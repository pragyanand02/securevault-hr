const test = require('node:test');
const assert = require('node:assert/strict');

const { isRetentionExpired } = require('../services/retentionService');

const now = new Date('2026-11-05T00:00:00.000Z');
const user = (overrides = {}) => ({
  isDeleted: true,
  retentionUntil: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

test('a soft-deleted record past its retention date is eligible', () => {
  assert.equal(isRetentionExpired(user(), now), true);
});

test('an active employee is never eligible, even with an old retention date', () => {
  assert.equal(isRetentionExpired(user({ isDeleted: false }), now), false);
});

test('a record still inside its retention window is not eligible', () => {
  assert.equal(
    isRetentionExpired(user({ retentionUntil: '2027-01-01T00:00:00.000Z' }), now),
    false
  );
});

test('a record without a retention date is not eligible', () => {
  assert.equal(isRetentionExpired(user({ retentionUntil: null }), now), false);
  assert.equal(isRetentionExpired({}, now), false);
  assert.equal(isRetentionExpired(null, now), false);
});

test('the boundary date counts as expired', () => {
  assert.equal(isRetentionExpired(user({ retentionUntil: now.toISOString() }), now), true);
});

test('an invalid retention date fails closed', () => {
  assert.equal(isRetentionExpired(user({ retentionUntil: 'not-a-date' }), now), false);
});
