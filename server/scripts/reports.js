// Lista los reportes abiertos y permite cerrarlos: npm run reports [-- --close <id>]
import { all, run } from '../src/db.js';

const i = process.argv.indexOf('--close');
if (i > -1) {
  run(`UPDATE reports SET status = 'closed' WHERE id = ?`, Number(process.argv[i + 1]));
  console.log(`Reporte ${process.argv[i + 1]} cerrado`);
}
const rows = all(
  `SELECT r.id, r.reason, r.details, r.post_id, r.created_at, a.username AS reporter, t.username AS target
   FROM reports r LEFT JOIN users a ON a.id = r.reporter_id LEFT JOIN users t ON t.id = r.target_user_id
   WHERE r.status = 'open' ORDER BY r.id`,
);
if (!rows.length) console.log('No hay reportes abiertos.');
for (const r of rows) {
  console.log(`#${r.id} · ${new Date(r.created_at).toISOString()} · @${r.reporter} → @${r.target} · ${r.reason}${r.post_id ? ` · post ${r.post_id}` : ''}`);
  if (r.details) console.log(`    "${r.details}"`);
}
