-- ── PDF-VORLAGE: Jahresabrechnung (Phase 7.10 Migration) ──────
-- Fügt ein bearbeitbares Default-Template für den Typ 'jahresabrechnung'
-- in die pdf_templates-Tabelle ein.
-- Zweigeteilt: Anschreiben (Seite 1) + Einzelabrechnung (Seite 2+).
-- Platzhalter: {{variable_name}} — werden pro Einheit dynamisch ersetzt.

INSERT INTO pdf_templates (type, name, description, content, use_letterhead)
VALUES (
    'jahresabrechnung',
    'Jahresabrechnung',
    'Hausgeldabrechnung je Verwaltungseinheit — Anschreiben mit Saldo + Einzelabrechnung (Ist-Kosten, Umlageschlüssel, Verteilung)',
    '[
        {"type": "heading", "text": "Hausgeldabrechnung für das Jahr {{abrechnungs_jahr}}", "size": 11, "bold": true},
        {"type": "spacer", "height": 15},
        {"type": "text", "text": "{{anrede}}", "size": 10},
        {"type": "spacer", "height": 5},
        {"type": "text", "text": "für Ihre Einheit {{einheit_nummer}} in der {{weg_name}} übersenden wir Ihnen die Hausgeldabrechnung für das Wirtschaftsjahr {{abrechnungs_jahr}}. {{saldo_info}}", "size": 10},
        {"type": "spacer", "height": 15},
        {"type": "hint_box", "text": "Abrechnungssaldo: {{saldo_label}}  —  {{abrechnungs_saldo}}", "title": "Ergebnis"},
        {"type": "spacer", "height": 15},
        {"type": "text", "text": "Die Abrechnung wird der nächsten Eigentümerversammlung zur Beschlussfassung vorgelegt. Bis dahin gilt der aktuelle Wirtschaftsplan.", "size": 10},
        {"type": "spacer", "height": 8},
        {"type": "text", "text": "Die detaillierte Einzelabrechnung finden Sie auf der folgenden Seite.", "size": 10},
        {"type": "spacer", "height": 15},
        {"type": "text", "text": "Mit freundlichen Grüßen", "size": 10},
        {"type": "spacer", "height": 25},
        {"type": "text", "text": "{{firma}}", "size": 10, "bold": true},
        {"type": "text", "text": "{{geschaeftsfuehrer}}", "size": 10, "color": "gray"},

        {"type": "page_break"},

        {"type": "heading", "text": "Hausgeldabrechnung {{abrechnungs_jahr}}", "size": 16, "bold": true},
        {"type": "text", "text": "Einzelabrechnung", "size": 12, "color": "gray"},
        {"type": "spacer", "height": 15},
        {"type": "text", "text": "Objekt: {{objekt_adresse}}  ·  Abrechnungszeitraum: {{abrechnungs_zeitraum}}", "size": 9},
        {"type": "text", "text": "Verwalter: {{verwalter_firma}}, {{verwalter_adresse}}", "size": 8, "color": "gray"},
        {"type": "spacer", "height": 8},
        {"type": "text", "text": "Eigentümer: {{eigentuemer_name}}", "size": 9, "bold": true},
        {"type": "text", "text": "{{eigentuemer_adresse}}", "size": 8, "color": "gray"},
        {"type": "text", "text": "WE {{einheit_nummer}}  |  MEA: {{mea}}  |  Fläche: {{flaeche}}", "size": 8},
        {"type": "spacer", "height": 15},
        {"type": "heading", "text": "Abrechnungsergebnis", "size": 10, "color": "olive"},
        {"type": "table", "source": "abrechnungsergebnis", "columns": [
            {"key": "label", "label": "Berechnung Ihres Anteils", "width": 0.46, "align": "left"},
            {"key": "gesamt", "label": "Objekt gesamt", "width": 0.27, "align": "right", "format": "eur"},
            {"key": "anteil", "label": "Ihr Anteil", "width": 0.27, "align": "right", "format": "eur"}
        ], "highlight_last": true},
        {"type": "spacer", "height": 5},
        {"type": "hint_box", "text": "{{bgh_hinweis}}", "size": 7},
        {"type": "spacer", "height": 15},
        {"type": "heading", "text": "Umlageschlüssel", "size": 10, "color": "olive"},
        {"type": "table", "source": "umlageschluessel", "columns": [
            {"key": "nr", "label": "Nr.", "width": 0.06, "align": "left"},
            {"key": "name", "label": "Schlüssel", "width": 0.24, "align": "left"},
            {"key": "typ", "label": "Umlage-Typ", "width": 0.14, "align": "left"},
            {"key": "zeitraum", "label": "Zeitraum", "width": 0.20, "align": "left"},
            {"key": "tage", "label": "Tage", "width": 0.08, "align": "right"},
            {"key": "gesamt", "label": "Gesamtumlage", "width": 0.14, "align": "right"},
            {"key": "anteil", "label": "Ihr Anteil", "width": 0.14, "align": "right"}
        ]},
        {"type": "spacer", "height": 15},
        {"type": "heading", "text": "Verteilungsergebnis", "size": 10, "color": "olive"},
        {"type": "table", "source": "verteilung", "columns": [
            {"key": "konto", "label": "Konto", "width": 0.08, "align": "left"},
            {"key": "bezeichnung", "label": "Bezeichnung", "width": 0.30, "align": "left"},
            {"key": "schluessel", "label": "Schlüssel", "width": 0.22, "align": "left"},
            {"key": "gesamt", "label": "Ist-Kosten", "width": 0.20, "align": "right", "format": "eur"},
            {"key": "anteil", "label": "Ihr Anteil", "width": 0.20, "align": "right", "format": "eur"}
        ], "highlight_last": true},
        {"type": "spacer", "height": 15},
        {"type": "hint_box", "text": "Diese Hausgeldabrechnung wurde maschinell erstellt. Die Abrechnung ist gemäß § 28 Abs. 2 WEG durch Beschluss der Eigentümerversammlung zu genehmigen. Etwaige Nachzahlungen bzw. Guthaben werden nach Beschlussfassung fällig bzw. erstattet."}
    ]'::jsonb,
    true
)
ON CONFLICT (type) DO NOTHING;
