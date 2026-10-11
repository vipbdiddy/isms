/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readAuthLink } from './authLink.ts';

test('reads the sign-in code from a link back into the app', () => {
  assert.deepEqual(readAuthLink('isms://auth-callback?code=abc-123'), { code: 'abc-123', error: undefined });
});

test('reads why a link failed, from the query or after a #', () => {
  assert.deepEqual(
    readAuthLink('isms://reset-password?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'),
    { code: undefined, error: 'Email link is invalid or has expired' },
  );
  assert.deepEqual(readAuthLink('isms://auth-callback#error=server_error'), { code: undefined, error: 'server_error' });
});

test('a link without either says nothing', () => {
  assert.deepEqual(readAuthLink('isms://auth-callback'), { code: undefined, error: undefined });
});
