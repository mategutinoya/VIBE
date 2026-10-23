import { Router } from 'express';
import { get, run } from '../db.js';
import { config } from '../config.js';
import { badRequest, notFound } from '../lib/errors.js';
import { ensureDuo, getDuoFor, serializeDuo, submitAnswer, duoHistory } from '../lib/duo.js';
import { claimMedia } from '../lib/media.js';
import { notify } from '../lib/social.js';
import { intId, oneOf, text, optionalCursor, REACTIONS } from '../lib/validate.js';

const router = Router();

/** Dúo(s) activos. Si no tienes ninguno y tienes amigos, se crea uno nuevo. */
router.get('/', (req, res) => {
  const v = req.user.id;
  const duos = ensureDuo(v).map((d) => serializeDuo(d, v));
  const friends = get('SELECT COUNT(*) AS n FROM friendships WHERE user_id = ?', v).n;
  res.json({ duos, hasFriends: friends > 0 });
});

router.get('/history', (req, res) => {
  const v = req.user.id;
  const rows = duoHistory(v, optionalCursor(req.query.before));
  res.json({ duos: rows.map((d) => serializeDuo(d, v)), nextCursor: rows.length === 20 ? rows.at(-1).id : null });
});

router.get('/:id', (req, res) => {
  const d = getDuoFor(intId(req.params.id), req.user.id);
  if (!d) throw notFound('Este dúo no existe');
  res.json({ duo: serializeDuo(d, req.user.id) });
});

router.post('/:id/answer', (req, res) => {
  const v = req.user.id;
  const d = getDuoFor(intId(req.params.id), v);
  if (!d) throw notFound('Este dúo no existe');
  if (d.expires_at <= Date.now()) throw badRequest('Este dúo ya terminó. Mañana tendrás otro.');
  if (get('SELECT 1 FROM duo_answers WHERE duo_id = ? AND user_id = ?', d.id, v)) throw badRequest('Ya respondiste este dúo');
  const kind = oneOf(req.body.kind, ['photo', 'text', 'audio'], 'El tipo');
  const body = text(req.body.body, {
    field: 'La respuesta',
    max: kind === 'text' ? config.limits.postText : config.limits.caption,
    required: kind === 'text',
  });
  let mediaId = null;
  if (kind !== 'text') mediaId = claimMedia(req.body.mediaId, v, kind === 'photo' ? 'image' : 'audio', 'duo').id;
  submitAnswer(d, v, { kind, body, mediaId });
  res.json({ duo: serializeDuo(getDuoFor(d.id, v), v) });
});

/** Reaccionar a la respuesta del compañero (una vez revelado). */
router.put('/:id/reaction', (req, res) => {
  const v = req.user.id;
  const d = getDuoFor(intId(req.params.id), v);
  if (!d || !d.revealed_at) throw notFound('Este dúo no existe o aún no se ha revelado');
  const partner = d.user_a === v ? d.user_b : d.user_a;
  const emoji = req.body.emoji === null ? null : oneOf(req.body.emoji, REACTIONS, 'La reacción');
  run('UPDATE duo_answers SET reaction = ? WHERE duo_id = ? AND user_id = ?', emoji, d.id, partner);
  if (emoji) notify(partner, v, 'duo_reaction', { duoId: d.id });
  res.json({ duo: serializeDuo(d, v) });
});

export default router;
