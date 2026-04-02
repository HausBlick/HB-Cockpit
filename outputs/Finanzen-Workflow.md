# **Finanzen UX Workflow: Der Verwalteralltag**

Dieses Dokument beschreibt rein den **Nutzer-Workflow (User Experience)** des Verwalters, losgelöst von der technischen Datenbank-Struktur. Es beantwortet die Frage: _Wie klickt sich der Verwalter durch den Jahresabschluss?_

## **Ausgangssituation (Prämisse)**

Das laufende Wirtschaftsjahr (z.B. 01.01. bis 31.12.) ist beendet. Der Verwalter hat alle Bankkonten abgeglichen, alle Rechnungen verbucht (striktes Geldflussprinzip!) und die Zählerstände erfasst. Das Journal ist "sauber".

## **Phase 1: Der Vermögensbericht (Die gesetzliche Momentaufnahme)**

_Nach § 28 WEG (WEMoG) zwingend gefordert. Der Verwalter erstellt einen Stichtags-Nachweis über die tatsächliche Vermögenslage der WEG._

- **Schritt 1.1: Kontensalden prüfen (Girokonten)**
  - _UI-Workflow:_ Das System zeigt den errechneten System-Saldo zum Stichtag (31.12.) an. Der Verwalter tippt manuell den tatsächlichen Saldo laut Bankkontoauszug in ein Eingabefeld ein.
  - _Management by Exception:_ Stimmen die Werte überein (Differenz 0,00 €), erscheint ein grüner Haken und man klickt auf "Weiter". Nur bei einer Abweichung klappt eine Detailansicht (Journal-Auszug) auf, um fehlende Buchungen (z.B. Bankgebühren) nachzutragen.
- **Schritt 1.2: Status der Erhaltungsrücklage (Treuhandkonten)**
  - _UI-Workflow:_ Identisches Prinzip wie bei 1.1. Das System zeigt die virtuelle Entwicklung (Anfang + Zuführungen - Entnahmen = Endbestand). Dieser Endbestand muss mit dem echten, manuell eingetragenen Saldo des Bank-Rücklagenkontos abgeglichen und per Klick bestätigt werden.
- **Schritt 1.3: Forderungen und Verbindlichkeiten**
  - Das System generiert vollautomatisch eine Liste aller am Stichtag (31.12.) unbezahlten Sollstellungen (Hausgeldrückstände der Eigentümer) und noch offener Handwerkerrechnungen.
  - _UI-Workflow (Inline-Bearbeitung):_ Um den Flow nicht zu unterbrechen, kann der Verwalter direkt in dieser Ansicht eingreifen, ohne das Modul zu verlassen:
    - **Stornieren:** Fehlerhafte Sollstellungen oder Rechnungen direkt annullieren.
    - **Ausbuchen:** Kleinbeträge oder uneinbringliche Forderungen wertberichtigend ausbuchen.
    - **Ergänzen:** Vergessene oder nachträglich eingetroffene offene Posten manuell hinzufügen.

## **Phase 2: Die Jahresabrechnung (Das vergangene Jahr)**

_Der Verwalter startet den Prozess zur Verteilung der tatsächlichen Kosten auf die Eigentümer (Gesamt- und Einzelabrechnung)._

- **Schritt 2.1: Gesamtabrechnung & Kosten-Kategorisierung**
  - Zusammenstellung aller Einnahmen und Ausgaben.
  - Das UI muss zwingend zwischen _umlagefähigen Betriebskosten_ (nach BetrKV) und _nicht umlagefähigen WEG-Kosten_ (Verwaltung, Rücklagenzuführung) unterscheiden.
