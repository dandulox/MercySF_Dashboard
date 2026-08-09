# Account-Analyse: Überlagerte Statistiken (Charakter- & Klassenvergleich)

**Datum:** 2026-08-09
**Status:** Genehmigt

## Ziel

Aktuell zeigt die "Analysen"-Seite pro Charakter je ein separates Chart pro Statistik-Feld
(Level, Erfahrung, Gold, Pilze, Ehre, Rang, Rüstung). Es gibt keine Möglichkeit, mehrere
Statistiken oder mehrere Charaktere in einem Chart zu überlagern, und keine Gruppierung
nach Spielklasse.

Neue Anforderung: eine eigene Seite "Account-Analyse" mit einem Filter-/Serien-System, mit
dem beliebige Kombinationen aus (Charakter oder Klasse) × (Statistik-Feld) als überlagerte
Linien in einem gemeinsamen Chart dargestellt werden können.

Die bestehende "Analysen"-Seite (Einzel-Account-Ansicht, Earnings-Chart, Aktionen-Tabelle)
bleibt unverändert bestehen.

## Datenmodell: Charakterklasse

Die Spielklasse (Krieger, Magier, Scout, Assassine, Waldläufer/Bard, Berserker,
Dämonenjäger, Druide, Paladin, Nekromant …) wird aktuell nirgends erfasst.

- **Neues Profilfeld** `characterClass` (string, z.B. `"Warrior"`) in `accountsRegistry.js`,
  einmalig ermittelt und dauerhaft gespeichert — die Klasse eines Charakters ändert sich nie.
- **sfapi-bridge (Rust, `sfapi-bridge/src/main.rs`)**: `StateResponse` bekommt ein neues Feld
  `character_class: String`, befüllt aus `character.class` (sf-api `Class`-Enum, per
  `format!("{:?}", ...)` wie bei `required_class` bei den Ausrüstungsgegenständen).
- **Backfill-Mechanismus:** Beim Laden der bestehenden Accounts-Seite (`accounts.js`) wird für
  jedes Profil, das Server+Charaktername+gespeichertes Passwort hat, aber noch keine
  `characterClass`, im Hintergrund (gestaffelt, nicht parallel) einmal
  `GET /api/gamestate/:profileId` aufgerufen. Aus der Antwort wird `characterClass` gelesen und
  über einen neuen Endpoint `PATCH /api/profiles/:id/class` dauerhaft im Profil gespeichert.
  Schlägt der Aufruf fehl (z.B. Bridge nicht erreichbar), wird es beim nächsten Laden der Seite
  erneut versucht.
- Profile ohne gespeichertes Passwort können nicht automatisch erkannt werden und bleiben
  `characterClass: null` ("Unbekannt"). Sie sind weiterhin einzeln als Charakter wählbar, tauchen
  aber nicht in der Klassen-Gruppierung auf.
- Manueller Fallback: Button "🔄 Klasse neu erkennen" auf jeder Profil-Karte in `accounts.js`,
  der denselben Backfill-Aufruf einzeln anstößt (für den Fall dauerhaft fehlgeschlagener
  Auto-Erkennung, z.B. Bridge zeitweise down).

## Neue Seite: "Account-Analyse"

Neuer Eintrag in der Navigation (`public/pages/`, Router-Registrierung analog zu den
bestehenden Seiten), Icon z.B. 🧬, Label "Account-Analyse".

### Filter-Leiste

- **Zeitraum:** Radio/Select mit drei Optionen:
  - `24h` — 5-Minuten-Buckets (max. 288 Punkte), wie im bestehenden
    `/api/analytics/:accountId`-Endpoint.
  - `7d` — Tages-Buckets.
  - `30d` — Tages-Buckets.
  - Tages-Aggregation nutzt dieselbe Logik wie der bestehende
    `/api/stats/:accountId/daily`-Endpoint (Referenz: `routes/analytics.js`,
    `statsDb.js`).
- **Serien-Baukasten:** Liste von "Serien", die der Nutzer per "+ Serie hinzufügen" aufbaut.
  Jede Serie hat:
  - **Zieltyp:** `Charakter` oder `Klasse`
  - **Ziel:** bei `Charakter` ein Dropdown mit allen Profilen (Nickname); bei `Klasse` ein
    Dropdown mit allen erkannten Klassen, die mindestens einen Charakter haben
  - **Feld:** Level, Erfahrung, Gold, Pilze, Ehre, Rang, Rüstung
  - Jede Serie ist einzeln entfernbar (✕-Button)
  - Mindestens eine Serie ist Pflicht, um das Chart zu rendern
- **Normalisieren-Toggle:** Checkbox "Werte als Index anzeigen (Start = 100)". Automatisch
  aktiviert (aber vom Nutzer abschaltbar), sobald mehr als ein unterschiedliches Feld in den
  aktiven Serien vorkommt — verschiedene Skalen (Level 0–800 vs. Gold in Millionen) wären
  sonst nicht sinnvoll überlagerbar. Normalisierung: pro Serie wird jeder Wert durch den
  ersten Wert der Serie geteilt und ×100 gerechnet.

### Chart

Ein Chart.js-Liniendiagramm (wie in `analytics.js` bereits genutzt, inkl. Theme-Handling via
`mercy-theme-change`), eine Linie pro Serie, Legende "Charname – Feld" bzw.
"Klasse (Σ) – Feld". Bei Silber wird wie in der bestehenden Seite von Silber auf Gold
umgerechnet (÷100), bevor normalisiert wird.

## Neuer Backend-Endpoint

`POST /api/analytics/compare`

**Request Body:**
```json
{
  "range": "24h" | "7d" | "30d",
  "series": [
    { "type": "account", "id": "<accountId>", "field": "level" },
    { "type": "class", "id": "Warrior", "field": "experience" }
  ]
}
```

**Verhalten:**
- `type: "account"` — liefert die Zeitreihe wie der bestehende
  `/api/analytics/:accountId`-Endpoint (gefiltert auf das angeforderte Feld und den Zeitraum).
- `type: "class"` — ermittelt alle Profile mit passender `characterClass`, lädt deren
  Zeitreihen für das Feld, und summiert pro Zeit-Bucket die Werte aller Accounts, die in
  diesem Bucket Daten haben. **Bekannte Einschränkung:** kein Auffüllen fehlender Werte
  (kein Forward-Fill) — fehlt ein Account in einem Bucket, wird er in diesem Bucket einfach
  nicht mitgezählt. Das ist für ein grobes Vergleichs-Chart ausreichend und hält die
  Implementierung einfach.
- Bei node-agent-Profilen (`profile.nodeId` gesetzt) wird wie beim bestehenden
  `/api/analytics/:accountId`-Endpoint an den zuständigen Node delegiert
  (`nodeClient.call`); der `compare`-Endpoint ruft dafür intern denselben Delegationspfad für
  jedes beteiligte Profil auf und aggregiert die Ergebnisse im Dashboard-Server.

**Response:**
```json
{
  "buckets": ["2026-08-08T10:00:00.000Z", ...],
  "series": [
    { "label": "Charname – Level", "values": [42, 43, ...] },
    { "label": "Warrior (Σ) – Erfahrung", "values": [123456, ...] }
  ]
}
```

## Grenzen / bewusst ausgeklammert

- Keine Persistenz der Serien-Konfiguration (kein "gespeicherte Ansichten"-Feature) — jede
  Session baut die Serien neu zusammen. Kann später ergänzt werden, falls gewünscht.
- Kein Forward-Fill bei Klassen-Aggregation (s.o.).
- Keine Änderung an der bestehenden "Analysen"-Seite.
