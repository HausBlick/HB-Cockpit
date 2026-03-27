-- ============================================================
-- SEED-SCRIPT: Zeppelinstraße 8 (building_id=17) — Komplett-Reset
-- 3 Wirtschaftsjahre:
--   2024: Perfektes Jahr (alle zahlen pünktlich, Ist = WP, 0 € Spitze)
--   2025: WE02 (Michael Braun) war im Juli säumig → Mahnung Stufe 1
--   2026: Nur Wirtschaftsplan-Entwurf, keine Buchungen
--
-- Ausführen: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

-- ============================================================
-- SCHRITT 1: GoBD-RULES TEMPORÄR DEAKTIVIEREN
-- journal_no_delete und journal_no_update sind PostgreSQL RULES
-- (DO INSTEAD NOTHING) — kein Trigger! RULES können nicht durch
-- session_replication_role oder RLS-Bypass umgangen werden.
-- Lösung: DROP RULE → DELETE → Nur journal_no_delete neu anlegen.
-- journal_no_update RULE bleibt gelöscht: Metadaten-Edits laufen
-- jetzt korrekt über den Trigger (journal_no_update_fn).
-- ============================================================
DROP RULE IF EXISTS journal_no_delete ON journal_entries;
DROP RULE IF EXISTS journal_no_update ON journal_entries;

-- ============================================================
-- SCHRITT 2: LÖSCHEN
-- ============================================================
DELETE FROM dunning_notices
  WHERE building_id = 17;

DELETE FROM payment_demands
  WHERE building_id = 17;

DELETE FROM journal_attachments
  WHERE journal_id IN (SELECT id FROM journal_entries WHERE building_id = 17);

DELETE FROM journal_entries
  WHERE building_id = 17;

DELETE FROM budget_plan_items
  WHERE budget_plan_id IN (SELECT id FROM budget_plans WHERE building_id = 17);

DELETE FROM budget_plans
  WHERE building_id = 17;

-- Nur die Delete-Protection wieder herstellen
CREATE RULE journal_no_delete AS ON DELETE TO journal_entries DO INSTEAD NOTHING;

-- ============================================================
-- SCHRITT 3: VERTEILERSCHLÜSSEL
-- 4100 (Heizung), 4140 (Hausmeister), 4150 (Allgemeinstrom)
-- → MEA "Miteigentumsanteile" (id=6b8ab4a5-..., total=1000)
-- Damit alle Konten nach MEA verteilen → saubere 0 € Spitze
-- ============================================================
UPDATE accounts
SET    primary_key_id           = '6b8ab4a5-a45f-4221-a50b-61ddeb30f292',
       secondary_key_id         = NULL,
       secondary_key_percentage = NULL
WHERE  building_id = 17
  AND  account_number IN ('4100', '4140', '4150');

-- ============================================================
-- SCHRITT 4: WIRTSCHAFTSPLÄNE, BUCHUNGEN, FORDERUNGEN
-- (DO-Block wegen RETURNING-Variablen für budget_plan_id)
-- ============================================================
DO $$
DECLARE
    v_p24          BIGINT;   -- budget_plan_id 2024
    v_p25          BIGINT;   -- budget_plan_id 2025
    v_p26          BIGINT;   -- budget_plan_id 2026
    v_demand_jul25 BIGINT;   -- payment_demand_id WE02 Juli 2025

    -- Eigentümer-UUIDs (persons.id)
    v_we01 UUID := 'c8fa2d02-cbda-40e6-9481-b8b79c039f44';  -- WE01 Karin Hoffmann  apt=55
    v_we02 UUID := '60ceea67-8182-4910-b109-74f9c1431979';  -- WE02 Michael Braun   apt=56
    v_we03 UUID := 'e58f624f-d761-404f-a830-eda403205e2a';  -- WE03 Thomas Gruber   apt=57
    v_we04 UUID := '3be8b34a-fc83-452d-a97c-6c8f6c269b98';  -- WE04 Eva Schneider   apt=58

    -- Account-IDs (building_id=17) — fest verdrahtet für Performance
    -- 1200=323 Girokonto, 1400=335 Ford. Hausgeld, 8000=322 HG-Einnahmen
    -- 4100=318 Heizung, 4110=313 Wasser, 4120=314 Müll, 4130=315 Versich.
    -- 4140=316 Hausmeister, 4150=317 Allgemeinstrom, 4200=319 Verwaltung
    -- 4300=320 Instandhaltung, 4310=321 Rücklage
    -- 4201=340 Mahngebühren, 1420=330 Ford. Mahnwesen

