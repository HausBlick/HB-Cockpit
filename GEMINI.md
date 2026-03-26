Dieses Dokument ist die "Single Source of Truth" für das strategische Gesamtkonzept, die Vision und alle geplanten Workflows.

🤖 KI-Protokoll: Workflow für Gemini & Claude

Dieses Projekt nutzt eine extrem token-effiziente **Drei-Datei-Architektur** zur asynchronen Steuerung der KIs:

1. **GEMINI.md (Das Master Manifest):** Enthält das strategische Konzept, die Vision und die Umsetzungs-Pakete. 
   - **Regel für Gemini:** Pflegt diese Datei, führt das Update-Log.
   - **Regel für Claude:** Darf diese Datei *niemals* verändern. Liest sie nur zu Beginn eines neuen Pakets (und prüft nur den Update-Log, um Tokens zu sparen).

2. **CLAUDE.md (Das Technische Logbuch):** Enthält den exakten technischen Ist-Zustand (DB-Schema, JS-Module, Changelog).
   - **Regel für Claude:** Pflegt diese Datei nach jedem erfolgreichen Commit zwingend.
   - **Regel für Gemini:** Liest diese Datei nur, wenn technischer Kontext für ein neues Konzept zwingend nötig ist.

3. **BRIEFING.md (Der Kommunikations-Kanal):** Lokale Datei für den direkten, token-sparenden Austausch (Fragen, Antworten, Fehler-Reports) zwischen Projektadmin (Niko), Gemini und Claude.
   - **Der Workflow:** Anstatt riesige Chat-Verläufe in die Prompts zu kopieren, schreibt der Admin (oder eine der KIs) Fragen, Feedback oder Teil-Briefings in diese Datei. Die angesprochene KI liest *nur* diese Datei, erledigt den Task, und dokumentiert die Antwort ebenfalls dort oder leert sie wieder. Das spart massive Kontext-Tokens!

0. Update-Log

- **Übergabe-Paket hinzugefügt (6.9-B):** Jahresabrechnung PDF-Export — Anschreiben (Seite 1) + Einzelabrechnung (Seite 2), orientiert am Einzelwirtschaftsplan-Design.
- **feat(arch): native Sonderrollen (landlord/advisory) & Finanz-Klassifizierung (Paket 8.1):** Erweiterung des Rollenmodells und Einführung des is_allocatable-Flags.
- **Workflow-Update (Prompt-Kette):** Einführung des "Cowork-Claude -> Gemini CLI -> Claude Code"-Workflows. Gemini validiert das Konzept, schreibt lokal in die BRIEFING.md und generiert einen fertigen Copy-Paste-Prompt für Claude Code am Ende jeder Antwort.
- **Workflow-Update (Drei-Datei-Architektur):** Einführung der lokalen `BRIEFING.md` als token-effizienter Kommunikationskanal zwischen den KIs und dem Admin hinzugefügt. Das KI-Protokoll wurde entsprechend angepasst.
- **Übergabe-Paket hinzugefügt (6.10):** Neues Paket für Verteilerschlüssel-Management, HeizKV-Splits und Einzelwirtschaftspläne am Ende des Dokuments zur Umsetzung hinterlegt. Empfehlungen aus dem Briefing (Client-Side PDF-Generierung, Initialbefüllung der System-Schlüssel) wurden als Anweisung für Claude integriert.
- **Konzept-Erweiterung (Finanzen):** Einzelwirtschaftsplan inkl. PDF-Design und Bulk-Generierung (Master-PDF in einem Rutsch) als Teil der Verteilerschlüssel-Logik in Modul 4 hinzugefügt.
- **Übergabe-Paket hinzugefügt:** Detaillierte Anforderungen für Admin-Einstellungen (7.1) und Official Letter Engine (6.9) am Ende des Dokuments zur Umsetzung für Claude hinterlegt.
- **Frontend-Rahmenbedingungen hinzugefügt:** Strikte Vorgaben für Design-Konsistenz (Vermeidung von Wildwuchs), Mobile-First "App-Feeling" und PWA-Readiness etabliert.


