-- ── HAUSGELD-HISTORISIERUNG (Phase 6.15-G) ────────────────────
-- Speichert jede Hausgeld-Änderung mit Zeitstempel und Grund.
-- Wird bei Beschluss-Aktivierung (Post-ETV) befüllt.
-- Hinweis: apartments.id und buildings.id sind BIGINT.

CREATE TABLE IF NOT EXISTS hausgeld_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id BIGINT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    apartment_id BIGINT NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    old_hausgeld DECIMAL(10,2),
    new_hausgeld DECIMAL(10,2) NOT NULL,
    change_reason TEXT NOT NULL DEFAULT 'Wirtschaftsplan-Beschluss',
    fiscal_year INT NOT NULL,
    changed_by UUID REFERENCES profiles(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE hausgeld_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hausgeld_history_select" ON hausgeld_history
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "hausgeld_history_insert" ON hausgeld_history
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- Index
CREATE INDEX IF NOT EXISTS idx_hausgeld_history_apt
    ON hausgeld_history(apartment_id, changed_at DESC);
