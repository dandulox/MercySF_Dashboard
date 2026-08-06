const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');
const SESSION_COOKIE = 'mercy_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readSessions() {
  if (!fs.existsSync(SESSIONS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeSessions(sessions) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2), { mode: 0o600 });
  try { fs.chmodSync(SESSIONS_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function pruneExpired(sessions) {
  const now = Date.now();
  let changed = false;
  for (const token of Object.keys(sessions)) {
    if (Date.parse(sessions[token].expiresAt) <= now) {
      delete sessions[token];
      changed = true;
    }
  }
  return changed;
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = readSessions();
  pruneExpired(sessions);
  sessions[token] = {
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  writeSessions(sessions);
  return token;
}

function isValid(token) {
  if (!token) return false;
  const entry = readSessions()[token];
  if (!entry) return false;
  return Date.parse(entry.expiresAt) > Date.now();
}

function destroySession(token) {
  const sessions = readSessions();
  if (sessions[token]) {
    delete sessions[token];
    writeSessions(sessions);
  }
}

function readSessionCookie(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name === SESSION_COOKIE) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

setInterval(() => {
  const sessions = readSessions();
  if (pruneExpired(sessions)) writeSessions(sessions);
}, 60 * 60 * 1000);

module.exports = { createSession, isValid, destroySession, readSessionCookie, SESSION_COOKIE, SESSION_TTL_MS };
