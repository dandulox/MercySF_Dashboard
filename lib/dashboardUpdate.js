const { execSync, spawn } = require('child_process');
const path = require('path');

const REPO_DIR = path.join(__dirname, '..');
const BRIDGE_DIR = path.join(REPO_DIR, 'sfapi-bridge');
const GITHUB_API = 'https://api.github.com/repos/dandulox/MercySF_Dashboard/commits/main';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const state = {
  checking: false,
  applying: false,
  updateAvailable: false,
  currentSha: null,
  remoteSha: null,
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

async function checkForUpdate() {
  if (state.checking) return;
  state.checking = true;
  try {
    const res = await fetch(GITHUB_API, { headers: { 'User-Agent': 'mercy-sf-dashboard' } });
    if (!res.ok) throw new Error(`GitHub API antwortete mit ${res.status}`);
    const data = await res.json();
    const remoteSha = data.sha;
    const currentSha = getCurrentSha();
    state.remoteSha = remoteSha;
    state.currentSha = currentSha;
    state.updateAvailable = !!(currentSha && remoteSha && currentSha !== remoteSha);
    state.lastCheckedAt = new Date().toISOString();
    state.lastError = null;
  } catch (err) {
    state.lastError = err.message;
  } finally {
    state.checking = false;
  }
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
