-- Phase 5.8: Vorbemerkung-Toggle für Protokoll
-- Steuert ob die Vorbemerkung eines TOPs im Protokoll-PDF erscheint (Standard: nein)
ALTER TABLE etv_agenda_items
ADD COLUMN IF NOT EXISTS remark_in_protocol BOOLEAN DEFAULT false;
