const pty = require('node-pty');
const profileStore = require('./profileStore');
const credentialStore = require('./credentialStore');
const actionLog = require('./actionLog');

// Angepasste Kopie von MercySF_Dashboard/lib/ptyManager.js für den Node-Agent: gleiche
// Autofill-/Status-Erkennungslogik, aber ohne Abhängigkeit auf das dortige notifications-/
// logBuffer-Modul (Warnungen/Fehler landen hier nur im lokalen Prozess-Log, das Dashboard sieht
// den Zustand über den Status-Broadcast bzw. beim nächsten WS-Connect).
const CLI_PATH = process.env.MERCY_CLI_PATH || '/opt/mercy/mercy-cli-linux-x64';
const CWD = process.env.MERCY_CLI_CWD || '/opt/mercy';

const sessions = new Map(); // id -> { proc, sockets, lastExitInfo, autofill, scrollback, botState, stateBuffer }

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const CHAR_LIST_RE = /\[(\d+)\]\s+([^\n@]+?)\s+@\s+(\S+)/g;
const SCROLLBACK_MAX_CHARS = 80_000;

const STATE_RANK = { offline: 0, connecting: 1, logged_in: 2, running: 3 };

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, {
      proc: null,
      sockets: new Set(),
      lastExitInfo: null,
      autofill: null,
      scrollback: '',
      botState: 'offline',
      stateBuffer: '',
      startedAt: null,
      commandsSent: 0,
      errorsSeen: 0,
    });
  }
  return sessions.get(id);
}