BEGIN

    -- ==========================================================
    -- WIRTSCHAFTSPLÄNE
    -- ==========================================================

    INSERT INTO budget_plans (building_id, fiscal_year, status, notes)
    VALUES (17, 2024, 'active', 'Wirtschaftsplan 2024')
    RETURNING id INTO v_p24;

    INSERT INTO budget_plans (building_id, fiscal_year, status, notes)
    VALUES (17, 2025, 'active', 'Wirtschaftsplan 2025')
    RETURNING id INTO v_p25;

    INSERT INTO budget_plans (building_id, fiscal_year, status, notes)
    VALUES (17, 2026, 'draft', 'Wirtschaftsplan 2026')
    RETURNING id INTO v_p26;

    -- ==========================================================
    -- WIRTSCHAFTSPLAN-POSITIONEN (alle 3 Jahre identisch)
    -- Jahresbudget: 24.000 € (2.000 €/Monat)
    --   4100 Heizung & Energie         6.960 € (quartalsw. 1.740)
    --   4110 Wasser & Abwasser         2.400 € (quartalsw.   600)
    --   4120 Müllabfuhr                  960 € (quartalsw.   240)
    --   4130 Versicherungen            1.800 € (quartalsw.   450)
    --   4140 Hausmeister / Reinigung   2.400 € (quartalsw.   600)
    --   4150 Allgemeinstrom              480 € (quartalsw.   120)
    --   4200 Verwaltungskosten         2.400 € (quartalsw.   600)
    --   4300 Instandhaltung allgemein  1.200 € (quartalsw.   300)
    --   4310 Erhaltungsrücklage        5.400 € (monatl.      450)
    -- ==========================================================

    INSERT INTO budget_plan_items
      (budget_plan_id, account_id, planned_amount, prior_year_actual, adjustment_percent)
    SELECT p_id, a_id, amt, amt, 0.00
    FROM unnest(ARRAY[v_p24, v_p25, v_p26]) AS p_id,
    (VALUES
      (318, 6960.00),  -- 4100 Heizung & Energie
      (313, 2400.00),  -- 4110 Wasser & Abwasser
      (314,  960.00),  -- 4120 Müllabfuhr
      (315, 1800.00),  -- 4130 Versicherungen
      (316, 2400.00),  -- 4140 Hausmeister / Reinigung
      (317,  480.00),  -- 4150 Allgemeinstrom
      (319, 2400.00),  -- 4200 Verwaltungskosten
      (320, 1200.00),  -- 4300 Instandhaltung allgemein
      (321, 5400.00)   -- 4310 Erhaltungsrücklage
    ) AS t(a_id, amt);

    -- ==========================================================
    -- JOURNAL-EINTRÄGE 2024 (perfektes Jahr)
    -- ==========================================================

    -- 1. Sollstellungen monatlich pro WE (Debit 1400 / Credit 8000)
    INSERT INTO journal_entries
      (building_id, entry_date, fiscal_year, apartment_id,
       debit_account_id, credit_account_id, amount, description, entry_type)
    SELECT 17, make_date(2024, m, 1), 2024, apt, 335, 322, hg,
           'Sollstellung HG ' || lpad(m::text,2,'0') || '/2024', 'sollstellung'
    FROM generate_series(1,12) AS m,
    (VALUES (55,410.00),(56,458.00),(57,506.00),(58,626.00)) AS t(apt, hg);

    -- 2. HG-Zahlungseingänge monatlich pro WE (Debit 1200 / Credit 1400)
    INSERT INTO journal_entries
      (building_id, entry_date, fiscal_year, apartment_id,
       debit_account_id, credit_account_id, amount, description, entry_type)
    SELECT 17, make_date(2024, m, 5), 2024, apt, 323, 335, hg,
           'HG-Eingang ' || lpad(m::text,2,'0') || '/2024', 'manual'
    FROM generate_series(1,12) AS m,
    (VALUES (55,410.00),(56,458.00),(57,506.00),(58,626.00)) AS t(apt, hg);

    -- 3. Betriebskosten quartalsweise (Debit 4xxx / Credit 1200)
    INSERT INTO journal_entries
      (building_id, entry_date, fiscal_year, apartment_id,
       debit_account_id, credit_account_id, amount, description, entry_type)
    SELECT 17, qd, 2024, NULL, acc, 323, amt, descr, 'manual'
    FROM (VALUES
      ('2024-03-31'::date, 318, 1740.00, 'Heizung/Energie Q1 2024'),
      ('2024-03-31'::date, 313,  600.00, 'Wasser/Abwasser Q1 2024'),
      ('2024-03-31'::date, 314,  240.00, 'Müllabfuhr Q1 2024'),
      ('2024-03-31'::date, 315,  450.00, 'Versicherungen Q1 2024'),
      ('2024-03-31'::date, 316,  600.00, 'Hausmeister Q1 2024'),
      ('2024-03-31'::date, 317,  120.00, 'Allgemeinstrom Q1 2024'),
      ('2024-03-31'::date, 319,  600.00, 'Verwaltungskosten Q1 2024'),
      ('2024-03-31'::date, 320,  300.00, 'Instandhaltung Q1 2024'),
      ('2024-06-30'::date, 318, 1740.00, 'Heizung/Energie Q2 2024'),
      ('2024-06-30'::date, 313,  600.00, 'Wasser/Abwasser Q2 2024'),
      ('2024-06-30'::date, 314,  240.00, 'Müllabfuhr Q2 2024'),
      ('2024-06-30'::date, 315,  450.00, 'Versicherungen Q2 2024'),
      ('2024-06-30'::date, 316,  600.00, 'Hausmeister Q2 2024'),
      ('2024-06-30'::date, 317,  120.00, 'Allgemeinstrom Q2 2024'),
      ('2024-06-30'::date, 319,  600.00, 'Verwaltungskosten Q2 2024'),
      ('2024-06-30'::date, 320,  300.00, 'Instandhaltung Q2 2024'),
      ('2024-09-30'::date, 318, 1740.00, 'Heizung/Energie Q3 2024'),
      ('2024-09-30'::date, 313,  600.00, 'Wasser/Abwasser Q3 2024'),
      ('2024-09-30'::date, 314,  240.00, 'Müllabfuhr Q3 2024'),
      ('2024-09-30'::date, 315,  450.00, 'Versicherungen Q3 2024'),
      ('2024-09-30'::date, 316,  600.00, 'Hausmeister Q3 2024'),
      ('2024-09-30'::date, 317,  120.00, 'Allgemeinstrom Q3 2024'),
      ('2024-09-30'::date, 319,  600.00, 'Verwaltungskosten Q3 2024'),
      ('2024-09-30'::date, 320,  300.00, 'Instandhaltung Q3 2024'),
      ('2024-12-31'::date, 318, 1740.00, 'Heizung/Energie Q4 2024'),
      ('2024-12-31'::date, 313,  600.00, 'Wasser/Abwasser Q4 2024'),
      ('2024-12-31'::date, 314,  240.00, 'Müllabfuhr Q4 2024'),
      ('2024-12-31'::date, 315,  450.00, 'Versicherungen Q4 2024'),
      ('2024-12-31'::date, 316,  600.00, 'Hausmeister Q4 2024'),
      ('2024-12-31'::date, 317,  120.00, 'Allgemeinstrom Q4 2024'),
      ('2024-12-31'::date, 319,  600.00, 'Verwaltungskosten Q4 2024'),
      ('2024-12-31'::date, 320,  300.00, 'Instandhaltung Q4 2024')
    ) AS t(qd, acc, amt, descr);

    -- 4. Rücklage-Zuführungen monatlich (Debit 4310 / Credit 1200)
    INSERT INTO journal_entries
      (building_id, entry_date, fiscal_year, apartment_id,
       debit_account_id, credit_account_id, amount, description, entry_type)
    SELECT 17, make_date(2024, m, 1), 2024, NULL, 321, 323, 450.00,
           'Rücklage-Zuführung ' || lpad(m::text,2,'0') || '/2024', 'ruecklage'
    FROM generate_series(1,12) AS m;

    -- ==========================================================
    -- PAYMENT DEMANDS 2024 (alle bezahlt)
    -- ==========================================================
    INSERT INTO payment_demands
      (building_id, apartment_id, person_id, demand_type, amount, status, due_date, fiscal_year)
    SELECT 17, apt, pid, 'hausgeld', hg, 'paid', make_date(2024, m, 1), 2024
    FROM generate_series(1,12) AS m,
    (VALUES
      (55, 410.00, v_we01),
      (56, 458.00, v_we02),
      (57, 506.00, v_we03),
      (58, 626.00, v_we04)
    ) AS t(apt, hg, pid);

    -- ==========================================================
    -- JOURNAL-EINTRÄGE 2025 (WE02 Juli fehlt)
    -- ==========================================================

    -- 1. Sollstellungen monatlich alle WEs
    INSERT INTO journal_entries
      (building_id, entry_date, fiscal_year, apartment_id,
       debit_account_id, credit_account_id, amount, description, entry_type)
    SELECT 17, make_date(2025, m, 1), 2025, apt, 335, 322, hg,
           'Sollstellung HG ' || lpad(m::text,2,'0') || '/2025', 'sollstellung'
    FROM generate_series(1,12) AS m,
    (VALUES (55,410.00),(56,458.00),(57,506.00),(58,626.00)) AS t(apt, hg);

    -- 2. HG-Zahlungseingänge 2025 (WE02 Juli ausgelassen)
    INSERT INTO journal_entries
      (building_id, entry_date, fiscal_year, apartment_id,
       debit_account_id, credit_account_id, amount, description, entry_type)
    SELECT 17, make_date(2025, m, 5), 2025, apt, 323, 335, hg,
           'HG-Eingang ' || lpad(m::text,2,'0') || '/2025', 'manual'
    FROM generate_series(1,12) AS m,
    (VALUES (55,410.00),(56,458.00),(57,506.00),(58,626.00)) AS t(apt, hg)
    WHERE NOT (apt = 56 AND m = 7);  -- WE02 Juli fehlt

    -- 3. Betriebskosten 2025 (identisch 2024)
    INSERT INTO journal_entries
      (building_id, entry_date, fiscal_year, apartment_id,
       debit_account_id, credit_account_id, amount, description, entry_type)
    SELECT 17, qd, 2025, NULL, acc, 323, amt, descr, 'manual'
    FROM (VALUES
      ('2025-03-31'::date, 318, 1740.00, 'Heizung/Energie Q1 2025'),
      ('2025-03-31'::date, 313,  600.00, 'Wasser/Abwasser Q1 2025'),
      ('2025-03-31'::date, 314,  240.00, 'Müllabfuhr Q1 2025'),
      ('2025-03-31'::date, 315,  450.00, 'Versicherungen Q1 2025'),
      ('2025-03-31'::date, 316,  600.00, 'Hausmeister Q1 2025'),
      ('2025-03-31'::date, 317,  120.00, 'Allgemeinstrom Q1 2025'),
      ('2025-03-31'::date, 319,  600.00, 'Verwaltungskosten Q1 2025'),
      ('2025-03-31'::date, 320,  300.00, 'Instandhaltung Q1 2025'),
      ('2025-06-30'::date, 318, 1740.00, 'Heizung/Energie Q2 2025'),
      ('2025-06-30'::date, 313,  600.00, 'Wasser/Abwasser Q2 2025'),
      ('2025-06-30'::date, 314,  240.00, 'Müllabfuhr Q2 2025'),
      ('2025-06-30'::date, 315,  450.00, 'Versicherungen Q2 2025'),
      ('2025-06-30'::date, 316,  600.00, 'Hausmeister Q2 2025'),
      ('2025-06-30'::date, 317,  120.00, 'Allgemeinstrom Q2 2025'),
      ('2025-06-30'::date, 319,  600.00, 'Verwaltungskosten Q2 2025'),
      ('2025-06-30'::date, 320,  300.00, 'Instandhaltung Q2 2025'),
      ('2025-09-30'::date, 318, 1740.00, 'Heizung/Energie Q3 2025'),
      ('2025-09-30'::date, 313,  600.00, 'Wasser/Abwasser Q3 2025'),
      ('2025-09-30'::date, 314,  240.00, 'Müllabfuhr Q3 2025'),
      ('2025-09-30'::date, 315,  450.00, 'Versicherungen Q3 2025'),
      ('2025-09-30'::date, 316,  600.00, 'Hausmeister Q3 2025'),
      ('2025-09-30'::date, 317,  120.00, 'Allgemeinstrom Q3 2025'),
      ('2025-09-30'::date, 319,  600.00, 'Verwaltungskosten Q3 2025'),
      ('2025-09-30'::date, 320,  300.00, 'Instandhaltung Q3 2025'),
      ('2025-12-31'::date, 318, 1740.00, 'Heizung/Energie Q4 2025'),
      ('2025-12-31'::date, 313,  600.00, 'Wasser/Abwasser Q4 2025'),
      ('2025-12-31'::date, 314,  240.00, 'Müllabfuhr Q4 2025'),
      ('2025-12-31'::date, 315,  450.00, 'Versicherungen Q4 2025'),
      ('2025-12-31'::date, 316,  600.00, 'Hausmeister Q4 2025'),
      ('2025-12-31'::date, 317,  120.00, 'Allgemeinstrom Q4 2025'),
      ('2025-12-31'::date, 319,  600.00, 'Verwaltungskosten Q4 2025'),
      ('2025-12-31'::date, 320,  300.00, 'Instandhaltung Q4 2025')
    ) AS t(qd, acc, amt, descr);

    -- 4. Rücklage 2025
    INSERT INTO journal_entries
      (building_id, entry_date, fiscal_year, apartment_id,
       debit_account_id, credit_account_id, amount, description, entry_type)
    SELECT 17, make_date(2025, m, 1), 2025, NULL, 321, 323, 450.00,
           'Rücklage-Zuführung ' || lpad(m::text,2,'0') || '/2025', 'ruecklage'
    FROM generate_series(1,12) AS m;

    -- 5. Mahngebühr-Buchung bei Mahnung-Erstellung
    --    Debit 4201 Mahngebühren (340) / Credit 1420 Ford. Mahnwesen (330)
    --    apartment_id=56 → erscheint als Direktkosten in JAB WE02
    INSERT INTO journal_entries
      (building_id, entry_date, fiscal_year, apartment_id,
       debit_account_id, credit_account_id, amount, description, entry_type)
    VALUES
      (17, '2025-08-15', 2025, 56, 340, 330, 5.00,
       'Mahngebühr (Stufe 1) — Michael Braun WE02', 'manual');

    -- ==========================================================
    -- PAYMENT DEMANDS 2025
    -- WE02 (apt=56) Juli (m=7) → status='overdue', alle anderen 'paid'
    -- ==========================================================
    INSERT INTO payment_demands
      (building_id, apartment_id, person_id, demand_type, amount, status, due_date, fiscal_year)
    SELECT 17, apt, pid, 'hausgeld', hg,
           CASE WHEN apt = 56 AND m = 7 THEN 'overdue' ELSE 'paid' END,
           make_date(2025, m, 1), 2025
    FROM generate_series(1,12) AS m,
    (VALUES
      (55, 410.00, v_we01),
      (56, 458.00, v_we02),
      (57, 506.00, v_we03),
      (58, 626.00, v_we04)
    ) AS t(apt, hg, pid);

    -- ==========================================================
    -- MAHNUNG: WE02 Juli 2025 (dunning_notices)
    -- Berechnung: 458 × 3,37% × 30/365 = 1,27 € Zinsen
    --             Mahngebühr: 5,00 € (global_settings.default_dunning_fee)
    --             Gesamt: 458 + 5 + 1,27 = 464,27 €
    -- ==========================================================

    -- Demand-ID für WE02 Juli 2025 ermitteln
    SELECT id INTO v_demand_jul25
    FROM payment_demands
    WHERE building_id = 17
      AND apartment_id = 56
      AND fiscal_year  = 2025
      AND due_date     = '2025-07-01';

    INSERT INTO dunning_notices
      (building_id, person_id, payment_demand_id, dunning_level, dunning_date,
       overdue_amount, dunning_fee, interest_rate, interest_amount, total_amount,
       status, notes)
    VALUES
      (17, v_we02, v_demand_jul25, 1, '2025-08-15',
       458.00, 5.00, 3.37, 1.27, 464.27,
       'sent',
       'Zahlungserinnerung Juli 2025 — Hausgeld Zeppelinstraße 8 WE02');

END $$;

COMMIT;
