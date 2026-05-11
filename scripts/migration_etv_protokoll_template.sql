-- Migration: ETV Protokoll Anschreiben — PDF-Template
-- Fügt Default-Template für das Protokoll-Anschreiben (Seite 1) hinzu.
-- Editierbar im Dokumentendesigner (Einstellungen → Dokumenten-Designer).
-- Platzhalter: {{gebaeude_name}}, {{datum_versammlung}}, {{wirtschaftsjahr}}, {{firma}}, {{datum_heute}}, {{gebaeude_adresse}}

INSERT INTO pdf_templates (type, name, description, content, use_letterhead)
VALUES (
    'etv_protokoll',
    'ETV Protokoll — Anschreiben',
    'Anschreiben (Seite 1) für das Protokoll der Eigentümerversammlung. DIN-5008-Kopf (Adressfeld, Datum, Betreff) ist fest — dieser Text beginnt direkt darunter.',
    '[
        {"type": "text", "text": "Sehr geehrte Eigentümerinnen und Eigentümer,"},
        {"type": "spacer", "height": 8},
        {"type": "text", "text": "in der Anlage erhalten Sie das Protokoll der Eigentümerversammlung vom {{datum_versammlung}} zur Kenntnisnahme und für Ihre Unterlagen."},
        {"type": "spacer", "height": 6},
        {"type": "text", "text": "Das unterschriebene Originalprotokoll ist bei der Verwaltung hinterlegt und kann dort auf Anfrage eingesehen werden (§ 24 Abs. 6 WEG)."},
        {"type": "spacer", "height": 20},
        {"type": "text", "text": "Vielen Dank"},
        {"type": "spacer", "height": 14},
        {"type": "text", "text": "Mit freundlichen Grüßen"},
        {"type": "spacer", "height": 10},
        {"type": "text", "text": "{{firma}}"},
        {"type": "spacer", "height": 36},
        {"type": "hint_box", "title": "Anlage", "text": "• Protokoll der Eigentümerversammlung vom {{datum_versammlung}}"}
    ]'::jsonb,
    true
)
ON CONFLICT (type) DO NOTHING;
