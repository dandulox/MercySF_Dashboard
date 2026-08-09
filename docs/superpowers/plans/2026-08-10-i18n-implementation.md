# English Translation (DE/EN i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DE/EN language switcher to the MercySF Dashboard, covering the authenticated app (`index.html`, `router.js`, `public/pages/*.js`) and the pre-auth screens (`login.html`, `setup.html`).

**Architecture:** A tiny hand-rolled i18n layer (`public/lib/i18n.js` + `public/lib/i18n/de.js` + `public/lib/i18n/en.js`), all native ES modules (the project already loads `router.js` and `pages/*.js` this way — no bundler, no new dependency). Static HTML uses `data-i18n`/`data-i18n-attr`/`data-i18n-html` attributes applied by `applyTranslations()`; JS-rendered template strings call `t('key')` inline. Language choice persists server-side (authenticated app) via the existing `lib/panelSettings.js` → `data/panel-settings.json` pattern, or via `localStorage` (pre-auth pages, which have no session yet).

**Tech Stack:** Vanilla JS (ES modules, no build step), Express (`routes/panel-settings.js`), no test framework in this repo — verification is `node --input-type=module --check` for syntax plus manual browser click-through (documented per task).

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-10-i18n-design.md`.
- No new npm dependencies. No bundler/build step introduced.
- German strings are the source of truth; wording must be copied verbatim into `de.js` (no rewording during extraction) so the visual diff of German-language screens is zero.
- Every dictionary key added to `de.js` MUST have a matching key in `en.js` in the same task/commit — never leave a task with mismatched key sets.
- `t()` must never throw and must never render as blank text — missing key falls back to German, then to the raw key string.
- Server-generated error strings (thrown from Express routes in `routes/*.js`, e.g. `"Zugangsdaten ungültig"`) are **out of scope** — this plan only translates client-rendered UI text in `public/`. Do not translate `routes/*.js` or `lib/*.js` error messages.
- Syntax check command for every touched client `.js` file (run from `MercySF_Dashboard/`): `node --input-type=module --check < public/<path>.js` — must print no output (exit 0).
- Commit after every task.

---

## File Structure

| File | Responsibility |
|---|---|
| `public/lib/i18n/de.js` | German dictionary (source of truth), flat namespaced keys, ES module default export |
| `public/lib/i18n/en.js` | English dictionary, same key set |
| `public/lib/i18n.js` | `t()`, `getLanguage()`, `setLanguageAuthenticated()`/`setLanguageLocal()`, `initI18nAuthenticated()`/`initI18nLocal()`, `applyTranslations()`, `onLanguageChange()` |
| `lib/panelSettings.js` | + `getLanguage()`/`setLanguage()`, alongside existing preset persistence (also fixes a pre-existing overwrite bug, see Task 3) |
| `routes/panel-settings.js` | GET/POST gain a `language` field |
| `public/index.html` | `data-i18n` attributes + language toggle button in topbar |
| `public/login.html`, `public/setup.html` | `data-i18n` attributes + language toggle button |
| `public/login.js`, `public/setup.js` | dynamic strings → `t()`, localStorage-based language init |
| `public/router.js` | nav labels, status text, confirm dialogs → `t()`; re-render wiring on language change; language toggle button handler |
| `public/pages/*.js` (7 files) | template-string literals → `t()` |
| `public/style.css` | `.lang-toggle-btn` sizing rule |

---

### Task 1: i18n dictionaries (shared/nav/topbar/sidebar/login/setup/console keys)

**Files:**
- Create: `public/lib/i18n/de.js`
- Create: `public/lib/i18n/en.js`

**Interfaces:**
- Produces: `export default { 'namespace.key': 'string', ... }` from both files — consumed by `public/lib/i18n.js` (Task 2) via `import de from './i18n/de.js'` / `import en from './i18n/en.js'`.
- Key namespaces used across this plan: `common.*`, `nav.*`, `topbar.*`, `sidebar.*`, `login.*`, `setup.*`, `router.*`, `console.*`, `analytics.*`, `analyticsCompare.*`, `nodes.*`, `settings.*`, `accounts.*`, `overview.*`. This task populates every namespace except the last six (`analytics` through `overview`), which are populated in Tasks 9–14 by the engineer working that page.

- [ ] **Step 1: Create `public/lib/i18n/de.js`**

```js
export default {
  // common — reused by login.js and setup.js (identical password-toggle/copy-button UI)
  'common.showPassword': 'Passwort anzeigen',
  'common.copied': 'Kopiert ✓',
  'common.copyError': 'Fehler',
  'common.copyBtn': 'Kopieren',
  'common.passwordMismatch': 'Passwörter stimmen nicht überein.',

  // nav — page labels rendered by router.js (Task 7)
  'nav.overview': 'Overview',
  'nav.accounts': 'Account-Verwaltung',
  'nav.nodes': 'Nodes',
  'nav.analytics': 'Analysen',
  'nav.analyticsCompare': 'Account-Analyse',
  'nav.settings': 'Einstellungen',
  'nav.console': 'Konsole',

  // topbar — index.html static parts + router.js dynamic parts
  'topbar.menuTitle': 'Menü',
  'topbar.menuAria': 'Menü öffnen',
  'topbar.loading': 'Lade...',
  'topbar.anonLabel': '🕶 Anonym',
  'topbar.anonTitle': 'Charakternamen verpixeln (z. B. für Screenshots/Streaming)',
  'topbar.themeToggleTitle': 'Hell-/Dunkelmodus umschalten',
  'topbar.langToggleTitle': 'Sprache wechseln',
  'topbar.accessTitle': 'Zugang',
  'topbar.accessBtnTitle': 'Zugang',
  'topbar.currentPassword': 'Aktuelles Passwort',
  'topbar.newPassword': 'Neues Passwort',
  'topbar.passwordChanged': 'Passwort geändert.',
  'topbar.changePasswordBtn': 'Passwort ändern',
  'topbar.logoutBtn': 'Abmelden',
  'topbar.notifTitle': 'Fehler & Warnungen',
  'topbar.notifBtnTitle': 'Fehler & Warnungen',
  'topbar.notifClearBtn': 'Alle gelesen',
  'topbar.refreshTitle': 'Aktualisieren',

  // sidebar — index.html static parts
  'sidebar.brandSub': 'Web-Dashboard',
  'sidebar.accountsTitle': 'ACCOUNTS',
  'sidebar.engineTitle': 'BOT ENGINE',
  'sidebar.engineStatusUnknown': 'UNBEKANNT',
  'sidebar.cliLabel': 'MercySF CLI',
  'sidebar.dashboardLabel': 'Dashboard',
  'sidebar.checking': 'Prüfe…',
  'sidebar.forceCheckTitle': 'Jetzt prüfen',
  'sidebar.footerHtml': 'Dieses Dashboard baut auf der großartigen Arbeit von <a href="https://mercysf.app" target="_blank" rel="noopener">Mercy SF</a> auf. Ausrüstungsdaten laufen über <a href="https://github.com/the-marenga/sf-api" target="_blank" rel="noopener">sf-api</a> von the-marenga.',
  'sidebar.kofi': '☕ Mercy SF auf Ko-fi unterstützen',
  'sidebar.github': 'Quellcode auf GitHub',

  // login.html / login.js
  'login.title': 'Anmelden',
  'login.subtitle': 'Mercy SF Web-Dashboard',
  'login.username': 'Benutzername',
  'login.password': 'Passwort',
  'login.submit': 'Anmelden',
  'login.forgot': 'Zugangsdaten vergessen?',
  'login.resetDivider': 'WIEDERHERSTELLUNG',
  'login.resetIntro': 'Gib deinen 12-Wort-Wiederherstellungsschlüssel ein.',
  'login.newPassword': 'Neues Passwort',
  'login.newPasswordRepeat': 'Neues Passwort wiederholen',
  'login.resetSubmit': 'Passwort zurücksetzen',
  'login.backToLogin': 'Zurück zum Login',
  'login.fillAllWords': 'Bitte alle 12 Wörter ausfüllen.',
  'login.resetDoneTitle': 'Passwort zurückgesetzt',
  'login.resetDoneSubtitle': 'Dein alter Wiederherstellungsschlüssel ist jetzt ungültig.',
  'login.newRecoveryTitle': 'Neuer 12-Wort-Wiederherstellungsschlüssel',
  'login.saveWarning': 'Speichere den neuen Schlüssel jetzt an einem sicheren Ort — er wird nur dieses eine Mal angezeigt.',
  'login.confirmSavedNew': 'Ich habe den neuen Schlüssel sicher gespeichert.',
  'login.continueToLogin': 'Weiter zum Login',

  // setup.html / setup.js
  'setup.title': 'Zugang einrichten',
  'setup.subtitle': 'Noch kein Zugang vorhanden — lege jetzt den einzigen Admin-Zugang für dieses Dashboard an.',
  'setup.username': 'Benutzername',
  'setup.password': 'Passwort',
  'setup.passwordRepeat': 'Passwort wiederholen',
  'setup.submit': 'Zugang anlegen',
  'setup.doneTitle': 'Zugang angelegt',
  'setup.doneSubtitle': 'Speichere beide Schlüssel jetzt an einem sicheren Ort. Sie werden nach dem Verlassen dieser Seite nicht mehr angezeigt.',
  'setup.aesKeyTitle': 'AES-Schlüssel (Bot-Zugangsdaten)',
  'setup.recoveryTitle': '12-Wort-Wiederherstellungsschlüssel',
  'setup.warning': 'Beide Schlüssel lassen sich danach nirgends erneut anzeigen. Der Recovery-Schlüssel setzt bei Verlust dein Passwort zurück — bewahre ihn wie ein echtes Passwort auf.',
  'setup.printBtn': '🖨 Drucken',
  'setup.confirmSaved': 'Ich habe beide Schlüssel sicher gespeichert.',
  'setup.continueToDashboard': 'Weiter zum Dashboard',

  // router.js dynamic text
  'router.noData': 'keine Daten',
  'router.level': 'Level {{level}}',
  'router.noAccounts': 'Keine Accounts',
  'router.selectAccount': 'Account wählen',
  'router.pageLoadError': 'Fehler beim Laden der Seite "{{page}}": {{message}}',
  'router.botRunning': 'LÄUFT',
  'router.botStopped': 'GESTOPPT',
  'router.botActiveStatus': 'Bot-Prozess aktiv',
  'router.botInactiveStatus': 'Kein Bot-Prozess erkannt',
  'router.noDataDir': 'Kein Account-Datenverzeichnis gefunden — noch nicht eingeloggt',
  'router.installing': 'Installiere…',
  'router.updateTo': 'Update auf {{version}}',
  'router.currentVersionTitle': 'Aktuell: {{version}}',
  'router.upToDateWithVersion': 'Up To Date ({{version}})',
  'router.restarting': 'Startet neu…',
  'router.confirmCliUpdate': 'CLI aktualisieren? Laufende Konsolen-Sessions werden neu gestartet, aktive Logins gehen dabei verloren.',
  'router.confirmDashboardUpdate': 'Dashboard aktualisieren? Der Server-Prozess startet dabei neu (git pull + Neubau), die Seite lädt danach automatisch neu.',
  'router.updateFailed': 'Update fehlgeschlagen: {{message}}',
  'router.checkFailed': 'Prüfung fehlgeschlagen: {{message}}',
  'router.notifEmpty': 'Keine Fehler oder Warnungen bisher.',

  // console.js (public/pages/console.js)
  'console.title': 'Konsole',
  'console.intro': 'Globale Standard-Konsole. Für einzelne Accounts siehe <a href="#/accounts">Account-Verwaltung</a>.',
  'console.connecting': 'Verbinde...',
  'console.restartBtn': 'CLI neu starten',
  'console.loadingTerminal': 'Lade Terminal...',
  'console.connected': 'Verbunden — CLI läuft',
  'console.notRunning': 'CLI läuft nicht',
  'console.disconnected': 'Nicht verbunden (WebSocket getrennt)',
  'console.restarting': 'Starte CLI neu...',
  'console.restartFailed': 'Neustart fehlgeschlagen: {{message}}',
  'console.spawnFailed': 'Start fehlgeschlagen ({{time}}): {{message}}',
  'console.exited': 'Beendet ({{time}}), exitCode={{exitCode}}',
  'console.exitedWithSignal': 'Beendet ({{time}}), exitCode={{exitCode}}, signal={{signal}}',
};
```

- [ ] **Step 2: Create `public/lib/i18n/en.js`**

```js
export default {
  'common.showPassword': 'Show password',
  'common.copied': 'Copied ✓',
  'common.copyError': 'Error',
  'common.copyBtn': 'Copy',
  'common.passwordMismatch': "Passwords don't match.",

  'nav.overview': 'Overview',
  'nav.accounts': 'Account Management',
  'nav.nodes': 'Nodes',
  'nav.analytics': 'Analytics',
  'nav.analyticsCompare': 'Account Analysis',
  'nav.settings': 'Settings',
  'nav.console': 'Console',

  'topbar.menuTitle': 'Menu',
  'topbar.menuAria': 'Open menu',
  'topbar.loading': 'Loading...',
  'topbar.anonLabel': '🕶 Anonymous',
  'topbar.anonTitle': 'Pixelate character names (e.g. for screenshots/streaming)',
  'topbar.themeToggleTitle': 'Toggle light/dark mode',
  'topbar.langToggleTitle': 'Switch language',
  'topbar.accessTitle': 'Access',
  'topbar.accessBtnTitle': 'Access',
  'topbar.currentPassword': 'Current password',
  'topbar.newPassword': 'New password',
  'topbar.passwordChanged': 'Password changed.',
  'topbar.changePasswordBtn': 'Change password',
  'topbar.logoutBtn': 'Log out',
  'topbar.notifTitle': 'Errors & warnings',
  'topbar.notifBtnTitle': 'Errors & warnings',
  'topbar.notifClearBtn': 'Mark all read',
  'topbar.refreshTitle': 'Refresh',

  'sidebar.brandSub': 'Web Dashboard',
  'sidebar.accountsTitle': 'ACCOUNTS',
  'sidebar.engineTitle': 'BOT ENGINE',
  'sidebar.engineStatusUnknown': 'UNKNOWN',
  'sidebar.cliLabel': 'MercySF CLI',
  'sidebar.dashboardLabel': 'Dashboard',
  'sidebar.checking': 'Checking…',
  'sidebar.forceCheckTitle': 'Check now',
  'sidebar.footerHtml': 'This dashboard builds on the excellent work of <a href="https://mercysf.app" target="_blank" rel="noopener">Mercy SF</a>. Equipment data runs through <a href="https://github.com/the-marenga/sf-api" target="_blank" rel="noopener">sf-api</a> by the-marenga.',
  'sidebar.kofi': '☕ Support Mercy SF on Ko-fi',
  'sidebar.github': 'View source on GitHub',

  'login.title': 'Sign in',
  'login.subtitle': 'Mercy SF Web Dashboard',
  'login.username': 'Username',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.forgot': 'Forgot your credentials?',
  'login.resetDivider': 'RECOVERY',
  'login.resetIntro': 'Enter your 12-word recovery phrase.',
  'login.newPassword': 'New password',
  'login.newPasswordRepeat': 'Repeat new password',
  'login.resetSubmit': 'Reset password',
  'login.backToLogin': 'Back to login',
  'login.fillAllWords': 'Please fill in all 12 words.',
  'login.resetDoneTitle': 'Password reset',
  'login.resetDoneSubtitle': 'Your old recovery phrase is now invalid.',
  'login.newRecoveryTitle': 'New 12-word recovery phrase',
  'login.saveWarning': "Save the new key somewhere safe now — it's shown only this once.",
  'login.confirmSavedNew': "I've saved the new key securely.",
  'login.continueToLogin': 'Continue to login',

  'setup.title': 'Set up access',
  'setup.subtitle': 'No access set up yet — create the single admin account for this dashboard now.',
  'setup.username': 'Username',
  'setup.password': 'Password',
  'setup.passwordRepeat': 'Repeat password',
  'setup.submit': 'Create access',
  'setup.doneTitle': 'Access created',
  'setup.doneSubtitle': "Save both keys somewhere safe now. They won't be shown again after you leave this page.",
  'setup.aesKeyTitle': 'AES key (bot credentials)',
  'setup.recoveryTitle': '12-word recovery phrase',
  'setup.warning': 'Neither key can be shown again after this. The recovery key resets your password if lost — keep it as safe as a real password.',
  'setup.printBtn': '🖨 Print',
  'setup.confirmSaved': "I've saved both keys securely.",
  'setup.continueToDashboard': 'Continue to dashboard',

  'router.noData': 'no data',
  'router.level': 'Level {{level}}',
  'router.noAccounts': 'No accounts',
  'router.selectAccount': 'Select account',
  'router.pageLoadError': 'Error loading page "{{page}}": {{message}}',
  'router.botRunning': 'RUNNING',
  'router.botStopped': 'STOPPED',
  'router.botActiveStatus': 'Bot process active',
  'router.botInactiveStatus': 'No bot process detected',
  'router.noDataDir': 'No account data directory found — not logged in yet',
  'router.installing': 'Installing…',
  'router.updateTo': 'Update to {{version}}',
  'router.currentVersionTitle': 'Current: {{version}}',
  'router.upToDateWithVersion': 'Up To Date ({{version}})',
  'router.restarting': 'Restarting…',
  'router.confirmCliUpdate': 'Update the CLI? Running console sessions will restart, active logins will be lost.',
  'router.confirmDashboardUpdate': 'Update the dashboard? The server process will restart (git pull + rebuild), the page will reload automatically afterward.',
  'router.updateFailed': 'Update failed: {{message}}',
  'router.checkFailed': 'Check failed: {{message}}',
  'router.notifEmpty': 'No errors or warnings yet.',

  'console.title': 'Console',
  'console.intro': 'Global default console. For individual accounts, see <a href="#/accounts">Account Management</a>.',
  'console.connecting': 'Connecting...',
  'console.restartBtn': 'Restart CLI',
  'console.loadingTerminal': 'Loading terminal...',
  'console.connected': 'Connected — CLI running',
  'console.notRunning': 'CLI not running',
  'console.disconnected': 'Not connected (WebSocket disconnected)',
  'console.restarting': 'Restarting CLI...',
  'console.restartFailed': 'Restart failed: {{message}}',
  'console.spawnFailed': 'Start failed ({{time}}): {{message}}',
  'console.exited': 'Exited ({{time}}), exitCode={{exitCode}}',
  'console.exitedWithSignal': 'Exited ({{time}}), exitCode={{exitCode}}, signal={{signal}}',
};
```

- [ ] **Step 3: Verify both files parse as ES modules**

Run (from `MercySF_Dashboard/`):
```bash
node --input-type=module --check < public/lib/i18n/de.js
node --input-type=module --check < public/lib/i18n/en.js
```
Expected: no output, exit code 0 for both.

- [ ] **Step 4: Verify the key sets match exactly**

Run:
```bash
node -e "
const de = require('fs').readFileSync('public/lib/i18n/de.js','utf8').match(/'([a-zA-Z.]+)':/g).map(s=>s.slice(1,-2));
const en = require('fs').readFileSync('public/lib/i18n/en.js','utf8').match(/'([a-zA-Z.]+)':/g).map(s=>s.slice(1,-2));
const missing = de.filter(k => !en.includes(k));
const extra = en.filter(k => !de.includes(k));
console.log('missing in en:', missing);
console.log('extra in en:', extra);
"
```
Expected: `missing in en: []` and `extra in en: []`.

- [ ] **Step 5: Commit**

```bash
git add public/lib/i18n/de.js public/lib/i18n/en.js
git commit -m "i18n: add DE/EN dictionaries for shared UI, nav, topbar, sidebar, login, setup, console"
```

---

### Task 2: i18n runtime helper

**Files:**
- Create: `public/lib/i18n.js`

**Interfaces:**
- Consumes: `de.js`/`en.js` default exports from Task 1.
- Produces (all consumed by Tasks 4–14):
  - `t(key: string, vars?: Record<string,string|number>): string`
  - `getLanguage(): 'de' | 'en'`
  - `applyTranslations(root?: Element | Document): void`
  - `initI18nAuthenticated(fetchJSON: (url, opts?) => Promise<any>): Promise<void>`
  - `setLanguageAuthenticated(lang: 'de'|'en', fetchJSON): Promise<void>`
  - `initI18nLocal(): void`
  - `setLanguageLocal(lang: 'de'|'en'): void`
  - `onLanguageChange(cb: (lang: 'de'|'en') => void): () => void` (returns unsubscribe)

- [ ] **Step 1: Write `public/lib/i18n.js`**

```js
import de from './i18n/de.js';
import en from './i18n/en.js';

const DICTS = { de, en };
const STORAGE_KEY = 'mercy-lang';

let activeLang = 'de';
const listeners = new Set();

function detectBrowserLang() {
  const raw = (navigator.language || 'de').slice(0, 2).toLowerCase();
  return raw === 'en' ? 'en' : 'de';
}

function interpolate(str, vars) {
  if (!vars) return str;
  return Object.keys(vars).reduce(
    (acc, key) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key])),
    str
  );
}

export function t(key, vars) {
  const dict = DICTS[activeLang] || DICTS.de;
  const raw = dict[key] ?? DICTS.de[key] ?? key;
  return interpolate(raw, vars);
}

export function getLanguage() {
  return activeLang;
}

export function onLanguageChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.getAttribute('data-i18n-attr').split(',').forEach(pair => {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

function applyLang(lang) {
  activeLang = DICTS[lang] ? lang : 'de';
  document.documentElement.setAttribute('lang', activeLang);
  applyTranslations(document);
  listeners.forEach(cb => cb(activeLang));
}

export async function initI18nAuthenticated(fetchJSON) {
  let lang = null;
  try {
    const data = await fetchJSON('/api/panel-settings');
    lang = data.language || null;
  } catch (e) { /* server not reachable yet — fall back below */ }

  if (!lang) {
    lang = localStorage.getItem(STORAGE_KEY) || detectBrowserLang();
    try {
      await fetchJSON('/api/panel-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
    } catch (e) { /* non-fatal — language still applies locally this session */ }
  }
  applyLang(lang);
}

