-- Migration: voting_type + majority_type um 'none' erweitern
-- Zweck: "Kein Beschluss — nicht relevant" als Option für TOPs ohne Abstimmung

ALTER TABLE etv_agenda_items
  DROP CONSTRAINT etv_agenda_items_voting_type_check;

ALTER TABLE etv_agenda_items
  ADD CONSTRAINT etv_agenda_items_voting_type_check
  CHECK (voting_type IN ('mea', 'heads', 'object', 'none'));

ALTER TABLE etv_agenda_items
  DROP CONSTRAINT etv_agenda_items_majority_type_check;

ALTER TABLE etv_agenda_items
  ADD CONSTRAINT etv_agenda_items_majority_type_check
  CHECK (majority_type IN ('simple', 'qualified', 'double_qualified', 'none'));
