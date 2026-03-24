# Briefing für Gemini CLI: Neues Umsetzungs-Paket — Verteilerschlüssel

> Dieses Dokument ist ein Briefing für Gemini CLI.
> Aufgabe: Lies alles durch, stelle ggf. Rückfragen, und schreibe dann ein vollständiges
> Umsetzungs-Paket für Claude Code in die GEMINI.md (inkl. Update-Log-Eintrag).

---

## Kontext & Hintergrund

Wir bauen das HausBlick Mieterportal — eine WEG-Hausverwaltungs-Plattform.
Das Finanzmodul (Phase 6) ist weitgehend fertig: Doppelte Buchführung, Kontenrahmen,
Wirtschaftsplan, Jahresabrechnung, Mahnwesen, SEPA-Export sind implementiert.
Admin-Einstellungen (7.1) und die Letter Engine Basis (6.9) sind ebenfalls fertig implementiert.

Das nächste kritische Feature ist das **Verteilerschlüssel-Management**. Es ist die
Voraussetzung für das finale PDF-Design der Abrechnungen (Wirtschaftsplan, Hausgeldabrechnung).

---

## WICHTIG: Briefbogen ist bereits vollständig gestaltet

Der Briefbogen (Letterhead) von HB Verwaltung existiert bereits als fertiges Design-Asset
und enthält alle statischen Firmendaten:

- **Logo** (HB Haus-Icon + "Verwaltung" Schriftzug in hb-olive)
- **Firmenname:** Nikola Krnic / HB Verwaltung
- **Adresse:** Marie-Curie-Platz 6, 88046 Friedrichshafen
- **Kontakt:** hausblick-fn.de | info@hausblick-fn.de | 07541 55925 85 | @hb.verwaltung
- **Bankdaten:** BUNQ | IBAN: DE66 3701 9000 1011 2458 40 | BIC: BUNQDE82
- **Steuernummer:** 61161/00103

**Konsequenz für die Implementierung:**
Das System muss diese Daten NICHT aus der Datenbank generieren oder dynamisch befüllen.
Die `company_settings`-Tabelle braucht nur:
- `letterhead_url` (Pfad zum Briefbogen-Bild in Supabase Storage)
- Ggf. `signature_name` (falls der Unterzeichner je nach Dokument variiert)

**PDF-Generierungslogik:**
Das Briefbogen-Bild wird als Hintergrundebene geladen. Die Letter Engine
legt den **dynamischen Inhalt** (Empfängeradresse, Datum, Dokumenttitel, Tabellen,
Beträge, Gesamtsummen) auf einer zweiten Ebene darüber. Der Inhaltsbereich
ist das große weiße Feld mit der olive Randlinie links — dort wird der Content platziert.

---

## Was ein Verteilerschlüssel ist (rechtlicher Kontext)

Ein Verteilerschlüssel definiert, wie Gemeinschaftskosten einer WEG auf die einzelnen
Wohnungseinheiten umgelegt werden. Die gesetzliche Grundlage ist **§ 16 WEG**, reformiert
durch das **WEMoG 2020** (seit 01.12.2020).

**Kernregeln:**
- Standard-Schlüssel ist der Miteigentumsanteil (MEA)
- Seit WEMoG 2020: Änderungen per einfachem Mehrheitsbeschluss möglich (kein Notar nötig)
- **Heizkostenverordnung (HeizKV):** Heizkosten MÜSSEN zu 50–70 % nach Verbrauch und
  30–50 % nach Wohnfläche verteilt werden — kein reiner MEA-Schlüssel erlaubt
- Änderungen gelten nur prospektiv, niemals rückwirkend

---

## Die 7 Schlüssel-Typen die das System unterstützen muss

### Standard-Typen (vordefiniert, nicht löschbar)

| # | Typ-ID | Name | Beschreibung | Typisches Beispiel |
|---|--------|------|--------------|-------------------|
| 1 | `mea_full` | Miteigentumsanteil (voll) | Alle Einheiten inkl. Garagen/Stellplätze | Versicherungen, Verwaltungshonorar, Rücklagen |
| 2 | `mea_residential` | MEA Wohneinheiten | MEA nur für Wohneinheiten (ohne GA/TG) | Aufzug, Allgemeinstrom |
| 3 | `mea_no_garage` | MEA ohne Garage | MEA ohne Garagen/Tiefgaragen | Objektspezifisch |
| 4 | `unit_count` | Anzahl Einheiten | Gleichverteilung nach Anzahl WE | Müllgebühren, Hausmeister |
| 5 | `living_area` | Wohnfläche (m²) | Anteilig nach Quadratmetern | Gartenpflege, Treppenreinigung |
| 6 | `consumption` | Verbrauch | Nach Zählerstand (Heizung, Wasser) | Heizkosten (HeizKV-Pflicht) |
| 7 | `fixed_amount` | Festbetrag | Fixer Euro-Betrag (z.B. aus Vorjahres-Abrechnung) | Techem-Abrechnung, Pauschalbeträge |

