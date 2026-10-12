/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canSee, canSeeLovedOne, detectTopics, feed, findAdvice, matchesKind, visibleIsms, type Viewer } from './advice.ts';
import type { Ism, LovedOne } from './types.ts';

const ME = 'me';
const FRIEND = 'friend';
const me: Viewer = { userId: ME, friendIds: new Set([FRIEND]) };
const stranger: Viewer = { userId: 'stranger', friendIds: new Set() };
const signedOut: Viewer = { userId: '', friendIds: new Set() };
const lovedOne = (id: string, ownerId: string, visibility: LovedOne['visibility'], createdAt = 0): LovedOne => ({
  id,
  ownerId,
  name: id,
  relationship: 'Grandma',
  visibility,
  createdAt,
});
const ism = (id: string, lovedOneId: string, ownerId: string, topics: string[], text = 'words', extra: Partial<Ism> = {}): Ism => ({
  id,
  lovedOneId,
  ownerId,
  text,
  topics,
  kind: 'quote',
  createdAt: 0,
  ...extra,
});

const lovedOnes = [
  lovedOne('mine', ME, 'private'),
  lovedOne('theirsPublic', 'other', 'public'),
  lovedOne('theirsPrivate', 'other', 'private'),
  lovedOne('friendsOnly', FRIEND, 'friends'),
  lovedOne('friendsPrivate', FRIEND, 'private'),
  lovedOne('strangersFriendsOnly', 'other', 'friends'),
];
const byId = (id: string) => lovedOnes.find((l) => l.id === id);

test('you always see your own isms; others only when their family made them public', () => {
  assert.equal(canSee(ism('1', 'mine', ME, []), byId('mine'), me), true);
  assert.equal(canSee(ism('2', 'theirsPublic', 'other', []), byId('theirsPublic'), me), true);
  assert.equal(canSee(ism('3', 'theirsPrivate', 'other', []), byId('theirsPrivate'), me), false);
  assert.equal(
    canSee(ism('4', 'theirsPublic', 'other', [], 'x', { keepPrivate: true }), byId('theirsPublic'), me),
    false,
  );
});

test('friends-only loved ones are seen by the owner and their friends, nobody else', () => {
  const friendsOnly = byId('friendsOnly')!;
  assert.equal(canSeeLovedOne(friendsOnly, me), true);
  assert.equal(canSeeLovedOne(friendsOnly, { userId: FRIEND, friendIds: new Set() }), true);
  assert.equal(canSeeLovedOne(friendsOnly, stranger), false);
  assert.equal(canSeeLovedOne(friendsOnly, signedOut), false);
  assert.equal(canSeeLovedOne(byId('friendsPrivate')!, me), false);
  assert.equal(canSeeLovedOne(byId('strangersFriendsOnly')!, me), false);
  assert.equal(canSee(ism('5', 'friendsOnly', FRIEND, []), friendsOnly, me), true);
  assert.equal(canSee(ism('6', 'friendsOnly', FRIEND, [], 'x', { keepPrivate: true }), friendsOnly, me), false);
  assert.equal(canSee(ism('7', 'friendsOnly', FRIEND, []), friendsOnly, stranger), false);
});

test('scopes: "mine", then "friends" adds your friends\', then "everyone" adds public ones', () => {
  const all = [
    ism('1', 'mine', ME, []),
    ism('2', 'theirsPublic', 'other', []),
    ism('3', 'theirsPrivate', 'other', []),
    ism('4', 'friendsOnly', FRIEND, []),
    ism('5', 'friendsPrivate', FRIEND, []),
    ism('6', 'strangersFriendsOnly', 'other', []),
  ];
  const ids = (scope: 'mine' | 'friends' | 'everyone', viewer = me) =>
    visibleIsms(all, lovedOnes, viewer, scope).map((i) => i.id);
  assert.deepEqual(ids('mine'), ['1']);
  assert.deepEqual(ids('friends'), ['1', '4']);
  assert.deepEqual(ids('everyone'), ['1', '2', '4']);
  assert.deepEqual(ids('everyone', signedOut), ['2']);
});

test('the feed lists new memories and new loved ones, newest first', () => {
  const people = [lovedOne('old', FRIEND, 'friends', 10), lovedOne('mine', ME, 'private', 20), lovedOne('hidden', 'other', 'friends', 99)];
  const memories = [
    ism('a', 'old', FRIEND, [], 'x', { createdAt: 30 }),
    ism('b', 'mine', ME, [], 'x', { createdAt: 25 }),
    ism('c', 'hidden', 'other', [], 'x', { createdAt: 98 }),
  ];
  assert.deepEqual(
    feed(memories, people, me, 'friends').map((item) => item.id),
    ['ism-a', 'ism-b', 'loved-one-mine', 'loved-one-old'],
  );
  assert.deepEqual(feed(memories, people, me, 'mine').map((item) => item.id), ['ism-b', 'loved-one-mine']);
});

test('detects topics from a description of the situation', () => {
  assert.deepEqual(detectTopics("I'm nervous about my job interview tomorrow"), ['courage', 'work']);
  assert.deepEqual(detectTopics('Broke up with my boyfriend.'), ['love']);
  assert.deepEqual(detectTopics('hello'), []);
});

test('ranks by topic first, then shared words, own loved ones on ties', () => {
  const isms = [
    ism('other-money', 'theirsPublic', 'other', ['money'], 'Pay yourself first'),
    ism('mine-money', 'mine', ME, ['money'], 'Never lend what you cannot lose'),
    ism('mine-love', 'mine', ME, ['love'], 'Marry your best friend'),
  ];
  const ranked = findAdvice('Should I lend my brother money?', [], isms, ME).map((m) => m.ism.id);
  assert.deepEqual(ranked, ['mine-money', 'other-money']);
});

test('nothing to go on means no results', () => {
  assert.deepEqual(findAdvice('', [], [ism('1', 'mine', ME, ['love'])], ME), []);
});

test('filters quotes, stories, or both', () => {
  const quote = ism('q', 'mine', ME, []);
  const story = ism('s', 'mine', ME, [], 'One summer…', { kind: 'story', title: 'The lake house' });
  assert.deepEqual([quote, story].filter((i) => matchesKind(i, 'quote')).map((i) => i.id), ['q']);
  assert.deepEqual([quote, story].filter((i) => matchesKind(i, 'story')).map((i) => i.id), ['s']);
  assert.deepEqual([quote, story].filter((i) => matchesKind(i, 'all')).map((i) => i.id), ['q', 's']);
});

test("a story's title counts when matching a situation", () => {
  const story = ism('s', 'mine', ME, [], 'We drove all night.', { kind: 'story', title: 'Fishing at the lake' });
  assert.deepEqual(findAdvice('thinking about fishing', [], [story], ME).map((m) => m.ism.id), ['s']);
});
