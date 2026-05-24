# CHANGELOG.md – HB-Cockpit

> Append-only Projekt-Tagebuch. Aus der alten CLAUDE.md (Abschnitt 12) ausgelagert am 24.05.2026.
> Neue Einträge oben anhängen. Jede Änderung mit Datum, Modul, Beschreibung.
> **Hinweis Claude Code:** Diese Datei wird nicht automatisch in den Kontext geladen. Nur lesen, wenn historischer Kontext gefragt ist.

---

### feat(tickets): B3 — Antwort-Benachrichtigung und Gelesen-Tracking (2026-05-24)

**Module:** Migration `ticket_reads`, Edge Function `send-notification`, `mod-tickets.js`
**Feature:**
- Neue Tabelle `ticket_reads` (user_id, ticket_id, last_read_at) mit RLS: jeder User sieht/schreibt nur eigene Zeilen.
- Edge Function: neuer Typ `ticket_reply` — benachrichtigt die Gegenseite (creator ↔ assigned_to), fetch Titel aus DB, kein Versand wenn Gegenpartei fehlt.
- `sendTicketMessage`: ruft `sendNotification('ticket_reply', ...)` nach erfolgreichem Insert auf (fire & forget).
- `openTicketDetail`: Upsert in `ticket_reads` beim Öffnen und bei eingehender Realtime-Nachricht.
- `_loadTicketView`: lädt `ticket_reads` + fremde `ticket_messages` parallel nach dem Ticket-Fetch; baut `_ticketUnreadSet`.
- `_ticketRowHtml`: zeigt "Neu"-Badge (bg-hb-orange) wenn ungelesene Fremd-Nachrichten vorhanden.
**Hinweis:** Migration muss manuell in Supabase eingespielt werden. Mailversand hängt an B4 (Brevo).
**Geänderte Dateien:** `supabase/migrations/20260524000001_ticket_reads.sql`, `supabase/functions/send-notification/index.ts`, `supabase/functions/send-notification/email-content.ts`, `js/modules/mod-tickets.js`

---

### feat(dashboard): Meldungen-Widget — Chip, Modal und Gelesen-Markierung (2026-05-24)

**Module:** `mod-news.js`, `mod-dashboard.js`
**Feature:**
- `openNewsModal()` lädt die News per Supabase nach, wenn `_newsData` leer ist (Aufruf vom Dashboard vor erstem Öffnen des Schwarzen Bretts). Gelesen-Markierung und Like-Toggle funktionieren danach korrekt.
- Dashboard-Widget "Aktuelle Meldungen": `news_reads` um `read_at` erweitert, `latestNews`-Query um `updated_at`, `newsReadMap` (id → Date) aufgebaut.
- Inline-Chip neben Titel: "Neu" (orange) wenn nie gelesen, "Update" (olive) wenn bearbeitet und `updated_at > read_at`, sonst kein Chip.
- `onclick` auf `openNewsModal(n.id)` umgestellt (numerisch, kein String-Cast-Problem).
- `_dashOpenNews` entfernt (war nur für dieses Widget genutzt).
**Geänderte Dateien:** `js/modules/mod-news.js`, `js/modules/mod-dashboard.js`

---

### feat(dashboard): Hausgeld-Kachel mit Einheiten-Paging (2026-05-24)

**Modul:** `mod-dashboard.js`
**Feature:** Die 4. KPI-Kachel zeigt für Owner alle Einheiten mit Hausgeld, blätterbar per ‹ ›.
- Owner-Einheiten via `ownerships (is_active=true) → apartments → buildings`
- Betrag per `getMonthlyHausgeld()`, Fallback `apartments.hausgeld`
- "Gültig ab" aus `budget_plans (status=active)`, nur wenn dynHG vorhanden
- Pfeile nur bei mehr als einer Einheit; Einheit + Objekt immer angezeigt
- Tenant-Pfad ("Warmmiete") unverändert
- `_dashHgState` als Modul-State; `window._dashHausgeldPage(dir)` rendert nur die Kachel neu
**Geänderte Dateien:** `js/modules/mod-dashboard.js`

---

### Fix B1: Ansprechpartner-Widget — falsche Spaltennamen korrigiert (2026-05-24)

**Modul:** `mod-dashboard.js`
**Problem:** contacts-Abfrage verwendete nicht existierende Spalten (`company_name`, `first_name`, `last_name`, `is_released`) → Query schlug fehl → Widget zeigte immer "Noch kein Ansprechpartner hinterlegt".
**Fix:**
- `.select()` auf echte Spalten umgestellt: `company, contact_person, is_company, phone, mobile, email, category, building_ids, logo_url`
- `.eq('is_released', true)` entfernt (Spalte existiert nicht; Sichtbarkeit regelt RLS)
- `building_ids`-Vergleich auf String normalisiert (DB liefert `["16"]`, buildingId ist Zahl)
- Render: `company_name`/`first_name`/`last_name` → `company`/`contact_person`; `logo_url` als rundes Bild wenn vorhanden; `mobile` als Fallback wenn `phone` leer
**Geänderte Dateien:** `js/modules/mod-dashboard.js`

---

### Fix B2: Beschlusssammlung-Anfrage nur eigene Gebäude (2026-05-24)

**Modul:** `mod-dokumente.js`
**Problem:** `_docsRequestBeschlusssammlung()` lud alle Gebäude ungefiltert aus der DB. Owner konnte fremde Gebäude in der Auswahl sehen.
**Fix:**
- Gebäude-Abfrage auf Ownerships des eingeloggten Users eingeschränkt: `persons` per `auth_user_id` → `ownerships` (is_active=true) → `apartments.building_id` → `buildings.in()`
- `_beschRequestCopy()` (war in `mod-etv.js`, auf `dashboard.html` nicht geladen) durch lokale Funktion `_docsSubmitBeschlussRequest()` ersetzt — verwendet `_docsState.buildings` statt `_etvState.buildings`
**Geänderte Dateien:** `js/modules/mod-dokumente.js`

---

### ETV Durchführung & Nachbereitung Fixes (2026-05-22/24)

**Commits:** `e50c38b`, `28aa708`, `9cc89d1`, `9ab4a44`. **Dateien:** `mod-etv.js`, `utils-pdf.js`, `etv.html` (v20260522a).

**Migrationen:**
- `etv_remark_in_protocol`: `etv_agenda_items.remark_in_protocol BOOLEAN DEFAULT false`
- `etv_result_status_add_abstained_closed`: CHECK-Constraint erweitert um `abstained` + `closed` (fehlten → Updates schlugen lautlos fehl)

**`mod-etv.js`:**
- **`resultLabel`:** Neuer Status `'closed'` → Badge "Erledigt" (hb-success).
- **Kein-Beschluss-TOPs (`voting_type='none'`):** "Abgeschlossen"-Button statt statischem Text. `_etvMarkTopClosed()` → `result_status='closed'`. Badge "Erledigt" in Durchführungs- und Nachbereitungs-Liste.
- **Enthaltung-Status in Nachbereitung:** Eigener `abstained`-Fall in `statusBadge` (war bisher "Ausstehend"). Grund war auch fehlendes `abstained` im DB-Constraint.
- **selectedTopId-Fix:** `_etvOpenSession` hat `selectedTopId = null` gesetzt → nach jeder Abstimmung Sprung auf TOP 1. Zeile entfernt; bestehende Fallback-Logik in `_etvRenderMain` übernimmt korrekt.
- **Vorbemerkung Toggle (Nachbereitung):** Toggle "Im Protokoll aufführen" neben Label. Standard: aus. Wird mit "Speichern" in `remark_in_protocol` persistiert.
- **`_etvCloseSession`:** `'closed'` zu `votedStatuses` hinzugefügt.

**`utils-pdf.js`:**
- **Protokoll-PDF Vorbemerkung:** Erscheint nur wenn `item.remark_in_protocol === true`. Einladungs-PDF unverändert.
- **Unterschriftsfelder komplett überarbeitet:** Alle drei Linien (Unterschrift/Name/Datum) gleich breit (215pt). Namenlinie + "Name in Druckbuchstaben" nur wenn kein Name vorausgefüllt. Mit Name: kompaktes Layout (Name + Rolle direkt unter Linie). Mehr Schreibraum zwischen den Linien. Größerer Abstand zwischen oberer und unterer Unterschriften-Zeile (135pt).

### Sidebar Icon-Only + Hover-Expand (2026-05-18/19)

**Commits:** `6e7807d` (Feature), `8d607d3` (Animation-Fix). **5 Dateien:** `nav.js`, `dashboard.html`, `etv.html`, `finanzen.html`, `zeiterfassung.html`.

**Finaler CSS-Stand (`@media (min-width: 768px)`) in allen 4 HTML-Shells:**
- `#sidebar`: Default `width: 72px`, `overflow: hidden`. Expand: 0.08s Delay + 0.3s `cubic-bezier(0.4,0,0.2,1)`. Collapse: 0.4s Delay (Sidebar bleibt beim seitlichen Rausfahren kurz offen).
- `.sidebar-logo-area`: Padding 16px 0 (collapsed) → 32px (expanded). CSS-kontrolliert statt Tailwind `p-8`.
- `.sidebar-logo-icon`: 32px collapsed → 40px expanded.
- `.sidebar-logo-text`: opacity+max-height Transition (nicht display:none — sonst kein Fade).
- `.nav-label`: `max-width: 0 + opacity: 0` → `max-width: 200px + opacity: 1`. Separate `transition` (nicht `all`).
- `.nav-link`: `padding: 12px` (quadratisch, 40×40px Icon-Button, zentriert durch symmetrisches Padding) → `padding: 12px 16px` expanded. **Kein** `justify-content`-Wechsel (nicht animierbar, war Ursache des Ruckelns). Explizite `transition` auf `background-color/color/padding/gap` — überschreibt `transition: all 0.2s` (Konflikt mit Sidebar-Width-Transition).
- `.nav-section-title`: max-height 0→50px. `.nav-badge`: `display:none` wenn collapsed.

**nav.js:** Alle Labels in `<span class="nav-label">` gewickelt. Badges als direkte Flex-Kinder von `.nav-link` (außerhalb `nav-label`) → `ml-auto` funktioniert im expanded Zustand.

**Architektur-Entscheidung:** 72px Sidebar (statt 64px) — notwendig für quadratischen Button: Container p-4 (16px) + nav-link padding 12px + Icon 16px + 12px + 16px = 72px.

**Offener Punkt:** `ticket_messages` noch nicht in `supabase_realtime`-Publikation → Ticket-Chat Realtime funktioniert nicht (bekannt, 1 SQL-Zeile Fix).

---

### ETV — Durchführungs-Tab UX + Realtime-Sync (2026-05-18)

**Abstimmungs-Notiz als Inline-Textarea mit Auto-Save (`mod-etv.js` v20260515e):**
- Abstimmungs-Notiz im Durchführungs-Tab ist jetzt direkte `<textarea>` statt read-only + Modal.
- Auto-Save nach 700ms Tipp-Pause (`_etvNoteInput(topId)`): Supabase UPDATE auf `etv_agenda_items.result_note`.
- Status-Feedback neben Label: "wird gespeichert…" → "✓ gespeichert" (verschwindet nach 2s).
- Debounce-Timer je TOP in `_etvNoteTimers = {}` (Map), kein Überschreiben bei schnellen TOP-Wechseln.

**Supabase Realtime — Live-Sync der Abstimmungs-Notiz:**
- Subscription auf `etv_agenda_items` (event: UPDATE, filter: `session_id=eq.{id}`) beim Öffnen einer Session.
- Empfänger-Gerät: `_etvState.agenda` wird aktualisiert, Textarea-Wert gesetzt — aber **nur wenn das Feld nicht fokussiert ist** (verhindert Überschreiben beim Tippen).
- Channel wird bei Session-Wechsel sauber via `removeChannel()` getrennt.
- DB-Fix nötig gewesen: `etv_agenda_items` war nicht in `supabase_realtime`-Publikation → Migration `enable_realtime_etv_agenda_items`.

