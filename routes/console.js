const { WebSocketServer } = require('ws');
const ptyManager = require('../lib/ptyManager');

const DEFAULT_ID = 'default';

module.exports = {
  attach(httpServer, app) {
    const wss = new WebSocketServer({ noServer: true });

    // Standard-Konsole startet sofort beim Server-Start, nicht erst wenn jemand die
    // Konsolen-Seite öffnet — sonst gibt es kein Activity-Log, bevor jemand vorbeischaut.
    ptyManager.ensurePty(DEFAULT_ID);

    httpServer.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/api/console/ws') return;
      const id = url.searchParams.get('profile') || DEFAULT_ID;
      wss.handleUpgrade(req, socket, head, ws => {
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
