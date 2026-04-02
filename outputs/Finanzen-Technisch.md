# Technisches Konzept: Finanzen & Jahresabschluss (Phase 7+) - FINALISIERT

Dieses Dokument definiert die technische Umsetzung basierend auf dem "Finanzen UX Workflow" und den Abstimmungen vom 02.04.2026.

## 1. Datenmodell-Erweiterungen (Supabase/PostgreSQL)

### 1.1 Vermögensbericht & Saldenabgleich (`financial_statements`)
**Status:** Dauerhafte Speicherung zur Rechtssicherung (§ 28 WEG).
- `id` (UUID, PK)
- `building_id` (FK buildings)
- `stichtag` (DATE, meist 31.12.)
- `account_id` (FK accounts - für Bank/Rücklagenkonten)
- `system_balance` (DECIMAL - Errechnet aus Journal zum Stichtag)
- `statement_balance` (DECIMAL - Manuell eingetragener Saldo laut Bankbeleg)
- `difference` (DECIMAL - system_balance - statement_balance)
- `is_validated` (BOOLEAN - True, wenn Differenz 0,00 € oder manuell quittiert)
- `validated_at` (TIMESTAMP)

### 1.2 Beirat-Prüfung (`audit_protocols`)
- `id` (UUID, PK)
- `building_id` (FK buildings)
- `fiscal_year` (INT)
- `auditor_id` (FK profiles)
- `status` (ENUM: 'pending', 'completed', 'disputed')
- `check_date` (TIMESTAMP)
- `findings` (TEXT - Pflichtfeld bei Beanstandung)
- `is_formally_correct` (BOOLEAN)
- `signature_data` (JSONB - IP, Timestamp und User-Agent der Bestätigung)

### 1.3 Dokumenten-Status & Staging
Erweiterung `documents`:
- `status`: 'draft' (Standard nach Generierung), 'released' (Sichtbar für Eigentümer).
- `metadata`: `{"type": "jab", "fiscal_year": 2025, "unit_id": "..."}` zur gezielten Filterung.

## 2. Die Berechnungs-Engine

### 2.1 Das 3-Stufen-Abrechnungsmodell (Präzisions-Kalkulation)
1. **Stufe 1 (Kosten-Abweichung):** `Summe(Einzelanteile_Ist_Kosten) - Soll_Hausgeld_Plan (laut WP)`
2. **Stufe 2 (Zahlungs-Abweichung):** `Soll_Hausgeld_Plan - Ist_Zahlungen_Journal`
3. **Stufe 3 (Finaler Saldo):** `Stufe 1 + Stufe 2` -> Ergebnis: Guthaben oder Nachzahlung.

### 2.2 PDF-Layout: Kompakte JAB-Matrix
- **Soll/Ist-Vergleich:** Eine kompakte Tabelle mit 12 Zeilen (Jan-Dez).
- **Inhalt:** Spalten für "Soll-Hausgeld", "Ist-Zahlung" und "Differenz".
- **Ziel:** Maximal eine Seite Platzverbrauch für maximale Übersichtlichkeit.

## 3. Workflow & Automatisierung

### 3.1 ETV-Kopplung & Freigabe
- **Trigger:** Klick auf "ETV-Einladung versenden" im ETV-Modul.
- **Aktion 1 (Kombination):** System generiert eine "Versand-PDF" (Einladung + TOPs + individuelle Anhänge JAB/WP des jeweiligen Empfängers).
- **Aktion 2 (Portal):** System setzt `documents.status` der verknüpften Anhänge auf `released`. Diese erscheinen im Portal als **separate Einzel-Dokumente** (Einladung, Abrechnung, Plan).
- **Sicherheit:** Filterung über `unit_id` stellt sicher, dass jeder Eigentümer nur seine eigene Abrechnung sieht.

### 3.2 Beschluss-Aktivierung (Post-ETV)
- **Workflow:** Manueller Knopfdruck ("Werte jetzt aktivieren") durch den Admin im Finanz-Modul nach erfolgter ETV.
- **System-Aktion:** 
  1. Update `apartments.hausgeld` mit den neuen Planwerten.
  2. Generierung von einmaligen `payment_demands` für die Abrechnungsspitzen (Nachzahlung/Guthaben).
  3. Historisierung des alten Hausgeldes (Audit-Trail).

## 4. Sicherheit & Revision
- **Journal-Sperre:** Sobald der Vermögensbericht (Phase 1.1) validiert und das Jahr "geschlossen" ist, werden neue Buchungen (`journal_entries`) für diesen Zeitraum blockiert (`status = 'closed'`).
- **Beirat-Haftungsausschluss:** Einblendung einer editierbaren Hinweisbox im Beirat-Cockpit vor der digitalen Signatur.
