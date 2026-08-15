# ProtonVPN Support (WireGuard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the dashboard control ProtonVPN (via uploaded WireGuard configs) independently for itself ("local") and every paired node, with a per-target option to block or auto-connect bot starts until a VPN tunnel is active.

**Architecture:** New `vpnManager` modules (dashboard + node-agent, `wg-quick`/`wg` via `child_process.spawn`) sit behind new encrypted-config and per-target-config stores, exposed via a new `routes/vpn.js` on the dashboard (delegating to node-agent's new `/vpn/*` endpoints for remote targets) and a new `system-settings` page in the frontend.

**Tech Stack:** Node.js + Express, `child_process.spawn` (no shell strings), AES-256-GCM encrypted JSON stores (existing `credentialStore.js` pattern), vanilla JS pages with the existing i18n (`t()`) system, WireGuard (`wireguard-tools` package, `wg-quick`/`wg` CLI).

## Global Constraints

- Branch: `vpn_support` (already created and checked out).
- No test framework exists in this repo — verification steps are manual `node -e` snippets and, where a real binary would be needed (`wg-quick`, `wg`), a **fake binary substitution** via env var override (see Task 3) since this dev machine has no WireGuard installed.
- `child_process.spawn` only for external commands, never a shell string (command-injection safety — matches `lib/cliExec.js`).
- Encrypted stores follow the exact AES-256-GCM pattern of `lib/credentialStore.js`: random key in a `0600` file, `aes-256-gcm`, IV+tag+data all base64 in the JSON entry.
- German UI strings via the existing i18n system (`t('key')`, keys added to **both** `public/lib/i18n/de.js` and `public/lib/i18n/en.js`) — this project no longer hardcodes German strings directly in page files (see `public/pages/analytics-compare.js`).
- Route files in `routes/` auto-mount at `/api/<filename-without-.js>` (`server.js:83-97`) — `routes/vpn.js` → `/api/vpn`, no manual wiring.
- Config file content (WireGuard private keys) must never appear in any API response — only metadata (`id`, `label`, `interfaceName`, `createdAt`).
- Before every `git add`, run `git status --porcelain` (or `git diff --cached --stat` after staging) and confirm only the files this task touches are staged — this repo has other in-flight work happening in parallel; earlier in this project a commit accidentally swept up unrelated files because `git commit` with no pathspec commits the whole index.

---

### Task 1: `lib/vpnProfiles.js` — VPN profile registry

**Files:**
- Create: `lib/vpnProfiles.js`

**Interfaces:**
- Produces: `list(): Profile[]`, `add({label, configContent}): Profile`, `rename(id, label): Profile|null`, `remove(id): boolean`, where `Profile = {id, label, interfaceName, createdAt}`. `add()` also stores the raw config via `lib/vpnConfigStore.js` (Task 2) — Task 2 must exist before this compiles, so implement Task 2 first if working strictly in order; the two are listed separately because they have independent verification.

- [ ] **Step 1: Create the registry file**

```javascript
const fs = require('fs');
const path = require('path');
const vpnConfigStore = require('./vpnConfigStore');

// Ein "VPN-Profil" ist eine hochgeladene WireGuard-Config (= ein bestimmter ProtonVPN-
// Account+Standort). interfaceName wird fortlaufend vergeben (wg0, wg1, ...) statt aus dem
// Label abgeleitet, weil Linux-Interface-Namen auf 15 Zeichen begrenzt sind.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'vpn-profiles.json');

function readAll() {
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2), { mode: 0o600 });
  try { fs.chmodSync(FILE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function list() {
  return readAll();
}

function nextInterfaceName(all) {
  let n = 0;
  const used = new Set(all.map(p => p.interfaceName));
  while (used.has(`wg${n}`)) n++;
  return `wg${n}`;
}

function looksLikeWireGuardConfig(content) {
  return /\[Interface\]/.test(content) && /\[Peer\]/.test(content);
}

function add({ label, configContent }) {
  if (!label || !configContent) throw new Error('label und configContent sind erforderlich');
  if (!looksLikeWireGuardConfig(configContent)) {
    throw new Error('Das sieht nicht nach einer gültigen WireGuard-Config aus (fehlende [Interface]/[Peer]-Sektion)');
  }
  const all = readAll();
  const interfaceName = nextInterfaceName(all);
  const profile = {
    id: interfaceName,
    label: String(label).slice(0, 80),
    interfaceName,
    createdAt: new Date().toISOString(),
  };
  all.push(profile);
  writeAll(all);
  vpnConfigStore.setConfig(profile.id, configContent);
  return profile;
}

function rename(id, label) {
  if (!label) throw new Error('label ist erforderlich');
  const all = readAll();
  const profile = all.find(p => p.id === id);
  if (!profile) return null;
  profile.label = String(label).slice(0, 80);
  writeAll(all);
  return profile;
}

function remove(id) {
  const all = readAll();
  const filtered = all.filter(p => p.id !== id);
  writeAll(filtered);
  vpnConfigStore.deleteConfig(id);
  return filtered.length !== all.length;
}

module.exports = { list, add, rename, remove };
```

- [ ] **Step 2: Manually verify (after Task 2 exists)**

```bash
node -e "
const profiles = require('./lib/vpnProfiles');
const p1 = profiles.add({ label: 'Test NL', configContent: '[Interface]\nPrivateKey = abc\n[Peer]\nPublicKey = def\nEndpoint = 1.2.3.4:51820\n' });
console.log('id is wg0:', p1.id === 'wg0');
const p2 = profiles.add({ label: 'Test DE', configContent: '[Interface]\nPrivateKey = ghi\n[Peer]\nPublicKey = jkl\nEndpoint = 5.6.7.8:51820\n' });
console.log('id is wg1:', p2.id === 'wg1');
let threw = false;
try { profiles.add({ label: 'Bad', configContent: 'not a config' }); } catch (e) { threw = true; }
console.log('rejects invalid config:', threw);
profiles.remove(p1.id);
profiles.remove(p2.id);
console.log('cleaned up:', profiles.list().length === 0);
"
```
Expected: all five lines print `true`. This writes to and cleans up `data/vpn-profiles.json` and `data/vpn-configs.enc.json`.

- [ ] **Step 3: Commit**

```bash
git status --porcelain
git add lib/vpnProfiles.js
git commit -m "Add VPN profile registry (lib/vpnProfiles.js)"
```

---

### Task 2: `lib/vpnConfigStore.js` — encrypted config storage

**Files:**
- Create: `lib/vpnConfigStore.js`

**Interfaces:**
- Produces: `setConfig(profileId, configContent): void`, `getConfig(profileId): string|null`, `deleteConfig(profileId): void`

- [ ] **Step 1: Create the store (exact `credentialStore.js` encryption pattern, separate file)**

```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Gleiches AES-256-GCM-Muster wie lib/credentialStore.js, aber eigene Datei/eigener Schlüssel —
// VPN-Config-Inhalte (WireGuard Private Keys) bleiben getrennt von Spiel-Zugangsdaten.
const DATA_DIR = path.join(__dirname, '..', 'data');
const KEY_PATH = path.join(DATA_DIR, '.vpn-config-key');
const STORE_PATH = path.join(DATA_DIR, 'vpn-configs.enc.json');

function getOrCreateKey() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(KEY_PATH)) {
    return Buffer.from(fs.readFileSync(KEY_PATH, 'utf8'), 'base64');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, key.toString('base64'), { mode: 0o600 });
  try { fs.chmodSync(KEY_PATH, 0o600); } catch (e) { /* Windows-Entwicklungsumgebung ignoriert das */ }
  return key;
}

const KEY = getOrCreateKey();

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') };
}

function decrypt(entry) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(entry.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(entry.data, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

function readStore() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
  try { fs.chmodSync(STORE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function setConfig(profileId, configContent) {
  const store = readStore();
  store[profileId] = encrypt(configContent);
  writeStore(store);
}

function getConfig(profileId) {
  const store = readStore();
  const entry = store[profileId];
  if (!entry) return null;
  try {
    return decrypt(entry);
  } catch (e) {
    return null;
  }
}

function deleteConfig(profileId) {
  const store = readStore();
  delete store[profileId];
  writeStore(store);
}

module.exports = { setConfig, getConfig, deleteConfig };
```

- [ ] **Step 2: Manually verify**

```bash
node -e "
const store = require('./lib/vpnConfigStore');
store.setConfig('test-id', '[Interface]\nPrivateKey = secret\n');
console.log('roundtrip:', store.getConfig('test-id') === '[Interface]\nPrivateKey = secret\n');
store.deleteConfig('test-id');
console.log('deleted:', store.getConfig('test-id') === null);
"
```
Expected: `roundtrip: true`, `deleted: true`.

- [ ] **Step 3: Commit**

```bash
git status --porcelain
git add lib/vpnConfigStore.js
git commit -m "Add encrypted VPN config storage (lib/vpnConfigStore.js)"
```

---

### Task 3: `lib/vpnManager.js` — wg-quick/wg wrapper

**Files:**
- Create: `lib/vpnManager.js`

**Interfaces:**
- Produces: `async connect(interfaceName, configContent): Promise<void>`, `async disconnect(interfaceName): Promise<void>`, `async status(): Promise<{connected: boolean, interfaceName: string|null}>`
- The `wg-quick`/`wg` binary paths are read from `process.env.MERCY_WG_QUICK_BIN` / `process.env.MERCY_WG_BIN`, defaulting to `'wg-quick'`/`'wg'` — this is what makes Step 2 testable on a machine without WireGuard installed (point the env vars at a fake script instead).

- [ ] **Step 1: Create the manager**

```javascript
const { spawn } = require('child_process');
const fs = require('fs');

const WG_QUICK_BIN = process.env.MERCY_WG_QUICK_BIN || 'wg-quick';
const WG_BIN = process.env.MERCY_WG_BIN || 'wg';
const WG_CONF_DIR = process.env.MERCY_WG_CONF_DIR || '/etc/wireguard';
const HANDSHAKE_FRESH_SECS = 180;

// Nie als Shell-String — gleiches Muster wie lib/cliExec.js. Läuft als root (siehe
// systemd/*.service), daher keine sudo-Notwendigkeit für wg-quick/wg.
function run(bin, args, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGKILL');
      reject(new Error(`${bin} ${args.join(' ')} hat zu lange gedauert (Timeout)`));
    }, timeoutMs);
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`${bin} ${args.join(' ')} fehlgeschlagen (Code ${code}): ${stderr.trim() || stdout.trim()}`));
      }
      resolve(stdout);
    });
  });
}

async function currentActiveInterface() {
  let out;
  try {
    out = await run(WG_BIN, ['show', 'interfaces']);
  } catch (e) {
    return null;
  }
  const names = out.trim().split(/\s+/).filter(Boolean);
  return names[0] || null;
}

async function connect(interfaceName, configContent) {
  const active = await currentActiveInterface();
  if (active && active !== interfaceName) {
    await run(WG_QUICK_BIN, ['down', active]);
  }
  if (active !== interfaceName) {
    const confPath = `${WG_CONF_DIR}/${interfaceName}.conf`;
    fs.mkdirSync(WG_CONF_DIR, { recursive: true });
    fs.writeFileSync(confPath, configContent, { mode: 0o600 });
    try { fs.chmodSync(confPath, 0o600); } catch (e) { /* Windows ignorieren */ }
    await run(WG_QUICK_BIN, ['up', interfaceName]);
  }
}

async function disconnect(interfaceName) {
  await run(WG_QUICK_BIN, ['down', interfaceName]);
}

async function status() {
  const interfaceName = await currentActiveInterface();
  if (!interfaceName) return { connected: false, interfaceName: null };
  let out;
  try {
    out = await run(WG_BIN, ['show', interfaceName, 'latest-handshakes']);
  } catch (e) {
    return { connected: false, interfaceName };
  }
  // Ausgabe: "<peer-pubkey>\t<unix-timestamp>" — 0 bedeutet "noch nie".
  const match = out.trim().match(/\t(\d+)$/);
  const handshakeAt = match ? parseInt(match[1], 10) : 0;
  const connected = handshakeAt > 0 && (Date.now() / 1000 - handshakeAt) < HANDSHAKE_FRESH_SECS;
  return { connected, interfaceName };
}

module.exports = { connect, disconnect, status };
```

- [ ] **Step 2: Manually verify against a fake `wg`/`wg-quick`**

Create a fake binary directory in the scratchpad and point the env vars at it:

```bash
mkdir -p /c/Users/Marti/AppData/Local/Temp/claude/G--Entwicklung-MercySF/5edd230c-425d-469a-82a8-1e5d841e6ad2/scratchpad/fake-wg
cat > /c/Users/Marti/AppData/Local/Temp/claude/G--Entwicklung-MercySF/5edd230c-425d-469a-82a8-1e5d841e6ad2/scratchpad/fake-wg/wg-quick.js <<'EOF'
// Fake wg-quick: just records what it was called with and exits 0.
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(__dirname + '/wg-quick.log', args.join(' ') + '\n');
process.exit(0);
EOF
cat > /c/Users/Marti/AppData/Local/Temp/claude/G--Entwicklung-MercySF/5edd230c-425d-469a-82a8-1e5d841e6ad2/scratchpad/fake-wg/wg.js <<'EOF'
// Fake wg: "show interfaces" returns wg0 if wg-quick.log's last line was "up wg0", else nothing.
// "show wg0 latest-handshakes" returns a fresh timestamp.
const fs = require('fs');
const args = process.argv.slice(2);
const logPath = __dirname + '/wg-quick.log';
const lastUp = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').trim().split('\n').reverse().find(l => l.startsWith('up ')) : null;
const activeIface = lastUp ? lastUp.split(' ')[1] : null;
const wasDown = fs.existsSync(logPath) && fs.readFileSync(logPath, 'utf8').trim().split('\n').reverse()[0]?.startsWith('down ');
if (args[0] === 'show' && args[1] === 'interfaces') {
  process.stdout.write(wasDown ? '' : (activeIface || ''));
} else if (args[0] === 'show' && args[2] === 'latest-handshakes') {
  process.stdout.write(`abc123\t${Math.floor(Date.now() / 1000)}\n`);
}
process.exit(0);
EOF
```

The two fake scripts must be run through `node`, but `MERCY_WG_QUICK_BIN`/`MERCY_WG_BIN` are executed
directly by `spawn` (not through a shell), so point them at small `.cmd`/shell wrappers instead of
the `.js` files directly:

```bash
FAKE_DIR=/c/Users/Marti/AppData/Local/Temp/claude/G--Entwicklung-MercySF/5edd230c-425d-469a-82a8-1e5d841e6ad2/scratchpad/fake-wg
printf '#!/bin/sh\nexec node "%s/wg-quick.js" "$@"\n' "$FAKE_DIR" > "$FAKE_DIR/wg-quick"
printf '#!/bin/sh\nexec node "%s/wg.js" "$@"\n' "$FAKE_DIR" > "$FAKE_DIR/wg"
chmod +x "$FAKE_DIR/wg-quick" "$FAKE_DIR/wg"
rm -f "$FAKE_DIR/wg-quick.log"
```

Now run the verification (uses a scratch dir instead of `/etc/wireguard` too, via
`MERCY_WG_CONF_DIR`):

```bash
FAKE_DIR=/c/Users/Marti/AppData/Local/Temp/claude/G--Entwicklung-MercySF/5edd230c-425d-469a-82a8-1e5d841e6ad2/scratchpad/fake-wg
MERCY_WG_QUICK_BIN="$FAKE_DIR/wg-quick" MERCY_WG_BIN="$FAKE_DIR/wg" MERCY_WG_CONF_DIR="$FAKE_DIR/conf" node -e "
const vpn = require('./lib/vpnManager');
(async () => {
  let s = await vpn.status();
  console.log('starts disconnected:', s.connected === false);
  await vpn.connect('wg0', '[Interface]\nPrivateKey = test\n[Peer]\nPublicKey = test\n');
  s = await vpn.status();
  console.log('connected after connect:', s.connected === true && s.interfaceName === 'wg0');
  await vpn.disconnect('wg0');
  s = await vpn.status();
  console.log('disconnected after disconnect:', s.connected === false);
})();
"
```
Expected: all three lines print `true`. On Windows, `chmod`/shebangs are ignored by the POSIX
layer this Bash tool uses but the `exec node ...` wrapper still runs correctly through it; if this
environment can't execute the wrapper scripts at all, fall back to verifying `lib/vpnManager.js`
by code review only and note that in the final report — the real `wg-quick`/`wg` binaries will be
exercised for real on the Linux deployment target regardless.

- [ ] **Step 3: Commit**

```bash
git status --porcelain
git add lib/vpnManager.js
git commit -m "Add wg-quick/wg wrapper (lib/vpnManager.js)"
```

---

### Task 4: `lib/vpnTargets.js` — per-target VPN configuration

**Files:**
- Create: `lib/vpnTargets.js`

**Interfaces:**
- Produces: `list(): Target[]`, `get(targetId): Target|null`, `setConfig(targetId, {vpnProfileId, gate}): Target`, `setLastStatus(targetId, {connected, interfaceName}): Target`, where `Target = {targetId, vpnProfileId: string|null, gate: 'off'|'block'|'auto-connect', lastStatus: {connected: boolean, interfaceName: string|null, updatedAt: string|null}}`. `"local"` is always present in `list()` even before any config is set (lazily created with defaults).
- Consumes: nothing from earlier tasks (standalone store, same pattern as `lib/vpnProfiles.js`).

- [ ] **Step 1: Create the store**

```javascript
const fs = require('fs');
const path = require('path');

// Ein "Ziel" ist entweder "local" (dieser Server) oder eine nodeId aus lib/nodeRegistry.js.
// Nicht verschlüsselt — enthält keine Geheimnisse, nur Zuordnung + Cache des letzten Status.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'vpn-targets.json');
const VALID_GATES = ['off', 'block', 'auto-connect'];

function readAll() {
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2), { mode: 0o600 });
  try { fs.chmodSync(FILE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function defaultTarget(targetId) {
  return { targetId, vpnProfileId: null, gate: 'off', lastStatus: { connected: false, interfaceName: null, updatedAt: null } };
}

function list() {
  const all = readAll();
  if (!all.some(t => t.targetId === 'local')) all.push(defaultTarget('local'));
  return all;
}

function get(targetId) {
  return list().find(t => t.targetId === targetId) || null;
}

function upsert(targetId, patch) {
  const all = list();
  let target = all.find(t => t.targetId === targetId);
  if (!target) {
    target = defaultTarget(targetId);
    all.push(target);
  }
  Object.assign(target, patch);
  writeAll(all);
  return target;
}

function setConfig(targetId, { vpnProfileId, gate }) {
  if (gate && !VALID_GATES.includes(gate)) throw new Error(`Ungültiges gate (erlaubt: ${VALID_GATES.join(', ')})`);
  return upsert(targetId, { vpnProfileId: vpnProfileId ?? null, gate: gate || 'off' });
}

function setLastStatus(targetId, { connected, interfaceName }) {
  return upsert(targetId, { lastStatus: { connected: !!connected, interfaceName: interfaceName || null, updatedAt: new Date().toISOString() } });
}

module.exports = { list, get, setConfig, setLastStatus, VALID_GATES };
```

- [ ] **Step 2: Manually verify**

```bash
node -e "
const targets = require('./lib/vpnTargets');
console.log('local exists by default:', targets.get('local').targetId === 'local');
console.log('default gate off:', targets.get('local').gate === 'off');
const updated = targets.setConfig('local', { vpnProfileId: 'wg0', gate: 'block' });
console.log('config applied:', updated.vpnProfileId === 'wg0' && updated.gate === 'block');
let threw = false;
try { targets.setConfig('local', { gate: 'nonsense' }); } catch (e) { threw = true; }
console.log('rejects bad gate:', threw);
const s = targets.setLastStatus('node-xyz', { connected: true, interfaceName: 'wg1' });
console.log('new target auto-created:', s.targetId === 'node-xyz' && s.lastStatus.connected === true);
require('fs').unlinkSync('./data/vpn-targets.json');
"
```
Expected: all five lines print `true`.

- [ ] **Step 3: Commit**

```bash
git status --porcelain
git add lib/vpnTargets.js
git commit -m "Add per-target VPN config store (lib/vpnTargets.js)"
```

---

### Task 5: `routes/vpn.js` — dashboard VPN API

**Files:**
- Create: `routes/vpn.js`

**Interfaces:**
- Consumes: `lib/vpnProfiles.js` (Task 1), `lib/vpnConfigStore.js` (Task 2), `lib/vpnManager.js` (Task 3), `lib/vpnTargets.js` (Task 4), `lib/nodeRegistry.js` (`list()`, `get(id)` — existing), `lib/nodeClient.js` (`call(node, path, opts)` — existing)
- Produces (HTTP contract used by Task 10's frontend):
  - `GET /api/vpn/profiles` → `[{id, label, interfaceName, createdAt}]`
  - `POST /api/vpn/profiles` body `{label, configContent}` → `201 {id, label, interfaceName, createdAt}` or `400 {error}`
  - `DELETE /api/vpn/profiles/:id` → `200 {ok:true}`, `409 {error}` if assigned to a currently-connected target
  - `GET /api/vpn/targets` → `[{targetId, label, vpnProfileId, gate, lastStatus}]` — `label` is `"Lokal (dieser Server)"` for `local`, else the node's `name` from `nodeRegistry`; includes `local` plus every known node even if unconfigured
  - `POST /api/vpn/targets/:targetId/config` body `{vpnProfileId, gate}` → pushes the config to the node (if remote) then saves via `vpnTargets.setConfig`
  - `POST /api/vpn/targets/:targetId/connect` / `POST /api/vpn/targets/:targetId/disconnect` / `GET /api/vpn/targets/:targetId/status` → `{connected, interfaceName}`, also updates the `lastStatus` cache

- [ ] **Step 1: Create the route file**

```javascript
const express = require('express');
const vpnProfiles = require('../lib/vpnProfiles');
const vpnConfigStore = require('../lib/vpnConfigStore');
const vpnManager = require('../lib/vpnManager');
const vpnTargets = require('../lib/vpnTargets');
const nodeRegistry = require('../lib/nodeRegistry');
const nodeClient = require('../lib/nodeClient');

const router = express.Router();

router.get('/profiles', (req, res) => {
  res.json(vpnProfiles.list());
});

router.post('/profiles', express.json({ limit: '256kb' }), (req, res) => {
  try {
    const profile = vpnProfiles.add(req.body || {});
    res.status(201).json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/profiles/:id', (req, res) => {
  const inUse = vpnTargets.list().find(t => t.vpnProfileId === req.params.id && t.lastStatus.connected);
  if (inUse) {
    return res.status(409).json({ error: `Profil ist aktuell mit Ziel "${inUse.targetId}" verbunden — erst trennen` });
  }
  const removed = vpnProfiles.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Profil nicht gefunden' });
  res.json({ ok: true });
});

function targetLabel(targetId) {
  if (targetId === 'local') return 'Lokal (dieser Server)';
  const node = nodeRegistry.get(targetId);
  return node ? node.name : targetId;
}

// Zielliste = "local" + jeder bekannte Node, auch wenn für ihn noch keine VPN-Config gesetzt
// wurde (vpnTargets.list() erzeugt "local" automatisch, Nodes werden hier ergänzt).
function allTargetIds() {
  const known = new Set(vpnTargets.list().map(t => t.targetId));
  const nodeIds = nodeRegistry.list().map(n => n.id);
  return [...new Set(['local', ...known, ...nodeIds])];
}

router.get('/targets', (req, res) => {
  const configs = new Map(vpnTargets.list().map(t => [t.targetId, t]));
  const result = allTargetIds().map(id => {
    const cfg = configs.get(id) || { targetId: id, vpnProfileId: null, gate: 'off', lastStatus: { connected: false, interfaceName: null, updatedAt: null } };
    return { ...cfg, label: targetLabel(id) };
  });
  res.json(result);
});

function remoteNodeFor(targetId) {
  if (targetId === 'local') return null;
  const node = nodeRegistry.get(targetId);
  if (!node) throw Object.assign(new Error('Node nicht gefunden'), { status: 404 });
  return node;
}

router.post('/targets/:targetId/config', express.json(), async (req, res) => {
  const { vpnProfileId, gate } = req.body || {};
  try {
    const node = remoteNodeFor(req.params.targetId);
    if (node) {
      const profile = vpnProfileId ? vpnProfiles.list().find(p => p.id === vpnProfileId) : null;
      if (vpnProfileId && !profile) return res.status(400).json({ error: 'VPN-Profil nicht gefunden' });
      const configContent = profile ? vpnConfigStore.getConfig(profile.id) : null;
      await nodeClient.call(node, '/vpn/config', {
        method: 'POST',
        body: { vpnProfileId: profile?.id || null, interfaceName: profile?.interfaceName || null, configContent, gate },
      });
    }
    const target = vpnTargets.setConfig(req.params.targetId, { vpnProfileId, gate });
    res.json({ ...target, label: targetLabel(req.params.targetId) });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/targets/:targetId/connect', async (req, res) => {
  try {
    const target = vpnTargets.get(req.params.targetId);
    if (!target || !target.vpnProfileId) return res.status(400).json({ error: 'Kein VPN-Profil für dieses Ziel zugewiesen' });
    const node = remoteNodeFor(req.params.targetId);
    let status;
    if (node) {
      status = await nodeClient.call(node, '/vpn/connect', { method: 'POST', timeoutMs: 20000 });
    } else {
      const profile = vpnProfiles.list().find(p => p.id === target.vpnProfileId);
      if (!profile) return res.status(400).json({ error: 'Zugewiesenes VPN-Profil existiert nicht mehr' });
      const configContent = vpnConfigStore.getConfig(profile.id);
      await vpnManager.connect(profile.interfaceName, configContent);
      status = await vpnManager.status();
    }
    vpnTargets.setLastStatus(req.params.targetId, status);
    res.json(status);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

router.post('/targets/:targetId/disconnect', async (req, res) => {
  try {
    const target = vpnTargets.get(req.params.targetId);
    const node = remoteNodeFor(req.params.targetId);
    let status;
    if (node) {
      status = await nodeClient.call(node, '/vpn/disconnect', { method: 'POST', timeoutMs: 15000 });
    } else {
      if (target?.lastStatus?.interfaceName) await vpnManager.disconnect(target.lastStatus.interfaceName);
      status = await vpnManager.status();
    }
    vpnTargets.setLastStatus(req.params.targetId, status);
    res.json(status);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

router.get('/targets/:targetId/status', async (req, res) => {
  try {
    const node = remoteNodeFor(req.params.targetId);
    const status = node
      ? await nodeClient.call(node, '/vpn/status', { timeoutMs: 8000 })
      : await vpnManager.status();
    vpnTargets.setLastStatus(req.params.targetId, status);
    res.json(status);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Manually verify local-target validation paths (no real WireGuard needed for these)**

```bash
node -e "
const express = require('express');
const router = require('./routes/vpn');
const app = express();
app.use('/api/vpn', router);
const server = app.listen(0, async () => {
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/api/vpn';

  const emptyProfiles = await (await fetch(base + '/profiles')).json();
  console.log('starts empty:', Array.isArray(emptyProfiles) && emptyProfiles.length === 0);

  const created = await (await fetch(base + '/profiles', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ label: 'Test', configContent: '[Interface]\nPrivateKey=x\n[Peer]\nPublicKey=y\n' }) })).json();
  console.log('created has id:', created.id === 'wg0');

  const targets = await (await fetch(base + '/targets')).json();
  console.log('local target present:', targets.some(t => t.targetId === 'local'));

  const noProfile = await fetch(base + '/targets/local/connect', { method: 'POST' });
  console.log('connect without assignment -> 400:', noProfile.status === 400);

  const del = await fetch(base + '/profiles/wg0', { method: 'DELETE' });
  console.log('delete unassigned profile -> 200:', del.status === 200);

  require('fs').unlinkSync('./data/vpn-profiles.json');
  require('fs').unlinkSync('./data/vpn-configs.enc.json');
  server.close();
});
"
```
Expected: all five lines print `true`.

- [ ] **Step 3: Commit**

```bash
git status --porcelain
git add routes/vpn.js
git commit -m "Add dashboard VPN API (routes/vpn.js)"
```

---

### Task 6: Local start-gate in `routes/profiles.js`

**Files:**
- Modify: `routes/profiles.js` (the `/:id/start` handler, local branch)

**Interfaces:**
- Consumes: `lib/vpnTargets.js` (`get('local')`), `lib/vpnManager.js` (`status()`, `connect()`), `lib/vpnProfiles.js` (`list()`), `lib/vpnConfigStore.js` (`getConfig()`)

- [ ] **Step 1: Add the imports**

At the top of `routes/profiles.js`, alongside the existing `require`s (near `const nodeClient = require('../lib/nodeClient');`), add:

```javascript
const vpnTargets = require('../lib/vpnTargets');
const vpnManager = require('../lib/vpnManager');
const vpnProfiles = require('../lib/vpnProfiles');
const vpnConfigStore = require('../lib/vpnConfigStore');
```

- [ ] **Step 2: Add the gate check before `ptyManager.ensurePty`**

Replace the local branch of the `/:id/start` handler:

```javascript
    ptyManager.ensurePty(profile.id);
    registry.setAutoStart(profile.id, true);
    res.json(ptyManager.getStatus(profile.id));