export async function setLanguageAuthenticated(lang, fetchJSON) {
  applyLang(lang);
  await fetchJSON('/api/panel-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: lang }),
  });
}

export function initI18nLocal() {
  const lang = localStorage.getItem(STORAGE_KEY) || detectBrowserLang();
  applyLang(lang);
}

export function setLanguageLocal(lang) {
  localStorage.setItem(STORAGE_KEY, lang);
  applyLang(lang);
}
```

- [ ] **Step 2: Verify it parses**

```bash
node --input-type=module --check < public/lib/i18n.js
```
Expected: no output, exit code 0.

- [ ] **Step 3: Manual smoke check in the browser**

This can't run standalone (it's an ES module with relative imports resolved by the browser), so defer functional verification to Task 4 once `index.html` imports it. This step just confirms no syntax errors block later tasks.

- [ ] **Step 4: Commit**

```bash
git add public/lib/i18n.js
git commit -m "i18n: add t()/applyTranslations() runtime helper"
```

---

### Task 3: Server-side language persistence

**Files:**
- Modify: `lib/panelSettings.js`
- Modify: `routes/panel-settings.js`

**Interfaces:**
- Produces: `panelSettings.getLanguage(): 'de'|'en'|null`, `panelSettings.setLanguage(lang: 'de'|'en'): 'de'|'en'` (throws on invalid input) — consumed by `routes/panel-settings.js` and, via HTTP, by `public/lib/i18n.js` (Task 2).
- `GET /api/panel-settings` response gains `language: 'de'|'en'|null`.
- `POST /api/panel-settings` body gains optional `language`; existing `preset` field behavior is unchanged.

- [ ] **Step 1: Fix the existing overwrite bug and add language support in `lib/panelSettings.js`**

`setPreset` currently calls `writeFile({ gamestatePollPreset: presetKey })`, which replaces the *entire* file content instead of merging — any other key stored in `data/panel-settings.json` (like the `language` this task adds) would be silently wiped out on the next preset change. Fix `setPreset` to read-modify-write, matching the new `setLanguage`.

Replace the whole file:

```js
const fs = require('fs');
const path = require('path');

