-- ── JAB-Template v2: Monats-Matrix + Vermögensbericht (Phase 6.15-E) ──
-- Aktualisiert das bestehende 'jahresabrechnung'-Template um:
-- 1. Hausgeld-Monatsübersicht (jab_monats_matrix) nach dem Abrechnungsergebnis
-- 2. Vermögensbericht als eigenes Blatt am Ende (nach Hinweis-Box)

UPDATE pdf_templates SET content = '[
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
    {"type": "heading", "text": "Hausgeld-Monatsübersicht", "size": 10, "color": "olive"},
    {"type": "table", "source": "jab_monats_matrix", "columns": [
        {"key": "monat", "label": "Monat", "width": 0.28, "align": "left"},
        {"key": "soll", "label": "Soll-Hausgeld", "width": 0.24, "align": "right", "format": "eur"},
        {"key": "ist", "label": "Ist-Zahlung", "width": 0.24, "align": "right", "format": "eur"},
        {"key": "differenz", "label": "Differenz", "width": 0.24, "align": "right", "format": "eur"}
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
        {"key": "gesamt", "label": "Ist-Kosten", "width": 0.20, "align": "right", "format": "eur"},
        {"key": "anteil", "label": "Ihr Anteil", "width": 0.20, "align": "right", "format": "eur"}
    ], "highlight_last": true},
    {"type": "spacer", "height": 15},
    {"type": "hint_box", "text": "Diese Hausgeldabrechnung wurde maschinell erstellt. Die Abrechnung ist gemäß § 28 Abs. 2 WEG durch Beschluss der Eigentümerversammlung zu genehmigen. Etwaige Nachzahlungen bzw. Guthaben werden nach Beschlussfassung fällig bzw. erstattet."},

    {"type": "page_break"},

    {"type": "heading", "text": "Vermögensbericht zum 31.12.{{abrechnungs_jahr}}", "size": 14, "bold": true},
    {"type": "text", "text": "§ 28 Abs. 4 WEG — Darstellung der Vermögenslage der WEG", "size": 9, "color": "gray"},
    {"type": "spacer", "height": 12},
    {"type": "heading", "text": "Kontensalden (Bank & Rücklage)", "size": 10, "color": "olive"},
    {"type": "table", "source": "vermoegen_konten", "columns": [
        {"key": "konto", "label": "Konto", "width": 0.12, "align": "left"},
        {"key": "bezeichnung", "label": "Bezeichnung", "width": 0.36, "align": "left"},
        {"key": "saldo", "label": "Saldo 31.12.", "width": 0.26, "align": "right", "format": "eur"},
        {"key": "status", "label": "Status", "width": 0.26, "align": "left"}
    ]},
    {"type": "spacer", "height": 12},
    {"type": "heading", "text": "Offene Forderungen", "size": 10, "color": "olive"},
    {"type": "table", "source": "vermoegen_forderungen", "columns": [
        {"key": "einheit", "label": "Einheit", "width": 0.15, "align": "left"},
        {"key": "eigentuemer", "label": "Eigentümer", "width": 0.35, "align": "left"},
        {"key": "betrag", "label": "Betrag", "width": 0.25, "align": "right", "format": "eur"},
        {"key": "typ", "label": "Typ", "width": 0.25, "align": "left"}
    ], "highlight_last": true},
    {"type": "spacer", "height": 10},
    {"type": "hint_box", "text": "Dieser Vermögensbericht wurde maschinell erstellt und gibt die Vermögenslage der Wohnungseigentümergemeinschaft zum Stichtag 31.12.{{abrechnungs_jahr}} wieder. Er ist Bestandteil der Jahresabrechnung."}
]'::jsonb,
updated_at = NOW()
WHERE type = 'jahresabrechnung';
