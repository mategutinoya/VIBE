import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-test-'));
process.env.DATA_DIR = dir;
process.env.AUTH_RATE_MAX = '1000';

let server;
let base;

before(async () => {
  const { createApp } = await import('../src/index.js');
  const { seedDemo } = await import('../src/lib/demo.js');
  seedDemo();
  await new Promise((r) => (server = createApp().listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Cliente mínimo con cookie de sesión. */
function client() {
  let cookie = '';
  const call = async (method, url, body, { csrf = true, form } = {}) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    if (csrf) headers['x-vibe'] = '1';
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + url, { method, headers, body: payload });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    return { status: res.status, body: type.includes('json') ? await res.json() : await res.arrayBuffer() };
  };
  return {
    call,
    get: (u) => call('GET', u),
    post: (u, b, o) => call('POST', u, b, o),
    put: (u, b) => call('PUT', u, b),
    patch: (u, b) => call('PATCH', u, b),
    del: (u, b) => call('DELETE', u, b),
  };
}

async function signup(username, extra = {}) {
  const c = client();
  const r = await c.post('/api/auth/signup', {
    username,
    displayName: username.toUpperCase(),
    password: 'contraseña-segura',
    ageConfirmed: true,
    ...extra,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  c.user = r.body.user;
  return c;
}

async function befriend(a, b) {
  await a.post('/api/friends/requests', { userId: b.user.id });
  const reqs = await b.get('/api/friends/requests');
  const r = reqs.body.incoming.find((x) => x.id === a.user.id);
  assert.equal((await b.post(`/api/friends/requests/${r.requestId}/accept`)).status, 200);
}

const JPEG_WITH_GPS = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  Buffer.from([0xff, 0xe1, 0x00, 0x0e]),
  Buffer.from('Exif\0\0GPS!!!!', 'latin1').subarray(0, 12),
  Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x20, 0x01, 0x01, 0x11, 0x00]),
  Buffer.from([0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0xff, 0xd9]),
]);

async function upload(c, buf, name = 'f.jpg') {
  const form = new FormData();
  form.append('file', new Blob([buf]), name);
  return c.post('/api/media', undefined, { form });
}

test('registro: valida campos y crea sesión persistente', async () => {
  const c = client();
  let r = await c.post('/api/auth/signup', { username: 'A!', displayName: 'x', password: '12345678', ageConfirmed: true });
  assert.equal(r.status, 400);
  r = await c.post('/api/auth/signup', { username: 'valido', displayName: 'x', password: 'corta', ageConfirmed: true });
  assert.equal(r.status, 400);
  r = await c.post('/api/auth/signup', { username: 'valido', displayName: 'x', password: 'larga-suficiente', ageConfirmed: false });
  assert.equal(r.status, 400);
  const ana = await signup('ana');
  assert.equal((await ana.get('/api/me')).body.user.username, 'ana');
  const dup = await client().post('/api/auth/signup', { username: 'ANA', displayName: 'x', password: 'larga-suficiente', ageConfirmed: true });
  assert.equal(dup.status, 400);
  const login = client();
  assert.equal((await login.post('/api/auth/login', { username: 'ana', password: 'mal' })).status, 401);
  assert.equal((await login.post('/api/auth/login', { username: 'ana', password: 'contraseña-segura' })).status, 200);
  await login.post('/api/auth/logout');
  assert.equal((await login.get('/api/me')).status, 401);
});

test('CSRF: rechaza escrituras sin cabecera X-Vibe', async () => {
  const c = await signup('csrf_user');
  const r = await c.call('POST', '/api/posts', { kind: 'text', body: 'hola' }, { csrf: false });
  assert.equal(r.status, 403);
});

