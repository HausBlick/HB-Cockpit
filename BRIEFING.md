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

**Design-Tokens:** `hb-olive` #687451 · `hb-offblack` #373737 · `hb-ultralight` #F9FAF8 · `hb-orange` #EB762D
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

## Aufgabe: Gemini CLI

**Status:** 🔄 Neue Aufgabe
**Paket:** Übergabe-Paket für Phase 1B — Frontend-Architektur: Dashboard vs. externe Tools

---

### Kontext

Phase 1B ist die zweithöchste Priorität (🔴). Die strategische Entscheidung steht bereits in GEMINI.md §2:

> Das `dashboard.html` (Startseite/Workspace, Tickets, Schwarzes Brett, Kontaktbuch, Kalender, CRM, Gebäude & Einheiten, Globale Einstellungen) bildet das Zentrum. Komplexe Tools (Finanzen, ETV, Zeiterfassung, Dokumentencloud) öffnen sich als separate HTML-Seiten. Deep-Linking (z.B. `?building=17`) verknüpft die Ansichten.

### Ist-Zustand (technisch)

- **Aktuell:** Alles läuft in einer einzigen `dashboard.html` als SPA. Module werden per `data-module`-Attribut in Nav-Links referenziert und per JS in den Content-Bereich geladen.
- **Navigation:** `nav.js` rendert Sidebar + Bottom-Nav rollenbasiert. Aktiver Zustand wird per `setActiveNav()` gesetzt.
- **Geteilte Infrastruktur:** `config.js` (Supabase-Client, Icons, Enums), `utils.js` (Toast, Modal, Dropdown, Responsive), `nav.js` (Navigation, Badges)
- **Betroffene Module für Extraktion:** `mod-finanzen.js` (~4000+ Zeilen), `mod-etv.js` (~2000+ Zeilen), `mod-zeiterfassung.js` (~1500+ Zeilen), `mod-dokumente.js` (~1500+ Zeilen)
- **Phase 1C (Mobile) ist abgeschlossen:** Bottom-Nav, Bottom Sheets, Responsive Tables, Skeleton Loading — all das muss in den neuen Seiten ebenfalls funktionieren

### Deine Aufgabe

Verfasse ein **offizielles Übergabe-Paket** für Claude Code. Schreibe es in den Abschnitt "Aufgabe: Claude Code" weiter unten.

**Offene Architektur-Fragen, die du klären solltest:**

1. **Shared Layout:** Bekommen die externen Seiten (finanzen.html, etv.html, etc.) dasselbe Layout wie dashboard.html (Sidebar, Top-Bar, Bottom-Nav)? Oder ein eigenes, schlankeres Layout? Wie wird Code-Duplikation bei Header/Nav vermieden?

2. **Navigation zwischen Seiten:** Wie funktioniert die Nav? Sidebar-Links, die auf andere HTML-Seiten verweisen statt Module zu laden? Wie bleibt der Active-State korrekt über Seitenwechsel?

3. **Deep-Linking-Schema:** Welche Query-Parameter? Beispiel: `finanzen.html?building=17&tab=buchungen` — wie übergibt das Dashboard den Kontext?

4. **Shared State:** Wenn ein User in dashboard.html ein Gebäude ausgewählt hat und dann zu finanzen.html wechselt — wie wird der Gebäude-Kontext transportiert? URL-Params? SessionStorage?

5. **Rollenbasierte Sichtbarkeit:** Mieter/Eigentümer sehen die externen Tools nicht — wie wird das sichergestellt? Nur über Nav-Ausblendung oder auch serverseitig (RLS reicht für Daten, aber die HTML-Seiten sind statisch auf GitHub Pages)?

6. **Reihenfolge der Extraktion:** Welches Modul zuerst? Empfehlung: kleinstes zuerst (Zeiterfassung?) als Proof of Concept, dann die großen.

**Format:**
```
[UMSETZUNGS-ÜBERGABE FÜR CLAUDE]
1. Ziel
2. Architektur-Entscheidungen (zu den 6 Fragen oben)
3. Anforderungen (priorisiert)
4. Betroffene Dateien
5. UI-Vorgaben
6. Offene Entwickler-Entscheidungen
```

### Antwort Gemini CLI

**Erledigt.** Das Übergabe-Paket für Phase 1B (Frontend-Architektur-Split) wurde erstellt und im Claude-Block platziert. Alle 6 Architektur-Fragen wurden präzise beantwortet (Shared Layout via `nav.js` Injection, URL-Params + `sessionStorage` für State, JS-basierter Auth-Guard für statische Seiten, PoC-Start mit Zeiterfassung). Die Einhaltung der Mobile-Patterns aus Phase 1C wurde als strikte UI-Vorgabe verankert.

---

## Aufgabe: Claude Code

**Status:** 🔄 Übergabe-Paket bereitgestellt (Phase 1B)

