-- TESTDATEN — Löschen mit: psql "postgresql://postgres:[PASSWORT]@db.unprrlbvylmzxxhpfisr.supabase.co:5432/postgres" -f scripts/delete-testdata.sql
--
-- Erstellt zwei vollständige Testgebäude (TEST-001, TEST-002) mit:
--   Gebäude, Einheiten, Bankkonten, Kontenrahmen, Zähler, Ablesungen,
--   Wirtschaftsplan, Sollstellungen, Buchungsjournal (inkl. §35a), Mahnwesen
--
-- Voraussetzung: Supabase-Projekt unprrlbvylmzxxhpfisr, Phase 6-A Migration angewendet.

SET row_security = off;

DO $$
DECLARE
    -- ── Building IDs ────────────────────────────────────────────
    bid1 bigint;  -- TEST-001 Musterstraße 12, Berlin
    bid2 bigint;  -- TEST-002 Parkweg 5, Hamburg

    -- ── Apartment IDs Building 1 ─────────────────────────────
    apt1_1 bigint;  -- WE01 EG links  70,5 m²  MEA 350/1000
    apt1_2 bigint;  -- WE02 1.OG      85,0 m²  MEA 420/1000
    apt1_3 bigint;  -- WE03 2.OG      60,5 m²  MEA 230/1000

    -- ── Apartment IDs Building 2 ─────────────────────────────
    apt2_1 bigint;  -- WE01 EG        90,0 m²  MEA 540/1000
    apt2_2 bigint;  -- WE02 1.OG      75,0 m²  MEA 460/1000

    -- ── Account IDs Building 1 ───────────────────────────────
    a1_1200 bigint; a1_1210 bigint; a1_1400 bigint; a1_1410 bigint;
    a1_3000 bigint; a1_3100 bigint;
    a1_8400 bigint; a1_8410 bigint;
    a1_4100 bigint; a1_4110 bigint; a1_4120 bigint; a1_4130 bigint;
    a1_4140 bigint; a1_4150 bigint; a1_4160 bigint; a1_4170 bigint;
    a1_4900 bigint;

    -- ── Account IDs Building 2 ───────────────────────────────
    a2_1200 bigint; a2_1400 bigint; a2_3000 bigint;
    a2_8400 bigint; a2_4100 bigint; a2_4130 bigint;
    a2_4140 bigint; a2_4150 bigint; a2_4160 bigint;

    -- ── Meter IDs Building 1 ─────────────────────────────────
    m1_1_el bigint; m1_1_wa bigint; m1_1_he bigint;
    m1_2_el bigint; m1_2_wa bigint; m1_2_he bigint;
    m1_3_el bigint; m1_3_wa bigint; m1_3_he bigint;

    -- ── Meter IDs Building 2 ─────────────────────────────────
    m2_1_el bigint; m2_1_wa bigint;
    m2_2_el bigint; m2_2_wa bigint;

    -- ── Plan IDs ─────────────────────────────────────────────
    bp1 bigint;
    bp2 bigint;

BEGIN

-- ════════════════════════════════════════════════════════════════
-- GEBÄUDE 1: Musterstraße 12, Berlin  (TEST-001)
-- ════════════════════════════════════════════════════════════════

INSERT INTO buildings (
    name, street, house_number, zip_code, city, file_number,
    construction_year, heating_type, energy_source, status, total_mea,
    energy_certificate_type, energy_certificate_expiry,
    next_fire_safety_check, drinking_water_analysis_due,
    last_legionella_check, legionella_check_interval_months,
    fiscal_year_start, fiscal_year_end, creditor_id
) VALUES (
    'Testgebäude Musterstraße', 'Musterstraße', '12', '10115', 'Berlin', 'TEST-001',
    1978, 'Zentralheizung', 'Gas', 'active', 1000,
    'Energiebedarfsausweis', '2027-06-30',
    '2025-09-15', '2026-03-01',
    '2024-10-01', 12,
    '01-01', '12-31', 'DE98ZZZ09999999999'
) RETURNING id INTO bid1;