test('privacidad de publicaciones: amigos, círculos y público', async () => {
  const bea = await signup('bea');
  const carlos = await signup('carlos');
  const dora = await signup('dora');
  await befriend(bea, carlos);
  await befriend(bea, dora);

  const circle = await bea.post('/api/friends/circles', { name: 'Íntimos', memberIds: [carlos.user.id] });
  assert.equal(circle.status, 201);
  const pFriends = (await bea.post('/api/posts', { kind: 'text', body: 'para amigos' })).body.post;
  const pCircle = (await bea.post('/api/posts', { kind: 'text', body: 'para el círculo', audience: 'circle', circleId: circle.body.circle.id })).body.post;
  const pPublic = (await bea.post('/api/posts', { kind: 'text', body: 'para todos', audience: 'public' })).body.post;

  const feedCarlos = (await carlos.get('/api/feed')).body.posts.map((p) => p.id);
  assert.ok(feedCarlos.includes(pFriends.id) && feedCarlos.includes(pCircle.id) && feedCarlos.includes(pPublic.id));
  const feedDora = (await dora.get('/api/feed')).body.posts.map((p) => p.id);
  assert.ok(feedDora.includes(pFriends.id) && !feedDora.includes(pCircle.id));
  assert.equal((await dora.get(`/api/posts/${pCircle.id}`)).status, 404);

  const stranger = await signup('extrano');
  assert.equal((await stranger.get(`/api/posts/${pFriends.id}`)).status, 404);
  assert.equal((await stranger.get(`/api/posts/${pPublic.id}`)).status, 200);
  const disc = (await stranger.get('/api/discover')).body.posts.map((p) => p.id);
  assert.ok(disc.includes(pPublic.id) && !disc.includes(pFriends.id));

  // Al hacer la cuenta privada, lo público deja de verse fuera de los amigos
  await bea.patch('/api/me', { isPrivate: true });
  assert.equal((await stranger.get(`/api/posts/${pPublic.id}`)).status, 404);
  assert.equal((await bea.post('/api/posts', { kind: 'text', body: 'x', audience: 'public' })).status, 400);
});

test('reacciones, respuestas y notificaciones', async () => {
  const eva = await signup('eva');
  const fede = await signup('fede');
  await befriend(eva, fede);
  const post = (await eva.post('/api/posts', { kind: 'text', body: 'hola mundo' })).body.post;
  assert.equal((await fede.put(`/api/posts/${post.id}/reaction`, { emoji: 'no-valida' })).status, 400);
  const r = await fede.put(`/api/posts/${post.id}/reaction`, { emoji: '🔥' });
  assert.equal(r.body.post.myReaction, '🔥');
  await fede.put(`/api/posts/${post.id}/reaction`, { emoji: '💜' });
  const c = await fede.post(`/api/posts/${post.id}/comments`, { body: 'qué bueno' });
  assert.equal(c.status, 201);
  assert.equal(c.body.comment.author.username, 'fede');
  assert.equal(c.body.comment.author.id, fede.user.id);
  const n = (await eva.get('/api/notifications')).body.notifications;
  assert.equal(n.filter((x) => x.type === 'reaction').length, 1, 'cambiar de reacción no duplica notificaciones');
  assert.ok(n.some((x) => x.type === 'comment'));
  assert.ok((await eva.get('/api/me/badges')).body.notifications >= 2);
});

test('bloquear oculta perfiles y contenido en ambas direcciones', async () => {
  const gala = await signup('gala');
  const hugo = await signup('hugo');
  await befriend(gala, hugo);
  const post = (await hugo.post('/api/posts', { kind: 'text', body: 'visible' })).body.post;
  await gala.post('/api/blocks', { userId: hugo.user.id });
  assert.equal((await gala.get(`/api/posts/${post.id}`)).status, 404);
  assert.equal((await hugo.get('/api/users/gala')).status, 404);
  assert.equal((await hugo.post(`/api/messages/${gala.user.id}`, { body: 'hola' })).status, 404);
  assert.equal((await hugo.post('/api/friends/requests', { userId: gala.user.id })).status, 404);
  assert.equal((await gala.post('/api/reports', { userId: hugo.user.id, reason: 'acoso', details: 'test' })).status, 201);
});

test('media: elimina EXIF/GPS, valida tipo y respeta el acceso', async () => {
  const ines = await signup('ines');
  const juan = await signup('juan');
  const bad = await upload(ines, Buffer.from('<svg onload=alert(1)>'), 'x.svg');
  assert.equal(bad.status, 400);
  const up = await upload(ines, JPEG_WITH_GPS);
  assert.equal(up.status, 201, JSON.stringify(up.body));
  const mediaUrl = up.body.media.url;
  // Pendiente: solo el dueño
  assert.equal((await juan.get(mediaUrl)).status, 404);
  const file = Buffer.from((await ines.get(mediaUrl)).body);
  assert.ok(!file.toString('latin1').includes('Exif'), 'el EXIF debe eliminarse');
  await ines.post('/api/posts', { kind: 'photo', mediaId: up.body.media.id, body: '' });
  assert.equal((await juan.get(mediaUrl)).status, 404, 'no amigo no puede ver la foto de amigos');
  await befriend(ines, juan);
  assert.equal((await juan.get(mediaUrl)).status, 200);
  // Un media no se puede reutilizar
  assert.equal((await ines.post('/api/posts', { kind: 'photo', mediaId: up.body.media.id })).status, 400);
});

