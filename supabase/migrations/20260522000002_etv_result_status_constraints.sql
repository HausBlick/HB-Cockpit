-- Constraint auf result_status um 'abstained' und 'closed' erweitern
-- 'abstained' fehlte => Enthaltungs-Updates schlugen lautlos fehl
-- 'closed' nötig für "Kein Beschluss"-TOPs die manuell abgeschlossen werden
ALTER TABLE etv_agenda_items
  DROP CONSTRAINT etv_agenda_items_result_status_check;

ALTER TABLE etv_agenda_items
  ADD CONSTRAINT etv_agenda_items_result_status_check
  CHECK (result_status = ANY (ARRAY['pending','approved','rejected','postponed','abstained','closed']));
