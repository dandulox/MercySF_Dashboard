const { execSync, spawn } = require('child_process');
const path = require('path');

// Angepasste Kopie von MercySF_Dashboard/lib/dashboardUpdate.js: aktualisiert den Code des
// Node-Agents selbst (git pull des gemeinsamen Repos, eine Ebene über node-agent/, + npm install
// nur im node-agent-Unterordner, kein Rust/sfapi-Bridge-Build — der Node-Agent hat keinen). Läuft
// wie dort auf Anfrage vom Dashboard, kein eigener Timer.
const NODE_AGENT_DIR = path.join(__dirname, '..');
const REPO_DIR = path.join(NODE_AGENT_DIR, '..');
const GITHUB_API_BASE = 'https://api.github.com/repos/dandulox/MercySF_Dashboard/commits';

const state = {
  checking: false,
  applying: false,
  updateAvailable: false,
  currentSha: null,
  remoteSha: null,
  currentVersion: null,
  branch: null,
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

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_DIR }).toString().trim();
  } catch (e) {
    return 'main';
  }
}

function getCurrentVersion() {
  try {
    return require(path.join(NODE_AGENT_DIR, 'package.json')).version || null;
  } catch (e) {
    return null;
  }
}

async function checkForUpdate() {
  if (state.checking) return state;
  state.checking = true;
  try {
    const branch = getCurrentBranch();
    state.branch = branch;
    const res = await fetch(`${GITHUB_API_BASE}/${encodeURIComponent(branch)}`, { headers: { 'User-Agent': 'mercy-node-agent' } });
    if (!res.ok) throw new Error(`GitHub API antwortete mit ${res.status}`);
    const data = await res.json();
    const remoteSha = data.sha;
    const currentSha = getCurrentSha();
    state.remoteSha = remoteSha;
    state.currentSha = currentSha;
    state.currentVersion = getCurrentVersion();
    state.updateAvailable = !!(currentSha && remoteSha && currentSha !== remoteSha);
    state.lastCheckedAt = new Date().toISOString();
    state.lastError = null;
  } catch (err) {
    state.lastError = err.message;
  } finally {
    state.checking = false;
  }
  return state;
}

// Gleiches Muster wie dashboardUpdate.js: Neustart erst nach kurzer Verzögerung, losgelöst vom
// aktuellen Prozess, sonst würde applyUpdate() sich selbst mitten in der eigenen HTTP-Antwort killen.
function scheduleRestart() {
  const child = spawn('bash', ['-c', 'sleep 2 && systemctl restart mercy-node-agent'], {
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
    execSync(`git pull --ff-only origin ${state.branch || 'main'}`, { cwd: REPO_DIR, stdio: 'pipe' });
    execSync('npm install --omit=dev --no-audit --no-fund', { cwd: NODE_AGENT_DIR, stdio: 'pipe' });
    state.updateAvailable = false;
    state.currentSha = state.remoteSha;
    state.currentVersion = getCurrentVersion();
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

module.exports = { state, checkForUpdate, applyUpdate };
