-- ── ETV-MODUL: DATENBANK-SCHEMA (KORRIGIERTE TYPEN V3) ──────
-- Fix: building_id/apartment_id (BIGINT) und person_id (UUID).

-- 1. Die Versammlung (Session)
CREATE TABLE IF NOT EXISTS etv_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id BIGINT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT DEFAULT 'Vor Ort / Online',
    status TEXT CHECK (status IN ('planned', 'active', 'closed')) DEFAULT 'planned',
    quorum_reached BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Tagesordnungspunkte (TOPs)
CREATE TABLE IF NOT EXISTS etv_agenda_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES etv_sessions(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    proposed_resolution TEXT,
    voting_type TEXT CHECK (voting_type IN ('mea', 'heads', 'object')) DEFAULT 'mea',
    majority_type TEXT CHECK (majority_type IN ('simple', 'qualified', 'double_qualified')) DEFAULT 'simple',
    result_status TEXT CHECK (result_status IN ('pending', 'approved', 'rejected', 'postponed')) DEFAULT 'pending',
    result_note TEXT
);

-- 3. Präsenz & Vollmachten (Check-in)
CREATE TABLE IF NOT EXISTS etv_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES etv_sessions(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id),
    apartment_id BIGINT NOT NULL REFERENCES apartments(id),
    is_present BOOLEAN DEFAULT false,
    proxy_person_id UUID REFERENCES persons(id),
    instructions JSONB,
    UNIQUE(session_id, apartment_id)
);

-- 4. Abstimmungsergebnisse (Einzelstimmen)
CREATE TABLE IF NOT EXISTS etv_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_item_id UUID NOT NULL REFERENCES etv_agenda_items(id) ON DELETE CASCADE,
    apartment_id BIGINT NOT NULL REFERENCES apartments(id),
    vote TEXT CHECK (vote IN ('yes', 'no', 'abstain')),
    weight_mea NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE etv_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE etv_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE etv_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE etv_votes ENABLE ROW LEVEL SECURITY;

-- Policies für admin/manager
CREATE POLICY "etv_admin_all" ON etv_sessions FOR ALL TO authenticated USING (true);
CREATE POLICY "etv_agenda_admin_all" ON etv_agenda_items FOR ALL TO authenticated USING (true);
CREATE POLICY "etv_attendance_admin_all" ON etv_attendance FOR ALL TO authenticated USING (true);
CREATE POLICY "etv_votes_admin_all" ON etv_votes FOR ALL TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_etv_sessions_building ON etv_sessions(building_id);
CREATE INDEX IF NOT EXISTS idx_etv_agenda_session ON etv_agenda_items(session_id);
CREATE INDEX IF NOT EXISTS idx_etv_attendance_session ON etv_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_etv_votes_agenda ON etv_votes(agenda_item_id);