1. Vision & Zielsetzung

Die Vision: Schaffung einer radikal einfachen, hochgradig automatisierten und rechtssicheren Cloud-Plattform, die Hausverwaltungen, Eigentümer und Mieter in einem einzigen, digitalen Ökosystem ("Single Point of Truth") vereint.

Kerneigenschaften:

GoBD- & WEG-konform: Strikte Einhaltung deutscher Rechtsnormen (Echte doppelte Buchführung, Geldfluss- vs. Leistungsprinzip, WEMoG-Konformität).

Automatisierung first: Eliminierung manueller "Manufaktur-Aufgaben" durch Auto-Naming von Dokumenten, intelligente Sollstellungen und smarte Zuweisungen.

Transparenz: Kaskadierendes Berechtigungssystem, das jedem Akteur (vom Mieter bis zum Verwalter) exakt die relevanten Daten, Dokumente und Finanzen in Echtzeit auf seinem Dashboard präsentiert.

2. Technische Architektur & Stack

Das System ist auf maximale Skalierbarkeit, Sicherheit und Performance ohne unnötigen Overhead ausgelegt:

Backend & Datenbank: Supabase (PostgreSQL 17). Nutzt Row Level Security (RLS) für absolut sichere Mandantentrennung auf Datenbankebene.

Authentifizierung: Supabase Auth (Magic Links, Passwort-Resets, rollenbasierter Zugriff).

Storage: Supabase Storage (Privater Bucket documents mit signierten URLs für sicheren Dokumentenzugriff).

Frontend: Vanilla JavaScript (ES6 Modules), HTML5, Tailwind CSS (via CDN) – keine schweren Frameworks, extrem schnelle Ladezeiten.

Hosting: GitHub Pages (Continuous Deployment aus dem main-Branch).

Das Design-System & Frontend-Rahmenbedingungen

Minimalistisch, fokussiert und professionell. Um "Wildwuchs" zu vermeiden, gelten strikte Design-Vorgaben für alle Module:

