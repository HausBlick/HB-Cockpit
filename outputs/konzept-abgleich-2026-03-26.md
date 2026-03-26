# Konzept-Abgleich: GEMINI.md ↔ CLAUDE.md (Zusammengeführt)
**Erstellt:** 26.03.2026 | **Aktualisiert:** 26.03.2026 (Merge: Dispatch-Analyse + Cowork-Vollabgleich)
**Zweck:** Vollständiger Abgleich zwischen strategischem Konzept (GEMINI.md) und technischem Ist-Zustand (CLAUDE.md)

---

## 1. Zusammenfassung (TL;DR)

Das Projekt ist weit fortgeschritten und deckt die wichtigsten Kern-Anforderungen ab. Es gibt **5 strukturelle Lücken**, **12 offene Funktionen** (in CLAUDE.md als 📋 dokumentiert) sowie **6 Zukunfts-Features** (💡).

**Die drei kritischsten Befunde:**
1. **Fehlendes Sonderrollen-Konzept** (`landlord` / `advisory`) — in GEMINI.md als Kern-Architektur, in CLAUDE.md nur rudimentär
2. **Einladungscode-Workflow** — auf Phase 8.4 (💡) verschoben, obwohl GEMINI.md ihn als Fundament einstuft
3. **Kein `is_allocatable`-Flag auf Konten** — blockiert langfristig die Nebenkostenabrechnung (Phase 8.6)

---

## 2. Abgleich nach Modulen

### Modul 1: CRM & Gebäude-Management (Phase 2+3)

| Konzept-Anforderung | Status | Referenz | Bewertung |
|---|---|---|---|
| Internes CRM (persons-Tabelle) | ✅ | Phase 2 | OK |
| Objekt-Struktur & Historisierung | ✅ | Phase 3 | OK |
| Nutzer-Onboarding (Einladungscode) | 🔴 | 8.4 (💡) | **Widerspruch** — Konzept = Fundament, CLAUDE.md = optional |
| Objekt-Onboarding Wizard (Eröffnungsbilanz, Alt-Salden) | 🔴 | Nicht in CLAUDE.md | **Lücke** — fehlt komplett im Projektplan |
| Wartungsvertrags- & Schlüsselverwaltung | 🟡 | 3.6 (📋) | Bekannt, noch nicht gebaut |

### Modul 2: Kommunikation & Service (Phase 4)

| Konzept-Anforderung | Status | Referenz | Bewertung |
|---|---|---|---|
| Schwarzes Brett mit Info-Kaskade | ✅ | Phase 4.1 | OK — aber landlord→Mieter "Durchreichen" fehlt |
| Ticket-System (Helpdesk & Routing) | ✅ | Phase 4.2–4.9 | OK |
| Eskalation tenant→landlord→manager | 🟡 | Phase 4.7 | Nur owner→manager, tenant→landlord fehlt (wegen fehlender landlord-Rolle) |
| Strikte Trennung "Gesendet/Erhalten" | ❓ | — | Im Konzept gefordert, nicht explizit dokumentiert |
| Massen-E-Mail | 🟡 | 4.10 (📋) | Bekannt, noch nicht gebaut |
| Auftragsmanagement (PDF für Handwerker) | 🟡 | 4.11 (📋) | Bekannt, noch nicht gebaut |
| Dienstleister-Verzeichnis | ✅ | Phase 5.3 | OK |

### Modul 3: Dokumenten-Cloud & ETV (Phase 5)

| Konzept-Anforderung | Status | Referenz | Bewertung |
|---|---|---|---|
| Staging & Auto-Naming | ✅ | Phase 5.2 | OK |
| Zero-Auto-Publish (Draft-Workflow) | ✅ | Phase 5.2 | OK |
| Bulk-Release (150 Abrechnungen) | 🟡 | 5.5 (📋) | Bekannt, noch nicht gebaut |
| Personen-bezogene Dokumente | ✅ | Phase 5.2 / 5b | OK |
| Mieter-Silo (nur landlord-freigegebene Docs) | 🔴 | — | **Lücke** — hängt an fehlender landlord-Rolle |
| ETV-Dokumente & Beschlusssammlung | 🟡 | 5.6 (📋) | Bekannt, noch nicht gebaut |
| Digitale Umlaufbeschlüsse | 💡 | 8.1 | Zukunft |

