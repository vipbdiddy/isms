/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canSee, detectTopics, findAdvice, matchesKind, visibleIsms } from './advice.ts';
import type { Ism, LovedOne } from './types.ts';

const ME = 'me';
const lovedOne = (id: string, ownerId: string, visibility: LovedOne['visibility']): LovedOne => ({
  id,
  ownerId,
  name: id,
  relationship: 'Grandma',
  visibility,
  createdAt: 0,
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
];

test('you always see your own isms; others only when their family made them public', () => {
  assert.equal(canSee(ism('1', 'mine', ME, []), lovedOnes[0], ME), true);
  assert.equal(canSee(ism('2', 'theirsPublic', 'other', []), lovedOnes[1], ME), true);
  assert.equal(canSee(ism('3', 'theirsPrivate', 'other', []), lovedOnes[2], ME), false);
  assert.equal(
    canSee(ism('4', 'theirsPublic', 'other', [], 'x', { keepPrivate: true }), lovedOnes[1], ME),
    false,
  );
});

test('scope "mine" filters to your loved ones, "everyone" adds public ones', () => {
  const all = [
    ism('1', 'mine', ME, []),
    ism('2', 'theirsPublic', 'other', []),
    ism('3', 'theirsPrivate', 'other', []),
  ];
  assert.deepEqual(visibleIsms(all, lovedOnes, ME, 'mine').map((i) => i.id), ['1']);
  assert.deepEqual(visibleIsms(all, lovedOnes, ME, 'everyone').map((i) => i.id), ['1', '2']);
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
