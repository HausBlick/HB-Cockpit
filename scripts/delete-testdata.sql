-- TESTDATEN LÖSCHEN — Entfernt alle Datensätze mit file_number LIKE 'TEST-%'
-- Ausführen mit: psql "postgresql://postgres:[PASSWORT]@db.unprrlbvylmzxxhpfisr.supabase.co:5432/postgres" -f scripts/delete-testdata.sql

SET row_security = off;

-- GoBD-Rules temporär deaktivieren (journal_entries erlaubt keine DELETE/UPDATE per Rule)
DROP RULE IF EXISTS journal_no_delete ON journal_entries;
DROP RULE IF EXISTS journal_no_update ON journal_entries;

-- Löschen in richtiger Reihenfolge (FK-Constraints beachten)
DO $$
DECLARE
    test_building_ids   bigint[];
    test_apartment_ids  bigint[];
    test_meter_ids      bigint[];
    test_plan_ids       bigint[];
BEGIN
    SELECT ARRAY_AGG(id) INTO test_building_ids
    FROM buildings WHERE file_number LIKE 'TEST-%';

    IF test_building_ids IS NULL THEN
        RAISE NOTICE 'Keine Testgebäude (file_number LIKE TEST-%) gefunden — nichts zu löschen.';
        RETURN;
    END IF;

    SELECT ARRAY_AGG(id) INTO test_apartment_ids
    FROM apartments WHERE building_id = ANY(test_building_ids);

    SELECT ARRAY_AGG(id) INTO test_meter_ids
    FROM meters WHERE apartment_id = ANY(test_apartment_ids);

    SELECT ARRAY_AGG(id) INTO test_plan_ids
    FROM budget_plans WHERE building_id = ANY(test_building_ids);

    -- Mahnwesen
    DELETE FROM dunning_notices
    WHERE building_id = ANY(test_building_ids);

    -- Zählerstände
    IF test_meter_ids IS NOT NULL THEN
        DELETE FROM meter_readings WHERE meter_id = ANY(test_meter_ids);
    END IF;
    DELETE FROM meters WHERE apartment_id = ANY(test_apartment_ids);

    -- Sollstellungen & Sonderumlagen
    DELETE FROM payment_demands WHERE building_id = ANY(test_building_ids);
    DELETE FROM special_levies  WHERE building_id = ANY(test_building_ids);

    -- Buchungsjournal
    DELETE FROM journal_entries WHERE building_id = ANY(test_building_ids);

    -- Wirtschaftsplan
    IF test_plan_ids IS NOT NULL THEN
        DELETE FROM budget_plan_items WHERE budget_plan_id = ANY(test_plan_ids);
    END IF;
    DELETE FROM budget_plans WHERE building_id = ANY(test_building_ids);

    -- Konten
    DELETE FROM accounts WHERE building_id = ANY(test_building_ids);

    -- Bankkonten & Beirat-Freigaben
    DELETE FROM building_bank_accounts   WHERE building_id = ANY(test_building_ids);
    DELETE FROM beirat_access_periods    WHERE building_id = ANY(test_building_ids);

    -- Einheiten & Gebäude
    DELETE FROM apartments WHERE building_id = ANY(test_building_ids);
    DELETE FROM buildings  WHERE id = ANY(test_building_ids);

    RAISE NOTICE 'Testdaten erfolgreich gelöscht (% Gebäude).', array_length(test_building_ids, 1);
END $$;

-- GoBD-Rules wieder aktivieren
CREATE OR REPLACE RULE journal_no_update AS
    ON UPDATE TO journal_entries DO INSTEAD NOTHING;

CREATE OR REPLACE RULE journal_no_delete AS
    ON DELETE TO journal_entries DO INSTEAD NOTHING;

RAISE NOTICE 'GoBD-Rules wiederhergestellt.';
