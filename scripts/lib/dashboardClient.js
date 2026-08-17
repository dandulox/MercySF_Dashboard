const http = require('node:http');
const https = require('node:https');

function request(baseUrl, { method = 'GET', path, body, cookie }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = mod.request(url, {
      method,
      headers,
      timeout: 10000,
      ...(url.protocol === 'https:' ? { rejectUnauthorized: false } : {}),
    }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (e) { /* keine JSON-Antwort */ }
        const setCookie = res.headers['set-cookie'];
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ body: parsed, setCookie });
        } else {
          reject(new Error((parsed && parsed.error) || `Dashboard antwortete mit Status ${res.statusCode}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung bei der Verbindung zum Dashboard')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function createClient(baseUrl) {
  let sessionCookie = null;

  function extractCookie(setCookieHeaders) {
    if (!setCookieHeaders || !setCookieHeaders.length) return null;
    return setCookieHeaders[0].split(';')[0];
  }

  return {
    async setup(username, password) {
      const { body, setCookie } = await request(baseUrl, { method: 'POST', path: '/api/auth/setup', body: { username, password } });
      sessionCookie = extractCookie(setCookie) || sessionCookie;
      return body;
    },
    async login(username, password) {
      const { setCookie } = await request(baseUrl, { method: 'POST', path: '/api/auth/login', body: { username, password } });
      sessionCookie = extractCookie(setCookie);
    },
    async pairNode({ name, host, port, code }) {
      const { body } = await request(baseUrl, { method: 'POST', path: '/api/nodes/pair', body: { name, host, port, code }, cookie: sessionCookie });
      return body;
    },
    async listNodes() {
      const { body } = await request(baseUrl, { method: 'GET', path: '/api/nodes', cookie: sessionCookie });
      return body;
    },
    async deleteNode(id) {
      await request(baseUrl, { method: 'DELETE', path: `/api/nodes/${id}`, cookie: sessionCookie });
    },
  };
}

module.exports = { createClient };