// Globale (nicht pro Account) Panel-Einstellungen — Abfrage-Intervall für die
// sf-api-Bridge (Ausrüstung/Spielstand) und die UI-Sprache. Bewusst nur vordefinierte
// Intervalle erlaubt statt freier Eingabe, um versehentlich zu aggressive Abfrage-Raten
// (Ban-Risiko) zu vermeiden.
const FILE_PATH = path.join(__dirname, '..', 'data', 'panel-settings.json');

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // bisheriges festes Verhalten

const PRESETS = {
  default: { label: 'Standard (alle 10 Minuten)', ms: DEFAULT_INTERVAL_MS },
  hourly: { label: '1x pro Stunde', ms: 60 * 60 * 1000 },
  daily: { label: '1x pro Tag', ms: 24 * 60 * 60 * 1000 },
};

const LANGUAGES = new Set(['de', 'en']);

function readFile() {
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeFile(data) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

function getPresetKey() {
  const data = readFile();
  return PRESETS[data.gamestatePollPreset] ? data.gamestatePollPreset : 'default';
}

function getIntervalMs() {
  return PRESETS[getPresetKey()].ms;
}

function setPreset(presetKey) {
  if (!PRESETS[presetKey]) {
    throw new Error(`Unbekanntes Intervall-Preset: ${presetKey}`);
  }
  const data = readFile();
  data.gamestatePollPreset = presetKey;
  writeFile(data);
  return presetKey;
}

function getLanguage() {
  const data = readFile();
  return LANGUAGES.has(data.language) ? data.language : null;
}

function setLanguage(lang) {
  if (!LANGUAGES.has(lang)) {
    throw new Error(`Unbekannte Sprache: ${lang}`);
  }
  const data = readFile();
  data.language = lang;
  writeFile(data);
  return lang;
}

module.exports = { PRESETS, getPresetKey, getIntervalMs, setPreset, getLanguage, setLanguage };
```

- [ ] **Step 2: Update `routes/panel-settings.js`**

Replace the whole file:

```js
const express = require('express');
const panelSettings = require('../lib/panelSettings');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    current: panelSettings.getPresetKey(),
    presets: Object.entries(panelSettings.PRESETS).map(([key, p]) => ({ key, label: p.label, ms: p.ms })),
    language: panelSettings.getLanguage(),
  });
});

