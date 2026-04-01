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

- **Backend / DB / Auth:** Supabase (PostgreSQL 17, RLS). Auth: Supabase Auth aktiv — E-Mail/Passwort, Magic Link, Passwort-Reset. Registrierung aktuell nur durch Admin, Self-Service geplant (→ 7.8 Einladungscode)
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

### Multi-Page-Architektur (Phase 1B)
Das Dashboard bleibt SPA für Alltags-Module. Komplexe Tools werden als eigene HTML-Seiten ausgelagert.
Geteilte Basis: `config.js`, `utils.js`, `nav.js`. Deep-Linking per URL-Params (`?building=17&tab=projekte`).
Gebäude-Kontext wird via `sessionStorage` (`hb_active_building`) zwischen Seiten transportiert.

| Seite | Module | Zielgruppe |
|---|---|---|
| `dashboard.html` | Dashboard, Tickets, News, Kontakte, Kalender, CRM, Objekte, Einstellungen | Alle Rollen |
| `zeiterfassung.html` | Zeiterfassung & Projekte | admin, manager |
| `etv.html` *(geplant)* | Eigentümerversammlung | admin, manager |
| `dokumente.html` *(geplant)* | Dokumenten-Cloud | Alle Rollen |
| `finanzen.html` *(geplant)* | Buchhaltung & Finanzen | admin, manager, advisory |

