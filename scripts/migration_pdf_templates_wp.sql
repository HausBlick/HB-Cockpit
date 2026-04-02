-- ── PDF-VORLAGE: Einzelwirtschaftsplan (Phase 7.10 Migration) ──
-- Fügt ein bearbeitbares Default-Template für den Typ 'einzelwirtschaftsplan'
-- in die pdf_templates-Tabelle ein.
-- Blocktypen: heading, text, table, spacer, hint_box
-- Platzhalter: {{variable_name}} — werden pro Einheit dynamisch ersetzt.

INSERT INTO pdf_templates (type, name, description, content, use_letterhead)
VALUES (
    'einzelwirtschaftsplan',
    'Einzelwirtschaftsplan',
    'Wirtschaftsplan je Verwaltungseinheit — Hausgeld-Übersicht, Umlageschlüssel und Verteilungsergebnis',
    '[
        {"type": "heading", "text": "Wirtschaftsplan", "size": 16, "bold": true},
        {"type": "text", "text": "Einzelwirtschaftsplan", "size": 12, "color": "gray"},
        {"type": "spacer", "height": 15},
        {"type": "text", "text": "Objekt: {{objekt_adresse}}  ·  Planzeitraum: {{planzeitraum}}", "size": 9},
        {"type": "text", "text": "Verwalter: {{verwalter_firma}}, {{verwalter_adresse}}", "size": 8, "color": "gray"},
        {"type": "spacer", "height": 8},
        {"type": "text", "text": "Eigentümer: {{eigentuemer_name}}", "size": 9, "bold": true},
        {"type": "text", "text": "{{eigentuemer_adresse}}", "size": 8, "color": "gray"},
        {"type": "text", "text": "WE {{einheit_nummer}}  |  MEA: {{mea}}  |  Fläche: {{flaeche}}", "size": 8},
        {"type": "spacer", "height": 15},
        {"type": "heading", "text": "Hausgeld-Übersicht", "size": 10, "color": "olive"},
        {"type": "table", "source": "hausgeld_summary", "columns": [
            {"key": "label", "label": "Hausgeld", "width": 0.46, "align": "left"},
            {"key": "gesamt", "label": "Objekt gesamt", "width": 0.27, "align": "right", "format": "eur"},
            {"key": "anteil", "label": "Ihr Anteil", "width": 0.27, "align": "right", "format": "eur"}
        ], "highlight_last": true},
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
            {"key": "gesamt", "label": "Gesamtkosten", "width": 0.20, "align": "right", "format": "eur"},
            {"key": "anteil", "label": "Ihr Anteil", "width": 0.20, "align": "right", "format": "eur"}
        ], "highlight_last": true},
        {"type": "spacer", "height": 15},
        {"type": "hint_box", "text": "Dieser Wirtschaftsplan wurde maschinell erstellt und ist rechtlich bindend nach Beschlussfassung der WEG-Gemeinschaft. Die aus dem Wirtschaftsplan resultierenden monatlichen Hausgelder sind über den Planungszeitraum hinaus weiter zu zahlen, bis ein neuer Wirtschaftsplan beschlossen wurde."}
    ]'::jsonb,
    true
)
ON CONFLICT (type) DO NOTHING;
