// Tests de las comprobaciones de autenticación y rol de las Cloud Functions.
//   cd functions && npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  requireAuth, requireId, isParticipant, assertHost, assertParticipant,
  sanitizeUserName, sanitizeImageUrl,
} = require('../src/utils/auth');

const code = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof HttpsError); return e.code; }
  return null;
};

const game = { hostId: 'alice', players: ['alice', 'bob'] };

test('requireAuth returns the uid or rejects anonymous calls', () => {
  assert.equal(requireAuth({ auth: { uid: 'alice' } }), 'alice');
  assert.equal(code(() => requireAuth({})), 'unauthenticated');
  assert.equal(code(() => requireAuth({ auth: null })), 'unauthenticated');
  assert.equal(code(() => requireAuth(undefined)), 'unauthenticated');
});

test('requireId rejects missing, oversized or path-like ids', () => {
  assert.equal(requireId('g1', 'gameId'), 'g1');
  for (const bad of [undefined, null, '', 42, {}, 'a/b', 'x'.repeat(129)]) {
    assert.equal(code(() => requireId(bad, 'gameId')), 'invalid-argument');
  }
});

test('only the host passes assertHost', () => {
  assert.equal(code(() => assertHost(game, 'alice')), null);
  assert.equal(code(() => assertHost(game, 'bob')), 'permission-denied');
  assert.equal(code(() => assertHost(null, 'alice')), 'permission-denied');
});

test('only players pass assertParticipant', () => {
  assert.equal(isParticipant(game, 'bob'), true);
  assert.equal(code(() => assertParticipant(game, 'bob')), null);
  assert.equal(code(() => assertParticipant(game, 'mallory')), 'permission-denied');
  assert.equal(code(() => assertParticipant({ hostId: 'h' }, 'mallory')), 'permission-denied');
});

test('user names are trimmed and limited to 40 characters', () => {
  assert.equal(sanitizeUserName('  Alice '), 'Alice');
  assert.equal(code(() => sanitizeUserName('   ')), 'invalid-argument');
  assert.equal(code(() => sanitizeUserName('x'.repeat(41))), 'invalid-argument');
  assert.equal(code(() => sanitizeUserName({})), 'invalid-argument');
});

test('image URIs must be https or local picker URIs', () => {
  assert.equal(sanitizeImageUrl(''), null);
  assert.equal(sanitizeImageUrl('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(sanitizeImageUrl('file:///data/user/0/a.jpg'), 'file:///data/user/0/a.jpg');
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'http://x/a.png', 'x'.repeat(3000)]) {
    assert.equal(code(() => sanitizeImageUrl(bad)), 'invalid-argument');
  }
});
