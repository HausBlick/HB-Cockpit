-- Migration: ETV Voting & Protocol Extensions
-- Adds individual vote tracking, proxy support, and protocol metadata fields

-- A) Individual votes: track who cast the vote
ALTER TABLE etv_votes ADD COLUMN IF NOT EXISTS cast_by_person_id UUID REFERENCES persons(id);

-- B) Proxy check-in: name of the proxy representative
ALTER TABLE etv_attendance ADD COLUMN IF NOT EXISTS proxy_name TEXT;

-- C) Protocol metadata on sessions
ALTER TABLE etv_sessions ADD COLUMN IF NOT EXISTS chairman_name TEXT;
ALTER TABLE etv_sessions ADD COLUMN IF NOT EXISTS secretary_name TEXT;
ALTER TABLE etv_sessions ADD COLUMN IF NOT EXISTS actual_start_time TIME;
ALTER TABLE etv_sessions ADD COLUMN IF NOT EXISTS actual_end_time TIME;
ALTER TABLE etv_sessions ADD COLUMN IF NOT EXISTS general_notes TEXT;

-- C) Discussion notes per agenda item
ALTER TABLE etv_agenda_items ADD COLUMN IF NOT EXISTS discussion_note TEXT;
