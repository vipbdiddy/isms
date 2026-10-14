/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { byTarget, canDeleteComment, knowsSharer, likedByLine, shortCount, targetKey, type Circle } from './social.ts';
import type { Comment, Like } from './types.ts';

test('likes and comments are grouped by what they are on', () => {
  const likes: Like[] = [
    { userId: 'ann', ismId: 'q1' },
    { userId: 'bob', ismId: 'q1' },
    { userId: 'ann', lovedOneId: 'q1' },
  ];
  const grouped = byTarget(likes);
  assert.equal(targetKey({ ismId: 'q1' }), 'ism:q1');
  assert.deepEqual(grouped.get('ism:q1')?.map((l) => l.userId), ['ann', 'bob']);
  // The same id as a loved one is a different thing.
  assert.deepEqual(grouped.get('loved-one:q1')?.map((l) => l.userId), ['ann']);
  assert.equal(grouped.get('ism:other'), undefined);
});

test('"Liked by" names you first, then a few others, then a count', () => {
  assert.equal(likedByLine([], false), '');
  assert.equal(likedByLine([], true), 'Liked by you');
  assert.equal(likedByLine(['Ann'], false), 'Liked by Ann');
  assert.equal(likedByLine(['Ann'], true), 'Liked by you and Ann');
  assert.equal(likedByLine(['Ann', 'Bob'], true), 'Liked by you, Ann and Bob');
  assert.equal(likedByLine(['Ann', ''], false), 'Liked by Ann and someone');
  assert.equal(likedByLine(['Ann', 'Bob', 'Cat'], true), 'Liked by you, Ann and 2 others');
});

test('comments are deleted by their author or whoever shared the memory', () => {
  const comment: Comment = { id: 'c', authorId: 'bob', ismId: 'q', body: 'Hi', reviewStatus: 'ok', createdAt: 0 };
  assert.equal(canDeleteComment(comment, 'bob', ['ann']), true);
  assert.equal(canDeleteComment(comment, 'ann', ['ann']), true);
  assert.equal(canDeleteComment(comment, 'cat', ['ann']), false);
  assert.equal(canDeleteComment(comment, '', ['']), false);
  // On something Dan added to Ann's loved one, both of them can.
  assert.equal(canDeleteComment(comment, 'dan', ['dan', 'ann']), true);
  assert.equal(canDeleteComment(comment, 'ann', ['dan', 'ann']), true);
});

test('names and profiles show for friends, groups and public profiles only', () => {
  const circle: Circle = {
    userId: 'me',
    friendIds: new Set(['friend']),
    groupmateIds: new Set(['cousin']),
    publicProfileIds: new Set(['open']),
  };
  assert.equal(knowsSharer('me', circle), true);
  assert.equal(knowsSharer('friend', circle), true);
  assert.equal(knowsSharer('cousin', circle), true);
  assert.equal(knowsSharer('open', circle), true);
  assert.equal(knowsSharer('stranger', circle), false);
  assert.equal(knowsSharer('open', { ...circle, userId: '' }), false);
});

test('counts are short', () => {
  assert.equal(shortCount(0), '');
  assert.equal(shortCount(7), '7');
  assert.equal(shortCount(999), '999');
  assert.equal(shortCount(1000), '1k');
  assert.equal(shortCount(1250), '1.3k');
  assert.equal(shortCount(12_500), '13k');
});