-- ── Einheiten ────────────────────────────────────────────────
INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, meter_heating, tenant_status)
VALUES (bid1, 'WE01 – EG links', 'Wohnung', 'EG', 70.5, 3,
    250.00, 42.00, 35.0, 350, 1000,
    'ST-001-WE01', 'WW-001-WE01', 'HZ-001-WE01', 'occupied')
RETURNING id INTO apt1_1;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, meter_heating, tenant_status)
VALUES (bid1, 'WE02 – 1.OG', 'Wohnung', '1. OG', 85.0, 4,
    300.00, 51.00, 42.0, 420, 1000,
    'ST-001-WE02', 'WW-001-WE02', 'HZ-001-WE02', 'occupied')
RETURNING id INTO apt1_2;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, meter_heating, tenant_status)
VALUES (bid1, 'WE03 – 2.OG', 'Wohnung', '2. OG', 60.5, 2,
    220.00, 37.00, 23.0, 230, 1000,
    'ST-001-WE03', 'WW-001-WE03', 'HZ-001-WE03', 'vacant')
RETURNING id INTO apt1_3;

-- ── Bankkonten ───────────────────────────────────────────────
INSERT INTO building_bank_accounts (building_id, account_type, bank_name, iban, bic, current_balance)
VALUES
    (bid1, 'giro',      'Deutsche Bank', 'DE89370400440532013000', 'DEUTDEDB', 15420.50),
    (bid1, 'ruecklage', 'Deutsche Bank', 'DE89370400440532013001', 'DEUTDEDB', 24850.00);

-- ── Kontenrahmen (Kopie der System-Vorlagen) ─────────────────
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'1200','Girokonto Hausgeld','asset','bank',false,null,true,10) RETURNING id INTO a1_1200;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'1210','Rücklagenkonto','asset','bank',true,'Instandhaltungsrücklage',true,20) RETURNING id INTO a1_1210;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'1400','Forderungen Hausgeld','asset','receivable',false,null,true,30) RETURNING id INTO a1_1400;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'1410','Forderungen Sonderumlage','asset','receivable',false,null,true,40) RETURNING id INTO a1_1410;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'3000','Erhaltungsrücklage','liability','reserve',true,'Erhaltungsrücklage',true,50) RETURNING id INTO a1_3000;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'3100','Verbindlichkeiten Guthaben','liability','payable',false,null,true,60) RETURNING id INTO a1_3100;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'8400','Hausgeld-Einnahmen','revenue','hausgeld',false,null,true,70) RETURNING id INTO a1_8400;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'8410','Sonderumlage-Einnahmen','revenue','sonderumlage',false,null,true,80) RETURNING id INTO a1_8410;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'4100','Heizung & Energie','expense','operating',false,null,true,90) RETURNING id INTO a1_4100;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'4110','Wasser & Abwasser','expense','operating',false,null,true,100) RETURNING id INTO a1_4110;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'4120','Müllabfuhr','expense','operating',false,null,true,110) RETURNING id INTO a1_4120;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'4130','Versicherungen','expense','operating',false,null,true,120) RETURNING id INTO a1_4130;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'4140','Hausmeister / Reinigung','expense','operating',false,null,true,130) RETURNING id INTO a1_4140;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'4150','Verwaltungskosten','expense','operating',false,null,true,140) RETURNING id INTO a1_4150;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'4160','Instandhaltung allgemein','expense','maintenance',false,null,true,150) RETURNING id INTO a1_4160;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'4170','Rücklagen-Entnahme Instand.','expense','reserve',false,null,true,160) RETURNING id INTO a1_4170;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid1,'4900','Sonstige Kosten','expense','other',false,null,true,170) RETURNING id INTO a1_4900;

-- ── Zähler ───────────────────────────────────────────────────
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_1,'ST-001-WE01','electricity',true) RETURNING id INTO m1_1_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_1,'WW-001-WE01','water',true)       RETURNING id INTO m1_1_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_1,'HZ-001-WE01','heating',true)     RETURNING id INTO m1_1_he;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_2,'ST-001-WE02','electricity',true) RETURNING id INTO m1_2_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_2,'WW-001-WE02','water',true)       RETURNING id INTO m1_2_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_2,'HZ-001-WE02','heating',true)     RETURNING id INTO m1_2_he;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_3,'ST-001-WE03','electricity',true) RETURNING id INTO m1_3_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_3,'WW-001-WE03','water',true)       RETURNING id INTO m1_3_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_3,'HZ-001-WE03','heating',true)     RETURNING id INTO m1_3_he;