- **Schritt 2.2: Heizkosten & Externe Dienstleister (Die 3-Wege-Logik)**
  - Das System prüft die Gebäude-Stammdaten und bietet drei flexible Workflows an:
    - **Weg 1 (Keine Zentralheizung):** Sind Gasetagenheizungen/dezentrale Systeme verbaut, entfällt die Heizkostenabrechnung für die WEG. Dieser Schritt wird übersprungen.
    - **Weg 2 (Externer Messdienstleister wie Techem/Ista):** Der Verwalter übernimmt die finalen Werte des Dienstleisters. _UX-Optionen:_ Entweder per CSV-Import-Schnittstelle oder per manueller Schnelleingabe (Grid-Tabelle) der fertigen Heiz- und Warmwasserkosten pro Einheit.
    - **Weg 3 (Selbstabrechner):** Das System berechnet die Kostenverteilung selbst. Dabei zieht es sich die maximal flexiblen Vorgaben aus den Gebäudeeinstellungen:
      - _Aufteilungsquote:_ Dynamisch einstellbar (z.B. 70/30, 50/50).
      - _Freie Wahl der Schlüssel:_ Definition, welcher Schlüssel für die Grundkosten (z.B. MEA, Wohnfläche, Einheiten) und welcher für die Verbrauchskosten (z.B. Zählerwerte, Heizfläche) gilt.
      - _Härtefall-Option (Keine Zähler):_ Wenn eine Verbrauchserfassung wirtschaftlich unzumutbar ist, kann auch der "Verbrauchsanteil" über feste Schlüssel (z.B. Wohnfläche) verteilt werden.
- **Schritt 2.3: Berechnung der anteiligen Kosten & Schlüsselprüfung**
  - Das System visualisiert die Berechnungsgrundlage: (Kostenart Gesamtsumme / Gesamt-Menge des Schlüssels) \* Individueller Anteil der Einheit.
  - _Eigentümerwechsel (Das Fälligkeitsprinzip):_ Das System generiert rechtssicher nur _eine_ Abrechnung auf den Namen des zum Beschlusszeitpunkt aktuellen Eigentümers. Als Service für den internen Ausgleich zwischen Käufer und Verkäufer blendet das System im Entwurf einen informativen Block ein ("Theoretischer Anteil nach 365 Tagen"). Die echte Pro-rata-temporis-Splittung bleibt dem späteren Mietverwaltungs-Modul (für Mieterwechsel) vorbehalten.
  - Das System zeigt alle verwendeten Kostenarten und deren eingestellten Schlüssel an. Hier kann der Verwalter bei Ausreißern letzte Korrekturen vornehmen.
- **Schritt 2.4: Das Abrechnungsspitzen-Cockpit (Plausibilität & Einzelprüfung)**
  - _Der Gesamt-Plausibilitäts-Check:_ Ganz oben auf der Seite führt das System einen automatischen Cross-Check durch: **Summe aller verteilten Einzelkosten vs. Gesamtkosten laut Journal**. Ist die Differenz nicht exakt 0,00 €, erscheint eine rote Warnung.
  - _Die Übersichts-Tabelle:_ Eine tabellarische Liste aller Einheiten mit den Spalten: Name, Soll-Kosten (Anteil), Ist-Zahlungen (Geleistet), und der finalen Abrechnungsspitze (Guthaben/Nachzahlung).
  - _Quick-Voransicht:_ Button öffnet ein Modal mit der exakten Einzelabrechnung für diese eine Wohnung zur schnellen Kontrolle.

## **Phase 3: Der Wirtschaftsplan (Das zukünftige Jahr)**

_Basierend auf der Jahresabrechnung wird das neue Hausgeld für das kommende Jahr festgelegt._

- **Schritt 3.1: Extrapolation der Gesamtkosten (Der dynamische Planungs-Grid)**
  - _UI-Workflow:_ "Excel-ähnliche" Übersichtstabelle. Der Verwalter nutzt die _Zwei-Wege-Berechnung_ (Prozentuale Erhöhung vs. absoluter Betrag überschreiben) auf Basis der aktuellen Planzahlen.
- **Schritt 3.2: Geplante Zuführung zur Erhaltungsrücklage**
  - _UI-Workflow:_ Übersicht aller Rücklagenkonten mit ihren festen Schlüsseln (z.B. Tiefgarage). Der Verwalter gibt lediglich die _neue absolute Ziel-Gesamtsumme_ ein.
- **Schritt 3.3: Berechnung & Festlegung neues Hausgeld**
  - Das System errechnet das neue monatliche Hausgeld pro Eigentümer (Operative Kosten + Rücklagenzuführung) basierend auf den neuen Planzahlen und Schlüsseln.

## **Phase 4: Finalisierung, Freigabe & ETV-Vorbereitung**

_Die Ergebnisse werden in offizielle Dokumente gegossen und durchlaufen den 3-stufigen Freigabeprozess._

