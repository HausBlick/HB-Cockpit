Dieses Dokument ist die "Single Source of Truth" für das strategische Gesamtkonzept, die Vision und alle geplanten Workflows.

🤖 KI-Protokoll: Workflow für Gemini & Claude

Anweisung an Claude Code (Terminal) & Gemini (Gemini CLI):
Dieses Projekt nutzt eine Zwei-Datei-Architektur zur Steuerung der KIs:

GEMINI.md (Dieses Dokument): Enthält das strategische Konzept, die Vision, funktionale Anforderungen und die nächsten Umsetzungs-Pakete (Übergaben). Hieran arbeitet der Projektadmin (Niko) immer mit Gemini CLI.
Gemini gibt zu Änderungen immer eine kurze Übersicht über neue Inhalte im Konzeot unter dem Punkt "0. Update-Log", damit Claude immer gleich Sieht, was sich an dem gesamten Konzept geändert hat.

Regel für Claude: Claude liest dieses Dokument, um zu verstehen, was gebaut werden soll und wie die UX gedacht ist. Claude darf dieses Dokument niemals verändern oder löschen.

CLAUDE.md (Technisches Logbuch): Enthält den exakten technischen Ist-Zustand (DB-Schema, Farb-Tokens, implementierte JS-Module, RLS-Policies). Hieran arbeitet der Projektadmin (Niko) immer mit Claude Code.

Regel für Claude: Nach der erfolgreichen Umsetzung eines Pakets aus der GEMINI.md MUSS Claude zwingend das Changelog und den technischen Stand in der CLAUDE.md aktualisieren.

0. Update-Log

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

Fokus: Steuerung des Gesamtunternehmens und Hauptkommunikation zu den Eigentümern.

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
