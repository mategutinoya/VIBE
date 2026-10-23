import { Router } from 'express';
import { get, all, run, now, tx } from '../db.js';
import { badRequest, notFound, forbidden } from '../lib/errors.js';
import { publicUser } from '../lib/serialize.js';
import { areFriends, isBlockedEither, makeFriends, unfriend, notify, mutualCount } from '../lib/social.js';
import { intId, text, oneOf } from '../lib/validate.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = all(
    `SELECT u.*, f.created_at AS since FROM friendships f JOIN users u ON u.id = f.friend_id
     WHERE f.user_id = ? ORDER BY u.display_name COLLATE NOCASE`,
    req.user.id,
  );
  res.json({ users: rows.map((u) => ({ ...publicUser(u), since: u.since })) });
});

router.get('/requests', (req, res) => {
  const v = req.user.id;
  const incoming = all(
    `SELECT r.id AS request_id, r.created_at AS requested_at, u.* FROM friend_requests r JOIN users u ON u.id = r.from_id
     WHERE r.to_id = ? ORDER BY r.created_at DESC`,
    v,
  );
  const outgoing = all(
    `SELECT r.id AS request_id, r.created_at AS requested_at, u.* FROM friend_requests r JOIN users u ON u.id = r.to_id
     WHERE r.from_id = ? ORDER BY r.created_at DESC`,
    v,
  );
  const shape = (u) => ({ ...publicUser(u), requestId: u.request_id, requestedAt: u.requested_at, mutuals: mutualCount(v, u.id) });
  res.json({ incoming: incoming.map(shape), outgoing: outgoing.map(shape) });
});

router.post('/requests', (req, res) => {
  const v = req.user.id;
  const targetId = intId(req.body.userId, 'userId');
  const target = get('SELECT * FROM users WHERE id = ?', targetId);
  if (!target || targetId === v || isBlockedEither(v, targetId)) throw notFound('Este perfil no existe');
  if (areFriends(v, targetId)) return res.json({ status: 'friends' });
  // Si el otro ya te había enviado solicitud, se acepta automáticamente
  const reverse = get('SELECT id FROM friend_requests WHERE from_id = ? AND to_id = ?', targetId, v);
  if (reverse) {
    tx(() => {
      makeFriends(v, targetId);
      notify(targetId, v, 'friend_accept');
    });
    return res.json({ status: 'friends' });
  }
  if (target.allow_requests === 'fof' && mutualCount(v, targetId) === 0 && !target.is_demo) {
    throw forbidden('Esta persona solo acepta solicitudes de amigos de sus amigos');
  }
  const pending = get('SELECT COUNT(*) AS n FROM friend_requests WHERE from_id = ? AND created_at > ?', v, now() - 86400_000).n;
  if (pending >= 60) throw badRequest('Has enviado muchas solicitudes hoy. Vuelve a intentarlo mañana.');
  tx(() => {
    const r = run('INSERT OR IGNORE INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)', v, targetId, now());
    if (r.changes) notify(targetId, v, 'friend_request');
    // Las cuentas demo aceptan al instante para que puedas probar la app
    if (target.is_demo) makeFriends(v, targetId);
  });
  res.status(201).json({ status: target.is_demo ? 'friends' : 'outgoing' });
});