```
dashboard.html              # HTML-Shell — SPA für Alltags-Module
zeiterfassung.html          # Standalone — Zeiterfassung & Projekte (Phase 1B PoC)
js/
  config.js                 # Supabase-Client, globale Vars, Icons, EXTERNAL_PAGES Routing
  utils.js                  # Toast, Dropdown, Logout, Mobile-Menu, Modal/Bottom-Sheet
  utils-pdf.js              # Official Letter Engine (pdf-lib)
  nav.js                    # init(), Multi-Page-Routing, renderNav(), renderBottomNav(), Active-State
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
    mod-zeiterfassung.js    # Zeiterfassung & Projekte (→ zeiterfassung.html, nicht mehr in dashboard.html)
    mod-settings.js         # Admin-Einstellungen (Firmendaten, Finanz-Defaults, Logo/Briefbogen-Upload)
    mod-placeholder.js      # Platzhalter für kommende Module (loadProfile, loadMyUnits, loadMyTenants)
    mod-etv.js              # Eigentümerversammlung (Planung, Check-in, Abstimmung, Protokoll)
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
- **Bottom-Nav (Mobile):** `.bnav-item` gray-400, `.bnav-active` hb-olive + Dot. 5 Items: Home, Tickets, News/Kontakte, Dokumente, Mehr
- **Skeleton Loading:** `.skeleton` Klasse (Shimmer-Animation, rounded-[15px]). Typen via `showSkeleton()`: list, cards, table
- **Mobile Scroll-Containment:** Content-Area ist der einzige Scroll-Container. Nie `overflow-y-auto` auf Body oder Main
- **Responsive Tables:** `.rtable`-Klasse auf Container → automatische Card-Umwandlung auf Mobile. `makeTableResponsive(el)` nach jedem Table-Render aufrufen
- **Touch-Targets:** Alle interaktiven Elemente `min-h-[44px] min-w-[44px]`. Buttons/Links mit `p-3` statt `p-1`
- **Multi-Page Nav-Links:** Für Module in `EXTERNAL_PAGES` → `<a href="...">`. Für SPA-Module auf Dashboard → `onclick`. Auf externen Seiten → SPA-Links zeigen auf `dashboard.html?m=fnName`
- **Externe Seiten HTML-Shell:** Identische Struktur wie `dashboard.html` (Sidebar, Header, Content-Area, Bottom-Nav). Nur seitenspezifische `<script>`-Tags. Logo/Header-Klick → `dashboard.html`

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
- 1B 🔄 **Frontend-Architektur: Dashboard vs. externe Tools**
  > Dashboard (`dashboard.html`) für Übersicht + leichte Module. Separate HTML-Seiten für komplexe Tools: Finanzen (`finanzen.html`), ETV (`etv.html`), Zeiterfassung (`zeiterfassung.html`), Dokumentencloud (`dokumente.html`).
  > Im Dashboard bleiben: Startseite/Workspace, Tickets, Schwarzes Brett, Kontaktbuch, Kalender, CRM, Gebäude & Einheiten, Einstellungen.
  > Geteilte Basis: `config.js`, `utils.js`, `nav.js`. Deep-Linking mit Query-Parametern (z.B. `finanzen.html?building=17&tab=verteilerschluessel`). Mieter/Eigentümer-Dashboard bleibt SPA.
  > **PoC Zeiterfassung ✅:** `zeiterfassung.html` als erste extrahierte Seite. Multi-Page-Routing in `nav.js` (`_navItem`, `_getCurrentPage`, `bottomNavGo`). Auth-Guard, sessionStorage-Sync, Deep-Link-Routing (`?m=loadTickets`). Nächste Schritte: ETV, Dokumente, Finanzen.
- 1C 🔄 **Mobile-Audit & Responsive Patterns** (Phase A abgeschlossen)
  > **Phase A (Fundament) ✅:** Scroll-Containment (Body h-screen, Main flex-1 min-h-0, Content overflow-y-auto). Bottom-Navigation (5 Items rollenbasiert, Badge-Sync, Active-State-Sync mit Sidebar). Mobile-Header (Logo + Role-Label, Hamburger durch Bottom-Nav ersetzt). Skeleton-Loading CSS-Pattern. Safe-Area-Inset für Notch-Geräte. Toast-Position über Bottom-Nav.
  > **Phase B (Modals & Loading) ✅:** `showModal()`/`hideModal()` Utility (Desktop zentriert, Mobile Bottom Sheet). 8 Modals migriert (Tickets, Dokumente, Kontakte). Swipe-to-Dismiss. Skeleton-Loader im Dashboard.
  > **Phase C (Modul-Migration) ✅:** Responsive-Table CSS-Pattern (`.rtable`, auto data-labels). 26 `makeTableResponsive()`-Aufrufe in 8 Modulen. Ticket-Chat-Fix (dvh-Höhe + Overlay-Sidebar). Touch-Target 44px Audit (13 Korrekturen in mod-tickets).

### ✅ Phase 2 — Personen-CRM (ABGESCHLOSSEN)
- 2.1 Supabase-Anbindung (Mock-Daten ersetzt) ✅
- 2.2 Neue Person anlegen ✅
- 2.3 Person bearbeiten — 4-Tab-Formular (Stammdaten / Rollen / Portal / SEPA) ✅
- 2.4 Einladungscode generieren 💡 (→ hochgestuft nach 7.8)

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
- 4.12 **News-Durchreichen für landlord** (Landlord kann WEG-News an eigene Mieter weiterleiten/freigeben) 📋
- 4.13 **Ticket-Eskalation tenant→landlord→manager** (3-stufige Eskalationslogik statt nur owner→manager) 📋

### 🔄 Phase 5 — Dokumente & Kontakte (TEILWEISE ABGESCHLOSSEN)
- 5.1 Dokumenten-Cloud — Migration `phase5_documents` ✅
- 5.2 Dokumenten-Cloud — `mod-dokumente.js`: Upload, Download, Vorschau, Kategorien, Read-Tracking, Nav-Badge, Listen- & Baumansicht, Draft-Workflow, Auto-Naming, `document_links` für Personen-Scope ✅
- 5.3 Kontaktbuch — `mod-kontakte.js` ✅
- 5.4 Dashboard KPIs (rollenbasiert, Kennzahlen, Fristen-Widget) ✅
- 5.5 **Bulk-Release** (Massen-Freigabe von Dokumenten, z.B. 150 Jahresabrechnungen gleichzeitig) 📋
- 5.6 **ETV-Dokumente & Beschlusssammlung** (Einladungen/Protokolle generieren, gesetzliche Beschlusssammlung §24 Abs. 7 WEG) 📋
- 5.7 **Landlord-Funktionen** 📋
  - 5.7-A **Widget "Meine Mieter"** (Dashboard-Widget: Mieter-Liste, Mietverträge, deren offene Tickets) 📋
  - 5.7-B **Dokument-Durchreichen** (Landlord kann WEG-Dokumente für eigene Mieter freigeben → Mieter-Silo: Mieter sieht nur aktiv durchgereichte Dokumente) 📋

### 🔄 Phase 5.8 — ETV-Begleiter (Eigentümerversammlung)
*Komplettmodul: Planung, Check-in, Abstimmung, Protokoll, Beschlusssammlung.*
- 5.8-A Planung: Sessions, TOPs, Check-in, Abstimmung (MEA/Kopf/Objekt), Protokoll-PDF ✅
- 5.8-B Einladungs-PDF mit ETV-Staging-Workflow ✅
- 5.8-C **Dynamische Platzhalter in TOPs** (Text-Platzhalter z.B. `[BEAUFTRAGTE_FIRMA]` mit Auswahlmöglichkeiten) 📋
- 5.8-D **Vollmachten-System** (Formular + TOP-bezogene Weisungen Ja/Nein/Enthaltung + Verwalter-Vollmacht) 📋
- 5.8-E **Kontextsensitive Abstimmungs-Engine** (variable Abfrage-Reihenfolge, Effizienz-Logik "Einstimmiges JA", Platzhalter-Finale) 📋
- 5.8-F **Unterschriften-Workflow + Beschlusssammlung §24 Abs. 7 WEG** (Verwalter-Eintrag wer/wann unterschrieben, automatischer Transfer in gebäudespezifische Beschlusssammlung) 📋
- 5.8-G **Kommunikation & Termine** (Auto-News "ETV-Planung gestartet", Antragsfrist, Kalendereintrag, digitale Einladung im Portal) 📋

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
- 6.11 **Zeiterfassung & Projekte** (Projektbezogene Zeiterfassung mit Arbeitspaketen, Live-Timer, manueller Zeiteintrag, Bearbeitung, Arbeitsrapport-PDF, Nav-Integration) ✅
- 6.14 **Automatischer Zahlungsabgleich** (Fuzzy-Match beim CSV-Import: Betrag + IBAN → offene Sollstellung vorschlagen) 📋
- 6.15 🟡 **WP/JAB Testing & UX-Verbesserung** (zurückgestellt bis Praxis-Feedback vorliegt — mögliche Richtung: Inline-editierbare Tabellen statt Modals, direktes Hinzufügen/Entfernen von Positionen) 📋

### 🔄 Phase 7 — System, Einstellungen & Benachrichtigungen
*Querschnitts-Modul: Konfiguration, E-Mail-Push, User-Profile, Audit, PWA.*
- 7.1 **Admin-Einstellungen** (Firmenstammdaten, Briefkopf-Upload, Mahngebühr, Basiszins) ✅
- 7.2 **E-Mail-Benachrichtigungen** (Trigger: neue Tickets, Statusänderungen, neu freigegebene Dokumente, News) 📋
- 7.3 **Nutzer-Einstellungen** (Passwort ändern, Notification Opt-Ins je Trigger-Typ) 📋
- 7.4 **System-Logs / Audit Trail** (revisionssichere Aktions-Historie für Admin: Wer hat wann was geändert?) 📋
- 7.5 **In-App Hilfe & Onboarding** (Fragezeichen-Symbol je Modul → kontextbezogene Doku / Guided Tour) 📋
- 7.6 **PWA-Implementierung** (`manifest.json`, Service Worker, Icons, Offline-Fallback — installierbar auf iOS/Android-Homescreen) 📋
- 7.7 **SSOT-Audit** (Hausgeld dynamisch aus WP, Basiszins + Mahngebühren aus `global_settings`, Heizkosten-Split aus `distribution_keys`, ETV-Quorum konfigurierbar, Enums zentralisiert in `config.js`) ✅
- 7.8 🟡 **Einladungscode & Nutzer-Onboarding** (Admin generiert Registrierungscode → `persons.invite_code` → Registrierungsseite. MVP reicht) 📋
- 7.9 **Beirat-Auftragsfreigabe** (Advisory-Rolle kann Aufträge/Ausgaben ab Schwellwert freigeben, Freigabe-Status wird bei Buchung geprüft) 📋
- 7.10 🟡 **PDF-Vorlagen-System (Template-Engine)** 📋
  > Ablösung hardcodierter PDF-Texte in `utils-pdf.js` durch datenbankgestütztes Vorlagen-System.
  > Neue Tabelle `pdf_templates` (Typ, JSON-Block-Array). Blocktypen: heading, text, table, spacer, hinweis_box. Textblöcke mit Platzhaltern (`{{eigentuemer_name}}`, `{{abrechnungssaldo}}`). Tabellenblöcke referenzieren Datenquellen.
  > Admin-UI: Block-Editor in Einstellungen (Drag & Drop, Basic-Formatierung, Platzhalter-Palette).
  > Umsetzung: (1) Architektur + erster Template-Typ, (2) schrittweise Migration aller PDF-Typen.

### 💡 Phase 8 — Automatisierung & Erweiterungen
*Nach Projektabschluss — optionale Nachrüstung.*
- 8.1 **Umlaufbeschluss-Modul** (digitale Abstimmung ohne Video, Protokoll-PDF) 💡
- 8.2 **KI-Belegerfassung** (PDF-Upload → OCR via Google Document AI → Buchungsvorschlag) 💡
- 8.3 **Messdienstleister CSV-Import** (Techem/Ista Ablesewerte als CSV importieren) 💡
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

> Komprimierte Dokumentation aller durchgeführten Änderungen.
> Migrationen, Architektur-Entscheidungen und DB-Schema-Änderungen bleiben erhalten.

---

### Phase 1 — Tech-Debt & Infrastruktur
RLS-Cleanup, FK-Indexes, Security-Warnings, Migration-Files, Frontend-Modularisierung (`dashboard.html` → `config.js`, `utils.js`, `nav.js`, `mod-*.js`).

### Phase 2 — Personen-CRM (`3d951de`)
Migrationen: `extend_persons_crm` (5 Felder), `extend_apartments_mea` (MEA). `mod-personen.js` auf Supabase CRUD, `mod-persons-edit.js` (4-Tab-Formular).

### Phase 3 — Objekte & Zuweisungen (`28b8842`..`b54f195`)
Migration `extend_apartments_warm_water_meter`. Gebäude-Detail (4 Tabs), Einheiten-Detail (5 Tabs), Zuweisungs-Modal (Autocomplete, Quick-Create, `ownerships`/`tenancies`), Einheiten als Tabelle.

### Phase 4 — Kommunikation (`9682a6b`..`5ff7ad5`)
Migration `phase4_news_and_tickets`. `mod-news.js` (Feed, Filter-Chips, Like, Read-Tracking, Rich-Text-Editor). `mod-tickets.js` (Zwei-Spalten, Chat-Bubbles, Realtime via `postgres_changes`). Status-Flow (5 Stufen), Wiedervorlage/Snooze, Auto-Reopen, Eskalation, Deep-Links, Mobile 3-Zustands-Flow.

### Phase 5 — Dokumente, Kontakte, Dashboard, Kalender (`f2ef175`, `45c3672`)
Migration `phase5_documents`, `phase5b_document_links`, `fix_document_reads_legacy_trigger`. Globaler UI-Overhaul (olive Cards/Nav). `mod-dokumente.js` (Upload, Vorschau, Draft-Workflow, Listen-/Baumansicht, Auto-Naming, Personen-Scope). `mod-kontakte.js`. `mod-dashboard.js` (Admin/Manager: 4 KPIs + 4 Widgets; Tenant/Owner: 4 KPIs + 4 Widgets). `mod-kalender.js` (Monatskalender, Fristen-Pills, Ticket-Wiedervorlagen, Deadline-Popup).

### Phase 6-A — Finanzen DB-Fundament
Migration `phase6a_finance_foundation`: 8 Tabellen (`accounts`, `journal_entries`, `budget_plans`, `budget_plan_items`, `payment_demands`, `special_levies`, `dunning_notices`, `beirat_access_periods`). GoBD-konform: `journal_no_update`/`journal_no_delete` RULES. 17 System-Konten (SKR03/04). 5 Performance-Indexes.

### Phase 6-B — Buchhaltung UI
`mod-finanzen.js`: 5-Tab-Layout (Übersicht/Buchungen/Zählerstände/Sollstellungen/Onboarding). Kontenblatt + Saldo, Buchungsmaske + Beleg-Upload, Schnelleingabe-Grid Zähler, Sollstellungs-Generierung, Onboarding-Wizard.

### Phase 6-C — Wirtschaftsplan, Sonderumlagen, Rücklage, Belegprüfung
WP-Tab (draft→approved→active→closed, Positionen, Auto-Kalkulation). Sonderumlagen (Verteilungsschlüssel, payment_demands). Rücklage-Tab (Echtzeit-Saldo, Zuführung/Entnahme). Belegprüfung (Beirat-Freigabezeiträume, Read-Only-View).

### Phase 6-D — Jahresabrechnung, Mahnwesen, DATEV-Export
JAB 5-Schritte-Wizard (Konto-Checkliste, Ist-Zahlen, Umlageschlüssel, Soll-Ist-Abgleich, Abschluss). Heizkosten Option A/B. §35a EStG. Mahnwesen (Stufe 1-3, Zinsberechnung). DATEV-Export (EXTF-Header, SKR03/04).

### Phase 6-E — CSV-Import & SEPA-Export (`3efc9ed`)
CSV-Import (MT940/Sparkasse/Volksbank/allgemein, Drag & Drop, Duplikat-Check). SEPA-Export (PAIN.008.003.02). Testdaten-Scripts.

### Phase 6-F — Belege, Konten-CRUD, Unterkonten
Migration `phase6f_journal_attachments_and_subaccounts` (`journal_attachments`, `parent_account_id`). Konten bearbeiten/löschen (Soft-Delete, System-Schutz). Unterkonto-Hierarchie (eingerückt └). Konto-Ledger, Suchleiste, Buchungs-Detailansicht.

### Phase 6.9 — Official Letter Engine + PDF-Redesign
Migration `global_settings`. `mod-settings.js` (Firmenstammdaten, Finanz-Defaults, Briefpapier). `utils-pdf.js`: `generateMahnungPDF`, `generateWirtschaftsplanPDF`, `generateEinzelwirtschaftsplanPDF` (Inter-Font, 5-Block-Aufbau, Briefbogen-Integration, Seitenumbruch-Logik). `generateJahresabrechnungPDF` (Anschreiben + Einzelabrechnung, Direktkosten-Split, Saldo-Berechnung). `formatBuildingName()` global.

### Phase 6.10 — Verteilerschlüssel & Einzelwirtschaftspläne
Migration `phase610_distribution_keys` (`distribution_keys`, `distribution_key_units`, `accounts`-Erweiterung). 5. Tab im Gebäude-Detail. Schlüsselzuweisung je Konto (primär/sekundär). Bulk-PDF Einzelwirtschaftspläne mit Dual-Key-Support. Gesamtumlage manuell/auto.

### Phase 6-D.3 — Mahnungs-Buchungslogik
Migration `migration_phase6d3_mahnung_accounts.sql`: Konten 1420/8010/8020 als System-Templates. Korrekte 3er-Split Buchungslogik: Mahnung-Erstellung (4201→1420), Zahlung (1200→1400/8010/1420), Storno (GoBD-konform). `_finEnsureAccounts` kopiert `is_system_account` + `is_allocatable`.

**Architektur-Entscheidung Mahngebühr-Buchungsfluss:**
- Erstellung: Debit 4201 (Aufwand, apartment_id) / Credit 1420 (Forderung) → Direktkosten in JAB
- Zahlung: Debit 1200 (Bank) / Credit 1420 (Forderung löschen, kein apartment_id) → neutral für JAB

### GoBD-Fix — journal_no_update RULE vs. Trigger
`journal_no_update` war als RULE (`DO INSTEAD NOTHING`) statt Trigger angelegt → alle UPDATEs still ignoriert. Fix: DROP RULE, Trigger `journal_no_update_fn` aktiv (blockiert Finanzdaten, erlaubt Metadaten). `journal_no_delete` RULE bleibt (GoBD: kein Löschen). Migration `migration_journal_metadata_update.sql`.

### Phase 8.1 — Sonderrollen & Finanz-Klassifizierung
Migration `phase81_special_roles_and_allocatable`: 6 Rollen (+landlord, +advisory), `is_allocatable` BOOLEAN. 6 RLS-Policies (3×landlord, 3×advisory). WP-Tabelle nach umlagefähig/nicht gruppiert. PDF-Sektionen auf `is_allocatable` umgestellt. Nav-Sektionen je Rolle.

### Zeiterfassung-Modul
`mod-zeiterfassung.js`: Projekte, Arbeitspakete, Live-Timer, manuelle Einträge, Bearbeitung. Arbeitsrapport-PDF. Migration `migration_zeiterfassung.sql` (3 Tabellen).

### ETV-Modul & Staging-Workflow
`mod-etv.js`: Planung (Sessions, TOPs, Vorbemerkung, interne Notiz), Check-in (Präsenz/Vollmachten), Abstimmung (MEA/Kopf/Objekt), Protokoll-PDF. Migration `migration_etv.sql` (4 Tabellen), `etv_agenda_items` um `preliminary_remark`/`internal_note` erweitert. ETV-Staging: WP/JAB pro Einheit splitten + in Storage uploaden. Einladungs-PDF mit automatischem Anhang.

### Phase 7.7 — SSOT-Audit
`getMonthlyHausgeld()` berechnet Hausgeld dynamisch aus WP + Verteilerschlüssel (3 Module umgestellt). Basiszins + Mahngebühren aus `global_settings`. Heizkosten-Split aus `distribution_keys.heiz_split_percent`. ETV-Quorum konfigurierbar (`etv_sessions.quorum_percent`, Migration `migration_etv_quorum_percent.sql`). 16 zentrale Enum-Konstanten in `config.js`, 10 Module umgestellt.

### Phase 1C-A — Mobile-Fundament (Bottom-Nav, Scroll-Containment, Skeleton)
**Architektur-Entscheidungen:** (1) Hamburger-Menü mobil komplett durch Bottom-Nav ersetzt; Sidebar wird über "Mehr"-Item als Slide-In geöffnet. (2) Gesten via Vanilla-JS `touch*`-Events, passive Listeners (vorbereitet für Phase B). (3) Scroll-Containment: Body `h-screen overflow-hidden`, Main `flex-1 min-h-0 overflow-hidden`, Content-Area einziger Scroll-Container (`flex-1 min-h-0 overflow-y-auto`).

`dashboard.html`: Layout-Fix (Body h-screen, Main flex-1, kein doppeltes overflow-y-auto). Mobile-Header ohne Hamburger (Logo + Role-Label). Desktop-Header auf Mobile kompakt (nur Avatar). Bottom-Nav (`#bottom-nav`, md:hidden). CSS: `.bnav-item`/`.bnav-active` (Active-Dot), `.skeleton`/`@keyframes sk-shimmer`, Safe-Area-Inset. Toast-Position `bottom-20 md:bottom-6`.

