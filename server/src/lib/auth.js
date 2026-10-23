import { config } from '../config.js';
import { get, run, now } from '../db.js';
import { HttpError } from './errors.js';
import { randomToken, sha256 } from './security.js';

export const COOKIE = 'vibe_session';

export function createSession(res, userId) {
  const token = randomToken();
  const t = now();
  const expires = t + config.sessionDays * 86400_000;
  run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', sha256(token), userId, t, expires);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.sessionDays * 86400_000,
    path: '/',
  });
}

export function destroySession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

/** Adjunta req.user si hay sesión válida. */
export function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    const row = get(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
      sha256(token),
      now(),
    );
    if (row) req.user = row;
  }
  next();
}

export function requireUser(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Inicia sesión para continuar', 'unauthenticated'));
  next();
}

/**
 * Protección CSRF: toda petición que modifica datos debe llevar la cabecera X-Vibe.
 * Un sitio ajeno no puede añadir cabeceras personalizadas sin un preflight CORS, que no permitimos.
 */
export function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-vibe') !== '1') return next(new HttpError(403, 'Petición rechazada', 'csrf'));
  next();
}
