-- Migration: TOP-Dokumente mit optionaler Eigentümer-Zuordnung
-- Zweck: PDFs pro TOP hochladen, wahlweise für alle oder einzelne Eigentümer

CREATE TABLE IF NOT EXISTS etv_agenda_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_item_id UUID NOT NULL REFERENCES etv_agenda_items(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('building', 'owner')) DEFAULT 'building',
    owner_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_etv_agenda_docs_item ON etv_agenda_documents(agenda_item_id);
CREATE INDEX idx_etv_agenda_docs_owner ON etv_agenda_documents(owner_person_id) WHERE owner_person_id IS NOT NULL;

-- RLS
ALTER TABLE etv_agenda_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etv_agenda_docs_select" ON etv_agenda_documents
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "etv_agenda_docs_insert" ON etv_agenda_documents
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "etv_agenda_docs_delete" ON etv_agenda_documents
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );
