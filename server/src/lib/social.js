import { get, all, run, now } from '../db.js';

export const areFriends = (a, b) => !!get('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?', a, b);

export const isBlockedEither = (a, b) =>
  !!get(
    'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
    a, b, b, a,
  );

export const friendIds = (userId) => all('SELECT friend_id AS id FROM friendships WHERE user_id = ?', userId).map((r) => r.id);

export function makeFriends(a, b) {
  const t = now();
  run('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)', a, b, t);
  run('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)', b, a, t);
  run('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', a, b, b, a);
}

export function unfriend(a, b) {
  run('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', a, b, b, a);
  // Si ya no sois amigos, tampoco seguís en los círculos del otro
  run('DELETE FROM circle_members WHERE user_id = ? AND circle_id IN (SELECT id FROM circles WHERE owner_id = ?)', b, a);
  run('DELETE FROM circle_members WHERE user_id = ? AND circle_id IN (SELECT id FROM circles WHERE owner_id = ?)', a, b);
  // Un dúo sin revelar entre personas que ya no son amigas se cierra
  run(
    `UPDATE duos SET expires_at = ? WHERE revealed_at IS NULL AND expires_at > ?
     AND ((user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?))`,
    now(), now(), a, b, b, a,
  );
}

export const mutualCount = (a, b) =>
  get(
    `SELECT COUNT(*) AS n FROM friendships f1 JOIN friendships f2 ON f1.friend_id = f2.friend_id
     WHERE f1.user_id = ? AND f2.user_id = ?`,
    a, b,
  ).n;

/** Relación del espectador con otro usuario: self | friends | outgoing | incoming | blocked | none */
export function relationship(viewerId, otherId) {
  if (viewerId === otherId) return { status: 'self' };
  if (get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', viewerId, otherId)) return { status: 'blocked' };
  if (areFriends(viewerId, otherId)) return { status: 'friends' };
  const out = get('SELECT id FROM friend_requests WHERE from_id = ? AND to_id = ?', viewerId, otherId);
  if (out) return { status: 'outgoing', requestId: out.id };
  const inc = get('SELECT id FROM friend_requests WHERE from_id = ? AND to_id = ?', otherId, viewerId);
  if (inc) return { status: 'incoming', requestId: inc.id };
  return { status: 'none' };
}

export function notify(userId, actorId, type, { postId = null, duoId = null } = {}) {
  if (userId === actorId) return;
  // Evita duplicar la misma notificación sin leer (p. ej. cambiar de reacción varias veces)
  if (type === 'reaction') {
    run(
      `DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'reaction' AND post_id = ? AND read_at IS NULL`,
      userId, actorId, postId,
    );
  }
  run(
    'INSERT INTO notifications (user_id, actor_id, type, post_id, duo_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    userId, actorId, type, postId, duoId, now(),
  );
}
