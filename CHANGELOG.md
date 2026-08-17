# Changelog

Notable changes to MercySF_Dashboard. Format loosely follows [Keep a
Changelog](https://keepachangelog.com/). History before 2.0.0 lives in
`git log` — this file starts tracking from the "Version 2" design
overhaul.

## [2.11.3] - 2026-08-17

### Changed
- `install.sh`/`install.ps1` now show a per-step progress indicator across all install paths,
  and run long/noisy commands (`docker compose build/up`, `docker build`, `npm install`,
  `cargo build`, `apt-get`, rustup) behind a spinner instead of dumping raw output — full output
  is still shown automatically if a step fails.

### Fixed
- `install.sh --uninstall` / `install.ps1 -Uninstall` now also remove node containers created
  via `add-node.sh`/`add-node.ps1` (and their data volumes) — previously only the dashboard and
  sf-api bridge (managed by docker-compose) were cleaned up, leaving standalone node containers
  behind. Node containers are now tagged with a `mercy.role=node` Docker label so uninstall can
  find them regardless of how they were created.

## [2.11.2] - 2026-08-17

### Changed
- Installer console output (`install.sh`, `install.ps1`, `add-node.sh`, `add-node.ps1`,
  `scripts/docker-link-node.js`) translated from German to English, with a small banner and
  colored step/success markers for a cleaner install experience.

## [2.11.1] - 2026-08-17

### Changed
- Topbar: Emoji-Icons (Anonym-Modus, Theme-Toggle, Einstellungen, Zugang, Benachrichtigungen,
  Aktualisieren) durch einheitliche Inline-SVG-Icons ersetzt.

## [2.11.0] - 2026-08-17

### Added
- Docker-basierte Installation als Alternative zur nativen systemd-Installation: `install.sh`
  (Linux/WSL) und das neue `install.ps1` (Windows, Docker Desktop) fragen jetzt interaktiv
  "nativ oder Docker?" ab und richten bei Docker-Wahl Dashboard, sf-api-Bridge und optional
  beliebig viele Node-Container automatisch ein — inklusive automatischem Pairing ohne manuelle
  IP/Code-Eingabe. Node-Container können danach jederzeit über `add-node.sh`/`add-node.ps1`
  hinzugefügt oder entfernt werden. Funktioniert auch unter Docker Desktop (Windows/Mac),
  inklusive isoliertem WireGuard-VPN-Tunnel pro Node-Container (jeder Container bekommt einen
  eigenen Netzwerk-Namespace, hebt damit die "eine VPN-Identität pro Node"-Grenze der
  physischen Node-Installation auf). `install.sh` installiert Docker Engine + Compose-Plugin bei
  Bedarf selbst über das offizielle apt-Repository (Debian/Ubuntu).

## [2.10.2] - 2026-08-17

### Added
- Telemetrie-Ping meldet jetzt zusätzlich pro Node (und lokal) die Anzahl aktiver Accounts und
  laufender Charaktere (`nodeStats`), hinter dem bestehenden Versions-Reporting-Opt-out.

## [2.10.1] - 2026-08-16

### Fixed
- Sidebar: the first account group could never be collapsed — every
  re-render (the sidebar polls `/api/accounts` periodically) re-expanded
  whichever group contained the currently selected character, which for
  the first group is true from the moment the page loads. Auto-expand
  now only fires when the selection actually changes, not on every
  render.

## [2.10.0] - 2026-08-16

### Changed
- Sidebar: the account list below the main nav now groups characters by
  login instead of listing every character flat. Each login is a
  collapsible row showing "X/Y" (X = characters currently botting, Y =
  total characters on that login) with a chevron to expand/collapse its
  character list; a login containing the currently selected character
  auto-expands. `GET /api/accounts` now includes `username` and a
  `running` flag per character (local via `ptyManager.getStatus`, remote
  via the node-agent's own `/profiles` status) to back this.

## [2.9.2] - 2026-08-16

### Fixed
- Randomizer: the global-limits grid still misaligned inputs whenever a
  label wrapped to a different number of lines than its row neighbors —
  the earlier `min-height` fix on the whole `<label>` didn't survive
  adding more/longer fields (timezone, min gap). Reworked to a fixed
  4-column grid (2 on tablet, 1 on mobile) with the label text in its
  own bottom-aligned, fixed-height span, separate from the input —
  every input in a row now sits at the same position regardless of how
  many lines its label took.

## [2.9.1] - 2026-08-16

### Changed
- Randomizer: the timezone setting is now a dropdown of common IANA
  zones instead of a free-text field — the currently configured value
  is always included even if it's not in the preset list.

## [2.9.0] - 2026-08-16

### Added
- Randomizer: a `timezone` setting (IANA name, e.g. `Europe/Berlin`,
  default `UTC`). Root-caused a live report of "bots don't start despite
  the schedule": the whole scheduling engine ran on the server's OS
  timezone (UTC on a typical VPS) with no way to say "dayStart 06:00
  means 6am *here*, not 6am UTC" — on a server in a different timezone
  than the operator, this made every block fire hours later (by the
  operator's clock) than expected, with nothing actually broken. Falls
  back to server time if the configured zone is invalid, so a bad value
  can't crash the tick. DST is handled automatically via `Intl`, no
  manual offset table.
- Randomizer: the Timeline card now shows "Server time (<timezone>):
  HH:MM" (computed the same way the tick itself computes it) so a
  mismatch like this is visible at a glance instead of requiring a
  server-side investigation. The timeline's "now" marker also switched
  from the viewer's browser clock to this same server-computed time, so
  it's consistent with what the scheduler is actually acting on.

## [2.8.1] - 2026-08-16

### Fixed
- Randomizer: every failure in the tick (start/stop/VPN-switch/node-
  assignment errors, an unresolvable reserve node) was silently
  swallowed — nothing showed up anywhere, not even the server log. All
  of these now log a `[randomizer] ...` line with the actual error, and
  a missing reserve node no longer marks an account as "handled" (it
  keeps retrying every tick instead of giving up for the day).
- Randomizer: if the reserve node is the *only* node (typical
  single-server setup with no paired nodes) and is reserved for city
  guard, the main pool is empty and nothing gets a bot block at all —
  now logs a clear warning naming this as the likely cause instead of
  silently scheduling nothing.
- Randomizer: a VPN profile referenced by an account's config that no
  longer exists left the previous VPN gate assignment in place (e.g.
  still "block") instead of falling back to no VPN, which could make
  the subsequent start fail for an unrelated reason.

## [2.8.0] - 2026-08-16

### Added
- Randomizer: a "Recalculate" button forces a brand-new assignment for
  today instead of waiting for the next day's rollover — new timeslots,
  new node distribution, and (for Random-mode accounts) newly rolled
  hours/blocks/city-guard counts. A persisted per-day nonce gets mixed
  into the scheduling seed so recalculating actually produces a
  different plan instead of the same deterministic one; already-running
  accounts pick up the new plan (including node/VPN reassignment) on the
  next tick.

### Fixed
- Timeline: hover tooltips on the schedule bars now use a custom,
  immediately-visible tooltip instead of the native browser `title`
  attribute, which was unreliable on the densely packed, sometimes
  few-pixels-wide segments.

## [2.7.0] - 2026-08-16

### Added
- Randomizer: a "Timeline" card showing today's whole-day schedule at a
  glance — one row per node with today's bot blocks drawn as colored
  segments on a 00:00–24:00 track (color-coded per account, hover for
  exact times) plus a utilization percentage (occupied time vs. the
  configured day window), a separate row for the reserve node's combined
  city-guard pulse queue, and a "now" marker across all tracks. Backed by
  a new `GET /api/randomizer/timeline` endpoint.

## [2.6.1] - 2026-08-16

### Fixed
- Randomizer: a city-guard pulse could be scheduled at a time when the
  same account was also running its own bot block on its main node —
  same login active over two node connections at once. Pulses are now
  checked against the account's own blocks and pushed past them if they
  collide.
- Randomizer: added a minimum gap (default 60 min, configurable) between
  two city-guard pulses of the *same* account — guard duty has a real
  in-game duration, so sending a character back too soon didn't make
  sense.

## [2.6.0] - 2026-08-16

### Added
- Topbar: two new status chips next to "Bot process active", shown only
  when at least one account has the randomizer enabled — "Randomizer
  active X/Y" (X = accounts with the randomizer on, Y = total accounts)
  and "Randomizer queue X/Y" (X = accounts in today's plan that haven't
  finished their last scheduled block/city-guard pulse yet, Y = total
  accounts scheduled today). New `GET /api/randomizer/status` endpoint
  backs both.

## [2.5.3] - 2026-08-16

### Fixed
- Randomizer: the English UI left "Willkür" untranslated in three spots
  (mode button label, min/max hours field hints) — now "Random".

## [2.5.2] - 2026-08-16

### Added
- Randomizer: new "Hard enforce" toggle (default off). Off keeps the
  existing behavior — a bot already running outside the plan (manually
  started, or running before the randomizer was enabled) is left alone
  until the next scheduled transition. On actively stops it every tick
  as soon as the plan says it shouldn't be running, instead of waiting.

## [2.5.1] - 2026-08-16

### Fixed
- Randomizer: global-limits fields no longer misalign when a label wraps
  to two lines (e.g. "Latest start (hard cutoff)") — labels now reserve
  a fixed height so every input in a row lines up. Account rows now lay
  out two per row (cards) instead of one cramped full-width line each.
- Scoped `.empty-hint` under `.randomizer-page` — it was unscoped and
  could have leaked into other pages using the same class name.

## [2.5.0] - 2026-08-16

### Added
- Randomizer: per-account VPN assignment (pick an existing VPN profile,
  or explicitly "no VPN" — no implicit fallback) and a priority (1-100,
  higher = scheduled first).
- Randomizer: automatic node distribution. Enabled accounts are sorted by
  priority and round-robin assigned across all online nodes (+ Local),
  minus one node reserved exclusively for city-guard pulses. Each node
  runs its assigned accounts **sequentially** (never overlapping), since
  a node can only hold one VPN identity at a time — switching to the next
  account explicitly disconnects the previous VPN and applies the new
  account's assignment (local via `vpnTargets`, remote via the node-
  agent's existing `/vpn/config` and `/vpn/disconnect` endpoints) before
  starting it, including updating the character's `nodeId` so the start
  actually routes to the node the randomizer chose. Each node processes
  its own queue independently — no waiting on other nodes.
- Randomizer: all accounts' city-guard pulses (regardless of their main
  node) share one combined queue on the reserve node, in priority order —
  if the day doesn't have room for everything, the lowest-priority pulses
  are dropped first.
- New global settings: reserve node picker, node handoff buffer (VPN
  switch time between two accounts on the same node), and a hard cutoff
  after which nothing new starts on any node.

### Changed
- Randomizer's day-plan generation replaced the old "independent accounts
  with a minimum stagger" model with the node-queue model above — this
  also removes the `minStaggerMinutes` setting (superseded by per-node
  sequential placement).

## [2.4.1] - 2026-08-16

### Fixed
- Randomizer: "Account" was implemented at the character level (per
  profile) — corrected to operate at the login level, so a login with
  multiple characters gets one shared schedule and all its characters
  start/stop together (same grouping as the "start all"/"stop all" login
  actions on the Accounts page).
- Randomizer: Willkür mode is now a dedicated on/off button per account
  instead of a mode dropdown — clearer, and the three manual fields grey
  out (disabled, not hidden) instead of disappearing when Willkür is on.
- Removed the `<select>` from the randomizer row entirely — it rendered
  with poor contrast (light text on a light dropdown background) in some
  browsers.

## [2.4.0] - 2026-08-16

### Added
- Account-Randomizer: new "Randomizer" nav page that automatically starts/
  stops each account's bot on a daily-generated schedule instead of
  requiring manual start/stop. Per account: enable/disable, **Manual**
  mode (set total hours/day, block count 1-4, city-guard pulse count 1-5 —
  only the timing is randomized daily) or **Willkür** mode (everything,
  including hours/blocks/pulses, is re-rolled every day). Accounts never
  start at the exact same time — a minimum stagger is enforced across all
  enabled accounts, shifting later start times forward (capped so nothing
  spills past midnight). City-guard pulses are short login/logout cycles
  placed in the gaps between bot blocks. Global limits (day window,
  min/max hours, stagger, block/pulse durations) are editable from the
  same page. Deterministic per-day scheduling via a seeded PRNG keyed on
  `profileId + date`, so a dashboard restart mid-day reproduces the same
  plan instead of re-rolling it.

## [2.3.0] - 2026-08-16

### Changed
- Overview: Tavern merged into the Character card as a sub-section instead
  of its own full-width card; Equipment's grid uses wider tiles (fewer,
  taller columns); Battle History is more compact (tighter rows, capped
  scroll height, default 8 rows instead of 20); Recent Actions, Scouted
  Players, and the Activity Log moved into a 3-column row.

### Fixed
- Accounts: the "…" overflow menu (secondary actions + session stats) and
  the console button no longer expand a tile inline — both render as
  popups (a floating overlay for the menu, a centered modal for the
  console) instead, so nothing in the tile grid shifts layout.
- Accounts: a CSS-scoping bug introduced by the popup move — the
  login-helper, character-picker, and terminal styles were still scoped
  under `.accounts-page` but now render outside it (appended to
  `document.body`).
- Overview: cards in the same gamestate-grid row lost equal-height
  alignment after the Tavern merge (regression from the layout change
  above, fixed same day).

## [2.2.0] - 2026-08-15

### Added
- Bug-Report-System: new "Bug melden" tab in the settings panel. Submits
  title/description/severity plus a diagnostic snapshot (instance ID,
  dashboard version, uptime, per-node name/host/CLI version/last-seen/
  status) to the collector's new ingest endpoint.

## [2.1.0] - 2026-08-15

### Added
- Accounts: filterable tile view (search by name/server, filter by
  status/class) replacing the old vertically-stacked profile cards.

### Changed
- Recent Actions and Scouted Players moved from the per-account detail
  block on the Accounts page to their own cards on Overview.

## [2.0.0] - 2026-08-15

### Changed
- **Navigation overhaul:** Bot-Einstellungen and System-Einstellungen moved
  out of the main sidebar into a right-side slide-out settings panel with
  tabs, opened via a topbar gear icon.
- Marketplace switched from a list to a tile grid with a detail popup;
  removed the now-redundant standalone Konsole and Analysen nav pages
  (superseded by per-account console and Account-Analyse).
- Settings panel groups: single-column, collapsible sections instead of a
  two-column layout.

### Fixed
- Marketplace detail popup CSS-scoping bug that caused multiple unstyled
  popups to stack at the bottom of the page.
