const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const ptyManager = require('../lib/ptyManager');
const sessionStore = require('../lib/sessionStore');
const accountsRegistry = require('../lib/accountsRegistry');
const nodeRegistry = require('../lib/nodeRegistry');

const DEFAULT_ID = 'default';

// Läuft ein Profil auf einem entfernten Node, gibt es hier keine lokale PTY zum Anhängen —
// stattdessen baut das Dashboard selbst eine zweite WebSocket-Verbindung zum Node-Agent auf
// (Server-zu-Server, daher per Authorization-Header statt Cookie) und reicht Nachrichten in
// beide Richtungen 1:1 durch (Doppel-Hop: Browser ↔ Dashboard ↔ Node-Agent ↔ PTY). Das Protokoll
// ({type:'data'|'status'|'input'|'resize'|'restart'}) ist auf beiden Hops identisch, es wird also
// nicht übersetzt, nur weitergeleitet.
function attachRemoteRelay(node, profileId, browserWs) {
  const wsUrl = `${node.useTls ? 'wss' : 'ws'}://${node.host}:${node.port}/console/ws?profile=${encodeURIComponent(profileId)}`;
  const nodeWs = new WebSocket(wsUrl, {
    headers: { Authorization: `Bearer ${node.token}` },
    rejectUnauthorized: false,
  });

  let nodeOpen = false;
  const pending = [];

  nodeWs.on('open', () => {
    nodeOpen = true;
    pending.splice(0).forEach(m => nodeWs.send(m));
  });
  nodeWs.on('message', data => {
    if (browserWs.readyState === browserWs.OPEN) browserWs.send(data.toString());
  });
  nodeWs.on('close', () => {
    if (browserWs.readyState === browserWs.OPEN) {
      browserWs.send(JSON.stringify({ type: 'status', running: false, lastExitInfo: { reason: 'node_disconnected' } }));
    }
  });
  nodeWs.on('error', err => {
    console.error(`[console-relay:${profileId}] Node "${node.name}" nicht erreichbar:`, err.message);
    if (browserWs.readyState === browserWs.OPEN) {
      browserWs.send(JSON.stringify({ type: 'status', running: false, lastExitInfo: { reason: 'node_unreachable', message: err.message } }));
    }
  });

  browserWs.on('message', raw => {
    const text = raw.toString();
    if (nodeOpen) nodeWs.send(text); else pending.push(text);
  });
  browserWs.on('close', () => { try { nodeWs.close(); } catch (e) { /* schon zu */ } });
}

module.exports = {
  attach(httpServer, app) {
    const wss = new WebSocketServer({ noServer: true });

    // Standard-Konsole startet sofort beim Server-Start, nicht erst wenn jemand die
    // Konsolen-Seite öffnet — sonst gibt es kein Activity-Log, bevor jemand vorbeischaut.
    ptyManager.ensurePty(DEFAULT_ID);

    httpServer.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/api/console/ws') return;
      if (!sessionStore.isValid(sessionStore.readSessionCookie(req))) {
        socket.destroy();
        return;
      }
      const id = url.searchParams.get('profile') || DEFAULT_ID;
      wss.handleUpgrade(req, socket, head, ws => {
        const profile = id !== DEFAULT_ID ? accountsRegistry.list().find(p => p.id === id) : null;
        const node = profile && profile.nodeId ? nodeRegistry.get(profile.nodeId) : null;
        if (node) {
          attachRemoteRelay(node, id, ws);
          return;
        }

        ptyManager.ensurePty(id);
        ptyManager.attachSocket(id, ws);
        const status = ptyManager.getStatus(id);
        ws.send(JSON.stringify({ type: 'status', running: status.running, lastExitInfo: status.lastExitInfo }));
        ws.on('message', raw => {
          let msg;
          try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
          if (msg.type === 'input') ptyManager.write(id, msg.data);
          if (msg.type === 'resize') ptyManager.resize(id, msg.cols, msg.rows);
          if (msg.type === 'restart') ptyManager.restartPty(id);
        });
      });
    });

    app.post('/api/console/restart', (req, res) => {
      ptyManager.restartPty(DEFAULT_ID);
      res.json({ ok: true, running: ptyManager.getStatus(DEFAULT_ID).running });
    });

    app.get('/api/console/status', (req, res) => {
      res.json(ptyManager.getStatus(DEFAULT_ID));
    });
  },
};