- **Schritt 4.1: PDF-Generierung & Staging (Status "Entwurf")**
  - Das System generiert _nicht_ ein riesiges Massendokument, sondern erzeugt pro Eigentümer individuell zwei vollfertige, offizielle PDFs und legt diese im System ab. **Status: Entwurf** (Noch nicht für die Eigentümer sichtbar).
  - **Dokument 1: Die Jahresabrechnung (inkl. Vermögensbericht)**
    - _Anschreiben:_ Text und kurze Übersicht über das Ergebnis (Abrechnungsspitze).
    - _Die Abrechnung:_ Tabelle mit der Gegenüberstellung von Gesamtkosten und individuellem Anteil.
    - _Hausgeld-Übersicht:_ Tabelle mit den Monaten und der Aufteilung der tatsächlich geleisteten Zahlungen (Hausgeld operativ vs. Zuführung Rücklage).
    - _Steuerbescheinigung (§ 35a EStG):_ Block als Tabelle unter der Abrechnung mit dem Ausweis zu haushaltsnahen Dienstleistungen/Handwerkerkosten.
    - _Der Vermögensbericht:_ **Ganz am Schluss** als eigenes Blatt/mit Seitenumbruch angehängt (mit allen Konten & Status-Infos).
  - **Dokument 2: Der Wirtschaftsplan**
    - _Kompakter Header:_ Prominente Angabe des zukünftigen monatlichen Hausgeldes PLUS der monatlichen Zuführung zur Erhaltungsrücklage in 2 Zeilen. Darunter das finale Ergebnis von dem Betrag, der zukünftig an die WEG bezahlt werden muss (Hausgeld + Rücklagen).
    - _Verteilerschlüssel:_ Angabe der angewendeten Verteilerschlüssel im Plan in einer Tabelle.
    - _Der Plan:_ Einfache Tabelle mit den geplanten Gesamtkosten vs. den anteiligen Kosten für die Einheit, gruppiert nach umlagefähig und nicht umlagefähig.
- **Schritt 4.2: Freigabe zur digitalen Belegprüfung (Das Beirats-Cockpit)**
  - _UI-Workflow (In-App-Prüfung):_ Der Verwalter schaltet dem Beirat die zuvor erstellten Entwürfe und die Belegansicht frei. Der Beirat (oder ein bestimmter Eigentümer) kann nun durch alle Konten und Buchungen navigieren und die verknüpften PDF-Belege öffnen. Alle Felder sind **strikt schreibgeschützt**.
  - _Hinweisbox & ETV-Verknüpfung:_ Direkt oberhalb der Buchungsübersicht (und nochmals beim Bestätigungsformular) wird eine prominente Hinweisbox eingeblendet. Diese erinnert den Prüfer daran, dass das Prüfergebnis auf der kommenden ETV als eigener Tagesordnungspunkt (TOP) behandelt wird und er hierzu eine kurze Stellungnahme abgeben muss. _Der Text ist vom Verwalter über die globalen Einstellungen (für alle Gebäude) oder im Freigabeprozess der Belegprüfung (für das jeweilige Gebäude) frei editierbar._
  - _Digitale Bestätigung & Protokoll-Formular:_ Nach der Prüfung füllt der Beirat direkt im Portal ein strukturiertes Formular aus: Datum, Uhrzeit, "Ordnungsgemäß geprüft" oder "Beanstandung" (inkl. Pflicht-Kommentarfeld) und Angaben zum Prüfungsumfang.
  - _Der Offline-Fallback (ZIP-Export):_ Für technisch weniger versierte Prüfer kann per Knopfdruck ein ZIP-Archiv generiert werden (enthält alle Rechnungs-PDFs nach Konten geordnet) Das evtl schon im Freigabeprozess.
