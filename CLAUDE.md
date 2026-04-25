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

→ Vollständige Spezifikation in **`DESIGN.md`** (Single Source of Truth).

Kurzübersicht der wichtigsten Tokens:
- **Primärfarbe:** hb-olive `#687451`
- **Textfarbe:** hb-offblack `#373737`
- **Hintergrund:** hb-ultralight `#F5F5F5`
- **Akzent:** hb-orange `#EB762D`

Alle weiteren Farben, Typografie, Spacing, Radien, Schatten, Komponenten und Mobile-Patterns: siehe DESIGN.md.

---

## 4. Rollen & Berechtigungen (`profiles.role`)

| Rolle | Beschreibung |
|---|---|
| `admin` | Vollzugriff auf alle Objekte, Mandanten, Finanzen, Tickets |
| `manager` | Vollzugriff, limitiert auf zugewiesene Gebäude (`management_assignments`) |
| `owner` | Lesend: eigene Einheiten, WEG-Dokumente, Tickets, Kontaktbuch |
| `tenant` | Lesend: eigener Mietvertrag, Dokumente, Schwarzes Brett. Darf Tickets erstellen |

**Zusatz-Features (additiv zur Basis-Rolle `owner`):**

| Flag/Tabelle | Beschreibung |
|---|---|
| `profiles.is_landlord` | Owner + Vermieter-Bereich: eigene Mieter sehen/anlegen, Tickets an Mieter weiterleiten |
| `board_members` (pro Gebäude) | Owner + Beirat: Lesezugriff auf Finanzdaten (Konten, Buchungen, Belege) — gebäudespezifisch |

> **Architektur-Entscheidung Rollenbausteine:** `profiles.role` hat nur 4 Werte (admin/manager/owner/tenant). Landlord und Advisory sind keine eigenen Rollen, sondern additive Features. Ein Owner kann gleichzeitig Vermieter (`is_landlord=true`) UND Beirat (`board_members`-Eintrag) sein. Die Nav und Berechtigungen werden dynamisch zusammengesetzt.

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
| `etv.html` | Eigentümerversammlung | admin, manager |
| `finanzen.html` | Buchhaltung & Finanzen (13 Tabs, Deep-Link `?tab=buchungen`) | admin, manager, owner (mit board_members) |

```
dashboard.html              # HTML-Shell — SPA für Alltags-Module (+ Dokumente für alle Rollen)
zeiterfassung.html          # Standalone — Zeiterfassung & Projekte
etv.html                    # Standalone — Eigentümerversammlung (Planung, Check-in, Abstimmung, Protokoll)
finanzen.html               # Standalone — Buchhaltung (13 Tabs, Tab-Deep-Linking)
js/
  config.js                 # Supabase-Client, globale Vars, Icons, EXTERNAL_PAGES Routing
  utils.js                  # Toast, Dropdown, Logout, Mobile-Menu, Modal/Bottom-Sheet
  utils-pdf.js              # Official Letter Engine (pdf-lib) + Template-Engine (generateFromTemplate, Platzhalter-Parser)
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
    mod-settings.js         # Admin-Einstellungen (Firmendaten, Finanz-Defaults, Logo/Briefbogen-Upload, Dokumenten-Designer)
    mod-placeholder.js      # Mein Profil (Kontodaten + Benachrichtigungs-Toggles), Platzhalter (loadMyUnits, loadMyTenants)
    mod-etv.js              # Eigentümerversammlung (Planung, Check-in, Abstimmung, Protokoll)
```

### Design-Konventionen
→ Alle Konventionen (Card-Styles, Button-Varianten, Tabellen, Badges, Nav, Filter-Chips, Skeleton, Mobile-Patterns) sind verbindlich in **`DESIGN.md`** definiert.

Architektur-Konventionen, die NICHT zum Design-System gehören (verbleiben hier):
- **Supabase-Joins mit mehreren FKs:** immer expliziten FK-Hint verwenden, z.B. `profiles!uploaded_by(full_name)`
- **Multi-Page Nav-Links:** Für Module in `EXTERNAL_PAGES` → `<a href="...">`. Für SPA-Module auf Dashboard → `onclick`. Auf externen Seiten → SPA-Links zeigen auf `dashboard.html?m=fnName`
- **Externe Seiten HTML-Shell:** Identische Struktur wie `dashboard.html` (Sidebar, Header, Content-Area, Bottom-Nav). Nur seitenspezifische `<script>`-Tags. Logo/Header-Klick → `dashboard.html`
- **Responsive Tables:** `.rtable`-Klasse auf Container → automatische Card-Umwandlung auf Mobile. `makeTableResponsive(el)` nach jedem Table-Render aufrufen

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

**Phase 6.15 Vermögensbericht & Beirat-Prüfprotokoll:**
`financial_statements` (building_id FK BIGINT, fiscal_year INT, stichtag DATE, account_id FK BIGINT→accounts, system_balance DECIMAL, statement_balance DECIMAL, difference DECIMAL GENERATED, is_validated BOOLEAN, validated_at TIMESTAMP, notes TEXT. UNIQUE(building_id, fiscal_year, account_id). Index auf building_id+fiscal_year.)
`audit_protocols` (building_id FK BIGINT, fiscal_year INT, auditor_id FK UUID→profiles, status CHECK(pending/completed/disputed), check_date TIMESTAMP, scope_description TEXT, findings TEXT, is_formally_correct BOOLEAN, signature_data JSONB. UNIQUE(building_id, fiscal_year, auditor_id).)
`global_settings.audit_hint_text` (TEXT — editierbarer Hinweistext für Beirat-Cockpit)
`hausgeld_history` (building_id FK BIGINT, apartment_id FK BIGINT, old_hausgeld DECIMAL, new_hausgeld DECIMAL, change_reason TEXT, fiscal_year INT, changed_by FK UUID→profiles, changed_at TIMESTAMP. Index auf apartment_id+changed_at.)

**Phase 7 System-Tabellen:**
`global_settings` (single-row id=1: Firmenstammdaten, Finanz-Defaults, logo_url, letterhead_pdf_url, notifications_enabled BOOLEAN, notification_sender_email TEXT, notification_sender_name TEXT. RLS: lesen=alle, schreiben=admin)

**Phase 7.2 E-Mail-Benachrichtigungen:**
`notification_preferences` (user_id FK→profiles, trigger_type CHECK(ticket_new/ticket_status/document_released/news_new), enabled BOOLEAN DEFAULT true. UNIQUE(user_id, trigger_type). RLS: eigene lesen/schreiben, Admin liest alle.)
`email_log` (trigger_type TEXT, recipient_email TEXT, recipient_user_id FK→profiles, subject TEXT, status CHECK(pending/sent/failed/skipped), error_message TEXT, metadata JSONB. RLS: nur Admin/Manager lesen, Insert via service_role. Append-only Audit-Trail.)

