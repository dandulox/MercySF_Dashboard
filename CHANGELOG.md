# Changelog

Notable changes to MercySF_Dashboard. Format loosely follows [Keep a
Changelog](https://keepachangelog.com/). History before 2.0.0 lives in
`git log` — this file starts tracking from the "Version 2" design
overhaul.

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
