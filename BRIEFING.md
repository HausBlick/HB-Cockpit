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

## Aufgabe Gemini CLI:

(Warte auf Feedback zu 6.15-A)

---

### Antwort Gemini CLI

Briefing für Claude Code (Präzisierung Paket 6.15) wurde erstellt.

---

## Aufgabe Claude Code:

### Paket 6.15: Der große Jahresabschluss (Korrekturen & Präzisierungen)

Claude, du arbeitest bereits an **6.15-A (Journal-Sperre)**. Bitte prüfe bei der Umsetzung folgende Details:

1. **Journal-Sperre (6.15-A):** Diese muss zwingend auf **Gebäude-Ebene** (`building_id`) und für ein spezifisches Geschäftsjahr (`fiscal_year`) gelten, nicht global.
2. **Kombi-PDF (Ab 6.15-D/E):** Bei der ETV-Einladung muss ein kombiniertes PDF (Einladung + Tagesordnung + individuelle Anhänge des jeweiligen Empfängers) generiert werden. Die Anhänge (JAB/WP) werden zeitgleich im Portal als **Einzel-Dokumente** freigeschaltet.
3. **Abrechnungsspitzen (Ab 6.15-F):** Der Beschluss-Trigger ("Werte jetzt aktivieren") muss für jede Einheit eine einmalige Sollstellung (`payment_demands`) für die jeweilige Abrechnungsspitze (Guthaben/Nachzahlung) erzeugen.
4. **JAB-Layout (PDF):** Für den Soll/Ist-Vergleich in der Einzelabrechnung ist eine kompakte **12-Monats-Matrix** (max. 1 Seite) Pflicht.

**Nächster Schritt:** Schließe 6.15-A ab und fahre dann mit **6.15-B (Vermögensbericht-Tabelle)** fort, wie in `CLAUDE.md` geplant, unter Berücksichtigung dieser Punkte.

---

### Antwort Claude Code:

**6.15-A Journal-Sperre — BEREITS ABGESCHLOSSEN ✅**

Zu den Präzisierungen:
1. **Gebäude-Ebene:** Bereits korrekt implementiert — `_finIsYearClosed(buildingId, fiscalYear)` prüft `budget_plans` mit `.eq('building_id', buildingId).eq('fiscal_year', fiscalYear).eq('status', 'closed')`.
2. **Kombi-PDF:** Notiert für 6.15-D/E.
3. **Abrechnungsspitzen:** Notiert für 6.15-G.
4. **12-Monats-Matrix:** Notiert für 6.15-E.

**6.15-B Vermögensbericht — ABGESCHLOSSEN ✅**

JAB-Wizard von 5 auf 6 Steps erweitert. Neuer Step 1: Saldenabgleich Bank/Rücklage (System vs. Bankauszug) + Forderungen/Verbindlichkeiten mit Inline-Stornierung. Daten werden per UPSERT in `financial_statements` gespeichert.

**Aktionen für Niko:**
- Migration `scripts/migration_financial_statements.sql` in Supabase ausführen (Fix: `building_id` ist jetzt `BIGINT`, nicht UUID). - **Niko: Erledigt**
- RLS-Policies für `financial_statements` manuell in Supabase anlegen (lesen=admin/manager, schreiben=admin/manager). → Claude erstellt keine RLS (Regel #1 in BRIEFING). **Niko: Erledigt**

**6.15-C Beirat-Prüfprotokoll — ABGESCHLOSSEN ✅**

Beirat-View erweitert: Hinweisbox (Text aus `global_settings.audit_hint_text`, editierbar), Prüfprotokoll-Formular (Ergebnis/Umfang/Feststellungen mit Pflichtfeld-Logik), digitale Signatur-Metadaten. Admin sieht eingereichte Protokolle in der Belegprüfung.

**Aktionen für Niko:**
- Migration `scripts/migration_audit_protocols.sql` in Supabase ausführen (Tabelle `audit_protocols` + `global_settings.audit_hint_text` Spalte). RLS-Policies sind im SQL enthalten. **Niko: Erledigt**

**6.15-D Dokumenten-Status-Lifecycle — ABGESCHLOSSEN ✅**

`documents.metadata` JSONB-Spalte ergänzt. `_pdfSplitAndUpload()` erstellt jetzt DB-Einträge mit `status:'draft'` + `metadata:{doc_type, fiscal_year, unit_id}`. Nicht-Admins sehen nur `active`/`released` (bestehende Filterlogik reicht aus). Status-Flow: draft → released (bei ETV-Einladungsversand, kommt in 6.15-G).

**Aktionen für Niko:**
- Migration `scripts/migration_documents_staging.sql` in Supabase ausführen (nur 1 Zeile: `ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB`). **Niko: Erledigt**

**6.15-E JAB-PDF Monatsübersicht + Vermögensbericht — ABGESCHLOSSEN ✅**

JAB-PDF hat jetzt 3 Seiten: (1) Anschreiben, (2) Einzelabrechnung mit 12-Monats-Matrix `jab_monats_matrix`, (3) Vermögensbericht (Kontensalden + offene Forderungen). Daten kommen aus `payment_demands` (Soll/Monat), `journal_entries` Konto 1400 (Ist/Monat), `financial_statements` (Salden) und `payment_demands` (Forderungen).

**Aktionen für Niko:**
- Migration `scripts/migration_jab_template_v2.sql` in Supabase ausführen (UPDATE des bestehenden JAB-Templates, kein INSERT). **Niko: Erledigt**

**6.15-F ETV-Kopplung & Kombi-PDF — ABGESCHLOSSEN ✅**

Kombi-PDF (Einladung + TOPs + WP/JAB pro Eigentümer) war bereits implementiert. Neu: Status-Trigger `draft→released` bei Einladungsgenerierung. Confirm-Dialog warnt vor Freigabe. Button zeigt Fortschritt.

**Keine Migration nötig** — reine Code-Änderung.

**Nächster Schritt:** 6.15-G (Beschluss-Aktivierung: Hausgeld-Update + Sollstellungen für Spitzen). Niko gibt grünes Licht.

**6.15-G Beschluss-Aktivierung — ABGESCHLOSSEN ✅**

Button "Beschlüsse aktivieren" in JAB Step 6. 3 Aktionen:
1. Sollstellungen für Abrechnungsspitzen (Nachzahlung/Guthaben) mit 14-Tage-Frist
2. Hausgeld-Update aus WP des Folgejahres (nur bei Änderung)
3. Historisierung in `hausgeld_history`

**Aktionen für Niko:**
- Migration `scripts/migration_hausgeld_history.sql` in Supabase ausführen. **Niko: Erledigt**

**Phase 6.15 ist damit KOMPLETT (A–G alle ✅).**

**Hinweis für Gemini:** Die ursprüngliche Planung hatte 6.15-F als "WP-PDF Header" und 6.15-G als "Beschluss-Aktivierung". Gemini hat 6.15-F als ETV-Kopplung umdefiniert — das ist jetzt erledigt. Falls der WP-PDF Header (Hausgeld+Rücklage getrennt) noch gewünscht ist, kann das als separater Punkt nachgezogen werden.

---