### Modul 4: Finanzen & Abrechnung (Phase 6)

| Konzept-Anforderung | Status | Referenz | Bewertung |
|---|---|---|---|
| Echte Doppik & GoBD-konformes Journal | ✅ | Phase 6-A | OK |
| Konten-Klassifikation umlagefähig/nicht umlagefähig | 🔴 | — | **Lücke** — kein `is_allocatable`-Flag auf accounts |
| Verteilerschlüssel & Einzelwirtschaftspläne | ✅ | Phase 6.10 | OK (inkl. Bugfixes 25.03.2026) |
| Automatischer Zahlungsabgleich (Matching) | 🟡 | Phase 6.4 | CSV-Import da, automatisches Matching fehlt |
| Zählerstände UI | 🟡 | 6.8 (📋) | Bekannt, noch nicht gebaut |
| Rücklagen-Cockpit | ✅ | Phase 6-C | OK |
| Jahresabrechnung inkl. HeizkostenV & §35a | ✅ | Phase 6-D | OK |
| Official Letter Engine | ✅ | Phase 6.9 / 7-A | OK |
| Mahnwesen 3-stufig & DATEV-Export | ✅ | Phase 6-D | OK |
| Pro-rata-temporis Umlage | 🟡 | 6.7 (📋) | Bekannt, noch nicht gebaut |
| SEPA-XML Export | ✅ | Phase 6-E | OK |

### Modul 5: Dashboards & UX (Phase 5.4)

| Konzept-Anforderung | Status | Referenz | Bewertung |
|---|---|---|---|
| Admin/Manager-Dashboard | ✅ | Phase 5.4 | OK |
| Tenant-Dashboard | ✅ | Phase 5.4 | OK |
| Owner-Dashboard | 🟡 | Phase 5.4 | Basis da, ETV-Termine fehlen |
| Landlord "Meine Mieter"-Widget | 🔴 | mod-placeholder.js | **Lücke** — landlord-Rolle fehlt |
| Beirat Belegprüfung | 🟡 | mod-finanzen.js | Funktion da, aber kein dediziertes Dashboard-Widget |
| In-App Hilfe & Onboarding | 🟡 | 7.5 (📋) | Bekannt, noch nicht gebaut |

### Modul 6: System & Einstellungen (Phase 7)

| Konzept-Anforderung | Status | Referenz | Bewertung |
|---|---|---|---|
| Admin-Einstellungen | ✅ | Phase 7.1 | OK |
| Supabase Auth (Magic Links, Passwort-Reset) | ❓ | — | Läuft, aber Flow nicht explizit dokumentiert |
| E-Mail-Benachrichtigungen | 🟡 | 7.2 (📋) | Bekannt, noch nicht gebaut |
| Nutzer-Einstellungen | 🟡 | 7.3 (📋) | Bekannt, noch nicht gebaut |
| Audit Trail | 🟡 | 7.4 (📋) | Bekannt, noch nicht gebaut |
| PWA | 🟡 | 7.6 (📋) | Bekannt, noch nicht gebaut |

---

## 3. Die 5 strukturellen Lücken

### Lücke 1: Sonderrollen `landlord` und `advisory` (KRITISCH)

**Konzept:** Eigene Sonderrollen mit Dashboards, Workflows und Rechten.
**Realität:** Nur 4 Rollen (`admin`, `manager`, `owner`, `tenant`). Beirat als Workaround über `board_members`. Landlord existiert nicht.
**Blockiert:** Mieter-Silo, Ticket-Eskalation tenant→landlord, "Meine Mieter"-Widget, Dokumente durchreichen.
**Entscheidung nötig:** `landlord` als `profiles.role`-Wert (DB-Migration + RLS) ODER als Flag `is_landlord` auf owner?

### Lücke 2: `is_allocatable` auf Konten (WICHTIG)

**Konzept:** Strikte Trennung umlagefähig/nicht umlagefähig als Basis für Nebenkostenabrechnung.
**Realität:** `accounts` hat `account_type`, aber kein `is_allocatable`-Flag.
**Fix:** Kleine DB-Migration: `ALTER TABLE accounts ADD COLUMN is_allocatable BOOLEAN DEFAULT false;`

