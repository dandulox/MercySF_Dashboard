const { execSync, spawn } = require('child_process');
const path = require('path');

const REPO_DIR = path.join(__dirname, '..');
const BRIDGE_DIR = path.join(REPO_DIR, 'sfapi-bridge');
const GITHUB_API = 'https://api.github.com/repos/dandulox/MercySF_Dashboard/commits/main';
const GITHUB_PACKAGE_JSON_API = 'https://api.github.com/repos/dandulox/MercySF_Dashboard/contents/package.json?ref=main';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const state = {
  checking: false,
  applying: false,
  updateAvailable: false,
  currentSha: null,
  remoteSha: null,
  currentVersion: null,
  remoteVersion: null,
  lastCheckedAt: null,
  lastError: null,
};

function getCurrentSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_DIR }).toString().trim();
  } catch (e) {
    return null;
  }
}

function getCurrentVersion() {
  try {
    return require(path.join(REPO_DIR, 'package.json')).version || null;
  } catch (e) {
    return null;
  }
}

// Holt die Versionsnummer aus der package.json des Remote-Standes (nicht nur die Commit-SHA),
// damit die UI anzeigen kann, AUF welche Version ein verfügbares Update aktualisieren würde.
async function getRemoteVersion() {
  try {
    const res = await fetch(GITHUB_PACKAGE_JSON_API, { headers: { 'User-Agent': 'mercy-sf-dashboard', Accept: 'application/vnd.github.raw' } });
    if (!res.ok) throw new Error(`GitHub API antwortete mit ${res.status}`);
    const text = await res.text();
    const pkg = JSON.parse(text);
    return pkg.version || null;
  } catch (e) {
    return null;
  }
}

async function checkForUpdate() {
  if (state.checking) return state;
  state.checking = true;
  try {
    const res = await fetch(GITHUB_API, { headers: { 'User-Agent': 'mercy-sf-dashboard' } });
    if (!res.ok) throw new Error(`GitHub API antwortete mit ${res.status}`);
    const data = await res.json();
    const remoteSha = data.sha;
    const currentSha = getCurrentSha();
    state.remoteSha = remoteSha;
    state.currentSha = currentSha;
    state.currentVersion = getCurrentVersion();
    state.updateAvailable = !!(currentSha && remoteSha && currentSha !== remoteSha);
    // Zielversion nur nachladen, wenn wirklich ein Update ansteht — spart einen zusätzlichen
    // GitHub-API-Aufruf bei jedem 5-Minuten-Check, wenn ohnehin nichts Neues da ist.
    state.remoteVersion = state.updateAvailable ? await getRemoteVersion() : state.currentVersion;
    state.lastCheckedAt = new Date().toISOString();
    state.lastError = null;
  } catch (err) {
    state.lastError = err.message;
  } finally {
    state.checking = false;
  }
  return state;
}

// Startet Dienst-Neustart erst NACH einer kurzen Verzögerung, losgelöst vom aktuellen
// Node-Prozess — sonst würde applyUpdate() sich selbst mitten in der eigenen HTTP-Antwort killen.
function scheduleRestart() {
  const child = spawn('bash', ['-c', 'sleep 2 && systemctl restart mercy-dashboard mercy-sfapi-bridge'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function applyUpdate() {
  if (state.applying) throw new Error('Update läuft bereits');
  if (!state.updateAvailable) throw new Error('Kein Update verfügbar');
  state.applying = true;
  try {
    execSync('git pull --ff-only', { cwd: REPO_DIR, stdio: 'pipe' });
    execSync('npm install --omit=dev --no-audit --no-fund', { cwd: REPO_DIR, stdio: 'pipe' });
    execSync(
      'cp node_modules/chart.js/dist/chart.umd.js public/vendor/chart.js && ' +
      'cp node_modules/@xterm/xterm/lib/xterm.js public/vendor/xterm.js && ' +
      'cp node_modules/@xterm/xterm/css/xterm.css public/vendor/xterm.css',
      { cwd: REPO_DIR, stdio: 'pipe', shell: '/bin/bash' }
    );
    execSync('bash -lc "source $HOME/.cargo/env && cargo build --release"', { cwd: BRIDGE_DIR, stdio: 'pipe' });
    state.updateAvailable = false;
    state.currentSha = state.remoteSha;
    state.currentVersion = state.remoteVersion;
    state.lastError = null;
    scheduleRestart();
  } catch (err) {
    state.lastError = err.message;
    throw err;
  } finally {
    state.applying = false;
  }
}

checkForUpdate();
setInterval(checkForUpdate, CHECK_INTERVAL_MS);

module.exports = { state, checkForUpdate, applyUpdate };
