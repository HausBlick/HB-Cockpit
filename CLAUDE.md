# HB-Mieterportal — Projekt-Kontext für Claude Code

## Projektübersicht
Cloudbasiertes Immobilienverwaltungs-ERP für WEG- und Mietverwaltung.
**Live:** https://portal.hausblick-fn.de/
**Repo:** https://github.com/HausBlick/Mieter-Portal

---

## Tech-Stack
- **Backend / Auth / DB:** Supabase (PostgreSQL 17, Row Level Security)
- **Frontend:** HTML5, Vanilla JavaScript, Tailwind CSS (CDN)
- **Hosting:** GitHub Pages

## Supabase
- **Projekt-ID:** `unprrlbvylmzxxhpfisr`
- **URL:** `https://unprrlbvylmzxxhpfisr.supabase.co`
- **Anon Key:** `sb_publishable_nWYozmRQq8E17z_ljZ2SHA_LUulwUV1`

---

## Design-System
- **hb-olive:** `#687451` (Primärfarbe, Buttons, aktive Tabs)
- **hb-offblack:** `#373737` (Haupttext, Überschriften)
- **hb-ultralight:** `#F9FAF8` (App-Hintergrund)
- **hb-orange:** `#EB762D` (Akzent, Warnungen)
- **Font:** Inter (Google Fonts)
- **Cards:** `rounded-[15px]`, `box-shadow: 0 4px 20px -2px rgba(0,0,0,0.03)`
- **Inputs:** Hintergrund `#F9FAF8`, Focus-Ring in hb-olive (10% Opacity)
- **Buttons:** `.btn-primary` (olive), `.btn-secondary` (grau), `border-radius: 12px`

---

## Rollen & Berechtigungen (`profiles.role`)
| Rolle | Zugriff |
|---|---|
| `admin` | Vollzugriff auf alles |
| `manager` | Vollzugriff, aber nur eigene Gebäude (`management_assignments`) |
| `owner` | Lesend: eigene Einheiten, WEG-Dokumente, eigene Mieter |
| `tenant` | Lesend: eigener Mietvertrag, Dokumente, Schwarzes Brett. Darf Tickets erstellen |

---

## Datenbankschema (22 Tabellen, alle RLS-geschützt)
`profiles`, `buildings`, `apartments`, `persons`, `tenancies`, `ownerships`,
`management_assignments`, `tickets`, `ticket_messages`, `news`, `news_likes`,
`documents`, `document_reads`, `contacts`, `meters`, `meter_readings`,
`invitations`, `building_bank_accounts`, `building_insurances`,
`board_members`, `service_providers`, `person_bank_accounts`

**Wichtige Architektur-Entscheidung:**
Auth-User (`auth.users`) sind von CRM-Kontakten (`persons`) getrennt.
Verknüpfung läuft über `persons.auth_user_id` und `invite_code`.
`tenancies.tenant_id` → `persons.id` (NICHT `auth.uid()`)

---

## Frontend-Struktur (nach Modularisierung)
```
dashboard.html          # HTML-Shell (~128 Zeilen)
js/
  config.js             # Supabase-Client, globale Vars, Icons
  utils.js              # Toast, Dropdown, Logout, Mobile-Menu
  nav.js                # init(), renderNav(), setActiveNav()
  modules/
    mod-dashboard.js    # Dashboard-Modul
    mod-objekte.js      # Gebäude & Einheiten (CRUD)
    mod-personen.js     # Globales CRM / Adressbuch
    mod-placeholder.js  # Platzhalter für kommende Module
```

---

## Migrations-Workflow (PFLICHT)
**Keine direkten SQL-Änderungen im Supabase-Editor.**
Alle Schema-Änderungen laufen als Migration:

```bash
# Migration einspielen via Supabase MCP / API
# Namensformat: YYYYMMDDHHMMSS_beschreibung
```

**Bisherige Migrationen:**
| Version | Name |
|---|---|
| 20260313111823 | cleanup_duplicate_rls_policies |
| 20260313111831 | add_missing_fk_indexes |
| 20260313111841 | fix_function_search_path |
| 20260313112747 | baseline_schema |

---

## Projektplan — 6 Phasen

### ✅ Phase 1 — Tech-Debt & Infrastruktur (KOMPLETT)
- 1.1 RLS-Policies bereinigt
- 1.2 Performance-Indexes angelegt
- 1.3 Security-Warnings behoben
- 1.4 Migration-Files eingeführt
- 1.5 Frontend modularisiert

### 🟡 Phase 2 — Personen-CRM (IN ARBEIT)
- 2.1 Supabase-Anbindung (Mock-Daten ersetzen) — **📋 Geplant**
- 2.2 Neue Person anlegen (Formular + INSERT) — **📋 Geplant**
- 2.3 Person bearbeiten (Tab-UI) — **🔴 Wartet auf Gemini-Konzept**
- 2.4 Einladungscode generieren — **💡 Idee**

### 📋 Phase 3 — Objekte & Zuweisungen
- 3.1 Eigentümer-Zuweisung (`ownerships`)
- 3.2 Mieter-Zuweisung (`tenancies`)
- 3.3 Gebäude-Detail ausbauen
- 3.4 Einheiten-Detail ausbauen
- 3.5 Zählerstände UI

### 📋 Phase 4 — Kommunikation
- 4.1 Schwarzes Brett Konzept
- 4.2 Schwarzes Brett Implementierung
- 4.3 Ticket-System Konzept
- 4.4 Ticket-System Implementierung

### 💡 Phase 5 — Dokumente, Kontakte & Dashboard
### 💡 Phase 6 — Finanzen & Abrechnung

---

## Workflow — Triade
**Gemini (Architekt)** → Konzepte, DB-Design, UI-Vorgaben
**Nutzer (Product Owner)** → Steuert, testet, transportiert
**Claude (Developer)** → Implementierung direkt im Repo via Claude Code

**Übergabe-Format (Gemini → Claude):**
```
[UMSETZUNGS-ÜBERGABE FÜR CLAUDE]
1. Ziel
2. Anforderungen
3. DB-Änderungen (SQL)
4. UI-Vorgaben
5. Offene Entwickler-Entscheidungen
```

---

## Interaktionsregeln (WICHTIG)
- **Sprache:** Immer Deutsch
- **Fragen:** Immer nur eine Frage auf einmal (iteratives Interview)
- **Antworten:** Kurz und präzise
- **Rating:** Jede Antwort mit Konfidenz abschließen, z.B. `Rating: 95%`
- **Migrations:** Niemals direktes SQL im Supabase-Editor — immer als Migration
- **Git:** Nach jeder abgeschlossenen Aufgabe einen sauberen Commit vorschlagen
