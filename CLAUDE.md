# CLAUDE.md — HB-Cockpit

> Anweisungs-Datei für Claude Code (Terminal) und Cowork.
> Schlank, statisch, von Niko gepflegt. Historie liegt in CHANGELOG.md.

---

## 0. WICHTIG – Doku-Architektur (Stand 24.05.2026)

Dieses Projekt nutzt **vier** Dokumentations-Dateien mit strikt getrennten Zwecken:

| Datei | Zweck | Pflege | Wird automatisch in Kontext geladen? |
|---|---|---|---|
| `CLAUDE.md` (diese Datei) | Statische Anweisung, Architektur, Konventionen, Definition of Done | **Niko** (selten) | ja |
| `GEMINI.md` | Strategisches Konzept, Vision, Vorhaben-Pakete | Gemini + Niko | nur bei Bedarf |
| `STATUS.md` | Aktuelle Baustellen, offene Bugs, Live-Gang-Checkliste | **Niko ausschließlich** | ja |
| `CHANGELOG.md` | Append-only Historie aller Phasen und Änderungen | Claude Code (append) | nein – nur bei Bedarf lesen |

**Strikte Regeln:**
- Claude Code darf **STATUS.md nur lesen, niemals editieren**. Status wird ausschließlich von Niko gepflegt.
- Claude Code darf **GEMINI.md nicht verändern** – nur lesen.
- Claude Code darf **CLAUDE.md nicht eigenmächtig erweitern** – Architektur-Änderungen werden von Niko nachgetragen.
- Claude Code **darf und soll** CHANGELOG.md nach erfolgreichem Commit ergänzen (neuer Eintrag oben mit Datum, Modul, Beschreibung, geänderte Dateien).

**Veraltete Dateien (nicht mehr verwenden):**
- `BRIEFING.md` – archiviert, nicht mehr aktiv.

---

## 1. Definition of Done

**Eine Aufgabe ist NICHT erledigt durch:**
- "Der Code kompiliert."
- "Die Funktion existiert."
- "Es gibt keine Syntax-Fehler."

**Eine Aufgabe ist erst erledigt, wenn ALLE Punkte erfüllt sind:**

1. ✅ **Code läuft** – kein Build-Error, kein Lint-Error
2. ✅ **Niko hat das Feature manuell im laufenden System verifiziert** – nicht Claude Code allein
3. ✅ **Edge Cases sind benannt** – Claude Code listet auf, was er nicht getestet hat
4. ✅ **Commit existiert** mit aussagekräftiger Message nach Schema `type(scope): kurze Beschreibung`
5. ✅ **CHANGELOG.md ist ergänzt** im selben Commit
6. ✅ **STATUS.md-Eintrag ist von Niko auf "erledigt" gesetzt** (nicht von Claude Code)

**Claude Code darf eine Aufgabe niemals selbständig als ✅ markieren.** Selbstbericht über Faktisches (welche Datei geändert) ist erlaubt. Selbstbericht über Qualität (funktioniert / ist fertig) nicht. Diese Bewertung nimmt Niko vor.

---

## 2. Projekt & URLs

| | |
|---|---|
| **Live-URL** | https://portal.hausblick-fn.de/ |
| **GitHub** | https://github.com/HausBlick/Mieter-Portal |
| **Supabase Projekt-ID** | `unprrlbvylmzxxhpfisr` |
| **Supabase URL** | `https://unprrlbvylmzxxhpfisr.supabase.co` |
| **Anon Key** | `sb_publishable_nWYozmRQq8E17z_ljZ2SHA_LUulwUV1` |

---

## 3. Tech-Stack

- **Backend / DB / Auth:** Supabase (PostgreSQL 17, RLS). Auth über Supabase Auth (E-Mail/Passwort, Magic Link, Passwort-Reset). Registrierung durch Admin via Edge Function `create-user`.
- **Frontend:** HTML5, Vanilla JavaScript (ES6 Modules), Tailwind CSS (via CDN)
- **PDF:** `pdf-lib` (client-side). Briefbogen als Hintergrund-Layer.
- **Hosting:** GitHub Pages (Push auf `main` → live)