router.post('/', express.json(), (req, res) => {
  const { preset, language } = req.body || {};
  try {
    const result = { ok: true };
    if (preset !== undefined) result.current = panelSettings.setPreset(preset);
    if (language !== undefined) result.language = panelSettings.setLanguage(language);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Verify syntax**

```bash
node --check lib/panelSettings.js
node --check routes/panel-settings.js
```
Expected: no output, exit code 0 (these are CommonJS/server files, so plain `node --check` applies, unlike the client `.js` files).

- [ ] **Step 4: Manual verification against the running server**

```bash
npm start
```
In another terminal:
```bash
curl -s http://localhost:3000/api/panel-settings
```
(Adjust host/port to whatever `server.js`/`deployment-notes.md` specify if different from 3000 — check `server.js` for the actual listen port before running this.) Confirm the JSON response includes `"language"` (likely `null` on a fresh install) alongside the existing `current`/`presets`. Stop the server (`Ctrl+C`) when done — this is a manual check, not something to leave running.

- [ ] **Step 5: Commit**

```bash
git add lib/panelSettings.js routes/panel-settings.js
git commit -m "feat: persist UI language in panel-settings, fix preset-write clobbering other keys"
```

---

### Task 4: `index.html` — static translations + language toggle

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`

**Interfaces:**
- Consumes: `data-i18n`/`data-i18n-attr`/`data-i18n-html` attributes processed by `applyTranslations()` (Task 2); `#lang-toggle-btn` wired in Task 7 (`router.js`), matching the existing `#theme-toggle-btn` pattern already in that file.

- [ ] **Step 1: Add `data-i18n*` attributes to `public/index.html`**

Apply these edits (German text stays as the literal fallback content — unchanged wording, just attributes added):

```html
<!-- brand-sub -->
<div class="brand-sub" data-i18n="sidebar.brandSub">Web-Dashboard</div>

<!-- accounts list title -->
<div class="accounts-list-title" data-i18n="sidebar.accountsTitle">ACCOUNTS <span id="accounts-count"></span></div>
```
Note: `sidebar.accountsTitle` is `textContent`-only in the dictionary ("ACCOUNTS") — but the live element also contains the `<span id="accounts-count">` sibling used by `router.js`. Setting `textContent` via `data-i18n` would destroy that span. Instead, leave the `<span>` out of the translated element: wrap only the static label.

```html
<div class="accounts-list-title"><span data-i18n="sidebar.accountsTitle">ACCOUNTS</span> <span id="accounts-count"></span></div>
```

```html
<!-- engine box -->
<span data-i18n="sidebar.engineTitle">BOT ENGINE</span>
<span id="engine-status" class="pill pill-off" data-i18n="sidebar.engineStatusUnknown">UNBEKANNT</span>
...
<div class="engine-version-label" data-i18n="sidebar.cliLabel">MercySF CLI</div>
<span id="cli-version-pill" class="pill pill-off" data-i18n="sidebar.checking">Prüfe…</span>
<button class="icon-btn-tiny" id="cli-force-check-btn" data-i18n-attr="title:sidebar.forceCheckTitle" title="Jetzt prüfen">⟳</button>
...
<div class="engine-version-label" data-i18n="sidebar.dashboardLabel">Dashboard</div>
<span id="dashboard-version-pill" class="pill pill-off" data-i18n="sidebar.checking">Prüfe…</span>
<button class="icon-btn-tiny" id="dashboard-force-check-btn" data-i18n-attr="title:sidebar.forceCheckTitle" title="Jetzt prüfen">⟳</button>

<!-- sidebar footer -->
<div class="sidebar-footer-text" data-i18n-html="sidebar.footerHtml">
  Dieses Dashboard baut auf der großartigen Arbeit von
  <a href="https://mercysf.app" target="_blank" rel="noopener">Mercy SF</a> auf.
  Ausrüstungsdaten laufen über
  <a href="https://github.com/the-marenga/sf-api" target="_blank" rel="noopener">sf-api</a> von the-marenga.
</div>
<a class="sidebar-footer-kofi" href="https://ko-fi.com/senseiissei" target="_blank" rel="noopener" data-i18n="sidebar.kofi">☕ Mercy SF auf Ko-fi unterstützen</a>
<a class="sidebar-footer-github" href="https://github.com/dandulox/MercySF_Dashboard" target="_blank" rel="noopener">
  <svg role="img" viewBox="0 0 24 24" aria-hidden="true">...</svg>
  <span data-i18n="sidebar.github">Quellcode auf GitHub</span>
</a>
```
Note: the GitHub link's text was a bare text node after the `<svg>`; wrap it in `<span data-i18n="sidebar.github">` so `applyTranslations` can target it without touching the `<svg>` sibling.

```html
<!-- topbar -->
<button class="icon-btn sidebar-toggle-btn" id="sidebar-toggle-btn" data-i18n-attr="title:topbar.menuTitle,aria-label:topbar.menuAria" title="Menü" aria-label="Menü öffnen">☰</button>
...
<span class="char-name" id="account-dropdown-label" data-i18n="topbar.loading">Lade...</span>
...
<div class="status-chip" id="global-status" data-i18n="topbar.loading">Lade...</div>
<div class="topbar-right">
  <label class="anon-toggle" data-i18n-attr="title:topbar.anonTitle" title="Charakternamen verpixeln (z. B. für Screenshots/Streaming)">
    <span data-i18n="topbar.anonLabel">🕶 Anonym</span>
    <span class="switch">
      <input type="checkbox" id="anon-toggle-input" />
      <span class="switch-track"><span class="switch-thumb"></span></span>
    </span>
  </label>
  <button class="icon-btn lang-toggle-btn" id="lang-toggle-btn" data-i18n-attr="title:topbar.langToggleTitle" title="Sprache wechseln">DE</button>
  <button class="icon-btn" id="theme-toggle-btn" data-i18n-attr="title:topbar.themeToggleTitle" title="Hell-/Dunkelmodus umschalten">🌙</button>
  <div class="notif-dropdown" id="access-dropdown">
    <button class="icon-btn" id="access-btn" data-i18n-attr="title:topbar.accessBtnTitle" title="Zugang">🔐</button>
    <div class="notif-panel" id="access-panel" hidden style="width:260px;">
      <div class="notif-panel-header"><span data-i18n="topbar.accessTitle">Zugang</span></div>
      <div style="padding:14px;">
        <form id="change-password-form">
          <label data-i18n="topbar.currentPassword" style="display:block;font-size:12px;color:var(--muted);margin:8px 0 4px;">Aktuelles Passwort</label>
          <input type="password" id="cp-current" required style="width:100%;box-sizing:border-box;background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;" />
          <label data-i18n="topbar.newPassword" style="display:block;font-size:12px;color:var(--muted);margin:8px 0 4px;">Neues Passwort</label>
          <input type="password" id="cp-new" required minlength="8" style="width:100%;box-sizing:border-box;background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;" />
          <div id="cp-error" style="color:var(--red);font-size:12px;margin-top:6px;" hidden></div>
          <div id="cp-success" data-i18n="topbar.passwordChanged" style="color:var(--green);font-size:12px;margin-top:6px;" hidden>Passwort geändert.</div>
          <button type="submit" class="btn btn-primary" data-i18n="topbar.changePasswordBtn" style="width:100%;margin-top:10px;">Passwort ändern</button>
        </form>
        <button type="button" id="logout-btn" class="btn" data-i18n="topbar.logoutBtn" style="width:100%;margin-top:10px;">Abmelden</button>
      </div>
    </div>
  </div>
  <div class="notif-dropdown" id="notif-dropdown">
    <button class="icon-btn" id="notif-btn" data-i18n-attr="title:topbar.notifBtnTitle" title="Fehler & Warnungen">
      🔔<span class="notif-badge" id="notif-badge" hidden>0</span>
    </button>
    <div class="notif-panel" id="notif-panel" hidden>
      <div class="notif-panel-header">
        <span data-i18n="topbar.notifTitle">Fehler & Warnungen</span>
        <button class="notif-clear-btn" id="notif-clear-btn" data-i18n="topbar.notifClearBtn">Alle gelesen</button>
      </div>
      <div class="notif-panel-list" id="notif-panel-list"></div>
    </div>
  </div>
  <button class="icon-btn" id="refresh-btn" data-i18n-attr="title:topbar.refreshTitle" title="Aktualisieren">⟳</button>
</div>
```

Also add the `i18n.js` import and init call right before the router import at the bottom of `<body>`:

```html
<script type="module">
  import { initI18nAuthenticated } from '/lib/i18n.js';
  async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  }
  await initI18nAuthenticated(fetchJSON);
</script>
<script type="module" src="/router.js"></script>
```

- [ ] **Step 2: Add `.lang-toggle-btn` sizing to `public/style.css`**

Add near the existing `.icon-btn` rule (`public/style.css:284`):

```css
.lang-toggle-btn {
  width: auto;
  padding: 0 8px;
  font-weight: 700;
  font-size: 11px;
}
```

- [ ] **Step 3: Verify `index.html` is well-formed and the inline script parses**

```bash
node --input-type=module --check < public/style.css 2>/dev/null; echo "(css has no JS syntax to check, skip)"
```
Instead, manually confirm no unclosed tags by loading the page (Step 4).

- [ ] **Step 4: Manual browser check**

Start the dashboard (`npm start`), open `index.html` in a browser, open devtools console — confirm no errors from the inline module script or `i18n.js`. The language toggle button won't do anything yet (wired in Task 7) but should render with text `DE`.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css
git commit -m "i18n: wire data-i18n attributes and language init into index.html"
```

---

### Task 5: `login.html` + `login.js`

**Files:**
- Modify: `public/login.html`
- Modify: `public/login.js`

**Interfaces:**
- Consumes: `t`, `applyTranslations`, `initI18nLocal`, `setLanguageLocal`, `getLanguage`, `onLanguageChange` from `public/lib/i18n.js` (Task 2).

- [ ] **Step 1: Add `data-i18n*` attributes to `public/login.html`**

```html
<div class="auth-card" id="card">
  <div class="auth-header">
    <div class="auth-icon">⚔</div>
    <div>
      <h1 class="auth-title" data-i18n="login.title">Anmelden</h1>
      <p class="auth-subtitle" data-i18n="login.subtitle">Mercy SF Web-Dashboard</p>
    </div>
  </div>
  <form id="login-form">
    <div class="field">
      <label for="username" data-i18n="login.username">Benutzername</label>
      <input type="text" id="username" required autocomplete="username" />
    </div>
    <div class="field">
      <label for="password" data-i18n="login.password">Passwort</label>
      <input type="password" id="password" required autocomplete="current-password" />
    </div>
    <div id="login-error" class="error-text" hidden></div>
    <button type="submit" class="btn-primary-lg" data-i18n="login.submit">Anmelden</button>
  </form>
  <button type="button" class="link-btn" id="forgot-btn" data-i18n="login.forgot">Zugangsdaten vergessen?</button>

  <form id="reset-form" hidden>
    <div class="divider" data-i18n="login.resetDivider">WIEDERHERSTELLUNG</div>
    <p class="muted" data-i18n="login.resetIntro">Gib deinen 12-Wort-Wiederherstellungsschlüssel ein.</p>
    <div class="word-grid" id="word-grid"></div>
    <div class="field" style="margin-top:16px;">
      <label for="new-password" data-i18n="login.newPassword">Neues Passwort</label>
      <input type="password" id="new-password" required minlength="8" autocomplete="new-password" />
    </div>
    <div class="field">
      <label for="new-password2" data-i18n="login.newPasswordRepeat">Neues Passwort wiederholen</label>
      <input type="password" id="new-password2" required minlength="8" autocomplete="new-password" />
    </div>
    <div id="reset-error" class="error-text" hidden></div>
    <button type="submit" class="btn-primary-lg" data-i18n="login.resetSubmit">Passwort zurücksetzen</button>
    <button type="button" class="link-btn" id="back-to-login-btn" data-i18n="login.backToLogin">Zurück zum Login</button>
  </form>
  <button type="button" class="icon-btn lang-toggle-btn" id="lang-toggle-btn" style="position:absolute;top:14px;right:14px;">DE</button>
</div>
```

Note: `.auth-card` already has `position: relative` (see `public/login.html:31-41`), so the absolutely-positioned toggle button anchors correctly inside it.

- [ ] **Step 2: Update `public/login.js`** — add i18n import, translate dynamic strings, wire the toggle

Replace the whole file:

```js
import { t, applyTranslations, initI18nLocal, setLanguageLocal, getLanguage, onLanguageChange } from '/lib/i18n.js';

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { const body = await res.json(); if (body.error) msg = body.error; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function addPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.toggled) return;
    input.dataset.toggled = '1';
    const wrap = document.createElement('div');
    wrap.className = 'password-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'password-toggle';
    btn.textContent = '👁';
    btn.setAttribute('aria-label', t('common.showPassword'));
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁';
    });
    wrap.appendChild(btn);
  });
}

function initCopyButtons(root = document) {
  root.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetEl = document.getElementById(btn.dataset.copyTarget);
      if (!targetEl) return;
      try {
        await navigator.clipboard.writeText(targetEl.textContent);
        const original = btn.textContent;
        btn.textContent = t('common.copied');
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1800);
      } catch (e) {
        btn.textContent = t('common.copyError');
      }
    });
  });
}

function initLangToggle() {
  const btn = document.getElementById('lang-toggle-btn');
  if (!btn) return;
  const apply = (lang) => { btn.textContent = lang === 'de' ? 'EN' : 'DE'; };
  apply(getLanguage());
  onLanguageChange(apply);
  btn.addEventListener('click', () => {
    setLanguageLocal(getLanguage() === 'de' ? 'en' : 'de');
  });
}

async function init() {
  initI18nLocal();
  initLangToggle();
  const status = await fetchJSON('/api/auth/status');
  if (!status.hasAccess) {
    location.href = '/setup.html';
    return;
  }
  document.getElementById('login-form').addEventListener('submit', onLogin);
  document.getElementById('forgot-btn').addEventListener('click', showResetForm);
  document.getElementById('back-to-login-btn').addEventListener('click', showLoginForm);
  document.getElementById('reset-form').addEventListener('submit', onReset);
  buildWordGrid();
  addPasswordToggles();
}

function buildWordGrid() {
  const grid = document.getElementById('word-grid');
  grid.innerHTML = '';
  for (let i = 1; i <= 12; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'word-input-wrap';
    const badge = document.createElement('span');
    badge.className = 'word-index';
    badge.textContent = i;
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    wrap.appendChild(badge);
    wrap.appendChild(input);
    grid.appendChild(wrap);
  }
}

function showResetForm() {
  document.getElementById('login-form').hidden = true;
  document.getElementById('forgot-btn').hidden = true;
  document.getElementById('reset-form').hidden = false;
}

