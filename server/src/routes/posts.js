import { Router } from 'express';
import { get, all, run, now, tx } from '../db.js';
import { config } from '../config.js';
import { badRequest, notFound, forbidden, HttpError } from '../lib/errors.js';
import { claimMedia, deleteMediaFile } from '../lib/media.js';
import { rateLimiter } from '../lib/security.js';
import { serializePosts, publicUser, POST_SELECT, VISIBLE } from '../lib/serialize.js';
import { notify } from '../lib/social.js';
import { intId, text, oneOf, optionalCursor, REACTIONS } from '../lib/validate.js';

const router = Router();
const writeLimit = rateLimiter({ windowMs: 60_000, max: 30 });

function limitWrites(req) {
  if (!writeLimit(`w:${req.user.id}`)) throw new HttpError(429, 'Vas muy rápido. Espera un momento.', 'rate_limited');
}

const PAGE = 15;

/** Inicio: publicaciones tuyas y de tus amigos que puedes ver, en orden cronológico. Sin algoritmo. */
router.get('/feed', (req, res) => {
  const v = req.user.id;
  const rows = all(
    `${POST_SELECT}
     WHERE p.id < $before
       AND (p.author_id = $v OR p.author_id IN (SELECT friend_id FROM friendships WHERE user_id = $v))
       AND ${VISIBLE}
     ORDER BY p.id DESC LIMIT ${PAGE}`,
    { v, before: optionalCursor(req.query.before) },
  );
  res.json({ posts: serializePosts(rows, v), nextCursor: rows.length === PAGE ? rows.at(-1).id : null });
});

/**
 * Descubrir: vibes públicos de cuentas públicas que no son tus amigos.
 * Máximo 2 por persona por página para que ninguna voz acapare la pantalla.
 */
router.get('/discover', (req, res) => {
  const v = req.user.id;
  const before = optionalCursor(req.query.before);
  const rows = all(
    `${POST_SELECT}
     WHERE p.id < $before AND p.audience = 'public' AND u.is_private = 0 AND p.author_id != $v
       AND NOT EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = $v AND f.friend_id = p.author_id)
       AND ${VISIBLE}
     ORDER BY p.id DESC LIMIT 60`,
    { v, before },
  );
  const perAuthor = new Map();
  const picked = [];
  for (const r of rows) {
    const n = perAuthor.get(r.author_id) || 0;
    if (n >= 2) continue;
    perAuthor.set(r.author_id, n + 1);
    picked.push(r);
    if (picked.length === 24) break;
  }
  const lastScanned = rows.length === 60 ? rows.at(-1).id : picked.length === 24 ? picked.at(-1).id : null;

  let people = [];
  if (before === Number.MAX_SAFE_INTEGER) {
    // Personas: primero amigos de amigos, luego cuentas públicas que quieren ser descubiertas.
    people = all(
      `SELECT u.*, (SELECT COUNT(*) FROM friendships f1 JOIN friendships f2 ON f1.friend_id = f2.friend_id
                    WHERE f1.user_id = $v AND f2.user_id = u.id) AS mutuals
       FROM users u
       WHERE u.id != $v AND u.discoverable = 1
         AND NOT EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = $v AND f.friend_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM friend_requests r WHERE r.from_id = $v AND r.to_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = u.id AND b.blocked_id = $v) OR (b.blocker_id = $v AND b.blocked_id = u.id))
         AND (u.is_private = 0 OR EXISTS (SELECT 1 FROM friendships f1 JOIN friendships f2 ON f1.friend_id = f2.friend_id
                                          WHERE f1.user_id = $v AND f2.user_id = u.id))
       ORDER BY mutuals DESC, u.is_demo ASC, u.created_at DESC LIMIT 12`,
      { v },
    ).map((u) => ({ ...publicUser(u), mutuals: u.mutuals, bio: u.bio }));
  }
  res.json({ posts: serializePosts(picked, v), people, nextCursor: lastScanned });
});

function visiblePost(id, v) {
  const row = get(`${POST_SELECT} WHERE p.id = $id AND ${VISIBLE}`, { id, v });
  if (!row) throw notFound('Esta publicación no existe o no tienes acceso');
  return row;
}

router.get('/posts/:id', (req, res) => {
  const row = visiblePost(intId(req.params.id), req.user.id);
  res.json({ post: serializePosts([row], req.user.id)[0] });
});