CI-Farben: hb-olive (#687451) für Aktionen/Primäres, hb-ultralight (#F9FAF8) als Hintergrund, hb-offblack (#373737) für Typografie und hb-signalorange (#EB762D) Für extreme Aufmerksamkeit und
wichtige Hinweise/Akzente. Keine Fremdfarben!

Konsistenz-Zwang: Alle Module müssen exakt dieselbe Formensprache (Weiche UI-Karten `rounded-[15px]`, identische Tabellen, einheitliche Button-Styles) nutzen.

Mobile First & App-Feeling: Die mobile Ansicht ist keine zweitrangige Web-Ansicht, sondern muss sich wie eine native App anfühlen (Sticky-Header, flüssige Swipe-Menüs, gut greifbare Touch-Zonen).

PWA-Ready: Das Portal wird als Progressive Web App (PWA) konzipiert, sodass Nutzer es sich als "echte App" auf ihr Smartphone (iOS/Android) herunterladen und auf dem Homescreen ablegen können.

3. Rollen & Berechtigungskonzept (Die Kaskade)

Das System steuert Sichtbarkeiten und Funktionen strikt hierarchisch über definierte Haupt- und Sonderrollen:

Verwalter (admin):

Status: Super-Admin (Geschäftsführer/Inhaber).

Rechte: Vollzugriff auf alle Gebäude, Einheiten, Finanzen und globalen Einstellungen.

Fokus: Steuerung des Gesamtunternehmens und Hauptkommunikation zu den Eigentürmern.

Objektverwalter (manager):

Status: Mitarbeiter der Hausverwaltung.

Rechte: Identische Admin-Rechte, jedoch strikt limitiert auf zugewiesene Objekte.

Fokus: Laufendes operatives Geschäft, Einstellungen für eigene Objekte und Betreuung der dortigen Eigentümer.

Eigentümer (owner):

Status: Primärer Kunde der Hausverwaltung.

Rechte: Einsicht in alle WEG-relevanten Dokumente (Abrechnungen, Protokolle), Finanz-Dashboards und Stammdaten der eigenen Einheiten. Kommunikation mit admin/manager.

Sonderrolle 3.1: Verwaltungsbeirat (advisory): Von der Verwaltung ernannte owner mit erweiterten Prüfrechten (Belegprüfung, Auftragsfreigabe).

Sonderrolle 3.2: Vermieter (landlord): owner, die vermieten. Dürfen Mieter anlegen, Dokumente durchreichen und mit Mietern über Tickets kommunizieren.

Mieter (tenant):

Status: Endnutzer / Bewohner.

Rechte: Lesezugriff auf technische Details der Einheit, das Kontaktbuch und vom landlord freigegebene Dokumente. Ticket-Kommunikation mit dem Vermieter.

4. Die Kernmodule (Funktionaler Scope)

Modul 1: CRM & Gebäude-Management (Das Fundament)

Internes CRM (Globales Adressbuch): Zentrale Verwaltungs-Datenbank (persons) für alle Akteure. Keine Dubletten. Nur für admin und manager.

Nutzer-Onboarding: Workflow zur Einladung neuer Nutzer via E-Mail oder PDF-Brief (Registrierungscode).

Objekt-Struktur & Historisierung: Tiefe Verknüpfung Gebäude ➔ Einheiten. Tagesgenaue Erfassung (Start/Enddatum) von Verträgen für Pro-rata-temporis-Abrechnungen.

Objekt-Onboarding: Wizard zur Übernahme neuer WEGs (Eröffnungsbilanz, Alt-Salden, Rücklagen).

Wartungsvertrags- & Schlüsselverwaltung: Fristenüberwachung von Dienstleistern und Lückenlose Dokumentation der Schließanlage.

Modul 2: Kommunikation & Service

Schwarzes Brett (Info-Kaskade): Verwalter postet globale/objektspezifische News. Vermieter können diese an Mieter durchreichen oder eigene News erstellen.

Massen-E-Mail: Serienbrieffunktion für schnelle Text-Infos an alle Bewohner eines Objekts.

Ticket-System (Helpdesk & Routing): Zammad-Style Helpdesk. Strikte Trennung "Gesendet" / "Erhalten". Eskalationslogik (tenant ➔ landlord ➔ manager).

Auftragsmanagement: Generierung von offiziellen "Auftrags-PDFs" für Handwerker direkt aus einem Ticket heraus.

Dienstleister-Verzeichnis: Externes Kontaktbuch für Bewohner inkl. Notfall-Badges und Disclaimer.

Modul 3: Dokumenten-Cloud & ETV-Management

Staging & Auto-Naming: Hochgeladene/generierte Dokumente werden standardisiert benannt und landen im "Staging"-Bereich.

Striktes Zero-Auto-Publish & Bulk-Release: Kein Dokument ist sofort öffentlich. Zwingende explizite Freigabe (ggf. als Massen-Freigabe z.B. für 150 Abrechnungen).

Das Mieter-Silo: Der Mieter sieht ausschließlich Dokumente, die aktiv von seinem Vermieter hochgeladen/durchgereicht wurden. Kein Zugriff auf WEG-Interna.

Personenbezogene Dokumente: Gezielte Zuweisung an eine Person (statt Einheit) inkl. Benachrichtigung.

Automatisierte ETV-Dokumente & Beschlusssammlung: Generierung von ETV-Einladungen/Protokollen. Automatische Führung der gesetzlichen Beschlusssammlung (§ 24 Abs. 7 WEG).

Digitale Umlaufbeschlüsse: Tool für rechtsgültige, asynchrone Online-Abstimmungen (§ 23 Abs. 3 WEG).

Modul 4: Finanzen & Abrechnung (Das Herzstück)

Echte Doppik & Kontenrahmen: GoBD-konformes Journal. Strikte Kategorisierung der Konten in "umlegbar" (Betriebskosten für Mieter) und "nicht umlegbar" (Verwaltergebühren, Instandhaltung, Rücklagenzuführung). Das ist die zwingende Basis für die spätere Nebenkostenabrechnung der Vermieter.

Objektspezifische Verteilerschlüssel & Einzelwirtschaftspläne: Dynamische Anlage und Verwaltung individueller Schlüssel pro Gebäude (z.B. Verteilung nach speziellen Wasserzählern, Miteigentumsanteilen, Wohnfläche oder festen Beträgen). Darauf aufbauend: Automatische Generierung von Einzelwirtschaftsplänen pro Eigentümer/Einheit inkl. PDF-Design und Bulk-Generierung (Konfiguration, Erzeugung und Zusammenführung in ein einziges Master-PDF in einem Rutsch).

Automatischer Zahlungsabgleich (Banking): Matching von Bankumsätzen zu offenen Sollstellungen.

Zählerstands-Management: Erfassungsmaske für Ablesewerte (Stichtage, Mieterwechsel).

Rücklagen-Cockpit: Sub-Modul zur strikten Führung der Erhaltungsrücklage getrennt vom Hausgeldkonto.

Die Abrechnungen: Wizards inkl. HeizkostenV und §35a EStG. Das System trennt bei der Ausweisung automatisch die umlegbaren von den nicht umlegbaren Kosten.

Official Letter Engine: Erstellung von Abrechnungen, Plänen und Mahnungen als rechtssicheres PDF mit Briefkopf.

Mahnwesen & DATEV-Export: 3-stufiger Mahnlauf und CSV-Export für Steuerberater.

Modul 5: Rollenspezifische Dashboards & UX

Das Mieter-Dashboard (tenant): Quick-Actions, "Mein Ansprechpartner", Tickets, aktuelle Miete & Zahlungsart, Gebäude-Kalender und Dokumente vom Vermieter.

Das Eigentümer-Dashboard (owner): Hausgeld-Saldo, WEG-News, ETV-Termine, Ticket-Routing.

Vermieter (landlord): Zusatz-Widget "Meine Mieter" inkl. Mieter-Tickets.

Beirat (advisory): Zusatz-Widget für digitale Belegprüfung und Auftragsfreigabe.

Das Verwalter-Dashboard (admin/manager): Leitstand. Prioritäts-Tickets, Staging-Freigaben, ablaufende Compliance-Fristen, überfällige Forderungen.

5.4 In-App Hilfe & Onboarding: Jedes Kernmodul besitzt ein kontextbezogenes "Fragezeichen-Symbol". Klickt der User darauf, öffnet sich eine kurze Dokumentation/Guided-Tour, die ihm die Funktionen und Workflows dieses Bereichs erklärt.

Modul 6: System, Einstellungen & Benachrichtigungen

Admin-Einstellungen (Portal-Config): Globale Konfiguration durch den admin.

Hinterlegung von Firmenanschrift, Steuernummer, Logo und offiziellem PDF-Briefkopf.

Definition von Standard-Werten (z.B. Höhe der Standard-Mahngebühr, Basiszins).

E-Mail-Benachrichtigungssystem: Automatischer Push-Service, um Nutzer ins Portal zu holen.

Trigger: E-Mail-Versand bei neuen Tickets, Statusänderungen in Tickets, neu freigegebenen Dokumenten oder neuen Beiträgen am Schwarzen Brett.

Nutzer-Einstellungen (User Profile): Jeder User (admin bis tenant) hat ein Profil-Menü.

Ändern von Passwort und persönlichen Login-Daten.

Notification Opt-Ins: Individuelle Einstellung, worüber der Nutzer per Mail informiert werden möchte (z.B. "Keine E-Mails bei News-Updates", "Sofortige E-Mail bei neuen Tickets").

System-Logs (Audit Trail): Eine für den Admin sichtbare, revisionssichere Historie aller systemkritischen Aktionen (Wer hat wann welches Konto gelöscht oder eine Abrechnung freigegeben?).

5. Zukunfts-Vision & Ausblick (Phase 7+)

Das System ist darauf ausgelegt, mit den Marktanforderungen zu wachsen:

Nebenkostenabrechnung (Vermieter-Erweiterung): Modul für den landlord. Das System zieht die umlegbaren Betriebskosten direkt aus der WEG-Abrechnung vor. Der Vermieter ergänzt mieterspezifische Kosten (z.B. Grundsteuer) und generiert per Knopfdruck eine Nebenkostenabrechnung als PDF.

Digitale Versammlungen: Hybride ETVs (Video-Integration) im Portal.

KI-Buchhaltung: KI-gestützte Belegerfassung (OCR) für automatische Buchungsvorschläge.

API-Schnittstellen: Automatischer Datenabruf bei Techem, Ista & Co.

---

[UMSETZUNGS-ÜBERGABE FÜR CLAUDE]

## Paket: Admin-Einstellungen (7.1) & Official Letter Engine (6.9)

### 1. Ziel
Die Hausverwaltung benötigt die Möglichkeit, ihre Unternehmens-Stammdaten (Logo, Firmenanschrift, rechtliche Angaben) zentral zu verwalten. Darauf aufbauend muss eine "Official Letter Engine" geschaffen werden, die in der Lage ist, aus den Daten des Finanzmoduls (Abrechnungen, Mahnungen, Pläne) rechtssichere PDFs mit dem offiziellen Briefkopf der Verwaltung zu generieren. Dies ist die zwingende Voraussetzung für den produktiven Einsatz der Finanzen.

### 2. Anforderungen
**A) Admin-Einstellungen (Modul `mod-settings.js`):**
- **Zugriff:** Nur für die Rolle `admin`.
- **Daten:** Erfassung von Firmenname, Straße, PLZ/Ort, Telefon, E-Mail, Website, Steuernummer, HRB, Geschäftsführer.
- **Finanz-Defaults:** Festlegen von Standard-Werten wie `Standard-Mahngebühr` (z.B. 5,00 €) und `Basiszins` (z.B. 3,37%).
- **Uploads:** Möglichkeit, ein Firmen-Logo (z.B. für das Portal-Header-Fallback) und ein offizielles Briefbogen-Hintergrund-PDF (A4) hochzuladen.