**Quick-Edit Modal vergrößert:**
- `max-w-lg` → `max-w-2xl`. Zeilen: Notiz/Vorbemerkung 5→8, Beschlussantrag 8→12.
- `resize-none` → `resize-y` (manuell weiter aufziehbar).

**Durchführungs-Tab Layout 25/75:**
- TOP-Liste: `xl:col-span-5` → `xl:col-span-3` (25%).
- Detail-Panel: `xl:col-span-7` → `xl:col-span-9` (75%).
- Bei offener Quorum-Sidebar: 3+3+6=12 (statt 3+4+5).

**Vollbildmodus:**
- Button (Expand-SVG-Icon) neben Zahnrad im Session-Header (`id="etv-fullscreen-btn"`).
- `_etvToggleFullscreen()`: `requestFullscreen()` / `exitFullscreen()`.
- `fullscreenchange`-Event: setzt/entfernt `body.etv-fullscreen` Klasse.
- CSS in `etv.html`: `body.etv-fullscreen` blendet `#sidebar`, `header`, `#bottom-nav` aus, `#content-area padding: 0`.
- Icon wechselt automatisch zwischen Expand und Collapse. ESC beendet Vollbild nativ.

---

### ETV — Anwesenheits- und Vollmachtsliste PDF (2026-05-13)

Neues Feature in `mod-etv.js`: Button **"↓ Anwesenheitsliste"** (btn-outline) in der Gebäude-Toolbar neben "+ Neue Versammlung planen". Abrufbar ohne angelegte Session — gebäudebezogen.

**`_etvDownloadAnwesenheitsliste()` (`mod-etv.js` v20260513h):**
- Lädt `apartments` (apartment_number, mea_numerator, mea_denominator, sq_meters) + aktive `ownerships` mit Personen-Join für das gewählte Gebäude
- Sortiert nach Wohnungsnummer, Name im Format "Nachname, Vorname"
- Fügt 5 Leerzeilen für Nachmeldungen an
- Ruft `generateAnwesenheitslistePDF()` auf, Download als `Anwesenheitsliste_{Gebäude}_{Datum}.pdf`

**`generateAnwesenheitslistePDF(building, rows)` (`utils-pdf.js` v20260513h):**
- A4 Querformat (841×595 pt), 6 Spalten: Nr. | WE/MEA/m² | Eigentümer | Unterschrift Eigentümer | Vertreten durch (Name in Druckbuchstaben) | Unterschrift Vertreter
- Olive Header-Banner (nur Seite 1), Spaltenheader wiederholt auf allen Seiten
- Alle drei Schreiblinien (Unterschrift Eigentümer, Name in Druckbuchstaben, Unterschrift Vertreter) auf gleicher Höhe im unteren Zeilendrittel
- Olive Tabellenrahmen: Abschlusslinie + linke/rechte Bordüre — pro Seite abgeschlossen (auch vor Seitenumbruch)
- Alternierende Zeilen, vertikale Trennlinien, Footer mit Seitenzahl + §24-Hinweis
- Zeilenhöhe 52pt (ca. 10 Zeilen pro Folgeseite)

---

### Phase 5.8-C — Dynamische Platzhalter in ETV-TOPs (2026-05-13)

Migration `20260513000002_etv_placeholders.sql`: `etv_agenda_items.placeholder_options JSONB DEFAULT '{}'` + `placeholder_values JSONB DEFAULT '{}'`.

**Syntax:** `[GROSSBUCHSTABEN]` im Beschlussantrag (z.B. `[BEAUFTRAGTE_FIRMA]`, `[BETRAG]`, `[DATUM]`).

**TOP anlegen / bearbeiten (`mod-etv.js`):**
- Textarea erkennt Platzhalter per `oninput` → Optionen-Editor erscheint automatisch darunter.
- Pro Platzhalter: Eingabefelder für vordef. Auswahlmöglichkeiten (+ Option-Button, × Entfernen).
- `_etvSaveTOP()` / `_etvUpdateTOP()`: speichert `placeholder_options`; `placeholder_values` bleibt beim Bearbeiten erhalten.
- Editier-Modal: `data-existing` Attribut füllt vorhandene Optionen vor; `setTimeout` triggert initialen Scan.

**Durchführungs-Tab (Resolver-UI):**
- Detailpanel zeigt Beschlussantrag mit farbigen Inline-Badges: gelöst=olive, offen=orange.
- Resolver-Sektion über Abstimmungs-Buttons: Select (wenn Optionen def.) oder Freitext-Input.
- "Platzhalter speichern" → `_etvSavePlaceholders(topId)` → UPSERT in `placeholder_values`.
- JA-Button: ausgegraut + `cursor-not-allowed` wenn ungelöste Platzhalter vorhanden. NEIN + ENTHALTUNG immer klickbar.
- Orange Warnhinweis über den Buttons erklärt Einschränkung.

**TOP-Listen:**
- Prep-Tab: Badge `⬡ Platzhalter` (orange) wenn Platzhalter im Beschlussantrag.
- Exec-Tab: Badge `⬡ Platzhalter` (orange) wenn `_etvHasUnresolved(top)`.

**PDF-Generierung (`utils-pdf.js`):**
- `_pdfResolveEtvPlaceholders(item)` ersetzt `[KEY]` durch `placeholder_values[KEY]` (plain text für PDF).
- Protokoll-PDF + Einladungs-PDF: nutzen aufgelöste Werte statt rohen Platzhaltertext.
- Beschlusssammlung-Transfer (`_beschDoTransfer`): `beschluss_text` verwendet aufgelösten Text.

**Cache-Buster:** `mod-etv.js?v=20260513i`, `utils-pdf.js?v=20260513i`.

---

### Design-System — `btn-outline` + mod-objekte.js Button-Audit (2026-05-13)

Neue CSS-Klasse `btn-outline` (weiß mit olive Rahmen, hover füllt sich olive) in allen 4 HTML-Shells (`dashboard.html`, `etv.html`, `finanzen.html`, `zeiterfassung.html`) definiert. Tap-Feedback-Regel um `.btn-outline:active` erweitert.

**3 Button-Varianten im Design-System:**
- `btn-primary` — Olive ausgefüllt, weiße Schrift (Haupt-CTA)
- `btn-outline` — Weiß/olive Rahmen (Sekundär-Aktionen auf hellem Hintergrund: "Bearbeiten", "+ Hinzufügen")
- `btn-secondary` — Grau (Abbrechen/Zurück in Modals)
- **Toolbar-Stil (kein eigener CSS-Name):** `bg-white/20 hover:bg-white/30 text-white` — für Buttons auf olive Hintergründen (Sidebar-Header, Einheiten-Header)

**`mod-objekte.js` (v20260513a) — 7 Buttons migriert:**
- Runder "+" Sidebar-Button → `bg-white/20` Toolbar-Stil, Text "+ Neues Objekt"
- "Bearbeiten" Gebäude-Detail → `btn-outline text-xs`
- "+ Beirat hinzufügen" → `btn-outline text-xs`
- "+ Einheit" (Olive-Header) → `bg-white/20` Toolbar-Stil
- "Bearbeiten" Einheiten-Detail → `btn-outline text-xs`
- "+ Konto" → `btn-outline text-xs`
- "+ Schlüssel" → `btn-outline text-xs`

**Offen (weitere Module — wird laufend ergänzt):** mod-finanzen.js, mod-etv.js, mod-zeiterfassung.js, mod-settings.js, mod-personen.js, mod-tickets.js, mod-dokumente.js, mod-kontakte.js

---

### Beschlusssammlung PDF-Redesign & Bugfixes (2026-05-13)

**`generateBeschlussPDF()` komplett neu (`utils-pdf.js` v20260513e/f):**
- 6-Spalten-Layout nach §24 Abs. 7 WEG Muster: Lfd. Nr. | Beschlusswortlaut | Versammlung | Gerichtsentscheidung | Vermerke | Eintragungsvermerk
- Versammlung-Spalte: Art ("Eigentümerversammlung" / "Umlaufbeschluss §23 Abs. 3 WEG") + TOP-Nummer + Datum
- Vermerke-Spalte: Ergebnis (farbig) + Abstimmungszahlen + Status (mit Trennlinie) + Notiz (kursiv, umgebrochen)
- Eintragungsvermerk: Verwalter-Name (via `profiles!created_by`-Join) + Datum
- Vertikale Spaltentrenner, alternierende Zeilen, abschließende Olive-Linie
- Status-Notiz umbricht korrekt innerhalb der Spaltenbreite

**Bugfix `_beschDoTransfer()` — `topId` fehlte in rows-Objekt:**
- `top_id` wurde als `undefined` inseriert → TOP-Nummer im PDF nicht sichtbar
- Fix: `topId: top.id` dem rows-Objekt beim Aufbau hinzugefügt
- Betrifft nur neue Übertragungen — bestehende DB-Einträge ohne top_id müssen manuell nachgetragen werden

**Query-Erweiterung `_beschLoadAndRender()`:**
- `select('*, profiles!created_by(full_name), etv_agenda_items!top_id(sort_order, title)')` — Verwalter-Name + TOP-Details in einer Abfrage

**`_beschDownloadPDF()` (`mod-etv.js` v20260513g):**
- Admin/Manager können Beschlusssammlung direkt als PDF herunterladen (ohne Eigentümer-Anfrage)
- Button "↓ PDF" in der Toolbar neben "Neu nummerieren" und "+ Neuer Beschluss"

---

### Phase 5.8-F — Beschlusssammlung §24 Abs. 7 WEG (2026-05-13)

Migration `20260513000001_beschluesse.sql`: Neue Tabelle `beschluesse` (building_id, beschluss_nr YYYY/NNN, beschluss_datum, art etv/umlauf/sonstig, beschluss_text, abstimmung_ja/nein/enthaltung, ergebnis angenommen/abgelehnt/einstimmig, etv_session_id FK nullable, top_id FK UNIQUE nullable, status aktiv/angefochten/nichtig/aufgehoben, status_notiz, created_by). Kein DELETE erlaubt (absichtlich keine DELETE-Policy).

**`loadBeschluesse()` in `mod-etv.js`:**
- Two-Panel-Layout (analog loadETV): linke Gebäude-Sidebar, rechts Tab-Ansicht
- **Tab "Beschlüsse":** Chronologische Liste (Datum ASC), "Neuer Beschluss"-Modal (Nr auto-vorgeschlagen, Backdating möglich), Detail-Modal + Status-Änderung, "Neu durchnummerieren"-Button (YYYY/NNN nach beschluss_datum)
- **Tab "Anfragen":** Offene Tickets mit `category='Beschlusssammlung-Anfrage'`, "PDF freigeben"-Button → `generateBeschlussPDF()` + Storage-Upload + `documents`-Eintrag `visibility_scope='person'` + `document_links` für anfragenden Owner + Ticket schließen

**ETV-Integration (`mod-etv.js`):**
- Button "Übertragen" in Nachbereitung-Tab (nach Protokoll-Generator): öffnet Transfer-Modal mit allen angenommenen TOPs (Duplikat-Check via top_id)
- `_beschTransferFromSession()`: Abstimmungsergebnis aus `_etvState.votes` vorbelegt, beschluss_nr auto-vorgeschlagen, Checkbox pro TOP
- `_beschRequestCopy()`: von Owner aufrufbar, erstellt Ticket + sendNotification

**`nav.js`:**
- Neuer Nav-Eintrag "Beschlusssammlung" (admin/manager) unterhalb ETV: auf etv.html per onclick, von anderen Seiten per `href="etv.html?tab=beschluesse"`
- `PAGE_INIT.etv` prüft `?tab=beschluesse` und ruft `loadBeschluesse()` statt `loadETV()`
- Badge `nav-badge-beschluesse`: Anzahl offener Beschlusssammlung-Anfragen
- Ticket-Badge für admin/manager exkludiert `category='Beschlusssammlung-Anfrage'` (werden separat gezählt)

