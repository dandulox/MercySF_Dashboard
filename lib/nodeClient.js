const http = require('http');
const https = require('https');

// Kleiner HTTP-Client für die Kommunikation mit einem Node-Agent (kein axios im Projekt, siehe
// cliExec.js/dashboardUpdate.js — gleiches Muster: eingebaute http/https-Module). Node-Agents
// verwenden wie das Dashboard selbstsignierte Zertifikate (siehe install.sh), daher
// rejectUnauthorized:false — das Vertrauen entsteht durch den einmaligen Pairing-Code, nicht
// durch eine öffentliche CA.
const DEFAULT_TIMEOUT_MS = 10_000;

function requestJson(nodeUrl, { method = 'GET', path, body, token, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, nodeUrl);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = mod.request(url, {
      method,
      headers,
      timeout: timeoutMs,
      ...(isHttps ? { rejectUnauthorized: false } : {}),
    }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (e) { /* keine JSON-Antwort */ }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const message = (parsed && parsed.error) || `Node antwortete mit Status ${res.statusCode}`;
          reject(Object.assign(new Error(message), { status: res.statusCode }));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung bei der Verbindung zum Node')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Ein neu installierter Node kennt kein Protokoll für den Nutzer — probiert HTTPS zuerst (Standard
// bei installiertem Zertifikat), fällt bei Verbindungsfehlern auf HTTP zurück. Wird einmalig beim
// Pairing verwendet; das Ergebnis (welches Protokoll funktioniert hat) landet im Node-Datensatz.
async function withProtocolFallback(host, port, fn) {
  try {
    return { useTls: true, ...(await fn(`https://${host}:${port}`)) };
  } catch (err) {
    return { useTls: false, ...(await fn(`http://${host}:${port}`)) };
  }
}

function nodeBaseUrl(node) {
  return `${node.useTls ? 'https' : 'http'}://${node.host}:${node.port}`;
}

async function health(host, port) {
  const { useTls, ...result } = await withProtocolFallback(host, port, base => requestJson(base, { path: '/health', timeoutMs: 5000 }));
  return { useTls, ...result };
}

async function pairNode({ host, port, code, timeoutMs }) {
  const { useTls, ...result } = await withProtocolFallback(host, port, base =>
    requestJson(base, { method: 'POST', path: '/pair', body: { code }, timeoutMs: timeoutMs || 8000 }));
  return { useTls, ...result };
}

function call(node, path, { method = 'GET', body, timeoutMs } = {}) {
  return requestJson(nodeBaseUrl(node), { method, path, body, token: node.token, timeoutMs });
}

module.exports = {
  health,
  pairNode,
  call,
  nodeBaseUrl,
  requestJson,
};
