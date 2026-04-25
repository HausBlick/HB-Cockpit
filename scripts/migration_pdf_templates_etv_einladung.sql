-- Migration: Default-Template für ETV-Einladung (Anschreiben Seite 1)
-- Blocktypen: text, spacer, info_box, agenda_list, anlagen_list

INSERT INTO pdf_templates (type, name, description, content, use_letterhead) VALUES (
  'etv_einladung',
  'ETV-Einladung',
  'Anschreiben zur Eigentümerversammlung (Seite 1 — editierbar im Designer)',
  '[
    {"type": "text", "text": "Sehr {{anrede}} {{nachname}},", "size": 10},
    {"type": "spacer", "height": 8},
    {"type": "text", "text": "hiermit laden wir Sie herzlich zur ordentlichen Eigentümerversammlung der WEG {{gebaeude_adresse}} ein.", "size": 9.5},
    {"type": "spacer", "height": 10},
    {"type": "info_box", "lines": ["{{datum}}  um  {{uhrzeit}} Uhr", "{{ort}}"], "size": 11, "bold": true, "align": "center"},
    {"type": "spacer", "height": 10},
    {"type": "text", "text": "Bitte bringen Sie diese Einladung sowie einen gültigen Lichtbildausweis zur Versammlung mit. Sollten Sie nicht persönlich teilnehmen können, nutzen Sie bitte die beigefügte Vollmacht.", "size": 9.5},
    {"type": "spacer", "height": 12},
    {"type": "agenda_list", "title": "Tagesordnung:", "title_size": 11, "size": 9.5},
    {"type": "spacer", "height": 12},
    {"type": "text", "text": "Mit freundlichen Grüßen", "size": 9.5},
    {"type": "text", "text": "{{firma}}", "size": 9.5, "bold": true},
    {"type": "spacer", "height": 14},
    {"type": "anlagen_list", "title": "Anlagen:", "title_size": 9, "size": 9, "color": "gray"}
  ]'::jsonb,
  true
)
ON CONFLICT (type) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = now();
