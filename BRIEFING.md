# BRIEFING.md — HB Mieterportal

> **Zweck:** Lokaler Kommunikationskanal zwischen Cowork-Claude (Projektadmin), Gemini CLI und Claude Code.
> **Regel:** Nur die AKTUELLE Aufgabe steht hier. Nach Abschluss wird der Aufgabenbereich geleert.
> **Wichtig:** Diese Datei wird NICHT gepusht (.gitignore). Cowork-Claude pflegt diese Datei.

---

## Projekt-Kontext (permanent)

| | |
|---|---|
| **Live-URL** | https://portal.hausblick-fn.de/ |
| **GitHub** | https://github.com/HausBlick/Mieter-Portal |
| **Supabase ID** | `unprrlbvylmzxxhpfisr` |
| **Stack** | Supabase (PostgreSQL 17 + RLS) · Vanilla JS (ES6) · Tailwind CSS CDN · GitHub Pages |
| **PDF-Library** | `pdf-lib` (client-side). Briefbogen = Hintergrund-Layer aus `global_settings.letterhead_url` |
| **Schriftart** | Inter (Regular 400, SemiBold 600, Bold 700) — eingebettet via `fonts/Inter-*.ttf` |

**Design-System:** Vollständig spezifiziert in **`DESIGN.md`** (8 Brand-Farben + 2 semantische, Apple HIG-inspiriert)
**Rollen:** `admin` · `manager` · `owner` · `tenant` | Sonder: `advisory` (Beirat) · `landlord` (Vermieter)

---

## Vorgehen

1. **Cowork-Claude** schreibt die Aufgabe in den Abschnitt der zuständigen KI (unten)
2. **Niko** gibt der KI den Hinweis: `Lies BRIEFING.md — dort steht deine aktuelle Aufgabe.`
3. Die KI liest, arbeitet, und schreibt ihr Ergebnis/Feedback in den **Antwort-Block**
4. **Cowork-Claude** liest das Feedback und plant den nächsten Schritt

---

## GENERELLE REGELN FÜR CLAUDE CODE

1. **RLS-Policies NICHT anfassen!** Die RLS-Policies wurden manuell in Supabase mit `SECURITY DEFINER`-Funktionen repariert. Erstelle KEINE neuen und ändere KEINE bestehenden.
2. **Dateien NICHT abschneiden!** Du neigst dazu, bei Edits die letzten Zeilen langer Dateien abzuschneiden. **Prüfe nach JEDEM Edit**, dass die letzte Funktion der Datei vollständig vorhanden ist. Zähle die Zeilen vorher und nachher.
3. **CLAUDE.md immer mit committen** — nach jeder Modul-Änderung im selben Commit aktualisieren.

---

## Aufgabe Gemini CLI:

(Keine aktuelle Aufgabe)

---

### Antwort Gemini CLI

Hier ist das konzeptionelle Design für die 3 geforderten ETV-Bereiche (A, B, C):

---

## Aufgabe Claude Code:

### ETV-Ausbau: Individuelle Abstimmungen, Check-in & Protokoll-Tool (Phase 5.8)

Implementiere die folgenden drei konzeptionellen Erweiterungen im ETV-Modul. Setze sie iterativ um und ergänze zuerst das Datenbankschema über eine neue SQL-Migrationsdatei (z.B. `scripts/migration_etv_voting_protocol.sql`).

#### A) Individuelle Abstimmungen pro Eigentümer (Punkt 3)

**1. DB-Schema (Tabelle `etv_votes` erweitern):**
- Aktuell: `id, agenda_item_id, apartment_id, vote, weight_mea, created_at`
- **Neu hinzu:** `cast_by_person_id UUID REFERENCES persons(id)` – dokumentiert, wer die Stimme tatsächlich abgegeben hat (Eigentümer oder Vertreter).

**2. UI-Flow (Abstimmung):**
- Das System zeigt in der Abstimmungsphase pro TOP eine Liste **aller anwesenden (eingecheckten) Einheiten**.
- Für jede Einheit gibt es Radio-Buttons oder einen Toggle: `Ja | Nein | Enthaltung`.
- **Effizienz-Feature ("Einstimmiges JA"):** Ein Button "Alle auf JA setzen", der bei allen anwesenden Einheiten "Ja" vorauswählt. Der Verwalter muss dann nur noch abweichende Stimmen (Nein/Enthaltung) manuell umklicken.
- Beim Speichern (`_etvSaveVote()`) werden individuelle Zeilen in `etv_votes` geschrieben (eine pro Einheit).

#### B) Vollmachten beim Check-in (Punkt 6)