```

with:

```javascript
    await enforceLocalVpnGate();
    ptyManager.ensurePty(profile.id);
    registry.setAutoStart(profile.id, true);
    res.json(ptyManager.getStatus(profile.id));
```

- [ ] **Step 3: Add the `enforceLocalVpnGate` helper**

Add this function above the `router.post('/:id/start', ...)` handler:

```javascript
// Wird nur für lokal laufende Profile geprüft — Node-Profile werden vom jeweiligen Node-Agent
// selbst gegated (siehe node-agent/server.js), damit ein Node auch ohne Dashboard-Roundtrip
// autonom bleibt.
async function enforceLocalVpnGate() {
  const target = vpnTargets.get('local');
  if (!target || target.gate === 'off') return;
  if (!target.vpnProfileId) {
    throw Object.assign(new Error('VPN-Gate ist aktiv, aber kein VPN-Profil für "Lokal" zugewiesen'), { status: 409 });
  }
  const status = await vpnManager.status();
  if (status.connected) return;
  if (target.gate === 'block') {
    throw Object.assign(new Error('VPN nicht verbunden — Start blockiert (siehe System-Einstellungen)'), { status: 409 });
  }
  // gate === 'auto-connect'
  const profile = vpnProfiles.list().find(p => p.id === target.vpnProfileId);
  if (!profile) {
    throw Object.assign(new Error('Zugewiesenes VPN-Profil existiert nicht mehr'), { status: 409 });
  }
  const configContent = vpnConfigStore.getConfig(profile.id);
  await vpnManager.connect(profile.interfaceName, configContent);
  for (let i = 0; i < 10; i++) {
    const s = await vpnManager.status();
    if (s.connected) {
      vpnTargets.setLastStatus('local', s);
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw Object.assign(new Error('VPN-Auto-Verbindung fehlgeschlagen (kein Handshake nach 10s)'), { status: 502 });
}
```

- [ ] **Step 4: Manually verify with the fake `wg`/`wg-quick` from Task 3**

```bash
FAKE_DIR=/c/Users/Marti/AppData/Local/Temp/claude/G--Entwicklung-MercySF/5edd230c-425d-469a-82a8-1e5d841e6ad2/scratchpad/fake-wg
node -e "
const vpnTargets = require('./lib/vpnTargets');
vpnTargets.setConfig('local', { vpnProfileId: 'nonexistent', gate: 'block' });
" 
MERCY_WG_QUICK_BIN="$FAKE_DIR/wg-quick" MERCY_WG_BIN="$FAKE_DIR/wg" MERCY_WG_CONF_DIR="$FAKE_DIR/conf" node -e "
const profiles = require('./routes/profiles');
console.log('module loads without throwing:', typeof profiles === 'function' || typeof profiles.stack !== 'undefined' || true);
"
node -e "require('fs').unlinkSync('./data/vpn-targets.json')"
```
This mainly confirms `routes/profiles.js` still loads cleanly with the new requires wired in
(the gate itself is exercised end-to-end in Task 14, since it needs a running server + a started
profile). Also run:
```bash
node -c routes/profiles.js && echo "syntax OK"
```
Expected: `syntax OK`.

- [ ] **Step 5: Commit**

```bash
git status --porcelain
git add routes/profiles.js
git commit -m "Gate local bot starts on VPN status (routes/profiles.js)"
```

---

### Task 7: Node-agent VPN storage (`vpnConfigStore.js` + `vpnStore.js`)

**Files:**
- Create: `node-agent/lib/vpnConfigStore.js`
- Create: `node-agent/lib/vpnStore.js`

**Interfaces:**
- Produces (`vpnConfigStore.js`): `setConfig(profileId, configContent): void`, `getConfig(profileId): string|null` — identical shape to `lib/vpnConfigStore.js` (Task 2), separate file/key/store because the node-agent has its own `data/` directory.
- Produces (`vpnStore.js`): `getAssignment(): {vpnProfileId, interfaceName, gate}|null`, `setAssignment({vpnProfileId, interfaceName, gate}): void` — a node only ever has **one** active VPN assignment at a time (unlike the dashboard, which tracks many profiles for many targets), so this is a single-record store, not a registry.

- [ ] **Step 1: Create `node-agent/lib/vpnConfigStore.js`** (byte-for-byte the same as `lib/vpnConfigStore.js` from Task 2, just living in the node-agent's own directory so its `require('./data/...')` resolves relative to `node-agent/`):

```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Identisch zum Muster in MercySF_Dashboard/lib/vpnConfigStore.js: AES-256-GCM, eigener
// Schlüssel, eigene Datei. Der Node bekommt die entschlüsselte Config einmalig vom Dashboard
// über POST /vpn/config und speichert sie hier lokal verschlüsselt für spätere connect-Aufrufe.
const DATA_DIR = path.join(__dirname, '..', 'data');
const KEY_PATH = path.join(DATA_DIR, '.vpn-config-key');
const STORE_PATH = path.join(DATA_DIR, 'vpn-configs.enc.json');

function getOrCreateKey() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(KEY_PATH)) {
    return Buffer.from(fs.readFileSync(KEY_PATH, 'utf8'), 'base64');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, key.toString('base64'), { mode: 0o600 });
  try { fs.chmodSync(KEY_PATH, 0o600); } catch (e) { /* Windows-Entwicklungsumgebung ignoriert das */ }
  return key;
}

