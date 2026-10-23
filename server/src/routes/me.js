import { Router } from 'express';
import { get, all, run, now, tx } from '../db.js';
import { destroySession } from '../lib/auth.js';
import { badRequest, HttpError } from '../lib/errors.js';
import { claimMedia, deleteMediaFile } from '../lib/media.js';
import { verifyPassword } from '../lib/security.js';
import { selfUser, publicUser } from '../lib/serialize.js';
import { activeDuos } from '../lib/duo.js';
import { text, oneOf } from '../lib/validate.js';
import { config } from '../config.js';

const router = Router();

router.get('/', (req, res) => res.json({ user: selfUser(req.user) }));

router.patch('/', (req, res) => {
  const u = req.user;
  const b = req.body;
  const fields = {};
  if (b.displayName !== undefined) fields.display_name = text(b.displayName, { field: 'El nombre', max: 40, required: true, multiline: false });
  if (b.bio !== undefined) fields.bio = text(b.bio, { field: 'La biografía', max: config.limits.bio });
  if (b.isPrivate !== undefined) fields.is_private = b.isPrivate ? 1 : 0;
  if (b.discoverable !== undefined) fields.discoverable = b.discoverable ? 1 : 0;
  if (b.allowRequests !== undefined) fields.allow_requests = oneOf(b.allowRequests, ['everyone', 'fof'], 'allowRequests');
  tx(() => {
    if (b.avatarMediaId !== undefined) {
      const old = u.avatar_media_id && get('SELECT * FROM media WHERE id = ?', u.avatar_media_id);
      if (b.avatarMediaId === null) {
        fields.avatar_media_id = null;
      } else {
        fields.avatar_media_id = claimMedia(b.avatarMediaId, u.id, 'image', 'avatar').id;
      }
      if (old) {
        run('UPDATE users SET avatar_media_id = NULL WHERE id = ?', u.id);
        deleteMediaFile(old);
      }
    }
    const keys = Object.keys(fields);
    if (keys.length) {
      run(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => fields[k]), u.id);
    }
  });
  res.json({ user: selfUser(get('SELECT * FROM users WHERE id = ?', u.id)) });
});

/** Contadores para la navegación. El cliente lo consulta periódicamente. */
router.get('/badges', (req, res) => {
  const id = req.user.id;
  const notifications = get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', id).n;
  const messages = get('SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND read_at IS NULL', id).n;
  const requests = get('SELECT COUNT(*) AS n FROM friend_requests WHERE to_id = ?', id).n;
  const pendingDuo = activeDuos(id).some(
    (d) => !get('SELECT 1 FROM duo_answers WHERE duo_id = ? AND user_id = ?', d.id, id),
  );
  res.json({ notifications, messages, requests, pendingDuo });
});

router.get('/blocked', (req, res) => {
  const rows = all(
    'SELECT u.* FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ? ORDER BY b.created_at DESC',
    req.user.id,
  );
  res.json({ users: rows.map(publicUser) });
});

/** Eliminar la cuenta y todos sus datos. Requiere la contraseña. */
router.delete('/', async (req, res) => {
  const ok = await verifyPassword(String(req.body?.password || ''), req.user.password_hash);
  if (!ok) throw new HttpError(401, 'Contraseña incorrecta', 'bad_credentials');
  const media = all('SELECT * FROM media WHERE owner_id = ?', req.user.id);
  tx(() => {
    run('UPDATE users SET avatar_media_id = NULL WHERE id = ?', req.user.id);
    media.forEach(deleteMediaFile);
    run('DELETE FROM users WHERE id = ?', req.user.id);
  });
  destroySession(req, res);
  res.json({ ok: true });
});

export default router;