-- ── Zählerstände (Jahresablesung 2024) ───────────────────────
INSERT INTO meter_readings (meter_id, reading_value, reading_date, reading_type) VALUES
    (m1_1_el, 12450.0, '2024-12-31', 'jahresablesung'),
    (m1_1_wa,   580.5, '2024-12-31', 'jahresablesung'),
    (m1_1_he,  3240.0, '2024-12-31', 'jahresablesung'),
    (m1_2_el, 18920.0, '2024-12-31', 'jahresablesung'),
    (m1_2_wa,   720.0, '2024-12-31', 'jahresablesung'),
    (m1_2_he,  4100.0, '2024-12-31', 'jahresablesung'),
    (m1_3_el,  9870.0, '2024-12-31', 'jahresablesung'),
    (m1_3_wa,   490.0, '2024-12-31', 'jahresablesung'),
    (m1_3_he,  2850.0, '2024-12-31', 'jahresablesung');

-- ── Zählerstände (Halbjahresablesung 2025) ───────────────────
INSERT INTO meter_readings (meter_id, reading_value, reading_date, reading_type) VALUES
    (m1_1_el, 13105.0, '2025-06-30', 'regulaer'),
    (m1_1_wa,   612.0, '2025-06-30', 'regulaer'),
    (m1_1_he,  1580.0, '2025-06-30', 'regulaer'),
    (m1_2_el, 19650.0, '2025-06-30', 'regulaer'),
    (m1_2_wa,   754.0, '2025-06-30', 'regulaer'),
    (m1_2_he,  2020.0, '2025-06-30', 'regulaer'),
    (m1_3_el, 10380.0, '2025-06-30', 'regulaer'),
    (m1_3_wa,   518.0, '2025-06-30', 'regulaer'),
    (m1_3_he,  1380.0, '2025-06-30', 'regulaer');

-- ── Wirtschaftsplan 2025 (aktiv) ─────────────────────────────
INSERT INTO budget_plans (building_id, fiscal_year, status, approved_at, valid_from, created_at, updated_at)
VALUES (bid1, 2025, 'active', NOW() - interval '75 days', '2025-01-01', NOW() - interval '80 days', NOW())
RETURNING id INTO bp1;

INSERT INTO budget_plan_items (budget_plan_id, account_id, planned_amount, prior_year_actual, adjustment_percent)
VALUES
    (bp1, a1_4100,  4800.00,  4400.00,  9.1),
    (bp1, a1_4110,  1200.00,  1100.00,  9.1),
    (bp1, a1_4120,   600.00,   560.00,  7.1),
    (bp1, a1_4130,  2400.00,  2400.00,  0.0),
    (bp1, a1_4140,  3600.00,  3200.00, 12.5),
    (bp1, a1_4150,  2400.00,  2400.00,  0.0),
    (bp1, a1_4160,  3000.00,  2800.00,  7.1);

-- ── Sollstellungen 2025 — Jan–Jun bezahlt, Jul–Dez offen ─────
INSERT INTO payment_demands (building_id, apartment_id, demand_type, amount, due_date, fiscal_year, status) VALUES
    -- WE01 (250€/Monat)
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-01-01', 2025, 'paid'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-02-01', 2025, 'paid'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-03-01', 2025, 'paid'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-04-01', 2025, 'paid'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-05-01', 2025, 'paid'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-06-01', 2025, 'paid'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-07-01', 2025, 'open'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-08-01', 2025, 'open'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-09-01', 2025, 'open'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-10-01', 2025, 'open'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-11-01', 2025, 'open'),
    (bid1, apt1_1, 'hausgeld', 250.00, '2025-12-01', 2025, 'open'),
    -- WE02 (300€/Monat)
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-01-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-02-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-03-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-04-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-05-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-06-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-07-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-08-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-09-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-10-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-11-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 300.00, '2025-12-01', 2025, 'open'),
    -- WE03 (220€/Monat) — März überfällig, Rest offen
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-01-01', 2025, 'paid'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-02-01', 2025, 'paid'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-03-01', 2025, 'overdue'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-04-01', 2025, 'overdue'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-05-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-06-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-07-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-08-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-09-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-10-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-11-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 220.00, '2025-12-01', 2025, 'open');

