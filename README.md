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

The script installs all dependencies (Node.js, Rust/Cargo for the sf-api bridge, build tools for native modules, `wireguard-tools`/`resolvconf` for VPN support, the Mercy SF CLI), sets up a self-signed TLS certificate, and starts the dashboard and sf-api bridge as systemd services. It's then reachable at `https://<server-ip>:8080` — the first visit leads to a setup page that walks you through creating the single dashboard account.

Running the script again only updates code and dependencies — existing account data, certificates, and the installed CLI version are left untouched.

### Multiple servers (nodes)

A single dashboard can control accounts across multiple, physically separate servers, not just the one it's installed on. Each additional server runs a lightweight **node agent** (no web UI of its own, no sf-api bridge) — installed just as easily as the dashboard itself:

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --node
```

At the end, the script shows the IP address and a pairing code valid for 15 minutes (retrievable again via `journalctl -u mercy-node-agent` if needed). In the dashboard, under **System Settings → Node** → "Pair a node", enter the IP, port (default `8090`), and code — after that, you can choose which node an account runs on when creating it (or later, via the dropdown on each account profile). Start/stop/status/settings/battle history/"claim"/web terminal/stats/analytics all work identically for node accounts as for local ones, but run transparently through the respective node agent. The **Node** tab also lets you check/update the CLI version per node and update the node agent itself with a click (`git pull` + service restart) — both without SSH access to the respective server. The overview page additionally shows a node card: clicking a node expands its accounts with level/gold/honor inline.

For the case where a bot or a whole node has hung, the **Nodes** page has a quick-control per node: restart just the active bot sessions, restart the node-agent service, or reboot the entire server (`systemctl reboot`) — recently running bots start back up automatically afterward, no manual re-clicking needed. Ping now visibly shows online/offline plus response time, and a rough load indicator (CPU load, RAM usage, uptime) runs alongside it. The dashboard itself also shows up as a node in the list (the server the dashboard is installed on) — the same quick-control, updates, and load indicator work for the dashboard's own server too, not just connected nodes.

### Docker installation

As an alternative to the native systemd installation above, `install.sh` (Linux/WSL) and
`install.ps1` (Windows, Docker Desktop) offer a Docker-based install: choose "Docker" at the
first prompt, and optionally how many additional node containers to create right away — they're
built, started, and paired with the dashboard automatically, no manual IP/code entry needed.
More node containers can be added or removed later without touching the install script:

```bash
./add-node.sh node-3            # create and link
./add-node.sh --remove node-3   # unlink and remove
```

```powershell
.\add-node.ps1 -Name node-3            # create and link
.\add-node.ps1 -Name node-3 -Remove    # unlink and remove
```

Works identically under Docker Desktop (Windows/Mac) since it runs a Linux VM under the hood —
including the WireGuard VPN gating per node container (each container gets its own isolated
network namespace, so multiple node containers can each hold their own simultaneous WireGuard
tunnel, unlike the "one VPN identity per node" limit on bare-metal nodes).

### Uninstallation

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --uninstall
```

Removes **everything**: all systemd services (dashboard, sf-api bridge, and/or node agent, whichever is installed), the entire `/opt/mercy` folder including code, certificates, the CLI binary, saved bot credentials, the dashboard account, and the earnings-statistics database. No intermediate step, no confirmation prompt — make sure you really want everything gone before running it. Running the same command on a node server correspondingly removes only the node agent there.

## Features