### Lücke 3: Einladungscode zu niedrig priorisiert (WICHTIG)

**Konzept:** Nutzer-Onboarding als Fundament (Modul 1).
**Realität:** Verschoben nach 8.4 (💡). Kein Weg, Endnutzer ins Portal einzuladen.
**Empfehlung:** Hochstufen auf 7.x. MVP: Admin generiert Code → person.invite_code → register.html.

### Lücke 4: Automatischer Zahlungsabgleich (NICE-TO-HAVE)

**Konzept:** Matching von Bankumsätzen zu Sollstellungen.
**Realität:** Nur manueller CSV-Import mit Kontenzuweisung.
**Empfehlung:** Optional: Fuzzy-Match (Betrag + IBAN). In GEMINI.md als bewusste Entscheidung dokumentieren.

### Lücke 5: Mieter-Silo (hängt an Lücke 1)

**Konzept:** Mieter sieht nur vom landlord durchgereichte Dokumente.
**Realität:** document_links existiert, aber landlord-Durchreich-Logik fehlt.
**Empfehlung:** Wird mit landlord-Rolle automatisch lösbar.

---

## 4. Bestätigte Übereinstimmungen (Was gut läuft)

- ✅ Tech-Stack exakt wie im Konzept
- ✅ Design-System (Farben, Inter, rounded-[15px], Mobile First)
- ✅ GoBD-konformes Buchführungssystem (No-Update/No-Delete-Rules)
- ✅ RLS auf allen 33 Tabellen
- ✅ Historisierung von Verträgen (start/end_date)
- ✅ Verteilerschlüssel mit HeizKV-Split
- ✅ Official Letter Engine mit Briefkopf (pdf-lib, client-side)
- ✅ Einzelwirtschaftsplan-PDF (Inter-Font, Briefbogen, Bulk-Export)
- ✅ 3-stufiges Mahnwesen + DATEV + SEPA-XML
- ✅ CSV-Bankimport (MT940/Sparkasse/Volksbank)
- ✅ Modulares Frontend (JS-Module, keine Frameworks)
- ✅ Kalender mit Fristen + Ticket-Wiedervorlagen
- ✅ Rollenbasierte Dashboards

---

## 5. Empfohlene Umsetzungsreihenfolge

**Schritt 1: Architektur-Entscheidung (Gemini-Session)**
→ K1: Sonderrollen-Frage klären (landlord/advisory)
→ Mieter-Silo technisch spezifizieren
→ Ergebnis: Übergabe-Paket für Claude Code

**Schritt 2: Endnutzer-Aktivierung**
→ K2: Einladungscode-Workflow MVP
→ W1: is_allocatable-Flag auf accounts (5-Min-Migration)

**Schritt 3: System & Notifications**
→ W2: E-Mail-Benachrichtigungen
→ W3: PWA (manifest.json + Service Worker)
→ N2: Nutzer-Einstellungen + Notification Opt-Ins

**Schritt 4: Verwalter-Effizienz**
→ W4: Zählerstände UI
→ W5: Bulk-Release Dokumente
→ W6: Auftragsmanagement PDF
→ W7: Massen-E-Mail

**Schritt 5: Rechtliche Compliance**
→ W8: Pro-rata-temporis Umlage
→ N4: ETV-Dokumente & Beschlusssammlung

**Schritt 6: UX-Polish & Zukunft**
→ N1: In-App Hilfe, N3: Audit Trail, N5/N6: Wartungsverträge / Objekt-Onboarding

---

## 6. Offene Entscheidungen für Niko

1. **Sonderrollen:** landlord als `profiles.role` ODER `is_landlord`-Flag auf owner?
2. **Einladungscode:** Für nächsten produktiven Einsatz nötig, oder reicht manuelle Admin-Anlage vorerst?
3. **E-Mail-Infrastruktur:** Supabase Edge Functions + SMTP-Provider (Resend/Postmark)?
4. **Automatisches Matching:** CSV-Import um Fuzzy-Match ergänzen, oder bewusst manuell lassen?
5. **Objekt-Onboarding Wizard:** Eröffnungsbilanz/Alt-Salden geplant? Fehlt komplett in CLAUDE.md.

---

*Zusammengeführt aus: Dispatch-Scheduled-Task + Cowork-Claude Vollabgleich (26.03.2026)*