**B) Official Letter Engine (`utils-pdf.js` oder in `mod-finanzen.js` integriert):**
- **Client-Side PDF-Generierung:** Nutzung einer bewährten Library (z.B. `jspdf` via CDN) um die Serverkosten gering zu halten.
- **Briefkopf-Integration:** Das System muss das vom Admin hochgeladene Briefbogen-PDF (oder eine generierte Kopf-/Fußzeile aus den Stammdaten) als Basis-Ebene für jedes Dokument nutzen.
- **Adressfeld:** Exakte Positionierung des Empfänger-Adressfelds für Standard-DIN-Fensterbriefumschläge.
- **Erste Use-Cases (MVP):** 
  - Generierung einer Mahnung (aus `dunning_notices`).
  - Generierung eines Wirtschaftsplans (`budget_plans`).

### 3. DB-Änderungen (Supabase)
- **Neue Tabelle `global_settings`:** (Oder Nutzung einer single-row table). Sollte Spalten für die Firmenstammdaten und Finanz-Defaults enthalten. RLS: Read für `admin/manager/owner/tenant`, Update nur für `admin`.
- **Storage-Bucket Erweiterung:** Anpassung der Storage-Policies oder Schaffung eines speziellen Ordners in einem Bucket (z.B. `public_assets` oder im bestehenden `documents` Bucket) für das Logo und das Briefbogen-PDF.

