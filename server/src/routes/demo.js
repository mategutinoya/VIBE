import { Router } from 'express';
import { tx } from '../db.js';
import { connectDemo, demoUserIds } from '../lib/demo.js';
import { areFriends, unfriend } from '../lib/social.js';
import { notFound } from '../lib/errors.js';

const router = Router();

router.get('/', (req, res) => {
  const ids = demoUserIds();
  res.json({ available: ids.length > 0, connected: ids.some((id) => areFriends(req.user.id, id)) });
});

/** Añade las cuentas demo como amigos para explorar la app antes de que lleguen tus amigos reales. */
router.post('/', (req, res) => {
  if (!demoUserIds().length) throw notFound('El contenido de demostración está desactivado');
  connectDemo(req.user.id);
  res.json({ connected: true });
});

router.delete('/', (req, res) => {
  tx(() => demoUserIds().forEach((id) => unfriend(req.user.id, id)));
  res.json({ connected: false });
});

export default router;
