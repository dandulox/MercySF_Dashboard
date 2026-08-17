const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createClient } = require('./dashboardClient');

function startFakeDashboard() {
  const nodes = [{ id: 'n1', name: 'node-1', host: 'node-1', port: 8090 }];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const parsed = body ? JSON.parse(body) : {};
      const cookie = req.headers.cookie || '';

      if (req.method === 'POST' && req.url === '/api/auth/setup') {
        res.setHeader('Set-Cookie', 'mercy_session=abc123; Path=/');
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ aesKey: 'fakeaeskey', recoveryPhrase: 'one two three' }));
        return;
      }
      if (req.method === 'POST' && req.url === '/api/auth/login') {
        if (parsed.username === 'admin' && parsed.password === 'secret') {
          res.setHeader('Set-Cookie', 'mercy_session=abc123; Path=/');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Zugangsdaten ungültig' }));
        }
        return;
      }
      if (req.method === 'POST' && req.url === '/api/nodes/pair') {
        if (!cookie.includes('mercy_session=abc123')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nicht angemeldet' }));
          return;
        }
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'n2', name: parsed.name || parsed.host, host: parsed.host, port: parsed.port }));
        return;
      }
      if (req.method === 'GET' && req.url === '/api/nodes') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ id: 'local' }, ...nodes]));
        return;
      }
      if (req.method === 'DELETE' && req.url === '/api/nodes/n1') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('setup returns aesKey and recoveryPhrase', async () => {
  const server = await startFakeDashboard();
  const { port } = server.address();
  const client = createClient(`http://127.0.0.1:${port}`);
  const result = await client.setup('admin', 'secret');
  assert.deepEqual(result, { aesKey: 'fakeaeskey', recoveryPhrase: 'one two three' });
  server.close();
});

test('login then pairNode succeeds using the session cookie from login', async () => {
  const server = await startFakeDashboard();
  const { port } = server.address();
  const client = createClient(`http://127.0.0.1:${port}`);
  await client.login('admin', 'secret');
  const result = await client.pairNode({ name: 'node-1', host: 'node-1', port: 8090, code: 'XYZ' });
  assert.equal(result.host, 'node-1');
  server.close();
});

test('login rejects with wrong credentials', async () => {
  const server = await startFakeDashboard();
  const { port } = server.address();
  const client = createClient(`http://127.0.0.1:${port}`);
  await assert.rejects(() => client.login('admin', 'wrong'), /Zugangsdaten ungültig/);
  server.close();
});

test('pairNode without prior login is rejected by the server (401 surfaced as error)', async () => {
  const server = await startFakeDashboard();
  const { port } = server.address();
  const client = createClient(`http://127.0.0.1:${port}`);
  await assert.rejects(() => client.pairNode({ name: 'x', host: 'x', port: 1, code: 'y' }), /Nicht angemeldet/);
  server.close();
});

test('listNodes and deleteNode work after login', async () => {
  const server = await startFakeDashboard();
  const { port } = server.address();
  const client = createClient(`http://127.0.0.1:${port}`);
  await client.login('admin', 'secret');
  const nodes = await client.listNodes();
  assert.equal(nodes.length, 2);
  await client.deleteNode('n1');
  server.close();
});
