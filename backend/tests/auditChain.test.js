const test = require('node:test');
const assert = require('node:assert/strict');

process.env.AES_SECRET_KEY = 'test-only-secret-key-that-is-long-enough-123456';
process.env.AES_KEY_ID = 'k1';

const { computeHash, computeMerkleRoot, canonicalize, GENESIS } = require('../utils/auditChain');

const base = {
  sequence: 1,
  actor: null,
  actorName: 'System',
  actorEmail: null,
  actorRole: 'system',
  action: 'TEST_EVENT',
  category: 'SYSTEM',
  severity: 'info',
  targetId: null,
  targetType: null,
  details: 'hello',
  metadata: { b: 2, a: 1 },
  ip: '127.0.0.1',
  userAgent: 'node-test',
  createdAt: new Date('2026-11-04T10:00:00.000Z'),
  prevHash: GENESIS,
};

test('canonical JSON is independent of key insertion order', () => {
  assert.equal(
    canonicalize({ b: 2, a: 1 }),
    canonicalize({ a: 1, b: 2 })
  );
});

test('hash is deterministic', () => {
  assert.equal(computeHash(base), computeHash({ ...base }));
});

test('changing any protected field changes the hash', () => {
  const original = computeHash(base);
  assert.notEqual(original, computeHash({ ...base, details: 'tampered' }));
  assert.notEqual(original, computeHash({ ...base, actorRole: 'admin' }));
  assert.notEqual(original, computeHash({ ...base, metadata: { a: 1, b: 3 } }));
});

test('a hash chain links records through prevHash', () => {
  const first = { ...base, sequence: 1, prevHash: GENESIS };
  first.hash = computeHash(first);

  const second = { ...base, sequence: 2, prevHash: first.hash };
  second.hash = computeHash(second);

  assert.notEqual(first.hash, second.hash);
  assert.equal(second.prevHash, first.hash);
});

test('Merkle root is deterministic for the same ordered hashes', () => {
  const hashes = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
  assert.equal(computeMerkleRoot(hashes), computeMerkleRoot([...hashes]));
});

test('Merkle root is order-sensitive', () => {
  const forward = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
  const reversed = [...forward].reverse();
  assert.notEqual(computeMerkleRoot(forward), computeMerkleRoot(reversed));
});

test('Merkle root changes when any record changes', () => {
  const hashes = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
  const altered = [hashes[0], 'd'.repeat(64), hashes[2]];
  assert.notEqual(computeMerkleRoot(hashes), computeMerkleRoot(altered));
});

test('Merkle root handles odd and single-node sets', () => {
  const single = 'a'.repeat(64);
  assert.equal(computeMerkleRoot([single]), single);

  const three = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
  const root = computeMerkleRoot(three);
  assert.equal(typeof root, 'string');
  assert.equal(root.length, 64);
  assert.equal(computeMerkleRoot([]), null);
});