**`mod-dokumente.js` (Owner/Advisory):**
- Card "Beschlusssammlung" in linker Sidebar unterhalb Kategorien (nur `role='owner'`)
- Button "Kopie anfordern" → `_docsRequestBeschlusssammlung()`: bei 1 Gebäude direkt, bei mehreren Auswahl-Modal
- Ruft `_beschRequestCopy(buildingId)` auf (Cross-Module-Aufruf)

**`utils-pdf.js` — `generateBeschlussPDF(building, beschluesse)`:**
- A4 Querformat (841×595pt), kein Briefbogen
- Olive-Header-Banner: Titel + Gebäudename + Erstellungsdatum + §24-Hinweis
- Tabellen-Header: Nr. | Datum | Art | Beschlusstext | Ergebnis | Status
- Text-Wrapping in Beschlusstext-Spalte via `_pdfSplitText()`, dynamische Zeilenhöhe
- Status-Farben: aktiv=olive, angefochten=orange, nichtig=grau, aufgehoben=rot
- Automatischer Seitenumbruch + Tabellen-Header-Wiederholung
- Footer: Seitenzahl + §24-Hinweis

**Cache-Buster:** mod-etv.js, nav.js, mod-dokumente.js, utils-pdf.js → `v=20260513a`. Alle 4 HTML-Shells aktualisiert.

---

### Auth-Flow, Profil-Bearbeitung, E-Mail-System (2026-05-13)

**Brevo SMTP + Auth-E-Mail-Templates:**
- Supabase Auth auf Brevo SMTP umgestellt (alle Auth-Mails: Einladung, Reset, E-Mail-Änderung).
- `mail-templates/invite-user.html`, `reset-password.html`, `change-email.html` — Branded HTML-Templates im HB-Olive-Design. In Supabase Dashboard → Authentication → Email Templates eingetragen.

**Auth-Flow `index.html` (Phase 7.8 ✅):**
- Hash `type=invite` erkennen → "Passwort festlegen"-Formular statt sofortiger Dashboard-Redirect.
- `PASSWORD_RECOVERY`-Event → ebenfalls Passwort-setzen-Formular (für Passwort-vergessen-Flow).
- "Passwort vergessen?"-Link → `resetPasswordForEmail()` → Reset-Mail via Brevo.
- Drei Formulare (Login / Forgot / Set-Password) per Toggle ein-/ausgeblendet.

**Profil-Bearbeitung `mod-placeholder.js` (Phase 7.3 ✅):**
- Name: inline bearbeiten → `profiles.full_name` UPDATE.
- E-Mail: `supabase.auth.updateUser({ email })` → Bestätigungslink an neue Adresse (nutzt `change-email.html`).
- Passwort: `supabase.auth.updateUser({ password })` mit Mindestlänge + Bestätigung.
- Inline-Toggle: nur eine Sektion gleichzeitig offen.

**Edge Function `send-notification` lokal gespeichert + refactored:**
- `supabase/functions/send-notification/index.ts` — vollständige Funktion jetzt versioniert.
- `supabase/functions/send-notification/email-content.ts` — alle E-Mail-Texte (Betreff, Body, Button, Footer) in separater editierbarer Datei. E-Mail-Design auf HB-Olive-Standard (identisch zu Auth-Mails).

**Scope-aware Dokument-Benachrichtigungen (Bugfix):**
- Dokumente gehen **nie automatisch an Mieter** — Weiterleitung bleibt dem Vermieter überlassen (Phase 5.7-B).
- `visibility_scope='building'` → nur Eigentümer des Gebäudes (`getBuildingOwners`).
- `visibility_scope='unit'` → nur der aktuelle Eigentümer der Einheit (`getUnitOwner`).
- `visibility_scope='person'` → nur die verknüpfte Person aus `document_links` (`getDocumentLinkPerson`).
- `news_new` bleibt unverändert (alle Bewohner inkl. Mieter — Schwarzes Brett).
- `mod-dokumente.js`: `unit_id` + `visibility_scope` im `sendNotification`-Payload ergänzt.

---

### Supabase CLI Infrastruktur + Nutzer-Anlegen + ETV Two-Panel (2026-05-12)

**Supabase CLI Migrations-Verwaltung:**
- `supabase/config.toml` mit project_id `unprrlbvylmzxxhpfisr` via `supabase init`.
- Baseline-Migration `supabase/migrations/20260101000000_baseline.sql` als Placeholder erstellt + via `supabase migration repair --status applied` markiert (Live-DB enthält das vollständige Schema, kein Docker verfügbar für `db dump`).
- Alle 39 `scripts/migration_*.sql`, `scripts/fix_*.sql`, `scripts/etv_*.sql`, `scripts/phase*.sql` gelöscht. Verbleiben: `create_test_users.sql`, `debug_beirat_access.sql`, `delete-testdata.sql`, `seed-testdata.sql`, `seed_zeppelinstr8_reset.sql`.
- Zukünftige Schema-Änderungen: `supabase/migrations/YYYYMMDDHHMMSS_name.sql` anlegen + remote mit `supabase db push` deployen.

**Edge Function `create-user` (deployed):**
- `supabase/functions/create-user/index.ts` — Admin-Only User-Anlage.
- Zwei Modi: `password` → `createUser()` mit `email_confirm=true`; ohne Password → `inviteUserByEmail()`.
- Batch-Support: Body kann Array oder Einzelobjekt sein. Felder: `email`, `full_name`, `role`, `password?`, `building_ids?` (für Manager).
- Erstellt `profiles`-Eintrag (upsert) + `management_assignments` für Manager.

**Einstellungen → Nutzer-Tab (`mod-settings.js` v20260512b):**
- Neuer Tab "Nutzer" für Admin: Batch-Anlage-Tabelle (Email/Name/Rolle/Passwort), CSV-Import, Einzelanlage-Formular.
- Ruft Edge Function `create-user` auf.

**ETV Two-Panel-Layout (`mod-etv.js` v20260512a):**
- Startseite: Links Gebäude-Liste (klickbar), rechts ETV-Sessions des gewählten Gebäudes.
- Ersetzt altes Dropdown. `_etvRenderBuildingList()`, `_etvSelectBuilding()`, `_etvMarkActiveBuilding()`.

---

### Design-Migration KOMPLETT ABGESCHLOSSEN (Blöcke 1–4)
DESIGN.md ist Single Source of Truth. Tailwind-Config, CSS, Radien, Schatten, Borders, Farb-Palette, Tap-Feedback, Toast-Varianten, Typografie-Hierarchie und Fließtext-Feinschliff — alles migriert.

### Design-Migration Block 4 — Fließtext-Feinschliff (text-sm → text-[15px])

**Selektive Migration nach Faustregel:** NUR echte Fließtext-Stellen (`<p>`-Beschreibungen, Empty-States, Hint-Texte, Modal-Bodys mit `leading-relaxed`). Form-Labels, Toggle-Switches, Tabellen-Zellen, Buttons, Selects, Card-Header, Sidebar-Items, Inline-Wertanzeigen bleiben bewusst auf `text-sm` (14px) — kompakter Charakter.

**63 Stellen migriert (von 633 text-sm-Vorkommen):**
- HTML-Shells (2): index.html "Bitte loggen Sie sich ein", register.html Code-Hint
- mod-news.js (4): Page-Subtitle, Empty-State, News-Card-Preview, Detail-Modal-Body
- mod-kontakte.js (3): Page-Subtitle, Empty-State, Quick-Create-Frage
- mod-kalender.js (1): Page-Subtitle
- mod-personen.js (1): Page-Subtitle
- mod-dashboard.js (10×replace_all): alle `<p class="p-6 text-sm text-gray-400 text-center">` Empty-States in Admin- und User-Widgets
- mod-dokumente.js (3): Page-Subtitle, Vorschau-Hinweis, Drag-Drop-Hinweis
- mod-tickets.js (2): "Bitte wähle..." Empty-State, "Noch keine Nachrichten"
- mod-objekte.js (8×replace_all + 1): alle `text-sm text-gray-400` Empty-States, "Keine Person gefunden"
- mod-etv.js (5): "Keine Gebäude", Protokoll-Beschreibung, Empty-State Dokumente, 2× Detail-Panel/Protokoll-Body
- mod-zeiterfassung.js (2): Kein-Zugriff-Hinweis, Projekt-Beschreibung
- mod-finanzen.js (10×replace_all "Kein Gebäude" + 11): Page-Subtitle, alle "Kein Gebäude gewählt", Belegprüfung-Empty, Eröffnungssalden-Description, Wirtschaftsplan-Empty, Rücklagekonten-Empty, Beirat-Subtitle + Hint, JAB-Description, CSV-Drop-Hinweis, Buchungen-Empty
- mod-settings.js (1): Designer-Empty-State
- mod-persons-edit.js (1): Zuweisungen-Empty-State

**Bewusst belassen** (sind keine Fließtexte, sondern semantisch andere Elemente):
- Form-Labels (z.B. mod-settings Toggle-Switch-Beschriftungen, mod-kontakte "24/7 Notfallkontakt")
- Card-Title in Sidebars (mod-dokumente "Alle Dokumente", mod-tickets Kategorie-Pills)
- Wert-Anzeigen in Forms (mod-placeholder Profile-Daten, mod-objekte Bool-Häkchen)
- Apartment-Subtitle (m², Zimmer — kompakte Info-Zeile)
- Inline-Hilfstexte in Tabellen-Zellen
- Dropdown-User-Name (Header)

Cache-Buster aller in Block 4 geänderten JS-Dateien (mod-news, mod-kontakte, mod-kalender, mod-personen, mod-dashboard, mod-dokumente, mod-tickets, mod-objekte, mod-etv, mod-zeiterfassung, mod-finanzen, mod-settings, mod-persons-edit) auf `v=20260425k`.

### Design-Migration Block 3 — Typografie-Hierarchie (Paket G abgespeckt)

**Paket G — Page-H1 + KPI-Zahlen:**
- **15 Page-H1 auf `text-[28px] font-bold`** angehoben (DESIGN.md §2 Typografie-Skala):
  - Login/Register: index.html "Mieterportal", register.html "Willkommen im Haus!"
  - Dashboard (admin + user): "Hallo, ${name}!"
  - Module: "Eigentümerversammlungen" (mod-etv), "Buchhaltung" (mod-finanzen), "Belegprüfung Beirat → ${gebäude}" (mod-finanzen Beirat-View), "Kalender", "Schwarzes Brett" (mod-news), "Kontaktbuch", "Globales Adressbuch" (mod-personen), "Dokumenten Cloud" (mod-dokumente), "Einstellungen" (mod-settings — war text-xl), "Zeiterfassung & Projekte" (mod-zeiterfassung — war text-xl), Projekt-Detail-Header in mod-zeiterfassung.
