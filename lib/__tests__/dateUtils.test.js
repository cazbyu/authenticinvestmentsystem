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

test('parseLocalDate returns invalid Date for empty string', () => {
  const date = parseLocalDate('');
  assert.ok(isNaN(date.getTime()));
});

test('parseLocalDate returns invalid Date for non-string input', () => {
  const date = parseLocalDate(null);
  assert.ok(isNaN(date.getTime()));
});
