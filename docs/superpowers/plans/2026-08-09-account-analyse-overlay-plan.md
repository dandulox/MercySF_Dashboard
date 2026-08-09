# Account-Analyse Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic character-class detection plus a new "Account-Analyse" page that lets the user overlay any combination of (character or class) × (stat field) as lines in one Chart.js chart.

**Architecture:** Extend the existing `accountsRegistry` profile record with a `characterClass` field, auto-populated the next time the existing sfapi-bridge `/state` call runs for that profile. Extract the existing per-account analytics bucket/read logic out of `routes/analytics.js` into a shared `lib/analyticsService.js` so a new `POST /api/analytics-compare` endpoint can reuse it for both single-character and class-summed (multi-character) series, across local and node-delegated profiles, at three time granularities (24h / 7d / 30d). A new page `public/pages/analytics-compare.js` provides the series-builder filter UI and renders the overlay chart.

**Tech Stack:** Node.js + Express (dashboard backend), Chart.js (already vendored at `/vendor/chart.js`), vanilla JS pages (no framework/build step), Rust + axum + sf-api (`sfapi-bridge`), plain Node.js (`node-agent`).

## Global Constraints

- No test framework exists anywhere in this repo (`package.json` has no test script, no `tests/` directory in the dashboard, node-agent, or sfapi-bridge). Do not introduce one for this feature — follow the codebase's existing convention of manual verification (this plan's "test" steps are manual `node -e` snippets, `curl`/PowerShell HTTP calls, and browser checks, not automated test files).
- Follow existing code style exactly: German UI strings and comments explaining *why* (not *what*), CommonJS `require`/`module.exports` in Node files, ES module `import`/`export default` in `public/pages/*.js`, 2-space indentation.
- Money fields: `silver` is stored in Silber; the UI always divides by 100 and labels it "Gold" (see `public/pages/analytics.js:141`) — the new page must do the same.
- Route files in `routes/` are auto-mounted at `/api/<filename-without-.js>` by `server.js:83-97` — a new file `routes/analytics-compare.js` will be mounted at `/api/analytics-compare` automatically, no manual wiring needed.
- The "account" identifier used throughout the existing analytics/history/stats endpoints (and by `ctx.getAccountId()` in the frontend) is `accountIdFor(server, characterName)` from `lib/data.js`, e.g. `https___s1-mercysf_com__CharName` — **not** `accountsRegistry` profile IDs (which are slugs like `username-charname`). Keep using this identifier for all "account" series in the new endpoint.
- sf-api 0.4.4's `Character` struct has a field `class: Class`, where `Class` is a 12-variant plain unit enum (`Warrior`, `Mage`, `Scout`, `Assassin`, `BattleMage`, `Berserker`, `DemonHunter`, `Druid`, `Bard`, `Necromancer`, `Paladin`, `PlagueDoctor`) — confirmed via docs.rs. `format!("{:?}", character.class)` yields the plain variant name string.

---

### Task 1: sfapi-bridge — expose character class in `/state`

**Files:**
- Modify: `sfapi-bridge/src/main.rs:93-101` (`StateResponse` struct), `sfapi-bridge/src/main.rs:237-244` (`state_handler` return)

**Interfaces:**
- Produces: `StateResponse.character_class: String` (serialized as `characterClass` in JSON, via the existing `#[serde(rename_all = "camelCase")]` — actually `StateResponse` currently has no `#[serde(rename_all = ...)]` attribute, see step 1 for exact fix)

- [ ] **Step 1: Add the field to `StateResponse` with explicit camelCase rename**

