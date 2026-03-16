# CLAUDE.md — HB-Mieterportal
> Single Source of Truth für Claude Code (Terminal). Immer aktuell halten nach jeder Phase.

---

## 1. Projekt & URLs

| | |
|---|---|
| **Live-URL** | https://portal.hausblick-fn.de/ |
| **GitHub** | https://github.com/HausBlick/Mieter-Portal |
| **Supabase Projekt-ID** | `unprrlbvylmzxxhpfisr` |
| **Supabase URL** | `https://unprrlbvylmzxxhpfisr.supabase.co` |
| **Anon Key** | `sb_publishable_nWYozmRQq8E17z_ljZ2SHA_LUulwUV1` |

---

## 2. Tech-Stack

- **Backend / DB / Auth:** Supabase (PostgreSQL 17, RLS)
- **Frontend:** HTML5, Vanilla JavaScript, Tailwind CSS (via CDN)
- **Hosting:** GitHub Pages (Push auf `main` → live)

---

## 3. Design-System

| Token | Wert | Verwendung |
|---|---|---|
| `hb-olive` | `#687451` | Primärfarbe, Buttons, aktive Tabs |
| `hb-offblack` | `#373737` | Haupttext, Überschriften |
| `hb-ultralight` | `#F9FAF8` | App-Hintergrund |
| `hb-orange` | `#EB762D` | Akzentfarbe, Warnungen |

- **Cards:** `rounded-[15px]`, `box-shadow: 0 4px 20px -2px rgba(0,0,0,0.03)`
- **Inputs:** Hintergrund `#F9FAF8`, Border `#e5e7eb`, Focus-Ring hb-olive (10% Opacity)
- **Typografie:** Inter (Google Fonts)

---

## 4. Rollen & Berechtigungen (`profiles.role`)

| Rolle | Beschreibung |
|---|---|
| `admin` | Vollzugriff auf alle Objekte, Mandanten, Finanzen, Tickets |
| `manager` | Vollzugriff, limitiert auf zugewiesene Gebäude (`management_assignments`) |
| `owner` | Lesend: eigene Einheiten, WEG-Dokumente, optional eigene Mieter |
| `tenant` | Lesend: eigener Mietvertrag, Dokumente, Schwarzes Brett. Darf Tickets erstellen |

---

## 5. Frontend-Struktur

```
dashboard.html              # HTML-Shell (~130 Zeilen)
js/
  config.js                 # Supabase-Client, globale Vars, Icons
  utils.js                  # Toast, Dropdown, Logout, Mobile-Menu
  nav.js                    # init(), renderNav(), setActiveNav(), loadNavBadges()
  modules/
    mod-dashboard.js        # Dashboard — KPIs, Quick-Actions, Widgets (rollenbasiert)
    mod-objekte.js          # Gebäude & Einheiten (CRUD + Zuweisungen)
    mod-personen.js         # Personen-Liste & Supabase-Anbindung
    mod-persons-edit.js     # Personen bearbeiten (4-Tab-Formular)
    mod-news.js             # Schwarzes Brett (Feed, Like, Read-Tracking, Erstellen)
    mod-tickets.js          # Ticket-System (Chat, Status-Flow, Suche, Auto-Reopen)
    mod-dokumente.js        # Dokumenten-Cloud (Upload, Download, Vorschau, Kategorien)
    mod-kontakte.js         # Kontaktbuch (Handwerker, Notfallkontakte, Dienstleister)
    mod-kalender.js         # Monatskalender — Gebäude-Fristen & Ticket-Wiedervorlagen
    mod-placeholder.js      # Platzhalter für kommende Module
```

