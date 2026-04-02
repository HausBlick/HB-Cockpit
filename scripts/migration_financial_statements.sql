-- ── VERMÖGENSBERICHT: financial_statements (Phase 6.15-B) ─────
-- Speichert den Stichtags-Abgleich (§ 28 WEG) je Konto pro Gebäude/Jahr.
-- Der Verwalter gleicht System-Saldo mit dem echten Banksaldo ab.
-- Hinweis: buildings.id und accounts.id sind BIGINT (nicht UUID).

CREATE TABLE IF NOT EXISTS financial_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id BIGINT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    stichtag DATE NOT NULL DEFAULT '2025-12-31',
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    system_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    statement_balance DECIMAL(12,2),
    difference DECIMAL(12,2) GENERATED ALWAYS AS (COALESCE(statement_balance, 0) - system_balance) STORED,
    is_validated BOOLEAN NOT NULL DEFAULT false,
    validated_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(building_id, fiscal_year, account_id)
);

-- RLS aktivieren
ALTER TABLE financial_statements ENABLE ROW LEVEL SECURITY;

-- RLS-Policies: Lesen und Schreiben für admin + manager
-- (verwendet SECURITY DEFINER Funktion is_admin_or_manager falls vorhanden,
--  ansonsten direkter Check auf profiles.role)
CREATE POLICY "financial_statements_select" ON financial_statements
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "financial_statements_insert" ON financial_statements
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "financial_statements_update" ON financial_statements
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- Index für schnellen Lookup
CREATE INDEX IF NOT EXISTS idx_financial_statements_building_fy
    ON financial_statements(building_id, fiscal_year);