`StateResponse` (unlike the other structs in this file) has no `#[serde(rename_all = "camelCase")]` attribute, so its existing fields serialize as-is (`character_name`, not `characterName` — check the frontend never reads this key before assuming otherwise; `routes/gamestate.js` doesn't touch `character_name` today so this is safe to leave alone). Add the new field with an explicit per-field rename so we don't change the two existing field names' wire format:

Replace `sfapi-bridge/src/main.rs:93-101`:

```rust
#[derive(Serialize)]
struct StateResponse {
    character_name: String,
    equipment: Vec<EquipmentItem>,
    guild: Option<GuildInfo>,
    tavern: TavernInfo,
    mail: MailInfo,
}
```

with:

```rust
#[derive(Serialize)]
struct StateResponse {
    character_name: String,
    #[serde(rename = "characterClass")]
    character_class: String,
    equipment: Vec<EquipmentItem>,
    guild: Option<GuildInfo>,
    tavern: TavernInfo,
    mail: MailInfo,
}
```

- [ ] **Step 2: Populate the field in `state_handler`**

Replace `sfapi-bridge/src/main.rs:237-244`:

```rust
    Json(StateResponse {
        character_name: character.name.clone(),
        equipment,
        guild,
        tavern,
        mail,
    })
    .into_response()
```

with:

```rust
    Json(StateResponse {
        character_name: character.name.clone(),
        character_class: format!("{:?}", character.class),
        equipment,
        guild,
        tavern,
        mail,
    })
    .into_response()
```

- [ ] **Step 3: Build and fix any compile error**

Run:
```bash
cd sfapi-bridge && cargo build --release
```

Expected: builds successfully. If `cargo` isn't installed on this machine, skip building here — the bridge is deployed and built on the Linux dashboard server (see `sfapi-bridge/Cargo.toml`, `install.sh`), so note in your final report that this step still needs a build on that server before deploy. If `cargo` *is* available but the build fails with something like "no field `class` on type `Character`", the sf-api version pinned in `Cargo.lock` may differ from what docs.rs shows — run `cargo doc --open -p sf-api` (or search `~/.cargo/registry/src/*/sf-api-*/src/gamestate/character.rs` for `pub class`) to find the actual field name and adjust Step 1/2 accordingly.

- [ ] **Step 4: Commit**

```bash
git add sfapi-bridge/src/main.rs
git commit -m "sfapi-bridge: expose character class in /state response"
```

---

### Task 2: `accountsRegistry` — add `characterClass` field

**Files:**
- Modify: `lib/accountsRegistry.js`

**Interfaces:**
- Produces: `registry.setCharacterClass(id: string, characterClass: string|null): Profile|null`, and every profile object now has a `characterClass: string|null` property (default `null` for new profiles; `undefined` for profiles created before this change until backfilled — both are falsy, treat identically).

- [ ] **Step 1: Add the default field in `add()`**

In `lib/accountsRegistry.js:51-64`, add `characterClass: null,` to the profile object literal, right after `characterName`:

```javascript
  const profile = {
    id,
    nickname: String(nickname || characterName).slice(0, 60),
    username: String(username).slice(0, 100),
    server: String(server).slice(0, 100),
    characterName: String(characterName).slice(0, 100),
    characterClass: null,
    pausedKeys: [],
    autoStart: false,
```

- [ ] **Step 2: Add `setCharacterClass()`**

Add this function after `rename()` (`lib/accountsRegistry.js:82-90`), following the exact same shape as `rename`/`setAutoStart`:

```javascript
function setCharacterClass(id, characterClass) {
  const all = readAll();
  const profile = all.find(p => p.id === id);
  if (!profile) return null;
  profile.characterClass = characterClass || null;
  writeAll(all);
  return profile;
}
```

- [ ] **Step 3: Export it**

In `lib/accountsRegistry.js:121`, change:
```javascript
module.exports = { list, add, rename, setPausedKeys, setAutoStart, setNode, remove };
```
to:
```javascript
module.exports = { list, add, rename, setPausedKeys, setAutoStart, setNode, setCharacterClass, remove };
```

- [ ] **Step 4: Manually verify**

Run from the `MercySF_Dashboard` directory:
```bash
node -e "
const r = require('./lib/accountsRegistry');
const p = r.add({ username: 'test-plan-verify', server: 's1.example.com', characterName: 'PlanVerifyChar', nickname: 'PV' });
console.log('created:', p.characterClass === null);
const updated = r.setCharacterClass(p.id, 'Warrior');
console.log('set:', updated.characterClass === 'Warrior');
r.remove(p.id);
console.log('cleaned up:', r.list().every(x => x.id !== p.id));
"
```
Expected output: `created: true`, `set: true`, `cleaned up: true`. This writes to and cleans up `data/account-profiles.json` — safe to run against the real file since it removes the test profile at the end.

- [ ] **Step 5: Commit**

```bash
git add lib/accountsRegistry.js
git commit -m "accountsRegistry: add characterClass field"
```

---

### Task 3: Persist detected class from `/api/gamestate`

**Files:**
- Modify: `routes/gamestate.js`

**Interfaces:**
- Consumes: `registry.setCharacterClass` from Task 2; bridge response now includes `characterClass` (Task 1, but this task doesn't hard-depend on the Rust build — it just reads `data.characterClass`, which is `undefined` until the bridge is rebuilt, and the `if` guard below handles that safely).

- [ ] **Step 1: Persist the class on successful bridge response**

In `routes/gamestate.js`, find:
```javascript
  const data = await bridgeRes.json();
  if (!bridgeRes.ok) {
    return res.status(502).json({ error: data.error || 'sf-api-Bridge-Fehler' });
  }

  cache.set(profile.id, { data, expiresAt: Date.now() + cacheTtlMs });
  res.json(data);
```
Replace with:
```javascript
  const data = await bridgeRes.json();
  if (!bridgeRes.ok) {
    return res.status(502).json({ error: data.error || 'sf-api-Bridge-Fehler' });
  }

  // Die Spielklasse ändert sich nie — einmal erkannt, dauerhaft im Profil speichern, damit die
  // Account-Analyse-Seite Charaktere nach Klasse gruppieren kann, ohne bei jedem Laden erneut
  // die Bridge (und damit einen echten Spiele-Login) aufrufen zu müssen.
  if (data.characterClass && profile.characterClass !== data.characterClass) {
    registry.setCharacterClass(profile.id, data.characterClass);
  }

  cache.set(profile.id, { data, expiresAt: Date.now() + cacheTtlMs });
  res.json(data);
```

- [ ] **Step 2: Import the registry module**

Check `routes/gamestate.js:1-6` already has `const registry = require('../lib/accountsRegistry');` — it does (line 2). No import change needed.

- [ ] **Step 3: Manually verify with a mock bridge**

This route calls out to a real running sfapi-bridge + real game login, which isn't practical to exercise standalone. Instead verify the logic in isolation:
```bash
node -e "
const registry = require('./lib/accountsRegistry');
const p = registry.add({ username: 'test-plan-verify2', server: 's1.example.com', characterName: 'PlanVerifyChar2', nickname: 'PV2' });
// Simulate the exact condition from the new code block:
const data = { characterClass: 'Mage' };
if (data.characterClass && p.characterClass !== data.characterClass) {
  registry.setCharacterClass(p.id, data.characterClass);
}
const reloaded = registry.list().find(x => x.id === p.id);
console.log('persisted:', reloaded.characterClass === 'Mage');
registry.remove(p.id);
"
```
Expected: `persisted: true`.

- [ ] **Step 4: Commit**

```bash
git add routes/gamestate.js
git commit -m "gamestate: persist detected character class to profile"
```

---

### Task 4: Include `characterClass` in `/api/accounts`

**Files:**
- Modify: `server.js:44-53`

**Interfaces:**
- Consumes: `accountsRegistry.list()` (already imported in `server.js:10` as `accountsRegistry`), `accountIdFor` (already imported in `server.js:6`)
- Produces: every object returned by `GET /api/accounts` now has `characterClass: string|null`

- [ ] **Step 1: Join in `characterClass` by matching `accountIdFor`**

Replace `server.js:44-53`:
```javascript
app.get('/api/accounts', async (req, res) => {
  const dataDir = findDataDir();
  const localAccounts = dataDir ? listAccounts(dataDir).map(acc => ({
    ...acc,
    stats: latestSnapshot(dataDir, acc.id),
    currentActivity: logBuffer.getLastActivity(acc.charName),
  })) : [];
  const remoteAccounts = await listRemoteAccounts();
  res.json([...localAccounts, ...remoteAccounts]);
});
```
with:
```javascript
function characterClassFor(accountId) {
  const profile = accountsRegistry.list().find(p =>
    p.server && p.characterName && accountIdFor(p.server, p.characterName) === accountId);
  return profile ? (profile.characterClass || null) : null;
}

app.get('/api/accounts', async (req, res) => {
  const dataDir = findDataDir();
  const localAccounts = dataDir ? listAccounts(dataDir).map(acc => ({
    ...acc,
    stats: latestSnapshot(dataDir, acc.id),
    currentActivity: logBuffer.getLastActivity(acc.charName),
    characterClass: characterClassFor(acc.id),
  })) : [];
  const remoteAccounts = await listRemoteAccounts();
  const remoteAccountsWithClass = remoteAccounts.map(acc => ({ ...acc, characterClass: characterClassFor(acc.id) }));
  res.json([...localAccounts, ...remoteAccountsWithClass]);
});
```

- [ ] **Step 2: Manually verify**

Start the dashboard (from `MercySF_Dashboard`):
```bash
npm install
node server.js
```
In a second terminal, check `/api/accounts` includes the new field (adjust host/port/auth as needed — this project requires a logged-in session cookie via `/login.html`, so the simplest check is code review plus the Task 2 unit check already covering the join logic). At minimum, confirm the server starts without a syntax error:
```bash
node -c server.js && echo "syntax OK"
```
Expected: `syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "api/accounts: include detected characterClass per account"
```

---

### Task 5: `accounts.js` — auto-backfill + manual class detection button

**Files:**
- Modify: `public/pages/accounts.js`

**Interfaces:**
- Consumes: `GET /api/gamestate/:profileId` (existing endpoint, now also persists class as of Task 3), `p.characterClass`, `p.hasPassword` (already returned by `GET /api/profiles`, Task 2 makes `characterClass` flow through automatically since `routes/profiles.js:60-73` spreads `...p`)

- [ ] **Step 1: Add a class badge to `metaLine()`**

Replace `public/pages/accounts.js:229-235`:
```javascript
    function metaLine(p) {
      const nodeBadge = p.nodeId ? `<span class="node-badge">🖧 ${escapeHtml(nodesById.get(p.nodeId)?.name || '?')}</span>` : '';
      if (p.server && p.characterName) {
        return `${escapeHtml(p.username)} · ${escapeHtml(p.characterName)} @ ${escapeHtml(p.server)}${nodeBadge}`;
      }
      return `${escapeHtml(p.username)} · noch nicht eingeloggt${nodeBadge}`;
    }
```
with:
```javascript
    function metaLine(p) {
      const nodeBadge = p.nodeId ? `<span class="node-badge">🖧 ${escapeHtml(nodesById.get(p.nodeId)?.name || '?')}</span>` : '';
      const classBadge = p.characterClass ? `<span class="node-badge">${escapeHtml(p.characterClass)}</span>` : '';
      if (p.server && p.characterName) {
        return `${escapeHtml(p.username)} · ${escapeHtml(p.characterName)} @ ${escapeHtml(p.server)}${classBadge}${nodeBadge}`;
      }
      return `${escapeHtml(p.username)} · noch nicht eingeloggt${nodeBadge}`;
    }
```
(Reusing the existing `.node-badge` CSS class — `public/pages/accounts.js:75` — instead of adding a new style, since it's already the right look: small pill, accent-colored border.)

- [ ] **Step 2: Add the "🔄 Klasse" button to the card actions**

In `public/pages/accounts.js:315-324`, replace:
```javascript
            <div class="profile-actions">
              <button class="btn btn-primary" data-action="start" ${p.status.running ? 'disabled' : ''}>Start</button>
              <button class="btn-secondary" data-action="stop" ${p.status.running ? '' : 'disabled'}>Stop</button>
              <button class="btn-secondary" data-action="pause" ${hasCharacter && !paused ? '' : 'disabled'} title="Schaltet alle Automatisierungen aus (kein garantierter Sofort-Effekt, nur Konfiguration)">${paused ? 'Pausiert' : 'Pause'}</button>
              <button class="btn-secondary" data-action="resume" ${paused ? '' : 'disabled'}>Fortsetzen</button>
              <button class="btn-secondary" data-action="claim" ${hasCharacter && p.hasPassword ? '' : 'disabled'} title="Kalender, Tagesaufgaben und ausstehende Freischaltungen abholen">Einlösen</button>
              <button class="btn-secondary" data-action="toggle-term">Konsole</button>
              <select class="node-select" data-action="move-node" title="Auf einen anderen Node verschieben">${nodeOptionsHtml(p.nodeId)}</select>
              <button class="btn-danger" data-action="delete">Löschen</button>
            </div>
```
with:
```javascript
            <div class="profile-actions">
              <button class="btn btn-primary" data-action="start" ${p.status.running ? 'disabled' : ''}>Start</button>
              <button class="btn-secondary" data-action="stop" ${p.status.running ? '' : 'disabled'}>Stop</button>
              <button class="btn-secondary" data-action="pause" ${hasCharacter && !paused ? '' : 'disabled'} title="Schaltet alle Automatisierungen aus (kein garantierter Sofort-Effekt, nur Konfiguration)">${paused ? 'Pausiert' : 'Pause'}</button>
              <button class="btn-secondary" data-action="resume" ${paused ? '' : 'disabled'}>Fortsetzen</button>
              <button class="btn-secondary" data-action="claim" ${hasCharacter && p.hasPassword ? '' : 'disabled'} title="Kalender, Tagesaufgaben und ausstehende Freischaltungen abholen">Einlösen</button>
              <button class="btn-secondary" data-action="detect-class" ${hasCharacter && p.hasPassword ? '' : 'disabled'} title="Spielklasse abrufen (für die Account-Analyse)">🔄 Klasse</button>
              <button class="btn-secondary" data-action="toggle-term">Konsole</button>
              <select class="node-select" data-action="move-node" title="Auf einen anderen Node verschieben">${nodeOptionsHtml(p.nodeId)}</select>
              <button class="btn-danger" data-action="delete">Löschen</button>
            </div>
```

- [ ] **Step 3: Wire the button's click handler**

In `public/pages/accounts.js`, right after the `claimBtn` block (`public/pages/accounts.js:402-418`), add:
```javascript
        const detectClassBtn = card.querySelector('[data-action="detect-class"]');
        if (detectClassBtn) {
          detectClassBtn.addEventListener('click', async () => {
            const original = detectClassBtn.textContent;
            detectClassBtn.disabled = true;
            detectClassBtn.textContent = 'Erkenne…';
            try {
              await ctx.fetchJSON(`/api/gamestate/${encodeURIComponent(id)}`);
              await loadProfiles();
            } catch (err) {
              detectClassBtn.textContent = original;
              alert('Klassenerkennung fehlgeschlagen: ' + err.message);
            } finally {
              detectClassBtn.disabled = !(hasCharacter && p.hasPassword);
            }
          });
        }
```
Note: `loadProfiles()` re-renders the whole list (it's called elsewhere the same way, e.g. after `start`/`stop`), so there's no need to manually reset `detectClassBtn.textContent` on success — the card is rebuilt from scratch with the fresh badge.

- [ ] **Step 4: Add the background backfill after `loadProfiles()` builds the list**

At the end of `loadProfiles()`, after the `list.querySelectorAll('.profile-card').forEach(...)` block closes (this is the block containing Steps 1-3's handlers, ending around where the function itself ends — find the closing of `loadProfiles` and add just before its final closing brace, i.e. as the last statement inside `async function loadProfiles() { ... }`), add:
```javascript
      backfillMissingClasses(profiles);
```
Then add this new function above `loadProfiles()` (right after the `statusInfo()` function, `public/pages/accounts.js:244`):
```javascript
    // Klasse wird einmalig automatisch ermittelt (sf-api-bridge-Login), nacheinander statt
    // parallel, um nicht mehrere echte Spiele-Logins gleichzeitig auszulösen. Best-effort:
    // Fehler (z. B. Bridge gerade offline) werden ignoriert, die Karte zeigt dann weiterhin
    // keine Klasse an, der manuelle "🔄 Klasse"-Button bleibt als Fallback.
    let backfillRunning = false;
    async function backfillMissingClasses(profiles) {
      if (backfillRunning) return;
      const targets = profiles.filter(p => p.server && p.characterName && p.hasPassword && !p.characterClass);
      if (!targets.length) return;
      backfillRunning = true;
      let any = false;
      for (const p of targets) {
        try {
          await ctx.fetchJSON(`/api/gamestate/${encodeURIComponent(p.id)}`);
          any = true;
        } catch (err) { /* still-offline bridge or login failure — retry next page visit */ }
      }
      backfillRunning = false;
      if (any) await loadProfiles();
    }
```

- [ ] **Step 5: Manually verify**

```bash
node -c public/pages/accounts.js && echo "syntax OK"
```
Expected: `syntax OK`. Full behavioral verification happens in Task 11 (browser check) once the whole feature is wired up.

- [ ] **Step 6: Commit**

```bash
git add public/pages/accounts.js
git commit -m "accounts page: show detected class, backfill + manual retry button"
```

---

### Task 6: Extract `lib/analyticsService.js`, refactor `routes/analytics.js`

**Files:**
- Create: `lib/analyticsService.js`
- Modify: `routes/analytics.js`

**Interfaces:**
- Produces: `ALLOWED_FIELDS: string[]`, `async getAccountSeries(accountId: string, opts?: { bucketMs?: number, maxBuckets?: number }): Promise<{ fields: string[], series: Record<string, {t: string, v: number|null}[]> } | null>` — `null` means "no data dir and no node delegation possible" (caller returns 404); throws (with `.status`) on node delegation failure, mirroring `nodeClient.call`'s existing error shape.

- [ ] **Step 1: Create `lib/analyticsService.js`**

```javascript
const fs = require('fs');
const path = require('path');
const { findDataDir, findProfileByAccountId } = require('./data');
const nodeRegistry = require('./nodeRegistry');
const nodeClient = require('./nodeClient');

const ALLOWED_FIELDS = ['level', 'experience', 'silver', 'mushrooms', 'honor', 'rank', 'armor'];
const DEFAULT_BUCKET_MS = 5 * 60 * 1000; // 5-Minuten-Schritte
const DEFAULT_MAX_BUCKETS = 288; // ~24h bei 5-Minuten-Schritten

// In Zeit-Buckets einsortieren, pro Bucket den letzten (aktuellsten) Snapshot behalten — ergibt
// eine gleichmäßige Zeitachse statt unregelmäßig verteilter Rohdatenpunkte. bucketMs/maxBuckets
// sind parametrisiert (statt der früher hartcodierten 5-Minuten/288-Werte), damit derselbe Code
// auch die 7-Tage/30-Tage-Ansicht der Account-Analyse-Seite mit Tages-Buckets bedienen kann.
function readLocalAccountSeries(dataDir, accountId, bucketMs, maxBuckets) {
  const filePath = path.join(dataDir, 'analytics', `${accountId}.json`);
  if (!fs.existsSync(filePath)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
  const snapshots = data.snapshots || [];
  const buckets = new Map();
  for (const snap of snapshots) {
    const ms = Date.parse(snap.timestamp);
    if (Number.isNaN(ms)) continue;
    const bucketKey = Math.floor(ms / bucketMs) * bucketMs;
    buckets.set(bucketKey, snap);
  }
  const bucketKeys = [...buckets.keys()].sort((a, b) => a - b).slice(-maxBuckets);
  const series = {};
  for (const field of ALLOWED_FIELDS) {
    series[field] = bucketKeys.map(key => ({ t: new Date(key).toISOString(), v: buckets.get(key)[field] }));
  }
  return { fields: ALLOWED_FIELDS, series };
}

async function getAccountSeries(accountId, { bucketMs = DEFAULT_BUCKET_MS, maxBuckets = DEFAULT_MAX_BUCKETS } = {}) {
  const profile = findProfileByAccountId(accountId);
  const node = profile && profile.nodeId ? nodeRegistry.get(profile.nodeId) : null;
  if (node) {
    return nodeClient.call(
      node,
      `/profiles/${encodeURIComponent(profile.id)}/analytics?bucketMs=${bucketMs}&maxBuckets=${maxBuckets}`,
      { timeoutMs: 10000 },
    );
  }
  const dataDir = findDataDir();
  if (!dataDir) return null;
  return readLocalAccountSeries(dataDir, accountId, bucketMs, maxBuckets);
}

module.exports = { ALLOWED_FIELDS, DEFAULT_BUCKET_MS, DEFAULT_MAX_BUCKETS, getAccountSeries };
```

- [ ] **Step 2: Refactor `routes/analytics.js` to use it**

Replace the entire contents of `routes/analytics.js` with:
```javascript
const express = require('express');
const { getAccountSeries } = require('../lib/analyticsService');

const router = express.Router();

router.get('/:accountId', async (req, res) => {
  try {
    const result = await getAccountSeries(req.params.accountId);
    if (!result) return res.status(404).json({ error: 'Keine Analysedaten für diesen Account' });
    res.json(result);
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Manually verify the extracted bucket logic is unchanged**

```bash
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');

// Fake data dir with one analytics file, to exercise readLocalAccountSeries without a real CLI.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mercy-plan-verify-'));
fs.mkdirSync(path.join(tmp, 'analytics'));
const snapshots = [
  { timestamp: '2026-08-09T10:00:00.000Z', level: 10, experience: 100, silver: 5000, mushrooms: 2, honor: 50, rank: 900, armor: 300 },
  { timestamp: '2026-08-09T10:04:00.000Z', level: 10, experience: 150, silver: 5200, mushrooms: 2, honor: 55, rank: 895, armor: 300 },
];
fs.writeFileSync(path.join(tmp, 'analytics', 'test-account.json'), JSON.stringify({ snapshots }));

// Point findDataDir() to our tmp dir by monkeypatching the module before analyticsService loads it.
const dataModule = require('./lib/data');
dataModule.findDataDir = () => tmp;
dataModule.findProfileByAccountId = () => null;

delete require.cache[require.resolve('./lib/analyticsService')];
const svc = require('./lib/analyticsService');
svc.getAccountSeries('test-account', {}).then(result => {
  console.log('fields match:', JSON.stringify(result.fields) === JSON.stringify(['level','experience','silver','mushrooms','honor','rank','armor']));
  console.log('one bucket (both snapshots fall in same 5-min bucket):', result.series.level.length === 1);
  console.log('kept latest snapshot in bucket:', result.series.experience[0].v === 150);
  fs.rmSync(tmp, { recursive: true, force: true });
});
"
```
Expected output:
```
fields match: true
one bucket (both snapshots fall in same 5-min bucket): true
kept latest snapshot in bucket: true
```

- [ ] **Step 4: Commit**

```bash
git add lib/analyticsService.js routes/analytics.js
git commit -m "Extract shared analytics bucket logic into lib/analyticsService"
```

---

### Task 7: node-agent — accept `bucketMs`/`maxBuckets` on `/profiles/:id/analytics`

**Files:**
- Modify: `node-agent/server.js:298-332`

**Interfaces:**
- Produces: `GET /profiles/:id/analytics?bucketMs=<ms>&maxBuckets=<n>` (both optional, defaulting to the previous hardcoded 5-minute/288 behavior — fully backward compatible with the existing dashboard call in `lib/analyticsService.js` Task 6, which omits them when called from `routes/analytics.js`'s single-account path... actually it always passes them now per Task 6 Step 1, both callers pass explicit values, so the defaults only matter for any other caller).

- [ ] **Step 1: Parametrize the bucket size and cap**

Replace `node-agent/server.js:298-332`:
```javascript
const ANALYTICS_FIELDS = ['level', 'experience', 'silver', 'mushrooms', 'honor', 'rank', 'armor'];
const ANALYTICS_BUCKET_MS = 5 * 60 * 1000;
const ANALYTICS_MAX_BUCKETS = 288;

// Gleiche Bucket-Logik wie routes/analytics.js im Dashboard — liest die rohen, von der lokal
// laufenden CLI geschriebenen Snapshots direkt von der Platte, kein Zwischenspeicher nötig.
app.get('/profiles/:id/analytics', (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  if (!profile.server || !profile.characterName) return res.status(400).json({ error: 'Noch kein Charakter für dieses Profil bekannt' });
  const dataDir = findDataDir();
  if (!dataDir) return res.status(404).json({ error: 'Kein Datenverzeichnis gefunden' });
  const filePath = path.join(dataDir, 'analytics', `${accountIdFor(profile.server, profile.characterName)}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Keine Analysedaten für diesen Account' });
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return res.status(500).json({ error: 'Analysedaten konnten nicht gelesen werden' });
  }
  const snapshots = data.snapshots || [];
  const buckets = new Map();
  for (const snap of snapshots) {
    const ms = Date.parse(snap.timestamp);
    if (Number.isNaN(ms)) continue;
    const bucketKey = Math.floor(ms / ANALYTICS_BUCKET_MS) * ANALYTICS_BUCKET_MS;
    buckets.set(bucketKey, snap);
  }
  const bucketKeys = [...buckets.keys()].sort((a, b) => a - b).slice(-ANALYTICS_MAX_BUCKETS);
  const series = {};
  for (const field of ANALYTICS_FIELDS) {
    series[field] = bucketKeys.map(key => ({ t: new Date(key).toISOString(), v: buckets.get(key)[field] }));
  }
  res.json({ fields: ANALYTICS_FIELDS, series });
});
```
with:
```javascript
const ANALYTICS_FIELDS = ['level', 'experience', 'silver', 'mushrooms', 'honor', 'rank', 'armor'];
const ANALYTICS_DEFAULT_BUCKET_MS = 5 * 60 * 1000;
const ANALYTICS_DEFAULT_MAX_BUCKETS = 288;
const ANALYTICS_MIN_BUCKET_MS = 60 * 1000;
const ANALYTICS_MAX_BUCKET_MS = 7 * 24 * 60 * 60 * 1000;
const ANALYTICS_MAX_BUCKETS_CAP = 400;

// Gleiche Bucket-Logik wie lib/analyticsService.js im Dashboard — liest die rohen, von der lokal
// laufenden CLI geschriebenen Snapshots direkt von der Platte, kein Zwischenspeicher nötig.
// bucketMs/maxBuckets sind per Query-Parameter überschreibbar (Standard: unverändertes
// 5-Minuten/24h-Verhalten), damit die Account-Analyse-Seite im Dashboard auch 7-Tage/30-Tage-
// Ansichten für auf diesem Node laufende Accounts anfordern kann.
app.get('/profiles/:id/analytics', (req, res) => {
  const profile = profileStore.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  if (!profile.server || !profile.characterName) return res.status(400).json({ error: 'Noch kein Charakter für dieses Profil bekannt' });
  const dataDir = findDataDir();
  if (!dataDir) return res.status(404).json({ error: 'Kein Datenverzeichnis gefunden' });
  const filePath = path.join(dataDir, 'analytics', `${accountIdFor(profile.server, profile.characterName)}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Keine Analysedaten für diesen Account' });
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return res.status(500).json({ error: 'Analysedaten konnten nicht gelesen werden' });
  }
  const bucketMs = Math.min(Math.max(parseInt(req.query.bucketMs, 10) || ANALYTICS_DEFAULT_BUCKET_MS, ANALYTICS_MIN_BUCKET_MS), ANALYTICS_MAX_BUCKET_MS);
  const maxBuckets = Math.min(Math.max(parseInt(req.query.maxBuckets, 10) || ANALYTICS_DEFAULT_MAX_BUCKETS, 1), ANALYTICS_MAX_BUCKETS_CAP);
  const snapshots = data.snapshots || [];
  const buckets = new Map();
  for (const snap of snapshots) {
    const ms = Date.parse(snap.timestamp);
    if (Number.isNaN(ms)) continue;
    const bucketKey = Math.floor(ms / bucketMs) * bucketMs;
    buckets.set(bucketKey, snap);
  }
  const bucketKeys = [...buckets.keys()].sort((a, b) => a - b).slice(-maxBuckets);
  const series = {};
  for (const field of ANALYTICS_FIELDS) {
    series[field] = bucketKeys.map(key => ({ t: new Date(key).toISOString(), v: buckets.get(key)[field] }));
  }
  res.json({ fields: ANALYTICS_FIELDS, series });
});
```

- [ ] **Step 2: Manually verify**

```bash
node -c node-agent/server.js && echo "syntax OK"
```
Expected: `syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add node-agent/server.js
git commit -m "node-agent: accept bucketMs/maxBuckets on /profiles/:id/analytics"
```

---

### Task 8: `POST /api/analytics-compare` endpoint

**Files:**
- Create: `routes/analytics-compare.js`

**Interfaces:**
- Consumes: `getAccountSeries` + `ALLOWED_FIELDS` from `lib/analyticsService.js` (Task 6), `accountsRegistry.list()`, `accountIdFor` from `lib/data.js`
- Produces (HTTP contract used by Task 9's frontend):
  - Request: `POST /api/analytics-compare` body `{ range: '24h'|'7d'|'30d', series: [{ type: 'account'|'class', id: string, field: string }] }`
  - Response `200`: `{ buckets: string[] /* ISO timestamps, ascending */, series: [{ type: 'account'|'class', targetLabel: string, field: string, values: (number|null)[] /* same length as buckets */ }] }`
  - Response `400`: `{ error: string }` for invalid range/series/field
  - `silver` values are already converted from Silber to Gold (÷100, rounded) in the response — the frontend must not divide again.

- [ ] **Step 1: Create `routes/analytics-compare.js`**

```javascript
const express = require('express');
const registry = require('../lib/accountsRegistry');
const { accountIdFor } = require('../lib/data');
const { getAccountSeries, ALLOWED_FIELDS } = require('../lib/analyticsService');

const router = express.Router();

// 24h nutzt dieselben 5-Minuten-Buckets wie die bestehende Einzel-Account-Analysen-Seite;
// 7d/30d nutzen Tages-Buckets über dieselbe Bucket-Funktion (siehe lib/analyticsService.js) —
// bewusst NICHT über statsDb (dort fehlen mushrooms/armor, siehe lib/statsDb.js Schema),
// sondern über dieselben rohen analytics/*.json-Snapshots wie die 24h-Ansicht, nur mit größeren
// Buckets und einem höheren maxBuckets-Limit.
const RANGE_CONFIG = {
  '24h': { bucketMs: 5 * 60 * 1000, maxBuckets: 288 },
  '7d': { bucketMs: 24 * 60 * 60 * 1000, maxBuckets: 7 },
  '30d': { bucketMs: 24 * 60 * 60 * 1000, maxBuckets: 30 },
};

function toGoldIfSilver(field, v) {
  if (field !== 'silver' || typeof v !== 'number') return v;
  return Math.round(v / 100);
}

// Holt die Zeitreihe eines einzelnen Accounts für ein Feld — best-effort: ein einzelner
// nicht erreichbarer Account (z. B. Node offline) soll nicht die gesamte Vergleichsanfrage
// scheitern lassen, insbesondere bei Klassen-Summen über mehrere Accounts.
async function seriesForAccount(accountId, field, bucketCfg) {
  try {
    const data = await getAccountSeries(accountId, bucketCfg);
    if (!data || !data.series || !data.series[field]) return [];
    return data.series[field].map(p => ({ t: p.t, v: toGoldIfSilver(field, p.v) }));
  } catch (err) {
    return [];
  }
}

router.post('/', express.json(), async (req, res) => {
  const { range, series } = req.body || {};
  const bucketCfg = RANGE_CONFIG[range];
  if (!bucketCfg) return res.status(400).json({ error: 'Ungültiger Zeitraum (erlaubt: 24h, 7d, 30d)' });
  if (!Array.isArray(series) || !series.length) {
    return res.status(400).json({ error: 'Mindestens eine Serie erforderlich' });
  }
  for (const s of series) {
    if (!s || (s.type !== 'account' && s.type !== 'class') || !s.id || !ALLOWED_FIELDS.includes(s.field)) {
      return res.status(400).json({ error: 'Ungültige Serien-Definition' });
    }
  }

  const allProfiles = registry.list();
  const bucketKeySet = new Set();
  const perSeries = [];

  for (const s of series) {
    let points;
    let targetLabel;
    if (s.type === 'account') {
      const profile = allProfiles.find(p => p.server && p.characterName && accountIdFor(p.server, p.characterName) === s.id);
      targetLabel = profile ? profile.nickname : s.id;
      points = await seriesForAccount(s.id, s.field, bucketCfg);
    } else {
      const members = allProfiles.filter(p => p.characterClass === s.id && p.server && p.characterName);
      targetLabel = s.id;
      const memberSeriesList = await Promise.all(
        members.map(p => seriesForAccount(accountIdFor(p.server, p.characterName), s.field, bucketCfg)),
      );
      const sums = new Map();
      for (const memberPoints of memberSeriesList) {
        for (const p of memberPoints) {
          if (typeof p.v !== 'number') continue;
          const key = Date.parse(p.t);
          sums.set(key, (sums.get(key) || 0) + p.v);
        }
      }
      points = [...sums.entries()].sort((a, b) => a[0] - b[0]).map(([ms, v]) => ({ t: new Date(ms).toISOString(), v }));
    }
    points.forEach(p => bucketKeySet.add(Date.parse(p.t)));
    perSeries.push({ type: s.type, targetLabel, field: s.field, points });
  }

  const bucketKeys = [...bucketKeySet].sort((a, b) => a - b);
  const buckets = bucketKeys.map(ms => new Date(ms).toISOString());
  const resultSeries = perSeries.map(({ type, targetLabel, field, points }) => {
    const byKey = new Map(points.map(p => [Date.parse(p.t), p.v]));
    return {
      type,
      targetLabel,
      field,
      values: bucketKeys.map(k => (byKey.has(k) ? byKey.get(k) : null)),
    };
  });

  res.json({ buckets, series: resultSeries });
});

module.exports = router;
```

- [ ] **Step 2: Manually verify request validation and happy path without a running server**

```bash
node -e "
const express = require('express');
const router = require('./routes/analytics-compare');
const app = express();
app.use('/api/analytics-compare', router);
const server = app.listen(0, async () => {
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/api/analytics-compare';

  const badRange = await fetch(base, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ range: 'nope', series: [] }) });
  console.log('bad range -> 400:', badRange.status === 400);

  const noSeries = await fetch(base, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ range: '24h', series: [] }) });
  console.log('empty series -> 400:', noSeries.status === 400);

  const badField = await fetch(base, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ range: '24h', series: [{ type: 'account', id: 'x', field: 'nope' }] }) });
  console.log('bad field -> 400:', badField.status === 400);

  // Unknown account id -> no data anywhere -> empty series but still 200 with empty buckets/values.
  const unknown = await fetch(base, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ range: '24h', series: [{ type: 'account', id: 'does-not-exist', field: 'level' }] }) });
  const unknownBody = await unknown.json();
  console.log('unknown account -> 200 empty:', unknown.status === 200 && unknownBody.buckets.length === 0 && unknownBody.series[0].values.length === 0);

  server.close();
});
"
```
Expected output:
```
bad range -> 400: true
empty series -> 400: true
bad field -> 400: true
unknown account -> 200 empty: true
```
(Node 18+ has global `fetch`; check with `node --version` first — this project's `node-pty`/`better-sqlite3` deps imply a reasonably modern Node is already expected.)

- [ ] **Step 3: Commit**

```bash
git add routes/analytics-compare.js
git commit -m "Add POST /api/analytics-compare endpoint for overlay series"
```

---

### Task 9: `public/pages/analytics-compare.js` — Account-Analyse page

**Files:**
- Create: `public/pages/analytics-compare.js`

**Interfaces:**
- Consumes: `GET /api/accounts` (Task 4, now includes `characterClass`), `POST /api/analytics-compare` (Task 8), `ctx.fetchJSON`, `ctx.injectStyleOnce` from `public/lib` router context (same `ctx` shape used by `public/pages/analytics.js`)

- [ ] **Step 1: Create the page file**

```javascript
function ensureChartJs() {
  if (window.Chart) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/chart.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Chart.js konnte nicht geladen werden'));
    document.head.appendChild(script);
  });
}

function themeVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const FIELD_LABELS = { level: 'Level', silver: 'Gold', honor: 'Ehre', rank: 'Rang', mushrooms: 'Pilze', armor: 'Rüstung', experience: 'Erfahrung' };
const FIELD_KEYS = Object.keys(FIELD_LABELS);
const RANGE_LABELS = { '24h': '24 Std', '7d': '7 Tage', '30d': '30 Tage' };

// Deterministische Farbpalette statt Zufallsfarben, damit Serien beim Neuladen/Ändern stabil
// erkennbar bleiben (Chart.js hat keine eingebaute Kategorie-Palette für Liniendiagramme).
const SERIES_COLORS = [
  '#4f8cff', '#35c98f', '#f0b429', '#ff6b6b', '#a875ff', '#2dd4d4', '#ff9f43', '#e879f9',
];

let nextSeriesUid = 1;

export default {
  id: 'analytics-compare',
  label: 'Account-Analyse',
  icon: '🧬',
  mount(container, ctx) {
    const css = `
      .analytics-compare-page .filter-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; margin-bottom: 12px; }
      .analytics-compare-page .filter-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
      .analytics-compare-page .filter-row label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-right: 4px; }
      .analytics-compare-page select { background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 6px 10px; font-size: 13px; }
      .analytics-compare-page .series-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
      .analytics-compare-page .series-row { display: flex; gap: 8px; align-items: center; background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; flex-wrap: wrap; }
      .analytics-compare-page .series-swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .analytics-compare-page .series-remove { margin-left: auto; background: none; border: none; color: var(--muted); cursor: pointer; font-size: 15px; padding: 2px 6px; }
      .analytics-compare-page .series-remove:hover { color: var(--red); }
      .analytics-compare-page .add-series-btn { padding: 7px 14px; border-radius: 8px; border: 1px dashed var(--border); background: none; color: var(--accent); cursor: pointer; font-size: 13px; }
      .analytics-compare-page .chart-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; }
      .analytics-compare-page canvas { max-height: 420px; }
      .analytics-compare-page .empty-hint { color: var(--muted); font-size: 13px; }
    `;
    ctx.injectStyleOnce('analytics-compare', css);

    const wrap = document.createElement('div');
    wrap.className = 'analytics-compare-page';
    wrap.innerHTML = `
      <h1 class="page-title">Account-Analyse</h1>
      <div class="filter-card">
        <div class="filter-row">
          <label>Zeitraum</label>
          <select id="range-select">
            ${Object.entries(RANGE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
          <label style="margin-left:16px;"><input type="checkbox" id="normalize-toggle"> Werte als Index anzeigen (Start = 100)</label>
        </div>
        <div class="series-list" id="series-list"></div>
        <button class="add-series-btn" id="add-series-btn">+ Serie hinzufügen</button>
      </div>
      <div class="chart-card">
        <canvas id="compare-chart"></canvas>
        <div class="empty-hint" id="compare-empty" hidden>Füge mindestens eine Serie hinzu, um ein Chart zu sehen.</div>
      </div>
    `;
    container.appendChild(wrap);

    let accounts = [];
    let classes = [];
    // Jede Serie: { uid, type: 'account'|'class', targetId, field }
    let seriesDefs = [];
    let chart = null;
    let autoNormalize = false;

    function destroyChart() {
      if (chart) { chart.destroy(); chart = null; }
    }

    function applyChartTheme() {
      if (!chart) return;
      const muted = themeVar('--muted');
      const border = themeVar('--border');
      if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = muted;
      for (const scale of Object.values(chart.options.scales || {})) {
        if (scale.ticks) scale.ticks.color = muted;
        if (scale.grid) scale.grid.color = border;
      }
      chart.update();
    }
    window.addEventListener('mercy-theme-change', applyChartTheme);

    function targetOptionsHtml(type, selected) {
      if (type === 'class') {
        return classes.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
      }
      return accounts.map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${a.charName} (${a.server})</option>`).join('');
    }

    function fieldOptionsHtml(selected) {
      return FIELD_KEYS.map(f => `<option value="${f}" ${f === selected ? 'selected' : ''}>${FIELD_LABELS[f]}</option>`).join('');
    }

    function renderSeriesList() {
      const list = wrap.querySelector('#series-list');
      list.innerHTML = seriesDefs.map((s, idx) => `
        <div class="series-row" data-uid="${s.uid}">
          <span class="series-swatch" style="background:${SERIES_COLORS[idx % SERIES_COLORS.length]}"></span>
          <select data-role="type">
            <option value="account" ${s.type === 'account' ? 'selected' : ''}>Charakter</option>
            <option value="class" ${s.type === 'class' ? 'selected' : ''}>Klasse</option>
          </select>
          <select data-role="target">${targetOptionsHtml(s.type, s.targetId)}</select>
          <select data-role="field">${fieldOptionsHtml(s.field)}</select>
          <button class="series-remove" data-role="remove" title="Serie entfernen">✕</button>
        </div>
      `).join('');

      list.querySelectorAll('.series-row').forEach(row => {
        const uid = Number(row.dataset.uid);
        const def = seriesDefs.find(s => s.uid === uid);
        row.querySelector('[data-role="type"]').addEventListener('change', (ev) => {
          def.type = ev.target.value;
          def.targetId = def.type === 'class' ? (classes[0] || '') : (accounts[0]?.id || '');
          renderSeriesList();
          loadAndRender();
        });
        row.querySelector('[data-role="target"]').addEventListener('change', (ev) => {
          def.targetId = ev.target.value;
          loadAndRender();
        });
        row.querySelector('[data-role="field"]').addEventListener('change', (ev) => {
          def.field = ev.target.value;
          loadAndRender();
        });
        row.querySelector('[data-role="remove"]').addEventListener('click', () => {
          seriesDefs = seriesDefs.filter(s => s.uid !== uid);
          renderSeriesList();
          loadAndRender();
        });
      });
    }

    function addSeries() {
      const type = 'account';
      seriesDefs.push({ uid: nextSeriesUid++, type, targetId: accounts[0]?.id || '', field: 'level' });
      renderSeriesList();
      loadAndRender();
    }
    wrap.querySelector('#add-series-btn').addEventListener('click', addSeries);

    wrap.querySelector('#range-select').addEventListener('change', loadAndRender);
    wrap.querySelector('#normalize-toggle').addEventListener('change', renderChartFromLastResponse);

    let lastResponse = null;

    function normalizeValues(values) {
      const firstReal = values.find(v => typeof v === 'number');
      if (!firstReal) return values.map(() => null);
      return values.map(v => (typeof v === 'number' ? Math.round((v / firstReal) * 10000) / 100 : null));
    }

    function renderChartFromLastResponse() {
      const emptyHint = wrap.querySelector('#compare-empty');
      const canvas = wrap.querySelector('#compare-chart');
      if (!lastResponse || !lastResponse.series.length) {
        destroyChart();
        emptyHint.hidden = false;
        canvas.hidden = true;
        return;
      }
      emptyHint.hidden = true;
      canvas.hidden = false;

      const distinctFields = new Set(lastResponse.series.map(s => s.field));
      const normalizeCheckbox = wrap.querySelector('#normalize-toggle');
      if (distinctFields.size > 1 && !normalizeCheckbox.dataset.userTouched) {
        normalizeCheckbox.checked = true;
      }
      const normalize = normalizeCheckbox.checked;

      destroyChart();
      const labels = lastResponse.buckets.map(t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
      const datasets = lastResponse.series.map((s, idx) => {
        const targetLabel = s.type === 'class' ? `${s.targetLabel} (Σ)` : s.targetLabel;
        const color = SERIES_COLORS[idx % SERIES_COLORS.length];
        return {
          label: `${targetLabel} – ${FIELD_LABELS[s.field]}`,
          data: normalize ? normalizeValues(s.values) : s.values,
          borderColor: color,
          backgroundColor: color + '26',
          tension: 0.2,
          pointRadius: 0,
          spanGaps: true,
        };
      });

      chart = new window.Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: themeVar('--muted') } } },
          scales: {
            x: { ticks: { color: themeVar('--muted') }, grid: { color: themeVar('--border') } },
            y: { ticks: { color: themeVar('--muted') }, grid: { color: themeVar('--border') } },
          },
        },
      });
    }
    wrap.querySelector('#normalize-toggle').addEventListener('change', (ev) => {
      ev.target.dataset.userTouched = '1';
    });

    async function loadAndRender() {
      if (!seriesDefs.length) {
        lastResponse = null;
        renderChartFromLastResponse();
        return;
      }
      await ensureChartJs();
      const range = wrap.querySelector('#range-select').value;
      const body = {
        range,
        series: seriesDefs
          .filter(s => s.targetId)
          .map(s => ({ type: s.type, id: s.targetId, field: s.field })),
      };
      if (!body.series.length) {
        lastResponse = null;
        renderChartFromLastResponse();
        return;
      }
      try {
        lastResponse = await ctx.fetchJSON('/api/analytics-compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        renderChartFromLastResponse();
      } catch (err) {
        const emptyHint = wrap.querySelector('#compare-empty');
        emptyHint.textContent = 'Fehler: ' + err.message;
        emptyHint.hidden = false;
        wrap.querySelector('#compare-chart').hidden = true;
      }
    }

    async function init() {
      accounts = await ctx.fetchJSON('/api/accounts');
      classes = [...new Set(accounts.map(a => a.characterClass).filter(Boolean))].sort();
      if (!seriesDefs.length && accounts.length) {
        addSeries();
      } else {
        renderSeriesList();
        loadAndRender();
      }
    }

    init();

    return () => {
      window.removeEventListener('mercy-theme-change', applyChartTheme);
      destroyChart();
    };
  },
};
```

- [ ] **Step 2: Manually verify**

```bash
node -c public/pages/analytics-compare.js 2>&1 | head -5
```
`node -c` on an ES module file (`import`/`export default`) will fail because this repo has no `"type": "module"` in `package.json` and `.js` pages are loaded via `<script type="module">`/dynamic `import()` in the browser, not via plain `node -c`. Instead, verify syntax with the browser's own module loader in Task 11 (this is exactly how `public/pages/analytics.js` etc. are validated in this codebase already — there's no other check for these files).

Instead, sanity-check with a quick brace/paren balance check:
```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('public/pages/analytics-compare.js', 'utf8');
const open = (src.match(/\{/g) || []).length;
const close = (src.match(/\}/g) || []).length;
console.log('braces balanced:', open === close, open, close);
"
```
Expected: `braces balanced: true <N> <N>`.

- [ ] **Step 3: Commit**

```bash
git add public/pages/analytics-compare.js
git commit -m "Add Account-Analyse overlay page"
```

---

### Task 10: Register the new page in the router/nav

**Files:**
- Modify: `public/router.js:43-50`

**Interfaces:**
- Consumes: nothing new — `PAGES` array entries are just `{id, label, icon}`, matched against `public/pages/<id>.js` by `renderRoute()` (`public/router.js:225`)

- [ ] **Step 1: Add the nav entry**

Replace `public/router.js:43-50`:
```javascript
const PAGES = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'accounts', label: 'Account-Verwaltung', icon: '🗂' },
  { id: 'nodes', label: 'Nodes', icon: '🖧' },
  { id: 'analytics', label: 'Analysen', icon: '📈' },
  { id: 'settings', label: 'Einstellungen', icon: '⚙' },
  { id: 'console', label: 'Konsole', icon: '⌨' },
];
```
with:
```javascript
const PAGES = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'accounts', label: 'Account-Verwaltung', icon: '🗂' },
  { id: 'nodes', label: 'Nodes', icon: '🖧' },
  { id: 'analytics', label: 'Analysen', icon: '📈' },
  { id: 'analytics-compare', label: 'Account-Analyse', icon: '🧬' },
  { id: 'settings', label: 'Einstellungen', icon: '⚙' },
  { id: 'console', label: 'Konsole', icon: '⌨' },
];
```

- [ ] **Step 2: Manually verify**

```bash
node -c public/router.js && echo "syntax OK"
```
Expected: `syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add public/router.js
git commit -m "Register Account-Analyse page in navigation"
```

---

### Task 11: End-to-end browser verification

**Files:** none (verification-only task)

- [ ] **Step 1: Install dependencies and start the dashboard**

```bash
npm install
node server.js
```
Expected: server logs `Mounted route module 'analytics-compare' at /api/analytics-compare` among the other route-mount lines, and starts listening without throwing. If `better-sqlite3` or `node-pty` fail to build/load on this machine (native modules, Windows dev box vs. the project's normal Linux deployment target), note that in your final report — this task's remaining steps then can't run locally and must be verified on the actual deployment server instead.

- [ ] **Step 2: Complete first-run setup / log in**

Open the dashboard in the browser (`preview_start`/`navigate` tools), complete `/setup.html` if this is a fresh `data/` dir, then log in.

- [ ] **Step 3: Verify class detection**

Go to "Account-Verwaltung". For any profile with a stored password and a known character, confirm either a class badge already appears (if backfill fired automatically on page load) or click "🔄 Klasse" and confirm a badge with a class name (e.g. "Warrior") appears after it completes. If no accounts have stored passwords in this environment, skip to Step 4 and note this limitation.

- [ ] **Step 4: Verify the new page**

Click "Account-Analyse" in the nav. Confirm:
- One default series row appears (Charakter / first account / Level).
- Changing the Zeitraum dropdown (24h/7d/30d) reloads the chart without a JS console error.
- Clicking "+ Serie hinzufügen" adds a second row; changing its "Klasse" vs "Charakter" toggle switches the target dropdown's options correctly.
- Selecting two series with different fields (e.g. Level and Gold) auto-checks "Werte als Index anzeigen" and the chart renders two overlaid lines.
- Removing all series shows the "Füge mindestens eine Serie hinzu…" empty state instead of a broken chart.

- [ ] **Step 5: Check the browser console for errors**

Use the browser tool's console-reading capability; confirm no uncaught exceptions were logged while performing Step 4.

- [ ] **Step 6: Report results**

Summarize in your final report: what was verified live vs. what could only be verified via code review (e.g. the Rust build, if `cargo` wasn't available; native module load, if that failed) — this makes the state of the feature clear before merge.
