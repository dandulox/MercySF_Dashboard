# Anonyme Nutzungsstatistik (Sender + Collector)

**Datum:** 2026-08-15
**Status:** Genehmigt

## Ziel

Jede installierte `MercySF_Dashboard`-Instanz soll optional (standardmäßig aktiv) anonyme,
minimale Nutzungsdaten an einen privaten Collector-Dienst des Projektbetreibers senden:
wie lange das Dashboard läuft und wie viele Nodes gerade verbunden sind. Der Betreiber sieht
darüber ein Aggregat ("wie viele Installationen gibt es, wie viele sind gerade aktiv"), ohne
dass irgendeine Installation identifizierbar wird.

Zwei Teile, zwei Repos:

- **Sender** — Erweiterung von `MercySF_Dashboard` (dieses Repo).
- **Collector** — neues, separates Repo `mercysf-telemetry` (lokal unter
  `G:\Entwicklung\MercySF\mercysf-telemetry`, GitHub-Remote folgt später), läuft nur für den
  Betreiber selbst unter `data.poslab.cc` (Reverse Proxy: extern 443/TLS → intern Port 8091).

**Bewusst ausgeklammert:** der später geplante "Marktplatz für Profile" — dieser Entwurf deckt
nur die Telemetrie-Basis ab.

## Übertragene Daten (vollständige Liste — nicht mehr als das)

Pro Ping, alle 15 Minuten, per `POST https://data.poslab.cc/ingest`:

```json
{
  "instanceId": "a1b2c3d4-...",
  "uptimeSec": 123456,
  "connectedNodes": 2
}
```

- `instanceId`: zufällig generierte UUID, einmalig lokal erzeugt und gespeichert
  (`data/telemetry-id.json`), trägt keine Bedeutung außer "gleiche Installation über mehrere
  Pings hinweg wiedererkennen" — kein Bezug zu Host, IP, Account oder Person.
- `uptimeSec`: `process.uptime()` des Dashboard-Prozesses (Laufzeit seit letztem Start, nicht
  Server-Uptime).
- `connectedNodes`: Anzahl der über `lib/nodeRegistry.js` bekannten Nodes mit
  `lastStatus === 'online'` zum Zeitpunkt des Pings.

Kein Hostname, keine IP (außer der ohnehin bei jeder HTTP-Anfrage sichtbaren Absender-IP —
wird vom Collector nicht gespeichert), keine Dashboard-Version, keine Account- oder
Spieldaten.

## Sender (`MercySF_Dashboard`)

### `lib/telemetry.js` (neu)

- `getOrCreateInstanceId()`: liest/erzeugt `data/telemetry-id.json` (`{ id: "<uuid>" }`,
  `crypto.randomUUID()`).
- `isEnabled()` / `setEnabled(bool)`: liest/schreibt `data/telemetry-settings.json`
  (`{ enabled: true }`, Default `true`, wenn Datei fehlt — Opt-out, kein Opt-in).
- `sendPing()`: best-effort `fetch('https://data.poslab.cc/ingest', { method: 'POST', ... })`
  mit dem oben beschriebenen Body; Fehler (Collector nicht erreichbar, Timeout) werden
  verschluckt (`.catch(() => {})`), kein Retry, keine Fehleranzeige im UI — Telemetrie darf den
  laufenden Betrieb nie beeinträchtigen.
- Beim Modul-Load: einmal sofort senden (falls aktiviert), danach `setInterval(sendPing, 15 *
  60 * 1000)`. `isEnabled()` wird bei jedem Tick frisch geprüft, damit ein Ausschalten in den
  Einstellungen ohne Neustart beim nächsten Tick greift.
- Gleiches Muster wie `lib/dashboardUpdate.js` (Requires, `setInterval`, in `server.js` per
  `require('./lib/telemetry')` beim Start eingebunden).

### `routes/telemetry-settings.js` (neu)

- `GET /api/telemetry-settings` → `{ enabled }`
- `POST /api/telemetry-settings` Body `{ enabled }` → speichert, `{ enabled }` zurück

(Dateiname-Konvention wie bisher: automatisch gemountet unter `/api/telemetry-settings`.)

### Frontend: neuer 4. Tab "Statistik" in `public/pages/system-settings.js`

Reihenfolge der Tabs: Allgemein, Node, VPN, **Statistik**. Inhalt:

