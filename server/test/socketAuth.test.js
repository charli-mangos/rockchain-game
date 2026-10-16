// Tests de autenticación de sockets: cd server && npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Server } = require('socket.io');
const { io: connect } = require('socket.io-client');
const {
  createSocketAuthMiddleware,
  bindPayloadToUser,
  canActOnGame,
  canJoinGame,
  parseCorsOrigins,
  isOriginAllowed,
} = require('../lib/socketAuth');

// Verificador falso: solo acepta "valid-token-<uid>"
const fakeVerify = async (token) => {
  if (token.startsWith('valid-token-')) return { uid: token.slice('valid-token-'.length) };
  throw new Error('invalid token');
};

let server;
let url;

before(async () => {
  const httpServer = http.createServer();
  server = new Server(httpServer);
  server.use(createSocketAuthMiddleware(fakeVerify));
  server.on('connection', (socket) => {
    socket.on('whoami', (payload, ack) => ack(bindPayloadToUser(payload, socket.data.uid)));
  });
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${httpServer.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const tryConnect = (auth) => new Promise((resolve) => {
  const client = connect(url, { auth, transports: ['websocket'], reconnection: false });
  client.on('connect', () => resolve({ client, error: null }));
  client.on('connect_error', (error) => { client.close(); resolve({ client: null, error }); });
});

test('handshake without token is rejected', async () => {
  const { error } = await tryConnect({});
  assert.equal(error && error.message, 'unauthorized');
});

test('handshake with an invalid token is rejected', async () => {
  const { error } = await tryConnect({ token: 'forged' });
  assert.equal(error && error.message, 'unauthorized');
});

test('handshake with a valid token connects and binds the uid', async () => {
  const { client, error } = await tryConnect({ token: 'valid-token-alice' });
  assert.equal(error, null);
  // Aunque el cliente diga ser otro usuario, el servidor usa el uid del token
  const reply = await client.emitWithAck('whoami', { gameId: 'g1', userId: 'mallory' });
  assert.deepEqual(reply, { gameId: 'g1', userId: 'alice' });
  client.close();
});

test('oversized tokens are rejected without calling the verifier', async () => {
  let called = false;
  const mw = createSocketAuthMiddleware(async () => { called = true; return { uid: 'x' }; });
  const err = await new Promise((resolve) => mw({ handshake: { auth: { token: 'x'.repeat(5000) } } }, resolve));
  assert.equal(err.message, 'unauthorized');
  assert.equal(called, false);
});

test('bindPayloadToUser only rewrites plain objects', () => {
  assert.deepEqual(bindPayloadToUser({ userId: 'mallory', a: 1 }, 'alice'), { userId: 'alice', a: 1 });
  assert.equal(bindPayloadToUser('transport close', 'alice'), 'transport close');
  assert.equal(bindPayloadToUser(undefined, 'alice'), undefined);
});

test('room access requires being a player of the room', () => {
  const room = { players: [{ userId: 'alice' }, { userId: 'bob' }] };
  assert.equal(canActOnGame(room, 'alice'), true);
  assert.equal(canActOnGame(room, 'mallory'), false);
  assert.equal(canActOnGame(undefined, 'alice'), false);
});

test('joining requires being listed in the Firestore game', () => {
  const game = { hostId: 'alice', players: ['alice', 'bob'] };
  assert.equal(canJoinGame(game, 'bob'), true);
  assert.equal(canJoinGame(game, 'mallory'), false);
  assert.equal(canJoinGame(null, 'alice'), false);
});

test('CORS allows native clients and listed origins only', () => {
  const allowed = parseCorsOrigins(' https://a.example , https://b.example,');
  assert.deepEqual(allowed, ['https://a.example', 'https://b.example']);
  assert.equal(isOriginAllowed(undefined, allowed), true);
  assert.equal(isOriginAllowed('https://a.example', allowed), true);
  assert.equal(isOriginAllowed('https://evil.example', allowed), false);
  assert.equal(isOriginAllowed('https://evil.example', parseCorsOrigins('')), false);
});

test('production silences debug logs unless LOG_LEVEL=debug', () => {
  const { configureConsole } = require('../lib/logger');
  const fake = () => ({ log: 'L', info: 'I', debug: 'D', warn: 'W', error: 'E' });
  const prod = fake();
  assert.equal(configureConsole({ NODE_ENV: 'production' }, prod), 'warn');
  assert.notEqual(prod.log, 'L');
  assert.equal(prod.warn, 'W');
  assert.equal(prod.error, 'E');
  const dbg = fake();
  configureConsole({ NODE_ENV: 'production', LOG_LEVEL: 'debug' }, dbg);
  assert.equal(dbg.log, 'L');
  const dev = fake();
  configureConsole({}, dev);
  assert.equal(dev.log, 'L');
});
