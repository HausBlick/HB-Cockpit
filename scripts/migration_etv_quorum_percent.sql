-- Migration: etv_quorum_percent
-- Fügt quorum_percent Spalte zu etv_sessions hinzu (Default 50%, konfigurierbar pro Versammlung)

ALTER TABLE etv_sessions
    ADD COLUMN IF NOT EXISTS quorum_percent numeric(5,2) DEFAULT 50.00;

COMMENT ON COLUMN etv_sessions.quorum_percent IS 'Quorum-Schwelle in Prozent (Default 50% gem. § 25 WEG)';