router.post('/posts', (req, res) => {
  limitWrites(req);
  const v = req.user.id;
  const kind = oneOf(req.body.kind, ['photo', 'text', 'audio'], 'El tipo');
  const audience = oneOf(req.body.audience || 'friends', ['friends', 'circle', 'public'], 'La audiencia');
  const body = text(req.body.body, {
    field: kind === 'text' ? 'El pensamiento' : 'El texto',
    max: kind === 'text' ? config.limits.postText : config.limits.caption,
    required: kind === 'text',
  });
  let circleId = null;
  if (audience === 'circle') {
    circleId = intId(req.body.circleId, 'circleId');
    if (!get('SELECT 1 FROM circles WHERE id = ? AND owner_id = ?', circleId, v)) throw badRequest('Ese círculo no existe');
  }
  if (audience === 'public' && req.user.is_private) {
    throw badRequest('Tu cuenta es privada. Cámbiala a pública en Ajustes para publicar en Descubrir.');
  }
  const id = tx(() => {
    let mediaId = null;
    if (kind !== 'text') mediaId = claimMedia(req.body.mediaId, v, kind === 'photo' ? 'image' : 'audio', 'post').id;
    const r = run(
      'INSERT INTO posts (author_id, kind, body, media_id, audience, circle_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      v, kind, body, mediaId, audience, circleId, now(),
    );
    return Number(r.lastInsertRowid);
  });
  res.status(201).json({ post: serializePosts([visiblePost(id, v)], v)[0] });
});

router.delete('/posts/:id', (req, res) => {
  const p = get('SELECT * FROM posts WHERE id = ?', intId(req.params.id));
  if (!p) throw notFound();
  if (p.author_id !== req.user.id) throw forbidden();
  const media = p.media_id && get('SELECT * FROM media WHERE id = ?', p.media_id);
  tx(() => {
    run('DELETE FROM posts WHERE id = ?', p.id);
    deleteMediaFile(media);
  });
  res.json({ ok: true });
});

router.put('/posts/:id/reaction', (req, res) => {
  const v = req.user.id;
  const p = visiblePost(intId(req.params.id), v);
  const emoji = oneOf(req.body.emoji, REACTIONS, 'La reacción');
  tx(() => {
    run(
      `INSERT INTO reactions (post_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (post_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at`,
      p.id, v, emoji, now(),
    );
    notify(p.author_id, v, 'reaction', { postId: p.id });
  });
  res.json({ post: serializePosts([visiblePost(p.id, v)], v)[0] });
});

router.delete('/posts/:id/reaction', (req, res) => {
  const v = req.user.id;
  const p = visiblePost(intId(req.params.id), v);
  run('DELETE FROM reactions WHERE post_id = ? AND user_id = ?', p.id, v);
  run(`DELETE FROM notifications WHERE type = 'reaction' AND post_id = ? AND actor_id = ? AND read_at IS NULL`, p.id, v);
  res.json({ post: serializePosts([visiblePost(p.id, v)], v)[0] });
});

router.get('/posts/:id/reactions', (req, res) => {
  const v = req.user.id;
  const p = visiblePost(intId(req.params.id), v);
  const rows = all(
    `SELECT r.emoji, u.* FROM reactions r JOIN users u ON u.id = r.user_id WHERE r.post_id = ?
     AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = ? AND b.blocked_id = u.id)
     ORDER BY r.created_at DESC`,
    p.id, v,
  );
  res.json({ reactions: rows.map((r) => ({ emoji: r.emoji, user: publicUser(r) })) });
});

/* ---------- Respuestas ---------- */
const COMMENT_SELECT = `SELECT c.id, c.body, c.created_at, c.author_id, u.username, u.display_name, u.avatar_media_id, u.is_demo
  FROM comments c JOIN users u ON u.id = c.author_id`;

function commentOut(r, v, postAuthorId) {
  return {
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    author: publicUser({ ...r, id: r.author_id }),
    canDelete: r.author_id === v || postAuthorId === v,
  };
}

router.get('/posts/:id/comments', (req, res) => {
  const v = req.user.id;
  const p = visiblePost(intId(req.params.id), v);
  const rows = all(
    `${COMMENT_SELECT}
     WHERE c.post_id = ? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = c.author_id)
                                                                  OR (b.blocker_id = c.author_id AND b.blocked_id = ?))
     ORDER BY c.id`,
    p.id, v, v,
  );
  res.json({ comments: rows.map((r) => commentOut(r, v, p.author_id)) });
});

router.post('/posts/:id/comments', (req, res) => {
  limitWrites(req);
  const v = req.user.id;
  const p = visiblePost(intId(req.params.id), v);
  const body = text(req.body.body, { field: 'La respuesta', max: config.limits.comment, required: true });
  const id = tx(() => {
    const r = run('INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?, ?, ?, ?)', p.id, v, body, now());
    notify(p.author_id, v, 'comment', { postId: p.id });
    return Number(r.lastInsertRowid);
  });
  res.status(201).json({ comment: commentOut(get(`${COMMENT_SELECT} WHERE c.id = ?`, id), v, p.author_id) });
});

router.delete('/comments/:id', (req, res) => {
  const v = req.user.id;
  const c = get('SELECT c.*, p.author_id AS post_author FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?', intId(req.params.id));
  if (!c) throw notFound();
  if (c.author_id !== v && c.post_author !== v) throw forbidden();
  run('DELETE FROM comments WHERE id = ?', c.id);
  res.json({ ok: true });
});

export default router;
