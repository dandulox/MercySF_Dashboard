*[🇬🇧 English](README.md) | [🇩🇪 Deutsch](README.de.md)*

# Mercy SF Web Dashboard

A web dashboard for [Mercy SF](https://mercysf.app), built around the existing CLI — overview, control, and analytics for all accounts right in the browser, instead of the terminal menu. It also pulls live data (equipment, guild, tavern, mail) directly from the game server via [sf-api](https://github.com/the-marenga/sf-api) by the-marenga.

Everything runs on top of the official CLI. Nothing about the bot itself is changed — this just builds an interface around it.

> ⚠️ **Experimental, use at your own risk.** This dashboard is under active development and may contain bugs. Also: automated play (botting) generally violates Shakes & Fidget's terms of service — there is an inherent risk of account suspension, regardless of whether the automation runs through this dashboard or directly via the CLI. Use at your own responsibility.

## Installation

On a fresh Debian/Ubuntu server, as root:

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash
```

The script installs all dependencies (Node.js, Rust/Cargo for the sf-api bridge, build tools for native modules, the Mercy SF CLI), sets up a self-signed TLS certificate, and starts the dashboard and sf-api bridge as systemd services. It's then reachable at `https://<server-ip>:8080` — the first visit leads to a setup page that walks you through creating the single dashboard account.

Running the script again only updates code and dependencies — existing account data, certificates, and the installed CLI version are left untouched.

### Multiple servers (nodes)

A single dashboard can control accounts across multiple, physically separate servers, not just the one it's installed on. Each additional server runs a lightweight **node agent** (no web UI of its own, no sf-api bridge) — installed just as easily as the dashboard itself:

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --node
```

At the end, the script shows the IP address and a pairing code valid for 15 minutes (retrievable again via `journalctl -u mercy-node-agent` if needed). In the dashboard, under **Nodes** → "Pair a node", enter the IP, port (default `8090`), and code — after that, you can choose which node an account runs on when creating it (or later, via the dropdown on each account profile). Start/stop/status/settings/battle history/"claim"/web terminal/stats/analytics all work identically for node accounts as for local ones, but run transparently through the respective node agent. The **Nodes** page also lets you check/update the CLI version per node and update the node agent itself with a click (`git pull` + service restart) — both without SSH access to the respective server. The overview page additionally shows a node card: clicking a node expands its accounts with level/gold/honor inline.

### Uninstallation

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --uninstall
```

Removes **everything**: all systemd services (dashboard, sf-api bridge, and/or node agent, whichever is installed), the entire `/opt/mercy` folder including code, certificates, the CLI binary, saved bot credentials, the dashboard account, and the earnings-statistics database. No intermediate step, no confirmation prompt — make sure you really want everything gone before running it. Running the same command on a node server correspondingly removes only the node agent there.

## Features

- **Nodes (multi-server)** — accounts don't have to run on the server the dashboard itself is installed on: additional servers get a lightweight node agent, connect to the dashboard via IP + a time-limited pairing code, and then show up as a target choice when creating/moving an account. Control, console, settings, battle history, daily earnings, and analytics all work the same for node accounts as for local ones, queried transparently through the respective node agent. CLI version and node agent software can be checked and updated per node directly from the dashboard, without SSH. The overview page additionally shows a node card with online/offline status that expands per node into a mini account list (level/gold/honor)
- **Overview** — modular, collapsible cards (state is remembered): accounts table, character stats, equipment, tavern (including adventure points as a progress bar), guild, mail, battle history, activity log
- **Account management** — log in once, every character on a login is found automatically across all servers and set up as its own profile; passwords are stored AES-256-encrypted on disk; per account: start/stop/pause, "claim" (calendar/daily tasks/pending unlocks). Characters that were still running at the last restart/update start back up automatically afterward (staggered, so they don't all log in at once)
- **Built-in web terminal** — its own console session per account in the browser (xterm.js), including automated login click-through
- **Live game data via sf-api** — equipment (slot/type/attributes/quality), guild (honor, rank, member list), tavern (adventure points, current action, available quests), and mail/inbox are queried directly from the game server (read-only, a stateless Rust service on localhost only); how often it polls is configurable under Settings as a global panel interval (default 10 minutes, 1×/hour, 1×/day)
- **Battle history** — real fights recorded locally by the CLI process (opponent, arena/dungeon/scrapbook, win/loss, XP/gold/honor) via the non-interactive CLI command `--history`
- **Daily earnings** — SQLite-backed breakdown of how much XP/gold/honor an account earns per day, plus a list of individually detected fight windows (arena/dungeon), fed from the CLI analytics files that are written continuously anyway — no extra logins against the game server needed
- **Analytics** — time-series charts for level, experience, gold, mushrooms, honor, rank, armor
- **Settings** — every bot config toggle readable and writable right in the browser, grouped by area. Reading goes through the non-interactive CLI command `--config`; writing the `auto_*` toggles the CLI itself reports as officially changeable goes through the supported `--config --set` path, all other fields (numbers, strings) still go through the config file directly, since the CLI doesn't offer a way for those yet. Also **settings templates**: save a character's current config as a template and apply it to any number of other characters (creating their config if needed), or import a template directly from an uploaded backup file from the Windows app — fields unknown to either version are filtered out or automatically filled in with default values learned from real accounts
- **Notifications** — automatically detects errors/warnings from the log output, a bell with a badge + toast popups
- **Anonymous mode** — pixelates character names, e.g. for screenshots/streaming
- **Mobile view** — fully usable on a phone: navigation as a collapsible menu, tables/console adapt to screen width
- **Automatic update check for CLI and dashboard** — the BOT ENGINE box in the sidebar permanently shows the status of both components ("Up To Date" / "Update Available"): the CLI is checked once a day via MD5 comparison against the official download file, the dashboard itself once a day against the latest commit on GitHub. Clicking "Update" installs automatically (`git pull` + rebuild + restart for the dashboard, download + swap for the CLI binary) — the page reloads on its own afterward. The running dashboard version is also shown in the sidebar footer
- **Login/access protection** — exactly one dashboard account (single admin), the first visit after installation leads to the setup page; it shows the AES key (encrypts the stored bot credentials) and a 12-word recovery phrase once (with mandatory confirmation and a print option), which can later reset the password without email. Change password and logout right in the dashboard

## Known limitations

Since version 2.13.0, the CLI offers a documented, non-interactive JSON mode (`--user`/`--character`/`--password-stdin`), which the dashboard uses for settings, battle history, and "claim". The actual bot start/login flow in the web terminal, however, still runs through the classic interactive text menu — so that automation still relies on pattern-matching the terminal output (`Select option:`, `Username:`, `Password:`, `Select character index:`, `Bot Menu` …). If the wording of a CLI menu changes there, the automation can break until the code is adjusted accordingly. Further known gaps:

- No native pause command — "Pause" instead turns off all active `auto_*` config toggles; whether that stops an already-running bot loop immediately or only on its next pass is unverified
- Only ~20 `auto_*` toggles are officially changeable through the CLI itself (`--config --set`) — all other settings fields (numbers, strings, remaining booleans) are still written directly to the config file by the dashboard, since the CLI doesn't offer a supported way for those yet
- No official version/update API for the CLI — the update check compares MD5 hashes against the public download file
- A dashboard self-update (`git pull` + rebuild) briefly interrupts the active connection while both systemd services restart — the page reloads automatically once the server responds again
- `sf-api` doesn't provide readable item names (only numeric IDs/enum types) — the equipment display shows slot, item type, attributes, and quality, not display names
- Daily earnings for gold are a **net change** per time window (can include expenses like repairs/shop purchases) — XP and honor are exact, since they only change through fights/quests; which CLI commands ran in the same window is shown alongside
- No rate limiting on login/password-reset attempts — no brute-force protection, mainly relevant if the dashboard is ever exposed beyond its own LAN
- The activity log on the overview page stays empty for node accounts — a node's PTY output doesn't flow through the dashboard's local log ring buffer. Analytics, daily earnings, and the node card on the overview do work for node accounts, though, since that data is actively queried from the respective node rather than read from the PTY log
- A node agent only ever accepts exactly one paired dashboard at a time — re-pairing (e.g. with a new code) silently disconnects a previously connected dashboard
- A node agent self-update checks the currently checked-out git branch against GitHub — that assumes the branch actually exists on GitHub (for a local/unpushed branch, the check fails instead of reporting "no update")

## Resource usage

**Test 1** — 4 vCPU / 8 GB RAM, 11 concurrently running accounts:

| Metric | Value |
|---|---|
| CPU usage | 1.8% |
| RAM usage | 217.6 MB of 8 GB (2.72%) |
| Boot disk | 13 GB of 49 GB (28%) |

**Test 2** — 1 vCPU / 1 GB RAM (Proxmox LXC container), 30 concurrently running accounts:

| Metric | Value |
|---|---|
| CPU usage | 2.82% |
| RAM usage | 226.7 MB of 1.07 GB (21.11%) |
| Boot disk | 3.95 GB of 8.35 GB (47.36%) |

## Tech stack

Node.js + Express (backend), vanilla JS with ES modules (frontend, no build step), `node-pty` + `xterm.js` (console), `chart.js` (analytics/earnings), `ws` (WebSocket), `better-sqlite3` (earnings tracking), `crypto` (Node's built-in module for login/session hashing, no extra auth library). The sf-api integration is a separate, stateless Rust service (`sfapi-bridge/`, `axum` + [`sf-api`](https://github.com/the-marenga/sf-api)) that listens on `127.0.0.1` only. For multi-server setups there's also `node-agent/` — a standalone, minimal Node.js + Express/`ws` app (its own `package.json`, no Rust, no frontend) that runs on remote servers and connects to the dashboard via IP + pairing code (bearer-token auth after pairing).

## Acknowledgements

This dashboard only exists because others did the actual groundwork:

- **[Mercy SF](https://mercysf.app)** (Sensei Issei) — the CLI/bot itself that this dashboard is built around. If you'd like to support the project: [Ko-fi](https://ko-fi.com/senseiissei).
- **[sf-api](https://github.com/the-marenga/sf-api)** (the-marenga) — the Rust library through which this dashboard queries live data (equipment, guild, tavern, mail) directly from the game server.

## License

AGPLv3, see [LICENSE](LICENSE).
