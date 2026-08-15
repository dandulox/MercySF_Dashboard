# Changelog

Notable changes to MercySF_Dashboard. Format loosely follows [Keep a
Changelog](https://keepachangelog.com/). History before 2.0.0 lives in
`git log` — this file starts tracking from the "Version 2" design
overhaul.

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
