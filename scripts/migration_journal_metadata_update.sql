-- Migration: journal_no_update Trigger lockert für Metadaten-Felder
-- GoBD-Schutz bleibt für Finanzdaten (Konten, Betrag, Datum, Buchungstyp)
-- Erlaubt Änderungen an: apartment_id, description, reference_number, lohn_anteil_35a
--
-- Ausführen in: Supabase Dashboard → SQL Editor

CREATE OR REPLACE FUNCTION journal_no_update_fn()
RETURNS trigger AS $$
BEGIN
  IF (
    OLD.amount              IS DISTINCT FROM NEW.amount              OR
    OLD.debit_account_id    IS DISTINCT FROM NEW.debit_account_id    OR
    OLD.credit_account_id   IS DISTINCT FROM NEW.credit_account_id   OR
    OLD.entry_date          IS DISTINCT FROM NEW.entry_date          OR
    OLD.fiscal_year         IS DISTINCT FROM NEW.fiscal_year         OR
    OLD.building_id         IS DISTINCT FROM NEW.building_id         OR
    OLD.entry_type          IS DISTINCT FROM NEW.entry_type          OR
    OLD.storno_of           IS DISTINCT FROM NEW.storno_of
  ) THEN
    RAISE EXCEPTION 'journal_entries: Finanzdaten sind GoBD-geschützt (Konten, Betrag, Datum). Bitte Storno + Neubuchung verwenden.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS journal_no_update ON journal_entries;
CREATE TRIGGER journal_no_update
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION journal_no_update_fn();
