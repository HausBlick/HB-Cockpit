# BRIEFING.md — HB Mieterportal (Lokaler KI-Kanal)

> **Zweck:** Token-effizienter Kontext-Kanal zwischen Niko, Gemini CLI und Claude Code.
> Diese Datei ersetzt das vollständige Lesen von GEMINI.md/CLAUDE.md bei jedem Start.
> **Regel:** Kurz & präzise. Keine großen Code-Blöcke oder Chat-Verläufe hier einfügen.
>
> ⚠️ **LOKAL ONLY:** Diese Datei steht in `.gitignore` und wird NICHT gepusht.
> Beim allerersten Mal: Datei einmalig committen → Claude Code zieht sie → dann zu .gitignore hinzufügen.

---

## 🏗️ Projekt-Essentials (Permanent — nicht löschen)

| | |
|---|---|
| **Live-URL** | https://portal.hausblick-fn.de/ |
| **GitHub** | https://github.com/HausBlick/Mieter-Portal |
| **Supabase ID** | `unprrlbvylmzxxhpfisr` |
| **Stack** | Supabase (PostgreSQL 17 + RLS) · Vanilla JS (ES6) · Tailwind CSS CDN · GitHub Pages |

**CI-Design-Tokens:**
- `hb-olive` `#687451` → Buttons, Header, aktive Elemente
- `hb-offblack` `#373737` → Text, Überschriften
- `hb-ultralight` `#F9FAF8` → App-Hintergrund
- `hb-orange` `#EB762D` → Warnungen, Akzente
- Cards: `rounded-[15px]` · Schatten: `0 4px 20px -2px rgba(0,0,0,0.03)` · Font: Inter

**Rollen:** `admin` (Vollzugriff) · `manager` (Objekt-limitiert) · `owner` · `tenant`
**Sonderrollen:** `advisory` (Beirat) · `landlord` (vermietender Eigentümer)

**Briefbogen:** Fertig gestaltet (Logo, Adresse, IBAN, Steuernummer sind fix im Bild).
Liegt in Supabase Storage → `letterhead_url` aus `global_settings`. Kein dynamisches Befüllen nötig.
**PDF-Library:** `pdf-lib` (client-side, kein Server). Briefbogen = Hintergrund-Layer, Content = darüber.

---

## 📋 Phasen-Übersicht (Kurzform)

| Phase | Thema | Status |
|---|---|---|
| 1–2 | Infrastruktur, CRM | ✅ Abgeschlossen |
| 3 | Objekte & Zuweisungen | 🔄 Offen: 3.6 Wartungsverträge/Schlüssel |
| 4 | Kommunikation | 🔄 Offen: 4.10 Massen-E-Mail, 4.11 Auftragsmanagement |
| 5 | Dokumente & Kontakte | 🔄 Offen: 5.5 Bulk-Release, 5.6 ETV-Dokumente |
| 6 | Finanzen & Abrechnung | 🔄 Offen: 6.7 Pro-rata, **6.8 Zählerstände**, **6.10 WP PDF-Design** |
| 7 | System & Einstellungen | 📋 Offen: 7.2 E-Mail-Push, 7.3 Nutzer-Settings, 7.4 Audit, 7.6 PWA |
| 8 | Automatisierung (optional) | 💡 Zukunft |

---

## 🎯 Aktuelles Paket

**Paket:** `6.10-B` — **Einzelwirtschaftsplan PDF-Design**
**Status:** 🔄 In Umsetzung durch Claude Code
**Voraussetzung:** Verteilerschlüssel-Logik (6.10-A) ist fertig implementiert ✅

### Aufgabe für Claude Code

Das PDF des Einzelwirtschaftsplans ist funktional korrekt, aber optisch noch nicht
auf dem finalen Qualitätsniveau. Es soll moderner, professioneller und strikt im
HausBlick CI gestaltet werden.

**Was geändert werden soll (präzise):**