- **KPI-Zahlen im Dashboard auf `text-[32px] font-bold`** angehoben — zentral in `_dashKpi()` ([mod-dashboard.js:36](js/modules/mod-dashboard.js#L36)), wirkt auf alle Admin- und User-KPIs gleichzeitig.
- **font-weight harmonisiert** auf `font-bold` (700) gemäß DESIGN.md §2 — bisher meist `font-extrabold` (800).

**NICHT angefasst (laut Plan):** 629 `text-sm`-Vorkommen für Fließtext (zu hohes Layout-Risiko, geringer visueller Gewinn). Stattdessen nur globale Input-Größe via CSS in HTML-Shells (44px Höhe, 15px Schriftgröße) — bereits in Block 1 erledigt.

**Bewusst stehen gelassen:** mod-persons-edit.js Modal-Titel (`text-2xl`), Tickets-/Objekte-Card-Titelleisten (`text-sm` weiß auf olive — eigenes Design-Pattern, kein Page-Header).

Cache-Buster aller in Block 3 geänderten JS-Dateien (mod-dashboard, mod-dokumente, mod-etv, mod-finanzen, mod-kalender, mod-kontakte, mod-news, mod-personen, mod-settings, mod-zeiterfassung) auf `v=20260425j`.

### Design-Migration Block 2 — Patterns + Farb-Migration (Pakete C + H + E)

**Paket C — Tap-Feedback & Bottom-Sheet-Drag-Indicator:**
- CSS in 4 großen HTML-Shells: `.btn-primary:active`, `.btn-secondary:active`, `.tap-feedback:active` → `transform: scale(0.97)` + `opacity: 0.7` über 100ms. Selects/Toggle-Switches/Container-Buttons bewusst NICHT betroffen (kontrollierte Opt-in-Selektoren statt globalem `button:active`).
- `utils.js` → `showModal()`: Bottom-Sheet bekommt automatisch einen iOS-typischen Drag-Indicator (5×36px graue Pille, sticky oben). Plus alter `rounded-t-[15px]` → `rounded-t-2xl`.

**Paket H — Toast-Varianten + Segment-Bar CSS:**
- `utils.js` → `showToast()` Default geändert von `'success'` → `'info'`. Neue 3-Wege-Logik: `'success'` → `bg-hb-success`, `'error'` → `bg-hb-error`, sonst → `bg-hb-offblack`. **Verhaltenswechsel:** Bestehende Aufrufe ohne expliziten Type werden ab jetzt offblack statt hb-olive — wer Erfolgs-Grün will, muss explizit `'success'` übergeben.
- CSS `.segment-bar` + `.segment-item` (Apple-Stil, horizontal scrollbare Pill-Buttons) in 4 großen HTML-Shells als bereitstehendes Pattern. Migration konkreter Filter-Bars erfolgt später.

**Paket E — Verbotene Tailwind-Farben (red/blue/green/emerald/purple) → Brand-Palette:**
- 4 große HTML-Shells: Logout-Button `text-red-500/bg-red-50` → `text-hb-error/bg-hb-error/5`.
- index.html / register.html: Error-/Success-Boxes auf `bg-hb-error/12` und `bg-hb-success/12`.
- mod-dashboard.js: Deadline-Status (Überfällig/Kritisch/OK) auf hb-error/hb-success.
- mod-etv.js: Voting-JA-Button auf hb-success, Quorum-Pillen "Beschlussfähig", "Bereit"-Badge.
- mod-finanzen.js (23 Stellen): Saldos (negativ→hb-error, positiv→hb-success), Status-Badges Bezahlt/Aktiv/Ordnungsgemäß, Mahnung Stufe 3, Konto-Type-Badges (asset→olive, liability→gold-bold, revenue→success).
- mod-kalender.js (7 Stellen): Legenden-Punkte, Pillen-Mapping, Tage-Status-Texte.
- mod-news.js: Ankündigung-Badge `bg-blue-*` → olive.
- mod-objekte.js (3 Stellen, +emerald-Nachzügler): Eigentümer-Badge → olive, Mieter-Badge → gold-bold, Bool-Häkchen, Vermietet-Status, Assign-Selected-Box → success.
- mod-persons-edit.js (2 Stellen, emerald-Nachzügler): Registriert-Status, Aktiv-Badge → success.
- mod-settings.js: E-Mail-Log-Status (sent/failed/pending) auf success/error/gold-bold; Designer-Demo grüne Box → hb-success.
- nav.js: Nav-Fehler-Hinweis → hb-error.

**Mitgenommen aus Paket-C-Audit:** 3 verbliebene Sonder-Radien gefixt (utils.js Bottom Sheet `rounded-t-[15px]`, mod-etv.js Modal-Header/Footer `rounded-t-[20px]`/`rounded-b-[20px]` → 2xl).

Cache-Buster: utils.js + mod-etv.js auf `v=20260425h` (Pakete C+H), alle in Paket E geänderten JS-Dateien (mod-dashboard, mod-etv, mod-finanzen, mod-kalender, mod-news, mod-objekte, mod-persons-edit, mod-settings, nav.js) auf `v=20260425i`.

### Design-Migration Block 1 — Fundament (Pakete A + B + D + F)
DESIGN.md ist neue Single Source of Truth für alle UI-Tokens. Block 1 setzt das Fundament: Tailwind-Config, globales CSS, Border-Radien und Card-Borders. CLAUDE.md §3 (Design-System) und Design-Konventionen-Block durch Verweise auf DESIGN.md ersetzt — nur die nicht-UI-Architekturkonventionen (FK-Hint, Multi-Page-Nav, externe Shells, Responsive Tables) bleiben in CLAUDE.md.

**Paket A — Tailwind-Config & Farb-Tokens:** Alle 6 HTML-Shells synchron erweitert um neue Brand-Farben (`hb-white`, `hb-gray`, `hb-gold-bold`, `hb-gold-soft`) + semantische Farben (`hb-success #4A7C59`, `hb-error #C4453E`). `hb-ultralight` von `#F9FAF8` → `#F5F5F5` (Brand Guide). `borderRadius` korrigiert (lg=8px, xl=12px, 2xl=16px statt überall 15px). Neue `boxShadow`-Skala soft/md/lg.

**Paket B — Globales CSS in HTML-Shells:** Body-Hintergrund, `.card`-Klasse (Radius 16px, Schatten `0 2px 8px rgba(0,0,0,0.08)`, Border-Opacity 0.12), Inputs/Selects/Textareas (Radius 12px, Höhe **44px** für Touch-Target, Schriftgröße 15px, Hintergrund #F5F5F5), `.skeleton` (16px), `.rtable tbody tr` (16px + 0.12 Border). Sidebar-/Modal-/Sheet-Animationen auf Apple-Easing `cubic-bezier(0.25, 1, 0.5, 1)`. Neu: `@media (prefers-reduced-motion: reduce)` global.

**Paket D — Border-Radien-Konsolidierung:** 26× `rounded-[15px]` → `rounded-2xl` (16px) in 8 Dateien. mod-etv.js: Sonder-Radien `rounded-[20px/25px]` → `rounded-2xl`, `rounded-[30px/35px]` → `rounded-3xl` (Modals).

**Paket F — Card-Border-Hardcodes:** 26× `border-hb-olive/20` → `border-hb-olive/12` in 6 Modulen (etv, finanzen, kalender, objekte, settings, zeiterfassung). Plus 1 Inline-Style in mod-finanzen.js (rgba 0.15 → 0.12).

**Stille A11y-Fixes mitgenommen:** Input-Höhe 40 → 44px, Schriftgröße 14 → 15px, prefers-reduced-motion-Block.

**Geänderte Dateien:** 6 HTML-Shells (dashboard, etv, finanzen, zeiterfassung, index, register), 9 JS-Module (utils, mod-finanzen, mod-kalender, mod-news, mod-objekte, mod-personen, mod-etv, mod-settings, mod-zeiterfassung). Cache-Buster aller geänderten JS-Dateien auf `v=20260425g`.

### Phase 1 — Tech-Debt & Infrastruktur
RLS-Cleanup, FK-Indexes, Security-Warnings, Migration-Files, Frontend-Modularisierung (`dashboard.html` → `config.js`, `utils.js`, `nav.js`, `mod-*.js`).

### Phase 2 — Personen-CRM (`3d951de`)
Migrationen: `extend_persons_crm` (5 Felder), `extend_apartments_mea` (MEA). `mod-personen.js` auf Supabase CRUD, `mod-persons-edit.js` (4-Tab-Formular).

### Phase 3 — Objekte & Zuweisungen (`28b8842`..`b54f195`)
Migration `extend_apartments_warm_water_meter`. Gebäude-Detail (4 Tabs), Einheiten-Detail (5 Tabs), Zuweisungs-Modal (Autocomplete, Quick-Create, `ownerships`/`tenancies`), Einheiten als Tabelle.

### Phase 4 — Kommunikation (`9682a6b`..`5ff7ad5`)
Migration `phase4_news_and_tickets`. `mod-news.js` (Feed, Filter-Chips, Like, Read-Tracking, Rich-Text-Editor). `mod-tickets.js` (Zwei-Spalten, Chat-Bubbles, Realtime via `postgres_changes`). Status-Flow (5 Stufen), Wiedervorlage/Snooze, Auto-Reopen, Eskalation, Deep-Links, Mobile 3-Zustands-Flow.

### Phase 5 — Dokumente, Kontakte, Dashboard, Kalender (`f2ef175`, `45c3672`)
Migration `phase5_documents`, `phase5b_document_links`, `fix_document_reads_legacy_trigger`. Globaler UI-Overhaul (olive Cards/Nav). `mod-dokumente.js` (Upload, Vorschau, Draft-Workflow, Listen-/Baumansicht, Auto-Naming, Personen-Scope). `mod-kontakte.js`. `mod-dashboard.js` (Admin/Manager: 4 KPIs + 4 Widgets; Tenant/Owner: 4 KPIs + 4 Widgets). `mod-kalender.js` (Monatskalender, Fristen-Pills, Ticket-Wiedervorlagen, Deadline-Popup).

### Phase 6-A — Finanzen DB-Fundament
Migration `phase6a_finance_foundation`: 8 Tabellen (`accounts`, `journal_entries`, `budget_plans`, `budget_plan_items`, `payment_demands`, `special_levies`, `dunning_notices`, `beirat_access_periods`). GoBD-konform: `journal_no_update`/`journal_no_delete` RULES. 17 System-Konten (SKR03/04). 5 Performance-Indexes.

### Phase 6-B — Buchhaltung UI
`mod-finanzen.js`: 5-Tab-Layout (Übersicht/Buchungen/Zählerstände/Sollstellungen/Onboarding). Kontenblatt + Saldo, Buchungsmaske + Beleg-Upload, Schnelleingabe-Grid Zähler, Sollstellungs-Generierung, Onboarding-Wizard.

### Phase 6-C — Wirtschaftsplan, Sonderumlagen, Rücklage, Belegprüfung
WP-Tab (draft→approved→active→closed, Positionen, Auto-Kalkulation). Sonderumlagen (Verteilungsschlüssel, payment_demands). Rücklage-Tab (Echtzeit-Saldo, Zuführung/Entnahme). Belegprüfung (Beirat-Freigabezeiträume, Read-Only-View).

### Phase 6-D — Jahresabrechnung, Mahnwesen, DATEV-Export
JAB 5-Schritte-Wizard (Konto-Checkliste, Ist-Zahlen, Umlageschlüssel, Soll-Ist-Abgleich, Abschluss). Heizkosten Option A/B. §35a EStG. Mahnwesen (Stufe 1-3, Zinsberechnung). DATEV-Export (EXTF-Header, SKR03/04).

### Phase 6-E — CSV-Import & SEPA-Export (`3efc9ed`)
CSV-Import (MT940/Sparkasse/Volksbank/allgemein, Drag & Drop, Duplikat-Check). SEPA-Export (PAIN.008.003.02). Testdaten-Scripts.

### Phase 6-F — Belege, Konten-CRUD, Unterkonten
Migration `phase6f_journal_attachments_and_subaccounts` (`journal_attachments`, `parent_account_id`). Konten bearbeiten/löschen (Soft-Delete, System-Schutz). Unterkonto-Hierarchie (eingerückt └). Konto-Ledger, Suchleiste, Buchungs-Detailansicht.

### Phase 6.9 — Official Letter Engine + PDF-Redesign
Migration `global_settings`. `mod-settings.js` (Firmenstammdaten, Finanz-Defaults, Briefpapier). `utils-pdf.js`: `generateMahnungPDF`, `generateWirtschaftsplanPDF`, `generateEinzelwirtschaftsplanPDF` (Inter-Font, 5-Block-Aufbau, Briefbogen-Integration, Seitenumbruch-Logik). `generateJahresabrechnungPDF` (Anschreiben + Einzelabrechnung, Direktkosten-Split, Saldo-Berechnung). `formatBuildingName()` global.

### Phase 6.10 — Verteilerschlüssel & Einzelwirtschaftspläne
Migration `phase610_distribution_keys` (`distribution_keys`, `distribution_key_units`, `accounts`-Erweiterung). 5. Tab im Gebäude-Detail. Schlüsselzuweisung je Konto (primär/sekundär). Bulk-PDF Einzelwirtschaftspläne mit Dual-Key-Support. Gesamtumlage manuell/auto.

### Phase 6-D.3 — Mahnungs-Buchungslogik
Migration `migration_phase6d3_mahnung_accounts.sql`: Konten 1420/8010/8020 als System-Templates. Korrekte 3er-Split Buchungslogik: Mahnung-Erstellung (4201→1420), Zahlung (1200→1400/8010/1420), Storno (GoBD-konform). `_finEnsureAccounts` kopiert `is_system_account` + `is_allocatable`.

**Architektur-Entscheidung Mahngebühr-Buchungsfluss:**
- Erstellung: Debit 4201 (Aufwand, apartment_id) / Credit 1420 (Forderung) → Direktkosten in JAB
- Zahlung: Debit 1200 (Bank) / Credit 1420 (Forderung löschen, kein apartment_id) → neutral für JAB

### GoBD-Fix — journal_no_update RULE vs. Trigger
`journal_no_update` war als RULE (`DO INSTEAD NOTHING`) statt Trigger angelegt → alle UPDATEs still ignoriert. Fix: DROP RULE, Trigger `journal_no_update_fn` aktiv (blockiert Finanzdaten, erlaubt Metadaten). `journal_no_delete` RULE bleibt (GoBD: kein Löschen). Migration `migration_journal_metadata_update.sql`.

### Phase 8.1 — Sonderrollen & Finanz-Klassifizierung
Migration `phase81_special_roles_and_allocatable`: 6 Rollen (+landlord, +advisory), `is_allocatable` BOOLEAN. 6 RLS-Policies (3×landlord, 3×advisory). WP-Tabelle nach umlagefähig/nicht gruppiert. PDF-Sektionen auf `is_allocatable` umgestellt. Nav-Sektionen je Rolle.

### Zeiterfassung-Modul
`mod-zeiterfassung.js`: Projekte, Arbeitspakete, Live-Timer, manuelle Einträge, Bearbeitung. Arbeitsrapport-PDF. Migration `migration_zeiterfassung.sql` (3 Tabellen).

### ETV-Modul & Staging-Workflow
`mod-etv.js`: Planung (Sessions, TOPs, Vorbemerkung, interne Notiz), Check-in (Präsenz/Vollmachten), Abstimmung (MEA/Kopf/Objekt), Protokoll-PDF. Migration `migration_etv.sql` (4 Tabellen), `etv_agenda_items` um `preliminary_remark`/`internal_note` erweitert. ETV-Staging: WP/JAB pro Einheit splitten + in Storage uploaden. Einladungs-PDF mit automatischem Anhang.

### Phase 5.8 ETV-Ausbau (Voting, Proxy, Protokoll-Formalia)
Migration `migration_etv_voting_protocol.sql`: `etv_votes.cast_by_person_id` UUID, `etv_attendance.proxy_name` TEXT, `etv_sessions.{chairman_name, secretary_name, actual_start_time, actual_end_time, general_notes}`. `discussion_note` aus `etv_agenda_items` später entfernt (redundant zu `result_note`).

**Neu implementiert in `mod-etv.js` (v20260511f):**
- **Quorum-Warnung pro TOP:** `topNeedsWarning()` prüft `unanimous` (alle WE müssen anwesend sein) und `double_qualified` (>50% aller MEA nötig). Badge "! Nicht erreichbar" in TOP-Liste und Detail-Panel.
- **Abstimmungs-Korrektur:** Button-Zustand spiegelt gespeichertes Ergebnis (aktiver Button hervorgehoben). Enthaltung als eigener Status `abstained` (nicht mehr `pending`). `_etvCloseSession()` prüft offene TOPs (Enthaltung gilt als abgestimmt).
- **Inline-Edit (Quick-Edit):** ✎-Button neben Interne Notiz, Vorbemerkung, Beschlussantrag, Abstimmungs-Notiz → `_etvQuickEditField()` / `_etvQuickEditSave()` via `showModal`.
- **Vollmachten (Proxy-Check-in):** Dual-Button-Layout im Check-in-Modal (CHECK-IN | Vertreten). `_etvOpenProxyModal()` (z-[70]) mit Proxy-Name + optionalen Vorab-Weisungen per TOP (`instructions` JSONB). `_etvSaveProxy()` setzt `is_present=true` + `proxy_name`. `_etvClearProxy()` löscht Vollmacht. Vollmacht-Badge in Präsenzliste sichtbar.
- **Einzelstimmen (`_etvOpenIndividualVoting`):** Modal (z-[70]) mit per-Einheit JA/NEIN/ENTH-Buttons. "Alle auf JA setzen"-Button. Proxy-Weisungen werden vorausgefüllt (Weisung-Badge). Live-Zusammenfassung. Speichert in `etv_votes` mit `cast_by_person_id`. Berechnet `result_status` nach Mehrheitstyp (unanimous/double_qualified/qualified/simple).
- **Protokoll-Formalia:** Banner im Durchführungs-Tab mit "Formalia erfassen"-Button. `_etvProtocolModal()` erfasst Versammlungsleiter, Protokollführer, Beginn, Ende, Notizen. `_etvSaveProtocolData()` speichert in `etv_sessions`. "Versammlung beenden"-Button direkt im Banner.

### Phase 5.8 ETV-Nachbereitung (Tab 3 — Protokoll)
Migration `migration_etv_protokoll_signatories.sql`: `etv_sessions.beirat_signatory_1/2` TEXT.

**Neu implementiert in `mod-etv.js` + `utils-pdf.js` (v20260511g):**
- **`_etvRenderFollow()` komplett neu:** Protokoll-Vorschau mit allen TOPs als Accordion (ausklappbar). Pro TOP editierbare Felder: Vorbemerkung, Beschlussantrag, Diskussionsnotiz + Abstimmungs-Zusammenfassung (MEA ja/nein/enth. mit Objektanzahl und %). `_etvFollowSaveTop(id)` speichert per UPSERT in `etv_agenda_items` (liest `result_note`, nicht `discussion_note`).
- **Formalia-Sektion:** Read-only Zusammenfassung (Beginn, Ende, Ort, VL, Prot.) mit "Bearbeiten"-Link → `_etvProtocolModal()`.
- **Unterzeichner-Eingabe:** 4 Felder (VL, PF, Beirat 1, Beirat 2) — vorbelegt aus Session, Beirat-Felder leer. Werden bei PDF-Generierung in `etv_sessions` gespeichert.
- **Freigabe-Toggle:** "Im Portal freigeben" — Checkbox in UI. Wenn aktiv: PDF wird in Storage hochgeladen + `documents`-Eintrag mit `status='released'` angelegt.
- **`generateETVProtokollPDF()` komplett neu geschrieben:**
  - Seite 1: Anschreiben (DIN 5008, Briefbogen, Standard-Text mit Anlage-Zeile)
  - Seite 2: Protokoll-Kopf (Formalia-Box, Beschlussfähigkeits-3-Spalten-Tabelle MEA/Einheiten/Anteil, TOP-Kurzübersicht)
  - Seiten 2ff: TOPs — Design analog Einladungs-PDF (shared helpers `_pdfDrawTopHeader` + `_pdfDrawSection`), olive Labels size 11, Feststellung+Verkündung mit Metadaten-Zeilen + MEA-Ergebnis-Zeilen + Einheiten-Spalte, Ergebnis-Banner (grün/rot), Diskussionsnotiz, Trennlinie zwischen TOPs
  - Letzte Seite: 2×2 Unterschriften-Felder mit Name oder Platzhalter `______ (Hier Name in Druckbuchstaben einfügen)`, Datum-Linie, olive Hinweis-Box §24 Abs. 6 WEG
  - `publishNow=true`: Upload zu `{buildingId}/Protokoll_ETV_{fy}.pdf` in documents-Bucket + documents-DB-Eintrag `status='released'`
- **`_etvSetTab()` jetzt async:** Lädt `etv_votes` beim ersten Wechsel zu Tab 3 (gecacht in `_etvState.votes`, Reset bei `_etvOpenSession`).
- **`_etvCloseSession()` gefixt:** Schließt Session und wechselt direkt zu Tab 3 (kein Redirect auf Startseite mehr).
- **Shared PDF-Helpers in `utils-pdf.js`:** `_pdfDrawTopHeader()` (olive Balken, dynamische Höhe, weiße Schrift) + `_pdfDrawSection()` (olive Label size 11 + mehrzeiliger Text mit Seitenumbruch-Handling) — gemeinsam genutzt von Einladungs- und Protokoll-PDF.
- **Protokoll-Anschreiben (Seite 1) im Dokumentendesigner editierbar:** Template-Typ `etv_protokoll`. Migration `migration_etv_protokoll_template.sql`. DIN-5008-Kopf (Adressfeld, Datum, Betreff) bleibt fest; der Brieftext darunter nutzt `generateFromTemplate()` mit Legacy-Fallback. Platzhalter: `{{datum_versammlung}}`, `{{gebaeude_name}}`, `{{gebaeude_adresse}}`, `{{wirtschaftsjahr}}`, `{{firma}}`, `{{datum_heute}}`.

### Phase 5.8 Protokoll-Upload Bugfixes (2026-05-12)

Kette von Folgefehlern beim erstmaligen Testen des "Im Portal veröffentlichen"-Toggles in `generateETVProtokollPDF`. Alle 4 Fehler behoben:

**1. publishNow-Block (`utils-pdf.js` v20260511o):**
- Fehlende INSERT-Felder `file_size` + `generated_filename` ergänzt.
- Falscher Spaltenname `storage_path` → `file_path` korrigiert.
- Upload- und DB-Fehler getrennt behandelt (eigene `console.error`-Logs).

**2. `documents.status` CHECK-Constraint (`fix_documents_status_check_add_released`):**
- Constraint kannte nur `draft/active/archived`, nicht `released`.
- Alle INSERTs mit `status='released'` schlugen still fehl (betrifft auch `_pdfSplitAndUpload` für WP/JAB).

**3. Storage UPDATE-Policy (`fix_storage_documents_update_policy`):**
- Beim zweiten Generieren versuchte `upsert:true` ein UPDATE auf `storage.objects` — Policy fehlte komplett.

**4. RLS SELECT-Policies (`fix_rls_documents_released_visibility`):**
- `docs_select_owner`, `docs_select_tenant`, `landlord_read_own_documents` hatten `status='active'` hardcoded.
- Protokoll-PDFs und JABs mit `status='released'` waren für Eigentümer/Mieter unsichtbar.
- Fix: `status IN ('active', 'released')` in allen drei Policies.

**5. Gebäude-Filter in Dokumenten-Cloud (`mod-dokumente.js` v20260511p):**
- `_populateBuildingFilter()`: Nicht-Admins sahen alle Gebäude im Filter, nicht nur eigene.
- Fix: Filter auf Gebäude beschränkt, die tatsächlich in den (RLS-gefilterten) Dokumenten vorkommen.

### Phase 7.7 — SSOT-Audit
`getMonthlyHausgeld()` berechnet Hausgeld dynamisch aus WP + Verteilerschlüssel (3 Module umgestellt). Basiszins + Mahngebühren aus `global_settings`. Heizkosten-Split aus `distribution_keys.heiz_split_percent`. ETV-Quorum konfigurierbar (`etv_sessions.quorum_percent`, Migration `migration_etv_quorum_percent.sql`). 16 zentrale Enum-Konstanten in `config.js`, 10 Module umgestellt.

### Phase 1C-A — Mobile-Fundament (Bottom-Nav, Scroll-Containment, Skeleton)
**Architektur-Entscheidungen:** (1) Hamburger-Menü mobil komplett durch Bottom-Nav ersetzt; Sidebar wird über "Mehr"-Item als Slide-In geöffnet. (2) Gesten via Vanilla-JS `touch*`-Events, passive Listeners (vorbereitet für Phase B). (3) Scroll-Containment: Body `h-screen overflow-hidden`, Main `flex-1 min-h-0 overflow-hidden`, Content-Area einziger Scroll-Container (`flex-1 min-h-0 overflow-y-auto`).

`dashboard.html`: Layout-Fix (Body h-screen, Main flex-1, kein doppeltes overflow-y-auto). Mobile-Header ohne Hamburger (Logo + Role-Label). Desktop-Header auf Mobile kompakt (nur Avatar). Bottom-Nav (`#bottom-nav`, md:hidden). CSS: `.bnav-item`/`.bnav-active` (Active-Dot), `.skeleton`/`@keyframes sk-shimmer`, Safe-Area-Inset. Toast-Position `bottom-20 md:bottom-6`.

`nav.js`: `renderBottomNav(role)` (5 Items rollenbasiert: admin/manager, tenant, owner/landlord/advisory). `bottomNavGo(fnName, el)` (Active-State + Sidebar-Sync). `_syncBottomNav(fnName)` (Sidebar→Bottom-Nav, Fallback "Mehr"). `_setBnavBadge(id, count)` (Badge-Sync Sidebar↔Bottom-Nav).

`utils.js`: `showSkeleton({ rows, type })` — Typen: `list` (Avatar + Text), `cards` (Block-Platzhalter), `table` (Header + Zeilen).

`config.js`: `icons.more` (Hamburger-SVG für Bottom-Nav "Mehr"-Item).

### Phase 1C-B — Bottom Sheets, Modal-Migration, Skeleton-Integration
`utils.js`: `showModal(id, contentHtml, options)` — Desktop: zentriertes Modal (scale-in). Mobile: Bottom Sheet (slide-up, `rounded-t-[15px]`, max-h-85vh). `hideModal(id)` mit Animate-Out. `_addSwipeToDismiss(modal)` (Swipe-Down-to-Dismiss, Threshold 80px, passive touch-Listeners). Escape-Key-Handler.

`dashboard.html`: CSS `.modal-sheet` (transition transform 0.3s) + `.modal-inner` (transition transform/opacity 0.2s).

**Modal-Migration (8 Modals in 3 Modulen):**
- `mod-tickets.js`: `showCreateTicketModal` → `showModal()`. Grid `grid-cols-1 md:grid-cols-2`.
- `mod-dokumente.js`: 3 Modals (`doc-detail-modal`, `doc-edit-modal`, `doc-upload-modal`) → `showModal()`.
- `mod-kontakte.js`: 4 Modals (`contact-detail-modal`, `contact-form-modal`, `add-persons-prompt`, `contact-person-form-modal`) → `showModal()`.

**Skeleton-Loader:** Dashboard-Spinner (Admin + User) durch Skeleton-Platzhalter ersetzt (4 KPI-Blocks + Widget-Blocks).

### Phase 1C-C — Responsive Tables, Ticket-Chat-Fix, Touch-Targets
`dashboard.html`: CSS `.rtable` Pattern — auf Mobile (< 768px) werden `<table>` automatisch in gestapelte Cards umgewandelt. `<thead>` versteckt, `<tr>` als Card mit border-radius, `<td>` als Flex-Row mit `data-label`-Pseudo-Element. `.td-action` für volle Breite bei Button-Spalten. `.td-hide-mobile` zum Ausblenden.

`utils.js`: `makeTableResponsive(elOrId)` — liest `<th>`-Texte, setzt `data-label` auf `<td>`, erkennt Action-Spalten automatisch (Buttons/Links), fügt `.rtable`-Klasse hinzu.

**Tabellen-Migration (26 Aufrufe in 8 Modulen):**
- `mod-personen.js`: Personen-Tabelle
- `mod-objekte.js`: Einheiten-Liste, Bankkonten, Verteilerschlüssel (3 Tabellen)
- `mod-tickets.js`: Ticket-Liste, Suchergebnisse
- `mod-dokumente.js`: Dokument-Liste
- `mod-dashboard.js`: Widget-Tabellen (Admin + User Dashboard)
- `mod-finanzen.js`: 14 Tabellen (Konten, Journal, Zähler, Sollstellungen, WP, JAB, Mahnwesen, CSV, SEPA, Rücklage, Beirat)
- `mod-zeiterfassung.js`: Zeit-Historie
- `mod-etv.js`: ETV-Staging

**Ticket-Chat-Fix:** Card `h-[calc(100dvh-160px)]` mit `overflow-hidden`. Chat-Bereich `min-h-0` für korrektes Flex-Shrinking. Info-Sidebar als Overlay auf Mobile (`max-lg:absolute max-lg:inset-0`), "Zurück zum Chat"-Button.

**Touch-Target 44px Audit (mod-tickets.js):** 13 Korrekturen: Create-Button, Filter-Buttons, Gebäude-Filter, Suchfeld, Zurück-Button, Info-Toggle, Send-Button, Modal-Close, Status-Select, Assignee-Select, Deep-Links, Eskalation-Button.

### Phase 1B-PoC — Multi-Page-Architektur (Zeiterfassung)
**Architektur-Entscheidungen:**
- **Shared Layout:** Externe HTML-Seiten haben identische DOM-Struktur (Sidebar, Header, Content-Area, Bottom-Nav). `nav.js` injiziert Navigation in dieselben Container-IDs — keine redundante Kopie.
- **Asset-Loading:** Direkte `<script>`-Tags pro Seite, kein dynamischer Loader. Jede Seite lädt nur benötigte Module.
- **Navigation:** `_navItem()` erzeugt automatisch `onclick` (SPA auf Dashboard) oder `href` (Cross-Page). Auf externen Seiten zeigen SPA-Links auf `dashboard.html?m=loadXxx`.
- **Active-State:** Auf Dashboard per `setActiveNav()` onclick-Handler. Auf externen Seiten per `_getCurrentPage()`-Match im `_navItem()`.
- **Deep-Linking:** Dashboard liest `?m=`-Parameter und ruft das Modul direkt auf. Module lesen `?building=`-Parameter.
- **Shared State:** `sessionStorage.hb_active_building` wird bei Gebäude-Wechsel gesetzt und von externen Seiten als Fallback gelesen.
- **Auth-Guard:** `EXTERNAL_PAGE_ROLES` in config.js → `init()` prüft Rolle und redirected zu dashboard.html.

**Geänderte Dateien:**
- `config.js`: `EXTERNAL_PAGES` (Routing-Map), `EXTERNAL_PAGE_ROLES` (Auth-Guard), `_getCurrentPage()`, `_isExternalPage()`, `_syncBuildingToSession()`.
- `nav.js`: Komplett refactored. `_navItem()` (Multi-Page-Link-Generator), `init()` (Page-Detection, Auth-Guard, Deep-Link-Routing, PAGE_INIT), `renderNav()` (über `_navItem` statt hardcoded onclick), `bottomNavGo()` (Cross-Page-Navigation, sessionStorage-Sync), `renderBottomNav()` ("Mehr"-Active auf externen Seiten).
- `mod-zeiterfassung.js`: Building-Kontext aus URL-Param (`?building=`) > `sessionStorage` > erster in Liste. `_timeChangeBuilding()` synct zu sessionStorage.
- `dashboard.html`: `mod-zeiterfassung.js` Script-Tag entfernt (Kommentar-Platzhalter), Cache-Buster `v=20260401c`.
- Neu: `zeiterfassung.html` — eigenständige HTML-Shell, lädt nur `config.js`, `utils.js`, `utils-pdf.js`, `mod-zeiterfassung.js`, `nav.js`. Identisches Layout wie `dashboard.html`. Logo/Header linken zurück zu `dashboard.html`.

### Phase 1B — Komplett-Migration (ETV + Finanzen)
**Strategie-Änderung:** Dokumente bleiben im Dashboard (nahtloser Mieter/Eigentümer-Zugriff). Nur 3 Module werden extrahiert.

**Geänderte Dateien:**
- `config.js`: `EXTERNAL_PAGES` um `loadETV`→`etv.html` und `loadFinance`→`finanzen.html` erweitert. `EXTERNAL_PAGE_ROLES` mit `advisory` für Finanzen (Belegprüfung).
- `nav.js`: `PAGE_INIT` um `etv` und `finanzen` erweitert.
- `mod-etv.js`: Building-Kontext aus URL-Param > sessionStorage > Default. `_etvOnBuildingChange()` synct zu sessionStorage.
- `mod-finanzen.js`: Building-Kontext + **Tab-Deep-Linking** (`?building=17&tab=buchungen`). 13 gültige Tab-Keys validiert. `_finOnBuildingChange()` synct zu sessionStorage.
- `dashboard.html`: `mod-finanzen.js`, `mod-etv.js` Script-Tags entfernt. **Bonus:** `pdf-lib`, `fontkit`, `utils-pdf.js` ebenfalls entfernt (keine PDF-Nutzer mehr im Dashboard) → schnellere Ladezeit.
- Neu: `etv.html` — eigenständige HTML-Shell, lädt `config.js`, `utils.js`, `utils-pdf.js`, `mod-etv.js`, `nav.js` + PDF-Libs (Einladungs-/Protokoll-PDF).
- Neu: `finanzen.html` — eigenständige HTML-Shell, lädt `config.js`, `utils.js`, `utils-pdf.js`, `mod-finanzen.js`, `nav.js` + PDF-Libs (WP/JAB/Mahnung-PDFs).

**Architektur-Ergebnis Phase 1B:**
Dashboard-Payload von ~15 Scripts auf ~10 reduziert (+3 CDN-Libs entfernt). Jede externe Seite lädt nur 5 eigene + 3 CDN-Scripts. Navigation, Active-State und Building-Kontext funktionieren nahtlos über Seitengrenzen hinweg.

### Phase 7.10 — PDF-Vorlagen-System (Dokumenten-Designer)
Migration `migration_pdf_templates.sql`: `pdf_templates`-Tabelle (type UNIQUE, name, description, content JSONB, use_letterhead BOOLEAN). RLS: lesen=authenticated, schreiben=admin. Default-Template: Mahnung (17 Blöcke).

**Architektur-Entscheidungen:**
- **JSON-Block-Struktur:** `content` ist ein Array von Block-Objekten `[{type, ...props}]`. Blocktypen: `heading`, `text`, `table`, `spacer`, `page_break`, `hint_box`. Erweiterbar durch neue Typen ohne Schema-Migration.
- **Platzhalter-System:** `{{variable_name}}`-Syntax, Parser per Regex. Unbekannte Platzhalter bleiben stehen (sichtbar im Preview). Variablen pro Template-Typ definiert in `PDF_TEMPLATE_VARIABLES`.
- **Tabellen-Datenquellen:** `table`-Blöcke referenzieren eine `source` (z.B. `offene_posten`). Spalten mit `width` (0–1 relativ), `align`, `format` (z.B. `eur`). Daten werden vom Caller übergeben (nicht vom Template geladen).
- **Template-Cache:** `_pdfLoadTemplate()` cached pro Session, `_pdfClearTemplateCache()` invalidiert nach Speichern im Designer.
- **Live-Preview:** Debounced (600ms). Nutzt Dummy-Daten aus `PDF_PREVIEW_DUMMY_DATA`. Rendert PDF via `pdf-lib` im Browser, zeigt als Blob-URL in `<embed>`.
- **Legacy-Fallback:** `generateMahnungPDF()` prüft ob ein `mahnung`-Template existiert. Wenn ja → Template-Engine. Wenn nein → hardcoded Layout bleibt erhalten.

**Geänderte Dateien:**
- `utils-pdf.js`: `_pdfReplacePlaceholders()` (Platzhalter-Parser), `generateFromTemplate()` (Block-Renderer mit Seitenumbruch-Logik), `_pdfLoadTemplate()` / `_pdfClearTemplateCache()` (DB-Zugriff + Cache), `PDF_PREVIEW_DUMMY_DATA` (Mahnung-Vorschaudaten), `PDF_TEMPLATE_VARIABLES` / `PDF_TEMPLATE_TABLES` (Variablen-/Tabellen-Definitionen). `generateMahnungPDF()` umgestellt auf Template-First mit Legacy-Fallback.
- `mod-settings.js`: Tab-Navigation (Allgemein | Dokumenten-Designer). Designer: Template-Selektor, Block-Editor (inline-editierbar, Drag & Drop, Hoch/Runter/Löschen), Variablen-Palette (klicken zum Einfügen), Live-Preview (Splitscreen, Debounced PDF-Rendering), Briefbogen-Checkbox, Speichern-Button.
- `dashboard.html`: CSS für `.ds-block` (Drag-Transition, Ring-Highlight). Cache-Buster für `mod-settings.js`.
- `etv.html`, `finanzen.html`, `zeiterfassung.html`: Cache-Buster für `utils-pdf.js`.
- Neu: `scripts/migration_pdf_templates.sql` — Tabelle + RLS + Default-Mahnung-Template.

### Phase 7.10.1 — Einzelwirtschaftsplan auf Template-System migriert
Migration `migration_pdf_templates_wp.sql`: Default-Template `einzelwirtschaftsplan` (19 Blöcke: Titel, Meta-Info, Eigentümer, Hausgeld-Summary, Umlageschlüssel, Verteilung, Hinweis-Box).

**Geänderte Dateien:**
- `utils-pdf.js`: `PDF_PREVIEW_DUMMY_DATA.einzelwirtschaftsplan` (Dummy-Daten für Live-Preview). `PDF_TEMPLATE_VARIABLES.einzelwirtschaftsplan` (17 Platzhalter). `PDF_TEMPLATE_TABLES.einzelwirtschaftsplan` (3 Tabellen: hausgeld_summary, umlageschluessel, verteilung). `generateEinzelwirtschaftsplanPDF()` umgestellt auf Template-First mit Legacy-Fallback (analog Mahnung-Pattern). Template-Pfad: pro Einheit Platzhalter + Tabellendaten berechnen → `generateFromTemplate()` mit Bulk-PDF-Support (aptPageRanges, ETV-Staging).
- Neu: `scripts/migration_pdf_templates_wp.sql` — Default-Template für Einzelwirtschaftsplan.

### Phase 7.10.2 — Jahresabrechnung auf Template-System migriert
Migration `migration_pdf_templates_jab.sql`: Default-Template `jahresabrechnung` (zweigeteilt via `page_break`: Anschreiben + Einzelabrechnung).

**Architektur:** Anschreiben (Seite 1) mit DIN 5008 (Absender, Empfänger, Datum) — DIN-Elemente werden VOR `generateFromTemplate()` auf die erste Seite gezeichnet, Template startet bei `startY = height - 200`. Nach `page_break` folgt die Einzelabrechnung (Abrechnungsergebnis, Umlageschlüssel, Verteilung).

**Geänderte Dateien:**
- `utils-pdf.js`: `PDF_PREVIEW_DUMMY_DATA.jahresabrechnung` (Dummy-Daten mit Guthaben-Szenario). `PDF_TEMPLATE_VARIABLES.jahresabrechnung` (24 Platzhalter inkl. saldo_label, saldo_info, bgh_hinweis). `PDF_TEMPLATE_TABLES.jahresabrechnung` (3 Tabellen: abrechnungsergebnis, umlageschluessel, verteilung). `generateJahresabrechnungPDF()` umgestellt auf Template-First mit Legacy-Fallback. Template-Pfad: pro Einheit Saldo berechnen + DIN 5008 zeichnen → `generateFromTemplate()` mit Bulk-PDF-Support (aptPageRanges, ETV-Staging).
- Neu: `scripts/migration_pdf_templates_jab.sql` — Default-Template für Jahresabrechnung.

### Phase 6.15-A — Journal-Sperre für abgeschlossene Wirtschaftsjahre
`mod-finanzen.js`: Zwei neue Hilfsfunktionen `_finIsYearClosed(buildingId, fiscalYear)` und `_finBlockIfYearClosed(buildingId, fiscalYear)`. Prüft `budget_plans.status = 'closed'` für das Gebäude + Jahr.

**Abgesicherte Insert-Stellen (5):**
- `_finSubmitBooking()` — Manuelle Buchungen
- `_finGenerateDemands()` — Sollstellungs-Generierung
- `_finBuchenRuecklage()` — Rücklage Zu-/Entnahmen
- `_finCreateDunning()` — Mahngebühr-Buchung
- `_finNoticePaidConfirm()` — Mahnzahlungs-Buchung

**Bewusst NICHT gesperrt (GoBD-konform):** `_finStorno()` und `_finNoticeReverse()` — Stornierungen müssen in abgeschlossenen Jahren weiterhin als Gegenbuchung möglich sein.

**UI:** Visuelles Lock-Banner (orange, Schloss-Icon) im Journal-Tab bei gesperrtem Jahr. Buchungsmaske wird ausgegraut (`opacity-50 pointer-events-none`).

### Phase 6.15-B — Vermögensbericht (§ 28 WEG) als JAB-Step 1
Migration `migration_financial_statements.sql`: Neue Tabelle `financial_statements` (building_id, fiscal_year, account_id, system_balance, statement_balance, difference GENERATED, is_validated, validated_at). UNIQUE-Constraint auf (building_id, fiscal_year, account_id).

**JAB-Wizard Umbau:** Von 5 auf 6 Steps erweitert. Neuer Step 1 = Vermögensbericht, alle bisherigen Steps um 1 nach hinten verschoben. Step-Labels im Stepper-Dot: Vermögen → Zeitraum → Ist-Daten → Schlüssel → Soll/Ist → Abschluss.

**Step 1 — Vermögensbericht:**
- **Phase A (Laden):** Bank-/Rücklagenkonten (asset, 1xxx) identifizieren. System-Saldo per Journal-Aggregation bis Stichtag 31.12. Bestehende `financial_statements` laden (falls bereits gespeichert). Offene Forderungen (`payment_demands` mit Status open/overdue) zum Stichtag.
- **Phase B (Speichern):** Eingetragene Bankstände per `UPSERT` in `financial_statements`. Auto-Validierung bei Differenz < 0,01 €.
- **UI:** Saldenabgleich-Tabelle (System-Saldo | Eingabefeld Auszug | Differenz | ✓-Status). Forderungen-Tabelle mit Inline-Stornierung. Grüner Haken bei Übereinstimmung.
- **Helpers:** `_finVSUpdateRow()` (Live-Update), `_finVSStornoDemand()` (Sollstellung stornieren).

**Geänderte Dateien:**
- `mod-finanzen.js`: 6-Step-Wizard, neue Step1Html (Vermögensbericht), Step-Nummern in allen Zurück/Weiter-Buttons und `_finJABNext()` aktualisiert. `_finJABStep2Html`–`_finJABStep6Html` (umbenannt). ~200 Zeilen neu.
- Neu: `scripts/migration_financial_statements.sql` — Tabelle + Index.

### Phase 6.15-C — Beirat-Prüfprotokoll
Migration `migration_audit_protocols.sql`: Neue Tabelle `audit_protocols` (building_id BIGINT, fiscal_year, auditor_id UUID, status, check_date, findings, is_formally_correct, signature_data JSONB). UNIQUE(building_id, fiscal_year, auditor_id). + `global_settings.audit_hint_text` Spalte.

**Beirat-View (`_finRenderBeiratView`) erweitert:**
- **Hinweisbox** (orange) oberhalb des Journals mit Text aus `global_settings.audit_hint_text` (Default-Text als Fallback).
- **Prüfprotokoll-Formular:** Ergebnis (Ordnungsgemäß/Beanstandung), Prüfungsumfang, Feststellungen (Pflicht bei Beanstandung). Per UPSERT gespeichert. Digitale Signatur-Metadaten (Timestamp, User-Agent) in `signature_data` JSONB.
- **Nach Abgabe:** Formular wird durch Read-Only-Ansicht des eingereichten Protokolls ersetzt.

**Admin-Belegprüfung (`_finLoadBelegpruefung`) erweitert:**
- Lädt `audit_protocols` parallel mit. Zeigt Prüfprotokoll-Tabelle (Prüfer, Datum, Ergebnis, Umfang, Feststellungen) zwischen Freigabe-Verwaltung und Buchungsvorschau.

**Geänderte Dateien:**
- `mod-finanzen.js`: Beirat-View komplett überarbeitet (~120 Zeilen), `_finBeiratSubmitProtocol()` neu, Admin-Belegprüfung um Protokoll-Anzeige erweitert.
- Neu: `scripts/migration_audit_protocols.sql` — Tabelle + RLS + Index + global_settings-Spalte.

### Phase 6.15-D — Dokumenten-Status-Lifecycle (draft→released)
Migration `migration_documents_staging.sql`: `documents.metadata` JSONB-Spalte (Default `{}`). Status `released` als neuer Wert neben `draft`/`active`.

**`_pdfSplitAndUpload()` komplett überarbeitet:**
- Neben Storage-Upload wird jetzt ein `documents`-DB-Eintrag erstellt: `status:'draft'`, `visibility_scope:'unit'`, `category:'Wirtschaftsplan'/'Jahresabrechnung'`, `metadata:{doc_type, fiscal_year, unit_id}`.
- Bei erneutem Upload (gleicher `file_path`): vorhandenes Dokument wird aktualisiert statt dupliziert.
- Toast-Text: "als Entwurf gespeichert" statt "für ETV gespeichert".

**Dokument-Sichtbarkeit:** Bereits korrekt implementiert — `mod-dokumente.js` filtert `.neq('status', 'draft')` für Nicht-Admins. Status `released` ist dadurch automatisch sichtbar. Admins sehen alle Status inkl. Draft-Filter-Chip.

**Status-Flow:** `draft` (bei PDF-Generierung) → `released` (bei ETV-Einladungsversand, implementiert in 6.15-G).

### Phase 6.15-E — JAB-PDF: Monatsübersicht + Vermögensbericht
Migration `migration_jab_template_v2.sql`: UPDATE des `jahresabrechnung`-Templates. 3 Seiten: Anschreiben → Einzelabrechnung (mit Monats-Matrix) → Vermögensbericht.

**Neue Tabellen-Quellen (3):**
- `jab_monats_matrix`: 12 Monatszeilen (Soll-Hausgeld, Ist-Zahlung, Differenz) + Gesamt-Zeile. Daten aus `payment_demands` (Soll pro Monat) + `journal_entries` auf Konto 1400 (Ist-Zahlungen pro Monat).
- `vermoegen_konten`: Bank-/Rücklagenkonten aus `financial_statements`. Saldo + Prüfstatus.
- `vermoegen_forderungen`: Offene `payment_demands` zum Stichtag 31.12. + Gesamt-Zeile.

**Geänderte Dateien:**
- `utils-pdf.js`: `_buildMonatsMatrix()` (Monatsdaten-Aggregation), Vermögensbericht-Datenload (einmalig vor Einheiten-Schleife). `PDF_TEMPLATE_TABLES.jahresabrechnung` um 3 Einträge erweitert. `PDF_PREVIEW_DUMMY_DATA.jahresabrechnung` um 3 Dummy-Tabellen. ~80 Zeilen neu.
- Neu: `scripts/migration_jab_template_v2.sql` — Template-UPDATE (kein INSERT, da Template bereits existiert).

### Phase 6.15-F — ETV-Kopplung & Kombi-PDF + Dokument-Freigabe
**Kombi-PDF** (bereits vorhanden): `generateETVEinladungPDF()` generiert pro Eigentümer ein zusammengeführtes PDF: Einladung + Tagesordnung + Vollmacht + WP/JAB-Anlagen (aus `etv-staging/`). Die Anlagen werden per `apartment_id` dem richtigen Eigentümer zugeordnet.

**Neu: Status-Trigger** (Zeile 3523–3539 in `utils-pdf.js`):
- Nach PDF-Download: alle `documents` mit `status='draft'` und `category IN ('Wirtschaftsplan', 'Jahresabrechnung')` des Gebäudes werden auf `status='released'` geschaltet.
- Toast zeigt Anzahl freigeschalteter Dokumente an.
- Error-Handling: Bei Fehler wird trotzdem das PDF ausgeliefert + Warnung gezeigt.

**Neu: Confirm + Fortschritt** (`mod-etv.js`):
- Confirm-Dialog warnt: "Dokumente werden für Eigentümer freigeschaltet"
- Button wechselt zu "Kombi-PDFs werden generiert…" + disabled während der Verarbeitung.

### Phase 6.15-G — Beschluss-Aktivierung (Post-ETV)
Migration `migration_hausgeld_history.sql`: Neue Tabelle `hausgeld_history` (building_id, apartment_id, old_hausgeld, new_hausgeld, change_reason, fiscal_year, changed_by, changed_at). RLS: admin/manager.

**`_finActivateBeschluss()` (mod-finanzen.js, ~100 Zeilen):**
Button "Beschlüsse aktivieren" in JAB Step 6 (neben "Abrechnung abschließen"). Confirm-Dialog mit 3-Punkte-Zusammenfassung. Führt 3 Aktionen aus:

1. **Sollstellungen für Abrechnungsspitzen:** Pro Einheit `payment_demands` mit `demand_type='nachzahlung'/'guthaben'`, Fälligkeit 14 Tage nach Klick. Nur wenn `|saldo| > 0.01`.
2. **Hausgeld-Update aus WP:** Sucht aktiven/approved WP für Folgejahr. Berechnet neues monatliches Hausgeld pro Einheit (Summe aller Planpositionen × Schlüsselanteil / 12). Aktualisiert `apartments.hausgeld` nur bei tatsächlicher Änderung.
3. **Historisierung:** Pro Hausgeld-Änderung ein Eintrag in `hausgeld_history` (alt/neu/Grund/FY/User).

**Geänderte Dateien:**
- `mod-finanzen.js`: `_finActivateBeschluss()` neu, Button in Step 6 HTML.
- Neu: `scripts/migration_hausgeld_history.sql` — Tabelle + RLS + Index.

### Rollenbausteine-Refactoring (landlord/advisory → Flags)
Migration `migration_role_refactor.sql`: `profiles.is_landlord` BOOLEAN. `profiles.role` CHECK von 6→4 Rollen (admin/manager/owner/tenant). Bestehende `landlord`-User → `owner` + `is_landlord=true`, `advisory`-User → `owner` (board_members-Eintrag bleibt). 3 RLS-Policies auf `is_landlord` umgestellt.

**Architektur-Entscheidung:** Landlord und Advisory sind keine eigenen Rollen, sondern additive Features auf der Basis-Rolle `owner`. Ein Owner kann gleichzeitig Vermieter (`is_landlord=true`) UND Beirat (`board_members`-Eintrag für spezifische Gebäude) sein.

**Geänderte Dateien:**
- `config.js`: `ROLE_LABELS` von 6→4 Einträge, `EXTERNAL_PAGE_ROLES.finanzen` auf `owner` statt `advisory`.
- `nav.js`: `init()` lädt `is_landlord` + `board_members` → setzt `_isLandlord`/`_isAdvisory` Flags. `renderNav()`: Owner-Block mit konditionalen Landlord/Advisory-Sektionen statt 3 separaten Blöcken. Auth-Guard berücksichtigt `_isAdvisory`. Role-Label kombiniert (z.B. "Vermieter & Beirat").
- `mod-tickets.js`: `role === 'landlord'` → `userProfile._isLandlord`. `isTenantOrOwner` vereinfacht.
- `mod-dashboard.js`: Hausgeld-Anzeige auf `role === 'owner'` vereinfacht.
- `mod-persons-edit.js`: Rollen-Dropdown von 6→4 Optionen. Neue Checkbox "Vermieter" (`is_landlord`). Hinweistext "Beirat-Zugang über Gebäude-Zuweisung". Speicherlogik um `is_landlord` erweitert.
- Neu: `scripts/migration_role_refactor.sql` — Spalte, Datenmigration, CHECK-Constraint, RLS-Policies.

### Ticket-System Erweiterungen (Rollen-Test)
- Ticket-Routing: Tenant→Landlord automatisch, Landlord→Tenant via Pill-Toggle, Owner→Verwalter via Eskalation.
- Empfänger-Dropdown für Admin/Manager (alle Eigentümer/Vermieter des Gebäudes).
- Ticket-Beschreibung wird als erste Chat-Nachricht eingefügt.
- Gebäude/Einheit-Felder für Tenants mit nur 1 Einheit ausgeblendet.
- Gebäude-Filter in Ticket-Sidebar auf eigene Gebäude beschränkt.
- Deep-Links (Gebäude/Einheit) nur für Admin/Manager klickbar.
- Schwarzes Brett für alle Rollen in Sidebar sichtbar.
- RLS: SELECT-Policies für profiles, buildings, apartments (alle authenticated), tickets (eigene+zugewiesene+admin).
- RPCs: `get_landlord_for_apartment`, `get_tenant_for_apartment`, `get_my_units_for_tickets`, `get_ticket_recipients`, `check_is_advisory`, `get_beirat_access` (alle SECURITY DEFINER).
- `mod-objekte.js`: Rollencheck am Einstieg (nur admin/manager).

### PDF-Template-Fixes (Tabellen-Rendering)
- Template-Engine `generateFromTemplate()`: Tabellen rendern jetzt **Zeile für Zeile** mit Seitenumbruch + Header-Wiederholung (statt all-or-nothing). Heading-Orphan-Schutz (60pt Reserve). `fmtEur()` mit `Number.EPSILON`-Trick gegen Floating-Point-Fehler. Heading-Abstand reduziert (steuerbar via `gap`-Property).
- Hint-Box: `title_size` Property für separate Titel-Schriftgröße. `**text**`-Syntax für Inline-Fettschrift.
- Migrations: `migration_fix_umlageschluessel_format.sql` (JAB/WP-Templates mit korrekter Blockfolge).

### Verwaltungsbeirat-UI im Gebäude-Detail
- Tab "Grundbuch": Neue Sektion "Verwaltungsbeirat" mit Liste aktiver Beiratsmitglieder, "Beirat hinzufügen" (Dropdown mit Eigentümern des Gebäudes), "Entfernen" (Soft-Remove via `valid_to`).
- Mehrere Beiräte pro Gebäude möglich (Vorsitz + Stellvertreter).

### Beirat-Belegprüfung Fixes
- `_finRenderBeiratView()`: Jahres-Switcher für mehrere Freigabezeiträume. Belege aus `journal_attachments` laden (statt nur `journal_entries.attachment_path`). Konto-Anzeige mit Fallback.
- RLS-Kaskaden-Fixes: SELECT-Policies für `board_members` (eigene), `beirat_access_periods` (eigene Gebäude), `journal_entries` (Beirat-Freigabe), `accounts` (Beirat-Gebäude), `journal_attachments` (Beirat-Belege), `audit_protocols` (eigene).

### Wirtschaftsjahr wieder öffnen
- WP-Tab: "Wieder öffnen"-Button bei Status `closed` → setzt auf `active`.
- JAB Step 6: "Sperre aufheben"-Button (ersetzt "Abschließen" wenn bereits gesperrt) → hebt `budget_plan`-Status + `journal is_locked` auf. Buttons kontextsensitiv.

### Feedback-Runde 9. April (Nachfixes)
- **News:** Client-seitige `visibility_scope`-Filterung entfernt — RLS filtert korrekt. Gebäudespezifische News jetzt für Eigentümer/Mieter sichtbar.
- **Kontakte:** Mieter sieht nur Notfallkontakte + vom Vermieter freigegebene. Tenant-Building-IDs aus `tenancies` statt `userProfile.apartment_id`.
- **Kontakte:** "Für Mieter freigeben"-Toggle nur für Landlords (`_isLandlord`), nicht für reine Owner.
- **Tickets:** Nicht-Admins sehen "Posteingang" (empfangene) + "Gesendet" (erstellte) statt gemischte Ansicht.
- **JAB Step 6:** `fiscalYear`-Fallback für Sperre-aufheben-Button.

### Test-User & Debugging
- `scripts/create_test_users.sql`: 4 Test-User (tenant, owner, landlord, advisory) mit Verknüpfungen für WEG Zeppelinstraße 8. Idempotent (Cleanup + Neuanlage).
- `scripts/debug_beirat_access.sql`: Diagnose-SQL für Beirat-Zugriffsprüfung.

### Phase 7.11 — Stammdaten-Dynamisierung (Quick-Wins)
- 7.11-A/B: Entscheidung: nicht umgesetzt — Bankdaten bereits über Briefbogen bzw. Mahnungstext abgedeckt.
- **7.11-C Verzugszins Auto-Berechnung:** Mahnlauf-Default auf `gsRate + 5` (§ 288 BGB) vorbelegt. Label "Basiszinssatz" → "Verzugszinssatz". Hint-Text zeigt Berechnungsformel.
- **7.11-D typeLabels zentralisiert:** `DISTRIBUTION_KEY_LABELS` in `config.js` (7 Typen: mea/sqm/units/consumption/persons/heizkosten/custom). 6 Stellen ersetzt: 2× `mod-finanzen.js` (distKeyLabel + Select-Options), 4× `utils-pdf.js` (_typeLabels/typeLabels).
- **7.11-E Mahngebühr-Verrechnungs-Hinweis:** Nach "Bezahlt"-Buchung bei Mahnungen mit Gebühr: Info-Toast nach 1,5s Delay ("Mahngebühr auf WEG-Konto gutgeschrieben — bitte Überweisung auf Verwalterkonto veranlassen").

### Phase 7.2 — E-Mail-Benachrichtigungen (Brevo)
Migration `phase72_email_notifications.sql`: `notification_preferences` (User-Opt-In/Out), `email_log` (DSGVO Audit-Trail), `global_settings` +3 Spalten.

**Architektur:**
- **E-Mail-Dienst:** Brevo (ex Sendinblue) — DSGVO-konform, Server in Deutschland, Free Tier 300/Tag.
- **Edge Function:** `send-notification` (Deno, Supabase Edge Functions). 1 Funktion für alle 4 Trigger-Typen. JWT-gesichert, nutzt service_role für DB-Zugriff + Brevo HTTP API (`api.brevo.com/v3/smtp/email`).
- **Frontend:** `sendNotification(type, payload)` in `config.js` — fire-and-forget, blockiert nie die UI.
- **Default:** Opt-In (alle Benachrichtigungen aktiv). User können einzelne Trigger unter "Mein Profil" deaktivieren.

**4 Trigger-Typen:**
| Trigger | Auslöser | Empfänger |
|---|---|---|
| `ticket_new` | `saveTicket()` in mod-tickets.js | assigned_to + Admins/Manager |
| `ticket_status` | `updateTicketStatus()` in mod-tickets.js | creator_id + assigned_to |
| `document_released` | `_publishDoc()` in mod-dokumente.js | Alle Nutzer des Gebäudes |
| `news_new` | `saveNews()` in mod-news.js | Alle Nutzer des Gebäudes (global: alle) |

**E-Mail-Adress-Auflösung:** `profiles.id` → `persons.auth_user_id` → `persons.email` (Fallback: `auth.users.email`).

**Geänderte Dateien:**
- `config.js`: `sendNotification()` Helper (fire-and-forget).
- `mod-tickets.js`: Trigger `ticket_new` nach `saveTicket()`, Trigger `ticket_status` nach `updateTicketStatus()`.
- `mod-dokumente.js`: Trigger `document_released` nach `_publishDoc()`.
- `mod-news.js`: Trigger `news_new` nach `saveNews()` (+ `.select('id').single()` Refactor).
- `mod-settings.js`: Neuer Tab "E-Mail" (Konfiguration, Trigger-Übersicht, E-Mail-Log mit Status-Badges).
- `mod-placeholder.js`: `loadProfile()` implementiert (Kontodaten read-only + 4 Benachrichtigungs-Toggles mit Upsert).
- Neu: `scripts/migration_email_notifications.sql`.
- Neu: Edge Function `send-notification/index.ts` (deployed via Supabase MCP).

