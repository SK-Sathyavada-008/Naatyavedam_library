import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

test('Supabase Client - initializes successfully with credentials', () => {
  const url = 'https://zmqdcowjmwraevxjafha.supabase.co';
  const key = 'sb_publishable_BnBTLb9Z31os7nCDYZf1oA_ut_xKNz8';

  const client = createClient(url, key);
  assert.ok(client);
  assert.equal(typeof client.from, 'function');
  assert.equal(typeof client.auth.signUp, 'function');
  assert.equal(typeof client.storage.from, 'function');
});