**Phase 7.10 PDF-Vorlagen-System:**
`pdf_templates` (id UUID, type TEXT UNIQUE, name TEXT, description TEXT, content JSONB, use_letterhead BOOLEAN DEFAULT true, created_at, updated_at. RLS: lesen=authenticated, schreiben=admin. Index auf type.)

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
| Phase 7.10 | migration_pdf_templates | `pdf_templates`-Tabelle (type UNIQUE, name, content JSONB, use_letterhead). RLS: lesen=authenticated, schreiben=admin. Index auf type. Default-Template: Mahnung. |
| Phase 7.10.1 | migration_pdf_templates_wp | Default-Template `einzelwirtschaftsplan` in `pdf_templates` (19 Blöcke: Titel, Meta, Eigentümer, Hausgeld-Summary, Umlageschlüssel, Verteilung, Hinweis-Box). |
| Phase 7.10.2 | migration_pdf_templates_jab | Default-Template `jahresabrechnung` in `pdf_templates` (zweigeteilt: Anschreiben mit Saldo + Einzelabrechnung mit Abrechnungsergebnis, Umlageschlüssel, Verteilung, Hinweis-Box). |
| Phase 6.15-B | migration_financial_statements | `financial_statements`-Tabelle (Vermögensbericht § 28 WEG). UNIQUE(building_id, fiscal_year, account_id). Difference als GENERATED COLUMN. |
| Phase 6.15-C | migration_audit_protocols | `audit_protocols`-Tabelle (Beirat-Prüfprotokoll). UNIQUE(building_id, fiscal_year, auditor_id). + `global_settings.audit_hint_text` Spalte. |
| Phase 6.15-D | migration_documents_staging | `documents.metadata` JSONB-Spalte. Status-Erweiterung um `released` (kein CHECK-Constraint). |
| Phase 6.15-E | migration_jab_template_v2 | UPDATE `pdf_templates` SET content: JAB-Template erweitert um `jab_monats_matrix`, `vermoegen_konten`, `vermoegen_forderungen`. 3 page_breaks. |
| Phase 6.15-G | migration_hausgeld_history | `hausgeld_history`-Tabelle (Historisierung Hausgeld-Änderungen). RLS: admin/manager. Index auf apartment_id+changed_at. |
| Rollen-Refactoring | migration_role_refactor | `profiles.is_landlord` BOOLEAN. CHECK von 6→4 Rollen. Datenmigration landlord→owner+flag, advisory→owner. |
| RLS-Fix | migration_rls_read_policies_all_roles | SELECT-Policies für profiles, buildings, apartments (alle authenticated), tickets (eigene+zugewiesene+admin). |
| RLS-Fix | migration_rls_beirat_read | Beirat-Lesezugriff auf journal_entries, accounts, journal_attachments, audit_protocols (via board_members+access_periods). |
| RLS-Fix | migration_rls_beirat_cascade_fix | SELECT-Policies für board_members (eigene) + beirat_access_periods (eigene Gebäude) — behebt RLS-Kaskaden-Problem. |
| RLS-Fix | migration_fix_rls_recursion | DROP redundanter landlord-Policies (apartments/persons/documents) die Endlosschleifen verursachten. |
| RLS-Fix | migration_tickets_tenant_insert_policy | INSERT-Policy für Tickets: alle authenticated Users mit eigener creator_id. |
| RPC | migration_get_landlord_for_apartment | `get_landlord_for_apartment(apt_id)` — Landlord einer Einheit finden (SECURITY DEFINER). |
| RPC | migration_get_tenant_for_apartment | `get_tenant_for_apartment(apt_id)` — Tenant einer Einheit finden (SECURITY DEFINER). |
| RPC | migration_tenant_ticket_helpers | `get_my_units_for_tickets()` — Einheiten des Users für Ticket-Modal (SECURITY DEFINER). |
| RPC | migration_get_ticket_recipients | `get_ticket_recipients(bld_id)` — Mögliche Empfänger für Abwärts-Tickets (SECURITY DEFINER). |
| RPC | migration_check_is_advisory | `check_is_advisory()` — Prüft ob User aktives Beiratsmitglied ist (SECURITY DEFINER). |
| RPC | migration_get_beirat_access | `get_beirat_access()` — Alle aktiven Beirat-Freigabezeiträume des Users (SECURITY DEFINER). |
| PDF-Fix | migration_fix_umlageschluessel_format | JAB/WP-Templates: korrekte Blockfolge + EUR-Format auf Verteilung. |
| Phase 7.2 | phase72_email_notifications | `notification_preferences` (User-Opt-In/Out pro Trigger), `email_log` (Audit-Trail), `global_settings` +3 Spalten (notifications_enabled, sender_email, sender_name). RLS, Indexes. Edge Function `send-notification` (Brevo HTTP API). |

---

## 8. Projektplan & Status

### ✅ Phase 1 — Tech-Debt & Infrastruktur (ABGESCHLOSSEN)
- 1.1 RLS-Policies bereinigt ✅
- 1.2 Performance-Indexes angelegt ✅
- 1.3 Supabase Security-Warnings behoben ✅
- 1.4 Migration-Files eingeführt ✅
- 1.5 Frontend modularisiert (dashboard.html → Module) ✅
- 1B ✅ **Frontend-Architektur: Dashboard vs. externe Tools** (ABGESCHLOSSEN)
  > Dashboard (`dashboard.html`) für Übersicht + leichte Module + Dokumente. Separate HTML-Seiten für komplexe Tools: Finanzen (`finanzen.html`), ETV (`etv.html`), Zeiterfassung (`zeiterfassung.html`).
  > Dokumente bleiben bewusst im Dashboard (nahtloser Zugriff für Mieter/Eigentümer).
  > Geteilte Basis: `config.js`, `utils.js`, `nav.js`. Deep-Linking mit Query-Parametern (z.B. `finanzen.html?building=17&tab=buchungen`). Mieter/Eigentümer-Dashboard bleibt SPA.
  > `pdf-lib` + `fontkit` + `utils-pdf.js` aus Dashboard entfernt (nur noch in externen Seiten geladen).
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

### 🔴 Phase 5.8 — ETV-Begleiter (Eigentümerversammlung) — AKTUELLE PRIORITÄT
*Komplettmodul: Planung, Check-in, Abstimmung, Protokoll, Beschlusssammlung. Wird jetzt komplett fertiggestellt vor Phase 6.15ff.*
- 5.8-A Planung: Sessions, TOPs, Check-in, Abstimmung (MEA/Kopf/Objekt), Protokoll-PDF ✅
- 5.8-B Einladungs-PDF mit ETV-Staging-Workflow ✅
- 5.8-C **Dynamische Platzhalter in TOPs** (Text-Platzhalter z.B. `[BEAUFTRAGTE_FIRMA]` mit Auswahlmöglichkeiten) 📋
- 5.8-D **Vollmachten-System** (Formular + TOP-bezogene Weisungen Ja/Nein/Enthaltung + Verwalter-Vollmacht) 📋
- 5.8-E **Kontextsensitive Abstimmungs-Engine** (variable Abfrage-Reihenfolge, Effizienz-Logik "Einstimmiges JA", Platzhalter-Finale) 📋
- 5.8-F **Unterschriften-Workflow + Beschlusssammlung §24 Abs. 7 WEG** (Verwalter-Eintrag wer/wann unterschrieben, automatischer Transfer in gebäudespezifische Beschlusssammlung) 📋
- 5.8-G **Kommunikation & Termine** (Auto-News "ETV-Planung gestartet", Antragsfrist, Kalendereintrag, digitale Einladung im Portal) 📋
- 5.8-H **Person-Grouping in Präsenzliste** (Eigentümer mit mehreren WE wird einmal angezeigt mit Badges WE01+WE04, ein Klick checkt alle WE ein/aus. MEA + Kopfprinzip aggregieren Stimmen, Objektprinzip bleibt pro WE.) 📋
- 5.8-I **Mehrere Eigentümer pro WE (Miteigentümer)** (Schema-Erweiterung: `UNIQUE(session_id, apartment_id, person_id)` statt aktuell `UNIQUE(session_id, apartment_id)`. Eheleute/Erbengemeinschaft als getrennte Personen, aber pro Einheit nur **eine** Stimme. Voting-Logik + Vollmachten-Zuordnung + PDF-Protokoll müssen mitziehen.) 📋

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
- 6.15 🔴 **WP/JAB Workflow-Umbau** (NÄCHSTE PRIORITÄT — Ziel-Workflow definiert in `outputs/Finanzen-Workflow.md`, Tech-Konzept in `outputs/Finanzen-Technisch.md`, Gap-Analyse in `outputs/Finanzen-Gap-Analyse.md`)
  - 6.15-A ✅ **Journal-Sperre** — Buchungen für abgeschlossene Jahre blockieren. `_finIsYearClosed()` + `_finBlockIfYearClosed()` prüft `budget_plans.status='closed'`. 5 Insert-Stellen abgesichert, Stornos bleiben GoBD-konform erlaubt. Visuelles Lock-Banner im Journal-Tab.
  - 6.15-B ✅ **Vermögensbericht (JAB-Step 1)** — Neue Tabelle `financial_statements`. JAB-Wizard von 5 auf 6 Steps erweitert. Step 1: Saldenabgleich Bank/Rücklage (System vs. Auszug), Forderungen/Verbindlichkeiten mit Inline-Stornierung, Upsert in `financial_statements`. (§ 28 WEG).
  - 6.15-C ✅ **Beirat-Prüfprotokoll** — Neue Tabelle `audit_protocols`. Digitales Formular in Beirat-View (Ergebnis, Umfang, Feststellungen), Hinweisbox (Text aus `global_settings.audit_hint_text`), Prüfprotokoll-Übersicht in Admin-Belegprüfung.
  - 6.15-D ✅ **Dokumenten-Status-Lifecycle** — `documents.metadata` JSONB + Status `released`. `_pdfSplitAndUpload()` erstellt DB-Einträge mit `status:'draft'` + `metadata:{doc_type, fiscal_year, unit_id}`. Nicht-Admins sehen nur `active`/`released`.
  - 6.15-E ✅ **JAB-PDF erweitern** — Hausgeld-Monatsübersicht `jab_monats_matrix` (12 Monate Soll/Ist/Differenz + Gesamt-Zeile). Vermögensbericht als eigenes Blatt (Kontensalden aus `financial_statements` + offene Forderungen). Template v2 mit 3 page_breaks.
  - 6.15-F ✅ **ETV-Kopplung & Kombi-PDF** — `generateETVEinladungPDF()` um Status-Trigger erweitert: verknüpfte JAB/WP-Dokumente werden bei Einladungsgenerierung von `draft` → `released` geschaltet. Confirm-Dialog + Button-Fortschrittsanzeige in `mod-etv.js`.
  - 6.15-G ✅ **Beschluss-Aktivierung (Post-ETV)** — Button "Beschlüsse aktivieren" in JAB Step 6. Automatisches Hausgeld-Update aus WP, Sollstellungen für Abrechnungsspitzen (14 Tage Frist), Historisierung in `hausgeld_history`.

