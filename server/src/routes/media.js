import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { get } from '../db.js';
import { badRequest, notFound, HttpError } from '../lib/errors.js';
import { storeMedia, canAccessMedia, mediaPath } from '../lib/media.js';
import { rateLimiter } from '../lib/security.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.limits.imageBytes, files: 1 } });
const uploadLimit = rateLimiter({ windowMs: 60 * 60_000, max: 120 });

router.post('/', upload.single('file'), (req, res) => {
  if (!uploadLimit(`u:${req.user.id}`)) throw new HttpError(429, 'Has subido demasiados archivos. Espera un poco.', 'rate_limited');
  if (!req.file) throw badRequest('No se recibió ningún archivo');
  let waveform;
  try {
    waveform = req.body.waveform ? JSON.parse(req.body.waveform) : undefined;
  } catch {
    waveform = undefined;
  }
  const m = storeMedia(req.user.id, req.file.buffer, { durationMs: req.body.durationMs, waveform });
  res.status(201).json({ media: { id: m.id, kind: m.kind, url: `/api/media/${m.id}`, width: m.width, height: m.height } });
});

router.get('/:id', (req, res) => {
  const m = get('SELECT * FROM media WHERE id = ?', req.params.id);
  // Misma respuesta si no existe o no tienes acceso: no revelamos qué archivos existen.
  if (!m || !canAccessMedia(m, req.user.id)) throw notFound();
  res.set('Cache-Control', 'private, max-age=86400, immutable');
  res.set('Content-Type', m.mime);
  res.sendFile(mediaPath(m), { headers: { 'Content-Type': m.mime } });
});

export default router;