### Design-Konventionen (aktuell gültig)
- **Card-Titelleisten:** `bg-hb-olive`, Text `text-sm font-bold text-white` (kein uppercase), `+`-Buttons `bg-white text-hb-olive`
- **Tabellen-Header:** `bg-gray-50 text-xs font-bold text-gray-500` (grau, kein uppercase)
- **Tabellen-Trennlinien:** `divide-y divide-hb-olive/10`
- **"Bearbeiten"-Buttons:** `text-xs text-hb-olive bg-hb-ultralight px-3 py-1.5 rounded-lg hover:bg-gray-100`
- **"Löschen"/"Entfernen"-Buttons:** `text-xs text-hb-orange px-3 py-1.5 rounded-lg hover:bg-hb-orange/5`
- **Card-Border:** `border: 1px solid rgba(104,116,81,0.2)` + `overflow: hidden`
- **Nav-Links:** Farbe `#687451`, aktiv: `bg-hb-olive text-white`
- **Filter-Chips auf olive Hintergrund:** aktiv `bg-white text-hb-olive border-white`, inaktiv `text-white border-white/50`
- **Supabase-Joins mit mehreren FKs:** immer expliziten FK-Hint verwenden, z.B. `profiles!uploaded_by(full_name)`

---

## 6. Datenbankschema (30 Tabellen, alle RLS)

`profiles`, `buildings`, `apartments`, `persons`, `tenancies`, `ownerships`, `management_assignments`, `tickets`, `ticket_messages`, `news`, `news_likes`, `documents`, `document_reads`, `document_links`, `contacts`, `meters`, `meter_readings`, `invitations`, `building_bank_accounts`, `building_insurances`, `board_members`, `service_providers`, `person_bank_accounts`

**Phase 6-A Finanztabellen:**
`accounts`, `journal_entries`, `budget_plans`, `budget_plan_items`, `payment_demands`, `special_levies`, `dunning_notices`, `beirat_access_periods`

**Wichtige Architektur:**
- Auth-User getrennt von CRM (`persons`) — Verknüpfung über `persons.auth_user_id` + `invite_code`
- `tenancies.tenant_id` → `persons.id` (nicht `auth.uid()`)
- Historisierung: `tenancies` + `ownerships` mit `start_date` / `end_date`
- **Doppelte Buchführung (GoBD):** `journal_entries` mit DB-RULES (`journal_no_update`, `journal_no_delete`) — keine Bearbeitung/Löschung möglich, nur Storno
- `accounts.building_id = NULL` → globale Kontenrahmen-Vorlage; `building_id != NULL` → gebäudespezifisch

---

## 7. Migrations-Historie

| Version | Name | Beschreibung |
|---|---|---|
| 20260313111823 | cleanup_duplicate_rls_policies | Doppelte RLS bereinigt |
| 20260313111831 | add_missing_fk_indexes | Performance-Indexes auf FK |
| 20260313111841 | fix_function_search_path | Security-Warnings behoben |
| 20260313112747 | baseline_schema | Vollständiges Baseline-Schema |
| Phase 2 | extend_persons_crm | `is_company`, `company_name`, `salutation`, `birthdate`, `tax_id` zu `persons` |
| Phase 2 | extend_apartments_mea | `mea_numerator`, `mea_denominator` zu `apartments` |
| Phase 3 | extend_apartments_warm_water_meter | `meter_water_warm`, `meter_water_warm_calibration` zu `apartments` |
| Phase 4 | phase4_news_and_tickets | `news`-Spalten, `news_reads`, `tickets.snooze_until`, `ticket_messages.is_system_message` |
| Phase 5 | phase5_documents | `documents` um 11 Spalten erweitert, `document_reads.downloaded_at`, RLS-Policies, `profiles.role`-Constraint auf 4 Rollen erweitert |
| Phase 5b | phase5b_document_links | `document_links`-Tabelle (Personen-Scope), `documents` um `original_filename`, `document_title`, `generated_filename` erweitert, RLS für `unit`- und `person`-Scope |
| Bugfix | fix_document_reads_legacy_trigger | Legacy-Trigger `trg_document_reads_sync_legacy` + Funktionen entfernt — verursachte 400-Fehler bei jedem `document_reads`-INSERT (uuid[] vs jsonb Typ-Konflikt) |
| Phase 6-A | phase6a_finance_foundation | 8 Finanztabellen: `accounts` (Kontenrahmen, 17 System-Konten), `journal_entries` (GoBD-konform, No-Update/No-Delete-Rules), `budget_plans`+`budget_plan_items` (Wirtschaftsplan), `payment_demands` (Sollstellungen), `special_levies` (Sonderumlagen), `dunning_notices` (Mahnwesen 3-stufig), `beirat_access_periods` (Beirat-Lesezugriff). 5 Performance-Indexes. |