function showLoginForm() {
  document.getElementById('reset-form').hidden = true;
  document.getElementById('login-form').hidden = false;
  document.getElementById('forgot-btn').hidden = false;
}

async function onLogin(ev) {
  ev.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.hidden = true;
  try {
    await fetchJSON('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    // Carry a pre-auth language choice into the authenticated app if the server has none yet.
    try {
      const settings = await fetchJSON('/api/panel-settings');
      if (!settings.language) {
        await fetchJSON('/api/panel-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: getLanguage() }),
        });
      }
    } catch (e) { /* non-fatal — sync attempt only */ }
    location.href = '/';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function onReset(ev) {
  ev.preventDefault();
  const inputs = [...document.querySelectorAll('#word-grid input')];
  const recoveryPhrase = inputs.map(i => i.value.trim().toLowerCase());
  const newPassword = document.getElementById('new-password').value;
  const newPassword2 = document.getElementById('new-password2').value;
  const errorEl = document.getElementById('reset-error');
  errorEl.hidden = true;

  if (recoveryPhrase.some(w => !w)) {
    errorEl.textContent = t('login.fillAllWords');
    errorEl.hidden = false;
    return;
  }
  if (newPassword !== newPassword2) {
    errorEl.textContent = t('common.passwordMismatch');
    errorEl.hidden = false;
    return;
  }

  try {
    const result = await fetchJSON('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryPhrase, newPassword }),
    });
    showNewRecoveryPhrase(result.recoveryPhrase);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function showNewRecoveryPhrase(recoveryPhrase) {
  const card = document.getElementById('card');
  const wordGridHtml = recoveryPhrase.map((w, i) =>
    `<div class="word-chip"><span class="word-index">${i + 1}</span>${escapeHtml(w)}</div>`
  ).join('');

  card.innerHTML = `
    <div class="auth-header">
      <div class="auth-icon">🔑</div>
      <div>
        <h1 class="auth-title">${t('login.resetDoneTitle')}</h1>
        <p class="auth-subtitle">${t('login.resetDoneSubtitle')}</p>
      </div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>${t('login.newRecoveryTitle')}</h3>
        <button type="button" class="copy-btn" data-copy-target="recovery-phrase-plain">${t('common.copyBtn')}</button>
      </div>
      <div class="word-grid" style="grid-template-columns:repeat(3,1fr);">${wordGridHtml}</div>
      <div id="recovery-phrase-plain" style="display:none;">${escapeHtml(recoveryPhrase.join(' '))}</div>
    </div>

    <div class="warning-banner">
      <span class="icon">⚠️</span>
      <span>${t('login.saveWarning')}</span>
    </div>

    <div class="confirm-row">
      <input type="checkbox" id="confirm-saved" />
      <label for="confirm-saved">${t('login.confirmSavedNew')}</label>
    </div>
    <button type="button" class="btn-primary-lg" id="continue-btn" disabled style="margin-top:14px;">${t('login.continueToLogin')}</button>
  `;

  document.getElementById('confirm-saved').addEventListener('change', (ev) => {
    document.getElementById('continue-btn').disabled = !ev.target.checked;
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    location.href = '/login.html';
  });
  initCopyButtons(card);
}

init();
```

- [ ] **Step 3: Verify syntax**

```bash
node --input-type=module --check < public/login.js
```
Expected: no output, exit code 0.

- [ ] **Step 4: Manual browser check**

Load `/login.html`. Confirm: page renders in German by default (or English if the browser's language is English and no `mercy-lang` is stored yet), clicking the `DE`/`EN` button in the top-right of the card flips all visible text including the recovery-phrase flow (trigger via "Zugangsdaten vergessen?" / "Forgot your credentials?"), and the choice survives a page reload (stored in `localStorage['mercy-lang']`).

- [ ] **Step 5: Commit**

```bash
git add public/login.html public/login.js
git commit -m "i18n: translate login page, add local language toggle"
```

---

### Task 6: `setup.html` + `setup.js`

**Files:**
- Modify: `public/setup.html`
- Modify: `public/setup.js`

**Interfaces:**
- Consumes: same `public/lib/i18n.js` exports as Task 5.

- [ ] **Step 1: Add `data-i18n*` attributes to `public/setup.html`**

```html
<div class="auth-card" id="card">
  <div class="auth-header">
    <div class="auth-icon">⚔</div>
    <div>
      <h1 class="auth-title" data-i18n="setup.title">Zugang einrichten</h1>
      <p class="auth-subtitle" data-i18n="setup.subtitle">Noch kein Zugang vorhanden — lege jetzt den einzigen Admin-Zugang für dieses Dashboard an.</p>
    </div>
  </div>
  <form id="setup-form">
    <div class="field">
      <label for="username" data-i18n="setup.username">Benutzername</label>
      <input type="text" id="username" required autocomplete="username" />
    </div>
    <div class="field">
      <label for="password" data-i18n="setup.password">Passwort</label>
      <input type="password" id="password" required minlength="8" autocomplete="new-password" />
    </div>
    <div class="field">
      <label for="password2" data-i18n="setup.passwordRepeat">Passwort wiederholen</label>
      <input type="password" id="password2" required minlength="8" autocomplete="new-password" />
    </div>
    <div id="setup-error" class="error-text" hidden></div>
    <button type="submit" class="btn-primary-lg" data-i18n="setup.submit">Zugang anlegen</button>
  </form>
  <button type="button" class="icon-btn lang-toggle-btn" id="lang-toggle-btn" style="position:absolute;top:14px;right:14px;">DE</button>
</div>
```

- [ ] **Step 2: Update `public/setup.js`**

Replace the whole file:

```js
import { t, initI18nLocal, setLanguageLocal, getLanguage, onLanguageChange } from '/lib/i18n.js';

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { const body = await res.json(); if (body.error) msg = body.error; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function addPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.toggled) return;
    input.dataset.toggled = '1';
    const wrap = document.createElement('div');
    wrap.className = 'password-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'password-toggle';
    btn.textContent = '👁';
    btn.setAttribute('aria-label', t('common.showPassword'));
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁';
    });
    wrap.appendChild(btn);
  });
}

function initCopyButtons(root = document) {
  root.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetEl = document.getElementById(btn.dataset.copyTarget);
      if (!targetEl) return;
      try {
        await navigator.clipboard.writeText(targetEl.textContent);
        const original = btn.textContent;
        btn.textContent = t('common.copied');
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1800);
      } catch (e) {
        btn.textContent = t('common.copyError');
      }
    });
  });
}

function initLangToggle() {
  const btn = document.getElementById('lang-toggle-btn');
  if (!btn) return;
  const apply = (lang) => { btn.textContent = lang === 'de' ? 'EN' : 'DE'; };
  apply(getLanguage());
  onLanguageChange(apply);
  btn.addEventListener('click', () => {
    setLanguageLocal(getLanguage() === 'de' ? 'en' : 'de');
  });
}

async function init() {
  initI18nLocal();
  initLangToggle();
  const status = await fetchJSON('/api/auth/status');
  if (status.hasAccess) {
    location.href = '/login.html';
    return;
  }
  document.getElementById('setup-form').addEventListener('submit', onSubmit);
  addPasswordToggles();
}

async function onSubmit(ev) {
  ev.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;
  const errorEl = document.getElementById('setup-error');
  errorEl.hidden = true;

  if (password !== password2) {
    errorEl.textContent = t('common.passwordMismatch');
    errorEl.hidden = false;
    return;
  }

  try {
    const result = await fetchJSON('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    showSecrets(result.aesKey, result.recoveryPhrase);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function showSecrets(aesKey, recoveryPhrase) {
  const card = document.getElementById('card');
  const wordGridHtml = recoveryPhrase.map((w, i) =>
    `<div class="word-chip"><span class="word-index">${i + 1}</span>${escapeHtml(w)}</div>`
  ).join('');

  card.innerHTML = `
    <div class="auth-header">
      <div class="auth-icon">🔑</div>
      <div>
        <h1 class="auth-title">${t('setup.doneTitle')}</h1>
        <p class="auth-subtitle">${t('setup.doneSubtitle')}</p>
      </div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>${t('setup.aesKeyTitle')}</h3>
        <button type="button" class="copy-btn" data-copy-target="aes-key">${t('common.copyBtn')}</button>
      </div>
      <div class="secret-value" id="aes-key">${escapeHtml(aesKey)}</div>
    </div>

    <div class="secret-block">
      <div class="secret-block-header">
        <h3>${t('setup.recoveryTitle')}</h3>
        <button type="button" class="copy-btn" data-copy-target="recovery-phrase-plain">${t('common.copyBtn')}</button>
      </div>
      <div class="word-grid">${wordGridHtml}</div>
      <div id="recovery-phrase-plain" style="display:none;">${escapeHtml(recoveryPhrase.join(' '))}</div>
    </div>

    <div class="warning-banner no-print">
      <span class="icon">⚠️</span>
      <span>${t('setup.warning')}</span>
    </div>

    <button type="button" class="btn-secondary no-print" id="print-btn">${t('setup.printBtn')}</button>

    <div class="confirm-row no-print">
      <input type="checkbox" id="confirm-saved" />
      <label for="confirm-saved">${t('setup.confirmSaved')}</label>
    </div>
    <button type="button" class="btn-primary-lg no-print" id="continue-btn" disabled style="margin-top:14px;">${t('setup.continueToDashboard')}</button>
  `;

  document.getElementById('print-btn').addEventListener('click', () => window.print());
  document.getElementById('confirm-saved').addEventListener('change', (ev) => {
    document.getElementById('continue-btn').disabled = !ev.target.checked;
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    location.href = '/';
  });
  initCopyButtons(card);
}

init();
```

- [ ] **Step 3: Verify syntax**

```bash
node --input-type=module --check < public/setup.js
```
Expected: no output, exit code 0.

- [ ] **Step 4: Manual browser check**

On a fresh install (no `data/` auth store yet — or temporarily rename it aside if one already exists, then restore it after testing), load `/setup.html`, confirm both languages render correctly including the post-submit secrets screen, and that print (`🖨 Drucken`/`🖨 Print`) still works.

- [ ] **Step 5: Commit**

```bash
git add public/setup.html public/setup.js
git commit -m "i18n: translate setup page, add local language toggle"
```

---

### Task 7: `router.js` — nav, status text, confirm dialogs, language toggle wiring

**Files:**
- Modify: `public/router.js`

**Interfaces:**
- Consumes: `t`, `getLanguage`, `setLanguageAuthenticated`, `onLanguageChange` from `public/lib/i18n.js`.
- Produces: re-render-on-language-change behavior that Tasks 9–14's pages rely on implicitly (each page's `mount()` is re-invoked by `renderRoute()`, so a page module that uses `t()` in its template strings translates itself automatically — no extra work needed in those files beyond using `t()`).

This task also splits `loadStatus`/`loadCliUpdateStatus`/`loadDashboardUpdateStatus` into fetch+render halves, so a language change can re-render the last-known status without a network round-trip.

- [ ] **Step 1: Add the import at the top of `public/router.js`**

```js
import { t, getLanguage, setLanguageAuthenticated, onLanguageChange } from '/lib/i18n.js';
```

- [ ] **Step 2: Translate `PAGES` labels**

Replace:
```js
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
With:
```js
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

- [ ] **Step 3: Translate `fmtLevel`, `renderSidebarAccounts`, `renderTopbarAccountSelect`, `renderNav`**

Replace:
```js
function fmtLevel(acc) {
  return acc.stats ? `Level ${acc.stats.level}` : 'keine Daten';
}
```
With:
```js
function fmtLevel(acc) {
  return acc.stats ? t('router.level', { level: acc.stats.level }) : t('router.noData');
}
```

Replace (in `renderTopbarAccountSelect`):
```js
  label.textContent = current ? `${current.charName} (${current.server})` : (state.accounts.length ? 'Account wählen' : 'Keine Accounts');
```
With:
```js
  label.textContent = current ? `${current.charName} (${current.server})` : (state.accounts.length ? t('router.selectAccount') : t('router.noAccounts'));
```

Replace `renderNav`:
```js
function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = PAGES.map(p =>
    `<a class="nav-item" data-page="${p.id}" href="#/${p.id}"><span>${p.icon}</span> ${p.label}</a>`
  ).join('');
}
```
With:
```js
function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = PAGES.map(p =>
    `<a class="nav-item" data-page="${p.id}" href="#/${p.id}"><span>${p.icon}</span> ${t(p.labelKey)}</a>`
  ).join('');
}
```

- [ ] **Step 4: Translate the page-load error in `renderRoute`**

Replace:
```js
  } catch (err) {
    root.innerHTML = `<div class="card"><p>Fehler beim Laden der Seite "${pageMeta.id}": ${err.message}</p></div>`;
  }
