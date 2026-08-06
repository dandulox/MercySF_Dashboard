const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { findDataDir, listAccounts, latestSnapshot, recentLogLines, isProcessRunning } = require('./lib/data');
const logBuffer = require('./lib/logBuffer');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/api/status', (req, res) => {
  const dataDir = findDataDir();
  res.json({ dataDir, botRunning: isProcessRunning() });
});

app.get('/api/accounts', (req, res) => {
  const dataDir = findDataDir();
  if (!dataDir) return res.json([]);
  const accounts = listAccounts(dataDir).map(acc => ({
    ...acc,
    stats: latestSnapshot(dataDir, acc.id),
    currentActivity: logBuffer.getLastActivity(acc.charName),
  }));
  res.json(accounts);
});

app.get('/api/account/:id/logs', (req, res) => {
  const dataDir = findDataDir();
  if (!dataDir) return res.json([]);
  const accounts = listAccounts(dataDir);
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json([]);
  const fileLines = recentLogLines(dataDir, acc.charName);
  // Diese Linux-Builds der CLI schreiben keine Log-Dateien auf die Platte — Fallback auf
  // den Live-Ringpuffer aus dem PTY-Output der eingebauten Konsole (routes/console.js).
  const lines = fileLines.length ? fileLines : logBuffer.getRecentLines(acc.charName);
  res.json(lines);
});

app.use(express.static(path.join(__dirname, 'public')));

const certPath = process.env.SSL_CERT || '/opt/mercy/certs/cert.pem';
const keyPath = process.env.SSL_KEY || '/opt/mercy/certs/key.pem';
const useTls = fs.existsSync(certPath) && fs.existsSync(keyPath);

const httpServer = useTls
  ? https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
  : http.createServer(app);

const routesDir = path.join(__dirname, 'routes');
if (fs.existsSync(routesDir)) {
  for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith('.js')) continue;
    const name = file.replace(/\.js$/, '');
    const mod = require(path.join(routesDir, file));
    if (typeof mod === 'function') {
      app.use(`/api/${name}`, mod);
      console.log(`Mounted route module '${name}' at /api/${name}`);
    } else if (mod && typeof mod.attach === 'function') {
      mod.attach(httpServer, app);
      console.log(`Attached module '${name}'`);
    }
  }
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Mercy Dashboard (${useTls ? 'HTTPS' : 'HTTP'}) listening on :${PORT}`);
  console.log(`Resolved data dir: ${findDataDir() || '(none found yet)'}`);
});
