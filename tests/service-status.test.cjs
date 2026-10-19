/* eslint-disable @typescript-eslint/no-require-imports -- VM harness tests server modules without live infrastructure. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(options = {}) {
  let time = Date.parse('2026-10-19T12:00:00Z');
  const calls = [];
  const env = options.env ?? {
    AXON_PUBLIC_SITE_URL: 'https://web.example',
    AXON_HEALTHCHECK_URL: 'https://backend.example/webhook/axon-health',
    AXON_HEALTHCHECK_SECRET: 'monitor-secret',
  };
  const modules = {};
  function load(path) {
    if (modules[path]) return modules[path];
    const exports = {};
    modules[path] = exports;
    const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, {
      exports, process: { env }, Response, Request, URL, AbortSignal, TextDecoder, Uint8Array, Date, Promise,
      require(name) {
        if (name === 'server-only') return {};
        if (name === '@/lib/service-status') return load('lib/service-status.ts');
        if (name === '@/lib/status-checks') return load('lib/status-checks.ts');
        return require(name);
      },
      fetch: async () => { throw Error('Unexpected default fetch'); },
    }, { filename: path });
    return exports;
  }
  const getStatus = load('lib/status-checks.ts').createStatusChecker({
    env, now: () => time, requestId: () => 'request-fixture',
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      const website = String(url).startsWith('https://web.example');
      if (options.reply) return options.reply({ website, url, init, advance: ms => { time += ms; } });
      return Response.json(website
        ? { service: 'axon-web', status: 'ok', request_id: init.headers['x-axon-health-request-id'] }
        : { service: 'axon-health', database: 'ok', request_id: init.headers['x-axon-health-request-id'] });
    },
  });
  return { getStatus, calls, load, advance: ms => { time += ms; } };
}

function states(result) { return Array.from(result.services, s => s.state); }

test('without configuration no outbound requests are made and all states are unknown', async () => {
  const f = fixture({ env: {} });
  assert.deepEqual(states(await f.getStatus()), ['unknown', 'unknown', 'unknown']);
  assert.equal(f.calls.length, 0);
});

test('matching fresh responses mark only the three covered services operational', async () => {
  const f = fixture();
  const result = await f.getStatus();
  assert.deepEqual(states(result), ['operational', 'operational', 'operational']);
  assert.equal(result.services[2].latencyMs, null);
  assert.equal(f.calls.length, 2);
  assert(f.calls.every(c => c.init.method === undefined && c.init.redirect === 'error' && c.init.cache === 'no-store' && c.init.signal));
  assert(!JSON.stringify(result).includes('monitor-secret'));
  assert(!JSON.stringify(result).includes('backend.example'));
  assert(!f.calls[0].init.headers['x-axon-health-secret']);
  assert.equal(f.calls[1].init.headers['x-axon-health-secret'], 'monitor-secret');
});

test('a database failure does not claim the backend runtime is down', async () => {
  const f = fixture({ reply: ({ website, init }) => Response.json(website
    ? { service: 'axon-web', status: 'ok', request_id: init.headers['x-axon-health-request-id'] }
    : { service: 'axon-health', database: 'error', request_id: init.headers['x-axon-health-request-id'] }, { status: website ? 200 : 503 }) });
  assert.deepEqual(states(await f.getStatus()), ['operational', 'operational', 'unreachable']);
});

for (const status of [401, 403, 404]) test('HTTP ' + status + ' is configuration unknown, not an outage', async () => {
  const f = fixture({ reply: () => Response.json({ error: 'private upstream detail' }, { status }) });
  const result = await f.getStatus();
  assert.deepEqual(states(result), ['unknown', 'unknown', 'unknown']);
  assert(!JSON.stringify(result).includes('private upstream detail'));
});

test('HTTP 200 with a stale request ID or default n8n body never produces green', async () => {
  for (const body of [{ service: 'axon-health', database: 'ok', request_id: 'old' }, { message: 'Workflow was started' }]) {
    const f = fixture({ reply: () => Response.json(body) });
    assert.deepEqual(states(await f.getStatus()), ['unknown', 'unknown', 'unknown']);
  }
});

test('unreachable checks leave database unknown rather than inventing a database outage', async () => {
  const f = fixture({ reply: () => { throw new Error('connection private.example failed'); } });
  const result = await f.getStatus();
  assert.deepEqual(states(result), ['unreachable', 'unreachable', 'unknown']);
  assert(!JSON.stringify(result).includes('private.example'));
});

test('5xx failures are not operational', async () => {
  const f = fixture({ reply: () => Response.json({ message: 'failure' }, { status: 502 }) });
  assert.deepEqual(states(await f.getStatus()), ['unreachable', 'unreachable', 'unknown']);
});

test('large or malformed responses fail closed without exposing their content', async () => {
  for (const body of ['{"private":"' + 'x'.repeat(20000) + '"}', '<html>not JSON</html>']) {
    const f = fixture({ reply: () => new Response(body) });
    assert.deepEqual(states(await f.getStatus()), ['unknown', 'unknown', 'unknown']);
  }
});

test('concurrent viewers share requests and cached results expire', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 20 }, () => f.getStatus()));
  assert.equal(f.calls.length, 2);
  assert(results.every(result => result === results[0]));
  f.advance(29000);
  await f.getStatus();
  assert.equal(f.calls.length, 2);
  f.advance(1001);
  await f.getStatus();
  assert.equal(f.calls.length, 4);
});

test('slow successful checks are distinguished from failed checks', async () => {
  const f = fixture({ reply: ({ website, init, advance }) => {
    advance(2500);
    return Response.json(website ? { service: 'axon-web', status: 'ok', request_id: init.headers['x-axon-health-request-id'] }
      : { service: 'axon-health', database: 'ok', request_id: init.headers['x-axon-health-request-id'] });
  } });
  const result = await f.getStatus();
  assert.equal(result.services[0].state, 'degraded');
  assert.equal(result.services[1].state, 'degraded');
  assert.equal(result.services[2].state, 'operational');
});

test('invalid URLs and missing secret cannot trigger a backend request', async () => {
  for (const url of ['http://external.example/health', 'https://user:password@example.com/health', 'file:///tmp/health', 'not-a-url']) {
    const f = fixture({ env: { AXON_HEALTHCHECK_URL: url, AXON_HEALTHCHECK_SECRET: 'secret' } });
    await f.getStatus(); assert.equal(f.calls.length, 0);
  }
  const f = fixture({ env: { AXON_HEALTHCHECK_URL: 'https://backend.example/health' } });
  await f.getStatus(); assert.equal(f.calls.length, 0);
});

test('public web health returns a bounded nonce and explicitly disables caching', async () => {
  const f = fixture({ env: {} });
  const route = f.load('app/api/health/route.ts');
  const response = await route.GET(new Request('https://web.example/api/health', { headers: { 'x-axon-health-request-id': 'r'.repeat(200) } }));
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'axon-web');
  assert.equal(body.request_id.length, 80);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('public status endpoint works without authentication and only returns sanitized snapshot', async () => {
  const f = fixture({ env: {} });
  const response = await f.load('app/api/status/route.ts').GET();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.services.length, 3);
  assert(response.headers.get('Cache-Control').includes('s-maxage=30'));
});