```
With:
```js
  } catch (err) {
    root.innerHTML = `<div class="card"><p>${t('router.pageLoadError', { page: pageMeta.id, message: err.message })}</p></div>`;
  }
```

- [ ] **Step 5: Split `loadStatus` into fetch+render, translate the render half**

Replace the whole function:
```js
async function loadStatus() {
  const status = await fetchJSON('/api/status');
  const chip = document.getElementById('engine-status');
  const globalStatus = document.getElementById('global-status');
  const versionEl = document.getElementById('footer-version');
  if (versionEl && status.version) versionEl.textContent = `Dashboard v${status.version}`;
  if (!chip || !globalStatus) return;
  if (status.botRunning) {
    chip.textContent = 'LÄUFT';
    chip.className = 'pill pill-on';
    globalStatus.textContent = 'Bot-Prozess aktiv';
  } else {
    chip.textContent = 'GESTOPPT';
    chip.className = 'pill pill-off';
    globalStatus.textContent = 'Kein Bot-Prozess erkannt';
  }
  if (!status.dataDir) {
    globalStatus.textContent = 'Kein Account-Datenverzeichnis gefunden — noch nicht eingeloggt';
  }
}
```
With:
```js
let lastStatus = null;

function renderStatus() {
  const status = lastStatus;
  if (!status) return;
  const chip = document.getElementById('engine-status');
  const globalStatus = document.getElementById('global-status');
  const versionEl = document.getElementById('footer-version');
  if (versionEl && status.version) versionEl.textContent = `Dashboard v${status.version}`;
  if (!chip || !globalStatus) return;
  if (status.botRunning) {
    chip.textContent = t('router.botRunning');
    chip.className = 'pill pill-on';
    globalStatus.textContent = t('router.botActiveStatus');
  } else {
    chip.textContent = t('router.botStopped');
    chip.className = 'pill pill-off';
    globalStatus.textContent = t('router.botInactiveStatus');
  }
  if (!status.dataDir) {
    globalStatus.textContent = t('router.noDataDir');
  }
}

async function loadStatus() {
  lastStatus = await fetchJSON('/api/status');
  renderStatus();
}
```

- [ ] **Step 6: Split `loadCliUpdateStatus` into fetch+render, translate the render half**

Replace the whole function:
```js
async function loadCliUpdateStatus() {
  const pill = document.getElementById('cli-version-pill');
  const btn = document.getElementById('engine-update-btn');
  if (!pill || !btn) return;
  const status = await fetchJSON('/api/cli-update/status');
  if (status.applying) {
    pill.textContent = 'Installiere…';
    pill.className = 'pill pill-warn';
    btn.style.display = 'none';
  } else if (status.updateAvailable) {
    pill.textContent = 'Update Available';
    pill.className = 'pill pill-warn';
    btn.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Update';
  } else {
    pill.textContent = 'Up To Date';
    pill.className = 'pill pill-on';
    btn.style.display = 'none';
  }
}
```
With:
```js
let lastCliStatus = null;

function renderCliUpdateStatus() {
  const status = lastCliStatus;
  const pill = document.getElementById('cli-version-pill');
  const btn = document.getElementById('engine-update-btn');
  if (!pill || !btn || !status) return;
  if (status.applying) {
    pill.textContent = t('router.installing');
    pill.className = 'pill pill-warn';
    btn.style.display = 'none';
  } else if (status.updateAvailable) {
    pill.textContent = 'Update Available';
    pill.className = 'pill pill-warn';
    btn.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Update';
  } else {
    pill.textContent = 'Up To Date';
    pill.className = 'pill pill-on';
    btn.style.display = 'none';
  }
}

async function loadCliUpdateStatus() {
  const pill = document.getElementById('cli-version-pill');
  const btn = document.getElementById('engine-update-btn');
  if (!pill || !btn) return;
  lastCliStatus = await fetchJSON('/api/cli-update/status');
  renderCliUpdateStatus();
}
```
Note: `'Update Available'` / `'Up To Date'` / `'Update'` / `'Installiere…'`'s English forms are handled via `t('router.installing')` for the one German-only string; the other three are already identical English words used in the German UI today, so they're left as literals (verified against Task 1's dictionaries — no `router.updateAvailable`/`router.upToDate`/`router.updateBtn` keys exist because both languages need the same text).

- [ ] **Step 7: Split `loadDashboardUpdateStatus` into fetch+render, translate the render half**

Replace the whole function:
```js
async function loadDashboardUpdateStatus() {
  const pill = document.getElementById('dashboard-version-pill');
  const btn = document.getElementById('dashboard-update-btn');
  if (!pill || !btn) return;
  const status = await fetchJSON('/api/dashboard-update/status');
  if (status.applying) {
    pill.textContent = 'Installiere…';
    pill.className = 'pill pill-warn';
    btn.style.display = 'none';
  } else if (status.updateAvailable) {
    pill.textContent = status.remoteVersion ? `Update auf ${status.remoteVersion}` : 'Update Available';
    pill.title = status.currentVersion ? `Aktuell: ${status.currentVersion}` : '';
    pill.className = 'pill pill-warn';
    btn.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Update';
  } else {
    pill.textContent = status.currentVersion ? `Up To Date (${status.currentVersion})` : 'Up To Date';
    pill.className = 'pill pill-on';
    btn.style.display = 'none';
  }
}
```
With:
```js
let lastDashboardStatus = null;

function renderDashboardUpdateStatus() {
  const status = lastDashboardStatus;
  const pill = document.getElementById('dashboard-version-pill');
  const btn = document.getElementById('dashboard-update-btn');
  if (!pill || !btn || !status) return;
  if (status.applying) {
    pill.textContent = t('router.installing');
    pill.className = 'pill pill-warn';
    btn.style.display = 'none';
  } else if (status.updateAvailable) {
    pill.textContent = status.remoteVersion ? t('router.updateTo', { version: status.remoteVersion }) : 'Update Available';
    pill.title = status.currentVersion ? t('router.currentVersionTitle', { version: status.currentVersion }) : '';
    pill.className = 'pill pill-warn';
    btn.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Update';
  } else {
    pill.textContent = status.currentVersion ? t('router.upToDateWithVersion', { version: status.currentVersion }) : 'Up To Date';
    pill.className = 'pill pill-on';
    btn.style.display = 'none';
  }
}