**1. DB-Schema (Tabelle `etv_attendance` erweitern):**
- Aktuell: `id, session_id, person_id, apartment_id, is_present, proxy_person_id, instructions`
- **Neu hinzu:** `proxy_name TEXT` – Fallback für externe Vertreter (die keinen Eintrag in `persons` haben). Alternativ wird auf `proxy_person_id` verzichtet und nur `proxy_name` genutzt, wenn die Verknüpfung nicht zwingend gebraucht wird (oft ist der Verwalter oder ein externer Dritter der Vertreter). *Entscheidung für Claude: `proxy_name TEXT` reicht völlig für das PDF-Protokoll.*

**2. UI-Flow (Check-in):**
- In der Check-in-Liste pro Einheit: Checkbox "Anwesend" ODER Toggle/Button "Vertreten durch...".
- Wird "Vertreten" gewählt, öffnet sich ein kleines Modal/Eingabefeld:
  - Name des Vertreters (Textfeld `proxy_name`, z.B. "Hausverwaltung" oder "Max Mustermann").
  - Optional: **Vorab-Weisungen (Instructions)** erfassen (Ja/Nein/Enthaltung pro TOP). Dies wird als JSON in `instructions` gespeichert: `{"top-1-uuid": "yes", "top-2-uuid": "no"}`.
- In der Abstimmungs-UI (aus Punkt A) werden die Stimmen für Einheiten, die Weisungen hinterlegt haben, automatisch ausgefüllt und farblich markiert (z.B. Schloss-Icon oder Hinweis "Gemäß Vollmacht").

#### C) Protokoll-Tool in der Durchführungsphase (Punkt 5)

**1. DB-Schema (`etv_sessions` & `etv_agenda_items` erweitern):**
- `etv_sessions` **neu hinzu:**
  - `chairman_name TEXT` (Versammlungsleitung, meist Verwalter)
  - `secretary_name TEXT` (Protokollführung)
  - `start_time TIME` (Tatsächlicher Beginn)
  - `end_time TIME` (Tatsächliches Ende)
  - `general_notes TEXT` (Allgemeine Bemerkungen zum Ablauf)
- `etv_agenda_items` **neu hinzu:**
  - `discussion_note TEXT` (Zusammenfassung der Diskussion VOR der Abstimmung). *Das bereits existierende `result_note` wird für die Begründung/Hinweise ZUM BESCHLUSS genutzt.*

**2. UI-Flow (Durchführung & Nachbereitung):**
- **Start der Versammlung:** Bevor der erste TOP bearbeitet wird, erscheint eine Formular-Maske zur Erfassung der Formalia (Startzeit `start_time`, Versammlungsleiter `chairman_name`, Protokollführer `secretary_name`, generelle Notizen).
- **Während der Versammlung:** In der Ansicht der einzelnen TOPs gibt es ein Textfeld für die "Diskussions-Notiz" (`discussion_note`) und ein Feld für das Beschlussergebnis (`result_note`).
- **Ende der Versammlung:** Unter den TOPs gibt es einen Button "Versammlung beenden". Dieser speichert automatisch die aktuelle Uhrzeit als `end_time` (Berliner Zeit) und schließt die Versammlung ab. Klickt man ihn, während noch TOPs auf 'pending' stehen, kommt ein Warnhinweis ("Es gibt noch unbearbeitete TOPs!").

**3. Struktur des fertigen Protokoll-PDFs (Hinweise für `utils-pdf.js`):**
1. **Briefkopf / Header:** "Niederschrift über die ordentliche Eigentümerversammlung der WEG [Name]" + Datum, Ort.
2. **Formalia:** Beginn, Ende, Versammlungsleiter, Protokollführer. Feststellung der ordnungsgemäßen Ladung.
3. **Beschlussfähigkeit:** "Anwesende und vertretene MEA: [X] / [Gesamt]. Die Versammlung ist beschlussfähig." (Aus Check-in-Daten generieren).
4. **Tagesordnungspunkte (Schleife über alle TOPs):**
   - **Titel:** "TOP 1: [Titel]"
   - **Diskussion:** [discussion_note] (nur wenn vorhanden)
   - **Antrag:** [proposed_resolution]
   - **Abstimmungsergebnis:**
     - Ja-Stimmen: [Summe MEA/Köpfe] (Namentlich/Einheiten: WE01, WE05...)
     - Nein-Stimmen: [Summe MEA/Köpfe] (Namentlich: WE02...)
     - Enthaltungen: [Summe MEA/Köpfe] (Namentlich: WE03...)
   - **Beschlussfassung:** "Der Antrag ist [angenommen/abgelehnt]." + [result_note]
5. **Schluss & Unterschriften:** Ort, Datum, Unterschriften-Linien für Versammlungsleiter, Protokollführer und mind. 1 Wohnungseigentümer/Beirat.

---

### Antwort Claude Code:

(leer)
