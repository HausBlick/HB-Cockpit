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

## ⚠️ GENERELLE REGELN FÜR CLAUDE CODE

1. **RLS-Policies NICHT anfassen!** Die RLS-Policies wurden manuell in Supabase mit `SECURITY DEFINER`-Funktionen repariert. Erstelle KEINE neuen und ändere KEINE bestehenden.
2. **Dateien NICHT abschneiden!** Du neigst dazu, bei Edits die letzten Zeilen langer Dateien abzuschneiden. **Prüfe nach JEDEM Edit**, dass die letzte Funktion der Datei vollständig vorhanden ist. Zähle die Zeilen vorher und nachher.
3. **CLAUDE.md immer mit committen** — nach jeder Modul-Änderung im selben Commit aktualisieren.

---

## Aufgabe: Claude Code (Folge-Auftrag)

**Status:** 🔄 Neue Aufgabe
**Paket:** Jahresabrechnung PDF — Anschreiben + Summary-Tabelle Redesign
**Bezug:** Commit `ed9c344` (Basis-Implementierung)

### Kontext

Die Basis-Implementierung der Jahresabrechnung PDF funktioniert. Nach dem ersten Test gibt es drei Änderungen:

### Änderung 1: Anschreiben (Seite 1) vereinfachen

**AKTUELL:** Die Summary-Tabelle auf Seite 1 zeigt 4 Zeilen (Gesamtkosten, HG-Vorschüsse Soll, HG-Vorschüsse Ist, Abrechnungsspitze).

**NEU:** Die Summary-Tabelle auf Seite 1 komplett **entfernen**. Es soll NUR die Highlight-Box mit dem Ergebnis bleiben:

```
┌─────────────────────────────────────────┐
│  Abrechnungsspitze:                     │
│  Nachzahlung          1.662,31 €        │  ← oder "Guthaben"
└─────────────────────────────────────────┘
```

Die detaillierte Herleitung (wie sich der Betrag ergibt) kommt auf Seite 2 in der neuen Summary-Tabelle (siehe Änderung 2).

### Änderung 2: Summary-Tabelle auf Seite 2 — Dreispaltig wie Referenz

Die Summary-Tabelle auf der Einzelabrechnung (Seite 2) soll dreispaltig werden und die vollständige Berechnung zeigen:

**Neues Format (3 Spalten: Bezeichnung | Objekt gesamt | Ihr Anteil):**

```
┌──────────────────────────┬────────────────┬──────────────┐
│ Berechnung Ihres Anteils │ Objekt gesamt  │ Ihr Anteil   │
├──────────────────────────┼────────────────┼──────────────┤
│   Gesamtkosten           │  123.551,35 €  │   1.374,65 € │
│ - HG-Vorschuss Soll      │  124.387,00 €  │   1.332,00 € │
├──────────────────────────┼────────────────┼──────────────┤
│ = Abrechnungsspitze      │     -835,65 €  │  Unterdeck.  │
│                          │                │    42,65 €   │
├──────────────────────────┼────────────────┼──────────────┤
│   HG-Vorschuss Soll      │  124.387,00 €  │   1.332,00 € │
│ - HG-Vorschuss Ist       │  119.234,81 €  │   1.332,00 € │
├──────────────────────────┼────────────────┼──────────────┤
│ = Zahlungsdifferenz      │    5.152,19 €  │ Planerfüllung│
│                          │                │     0,00 €   │
├──────────────────────────┼────────────────┼──────────────┤
│ = Abrechnungssaldo       │                │ Nachzahlung  │
│                          │                │    42,65 €   │
└──────────────────────────┴────────────────┴──────────────┘
```

**Logik:**
- **Abrechnungsspitze** = Gesamtkosten − HG-Vorschuss Soll (positiv = Unterdeckung/Nachzahlung, negativ = Überdeckung/Guthaben)
- **Zahlungsdifferenz** = HG-Vorschuss Soll − HG-Vorschuss Ist (positiv = nicht alles bezahlt, 0 = planmäßig bezahlt)
- **Abrechnungssaldo** = Abrechnungsspitze + Zahlungsdifferenz (das ist der finale Betrag: Nachzahlung oder Guthaben)

**Hinweis-Box neben oder unter der Summary-Tabelle:**
> *Zur Beschlussfassung steht ausschließlich die Abrechnungsspitze. Etwaige Zahlungsrückstände basieren auf dem Wirtschaftsplan des Vorjahres. Der Abrechnungssaldo dient lediglich der Information. (BGH-Urteil v. 09.03.2012 V ZR 147/11)*

**Datenquellen:**
- **Gesamtkosten Objekt gesamt:** Summe aller Aufwands-Buchungen (journal_entries, Soll-Seite auf Aufwandskonten) im Abrechnungszeitraum für das Gebäude
- **Gesamtkosten Ihr Anteil:** Verteilung über distribution_keys (wie bereits in der Verteilungstabelle berechnet)
- **HG-Vorschuss Soll:** Summe der payment_demands (demand_type='hausgeld') im Zeitraum — Objekt gesamt = alle Eigentümer, Ihr Anteil = nur diese Person/Einheit
- **HG-Vorschuss Ist:** Summe der tatsächlich gezahlten payment_demands (status='paid') im Zeitraum

### Änderung 3: Header auf Seite 1 bereinigen

**AKTUELL:** Seite 1 hat dieselbe Kopfzeile + graue Trennlinie wie Seite 2+.

**NEU:** Seite 1 soll **KEINE Kopfzeile** und **KEINE graue Trennlinie** haben — genau wie bei `generateEinzelwirtschaftsplanPDF`, wo `addFirstPage()` verwendet wird (nur Datum rechtsbündig, sonst clean).

### PFLICHT nach der Umsetzung:
- Prüfe mit `wc -l js/utils-pdf.js`, dass die Datei NICHT kürzer geworden ist (aktuell 1847 Zeilen)
- Prüfe mit `wc -l js/modules/mod-finanzen.js`, dass die Datei NICHT kürzer geworden ist (aktuell 3757 Zeilen)
- Committe + pushe mit CLAUDE.md-Update
- Schreibe dein Ergebnis in den Antwort-Block unten

### Antwort Claude Code

**Erledigt.** Alle 3 Änderungen umgesetzt:

1. **Seite 1 vereinfacht:** Summary-Tabelle entfernt, nur Highlight-Box bleibt.
2. **Seite 2 — neue 3-spaltige Summary:** Abrechnungsspitze (Kosten − HG-Soll), Zahlungsdifferenz (Soll − Ist), Abrechnungssaldo (Spitze + Differenz). Olive Grand-Total-Zeile. BGH-Hinweis (V ZR 147/11) unter der Tabelle.
3. **Seite 1 Header:** War bereits korrekt via `addFirstPage()` — nur Datum, keine Kopfzeile.

Datei-Integrität: utils-pdf.js 1879 (vorher 1847), mod-finanzen.js 3757 (unverändert).
