import { Router } from 'express';
import { get, run, now, tx } from '../db.js';
import { createSession, destroySession } from '../lib/auth.js';
import { badRequest, HttpError } from '../lib/errors.js';
import { hashPassword, verifyPassword, inviteCode, rateLimiter } from '../lib/security.js';
import { selfUser } from '../lib/serialize.js';
import { makeFriends, notify, isBlockedEither } from '../lib/social.js';
import { text, USERNAME_RE } from '../lib/validate.js';

const router = Router();
const authLimit = rateLimiter({ windowMs: 15 * 60_000, max: Number(process.env.AUTH_RATE_MAX || 30) });
const RESERVED = new Set(['admin', 'vibe', 'soporte', 'support', 'moderacion', 'root', 'api', 'demo']);

function checkLimit(req) {
  if (!authLimit(`auth:${req.ip}`)) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.', 'rate_limited');
}

function normalizeUsername(u) {
  return String(u || '').trim().toLowerCase().replace(/^@/, '');
}

function usernameProblem(username) {
  if (!USERNAME_RE.test(username)) return 'Usa de 3 a 20 caracteres: letras minúsculas, números, punto o guion bajo';
  if (RESERVED.has(username)) return 'Ese nombre de usuario está reservado';
  if (get('SELECT 1 FROM users WHERE username = ?', username)) return 'Ese nombre de usuario ya está ocupado';
  return null;
}

/** Sesión actual sin error si no hay sesión (evita un 401 en cada arranque del cliente). */
router.get('/session', (req, res) => res.json({ user: req.user ? selfUser(req.user) : null }));

router.get('/username-available', (req, res) => {
  const username = normalizeUsername(req.query.u);
  const problem = usernameProblem(username);
  res.json({ available: !problem, reason: problem });
});

router.post('/signup', async (req, res) => {
  checkLimit(req);
  const username = normalizeUsername(req.body.username);
  const problem = usernameProblem(username);
  if (problem) throw badRequest(problem, 'username');
  const displayName = text(req.body.displayName, { field: 'El nombre', max: 40, required: true, multiline: false });
  const password = String(req.body.password || '');
  if (password.length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres', 'password');
  if (password.length > 200) throw badRequest('La contraseña es demasiado larga', 'password');
  if (password.toLowerCase().includes(username)) throw badRequest('La contraseña no puede contener tu usuario', 'password');
  if (req.body.ageConfirmed !== true) throw badRequest('Debes confirmar que tienes 13 años o más', 'age');

  const hash = await hashPassword(password);
  const userId = tx(() => {
    const r = run(
      `INSERT INTO users (username, display_name, password_hash, invite_code, created_at) VALUES (?, ?, ?, ?, ?)`,
      username, displayName, hash, inviteCode(), now(),
    );
    const id = Number(r.lastInsertRowid);
    // Si llegó con un enlace de invitación, os hacéis amigos directamente: ambos lo habéis elegido.
    const inviter = req.body.inviteCode && get('SELECT id FROM users WHERE invite_code = ?', String(req.body.inviteCode));
    if (inviter) {
      makeFriends(id, inviter.id);
      notify(inviter.id, id, 'invite_joined');
    }
    return id;
  });
  createSession(res, userId);
  res.status(201).json({ user: selfUser(get('SELECT * FROM users WHERE id = ?', userId)) });
});

router.post('/login', async (req, res) => {
  checkLimit(req);
  const username = normalizeUsername(req.body.username);
  const user = get('SELECT * FROM users WHERE username = ?', username);
  const ok = user && (await verifyPassword(String(req.body.password || ''), user.password_hash));
  if (!ok) throw new HttpError(401, 'Usuario o contraseña incorrectos', 'bad_credentials');
  createSession(res, user.id);
  res.json({ user: selfUser(user) });
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

/** Vista previa de un enlace de invitación (sin iniciar sesión): solo nombre y avatar. */
router.get('/invite/:code', (req, res) => {
  const u = get('SELECT username, display_name, avatar_media_id FROM users WHERE invite_code = ? AND is_demo = 0', req.params.code);
  if (!u) throw new HttpError(404, 'Esta invitación no existe o ha caducado', 'not_found');
  res.json({ inviter: { username: u.username, displayName: u.display_name } });
});

/** Aceptar una invitación estando ya registrado. */
router.post('/invite/:code/accept', (req, res) => {
  if (!req.user) throw new HttpError(401, 'Inicia sesión para continuar', 'unauthenticated');
  const inviter = get('SELECT id FROM users WHERE invite_code = ? AND is_demo = 0', req.params.code);
  if (!inviter) throw new HttpError(404, 'Esta invitación no existe', 'not_found');
  if (inviter.id === req.user.id) throw badRequest('Es tu propio enlace de invitación');
  if (isBlockedEither(inviter.id, req.user.id)) throw new HttpError(404, 'Esta invitación no existe', 'not_found');
  tx(() => {
    makeFriends(req.user.id, inviter.id);
    notify(inviter.id, req.user.id, 'invite_joined');
  });
  res.json({ ok: true });
});

export default router;