-- ── Buchungsjournal 2025 ─────────────────────────────────────
-- Sollstellungen (Buchung für Jan–Jun)
INSERT INTO journal_entries (building_id, apartment_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year) VALUES
    (bid1, apt1_1, '2025-01-01', 'Hausgeld 01/2025 – WE01', 250.00, a1_1400, a1_8400, 'sollstellung', 2025),
    (bid1, apt1_1, '2025-02-01', 'Hausgeld 02/2025 – WE01', 250.00, a1_1400, a1_8400, 'sollstellung', 2025),
    (bid1, apt1_1, '2025-03-01', 'Hausgeld 03/2025 – WE01', 250.00, a1_1400, a1_8400, 'sollstellung', 2025),
    (bid1, apt1_2, '2025-01-01', 'Hausgeld 01/2025 – WE02', 300.00, a1_1400, a1_8400, 'sollstellung', 2025),
    (bid1, apt1_2, '2025-02-01', 'Hausgeld 02/2025 – WE02', 300.00, a1_1400, a1_8400, 'sollstellung', 2025),
    (bid1, apt1_2, '2025-03-01', 'Hausgeld 03/2025 – WE02', 300.00, a1_1400, a1_8400, 'sollstellung', 2025),
    (bid1, apt1_3, '2025-01-01', 'Hausgeld 01/2025 – WE03', 220.00, a1_1400, a1_8400, 'sollstellung', 2025),
    (bid1, apt1_3, '2025-02-01', 'Hausgeld 02/2025 – WE03', 220.00, a1_1400, a1_8400, 'sollstellung', 2025);

