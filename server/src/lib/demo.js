import { get, all, run, now, tx } from '../db.js';
import { inviteCode } from './security.js';
import { storeMedia } from './media.js';
import { artPng, melodyWav } from './demoart.js';
import { makeFriends } from './social.js';

/**
 * Contenido de demostración. Todas las cuentas terminan en ".demo", llevan la marca is_demo
 * y la interfaz las etiqueta como DEMO. No pueden iniciar sesión.
 */
const PEOPLE = [
  { u: 'lucia.demo', n: 'Lucía Marín', bio: 'fotos borrosas y playlists largas', av: ['#2a1b5c', '#c06bff', '#ff9ad5'] },
  { u: 'dani.demo', n: 'Dani Rivas', bio: 'skate, café, repetir', av: ['#0d2a4a', '#3fa3ff', '#7cf2d6'] },
  { u: 'noa.demo', n: 'Noa Sky', bio: 'estudiando diseño · mirando el cielo', av: ['#3a1030', '#ff6a8a', '#ffc46b'] },
  { u: 'marco.demo', n: 'Marco López', bio: 'toco el bajo mal pero con ganas', av: ['#10213a', '#6d5cff', '#46d4ff'] },
  { u: 'sofi.demo', n: 'Sofía Ortega', bio: 'medicina y memes, en ese orden', av: ['#13281f', '#3ed598', '#c8ff6b'] },
  { u: 'teo.demo', n: 'Teo Herrera', bio: 'corro a las 7am (a veces)', av: ['#2b1608', '#ff8a3d', '#ffd36b'] },
];

const H = 3600_000;
const POSTS = [
  { u: 'noa.demo', kind: 'photo', body: 'el cielo hoy ha decidido ser un fondo de pantalla', art: ['#1b1f5e', '#ff8a70', '#ffc59e', '#7a5cff'], ago: 0.6, audience: 'public' },
  { u: 'dani.demo', kind: 'text', body: 'nadie habla de lo bien que sienta llegar justo cuando el bus abre las puertas', ago: 1.4, audience: 'public' },
  { u: 'marco.demo', kind: 'audio', body: 'idea de bajo para el ensayo del jueves 🎸', notes: [45, 52, 57, 52, 48, 55, 60, 55, 43, 50, 55, 50], ago: 2.2, audience: 'public' },
  { u: 'lucia.demo', kind: 'photo', body: 'mi escritorio a las 2am vs mis planes de dormir pronto', art: ['#0b0d24', '#3b2a7a', '#d36bff', '#2f6bff'], ago: 3.1, audience: 'friends' },
  { u: 'sofi.demo', kind: 'text', body: 'hoy aprendí que el corazón late unas 100.000 veces al día y el mío ha gastado la mitad en el examen de esta mañana', ago: 4.5, audience: 'public' },
  { u: 'teo.demo', kind: 'photo', body: '6 km y un amanecer. el resto del día ya da igual', art: ['#1a0f2e', '#ff7a3d', '#ffd36b', '#ff4f7a'], ago: 7, audience: 'public' },
  { u: 'noa.demo', kind: 'text', body: '¿alguien más guarda capturas de pantalla de conversaciones bonitas para leerlas en días malos?', ago: 9, audience: 'friends' },
  { u: 'lucia.demo', kind: 'audio', body: 'tarareando la canción que no me sale de la cabeza', notes: [64, 67, 69, 71, 69, 67, 64, null, 62, 64, 67, 64], ago: 12, audience: 'public' },
  { u: 'dani.demo', kind: 'photo', body: 'spot nuevo descubierto. no os digo dónde', art: ['#0b1a2a', '#2c7dff', '#5ef2c8', '#1d3b6e'], ago: 20, audience: 'public' },
  { u: 'marco.demo', kind: 'text', body: 'propuesta: los domingos deberían durar 36 horas', ago: 26, audience: 'public' },
  { u: 'sofi.demo', kind: 'photo', body: 'biblioteca, modo supervivencia', art: ['#121a14', '#3ed598', '#e8ffb0', '#1f6b4f'], ago: 31, audience: 'friends' },
  { u: 'teo.demo', kind: 'text', body: 'el mejor momento del día es cuando suena una canción que no escuchabas desde hace años', ago: 40, audience: 'public' },
];

