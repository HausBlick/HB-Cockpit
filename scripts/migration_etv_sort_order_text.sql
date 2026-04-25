-- Migration: sort_order von INTEGER auf TEXT ändern
-- Zweck: Hierarchische TOP-Nummerierung (z.B. 2.1, 2.2, 3.1a)

ALTER TABLE etv_agenda_items
  ALTER COLUMN sort_order TYPE TEXT USING sort_order::TEXT;
