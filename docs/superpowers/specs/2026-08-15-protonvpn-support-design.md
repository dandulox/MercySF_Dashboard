# ProtonVPN-Steuerung (WireGuard-basiert)

**Datum:** 2026-08-15
**Status:** Genehmigt
**Branch:** `vpn_support`

## Ziel

Das Dashboard soll ProtonVPN-Verbindungen für sich selbst ("Lokal") und für jeden gepairten
Node-Agent unabhängig steuern können: Verbindung aufbauen/trennen, Standort wählen, Status
sehen — sowie eine Option, Bot-Starts erst zuzulassen, wenn eine VPN-Verbindung aktiv ist.

## Technologie-Entscheidung: WireGuard statt Proton-CLI

Alle drei recherchierten Proton-eigenen CLI-Wege sind für den headless-Root-Server-Betrieb
(systemd, kein Desktop/GUI, siehe `systemd/*.service`) nicht nutzbar:

- **Legacy `protonvpn-cli`** (PyPI, Python-Neuschreibung 2.2.11): archiviert; das
  OpenVPN-Backend, auf dem es basiert, funktioniert laut ProtonVPN offiziell seit 31.03.2025
  nicht mehr.
- **Community-Fork `Rafficer/linux-cli-community`**: ebenfalls archiviert (05.11.2025), gleiches
  totes OpenVPN-Backend.
- **Neue offizielle App (`ProtonVPN/proton-vpn-cli`)**: README-Zitat: *"Headless setups are not
  currently supported."* — auf einem GUI-losen Server nicht einsetzbar.

Stattdessen: **WireGuard-Configs**. ProtonVPN erlaubt das Herunterladen einer `.conf`-Datei pro
Account+Standort-Kombination über das Web-Dashboard (auch für Free-Accounts). Diese Datei wird
einmalig manuell heruntergeladen und hier hochgeladen; Steuerung erfolgt ausschließlich über das
Standard-Linux-Tool `wg-quick` (Paket `wireguard-tools`) — kein Proton-spezifisches Tooling, kein
Deprecation-Risiko, funktioniert garantiert headless.

**Konsequenz für das Datenmodell:** Es gibt keinen automatisierbaren "Login" mehr. Eine
hochgeladene Config *ist* bereits ein bestimmter Account+Server — "Standort wählen" bedeutet:
eine von mehreren hochgeladenen Configs zuweisen. Pro Ziel (Lokal oder ein Node) ist immer nur
ein WireGuard-Tunnel gleichzeitig aktiv; Standort wechseln heißt: aktuelles Interface runter,
neues rauf.

**Hinweis (nur als UI-Warnung, nicht hart erzwungen):** Eine WireGuard-Config ist an einen
bestimmten Proton-"Device-Slot" gebunden — dieselbe Config gleichzeitig auf zwei Zielen zu
verbinden funktioniert bei ProtonVPN nicht zuverlässig. Die UI warnt, wenn ein VPN-Profil bereits
einem anderen Ziel zugewiesen und dort verbunden ist.

## Datenmodell

### VPN-Profile (zentrale Registry, nur im Dashboard)

`lib/vpnProfiles.js` (Muster wie `accountsRegistry.js`), Datei `data/vpn-profiles.json`:

```json
{ "id": "wg0", "label": "Account A – Niederlande", "interfaceName": "wg0", "createdAt": "..." }
```

- `id`/`interfaceName` werden beim Anlegen fortlaufend vergeben (`wg0`, `wg1`, …) — **nicht**
  aus dem Label abgeleitet, da Linux-Interface-Namen auf 15 Zeichen begrenzt sind.
- CRUD: `list()`, `add({label, configContent})`, `rename(id, label)`, `remove(id)`.

### VPN-Config-Speicher (verschlüsselt)

`lib/vpnConfigStore.js` (gleiches AES-256-GCM-Muster wie `credentialStore.js`, aber eigene Datei
`data/vpn-configs.enc.json`, keyed nach VPN-Profil-`id`). Enthält den rohen `.conf`-Inhalt
(inkl. WireGuard Private Key) — wird nie im Klartext an den Browser zurückgegeben, nur beim
Verbinden serverseitig gelesen bzw. beim Zuweisen an einen Node einmalig an dessen
`node-agent/lib/vpnConfigStore.js` (eigene verschlüsselte Kopie dort) übertragen.

### VPN-Ziele

`lib/vpnTargets.js`, Datei `data/vpn-targets.json`. Ziele: `"local"` (Konstante) + jede bekannte
`nodeId` aus `nodeRegistry`. Pro Ziel:

