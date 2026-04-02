-- ── BEIRAT-PRÜFPROTOKOLL: audit_protocols (Phase 6.15-C) ──────
-- Speichert die digitale Belegprüfung durch den Beirat.
-- Der Beirat füllt nach Prüfung ein strukturiertes Formular aus.
-- Hinweis: buildings.id ist BIGINT (nicht UUID).

CREATE TABLE IF NOT EXISTS audit_protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id BIGINT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    auditor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'disputed')),
    check_date TIMESTAMP WITH TIME ZONE,
    scope_description TEXT,
    findings TEXT,
    is_formally_correct BOOLEAN,
    signature_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(building_id, fiscal_year, auditor_id)
);

-- RLS aktivieren
ALTER TABLE audit_protocols ENABLE ROW LEVEL SECURITY;

-- Lesen: admin, manager + advisory (Beirat sieht eigene Protokolle)
CREATE POLICY "audit_protocols_select" ON audit_protocols
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
        OR auditor_id = auth.uid()
    );

-- Schreiben: admin/manager können alles, Beirat kann nur eigene erstellen/bearbeiten
CREATE POLICY "audit_protocols_insert" ON audit_protocols
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
        OR auditor_id = auth.uid()
    );

CREATE POLICY "audit_protocols_update" ON audit_protocols
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
        OR auditor_id = auth.uid()
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
        OR auditor_id = auth.uid()
    );

-- Index
CREATE INDEX IF NOT EXISTS idx_audit_protocols_building_fy
    ON audit_protocols(building_id, fiscal_year);

-- Hinweistext für Beirat-Cockpit (editierbar durch Admin in Einstellungen)
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS audit_hint_text TEXT;
