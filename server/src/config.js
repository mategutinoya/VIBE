import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT || 8787),
  dataDir: path.resolve(process.env.DATA_DIR || path.join(root, 'data')),
  webDist: path.resolve(process.env.WEB_DIST || path.join(root, '..', 'web', 'dist')),
  // En producción detrás de HTTPS: COOKIE_SECURE=1
  cookieSecure: process.env.COOKIE_SECURE === '1',
  sessionDays: 30,
  demoContent: process.env.DEMO_CONTENT !== 'off',
  duoTtlMs: 24 * 60 * 60 * 1000,
  limits: {
    imageBytes: 8 * 1024 * 1024,
    audioBytes: 3 * 1024 * 1024,
    audioMaxMs: 30_000,
    postText: 280,
    caption: 200,
    comment: 300,
    message: 1000,
    bio: 160,
  },
};