- **Nodes (multi-server)** — accounts don't have to run on the server the dashboard itself is installed on: additional servers get a lightweight node agent, connect to the dashboard via IP + a time-limited pairing code, and then show up as a target choice when creating/moving an account. Control, console, settings, battle history, daily earnings, and analytics all work the same for node accounts as for local ones, queried transparently through the respective node agent. CLI version and node agent software can be checked and updated per node directly from the dashboard, without SSH. Ping shows online/offline plus response time, a load indicator (CPU load, RAM, uptime) runs alongside, and a quick-control lets you restart just the bot sessions, the node-agent service, or reboot the whole server when something's stuck (recently running bots restart automatically afterward). The dashboard itself shows up as a node too, with the same controls for its own server. Managed under **System Settings → Node**, alongside VPN and the global panel-interval setting. The overview page additionally shows a node card with online/offline status that expands per node into a mini account list (level/gold/honor)
- **VPN (ProtonVPN/WireGuard)** — WireGuard profiles (uploaded as a `.conf` file) are managed centrally in the dashboard and assigned per target — the local server or an individual node. Connecting/disconnecting runs transparently through the respective node agent, or locally via `wg-quick`. Each target has a selectable gate mode: **Off** (no check), **Block** (bot start is refused unless the VPN is connected), or **Auto-connect** (bot start connects the assigned profile automatically first) — the check runs both in the dashboard, for local accounts, and inside the node agent itself, for node accounts, without a dashboard round-trip. A "Check public IP" button confirms traffic is actually flowing through the tunnel, and node cards show a VPN Active/Inactive badge at a glance
- **Settings panel** — Bot Settings and System Settings live in a right-side slide-out panel with tabs (opened via a topbar gear icon) instead of taking up separate pages in the main navigation; each settings group is single-column and individually collapsible
- **Overview** — modular, collapsible cards (state is remembered): accounts table, character stats, equipment, guild, mail, battle history, and — as of the latest redesign — the tavern (including adventure points as a progress bar) folded into the character card as a sub-section, plus Recent Actions, Scouted Players, and the raw activity log sitting side by side in a compact three-column row
- **Account management** — log in once, every character on a login is found automatically across all servers and set up as its own profile; passwords are stored AES-256-encrypted on disk. Accounts show as a filterable tile grid (search by name/server, filter by status or class); the primary Start/Stop button stays on the tile, while secondary actions (pause/resume/claim/detect class/console/move node/delete) and the session-stats readout live behind a "…" overflow popup so tiles stay compact. The console opens as its own popup window instead of expanding the tile. Characters that were still running at the last restart/update start back up automatically afterward (staggered, so they don't all log in at once)
- **Account-Randomizer** — schedules when each login bots automatically instead of manual start/stop clicking, with two modes per login: **Manual** (set total bot-hours/day, number of blocks 1-4, and number of city-guard pulses 1-5 — only the timing is re-rolled daily) or **Random** ("Willkür" — everything, including hours/blocks/pulses, is re-rolled every day). Enabled accounts are sorted by priority and automatically distributed across all online nodes (+ Local), minus one node reserved for city-guard pulses; each node processes its assigned accounts strictly one after another — never in parallel — since a node can only hold one VPN identity at a time. Each account can be given its own VPN profile (or explicitly no VPN); switching to the next account on a node actively disconnects the previous VPN tunnel and connects the new one before starting, and updates which node the account's characters actually route to. All accounts' city-guard pulses share one combined, priority-ordered queue on the reserved node. A topbar chip shows how many accounts have the randomizer active and how many are still pending in today's schedule; an optional "hard enforce" toggle actively stops anything running outside the plan on every check instead of leaving a pre-existing session alone until its next scheduled transition
- **Built-in web terminal** — its own console session per account in the browser (xterm.js), including automated login click-through
- **Live game data via sf-api** — equipment (slot/type/attributes/quality), guild (honor, rank, member list), tavern (adventure points, current action, available quests), and mail/inbox are queried directly from the game server (read-only, a stateless Rust service on localhost only); how often it polls is configurable under **System Settings** as a global panel interval (default 10 minutes, 1×/hour, 1×/day)
- **Battle history** — real fights recorded locally by the CLI process (opponent, arena/dungeon/scrapbook, win/loss, XP/gold/honor) via the non-interactive CLI command `--history`
- **Daily earnings** — SQLite-backed breakdown of how much XP/gold/honor an account earns per day, plus a list of individually detected fight windows (arena/dungeon), fed from the CLI analytics files that are written continuously anyway — no extra logins against the game server needed
- **Analytics** — time-series charts for level, experience, gold, mushrooms, honor, rank, armor; the character selector can be sorted (name/class/server) and filtered with visibility chips (class/server) so it stays manageable with many accounts
- **Settings** — every bot config toggle readable and writable right in the browser, grouped by area. Reading goes through the non-interactive CLI command `--config`; writing the `auto_*` toggles the CLI itself reports as officially changeable goes through the supported `--config --set` path, all other fields (numbers, strings) still go through the config file directly, since the CLI doesn't offer a way for those yet. Also **settings templates**: save a character's current config as a template and apply it to any number of other characters (creating their config if needed), or import a template directly from an uploaded backup file from the Windows app — fields unknown to either version are filtered out or automatically filled in with default values learned from real accounts
- **Marketplace** — publish a settings template (title, multi-line description, character class, tags) to a shared, opt-in catalog hosted on a central collector; browse, search, and filter templates published by other players and import one with a click. A template can optionally be linked to a real character (via an anonymized account hash, never a raw account identifier) to show aggregate stats — level, gold, arena win rate — alongside the listing. Duplicate configurations are rejected on publish, and the original publisher can edit a template's metadata later via an owner token. Shown as a tile grid with a detail popup; instances that stop reporting in are moved to a separate inactive list after three days instead of disappearing immediately
- **Bug reporting** — a "Report bug" tab in the settings panel sends a title/description/severity report to a central collector, automatically attaching a diagnostic snapshot (instance ID, dashboard version, uptime, and per-node name/host/CLI version/last-seen/status) so an issue can be triaged without back-and-forth. Reports are tracked as tickets with a status (open/in progress/resolved/won't fix); node name and host are shown masked in the ticket view, not in plaintext
- **Notifications** — automatically detects errors/warnings from the log output, a bell with a badge + toast popups
- **Anonymous mode** — pixelates character names, e.g. for screenshots/streaming
- **Mobile view** — fully usable on a phone: navigation as a collapsible menu, tables/console adapt to screen width
- **Automatic update check for CLI and dashboard** — the BOT ENGINE box in the sidebar permanently shows the status of both components ("Up To Date" / "Update Available"): the CLI is checked once a day via MD5 comparison against the official download file, the dashboard itself once a day against the latest commit on GitHub. Clicking "Update" installs automatically (`git pull` + rebuild + restart for the dashboard, download + swap for the CLI binary) — the page reloads on its own afterward. The running dashboard version is also shown in the sidebar footer
- **Login/access protection** — exactly one dashboard account (single admin), the first visit after installation leads to the setup page; it shows the AES key (encrypts the stored bot credentials) and a 12-word recovery phrase once (with mandatory confirmation and a print option), which can later reset the password without email. Change password and logout right in the dashboard
- **Anonymous usage stats (opt-out)** — the dashboard can send an anonymous ping (a random instance ID, uptime, connected-node count, and — separately toggleable — dashboard/node version numbers) to a central collector purely for install statistics; no account data, credentials, or character information ever leaves the dashboard through this channel. Configurable under System Settings

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
- Connecting the VPN for the **local** target routes that server's entire traffic through the tunnel, not just the bot's, since the WireGuard profile's `AllowedIPs` is `0.0.0.0/0`/`::/0` — this includes the dashboard's own connection, so a misconfigured or unreachable VPN endpoint can cut off the dashboard itself
- A node agent only ever connects one VPN profile at a time (mirrors the single active WireGuard interface on the box) — assigning a second profile to the same node's target just swaps which one is active
- The load indicator (CPU/RAM) on the Nodes page only uses Node's own `os` module (no native addon) — good enough for a rough overview, not a precise system metric
- "Reboot server" on the Nodes page runs a real `systemctl reboot` — including for the dashboard's own server, if selected there as a local entry. There's no safeguard beyond the browser confirmation dialog, so use it deliberately
- The Randomizer's node distribution relies on the same "one VPN identity per node at a time" constraint as the VPN section above — accounts sharing a node with different VPN profiles are queued strictly one after another, never in parallel; if a node runs out of room before the configured cutoff, lower-priority accounts are simply skipped for that day (no rollover to another node or to the next day)
- Randomizer config changes (hours, VPN assignment, priority, mode, …) only take effect in the next day's plan — editing them after today's schedule was already generated doesn't reshuffle it
- By default the Randomizer won't touch a bot that was already running before it took over (started manually, or left over from a previous session) — it only reacts to its own tracked schedule transitions, unless "hard enforce" is switched on
- Marketplace publishing has no automated abuse/spam protection beyond duplicate-config rejection — moderation is manual, via the collector's admin panel

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

Node.js + Express (backend), vanilla JS with ES modules (frontend, no build step), `node-pty` + `xterm.js` (console), `chart.js` (analytics/earnings), `ws` (WebSocket), `better-sqlite3` (earnings tracking), `crypto` (Node's built-in module for login/session hashing, no extra auth library). The sf-api integration is a separate, stateless Rust service (`sfapi-bridge/`, `axum` + [`sf-api`](https://github.com/the-marenga/sf-api)) that listens on `127.0.0.1` only. For multi-server setups there's also `node-agent/` — a standalone, minimal Node.js + Express/`ws` app (its own `package.json`, no Rust, no frontend) that runs on remote servers and connects to the dashboard via IP + pairing code (bearer-token auth after pairing). Marketplace, bug reports, and anonymous usage stats talk to a separate, self-hosted collector service (own repository, Express + `better-sqlite3`, public ingest port + login-gated admin UI) — none of this is required for the dashboard's core functionality and all of it is opt-in.

## Acknowledgements

This dashboard only exists because others did the actual groundwork:

- **[Mercy SF](https://mercysf.app)** (Sensei Issei) — the CLI/bot itself that this dashboard is built around. If you'd like to support the project: [Ko-fi](https://ko-fi.com/senseiissei).
- **[sf-api](https://github.com/the-marenga/sf-api)** (the-marenga) — the Rust library through which this dashboard queries live data (equipment, guild, tavern, mail) directly from the game server.

## License

AGPLv3, see [LICENSE](LICENSE).