test('dúo: emparejamiento, respuestas ocultas hasta que ambos contestan', async () => {
  const kai = await signup('kai');
  const lea = await signup('lea');
  assert.deepEqual((await kai.get('/api/duo')).body.duos, [], 'sin amigos no hay dúo');
  await befriend(kai, lea);
  const d = (await kai.get('/api/duo')).body.duos[0];
  assert.equal(d.partner.username, 'lea');
  const leaView = (await lea.get('/api/duo')).body.duos;
  assert.equal(leaView.length, 1);
  assert.equal(leaView[0].id, d.id, 'el dúo es compartido');

  await kai.post(`/api/duo/${d.id}/answer`, { kind: 'text', body: 'mi respuesta secreta' });
  const pending = (await lea.get(`/api/duo/${d.id}`)).body.duo;
  assert.equal(pending.partnerAnswered, true);
  assert.equal(pending.theirs, null, 'no se revela antes de responder');
  assert.ok(!JSON.stringify(pending).includes('secreta'));
  assert.equal((await kai.post(`/api/duo/${d.id}/answer`, { kind: 'text', body: 'otra' })).status, 400);

  const revealed = (await lea.post(`/api/duo/${d.id}/answer`, { kind: 'text', body: 'la mía' })).body.duo;
  assert.equal(revealed.revealed, true);
  assert.equal(revealed.theirs.body, 'mi respuesta secreta');
  assert.equal((await lea.put(`/api/duo/${d.id}/reaction`, { emoji: '🫶' })).status, 200);
  assert.equal((await kai.get(`/api/duo/${d.id}`)).body.duo.mine.reaction, '🫶');

  const outsider = await signup('mia');
  assert.equal((await outsider.get(`/api/duo/${d.id}`)).status, 404);
  assert.equal((await kai.get('/api/users/lea')).body.stats.duosTogether, 1);
});

test('dúo con cuentas demo: la cuenta demo responde y se revela', async () => {
  const nico = await signup('nico');
  await nico.post('/api/demo');
  const d = (await nico.get('/api/duo')).body.duos[0];
  assert.ok(d.partner.isDemo);
  const r = (await nico.post(`/api/duo/${d.id}/answer`, { kind: 'text', body: 'hola demo' })).body.duo;
  assert.equal(r.revealed, true);
  assert.equal(r.theirs.auto, true);
  await nico.del('/api/demo');
  assert.equal((await nico.get('/api/friends')).body.users.length, 0);
});

test('invitación: registrarse con el enlace os hace amigos', async () => {
  const olga = await signup('olga');
  const code = (await olga.get('/api/me')).body.user.inviteCode;
  assert.equal((await client().get(`/api/auth/invite/${code}`)).body.inviter.username, 'olga');
  const pablo = await signup('pablo', { inviteCode: code });
  const friends = (await pablo.get('/api/friends')).body.users.map((u) => u.username);
  assert.deepEqual(friends, ['olga']);
});

test('mensajes solo entre amigos y búsqueda respeta la privacidad', async () => {
  const quim = await signup('quim');
  const rosa = await signup('rosa');
  assert.equal((await quim.post(`/api/messages/${rosa.user.id}`, { body: 'hola' })).status, 403);
  await befriend(quim, rosa);
  assert.equal((await quim.post(`/api/messages/${rosa.user.id}`, { body: 'hola' })).status, 201);
  assert.equal((await rosa.get('/api/me/badges')).body.messages, 1);
  const thread = (await rosa.get(`/api/messages/${quim.user.id}`)).body;
  assert.equal(thread.messages[0].body, 'hola');
  assert.equal((await rosa.get('/api/me/badges')).body.messages, 0);

  const sara = await signup('sara');
  await sara.patch('/api/me', { discoverable: false });
  const stranger = await signup('tomas');
  assert.equal((await stranger.get('/api/users/search?q=sa')).body.users.some((u) => u.username === 'sara'), false);
  assert.equal((await stranger.get('/api/users/search?q=sara')).body.users[0].username, 'sara', 'el usuario exacto sí aparece');
});

test('eliminar cuenta borra los datos', async () => {
  const ursula = await signup('ursula');
  await ursula.post('/api/posts', { kind: 'text', body: 'adiós' });
  assert.equal((await ursula.del('/api/me', { password: 'mal' })).status, 401);
  assert.equal((await ursula.del('/api/me', { password: 'contraseña-segura' })).status, 200);
  const other = await signup('victor');
  assert.equal((await other.get('/api/users/ursula')).status, 404);
});
