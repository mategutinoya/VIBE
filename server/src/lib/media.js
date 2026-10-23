import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { get, run, all, now } from '../db.js';
import { badRequest } from './errors.js';
import { randomToken } from './security.js';
import { VISIBLE } from './serialize.js';

const MEDIA_DIR = path.join(config.dataDir, 'media');

/** Detecta el tipo real por los bytes iniciales; nunca confiamos en el Content-Type del cliente. */
export function sniff(buf) {
  const ascii = (start, end) => buf.subarray(start, end).toString('latin1');
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return { kind: 'image', mime: 'image/png', ext: 'png' };
  if (buf.length > 4 && buf.readUInt32BE(0) === 0x1a45dfa3) return { kind: 'audio', mime: 'audio/webm', ext: 'webm' };
  if (ascii(0, 4) === 'OggS') return { kind: 'audio', mime: 'audio/ogg', ext: 'ogg' };
  if (ascii(4, 8) === 'ftyp') return { kind: 'audio', mime: 'audio/mp4', ext: 'm4a' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return { kind: 'audio', mime: 'audio/wav', ext: 'wav' };
  if (ascii(0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3' };
  return null;
}

/** Elimina metadatos EXIF/XMP/IPTC de un JPEG (incluida la ubicación GPS) sin recodificar. */
export function stripJpeg(buf) {
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    if (marker === 0xda) break; // Start of Scan: el resto son datos de imagen
    const len = buf.readUInt16BE(i + 2);
    const isMeta = marker === 0xe1 || marker === 0xed || marker === 0xfe; // APP1 (EXIF/XMP), APP13 (IPTC), COM
    if (!isMeta) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  out.push(buf.subarray(i));
  return Buffer.concat(out);
}

/** Elimina fragmentos de metadatos de un PNG (eXIf, tEXt, iTXt, zTXt, tIME). */
export function stripPng(buf) {
  const out = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString('latin1');
    const end = i + 12 + len;
    if (!['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'].includes(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(out);
}

function imageSize(buf, mime) {
  if (mime === 'image/png') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  let i = 2;
  while (i + 9 < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return { width: null, height: null };
}

export function storeMedia(ownerId, buffer, { durationMs, waveform, purpose = 'pending' } = {}) {
  const type = sniff(buffer);
  if (!type) throw badRequest('Formato de archivo no admitido');
  let buf = buffer;
  let dims = { width: null, height: null };
  let duration = null;
  let wave = null;
  if (type.kind === 'image') {
    if (buf.length > config.limits.imageBytes) throw badRequest('La imagen es demasiado grande (máx. 8 MB)');
    buf = type.mime === 'image/jpeg' ? stripJpeg(buf) : stripPng(buf);
    dims = imageSize(buf, type.mime);
  } else {
    if (buf.length > config.limits.audioBytes) throw badRequest('El audio es demasiado largo');
    duration = Math.max(0, Math.min(Number(durationMs) || 0, config.limits.audioMaxMs + 1500));
    if (Array.isArray(waveform)) {
      wave = JSON.stringify(waveform.slice(0, 48).map((x) => Math.max(0, Math.min(1, Number(x) || 0))).map((x) => Math.round(x * 100) / 100));
    }
  }
  const id = randomToken(18);
  const fileName = `${id}.${type.ext}`;
  fs.writeFileSync(path.join(MEDIA_DIR, fileName), buf);
  run(
    `INSERT INTO media (id, owner_id, kind, purpose, mime, file_name, size, width, height, duration_ms, waveform, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, ownerId, type.kind, purpose, type.mime, fileName, buf.length, dims.width, dims.height, duration, wave, now(),
  );
  return get('SELECT * FROM media WHERE id = ?', id);
}

/** Reclama un media subido por el usuario para un uso concreto. Verifica dueño, tipo y que no se haya usado. */
export function claimMedia(mediaId, ownerId, kind, purpose) {
  const m = get('SELECT * FROM media WHERE id = ?', String(mediaId || ''));
  if (!m || m.owner_id !== ownerId || m.purpose !== 'pending') throw badRequest('Archivo no válido o ya utilizado');
  if (m.kind !== kind) throw badRequest(kind === 'image' ? 'Se esperaba una imagen' : 'Se esperaba un audio');
  run('UPDATE media SET purpose = ? WHERE id = ?', purpose, m.id);
  return m;
}

/** ¿Puede este usuario descargar el archivo? Reglas idénticas a las del contenido que lo contiene. */
export function canAccessMedia(m, viewerId) {
  if (m.owner_id === viewerId) return true;
  switch (m.purpose) {
    case 'avatar':
      return !get(
        'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
        m.owner_id, viewerId, viewerId, m.owner_id,
      );
    case 'post':
      return !!get(`SELECT 1 FROM posts p JOIN users u ON u.id = p.author_id WHERE p.media_id = $m AND ${VISIBLE}`, { m: m.id, v: viewerId });
    case 'duo':
      return !!get(
        `SELECT 1 FROM duo_answers a JOIN duos d ON d.id = a.duo_id
         WHERE a.media_id = ? AND d.revealed_at IS NOT NULL AND (d.user_a = ? OR d.user_b = ?)`,
        m.id, viewerId, viewerId,
      );
    default:
      return false;
  }
}

export const mediaPath = (m) => path.join(MEDIA_DIR, m.file_name);

export function deleteMediaFile(m) {
  if (!m) return;
  fs.rm(mediaPath(m), { force: true }, () => {});
  run('DELETE FROM media WHERE id = ?', m.id);
}

/** Limpia archivos subidos que nunca se usaron (borradores abandonados). */
export function cleanupPendingMedia() {
  const old = all(`SELECT * FROM media WHERE purpose = 'pending' AND created_at < ?`, now() - 6 * 3600_000);
  old.forEach(deleteMediaFile);
}