- Checkbox "Nutzungsdaten senden" (Default: angehakt, Zustand kommt vom Server)
- Direkt darunter der Klartext-Hinweis, was genau übertragen wird (die drei Felder oben, auf
  Deutsch/Englisch ausformuliert) — Transparenz ist hier bewusst Teil des UI, nicht nur der
  Doku.
- Ändern der Checkbox löst sofort `POST /api/telemetry-settings` aus (kein extra
  Speichern-Button nötig, gleiches Sofort-Feedback-Muster wie in den bestehenden Toggle-artigen
  Einstellungen dieses Projekts).

## Collector (`mercysf-telemetry`, neues Repo)

**Tech-Stack:** Node.js + Express + `better-sqlite3` (gleicher Stack wie `MercySF_Dashboard`,
gleiche Deployment-Logik: systemd-Service, `npm start`).

### Datenmodell

SQLite, eine Tabelle, reines Append-Log (keine Deduplizierung/Update — die Auswertung passiert
beim Lesen):

```sql
CREATE TABLE pings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  uptime_sec INTEGER NOT NULL,
  connected_nodes INTEGER NOT NULL,
  received_at TEXT NOT NULL
);
CREATE INDEX idx_pings_instance ON pings(instance_id);
CREATE INDEX idx_pings_received ON pings(received_at);
```

### Endpunkte

- `POST /ingest` — **öffentlich, kein Login** (sonst könnten die Dashboards nicht senden).
  Validiert nur grob: `instanceId` muss ein String mit vernünftiger Länge sein (z. B. 8–100
  Zeichen), `uptimeSec`/`connectedNodes` müssen nicht-negative Zahlen innerhalb plausibler
  Grenzen sein (z. B. `connectedNodes <= 10000`). Ungültige Anfragen bekommen `400`, gültige
  werden als neue Zeile gespeichert, Antwort `{ ok: true }`. `express.json({ limit: '4kb' })`
  reicht für diesen winzigen Body.
- `GET /login` — einfaches HTML-Formular, ein Token-Feld.
- `POST /login` — Body `{ token }`, Vergleich (zeitkonstant, `crypto.timingSafeEqual`) gegen
  `process.env.TELEMETRY_ADMIN_TOKEN`; bei Erfolg signierter, `httpOnly`-Session-Cookie
  (gleiches Muster wie `MercySF_Dashboard/lib/sessionStore.js`, aber ohne Passwort-Hashing/
  Setup-Assistent — der Token selbst ist das Geheimnis, per Env-Var hinterlegt).
- `GET /` (Cookie-geschützt) — Übersichtsseite:
  - Anzahl bekannter Installationen insgesamt (`COUNT(DISTINCT instance_id)`)
  - Anzahl "gerade aktiv" (Installationen mit mindestens einem Ping in den letzten 30 Minuten —
    doppeltes Sende-Intervall als Toleranz)
  - Summe `connected_nodes` über die aktuell aktiven Installationen (jeweils deren neuester
    Ping)
  - Kleine Tabelle: Instanz-ID (gekürzt), zuletzt gesehen (relative Zeit), Uptime, verbundene
    Nodes — bewusst keine weiteren Spalten, es gibt nichts weiteres zu zeigen
- Alle anderen Pfade unter Login-Pflicht, `/ingest` und `/login`/`/login`-POST bleiben öffentlich
  (gleiche Middleware-Weiche wie in `MercySF_Dashboard/server.js`, nur mit Token statt
  Passwort-Setup).

### Deployment

Kein aufwändiges `install.sh` nötig (Einzel-Deployment nur für den Betreiber selbst) — README
mit manuellen Schritten reicht: `npm install`, `.env` mit `TELEMETRY_ADMIN_TOKEN` und `PORT=8091`,
systemd-Unit nach Vorbild von `MercySF_Dashboard/systemd/mercy-dashboard.service` (nur Pfade/
Portnummer angepasst).

## Grenzen / bewusst ausgeklammert

- Kein Marktplatz für Profile (kommt später, eigenes Feature).
- Keine Wiederholungsversuche/Warteschlange, wenn ein Ping fehlschlägt — geht einfach beim
  nächsten Tick erneut.
- Keine IP-Speicherung, kein Geo-Lookup, kein User-Agent-Tracking auf Collector-Seite.
- Keine Rate-Limiting-Infrastruktur am `/ingest`-Endpoint — bei diesem Nutzungsumfang (privates
  Projekt) nicht nötig; grobe Body-Validierung reicht als Basisschutz.