### 4. UI-Vorgaben
- **Neues Navigations-Element:** "Einstellungen" (nur für Admins sichtbar, idealerweise unten in der Sidebar platziert).
- **Settings-Dashboard:** Aufgeteilt in klare Sektionen (Cards) -> "Unternehmensdaten", "Finanz-Standardwerte", "Briefpapier & Logo". Einhaltung der strikten `hb-olive` Formensprache (`rounded-[15px]`).
- **PDF-Generierung:** Die Erzeugung der PDFs sollte über einen Button in den entsprechenden Finanz-Tabs (z.B. "Mahnung als PDF herunterladen") ausgelöst werden, idealerweise mit einem Loading-Spinner, da die PDF-Generierung kurz dauern kann.

### 5. Offene Entwickler-Entscheidungen (Claude)
- **PDF-Library:** Entscheidung für eine leichtgewichtige Client-Side PDF Library, die gut via CDN funktioniert und idealerweise ein bestehendes PDF als Hintergrund (Template) laden kann. (Empfehlung prüfen: `pdf-lib` oder `html2pdf.js`).
- **Speicherung Settings:** Soll `global_settings` eine Tabelle mit exakt einer Zeile (ID=1) sein, oder ein Key-Value Store? (Eine strukturierte Single-Row-Tabelle ist für Typisierung oft robuster).