`nav.js`: `renderBottomNav(role)` (5 Items rollenbasiert: admin/manager, tenant, owner/landlord/advisory). `bottomNavGo(fnName, el)` (Active-State + Sidebar-Sync). `_syncBottomNav(fnName)` (Sidebar→Bottom-Nav, Fallback "Mehr"). `_setBnavBadge(id, count)` (Badge-Sync Sidebar↔Bottom-Nav).

`utils.js`: `showSkeleton({ rows, type })` — Typen: `list` (Avatar + Text), `cards` (Block-Platzhalter), `table` (Header + Zeilen).

`config.js`: `icons.more` (Hamburger-SVG für Bottom-Nav "Mehr"-Item).

### Phase 1C-B — Bottom Sheets, Modal-Migration, Skeleton-Integration
`utils.js`: `showModal(id, contentHtml, options)` — Desktop: zentriertes Modal (scale-in). Mobile: Bottom Sheet (slide-up, `rounded-t-[15px]`, max-h-85vh). `hideModal(id)` mit Animate-Out. `_addSwipeToDismiss(modal)` (Swipe-Down-to-Dismiss, Threshold 80px, passive touch-Listeners). Escape-Key-Handler.

`dashboard.html`: CSS `.modal-sheet` (transition transform 0.3s) + `.modal-inner` (transition transform/opacity 0.2s).

