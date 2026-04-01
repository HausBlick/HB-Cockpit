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

*(Keine aktive Aufgabe)*

### Antwort Gemini CLI

*(ausstehend)*

---

## Aufgabe: Claude Code

*(Keine aktive Aufgabe)*

### Antwort Claude Code

*(ausstehend)*

---