-- Zahlungseingänge Jan–Mai (WE01 + WE02 pünktlich)
INSERT INTO journal_entries (building_id, apartment_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year, reference_number) VALUES
    (bid1, apt1_1, '2025-01-03', 'Hausgeld-Eingang WE01 Jan', 250.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0101'),
    (bid1, apt1_1, '2025-02-03', 'Hausgeld-Eingang WE01 Feb', 250.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0102'),
    (bid1, apt1_1, '2025-03-03', 'Hausgeld-Eingang WE01 Mrz', 250.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0103'),
    (bid1, apt1_2, '2025-01-05', 'Hausgeld-Eingang WE02 Jan', 300.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0201'),
    (bid1, apt1_2, '2025-02-05', 'Hausgeld-Eingang WE02 Feb', 300.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0202'),
    (bid1, apt1_3, '2025-01-07', 'Hausgeld-Eingang WE03 Jan', 220.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0301'),
    (bid1, apt1_3, '2025-02-07', 'Hausgeld-Eingang WE03 Feb', 220.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0302');

-- Betriebskosten 2025
INSERT INTO journal_entries (building_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year, reference_number) VALUES
    (bid1, '2025-01-15', 'Gasrechnung Januar 2025',       410.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-01'),
    (bid1, '2025-02-15', 'Gasrechnung Februar 2025',      395.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-02'),
    (bid1, '2025-03-15', 'Gasrechnung März 2025',         380.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-03'),
    (bid1, '2025-04-15', 'Gasrechnung April 2025',        310.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-04'),
    (bid1, '2025-05-15', 'Gasrechnung Mai 2025',          280.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-05'),
    (bid1, '2025-06-15', 'Gasrechnung Juni 2025',         260.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-06'),
    (bid1, '2025-01-20', 'Wassergeld Q1 2025',            290.00, a1_4110, a1_1200, 'manual', 2025, 'WAT-2025-01'),
    (bid1, '2025-04-20', 'Wassergeld Q2 2025',            305.00, a1_4110, a1_1200, 'manual', 2025, 'WAT-2025-02'),
    (bid1, '2025-01-28', 'Müllabfuhr Januar 2025',         48.00, a1_4120, a1_1200, 'manual', 2025, 'MUE-2025-01'),
    (bid1, '2025-02-28', 'Müllabfuhr Februar 2025',        48.00, a1_4120, a1_1200, 'manual', 2025, 'MUE-2025-02'),
    (bid1, '2025-03-31', 'Müllabfuhr März 2025',           48.00, a1_4120, a1_1200, 'manual', 2025, 'MUE-2025-03'),
    (bid1, '2025-01-01', 'Gebäudeversicherung Jahresprämie 2025', 2400.00, a1_4130, a1_1200, 'manual', 2025, 'VER-2025-01'),
    (bid1, '2025-01-25', 'Hausmeister Januar 2025',        300.00, a1_4140, a1_1200, 'manual', 2025, 'HM-2025-01'),
    (bid1, '2025-02-25', 'Hausmeister Februar 2025',       300.00, a1_4140, a1_1200, 'manual', 2025, 'HM-2025-02'),
    (bid1, '2025-03-25', 'Hausmeister März 2025 + §35a',   300.00, a1_4140, a1_1200, 'manual', 2025, 'HM-2025-03'),
    (bid1, '2025-01-31', 'Verwaltungskosten Q1 2025',      600.00, a1_4150, a1_1200, 'manual', 2025, 'VW-2025-01'),
    (bid1, '2025-04-30', 'Verwaltungskosten Q2 2025',      600.00, a1_4150, a1_1200, 'manual', 2025, 'VW-2025-02'),
    (bid1, '2025-03-10', 'Reparatur Hauseingang',          850.00, a1_4160, a1_1200, 'manual', 2025, 'REP-2025-01'),
    (bid1, '2025-05-22', 'Rohrreinigung Keller',           420.00, a1_4160, a1_1200, 'manual', 2025, 'REP-2025-02');

-- Buchung mit §35a EStG Lohnanteil (Hausmeister März)
UPDATE journal_entries SET lohn_anteil_35a = 210.00
WHERE building_id = bid1
  AND entry_date = '2025-03-25'
  AND description = 'Hausmeister März 2025 + §35a';

-- Rücklage-Zuführung (monatlich Jan–Jun)
INSERT INTO journal_entries (building_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year) VALUES
    (bid1, '2025-01-31', 'Zuführung Instandhaltungsrücklage Jan', 390.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-02-28', 'Zuführung Instandhaltungsrücklage Feb', 390.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-03-31', 'Zuführung Instandhaltungsrücklage Mrz', 390.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-04-30', 'Zuführung Instandhaltungsrücklage Apr', 390.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-05-31', 'Zuführung Instandhaltungsrücklage Mai', 390.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-06-30', 'Zuführung Instandhaltungsrücklage Jun', 390.00, a1_1210, a1_3000, 'ruecklage', 2025);

-- Eröffnungsbilanz (Onboarding-Demo)
INSERT INTO journal_entries (building_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year) VALUES
    (bid1, '2025-01-01', 'Eröffnungsbilanz Girokonto 01.01.2025',    12500.00, a1_1200, a1_8400, 'erhoeffnungsbilanz', 2025),
    (bid1, '2025-01-01', 'Eröffnungsbilanz Rücklagenkonto 01.01.2025', 22000.00, a1_1210, a1_3000, 'erhoeffnungsbilanz', 2025);

-- Mahnung für WE03 (überfällig März + April)
-- Mahnung: dunning_notices.person_id referenziert persons.id (CRM-Tabelle, bigint).
-- Mahnung kann im UI über den Mahnwesen-Tab angelegt werden.
-- Hier wird keine Mahnung eingespielt, um Abhängigkeit auf bestehende persons-Datensätze zu vermeiden.


-- ════════════════════════════════════════════════════════════════
-- GEBÄUDE 2: Parkweg 5, Hamburg  (TEST-002)
-- ════════════════════════════════════════════════════════════════

INSERT INTO buildings (
    name, street, house_number, zip_code, city, file_number,
    construction_year, heating_type, energy_source, status, total_mea,
    energy_certificate_type, energy_certificate_expiry,
    next_fire_safety_check, fiscal_year_start, fiscal_year_end
) VALUES (
    'Testgebäude Parkweg', 'Parkweg', '5', '20099', 'Hamburg', 'TEST-002',
    1995, 'Fernwärme', 'Fernwärme', 'active', 1000,
    'Energieverbrauchsausweis', '2028-12-31',
    '2026-04-01', '01-01', '12-31'
) RETURNING id INTO bid2;

-- ── Einheiten ────────────────────────────────────────────────
INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, tenant_status)
VALUES (bid2, 'WE01 – EG', 'Wohnung', 'EG', 90.0, 4,
    320.00, 55.00, 54.0, 540, 1000,
    'ST-002-WE01', 'WW-002-WE01', 'occupied')
RETURNING id INTO apt2_1;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, tenant_status)
VALUES (bid2, 'WE02 – 1.OG', 'Wohnung', '1. OG', 75.0, 3,
    270.00, 46.00, 46.0, 460, 1000,
    'ST-002-WE02', 'WW-002-WE02', 'occupied')
RETURNING id INTO apt2_2;

-- ── Bankkonten ───────────────────────────────────────────────
INSERT INTO building_bank_accounts (building_id, account_type, bank_name, iban, bic, current_balance)
VALUES (bid2, 'giro', 'Hamburger Sparkasse', 'DE12200505501234567890', 'HASPDEHHXXX', 8740.00);

-- ── Kontenrahmen ─────────────────────────────────────────────
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, is_active, sort_order)
VALUES (bid2,'1200','Girokonto Hausgeld','asset','bank',false,true,10) RETURNING id INTO a2_1200;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, is_active, sort_order)
VALUES (bid2,'1400','Forderungen Hausgeld','asset','receivable',false,true,30) RETURNING id INTO a2_1400;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'3000','Erhaltungsrücklage','liability','reserve',true,'Erhaltungsrücklage',true,50) RETURNING id INTO a2_3000;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, is_active, sort_order)
VALUES (bid2,'8400','Hausgeld-Einnahmen','revenue','hausgeld',false,true,70) RETURNING id INTO a2_8400;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, is_active, sort_order)
VALUES (bid2,'4100','Heizung & Energie','expense','operating',false,true,90) RETURNING id INTO a2_4100;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, is_active, sort_order)
VALUES (bid2,'4130','Versicherungen','expense','operating',false,true,120) RETURNING id INTO a2_4130;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, is_active, sort_order)
VALUES (bid2,'4140','Hausmeister / Reinigung','expense','operating',false,true,130) RETURNING id INTO a2_4140;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, is_active, sort_order)
VALUES (bid2,'4150','Verwaltungskosten','expense','operating',false,true,140) RETURNING id INTO a2_4150;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, is_active, sort_order)
VALUES (bid2,'4160','Instandhaltung allgemein','expense','maintenance',false,true,150) RETURNING id INTO a2_4160;

-- ── Zähler ───────────────────────────────────────────────────
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_1,'ST-002-WE01','electricity',true) RETURNING id INTO m2_1_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_1,'WW-002-WE01','water',true)       RETURNING id INTO m2_1_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_2,'ST-002-WE02','electricity',true) RETURNING id INTO m2_2_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_2,'WW-002-WE02','water',true)       RETURNING id INTO m2_2_wa;