### Benutzerdefinierte Schlüssel (frei anlegbar pro Gebäude)

Der Verwalter muss **eigene Schlüssel pro Gebäude** anlegen können, wenn die
Standard-Typen nicht ausreichen. Typische Beispiele aus der Praxis:

- "MEA Tiefgarage" (nur TG-Einheiten)
- "Anzahl Personen" (für Wasserverteilung)
- "Frontlänge" (für Straßenreinigung nach laufenden Metern)
- "Nutzfläche Gewerbe" (für Mischobjekte Wohnen+Gewerbe)

Ein benutzerdefinierter Schlüssel hat immer:
- Einen frei wählbaren Namen
- Einen Basis-Typ (einer der 7 oben)
- Eine Gesamtumlage (z.B. 1000 bei MEA, oder 37 bei 37 Einheiten)
- Individuelle Anteile pro Einheit (die Summe muss die Gesamtumlage ergeben)

---

## HeizKV-Sonderfall: Doppelschlüssel

Für Heizkosten und Warmwasser gelten Pflicht-Splits. Ein Konto muss zwei
Schlüssel gleichzeitig haben können:

**Beispiel:**
- Konto "Heizkosten" → 60 % nach Verbrauch + 40 % nach Wohnfläche
- Das System berechnet: `Gesamtkosten × 60 %` → nach Verbrauch verteilen,
  `Gesamtkosten × 40 %` → nach Wohnfläche verteilen, dann addieren

Die Datenbankstruktur muss diese Aufteilung (primary_key + secondary_key + split_percentage)
abbilden können.

---

## Umlagefähigkeit — die kaufmännisch wichtigste Zweiteilung

Jedes Konto im System ist bereits als `is_apportionable` (umlagefähig für Mieter) oder
nicht markiert (bestehende `accounts`-Tabelle). Diese Zweiteilung muss in der
Wirtschaftsplan-Ansicht klar getrennt ausgewiesen werden — exakt wie im Immoware24-Beispiel:

```
Sektion A: umlagefähig (Mieter)
  → Heizkosten, Wasser, Hausreinigung, Müll...
  → Diese Kosten darf der Eigentümer auf Mieter umlegen

Sektion B: nicht umlagefähig (Mieter)
  → Verwaltungshonorar, Rücklagenbildung, Instandhaltung...
  → Diese Kosten trägt der Eigentümer selbst
```

---

## Datenbankstruktur (Empfehlung für Claude Code)

### Neue Tabelle: `distribution_keys`