**Modal-Migration (8 Modals in 3 Modulen):**
- `mod-tickets.js`: `showCreateTicketModal` → `showModal()`. Grid `grid-cols-1 md:grid-cols-2`.
- `mod-dokumente.js`: 3 Modals (`doc-detail-modal`, `doc-edit-modal`, `doc-upload-modal`) → `showModal()`.
- `mod-kontakte.js`: 4 Modals (`contact-detail-modal`, `contact-form-modal`, `add-persons-prompt`, `contact-person-form-modal`) → `showModal()`.

**Skeleton-Loader:** Dashboard-Spinner (Admin + User) durch Skeleton-Platzhalter ersetzt (4 KPI-Blocks + Widget-Blocks).

### Phase 1C-C — Responsive Tables, Ticket-Chat-Fix, Touch-Targets
`dashboard.html`: CSS `.rtable` Pattern — auf Mobile (< 768px) werden `<table>` automatisch in gestapelte Cards umgewandelt. `<thead>` versteckt, `<tr>` als Card mit border-radius, `<td>` als Flex-Row mit `data-label`-Pseudo-Element. `.td-action` für volle Breite bei Button-Spalten. `.td-hide-mobile` zum Ausblenden.

`utils.js`: `makeTableResponsive(elOrId)` — liest `<th>`-Texte, setzt `data-label` auf `<td>`, erkennt Action-Spalten automatisch (Buttons/Links), fügt `.rtable`-Klasse hinzu.

