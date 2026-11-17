import { test } from 'node:test';
import assert from 'node:assert/strict';

const origin = 'http://fixtures.firecrawl.test:8765';
const loadPolicy = (configured: string | undefined) => {
  const previous = process.env.LOCAL_FIXTURE_ORIGIN;
  const modulePath = require.resolve('./local_fixture');
  delete require.cache[modulePath];
  if (configured === undefined) delete process.env.LOCAL_FIXTURE_ORIGIN;
  else process.env.LOCAL_FIXTURE_ORIGIN = configured;
  try {
    return require('./local_fixture') as typeof import('./local_fixture');
  } finally {
    if (previous === undefined) delete process.env.LOCAL_FIXTURE_ORIGIN;
    else process.env.LOCAL_FIXTURE_ORIGIN = previous;
  }
};

test('the fixture exception is disabled unless explicitly configured', () => {
  for (const value of [undefined, '']) {
    const policy = loadPolicy(value);
    assert.equal(policy.isLocalFixtureUrl(origin + '/static.html'), false);
    assert.equal(policy.isLocalFixtureProxyRequest({
      hostname: 'fixtures.firecrawl.test', port: 8765,
      request: { method: 'GET', url: origin + '/static.html' },
    }), false);
  }
});

test('only the exact configured fixture origin is allowed', () => {
  const policy = loadPolicy(origin);
  assert.equal(policy.isLocalFixtureUrl(origin + '/static.html'), true);
  for (const url of [
    'http://fixtures-denied.firecrawl.test:8765/static.html',
    'http://fixtures.firecrawl.test:8766/static.html',
    'https://fixtures.firecrawl.test:8765/static.html',
    'http://user:password@fixtures.firecrawl.test:8765/static.html',
    'http://127.0.0.1:8765/static.html',
    'http://169.254.169.254/latest/meta-data/',
  ]) assert.equal(policy.isLocalFixtureUrl(url), false, url);
  assert.throws(() => loadPolicy('http://localhost:8765'));
});

test('proxy fixture exception checks both URL and authority and never CONNECT', () => {
  const policy = loadPolicy(origin);
  const request = { method: 'GET', url: origin + '/static.html' };
  assert.equal(policy.isLocalFixtureProxyRequest({ hostname: 'fixtures.firecrawl.test', port: 8765, request }), true);
  assert.equal(policy.isLocalFixtureProxyRequest({ hostname: 'fixtures-denied.firecrawl.test', port: 8765, request }), false);
  assert.equal(policy.isLocalFixtureProxyRequest({ hostname: 'fixtures.firecrawl.test', port: 8766, request }), false);
  assert.equal(policy.isLocalFixtureProxyRequest({ hostname: 'fixtures.firecrawl.test', port: 8765, request: { ...request, method: 'CONNECT' } }), false);
  assert.equal(policy.isLocalFixtureProxyRequest({ hostname: 'fixtures.firecrawl.test', port: 8765, request: { method: 'GET', url: '/relative.html' } }), false);
});
