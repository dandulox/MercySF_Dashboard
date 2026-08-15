# Telemetry Sender (MercySF_Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-out anonymous telemetry sender to `MercySF_Dashboard` that pings a private collector every 15 minutes with an instance UUID, process uptime, and connected-node count, controllable from a new "Statistik" tab in System-Einstellungen.

**Architecture:** A new `lib/telemetry.js` module (same require-and-`setInterval` pattern as `lib/dashboardUpdate.js`) owns instance-id/enabled-flag persistence and the best-effort `fetch` ping. A new `routes/telemetry-settings.js` (auto-mounted under `/api/telemetry-settings` by `server.js`'s route-directory loader) exposes GET/POST for the enabled flag. The frontend adds a fourth tab to `public/pages/system-settings.js` reusing the existing tab-panel markup pattern.

**Tech Stack:** Node.js, Express (route auto-mounting already in `server.js`), native `fetch`, `fs`/`crypto` (no new dependencies).

## Global Constraints

- Collector endpoint: `POST https://data.poslab.cc/ingest` — copied verbatim from the spec, do not parameterize further.
- Ping interval: 15 minutes (`15 * 60 * 1000` ms), matching the spec exactly.
- Payload is exactly `{ instanceId, uptimeSec, connectedNodes }` — no additional fields (no hostname, IP, version, account/game data).
- Default is **opt-out**: `enabled` defaults to `true` when `data/telemetry-settings.json` is absent.
- Ping failures must never throw, log noisily, or surface in the UI — `.catch(() => {})`, no retry.
- This repo has no automated test suite (`npm test` does not exist) — verification steps use `node -e` one-offs and `curl`/browser checks, matching how the rest of the codebase is verified (see `lib/dashboardUpdate.js`, `routes/dashboard-update.js` for the pattern this mirrors).

---

### Task 1: `lib/telemetry.js` — instance id + enabled-flag persistence

**Files:**
- Create: `lib/telemetry.js`
- Test: manual, via `node -e` (see steps below)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `getOrCreateInstanceId()` → `string` (UUID), `isEnabled()` → `boolean`, `setEnabled(bool)` → `void`. These three are consumed by Task 2 (routes) and Task 3 (ping loop).

- [ ] **Step 1: Write `lib/telemetry.js` with id/flag persistence only (no ping yet)**

```javascript
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ID_PATH = path.join(DATA_DIR, 'telemetry-id.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'telemetry-settings.json');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  try { fs.chmodSync(filePath, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function getOrCreateInstanceId() {
  const existing = readJson(ID_PATH, null);
  if (existing && existing.id) return existing.id;
  const id = crypto.randomUUID();
  writeJson(ID_PATH, { id });
  return id;
}

function isEnabled() {
  const settings = readJson(SETTINGS_PATH, { enabled: true });
  return settings.enabled !== false;
}

function setEnabled(enabled) {
  writeJson(SETTINGS_PATH, { enabled: !!enabled });
}

module.exports = { getOrCreateInstanceId, isEnabled, setEnabled };
```

- [ ] **Step 2: Verify id/flag persistence manually**

Run:
```bash
node -e "const t = require('./lib/telemetry'); console.log(t.getOrCreateInstanceId()); console.log(t.isEnabled()); t.setEnabled(false); console.log(t.isEnabled());"
```
Expected: prints a UUID, then `true`, then `false`.

Run again to confirm persistence and default-true behavior:
```bash
node -e "const t = require('./lib/telemetry'); console.log(t.getOrCreateInstanceId()); console.log(t.isEnabled());"
```
Expected: same UUID as before, `false` (the setting from the previous run persisted).

Cleanup so later manual tests start from the documented opt-out default:
```bash
node -e "require('./lib/telemetry').setEnabled(true)"
```

- [ ] **Step 3: Commit**

```bash
git add lib/telemetry.js
git commit -m "feat(telemetry): add instance id and enabled-flag persistence"
```

---

### Task 2: `routes/telemetry-settings.js` — settings API

**Files:**
- Create: `routes/telemetry-settings.js`

**Interfaces:**
- Consumes: `isEnabled()`, `setEnabled(bool)` from `lib/telemetry.js` (Task 1).
- Produces: `GET /api/telemetry-settings` → `{ enabled: boolean }`; `POST /api/telemetry-settings` body `{ enabled: boolean }` → `{ enabled: boolean }`. Consumed by Task 4 (frontend tab).

- [ ] **Step 1: Write the route**

```javascript
const express = require('express');
const { isEnabled, setEnabled } = require('../lib/telemetry');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ enabled: isEnabled() });
});

router.post('/', (req, res) => {
  setEnabled(!!req.body.enabled);
  res.json({ enabled: isEnabled() });
});

module.exports = router;
```

- [ ] **Step 2: Verify the route is auto-mounted and responds**

Start the server (`node server.js`, requires an existing session cookie since `/api/` is auth-gated — log in via the browser first, then reuse that session's cookie, or verify through the browser directly per Step 3 below instead of curl if no cookie is handy).

Run (replace `<cookie>` with the value from an authenticated browser session's `mercy_session` cookie):
```bash
curl -s -H "Cookie: mercy_session=<cookie>" http://localhost:8080/api/telemetry-settings
```
Expected: `{"enabled":true}`

```bash
curl -s -X POST -H "Content-Type: application/json" -H "Cookie: mercy_session=<cookie>" -d '{"enabled":false}' http://localhost:8080/api/telemetry-settings
```
Expected: `{"enabled":false}`

Restore the default before moving on:
```bash
curl -s -X POST -H "Content-Type: application/json" -H "Cookie: mercy_session=<cookie>" -d '{"enabled":true}' http://localhost:8080/api/telemetry-settings
```

- [ ] **Step 3: Commit**

```bash
git add routes/telemetry-settings.js
git commit -m "feat(telemetry): add /api/telemetry-settings route"
```

---

### Task 3: Ping loop in `lib/telemetry.js`

**Files:**
- Modify: `lib/telemetry.js`
- Modify: `server.js:12` (add require alongside `require('./lib/statsCollector')`)

**Interfaces:**
- Consumes: `getOrCreateInstanceId()`, `isEnabled()` (this module, Task 1); `require('./nodeRegistry').list()` for `lastStatus === 'online'` counting (existing module, see `lib/nodeRegistry.js:27-29,52`).
- Produces: side-effecting `sendPing()` fired on load and every 15 minutes — no other module calls it directly, so no new exported interface beyond what Task 1 already produces.

- [ ] **Step 1: Add the ping loop to `lib/telemetry.js`**

Append to the existing file (after `setEnabled`, before `module.exports`):

```javascript
const nodeRegistry = require('./nodeRegistry');
const COLLECTOR_URL = 'https://data.poslab.cc/ingest';
const PING_INTERVAL_MS = 15 * 60 * 1000;

function countConnectedNodes() {
  return nodeRegistry.list().filter(n => n.lastStatus === 'online').length;
}

async function sendPing() {
  if (!isEnabled()) return;
  const body = JSON.stringify({
    instanceId: getOrCreateInstanceId(),
    uptimeSec: Math.floor(process.uptime()),
    connectedNodes: countConnectedNodes(),
  });
  try {
    await fetch(COLLECTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (e) {
    // Best-effort: Telemetrie darf den laufenden Betrieb nie beeinträchtigen.
  }
}

sendPing();
setInterval(sendPing, PING_INTERVAL_MS);
```

Update the `module.exports` line to also export `sendPing` for the manual test in Step 2:
```javascript
module.exports = { getOrCreateInstanceId, isEnabled, setEnabled, sendPing };
```

- [ ] **Step 2: Verify a ping fires without throwing, both enabled and disabled**

```bash
node -e "
const t = require('./lib/telemetry');
t.setEnabled(true);
t.sendPing().then(() => console.log('enabled ping resolved without throwing'));
"
```
Expected: prints `enabled ping resolved without throwing` (network failure, if the collector isn't deployed yet, is swallowed — no stack trace).

```bash
node -e "
const t = require('./lib/telemetry');
t.setEnabled(false);
t.sendPing().then(() => console.log('disabled ping resolved (no-op)'));
t.setEnabled(true);
"
```
Expected: prints `disabled ping resolved (no-op)` immediately (no fetch attempted when disabled).

- [ ] **Step 3: Wire the module into `server.js`**

In `server.js`, change line 12 from:
```javascript
require('./lib/statsCollector');
```
to:
```javascript
require('./lib/statsCollector');
require('./lib/telemetry');
```

- [ ] **Step 4: Verify server boots cleanly with telemetry loaded**

```bash
node server.js &
sleep 2
curl -s http://localhost:8080/api/status > /dev/null && echo "server up"
kill %1
```
Expected: `server up`, no uncaught exceptions printed before that.

- [ ] **Step 5: Commit**

```bash
git add lib/telemetry.js server.js
git commit -m "feat(telemetry): start 15-minute ping loop on server start"
```

---

### Task 4: "Statistik" tab in System-Einstellungen

**Files:**
- Modify: `public/pages/system-settings.js`
- Modify: `public/lib/i18n/de.js`
- Modify: `public/lib/i18n/en.js`

**Interfaces:**
- Consumes: `GET /api/telemetry-settings`, `POST /api/telemetry-settings` (Task 2); `ctx.fetchJSON` and `t()` helpers already used elsewhere in `system-settings.js`.
- Produces: nothing consumed by later tasks (final task in this plan).

- [ ] **Step 1: Add i18n strings**

In `public/lib/i18n/de.js`, next to the existing `systemSettings.tabVpn` entry (around line 383), add:
```javascript
  'systemSettings.tabStats': 'Statistik',
  'systemSettings.statsTitle': '📊 Nutzungsstatistik',
  'systemSettings.statsDesc': 'Sendet alle 15 Minuten drei anonyme Werte an einen privaten Collector-Dienst: eine zufällige Instanz-ID (ohne Bezug zu Host, IP, Account oder Person), die Laufzeit dieses Dashboard-Prozesses seit dem letzten Start, und die Anzahl aktuell verbundener Nodes. Kein Hostname, keine IP, keine Version, keine Account- oder Spieldaten werden übertragen.',
  'systemSettings.statsCheckboxLabel': 'Nutzungsdaten senden',
```

In `public/lib/i18n/en.js`, next to the existing `systemSettings.tabVpn` entry (around line 369), add:
```javascript
  'systemSettings.tabStats': 'Statistics',
  'systemSettings.statsTitle': '📊 Usage statistics',
  'systemSettings.statsDesc': 'Every 15 minutes, sends three anonymous values to a private collector service: a random instance ID (unrelated to host, IP, account, or person), this dashboard process\'s uptime since its last start, and the number of currently connected nodes. No hostname, IP, version, account, or game data is transmitted.',
  'systemSettings.statsCheckboxLabel': 'Send usage data',
```

- [ ] **Step 2: Add the tab button, panel, and checkbox wiring in `public/pages/system-settings.js`**

In the `TABS` constant (line 17), change:
```javascript
const TABS = ['general', 'node', 'vpn'];
```
to:
```javascript
const TABS = ['general', 'node', 'vpn', 'stats'];
```

In the tab-button row (lines 71-75), add a fourth button after the VPN one:
```javascript
      <div class="settings-tabs">
        <button class="settings-tab active" data-tab="general">${t('systemSettings.tabGeneral')}</button>
        <button class="settings-tab" data-tab="node">${t('systemSettings.tabNode')}</button>
        <button class="settings-tab" data-tab="vpn">${t('systemSettings.tabVpn')}</button>
        <button class="settings-tab" data-tab="stats">${t('systemSettings.tabStats')}</button>
      </div>
```

After the `vpn` panel's closing `</div>` (after line 102, before `` ` `` closes the template at line 103), add a new panel:
```javascript
      <div class="settings-tab-panel" data-panel="stats" hidden>
        <div class="panel-settings-card">
          <h3>${t('systemSettings.statsTitle')}</h3>
          <div class="panel-settings-desc">${t('systemSettings.statsDesc')}</div>
          <div class="panel-settings-row">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="telemetry-enabled-checkbox" />
              ${t('systemSettings.statsCheckboxLabel')}
            </label>
            <span id="telemetry-status"></span>
          </div>
        </div>
      </div>
```

After the existing `loadPanelSettings()` function block (after line 132's closing `}`), add:
```javascript
    // --- Statistik ---
    async function loadTelemetrySettings() {
      const checkbox = wrap.querySelector('#telemetry-enabled-checkbox');
      const status = wrap.querySelector('#telemetry-status');
      try {
        const data = await ctx.fetchJSON('/api/telemetry-settings');
        checkbox.checked = data.enabled;
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    }

    wrap.querySelector('#telemetry-enabled-checkbox').addEventListener('change', async (e) => {
      const status = wrap.querySelector('#telemetry-status');
      status.textContent = t('systemSettings.saving');
      try {
        await ctx.fetchJSON('/api/telemetry-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: e.target.checked }),
        });
        status.textContent = t('systemSettings.applied');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });
```

Update the final load-calls block (line 343-344) to also load telemetry settings:
```javascript
    loadPanelSettings();
    loadVpnProfiles().then(loadVpnTargets);
    loadTelemetrySettings();
```

- [ ] **Step 3: Verify in the browser**

Start the server, log in, navigate to System-Einstellungen. Confirm:
1. A fourth "Statistik" tab appears and switches panels like the other three.
2. The checkbox loads checked (default `true`).
3. Unchecking it shows "Gespeichert"/"Applied" status and a subsequent `GET /api/telemetry-settings` (via dev tools network tab or a manual curl with the session cookie) returns `{"enabled":false}`.
4. Re-checking it restores `{"enabled":true}`.

- [ ] **Step 4: Commit**

```bash
git add public/pages/system-settings.js public/lib/i18n/de.js public/lib/i18n/en.js
git commit -m "feat(telemetry): add Statistik tab to System-Einstellungen"
```