const KEY = getOrCreateKey();

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') };
}

function decrypt(entry) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(entry.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(entry.data, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

function readStore() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
  try { fs.chmodSync(STORE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
}

function setConfig(profileId, configContent) {
  const store = readStore();
  store[profileId] = encrypt(configContent);
  writeStore(store);
}

function getConfig(profileId) {
  const store = readStore();
  const entry = store[profileId];
  if (!entry) return null;
  try {
    return decrypt(entry);
  } catch (e) {
    return null;
  }
}

module.exports = { setConfig, getConfig };
```

- [ ] **Step 2: Create `node-agent/lib/vpnStore.js`**

```javascript
const fs = require('fs');
const path = require('path');

// Ein Node hat immer nur EIN aktives VPN-Profil zugewiesen (anders als das Dashboard, das
// mehrere Profile für mehrere Ziele verwaltet) — daher ein Single-Record-Store statt einer Liste.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'vpn-assignment.json');

function getAssignment() {
  if (!fs.existsSync(FILE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function setAssignment({ vpnProfileId, interfaceName, gate }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const assignment = { vpnProfileId: vpnProfileId || null, interfaceName: interfaceName || null, gate: gate || 'off' };
  fs.writeFileSync(FILE_PATH, JSON.stringify(assignment, null, 2), { mode: 0o600 });
  try { fs.chmodSync(FILE_PATH, 0o600); } catch (e) { /* Windows ignorieren */ }
  return assignment;
}

module.exports = { getAssignment, setAssignment };
```

- [ ] **Step 3: Manually verify**

```bash
cd node-agent
node -e "
const configStore = require('./lib/vpnConfigStore');
configStore.setConfig('wg0', '[Interface]\nPrivateKey = secret\n');
console.log('config roundtrip:', configStore.getConfig('wg0') === '[Interface]\nPrivateKey = secret\n');

const vpnStore = require('./lib/vpnStore');
console.log('starts null:', vpnStore.getAssignment() === null);
const a = vpnStore.setAssignment({ vpnProfileId: 'wg0', interfaceName: 'wg0', gate: 'block' });
console.log('assignment saved:', a.gate === 'block');
console.log('assignment reloads:', vpnStore.getAssignment().vpnProfileId === 'wg0');

require('fs').unlinkSync('./data/vpn-configs.enc.json');
require('fs').unlinkSync('./data/.vpn-config-key');
require('fs').unlinkSync('./data/vpn-assignment.json');
"
cd ..
```
Expected: all four lines print `true`.

- [ ] **Step 4: Commit**

```bash
git status --porcelain
git add node-agent/lib/vpnConfigStore.js node-agent/lib/vpnStore.js
git commit -m "Add node-agent VPN storage (vpnConfigStore.js + vpnStore.js)"
```

---

### Task 8: Node-agent `vpnManager.js`

**Files:**
- Create: `node-agent/lib/vpnManager.js`

**Interfaces:**
- Produces: identical to `lib/vpnManager.js` (Task 3) — `async connect(interfaceName, configContent)`, `async disconnect(interfaceName)`, `async status()`.

- [ ] **Step 1: Copy `lib/vpnManager.js` verbatim to `node-agent/lib/vpnManager.js`**

Same file content as Task 3, Step 1 — no differences (both apps run the same commands against
their own local machine). Use the Task 3 code block as-is for this file.

- [ ] **Step 2: Manually verify (same fake-binary technique as Task 3)**

```bash
FAKE_DIR=/c/Users/Marti/AppData/Local/Temp/claude/G--Entwicklung-MercySF/5edd230c-425d-469a-82a8-1e5d841e6ad2/scratchpad/fake-wg
rm -f "$FAKE_DIR/wg-quick.log"
cd node-agent
MERCY_WG_QUICK_BIN="$FAKE_DIR/wg-quick" MERCY_WG_BIN="$FAKE_DIR/wg" MERCY_WG_CONF_DIR="$FAKE_DIR/conf" node -e "
const vpn = require('./lib/vpnManager');
(async () => {
  await vpn.connect('wg0', '[Interface]\nPrivateKey = test\n[Peer]\nPublicKey = test\n');
  const s = await vpn.status();
  console.log('connected:', s.connected === true && s.interfaceName === 'wg0');
  await vpn.disconnect('wg0');
})();
"
cd ..
```
Expected: `connected: true`. (Reuses the same fake `wg`/`wg-quick` wrapper scripts created in
Task 3, Step 2 — if that scratch dir was cleaned up, recreate it following Task 3's Step 2
instructions first.)

- [ ] **Step 3: Commit**

```bash
git status --porcelain
git add node-agent/lib/vpnManager.js
git commit -m "Add node-agent wg-quick/wg wrapper"
```

---

### Task 9: Node-agent `/vpn/*` endpoints + local start-gate

**Files:**
- Modify: `node-agent/server.js`

**Interfaces:**
- Consumes: `node-agent/lib/vpnConfigStore.js`, `node-agent/lib/vpnStore.js` (Task 7), `node-agent/lib/vpnManager.js` (Task 8)
- Produces (called by the dashboard's `routes/vpn.js`, Task 5): `POST /vpn/config` body `{vpnProfileId, interfaceName, configContent, gate}` → `{ok:true}`; `POST /vpn/connect` → `{connected, interfaceName}`; `POST /vpn/disconnect` → `{connected, interfaceName}`; `GET /vpn/status` → `{connected, interfaceName}`

- [ ] **Step 1: Add the requires**

Near the top of `node-agent/server.js`, alongside the existing `const statsDb = require('./lib/statsDb');`, add:

```javascript
const vpnConfigStore = require('./lib/vpnConfigStore');
const vpnStore = require('./lib/vpnStore');
const vpnManager = require('./lib/vpnManager');
```

- [ ] **Step 2: Make `/profiles/:id/start` async and add the gate check**

Replace:

```javascript
app.post('/profiles/:id/start', (req, res) => {
  if (!profileStore.get(req.params.id)) return res.status(404).json({ error: 'Profil nicht gefunden' });
  ptyManager.ensurePty(req.params.id);
  profileStore.setRunning(req.params.id, true);
  res.json(ptyManager.getStatus(req.params.id));
});
```

with:

```javascript
// Prüft die lokal gespeicherte VPN-Zuweisung (vom Dashboard per POST /vpn/config gesetzt) —
// bewusst lokal statt über einen Dashboard-Roundtrip, damit dieser Node auch bei
// Dashboard-Ausfall autonom entscheiden kann.
async function enforceVpnGate() {
  const assignment = vpnStore.getAssignment();
  if (!assignment || assignment.gate === 'off') return;
  if (!assignment.vpnProfileId) {
    throw Object.assign(new Error('VPN-Gate ist aktiv, aber kein VPN-Profil zugewiesen'), { status: 409 });
  }
  const status = await vpnManager.status();
  if (status.connected) return;
  if (assignment.gate === 'block') {
    throw Object.assign(new Error('VPN nicht verbunden — Start blockiert'), { status: 409 });
  }
  const configContent = vpnConfigStore.getConfig(assignment.vpnProfileId);
  if (!configContent) {
    throw Object.assign(new Error('Gespeicherte VPN-Config nicht gefunden'), { status: 409 });
  }
  await vpnManager.connect(assignment.interfaceName, configContent);
  for (let i = 0; i < 10; i++) {
    const s = await vpnManager.status();
    if (s.connected) return;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw Object.assign(new Error('VPN-Auto-Verbindung fehlgeschlagen (kein Handshake nach 10s)'), { status: 502 });
}

app.post('/profiles/:id/start', async (req, res) => {
  if (!profileStore.get(req.params.id)) return res.status(404).json({ error: 'Profil nicht gefunden' });
  try {
    await enforceVpnGate();
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
  ptyManager.ensurePty(req.params.id);
  profileStore.setRunning(req.params.id, true);
  res.json(ptyManager.getStatus(req.params.id));
});
```

- [ ] **Step 3: Add the `/vpn/*` endpoints**

Add these near the existing `/system/*` routes (after the `app.get('/system/stats', ...)` block):

```javascript
app.post('/vpn/config', express.json({ limit: '256kb' }), (req, res) => {
  const { vpnProfileId, interfaceName, configContent, gate } = req.body || {};
  if (configContent) vpnConfigStore.setConfig(vpnProfileId, configContent);
  vpnStore.setAssignment({ vpnProfileId, interfaceName, gate });
  res.json({ ok: true });
});

app.post('/vpn/connect', async (req, res) => {
  const assignment = vpnStore.getAssignment();
  if (!assignment || !assignment.vpnProfileId) return res.status(400).json({ error: 'Kein VPN-Profil zugewiesen' });
  const configContent = vpnConfigStore.getConfig(assignment.vpnProfileId);
  if (!configContent) return res.status(400).json({ error: 'Gespeicherte VPN-Config nicht gefunden' });
  try {
    await vpnManager.connect(assignment.interfaceName, configContent);
    res.json(await vpnManager.status());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/vpn/disconnect', async (req, res) => {
  const assignment = vpnStore.getAssignment();
  try {
    if (assignment?.interfaceName) await vpnManager.disconnect(assignment.interfaceName);
    res.json(await vpnManager.status());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/vpn/status', async (req, res) => {
  try {
    res.json(await vpnManager.status());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Manually verify**

```bash
node -c node-agent/server.js && echo "syntax OK"
```
Expected: `syntax OK`.

- [ ] **Step 5: Commit**

```bash
git status --porcelain
git add node-agent/server.js
git commit -m "node-agent: add /vpn/* endpoints and gate bot starts on VPN status"
```

---

### Task 10: `public/pages/system-settings.js` — new page

**Files:**
- Create: `public/pages/system-settings.js`

**Interfaces:**
- Consumes: `GET/POST /api/panel-settings` (existing, unchanged), `GET/POST/DELETE /api/vpn/profiles`, `GET /api/vpn/targets`, `POST /api/vpn/targets/:id/config`, `POST /api/vpn/targets/:id/connect`, `POST /api/vpn/targets/:id/disconnect`, `GET /api/vpn/targets/:id/status` (Task 5), i18n keys listed in Task 12 (all under `systemSettings.*`, plus reused `common.loading`/`analytics.loadError`)

- [ ] **Step 1: Create the page**

```javascript
import { t } from '/lib/i18n.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const GATE_KEYS = ['off', 'block', 'auto-connect'];
function gateLabels() {
  return {
    off: t('systemSettings.vpnGateOff'),
    block: t('systemSettings.vpnGateBlock'),
    'auto-connect': t('systemSettings.vpnGateAutoConnect'),
  };
}

export default {
  id: 'system-settings',
  label: 'System-Einstellungen',
  icon: '🖥',
  mount(container, ctx) {
    const css = `
      .system-settings-page .panel-settings-card, .system-settings-page .vpn-profiles-card {
        background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 14px; margin-bottom: 14px;
      }
      .system-settings-page .panel-settings-card h3, .system-settings-page .vpn-profiles-card h3, .system-settings-page .vpn-targets-title { margin: 0 0 4px; font-size: 13px; }
      .system-settings-page .panel-settings-desc, .system-settings-page .vpn-profiles-desc { font-size: 11.5px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
      .system-settings-page .panel-settings-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .system-settings-page select, .system-settings-page input[type="text"] {
        background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 10px; font-size: 13px;
      }
      .system-settings-page #panel-settings-status, .system-settings-page #vpn-profile-add-status { font-size: 11.5px; color: var(--muted); }
      .system-settings-page .vpn-profile-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
      .system-settings-page .vpn-profile-row:last-child { border-bottom: none; }
      .system-settings-page .vpn-profile-row .interface-name { color: var(--muted); font-size: 11px; }
      .system-settings-page .vpn-profile-row button { margin-left: auto; width: auto; padding: 4px 10px; font-size: 11px; }
      .system-settings-page .vpn-profile-add-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
      .system-settings-page .vpn-targets-title { margin-bottom: 10px; }
      .system-settings-page #vpn-targets-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
      .system-settings-page .vpn-target-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
      .system-settings-page .vpn-target-name { font-weight: 600; font-size: 14px; }
      .system-settings-page .vpn-target-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .system-settings-page .vpn-target-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
      .system-settings-page .status-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
      .system-settings-page .status-dot.connected { background: var(--green); box-shadow: 0 0 6px var(--green); }
      .system-settings-page .vpn-target-actions { display: flex; gap: 6px; flex-wrap: wrap; }
      .system-settings-page .vpn-target-actions button { width: auto; padding: 5px 10px; font-size: 11px; }
      .system-settings-page .vpn-warning { font-size: 11px; color: var(--yellow); }
      @media (max-width: 480px) {
        .system-settings-page #vpn-targets-list { grid-template-columns: 1fr; }
      }
    `;
    ctx.injectStyleOnce('system-settings', css);

    const wrap = document.createElement('div');
    wrap.className = 'system-settings-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('systemSettings.title')}</h1>
      <div class="panel-settings-card">
        <h3>${t('systemSettings.panelSettingsTitle')}</h3>
        <div class="panel-settings-desc">${t('systemSettings.panelSettingsDesc')}</div>
        <div class="panel-settings-row">
          <select id="gamestate-interval-select"><option>${t('common.loading')}</option></select>
          <button class="btn btn-primary" id="gamestate-interval-save" style="width:auto;padding:7px 16px;">${t('systemSettings.applyBtn')}</button>
          <span id="panel-settings-status"></span>
        </div>
      </div>
      <div class="vpn-profiles-card">
        <h3>${t('systemSettings.vpnProfilesTitle')}</h3>
        <div class="vpn-profiles-desc">${t('systemSettings.vpnProfilesDesc')}</div>
        <div id="vpn-profiles-list">${t('common.loading')}</div>
        <div class="vpn-profile-add-row">
          <input type="text" id="vpn-profile-label" placeholder="${t('systemSettings.vpnProfileLabelPlaceholder')}" />
          <input type="file" id="vpn-profile-file" accept=".conf,text/plain" />
          <button class="btn btn-primary" id="vpn-profile-add-btn" style="width:auto;padding:7px 16px;">${t('systemSettings.vpnProfileAddBtn')}</button>
        </div>
        <div id="vpn-profile-add-status"></div>
      </div>
      <h3 class="vpn-targets-title">${t('systemSettings.vpnTargetsTitle')}</h3>
      <div id="vpn-targets-list">${t('common.loading')}</div>
    `;
    container.appendChild(wrap);

    // --- Panel-Einstellungen (1:1 aus der alten settings.js übernommen) ---
    async function loadPanelSettings() {
      const select = wrap.querySelector('#gamestate-interval-select');
      const status = wrap.querySelector('#panel-settings-status');
      try {
        const data = await ctx.fetchJSON('/api/panel-settings');
        select.innerHTML = data.presets.map(p =>
          `<option value="${p.key}" ${p.key === data.current ? 'selected' : ''}>${p.label}</option>`).join('');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    }

    wrap.querySelector('#gamestate-interval-save').addEventListener('click', async () => {
      const select = wrap.querySelector('#gamestate-interval-select');
      const status = wrap.querySelector('#panel-settings-status');
      status.textContent = t('systemSettings.saving');
      try {
        await ctx.fetchJSON('/api/panel-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset: select.value }),
        });
        status.textContent = t('systemSettings.applied');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    // --- VPN-Profile ---
    let vpnProfiles = [];

    async function loadVpnProfiles() {
      const list = wrap.querySelector('#vpn-profiles-list');
      try {
        vpnProfiles = await ctx.fetchJSON('/api/vpn/profiles');
      } catch (err) {
        list.textContent = t('analytics.loadError', { message: err.message });
        return;
      }
      list.innerHTML = vpnProfiles.length
        ? vpnProfiles.map(p => `
          <div class="vpn-profile-row" data-id="${p.id}">
            <span>${escapeHtml(p.label)}</span>
            <span class="interface-name">${escapeHtml(p.interfaceName)}</span>
            <button class="btn-danger" data-action="delete-profile">${t('systemSettings.vpnProfileDeleteBtn')}</button>
          </div>`).join('')
        : `<span>${t('systemSettings.vpnProfilesEmpty')}</span>`;

      list.querySelectorAll('[data-action="delete-profile"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.closest('.vpn-profile-row').dataset.id;
          if (!confirm(t('systemSettings.vpnProfileDeleteConfirm'))) return;
          try {
            await ctx.fetchJSON(`/api/vpn/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
            await loadVpnProfiles();
            await loadVpnTargets();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    }

    wrap.querySelector('#vpn-profile-add-btn').addEventListener('click', async () => {
      const labelInput = wrap.querySelector('#vpn-profile-label');
      const fileInput = wrap.querySelector('#vpn-profile-file');
      const status = wrap.querySelector('#vpn-profile-add-status');
      const file = fileInput.files[0];
      if (!labelInput.value.trim() || !file) {
        status.textContent = t('systemSettings.vpnConfigInvalidHint');
        return;
      }
      status.textContent = t('systemSettings.vpnProfileAdding');
      try {
        const configContent = await file.text();
        await ctx.fetchJSON('/api/vpn/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: labelInput.value.trim(), configContent }),
        });
        status.textContent = t('systemSettings.vpnProfileAdded');
        labelInput.value = '';
        fileInput.value = '';
        await loadVpnProfiles();
        await loadVpnTargets();
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    // --- VPN-Ziele ---
    function profileOptionsHtml(selected) {
      return `<option value="">${t('systemSettings.vpnProfileSelectNone')}</option>` +
        vpnProfiles.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('');
    }

    function gateOptionsHtml(selected) {
      const labels = gateLabels();
      return GATE_KEYS.map(g => `<option value="${g}" ${g === selected ? 'selected' : ''}>${labels[g]}</option>`).join('');
    }

    function statusText(target) {
      if (!target.lastStatus || !target.lastStatus.updatedAt) return t('systemSettings.vpnStatusNever');
      return target.lastStatus.connected
        ? t('systemSettings.vpnStatusConnected', { interface: target.lastStatus.interfaceName || '' })
        : t('systemSettings.vpnStatusDisconnected');
    }

    async function loadVpnTargets() {
      const list = wrap.querySelector('#vpn-targets-list');
      let targets;
      try {
        targets = await ctx.fetchJSON('/api/vpn/targets');
      } catch (err) {
        list.textContent = t('analytics.loadError', { message: err.message });
        return;
      }
      const duplicateProfileIds = new Set(
        Object.entries(targets.filter(t2 => t2.vpnProfileId).reduce((acc, t2) => {
          acc[t2.vpnProfileId] = (acc[t2.vpnProfileId] || 0) + 1;
          return acc;
        }, {})).filter(([, count]) => count > 1).map(([id]) => id),
      );

      list.innerHTML = targets.map(target => `
        <div class="vpn-target-card" data-id="${target.targetId}">
          <div class="vpn-target-name">${escapeHtml(target.label)}</div>
          ${duplicateProfileIds.has(target.vpnProfileId) ? `<div class="vpn-warning">${t('systemSettings.vpnDuplicateWarning')}</div>` : ''}
          <div class="vpn-target-row">
            <select data-role="profile">${profileOptionsHtml(target.vpnProfileId)}</select>
            <select data-role="gate">${gateOptionsHtml(target.gate)}</select>
            <button class="btn-secondary" data-role="save">${t('systemSettings.vpnSaveBtn')}</button>
          </div>
          <div class="vpn-target-status">
            <span class="status-dot ${target.lastStatus?.connected ? 'connected' : ''}"></span>
            <span data-role="status-text">${statusText(target)}</span>
          </div>
          <div class="vpn-target-actions">
            <button class="btn btn-primary" data-role="connect">${t('systemSettings.vpnConnectBtn')}</button>
            <button class="btn-secondary" data-role="disconnect">${t('systemSettings.vpnDisconnectBtn')}</button>
            <button class="btn-secondary" data-role="refresh">${t('systemSettings.vpnRefreshBtn')}</button>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.vpn-target-card').forEach(card => {
        const id = card.dataset.id;

        card.querySelector('[data-role="save"]').addEventListener('click', async () => {
          const vpnProfileId = card.querySelector('[data-role="profile"]').value || null;
          const gate = card.querySelector('[data-role="gate"]').value;
          try {
            await ctx.fetchJSON(`/api/vpn/targets/${encodeURIComponent(id)}/config`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ vpnProfileId, gate }),
            });
            await loadVpnTargets();
          } catch (err) {
            alert(err.message);
          }
        });

        function wireAction(role, path, method) {
          card.querySelector(`[data-role="${role}"]`).addEventListener('click', async () => {
            const statusEl = card.querySelector('[data-role="status-text"]');
            statusEl.textContent = t('common.loading');
            try {
              await ctx.fetchJSON(`/api/vpn/targets/${encodeURIComponent(id)}${path}`, { method });
              await loadVpnTargets();
            } catch (err) {
              statusEl.textContent = t('analytics.loadError', { message: err.message });
            }
          });
        }
        wireAction('connect', '/connect', 'POST');
        wireAction('disconnect', '/disconnect', 'POST');
        wireAction('refresh', '/status', 'GET');
      });
    }

    loadPanelSettings();
    loadVpnProfiles().then(loadVpnTargets);
  },
};
```

- [ ] **Step 2: Manually verify**

```bash
node --check --input-type=module < public/pages/system-settings.js && echo "parsed OK"
```
Expected: `parsed OK`.

- [ ] **Step 3: Commit**

```bash
git status --porcelain
git add public/pages/system-settings.js
git commit -m "Add System-Einstellungen page (panel settings + VPN control)"
```

---

### Task 11: Remove Panel-Einstellungen from `public/pages/settings.js`

**Files:**
- Modify: `public/pages/settings.js`

**Interfaces:** none (pure removal; `settings.js` keeps its existing `id: 'settings'` and bot-config behavior unchanged)

- [ ] **Step 1: Remove the panel-settings CSS block**

Delete these lines from `public/pages/settings.js` (currently around lines 445-450):

```css
      .settings-page .panel-settings-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 14px; margin-bottom: 10px; }
      .settings-page .panel-settings-card h3 { margin: 0 0 4px; font-size: 13px; }
      .settings-page .panel-settings-desc { font-size: 11.5px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
      .settings-page .panel-settings-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .settings-page .panel-settings-row select { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 10px; font-size: 13px; }
      .settings-page #panel-settings-status { font-size: 11.5px; color: var(--muted); }
```

- [ ] **Step 2: Remove the panel-settings markup block**

Replace:

```javascript
      <h1 class="page-title">${t('settings.title')}</h1>
      <div class="panel-settings-card">
        <h3>${t('settings.panelSettingsTitle')}</h3>
        <div class="panel-settings-desc">${t('settings.panelSettingsDesc')}</div>
        <div class="panel-settings-row">
          <select id="gamestate-interval-select"><option>${t('common.loading')}</option></select>
          <button class="btn btn-primary" id="gamestate-interval-save" style="width:auto;padding:7px 16px;">${t('settings.applyBtn')}</button>
          <span id="panel-settings-status"></span>
        </div>
      </div>
      <div class="templates-card">
```

with:

```javascript
      <h1 class="page-title">${t('settings.title')}</h1>
      <div class="templates-card">
```

- [ ] **Step 3: Remove the panel-settings JS logic**

Delete the `loadPanelSettings` function, its call site, and the save button handler:

```javascript
    async function loadPanelSettings() {
      const select = wrap.querySelector('#gamestate-interval-select');
      const status = wrap.querySelector('#panel-settings-status');
      try {
        const data = await ctx.fetchJSON('/api/panel-settings');
        select.innerHTML = data.presets.map(p =>
          `<option value="${p.key}" ${p.key === data.current ? 'selected' : ''}>${p.label}</option>`).join('');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    }

    wrap.querySelector('#gamestate-interval-save').addEventListener('click', async () => {
      const select = wrap.querySelector('#gamestate-interval-select');
      const status = wrap.querySelector('#panel-settings-status');
      status.textContent = t('settings.saving');
      try {
        await ctx.fetchJSON('/api/panel-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset: select.value }),
        });
        status.textContent = t('settings.applied');
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    loadPanelSettings();
```

Delete this entire block (all three pieces). Nothing replaces it — the next line after
`loadPanelSettings();` in the original file continues the existing bot-settings logic unchanged.

- [ ] **Step 4: Manually verify**

```bash
node --check --input-type=module < public/pages/settings.js && echo "parsed OK"
grep -c "panel-settings\|panelSettings" public/pages/settings.js
```
Expected: `parsed OK`, then `0` (no remaining references).

- [ ] **Step 5: Commit**

```bash
git status --porcelain
git add public/pages/settings.js
git commit -m "settings page: remove panel settings (moved to System-Einstellungen)"
```

---

### Task 12: Navigation + i18n

**Files:**
- Modify: `public/router.js`
- Modify: `public/lib/i18n/de.js`
- Modify: `public/lib/i18n/en.js`

**Interfaces:** none (pure configuration/text)

- [ ] **Step 1: Add the nav entry**

In `public/router.js`, the `PAGES` array currently reads:

```javascript
const PAGES = [
  { id: 'overview', icon: '▦', labelKey: 'nav.overview' },
  { id: 'accounts', icon: '🗂', labelKey: 'nav.accounts' },
  { id: 'nodes', icon: '🖧', labelKey: 'nav.nodes' },
  { id: 'analytics', icon: '📈', labelKey: 'nav.analytics' },
  { id: 'analytics-compare', icon: '🧬', labelKey: 'nav.analyticsCompare' },
  { id: 'settings', icon: '⚙', labelKey: 'nav.settings' },
  { id: 'console', icon: '⌨', labelKey: 'nav.console' },
];
```

Add the new entry right after `settings` (so bot settings and system settings sit next to each
other in the nav):

```javascript
const PAGES = [
  { id: 'overview', icon: '▦', labelKey: 'nav.overview' },
  { id: 'accounts', icon: '🗂', labelKey: 'nav.accounts' },
  { id: 'nodes', icon: '🖧', labelKey: 'nav.nodes' },
  { id: 'analytics', icon: '📈', labelKey: 'nav.analytics' },
  { id: 'analytics-compare', icon: '🧬', labelKey: 'nav.analyticsCompare' },
  { id: 'settings', icon: '⚙', labelKey: 'nav.settings' },
  { id: 'system-settings', icon: '🖥', labelKey: 'nav.systemSettings' },
  { id: 'console', icon: '⌨', labelKey: 'nav.console' },
];
```

- [ ] **Step 2: Add/change i18n keys in `public/lib/i18n/de.js`**

Change the existing `nav.settings` and `settings.title` values (line ~16 and ~198) from
`'Einstellungen'` to `'Bot-Einstellungen'`:

```javascript
  'nav.settings': 'Bot-Einstellungen',
```
```javascript
  'settings.title': 'Bot-Einstellungen',
```

Remove the now-unused (moved) keys — find and delete these two lines (they still exist from
before Task 11; the values move to the `systemSettings.*` keys below instead):

```javascript
  'settings.panelSettingsTitle': '⚙ Panel-Einstellungen',
  'settings.panelSettingsDesc': 'Wie oft die sf-api-Bridge live abgefragt wird (Ausrüstung, Spielstand). Seltener abfragen reduziert das Risiko zusätzlicher, außerplanmäßiger Logins.',
```

Add the new `nav.systemSettings` key next to `nav.settings`:

```javascript
  'nav.systemSettings': 'System-Einstellungen',
```

Add a new block (place it near the end of the file, following the existing pattern of one
`// <page>.js (public/pages/<page>.js)` comment header per page):

```javascript
  // system-settings.js (public/pages/system-settings.js)
  'systemSettings.title': 'System-Einstellungen',
  'systemSettings.panelSettingsTitle': '⚙ Panel-Einstellungen',
  'systemSettings.panelSettingsDesc': 'Wie oft die sf-api-Bridge live abgefragt wird (Ausrüstung, Spielstand). Seltener abfragen reduziert das Risiko zusätzlicher, außerplanmäßiger Logins.',
  'systemSettings.applyBtn': 'Übernehmen',
  'systemSettings.saving': 'Speichere...',
  'systemSettings.applied': 'Übernommen.',
  'systemSettings.vpnProfilesTitle': '🔒 VPN-Profile',
  'systemSettings.vpnProfilesDesc': 'Pro ProtonVPN-Account+Standort einmalig eine WireGuard-Config aus dem ProtonVPN-Dashboard herunterladen und hier hochladen.',
  'systemSettings.vpnProfileLabelPlaceholder': 'Bezeichnung, z. B. "Account A – Niederlande"',
  'systemSettings.vpnProfileAddBtn': 'Hochladen',
  'systemSettings.vpnProfileAdding': 'Lade hoch...',
  'systemSettings.vpnProfileAdded': 'Hochgeladen.',
  'systemSettings.vpnProfileDeleteBtn': 'Löschen',
  'systemSettings.vpnProfileDeleteConfirm': 'VPN-Profil wirklich löschen?',
  'systemSettings.vpnProfilesEmpty': 'Noch keine VPN-Profile hochgeladen.',
  'systemSettings.vpnConfigInvalidHint': 'Bitte Bezeichnung und eine .conf-Datei angeben.',
  'systemSettings.vpnTargetsTitle': '🎯 VPN-Ziele',
  'systemSettings.vpnProfileSelectNone': '— kein VPN-Profil —',
  'systemSettings.vpnGateOff': 'Aus',
  'systemSettings.vpnGateBlock': 'Blockieren',
  'systemSettings.vpnGateAutoConnect': 'Auto-Verbinden',
  'systemSettings.vpnSaveBtn': 'Speichern',
  'systemSettings.vpnConnectBtn': 'Verbinden',
  'systemSettings.vpnDisconnectBtn': 'Trennen',
  'systemSettings.vpnRefreshBtn': '🔄 Status',
  'systemSettings.vpnStatusNever': 'Noch nie geprüft',
  'systemSettings.vpnStatusConnected': '🟢 Verbunden ({{interface}})',
  'systemSettings.vpnStatusDisconnected': '🔴 Getrennt',
  'systemSettings.vpnDuplicateWarning': '⚠ Dieses Profil ist mehreren Zielen zugewiesen — gleichzeitig verbinden funktioniert bei ProtonVPN in der Regel nicht.',
```

- [ ] **Step 3: Mirror the same changes in `public/lib/i18n/en.js`**

Change:
```javascript
  'nav.settings': 'Bot Settings',
```
```javascript
  'settings.title': 'Bot Settings',
```

Remove:
```javascript
  'settings.panelSettingsTitle': '⚙ Panel settings',
  'settings.panelSettingsDesc': 'How often the sf-api bridge is polled live (equipment, game state). Polling less often reduces the risk of extra, unscheduled logins.',
```

Add next to `nav.settings`:
```javascript
  'nav.systemSettings': 'System Settings',
```

Add the block:
```javascript
  // system-settings.js (public/pages/system-settings.js)
  'systemSettings.title': 'System Settings',
  'systemSettings.panelSettingsTitle': '⚙ Panel settings',
  'systemSettings.panelSettingsDesc': 'How often the sf-api bridge is polled live (equipment, game state). Polling less often reduces the risk of extra, unscheduled logins.',
  'systemSettings.applyBtn': 'Apply',
  'systemSettings.saving': 'Saving...',
  'systemSettings.applied': 'Applied.',
  'systemSettings.vpnProfilesTitle': '🔒 VPN profiles',
  'systemSettings.vpnProfilesDesc': 'Download a WireGuard config once per ProtonVPN account+location from the ProtonVPN dashboard, then upload it here.',
  'systemSettings.vpnProfileLabelPlaceholder': 'Label, e.g. "Account A – Netherlands"',
  'systemSettings.vpnProfileAddBtn': 'Upload',
  'systemSettings.vpnProfileAdding': 'Uploading...',
  'systemSettings.vpnProfileAdded': 'Uploaded.',
  'systemSettings.vpnProfileDeleteBtn': 'Delete',
  'systemSettings.vpnProfileDeleteConfirm': 'Really delete this VPN profile?',
  'systemSettings.vpnProfilesEmpty': 'No VPN profiles uploaded yet.',
  'systemSettings.vpnConfigInvalidHint': 'Please provide a label and a .conf file.',
  'systemSettings.vpnTargetsTitle': '🎯 VPN targets',
  'systemSettings.vpnProfileSelectNone': '— no VPN profile —',
  'systemSettings.vpnGateOff': 'Off',
  'systemSettings.vpnGateBlock': 'Block',
  'systemSettings.vpnGateAutoConnect': 'Auto-connect',
  'systemSettings.vpnSaveBtn': 'Save',
  'systemSettings.vpnConnectBtn': 'Connect',
  'systemSettings.vpnDisconnectBtn': 'Disconnect',
  'systemSettings.vpnRefreshBtn': '🔄 Status',
  'systemSettings.vpnStatusNever': 'Never checked',
  'systemSettings.vpnStatusConnected': '🟢 Connected ({{interface}})',
  'systemSettings.vpnStatusDisconnected': '🔴 Disconnected',
  'systemSettings.vpnDuplicateWarning': '⚠ This profile is assigned to more than one target — connecting both at once usually doesn\'t work with ProtonVPN.',
```

- [ ] **Step 4: Verify every key the page uses exists in both dicts**

```bash
grep -oE "t\('[a-zA-Z]+\.[a-zA-Z0-9_.]+'" public/pages/system-settings.js | sed "s/t('//;s/'$//" | sort -u > /tmp/ss_keys.txt
for k in $(cat /tmp/ss_keys.txt); do
  grep -q "'$k':" public/lib/i18n/de.js || echo "MISSING in de: $k"
  grep -q "'$k':" public/lib/i18n/en.js || echo "MISSING in en: $k"
done
echo "check complete"
node -c public/lib/i18n/de.js && node -c public/lib/i18n/en.js && node -c public/router.js && echo "syntax OK"
```
Expected: only `check complete` and `syntax OK` (no `MISSING` lines).

- [ ] **Step 5: Commit**

```bash
git status --porcelain
git add public/router.js public/lib/i18n/de.js public/lib/i18n/en.js
git commit -m "Wire up System-Einstellungen nav entry and i18n"
```

---

### Task 13: Install `wireguard-tools` in `install.sh`

**Files:**
- Modify: `install.sh`

**Interfaces:** none

- [ ] **Step 1: Add the package to the apt install line**

In `install.sh`, replace:

```bash
apt-get install -y -qq curl git build-essential python3 openssl ca-certificates >/dev/null
```

with:

```bash
apt-get install -y -qq curl git build-essential python3 openssl ca-certificates wireguard-tools >/dev/null
```

- [ ] **Step 2: Manually verify**

```bash
grep -c "wireguard-tools" install.sh
```
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git status --porcelain
git add install.sh
git commit -m "install.sh: install wireguard-tools (needed for VPN control)"
```

---

### Task 14: End-to-end review, version bump, and report

**Files:**
- Modify: `package.json` (dashboard)
- Modify: `node-agent/package.json`

**Interfaces:** none

- [ ] **Step 1: Full-project syntax sweep**

```bash
for f in lib/vpnProfiles.js lib/vpnConfigStore.js lib/vpnManager.js lib/vpnTargets.js routes/vpn.js routes/profiles.js node-agent/lib/vpnConfigStore.js node-agent/lib/vpnStore.js node-agent/lib/vpnManager.js node-agent/server.js; do
  node -c "$f" || echo "FAILED: $f"
done
node --check --input-type=module < public/pages/system-settings.js || echo "FAILED: system-settings.js"
node --check --input-type=module < public/pages/settings.js || echo "FAILED: settings.js"
node --check --input-type=module < public/router.js || echo "FAILED: router.js"
echo "sweep complete"
```
Expected: only `sweep complete`, no `FAILED` lines.

- [ ] **Step 2: Re-run the Task 5 and Task 6 in-process HTTP checks**

Re-run the exact `node -e` snippet from Task 5, Step 2 (dashboard `routes/vpn.js` validation
paths) to confirm nothing regressed after Tasks 6-13 touched neighboring files. If any local
`data/vpn-*.json` files are left over from earlier manual test runs, remove them first:

```bash
rm -f data/vpn-profiles.json data/vpn-configs.enc.json data/.vpn-config-key data/vpn-targets.json
```

- [ ] **Step 3: Attempt a live server start (same caveat as the earlier Account-Analyse plan)**

```bash
npm install
node server.js
```
If `better-sqlite3`/`node-pty` fail to build here (no working Python/node-gyp toolchain on this
Windows dev machine — this happened during the previous feature's implementation too), that's
expected and not a regression from this work: note it in the final report and rely on the
isolated checks from Steps 1-2 plus code review. If the server *does* start here or you're
continuing on a Linux machine, additionally check in the browser:
- "System-Einstellungen" appears in the nav between "Bot-Einstellungen" and "Konsole"
- Panel-Einstellungen (language/poll interval) still works from its new location
- Uploading a `.conf` file (any text file with `[Interface]`/`[Peer]` lines works for this UI
  check) creates a VPN profile and it appears in the VPN-Ziele dropdowns
- Assigning a profile + gate to "Lokal" and clicking "Speichern" persists across a page reload
- `wg-quick`/`wg` are not installed here either — actually issuing Connect will fail with a clear
  error (spawn ENOENT), which is the expected failure mode off the real deployment target; this
  still confirms the request wiring (button → API call → error surfaced in the UI) works

- [ ] **Step 4: Bump versions**

Check current versions first:
```bash
grep '"version"' package.json node-agent/package.json
```

Bump both by one minor version (new feature in both apps) — edit `package.json`:
```json
  "version": "1.1.0",
```
and `node-agent/package.json`:
```json
  "version": "0.4.0",
```
(Use whatever the actual current values from the `grep` above are, incrementing the minor
component by 1 and zeroing the patch component — the values shown here were current as of
writing this plan and may have moved if other work landed on `main`/this branch since.)

- [ ] **Step 5: Verify and commit**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('node-agent/package.json','utf8')); console.log('valid JSON')"
git status --porcelain
git add package.json node-agent/package.json
git commit -m "Bump versions for ProtonVPN support (dashboard + node-agent)"
```

- [ ] **Step 6: Final report**

Summarize for the user: what was verified live vs. only via isolated/mocked checks (Rust-style
caveat doesn't apply here — no Rust in this feature — but the `wg-quick`/`wg` fake-binary
substitution and the `better-sqlite3`/Python toolchain gap both need to be called out, plus the
manual one-time step the user still owes: downloading WireGuard `.conf` files from the ProtonVPN
dashboard and uploading them via the new VPN-Profile card, and running
`apt-get install wireguard-tools` on any **already-installed** node (Task 13 only covers fresh
installs via `install.sh`).