---

## 8. Projektplan & Status

### ✅ Phase 1 — Tech-Debt & Infrastruktur (ABGESCHLOSSEN)
- 1.1 RLS-Policies bereinigt ✅
- 1.2 Performance-Indexes angelegt ✅
- 1.3 Supabase Security-Warnings behoben ✅
- 1.4 Migration-Files eingeführt ✅
- 1.5 Frontend modularisiert (dashboard.html → Module) ✅

### ✅ Phase 2 — Personen-CRM (ABGESCHLOSSEN)
- 2.1 Supabase-Anbindung (Mock-Daten ersetzt) ✅
- 2.2 Neue Person anlegen ✅
- 2.3 Person bearbeiten — 4-Tab-Formular (Stammdaten / Rollen / Portal / SEPA) ✅
- 2.4 Einladungscode generieren 💡 (→ verschoben nach 7.4)

### ✅ Phase 3 — Objekte & Zuweisungen (ABGESCHLOSSEN)
- 3.1 Eigentümer-Zuweisung (`ownerships`) ✅
- 3.2 Mieter-Zuweisung (`tenancies`) ✅
- 3.3 Gebäude-Detail: 4 Tabs (Stammdaten / Finanzen / Grundbuch / Technik & Fristen) ✅
- 3.4 Einheiten-Detail: 5 Tabs + Breadcrumb + Tabellen-Ansicht ✅
- 3.5 Zählerstände UI 💡 (→ verschoben nach 6.8)

### ✅ Phase 4 — Kommunikation (ABGESCHLOSSEN)
- 4.1 Schwarzes Brett (`mod-news.js`): Feed, Filter-Chips, Neu-Badge, Like-Toggle, Read-Tracking, Erstell-Modal ✅
- 4.2 Ticket-System (`mod-tickets.js`): Zwei-Spalten-Layout, Chat-Bubbles, Info-Sidebar ✅
- 4.3 Status-Flow: Offen → In Bearbeitung → Warte auf Rückmeldung → Wiedervorlage → Erledigt ✅
- 4.4 Wiedervorlage/Snooze mit Auto-Reset ✅
- 4.5 Auto-Reopen bei Mieter/Eigentümer-Antwort ✅
- 4.6 Ticket-Suche (RLS-sicher) ✅
- 4.7 Eskalation owner → Verwalter mit Systemnachricht ✅
- 4.8 Deep-Links: Gebäude, Einheit, Person aus Ticket-Detail ✅
- 4.9 Mobile Navigation (3-Zustands-Flow) ✅

### ✅ Phase 5 — Dokumente & Kontakte (TEILWEISE ABGESCHLOSSEN)
- 5.1 Dokumenten-Cloud — Migration `phase5_documents` ✅
- 5.2 Dokumenten-Cloud — `mod-dokumente.js`: Upload, Download, Vorschau, Kategorien, Read-Tracking, Nav-Badge, Listen- & Baumansicht, Draft-Workflow, Auto-Naming, `document_links` für Personen-Scope ✅
- 5.3 Kontaktbuch — `mod-kontakte.js` ✅
- 5.4 Dashboard KPIs (rollenbasiert, Kennzahlen, Fristen-Widget) ✅

