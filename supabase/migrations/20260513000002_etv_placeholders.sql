-- Phase 5.8-C: Dynamische Platzhalter in ETV-TOPs
-- Vordeffinierte Optionen pro Platzhalter (z.B. { "BEAUFTRAGTE_FIRMA": ["Firma A", "Firma B"] })
-- Aufgelöste Werte zur Abstimmungszeit (z.B. { "BEAUFTRAGTE_FIRMA": "Firma B" })
ALTER TABLE etv_agenda_items
  ADD COLUMN IF NOT EXISTS placeholder_options JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS placeholder_values  JSONB DEFAULT '{}';