---

## 4. Design-System

→ Vollständige Spezifikation in **`DESIGN.md`** (Single Source of Truth).

Kurzübersicht:
- **Primärfarbe:** hb-olive `#687451`
- **Textfarbe:** hb-offblack `#373737`
- **Hintergrund:** hb-ultralight `#F5F5F5`
- **Akzent:** hb-orange `#EB762D`

---

## 5. Rollen & Berechtigungen (`profiles.role`)

| Rolle | Beschreibung |
|---|---|
| `admin` | Vollzugriff auf alle Objekte, Mandanten, Finanzen, Tickets |
| `manager` | Vollzugriff, limitiert auf zugewiesene Gebäude (`management_assignments`) |
| `owner` | Lesend: eigene Einheiten, WEG-Dokumente, Tickets, Kontaktbuch |
| `tenant` | Lesend: eigener Mietvertrag, Dokumente, Schwarzes Brett. Darf Tickets erstellen |

**Zusatz-Features (additiv zu `owner`):**

| Flag/Tabelle | Beschreibung |
|---|---|
| `profiles.is_landlord` | Owner + Vermieter-Bereich |
| `board_members` (pro Gebäude) | Owner + Beirat (Lesezugriff auf Finanzdaten gebäudespezifisch) |

> `profiles.role` hat genau 4 Werte. Landlord und Advisory sind keine eigenen Rollen, sondern additive Features. Nav und Berechtigungen werden dynamisch zusammengesetzt.

---

## 6. Frontend-Struktur (Multi-Page-Architektur)

Dashboard bleibt SPA für Alltags-Module. Komplexe Tools sind eigene HTML-Seiten.
Geteilte Basis: `config.js`, `utils.js`, `nav.js`. Deep-Linking per URL-Params. Gebäude-Kontext via `sessionStorage` (`hb_active_building`).

| Seite | Module | Zielgruppe |
|---|---|---|
| `dashboard.html` | Dashboard, Tickets, News, Kontakte, Kalender, CRM, Objekte, Einstellungen, Dokumente | Alle Rollen |
| `zeiterfassung.html` | Zeiterfassung & Projekte | admin, manager |
| `etv.html` | Eigentümerversammlung | admin, manager |
| `finanzen.html` | Buchhaltung & Finanzen (13 Tabs) | admin, manager, owner mit board_members |

**JS-Module:**
```
js/
  config.js              # Supabase-Client, globale Vars, Icons, EXTERNAL_PAGES Routing
  utils.js               # Toast, Dropdown, Logout, Mobile-Menu, Modal/Bottom-Sheet
  utils-pdf.js           # Official Letter Engine + Template-Engine
  nav.js                 # Multi-Page-Routing, Nav-Render, Active-State
  modules/
    mod-dashboard.js     # Dashboard (KPIs, Quick-Actions, Widgets, rollenbasiert)
    mod-objekte.js       # Gebäude & Einheiten
    mod-personen.js      # Personen-Liste
    mod-persons-edit.js  # Personen bearbeiten (4-Tab)
    mod-news.js          # Schwarzes Brett
    mod-tickets.js       # Ticket-System
    mod-dokumente.js     # Dokumenten-Cloud
    mod-kontakte.js      # Kontaktbuch
    mod-kalender.js      # Monatskalender
    mod-finanzen.js      # Buchhaltung (Konten, Buchungen, Wirtschaftsplan, Abrechnung)
    mod-zeiterfassung.js # Zeiterfassung
    mod-settings.js      # Admin-Einstellungen + Dokumenten-Designer
    mod-placeholder.js   # Profil + Mein-Einheiten / Mein-Mieter
    mod-etv.js           # Eigentümerversammlung
```

---

## 7. Architektur-Konventionen (verbindlich)

