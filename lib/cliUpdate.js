const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const ptyManager = require('./ptyManager');

const CLI_PATH = '/opt/mercy/mercy-cli-linux-x64';
const DOWNLOAD_URL = 'https://mercysf.app/downloads/mercy-cli-linux-x64';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const state = {
  checking: false,
  applying: false,
  updateAvailable: false,
  currentHash: null,
  remoteHash: null,
  lastCheckedAt: null,
  lastError: null,
};

function md5OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// destDir default (os.tmpdir(), meist /tmp) reicht zum bloßen Prüfen/Hashen. Für den tatsächlichen
// Austausch (applyUpdate) muss der Download im selben Verzeichnis wie CLI_PATH landen, sonst
// schlägt das abschließende renameSync mit EXDEV fehl, wenn /tmp ein anderes Dateisystem ist
// als /opt (z. B. tmpfs in manchen Container-Setups).
function downloadToTemp(destDir) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(destDir || os.tmpdir(), `.mercy-cli-download-${Date.now()}`);
    const file = fs.createWriteStream(tmpPath);
    https.get(DOWNLOAD_URL, res => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(tmpPath, () => {});
        reject(new Error(`Download fehlgeschlagen: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(tmpPath)));
    }).on('error', err => {
      file.close();
      fs.unlink(tmpPath, () => {});
      reject(err);
    });
  });
}

async function checkForUpdate() {
  if (state.checking) return state;
  state.checking = true;
  let tmpPath = null;
  try {
    tmpPath = await downloadToTemp();
    const remoteHash = await md5OfFile(tmpPath);
    const currentHash = fs.existsSync(CLI_PATH) ? await md5OfFile(CLI_PATH) : null;
    state.remoteHash = remoteHash;
    state.currentHash = currentHash;
    state.updateAvailable = currentHash !== null && currentHash !== remoteHash;
    state.lastCheckedAt = new Date().toISOString();
    state.lastError = null;
  } catch (err) {
    state.lastError = err.message;
  } finally {
    if (tmpPath) fs.unlink(tmpPath, () => {});
    state.checking = false;
  }
  return state;
}

async function applyUpdate() {
  if (state.applying) throw new Error('Update läuft bereits');
  if (!state.updateAvailable) throw new Error('Kein Update verfügbar');
  state.applying = true;
  let tmpPath = null;
  try {
    tmpPath = await downloadToTemp(path.dirname(CLI_PATH));
    const freshHash = await md5OfFile(tmpPath);
    if (freshHash !== state.remoteHash) {
      throw new Error('Heruntergeladene Datei weicht vom zuletzt geprüften Stand ab, breche ab');
    }
    if (fs.existsSync(CLI_PATH)) {
      fs.copyFileSync(CLI_PATH, `${CLI_PATH}.bak`);
    }
    try {
      fs.renameSync(tmpPath, CLI_PATH);
    } catch (err) {
      // Fallback, falls Download- und Zielverzeichnis doch auf unterschiedlichen Dateisystemen
      // liegen (rename() kann nicht über Geräte-/Mount-Grenzen hinweg, copy+unlink schon).
      if (err.code !== 'EXDEV') throw err;
      fs.copyFileSync(tmpPath, CLI_PATH);
      fs.unlinkSync(tmpPath);
    }
    fs.chmodSync(CLI_PATH, 0o755);
    tmpPath = null;
    // Nur Sessions neu starten, die gerade tatsächlich laufen (ptyManager.listActiveIds) —
    // startet keine dormanten Account-Profile, die noch nie eine Konsole geöffnet hatten.
    for (const id of ptyManager.listActiveIds()) ptyManager.restartPty(id);
    state.updateAvailable = false;
    state.currentHash = state.remoteHash;
    state.lastError = null;
    return state.currentHash;
  } catch (err) {
    state.lastError = err.message;
    throw err;
  } finally {
    if (tmpPath) fs.unlink(tmpPath, () => {});
    state.applying = false;
  }
}

checkForUpdate();
setInterval(checkForUpdate, CHECK_INTERVAL_MS);

module.exports = { state, checkForUpdate, applyUpdate, CLI_PATH, DOWNLOAD_URL };
