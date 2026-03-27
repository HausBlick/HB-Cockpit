# CLAUDE.md — HB-Mieterportal
> Single Source of Truth für Claude Code (Terminal). Immer aktuell halten nach jeder Phase.

---

## 0. KI-Protokoll — Zwei-Datei-Architektur

Dieses Projekt nutzt zwei KI-gesteuerte Dokumente mit strikter Aufgabenteilung:

| Datei | Eigentümer | Inhalt | Wer pflegt sie |
|---|---|---|---|
| `GEMINI.md` | Gemini CLI | Strategisches Konzept, Vision, funktionale Anforderungen, Übergabe-Pakete | Niko + Gemini |
| `CLAUDE.md` | Claude Code | Technischer Ist-Zustand: DB-Schema, JS-Module, RLS, Design-Tokens, Changelog | Niko + Claude |

**Regeln für Claude:**
- `GEMINI.md` **niemals verändern oder löschen** — nur lesen
- Bei jeder Sitzung, in der `GEMINI.md` konsultiert wird: **zuerst den `0. Update-Log` prüfen** — dort dokumentiert Gemini alle Konzeptänderungen seit der letzten Übergabe
- Nach erfolgreicher Umsetzung eines GEMINI.md-Pakets: **CLAUDE.md zwingend aktualisieren** (Changelog, Schema, Phasen-Status, Frontend-Struktur)
- `CLAUDE.md` **immer im selben Commit** wie die zugehörigen Code-Änderungen mitcommiten

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

### Frontend-Rahmenbedingungen (verbindlich für alle Module)
- **Keine Fremdfarben:** Ausschließlich hb-olive, hb-offblack, hb-ultralight, hb-orange — kein Wildwuchs
- **Konsistenz-Zwang:** Alle Module nutzen exakt dieselbe Formensprache — `rounded-[15px]`-Cards, identische Tabellen-Header, einheitliche Button-Styles (siehe Design-Konventionen unten)
- **Mobile First & App-Feeling:** Mobile Ansicht ist keine zweitrangige Web-Ansicht — Sticky-Header, flüssige Swipe-Menüs, gut greifbare Touch-Zonen (mind. 44px)
- **PWA-Ready:** Portal wird als Progressive Web App konzipiert — Nutzer können es als "echte App" auf iOS/Android-Homescreen installieren

---

## 4. Rollen & Berechtigungen (`profiles.role`)

| Rolle | Beschreibung |
|---|---|
| `admin` | Vollzugriff auf alle Objekte, Mandanten, Finanzen, Tickets |
| `manager` | Vollzugriff, limitiert auf zugewiesene Gebäude (`management_assignments`) |
| `owner` | Lesend: eigene Einheiten, WEG-Dokumente, Tickets, Kontaktbuch |
| `tenant` | Lesend: eigener Mietvertrag, Dokumente, Schwarzes Brett. Darf Tickets erstellen |
| `landlord` | Wie owner + Vermieter-Bereich: eigene Mieter sehen, Dokumente durchreichen |
| `advisory` | Wie owner + Beirat: Lesezugriff auf Finanzdaten (Konten, Buchungen, Belege) via `board_members` |

---

## 5. Frontend-Struktur