### 🔄 Phase 7 — System, Einstellungen & Benachrichtigungen
*Querschnitts-Modul: Konfiguration, E-Mail-Push, User-Profile, Audit, PWA.*
- 7.1 **Admin-Einstellungen** (Firmenstammdaten, Briefkopf-Upload, Mahngebühr, Basiszins) ✅
- 7.2 **E-Mail-Benachrichtigungen** (Brevo SMTP API, 4 Trigger, Edge Function, User-Opt-Out) ✅
- 7.3 **Nutzer-Einstellungen** (Passwort ändern, Notification Opt-Ins je Trigger-Typ) 📋
- 7.4 **System-Logs / Audit Trail** (revisionssichere Aktions-Historie für Admin: Wer hat wann was geändert?) 📋
- 7.5 **In-App Hilfe & Onboarding** (Fragezeichen-Symbol je Modul → kontextbezogene Doku / Guided Tour) 📋
- 7.6 **PWA-Implementierung** (`manifest.json`, Service Worker, Icons, Offline-Fallback — installierbar auf iOS/Android-Homescreen) 📋
- 7.7 **SSOT-Audit** (Hausgeld dynamisch aus WP, Basiszins + Mahngebühren aus `global_settings`, Heizkosten-Split aus `distribution_keys`, ETV-Quorum konfigurierbar, Enums zentralisiert in `config.js`) ✅
- 7.8 🟡 **Einladungscode & Nutzer-Onboarding** (Admin generiert Registrierungscode → `persons.invite_code` → Registrierungsseite. MVP reicht) 📋
- 7.9 **Beirat-Auftragsfreigabe** (Advisory-Rolle kann Aufträge/Ausgaben ab Schwellwert freigeben, Freigabe-Status wird bei Buchung geprüft) 📋
- 7.10 **PDF-Vorlagen-System (Template-Engine)** ✅
  > `pdf_templates`-Tabelle (type, name, content JSONB, use_letterhead). Blocktypen: heading, text, table, spacer, page_break, hint_box.
  > Platzhalter-Parser `{{variable_name}}` mit automatischer Ersetzung. Template-Renderer `generateFromTemplate()` in utils-pdf.js.
  > Dokumenten-Designer in Einstellungen (Splitscreen: Block-Editor + Live-Preview). Drag & Drop, Variablen-Palette, Debounced PDF-Vorschau.
  > PoC: Mahnung auf Template-System migriert (mit Legacy-Fallback). Weitere PDF-Typen schrittweise migrierbar.
- 7.11 🔄 **Stammdaten-Dynamisierung** (Quick-Wins)
  - 7.11-A ~~Gebäude-Bankdaten in Mahnung-PDF~~ — Nicht nötig: Mahnungstext verweist auf bekanntes WEG-Konto.
  - 7.11-B ~~Verwalter-Bankdaten global~~ — Nicht nötig: Bankdaten bereits auf Briefbogen abgebildet.
  - 7.11-C ✅ **Verzugszins Auto-Berechnung** — Mahnlauf-Default auf `base_rate + 5` (§ 288 BGB) vorbelegt, Hint-Text ergänzt.
  - 7.11-D ✅ **typeLabels zentralisieren** — `DISTRIBUTION_KEY_LABELS` in `config.js`, 6 Stellen in utils-pdf.js + mod-finanzen.js umgestellt.
  - 7.11-E ✅ **Mahngebühr-Verrechnungs-Hinweis** — Toast nach "Bezahlt"-Buchung mit Hinweis auf Überweisung auf Verwalterkonto.

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

### Design-Migration KOMPLETT ABGESCHLOSSEN (Blöcke 1–4)
DESIGN.md ist Single Source of Truth. Tailwind-Config, CSS, Radien, Schatten, Borders, Farb-Palette, Tap-Feedback, Toast-Varianten, Typografie-Hierarchie und Fließtext-Feinschliff — alles migriert.

### Design-Migration Block 4 — Fließtext-Feinschliff (text-sm → text-[15px])

**Selektive Migration nach Faustregel:** NUR echte Fließtext-Stellen (`<p>`-Beschreibungen, Empty-States, Hint-Texte, Modal-Bodys mit `leading-relaxed`). Form-Labels, Toggle-Switches, Tabellen-Zellen, Buttons, Selects, Card-Header, Sidebar-Items, Inline-Wertanzeigen bleiben bewusst auf `text-sm` (14px) — kompakter Charakter.

**63 Stellen migriert (von 633 text-sm-Vorkommen):**
- HTML-Shells (2): index.html "Bitte loggen Sie sich ein", register.html Code-Hint
- mod-news.js (4): Page-Subtitle, Empty-State, News-Card-Preview, Detail-Modal-Body
- mod-kontakte.js (3): Page-Subtitle, Empty-State, Quick-Create-Frage
- mod-kalender.js (1): Page-Subtitle
- mod-personen.js (1): Page-Subtitle
- mod-dashboard.js (10×replace_all): alle `<p class="p-6 text-sm text-gray-400 text-center">` Empty-States in Admin- und User-Widgets
- mod-dokumente.js (3): Page-Subtitle, Vorschau-Hinweis, Drag-Drop-Hinweis
- mod-tickets.js (2): "Bitte wähle..." Empty-State, "Noch keine Nachrichten"
- mod-objekte.js (8×replace_all + 1): alle `text-sm text-gray-400` Empty-States, "Keine Person gefunden"
- mod-etv.js (5): "Keine Gebäude", Protokoll-Beschreibung, Empty-State Dokumente, 2× Detail-Panel/Protokoll-Body
- mod-zeiterfassung.js (2): Kein-Zugriff-Hinweis, Projekt-Beschreibung
- mod-finanzen.js (10×replace_all "Kein Gebäude" + 11): Page-Subtitle, alle "Kein Gebäude gewählt", Belegprüfung-Empty, Eröffnungssalden-Description, Wirtschaftsplan-Empty, Rücklagekonten-Empty, Beirat-Subtitle + Hint, JAB-Description, CSV-Drop-Hinweis, Buchungen-Empty
- mod-settings.js (1): Designer-Empty-State
- mod-persons-edit.js (1): Zuweisungen-Empty-State