**1. Meta-Header (Dokumentkopf)**
- Titel `Einzelwirtschaftsplan 2026` → größer, fetter, in `hb-offblack`
- Unter dem Titel: Objekt-Zeile (z.B. `0001 – WEG Musterstraße 12 – WE WE01 – EG links`) in mittelgrauer Schrift
- Eigentümer-Zeile und MEA/Fläche als zweizeilige kompakte Info-Box (leichter `hb-ultralight` Hintergrund, `rounded-[10px]`, linker Olive-Rand `border-l-4 border-hb-olive`)
- Datum (`Friedrichshafen, 24. März 2026`) → rechtsbündig auf Höhe der Info-Box, klar abgesetzt

**2. Haupttabelle**
- Header-Zeile: `bg-hb-olive text-white` (wie alle anderen Modul-Tabellen im Portal — KEIN Grau)
- Spalten: **Konto | Bezeichnung | Gesamt (€) | Schlüssel | Anteil (€)**
- ❌ KEIN `mtl. (€)` in der Tabelle — die monatliche Berechnung gehört NICHT in die Tabelle
- Zahlen-Spalten: rechtsbündig
- `Anteil (€)` > 0 → `font-bold text-hb-offblack`; = 0 → `text-gray-400` (deemphasized)
- Zeilentrennlinien: `divide-hb-olive/10` (ganz leicht olive)
- Zebra-Muster: gerade Zeilen `bg-white`, ungerade `bg-hb-ultralight/50` (sehr subtil)

**3. Gesamtzeile & Hausgeld-Berechnung**
- Summenzeile `Ihr Jahres-Hausgeld:` mit Jahresbetrag → `bg-hb-olive/10`, fett, klar abgesetzt
- Darunter (außerhalb der Tabelle, als kompakte Info-Box) die monatliche Ableitung:
  `Ihr monatliches Hausgeld: [Jahresbetrag ÷ 12] €`  — einmalig, klein, grau
- Diese Monatsberechnung ist eine Übersichtsinfo, keine Tabellenspalte

**4. Rechtlicher Hinweis-Block**
- Hintergrund: `hb-orange/10` (sehr helles Orange)
- Rahmen: `border border-hb-orange rounded-[10px]`
- Kleines ⚠️-Icon oder `i`-Icon in `hb-orange` links
- Text: `text-sm text-hb-offblack`

**5. Gesamtlayout**
- Mehr Weißraum zwischen den Sektionen (Header → Tabelle → Summe → Hinweis)
- Konsistenter seitlicher Innenabstand (mind. 10mm links, 15mm rechts vom Briefbogen-Rand)

**Referenz-Design:** Siehe Immoware24-Beispiel (strukturell ähnlich), aber mit HausBlick CI-Farben
statt dem Immoware-Grau. Die Olive-Header sind das stärkste visuelle Element.

---

## 📥 KI-Briefkasten

**Von:** Niko
**An:** Claude Code
**Datum:** 24.03.2026

**Nachricht:**
Verteilerschlüssel (6.10-A) ist fertig und funktioniert. ✅
Nächste Aufgabe: PDF-Design des Einzelwirtschaftsplans verbessern (Details oben unter "Aktuelles Paket").
Nach Umsetzung bitte CLAUDE.md aktualisieren (neuer Eintrag für 6.10-B).

---

## 📤 Antwort / Status

**Status:** Offen
**Antwort:** *(Claude Code trägt hier nach Erledigung den Status ein)*

---

## 📜 Zuletzt erledigte Pakete

| Paket | Beschreibung | Erledigt |
|---|---|---|
| 7.1 | Admin-Einstellungen (global_settings, Briefkopf-Upload) | ✅ |
| 6.9 | Official Letter Engine Basis (pdf-lib, Mahnung, Wirtschaftsplan) | ✅ |
| 6.10-A | Verteilerschlüssel-Management (distribution_keys, distribution_key_units, accounts-Erweiterung) | ✅ |

---

## 🔧 .gitignore Anweisung (einmalig, für Claude Code)

Beim ersten Mal nach dem Pull dieser Datei:
```
echo "BRIEFING.md" >> .gitignore
git add .gitignore
git commit -m "chore: BRIEFING.md lokal halten (nicht pushen)"
```
Danach bleibt BRIEFING.md dauerhaft lokal und wird nie mehr gepusht.
