# STATUS.md – HB-Cockpit Live-Gang

> **Pflege:** Ausschließlich von Niko. Claude Code darf lesen, nicht editieren.
> **Letztes Update:** 24.05.2026

---

## 🎯 Ziel
3 Eigentümer onboarden in 3–5 Tagen. Grundfunktionen: Dashboard, Schwarzes Brett, Tickets, Dokumente.

---

## 🔴 BLOCKER – muss vor Live-Gang gefixt sein

### B1: Owner-Dashboard ist leer - ✅ - abgeschlossen
**Symptom:** Eigenes Gebäude fehlt, "Meine Einheit"-Modul zeigt "Demnächst verfügbar", Hausgeld-Saldo ist Strich.
**Impact:** Erster Eindruck katastrophal. Eigentümer sieht nichts Persönliches.
**Status:** Fixed (Neues Feature: iehe Feature F1)

### B2: RLS-Lücke bei "Beschlusssammlung anfordern" ✅ - abgeschlossen
**Symptom:** Owner kann fremde Gebäude in der Auswahl sehen/anfordern.
**Impact:** Datenschutz-Verletzung. Kritisch.
**Status:** Fixed 

### B3: Ticket-Antwort kommt nicht beim Owner an ✅ - abgeschlossen
**Symptom:** Verwalter antwortet → Ticket bleibt im "Gesendet" des Owners. Keine Benachrichtigung. Status-Logik unklar.
**Impact:** Owner glaubt, niemand antwortet. Kernfunktion kaputt.
**Status:** fixed & Logik der Tickets verändert (Siehe CHANGEOG.md "Owner-Sidebar vereinfacht")

### B4: E-Mail-Versand funktioniert nicht ✅ - abgeschlossen
**Symptom:** Brevo verlangt IP-Autorisierung. Keine Mails kommen durch.
**Impact:** keine Ticket-Benachrichtigungen, keine News-Mails.
**Status:** Erledigt
**Hinweis:** Einladungen laufen aktuell über Supabase-Auth-Mails, das funktioniert. Brevo IP Auth deaktiviert

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
### K8: Benachrichtigungen an Verwalter (Mails) checken und optimieren.

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


## 🔵 FEATURES – nach Live-Gang

### F1: Ansprechpartner-System (Owner-Dashboard)
**Ziel:** Das „Mein Ansprechpartner"-Widget zeigt den/die zuständigen Verwalter
(optional zusätzlich Hausmeister und Verwaltungsbeirat) mit vollständigen
Kontaktdaten und Profilbild – als 2–3 Karten nebeneinander.

**Auslöser:** Bei B1 aufgefallen – das Widget war leer. Minimal-Lösung für den
Live-Gang: ein Verwalter-Kontakt wird manuell im Kontaktbuch angelegt und
freigegeben (das Widget liest bereits aus `contacts`, Kategorie „Verwalter").
F1 ist der nachgelagerte Vollausbau, kein Blocker.

**Bausteine:**
1. Profil-Erweiterung für admin/manager: zusätzliche Felder für Kontaktdaten
   (Telefon, Anzeige-E-Mail, Funktion/Bezeichnung) – Migration auf `profiles`.
2. Profilbild/Avatar: neuer Supabase-Storage-Bucket inkl. Policies, Upload-UI
   im Profil, Spalte `profiles.avatar_url`.
3. Auto-Anlage + Sync: beim Anlegen eines admin/manager-Users wird automatisch
   ein verknüpfter `contacts`-Eintrag (Kategorie „Verwalter") erzeugt;
   Profiländerungen werden in den verknüpften Kontakt gespiegelt
   (Link-Spalte auf `contacts` + Sync-Mechanismus nötig).
4. Multi-Card-Widget: Dashboard zeigt 2–3 Karten (Verwalter, Hausmeister,
   optional Verwaltungsbeirat aus `board_members`) inkl. Avatar.

**Vor Umsetzung zu klären:**
- Welche Profil-Felder genau (Telefon, Anzeige-E-Mail, Funktion …)?
- Sync-Richtung & -Mechanismus: DB-Trigger oder clientseitig beim Speichern?
- Wird der auto-angelegte Kontakt automatisch freigegeben (`is_released`)?
- Verwaltungsbeirat als 3. Karte aufnehmen?
- Hinweis: Baustein 2 berührt Storage-Policies → CLAUDE.md §8 Regel 1, bei
  Umsetzung explizit freigeben.

**Status:** offen – Backlog, Start nach Abschluss der Blocker/Wichtig-Punkte

### F2: Hausgeld-Historie — automatische Erfassung bei WP-Freigabe

**Ziel:** Hausgeld-Beträge je Einheit werden historisch gespeichert, sodass
Eigentümer und Verwaltung nachvollziehen können, wie sich das Hausgeld über
die Jahre entwickelt hat. Bei der finalen Freigabe eines Wirtschaftsplans
werden die berechneten Beträge automatisch in `hausgeld_history` eingetragen.

**Auslöser:** Bei der Hausgeld-Kachel (B1) aufgefallen – `getMonthlyHausgeld()`
berechnet den Betrag live aus dem aktiven WP, schreibt aber nichts in die
bereits vorhandene Tabelle `hausgeld_history`. Sobald ein neuer WP aktiviert
wird, ist der Vorgänger-Betrag nirgendwo mehr abrufbar. `apartments.hausgeld`
(manueller Fallback) wird durch den WP nicht aktualisiert und driftet deshalb
über Zeit vom realen Betrag ab.

**Bausteine:**
1. **Eintrag bei WP-Freigabe:** Wenn ein Wirtschaftsplan auf `status = 'active'`
   gesetzt wird, `getMonthlyHausgeld()` für jede Einheit des Gebäudes aufrufen
   und das Ergebnis als neuen Datensatz in `hausgeld_history` schreiben
   (Spalten: `apartment_id`, `building_id`, `amount`, `valid_from` aus
   `budget_plans.valid_from`, `source = 'budget_plan'`, `plan_id`).
2. **`apartments.hausgeld` synchron halten:** Nach dem Eintrag in die History
   den berechneten Betrag auch in `apartments.hausgeld` schreiben, damit der
   Fallback immer dem zuletzt freigegebenen WP-Wert entspricht.
3. **Kachel-Erweiterung:** „Gültig ab"-Zeile könnte zusätzlich einen Tooltip
   oder Link zur History bekommen (z. B. „Zuletzt: 210,00 € (2025)").
4. **Manueller Eintrag:** Optional – Admin kann `hausgeld_history` manuell
   befüllen (z. B. für Jahre vor Systemeinführung) ohne einen WP zu hinterlegen.

**Vor Umsetzung zu klären:**
- Wo genau im WP-Flow wird „final freigegeben" ausgelöst — Button im Finanzen-Modul?
- Soll der History-Eintrag per DB-Trigger oder clientseitig beim Status-Update geschrieben werden?
- Was passiert, wenn ein WP re-aktiviert wird (Duplikat-Eintrag)?
- Welche Spalten hat `hausgeld_history` aktuell — reicht das Schema oder braucht es eine Migration?

**Status:** offen – Backlog, Start nach Abschluss der Blocker/Wichtig-Punkte


