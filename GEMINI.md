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

- **feat(ui): Phase 1C (Mobile-Audit & Responsive Patterns) abgeschlossen:** Systemweites App-Feeling etabliert inkl. Bottom-Nav, Bottom-Sheets, Swipe-to-Dismiss, Skeleton-Loading und responsiver Umwandlung von 31 Tabellen in Mobile Cards.
- **feat(etv): ETV-Begleiter Modul (Phase 7):** Vollständige Implementierung der digitalen Eigentümerversammlung inkl. TOP-Planer, Live-Quorum-Prüfung (MEA-basiert) und PDF-Protokoll-Generierung. Tief vernetzt mit Stammdaten (apartments/ownerships).
- **Bugfix (6.9-C):** Jahresabrechnung PDF & Wizard — Korrektur doppelter Header, Seitenränder Anschreiben, Read-Only-Status für Umlageschlüssel und Anzeige von Guthaben im Wizard-Abschluss.
- **feat(time): Modul Zeiterfassung & Projekte (asynchrones Unterprojekt):** Einführung eines neuen Moduls zur projektbezogenen Zeiterfassung inkl. Arbeitspaketen, Live-Timer und PDF-Arbeitsrapport (Dokumentation am Ende der GEMINI.md hinzugefügt).
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

Das System ist auf maximale Skalierbarkeit, Sicherheit und Performance ohne unnögigen Overhead ausgelegt:

Backend & Datenbank: Supabase (PostgreSQL 17). Nutzt Row Level Security (RLS) für absolut sichere Mandantentrennung auf Datenbankebene.

Authentifizierung: Supabase Auth (Magic Links, Passwort-Resets, rollenbasierter Zugriff).

Storage: Supabase Storage (Privater Bucket documents mit signierten URLs für sicheren Dokumentenzugriff).

Frontend-Architektur (Verwalter): Aufteilung des monolithischen Dashboards. Das `dashboard.html` (Startseite/Workspace, Tickets, Schwarzes Brett, Kontaktbuch, Kalender, CRM, Gebäude & Einheiten, Globale Einstellungen) bildet das Zentrum. Komplexe Tools (Finanzen, ETV, Zeiterfassung, Dokumentencloud) öffnen sich als separate HTML-Seiten. Deep-Linking (z.B. `?building=17`) verknüpft die Ansichten.
Frontend (Basis): Vanilla JavaScript (ES6 Modules), HTML5, Tailwind CSS (via CDN) – keine schweren Frameworks. Das Mieter/Eigentümer-Dashboard bleibt als schlanke SPA unverändert.

Hosting: GitHub Pages (Continuous Deployment aus dem main-Branch).

Das Design-System & Frontend-Rahmenbedingungen

Minimalistisch, fokussiert und professionell. Um "Wildwuchs" zu vermeiden, gelten strikte Design-Vorgaben für alle Module:

CI-Farben: hb-olive (#687451) für Aktionen/Primäres, hb-ultralight (#F9FAF8) als Hintergrund, hb-offblack (#373737) für Typografie und hb-signalorange (#EB762D) Für extreme Aufmerksamkeit und
wichtige Hinweise/Akzente. Keine Fremdfarben!

Konsistenz-Zwang: Alle Module müssen exakt dieselbe Formensprache (Weiche UI-Karten `rounded-[15px]`, identische Tabellen, einheitliche Button-Styles) nutzen.

Mobile First & App-Feeling (High-End Native Patterns): Die mobile Ansicht ist keine zweitrangige Web-Ansicht. Alle Module unterliegen strikten, nativen UI-Regeln:
1. Zwingendes Scroll-Containment und Sticky-Header.
2. Mindestgröße für Touch-Targets (44px).
3. Bottom Navigation: Feste Navigationsleiste unten für die 4-5 wichtigsten Schnellzugriffe.
4. Bottom Sheets & Slide-Ins: Formulare und Menüs öffnen sich von unten (Swipe-Up) oder wischen seitwärts von rechts hinein (wie bei Ordnern in Drive). Ein Klick auf "Zurück" wischt die Ansicht wieder flüssig nach rechts heraus. Keine zentrierten Desktop-Modals mehr.
5. Skeleton Loading: Ladezeiten werden mit grauen Platzhaltern überbrückt, nicht mit Ladekreisen.
6. Mobile Cards statt Tabellen: Komplexe Tabellen werden auf dem Smartphone automatisch in klickbare Karten untereinander umgewandelt.

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

PDF-Vorlagen-System (Template-Engine): Ein datenbankgestütztes Template-System (Block-basiert, JSON-Struktur) für **alle** System-PDFs, um Texte ohne Code-Eingriffe gebäudeübergreifend anzupassen. 
- **Blöcke:** Text (mit Formatierung), Variablen/Platzhalter (z.B. `{{abrechnungssaldo}}`), Tabellen-Datenbindung (definiert Position der Berechnungen), Hinweis-Boxen und Abstandhalter.
- **Layout-Kontrolle:** Möglichkeit, gezielte Seitenumbrüche einzufügen (z.B. Trennung von Anschreiben und Abrechnung).
- **Briefkopf-Logik (Header-Toggle):** Pro Seite kann individuell gesteuert werden, ob der offizielle Briefkopf/Header angezeigt werden soll oder nicht (z.B. Header nur auf Seite 1).
- **Verwaltung:** Alles läuft über einen Drag&Drop Block-Editor direkt in den Admin-Einstellungen.

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

UX-Verbesserung Wirtschaftsplan & Abrechnungen (Visueller Workflow): Weiterentwicklung insbesondere des Wirtschaftsplans mit Fokus auf intuitive, moderne UX. Der Haupt-Schmerzpunkt "Blindflug bis zur PDF-Generierung" wird gelöst: Das System soll einen WYSIWYG-Ansatz (What You See Is What You Get) oder eine Live-Preview bieten, sodass man während der Eingabe der Daten direkt visuell kontrollieren kann, wie das finale Dokument/Ergebnis aussehen wird, ohne den kompletten Wizard durchlaufen und ein Test-PDF generieren zu müssen.

KI-Buchhaltung: KI-gestützte Belegerfassung (OCR) für automatische Buchungsvorschläge.

API-Schnittstellen: Automatischer Datenabruf bei Techem, Ista & Co.
I-Schnittstellen: Automatischer Datenabruf bei Techem, Ista & Co.