-- ── Zählerstände ─────────────────────────────────────────────
INSERT INTO meter_readings (meter_id, reading_value, reading_date, reading_type) VALUES
    (m2_1_el, 8540.0,  '2024-12-31', 'jahresablesung'),
    (m2_1_wa,  420.0,  '2024-12-31', 'jahresablesung'),
    (m2_2_el, 6830.0,  '2024-12-31', 'jahresablesung'),
    (m2_2_wa,  350.0,  '2024-12-31', 'jahresablesung'),
    (m2_1_el, 9210.0,  '2025-06-30', 'regulaer'),
    (m2_1_wa,  448.0,  '2025-06-30', 'regulaer'),
    (m2_2_el, 7360.0,  '2025-06-30', 'regulaer'),
    (m2_2_wa,  374.0,  '2025-06-30', 'regulaer');

-- ── Wirtschaftsplan 2025 (Entwurf) ───────────────────────────
INSERT INTO budget_plans (building_id, fiscal_year, status, created_at, updated_at)
VALUES (bid2, 2025, 'draft', NOW() - interval '10 days', NOW())
RETURNING id INTO bp2;

INSERT INTO budget_plan_items (budget_plan_id, account_id, planned_amount, prior_year_actual, adjustment_percent)
VALUES
    (bp2, a2_4100,  3600.00,  3300.00, 9.1),
    (bp2, a2_4130,  1800.00,  1800.00, 0.0),
    (bp2, a2_4140,  2400.00,  2200.00, 9.1),
    (bp2, a2_4150,  1800.00,  1800.00, 0.0),
    (bp2, a2_4160,  1200.00,  1000.00, 20.0);