### 🔄 Phase 6 — Finanzen & Abrechnung
*Kernmodul: Wirtschaftsplan, Hausgeldabrechnung, Erhaltungsrücklage.*
- 6-A DB-Fundament: Doppik, Kontenrahmen, Journal, Sollstellungen ✅
- 6.1 Wirtschaftsplan (Planung laufender Kosten pro WEG) 📋
- 6.2 Jahresabrechnung / Hausgeldabrechnung (Kostenverteilung nach MEA & Schlüsseln) 📋
- 6.3 Erhaltungsrücklage (Zuführungen, Entnahmen, Ausweis in Abrechnung) 📋
- 6.4 **CSV-Bankimport** (MT940/CSV-Upload → Transaktionen einlesen & zuordnen) 📋
- 6.5 **Mahnwesen** (mehrstufig, automatisch auf Basis offener Posten) 📋
- 6.6 **DATEV-Export** (CSV/JSON im DATEV-Format für Steuerberater) 📋
- 6.7 **Pro-rata-temporis Umlage** (zeitanteilige Abrechnung bei Mieterwechsel) 📋
- 6.8 **Zählerstände UI** (aus Phase 3.5 verschoben, wird für Abrechnung benötigt) 📋

### 💡 Phase 7 — Automatisierung & Erweiterungen
*Nach Projektabschluss — optionale Nachrüstung.*
- 7.1 **Umlaufbeschluss-Modul** (digitale Abstimmung ohne Video, Protokoll-PDF) 💡
- 7.2 **KI-Belegerfassung** (PDF-Upload → OCR via Google Document AI → Buchungsvorschlag) 💡
- 7.3 **Messdienstleister CSV-Import** (Techem/Ista Ablesewerte als CSV importieren) 💡
- 7.4 **Einladungscode UI** (aus Phase 2.4 verschoben) 💡
- 7.5 **Kalender-Ausbau**: manuelle Einträge, Wartungstermine, iCal-Export (.ics) für Sync mit Google/Apple/Outlook 💡

---

## 9. Bewusste Nicht-Ziele

> Funktionen, die bewusst aus dem Scope ausgeschlossen wurden — um Komplexität zu begrenzen und den Fokus auf den Kernnutzen zu halten.

| # | Nicht-Ziel | Begründung |
|---|---|---|
| 1 | **PSD2 / Open-Banking-Direktanbindung** | BaFin-Lizenz erforderlich; CSV-Import (6.4) reicht für die Zielgruppe |
| 2 | **EBICS-Schnittstelle** | Unverhältnismäßig für Zielgruppe; Bankvertrag + Zertifikate nötig |
| 3 | **Native Mobile Apps (iOS/Android)** | Web-App ist 100% responsiv — kein App-Store-Overhead |
| 4 | **Blockchain / unveränderliche Protokolle** | Anderes Geschäftsmodell; erhöht Komplexität ohne nachgewiesenen Nutzen |
| 5 | **Messdienstleister-API (Techem/Ista)** | Proprietärer ARGE-Standard; CSV-Import (7.3) ist pragmatischer Kompromiss |

---

## 10. Kommunikationsprotokoll (Triade)

| Rolle | Aufgabe |
|---|---|
| **Gemini (Architekt)** | Konzeption, Wireframes, DB-Design, Prozesslogik |
| **Claude (Developer)** | Code (HTML/JS/SQL), Refactoring, Debugging, Supabase |
| **Nutzer (Product Owner)** | Steuert Prozess, testet, transportiert zwischen Gemini & Claude |

**Übergabe-Format (Gemini → Claude):**
```
[UMSETZUNGS-ÜBERGABE FÜR CLAUDE]
1. Ziel
2. Anforderungen
3. DB-Änderungen
4. UI-Vorgaben
5. Offene Entwickler-Entscheidungen
```

---

## 11. Interaktionsstil (Regeln für Claude)