[UMSETZUNGS-ÜBERGABE FÜR CLAUDE]
1. Ziel
Entflechtung des monolithischen `dashboard.html` in eine aufgeräumte Multi-Page/SPA-Hybridarchitektur (Phase 1B, Prio 🔴). Das Kern-Dashboard behält alltägliche Funktionen. Komplexe Experten-Tools (Finanzen, ETV, Zeiterfassung, Dokumentencloud) werden in separate HTML-Dateien ausgelagert, um Ladezeiten, Wartbarkeit und Übersichtlichkeit zu optimieren. Das in Phase 1C etablierte "Mobile First"-App-Feeling muss auf allen neuen Seiten zu 100 % erhalten bleiben.

2. Architektur-Entscheidungen (zu den 6 offenen Fragen)
- **Shared Layout:** Die neuen HTML-Seiten (`zeiterfassung.html`, etc.) erhalten eine minimalistische HTML-Shell (inkl. Viewport-Meta für Mobile). Sidebar, Header und Bottom-Nav werden weiterhin dynamisch über `nav.js` gerendert und in leere Container-Elemente injiziert. Gemeinsame Basis-Skripte (`config.js`, `utils.js`, `nav.js`, Tailwind) werden im `<head>` geladen. Code-Duplikation beim HTML-Gerüst wird minimiert.
- **Navigation & Active-State:** `nav.js` wird so angepasst, dass Menüpunkte wahlweise SPA-Module (`data-module`) ODER echte Links (`href="zeiterfassung.html"`) unterstützen. Der Active-State wird anhand von `window.location.pathname` (für externe Seiten) oder dem aktiven `data-module` (im Dashboard) gesetzt.
- **Deep-Linking-Schema:** Der Kontextwechsel erfolgt über URL-Parameter (z.B. `?building=17&tab=projekte`). Externe Tools werten beim Start die `URLSearchParams` aus und initialisieren ihren Zustand entsprechend.
- **Shared State:** Zusätzlich zu URL-Parametern speichert das Dashboard global gewählte Kontexte (z.B. das zuletzt aktive Gebäude) in der `sessionStorage` (z.B. `hb_active_building`). Öffnet der User ein externes Tool über die Sidebar (ohne URL-Parameter), greift das Tool als Fallback auf die `sessionStorage` zurück.
- **Rollenbasierte Sichtbarkeit:** Da die HTML-Seiten statisch auf GitHub Pages gehostet sind, muss jede externe Seite beim Laden (in der Init-Logik) zwingend die Rolle via Supabase Auth prüfen. Ist der User kein `admin` oder `manager`, erfolgt ein sofortiger Redirect zu `dashboard.html` (RLS schützt die Daten zusätzlich).
- **Reihenfolge der Extraktion:** **Schritt 1 (PoC):** Auslagerung des Moduls Zeiterfassung in `zeiterfassung.html`. Erst wenn Layout-Injection, Routing, Auth-Guard und Mobile-Patterns hier fehlerfrei funktionieren, folgen **Schritt 2:** ETV, **Schritt 3:** Dokumentencloud und **Schritt 4:** Finanzen.

3. Anforderungen (priorisiert)
- Prio 1: Refactoring von `nav.js`, um externe Links und path-basiertes Active-State-Highlighting zu unterstützen, ohne das bestehende SPA-Routing im Dashboard zu brechen.
- Prio 2: Aufbau der `zeiterfassung.html` als Proof of Concept inkl. JS-Auth-Guard und Einbindung der nativen Mobile-Patterns aus Phase 1C.
- Prio 3: Implementierung des `sessionStorage`-Syncs für den globalen Gebäude-Kontext.
- Prio 4: Sukzessive Migration der verbleibenden drei Module (ETV, Dokumente, Finanzen).

4. Betroffene Dateien
- `dashboard.html` (Bereinigung der zu entfernenden Module)
- `js/nav.js` (Anpassung Nav-Generierung, externe Links, Active-State-Logik)
- Neu: `zeiterfassung.html`, `etv.html`, `dokumente.html`, `finanzen.html`
- JS-Module: `js/modules/mod-zeiterfassung.js`, `mod-etv.js`, `mod-dokumente.js`, `mod-finanzen.js` (Anpassung der Init-Logik für Standalone-Betrieb inkl. Parameter-Parsing und Auth-Check)

5. UI-Vorgaben
- Alle in Phase 1C etablierten Mobile-Patterns (Scroll-Containment via `h-screen overflow-hidden`, Sticky-Header, Bottom-Nav, Touch-Targets min. 44px, Skeleton-Loading, Bottom Sheets) MÜSSEN in den neuen HTML-Shells exakt identisch aufgebaut werden.
- Der visuelle Bruch (Flicker) beim Wechsel zwischen `dashboard.html` und den neuen Seiten soll so gering wie möglich gehalten werden.

6. Offene Entwickler-Entscheidungen (Bitte im ersten Commit-Feedback beantworten)
- **HTML-Shell-Injektion:** Wie genau stellst du sicher, dass die Sidebar/Bottom-Nav in den neuen Seiten gerendert wird, ohne den HTML-Struktur-Code in jede Datei redundant zu kopieren? (z.B. eine zentrale `renderGlobalLayout()`-Funktion in `nav.js`?)
- **Asset-Loading:** Werden die spezifischen Modul-JS-Dateien in den neuen HTML-Seiten als `<script type="module">` direkt geladen, oder nutzt du einen dynamischen Loader?

---