```sql
CREATE TABLE distribution_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- z.B. "MEA WE", "MEA ohne GA", "Anzahl Einheiten WE"
  type TEXT NOT NULL,                    -- enum: mea_full | mea_residential | mea_no_garage |
                                         --       unit_count | living_area | consumption |
                                         --       fixed_amount | custom
  total_value NUMERIC(12,4) NOT NULL,    -- Gesamtumlage (z.B. 1000.00 bei MEA, 37 bei Einheiten)
  description TEXT,                      -- optionaler Erläuterungstext
  is_system_default BOOLEAN DEFAULT false, -- true = Standard-Typ, false = benutzerdefiniert
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Neue Tabelle: `distribution_key_units`

Speichert den individuellen Anteil jeder Einheit an einem Schlüssel:

```sql
CREATE TABLE distribution_key_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_key_id UUID NOT NULL REFERENCES distribution_keys(id) ON DELETE CASCADE,
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  value NUMERIC(12,4) NOT NULL,         -- Anteil dieser Einheit (z.B. 13.74 von 1000 MEA)
  UNIQUE(distribution_key_id, apartment_id)
);
```

### Erweiterung: Tabelle `accounts`

Bestehende Spalten müssen um Schlüssel-Verknüpfung erweitert werden:

```sql
ALTER TABLE accounts ADD COLUMN primary_key_id UUID REFERENCES distribution_keys(id);
ALTER TABLE accounts ADD COLUMN secondary_key_id UUID REFERENCES distribution_keys(id);
ALTER TABLE accounts ADD COLUMN secondary_key_percentage NUMERIC(5,2);
-- Beispiel: primary_key_id = "Verbrauch", secondary_key_id = "Wohnfläche", secondary_key_percentage = 40.00
-- = 60% nach Verbrauch, 40% nach Wohnfläche (HeizKV)
```

---

## UI-Vorgaben

### Tab "Verteilerschlüssel" im Gebäude-Detail

Der neue Tab wird als 4. oder 5. Tab im Gebäude-Detail (`mod-objekte.js`) eingefügt.

**Ansicht: Liste der Schlüssel**
- Tabelle mit Spalten: Nr. | Name | Typ | Gesamtumlage | Einheiten konfiguriert | Aktionen
- Badge "System" bei Standard-Typen (grau, nicht löschbar)
- Badge "Custom" bei benutzerdefinierten Schlüsseln (olive)
- "Neuer Schlüssel"-Button oben rechts

**Modal: Schlüssel anlegen / bearbeiten**
- Felder: Name (Text), Typ (Dropdown mit den 7 Typen), Gesamtumlage (Zahl), Beschreibung
- Nach dem Speichern: Direkter Wechsel zur Einheiten-Konfiguration

**Ansicht: Einheiten-Anteile konfigurieren**
- Tabelle aller Einheiten des Gebäudes mit Eingabefeld für den Anteil
- Live-Summe unten: "Summe: 987,50 / 1000,00" — rot wenn nicht korrekt, grün wenn korrekt
- "Automatisch befüllen"-Button für Standard-Typen (z.B. MEA aus `apartments.mea_numerator`)
- Speichern nur möglich wenn Summe = Gesamtumlage (Validierung)

### Schlüssel-Zuweisung im Kontenplan

Im Tab "Konten" der Finanzen-Ansicht (`mod-finanzen.js`):
- Jedes Konto bekommt ein Dropdown "Primärer Schlüssel" (alle Schlüssel des Gebäudes)
- Optional: Checkbox "HeizKV-Split" → zeigt zweites Dropdown + Prozentfeld für Sekundärschlüssel
- Vorschau: "60% nach Verbrauch + 40% nach Wohnfläche"

---

## Design-Vorgaben (HausBlick CI)

Gleiche Formensprache wie alle anderen Module:
- Cards: `rounded-[15px]`, Card-Titelleisten `bg-hb-olive text-white`
- Tabellen: Header `bg-gray-50 text-xs font-bold text-gray-500`
- Trennlinien: `divide-y divide-hb-olive/10`
- Validierungs-Feedback: Summe korrekt = `text-green-600`, falsch = `text-hb-orange`
- Bearbeiten-Buttons: `text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg`
- Löschen-Buttons: `text-xs text-hb-orange px-3 py-1.5 rounded-lg`

---

## Offene Entscheidungen für Gemini

1. **Initialbefüllung:** Sollen bei der Anlage eines Gebäudes automatisch die 7
   Standard-Schlüssel vorbelegt werden (leer, ohne Einheiten-Anteile), oder erst
   auf Wunsch des Verwalters?

2. **Leerstand:** Wenn eine Einheit keinen Mieter hat — soll ihr Anteil im Schlüssel
   trotzdem geführt werden (der Eigentümer zahlt) oder ausgeblendet?

3. **Schlüssel-Historisierung:** Wenn ein Schlüssel geändert wird (WEMoG: nur prospektiv),
   brauchen wir eine Versionierung? Oder reicht es, dass alte Abrechnungs-Snapshots
   die damaligen Werte eingefroren haben?

4. **Gewerbe-Sonderfall:** Sollen gemischte Objekte (Wohnen + Gewerbe) in Phase 1
   bereits unterstützt werden, oder als späteres Modul behandelt werden?

5. **PDF-Generierung — Technik:** Der Briefbogen ist als fertiges Bild vorhanden (in
   Supabase Storage). Wie soll die Letter Engine den Content-Layer erzeugen?
   Option A: HTML → CSS → Puppeteer/headless Chrome → PDF (höchste Designfreiheit)
   Option B: jsPDF direkt im Browser (kein Server nötig, aber weniger Flexibilität)
   Option C: Supabase Edge Function mit einem PDF-Generator (serverside)
   Empfehlung von Niko ist Option A oder B — bitte Empfehlung machen.

---

## Aufgabe für Gemini

Bitte integriere dieses Paket in die `GEMINI.md`:
- Aktualisiere den `0. Update-Log` mit einer kurzen Zusammenfassung
- Füge das Paket als neues Unterkapitel in Phase 6 ein (z.B. "6.10 Verteilerschlüssel-Management")
- Beantworte die offenen Entscheidungen unter Punkt "Offene Entscheidungen" mit deiner
  Empfehlung, bevor du schreibst
- Stelle sicher, dass das Format der Übergabe dem Standard entspricht:
  1. Ziel, 2. Anforderungen, 3. DB-Änderungen, 4. UI-Vorgaben, 5. Offene Entwickler-Entscheidungen
