/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findPossibleDuplicates } from './duplicates.ts';
import type { LovedOne } from './types.ts';

const person = (id: string, name: string, years?: string, obituary?: string, createdAt = 0): LovedOne => ({
  id,
  ownerId: 'someone',
  name,
  relationship: '',
  years,
  obituary,
  visibility: 'public',
  createdAt,
});

const RUTH_OBITUARY =
  'Ruth Ellen Hadley, 87, of Story County, Iowa, passed away peacefully at home surrounded by family. ' +
  'Born on the family farm in 1931, she married Walter Hadley in 1950 and together they raised six children. ' +
  'Ruth taught Sunday school for forty years and won the county fair pie contest more times than anyone could count.';

const EARL_OBITUARY =
  'Earl James Whitaker, 73, of Toledo, Ohio, died after a short illness. Earl worked as a machinist at the same ' +
  'shop for 38 years and spent every free weekend on Lake Erie. He coached Little League for two decades and could ' +
  'fix anything with a roll of duct tape.';

const ruth = person('ruth', 'Grandma Ruth', '1931 – 2018', RUTH_OBITUARY);
const earl = person('earl', 'Pop Earl', '1948 – 2021', EARL_OBITUARY);
const everyone = [ruth, earl];
const ids = (list: LovedOne[]) => list.map((l) => l.id);

test('the same name and years is a match, whatever they were called', () => {
  assert.deepEqual(ids(findPossibleDuplicates({ name: 'Ruth Hadley', years: '1931-2018' }, everyone)), ['ruth']);
  assert.deepEqual(ids(findPossibleDuplicates({ name: 'Nana Ruth', years: '2018' }, everyone)), ['ruth']);
});

test('the same obituary is a match even under a different name', () => {
  assert.deepEqual(ids(findPossibleDuplicates({ name: 'Mom', obituary: RUTH_OBITUARY }, everyone)), ['ruth']);
  const shortened = RUTH_OBITUARY.split('. ').slice(0, 2).join('. ');
  assert.deepEqual(ids(findPossibleDuplicates({ name: 'Ruth', obituary: shortened }, everyone)), ['ruth']);
});

test('a full name is enough on its own, initials included', () => {
  const ruthHadley = person('rh', 'Ruth Ellen Hadley');
  assert.deepEqual(ids(findPossibleDuplicates({ name: 'Ruth E. Hadley' }, [ruthHadley])), ['rh']);
  assert.deepEqual(ids(findPossibleDuplicates({ name: 'josé o’neil' }, [person('j', 'Jose ONeil')])), ['j']);
});

test('one shared first name alone is not enough', () => {
  assert.deepEqual(findPossibleDuplicates({ name: 'Aunt Ruth' }, everyone), []);
  assert.deepEqual(findPossibleDuplicates({ name: 'Grandma' }, everyone), []);
  assert.deepEqual(findPossibleDuplicates({ name: '' }, everyone), []);
});

test('different years mean a different person', () => {
  assert.deepEqual(findPossibleDuplicates({ name: 'Ruth', years: '1950 – 2020' }, everyone), []);
  const seniorJunior = [person('sr', 'John Smith Sr.', '1940 – 2001')];
  assert.deepEqual(findPossibleDuplicates({ name: 'John Smith Jr.', years: '1968 – 2019' }, seniorJunior), []);
});

test("unrelated obituaries don't match each other", () => {
  assert.deepEqual(findPossibleDuplicates({ name: 'Someone', obituary: EARL_OBITUARY }, [ruth]), []);
});

test('best match first, at most three', () => {
  const list = [
    person('a', 'Mary Jones', undefined, undefined, 1),
    person('b', 'Mary Jones', '1950 – 2020', undefined, 2),
    person('c', 'Mary Jones', undefined, undefined, 3),
    person('d', 'Mary Jones', undefined, undefined, 4),
  ];
  assert.deepEqual(ids(findPossibleDuplicates({ name: 'Mary Jones', years: '1950-2020' }, list)), ['b', 'd', 'c']);
});
