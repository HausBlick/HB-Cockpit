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
  nav.js                    # init(), renderNav(), setActiveNav()
  modules/
    mod-dashboard.js        # Dashboard-Modul (Platzhalter)
    mod-objekte.js          # Gebäude & Einheiten (CRUD + Zuweisungen)
    mod-personen.js         # Personen-Liste & Supabase-Anbindung
    mod-persons-edit.js     # Personen bearbeiten (4-Tab-Formular)
    mod-news.js             # Schwarzes Brett (Feed, Like, Read-Tracking, Erstellen)
    mod-tickets.js          # Ticket-System (Chat, Status-Flow, Suche, Auto-Reopen)
    mod-placeholder.js      # Platzhalter für kommende Module
```

---

## 6. Datenbankschema (22 Tabellen, alle RLS)

`profiles`, `buildings`, `apartments`, `persons`, `tenancies`, `ownerships`, `management_assignments`, `tickets`, `ticket_messages`, `news`, `news_likes`, `documents`, `document_reads`, `contacts`, `meters`, `meter_readings`, `invitations`, `building_bank_accounts`, `building_insurances`, `board_members`, `service_providers`, `person_bank_accounts`

**Wichtige Architektur:**
- Auth-User getrennt von CRM (`persons`) — Verknüpfung über `persons.auth_user_id` + `invite_code`
- `tenancies.tenant_id` → `persons.id` (nicht `auth.uid()`)
- Historisierung: `tenancies` + `ownerships` mit `start_date` / `end_date`

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
| Phase 4 | phase4_news_and_tickets | `news`-Spalten ergänzt, `news_reads`-Tabelle, `tickets`-Spalten (`snooze_until`, `updated_at`), `ticket_messages.is_system_message`, Status-Default `Offen` |

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
- 2.4 Einladungscode generieren 💡 (folgt später)

### ✅ Phase 3 — Objekte & Zuweisungen (ABGESCHLOSSEN)
- 3.1 Eigentümer-Zuweisung (`ownerships`) ✅
- 3.2 Mieter-Zuweisung (`tenancies`) ✅
- 3.3 Gebäude-Detail: 4 Tabs (Stammdaten / Finanzen / Grundbuch / Technik & Fristen) ✅
- 3.4 Einheiten-Detail: 5 Tabs + Breadcrumb + Tabellen-Ansicht ✅
- 3.5 Zählerstände UI 💡 (folgt später)

### ✅ Phase 4 — Kommunikation (ABGESCHLOSSEN)
- 4.1 Schwarzes Brett (`mod-news.js`): News-Feed, Filter-Chips, Neu-Badge, Like-Toggle (optimistisch), Read-Tracking, Erstell-Modal mit Scope/Gebäude/Einheits-Auswahl ✅
- 4.2 Ticket-System (`mod-tickets.js`): Zwei-Spalten-Layout, Filter-Sidebar mit Badges, Ticket-Detail mit Chat-Bubbles + Info-Sidebar ✅
- 4.3 Ticket-Status-Flow: Offen → In Bearbeitung → Warte auf Rückmeldung → Wiedervorlage → Erledigt ✅
- 4.4 Wiedervorlage / Snooze: Client-seitige Prüfung beim Modulstart, automatisches Zurücksetzen auf „Offen" ✅
- 4.5 Auto-Reopen: Mieter/Eigentümer-Antwort setzt Status automatisch auf „Offen" (mit Systemnachricht) ✅
- 4.6 Ticket-Suche: durchsucht Betreff, Beschreibung, Ersteller, Gebäude, Chat-Inhalte — RLS-sicher ✅
- 4.7 Eskalation (owner → Verwalter): findet Manager via `management_assignments`, schreibt Systemnachricht ✅
- 4.8 Deep-Links: Gebäude, Einheit, Person (via `auth_user_id`) aus Ticket-Detail erreichbar ✅
- 4.9 „Meine erledigten Tickets": eigene Gruppe in Sidebar, kein Badge; „Meine Tickets" zeigt nur aktive ✅

### 💡 Phase 5 — Dokumente, Kontakte, Dashboard
### 💡 Phase 6 — Finanzen & Abrechnung

---

## 9. Kommunikationsprotokoll (Triade)

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

## 10. Interaktionsstil (Regeln für Claude)

- **Eine Frage auf einmal** — iteratives Interview-Verfahren bei Unklarheiten
- **Kurz & präzise** — kein unnötiges Ausholen
- **Rating** — jede Antwort mit `Rating: X%` abschließen
- **Sprache** — strikt Deutsch

---

## 11. Projekt-Tagebuch (Changelog)

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
| 1 | Migration: Felder `is_company`, `company_name`, `salutation`, `birthdate`, `tax_id` zu `persons` hinzugefügt |
| 2 | Migration: Felder `mea_numerator`, `mea_denominator` zu `apartments` hinzugefügt |
| 3 | `mod-personen.js`: Mock-Daten durch echte Supabase CRUD-Operationen ersetzt |
| 4 | `mod-persons-edit.js` (neu): 4-Tab-Formular — Stammdaten, Rollen, Portal-Status, SEPA-Bankdaten |
| 5 | CLAUDE.md erstellt und ins Repo eingecheckt |

---

### Phase 3 — Objekte & Zuweisungen
**Commits:** `28b8842`, `2cf5054`, `92bed53`, `b54f195`

| # | Was wurde gemacht |
|---|---|
| 1 | Migration: `meter_water_warm` + `meter_water_warm_calibration` zu `apartments` ergänzt |
| 2 | Gebäude-Detail: 4 Tabs (Stammdaten / Finanzen inkl. Bankkonten-CRUD / Grundbuch / Technik & Fristen) |
| 3 | Einheiten-Detail: 5 Tabs (Stammdaten / Abrechnung MEA / Finanzen / Zähler / Rechtliches & Personen) |
| 4 | Zuweisungs-Modal: Autocomplete-Suche, Quick-Create (Person inline anlegen), Speichern in `ownerships`/`tenancies`, Deep-Links |
| 5 | UX-Überarbeitung: Read-only Info-Ansicht für Gebäude & Einheiten, "Bearbeiten"-Button trennt Ansicht von Edit-Modus |
| 6 | Einheiten von Cards auf Tabelle umgestellt (Spalten: Nr., Typ, Lage, m², Hausgeld, Status) |
| 7 | Gebäude-Sidebar schmaler (30-40%), Hover-Highlighting statt dauerhaftem Grün, Live-Suchfeld ergänzt |
| 8 | Menüpunkt umbenannt: "Bestandsobjekte" → "Gebäude & Einheiten" |
| 9 | Layout-Optimierung: Header kompakter, Tab-Content `max-height: 25vh`, Einheitenliste `flex-grow` — Einheitenliste ist jetzt ohne Scrollen sichtbar ✅ |

---

### Phase 4 — Kommunikation: Schwarzes Brett & Ticket-System
**Commits:** `9682a6b`, `d103a5f`, `89ae299`, `19a4922`, `2a8a996`, `ed2f907`

| # | Was wurde gemacht |
|---|---|
| 1 | Migration `phase4_news_and_tickets` angewendet: `news`-Felder, `news_reads`, `tickets.snooze_until`, `ticket_messages.is_system_message` |
| 2 | `mod-news.js` (neu): News-Feed-Grid (1/2/3 Spalten), Filter-Chips, Neu-Badge (hb-orange), Like-Toggle mit optimistischem UI, Read-Tracking via `news_reads`, Erstell-Modal mit Scope-Auswahl (global/Gebäude/Einheit) |
| 3 | `mod-tickets.js` (neu): Zwei-Spalten-Layout, Filter-Sidebar, Ticket-Liste als Zeilen, Ticket-Detail mit Chat-Bubbles (eigene rechts hb-olive, andere links grau), Info-Sidebar |
| 4 | Ticket-Status-Flow vollständig: Offen → In Bearbeitung → Warte auf Rückmeldung → Wiedervorlage (mit Datum) → Erledigt |
| 5 | Wiedervorlage-Snooze: `_checkSnoozedTickets()` beim Modulstart, automatisches Reset auf `Offen` |
| 6 | Auto-Reopen: Mieter/Eigentümer-Antwort setzt Status bei `In Bearbeitung`, `Warte auf Rückmeldung`, `Wiedervorlage` automatisch auf `Offen` + Systemnachricht im Chat |
| 7 | Ticket-Suche: Suchfeld in Sidebar, durchsucht Betreff + Beschreibung + Ersteller-Name + Gebäude + Chat-Inhalte; RLS-sicher (Nachrichten-Treffer werden gegen zugängliche Ticket-IDs geprüft) |
| 8 | Ticket-Badges: Anzahl je Filter-Eintrag, „Erledigt" und „Meine erledigten" ohne Badge |
| 9 | „Meine erledigten Tickets": eigene Sidebar-Gruppe, „Meine Tickets" zeigt nur noch aktive |
| 10 | Bugfix: `mod-placeholder.js` hat `loadNews()` / `loadTickets()` überschrieben — beide Funktionen entfernt |