---

[UMSETZUNGS-ÜBERGABE FÜR CLAUDE]

## Paket: Verteilerschlüssel-Management & Einzelwirtschaftspläne (6.10)

### 1. Ziel
Einführung einer WEMoG-konformen Verwaltung von Verteilerschlüsseln pro Gebäude. Dies ist die gesetzliche Basis (§ 16 WEG), um Gemeinschaftskosten auf die Einheiten umzulegen. Darauf aufbauend soll die "Official Letter Engine" befähigt werden, Einzelwirtschaftspläne (inkl. Briefkopf-Integration) als Bulk-PDF für alle Einheiten eines Gebäudes in einem Rutsch zu generieren.

### 2. Anforderungen
- **Schlüssel-Typen:** Das System unterscheidet zwischen "System-Schlüsseln" (7 feste Standardtypen: MEA voll, MEA Wohnen, MEA ohne Garage, Anzahl Einheiten, Wohnfläche, Verbrauch, Festbetrag) und "Benutzerdefinierten Schlüsseln" (frei benennbar).
- **Zuweisung:** Jede Einheit in einem Gebäude bekommt einen numerischen Anteilwert (Value) für jeden konfigurierten Schlüssel zugewiesen. Die Summe aller Anteile muss der "Gesamtumlage" entsprechen.
- **Konten-Verknüpfung:** Jedes Finanzkonto (Aufwände/Rücklagen) in einem Gebäude muss mit einem "Primären Schlüssel" verknüpft werden.
- **HeizKV-Split:** Für Heizkosten muss ein "Doppelschlüssel" (Primär- + Sekundärschlüssel inkl. %-Split, z.B. 60% Verbrauch / 40% Wohnfläche) unterstützt werden.
- **Umlagefähigkeit:** In der Anzeige der Pläne müssen Kosten zwingend in "umlagefähig" (für Mieter) und "nicht umlagefähig" unterteilt werden.
- **PDF-Generierung (Einzelwirtschaftsplan):** Nutzung des bestehenden Briefbogens (`letterhead_url` aus `global_settings`) als Hintergrund. Dynamische Befüllung der Adressfelder, des Schlüssels, der Anteile und Kosten. Generierung aller Pläne eines Gebäudes als ein einziges, zusammenhängendes Master-PDF (Bulk-Export).

### 3. DB-Änderungen (Supabase)
- **Tabelle `distribution_keys`:** `id`, `building_id` (FK), `name`, `type` (enum), `total_value` (numeric), `is_system_default` (boolean).
- **Tabelle `distribution_key_units`:** `id`, `distribution_key_id` (FK), `apartment_id` (FK), `value` (numeric). Unique Constraint auf (key_id, apartment_id).
- **Änderung an `accounts`:** Hinzufügen von `primary_key_id` (UUID), `secondary_key_id` (UUID) und `secondary_key_percentage` (numeric 5,2).
- **Initial-Trigger:** Beim Erstellen eines Gebäudes sollten die 7 System-Schlüssel automatisch via Supabase Function (oder im Client) mit leeren Werten angelegt werden.

