# Mercy SF Web-Dashboard

Ein Web-Dashboard für [Mercy SF](https://mercysf.app), das um die bestehende CLI herum gebaut ist — Übersicht, Steuerung und Analyse für alle Accounts direkt im Browser, statt über das Terminal-Menü. Zusätzlich holt es über [sf-api](https://github.com/the-marenga/sf-api) von the-marenga Live-Daten (Ausrüstung, Gilde, Taverne, Mail) direkt vom Spieleserver.

Alles läuft auf Basis der offiziellen CLI. Es wird nichts am Bot selbst verändert, nur ein Interface drumherum gebaut.

> ⚠️ **Experimentell, Nutzung auf eigenes Risiko.** Dieses Dashboard befindet sich in aktiver Entwicklung, es kann Fehler enthalten. Außerdem: Automatisiertes Spielen (Botting) verstößt in der Regel gegen die Nutzungsbedingungen von Shakes & Fidget — es besteht grundsätzlich das Risiko einer Account-Sperrung, unabhängig davon, ob die Automatisierung über dieses Dashboard oder direkt über die CLI läuft. Nutzung auf eigene Verantwortung.

## Installation

Auf einem frischen Debian/Ubuntu-Server, als root:

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash
```

Das Skript installiert alle Abhängigkeiten (Node.js, Rust/Cargo für die sf-api-Bridge, Build-Tools für native Module, die Mercy-SF-CLI), richtet ein selbstsigniertes TLS-Zertifikat ein und startet Dashboard sowie sf-api-Bridge als systemd-Dienste. Danach ist es unter `https://<server-ip>:8080` erreichbar — beim ersten Aufruf führt eine Setup-Seite durch das Anlegen des einen Dashboard-Zugangs.

Erneutes Ausführen des Skripts aktualisiert nur Code und Dependencies — vorhandene Account-Daten, Zertifikate und die installierte CLI-Version bleiben unangetastet.

### Deinstallation

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --uninstall
```

Entfernt **alles**: beide systemd-Dienste, den kompletten `/opt/mercy`-Ordner inkl. Dashboard-Code, Zertifikate, CLI-Binary, gespeicherte Bot-Zugangsdaten, Dashboard-Zugang und die Ertrags-Statistik-Datenbank. Kein Zwischenschritt, keine Rückfrage — vor dem Ausführen sicher sein, dass wirklich alles weg soll.

## Funktionen

- **Übersicht** — modulare, ein-/ausklappbare Karten (Zustand bleibt gespeichert): Accounts-Tabelle, Charakter-Stats, Ausrüstung, Taverne (inkl. Abenteuerlust als Balkenanzeige), Gilde, Mail, Activity-Log
- **Account-Verwaltung** — einmal einloggen, alle Charaktere eines Logins werden automatisch über alle Server hinweg gefunden und als eigene Profile angelegt; Passwörter liegen AES-256-verschlüsselt auf der Platte; pro Account: Start/Stop/Pause
- **Eingebautes Web-Terminal** — pro Account eine eigene Konsolen-Session im Browser (xterm.js), inklusive automatisiertem Login-Durchklicken
- **Live-Spieldaten über sf-api** — Ausrüstung (Slot/Typ/Attribute/Qualität), Gilde (Ehre, Rang, Mitgliederliste), Taverne (Abenteuerlust, aktuelle Aktion, verfügbare Quests) und Mail/Postfach werden direkt vom Spieleserver abgefragt (read-only, ein zustandsloser Rust-Dienst nur auf localhost, 10-Minuten-Cache pro Account)
- **Tägliche Erträge** — SQLite-gestützte Auswertung, wie viel EP/Silber/Ehre ein Account pro Tag erwirtschaftet, plus eine Liste einzeln erkannter Kampf-Fenster (Arena/Dungeon), gespeist aus den ohnehin laufend geschriebenen CLI-Analytics-Dateien — keine zusätzlichen Logins gegen den Spieleserver nötig
- **Analysen** — Zeitreihen-Charts für Level, Erfahrung, Silber, Pilze, Ehre, Rang, Rüstung
- **Einstellungen** — alle Bot-Konfig-Schalter direkt im Browser lesbar und schreibbar, gruppiert nach Bereich
- **Benachrichtigungen** — erkennt Fehler/Warnungen automatisch aus dem Log-Output, Glocke mit Badge + Toast-Popups
- **Anonym-Modus** — Charakternamen verpixeln, z. B. für Screenshots/Streaming
- **Automatischer Update-Check für CLI und Dashboard** — der BOT-ENGINE-Kasten in der Sidebar zeigt permanent den Status beider Komponenten ("Up To Date" / "Update Available"): die CLI wird 1×/Tag per MD5-Vergleich gegen die offizielle Download-Datei geprüft, das Dashboard selbst 1×/Tag gegen den neuesten Commit auf GitHub. Ein Klick auf "Update" installiert automatisch (`git pull` + Neubau + Neustart beim Dashboard, Download + Austausch beim CLI-Binary) — die Seite lädt danach selbstständig neu. Die laufende Dashboard-Version steht zusätzlich im Sidebar-Footer.
- **Login/Zugangsschutz** — genau ein Dashboard-Zugang (Single-Admin), erster Besuch nach der Installation führt zur Setup-Seite; dort werden einmalig der AES-Schlüssel (verschlüsselt die gespeicherten Bot-Zugangsdaten) und ein 12-Wort-Wiederherstellungsschlüssel angezeigt (mit Pflicht-Bestätigung und Druck-Option), über den sich das Passwort später ohne E-Mail zurücksetzen lässt. Passwort-ändern und Logout direkt im Dashboard.

## Bekannte Einschränkungen

Die CLI bietet keine offizielle Fernsteuerungs-API — sie ist als reines Text-Menü für interaktive Terminal-Nutzung gebaut. Alles an Login-/Bot-Automatisierung in diesem Dashboard basiert auf Pattern-Matching des Terminal-Outputs (`Select option:`, `Username:`, `Password:`, `Select character index:`, `Bot Menu` …). Ändert sich der Wortlaut eines CLI-Menüs, kann die Automatisierung brechen, bis der Code entsprechend angepasst wird. Weitere bekannte Lücken:

- Kein natives Pause-Kommando — "Pause" schaltet stattdessen alle aktiven `auto_*`-Konfig-Schalter aus; ob das eine bereits laufende Bot-Schleife sofort stoppt oder erst beim nächsten Durchlauf, ist nicht verifiziert
- Der Linux-Build der CLI schreibt keine `logs/`- oder `battle_history/`-Dateien auf die Platte — das Dashboard behilft sich mit einem In-Memory-Ringpuffer aus dem Live-Terminal-Output
- Keine offizielle Versions-/Update-API für die CLI — der Update-Check vergleicht MD5-Hashes gegen die öffentliche Download-Datei
- Ein Dashboard-Selbst-Update (`git pull` + Neubau) unterbricht kurz die laufende Verbindung, während sich beide systemd-Dienste neu starten — die Seite lädt automatisch neu, sobald der Server wieder antwortet
- `sf-api` liefert keine lesbaren Item-Namen (nur numerische IDs/Enum-Typen) — die Ausrüstungs-Anzeige zeigt Slot, Item-Typ, Attribute und Qualität, keine Klarnamen
- Die täglichen Erträge sind bei Silber eine **Netto-Veränderung** pro Zeitfenster (kann Ausgaben wie Reparaturen/Shop-Käufe enthalten) — EP und Ehre sind exakt, da sie sich nur durch Kämpfe/Quests ändern; welche CLI-Befehle im selben Fenster liefen, wird zusätzlich angezeigt
- Kein Rate-Limiting auf Login/Passwort-Reset-Versuche — kein Schutz gegen Brute-Force, relevant vor allem falls das Dashboard je über das eigene LAN hinaus erreichbar gemacht wird

## Ressourcenverbrauch

**Test 1** — 4 vCPU / 8 GB RAM, 11 gleichzeitig laufende Accounts:

| Metrik | Wert |
|---|---|
| CPU-Auslastung | Load-Average 0,11–0,18 (4 Kerne) |
| RAM-Auslastung | ~217,6 MB von 8 GB |
| Bootdisk | 13 GB von 49 GB (28 %) |

**Test 2** — 1 vCPU / 1 GiB RAM (Proxmox-LXC-Container), 30 gleichzeitig laufende Accounts:

| Metrik | Wert |
|---|---|
| CPU-Auslastung | 2,82 % eines Kerns |
| RAM-Auslastung | 216,20 MiB von 1,00 GiB (21,11 %) |
| Bootdisk | 3,68 GiB von 7,78 GiB (47,36 %) |

## Tech-Stack

Node.js + Express (Backend), Vanilla JS mit ES-Modulen (Frontend, kein Build-Step), `node-pty` + `xterm.js` (Konsole), `chart.js` (Analysen/Erträge), `ws` (WebSocket), `better-sqlite3` (Ertrags-Tracking), `crypto` (Node-Bordmittel für Login-/Session-Hashing, keine zusätzliche Auth-Bibliothek). Die sf-api-Anbindung ist ein separater, zustandsloser Rust-Dienst (`sfapi-bridge/`, `axum` + [`sf-api`](https://github.com/the-marenga/sf-api)), der nur auf `127.0.0.1` lauscht.

## Danksagung

Dieses Dashboard existiert nur, weil andere die eigentliche Grundlagenarbeit geleistet haben:

- **[Mercy SF](https://mercysf.app)** (Sensei Issei) — die CLI/den Bot selbst, um den dieses Dashboard herum gebaut ist. Wer das Projekt unterstützen möchte: [Ko-fi](https://ko-fi.com/senseiissei).
- **[sf-api](https://github.com/the-marenga/sf-api)** (the-marenga) — die Rust-Bibliothek, über die dieses Dashboard Live-Daten (Ausrüstung, Gilde, Taverne, Mail) direkt vom Spieleserver abfragt.

## Lizenz

AGPLv3, siehe [LICENSE](LICENSE).