- **Eine Frage auf einmal** — iteratives Interview-Verfahren bei Unklarheiten
- **Kurz & präzise** — kein unnötiges Ausholen
- **Rating** — jede Antwort mit `Rating: X%` abschließen
- **Sprache** — strikt Deutsch
- **CLAUDE.md immer mit committen** — nach jeder Modul-Änderung CLAUDE.md im selben Commit aktualisieren (Changelog, Schema, Phasen-Status)

---

## 12. Projekt-Tagebuch (Changelog)

> Kurze, chronologische Dokumentation aller durchgeführten Änderungen.
> Ziel: Für Gemini, Claude und den Nutzer jederzeit nachvollziehbar was wann gebaut wurde.
> Format: Nach jeder Phase aktualisieren. Offene Punkte mit 🔴 markieren.

---

### Phase 1 — Tech-Debt & Infrastruktur

| # | Was wurde gemacht |
|---|---|
| 1 | RLS-Policies bereinigt — doppelte und ineffiziente Policies zusammengeführt |
| 2 | Performance-Indexes auf alle Foreign Keys angelegt (`building_id`, `tenant_id` etc.) |
| 3 | Supabase Security-Warnings behoben: `search_path` gesetzt, Passwort-Leak-Protection konfiguriert |
| 4 | Migration-Files eingeführt — alle Schema-Änderungen als SQL-Files versioniert |
| 5 | `dashboard.html` (700+ Zeilen) in Module aufgeteilt: `config.js`, `utils.js`, `nav.js`, `mod-*.js` |

---

### Phase 2 — Personen-CRM
**Commits:** `3d951de`, `695c95e`

| # | Was wurde gemacht |
|---|---|
| 1 | Migration: Felder `is_company`, `company_name`, `salutation`, `birthdate`, `tax_id` zu `persons` |
| 2 | Migration: Felder `mea_numerator`, `mea_denominator` zu `apartments` |
| 3 | `mod-personen.js`: Mock-Daten durch echte Supabase CRUD-Operationen ersetzt |
| 4 | `mod-persons-edit.js` (neu): 4-Tab-Formular — Stammdaten, Rollen, Portal-Status, SEPA-Bankdaten |
| 5 | CLAUDE.md erstellt und ins Repo eingecheckt |

---

### Phase 3 — Objekte & Zuweisungen
**Commits:** `28b8842`, `2cf5054`, `92bed53`, `b54f195`

| # | Was wurde gemacht |
|---|---|
| 1 | Migration: `meter_water_warm` + `meter_water_warm_calibration` zu `apartments` |
| 2 | Gebäude-Detail: 4 Tabs (Stammdaten / Finanzen inkl. Bankkonten-CRUD / Grundbuch / Technik & Fristen) |
| 3 | Einheiten-Detail: 5 Tabs (Stammdaten / Abrechnung MEA / Finanzen / Zähler / Rechtliches & Personen) |
| 4 | Zuweisungs-Modal: Autocomplete-Suche, Quick-Create, Speichern in `ownerships`/`tenancies`, Deep-Links |
| 5 | UX-Überarbeitung: Read-only Info-Ansicht + "Bearbeiten"-Button trennt Ansicht von Edit-Modus |
| 6 | Einheiten von Cards auf Tabelle umgestellt (Nr., Typ, Lage, m², Hausgeld, Status) |
| 7 | Gebäude-Sidebar schmaler, Hover-Highlighting, Live-Suchfeld |
| 8 | Menüpunkt: "Bestandsobjekte" → "Gebäude & Einheiten" |
| 9 | Layout-Optimierung: Tab-Content `max-height: 25vh`, Einheitenliste `flex-grow` ✅ |

---

### Phase 4 — Kommunikation: Schwarzes Brett & Ticket-System
**Commits:** `9682a6b`, `d103a5f`, `89ae299`, `19a4922`, `2a8a996`, `ed2f907`, `28aa1f9`, `5ff7ad5`

