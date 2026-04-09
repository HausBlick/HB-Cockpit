### Als Admin (dein Account): ###

1. Personen-Editor: Rolle + Vermieter-Checkbox sichtbar? Personen korrekt speicherbar? \
**Niko:** Nein, bei den 4 Neuen lädt die Seite nur, wenn ich auf "Bearbeiten" gehe, es passiert nach dem Klick auf beabrbeiten nichts. Bei den alten Testpersonen im System komme ich in die Bearbeiten-Funktion wie gehabt aber ich finde die Checkbox nirgends. \
**Claude:** Error-Handling in `loadPersonForEdit()` eingebaut — ein stiller Fehler in den parallelen Queries ließ den Spinner hängen. Außerdem `profileIsLandlord` fehlte im Return-Objekt, deshalb war die Checkbox unsichtbar. Beides gefixt. \
**→ Bitte erneut testen:** Neue Test-Personen bearbeiten + Checkbox "Vermieter" sichtbar bei registrierten Usern (Tab "Portal")?

2. Gebäude → Grundbuch: Beirat hinzufügen/entfernen funktioniert? \
**Niko:** Ja das klappt bisher ganz gut. \
**Claude:** ✅ Kein Fix nötig.

3. WP-Tab: "Wieder öffnen" bei geschlossenem Jahr sichtbar? \
**Niko:** Ja, aber das wünsche ich mir auch für die JAB, damit dann die gesperrten Buchungen wieder geöffnet werden. \
**Claude:** JAB Step 6 hat bereits den Button "Sperre aufheben" — er erscheint nur wenn das Jahr gesperrt ist (kontextsensitiver Toggle). Man muss den JAB-Wizard bis Step 6 durchklicken um ihn zu sehen. \
**→ Bitte erneut testen:** JAB-Wizard für das gesperrte Jahr öffnen → Step 6 → "Sperre aufheben" sichtbar?

4. Ticket: Empfänger-Dropdown zeigt Eigentümer des Gebäudes? \
**Niko:** Ja und funktioniert dann auch mit dem Versand an den Eigentümer \
**Claude:** ✅ Kein Fix nötig.

### Als Mieter (Max — mieter@test.hausblick.de):
5. Dashboard lädt ohne Fehler? \
**Niko:** Sieht danach aus, dass alles erstmal klappt. \
**Claude:** ✅ Kein Fix nötig.

6. Ticket erstellen: Kein Gebäude/Einheit-Feld, geht direkt an Viktor? \
**Niko:** Ja, das sieht auch gut aus, wobei ich gerne die Gruppen noch etwas anpassen möchte. Ich möchte dass "Posteingang" statt "Meine Tickets" da steht und darunter nur die Tickets sichtbar sind, die der User selber erhält. In den anderen Gruppen sollen dann nur die Tickets stehen, die er versendet/erstellt hat hat. ("Meine erledigten Tickets" sollte dementsprechend dann "Erledigt im Posteingang" heißen) \
**Claude:** Komplett umgebaut. Nicht-Admins sehen jetzt 4 Gruppen: **Posteingang** (assigned_to = ich), **Gesendet** (creator_id = ich), **Erledigt im Posteingang**, **Erledigte Gesendete**. Admins behalten das bisherige Layout. Default-Ansicht ist "Posteingang" statt "Meine Tickets". \
**→ Bitte erneut testen:** Als Max: Posteingang/Gesendet sichtbar? Zähler korrekt? Tickets in der richtigen Gruppe?

7. Schwarzes Brett sichtbar + lesbar? \
**Niko:** Nein, komischerweise sehen alle 4 Testuser nur das eine globale Ticket, die anderen 4 Tickets, die dem Gebäude zugewiesen sind, werden von niemandem gesehen, ausser mir als verwalter. deswegen kann ich auch nicht testen, ob die "An meinen Mieter weiterleiten" funktioniert \
**Claude:** RLS-Problem — News hatte keine SELECT-Policy für Nicht-Admins. Neue Policy: Eigentümer/Mieter sehen globale News + News ihrer zugewiesenen Gebäude. **Migration `migration_rls_news_select.sql` muss ausgeführt werden.** \
**→ Bitte testen nach Migration:** Alle 4 User sehen gebäudespezifische News der Zeppelinstraße?