router.post('/requests/:id/accept', (req, res) => {
  const r = get('SELECT * FROM friend_requests WHERE id = ? AND to_id = ?', intId(req.params.id), req.user.id);
  if (!r) throw notFound('La solicitud ya no existe');
  tx(() => {
    makeFriends(r.from_id, r.to_id);
    notify(r.from_id, r.to_id, 'friend_accept');
    run(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND actor_id = ? AND type = 'friend_request'`, now(), r.to_id, r.from_id);
  });
  res.json({ status: 'friends' });
});

/** Rechazar (destinatario) o cancelar (remitente). El remitente no recibe aviso del rechazo. */
router.delete('/requests/:id', (req, res) => {
  const v = req.user.id;
  const r = get('SELECT * FROM friend_requests WHERE id = ? AND (to_id = ? OR from_id = ?)', intId(req.params.id), v, v);
  if (!r) throw notFound('La solicitud ya no existe');
  tx(() => {
    run('DELETE FROM friend_requests WHERE id = ?', r.id);
    run(`DELETE FROM notifications WHERE type = 'friend_request' AND user_id = ? AND actor_id = ?`, r.to_id, r.from_id);
  });
  res.json({ ok: true });
});

router.delete('/:userId', (req, res) => {
  const other = intId(req.params.userId, 'userId');
  tx(() => unfriend(req.user.id, other));
  res.json({ ok: true });
});

/* ---------- Sugerencias: amigos de amigos ---------- */
router.get('/suggestions', (req, res) => {
  const v = req.user.id;
  const rows = all(
    `SELECT u.*, COUNT(*) AS mutuals FROM friendships f1
     JOIN friendships f2 ON f2.user_id = f1.friend_id
     JOIN users u ON u.id = f2.friend_id
     WHERE f1.user_id = $v AND f2.friend_id != $v AND u.discoverable = 1
       AND NOT EXISTS (SELECT 1 FROM friendships x WHERE x.user_id = $v AND x.friend_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM friend_requests r WHERE (r.from_id = $v AND r.to_id = u.id) OR (r.to_id = $v AND r.from_id = u.id))
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = u.id AND b.blocked_id = $v) OR (b.blocker_id = $v AND b.blocked_id = u.id))
     GROUP BY u.id ORDER BY mutuals DESC, u.id DESC LIMIT 12`,
    { v },
  );
  res.json({ users: rows.map((u) => ({ ...publicUser(u), mutuals: u.mutuals })) });
});

/* ---------- Círculos privados ---------- */
function validMembers(ownerId, ids) {
  if (!Array.isArray(ids)) throw badRequest('Miembros no válidos');
  const unique = [...new Set(ids.map((x) => intId(x, 'miembro')))];
  if (unique.length > 150) throw badRequest('Un círculo admite como máximo 150 personas');
  for (const id of unique) if (!areFriends(ownerId, id)) throw badRequest('Solo puedes añadir amigos a tus círculos');
  return unique;
}

function circleOut(c) {
  const members = all(
    'SELECT u.* FROM circle_members cm JOIN users u ON u.id = cm.user_id WHERE cm.circle_id = ? ORDER BY u.display_name COLLATE NOCASE',
    c.id,
  );
  return { id: c.id, name: c.name, members: members.map(publicUser), createdAt: c.created_at };
}

router.get('/circles', (req, res) => {
  const rows = all('SELECT * FROM circles WHERE owner_id = ? ORDER BY created_at', req.user.id);
  res.json({ circles: rows.map(circleOut) });
});

router.post('/circles', (req, res) => {
  const v = req.user.id;
  const name = text(req.body.name, { field: 'El nombre del círculo', max: 30, required: true, multiline: false });
  const members = validMembers(v, req.body.memberIds || []);
  if (get('SELECT COUNT(*) AS n FROM circles WHERE owner_id = ?', v).n >= 20) throw badRequest('Puedes tener hasta 20 círculos');
  const id = tx(() => {
    const r = run('INSERT INTO circles (owner_id, name, created_at) VALUES (?, ?, ?)', v, name, now());
    const cid = Number(r.lastInsertRowid);
    members.forEach((m) => run('INSERT INTO circle_members (circle_id, user_id) VALUES (?, ?)', cid, m));
    return cid;
  });
  res.status(201).json({ circle: circleOut(get('SELECT * FROM circles WHERE id = ?', id)) });
});

function ownCircle(req) {
  const c = get('SELECT * FROM circles WHERE id = ? AND owner_id = ?', intId(req.params.id), req.user.id);
  if (!c) throw notFound('Este círculo no existe');
  return c;
}

router.patch('/circles/:id', (req, res) => {
  const c = ownCircle(req);
  tx(() => {
    if (req.body.name !== undefined) {
      run('UPDATE circles SET name = ? WHERE id = ?', text(req.body.name, { field: 'El nombre del círculo', max: 30, required: true, multiline: false }), c.id);
    }
    if (req.body.memberIds !== undefined) {
      const members = validMembers(req.user.id, req.body.memberIds);
      run('DELETE FROM circle_members WHERE circle_id = ?', c.id);
      members.forEach((m) => run('INSERT INTO circle_members (circle_id, user_id) VALUES (?, ?)', c.id, m));
    }
  });
  res.json({ circle: circleOut(get('SELECT * FROM circles WHERE id = ?', c.id)) });
});

router.delete('/circles/:id', (req, res) => {
  const c = ownCircle(req);
  run('DELETE FROM circles WHERE id = ?', c.id);
  res.json({ ok: true });
});

/* ---------- Bloqueos y reportes ---------- */
export const safety = Router();

safety.post('/blocks', (req, res) => {
  const v = req.user.id;
  const other = intId(req.body.userId, 'userId');
  if (other === v) throw badRequest('No puedes bloquearte a ti mismo');
  if (!get('SELECT 1 FROM users WHERE id = ?', other)) throw notFound('Este perfil no existe');
  tx(() => {
    run('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', v, other, now());
    unfriend(v, other);
    run('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', v, other, other, v);
    run('DELETE FROM notifications WHERE user_id = ? AND actor_id = ?', v, other);
  });
  res.json({ ok: true });
});

safety.delete('/blocks/:userId', (req, res) => {
  run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', req.user.id, intId(req.params.userId, 'userId'));
  res.json({ ok: true });
});

const REPORT_REASONS = ['spam', 'acoso', 'contenido_inapropiado', 'suplantacion', 'menor_en_riesgo', 'otro'];

safety.post('/reports', (req, res) => {
  const v = req.user.id;
  const reason = oneOf(req.body.reason, REPORT_REASONS, 'El motivo');
  const details = text(req.body.details, { field: 'Los detalles', max: 500 });
  let targetUserId = req.body.userId ? intId(req.body.userId, 'userId') : null;
  const postId = req.body.postId ? intId(req.body.postId, 'postId') : null;
  if (postId) {
    const p = get('SELECT author_id FROM posts WHERE id = ?', postId);
    if (!p) throw notFound('La publicación no existe');
    targetUserId = p.author_id;
  }
  if (!targetUserId) throw badRequest('Indica qué quieres reportar');
  if (targetUserId === v) throw badRequest('No puedes reportarte a ti mismo');
  run(
    'INSERT INTO reports (reporter_id, target_user_id, post_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    v, targetUserId, postId, reason, details, now(),
  );
  res.status(201).json({ ok: true });
});

export default router;