const COMMENTS = [
  [0, 'lucia.demo', 'quiero ese cielo de fondo de pantalla ya'],
  [0, 'teo.demo', 'esto es arte'],
  [1, 'sofi.demo', 'la mayor victoria del día honestamente'],
  [2, 'dani.demo', 'suena mejor de lo que dices jaja'],
  [4, 'marco.demo', 'la mitad 😭'],
  [6, 'lucia.demo', 'siempre. tengo una carpeta entera'],
];

const REACTIONS = [[0, 'lucia.demo', '🔥'], [0, 'dani.demo', '💜'], [0, 'teo.demo', '🥹'], [1, 'marco.demo', '😂'], [1, 'sofi.demo', '😂'], [2, 'noa.demo', '🔥'], [4, 'noa.demo', '🥹'], [5, 'sofi.demo', '🔥'], [8, 'marco.demo', '😮'], [9, 'dani.demo', '🫶']];

export function seedDemo() {
  if (get('SELECT 1 FROM users WHERE is_demo = 1')) return;
  const t = now();
  const ids = {};
  tx(() => {
    PEOPLE.forEach((p, i) => {
      if (get('SELECT 1 FROM users WHERE username = ?', p.u)) return;
      const r = run(
        `INSERT INTO users (username, display_name, bio, is_demo, invite_code, created_at) VALUES (?, ?, ?, 1, ?, ?)`,
        p.u, p.n, p.bio, inviteCode(), t - 30 * 24 * H,
      );
      const id = Number(r.lastInsertRowid);
      ids[p.u] = id;
      const avatar = storeMedia(id, artPng({ width: 256, height: 256, colors: [p.av[0], p.av[1], p.av[2]], seed: i + 7 }), { purpose: 'avatar' });
      run('UPDATE users SET avatar_media_id = ? WHERE id = ?', avatar.id, id);
    });
    const list = Object.values(ids);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) makeFriends(list[i], list[j]);

    const postIds = POSTS.map((p, i) => {
      const author = ids[p.u];
      if (!author) return null;
      let mediaId = null;
      if (p.kind === 'photo') {
        mediaId = storeMedia(author, artPng({ width: 600, height: 750, colors: p.art, seed: i * 13 + 3 }), { purpose: 'post' }).id;
      } else if (p.kind === 'audio') {
        const a = melodyWav({ notes: p.notes });
        mediaId = storeMedia(author, a.wav, { purpose: 'post', durationMs: a.durationMs, waveform: a.waveform }).id;
      }
      const r = run(
        'INSERT INTO posts (author_id, kind, body, media_id, audience, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        author, p.kind, p.body, mediaId, p.audience, Math.round(t - p.ago * H),
      );
      return Number(r.lastInsertRowid);
    });
    COMMENTS.forEach(([pi, u, body], k) => {
      if (postIds[pi] && ids[u]) run('INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?, ?, ?, ?)', postIds[pi], ids[u], body, Math.min(t, Math.round(t - POSTS[pi].ago * H + (k + 1) * 300_000)));
    });
    REACTIONS.forEach(([pi, u, e]) => {
      if (postIds[pi] && ids[u]) run('INSERT INTO reactions (post_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)', postIds[pi], ids[u], e, t);
    });
  });
}

export const demoUserIds = () => all('SELECT id FROM users WHERE is_demo = 1').map((r) => r.id);

export function connectDemo(userId) {
  tx(() => demoUserIds().forEach((d) => makeFriends(userId, d)));
}
