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

(leer)

---

## Aufgabe Claude Code:

### Design-Migration Block 3 von 3: Typografie (Paket G — abgespeckt)

**Kontext:** Block 1 (Fundament) und Block 2 (Patterns + Farben) sind committed und gepusht. Dies ist der letzte Block. **Budget-Modus:** Nur die eindeutigen, klar definierten Typografie-Änderungen. Keine aufwendige Modul-für-Modul-Triage der 629 `text-sm`-Stellen.

**Referenz:** `DESIGN.md` §2 Typografie-Skala.

---

#### Was zu tun ist:

**1. H1-Seitentitel: `text-2xl` (24px) → `text-[28px]`**

NUR die echten Seitentitel — also die oberste Überschrift jedes Moduls/jeder Seite. Das sind typischerweise die Stellen direkt nach dem Modul-Load oder im Page-Header. Beispiele: "Buchhaltung & Finanzen", "Eigentümerversammlung", "Zeiterfassung", "Personen", "Objekte", "Einstellungen".

**NICHT ändern:** Modal-Titel, Card-Titel, Sub-Überschriften, KPI-Labels. Im Zweifel: `text-2xl` stehen lassen.

Geschätzter Umfang: ~10-15 Stellen.

**2. KPI-Zahlen im Dashboard: → `text-[32px] font-bold`**

In `mod-dashboard.js` die großen Kennzahlen (Admin-KPIs: offene Tickets, ausstehende Freigaben etc. + User-KPIs) auf `text-[32px] font-bold` anheben. Aktuell vermutlich `text-3xl font-extrabold` oder `text-[28px]`.

Geschätzter Umfang: ~5 Stellen.

**3. `text-sm` Fließtext — NICHT pauschal ändern!**

Die globale Fließtext-Migration von 14px auf 15px ist bereits über das CSS in den HTML-Shells abgedeckt (Input-font-size: 15px). Die 629 `text-sm`-Klassen in JS-Modulen **NICHT anfassen** — das wäre zu riskant und der visuelle Gewinn minimal. Das kann bei Bedarf später nachgezogen werden.

---

#### Commit-Strategie

- **Ein Commit:** Message: `style(design): Typografie-Hierarchie — H1 auf 28px, KPI auf 32px`
- **CLAUDE.md** mit-aktualisieren (Changelog-Eintrag Design-Migration Block 3 + Gesamtfazit).
- **Cache-Buster** hochzählen.
- **Push.**

Im CLAUDE.md-Changelog bitte auch einen **Abschluss-Vermerk** für die gesamte Design-Migration:

```
### Design-Migration ABGESCHLOSSEN (Blöcke 1–3)
DESIGN.md ist ab sofort Single Source of Truth. Tailwind-Config, CSS, Radien, Schatten, Borders, 
Farb-Palette, Tap-Feedback, Toast-Varianten, Typografie-Hierarchie — alles migriert.
Offen für Nachzug: text-sm → text-[15px] Fließtext-Feinschliff (629 Stellen, bei Bedarf modul-weise).
```

---

#### Nach Abschluss

Schreibe dein Ergebnis in den Antwort-Block. Melde:
1. Welche H1-Stellen geändert wurden (Liste)
2. Welche KPI-Stellen geändert wurden
3. Zeilenzahlen-Check der betroffenen Dateien

**Damit ist die Design-Migration komplett.**

---

### Antwort Claude Code:

**Block 3 (Paket G abgespeckt) abgeschlossen — Commit `81e7d60` + Push erfolgreich.**

`7e0e1c4..81e7d60 main -> main` — 17 Dateien geändert, +46/-26 (Replace-only, keine Layout-Verschiebungen).

**Damit ist die gesamte Design-Migration komplett.**

---

#### 1. Geänderte H1-Stellen (15)

**Echte `text-2xl` → `text-[28px]` (12):**
| Datei | Stelle | Page-Title |
|---|---|---|
| `index.html:66` | Login-Seite | "Mieterportal" |
| `register.html:68` | Registrierungs-Seite | "Willkommen im Haus!" |
| `mod-dashboard.js:196` | Admin-Dashboard | "Hallo, ${firstName}!" |
| `mod-dashboard.js:484` | User-Dashboard | "Hallo, ${name}!" |
| `mod-dokumente.js:44` | Dokumenten-Cloud | "Dokumenten Cloud" |
| `mod-etv.js:81` | ETV-Übersicht | "Eigentümerversammlungen" |
| `mod-finanzen.js:160` | Finanzen-Hauptansicht | "Buchhaltung" |
| `mod-finanzen.js:2516` | Beirat-Belegprüfung | "${formatBuildingName(bldg)}" |
| `mod-kalender.js:25` | Kalender-Hauptansicht | "Kalender" |
| `mod-kontakte.js:100` | Kontaktbuch | "Kontaktbuch" |
| `mod-news.js:27` | Schwarzes Brett | "Schwarzes Brett" |
| `mod-personen.js:43` | Personen-Adressbuch | "Globales Adressbuch" |

