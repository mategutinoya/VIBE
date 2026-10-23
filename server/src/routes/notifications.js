import { Router } from 'express';
import { all, run, now } from '../db.js';
import { publicUser } from '../lib/serialize.js';

const router = Router();

router.get('/', (req, res) => {
  const v = req.user.id;
  const rows = all(
    `SELECT n.*, u.username, u.display_name, u.avatar_media_id, u.is_demo,
       p.kind AS post_kind, substr(p.body, 1, 80) AS post_excerpt
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     LEFT JOIN posts p ON p.id = n.post_id
     WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 60`,
    v,
  );
  res.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      createdAt: n.created_at,
      read: !!n.read_at,
      actor: n.actor_id ? publicUser({ ...n, id: n.actor_id }) : null,
      postId: n.post_id,
      postKind: n.post_kind,
      postExcerpt: n.post_excerpt,
      duoId: n.duo_id,
    })),
  });
});

router.post('/read', (req, res) => {
  run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', now(), req.user.id);
  res.json({ ok: true });
});

export default router;