**Tabellen-Migration (26 Aufrufe in 8 Modulen):**
- `mod-personen.js`: Personen-Tabelle
- `mod-objekte.js`: Einheiten-Liste, Bankkonten, Verteilerschlüssel (3 Tabellen)
- `mod-tickets.js`: Ticket-Liste, Suchergebnisse
- `mod-dokumente.js`: Dokument-Liste
- `mod-dashboard.js`: Widget-Tabellen (Admin + User Dashboard)
- `mod-finanzen.js`: 14 Tabellen (Konten, Journal, Zähler, Sollstellungen, WP, JAB, Mahnwesen, CSV, SEPA, Rücklage, Beirat)
- `mod-zeiterfassung.js`: Zeit-Historie
- `mod-etv.js`: ETV-Staging

**Ticket-Chat-Fix:** Card `h-[calc(100dvh-160px)]` mit `overflow-hidden`. Chat-Bereich `min-h-0` für korrektes Flex-Shrinking. Info-Sidebar als Overlay auf Mobile (`max-lg:absolute max-lg:inset-0`), "Zurück zum Chat"-Button.

**Touch-Target 44px Audit (mod-tickets.js):** 13 Korrekturen: Create-Button, Filter-Buttons, Gebäude-Filter, Suchfeld, Zurück-Button, Info-Toggle, Send-Button, Modal-Close, Status-Select, Assignee-Select, Deep-Links, Eskalation-Button.

