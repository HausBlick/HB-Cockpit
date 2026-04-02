# Gap-Analyse: UX-Workflow ↔ Technisches Konzept ↔ Ist-Zustand

> Erstellt am 02.04.2026 von Claude Code.
> Grundlage: `outputs/Finanzen-Workflow.md` (UX), `outputs/Finanzen-Technisch.md` (Tech-Konzept), Code-Analyse `mod-finanzen.js` + `utils-pdf.js`.

---

## 1. Was schon existiert (und gut funktioniert)

| Workflow-Phase | Ist-Zustand | Abdeckung |
|---|---|---|
| **Phase 2: JAB** (5.3 Abrechnungsspitze 3-Stufen) | `mod-finanzen.js` JAB-Wizard Step 1–5, exakt dieses 3-Stufen-Modell | ✅ 100% |
| **Phase 3: Wirtschaftsplan** | WP-Tab mit draft→approved→active→closed, Positionen-Grid, Schlüsselzuweisung | ✅ ~85% |
| **Phase 5: Berechnungslogik** | `calcShare()` in PDFs + JAB-Wizard | ✅ 100% |
| **Heizkosten 3-Wege** | Modus A (extern/manuell) + B (Selbstabrechner mit Split) in Step 3 | ✅ ~80% |
| **Beirat-Cockpit** | `_finRenderBeiratView()` + `beirat_access_periods` | ✅ ~60% |
| **PDF-Generierung** | Mahnung, WP, JAB — alle auf Template-System migriert | ✅ |
| **ETV-Integration** | Staging, Einladungs-PDF mit Anlagen | ✅ |

---

## 2. Was im Technischen Konzept steht, aber im Code FEHLT

| Tech-Konzept Punkt | Was fehlt | Aufwand |
|---|---|---|
| **1.1 `financial_statements`** (Vermögensbericht, Saldenabgleich) | Tabelle existiert nicht. Kein Stichtags-Abgleich Bank vs. System. Keine Inline-Journal-Korrektur. | **Mittel** — neue Tabelle + neuer Wizard-Step |
| **1.2 `audit_protocols`** (Digitale Belegprüfung mit Formular) | Tabelle existiert nicht. Beirat kann lesen, aber kein Prüfprotokoll-Formular ausfüllen, keine digitale Bestätigung. | **Mittel** — neue Tabelle + Formular-UI |
| **1.3 Dokumenten-Status Staging** | `documents.status` hat keinen Workflow `draft→internal_review→released`. WP/JAB-PDFs werden direkt generiert. | **Klein** — Feld existiert teils, Flow fehlt |
| **4.2 Beschluss-Trigger** | `activateBeschluss()` existiert nicht. Keine automatische Hausgeld-Aktualisierung nach ETV-Beschluss. Keine auto-Sollstellungen für Abrechnungsspitzen. | **Groß** — tiefe ETV↔Finanzen-Integration |
| **5. Lock-Mechanismus** | Journal-Sperre für abgeschlossene Jahre fehlt. | **Klein** — Check vor Insert |

---

## 3. Lücken im Technischen Konzept (fehlt gegenüber UX-Workflow)

| UX-Workflow beschreibt... | Tech-Konzept sagt... | Bewertung |
|---|---|---|
| **Phase 1.3:** Forderungen/Verbindlichkeiten mit Inline-Stornierung/Ausbuchung | Nicht erwähnt | Fehlt im Tech-Konzept |
| **Phase 2.3:** Eigentümerwechsel-Hinweis ("theoretischer Anteil nach 365 Tagen") | Nicht erwähnt | Fehlt im Tech-Konzept |
| **Phase 4.1:** PDF-Struktur JAB: Hausgeld-Übersicht (Monat für Monat) + §35a-Block + Vermögensbericht als eigenes Blatt | Nicht detailliert | Teilweise im Code (§35a existiert in Step 5), Monats-Breakdown und Vermögensbericht-Blatt fehlen |
| **Phase 4.2:** Hinweisbox für Beirat (editierbar), ZIP-Export der Belege | Nicht erwähnt | Fehlt im Tech-Konzept |
| **Phase 4.3:** Automatische Dokument-Freigabe bei ETV-Versand, Status-Wechsel draft→released | Nur kurz angedeutet unter 4.1/4.2 | Zu dünn spezifiziert |

