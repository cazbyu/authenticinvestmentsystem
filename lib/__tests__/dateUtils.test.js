require('ts-node/register');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLocalDate } = require('../dateUtils');

test('parseLocalDate returns valid Date for ISO string', () => {
  const date = parseLocalDate('2024-08-31');
  assert.equal(date.getFullYear(), 2024);
  assert.equal(date.getMonth(), 7); // August is month 7 (0-indexed)
  assert.equal(date.getDate(), 31);
});

test('parseLocalDate handles ISO string with time component (Z)', () => {
  const date = parseLocalDate('2025-06-01T00:00:00Z');
  assert.equal(date.getFullYear(), 2025);
  assert.equal(date.getMonth(), 5); // June
  assert.equal(date.getDate(), 1);
});

test('parseLocalDate handles ISO string with timezone offset', () => {
  const date = parseLocalDate('2025-06-01T12:34:56+02:00');
  assert.equal(date.getFullYear(), 2025);
  assert.equal(date.getMonth(), 5); // June
  assert.equal(date.getDate(), 1);
});

test('parseLocalDate returns invalid Date for empty string', () => {
  const date = parseLocalDate('');
  assert.ok(isNaN(date.getTime()));
});

test('parseLocalDate returns invalid Date for non-string input', () => {
  const date = parseLocalDate(null);
  assert.ok(isNaN(date.getTime()));
});
