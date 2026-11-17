/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pictureAspect } from './pictures.ts';

test('a picture keeps its own shape on a card', () => {
  assert.equal(pictureAspect(1600, 1200), 4 / 3);
  assert.equal(pictureAspect(1200, 1200), 1);
  assert.equal(pictureAspect(1000, 1200), 1000 / 1200);
});

test('very tall or very wide pictures are trimmed to fit a card', () => {
  assert.equal(pictureAspect(900, 1600), 4 / 5);
  assert.equal(pictureAspect(1600, 400), 2);
});

test('without a size, a picture shows as a usual photo', () => {
  assert.equal(pictureAspect(undefined, undefined), 4 / 3);
  assert.equal(pictureAspect(0, 900), 4 / 3);
});