- **Schritt 4.3: ETV-Einladung & Finale Dokumenten-Freigabe**
  - _Der ETV-Workflow:_ Der Verwalter erstellt im Eigentümerversammlungs-Tool eine neue Versammlung inkl. Tagesordnung.
  - _Die Verknüpfung:_ Das System generiert die ETV-Einladung (Anschreiben + Tagesordnung + Anlagen). Für die TOPs "Beschlussfassung Jahresabrechnung" und "Beschlussfassung Wirtschaftsplan" werden die Dokumente aus dem _Entwurf_ (aus Schritt 4.1) automatisch herangezogen und als Anlage beigefügt.
  - _Finale Freigabe:_ Durch den Versand der ETV-Einladung ändert sich der Status der Dokumente. Die Jahresabrechnung und der Wirtschaftsplan werden nun offiziell im Portal der jeweiligen Eigentümer sichtbar. _(Ob dies in einem einzelnen gebündelten PDF passiert oder als separate Dokumente, wird im Rahmen des ETV-Moduls technisch definiert)._
  - Erst nach der Beschlussfassung in der ETV werden die Jahresabrechnung und der Wirtschaftsplan als "beschlossen" markiert (evtl auch schon aus dem ETV Tool automatisch, wenn die jeweilige Mehrheit erreicht wurde) und die neuen Hausgeld-Beträge in die Einheiten im System (historisches Feld in jeder Einheit) übertragen bzw. Nachzahlungen/Guthaben in's Soll gestellt.

## **Phase 5: Die mathematische Berechnungslogik (Core Engine)**

_Dieses Kapitel definiert die exakten mathematischen Formeln, die das System für die Abrechnungen zwingend anwenden muss._

### **5.1 Verteilung der Gesamtkosten auf die Einzelabrechnung**

Für jede Kostenart (Konto) berechnet das System den individuellen Anteil einer Einheit wie folgt:

- **Formel:** (Summe der Buchungen auf dem Konto / Gesamtsumme der Einheiten des Verteilerschlüssels im Gebäude) \* Wert des Verteilerschlüssels der spezifischen Einheit
- _Beispiel (Müllabfuhr nach MEA):_ (1.000,00 € / 10.000 Gesamt-MEA) \* 250 MEA (Anteil Wohnung 1) = 25,00 € Anteil

### **5.2 Berechnung des neuen Wirtschaftsplans**

Das zukünftige monatliche Hausgeld pro Einheit setzt sich aus zwei Teilen zusammen:

- **Operative Kosten:** ((Geplante Gesamtkosten des Kontos / Gesamtschlüssel) \* Individueller Schlüssel) / 12 Monate
- **Rücklagenzuführung:** ((Geplante Gesamtzuführung / Gesamtschlüssel) \* Individueller Schlüssel) / 12 Monate

### **5.3 Die Abrechnungsspitze und das finale Abrechnungssaldo (IST-Methode mit SOLL-Ausweis)**

Das System berechnet das finale Ergebnis in einem **3-Stufen-Modell**, um für den Eigentümer absolute Transparenz zwischen "Kostenentwicklung" und seinem eigenen "Zahlungsverhalten" zu schaffen.

**WICHTIG (Die Summen-Regel zur Fehlervermeidung):** Die "Gesamtkosten (Ihr Anteil)" dürfen _niemals_ pauschal aus der Gesamtsumme des Objekts berechnet werden. Sie sind zwingend die exakte Aufsummierung aller zuvor einzeln berechneten Kostenanteile pro Buchungskonto! Dies verhindert Rundungsdifferenzen und Fehler bei abweichenden Umlageschlüsseln.

**Darstellung in der PDF-Einzelabrechnung (Die 3-Stufen-Tabelle):**

- **Ermittlung der Über-/Unterdeckung (Kosten vs. Plan):**
  - Aufsummierte Gesamtkosten (Ihr Anteil)
  - MINUS HG-Vorschuss Soll (Ihr Anteil) _(Das vertraglich vereinbarte Hausgeld laut altem Wirtschaftsplan)_
  - **\= Abrechnungsspitze (Unterdeckung / Überdeckung)** _(Zeigt, ob die WEG gut gewirtschaftet hat)._
- **Ermittlung der Zahlungsdifferenz (Plan vs. Zahlung):**
  - HG-Vorschuss Soll (Ihr Anteil)
  - MINUS HG-Vorschuss Ist (Ihr Anteil) _(Die tatsächlich auf dem Bankkonto verbuchten Zahlungen des Eigentümers)_
  - **\= Zahlungsdifferenz (Planerfüllung / Rückstand)** _(Zeigt, ob der Eigentümer seine Raten pünktlich bezahlt hat)._
- **Das finale Abrechnungssaldo (Das IST-Ergebnis):**
  - Das System verrechnet die beiden Ergebnisse aus Stufe 1 und 2 miteinander.
  - **\= Abrechnungssaldo (Guthaben oder Nachzahlung)** _(Dies ist der finale Betrag, den der Eigentümer zahlen muss oder erstattet bekommt)._