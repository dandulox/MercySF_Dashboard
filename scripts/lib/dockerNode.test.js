const test = require('node:test');
const assert = require('node:assert/strict');
const { buildNodeAgentRunArgs, parsePairingJson, pollUntil } = require('./dockerNode');

test('buildNodeAgentRunArgs produces a detached container with NET_ADMIN, tun device, and named volume', () => {
  const args = buildNodeAgentRunArgs({
    name: 'node-1',
    network: 'mercy-net',
    image: 'mercy-node-agent:latest',
    volumeName: 'mercy_node_node-1_data',
  });
  assert.equal(args[0], 'run');
  assert.ok(args.includes('-d'));
  assert.ok(args.includes('--name'));
  assert.ok(args.includes('node-1'));
  assert.ok(args.includes('--network'));
  assert.ok(args.includes('mercy-net'));
  assert.ok(args.includes('--cap-add'));
  assert.ok(args.includes('NET_ADMIN'));
  assert.ok(args.includes('--device'));
  assert.ok(args.includes('/dev/net/tun'));
  assert.ok(args.join(' ').includes('mercy_node_node-1_data:/app/data'));
  assert.equal(args[args.length - 1], 'mercy-node-agent:latest');
});

test('parsePairingJson returns code + expiresAt for valid JSON', () => {
  const result = parsePairingJson('{"code":"ABCD1234","expiresAt":"2026-08-17T12:00:00.000Z"}');
  assert.deepEqual(result, { code: 'ABCD1234', expiresAt: '2026-08-17T12:00:00.000Z' });
});

test('parsePairingJson throws on invalid JSON', () => {
  assert.throws(() => parsePairingJson('not json'), /Ungültige Pairing-Datei/);
});

test('parsePairingJson throws when code is missing', () => {
  assert.throws(() => parsePairingJson('{"expiresAt":"2026-08-17T12:00:00.000Z"}'), /Ungültige Pairing-Datei/);
});

test('pollUntil resolves once fn returns a truthy value', async () => {
  let calls = 0;
  const result = await pollUntil(() => {
    calls += 1;
    return calls < 3 ? null : 'ready';
  }, { intervalMs: 5, timeoutMs: 1000 });
  assert.equal(result, 'ready');
  assert.equal(calls, 3);
});

test('pollUntil rejects with Timeout when fn never returns truthy', async () => {
  await assert.rejects(
    () => pollUntil(() => null, { intervalMs: 5, timeoutMs: 20 }),
    /Timeout/
  );
});