-- ── Sollstellungen 2025 ───────────────────────────────────────
INSERT INTO payment_demands (building_id, apartment_id, demand_type, amount, due_date, fiscal_year, status) VALUES
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-01-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-02-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-03-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-04-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-05-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-06-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-07-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-08-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-09-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-10-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-11-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-12-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-01-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-02-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-03-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-04-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-05-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-06-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-07-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-08-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-09-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-10-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-11-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-12-01', 2025, 'open');

-- ── Buchungsjournal 2025 ─────────────────────────────────────
INSERT INTO journal_entries (building_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year) VALUES
    (bid2, '2025-01-03', 'Hausgeld-Eingang WE01 Jan', 320.00, a2_1200, a2_1400, 'manual', 2025),
    (bid2, '2025-02-03', 'Hausgeld-Eingang WE01 Feb', 320.00, a2_1200, a2_1400, 'manual', 2025),
    (bid2, '2025-03-03', 'Hausgeld-Eingang WE01 Mrz', 320.00, a2_1200, a2_1400, 'manual', 2025),
    (bid2, '2025-04-03', 'Hausgeld-Eingang WE01 Apr', 320.00, a2_1200, a2_1400, 'manual', 2025),
    (bid2, '2025-01-05', 'Hausgeld-Eingang WE02 Jan', 270.00, a2_1200, a2_1400, 'manual', 2025),
    (bid2, '2025-02-05', 'Hausgeld-Eingang WE02 Feb', 270.00, a2_1200, a2_1400, 'manual', 2025),
    (bid2, '2025-03-05', 'Hausgeld-Eingang WE02 Mrz', 270.00, a2_1200, a2_1400, 'manual', 2025),
    (bid2, '2025-04-05', 'Hausgeld-Eingang WE02 Apr', 270.00, a2_1200, a2_1400, 'manual', 2025),
    (bid2, '2025-01-15', 'Fernwärme Januar',          300.00, a2_4100, a2_1200, 'manual', 2025),
    (bid2, '2025-02-15', 'Fernwärme Februar',         285.00, a2_4100, a2_1200, 'manual', 2025),
    (bid2, '2025-03-15', 'Fernwärme März',            275.00, a2_4100, a2_1200, 'manual', 2025),
    (bid2, '2025-01-01', 'Gebäudeversicherung 2025', 1800.00, a2_4130, a2_1200, 'manual', 2025),
    (bid2, '2025-01-25', 'Hausmeister Jan–Mrz',        600.00, a2_4140, a2_1200, 'manual', 2025),
    (bid2, '2025-01-31', 'Verwaltungskosten Q1',       450.00, a2_4150, a2_1200, 'manual', 2025),
    (bid2, '2025-04-12', 'Reparatur Dachrinne',        340.00, a2_4160, a2_1200, 'manual', 2025);

RAISE NOTICE '✓ Testgebäude 1 (TEST-001): bid=%', bid1;
RAISE NOTICE '✓ Testgebäude 2 (TEST-002): bid=%', bid2;
RAISE NOTICE '  Buchungen B1: % Einträge', (SELECT COUNT(*) FROM journal_entries WHERE building_id = bid1);
RAISE NOTICE '  Buchungen B2: % Einträge', (SELECT COUNT(*) FROM journal_entries WHERE building_id = bid2);
RAISE NOTICE '  Sollstellungen gesamt: %', (SELECT COUNT(*) FROM payment_demands WHERE building_id IN (bid1, bid2));
RAISE NOTICE '  Zählerstände gesamt: %', (SELECT COUNT(*) FROM meter_readings WHERE meter_id IN (
    SELECT id FROM meters WHERE apartment_id IN (apt1_1,apt1_2,apt1_3,apt2_1,apt2_2)));
RAISE NOTICE 'Testdaten erfolgreich eingespielt.';

END $$;
