import { Router } from 'express';
import { get, all } from '../db.js';
import { notFound } from '../lib/errors.js';
import { publicUser, serializePosts, POST_SELECT, VISIBLE } from '../lib/serialize.js';
import { relationship, mutualCount, areFriends } from '../lib/social.js';
import { optionalCursor } from '../lib/validate.js';

const router = Router();

/** Búsqueda por usuario o nombre. Quien desactiva "aparecer en búsquedas" solo sale con su usuario exacto. */
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase().replace(/^@/, '').slice(0, 40);
  if (q.length < 2) return res.json({ users: [] });
  const like = `${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = all(
    `SELECT u.* FROM users u
     WHERE u.id != $v
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = u.id AND b.blocked_id = $v) OR (b.blocker_id = $v AND b.blocked_id = u.id))
       AND (
         u.username = $q
         OR ((u.discoverable = 1 OR EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = $v AND f.friend_id = u.id))
             AND (u.username LIKE $like ESCAPE '\\' OR lower(u.display_name) LIKE $like ESCAPE '\\'
                  OR lower(u.display_name) LIKE '% ' || $like ESCAPE '\\'))
       )
     ORDER BY (u.username = $q) DESC, u.is_demo ASC, u.username LIMIT 20`,
    { v: req.user.id, q, like },
  );
  res.json({
    users: rows.map((u) => ({ ...publicUser(u), relationship: relationship(req.user.id, u.id), mutuals: mutualCount(req.user.id, u.id) })),
  });
});

function findVisibleUser(viewerId, username) {
  const u = get('SELECT * FROM users WHERE username = ?', String(username));
  if (!u) throw notFound('Este perfil no existe');
  // Quien te bloqueó desaparece para ti
  if (get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', u.id, viewerId)) throw notFound('Este perfil no existe');
  return u;
}

router.get('/:username', (req, res) => {
  const v = req.user.id;
  const u = findVisibleUser(v, req.params.username);
  const rel = relationship(v, u.id);
  const isFriend = rel.status === 'friends';
  const canSeeAll = rel.status === 'self' || isFriend;
  res.json({
    user: {
      ...publicUser(u),
      bio: u.bio,
      isPrivate: !!u.is_private,
      joinedAt: u.created_at,
    },
    relationship: rel,
    stats: {
      // El número de amigos solo lo ven sus amigos o perfiles públicos
      friends: canSeeAll || !u.is_private ? get('SELECT COUNT(*) AS n FROM friendships WHERE user_id = ?', u.id).n : null,
      mutuals: rel.status === 'self' ? null : mutualCount(v, u.id),
      duosTogether: isFriend
        ? get(
            `SELECT COUNT(*) AS n FROM duos WHERE revealed_at IS NOT NULL AND ((user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?))`,
            v, u.id, u.id, v,
          ).n
        : null,
    },
    canMessage: isFriend,
    postsHidden: !canSeeAll && !!u.is_private,
  });
});

router.get('/:username/posts', (req, res) => {
  const v = req.user.id;
  const u = findVisibleUser(v, req.params.username);
  const rows = all(
    `${POST_SELECT} WHERE p.author_id = $a AND p.id < $before AND ${VISIBLE} ORDER BY p.id DESC LIMIT 18`,
    { a: u.id, v, before: optionalCursor(req.query.before) },
  );
  res.json({ posts: serializePosts(rows, v), nextCursor: rows.length === 18 ? rows.at(-1).id : null });
});

router.get('/:username/friends', (req, res) => {
  const v = req.user.id;
  const u = findVisibleUser(v, req.params.username);
  if (u.id !== v && u.is_private && !areFriends(v, u.id)) return res.json({ users: [] });
  const rows = all(
    `SELECT u.* FROM friendships f JOIN users u ON u.id = f.friend_id
     WHERE f.user_id = ? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = u.id AND b.blocked_id = ?)
     ORDER BY u.display_name COLLATE NOCASE`,
    u.id, v,
  );
  res.json({ users: rows.map(publicUser) });
});

export default router;
