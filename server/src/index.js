import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import './db.js';
import { loadUser, requireUser, csrfGuard } from './lib/auth.js';
import { HttpError } from './lib/errors.js';
import { cleanupPendingMedia } from './lib/media.js';
import { seedDemo } from './lib/demo.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import userRoutes from './routes/users.js';
import friendRoutes, { safety } from './routes/friends.js';
import postRoutes from './routes/posts.js';
import mediaRoutes from './routes/media.js';
import duoRoutes from './routes/duo.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import demoRoutes from './routes/demo.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      // Cámara y micrófono solo para esta web; la geolocalización está desactivada por completo.
      'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; " +
        "script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
    });
    next();
  });

  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use('/api', loadUser, csrfGuard);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/me', requireUser, meRoutes);
  app.use('/api/users', requireUser, userRoutes);
  app.use('/api/friends', requireUser, friendRoutes);
  app.use('/api', requireUser, safety);
  app.use('/api/media', requireUser, mediaRoutes);
  app.use('/api/duo', requireUser, duoRoutes);
  app.use('/api/messages', requireUser, messageRoutes);
  app.use('/api/notifications', requireUser, notificationRoutes);
  app.use('/api/demo', requireUser, demoRoutes);
  app.use('/api', requireUser, postRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada', 'not_found')));

  // Cliente compilado (npm run build en /web). Las rutas desconocidas devuelven index.html (SPA).
  if (fs.existsSync(config.webDist)) {
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(config.webDist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'El archivo es demasiado grande', code: 'too_large' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Petición mal formada', code: 'bad_json' });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error(err);
    res.status(500).json({ error: 'Algo salió mal. Inténtalo de nuevo.', code: 'server_error' });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  if (config.demoContent) seedDemo();
  cleanupPendingMedia();
  setInterval(cleanupPendingMedia, 3600_000).unref();
  createApp().listen(config.port, () => console.log(`VIBE API escuchando en http://localhost:${config.port}`));
}