**Bewusst belassen** (sind keine Fließtexte, sondern semantisch andere Elemente):
- Form-Labels (z.B. mod-settings Toggle-Switch-Beschriftungen, mod-kontakte "24/7 Notfallkontakt")
- Card-Title in Sidebars (mod-dokumente "Alle Dokumente", mod-tickets Kategorie-Pills)
- Wert-Anzeigen in Forms (mod-placeholder Profile-Daten, mod-objekte Bool-Häkchen)
- Apartment-Subtitle (m², Zimmer — kompakte Info-Zeile)
- Inline-Hilfstexte in Tabellen-Zellen
- Dropdown-User-Name (Header)

Cache-Buster aller in Block 4 geänderten JS-Dateien (mod-news, mod-kontakte, mod-kalender, mod-personen, mod-dashboard, mod-dokumente, mod-tickets, mod-objekte, mod-etv, mod-zeiterfassung, mod-finanzen, mod-settings, mod-persons-edit) auf `v=20260425k`.

### Design-Migration Block 3 — Typografie-Hierarchie (Paket G abgespeckt)

**Paket G — Page-H1 + KPI-Zahlen:**
- **15 Page-H1 auf `text-[28px] font-bold`** angehoben (DESIGN.md §2 Typografie-Skala):
  - Login/Register: index.html "Mieterportal", register.html "Willkommen im Haus!"
  - Dashboard (admin + user): "Hallo, ${name}!"
  - Module: "Eigentümerversammlungen" (mod-etv), "Buchhaltung" (mod-finanzen), "Belegprüfung Beirat → ${gebäude}" (mod-finanzen Beirat-View), "Kalender", "Schwarzes Brett" (mod-news), "Kontaktbuch", "Globales Adressbuch" (mod-personen), "Dokumenten Cloud" (mod-dokumente), "Einstellungen" (mod-settings — war text-xl), "Zeiterfassung & Projekte" (mod-zeiterfassung — war text-xl), Projekt-Detail-Header in mod-zeiterfassung.