| # | Was wurde gemacht |
|---|---|
| 1 | Migration `phase4_news_and_tickets`: `news`-Felder, `news_reads`, `tickets.snooze_until`, `ticket_messages.is_system_message` |
| 2 | `mod-news.js` (neu): News-Feed-Grid, Filter-Chips, Neu-Badge, Like-Toggle, Read-Tracking, Erstell-Modal |
| 3 | `mod-tickets.js` (neu): Zwei-Spalten-Layout, Chat-Bubbles (hb-olive / grau), Info-Sidebar |
| 4 | Status-Flow, Wiedervorlage-Snooze, Auto-Reopen, Ticket-Suche, Eskalation |
| 5 | Deep-Links: Gebäude, Einheit, Person aus Ticket-Detail erreichbar |
| 6 | Bugfix: `mod-placeholder.js` hat Module überschrieben — bereinigt |
| 7 | Personen-Infokarte: klickbare Tabellenzeile → read-only Modal + "Bearbeiten"-Button |
| 8 | RLS-Bugfix: Manager konnten Personen/Bankkonten nicht lesen — separate Policies ergänzt |
| 9 | Rich-Text-Editor im News-Modal (B, I, H2, Listen via `execCommand`) |
| 10 | Realtime-Chat in Tickets via `postgres_changes` INSERT-Subscription |
| 11 | Mobile Navigation: 3-Zustands-Flow (Sidebar → Liste → Detail) |
| 12 | Logo/Titel klickbar → navigiert zu Dashboard |

---

### Projekttag 3 — Dokumenten-Cloud Bugfixes & Konzept-Update

**Phase A — Bugfixes**
**Commits:** `45c3672`

| # | Was wurde gemacht |
|---|---|
| 1 | Typ-Mismatch behoben: DB-Integer-ID vs. HTML-String in `onclick` — `_docsById()` mit `==` |
| 2 | Download, Modal-Öffnung, Archivieren und Read-Tracking funktionieren jetzt korrekt |
| 3 | SVG-Icons in Aktionsspalte: Auge (Anzeigen) + Download-Pfeil statt Text-Buttons |
| 4 | Draft-Workflow: "Als Entwurf speichern"-Checkbox im Upload-Modal |
| 5 | Entwürfe sichtbar für Admin/Manager mit orangem "Entwurf"-Badge + "Freigeben"-Button |
| 6 | Entwürfe-Filter in Kategorie-Sidebar mit orange Badge-Zähler |
| 7 | Lesbare Dateinamen im Storage: `{timestamp}_{originalname}` statt Random-Hash |

**Phase 5.5 — Kalender**

| # | Was wurde gemacht |
|---|---|
| 1 | `mod-kalender.js` (neu): Monatskalender mit Prev/Next-Navigation, „Heute"-Sprung |
| 2 | Gebäude-Fristen als farbige Pills (Rot <14 Tage, Orange 14–30, Grün >30) |
| 3 | Legionellen-Fälligkeit berechnet aus `last_legionella_check + interval_months` |
| 4 | Ticket-Wiedervorlagen als kleinere olive Pills (nur eigene Tickets: creator oder assigned) |
| 5 | Klick auf Ticket-Pill → navigiert direkt zum Ticket-Chat |
| 6 | Nav-Eintrag „Kalender" (mit Icon) für admin/manager unter „Service & Dokumente" |
| 7 | `config.js`: Kalender-Icon ergänzt |
| 8 | Dashboard KPI „Anstehende Fristen" → navigiert jetzt zum Kalender statt zu scrollen |
| 9 | Legende unterhalb des Kalenders (Farb-Erklärung + Ticket-Wiedervorlage) |
| 10 | Klick auf Deadline-Pill öffnet Popup: Frist-Typ, Gebäude, Datum, Dringlichkeit + „Zum Gebäude"-Button |
| 11 | Popup schließt bei Klick außerhalb; Positionierung neben dem geklickten Element |