---

## 4. Einschätzung

### Was bereits solide ist
Die Kern-Engine (Berechnung, Verteilung, PDFs) ist vollständig. Das 3-Stufen-Modell, die Verteilerschlüssel-Logik, Heizkosten-Modi, Beirat-Read-Only-View — alles da und funktional.

### Was primär fehlt
1. **Vermögensbericht** (Phase 1) — komplett neu, aber klar abgegrenzt
2. **Workflow-Automatisierung** (Phase 4) — Beschluss-Trigger, Status-Lifecycle, Journal-Sperre

### Selbst umsetzbar vs. Gemini-Abstimmung nötig

| Punkt | Selbst umsetzbar? | Anmerkung |
|---|---|---|
| Journal-Sperre | ✅ Ja | Check vor Insert auf `fiscal_year` |
| Vermögensbericht als JAB-Step 0 | ✅ Ja | Empfehlung: Im bestehenden Wizard, keine neue Tabelle — Abgleich ist ein Check, kein persistentes Dokument |
| Beirat-Prüfprotokoll | ✅ Ja | Neue Tabelle `audit_protocols` + Formular-UI |
| Dokumenten-Status-Lifecycle | ✅ Ja | Grundlage für Beschluss-Trigger |
| Beschluss-Trigger (ETV↔Finanzen) | ⚠️ Gemini-Abstimmung | Automatische Hausgeld-Anpassung hat rechtliche Implikationen, genauer Flow muss definiert werden |
| Forderungen/Verbindlichkeiten Inline-Edit | ✅ Ja | Erweiterung des Vermögensbericht-Steps |
| Eigentümerwechsel-Hinweis | ✅ Ja | Info-Block im JAB Step 4, kein großer Umbau |
| Monats-Breakdown im JAB-PDF | ⚠️ Gemini-Abstimmung | Erfordert Klärung: Wie granular? Nur Summe oder echte 12-Monats-Tabelle? |
| ZIP-Export Belege für Beirat | ✅ Ja | Supabase Storage Bulk-Download |

---

## 5. Empfohlene Umsetzungsreihenfolge

| Prio | Aufgabe | Aufwand | Abhängigkeit |
|---|---|---|---|
| 1 | **Journal-Sperre** für abgeschlossene Jahre | Klein | Keine |
| 2 | **Vermögensbericht als JAB-Step 0** (Saldenabgleich Bank vs. System) | Mittel | Keine |
| 3 | **Beirat-Prüfprotokoll** (`audit_protocols` + Formular) | Mittel | Keine |
| 4 | **Dokumenten-Status-Lifecycle** (draft→review→released) | Klein | Grundlage für Prio 5 |
| 5 | **Beschluss-Trigger** (ETV→Finanzen-Kopplung) | Groß | Prio 4 + Gemini-Abstimmung |

---

## 6. Offene Fragen für Gemini

1. **Vermögensbericht:** Eigene Tabelle `financial_statements` mit persistiertem Abgleich, oder reicht ein transienter Check im JAB-Wizard (meine Empfehlung)?
2. **Beschluss-Trigger:** Soll `apartments.hausgeld` automatisch aktualisiert werden, wenn ein ETV-TOP "Wirtschaftsplan beschlossen" abgestimmt wird? Oder manueller Schritt?
3. **Monats-Breakdown JAB-PDF:** Der UX-Workflow beschreibt eine "Tabelle mit den Monaten und der Aufteilung der tatsächlich geleisteten Zahlungen". Wie granular? 12-Spalten-Matrix oder komprimierte Quartalsübersicht?
4. **Dokumenten-Freigabe:** Soll der Status-Wechsel draft→released an den ETV-Einladungsversand gekoppelt sein, oder ein separater Admin-Klick?