- **KPI-Zahlen im Dashboard auf `text-[32px] font-bold`** angehoben — zentral in `_dashKpi()` ([mod-dashboard.js:36](js/modules/mod-dashboard.js#L36)), wirkt auf alle Admin- und User-KPIs gleichzeitig.
- **font-weight harmonisiert** auf `font-bold` (700) gemäß DESIGN.md §2 — bisher meist `font-extrabold` (800).

**NICHT angefasst (laut Plan):** 629 `text-sm`-Vorkommen für Fließtext (zu hohes Layout-Risiko, geringer visueller Gewinn). Stattdessen nur globale Input-Größe via CSS in HTML-Shells (44px Höhe, 15px Schriftgröße) — bereits in Block 1 erledigt.

**Bewusst stehen gelassen:** mod-persons-edit.js Modal-Titel (`text-2xl`), Tickets-/Objekte-Card-Titelleisten (`text-sm` weiß auf olive — eigenes Design-Pattern, kein Page-Header).

Cache-Buster aller in Block 3 geänderten JS-Dateien (mod-dashboard, mod-dokumente, mod-etv, mod-finanzen, mod-kalender, mod-kontakte, mod-news, mod-personen, mod-settings, mod-zeiterfassung) auf `v=20260425j`.

### Design-Migration Block 2 — Patterns + Farb-Migration (Pakete C + H + E)

**Paket C — Tap-Feedback & Bottom-Sheet-Drag-Indicator:**
- CSS in 4 großen HTML-Shells: `.btn-primary:active`, `.btn-secondary:active`, `.tap-feedback:active` → `transform: scale(0.97)` + `opacity: 0.7` über 100ms. Selects/Toggle-Switches/Container-Buttons bewusst NICHT betroffen (kontrollierte Opt-in-Selektoren statt globalem `button:active`).
- `utils.js` → `showModal()`: Bottom-Sheet bekommt automatisch einen iOS-typischen Drag-Indicator (5×36px graue Pille, sticky oben). Plus alter `rounded-t-[15px]` → `rounded-t-2xl`.

**Paket H — Toast-Varianten + Segment-Bar CSS:**
- `utils.js` → `showToast()` Default geändert von `'success'` → `'info'`. Neue 3-Wege-Logik: `'success'` → `bg-hb-success`, `'error'` → `bg-hb-error`, sonst → `bg-hb-offblack`. **Verhaltenswechsel:** Bestehende Aufrufe ohne expliziten Type werden ab jetzt offblack statt hb-olive — wer Erfolgs-Grün will, muss explizit `'success'` übergeben.
- CSS `.segment-bar` + `.segment-item` (Apple-Stil, horizontal scrollbare Pill-Buttons) in 4 großen HTML-Shells als bereitstehendes Pattern. Migration konkreter Filter-Bars erfolgt später.

**Paket E — Verbotene Tailwind-Farben (red/blue/green/emerald/purple) → Brand-Palette:**
- 4 große HTML-Shells: Logout-Button `text-red-500/bg-red-50` → `text-hb-error/bg-hb-error/5`.
- index.html / register.html: Error-/Success-Boxes auf `bg-hb-error/12` und `bg-hb-success/12`.
- mod-dashboard.js: Deadline-Status (Überfällig/Kritisch/OK) auf hb-error/hb-success.
- mod-etv.js: Voting-JA-Button auf hb-success, Quorum-Pillen "Beschlussfähig", "Bereit"-Badge.
- mod-finanzen.js (23 Stellen): Saldos (negativ→hb-error, positiv→hb-success), Status-Badges Bezahlt/Aktiv/Ordnungsgemäß, Mahnung Stufe 3, Konto-Type-Badges (asset→olive, liability→gold-bold, revenue→success).
- mod-kalender.js (7 Stellen): Legenden-Punkte, Pillen-Mapping, Tage-Status-Texte.
- mod-news.js: Ankündigung-Badge `bg-blue-*` → olive.
- mod-objekte.js (3 Stellen, +emerald-Nachzügler): Eigentümer-Badge → olive, Mieter-Badge → gold-bold, Bool-Häkchen, Vermietet-Status, Assign-Selected-Box → success.
- mod-persons-edit.js (2 Stellen, emerald-Nachzügler): Registriert-Status, Aktiv-Badge → success.
- mod-settings.js: E-Mail-Log-Status (sent/failed/pending) auf success/error/gold-bold; Designer-Demo grüne Box → hb-success.
- nav.js: Nav-Fehler-Hinweis → hb-error.

**Mitgenommen aus Paket-C-Audit:** 3 verbliebene Sonder-Radien gefixt (utils.js Bottom Sheet `rounded-t-[15px]`, mod-etv.js Modal-Header/Footer `rounded-t-[20px]`/`rounded-b-[20px]` → 2xl).

Cache-Buster: utils.js + mod-etv.js auf `v=20260425h` (Pakete C+H), alle in Paket E geänderten JS-Dateien (mod-dashboard, mod-etv, mod-finanzen, mod-kalender, mod-news, mod-objekte, mod-persons-edit, mod-settings, nav.js) auf `v=20260425i`.

### Design-Migration Block 1 — Fundament (Pakete A + B + D + F)
DESIGN.md ist neue Single Source of Truth für alle UI-Tokens. Block 1 setzt das Fundament: Tailwind-Config, globales CSS, Border-Radien und Card-Borders. CLAUDE.md §3 (Design-System) und Design-Konventionen-Block durch Verweise auf DESIGN.md ersetzt — nur die nicht-UI-Architekturkonventionen (FK-Hint, Multi-Page-Nav, externe Shells, Responsive Tables) bleiben in CLAUDE.md.

**Paket A — Tailwind-Config & Farb-Tokens:** Alle 6 HTML-Shells synchron erweitert um neue Brand-Farben (`hb-white`, `hb-gray`, `hb-gold-bold`, `hb-gold-soft`) + semantische Farben (`hb-success #4A7C59`, `hb-error #C4453E`). `hb-ultralight` von `#F9FAF8` → `#F5F5F5` (Brand Guide). `borderRadius` korrigiert (lg=8px, xl=12px, 2xl=16px statt überall 15px). Neue `boxShadow`-Skala soft/md/lg.

**Paket B — Globales CSS in HTML-Shells:** Body-Hintergrund, `.card`-Klasse (Radius 16px, Schatten `0 2px 8px rgba(0,0,0,0.08)`, Border-Opacity 0.12), Inputs/Selects/Textareas (Radius 12px, Höhe **44px** für Touch-Target, Schriftgröße 15px, Hintergrund #F5F5F5), `.skeleton` (16px), `.rtable tbody tr` (16px + 0.12 Border). Sidebar-/Modal-/Sheet-Animationen auf Apple-Easing `cubic-bezier(0.25, 1, 0.5, 1)`. Neu: `@media (prefers-reduced-motion: reduce)` global.

**Paket D — Border-Radien-Konsolidierung:** 26× `rounded-[15px]` → `rounded-2xl` (16px) in 8 Dateien. mod-etv.js: Sonder-Radien `rounded-[20px/25px]` → `rounded-2xl`, `rounded-[30px/35px]` → `rounded-3xl` (Modals).

**Paket F — Card-Border-Hardcodes:** 26× `border-hb-olive/20` → `border-hb-olive/12` in 6 Modulen (etv, finanzen, kalender, objekte, settings, zeiterfassung). Plus 1 Inline-Style in mod-finanzen.js (rgba 0.15 → 0.12).

**Stille A11y-Fixes mitgenommen:** Input-Höhe 40 → 44px, Schriftgröße 14 → 15px, prefers-reduced-motion-Block.

**Geänderte Dateien:** 6 HTML-Shells (dashboard, etv, finanzen, zeiterfassung, index, register), 9 JS-Module (utils, mod-finanzen, mod-kalender, mod-news, mod-objekte, mod-personen, mod-etv, mod-settings, mod-zeiterfassung). Cache-Buster aller geänderten JS-Dateien auf `v=20260425g`.

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

### Phase 1B — Komplett-Migration (ETV + Finanzen)
**Strategie-Änderung:** Dokumente bleiben im Dashboard (nahtloser Mieter/Eigentümer-Zugriff). Nur 3 Module werden extrahiert.

**Geänderte Dateien:**
- `config.js`: `EXTERNAL_PAGES` um `loadETV`→`etv.html` und `loadFinance`→`finanzen.html` erweitert. `EXTERNAL_PAGE_ROLES` mit `advisory` für Finanzen (Belegprüfung).
- `nav.js`: `PAGE_INIT` um `etv` und `finanzen` erweitert.
- `mod-etv.js`: Building-Kontext aus URL-Param > sessionStorage > Default. `_etvOnBuildingChange()` synct zu sessionStorage.
- `mod-finanzen.js`: Building-Kontext + **Tab-Deep-Linking** (`?building=17&tab=buchungen`). 13 gültige Tab-Keys validiert. `_finOnBuildingChange()` synct zu sessionStorage.
- `dashboard.html`: `mod-finanzen.js`, `mod-etv.js` Script-Tags entfernt. **Bonus:** `pdf-lib`, `fontkit`, `utils-pdf.js` ebenfalls entfernt (keine PDF-Nutzer mehr im Dashboard) → schnellere Ladezeit.
- Neu: `etv.html` — eigenständige HTML-Shell, lädt `config.js`, `utils.js`, `utils-pdf.js`, `mod-etv.js`, `nav.js` + PDF-Libs (Einladungs-/Protokoll-PDF).
- Neu: `finanzen.html` — eigenständige HTML-Shell, lädt `config.js`, `utils.js`, `utils-pdf.js`, `mod-finanzen.js`, `nav.js` + PDF-Libs (WP/JAB/Mahnung-PDFs).

**Architektur-Ergebnis Phase 1B:**
Dashboard-Payload von ~15 Scripts auf ~10 reduziert (+3 CDN-Libs entfernt). Jede externe Seite lädt nur 5 eigene + 3 CDN-Scripts. Navigation, Active-State und Building-Kontext funktionieren nahtlos über Seitengrenzen hinweg.

### Phase 7.10 — PDF-Vorlagen-System (Dokumenten-Designer)
Migration `migration_pdf_templates.sql`: `pdf_templates`-Tabelle (type UNIQUE, name, description, content JSONB, use_letterhead BOOLEAN). RLS: lesen=authenticated, schreiben=admin. Default-Template: Mahnung (17 Blöcke).

**Architektur-Entscheidungen:**
- **JSON-Block-Struktur:** `content` ist ein Array von Block-Objekten `[{type, ...props}]`. Blocktypen: `heading`, `text`, `table`, `spacer`, `page_break`, `hint_box`. Erweiterbar durch neue Typen ohne Schema-Migration.
- **Platzhalter-System:** `{{variable_name}}`-Syntax, Parser per Regex. Unbekannte Platzhalter bleiben stehen (sichtbar im Preview). Variablen pro Template-Typ definiert in `PDF_TEMPLATE_VARIABLES`.
- **Tabellen-Datenquellen:** `table`-Blöcke referenzieren eine `source` (z.B. `offene_posten`). Spalten mit `width` (0–1 relativ), `align`, `format` (z.B. `eur`). Daten werden vom Caller übergeben (nicht vom Template geladen).
- **Template-Cache:** `_pdfLoadTemplate()` cached pro Session, `_pdfClearTemplateCache()` invalidiert nach Speichern im Designer.
- **Live-Preview:** Debounced (600ms). Nutzt Dummy-Daten aus `PDF_PREVIEW_DUMMY_DATA`. Rendert PDF via `pdf-lib` im Browser, zeigt als Blob-URL in `<embed>`.
- **Legacy-Fallback:** `generateMahnungPDF()` prüft ob ein `mahnung`-Template existiert. Wenn ja → Template-Engine. Wenn nein → hardcoded Layout bleibt erhalten.

**Geänderte Dateien:**
- `utils-pdf.js`: `_pdfReplacePlaceholders()` (Platzhalter-Parser), `generateFromTemplate()` (Block-Renderer mit Seitenumbruch-Logik), `_pdfLoadTemplate()` / `_pdfClearTemplateCache()` (DB-Zugriff + Cache), `PDF_PREVIEW_DUMMY_DATA` (Mahnung-Vorschaudaten), `PDF_TEMPLATE_VARIABLES` / `PDF_TEMPLATE_TABLES` (Variablen-/Tabellen-Definitionen). `generateMahnungPDF()` umgestellt auf Template-First mit Legacy-Fallback.
- `mod-settings.js`: Tab-Navigation (Allgemein | Dokumenten-Designer). Designer: Template-Selektor, Block-Editor (inline-editierbar, Drag & Drop, Hoch/Runter/Löschen), Variablen-Palette (klicken zum Einfügen), Live-Preview (Splitscreen, Debounced PDF-Rendering), Briefbogen-Checkbox, Speichern-Button.
- `dashboard.html`: CSS für `.ds-block` (Drag-Transition, Ring-Highlight). Cache-Buster für `mod-settings.js`.
- `etv.html`, `finanzen.html`, `zeiterfassung.html`: Cache-Buster für `utils-pdf.js`.
- Neu: `scripts/migration_pdf_templates.sql` — Tabelle + RLS + Default-Mahnung-Template.

### Phase 7.10.1 — Einzelwirtschaftsplan auf Template-System migriert
Migration `migration_pdf_templates_wp.sql`: Default-Template `einzelwirtschaftsplan` (19 Blöcke: Titel, Meta-Info, Eigentümer, Hausgeld-Summary, Umlageschlüssel, Verteilung, Hinweis-Box).

**Geänderte Dateien:**
- `utils-pdf.js`: `PDF_PREVIEW_DUMMY_DATA.einzelwirtschaftsplan` (Dummy-Daten für Live-Preview). `PDF_TEMPLATE_VARIABLES.einzelwirtschaftsplan` (17 Platzhalter). `PDF_TEMPLATE_TABLES.einzelwirtschaftsplan` (3 Tabellen: hausgeld_summary, umlageschluessel, verteilung). `generateEinzelwirtschaftsplanPDF()` umgestellt auf Template-First mit Legacy-Fallback (analog Mahnung-Pattern). Template-Pfad: pro Einheit Platzhalter + Tabellendaten berechnen → `generateFromTemplate()` mit Bulk-PDF-Support (aptPageRanges, ETV-Staging).
- Neu: `scripts/migration_pdf_templates_wp.sql` — Default-Template für Einzelwirtschaftsplan.

### Phase 7.10.2 — Jahresabrechnung auf Template-System migriert
Migration `migration_pdf_templates_jab.sql`: Default-Template `jahresabrechnung` (zweigeteilt via `page_break`: Anschreiben + Einzelabrechnung).

**Architektur:** Anschreiben (Seite 1) mit DIN 5008 (Absender, Empfänger, Datum) — DIN-Elemente werden VOR `generateFromTemplate()` auf die erste Seite gezeichnet, Template startet bei `startY = height - 200`. Nach `page_break` folgt die Einzelabrechnung (Abrechnungsergebnis, Umlageschlüssel, Verteilung).

**Geänderte Dateien:**
- `utils-pdf.js`: `PDF_PREVIEW_DUMMY_DATA.jahresabrechnung` (Dummy-Daten mit Guthaben-Szenario). `PDF_TEMPLATE_VARIABLES.jahresabrechnung` (24 Platzhalter inkl. saldo_label, saldo_info, bgh_hinweis). `PDF_TEMPLATE_TABLES.jahresabrechnung` (3 Tabellen: abrechnungsergebnis, umlageschluessel, verteilung). `generateJahresabrechnungPDF()` umgestellt auf Template-First mit Legacy-Fallback. Template-Pfad: pro Einheit Saldo berechnen + DIN 5008 zeichnen → `generateFromTemplate()` mit Bulk-PDF-Support (aptPageRanges, ETV-Staging).
- Neu: `scripts/migration_pdf_templates_jab.sql` — Default-Template für Jahresabrechnung.

### Phase 6.15-A — Journal-Sperre für abgeschlossene Wirtschaftsjahre
`mod-finanzen.js`: Zwei neue Hilfsfunktionen `_finIsYearClosed(buildingId, fiscalYear)` und `_finBlockIfYearClosed(buildingId, fiscalYear)`. Prüft `budget_plans.status = 'closed'` für das Gebäude + Jahr.

**Abgesicherte Insert-Stellen (5):**
- `_finSubmitBooking()` — Manuelle Buchungen
- `_finGenerateDemands()` — Sollstellungs-Generierung
- `_finBuchenRuecklage()` — Rücklage Zu-/Entnahmen
- `_finCreateDunning()` — Mahngebühr-Buchung
- `_finNoticePaidConfirm()` — Mahnzahlungs-Buchung

**Bewusst NICHT gesperrt (GoBD-konform):** `_finStorno()` und `_finNoticeReverse()` — Stornierungen müssen in abgeschlossenen Jahren weiterhin als Gegenbuchung möglich sein.

**UI:** Visuelles Lock-Banner (orange, Schloss-Icon) im Journal-Tab bei gesperrtem Jahr. Buchungsmaske wird ausgegraut (`opacity-50 pointer-events-none`).

### Phase 6.15-B — Vermögensbericht (§ 28 WEG) als JAB-Step 1
Migration `migration_financial_statements.sql`: Neue Tabelle `financial_statements` (building_id, fiscal_year, account_id, system_balance, statement_balance, difference GENERATED, is_validated, validated_at). UNIQUE-Constraint auf (building_id, fiscal_year, account_id).

**JAB-Wizard Umbau:** Von 5 auf 6 Steps erweitert. Neuer Step 1 = Vermögensbericht, alle bisherigen Steps um 1 nach hinten verschoben. Step-Labels im Stepper-Dot: Vermögen → Zeitraum → Ist-Daten → Schlüssel → Soll/Ist → Abschluss.

**Step 1 — Vermögensbericht:**
- **Phase A (Laden):** Bank-/Rücklagenkonten (asset, 1xxx) identifizieren. System-Saldo per Journal-Aggregation bis Stichtag 31.12. Bestehende `financial_statements` laden (falls bereits gespeichert). Offene Forderungen (`payment_demands` mit Status open/overdue) zum Stichtag.
- **Phase B (Speichern):** Eingetragene Bankstände per `UPSERT` in `financial_statements`. Auto-Validierung bei Differenz < 0,01 €.
- **UI:** Saldenabgleich-Tabelle (System-Saldo | Eingabefeld Auszug | Differenz | ✓-Status). Forderungen-Tabelle mit Inline-Stornierung. Grüner Haken bei Übereinstimmung.
- **Helpers:** `_finVSUpdateRow()` (Live-Update), `_finVSStornoDemand()` (Sollstellung stornieren).

**Geänderte Dateien:**
- `mod-finanzen.js`: 6-Step-Wizard, neue Step1Html (Vermögensbericht), Step-Nummern in allen Zurück/Weiter-Buttons und `_finJABNext()` aktualisiert. `_finJABStep2Html`–`_finJABStep6Html` (umbenannt). ~200 Zeilen neu.
- Neu: `scripts/migration_financial_statements.sql` — Tabelle + Index.

### Phase 6.15-C — Beirat-Prüfprotokoll
Migration `migration_audit_protocols.sql`: Neue Tabelle `audit_protocols` (building_id BIGINT, fiscal_year, auditor_id UUID, status, check_date, findings, is_formally_correct, signature_data JSONB). UNIQUE(building_id, fiscal_year, auditor_id). + `global_settings.audit_hint_text` Spalte.

**Beirat-View (`_finRenderBeiratView`) erweitert:**
- **Hinweisbox** (orange) oberhalb des Journals mit Text aus `global_settings.audit_hint_text` (Default-Text als Fallback).
- **Prüfprotokoll-Formular:** Ergebnis (Ordnungsgemäß/Beanstandung), Prüfungsumfang, Feststellungen (Pflicht bei Beanstandung). Per UPSERT gespeichert. Digitale Signatur-Metadaten (Timestamp, User-Agent) in `signature_data` JSONB.
- **Nach Abgabe:** Formular wird durch Read-Only-Ansicht des eingereichten Protokolls ersetzt.

**Admin-Belegprüfung (`_finLoadBelegpruefung`) erweitert:**
- Lädt `audit_protocols` parallel mit. Zeigt Prüfprotokoll-Tabelle (Prüfer, Datum, Ergebnis, Umfang, Feststellungen) zwischen Freigabe-Verwaltung und Buchungsvorschau.

**Geänderte Dateien:**
- `mod-finanzen.js`: Beirat-View komplett überarbeitet (~120 Zeilen), `_finBeiratSubmitProtocol()` neu, Admin-Belegprüfung um Protokoll-Anzeige erweitert.
- Neu: `scripts/migration_audit_protocols.sql` — Tabelle + RLS + Index + global_settings-Spalte.

### Phase 6.15-D — Dokumenten-Status-Lifecycle (draft→released)
Migration `migration_documents_staging.sql`: `documents.metadata` JSONB-Spalte (Default `{}`). Status `released` als neuer Wert neben `draft`/`active`.

**`_pdfSplitAndUpload()` komplett überarbeitet:**
- Neben Storage-Upload wird jetzt ein `documents`-DB-Eintrag erstellt: `status:'draft'`, `visibility_scope:'unit'`, `category:'Wirtschaftsplan'/'Jahresabrechnung'`, `metadata:{doc_type, fiscal_year, unit_id}`.
- Bei erneutem Upload (gleicher `file_path`): vorhandenes Dokument wird aktualisiert statt dupliziert.
- Toast-Text: "als Entwurf gespeichert" statt "für ETV gespeichert".

**Dokument-Sichtbarkeit:** Bereits korrekt implementiert — `mod-dokumente.js` filtert `.neq('status', 'draft')` für Nicht-Admins. Status `released` ist dadurch automatisch sichtbar. Admins sehen alle Status inkl. Draft-Filter-Chip.

**Status-Flow:** `draft` (bei PDF-Generierung) → `released` (bei ETV-Einladungsversand, implementiert in 6.15-G).

### Phase 6.15-E — JAB-PDF: Monatsübersicht + Vermögensbericht
Migration `migration_jab_template_v2.sql`: UPDATE des `jahresabrechnung`-Templates. 3 Seiten: Anschreiben → Einzelabrechnung (mit Monats-Matrix) → Vermögensbericht.

**Neue Tabellen-Quellen (3):**
- `jab_monats_matrix`: 12 Monatszeilen (Soll-Hausgeld, Ist-Zahlung, Differenz) + Gesamt-Zeile. Daten aus `payment_demands` (Soll pro Monat) + `journal_entries` auf Konto 1400 (Ist-Zahlungen pro Monat).
- `vermoegen_konten`: Bank-/Rücklagenkonten aus `financial_statements`. Saldo + Prüfstatus.
- `vermoegen_forderungen`: Offene `payment_demands` zum Stichtag 31.12. + Gesamt-Zeile.

**Geänderte Dateien:**
- `utils-pdf.js`: `_buildMonatsMatrix()` (Monatsdaten-Aggregation), Vermögensbericht-Datenload (einmalig vor Einheiten-Schleife). `PDF_TEMPLATE_TABLES.jahresabrechnung` um 3 Einträge erweitert. `PDF_PREVIEW_DUMMY_DATA.jahresabrechnung` um 3 Dummy-Tabellen. ~80 Zeilen neu.
- Neu: `scripts/migration_jab_template_v2.sql` — Template-UPDATE (kein INSERT, da Template bereits existiert).

### Phase 6.15-F — ETV-Kopplung & Kombi-PDF + Dokument-Freigabe
**Kombi-PDF** (bereits vorhanden): `generateETVEinladungPDF()` generiert pro Eigentümer ein zusammengeführtes PDF: Einladung + Tagesordnung + Vollmacht + WP/JAB-Anlagen (aus `etv-staging/`). Die Anlagen werden per `apartment_id` dem richtigen Eigentümer zugeordnet.

**Neu: Status-Trigger** (Zeile 3523–3539 in `utils-pdf.js`):
- Nach PDF-Download: alle `documents` mit `status='draft'` und `category IN ('Wirtschaftsplan', 'Jahresabrechnung')` des Gebäudes werden auf `status='released'` geschaltet.
- Toast zeigt Anzahl freigeschalteter Dokumente an.
- Error-Handling: Bei Fehler wird trotzdem das PDF ausgeliefert + Warnung gezeigt.

**Neu: Confirm + Fortschritt** (`mod-etv.js`):
- Confirm-Dialog warnt: "Dokumente werden für Eigentümer freigeschaltet"
- Button wechselt zu "Kombi-PDFs werden generiert…" + disabled während der Verarbeitung.

### Phase 6.15-G — Beschluss-Aktivierung (Post-ETV)
Migration `migration_hausgeld_history.sql`: Neue Tabelle `hausgeld_history` (building_id, apartment_id, old_hausgeld, new_hausgeld, change_reason, fiscal_year, changed_by, changed_at). RLS: admin/manager.

**`_finActivateBeschluss()` (mod-finanzen.js, ~100 Zeilen):**
Button "Beschlüsse aktivieren" in JAB Step 6 (neben "Abrechnung abschließen"). Confirm-Dialog mit 3-Punkte-Zusammenfassung. Führt 3 Aktionen aus:

1. **Sollstellungen für Abrechnungsspitzen:** Pro Einheit `payment_demands` mit `demand_type='nachzahlung'/'guthaben'`, Fälligkeit 14 Tage nach Klick. Nur wenn `|saldo| > 0.01`.
2. **Hausgeld-Update aus WP:** Sucht aktiven/approved WP für Folgejahr. Berechnet neues monatliches Hausgeld pro Einheit (Summe aller Planpositionen × Schlüsselanteil / 12). Aktualisiert `apartments.hausgeld` nur bei tatsächlicher Änderung.
3. **Historisierung:** Pro Hausgeld-Änderung ein Eintrag in `hausgeld_history` (alt/neu/Grund/FY/User).

**Geänderte Dateien:**
- `mod-finanzen.js`: `_finActivateBeschluss()` neu, Button in Step 6 HTML.
- Neu: `scripts/migration_hausgeld_history.sql` — Tabelle + RLS + Index.

### Rollenbausteine-Refactoring (landlord/advisory → Flags)
Migration `migration_role_refactor.sql`: `profiles.is_landlord` BOOLEAN. `profiles.role` CHECK von 6→4 Rollen (admin/manager/owner/tenant). Bestehende `landlord`-User → `owner` + `is_landlord=true`, `advisory`-User → `owner` (board_members-Eintrag bleibt). 3 RLS-Policies auf `is_landlord` umgestellt.

**Architektur-Entscheidung:** Landlord und Advisory sind keine eigenen Rollen, sondern additive Features auf der Basis-Rolle `owner`. Ein Owner kann gleichzeitig Vermieter (`is_landlord=true`) UND Beirat (`board_members`-Eintrag für spezifische Gebäude) sein.

**Geänderte Dateien:**
- `config.js`: `ROLE_LABELS` von 6→4 Einträge, `EXTERNAL_PAGE_ROLES.finanzen` auf `owner` statt `advisory`.
- `nav.js`: `init()` lädt `is_landlord` + `board_members` → setzt `_isLandlord`/`_isAdvisory` Flags. `renderNav()`: Owner-Block mit konditionalen Landlord/Advisory-Sektionen statt 3 separaten Blöcken. Auth-Guard berücksichtigt `_isAdvisory`. Role-Label kombiniert (z.B. "Vermieter & Beirat").
- `mod-tickets.js`: `role === 'landlord'` → `userProfile._isLandlord`. `isTenantOrOwner` vereinfacht.
- `mod-dashboard.js`: Hausgeld-Anzeige auf `role === 'owner'` vereinfacht.
- `mod-persons-edit.js`: Rollen-Dropdown von 6→4 Optionen. Neue Checkbox "Vermieter" (`is_landlord`). Hinweistext "Beirat-Zugang über Gebäude-Zuweisung". Speicherlogik um `is_landlord` erweitert.
- Neu: `scripts/migration_role_refactor.sql` — Spalte, Datenmigration, CHECK-Constraint, RLS-Policies.

### Ticket-System Erweiterungen (Rollen-Test)
- Ticket-Routing: Tenant→Landlord automatisch, Landlord→Tenant via Pill-Toggle, Owner→Verwalter via Eskalation.
- Empfänger-Dropdown für Admin/Manager (alle Eigentümer/Vermieter des Gebäudes).
- Ticket-Beschreibung wird als erste Chat-Nachricht eingefügt.
- Gebäude/Einheit-Felder für Tenants mit nur 1 Einheit ausgeblendet.
- Gebäude-Filter in Ticket-Sidebar auf eigene Gebäude beschränkt.
- Deep-Links (Gebäude/Einheit) nur für Admin/Manager klickbar.
- Schwarzes Brett für alle Rollen in Sidebar sichtbar.
- RLS: SELECT-Policies für profiles, buildings, apartments (alle authenticated), tickets (eigene+zugewiesene+admin).
- RPCs: `get_landlord_for_apartment`, `get_tenant_for_apartment`, `get_my_units_for_tickets`, `get_ticket_recipients`, `check_is_advisory`, `get_beirat_access` (alle SECURITY DEFINER).
- `mod-objekte.js`: Rollencheck am Einstieg (nur admin/manager).

### PDF-Template-Fixes (Tabellen-Rendering)
- Template-Engine `generateFromTemplate()`: Tabellen rendern jetzt **Zeile für Zeile** mit Seitenumbruch + Header-Wiederholung (statt all-or-nothing). Heading-Orphan-Schutz (60pt Reserve). `fmtEur()` mit `Number.EPSILON`-Trick gegen Floating-Point-Fehler. Heading-Abstand reduziert (steuerbar via `gap`-Property).
- Hint-Box: `title_size` Property für separate Titel-Schriftgröße. `**text**`-Syntax für Inline-Fettschrift.
- Migrations: `migration_fix_umlageschluessel_format.sql` (JAB/WP-Templates mit korrekter Blockfolge).

### Verwaltungsbeirat-UI im Gebäude-Detail
- Tab "Grundbuch": Neue Sektion "Verwaltungsbeirat" mit Liste aktiver Beiratsmitglieder, "Beirat hinzufügen" (Dropdown mit Eigentümern des Gebäudes), "Entfernen" (Soft-Remove via `valid_to`).
- Mehrere Beiräte pro Gebäude möglich (Vorsitz + Stellvertreter).

### Beirat-Belegprüfung Fixes
- `_finRenderBeiratView()`: Jahres-Switcher für mehrere Freigabezeiträume. Belege aus `journal_attachments` laden (statt nur `journal_entries.attachment_path`). Konto-Anzeige mit Fallback.
- RLS-Kaskaden-Fixes: SELECT-Policies für `board_members` (eigene), `beirat_access_periods` (eigene Gebäude), `journal_entries` (Beirat-Freigabe), `accounts` (Beirat-Gebäude), `journal_attachments` (Beirat-Belege), `audit_protocols` (eigene).

### Wirtschaftsjahr wieder öffnen
- WP-Tab: "Wieder öffnen"-Button bei Status `closed` → setzt auf `active`.
- JAB Step 6: "Sperre aufheben"-Button (ersetzt "Abschließen" wenn bereits gesperrt) → hebt `budget_plan`-Status + `journal is_locked` auf. Buttons kontextsensitiv.

### Feedback-Runde 9. April (Nachfixes)
- **News:** Client-seitige `visibility_scope`-Filterung entfernt — RLS filtert korrekt. Gebäudespezifische News jetzt für Eigentümer/Mieter sichtbar.
- **Kontakte:** Mieter sieht nur Notfallkontakte + vom Vermieter freigegebene. Tenant-Building-IDs aus `tenancies` statt `userProfile.apartment_id`.
- **Kontakte:** "Für Mieter freigeben"-Toggle nur für Landlords (`_isLandlord`), nicht für reine Owner.
- **Tickets:** Nicht-Admins sehen "Posteingang" (empfangene) + "Gesendet" (erstellte) statt gemischte Ansicht.
- **JAB Step 6:** `fiscalYear`-Fallback für Sperre-aufheben-Button.

### Test-User & Debugging
- `scripts/create_test_users.sql`: 4 Test-User (tenant, owner, landlord, advisory) mit Verknüpfungen für WEG Zeppelinstraße 8. Idempotent (Cleanup + Neuanlage).
- `scripts/debug_beirat_access.sql`: Diagnose-SQL für Beirat-Zugriffsprüfung.

### Phase 7.11 — Stammdaten-Dynamisierung (Quick-Wins)
- 7.11-A/B: Entscheidung: nicht umgesetzt — Bankdaten bereits über Briefbogen bzw. Mahnungstext abgedeckt.
- **7.11-C Verzugszins Auto-Berechnung:** Mahnlauf-Default auf `gsRate + 5` (§ 288 BGB) vorbelegt. Label "Basiszinssatz" → "Verzugszinssatz". Hint-Text zeigt Berechnungsformel.
- **7.11-D typeLabels zentralisiert:** `DISTRIBUTION_KEY_LABELS` in `config.js` (7 Typen: mea/sqm/units/consumption/persons/heizkosten/custom). 6 Stellen ersetzt: 2× `mod-finanzen.js` (distKeyLabel + Select-Options), 4× `utils-pdf.js` (_typeLabels/typeLabels).
- **7.11-E Mahngebühr-Verrechnungs-Hinweis:** Nach "Bezahlt"-Buchung bei Mahnungen mit Gebühr: Info-Toast nach 1,5s Delay ("Mahngebühr auf WEG-Konto gutgeschrieben — bitte Überweisung auf Verwalterkonto veranlassen").

### Phase 7.2 — E-Mail-Benachrichtigungen (Brevo)
Migration `phase72_email_notifications.sql`: `notification_preferences` (User-Opt-In/Out), `email_log` (DSGVO Audit-Trail), `global_settings` +3 Spalten.

**Architektur:**
- **E-Mail-Dienst:** Brevo (ex Sendinblue) — DSGVO-konform, Server in Deutschland, Free Tier 300/Tag.
- **Edge Function:** `send-notification` (Deno, Supabase Edge Functions). 1 Funktion für alle 4 Trigger-Typen. JWT-gesichert, nutzt service_role für DB-Zugriff + Brevo HTTP API (`api.brevo.com/v3/smtp/email`).
- **Frontend:** `sendNotification(type, payload)` in `config.js` — fire-and-forget, blockiert nie die UI.
- **Default:** Opt-In (alle Benachrichtigungen aktiv). User können einzelne Trigger unter "Mein Profil" deaktivieren.

**4 Trigger-Typen:**
| Trigger | Auslöser | Empfänger |
|---|---|---|
| `ticket_new` | `saveTicket()` in mod-tickets.js | assigned_to + Admins/Manager |
| `ticket_status` | `updateTicketStatus()` in mod-tickets.js | creator_id + assigned_to |
| `document_released` | `_publishDoc()` in mod-dokumente.js | Alle Nutzer des Gebäudes |
| `news_new` | `saveNews()` in mod-news.js | Alle Nutzer des Gebäudes (global: alle) |

**E-Mail-Adress-Auflösung:** `profiles.id` → `persons.auth_user_id` → `persons.email` (Fallback: `auth.users.email`).

**Geänderte Dateien:**
- `config.js`: `sendNotification()` Helper (fire-and-forget).
- `mod-tickets.js`: Trigger `ticket_new` nach `saveTicket()`, Trigger `ticket_status` nach `updateTicketStatus()`.
- `mod-dokumente.js`: Trigger `document_released` nach `_publishDoc()`.
- `mod-news.js`: Trigger `news_new` nach `saveNews()` (+ `.select('id').single()` Refactor).
- `mod-settings.js`: Neuer Tab "E-Mail" (Konfiguration, Trigger-Übersicht, E-Mail-Log mit Status-Badges).
- `mod-placeholder.js`: `loadProfile()` implementiert (Kontodaten read-only + 4 Benachrichtigungs-Toggles mit Upsert).
- Neu: `scripts/migration_email_notifications.sql`.
- Neu: Edge Function `send-notification/index.ts` (deployed via Supabase MCP).