```
dashboard.html              # HTML-Shell (~130 Zeilen)
js/
  config.js                 # Supabase-Client, globale Vars, Icons
  utils.js                  # Toast, Dropdown, Logout, Mobile-Menu
  utils-pdf.js              # Official Letter Engine (pdf-lib: generateMahnungPDF, generateWirtschaftsplanPDF, generateEinzelwirtschaftsplanPDF)
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
    mod-finanzen.js         # Buchhaltung (Konten, Buchungen, Wirtschaftsplan, Abrechnung, CSV/SEPA)
    mod-zeiterfassung.js    # Zeiterfassung & Projekte (Timer, Arbeitspakete, Arbeitsrapport-PDF)
    mod-settings.js         # Admin-Einstellungen (Firmendaten, Finanz-Defaults, Logo/Briefbogen-Upload)
    mod-placeholder.js      # Platzhalter für kommende Module (loadProfile, loadMyUnits, loadMyTenants)
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

## 6. Datenbankschema (33 Tabellen, alle RLS)

`profiles`, `buildings`, `apartments`, `persons`, `tenancies`, `ownerships`, `management_assignments`, `tickets`, `ticket_messages`, `news`, `news_likes`, `documents`, `document_reads`, `document_links`, `contacts`, `meters`, `meter_readings`, `invitations`, `building_bank_accounts`, `building_insurances`, `board_members`, `service_providers`, `person_bank_accounts`

**Phase 6-A/F Finanztabellen:**
`accounts`, `journal_entries`, `journal_attachments`, `budget_plans`, `budget_plan_items`, `payment_demands`, `special_levies`, `dunning_notices`, `beirat_access_periods`

**Phase 6.10 Verteilerschlüssel:**
`distribution_keys` (building_id FK, name, type ENUM(mea/sqm/units/consumption/persons/heizkosten/custom), total_value, heiz_split_percent, is_system_default. RLS: lesen=alle, schreiben=admin/manager)
`distribution_key_units` (distribution_key_id FK, apartment_id FK, value. UNIQUE(key_id, apartment_id). RLS: lesen=alle, schreiben=admin/manager)
`accounts`-Erweiterung: `primary_key_id` (FK→distribution_keys), `secondary_key_id` (FK→distribution_keys), `secondary_key_percentage` (numeric 5,2)

**Phase 8.1 Sonderrollen & Finanz-Klassifizierung:**
`profiles.role` CHECK erweitert um `landlord`, `advisory` (6 Rollen total)
`accounts.is_allocatable` (BOOLEAN DEFAULT false — umlagefähig auf Mieter für Betriebskostenabrechnung)
RLS: 3 Policies für `landlord` (apartments, persons, documents via ownerships), 3 Policies für `advisory` (journal_entries, accounts, journal_attachments via board_members + valid_to)

**Zeiterfassung (mod-zeiterfassung.js):**
`time_projects` (building_id FK, title, description, hourly_rate, billing_increment_min, status ENUM(active/closed), created_by FK→auth.users)
`time_work_packages` (project_id FK→time_projects, title, status ENUM(open/closed))
`time_entries` (work_package_id FK→time_work_packages, user_id FK→auth.users, start_time, end_time, description)

**Phase 7 System-Tabellen:**
`global_settings` (single-row id=1: Firmenstammdaten, Finanz-Defaults, logo_url, letterhead_pdf_url. RLS: lesen=alle, schreiben=admin)

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
| Phase 6-F | phase6f_journal_attachments_and_subaccounts | `journal_attachments`-Tabelle (mehrere Belege pro `journal_entries`, RLS admin/manager, Storage-Pfad), `accounts.parent_account_id` (Unterkonto-Hierarchie, self-referencing FK). |
| Phase 7 | global_settings | Single-row-Tabelle (id=1) für Firmenstammdaten, Finanz-Defaults, logo_url, letterhead_pdf_url. RLS: lesen=authenticated, schreiben=admin. |
| Phase 6.10 | phase610_distribution_keys | `distribution_keys` + `distribution_key_units` (Verteilerschlüssel je Gebäude + Einheitenwerte), Enum `distribution_key_type`, `accounts`-Erweiterung (primary_key_id, secondary_key_id, secondary_key_percentage), 4 Indexes, RLS-Policies. |
| Phase 8.1 | phase81_special_roles_and_allocatable | `profiles.role` CHECK auf 6 Rollen erweitert (+landlord, +advisory). `accounts.is_allocatable` BOOLEAN. 6 neue RLS-Policies (3×landlord via ownerships, 3×advisory via board_members+valid_to). |

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
- 2.4 Einladungscode generieren 💡 (→ verschoben nach 8.4)

### 🔄 Phase 3 — Objekte & Zuweisungen (TEILWEISE ABGESCHLOSSEN)
- 3.1 Eigentümer-Zuweisung (`ownerships`) ✅
- 3.2 Mieter-Zuweisung (`tenancies`) ✅
- 3.3 Gebäude-Detail: 4 Tabs (Stammdaten / Finanzen / Grundbuch / Technik & Fristen) ✅
- 3.4 Einheiten-Detail: 5 Tabs + Breadcrumb + Tabellen-Ansicht ✅
- 3.5 Zählerstände UI 💡 (→ verschoben nach 6.8)
- 3.6 **Wartungsvertrags- & Schlüsselverwaltung** (Dienstleister-Fristen, Schließanlage-Dokumentation) 📋

### 🔄 Phase 4 — Kommunikation (TEILWEISE ABGESCHLOSSEN)
- 4.1 Schwarzes Brett (`mod-news.js`): Feed, Filter-Chips, Neu-Badge, Like-Toggle, Read-Tracking, Erstell-Modal ✅
- 4.2 Ticket-System (`mod-tickets.js`): Zwei-Spalten-Layout, Chat-Bubbles, Info-Sidebar ✅
- 4.3 Status-Flow: Offen → In Bearbeitung → Warte auf Rückmeldung → Wiedervorlage → Erledigt ✅
- 4.4 Wiedervorlage/Snooze mit Auto-Reset ✅
- 4.5 Auto-Reopen bei Mieter/Eigentümer-Antwort ✅
- 4.6 Ticket-Suche (RLS-sicher) ✅
- 4.7 Eskalation owner → Verwalter mit Systemnachricht ✅
- 4.8 Deep-Links: Gebäude, Einheit, Person aus Ticket-Detail ✅
- 4.9 Mobile Navigation (3-Zustands-Flow) ✅
- 4.10 **Massen-E-Mail** (Serienbrief-Funktion an alle Bewohner eines Objekts) 📋
- 4.11 **Auftragsmanagement** (Auftrags-PDF für Handwerker direkt aus Ticket generieren) 📋

### 🔄 Phase 5 — Dokumente & Kontakte (TEILWEISE ABGESCHLOSSEN)
- 5.1 Dokumenten-Cloud — Migration `phase5_documents` ✅
- 5.2 Dokumenten-Cloud — `mod-dokumente.js`: Upload, Download, Vorschau, Kategorien, Read-Tracking, Nav-Badge, Listen- & Baumansicht, Draft-Workflow, Auto-Naming, `document_links` für Personen-Scope ✅
- 5.3 Kontaktbuch — `mod-kontakte.js` ✅
- 5.4 Dashboard KPIs (rollenbasiert, Kennzahlen, Fristen-Widget) ✅
- 5.5 **Bulk-Release** (Massen-Freigabe von Dokumenten, z.B. 150 Jahresabrechnungen gleichzeitig) 📋
- 5.6 **ETV-Dokumente & Beschlusssammlung** (Einladungen/Protokolle generieren, gesetzliche Beschlusssammlung §24 Abs. 7 WEG) 📋

### 🔄 Phase 6 — Finanzen & Abrechnung
*Kernmodul: Wirtschaftsplan, Hausgeldabrechnung, Erhaltungsrücklage.*
- 6-A DB-Fundament: Doppik, Kontenrahmen, Journal, Sollstellungen ✅
- 6-B Buchhaltung UI (`mod-finanzen.js`): Übersicht, Buchungen, Zählerstände, Sollstellungen, Onboarding ✅
- 6-C Wirtschaftsplan, Sonderumlagen, Erhaltungsrücklage, Beirat-Belegprüfung ✅
- 6-D Jahresabrechnung, Mahnwesen, DATEV-Export ✅
- 6-E CSV-Bankimport (Tab 12) + SEPA-XML Export (Tab 13) + Testdaten-Scripts ✅
- 6.4 **CSV-Bankimport** (MT940/Sparkasse/Volksbank/CSV allgemein, Drag & Drop, Duplikat-Check) ✅
- 6.13 **SEPA-XML Export** (PAIN.008.003.02, IBAN-Vorschau, „Als bezahlt"-Markierung) ✅
- 6.7 **Pro-rata-temporis Umlage** (zeitanteilige Abrechnung bei Mieterwechsel) 📋
- 6.8 **Zählerstände UI** (aus Phase 3.5 verschoben, wird für Abrechnung benötigt) 📋
- 6.9 **Official Letter Engine** (Mahnung + Wirtschaftsplan als PDF via pdf-lib, Briefkopf-Integration) ✅
- 6.10 **Verteilerschlüssel & Einzelwirtschaftspläne** (distribution_keys, Schlüsselzuweisung je Konto, Einzelplan-PDF Bulk) ✅
- 6.10-B **Einzelwirtschaftsplan PDF-Redesign** (Inter-Font, 5-Block-Aufbau: Meta-Header, Hausgeld-Summary, Umlageschlüssel, Verteilungsergebnis mit Sektionen, Hinweis-Box) ✅

### 🔄 Phase 7 — System, Einstellungen & Benachrichtigungen
*Querschnitts-Modul: Konfiguration, E-Mail-Push, User-Profile, Audit, PWA.*
- 7.1 **Admin-Einstellungen** (Firmenstammdaten, Briefkopf-Upload, Mahngebühr, Basiszins) ✅
- 7.2 **E-Mail-Benachrichtigungen** (Trigger: neue Tickets, Statusänderungen, neu freigegebene Dokumente, News) 📋
- 7.3 **Nutzer-Einstellungen** (Passwort ändern, Notification Opt-Ins je Trigger-Typ) 📋
- 7.4 **System-Logs / Audit Trail** (revisionssichere Aktions-Historie für Admin: Wer hat wann was geändert?) 📋
- 7.5 **In-App Hilfe & Onboarding** (Fragezeichen-Symbol je Modul → kontextbezogene Doku / Guided Tour) 📋
- 7.6 **PWA-Implementierung** (`manifest.json`, Service Worker, Icons, Offline-Fallback — installierbar auf iOS/Android-Homescreen) 📋

### 💡 Phase 8 — Automatisierung & Erweiterungen
*Nach Projektabschluss — optionale Nachrüstung.*
- 8.1 **Umlaufbeschluss-Modul** (digitale Abstimmung ohne Video, Protokoll-PDF) 💡
- 8.2 **KI-Belegerfassung** (PDF-Upload → OCR via Google Document AI → Buchungsvorschlag) 💡
- 8.3 **Messdienstleister CSV-Import** (Techem/Ista Ablesewerte als CSV importieren) 💡
- 8.4 **Einladungscode UI** (aus Phase 2.4 verschoben) 💡
- 8.5 **Kalender-Ausbau**: manuelle Einträge, Wartungstermine, iCal-Export (.ics) für Sync mit Google/Apple/Outlook 💡
- 8.6 **Nebenkostenabrechnung** (Vermieter-Modul: umlegbare Kosten aus WEG-Abrechnung, landlord-spezifische Kosten, PDF-Export) 💡
- 8.7 **Digitale Versammlungen** (hybride ETVs mit Video-Integration) 💡

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

→ Übergabe-Format und KI-Protokoll-Regeln: siehe **Abschnitt 0**.

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

### Phase 6-D — Jahresabrechnung, Mahnwesen, DATEV-Export

| # | Was wurde gemacht |
|---|---|
| 1 | **Tab Jahresabrechnung** (5-Schritte-Wizard): Rahmendaten → Ist-Zahlen (journal_entries aggregiert nach Konto) → Umlageschlüssel (MEA/m²/Einheiten/Custom je Aufwandskonto) → Soll-Ist-Abgleich (payment_demands vs. paid) → Abschluss |
| 2 | Heizkosten Option A (Messdienstleister, manuelle Festbeträge) + Option B (HeizkostenV: 50% Verbrauch / 50% Fläche aus meter_readings, Schätzung mit +10% für fehlende Werte) |
| 3 | Abschluss: journal_entries.is_locked=true, Nachzahlungs-Demands (demand_type='abrechnungsspitze'), budget_plan status='closed' |
| 4 | §35a EStG Steuerbescheinigung: Aggregation lohn_anteil_35a pro Einheit/Eigentümer, Tabelle + CSV-Export |
| 5 | Eigentümerwechsel: Hinweistext Stichtagsprinzip in Schritt 4 (MVP-Entscheidung: kein automatischer Split) |
| 6 | **Tab Mahnwesen**: Überfällige Sollstellungen mit Checkbox-Auswahl, Mahnlauf (Stufe 1-3, Basiszins 3,37%, Mahngebühr), Zinsberechnung (Tage × Rate × Betrag / 365), INSERT dunning_notices, Status „Bezahlt" setzen |
| 7 | **Tab DATEV-Export**: DATEV Buchungsstapel-Format (UTF-8 mit BOM, EXTF-Header, SKR03/04), CSV-Download. Separate §35a EStG Steuerbescheinigung als CSV |
| 8 | Hilfsfunktion `_finDownloadFile()` für Blob-CSV-Downloads |

---

### Projekttag 4 — mod-finanzen.js: Belege, Konten-CRUD, Unterkonten

| # | Was wurde gemacht |
|---|---|
| 1 | **Migration `phase6f_journal_attachments_and_subaccounts`**: neue Tabelle `journal_attachments` (GoBD-konform, mehrere Belege pro Buchung, RLS für admin/manager), Spalte `parent_account_id` auf `accounts` für Unterkonto-Hierarchie |
| 2 | **Beleg-Upload neu**: INSERT in `journal_attachments` statt RPC `update_journal_attachment` (permission denied bei `session_replication_role` entfernt), mehrere Belege pro Buchung möglich, `+ Beleg hinzufügen`-Button immer sichtbar |
| 3 | **Konten bearbeiten**: Stift-Button je Zeile → Edit-Modal (Kontonummer, Bezeichnung, Typ, Übergeordnetes Konto, Rücklage-Label), `UPDATE accounts`, nicht für System-Konten verfügbar |
| 4 | **Konten löschen**: Mülleimer-Button (hb-orange), prüft Buchungen + Unterkonten vor DELETE, Soft-Delete via `is_active=false`, System-Konten geschützt |
| 5 | **Konten-Sortierung**: `_finGetAccounts` sortiert jetzt nach `account_number` statt `sort_order` |
| 6 | **Unterkonto-Support**: `parent_account_id` in Anlegen- und Edit-Modal auswählbar, eingerückte Darstellung (└) im Kontenblatt für Unterkonten, Schutz gegen Selbstreferenz und Löschen mit Kindern |
| 7 | **Kontenblatt 5-spaltig**: neue „Aktionen"-Spalte rechts, colspan-Anpassungen in beiden Render-Pfaden |

---

### Projekttag 4 — mod-finanzen.js UX-Verbesserungen (Batch 2)

| # | Was wurde gemacht |
|---|---|
| 1 | **Buchungs-Detailansicht**: Slide-in Panel von rechts (420px, CSS-Transition), alle Felder, signierter Beleg-Link |
| 2 | **Deutsches Datumsformat**: `_finFormatDate()` Helper, alle Datumsspalten als `DD.MM.YYYY` |
| 3 | **WP Modal: Alle Kontentypen**: `fin-item-acc` Select zeigt expense/revenue/liability (vorher nur expense) |
| 4 | **WP Live-Berechnung bidirektional**: `planned_amount` ↔ `adjustment_percent` in Modal und Tabellen-Zeilen (Entwurf-Status), `_finCalcAdjFromPlanned`, `_finWPLivePlanned`, `_finWPLiveAdj`, `_finUpdatePlanItemAdj` |

---

### Projekttag 4 — mod-finanzen.js UX-Verbesserungen (Batch 1)

| # | Was wurde gemacht |
|---|---|
| 1 | **Konto-Ledger** (Tab Übersicht): Klick auf Konto-Zeile öffnet gefilterte Buchungsansicht (Datum, Gegenkonto, Beschreibung, Soll, Haben, laufender Saldo). „← Zurück"-Button. |
| 2 | **Suchleiste** in Kontenblatt (Kontonummer/Name/Typ) und Buchungsjournal (Betrag/Beschreibung/Kontoname). Live-Filterung ohne Reload. |
| 3 | **Buchungs-Detailansicht**: Klick auf Journal-Zeile öffnet Modal mit allen Feldern (Datum, Wertstellung, Konten, Betrag, Beschreibung, Referenz, §35a, Beleg-Link, Typ-Badge). |
| 4 | **Wirtschaftsplan Manueller Override**: `planned_amount` als editierbares Input-Feld in Draft-Plänen. Speichert per `onblur`. |
| 5 | **Variabler Heizkosten-Schlüssel** (Option B): `heatSplitV` (70%) + `heatSplitF` (30%), Validierung Summe = 100%. |

---

### Projekttag 4 — UI-Cleanup & Gebäudenamens-Logik

| # | Was wurde gemacht |
|---|---|
| 1 | **Header vereinfacht:** `<h1 id="welcome-title">` (Vorname) aus `dashboard.html` entfernt — Header zeigt nur noch Cockpit-Titel (`role-label`) |
| 2 | **Begrüßung ins Dashboard:** `Hallo, [Vorname]!` in `_renderAdminDashboard()` direkt über Quick-Actions eingefügt (war bisher nur in `_renderUserDashboard()`) |
| 3 | **`formatBuildingName(b)` in `config.js`:** Neue globale Hilfsfunktion — Schema: `[file_number] - WEG [street] [house_number]`; Legacy-Fallback: `b.name` |
| 4 | Alle Module (`mod-objekte`, `mod-finanzen`, `mod-tickets`, `mod-news`, `mod-dashboard`, `mod-kontakte`, `mod-dokumente`, `mod-kalender`) auf `formatBuildingName()` umgestellt |
| 5 | Alle buildings-Queries in betroffenen Modulen um `file_number, street, house_number` erweitert |

---

### Phase 6.10 — Verteilerschlüssel-Management & Einzelwirtschaftspläne

| # | Was wurde gemacht |
|---|---|
| 1 | **Migration `phase610_distribution_keys`**: `distribution_keys`-Tabelle (building_id, name, type ENUM, total_value, heiz_split_percent, is_system_default), `distribution_key_units`-Tabelle (key_id+apartment_id UNIQUE, value), `accounts`-Erweiterung (primary_key_id, secondary_key_id, secondary_key_percentage), 4 Performance-Indexes, RLS-Policies (lesen=alle, schreiben=admin/manager) |
| 2 | **`mod-objekte.js`: 5. Tab "Verteilerschlüssel"** im Gebäude-Detail: Liste aller Schlüssel (Name, Typ-Badge, Gesamtwert, Aktionen), "Neuer Schlüssel"-Modal (Name, 7 Typen, HeizKV-Split-%-Feld), "Werte"-Modal (Einheiten-Tabelle mit Wert-Inputs, Live-Summe, %-Anteile, Schnell-Befüllung aus MEA/m²/Einheiten), Auto-Initialisierung bei Erstellung |
| 3 | **`mod-finanzen.js`: Schlüsselzuweisung** im Konto-bearbeiten-Modal: Verteilerschlüssel-Sektion mit primärem/sekundärem Schlüssel-Dropdown + %-Anteil für HeizKV-Split. Distribution Keys werden mit Kontenblatt geladen (`_finState.distKeys`) |
| 4 | **`utils-pdf.js`: `generateEinzelwirtschaftsplanPDF(planId)`** — Bulk-PDF mit einer Seite pro Einheit. Spalten: Konto, Bezeichnung, Gesamt, Schlüssel, Anteil, monatlich. Berechnung über distribution_keys + unit values. Dual-Key-Support (HeizKV-Split). Eigentümer-Name, MEA/m²-Info, Hinweis-Box |
| 5 | **`mod-finanzen.js`: "Einzelpläne PDF"-Button** neben bestehendem PDF-Button im Wirtschaftsplan-Header |

---

### Phase 6.10-B — Einzelwirtschaftsplan PDF-Redesign (v2)

| # | Was wurde gemacht |
|---|---|
| 1 | **Inter-Font eingebettet**: `_pdfLoadInterFonts()` lädt Inter Regular 400, SemiBold 600, Bold 700 als TTF via `fonts/Inter-*.ttf`, cached als `Uint8Array` + `.slice()` bei jedem `embedFont()`. `@pdf-lib/fontkit` CDN + `pdfDoc.registerFontkit(fontkit)` |
| 2 | **Block 1 — Meta-Header**: Eigentümer-Name (SemiBold) + Adresse links. Rechts: 6-zeiliger Info-Block (Datum, WP-Jahr, Einheit, Gebäude, MEA, Wohnfläche) als Key-Value rechtsbündig |
| 3 | **Block 2 — Hausgeld-Summary**: 3-spaltige Tabelle (Hausgeld, Objekt gesamt, Ihr Anteil), olive Header. Zeile 1 „Jahres" dezent grau (#9ca3af). Zeile 2 „Monatlich" prominent (10pt SemiBold, einheitlich hb-olive, 24pt, hb-ultralight bg). Monatlicher Betrag NUR hier |
| 4 | **Block 3 — Umlageschlüssel-Tabelle**: 7 Spalten, `splitLines()` + Pre-Kalkulation aller Zeilenhöhen, `drawCell()`/`drawCellR()`. lineH=`fontSize*1.3`, padV=4pt, minRowH=18pt. Header via `drawTableHeader()` Mindesthöhe 22pt |
| 5 | **Block 4 — Verteilungsergebnis**: Bezeichnung 9pt/50mm, Schlüssel 7.5pt/38mm, je max 2 Zeilen mit „…"-Truncation. Sektionen umlagefähig/nicht umlagefähig (16pt, olive/10), Zwischensummen 20pt, Grand-Total 22pt olive bg |
| 6 | **Block 5 — Rechtlicher Hinweis**: 10pt Padding, 9.5pt Inter, lineH=13pt. Orange-Kreis (10pt) mit weißem „i", 6pt Gap. Box: orange/8% bg, 1pt border |
| 7 | **Betragsformatierung**: `fmt()` mit `Math.round((v+EPSILON)*100)/100`, `maximumFractionDigits:2` + ' €' — gilt für JEDEN Betrag im PDF |
| 8 | **Tabellen-Header**: `drawTableHeader()` berechnet Höhe `max(22, fs*1.35+8)`, Baseline `y - 5 - fontSize`, gibt Höhe zurück. Überschriften 10pt hb-olive, 10pt Abstand zur Tabelle, 24pt Abstand nach Tabelle |
| 9 | **Eigentümer-Query Bugfix**: `ownerships`-Query korrigiert: `.eq('is_active', true)` statt `.eq('active', true)`, FK-Hint `persons!owner_id` statt `persons` |
| 10 | **Font-Files**: `fonts/Inter-Regular.ttf`, `fonts/Inter-SemiBold.ttf`, `fonts/Inter-Bold.ttf` zum Projekt hinzugefügt |

---

### Bugfix — Verteilerschlüssel-Grunddaten

| # | Was wurde gemacht |
|---|---|
| 1 | **Gesamtumlage-Feld im "Neuer Schlüssel"-Modal**: Optionales Eingabefeld für `total_value`. Wenn manuell gesetzt (z.B. MEA 800 von 1000 weil Garagen ausgenommen), wird der Wert beim Speichern NICHT durch die Einheitenwerte-Summe überschrieben |
| 2 | **Gesamtumlage im Werte-Modal — UX-Redesign**: Radio-Toggle „Automatisch (Summe)" / „Manuell festlegen" statt Checkbox. Prominente Gesamtumlage-Anzeige mit Live-Update (`_dkUpdateTotalDisplay()`). Manuelles Eingabefeld mit Platzhalter. Auto-Erkennung ob manuell/auto beim Öffnen. **Bugfix:** Arrow-Funktionen (`=>`) in HTML-Template-Attributen brachen das Rendering — alle Expressions vor das Template verschoben, `.map()` mit `function()` statt Arrow |
| 3 | **EUR-Suffix bei Schlüsselwerten entfernt**: `utils-pdf.js` Block 3 (Umlageschlüssel-Tabelle) — `fmt()` (mit €) durch neuen Helper `fmtVal()` (ohne €) ersetzt für `total` und `unitVal`. Verteilerschlüssel-Werte sind dimensionslose Anteile (MEA, m², Einheiten), keine EUR-Beträge |
| 4 | **"Auf 0"-Button**: "Leeren"-Button im Schnell-Befüllen-Bereich umbenannt zu "Auf 0" für klarere Semantik |

---

### PDF-Redesign — Kopfbereich Einzelwirtschaftsplan (Immoware24-Orientierung)

| # | Was wurde gemacht |
|---|---|
| 1 | **Kopfzeile (alle Seiten)**: „Wirtschaftsplan | WEG [Adresse]" links (Bold), Erstellungsdatum rechts, dünne Trennlinie. `drawPageHeader()` Hilfsfunktion |
| 2 | **Titel-Block**: „Wirtschaftsplan" (16pt Bold) + „Einzelwirtschaftsplan" (12pt SemiBold) |
| 3 | **Objekt- & Verwalter-Block**: Zweispaltige Box mit Rahmen. Links: Objekt-Adresse + Planzeitraum (DD.MM.YYYY – DD.MM.YYYY). Rechts: Verwalter-Daten aus `global_settings` (company_name, street, zip_city, tax_number). Vertikale Trennlinie |
| 4 | **Eigentümer-Box**: Olive-umrandete Box mit Name (Bold), Adresse, Verwaltungseinheit (WE-Nr. + Lage + MEA + Fläche) |
| 5 | **Leerstand**: Einheiten ohne Eigentümer zeigen „Eigentümergemeinschaft (Leerstand)" als Fallback-Name |
| 6 | **Seite 2+ kompakter Header**: Nur Kopfzeile + Trennlinie, kein Eigentümer/Objekt-Block — aber Briefbogen als Hintergrund auf allen Seiten. `addPage()` kopiert immer das Briefbogen-Template |
| 7 | **Seitenumbruch-Logik**: Jeder Block prüft `y - blockH < mBottom` vor dem Zeichnen. Bei Platzmangel → neue Seite mit kompaktem Header. Tabellen-Header wird auf neuer Seite wiederholt |
| 8 | **buildings-Query erweitert**: `zip_code, city` hinzugefügt für vollständige Gebäude-Adresse im PDF |
| 9 | **Table-Drawing-Helpers refactored**: `splitLines`, `drawCell`, `drawCellSingle`, `drawCellR` aus der for-Schleife herausgezogen (einmal definiert, wiederverwendbar über Seitengrenzen) |
| 10 | **drawCostSection async**: Unterstützt jetzt Seitenumbrüche mitten in der Kostentabelle |
| 11 | **Seite 1 ohne Kopfzeile**: `addFirstPage()` zeigt nur Datum (rechtsbündig), keine Kopfzeile/Trennlinie — Seite 2+ behält kompakten Header via `addPage()` |
| 12 | **Content unter Logo**: Alle Seiten starten bei `pageHeight - 100` (unter Briefbogen-Logo ~85-90pt) |
| 13 | **Boxen kompakter**: Padding 10→6pt, Zeilenabstand reduziert, beide Boxen zusammen ~110pt statt ~180pt |
| 14 | **Eigentümer-Query gefixt**: `persons` hat kein `full_name` → Query auf `first_name, last_name, street, house_number, zip_code, city` geändert. FK-Hint `persons!ownerships_owner_id_fkey`. ownerMap baut Name/Adresse aus Einzelfeldern zusammen |
| 15 | **Box-Zeichenreihenfolge**: Boxes werden vor Text gezeichnet (Hintergrund zuerst), damit weißer Fill den Text nicht überdeckt |

---

### Phase 7-A — Admin-Einstellungen & Official Letter Engine

| # | Was wurde gemacht |
|---|---|
| 1 | **Migration `global_settings`**: Single-row-Tabelle (id=1) für Firmenstammdaten (company_name, street, zip_city, phone, email, website, tax_number, hrb_number, ceo_name), Finanz-Defaults (default_dunning_fee, base_interest_rate), logo_url, letterhead_pdf_url. RLS: lesen=authenticated, schreiben=admin |
| 2 | **`mod-settings.js`** (neu): 3-Card-Layout — Unternehmensdaten (9 Felder), Finanz-Standardwerte (2 Felder), Briefpapier & Logo (Upload via Supabase Storage `documents/settings/`). Nur für admin zugänglich |
| 3 | **`utils-pdf.js`** (neu, Official Letter Engine): pdf-lib via CDN. `generateMahnungPDF(noticeId)` — lädt dunning_notice + Empfängerdaten, DIN-5008-Adressfeld, Briefkopf-Integration (letterhead PDF als Template oder Fallback-Header). `generateWirtschaftsplanPDF(planId)` — lädt plan + items, Tabelle mit olive Header, Summenzeile. Fußzeile mit Firmendaten auf beiden Dokumenttypen |
| 4 | **PDF-Buttons in `mod-finanzen.js`**: Mahnwesen-Tabelle → PDF-Icon je Zeile. Wirtschaftsplan-Header → „PDF"-Button neben Status-Aktionen |
| 5 | **`dashboard.html`**: pdf-lib CDN (unpkg), utils-pdf.js, mod-settings.js eingebunden |
| 6 | **`mod-placeholder.js`**: `loadSettings()` Platzhalter entfernt (jetzt in mod-settings.js) |

---

### Phase 6-E — CSV-Bankimport, SEPA-XML Export, Testdaten-Scripts
**Commits:** `3efc9ed`

| # | Was wurde gemacht |
|---|---|
| 1 | **Tab 12 CSV-Import**: Format-Auswahl (MT940/Sparkasse/Volksbank/CSV allgemein), Drag & Drop Upload-Zone, client-seitiger Parser, Vorschau-Tabelle (Checkbox, Betrag farbkodiert grün/rot, Kontenzuweisung je Zeile), Duplikat-Erkennung per `reference_number`, Import in `journal_entries` |
| 2 | **Tab 13 SEPA-Export**: Offene/überfällige Sollstellungen mit IBAN-Vorschau, orange „Keine IBAN"-Badge, PAIN.008.003.02 XML-Download, „Als bezahlt markieren"-Button |
| 3 | **`scripts/seed-testdata.sql`**: 5 WE (TEST-001) + 4 WE (TEST-002), Zählerstände Jahresanfang + Jahresende 2025, 2 Wirtschaftspläne je Gebäude (2025 aktiv + 2026 Entwurf), 108 Sollstellungen (inkl. overdue für WE05) |
| 4 | Testdaten in DB eingespielt und verifiziert |

---

### Phase 6-C — Wirtschaftsplan, Sonderumlagen, Erhaltungsrücklage, Beirat-Belegprüfung

| # | Was wurde gemacht |
|---|---|
| 1 | **Tab Wirtschaftsplan**: Plan anlegen/status-flow (draft→approved→active→closed), Positionen (account, prior_year_actual, adjustment_percent, planned_amount mit Auto-Kalkulation), Gesamtsumme |
| 2 | **Sonderumlagen** (unterer Bereich Wirtschaftsplan-Tab): Anlegen (Titel, Betrag, Schlüssel MEA/Einheiten/m²/custom, Fälligkeit), Aktivierung → generiert `payment_demands` mit demand_type='sonderumlage' pro Eigentümer |
| 3 | **Tab Rücklage**: Karten pro Rücklagekonto mit Echtzeit-Saldo + Soll-Bestand aus aktivem Wirtschaftsplan (Warnung bei >5% Abweichung), Zuführung/Entnahme buchen (entry_type='ruecklage'), Entwicklungsübersicht mit laufendem Saldo |
| 4 | **Tab Belegprüfung** (Admin/Manager): Beirat-Freigabezeiträume CRUD (`beirat_access_periods`), Vorschau der Buchungen was Beirat sieht |
| 5 | **Beirat Read-Only-View**: `loadFinance()` erkennt Beirat-Mitglieder via `board_members` → `persons.auth_user_id` → prüft aktive `beirat_access_periods` → zeigt read-only Buchungsjournal |
| 6 | `nav.js`: „Belegprüfung" Nav-Eintrag für Owner-Rolle ergänzt (für Beirat-Mitglieder) |

---

### Phase 6-B — Buchhaltung UI

| # | Was wurde gemacht |
|---|---|
| 1 | `mod-finanzen.js` (neu): 5-Tab-Layout — Übersicht, Buchungen, Zählerstände, Sollstellungen, Onboarding |
| 2 | **Tab Übersicht**: Kontenblatt mit Saldo-Berechnung aus `journal_entries`, Konto-anlegen-Modal |
| 3 | Automatisches Kopieren der System-Kontenvorlagen (`building_id=NULL`) beim ersten Aufruf eines Gebäudes |
| 4 | **Tab Buchungen**: Buchungsmaske (Soll/Haben, Datum, Beleg-Upload → `documents`-Bucket/`belege/`-Unterordner, §35a-Feld), Journal-Tabelle mit Jahres-Filter, Storno-Button pro Zeile |
| 5 | **Tab Zählerstände**: Schnelleingabe-Grid (alle Einheiten × alle Zählertypen), letzter bekannter Wert als Placeholder, Bulk-INSERT in `meter_readings` via `meters.id` |
| 6 | **Tab Sollstellungen**: Generierung (12×Hausgeld pro aktivem Eigentümer, Duplikat-Check, gleichzeitig `journal_entries` 1400/8400), Status-Tabelle, „Als bezahlt markieren" |
| 7 | **Tab Onboarding**: 3-Schritte-Wizard (Stichtag → Bankkonten-Salden → Offene Posten), Eröffnungsbuchungen in `journal_entries` (entry_type='erhoeffnungsbilanz') |
| 8 | `nav.js`: „Abrechnungen" → „Buchhaltung" |
| 9 | `dashboard.html`: `mod-finanzen.js` Script-Tag ergänzt |
| 10 | `mod-dashboard.js`: `loadFinance:'Buchhaltung'` in `_dashNavTo`-Map ergänzt |

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

---

### Phase 8.1 — Sonderrollen-Architektur & Finanz-Klassifizierung

| # | Was wurde gemacht |
|---|---|
| 1 | **Migration `phase81_special_roles_and_allocatable`**: `profiles.role` CHECK-Constraint auf 6 Rollen erweitert (+`landlord`, +`advisory`). `accounts.is_allocatable` BOOLEAN DEFAULT false (Umlagefähigkeit für Betriebskostenabrechnung) |
| 2 | **6 neue RLS-Policies**: 3× landlord (apartments, persons, documents via ownerships), 3× advisory (journal_entries, accounts, journal_attachments via board_members + valid_to) |
| 3 | **`mod-finanzen.js`**: Checkbox "Umlagefähig (Betriebskosten)" in Konto-Anlegen- und Konto-Edit-Modal. `is_allocatable` bei INSERT/UPDATE mitgesendet |
| 4 | **`mod-finanzen.js` WP-Tabelle**: Positionen nach `is_allocatable` gruppiert — Sektions-Header "Umlagefähige Kosten" / "Nicht umlagefähige Kosten" + Zwischensummen |
| 5 | **`utils-pdf.js` Einzelwirtschaftsplan**: Sektions-Logik von Hardcoded `account_type === 'expense'` auf `is_allocatable` umgestellt. accounts-Select um `is_allocatable` erweitert |
| 6 | **`mod-persons-edit.js`**: Portal-Tab — Rollen-Dropdown (6 Rollen) für registrierte Personen. Speichert `profiles.role` des verknüpften Auth-Users |
| 7 | **`nav.js`**: roleLabels um `landlord: 'Vermieter Cockpit'` und `advisory: 'Beirat Cockpit'` erweitert. Eigene Nav-Sektionen: landlord = owner + Meine Mieter, advisory = owner + Belegprüfung. Owner bereinigt (kein Vermieter-Bereich, keine Belegprüfung mehr) |
| 8 | **`mod-dashboard.js`**: roleLabel-Map erweitert, Hausgeld-KPI für landlord/advisory |
| 9 | **Bugfix `mod-dashboard.js`**: `tickets.subject` → `tickets.title` (7 Stellen), `news.status`/`news.is_deleted` Filter entfernt (4 Stellen — Spalten existieren nicht in news-Tabelle) |
| 10 | **Bugfix `mod-kalender.js`**: `tickets.subject` → `tickets.title` in Wiedervorlage-Query und Ticket-Pill-Label |

---

### Bugfix — FK-Joins payment_demands/dunning_notices/ownerships (profiles→persons)

| # | Was wurde gemacht |
|---|---|
| 1 | **5 Queries gefixt** in `mod-finanzen.js`: `person:profiles(full_name)` → `person:persons(first_name, last_name)` in `payment_demands`- (Zeilen 1092, 2824) und `dunning_notices`-Queries (Zeile 2829). `owner:profiles(full_name)` → `owner:persons!ownerships_owner_id_fkey(first_name, last_name)` in `ownerships`-Queries (Zeilen 1376, 2684) |
| 2 | **6 Anzeige-Stellen** von `.full_name` auf `first_name + ' ' + last_name` umgestellt (Sollstellungen, Onboarding, Jahresabrechnung, Mahnwesen) |
| 3 | **Root Cause:** `payment_demands.person_id` und `dunning_notices.person_id` verweisen per FK auf `persons`, nicht auf `profiles`. `ownerships.owner_id` ebenfalls auf `persons`. Falscher JOIN auf `profiles` lieferte NULL-Ergebnisse |
| 4 | **Mahnwesen INSERT gefixt** (`_finCreateDunning`): Falsche Spaltennamen `amount`/`fee`/`due_date` → korrekte DB-Spalten `overdue_amount`/`dunning_fee`/`interest_rate`/`interest_amount`/`total_amount`/`dunning_date`. `person_id` ergänzt (aus `data-person-id` an Checkbox). Anzeige der dunning_notices-Tabelle auf `overdue_amount`/`dunning_fee`/`total_amount` umgestellt |

---

### Phase 6.9-B — Jahresabrechnung PDF-Export

| # | Was wurde gemacht |
|---|---|
| 1 | **`utils-pdf.js`: `generateJahresabrechnungPDF(buildingId, fiscalYear, jabData)`** — Bulk-PDF mit Anschreiben + Einzelabrechnung je Einheit. Nutzt jabData.entries für Ist-Kosten-Aggregation, jabData.sollIst für Soll-Ist-Abgleich |
| 2 | **Seite 1 (Anschreiben)**: DIN-Adressfeld (Eigentümer-Postanschrift), personalisierte Anrede (Salutation), Ergebnis-Highlight-Box zeigt **Abrechnungssaldo** (Spitze + Zahlungsdifferenz — Nachzahlung/Guthaben mit orange/olive Farbkodierung), Fließtext basiert auf saldoUnit. Keine Kopfzeile/Trennlinie (addFirstPage-Pattern) |
| 3 | **Seite 2+ (Einzelabrechnung)**: Objekt/Verwalter-Block, Eigentümer-Box. **Dreispaltige Summary-Tabelle**: Abrechnungsspitze (Gesamtkosten − HG-Soll), Zahlungsdifferenz (HG-Soll − HG-Ist), Abrechnungssaldo (Spitze + Differenz) mit Objekt-gesamt + Ihr-Anteil Spalten. BGH-Hinweis (V ZR 147/11). Umlageschlüssel-Tabelle, Verteilungsergebnis (umlagefähig/nicht umlagefähig), Grand-Total, §28 WEG Hinweis-Box |
| 4 | **Seitenumbruch-Logik**: Alle Blöcke und Tabellenzeilen prüfen `y < mBottom`, Tabellen-Header wird auf neuer Seite wiederholt. Briefbogen als Hintergrund auf allen Seiten |
| 5 | **`mod-finanzen.js`**: Button "Abrechnung als PDF exportieren" in `_finJABStep5Html` (Schritt 5 des Wizards). Wrapper `_finJABExportPDF()` übergibt `_finState.jabData` an die PDF-Funktion |
| 6 | **Bugfix: Doppelter Header** auf Seite 2 (Einzelabrechnung) — `addPage()` → `addFirstPage()`, keine Kopfzeile auf erster Seite der Einzelabrechnung |
| 7 | **Bugfix: Anschreiben Seitenränder** — hardcoded Intro-Zeilenumbrüche → `_pdfSplitText()` für volle Textbreite |
| 8 | **Wizard Schritt 3 Read-Only** — `<select>`-Dropdowns durch Textanzeige ersetzt, Schlüssel aus `accounts.primary_key_id` angezeigt, Hinweistext „Kontenblatt → Konto bearbeiten → Verteilerschlüssel" |
| 9 | **Wizard Schritt 5 Saldo-Tabelle** — Owner-Tabelle mit Ist-Kosten, HG-Soll, HG-Ist, Abrechnungssaldo (Nachzahlung hb-orange / Guthaben hb-olive). Netto-Ergebnis WEG als KPI. Saldo-Berechnung via Distribution-Keys in `_finJABNext(4)` |

---

### Zeiterfassung-Modul — Integration, CI-Anpassung & Bugfixes

| # | Was wurde gemacht |
|---|---|
| 1 | **`mod-zeiterfassung.js`** (neu): Zeiterfassung für Projekte & Arbeitspakete. Gebäude-Auswahl, Projekt-Cards (Titel, Status, Taktung), Projekt-Detailansicht mit Arbeitspaketen + Zeithistorie-Tabelle, Projekt-Statistik (Netto/Getaktet/Kontrollwert) |
| 2 | **Timer-Funktion**: Start/Stopp mit Live-Anzeige (HH:MM:SS), laufender Timer wird bei Seitenaufruf wiederhergestellt, Beschreibungs-Modal beim Stoppen |
| 3 | **Manuelle Zeiterfassung**: Modal mit Datum, Start-/Endzeit, Tätigkeitsbeschreibung |
| 4 | **Arbeitsrapport PDF**: `_timeGenerateReport()` — Design wie Wirtschaftsplan/Jahresabrechnung. Seite 1 ohne Kopfzeile (addFirstPage-Pattern), Objekt/Verwalter-Block (zweispaltig), Projekt-Box (olive-umrandet). Spalten: Datum, Tätigkeit, Von, Bis, Dauer (rechtsbündig). AP-Gruppierungsbalken über Tabelle, olive Tabellen-Header, Zebra-Zeilen, WP-Zwischensummen, Grand-Total (olive bg), Hinweis-Box (orange Rahmen). Signed-URL für Briefbogen via `createSignedUrl()`, try/catch für Fehlerbehandlung. Keine Euro-Angaben |
| 5 | **Integration**: `dashboard.html` Script-Tag, `nav.js` Menüpunkt „Zeiterfassung" (icons.clock) unter Finanzen für admin/manager, `config.js` clock-Icon |
| 6 | **CI-Anpassung**: Projekt-Card-Header → `bg-hb-olive text-white`, Zeithistorie-Header → olive, Projekt-Statistik → olive Titelleiste, Tabellen-Header ohne uppercase, + Button → `bg-white text-hb-olive`, Löschen-Button → Konvention, Timer-Modal → olive Header + Footer, Trennlinien → `border-hb-olive/10` |
| 7 | **Bugfix: Projekt bearbeiten** (`_timeOpenProjectEditModal`): Fehlende Funktion implementiert — Modal mit Titel, Beschreibung, Stundensatz, Abrechnungstakt, Status |
| 8 | **Bugfix: Arbeitspaket bearbeiten** (`_timeEditWP`): Fehlende Funktion implementiert — Modal mit Bezeichnung + Status (offen/abgeschlossen) |
| 9 | **Bugfix: Zeiteintrag bearbeiten** (`_timeEditEntry`): Stift-Icon in Zeithistorie ergänzt, Modal lädt Eintrag per ID und zeigt Datum/Start/Ende/Tätigkeit |
| 10 | **Bugfix: PDF-Export**: (a) `pdfDoc.registerFontkit(fontkit)` fehlte — Custom-TTF-Fonts schlugen still fehl. (b) `fetch(letterhead_pdf_url)` → `createSignedUrl()` — Storage-Pfad braucht signierte URL. (c) try/catch um gesamte Funktion für saubere Fehlermeldungen |
| 11 | **Migration**: `scripts/migration_zeiterfassung.sql` — 3 Tabellen (`time_projects`, `time_work_packages`, `time_entries`) mit RLS-Policies für admin/manager |

---

### Bugfix — Mahnwesen Buchungslogik greift nicht

| # | Was wurde gemacht |
|---|---|
| 1 | **`_finLoadMahnwesen` Konten-Laden**: Standard-Pattern `_finState.accounts.length ? ... : await _finGetAccounts(bid)` am Anfang ergänzt — verhindert "Konto nicht gefunden"-Fehler wenn Mahnwesen-Tab direkt aufgerufen wird |
| 2 | **`_finNoticePaidConfirm` Defensive**: `accs = _finState.accounts.length ? ... : await _finGetAccounts(bid)` statt `_finState.accounts \|\| []` — Konten werden nachladen falls zwischen Modal-Öffnung und Bestätigung verloren |
| 3 | **`_finCreateDunning` Fix**: `payment_demands.update({ status: 'overdue' })` entfernt — Sollstellungs-Status wird beim Erstellen einer Mahnung NICHT mehr geändert. Nur `_finNoticePaidConfirm` setzt `status='paid'` nach tatsächlichem Zahlungseingang |

### Bugfix — `_finNoticePaidConfirm` fiscal_year + Atomarität

| # | Was wurde gemacht |
|---|---|
| 1 | **`fiscal_year` ergänzt**: `const fiscalYear = new Date(date).getFullYear()` berechnet das Geschäftsjahr aus dem Buchungsdatum. Alle 3 Einträge im `entries`-Array erhalten `fiscal_year: fiscalYear` — behebt NOT-NULL-Constraint-Fehler |
| 2 | **Atomare Reihenfolge**: `Promise.all()` (Buchung + Status-Updates parallel) durch sequenzielle Ausführung ersetzt. Erst `journal_entries.insert()`, bei Fehler sofortiger Abbruch mit Toast — Status-Updates (`dunning_notices` + `payment_demands`) erfolgen NUR nach erfolgreichem INSERT |
| 3 | **`entry_type` korrigiert**: DB-Constraint erlaubt nur `manual/sollstellung/sonderumlage/ruecklage/abrechnungsspitze/erhoeffnungsbilanz/storno`. `'payment'` existiert nicht — alle 3 Mahnzahlungs-Buchungen auf `'manual'` geändert |

### Buchungsdetail-Erweiterung + Direktzuweisung Jahresabrechnung

| # | Was wurde gemacht |
|---|---|
| 1 | **Journal-Query**: `apartment:apartments(id,apartment_number)` Join ergänzt — `apartment_id`-Daten stehen im Detail und in der Tabelle zur Verfügung |
| 2 | **Einheit-Badge** in Journal-Tabellenzeile: olive Badge mit Wohnungs-Nr. wenn `apartment_id` gesetzt |
| 3 | **Buchungsdetail-Panel erweitert**: Wirtschaftsjahr, Einheit, Buchungstyp, Gesperrt-Badge, Buchungs-ID im Header |
| 4 | **"Metadaten bearbeiten"-Button** im Detail-Panel (nur für nicht gesperrte, nicht-Storno-Buchungen): öffnet Edit-Modal |
| 5 | **`_finEditEntry` + `_finSaveEntryEdit`**: Metadata-Edit-Modal für apartment_id, Beschreibung, Referenznummer, §35a. GoBD-Hinweis für Finanzdaten |
| 6 | **`_finNoticePaidModal`/`_finNoticePaidConfirm`**: `apartment_id` aus payment_demand wird jetzt an alle 3 Mahnzahlungs-Buchungen (1200→1400, 1200→8010, 1200→8020) übergeben |
| 7 | **JAB Schritt 4 — Direktkostenlogik**: Buchungen mit `apartment_id` fließen DIREKT in `istKosten` der betreffenden Einheit (Soll−Haben). Buchungen ohne `apartment_id` werden wie bisher über Verteilerschlüssel verteilt |
| 8 | **Migration `scripts/migration_journal_metadata_update.sql`**: Modifiziert `journal_no_update` Trigger — erlaubt UPDATE für Metadaten-Felder, blockiert weiterhin Finanzdaten (amount, Konten, Datum, entry_type) |

**Supabase-Aktion erforderlich:** `scripts/migration_journal_metadata_update.sql` im SQL-Editor ausführen (sonst schlägt "Metadaten bearbeiten" fehl).

### Jahresabrechnung Schritt 1 — Konto-Checkliste

| # | Was wurde gemacht |
|---|---|
| 1 | **Zweiphasiger Schritt 1**: Erste Phase zeigt nur Zeitraum-Eingabe + "Konten laden →"-Button. Nach dem Laden erscheint die Konto-Checkliste (alle Konten mit Buchungen im Zeitraum, sortiert nach Kontonummer) |
| 2 | **Konto-Checkliste**: Tabelle mit Checkbox, Kto.-Nr., Kontoname, Typ-Badge (Aufwand/Ertrag/Aktiva/Passiva), Buchungsanzahl. Default: alle Konten angehakt. "Alle / Keine"-Schnellauswahl |
| 3 | **Filterung**: Nur die angehakten Konten fließen in `jabData.entries` ein — alle nachfolgenden Schritte (Ist-Zahlen, Verteilerschlüssel, Saldo-Berechnung) arbeiten nur mit den ausgewählten Buchungen |
| 4 | **`jabData.rawEntries`**: Vollständige ungefilterte Buchungen werden separat gespeichert — "↺ Neu laden"-Button setzt `step1Loaded = false` ohne DB-Neuabfrage zu erzwingen |
| 5 | **Neue Globals**: `_finJABStep1Reset()` (Phase zurücksetzen), `_finJABSelectAll(val)` (alle an/ab) |

---

### Bugfix — Mahngebühr-Buchungsstruktur (korrekte WEG-Kontenlogik)

| # | Was wurde gemacht |
|---|---|
| 1 | **Konto 4201 "Mahngebühren"** (expense, Unterkonto 4200, `is_allocatable=false`) via Supabase SQL als System-Template (building_id=NULL) und in Gebäuden 16+17 angelegt |
| 2 | **`_finCreateDunning` — Aufwandsbuchung bei Mahnung-Erstellung**: Nach erfolgreichem INSERT der dunning_notices wird für jede Mahnung mit Gebühr > 0 ein journal_entry erstellt: Debit 4201 Mahngebühren (mit `apartment_id` = verursachende Einheit) / Credit 1420 Forderungen Mahnwesen. Gebühr erscheint damit als Direktkosten in der JAB der verursachenden Einheit |
| 3 | **`_finNoticePaidConfirm` — Gebühren-Eintrag korrigiert**: Gebühren-Buchung von `1200→8020 (mit apartment_id)` auf `1200→1420 (ohne apartment_id)` geändert — Zahlung löscht nur die Forderung, erzeugt keine doppelte Kostenposition |
| 4 | **`_finNoticePaidModal` — Label aktualisiert**: "Bank (1200) → Mahngebühr (8020)" → "Bank (1200) → Forderung Mahnwesen (1420)" |
| 5 | **Migration `scripts/migration_journal_metadata_update.sql`**: `journal_no_update` Trigger erlaubt UPDATE für Metadaten (apartment_id, description, reference_number, lohn_anteil_35a), blockiert weiterhin Finanzdaten — via Supabase MCP direkt angewendet |

**Korrekte Buchungsfluss Mahngebühr:**
- Bei Mahnung-Erstellung: Debit 4201 (Aufwand, apt_id=WE02) / Credit 1420 (Forderung) → erscheint als Direktkosten in WE02-JAB
- Bei Zahlung: Debit 1200 (Bank) / Credit 1420 (löscht Forderung, kein apt_id) → neutral für JAB

---

### Phase 6-D.3 — WEG-Standard-Kontenrahmen + Mahnungs-Buchungslogik

| # | Was wurde gemacht |
|---|---|
| 1 | **SQL-Migration `migration_phase6d3_mahnung_accounts.sql`**: Konten 1420 (Forderungen Mahnwesen, asset), 8010 (Verzugszinserträge, revenue), 8020 (Mahngebühren-Erstattung, revenue) als System-Templates (building_id=NULL, is_system_account=true) hinzugefügt. Automatisches Kopieren in bestehende Gebäude per INSERT...SELECT. `is_allocatable=true` für alle 4100–4199 Konten (Templates + Gebäude) |
| 2 | **`_finEnsureAccounts` gefixt**: Kopien übernehmen jetzt `is_system_account: t.is_system_account` (statt hardcoded false) und `is_allocatable: t.is_allocatable` — war bisher nicht kopiert |
| 3 | **Schloss-Icon für System-Konten**: Beide Render-Pfade (Ledger-Ansicht + Übersicht-Ansicht) ersetzen "System"-Textlabel durch SVG-Schloss-Icon (grau, klein, inline). Löschen-/Bearbeiten-Buttons bleiben für Systemkonten ausgeblendet |
| 4 | **`_finNoticePaidModal()`**: Neues Modal beim Klick auf "Bezahlt". Zeigt Datumsfeld (Default: heute) + 3-spaltige Buchungs-Split-Vorschau (Hauptforderung → 1400, Zinsen → 8010, Mahngebühr → 8020) mit Gesamtsumme |
| 5 | **`_finNoticePaidConfirm()`**: Erstellt bis zu 3 `journal_entries` (Bank 1200 → 1400/8010/8020), aktualisiert `dunning_notice.status='paid'` + `payment_demand.status='paid'` — Fallback-Fehlermeldung wenn Konten fehlen |
| 6 | **`_finNoticeReverse()`**: Storno bezahlter Mahnungen — erstellt GoBD-konforme Gegenbuchungen (1400/8010/8020 → Bank 1200, entry_type='storno'), setzt Notice zurück auf 'sent', Demand auf 'overdue' |
| 7 | **noticeRows-Buttons**: Offen → "Bezahlt"-Button (→ Modal), Bezahlt → "Bezahlt"-Label + "Stornieren"-Button (hb-orange), Storniert → graues "Storniert"-Label |

**Supabase-Aktion erforderlich:** `scripts/migration_phase6d3_mahnung_accounts.sql` in Supabase SQL-Editor ausführen.

---

### Bugfix — Jahresabrechnung Wizard Schritt 5: Ist-Kosten immer 0

| # | Was wurde gemacht |
|---|---|
| 1 | **Root Cause**: `_finState.distKeys` wurde mit `.select('id, name, type')` geladen — ohne `total_value`. In `_calcShareForApt` war damit `pkTotal = Number(undefined) \|\| 0 = 0` → Division durch 0 → 0 für alle Einheiten |
| 2 | **Fix**: Select auf `'id, name, type, total_value, heiz_split_percent'` erweitert (Zeile 224 `mod-finanzen.js`). Jetzt identisch mit dem PDF-Code in `utils-pdf.js` |
| 3 | **Saldo-Berechnung**: War bereits korrekt implementiert (Spitze + Zahlungsdifferenz) — Ergebnis stimmt nun, da Ist-Kosten korrekt berechnet werden |
| 4 | **Buttons über Tabelle**: „Abrechnung abschließen", „CSV", „PDF exportieren" in flex-Zeile neben Überschrift „Abrechnungsergebnis je Eigentümer" (rechtsbündig). Nur „← Zurück" verbleibt unten |

