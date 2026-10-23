import { all } from '../db.js';

export const mediaUrl = (id) => (id ? `/api/media/${id}` : null);

/** Vista pública mínima de un usuario. Nunca incluye datos privados (hash, ajustes, invitación). */
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatarUrl: mediaUrl(u.avatar_media_id),
    isDemo: !!u.is_demo,
  };
}

export function selfUser(u) {
  return {
    ...publicUser(u),
    bio: u.bio,
    isPrivate: !!u.is_private,
    discoverable: !!u.discoverable,
    allowRequests: u.allow_requests,
    inviteCode: u.invite_code,
    createdAt: u.created_at,
  };
}

export function mediaInfo(row, prefix = 'm_') {
  if (!row[`${prefix}id`]) return null;
  return {
    url: mediaUrl(row[`${prefix}id`]),
    mime: row[`${prefix}mime`],
    width: row[`${prefix}width`],
    height: row[`${prefix}height`],
    durationMs: row[`${prefix}duration_ms`],
    waveform: row[`${prefix}waveform`] ? JSON.parse(row[`${prefix}waveform`]) : null,
  };
}

export const MEDIA_COLUMNS = `m.id AS m_id, m.mime AS m_mime, m.width AS m_width, m.height AS m_height,
  m.duration_ms AS m_duration_ms, m.waveform AS m_waveform`;

/**
 * Convierte filas de posts (con columnas del autor y del media) en objetos de API,
 * cargando reacciones y número de respuestas en bloque.
 */
export function serializePosts(rows, viewerId) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => '?').join(',');
  const reactionRows = all(
    `SELECT post_id, emoji, COUNT(*) AS n, MAX(user_id = ?) AS mine FROM reactions
     WHERE post_id IN (${marks}) GROUP BY post_id, emoji ORDER BY n DESC`,
    viewerId, ...ids,
  );
  const commentRows = all(`SELECT post_id, COUNT(*) AS n FROM comments WHERE post_id IN (${marks}) GROUP BY post_id`, ...ids);
  const reactions = new Map();
  for (const r of reactionRows) {
    if (!reactions.has(r.post_id)) reactions.set(r.post_id, []);
    reactions.get(r.post_id).push({ emoji: r.emoji, count: r.n, mine: !!r.mine });
  }
  const comments = new Map(commentRows.map((r) => [r.post_id, r.n]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    audience: r.audience,
    circle: r.author_id === viewerId && r.circle_id ? { id: r.circle_id, name: r.circle_name } : null,
    createdAt: r.created_at,
    author: publicUser({
      id: r.author_id,
      username: r.a_username,
      display_name: r.a_display_name,
      avatar_media_id: r.a_avatar_media_id,
      is_demo: r.a_is_demo,
    }),
    media: mediaInfo(r),
    reactions: reactions.get(r.id) || [],
    myReaction: (reactions.get(r.id) || []).find((x) => x.mine)?.emoji || null,
    commentCount: comments.get(r.id) || 0,
    isMine: r.author_id === viewerId,
  }));
}

export const POST_SELECT = `SELECT p.*, u.username AS a_username, u.display_name AS a_display_name,
  u.avatar_media_id AS a_avatar_media_id, u.is_demo AS a_is_demo, c.name AS circle_name, ${MEDIA_COLUMNS}
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN media m ON m.id = p.media_id
  LEFT JOIN circles c ON c.id = p.circle_id`;

/**
 * Predicado SQL de visibilidad de un post para el espectador $v.
 * Es la única fuente de verdad sobre quién puede ver qué.
 */
export const VISIBLE = `(
  p.author_id = $v OR (
    NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = p.author_id AND b.blocked_id = $v)
                                          OR (b.blocker_id = $v AND b.blocked_id = p.author_id))
    AND (
      (p.audience = 'public' AND u.is_private = 0)
      OR (p.audience IN ('public','friends')
          AND EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = $v AND f.friend_id = p.author_id))
      OR (p.audience = 'circle'
          AND EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = $v AND f.friend_id = p.author_id)
          AND EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = p.circle_id AND cm.user_id = $v))
    )
  )
)`;
