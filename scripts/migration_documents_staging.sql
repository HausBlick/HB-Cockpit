-- ── DOKUMENTEN-STAGING: Status-Erweiterung + Metadata (Phase 6.15-D) ──
-- Erweitert documents um 'released'-Status und metadata JSONB.
-- Status-Flow: draft → released (bei ETV-Einladungsversand).
-- metadata speichert doc_type ('jab', 'wp') + fiscal_year für gezieltes Filtern.

-- Metadata-Spalte für Dokumenten-Typisierung (JAB/WP/ETV etc.)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Status-Check erweitern: draft, active, released
-- (active = manuell hochgeladen + sofort sichtbar, released = via ETV freigegeben)
-- Hinweis: Falls ein CHECK-Constraint existiert, muss er angepasst werden.
-- Da documents.status kein CHECK hat (nur Default 'draft'), reicht der neue Wert 'released' direkt.