function broadcastStatus(id) {
  const s = getSession(id);
  const msg = JSON.stringify({
    type: 'status',
    running: !!s.proc,
    botState: s.botState,
    lastExitInfo: s.lastExitInfo,
    startedAt: s.startedAt,
    commandsSent: s.commandsSent,
    errorsSeen: s.errorsSeen,
  });
  for (const ws of s.sockets) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function updateBotState(s, data) {
  s.stateBuffer = (s.stateBuffer + data.replace(ANSI_RE, '')).slice(-600);
  const buf = s.stateBuffer;
  let detected = null;
  if (/\[.+?\]\s+(Sending command|Received response)/.test(buf)) detected = 'running';
  else if (/Bot Menu/i.test(buf)) detected = 'logged_in';
  if (detected && STATE_RANK[detected] > STATE_RANK[s.botState]) {
    const prev = s.botState;
    s.botState = detected;
    if (prev !== detected) broadcastStatus(getIdForSession(s));
  }
}

function getIdForSession(target) {
  for (const [id, s] of sessions.entries()) if (s === target) return id;
  return null;
}

function handleAutofill(s, data) {
  const st = s.autofill;
  st.buffer = (st.buffer + data.replace(ANSI_RE, '')).slice(-8000);
  const buf = st.buffer;

  if (st.stage === 'menu' && /Select option:/.test(buf)) {
    st.stage = 'username';
    st.buffer = '';
    s.proc.write('1\r');
    return;
  }
  if (st.stage === 'username' && /Username:/i.test(buf)) {
    st.buffer = '';
    s.proc.write(st.username + '\r');
    st.stage = st.password ? 'password' : null;
    if (!st.stage) s.autofill = null;
    return;
  }
  if (st.stage === 'password' && /Password:\s*$/im.test(buf.trimEnd())) {
    st.buffer = '';
    s.proc.write(st.password + '\r');
    st.stage = st.characterName ? 'character' : null;
    if (!st.stage) s.autofill = null;
    return;
  }
  if (st.stage === 'character') {
    if (/Select character index:/i.test(buf)) {
      const matches = [...buf.matchAll(CHAR_LIST_RE)];
      const found = matches.find(m => m[2].trim() === st.characterName);
      if (found) s.proc.write(found[1] + '\r');
      st.stage = 'botmenu';
      st.buffer = '';
      return;
    }
    if (/Bot Menu/i.test(buf) && /Select option:/.test(buf)) {
      s.proc.write('1\r');
      s.autofill = null;
      return;
    }
    return;
  }
  if (st.stage === 'botmenu' && /Select option:/.test(buf)) {
    s.proc.write('1\r');
    s.autofill = null;
  }
}

function ensurePty(id) {
  const s = getSession(id);
  if (s.proc) return s.proc;
  try {
    s.proc = pty.spawn(CLI_PATH, [], {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: CWD,
      env: process.env,
    });
  } catch (err) {
    console.error(`[pty:${id}] Fehler beim Starten:`, err);
    s.lastExitInfo = { reason: 'spawn_failed', message: err.message, at: new Date().toISOString() };
    s.proc = null;
    s.botState = 'offline';
    broadcastStatus(id);
    return null;
  }
  console.log(`[pty:${id}] gestartet (pid ${s.proc.pid})`);

  const profile = profileStore.get(id);
  s.autofill = profile ? {
    username: profile.username,
    password: credentialStore.getPassword(id),
    characterName: profile.characterName || null,
    stage: 'menu',
    buffer: '',
  } : null;
  s.scrollback = '';
  s.stateBuffer = '';
  s.botState = 'connecting';
  s.startedAt = new Date().toISOString();
  s.commandsSent = 0;
  s.errorsSeen = 0;

  s.proc.onData(data => {
    if (s.autofill) handleAutofill(s, data);
    updateBotState(s, data);
    const clean = data.replace(ANSI_RE, '');
    s.commandsSent += (clean.match(/Sending command:/g) || []).length;
    s.errorsSeen += (clean.match(/\b(WARN|ERROR)\b/g) || []).length;
    for (const line of clean.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) actionLog.maybeRecordAction(trimmed);
    }
    s.scrollback = (s.scrollback + data).slice(-SCROLLBACK_MAX_CHARS);
    for (const ws of s.sockets) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'data', data }));
    }
  });
  s.proc.onExit(({ exitCode, signal }) => {
    console.log(`[pty:${id}] beendet (exitCode=${exitCode}, signal=${signal})`);
    s.lastExitInfo = { reason: 'exited', exitCode, signal, at: new Date().toISOString() };
    s.proc = null;
    s.autofill = null;
    s.botState = 'offline';
    broadcastStatus(id);
  });
  s.lastExitInfo = null;
  broadcastStatus(id);
  return s.proc;
}

function killPty(id) {
  const s = sessions.get(id);
  if (s && s.proc) {
    try { s.proc.kill(); } catch (e) { /* Prozess evtl. schon weg */ }
    s.proc = null;
    s.autofill = null;
    s.botState = 'offline';
    s.startedAt = null;
  }
}

function restartPty(id) {
  killPty(id);
  return ensurePty(id);
}

function getStatus(id) {
  const s = sessions.get(id);
  return {
    running: !!(s && s.proc),
    botState: s ? s.botState : 'offline',
    lastExitInfo: s ? s.lastExitInfo : null,
    startedAt: s ? s.startedAt : null,
    commandsSent: s ? s.commandsSent : 0,
    errorsSeen: s ? s.errorsSeen : 0,
  };
}

function attachSocket(id, ws) {
  const s = getSession(id);
  if (s.scrollback && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: 'data', data: s.scrollback }));
  }
  s.sockets.add(ws);
  ws.on('close', () => s.sockets.delete(ws));
}

function write(id, data) {
  const s = sessions.get(id);
  if (s && s.proc) s.proc.write(data);
}

function resize(id, cols, rows) {
  const s = sessions.get(id);
  if (s && s.proc) s.proc.resize(cols, rows);
}

function listActiveIds() {
  return [...sessions.entries()].filter(([, s]) => s.proc).map(([id]) => id);
}

module.exports = { ensurePty, killPty, restartPty, getStatus, attachSocket, write, resize, listActiveIds };