```json
{
  "targetId": "local",
  "vpnProfileId": "wg0",
  "gate": "off",
  "lastStatus": { "connected": false, "interfaceName": null, "updatedAt": null }
}
```

- `gate`: `"off"` | `"block"` | `"auto-connect"` (siehe Start-Gate unten).
- `lastStatus` ist ein Cache, aktualisiert bei jedem expliziten Status-Refresh oder
  Connect/Disconnect-Aufruf — kein Hintergrund-Polling (YAGNI, passt zum bestehenden
  on-demand-Muster von `nodeRegistry.markSeen`).

## VPN-Manager (Kernlogik, dupliziert zwischen Dashboard und Node-Agent)

`lib/vpnManager.js` (Dashboard) und `node-agent/lib/vpnManager.js` (identische Logik, gleiches
Duplikations-Muster wie `ptyManager.js`/`statsDb.js` heute schon zwischen beiden Apps):

- `connect(profileId, configContent)`: falls ein anderes von Mercy verwaltetes WG-Interface auf
  dieser Maschine aktiv ist, zuerst `wg-quick down` dafür; Config nach
  `/etc/wireguard/<interfaceName>.conf` schreiben (Modus `0600`); `wg-quick up <interfaceName>`
  ausführen (via `child_process.spawn`, nie als Shell-String — Muster wie `cliExec.js`).
- `disconnect(interfaceName)`: `wg-quick down <interfaceName>`.
- `status()`: `wg show interfaces` um aktive Interfaces zu finden, dann `wg show <interfaceName>
  latest-handshakes` — ein Handshake innerhalb der letzten 180 Sekunden gilt als "verbunden",
  sonst "getrennt" (Interface kann technisch oben sein, aber ohne Handshake tot).

## Backend-API (Dashboard)

`routes/vpn.js`, gemountet als `/api/vpn` (Dateiname-Konvention wie bisher):

- `GET /api/vpn/profiles` — Liste `{id, label, interfaceName, createdAt}` (nie den Config-Inhalt)
- `POST /api/vpn/profiles` — Body `{label, configContent}`; validiert, dass der Inhalt
  `[Interface]` und `[Peer]` Sektionen enthält; legt Profil + verschlüsselten Config-Eintrag an
- `DELETE /api/vpn/profiles/:id` — schlägt fehl (409), falls das Profil aktuell einem Ziel
  zugewiesen und dort verbunden ist
- `GET /api/vpn/targets` — Lokal + alle Nodes, je mit `vpnProfileId`, `gate`, `lastStatus`
- `POST /api/vpn/targets/:targetId/config` — Body `{vpnProfileId, gate}`; bei einem Node-Ziel
  wird die entschlüsselte Config einmalig an den Node übertragen (`nodeClient.call` →
  `POST /vpn/config` auf dem Node-Agent, Muster wie der bestehende Passwort-Push beim
  Node-Zuweisen in `routes/profiles.js`)
- `POST /api/vpn/targets/:targetId/connect` — lokal: `vpnManager.connect(...)` direkt; bei einem
  Node: `nodeClient.call` → `POST /vpn/connect`
- `POST /api/vpn/targets/:targetId/disconnect` — analog
- `GET /api/vpn/targets/:targetId/status` — Live-Status abfragen, `lastStatus`-Cache aktualisieren

## Node-Agent-Erweiterung

Neue Endpunkte in `node-agent/server.js`, gleiches Muster wie bestehende `/profiles/*`- und
`/system/*`-Routen:

- `POST /vpn/config` — Body `{vpnProfileId, configContent, gate}`; speichert verschlüsselt lokal
  (`node-agent/lib/vpnConfigStore.js`) und merkt sich `gate`
- `POST /vpn/connect`, `POST /vpn/disconnect`, `GET /vpn/status` — nutzen
  `node-agent/lib/vpnManager.js` mit der lokal gespeicherten Config

## Start-Gate

An zwei Stellen geprüft, jeweils **vor** dem eigentlichen Bot-Start:

- **Lokal:** `routes/profiles.js`, `/:id/start`-Handler (lokaler Zweig, vor
  `ptyManager.ensurePty`) — liest `vpnTargets` für `"local"`.
- **Node:** `node-agent/server.js`, `/profiles/:id/start`-Handler — liest seine eigene, lokal
  gespeicherte Gate-Konfiguration (kommt vom letzten `POST /vpn/config`-Aufruf). Bewusst lokal
  geprüft statt über einen Dashboard-Roundtrip, damit der Node autonom bleibt (gleiches Prinzip
  wie die bestehende Pause/Resume-Logik pro Node).