### Phase 1B-PoC — Multi-Page-Architektur (Zeiterfassung)
**Architektur-Entscheidungen:**
- **Shared Layout:** Externe HTML-Seiten haben identische DOM-Struktur (Sidebar, Header, Content-Area, Bottom-Nav). `nav.js` injiziert Navigation in dieselben Container-IDs — keine redundante Kopie.
- **Asset-Loading:** Direkte `<script>`-Tags pro Seite, kein dynamischer Loader. Jede Seite lädt nur benötigte Module.
- **Navigation:** `_navItem()` erzeugt automatisch `onclick` (SPA auf Dashboard) oder `href` (Cross-Page). Auf externen Seiten zeigen SPA-Links auf `dashboard.html?m=loadXxx`.
- **Active-State:** Auf Dashboard per `setActiveNav()` onclick-Handler. Auf externen Seiten per `_getCurrentPage()`-Match im `_navItem()`.
- **Deep-Linking:** Dashboard liest `?m=`-Parameter und ruft das Modul direkt auf. Module lesen `?building=`-Parameter.
- **Shared State:** `sessionStorage.hb_active_building` wird bei Gebäude-Wechsel gesetzt und von externen Seiten als Fallback gelesen.
- **Auth-Guard:** `EXTERNAL_PAGE_ROLES` in config.js → `init()` prüft Rolle und redirected zu dashboard.html.

