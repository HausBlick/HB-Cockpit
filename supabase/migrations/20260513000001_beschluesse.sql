-- Phase 5.8-F: Beschlusssammlung §24 Abs. 7 WEG
-- Chronologische Sammlung aller Eigentümerbeschlüsse pro Gebäude
-- Keine Löschung möglich — nur Status-Änderung (angefochten/nichtig/aufgehoben)

CREATE TABLE IF NOT EXISTS beschluesse (
    id                    BIGSERIAL PRIMARY KEY,
    building_id           BIGINT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    beschluss_nr          TEXT NOT NULL,
    beschluss_datum       DATE NOT NULL,
    art                   TEXT NOT NULL DEFAULT 'etv' CHECK (art IN ('etv', 'umlauf', 'sonstig')),
    beschluss_text        TEXT NOT NULL,
    abstimmung_ja         INT,
    abstimmung_nein       INT,
    abstimmung_enthaltung INT,
    abstimmungsmodus      TEXT,
    ergebnis              TEXT CHECK (ergebnis IN ('angenommen', 'abgelehnt', 'einstimmig')),
    etv_session_id        BIGINT REFERENCES etv_sessions(id) ON DELETE SET NULL,
    top_id                BIGINT REFERENCES etv_agenda_items(id) ON DELETE SET NULL,
    status                TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'angefochten', 'nichtig', 'aufgehoben')),
    status_notiz          TEXT,
    status_datum          DATE,
    created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beschluesse_building_id    ON beschluesse(building_id);
CREATE INDEX IF NOT EXISTS idx_beschluesse_building_datum ON beschluesse(building_id, beschluss_datum);
CREATE UNIQUE INDEX IF NOT EXISTS idx_beschluesse_top_id  ON beschluesse(top_id) WHERE top_id IS NOT NULL;

ALTER TABLE beschluesse ENABLE ROW LEVEL SECURITY;

-- Admin/Manager: voller Zugriff (INSERT, UPDATE für Status, kein DELETE)
CREATE POLICY "beschluesse_admin_manager_select" ON beschluesse
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

CREATE POLICY "beschluesse_admin_manager_insert" ON beschluesse
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

CREATE POLICY "beschluesse_admin_manager_update" ON beschluesse
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Kein DELETE erlaubt (RLS-Lücke absichtlich — keine DELETE-Policy = kein Löschen möglich)