### 4. UI-Vorgaben
- **Neuer Tab "Verteilerschlüssel":** Im Gebäude-Detail (`mod-objekte.js`). Übersichtstabelle der Schlüssel. Ein Klick auf einen Schlüssel öffnet eine Tabelle aller Einheiten zur Eingabe der individuellen Anteile.
- **Live-Validierung:** In der Einheiten-Ansicht muss unten eine Live-Summe stehen (z.B. "Summe: 950 / 1000"). Rot bei Abweichung, Grün bei Übereinstimmung.
- **Konten-Verknüpfung:** In `mod-finanzen.js` (Tab Übersicht) Dropdowns für die Schlüsselzuweisung je Konto hinzufügen. Checkbox für "HeizKV-Split" toggelt das zweite Dropdown.
- **Design:** Strikte Einhaltung der HB-Olive CI (`rounded-[15px]`, `divide-hb-olive/10`).

- **PDF-Generierung:** Bitte bleibe konsequent bei der Client-Side Generierung via **`pdf-lib`** (Option B aus dem Briefing), um den Serverless-Charakter beizubehalten. Lade das Admin-Briefbogen-Bild aus dem Storage und lege es als Layer unter den Text.
- **Historisierung:** Keine komplexe Tabellen-Historisierung (valid_from/to) implementieren! Es reicht, wenn die errechneten Werte in den final erzeugten Buchungen oder PDFs (Snapshots) als fixer Wert eingefroren werden. Leerstände werden berechnet (Eigentümer zahlt).

---

[UMSETZUNGS-ÜBERGABE FÜR CLAUDE]

## Paket: Sonderrollen-Architektur (8.1) & Finanz-Klassifizierung

### 1. Ziel
Erweiterung des Rollenmodells um `landlord` (Vermieter) und `advisory` (Beirat) als native Rollen in der `profiles`-Tabelle. Gleichzeitig Einführung des `is_allocatable`-Flags für Konten, um die Basis für die spätere Nebenkostenabrechnung zu schaffen.

### 2. Anforderungen
**A) Rollen-Erweiterung (`profiles.role`):**
- Registrierung der Rollen `landlord` und `advisory` im System.
- Dashboard-Logik: 
  - `landlord`: Erhält Zugriff auf das "Meine Mieter"-Widget (Platzhalter in `mod-dashboard.js` aktivieren).
  - `advisory`: Erhält Lesezugriff auf Finanzbelege und das "Beirat"-Widget.
- Navigation: Anpassung von `nav.js`, sodass Landlords ihre Mieter und Dokumente sehen, Beiräte die erweiterten Finanz-Tabs.

**B) Finanz-Erweiterung (`accounts`):**
- Jedes Konto muss via `is_allocatable BOOLEAN` als "umlagefähig" (für die Betriebskostenabrechnung relevant) oder "nicht umlagefähig" markiert werden können.

**C) RLS-Updates:**
- `landlord`: Darf Dokumente für seine zugewiesenen Einheiten (`apartments`) "freigeben" (durchreichen an Mieter).
- `advisory`: Darf alle Datensätze in `ledger`, `invoices` und `bank_transactions` des jeweiligen Objekts lesen (basierend auf `board_members` Verknüpfung).

### 3. DB-Änderungen (Supabase SQL)
- **Rollen-Update:** Anpassung des Check-Constraints auf `profiles.role` (admin, manager, owner, tenant, landlord, advisory).
- **Konten-Update:** `ALTER TABLE accounts ADD COLUMN is_allocatable BOOLEAN DEFAULT false;`
- **RLS-Anpassung:** Neue Policies für die Rollen `landlord` (fokussiert auf eigene Mieter/Einheiten) und `advisory` (objektweiter Lesezugriff Finanzen).

### 4. UI-Vorgaben
- **Konten-Verwaltung (`mod-finanzen.js`):** Checkbox "Umlagefähig (Betriebskosten)" in Edit-Maske.
- **Personen-Edit (`mod-persons-edit.js`):** Dropdown-Erweiterung für die neuen Rollen.
- **Dashboard (`mod-dashboard.js`):** Aktivierung der Rollen-spezifischen Widgets.
- **Navigation (`nav.js`):** Sichtbarkeits-Logik für neue Menüpunkte.