**Zusätzlich von `text-xl` → `text-[28px]` (3):**
Da Niko in der BRIEFING.md "Einstellungen" und "Zeiterfassung" als Beispiele für Page-Titles nannte, habe ich diese auch hochgezogen, obwohl sie aktuell `text-xl` (20px) hatten — sonst wäre die Hierarchie inkonsistent zu den anderen Modulen.
| Datei | Page-Title |
|---|---|
| `mod-settings.js:42` | "Einstellungen" |
| `mod-zeiterfassung.js:71` | "Zeiterfassung & Projekte" |
| `mod-zeiterfassung.js:168` | Projekt-Detail-Page-Header `${p.title}` |

**font-weight in allen 15 Stellen harmonisiert** auf `font-bold` (700) gemäß DESIGN.md §2 — bisher gemischt `font-extrabold` (800) und `font-bold` (700).

**Bewusst stehen gelassen** (sind keine Page-H1):
- `mod-persons-edit.js:245` — Modal-Titel "Neuen Kontakt anlegen / Person bearbeiten"
- `mod-tickets.js:31`, `mod-objekte.js:66` — Card-Titelleisten (`text-sm` weiß auf olive — eigenes Design-Pattern statt Page-Header)

#### 2. KPI-Stellen (1 zentrale Funktion → 8 effektive Vorkommen)

