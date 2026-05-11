-- Migration: ETV Protokoll-Unterzeichner
-- Fügt Beirat-Unterzeichner-Felder zu etv_sessions hinzu (werden in Tab 3 Nachbereitung befüllt)

ALTER TABLE etv_sessions
    ADD COLUMN IF NOT EXISTS beirat_signatory_1 TEXT,
    ADD COLUMN IF NOT EXISTS beirat_signatory_2 TEXT;

COMMENT ON COLUMN etv_sessions.beirat_signatory_1 IS 'Name Beirat-Unterzeichner 1 (wird bei PDF-Generierung in Nachbereitung eingetragen)';
COMMENT ON COLUMN etv_sessions.beirat_signatory_2 IS 'Name Beirat-Unterzeichner 2 (wird bei PDF-Generierung in Nachbereitung eingetragen)';