**Geänderte Dateien:**
- `config.js`: `EXTERNAL_PAGES` (Routing-Map), `EXTERNAL_PAGE_ROLES` (Auth-Guard), `_getCurrentPage()`, `_isExternalPage()`, `_syncBuildingToSession()`.
- `nav.js`: Komplett refactored. `_navItem()` (Multi-Page-Link-Generator), `init()` (Page-Detection, Auth-Guard, Deep-Link-Routing, PAGE_INIT), `renderNav()` (über `_navItem` statt hardcoded onclick), `bottomNavGo()` (Cross-Page-Navigation, sessionStorage-Sync), `renderBottomNav()` ("Mehr"-Active auf externen Seiten).
- `mod-zeiterfassung.js`: Building-Kontext aus URL-Param (`?building=`) > `sessionStorage` > erster in Liste. `_timeChangeBuilding()` synct zu sessionStorage.
- `dashboard.html`: `mod-zeiterfassung.js` Script-Tag entfernt (Kommentar-Platzhalter), Cache-Buster `v=20260401c`.
- Neu: `zeiterfassung.html` — eigenständige HTML-Shell, lädt nur `config.js`, `utils.js`, `utils-pdf.js`, `mod-zeiterfassung.js`, `nav.js`. Identisches Layout wie `dashboard.html`. Logo/Header linken zurück zu `dashboard.html`.

