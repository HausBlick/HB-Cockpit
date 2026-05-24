# STATUS.md – HB-Cockpit Live-Gang

> **Pflege:** Ausschließlich von Niko. Claude Code darf lesen, nicht editieren.
> **Letztes Update:** 24.05.2026

---

## 🎯 Ziel
3 Eigentümer onboarden in 3–5 Tagen. Grundfunktionen: Dashboard, Schwarzes Brett, Tickets, Dokumente.

---

## 🔴 BLOCKER – muss vor Live-Gang gefixt sein

### B1: Owner-Dashboard ist leer
**Symptom:** Eigenes Gebäude fehlt, "Meine Einheit"-Modul zeigt "Demnächst verfügbar", Hausgeld-Saldo ist Strich.
**Impact:** Erster Eindruck katastrophal. Eigentümer sieht nichts Persönliches.
**Status:** offen

### B2: RLS-Lücke bei "Beschlusssammlung anfordern"
**Symptom:** Owner kann fremde Gebäude in der Auswahl sehen/anfordern.
**Impact:** Datenschutz-Verletzung. Kritisch.
**Status:** offen

### B3: Ticket-Antwort kommt nicht beim Owner an
**Symptom:** Verwalter antwortet → Ticket bleibt im "Gesendet" des Owners. Keine Benachrichtigung. Status-Logik unklar.
**Impact:** Owner glaubt, niemand antwortet. Kernfunktion kaputt.
**Status:** offen

### B4: E-Mail-Versand funktioniert nicht
**Symptom:** Brevo verlangt IP-Autorisierung. Keine Mails kommen durch.
**Impact:** Keine Einladungen, keine Ticket-Benachrichtigungen, keine News-Mails.
**Status:** offen
**Hinweis:** Einladungen laufen aktuell über Supabase-Auth-Mails, das funktioniert. Aber alle anderen Trigger sind tot.

---

## 🟡 WICHTIG – sollte vor Live-Gang gefixt sein

### W1: "Beitrag erstellen"-Button für Owner sichtbar
**Symptom:** Button ist da, führt zu Fehler. Sollte ausgeblendet sein.
**Impact:** Verwirrung beim Eigentümer.
**Status:** offen

### W2: Like-Funktion zählt mehrfach
**Symptom:** Nach Refresh/Re-Login kann erneut geliked werden.
**Impact:** Like-Zahlen unzuverlässig.
**Status:** offen

### W3: Ticket-Einheit-Vorauswahl falsch bei Multi-Einheit
**Symptom:** Bei 2 Einheiten wird automatisch die erste vorausgewählt. Sollte "Keine Einheit gewählt" sein.
**Impact:** Falsche Zuordnung von Tickets möglich.
**Status:** offen

### W4: Dokumenten-Upload im Ticket fehlt
**Symptom:** Feature fehlt komplett.
**Impact:** Eigentümer kann keine Fotos/Belege anhängen.
**Status:** offen

---

## 🟢 KOSMETIK – nach Live-Gang okay

### K1: Mobile-Layout Dokumente verschachtelt
### K2: Mobile-Layout Tickets nicht nutzerfreundlich
### K3: PDF-Download öffnet neuen Tab statt direkt zu downloaden (Desktop + Mobile)
### K4: PDF-Modal könnte größer sein
### K5: Console-Errors auf Dashboard (kein User-Impact, aber aufräumen)
### K6: "Ansprechpartner"-Logik auf Startseite klären
### K7: "Geschlossen"-Status bei Tickets soll Owner-Benachrichtigung auslösen

---

## ✅ Funktioniert verlässlich (kein Handlungsbedarf)
- Login-Flow (über Supabase)
- Schwarzes Brett (lesen, lesen-Tracking, Filter nach Gebäude)
- Dokumente (Übersicht, Vorschau, Download, RLS)
- Logout
- Profil-Ansicht
- RLS-Trennung zwischen Owner-Accounts unterschiedlicher Gebäude
- Mobile-Login + Bottom-Nav

---

## 📋 Vorgehen

**Tag 1 (heute):** B1, B2 angehen
**Tag 2:** B3, B4 angehen
**Tag 3:** W1–W4 angehen
**Tag 4:** Re-Test mit diesem Protokoll, dann Einladungen versenden
**Tag 5:** Puffer

**Mieter werden nicht live genommen.** RLS-Test für Tenant nicht relevant.