Eine einzige Änderung in der `_dashKpi()`-Helper-Funktion ([mod-dashboard.js:36](js/modules/mod-dashboard.js#L36)) wirkt auf **alle Dashboard-KPIs**:
- 4 Admin-KPIs (offene Tickets, ausstehende Freigaben, neue Belege, Außenstände)
- 4 User-KPIs (Tenant + Owner Varianten)

Änderung: `text-3xl font-extrabold` → `text-[32px] font-bold`. Saldo-Anzeige in mod-finanzen.js (Zeile 2128) hat zwar auch `text-2xl font-extrabold`, ist aber **kein Dashboard-KPI** sondern eine Zahl im Konto-Ledger — daher nicht angepasst (wäre Scope-Erweiterung).

#### 3. Zeilenzahlen-Check

Alle 12 betroffenen JS-/HTML-Dateien: **Längen unverändert** (Replace-only, keine Insertions/Deletions außer in CLAUDE.md/Cache-Buster-Lines):

| Datei | Zeilen |
|---|---:|
| `index.html` | 127 |
| `register.html` | 200 |
| `mod-dashboard.js` | 629 |
| `mod-dokumente.js` | 982 |
| `mod-etv.js` | 1449 |
| `mod-finanzen.js` | 4895 |
| `mod-kalender.js` | 311 |
| `mod-kontakte.js` | 632 |
| `mod-news.js` | 516 |
| `mod-personen.js` | 252 |
| `mod-settings.js` | 1137 |
| `mod-zeiterfassung.js` | 1053 |

CLAUDE.md: +21 Zeilen (Block-3-Eintrag + Abschluss-Vermerk).

---

#### Gesamt-Bilanz Design-Migration (Blöcke 1+2+3)

| Block | Commit | Dateien | Insertions | Deletions |
|---|---|---:|---:|---:|
| Block 1 (A+B+D+F + Vorarbeiten) | `3159687` | 24 | 2044 | 462 |
| Block 2 — Pakete C+H | `925cbac` | 7 | 78 | 10 |
| Block 2 — Paket E | `7e0e1c4` | 16 | 85 | 74 |
| Block 3 — Paket G | `81e7d60` | 17 | 46 | 26 |
| **Summe** | — | **64** | **2253** | **572** |

**Audit-Endstand:**
- 0 `F9FAF8` global
- 0 `rounded-[15px]` global
- 0 `border-hb-olive/20` global
- 0 verbotene Tailwind-Farben (red/blue/green/emerald/purple/yellow)
- 0 `height: 40px` in HTML-Shells
- 0 alte Schatten `0,0,0,0.03`

**Offen für Nachzug (bewusst nicht in Blöcken 1–3):** 629 `text-sm`-Stellen für Fließtext-Feinschliff. Bei Bedarf modul-weise nachholbar — Layout-Risiko ist hoch und der visuelle Gewinn nach den Strukturänderungen aus Block 1 (Input-Höhe + Schriftgröße via CSS) bereits weitgehend erzielt.

**Damit ist die Design-Migration komplett. Stehe für die nächste Aufgabe bereit.**

---

### NACHTRAG — Block 4: text-sm Fließtext-Feinschliff (Commit `fcc0564`)

Nach Anweisung doch noch durchgezogen — selektive Migration mit Faustregel.

**Commit:** `81e7d60..fcc0564 main -> main` — 20 Dateien, +108/-79 (Replace-only, alle Längen unverändert).

#### Strategie

Statt pauschal alle 633 `text-sm`-Vorkommen zu ersetzen, klare Faustregel:
- **Migrieren** → echte Fließtext-Stellen: `<p>`-Beschreibungen, Empty-States in Cards, Hint-Texte unter Page-Headern, Modal-Bodies mit `leading-relaxed`, Drag-Drop-Hinweise
- **Belassen** → Form-Labels, Toggle-Switch-Beschriftungen, Tabellen-Zellen, Buttons, Selects, Card-Header (`text-sm font-bold text-white` auf olive), Sidebar-Items, Inline-Wertanzeigen, Apartment-Subtitles (m²/Zimmer-Info)

#### Migrierte Stellen (63 von 633)

| Datei | Anzahl | Was |
|---|---:|---|
| index.html | 1 | Login-Subtitle |
| register.html | 1 | Code-Hint mit `leading-relaxed` |
| mod-news.js | 4 | Page-Subtitle, Empty-State, Card-Preview, Detail-Modal-Body |
| mod-kontakte.js | 3 | Page-Subtitle, Empty-State, Quick-Create-Frage |
| mod-kalender.js | 1 | Page-Subtitle |
| mod-personen.js | 1 | Page-Subtitle |
| mod-dashboard.js | 10 | alle Widget-Empty-States (`<p class="p-6 text-sm text-gray-400 text-center">`) via replace_all |
| mod-dokumente.js | 3 | Page-Subtitle, Vorschau-Hinweis, Drag-Drop-Hinweis |
| mod-tickets.js | 2 | Welcome-Empty, "Noch keine Nachrichten" |
| mod-objekte.js | 9 | 8× alle `text-sm text-gray-400` Empty-States via replace_all + 1× Person-Hint |
| mod-etv.js | 5 | "Keine Gebäude", Protokoll-Body, Empty-State Dokumente, 2× Detail-Panel/Protokoll-Bodies mit `leading-relaxed` |
| mod-zeiterfassung.js | 2 | Kein-Zugriff, Projekt-Beschreibung |
| mod-finanzen.js | 21 | 10× "Kein Gebäude gewählt" via replace_all, Page-Subtitle, Belegprüfung-Empty, Eröffnungssalden-Description, WP-Empty, Rücklagekonten-Empty, Beirat-Subtitle + Hint, JAB-Description, CSV-Drop-Hinweis, Buchungen-Empty |
| mod-settings.js | 1 | Designer-Empty |
| mod-persons-edit.js | 1 | Zuweisungen-Empty |

#### Bewusst belassen (570 Stellen)

Die verbleibenden 570 text-sm-Vorkommen sind:
- **Form-Labels** (Toggle-Switch-Beschriftungen in mod-settings, "24/7 Notfallkontakt" / "Für Mieter sichtbar" in mod-kontakte)
- **Wert-Anzeigen** in Form-Layouts (mod-placeholder Profile-Daten, mod-objekte Bool-Häkchen, mod-personen E-Mail-Display)
- **Card-Titles in Sidebars** (mod-dokumente "Alle Dokumente", mod-tickets Kategorie-Pills + Bauteilname/Wohnung-Inline-Felder)
- **Tabellen-Zellen** (mod-finanzen Buchungs-Tabellen, sind kompakt sinnvoll)
- **Button-Labels** (`btn-primary text-sm`, `btn-secondary text-sm`)
- **Inline-Subtitles** (mod-objekte Apartment "Wohnen · 65 m² · 3 Zimmer")
- **Dropdown-User-Name** im Header
- **Chat-Bubbles** in mod-tickets (gewollt kompakt)
- **Status-Pills, Badges, Chips**

**Final-Audit:** 30 verbliebene `<p>`-Tags mit `text-sm` — nach Sichtprüfung alle korrekt (Form-Labels und Wert-Display, kein echter Fließtext).

#### Gesamt-Bilanz Design-Migration ALLE Blöcke

| Block | Commit | Dateien | Insertions | Deletions |
|---|---|---:|---:|---:|
| 1 (A+B+D+F + Vorarbeiten) | `3159687` | 24 | 2044 | 462 |
| 2 — C+H | `925cbac` | 7 | 78 | 10 |
| 2 — E | `7e0e1c4` | 16 | 85 | 74 |
| 3 — G | `81e7d60` | 17 | 46 | 26 |
| **4 — text-sm Fließtext** | **`fcc0564`** | **20** | **108** | **79** |
| **Summe** | — | **84** | **2361** | **651** |

**Damit ist die Design-Migration nach DESIGN.md vollständig — Tailwind, CSS, Radien, Schatten, Farben, Patterns, Typografie und Fließtext.**

Bereit für die nächste Aufgabe.

---