**Phase 5.4 — Dashboard KPIs**

| # | Was wurde gemacht |
|---|---|
| 1 | `mod-dashboard.js` vollständig implementiert (Platzhalter ersetzt) |
| 2 | **Admin/Manager**: Quick-Actions (4 Buttons), KPI-Karten (Offene Tickets, In Bearbeitung, Entwürfe, Fristen), 4 Widgets |
| 3 | Widget: Prioritäts-Tickets (5 neueste Offen/In Bearbeitung, klickbar → Ticket-Chat) |
| 4 | Widget: Warten auf Freigabe (Entwürfe, Freigeben-Button inline ohne Seitennavigation) |
| 5 | Widget: Ablaufende Fristen (energy_certificate, fire_safety, drinking_water, legionella berechnet, Farb-Badges Rot/Orange/Grün) |
| 6 | Widget: Letzte Aktivitäten (ticket_messages + news + documents, merged & sortiert) |
| 7 | **Tenant/Owner**: Begrüßung mit Rolle, Quick-Actions (3 Buttons), KPI-Karten (Tickets, Neue Docs, Ungelesene News, Hausgeld/Miete) |
| 8 | Widget: Aktuelle Meldungen (3 neueste News des eigenen Gebäudes) |
| 9 | Widget: Meine Tickets (offene Tickets, klickbar → Ticket-Chat) |
| 10 | Widget: Neue Dokumente (ungelesene Docs mit Download-Button + Read-Tracking) |
| 11 | Widget: Mein Ansprechpartner (Verwalter/Hausmeister aus contacts, tel:/mailto:-Links) |
| 12 | Navigation-Helpers (`_dashGoTickets`, `_dashNewTicket`, `_dashGoDocs` etc.) setzen auch aktiven Nav-Link |

**Phase B — Nav-Badge Bugfix**

| # | Was wurde gemacht |
|---|---|
| 1 | Root-Cause-Analyse: `document_reads`-INSERT schlug mit 400 fehl wegen Legacy-Trigger `trg_document_reads_sync_legacy` (versuchte `uuid[]` in `jsonb`-Spalte `documents.read_by` zu schreiben) |
| 2 | Migration `fix_document_reads_legacy_trigger`: Trigger + beide Hilfsfunktionen gedroppt |

**Phase C — Konzept-Update (Dokumenten-Cloud Erweiterung)**

| # | Was wurde gemacht |
|---|---|
| 1 | Migration `phase5b_document_links`: `document_links`-Tabelle (Personen-Scope), neue Spalten `original_filename`, `document_title`, `generated_filename` in `documents`, aktualisierte RLS-Policies |
| 2 | **Ansichts-Toggle**: Listen- und Baumansicht (Building → Apartment → Category → Dokumente), nur für Admin/Manager |
| 3 | **Baumansicht** (`_buildTreeHtml`): aufklappbare Knoten via `_docsState.treeOpen` (Set), Kollaps-Status bleibt beim Re-Render erhalten |
| 4 | **Per-File-Staging**: jede Datei im Upload-Modal bekommt eigenes Titelfeld (`_docsState.stagingFiles: [{file, title}]`) |
| 5 | **Kaskadierendes Scope-UI** (`_docsUpdateScopeFields`): `building` → nur Gebäude; `unit` → + Wohnung; `person` → + Personen-Multiselect |
| 6 | **Auto-Naming on Publish** (`_publishDoc`): `generated_filename = [file_number] [apt_number] - [document_title].[ext]` aus `buildings.file_number` + `apartments.apartment_number` |
| 7 | **document_links-Management** im Bearbeiten-Modal: Personen hinzufügen/entfernen, die Zugriff auf ein Dokument haben |
| 8 | Anzeige-Name-Priorität in Tabelle: `generated_filename` → `document_title` → `title` |

---

### Phase 6-A — Finanzen DB-Fundament

