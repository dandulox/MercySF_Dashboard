const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Pairing-Modell: Ein Node-Agent kennt zu jedem Zeitpunkt höchstens ein Dashboard (einen
// Bearer-Token). Solange kein Dashboard gepaart ist, zeigt der Node einen zeitlich begrenzten
// Pairing-Code (IP + Code werden dem Nutzer am Server angezeigt, z. B. vom Installer). Erfolgreiches
// Pairing verbraucht den Code und ersetzt einen eventuell vorher gültigen Token — ein erneutes
// Pairing "kickt" also bewusst ein vorheriges Dashboard, statt mehrere gleichzeitig zuzulassen.
const DATA_DIR = path.join(__dirname, '..', 'data');
const PAIRING_PATH = path.join(DATA_DIR, 'pairing.json');
const TOKEN_PATH = path.join(DATA_DIR, 'dashboard-token.json');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O/1/I zur besseren Lesbarkeit
const CODE_LENGTH = 8;
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_PAIR_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

let failedAttempts = [];

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  try { fs.chmodSync(filePath, 0o600); } catch (e) { /* Windows-Entwicklungsumgebung ignoriert das */ }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function isPaired() {
  return !!readJson(TOKEN_PATH);
}

function getToken() {
  const entry = readJson(TOKEN_PATH);
  return entry ? entry.token : null;
}

function regenerateCode() {
  const entry = { code: generateCode(), expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString() };
  writeJson(PAIRING_PATH, entry);
  console.log(`[pairing] Neuer Pairing-Code: ${entry.code} (gültig bis ${entry.expiresAt})`);
  return entry;
}

function getActiveCode() {
  const entry = readJson(PAIRING_PATH);
  if (!entry) return null;
  if (Date.parse(entry.expiresAt) <= Date.now()) return null;
  return entry;
}

// Muss regelmäßig aufgerufen werden (siehe server.js), damit nach Ablauf eines ungenutzten Codes
// automatisch ein neuer generiert wird — sonst bliebe ein frisch installierter, aber nie
// gepairter Node nach 15 Minuten für immer unpairbar, ohne dass jemand manuell eingreift.
function ensureFreshCodeIfUnpaired() {
  if (isPaired()) return;
  if (!getActiveCode()) regenerateCode();
}

function tooManyAttempts() {
  const now = Date.now();
  failedAttempts = failedAttempts.filter(t => now - t < ATTEMPT_WINDOW_MS);
  return failedAttempts.length >= MAX_PAIR_ATTEMPTS;
}

function recordFailedAttempt() {
  failedAttempts.push(Date.now());
}

// Erfolgreiches Pairing verbraucht den Code (einmalig gültig) und legt einen neuen, zufälligen
// Dashboard-Token an. Ein evtl. vorher gepairtes Dashboard verliert damit sofort den Zugriff.
function pair(code) {
  if (tooManyAttempts()) {
    const err = new Error('Zu viele fehlgeschlagene Versuche — bitte kurz warten.');
    err.status = 429;
    throw err;
  }
  const active = getActiveCode();
  if (!active || active.code !== String(code).toUpperCase().trim()) {
    recordFailedAttempt();
    const err = new Error('Ungültiger oder abgelaufener Pairing-Code.');
    err.status = 401;
    throw err;
  }
  failedAttempts = [];
  const token = crypto.randomBytes(32).toString('hex');
  writeJson(TOKEN_PATH, { token, pairedAt: new Date().toISOString() });
  try { fs.unlinkSync(PAIRING_PATH); } catch (e) { /* schon weg, egal */ }
  return token;
}

function unpair() {
  try { fs.unlinkSync(TOKEN_PATH); } catch (e) { /* war eh nicht gepairt */ }
  regenerateCode();
}

function verifyToken(token) {
  const stored = getToken();
  if (!stored || !token) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  isPaired, getToken, regenerateCode, getActiveCode, ensureFreshCodeIfUnpaired,
  pair, unpair, verifyToken,
};