- **Supabase-Joins mit mehreren FKs:** immer expliziten FK-Hint, z.B. `profiles!uploaded_by(full_name)`
- **Multi-Page Nav-Links:** Module in `EXTERNAL_PAGES` → `<a href="...">`. SPA-Module auf Dashboard → `onclick`. Auf externen Seiten → SPA-Links zeigen auf `dashboard.html?m=fnName`
- **Externe Seiten HTML-Shell:** Identische Struktur wie `dashboard.html` (Sidebar, Header, Content-Area, Bottom-Nav).
- **Responsive Tables:** `.rtable`-Klasse auf Container → `makeTableResponsive(el)` nach jedem Table-Render.
- **Auth-User getrennt von CRM (`persons`):** Verknüpfung über `persons.auth_user_id` + `invite_code`
- **Doppelte Buchführung (GoBD):** `journal_entries` mit DB-RULES (`journal_no_update`, `journal_no_delete`) — keine Bearbeitung/Löschung, nur Storno
- **Kontenrahmen:** `accounts.building_id = NULL` → globale Vorlage; `building_id != NULL` → gebäudespezifisch

---

## 8. Harte Regeln für Claude Code

1. **RLS-Policies NICHT anfassen.** Wurden manuell in Supabase mit `SECURITY DEFINER`-Funktionen repariert. Keine neuen erstellen, keine bestehenden ändern – außer nach expliziter Aufforderung mit Begründung.
2. **Dateien nicht abschneiden.** Bei Edits an langen Dateien: Zeilenzahl vorher/nachher prüfen, letzte Funktion auf Vollständigkeit kontrollieren.
3. **CHANGELOG.md im selben Commit** – nach jeder Modul-Änderung neuen Eintrag oben anhängen.
4. **STATUS.md nicht editieren** – nur Niko pflegt diese.
5. **Nicht eigenmächtig "fertig" melden** – siehe Definition of Done.

---

## 9. Datenbank-Übersicht (high-level)

49 Tabellen, alle mit RLS. Details und Migrations-Historie siehe CHANGELOG.md und Supabase-Dashboard.

**Kerntabellen:** `profiles`, `buildings`, `apartments`, `persons`, `tenancies`, `ownerships`, `management_assignments`, `tickets`, `ticket_messages`, `news`, `news_likes`, `documents`, `document_reads`, `contacts`, `meters`, `meter_readings`, `invitations`, `board_members`

**Finanzen:** `accounts`, `journal_entries`, `journal_attachments`, `budget_plans`, `budget_plan_items`, `payment_demands`, `special_levies`, `dunning_notices`, `beirat_access_periods`, `distribution_keys`, `distribution_key_units`, `financial_statements`, `audit_protocols`, `hausgeld_history`

**ETV:** `etv_sessions`, `etv_agenda_items`, `etv_attendance`, `etv_votes`, `beschluesse`

**Zeiterfassung:** `time_projects`, `time_work_packages`, `time_entries`

**System:** `global_settings`, `notification_preferences`, `email_log`, `pdf_templates`

---

## 10. Interaktionsstil (Regeln für Claude)

- **Eine Frage auf einmal** – iteratives Interview-Verfahren bei Unklarheiten
- **Kurz & präzise** – kein unnötiges Ausholen
- **Rating** – jede Antwort mit `Rating: X%` abschließen
- **Sprache** – strikt Deutsch
- **Definition of Done beachten** (Abschnitt 1) – niemals Selbstbewertung als ✅

---

## 11. Wo finde ich was?

| Ich suche... | Datei |
|---|---|
| Aktuelle offene Bugs / Live-Gang-Checkliste | **STATUS.md** |
| Strategie, Vision, geplante Features | **GEMINI.md** |
| Historie aller Phasen / Was wurde wann gebaut | **CHANGELOG.md** |
| Design-Tokens, UI-Konventionen | **DESIGN.md** |
| Architektur, Stack, Konventionen, Regeln | **CLAUDE.md** (diese Datei) |