| # | Was wurde gemacht |
|---|---|
| 1 | Migration `phase6a_finance_foundation` angewendet (8 neue Tabellen, alle mit RLS) |
| 2 | `accounts`: Kontenrahmen (WEG-spezifisch, SKR03/04-angelehnt), 17 System-Vorlagen-Konten (1200–8410), `building_id = NULL` = globale Vorlage |
| 3 | `journal_entries`: GoBD-konformes Buchungsjournal, DB-RULES verhindern UPDATE/DELETE — nur Storno erlaubt |
| 4 | `budget_plans` + `budget_plan_items`: Wirtschaftsplan pro Gebäude & Geschäftsjahr |
| 5 | `payment_demands`: Sollstellungen (hausgeld / sonderumlage / abrechnungsspitze / mahnung) |
| 6 | `special_levies`: Sonderumlagen mit Verteilungsschlüsseln (MEA / Einheiten / m² / custom) |
| 7 | `dunning_notices`: 3-stufiges Mahnwesen (Zahlungserinnerung / Mahnung / Letzte Mahnung) |
| 8 | `beirat_access_periods`: Zeitfenster für Beirat-Lesezugriff pro Geschäftsjahr |
| 9 | 5 Performance-Indexes auf häufig gefilterte Spalten (`building_id`, `fiscal_year`, `status`) |

---

### Projekttag 2 — UI-Overhaul & Phase 5
**Commits:** `(UI-Overhaul)`, `f2ef175`, `9281293`

| # | Was wurde gemacht |
|---|---|
| 1 | **Globaler UI-Overhaul:** Card-Borders olive, Card-Titelleisten `bg-hb-olive` in allen Modulen, Nav-Link-Farbe olive, Header-Padding reduziert |
| 2 | Tabellen-Header zurück auf Grau (`bg-gray-50 text-gray-500`), kein uppercase — konsistent in allen Modulen |
| 3 | `+`-Buttons auf olive Hintergrund → `bg-white text-hb-olive` |
| 4 | Tabellen-Trennlinien → `divide-y divide-hb-olive/10`; "Löschen"-Buttons → `text-hb-orange` |
| 5 | `nav.js`: "Hallo, " entfernt (nur Vorname), "Ticket System" → "Tickets", Kontaktbuch in Kommunikation für alle Rollen |
| 6 | `mod-news.js`: rollenbasierte Beschreibung, olive Filter-Chips, "Mehr lesen →"-Link, Like-Button ohne Text |
| 7 | `mod-tickets.js`: Ticket-Liste als Tabelle, "Von mir"/"An mich"-Badges (olive/orange), Filter-Reihenfolge angepasst |
| 8 | `mod-persons-edit.js`: Beirat + Dienstleister im Rollen-Tab ergänzt |
| 9 | `mod-kontakte.js`: Hinweis-Banner halbbreitig rechts neben Suche/Filter (zwei-spaltig) |
| 10 | Migration `phase5_documents` angewendet: `documents`-Tabelle erweitert, RLS-Policies, `profiles.role`-Constraint gefixt |
| 11 | `mod-dokumente.js` (neu): Zwei-Spalten-Layout, 13 Kategorien (WEG/Miet/Allgemein), Drag & Drop Upload → Supabase Storage, PDF-Vorschau via `<iframe>`, Bearbeiten, Archivieren (Soft-Delete), Read-Tracking, Nav-Badge |
| 12 | `nav.js`: `nav-badge-docs` in allen Rollen, `loadNavBadges()` um ungelesene Dokumente erweitert |
| 13 | Bugfix: `documents.uploaded_by` + `tenant_id` → zwei FKs auf `profiles` → Join-Hint `profiles!uploaded_by(full_name)` |
| 14 | **Manuelle Voraussetzung:** Supabase Storage-Bucket `documents` (privat, RLS) muss im Dashboard angelegt sein |
