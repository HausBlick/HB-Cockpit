-- ── PDF-VORLAGEN-SYSTEM (Phase 7.10) ──────────────────────────
-- Tabelle: pdf_templates
-- Speichert bearbeitbare PDF-Vorlagen als JSON-Block-Array.
-- Blocktypen: heading, text, table, spacer, page_break, hint_box
-- Platzhalter: {{variable_name}} — werden zur Laufzeit ersetzt.

CREATE TABLE IF NOT EXISTS pdf_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL UNIQUE,               -- z.B. 'mahnung', 'wirtschaftsplan', 'einzelwirtschaftsplan', 'jahresabrechnung'
    name TEXT NOT NULL,                       -- Anzeigename im Designer, z.B. 'Mahnung'
    description TEXT,                         -- Kurze Beschreibung für den Admin
    content JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array von Blöcken: [{type, ...props}]
    use_letterhead BOOLEAN NOT NULL DEFAULT true,  -- Briefbogen als Hintergrund
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS aktivieren
ALTER TABLE pdf_templates ENABLE ROW LEVEL SECURITY;

-- Lesen: alle authentifizierten Nutzer (Templates werden beim PDF-Generieren geladen)
CREATE POLICY "pdf_templates_select" ON pdf_templates
    FOR SELECT TO authenticated USING (true);

-- Schreiben: nur admin
CREATE POLICY "pdf_templates_insert" ON pdf_templates
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "pdf_templates_update" ON pdf_templates
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "pdf_templates_delete" ON pdf_templates
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Index auf type für schnellen Lookup
CREATE INDEX IF NOT EXISTS idx_pdf_templates_type ON pdf_templates(type);

-- ── Default-Template: Mahnung ─────────────────────────────────
-- Wird als PoC-Migration eingesetzt. Der Admin kann es im Designer anpassen.
INSERT INTO pdf_templates (type, name, description, content, use_letterhead)
VALUES (
    'mahnung',
    'Mahnung',
    'Zahlungserinnerung / Mahnung für offene Hausgeld-Forderungen',
    '[
        {"type": "heading", "text": "{{mahnstufe}} — Offene Hausgeld-Forderung", "size": 11, "bold": true},
        {"type": "spacer", "height": 30},
        {"type": "text", "text": "{{anrede}}", "size": 10},
        {"type": "spacer", "height": 10},
        {"type": "text", "text": "für Ihre Einheit {{einheit_nr}} in der {{weg_name}} haben wir folgende offene Hausgeld-Forderungen festgestellt, die trotz Fälligkeit noch nicht beglichen wurden:", "size": 10},
        {"type": "spacer", "height": 15},
        {"type": "table", "source": "offene_posten", "columns": [
            {"key": "bezeichnung", "label": "Bezeichnung", "width": 0.46, "align": "left"},
            {"key": "faelligkeit", "label": "Fälligkeit", "width": 0.27, "align": "left"},
            {"key": "betrag", "label": "Betrag", "width": 0.27, "align": "right", "format": "eur"}
        ]},
        {"type": "spacer", "height": 5},
        {"type": "table", "source": "zusammenfassung", "columns": [
            {"key": "label", "label": "", "width": 0.73, "align": "right"},
            {"key": "betrag", "label": "", "width": 0.27, "align": "right", "format": "eur"}
        ], "show_header": false, "highlight_last": true},
        {"type": "spacer", "height": 25},
        {"type": "text", "text": "Bitte überweisen Sie den Gesamtbetrag von {{gesamtbetrag}} binnen 7 Tagen auf das Ihnen bekannte Konto der WEG.", "size": 10},
        {"type": "spacer", "height": 10},
        {"type": "text", "text": "Bei weiterer Nichtzahlung behalten wir uns vor, rechtliche Schritte einzuleiten.", "size": 10},
        {"type": "spacer", "height": 15},
        {"type": "text", "text": "Mit freundlichen Grüßen", "size": 10},
        {"type": "spacer", "height": 25},
        {"type": "text", "text": "{{firma}}", "size": 10, "bold": true},
        {"type": "text", "text": "{{geschaeftsfuehrer}}", "size": 10, "color": "gray"}
    ]'::jsonb,
    true
)
ON CONFLICT (type) DO NOTHING;
