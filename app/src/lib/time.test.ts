/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { timeAgo } from './time.ts';

const now = new Date(2026, 9, 12, 12, 0).getTime();
const minutes = (n: number) => now - n * 60_000;

test('recent times are relative', () => {
  assert.equal(timeAgo(now, now), 'just now');
  assert.equal(timeAgo(minutes(5), now), '5 min ago');
  assert.equal(timeAgo(minutes(3 * 60), now), '3 hr ago');
  assert.equal(timeAgo(minutes(30 * 60), now), 'yesterday');
  assert.equal(timeAgo(minutes(4 * 24 * 60), now), '4 days ago');
});

test('older times are dates, with the year only when it differs', () => {
  assert.equal(timeAgo(new Date(2026, 2, 4).getTime(), now), 'Mar 4');
  assert.equal(timeAgo(new Date(2025, 2, 4).getTime(), now), 'Mar 4, 2025');
});
