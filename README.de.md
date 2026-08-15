*[🇬🇧 English](README.md) | [🇩🇪 Deutsch](README.de.md)*

# Mercy SF Web-Dashboard

Ein Web-Dashboard für [Mercy SF](https://mercysf.app), das um die bestehende CLI herum gebaut ist — Übersicht, Steuerung und Analyse für alle Accounts direkt im Browser, statt über das Terminal-Menü. Zusätzlich holt es über [sf-api](https://github.com/the-marenga/sf-api) von the-marenga Live-Daten (Ausrüstung, Gilde, Taverne, Mail) direkt vom Spieleserver.

Alles läuft auf Basis der offiziellen CLI. Es wird nichts am Bot selbst verändert, nur ein Interface drumherum gebaut.

> ⚠️ **Experimentell, Nutzung auf eigenes Risiko.** Dieses Dashboard befindet sich in aktiver Entwicklung, es kann Fehler enthalten. Außerdem: Automatisiertes Spielen (Botting) verstößt in der Regel gegen die Nutzungsbedingungen von Shakes & Fidget — es besteht grundsätzlich das Risiko einer Account-Sperrung, unabhängig davon, ob die Automatisierung über dieses Dashboard oder direkt über die CLI läuft. Nutzung auf eigene Verantwortung.

## Installation

Auf einem frischen Debian/Ubuntu-Server, als root:

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash
```

Das Skript installiert alle Abhängigkeiten (Node.js, Rust/Cargo für die sf-api-Bridge, Build-Tools für native Module, `wireguard-tools`/`resolvconf` für VPN-Unterstützung, die Mercy-SF-CLI), richtet ein selbstsigniertes TLS-Zertifikat ein und startet Dashboard sowie sf-api-Bridge als systemd-Dienste. Danach ist es unter `https://<server-ip>:8080` erreichbar — beim ersten Aufruf führt eine Setup-Seite durch das Anlegen des einen Dashboard-Zugangs.

Erneutes Ausführen des Skripts aktualisiert nur Code und Dependencies — vorhandene Account-Daten, Zertifikate und die installierte CLI-Version bleiben unangetastet.

### Mehrere Server (Nodes)

Ein Dashboard kann Accounts auf mehreren, physisch getrennten Servern steuern, statt nur auf dem, auf dem es selbst installiert ist. Dafür läuft auf jedem weiteren Server ein schlanker **Node-Agent** (kein eigenes Web-UI, keine sf-api-Bridge) — Installation genauso einfach wie das Dashboard selbst:

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --node
```

Am Ende zeigt das Skript die IP-Adresse und einen 15 Minuten gültigen Pairing-Code an (bei Bedarf erneut einsehbar über `journalctl -u mercy-node-agent`). Im Dashboard unter **System-Einstellungen → Node** → „Node pairen“ IP, Port (Standard `8090`) und Code eingeben — danach lässt sich beim Anlegen eines Accounts (oder nachträglich über das Dropdown an jedem Account-Profil) auswählen, auf welchem Node er läuft. Start/Stop/Status/Einstellungen/Kampfhistorie/„Einlösen“/Web-Terminal/Statistiken/Analysen funktionieren für Node-Accounts identisch zu lokalen Accounts, laufen aber transparent über den jeweiligen Node-Agent. Im **Node**-Tab lässt sich außerdem pro Node die CLI-Version prüfen/aktualisieren und der Node-Agent selbst per Klick aktualisieren (`git pull` + Neustart des Dienstes) — beides ohne SSH-Zugriff auf den jeweiligen Server. Die Übersichtsseite zeigt zusätzlich eine Node-Karte: Klick auf einen Node blendet dessen Accounts mit Level/Gold/Ehre direkt ein.

Für den Fall, dass sich ein Bot oder ein ganzer Node mal aufgehängt hat, gibt es auf der **Nodes**-Seite pro Node eine Schnellsteuerung: nur die aktiven Bot-Sessions neu starten, den Node-Agent-Dienst neu starten, oder den kompletten Server rebooten (`systemctl reboot`) — zuletzt laufende Bots werden danach automatisch wieder gestartet, kein manuelles Nachklicken nötig. Ping zeigt jetzt sichtbar Online/Offline samt Antwortzeit an, und eine grobe Auslastungsanzeige (CPU-Load, RAM-Auslastung, Uptime) läuft mit. Das Dashboard selbst taucht dabei ebenfalls als Node in der Liste auf (Server, auf dem das Dashboard installiert ist) — dieselbe Schnellsteuerung, Updates und Auslastungsanzeige funktionieren also auch für den Dashboard-Server selbst, nicht nur für angebundene Nodes.

### Deinstallation

```bash
curl -fsSL https://raw.githubusercontent.com/dandulox/MercySF_Dashboard/main/install.sh | bash -s -- --uninstall
```

Entfernt **alles**: alle systemd-Dienste (Dashboard, sf-api-Bridge und/oder Node-Agent, je nachdem was installiert ist), den kompletten `/opt/mercy`-Ordner inkl. Code, Zertifikate, CLI-Binary, gespeicherte Bot-Zugangsdaten, Dashboard-Zugang und die Ertrags-Statistik-Datenbank. Kein Zwischenschritt, keine Rückfrage — vor dem Ausführen sicher sein, dass wirklich alles weg soll. Läuft derselbe Befehl auf einem Node-Server, entfernt er dort entsprechend nur den Node-Agent.

## Funktionen

- **Nodes (Multi-Server)** — Accounts müssen nicht auf dem Server laufen, auf dem das Dashboard selbst installiert ist: weitere Server bekommen einen schlanken Node-Agent, werden per IP + zeitlich begrenztem Pairing-Code mit dem Dashboard verbunden und tauchen danach als Zielauswahl beim Anlegen/Verschieben eines Accounts auf. Steuerung, Konsole, Einstellungen, Kampfhistorie, tägliche Erträge und Analysen laufen für Node-Accounts genauso wie für lokale, transparent über den jeweiligen Node-Agent abgefragt. CLI-Version und Node-Agent-Software lassen sich pro Node direkt aus dem Dashboard heraus prüfen und aktualisieren, ohne SSH. Ping zeigt Online/Offline samt Antwortzeit, eine Auslastungsanzeige (CPU-Load, RAM, Uptime) läuft mit, und eine Schnellsteuerung erlaubt bei hängenden Bots/Servern einen gezielten Neustart (nur die Bot-Sessions, den Node-Agent-Dienst, oder den kompletten Server per Reboot — zuletzt laufende Bots starten danach automatisch wieder). Das Dashboard selbst erscheint dabei ebenfalls als Node in der Liste, mit derselben Steuerung für den eigenen Server. Verwaltet unter **System-Einstellungen → Node**, zusammen mit VPN und dem globalen Panel-Intervall. Die Übersichtsseite zeigt zusätzlich eine Node-Karte mit Online/Offline-Status, die sich pro Node zu einer Mini-Accountliste (Level/Gold/Ehre) aufklappen lässt
- **VPN (ProtonVPN/WireGuard)** — WireGuard-Profile (Upload einer `.conf`-Datei) werden zentral im Dashboard verwaltet und pro Ziel zugewiesen — dem lokalen Server oder einem einzelnen Node. Verbinden/Trennen läuft transparent über den jeweiligen Node-Agent, oder lokal über `wg-quick`. Pro Ziel ist ein Gate-Modus wählbar: **Aus** (keine Prüfung), **Blockieren** (Bot-Start wird verweigert, solange keine VPN-Verbindung steht) oder **Auto-Connect** (Bot-Start verbindet das zugewiesene Profil zuerst automatisch) — die Prüfung läuft sowohl im Dashboard, für lokale Accounts, als auch im Node-Agent selbst, für Node-Accounts, ohne Dashboard-Roundtrip. Ein „Öffentliche IP prüfen“-Button bestätigt, dass der Traffic tatsächlich durch den Tunnel läuft, und auf den Node-Karten zeigt ein VPN-Active/Inactive-Badge den Status auf einen Blick
- **Einstellungs-Panel** — Bot-Einstellungen und System-Einstellungen liegen in einem rechten Slide-out-Panel mit Tabs (aufrufbar über ein Zahnrad-Icon in der Topbar), statt eigene Seiten in der Hauptnavigation zu belegen; jede Einstellungsgruppe ist einspaltig und einzeln ein-/ausklappbar
- **Übersicht** — modulare, ein-/ausklappbare Karten (Zustand bleibt gespeichert): Accounts-Tabelle, Charakter-Stats, Ausrüstung, Gilde, Mail, Kampfhistorie — und seit der letzten Überarbeitung die Taverne (inkl. Abenteuerlust als Balkenanzeige) als Unterabschnitt der Charakter-Karte statt eigener Karte, sowie Letzte Aktionen, Zuletzt gescoutet und das rohe Activity-Log nebeneinander in einer kompakten Dreispalten-Reihe
- **Account-Verwaltung** — einmal einloggen, alle Charaktere eines Logins werden automatisch über alle Server hinweg gefunden und als eigene Profile angelegt; Passwörter liegen AES-256-verschlüsselt auf der Platte. Accounts erscheinen als filterbares Kachel-Raster (Suche nach Name/Server, Filter nach Status oder Klasse); der primäre Start/Stop-Button bleibt auf der Kachel, während Zusatzaktionen (Pause/Fortsetzen/Einlösen/Klasse erkennen/Konsole/Node verschieben/Löschen) und die Session-Statistiken hinter einem „⋯"-Overflow-Popup liegen, damit die Kacheln kompakt bleiben. Die Konsole öffnet als eigenes Popup-Fenster statt die Kachel aufzuklappen. Charaktere, die beim letzten Neustart/Update noch liefen, starten danach automatisch wieder (zeitversetzt, damit nicht alle gleichzeitig einloggen)
- **Account-Randomizer** — plant automatisch, wann welches Login bottet, statt manuell Start/Stop zu klicken, mit zwei Modi pro Login: **Manuell** (Gesamtstunden/Tag, Blockanzahl 1-4 und Stadtwache-Pulse 1-5 festlegen — nur das Timing wird täglich neu ausgewürfelt) oder **Willkür** (alles, inklusive Stunden/Blöcke/Pulse, wird jeden Tag neu ausgewürfelt). Aktivierte Accounts werden nach Priorität sortiert und automatisch auf alle Online-Nodes (+ Lokal) verteilt, minus einen für Stadtwache reservierten Node; jeder Node arbeitet seine zugeteilten Accounts strikt nacheinander ab — nie parallel — da ein Node immer nur eine VPN-Identität gleichzeitig halten kann. Jeder Account kann ein eigenes VPN-Profil bekommen (oder explizit kein VPN); beim Wechsel zum nächsten Account auf einem Node wird die vorherige VPN-Verbindung aktiv getrennt und die neue verbunden, bevor gestartet wird — inklusive Aktualisierung, auf welchen Node die Charaktere des Accounts tatsächlich routen. Alle Stadtwache-Pulse aller Accounts teilen sich eine gemeinsame, nach Priorität sortierte Warteschlange auf dem Reserve-Node. Ein Chip in der Topbar zeigt, wie viele Accounts den Randomizer aktiv haben und wie viele im heutigen Plan noch ausstehen; ein optionaler „Hart durchsetzen"-Schalter stoppt bei jedem Check aktiv alles außerhalb des Plans, statt eine bereits laufende Session bis zu ihrem nächsten geplanten Übergang in Ruhe zu lassen
- **Eingebautes Web-Terminal** — pro Account eine eigene Konsolen-Session im Browser (xterm.js), inklusive automatisiertem Login-Durchklicken
- **Live-Spieldaten über sf-api** — Ausrüstung (Slot/Typ/Attribute/Qualität), Gilde (Ehre, Rang, Mitgliederliste), Taverne (Abenteuerlust, aktuelle Aktion, verfügbare Quests) und Mail/Postfach werden direkt vom Spieleserver abgefragt (read-only, ein zustandsloser Rust-Dienst nur auf localhost); wie oft dabei nachgefragt wird, ist unter **System-Einstellungen** als globales Panel-Intervall einstellbar (Standard 10 Minuten, 1×/Stunde, 1×/Tag)
- **Kampfhistorie** — echte, vom CLI-Prozess lokal aufgezeichnete Kämpfe (Gegner, Arena/Dungeon/Sammelalbum, Sieg/Niederlage, EP/Gold/Ehre) über den nicht-interaktiven CLI-Befehl `--history`
- **Tägliche Erträge** — SQLite-gestützte Auswertung, wie viel EP/Gold/Ehre ein Account pro Tag erwirtschaftet, plus eine Liste einzeln erkannter Kampf-Fenster (Arena/Dungeon), gespeist aus den ohnehin laufend geschriebenen CLI-Analytics-Dateien — keine zusätzlichen Logins gegen den Spieleserver nötig
- **Analysen** — Zeitreihen-Charts für Level, Erfahrung, Gold, Pilze, Ehre, Rang, Rüstung; die Charakter-Auswahl lässt sich sortieren (Name/Klasse/Server) und über Sichtbarkeits-Chips (Klasse/Server) filtern, damit sie bei vielen Accounts übersichtlich bleibt
- **Einstellungen** — alle Bot-Konfig-Schalter direkt im Browser lesbar und schreibbar, gruppiert nach Bereich. Lesen läuft über den nicht-interaktiven CLI-Befehl `--config`; Schreiben der von der CLI selbst als offiziell änderbar gemeldeten `auto_*`-Schalter läuft über den unterstützten `--config --set`-Weg, alle übrigen Felder (Zahlen, Strings) weiterhin über die Config-Datei, da die CLI dafür noch keinen Weg anbietet. Zusätzlich **Einstellungs-Vorlagen**: aktuelle Konfiguration eines Charakters als Vorlage speichern und auf beliebig viele andere Charaktere anwenden (legt deren Config bei Bedarf auch neu an), oder eine Vorlage direkt aus einer hochgeladenen Backup-Datei der Windows-App importieren — Felder, die die jeweils andere Version nicht kennt, werden gefiltert bzw. automatisch mit zuvor aus echten Accounts gelernten Standardwerten aufgefüllt
- **Marktplatz** — eine Einstellungs-Vorlage (Titel, mehrzeilige Beschreibung, Charakterklasse, Tags) in einen gemeinsamen, opt-in Katalog auf einem zentralen Collector veröffentlichen; von anderen Spielern veröffentlichte Vorlagen durchsuchen, filtern und mit einem Klick importieren. Eine Vorlage kann optional mit einem echten Charakter verknüpft werden (über einen anonymisierten Account-Hash, nie eine rohe Account-Kennung), um aggregierte Statistiken (Level, Gold, Arena-Siegquote) neben dem Eintrag anzuzeigen. Doppelte Konfigurationen werden beim Veröffentlichen abgelehnt, der ursprüngliche Veröffentlicher kann die Metadaten einer Vorlage später über einen Owner-Token bearbeiten. Anzeige als Kachel-Raster mit Detail-Popup; Instanzen, die sich nicht mehr melden, wandern nach drei Tagen in eine separate Inaktiv-Liste statt sofort zu verschwinden
- **Bug-Reports** — ein „Bug melden"-Tab im Einstellungs-Panel schickt einen Titel/Beschreibung/Schweregrad-Report an einen zentralen Collector, inklusive automatisch angehängtem Diagnose-Snapshot (Instanz-ID, Dashboard-Version, Laufzeit sowie pro Node Name/Host/CLI-Version/Zuletzt-gesehen/Status), damit ein Problem ohne Hin-und-Her eingeordnet werden kann. Reports werden als Tickets mit Status (offen/in Bearbeitung/gelöst/wird nicht behoben) verfolgt; Node-Name und -Host werden in der Ticket-Ansicht maskiert angezeigt, nicht im Klartext
- **Benachrichtigungen** — erkennt Fehler/Warnungen automatisch aus dem Log-Output, Glocke mit Badge + Toast-Popups
- **Anonym-Modus** — Charakternamen verpixeln, z. B. für Screenshots/Streaming
- **Mobile-Ansicht** — vollständig nutzbar auf dem Smartphone: Navigation als ausklappbares Menü, Tabellen/Konsole passen sich der Bildschirmbreite an
- **Automatischer Update-Check für CLI und Dashboard** — der BOT-ENGINE-Kasten in der Sidebar zeigt permanent den Status beider Komponenten ("Up To Date" / "Update Available"): die CLI wird 1×/Tag per MD5-Vergleich gegen die offizielle Download-Datei geprüft, das Dashboard selbst 1×/Tag gegen den neuesten Commit auf GitHub. Ein Klick auf "Update" installiert automatisch (`git pull` + Neubau + Neustart beim Dashboard, Download + Austausch beim CLI-Binary) — die Seite lädt danach selbstständig neu. Die laufende Dashboard-Version steht zusätzlich im Sidebar-Footer.
- **Login/Zugangsschutz** — genau ein Dashboard-Zugang (Single-Admin), erster Besuch nach der Installation führt zur Setup-Seite; dort werden einmalig der AES-Schlüssel (verschlüsselt die gespeicherten Bot-Zugangsdaten) und ein 12-Wort-Wiederherstellungsschlüssel angezeigt (mit Pflicht-Bestätigung und Druck-Option), über den sich das Passwort später ohne E-Mail zurücksetzen lässt. Passwort-ändern und Logout direkt im Dashboard.
- **Anonyme Nutzungsstatistik (Opt-out)** — das Dashboard kann einen anonymen Ping (eine zufällige Instanz-ID, Laufzeit, Anzahl verbundener Nodes und — separat abschaltbar — Dashboard-/Node-Versionsnummern) an einen zentralen Collector senden, rein für Installationsstatistiken; über diesen Kanal verlassen niemals Account-Daten, Zugangsdaten oder Charakterinformationen das Dashboard. Einstellbar unter System-Einstellungen

## Bekannte Einschränkungen

Seit Version 2.13.0 bietet die CLI einen dokumentierten, nicht-interaktiven JSON-Modus (`--user`/`--character`/`--password-stdin`), den das Dashboard für Einstellungen, Kampfhistorie und "Einlösen" nutzt. Der eigentliche Bot-Start/Login-Ablauf im Web-Terminal läuft aber weiterhin über das klassische interaktive Text-Menü — dafür basiert die Automatisierung nach wie vor auf Pattern-Matching des Terminal-Outputs (`Select option:`, `Username:`, `Password:`, `Select character index:`, `Bot Menu` …). Ändert sich dort der Wortlaut eines CLI-Menüs, kann die Automatisierung brechen, bis der Code entsprechend angepasst wird. Weitere bekannte Lücken:

- Kein natives Pause-Kommando — "Pause" schaltet stattdessen alle aktiven `auto_*`-Konfig-Schalter aus; ob das eine bereits laufende Bot-Schleife sofort stoppt oder erst beim nächsten Durchlauf, ist nicht verifiziert
- Nur ~20 `auto_*`-Schalter sind über die CLI selbst offiziell änderbar (`--config --set`) — alle übrigen Einstellungsfelder (Zahlen, Strings, restliche Booleans) schreibt das Dashboard weiterhin direkt in die Config-Datei, da die CLI dafür noch keinen unterstützten Weg anbietet
- Keine offizielle Versions-/Update-API für die CLI — der Update-Check vergleicht MD5-Hashes gegen die öffentliche Download-Datei
- Ein Dashboard-Selbst-Update (`git pull` + Neubau) unterbricht kurz die laufende Verbindung, während sich beide systemd-Dienste neu starten — die Seite lädt automatisch neu, sobald der Server wieder antwortet
- `sf-api` liefert keine lesbaren Item-Namen (nur numerische IDs/Enum-Typen) — die Ausrüstungs-Anzeige zeigt Slot, Item-Typ, Attribute und Qualität, keine Klarnamen
- Die täglichen Erträge sind bei Gold eine **Netto-Veränderung** pro Zeitfenster (kann Ausgaben wie Reparaturen/Shop-Käufe enthalten) — EP und Ehre sind exakt, da sie sich nur durch Kämpfe/Quests ändern; welche CLI-Befehle im selben Fenster liefen, wird zusätzlich angezeigt
- Kein Rate-Limiting auf Login/Passwort-Reset-Versuche — kein Schutz gegen Brute-Force, relevant vor allem falls das Dashboard je über das eigene LAN hinaus erreichbar gemacht wird
- Das eigentliche Activity-Log (Rohzeilen) auf der Übersichtsseite bleibt für Node-Accounts leer — der PTY-Output eines Nodes läuft nicht durch den lokalen Log-Ringpuffer des Dashboards. "Letzte Aktionen"/"Zuletzt gescoutet" auf den Account-Karten, Analysen, tägliche Erträge und die Node-Karte auf der Übersicht funktionieren dagegen auch für Node-Accounts, da diese Daten aktiv vom jeweiligen Node abgefragt werden, nicht aus dem PTY-Log mitgelesen
- Ein Node-Agent akzeptiert immer nur genau ein gepairtes Dashboard gleichzeitig — erneutes Pairen (z. B. mit einem neuen Code) trennt ein zuvor verbundenes Dashboard kommentarlos
- Ein Node-Agent-Selbst-Update prüft den aktuell ausgecheckten Git-Branch gegen GitHub — das setzt voraus, dass dieser Branch auch tatsächlich auf GitHub existiert (bei einem lokalen/nicht gepushten Branch schlägt die Prüfung fehl, statt „kein Update“ zu melden)
- Das Verbinden der VPN für das Ziel **lokal** leitet den kompletten Traffic dieses Servers durch den Tunnel, nicht nur den des Bots, da `AllowedIPs` im WireGuard-Profil `0.0.0.0/0`/`::/0` ist — das betrifft auch die eigene Verbindung des Dashboards; ein falsch konfigurierter oder nicht erreichbarer VPN-Endpunkt kann das Dashboard selbst kappen
- Ein Node-Agent verbindet immer nur ein VPN-Profil gleichzeitig (entspricht dem einen aktiven WireGuard-Interface auf dem Server) — wird demselben Node-Ziel ein zweites Profil zugewiesen, wechselt nur, welches davon aktiv ist
- Die Auslastungsanzeige (CPU/RAM) auf der Nodes-Seite nutzt nur Node-Bordmittel (`os`-Modul, kein natives Addon) — reicht für einen groben Überblick, ist aber keine präzise Systemmetrik
- "Server neu starten" auf der Nodes-Seite führt einen echten `systemctl reboot` aus — auch für den Dashboard-Server selbst, wenn man ihn dort als lokalen Eintrag auswählt. Es gibt außer dem Bestätigungsdialog im Browser keine weitere Sicherung, entsprechend mit Bedacht einsetzen

## Ressourcenverbrauch

**Test 1** — 4 vCPU / 8 GB RAM, 11 gleichzeitig laufende Accounts:

| Metrik | Wert |
|---|---|
| CPU-Auslastung | 1,8 % |
| RAM-Auslastung | 217,6 MB von 8 GB (2,72 %) |
| Bootdisk | 13 GB von 49 GB (28 %) |

**Test 2** — 1 vCPU / 1 GB RAM (Proxmox-LXC-Container), 30 gleichzeitig laufende Accounts:

| Metrik | Wert |
|---|---|
| CPU-Auslastung | 2,82 % |
| RAM-Auslastung | 226,7 MB von 1,07 GB (21,11 %) |
| Bootdisk | 3,95 GB von 8,35 GB (47,36 %) |

## Tech-Stack

Node.js + Express (Backend), Vanilla JS mit ES-Modulen (Frontend, kein Build-Step), `node-pty` + `xterm.js` (Konsole), `chart.js` (Analysen/Erträge), `ws` (WebSocket), `better-sqlite3` (Ertrags-Tracking), `crypto` (Node-Bordmittel für Login-/Session-Hashing, keine zusätzliche Auth-Bibliothek). Die sf-api-Anbindung ist ein separater, zustandsloser Rust-Dienst (`sfapi-bridge/`, `axum` + [`sf-api`](https://github.com/the-marenga/sf-api)), der nur auf `127.0.0.1` lauscht. Für Multi-Server-Setups gibt es zusätzlich `node-agent/` — eine eigenständige, minimale Node.js + Express/`ws`-App (eigenes `package.json`, kein Rust, kein Frontend), die auf entfernten Servern läuft und sich per IP + Pairing-Code mit dem Dashboard verbindet (Bearer-Token-Auth nach dem Pairing).

## Danksagung

Dieses Dashboard existiert nur, weil andere die eigentliche Grundlagenarbeit geleistet haben:

- **[Mercy SF](https://mercysf.app)** (Sensei Issei) — die CLI/den Bot selbst, um den dieses Dashboard herum gebaut ist. Wer das Projekt unterstützen möchte: [Ko-fi](https://ko-fi.com/senseiissei).
- **[sf-api](https://github.com/the-marenga/sf-api)** (the-marenga) — die Rust-Bibliothek, über die dieses Dashboard Live-Daten (Ausrüstung, Gilde, Taverne, Mail) direkt vom Spieleserver abfragt.

## Lizenz

AGPLv3, siehe [LICENSE](LICENSE).
