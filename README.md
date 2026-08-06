# Mercy SF Web-Dashboard

Ein Web-Dashboard für [Mercy SF](https://mercysf.app), das um die bestehende CLI herum gebaut ist — Übersicht, Steuerung und Analyse für alle Accounts direkt im Browser, statt über das Terminal-Menü.

Alles läuft auf Basis der offiziellen CLI. Es wird nichts am Bot selbst verändert, nur ein Interface drumherum gebaut.

## Installation

Auf einem frischen Debian/Ubuntu-Server, als root:

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash
```

Das Skript installiert alle Abhängigkeiten (Node.js, Build-Tools für native Module, die Mercy-SF-CLI), richtet ein selbstsigniertes TLS-Zertifikat ein und startet das Dashboard als systemd-Dienst. Danach ist es unter `https://<server-ip>:8080` erreichbar.

Erneutes Ausführen des Skripts aktualisiert nur Code und Dependencies — vorhandene Account-Daten, Zertifikate und die installierte CLI-Version bleiben unangetastet.

## Funktionen

- **Übersicht** — alle Accounts in einer Tabelle: Level, Silber, Pilze, Ehre, Rang, Arena-/Dungeon-Kämpfe des Tages, Live-Activity-Log
- **Account-Verwaltung** — einmal einloggen, alle Charaktere eines Logins werden automatisch über alle Server hinweg gefunden und als eigene Profile angelegt; Passwörter liegen AES-256-verschlüsselt auf der Platte; pro Account: Start/Stop/Pause
- **Eingebautes Web-Terminal** — pro Account eine eigene Konsolen-Session im Browser (xterm.js), inklusive automatisiertem Login-Durchklicken
- **Analysen** — Zeitreihen-Charts für Level, Erfahrung, Silber, Pilze, Ehre, Rang, Rüstung
- **Einstellungen** — alle Bot-Konfig-Schalter direkt im Browser lesbar und schreibbar, gruppiert nach Bereich
- **Benachrichtigungen** — erkennt Fehler/Warnungen automatisch aus dem Log-Output, Glocke mit Badge + Toast-Popups
- **Anonym-Modus** — Charakternamen verpixeln, z. B. für Screenshots/Streaming
- **Automatischer CLI-Update-Check** — 1×/Tag per MD5-Vergleich gegen die offizielle Download-Datei, Ein-Klick-Update direkt im Dashboard

## Bekannte Einschränkungen

Die CLI bietet keine offizielle Fernsteuerungs-API — sie ist als reines Text-Menü für interaktive Terminal-Nutzung gebaut. Alles an Automatisierung in diesem Dashboard basiert auf Pattern-Matching des Terminal-Outputs (`Select option:`, `Username:`, `Password:`, `Select character index:`, `Bot Menu` …). Ändert sich der Wortlaut eines CLI-Menüs, kann die Automatisierung brechen, bis der Code entsprechend angepasst wird. Weitere bekannte Lücken:

- Kein natives Pause-Kommando — "Pause" schaltet stattdessen alle aktiven `auto_*`-Konfig-Schalter aus; ob das eine bereits laufende Bot-Schleife sofort stoppt oder erst beim nächsten Durchlauf, ist nicht verifiziert
- Der Linux-Build der CLI schreibt keine `logs/`- oder `battle_history/`-Dateien auf die Platte — das Dashboard behilft sich mit einem In-Memory-Ringpuffer aus dem Live-Terminal-Output, eine dauerhafte Kampfhistorie-Seite gibt es deshalb (noch) nicht
- Keine offizielle Versions-/Update-API — der Update-Check vergleicht MD5-Hashes gegen die öffentliche Download-Datei
- Kein Login-Schutz vor dem Dashboard selbst — gedacht für den Betrieb im eigenen, vertrauenswürdigen Netz

## Tech-Stack

Node.js + Express (Backend), Vanilla JS mit ES-Modulen (Frontend, kein Build-Step), `node-pty` + `xterm.js` (Konsole), `chart.js` (Analysen), `ws` (WebSocket).

## Lizenz

GPLv3, siehe [LICENSE](LICENSE).