### Als Vermieter (Viktor — vermieter@test.hausblick.de):
8. Sidebar: "Meine Mieter" sichtbar? \
**Niko:** Ja, sichtbar, sollte aber hoch in den Menüpunkt "Mein Asset" unter "Meine Einheiten" und das Modul haben wir noch nicht geschrieben. \
**Claude:** "Meine Mieter" in Sidebar verschoben — jetzt unter "Mein Asset" direkt nach "Meine Einheiten". Modul `loadMyTenants` existiert als Platzhalter, muss noch gebaut werden (eigene Phase). \
**→ Bitte erneut testen:** Nav-Position korrekt?

9. Ticket erstellen: Pill-Toggle "Hausverwaltung / Mieter"? \
**Niko:** Ja, Funktioniert an Mieter (siehe Punkt 10) und an den Verwalter. \
**Claude:** ✅ Kein Fix nötig.

10. Ticket von Max empfangen und sichtbar? \
**Niko:** Ja, von Max an Viktor kommt bei Viktor nicht an, aber von Viktor an Max schon. \
**Claude:** Root-Cause gefunden: Die RPC `get_landlord_for_apartment` suchte nach `pr.role = 'landlord'` — diese Rolle existiert seit dem Refactoring nicht mehr. Gefixt auf `pr.is_landlord = true`. **Migration `migration_get_landlord_for_apartment.sql` muss erneut ausgeführt werden.** \
**→ Bitte testen nach Migration:** Als Max ein neues Ticket erstellen → landet es bei Viktor im Posteingang?

### Als Eigentümer (Erika — eigentuemer@test.hausblick.de):
11. Dashboard + Dokumente + Tickets ohne Fehler? \
**Niko:** Ja, sieht so aus, aber bei "Kontakte" hat der Eigentümer die Funktion "An meine Mieter freigeben", das sollte bei "nur" Eigentümer nicht so sein. \
**Claude:** Release-Toggle "Für Mieter freigeben" war für alle Owner sichtbar. Jetzt nur noch für Owner mit `_isLandlord = true` (Vermieter). Reine Eigentümer sehen den Toggle nicht mehr. \
**→ Bitte erneut testen:** Erika sieht keinen Release-Toggle, Viktor schon?

12. Eskalation "An Verwalter" funktioniert? \
**Niko:** Ja, allerdings sieht der Verwalter alle Tickets, auch die, die nicht an ihn eskaliert werden. Das sollte behoben werden. \
**Claude:** Das ist **by design** — Admin/Manager brauchen Überblick über alle Tickets (Helpdesk-Funktion). Der Default-Filter "Meine Tickets" zeigt aber nur eigene/zugewiesene. Die Status-Filter (Offen, In Bearbeitung etc.) zeigen bewusst alle, damit nichts untergeht. Wenn du das anders haben möchtest, können wir das in einer nächsten Runde besprechen.

### Als Beirat (Berta — beirat@test.hausblick.de):
13. Belegprüfung: Buchungen + Belege sichtbar? \
**Niko:** Ja, funktioniert. \
**Claude:** ✅ Kein Fix nötig.

14. Jahres-Switcher (2025/2026)? \
**Niko:** Ja, ist da \
**Claude:** ✅ Kein Fix nötig.

15. Prüfprotokoll ausfüllen + abgeben? \
**Niko:** Ja, das sehe ich dann auch als Verwalter (Was kann ich damit dann machen oder was passiert mit der Prüfung?) \
**Claude:** Das Prüfprotokoll dient als **digitale Dokumentation für die ETV**. Der Admin sieht es in Finanzen → Tab "Belegprüfung" unter den Freigabezeiträumen. Dort werden Prüfer, Datum, Ergebnis (ordnungsgemäß/Beanstandung) und Feststellungen angezeigt. Es fließt als Tagesordnungspunkt in die Eigentümerversammlung ein. Aktuell keine automatische Weiterverarbeitung — bei Bedarf kann das Protokoll in die ETV-Einladung oder das ETV-Protokoll eingebunden werden (Phase 5.8-F).

---

### Migrationen die vor dem nächsten Test ausgeführt werden müssen:
1. `migration_rls_news_select.sql` — News für alle Rollen
2. `migration_get_landlord_for_apartment.sql` — RPC-Fix für Tenant→Landlord-Routing