---

[UMSETZUNGS-ÜBERGABE FÜR CLAUDE]

## Paket: Jahresabrechnung PDF-Export (6.9-B / Phase 6-D.2)

### 1. Ziel
Erweiterung der `Official Letter Engine` um den PDF-Export der Jahresabrechnung (Hausgeldabrechnung). Das PDF soll professionell gestaltet sein und sich am Design des Einzelwirtschaftsplans (`generateEinzelwirtschaftsplanPDF`) orientieren. Das MVP umfasst ein formelles Anschreiben (Seite 1) und die detaillierte Einzelabrechnung (Seite 2).

### 2. Anforderungen
**A) Seite 1: Das Anschreiben (Cover Letter)**
- **Adressfeld:** DIN-konforme Positionierung des Empfängers (aus `ownerships` & `persons`).
- **Betreff:** "Hausgeldabrechnung für das Jahr [Jahr]" in Fett.
- **Inhalt:** Personalisierte Anrede, kurzer Erläuterungstext zum Ergebnis der Abrechnung (Nachzahlung/Guthaben) und Hinweis auf die anstehende Beschlussfassung.
- **Ergebnis-Highlight:** Ein markanter Block (z.B. mit leichtem Olive-Hintergrund), der die "Abrechnungsspitze" (Saldo aus tatsächlichen Kosten minus Soll-Vorschüssen) klar ausweist.

**B) Seite 2: Die Einzelabrechnung (Detail-Ansicht)**
- **Kopfbereich:** Identisch zum Wirtschaftsplan (Titel, Objekt-Info, Eigentümer-Info-Box).
- **Zusammenfassungs-Tabelle:** 
  - Gesamtkosten der Einheit
  - Hausgeld-Vorschüsse (Soll)
  - Hausgeld-Vorschüsse (Ist) — optional/Info
  - Abrechnungsspitze (Ergebnis)
- **Verteilungstabelle:** Aufschlüsselung aller Konten mit:
  - Konto-Nr. & Bezeichnung
  - Gesamtkosten der WEG
  - Verteilerschlüssel & Anteilswert
  - Ergebnis-Betrag für die Einheit
- **Struktur:** Trennung in "Umlagefähig" (`is_allocatable = true`) und "Nicht umlagefähig" (`is_allocatable = false`).

### 3. Technische Umsetzung
- **Neue Funktion in `utils-pdf.js`:** `generateJahresabrechnungPDF(buildingId, fiscalYear, jabData)`.
- **Datenquelle:** Nutzt die bereits aggregierten Daten aus `_finState.jabData` (erzeugt im Wizard von `mod-finanzen.js`).
- **Infrastruktur:** Nutzung der bestehenden Helper `_pdfLoadInterFonts`, `_pdfDrawAddressField`, `drawPageHeader`, `drawTableHeader` etc.
- **Briefbogen:** Zwingende Nutzung des `letterhead_pdf_url` aus `global_settings` als Hintergrund-Layer.

### 4. UI-Vorgaben
- **Trigger:** Button "Abrechnung als PDF exportieren" in Schritt 5 (`_finJABStep5Html`) des Abrechnungs-Wizards hinzufügen.
- **Bulk-Option:** Integration in die "Staging-Freigabe" (später), vorerst als Einzel-Export pro Einheit oder als Gesamt-PDF für alle Einheiten des Objekts (Bulk-Export analog zum Wirtschaftsplan bevorzugt).

### 5. Offene Entwickler-Entscheidungen (Claude)
- **Datenübergabe:** Da `_finState.jabData` eine flüchtige Variable im Frontend-Modul ist, sollte die PDF-Funktion entweder direkt darauf zugreifen oder eine saubere Schnittstelle erhalten, die alle nötigen Summen pro Einheit bereits vorbereitet bekommt.
- **Bulk-Handling:** Soll beim Klick auf "Export" ein PDF mit allen Einheiten (getrennt durch Seitenumbrüche) generiert werden? (Empfehlung: Ja, analog zum Wirtschaftsplan).

---
