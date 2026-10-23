import { Router } from 'express';
import { get, all, run, now } from '../db.js';
import { config } from '../config.js';
import { notFound, forbidden, HttpError } from '../lib/errors.js';
import { rateLimiter } from '../lib/security.js';
import { publicUser } from '../lib/serialize.js';
import { areFriends } from '../lib/social.js';
import { intId, text } from '../lib/validate.js';

const router = Router();
const msgLimit = rateLimiter({ windowMs: 60_000, max: 40 });

/** Conversaciones: una por persona, con el último mensaje y los no leídos. */
router.get('/', (req, res) => {
  const v = req.user.id;
  const rows = all(
    `WITH pairs AS (
       SELECT CASE WHEN sender_id = $v THEN recipient_id ELSE sender_id END AS other, MAX(id) AS last_id
       FROM messages WHERE sender_id = $v OR recipient_id = $v GROUP BY other
     )
     SELECT u.*, m.body AS last_body, m.created_at AS last_at, m.sender_id AS last_sender,
       (SELECT COUNT(*) FROM messages x WHERE x.sender_id = u.id AND x.recipient_id = $v AND x.read_at IS NULL) AS unread
     FROM pairs JOIN messages m ON m.id = pairs.last_id JOIN users u ON u.id = pairs.other
     WHERE NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = u.id AND b.blocked_id = $v) OR (b.blocker_id = $v AND b.blocked_id = u.id))
     ORDER BY m.id DESC LIMIT 50`,
    { v },
  );
  res.json({
    conversations: rows.map((r) => ({
      user: publicUser(r),
      lastMessage: { body: r.last_body, createdAt: r.last_at, mine: r.last_sender === v },
      unread: r.unread,
      canReply: areFriends(v, r.id),
    })),
  });
});

function peer(req) {
  const other = get('SELECT * FROM users WHERE id = ?', intId(req.params.userId, 'userId'));
  if (!other || get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', other.id, req.user.id)) throw notFound('Esta conversación no existe');
  return other;
}

router.get('/:userId', (req, res) => {
  const v = req.user.id;
  const other = peer(req);
  const after = Number(req.query.after) || 0;
  const rows = all(
    `SELECT * FROM messages WHERE id > ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
     ORDER BY id DESC LIMIT 100`,
    after, v, other.id, other.id, v,
  ).reverse();
  run('UPDATE messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL', now(), other.id, v);
  res.json({
    user: publicUser(other),
    canReply: areFriends(v, other.id),
    messages: rows.map((m) => ({ id: m.id, body: m.body, createdAt: m.created_at, mine: m.sender_id === v, readAt: m.read_at })),
  });
});

router.post('/:userId', (req, res) => {
  const v = req.user.id;
  const other = peer(req);
  if (!areFriends(v, other.id)) throw forbidden('Solo puedes enviar mensajes a tus amigos');
  if (!msgLimit(`m:${v}`)) throw new HttpError(429, 'Vas muy rápido. Espera un momento.', 'rate_limited');
  const body = text(req.body.body, { field: 'El mensaje', max: config.limits.message, required: true });
  const r = run('INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES (?, ?, ?, ?)', v, other.id, body, now());
  const m = get('SELECT * FROM messages WHERE id = ?', Number(r.lastInsertRowid));
  res.status(201).json({ message: { id: m.id, body: m.body, createdAt: m.created_at, mine: true, readAt: null } });
});

export default router;
