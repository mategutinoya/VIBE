import { config } from '../config.js';
import { get, all, run, now, tx } from '../db.js';
import { PROMPTS, promptById, DEMO_ANSWERS } from './prompts.js';
import { notify } from './social.js';
import { publicUser, mediaInfo } from './serialize.js';

/**
 * EL DÚO — la mecánica central de VIBE.
 * Cada 24 h formas pareja con un amigo. Los dos reciben la misma pregunta.
 * Ninguno ve la respuesta del otro hasta que ambos han contestado.
 */

export function activeDuos(userId) {
  return all(
    `SELECT * FROM duos WHERE (user_a = ? OR user_b = ?) AND expires_at > ? ORDER BY created_at DESC`,
    userId, userId, now(),
  );
}

function pickPrompt(a, b) {
  const recent = new Set(
    all(
      `SELECT prompt_id FROM duos WHERE user_a IN (?, ?) OR user_b IN (?, ?) ORDER BY created_at DESC LIMIT 15`,
      a, b, a, b,
    ).map((r) => r.prompt_id),
  );
  const pool = PROMPTS.filter((p) => !recent.has(p.id));
  const list = pool.length ? pool : PROMPTS;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Garantiza que el usuario tiene un dúo activo si tiene al menos un amigo.
 * Prioriza amigos que hoy no tienen dúo y con los que hace más tiempo que no coincides.
 */
export function ensureDuo(userId) {
  const active = activeDuos(userId);
  if (active.length) return active;
  const t = now();
  const candidates = all(
    `SELECT f.friend_id AS id,
       (SELECT COUNT(*) FROM duos d WHERE (d.user_a = f.friend_id OR d.user_b = f.friend_id) AND d.expires_at > $t) AS busy,
       (SELECT MAX(created_at) FROM duos d WHERE (d.user_a = $u AND d.user_b = f.friend_id) OR (d.user_b = $u AND d.user_a = f.friend_id)) AS last
     FROM friendships f WHERE f.user_id = $u`,
    { u: userId, t },
  );
  if (!candidates.length) return [];
  candidates.forEach((c) => (c.rand = Math.random()));
  candidates.sort((x, y) => x.busy - y.busy || (x.last ?? 0) - (y.last ?? 0) || x.rand - y.rand);
  const partner = candidates[0].id;
  const prompt = pickPrompt(userId, partner);
  const id = tx(() => {
    const r = run(
      'INSERT INTO duos (user_a, user_b, prompt_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      userId, partner, prompt.id, t, t + config.duoTtlMs,
    );
    notify(partner, userId, 'duo_new', { duoId: Number(r.lastInsertRowid) });
    return Number(r.lastInsertRowid);
  });
  return [get('SELECT * FROM duos WHERE id = ?', id)];
}

export function getDuoFor(duoId, userId) {
  const d = get('SELECT * FROM duos WHERE id = ?', duoId);
  if (!d || (d.user_a !== userId && d.user_b !== userId)) return null;
  return d;
}

export function serializeDuo(d, viewerId) {
  const partnerId = d.user_a === viewerId ? d.user_b : d.user_a;
  const partner = get('SELECT * FROM users WHERE id = ?', partnerId);
  const answers = all(
    `SELECT a.*, m.id AS m_id, m.mime AS m_mime, m.width AS m_width, m.height AS m_height,
       m.duration_ms AS m_duration_ms, m.waveform AS m_waveform
     FROM duo_answers a LEFT JOIN media m ON m.id = a.media_id WHERE a.duo_id = ?`,
    d.id,
  );
  const mine = answers.find((a) => a.user_id === viewerId);
  const theirs = answers.find((a) => a.user_id === partnerId);
  const revealed = !!d.revealed_at;
  const shape = (a) => a && {
    kind: a.kind,
    body: a.body,
    media: mediaInfo(a),
    reaction: a.reaction,
    createdAt: a.created_at,
    auto: !!partner.is_demo && a.user_id === partnerId,
  };
  const prompt = promptById(d.prompt_id);
  const togetherCount = get(
    `SELECT COUNT(*) AS n FROM duos WHERE revealed_at IS NOT NULL AND
     ((user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?))`,
    viewerId, partnerId, partnerId, viewerId,
  ).n;
  return {
    id: d.id,
    prompt: { text: prompt.text, hint: prompt.hint },
    partner: publicUser(partner),
    createdAt: d.created_at,
    expiresAt: d.expires_at,
    expired: d.expires_at <= now(),
    revealed,
    revealedAt: d.revealed_at,
    mine: shape(mine) || null,
    // Antes de revelar, solo decimos SI el otro respondió, nunca QUÉ respondió.
    partnerAnswered: !!theirs,
    theirs: revealed ? shape(theirs) : null,
    togetherCount,
  };
}

export function submitAnswer(d, userId, { kind, body, mediaId }) {
  const partnerId = d.user_a === userId ? d.user_b : d.user_a;
  const t = now();
  tx(() => {
    run(
      'INSERT INTO duo_answers (duo_id, user_id, kind, body, media_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      d.id, userId, kind, body, mediaId, t,
    );
    const partner = get('SELECT is_demo FROM users WHERE id = ?', partnerId);
    if (partner?.is_demo && !get('SELECT 1 FROM duo_answers WHERE duo_id = ? AND user_id = ?', d.id, partnerId)) {
      // Las cuentas demo responden automáticamente para que puedas probar la revelación.
      run(
        `INSERT INTO duo_answers (duo_id, user_id, kind, body, created_at) VALUES (?, ?, 'text', ?, ?)`,
        d.id, partnerId, DEMO_ANSWERS[d.id % DEMO_ANSWERS.length], t,
      );
    }
    const count = get('SELECT COUNT(*) AS n FROM duo_answers WHERE duo_id = ?', d.id).n;
    if (count === 2) {
      run('UPDATE duos SET revealed_at = ? WHERE id = ?', t, d.id);
      notify(partnerId, userId, 'duo_revealed', { duoId: d.id });
    } else {
      notify(partnerId, userId, 'duo_answered', { duoId: d.id });
    }
  });
}

export function duoHistory(userId, before, limit = 20) {
  return all(
    `SELECT * FROM duos WHERE (user_a = ? OR user_b = ?) AND id < ? AND expires_at <= ?
     ORDER BY id DESC LIMIT ?`,
    userId, userId, before, now(), limit,
  );
}