async function loadDashboardUpdateStatus() {
  const pill = document.getElementById('dashboard-version-pill');
  const btn = document.getElementById('dashboard-update-btn');
  if (!pill || !btn) return;
  lastDashboardStatus = await fetchJSON('/api/dashboard-update/status');
  renderDashboardUpdateStatus();
}
```

- [ ] **Step 8: Translate `waitForServerAndReload`'s restart button text, confirm dialogs, and error alerts**

Replace:
```js
document.getElementById('engine-update-btn')?.addEventListener('click', async () => {
  if (!confirm('CLI aktualisieren? Laufende Konsolen-Sessions werden neu gestartet, aktive Logins gehen dabei verloren.')) return;
  const btn = document.getElementById('engine-update-btn');
  btn.disabled = true;
  btn.textContent = 'Installiere…';
  try {
    await fetchJSON('/api/cli-update/apply', { method: 'POST' });
    await loadCliUpdateStatus();
  } catch (err) {
    alert('Update fehlgeschlagen: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Update';
  }
});

document.getElementById('dashboard-update-btn')?.addEventListener('click', async () => {
  if (!confirm('Dashboard aktualisieren? Der Server-Prozess startet dabei neu (git pull + Neubau), die Seite lädt danach automatisch neu.')) return;
  const btn = document.getElementById('dashboard-update-btn');
  btn.disabled = true;
  btn.textContent = 'Installiere…';
  try {
    await fetchJSON('/api/dashboard-update/apply', { method: 'POST' });
    btn.textContent = 'Startet neu…';
    waitForServerAndReload();
  } catch (err) {
    alert('Update fehlgeschlagen: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Update';
  }
});
```
With:
```js
document.getElementById('engine-update-btn')?.addEventListener('click', async () => {
  if (!confirm(t('router.confirmCliUpdate'))) return;
  const btn = document.getElementById('engine-update-btn');
  btn.disabled = true;
  btn.textContent = t('router.installing');
  try {
    await fetchJSON('/api/cli-update/apply', { method: 'POST' });
    await loadCliUpdateStatus();
  } catch (err) {
    alert(t('router.updateFailed', { message: err.message }));
    btn.disabled = false;
    btn.textContent = 'Update';
  }
});

document.getElementById('dashboard-update-btn')?.addEventListener('click', async () => {
  if (!confirm(t('router.confirmDashboardUpdate'))) return;
  const btn = document.getElementById('dashboard-update-btn');
  btn.disabled = true;
  btn.textContent = t('router.installing');
  try {
    await fetchJSON('/api/dashboard-update/apply', { method: 'POST' });
    btn.textContent = t('router.restarting');
    waitForServerAndReload();
  } catch (err) {
    alert(t('router.updateFailed', { message: err.message }));
    btn.disabled = false;
    btn.textContent = 'Update';
  }
});
```

- [ ] **Step 9: Translate `wireForceCheckButton`'s error alert**

Replace:
```js
    } catch (err) {
      alert('Prüfung fehlgeschlagen: ' + err.message);
    } finally {
```
With:
```js
    } catch (err) {
      alert(t('router.checkFailed', { message: err.message }));
    } finally {
```

- [ ] **Step 10: Translate `renderNotifPanel`'s empty state and time formatting**

Replace:
```js
  if (!allNotifications.length) {
    list.innerHTML = '<div class="notif-panel-empty">Keine Fehler oder Warnungen bisher.</div>';
    return;
  }
```
With:
```js
  if (!allNotifications.length) {
    list.innerHTML = `<div class="notif-panel-empty">${t('router.notifEmpty')}</div>`;
    return;
  }
```
Leave `new Date(n.at).toLocaleTimeString('de-DE')` in `renderNotifPanel` as-is for now — locale-formatted timestamps are a smaller cosmetic detail than the surrounding text; note it as a known follow-up rather than blocking this task (it's still a valid time string in English, just German-formatted separators).

- [ ] **Step 11: Add `initLangToggle`, wire it, and hook up re-render-on-change**

Add this function near `initThemeToggle` (same file):
```js
function initLangToggle() {
  const btn = document.getElementById('lang-toggle-btn');
  if (!btn) return;
  const apply = (lang) => { btn.textContent = lang === 'de' ? 'EN' : 'DE'; };
  apply(getLanguage());
  btn.addEventListener('click', async () => {
    const next = getLanguage() === 'de' ? 'en' : 'de';
    try {
      await setLanguageAuthenticated(next, fetchJSON);
    } catch (err) {
      console.error('Failed to persist language choice', err);
    }
  });
}

onLanguageChange((lang) => {
  document.getElementById('lang-toggle-btn') && (document.getElementById('lang-toggle-btn').textContent = lang === 'de' ? 'EN' : 'DE');
  renderNav();
  renderSidebarAccounts();
  renderTopbarAccountSelect();
  renderStatus();
  renderCliUpdateStatus();
  renderDashboardUpdateStatus();
  renderNotifPanel();
  renderRoute();
});
```

- [ ] **Step 12: Call `initLangToggle()` alongside the other `init*()` calls near the bottom of the file**

Replace:
```js
initAnonMode();
initThemeToggle();
initNotifications();
initAccessMenu();
initMobileNav();
```
With:
```js
initAnonMode();
initThemeToggle();
initLangToggle();
initNotifications();
initAccessMenu();
initMobileNav();
```

- [ ] **Step 13: Verify syntax**

```bash
node --input-type=module --check < public/router.js
```
Expected: no output, exit code 0.

- [ ] **Step 14: Manual browser check**

Load the authenticated app (log in if needed). Confirm: nav labels, sidebar account list, topbar account dropdown, engine/dashboard status pills, and the notification panel empty state all switch language instantly when clicking the new `DE`/`EN` topbar button, with no page reload and no console errors. Confirm the choice persists after a manual page reload (server-side via `/api/panel-settings`).

- [ ] **Step 15: Commit**

```bash
git add public/router.js
git commit -m "i18n: translate router.js nav/status/dialogs, wire authenticated language toggle"
```

---

### Task 8: `public/pages/console.js` (worked example — smallest page, establishes the per-page pattern used by Tasks 9–14)

**Files:**
- Modify: `public/pages/console.js`

**Interfaces:**
- Consumes: `t` from `public/lib/i18n.js`. Note this file has no top-level `import` currently other than `connectTerminal` — add the `i18n.js` import alongside it.

- [ ] **Step 1: Add the import and translate every literal string**

Replace the whole file:

```js
import { connectTerminal } from '/lib/terminal.js';
import { t } from '/lib/i18n.js';

function fmtExitInfo(info) {
  if (!info) return '';
  const time = new Date(info.at).toLocaleTimeString('de-DE');
  if (info.reason === 'spawn_failed') return t('console.spawnFailed', { time, message: info.message });
  return info.signal
    ? t('console.exitedWithSignal', { time, exitCode: info.exitCode, signal: info.signal })
    : t('console.exited', { time, exitCode: info.exitCode });
}

export default {
  id: 'console',
  label: 'Konsole',
  icon: '⌨',
  mount(container, ctx) {
    const css = `
      .console-page .term-card { background: var(--surface-sunken); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 10px; height: 560px; }
      .console-page #term-container { width: 100%; height: 100%; }
      .console-page .status-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 10px; }
      .console-page .status-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
      .console-page .status-dot.connected { background: var(--green); box-shadow: 0 0 6px var(--green); }
      .console-page .status-dot.disconnected { background: var(--red); box-shadow: 0 0 6px var(--red); }
      .console-page .status-dot.connecting { background: var(--yellow); }
      .console-page .status-text { font-size: 13px; color: var(--muted); }
      .console-page .status-detail { font-size: 12px; color: var(--muted); margin-left: auto; overflow-wrap: break-word; }
      .console-page .btn-restart { width: auto; padding: 6px 14px; font-size: 12px; }
      @media (max-width: 480px) {
        .console-page .term-card { height: 420px; }
      }
    `;
    ctx.injectStyleOnce('console', css);

    const wrap = document.createElement('div');
    wrap.className = 'console-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('console.title')}</h1>
      <p class="muted" style="margin: -6px 0 12px; font-size: 12px;">${t('console.intro')}</p>
      <div class="status-bar">
        <span class="status-dot connecting" id="status-dot"></span>
        <span class="status-text" id="status-text">${t('console.connecting')}</span>
        <span class="status-detail" id="status-detail"></span>
        <button class="btn btn-primary btn-restart" id="restart-btn">${t('console.restartBtn')}</button>
      </div>
      <div class="term-card"><div id="term-container">${t('console.loadingTerminal')}</div></div>
    `;
    container.appendChild(wrap);

    function setStatus(state, text, detail) {
      const dot = wrap.querySelector('#status-dot');
      dot.className = 'status-dot ' + state;
      wrap.querySelector('#status-text').textContent = text;
      wrap.querySelector('#status-detail').textContent = detail || '';
    }

    const termHandle = connectTerminal({
      container: wrap.querySelector('#term-container'),
      onStatus: (status) => {
        if (status.running === true) setStatus('connected', t('console.connected'));
        else if (status.running === false) setStatus('disconnected', t('console.notRunning'), fmtExitInfo(status.lastExitInfo));
        else setStatus('disconnected', t('console.disconnected'));
      },
    });

    wrap.querySelector('#restart-btn').addEventListener('click', async () => {
      setStatus('connecting', t('console.restarting'));
      try {
        await ctx.fetchJSON('/api/console/restart', { method: 'POST' });
      } catch (err) {
        setStatus('disconnected', t('console.restartFailed', { message: err.message }));
      }
    });

    return () => termHandle.dispose();
  }
};
```

Note: the module-level `label: 'Konsole'` and `icon: '⌨'` properties on the default export are dead — `router.js` (Task 7) no longer reads `label`/`icon` from imported page modules, it uses the `PAGES` array's own `labelKey`/`icon`. Leaving them here is harmless (unused) but they're kept as-is rather than removed, since removing them is out of scope for this plan and they don't affect behavior. If you want to clean them up, confirm first that no other code reads `mod.default.label`/`.icon` (grep the repo for `.default.label` before removing).

- [ ] **Step 2: Verify syntax**

```bash
node --input-type=module --check < public/pages/console.js
```
Expected: no output, exit code 0.

- [ ] **Step 3: Manual browser check**

Navigate to `#/console` in both languages. Confirm the title, intro text, status text (connecting/connected/disconnected), and restart button all translate, and that triggering a CLI restart (or disconnect, if you can force one) shows a translated status detail.

- [ ] **Step 4: Commit**

```bash
git add public/pages/console.js
git commit -m "i18n: translate console page"
```

---

### Task 9: `public/pages/analytics.js`

**Files:**
- Modify: `public/pages/analytics.js`
- Modify: `public/lib/i18n/de.js`, `public/lib/i18n/en.js` (add `analytics.*` namespace)

**Interfaces:**
- Consumes: `t` from `public/lib/i18n.js`, same pattern as Task 8.

Apply the identical procedure established in Task 8 to this file:

- [ ] **Step 1: List every user-facing German literal in the file**

```bash
grep -noE '"[^"]*[äöüßÄÖÜ][^"]*"|`[^`]*[äöüßÄÖÜ][^`]*`|>[^<{}]*[äöüßÄÖÜ][^<{}]*<' public/pages/analytics.js
```
This catches strings containing German-specific characters (ä/ö/ü/ß) — the fast majority of this file's literal text will match. Cross-check by also reading the file top to bottom once, since some German words (e.g. "Level", "Status") use no umlauts and won't match the grep.

- [ ] **Step 2: Add an `analytics.*` key for each literal to both `public/lib/i18n/de.js` and `public/lib/i18n/en.js`**

Follow the exact naming/format convention from Task 1 (dot-namespaced, verbatim German text as the `de` value, e.g. `'analytics.someLabel': 'Der deutsche Text'`). Any string with a runtime value embedded (template literals like `` `${x} Punkte` ``) becomes a `{{var}}`-interpolated key, e.g. `'analytics.points': '{{count}} Punkte'`, consumed as `t('analytics.points', { count: x })` — same mechanism as `console.spawnFailed` in Task 8.

- [ ] **Step 3: Add the import and replace every literal with `t('analytics.key', vars?)`**

Add `import { t } from '/lib/i18n.js';` at the top (alongside any existing imports). Replace each literal identified in Step 1/2 in place.

- [ ] **Step 4: Verify the dictionary key sets still match**

Re-run the Task 1 Step 4 verification script — it must still report empty `missing`/`extra` arrays after adding the `analytics.*` keys to both files.

- [ ] **Step 5: Verify syntax**

```bash
node --input-type=module --check < public/pages/analytics.js
node --input-type=module --check < public/lib/i18n/de.js
node --input-type=module --check < public/lib/i18n/en.js
```
Expected: no output for all three, exit code 0.

- [ ] **Step 6: Manual browser check**

Navigate to `#/analytics` in both languages (use the topbar `DE`/`EN` toggle from Task 7). Confirm no leftover German text when in English mode, no raw `analytics.someKey`-looking strings visible (that would mean a missing `en` entry), and charts/data still render correctly (translation must not touch chart data, only labels/copy).

- [ ] **Step 7: Commit**

```bash
git add public/pages/analytics.js public/lib/i18n/de.js public/lib/i18n/en.js
git commit -m "i18n: translate analytics page"
```

---

### Task 10: `public/pages/analytics-compare.js`

**Files:**
- Modify: `public/pages/analytics-compare.js`
- Modify: `public/lib/i18n/de.js`, `public/lib/i18n/en.js` (add `analyticsCompare.*` namespace)

Identical procedure to Task 9, substituting:
- Grep target: `public/pages/analytics-compare.js`
- Key namespace: `analyticsCompare.*`
- Verify commands target `public/pages/analytics-compare.js`

- [ ] **Step 1: Grep and read the file for every user-facing German literal** (command from Task 9 Step 1, path substituted)
- [ ] **Step 2: Add `analyticsCompare.*` keys to both dictionaries** (convention from Task 9 Step 2)
- [ ] **Step 3: Add `import { t } from '/lib/i18n.js';` and replace every literal**
- [ ] **Step 4: Re-run the key-set-match verification script from Task 1 Step 4**
- [ ] **Step 5: Verify syntax** (`node --input-type=module --check < public/pages/analytics-compare.js` plus both dictionaries)
- [ ] **Step 6: Manual browser check** on `#/analytics-compare` in both languages
- [ ] **Step 7: Commit**
```bash
git add public/pages/analytics-compare.js public/lib/i18n/de.js public/lib/i18n/en.js
git commit -m "i18n: translate analytics-compare page"
```

---

### Task 11: `public/pages/nodes.js`

**Files:**
- Modify: `public/pages/nodes.js`
- Modify: `public/lib/i18n/de.js`, `public/lib/i18n/en.js` (add `nodes.*` namespace)

Identical procedure to Task 9, substituting:
- Grep target: `public/pages/nodes.js`
- Key namespace: `nodes.*`

- [ ] **Step 1: Grep and read the file for every user-facing German literal**
- [ ] **Step 2: Add `nodes.*` keys to both dictionaries**
- [ ] **Step 3: Add `import { t } from '/lib/i18n.js';` and replace every literal**
- [ ] **Step 4: Re-run the key-set-match verification script from Task 1 Step 4**
- [ ] **Step 5: Verify syntax** (`node --input-type=module --check < public/pages/nodes.js` plus both dictionaries)
- [ ] **Step 6: Manual browser check** on `#/nodes` in both languages — this page is node-pairing UI (per `docs/superpowers/specs`/project memory on multi-server pairing), pay particular attention to any pairing-code or connection-status copy since those are user-critical strings
- [ ] **Step 7: Commit**
```bash
git add public/pages/nodes.js public/lib/i18n/de.js public/lib/i18n/en.js
git commit -m "i18n: translate nodes page"
```

---

### Task 12: `public/pages/settings.js`

**Files:**
- Modify: `public/pages/settings.js`
- Modify: `public/lib/i18n/de.js`, `public/lib/i18n/en.js` (add `settings.*` namespace)

Identical procedure to Task 9, substituting:
- Grep target: `public/pages/settings.js`
- Key namespace: `settings.*`

Note: this file contains the `panel-settings` interval-preset UI (read in the design investigation for Task 3) — its preset `<option>` labels (`p.label`, e.g. "Standard (alle 10 Minuten)") come from `lib/panelSettings.js`'s `PRESETS` object, which is a **server-side** source, not a client literal. Translating those labels is out of scope for this task per the Global Constraints (server-side strings excluded) — leave `p.label` rendering as-is. Only translate the client-side literals surrounding it (headings, descriptions, status text, buttons).

- [ ] **Step 1: Grep and read the file for every user-facing German literal**
- [ ] **Step 2: Add `settings.*` keys to both dictionaries**
- [ ] **Step 3: Add `import { t } from '/lib/i18n.js';` and replace every literal** (excluding server-sourced `PRESETS` labels, per the note above)
- [ ] **Step 4: Re-run the key-set-match verification script from Task 1 Step 4**
- [ ] **Step 5: Verify syntax** (`node --input-type=module --check < public/pages/settings.js` plus both dictionaries)
- [ ] **Step 6: Manual browser check** on `#/settings` in both languages, including the panel-settings interval selector (its option labels will legitimately stay German — that's expected, not a bug) and the settings-templates UI on the same page
- [ ] **Step 7: Commit**
```bash
git add public/pages/settings.js public/lib/i18n/de.js public/lib/i18n/en.js
git commit -m "i18n: translate settings page"
```

---

### Task 13: `public/pages/accounts.js`

**Files:**
- Modify: `public/pages/accounts.js`
- Modify: `public/lib/i18n/de.js`, `public/lib/i18n/en.js` (add `accounts.*` namespace)

Identical procedure to Task 9, substituting:
- Grep target: `public/pages/accounts.js`
- Key namespace: `accounts.*`

This is the largest page file (663 lines) — expect the largest number of keys. Consider sub-namespacing further if natural groupings emerge while reading it (e.g. `accounts.form.*`, `accounts.list.*`, `accounts.console.*`) — this is at the implementer's discretion, dot-namespacing is just a convention for readability, not a hard schema.

- [ ] **Step 1: Grep and read the file for every user-facing German literal**
- [ ] **Step 2: Add `accounts.*` keys to both dictionaries**
- [ ] **Step 3: Add `import { t } from '/lib/i18n.js';` and replace every literal**
- [ ] **Step 4: Re-run the key-set-match verification script from Task 1 Step 4**
- [ ] **Step 5: Verify syntax** (`node --input-type=module --check < public/pages/accounts.js` plus both dictionaries)
- [ ] **Step 6: Manual browser check** on `#/accounts` in both languages — this page has the most interactive surface (account add/edit/remove forms, per-account console), click through every form and confirmation dialog in both languages
- [ ] **Step 7: Commit**
```bash
git add public/pages/accounts.js public/lib/i18n/de.js public/lib/i18n/en.js
git commit -m "i18n: translate accounts page"
```

---

### Task 14: `public/pages/overview.js`

**Files:**
- Modify: `public/pages/overview.js`
- Modify: `public/lib/i18n/de.js`, `public/lib/i18n/en.js` (add `overview.*` namespace)

Identical procedure to Task 9, substituting:
- Grep target: `public/pages/overview.js`
- Key namespace: `overview.*`

This is the app's default/landing page (`renderRoute()` falls back to `overview` when no hash is set) — verify it especially carefully since it's the first thing every session sees.

- [ ] **Step 1: Grep and read the file for every user-facing German literal**
- [ ] **Step 2: Add `overview.*` keys to both dictionaries**
- [ ] **Step 3: Add `import { t } from '/lib/i18n.js';` and replace every literal**
- [ ] **Step 4: Re-run the key-set-match verification script from Task 1 Step 4**
- [ ] **Step 5: Verify syntax** (`node --input-type=module --check < public/pages/overview.js` plus both dictionaries)
- [ ] **Step 6: Manual browser check** on `#/overview` (and as the default landing page) in both languages
- [ ] **Step 7: Commit**
```bash
git add public/pages/overview.js public/lib/i18n/de.js public/lib/i18n/en.js
git commit -m "i18n: translate overview page"
```

---

### Task 15: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run syntax check across every touched client file**

```bash
for f in public/index.html public/login.html public/setup.html; do
  echo "== $f (visual check only, HTML has no JS syntax checker here) ==";
done
for f in public/router.js public/login.js public/setup.js public/lib/i18n.js public/lib/i18n/de.js public/lib/i18n/en.js public/pages/*.js; do
  echo "checking $f";
  node --input-type=module --check < "$f" || echo "FAILED: $f";
done
```
Expected: every file prints "checking …" with no accompanying "FAILED" line.

- [ ] **Step 2: Final key-set-match check**

Re-run the Task 1 Step 4 script one more time against the final state of both dictionary files — must report empty `missing`/`extra`.

- [ ] **Step 3: Grep for any remaining untranslated German literals in translated files**

```bash
grep -noE '"[^"]*[äöüßÄÖÜ][^"]*"|`[^`]*[äöüßÄÖÜ][^`]*`' public/router.js public/login.js public/setup.js public/pages/*.js
```
Review each match — some are legitimate (e.g. `.toLocaleTimeString('de-DE')` locale codes, or the intentionally-untranslated `PRESETS` labels noted in Task 12). Anything else indicates a missed literal — go back to the relevant task's file and translate it.

- [ ] **Step 4: Full manual click-through**

Start the dashboard, and in **both** languages:
- Load `/setup.html` (if no access configured) or `/login.html`, confirm language toggle works and persists.
- Log in, confirm the pre-auth language choice carried into the authenticated app (or wasn't overwritten if a server-side choice already existed).
- Visit every page via the sidebar nav: Overview, Accounts, Nodes, Analytics, Account-Analyse/Account Analysis, Settings, Console.
- Reload the authenticated app and confirm the language persisted via `data/panel-settings.json` (inspect the file directly to confirm the `language` key is set correctly).
- Trigger at least one confirm() dialog (CLI update or dashboard update button) and one alert() (force an error, e.g. stop the server mid-request) in each language to confirm those translate too.

- [ ] **Step 5: Commit any fixes found during verification**

If Steps 1–4 turned up any issues, fix them and commit with a message like `i18n: fix missed literal in <file>` — one commit per logical fix, not a single giant cleanup commit.