Verhalten je nach `gate`:
- `"off"`: keine Prüfung, wie bisher.
- `"block"`: Live-Status abfragen; nicht verbunden → Start mit `409` und klarer Fehlermeldung
  ablehnen ("VPN nicht verbunden — Start blockiert, siehe System-Einstellungen").
- `"auto-connect"`: falls nicht verbunden, `vpnManager.connect(...)` mit dem zugewiesenen Profil
  aufrufen, bis zu 10 Sekunden auf einen Handshake pollen; bei Erfolg Start fortsetzen, bei
  Fehlschlag Start mit `502` und Fehlermeldung ablehnen (kein stiller Fallback auf ungeschützten
  Start).

## Frontend

### Neue Seite "System-Einstellungen"

`public/pages/system-settings.js`, neuer Nav-Eintrag in `public/router.js` (Icon z. B. `🖥`).
Enthält:

- **Panel-Einstellungen** — Karte 1:1 aus `public/pages/settings.js` hierher verschoben (Sprache,
  Poll-Intervall, gleiche Backend-Calls `/api/panel-settings`); wird aus `settings.js` entfernt.
- **VPN-Profile** — Karte: Tabelle der hochgeladenen Configs (Label, Interface-Name,
  Löschen-Button) + Upload-Formular (Label-Textfeld + Datei-Input für `.conf`, per
  `FileReader.readAsText`, dann `POST /api/vpn/profiles`).
- **VPN-Ziele** — eine Karte pro Ziel (Lokal + jeder Node aus `GET /api/nodes`): Dropdown zur
  Profil-Zuweisung, Verbinden-/Trennen-Buttons, Status-Zeile (🟢 verbunden / 🔴 getrennt, Zeit des
  letzten Refresh), 🔄-Refresh-Button, Start-Gate-Auswahl (Aus / Blockieren / Auto-Verbinden).
  Warnhinweis, falls das gewählte Profil bereits einem anderen (aktuell verbundenen) Ziel
  zugewiesen ist.

### Bestehende Seite "Einstellungen"

`public/pages/settings.js` bleibt reine Bot-Konfiguration (pro Charakter); die
Panel-Einstellungen-Karte wird entfernt. Nav-Label wechselt von "Einstellungen" zu
"Bot-Einstellungen" (`public/router.js`), Seiten-`id` bleibt `settings` (keine Breaking Changes
an internen Referenzen).

### i18n

Neue Keys unter `systemSettings.*` in `public/lib/i18n/de.js` und `en.js` (gleiches Muster wie
`analyticsCompare.*`), inklusive der verschobenen Panel-Einstellungen-Texte.

## Installation

`wireguard-tools` fehlt auf allen Zielsystemen (Dashboard-Server + jeder Node). Ergänzung in
`install.sh` (Debian/Ubuntu: `apt-get install -y wireguard-tools`) sowie ein entsprechender
Hinweis/Schritt für bereits laufende Node-Agent-Installationen (die nicht automatisch
"nachinstalliert" werden — Nutzer muss `apt-get install wireguard-tools` einmalig manuell auf
jedem bestehenden Node ausführen; das Dashboard/der Node-Agent installiert keine System-Pakete
automatisch, das wäre ein zu großer Eingriff für einen unbeaufsichtigten Prozess).

## Sicherheit

- WireGuard-Configs enthalten Private Keys — verschlüsselt at rest (wie Spiel-Passwörter),
  0600-Dateirechte auf den geschriebenen `/etc/wireguard/*.conf`-Dateien.
- Kein Klartext-Config-Inhalt geht jemals in einer API-Antwort an den Browser zurück (nur
  Metadaten: Label, Interface-Name, Zeitstempel).
- `child_process.spawn` statt Shell-Strings für alle `wg-quick`/`wg`-Aufrufe (Command-Injection-
  Schutz, gleiches Muster wie `cliExec.js`).

## Grenzen / bewusst ausgeklammert

- Keine automatische Standort-Umschaltung nach Zeitplan — nur manuell über die UI.
- Kein Hintergrund-Polling des VPN-Status; Anzeige basiert auf explizitem Refresh bzw. dem
  Zeitpunkt des letzten Connect/Disconnect/Start-Gate-Checks.
- Keine Validierung, ob eine WireGuard-Config tatsächlich zu ProtonVPN gehört (jede syntaktisch
  gültige `[Interface]`/`[Peer]`-Config wird akzeptiert) — bewusst generisch gehalten.
- Kein automatisches Nachinstallieren von `wireguard-tools` auf bestehenden Nodes.
