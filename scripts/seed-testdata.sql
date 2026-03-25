-- TESTDATEN — Löschen mit: psql "postgresql://postgres:[PASSWORT]@db.unprrlbvylmzxxhpfisr.supabase.co:5432/postgres" -f scripts/delete-testdata.sql
--
-- Erstellt zwei vollständige Testgebäude (TEST-001, TEST-002) mit:
--   Gebäude, Einheiten (5 + 4), Bankkonten, Kontenrahmen, Zähler, Ablesungen,
--   Wirtschaftsplan 2025 (aktiv) + 2026 (Entwurf), Sollstellungen, Buchungsjournal

SET row_security = off;

DO $$
DECLARE
    -- ── Building IDs ────────────────────────────────────────────
    bid1 bigint;  -- TEST-001 Musterstraße 12, Berlin
    bid2 bigint;  -- TEST-002 Parkweg 5, Hamburg

    -- ── Apartment IDs Building 1 (5 WE) ─────────────────────────
    apt1_1 bigint;  -- WE01 EG links  70,5 m²  MEA 200/1000
    apt1_2 bigint;  -- WE02 EG rechts 65,0 m²  MEA 185/1000
    apt1_3 bigint;  -- WE03 1.OG      85,0 m²  MEA 240/1000
    apt1_4 bigint;  -- WE04 2.OG      78,0 m²  MEA 220/1000
    apt1_5 bigint;  -- WE05 DG        55,5 m²  MEA 155/1000

    -- ── Apartment IDs Building 2 (4 WE) ─────────────────────────
    apt2_1 bigint;  -- WE01 EG        90,0 m²  MEA 285/1000
    apt2_2 bigint;  -- WE02 1.OG li   75,0 m²  MEA 238/1000
    apt2_3 bigint;  -- WE03 1.OG re   72,0 m²  MEA 228/1000
    apt2_4 bigint;  -- WE04 2.OG      80,0 m²  MEA 249/1000

    -- ── Account IDs Building 1 ───────────────────────────────────
    a1_1200 bigint; a1_1210 bigint; a1_1400 bigint; a1_1410 bigint;
    a1_3000 bigint; a1_3100 bigint;
    a1_8400 bigint; a1_8410 bigint;
    a1_4100 bigint; a1_4110 bigint; a1_4120 bigint; a1_4130 bigint;
    a1_4140 bigint; a1_4150 bigint; a1_4160 bigint; a1_4170 bigint;
    a1_4900 bigint;

    -- ── Account IDs Building 2 ───────────────────────────────────
    a2_1200 bigint; a2_1400 bigint; a2_3000 bigint;
    a2_8400 bigint; a2_4100 bigint; a2_4110 bigint; a2_4130 bigint;
    a2_4140 bigint; a2_4150 bigint; a2_4160 bigint;

    -- ── Meter IDs Building 1 (3 Zähler je WE = 15 Stück) ────────
    m1_1_el bigint; m1_1_wa bigint; m1_1_he bigint;
    m1_2_el bigint; m1_2_wa bigint; m1_2_he bigint;
    m1_3_el bigint; m1_3_wa bigint; m1_3_he bigint;
    m1_4_el bigint; m1_4_wa bigint; m1_4_he bigint;
    m1_5_el bigint; m1_5_wa bigint; m1_5_he bigint;

    -- ── Meter IDs Building 2 (2 Zähler je WE = 8 Stück) ─────────
    m2_1_el bigint; m2_1_wa bigint;
    m2_2_el bigint; m2_2_wa bigint;
    m2_3_el bigint; m2_3_wa bigint;
    m2_4_el bigint; m2_4_wa bigint;

    -- ── Plan IDs ─────────────────────────────────────────────────
    bp1_2025 bigint; bp1_2026 bigint;
    bp2_2025 bigint; bp2_2026 bigint;

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

-- ── Einheiten ────────────────────────────────────────────────────
INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, meter_heating, tenant_status)
VALUES (bid1, 'WE01 – EG links', 'Wohnung', 'EG', 70.5, 3,
    250.00, 40.00, 20.0, 200, 1000, 'ST-001-WE01', 'WW-001-WE01', 'HZ-001-WE01', 'occupied')
RETURNING id INTO apt1_1;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, meter_heating, tenant_status)
VALUES (bid1, 'WE02 – EG rechts', 'Wohnung', 'EG', 65.0, 3,
    235.00, 37.00, 18.5, 185, 1000, 'ST-001-WE02', 'WW-001-WE02', 'HZ-001-WE02', 'occupied')
RETURNING id INTO apt1_2;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, meter_heating, tenant_status)
VALUES (bid1, 'WE03 – 1.OG', 'Wohnung', '1. OG', 85.0, 4,
    305.00, 48.00, 24.0, 240, 1000, 'ST-001-WE03', 'WW-001-WE03', 'HZ-001-WE03', 'occupied')
RETURNING id INTO apt1_3;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, meter_heating, tenant_status)
VALUES (bid1, 'WE04 – 2.OG', 'Wohnung', '2. OG', 78.0, 3,
    280.00, 44.00, 22.0, 220, 1000, 'ST-001-WE04', 'WW-001-WE04', 'HZ-001-WE04', 'occupied')
RETURNING id INTO apt1_4;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, meter_heating, tenant_status)
VALUES (bid1, 'WE05 – DG', 'Wohnung', 'DG', 55.5, 2,
    200.00, 31.00, 15.5, 155, 1000, 'ST-001-WE05', 'WW-001-WE05', 'HZ-001-WE05', 'vacant')
RETURNING id INTO apt1_5;

-- ── Bankkonten ───────────────────────────────────────────────────
INSERT INTO building_bank_accounts (building_id, account_type, bank_name, iban, bic, current_balance)
VALUES
    (bid1, 'giro',      'Deutsche Bank', 'DE89370400440532013000', 'DEUTDEDB', 18250.75),
    (bid1, 'ruecklage', 'Deutsche Bank', 'DE89370400440532013001', 'DEUTDEDB', 31400.00);

-- ── Kontenrahmen ─────────────────────────────────────────────────
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

-- ── Zähler ───────────────────────────────────────────────────────
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_1,'ST-001-WE01','electricity',true) RETURNING id INTO m1_1_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_1,'WW-001-WE01','water',true)       RETURNING id INTO m1_1_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_1,'HZ-001-WE01','heating',true)     RETURNING id INTO m1_1_he;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_2,'ST-001-WE02','electricity',true) RETURNING id INTO m1_2_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_2,'WW-001-WE02','water',true)       RETURNING id INTO m1_2_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_2,'HZ-001-WE02','heating',true)     RETURNING id INTO m1_2_he;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_3,'ST-001-WE03','electricity',true) RETURNING id INTO m1_3_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_3,'WW-001-WE03','water',true)       RETURNING id INTO m1_3_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_3,'HZ-001-WE03','heating',true)     RETURNING id INTO m1_3_he;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_4,'ST-001-WE04','electricity',true) RETURNING id INTO m1_4_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_4,'WW-001-WE04','water',true)       RETURNING id INTO m1_4_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_4,'HZ-001-WE04','heating',true)     RETURNING id INTO m1_4_he;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_5,'ST-001-WE05','electricity',true) RETURNING id INTO m1_5_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_5,'WW-001-WE05','water',true)       RETURNING id INTO m1_5_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt1_5,'HZ-001-WE05','heating',true)     RETURNING id INTO m1_5_he;

-- ── Zählerstände: Jahresanfang 2025-01-01 ────────────────────────
INSERT INTO meter_readings (meter_id, reading_value, reading_date, reading_type) VALUES
    (m1_1_el, 12450.0, '2025-01-01', 'jahresablesung'),
    (m1_1_wa,   580.5, '2025-01-01', 'jahresablesung'),
    (m1_1_he,  3240.0, '2025-01-01', 'jahresablesung'),
    (m1_2_el, 10380.0, '2025-01-01', 'jahresablesung'),
    (m1_2_wa,   490.0, '2025-01-01', 'jahresablesung'),
    (m1_2_he,  2850.0, '2025-01-01', 'jahresablesung'),
    (m1_3_el, 18920.0, '2025-01-01', 'jahresablesung'),
    (m1_3_wa,   720.0, '2025-01-01', 'jahresablesung'),
    (m1_3_he,  4100.0, '2025-01-01', 'jahresablesung'),
    (m1_4_el, 16540.0, '2025-01-01', 'jahresablesung'),
    (m1_4_wa,   630.0, '2025-01-01', 'jahresablesung'),
    (m1_4_he,  3680.0, '2025-01-01', 'jahresablesung'),
    (m1_5_el,  8190.0, '2025-01-01', 'jahresablesung'),
    (m1_5_wa,   390.0, '2025-01-01', 'jahresablesung'),
    (m1_5_he,  2220.0, '2025-01-01', 'jahresablesung');

-- ── Zählerstände: Jahresende 2025-12-31 ──────────────────────────
INSERT INTO meter_readings (meter_id, reading_value, reading_date, reading_type) VALUES
    (m1_1_el, 13740.0, '2025-12-31', 'jahresablesung'),
    (m1_1_wa,   644.0, '2025-12-31', 'jahresablesung'),
    (m1_1_he,  3960.0, '2025-12-31', 'jahresablesung'),
    (m1_2_el, 11520.0, '2025-12-31', 'jahresablesung'),
    (m1_2_wa,   546.0, '2025-12-31', 'jahresablesung'),
    (m1_2_he,  3490.0, '2025-12-31', 'jahresablesung'),
    (m1_3_el, 20360.0, '2025-12-31', 'jahresablesung'),
    (m1_3_wa,   802.0, '2025-12-31', 'jahresablesung'),
    (m1_3_he,  5020.0, '2025-12-31', 'jahresablesung'),
    (m1_4_el, 17850.0, '2025-12-31', 'jahresablesung'),
    (m1_4_wa,   698.0, '2025-12-31', 'jahresablesung'),
    (m1_4_he,  4510.0, '2025-12-31', 'jahresablesung'),
    (m1_5_el,  9070.0, '2025-12-31', 'jahresablesung'),
    (m1_5_wa,   432.0, '2025-12-31', 'jahresablesung'),
    (m1_5_he,  2730.0, '2025-12-31', 'jahresablesung');

-- ── Wirtschaftsplan 2025 (aktiv) ─────────────────────────────────
INSERT INTO budget_plans (building_id, fiscal_year, status, approved_at, valid_from, created_at, updated_at)
VALUES (bid1, 2025, 'active', NOW() - interval '75 days', '2025-01-01', NOW() - interval '80 days', NOW())
RETURNING id INTO bp1_2025;

INSERT INTO budget_plan_items (budget_plan_id, account_id, planned_amount, prior_year_actual, adjustment_percent)
VALUES
    (bp1_2025, a1_4100,  6000.00,  5500.00,  9.1),
    (bp1_2025, a1_4110,  1500.00,  1380.00,  8.7),
    (bp1_2025, a1_4120,   720.00,   680.00,  5.9),
    (bp1_2025, a1_4130,  2800.00,  2800.00,  0.0),
    (bp1_2025, a1_4140,  4200.00,  3800.00, 10.5),
    (bp1_2025, a1_4150,  3000.00,  3000.00,  0.0),
    (bp1_2025, a1_4160,  3600.00,  3200.00, 12.5);

-- ── Wirtschaftsplan 2026 (Entwurf) ───────────────────────────────
INSERT INTO budget_plans (building_id, fiscal_year, status, created_at, updated_at)
VALUES (bid1, 2026, 'draft', NOW() - interval '5 days', NOW())
RETURNING id INTO bp1_2026;

INSERT INTO budget_plan_items (budget_plan_id, account_id, planned_amount, prior_year_actual, adjustment_percent)
VALUES
    (bp1_2026, a1_4100,  6500.00,  6000.00,  8.3),
    (bp1_2026, a1_4110,  1600.00,  1500.00,  6.7),
    (bp1_2026, a1_4120,   750.00,   720.00,  4.2),
    (bp1_2026, a1_4130,  2900.00,  2800.00,  3.6),
    (bp1_2026, a1_4140,  4400.00,  4200.00,  4.8),
    (bp1_2026, a1_4150,  3100.00,  3000.00,  3.3),
    (bp1_2026, a1_4160,  4000.00,  3600.00, 11.1);

-- ── Sollstellungen 2025 — Jan–Jun bezahlt, Jul–Dez offen ─────────
INSERT INTO payment_demands (building_id, apartment_id, demand_type, amount, due_date, fiscal_year, status) VALUES
    -- WE01 (250 €/Monat) — alle bezahlt
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
    -- WE02 (235 €/Monat)
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-01-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-02-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-03-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-04-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-05-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-06-01', 2025, 'paid'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-07-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-08-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-09-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-10-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-11-01', 2025, 'open'),
    (bid1, apt1_2, 'hausgeld', 235.00, '2025-12-01', 2025, 'open'),
    -- WE03 (305 €/Monat)
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-01-01', 2025, 'paid'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-02-01', 2025, 'paid'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-03-01', 2025, 'paid'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-04-01', 2025, 'paid'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-05-01', 2025, 'paid'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-06-01', 2025, 'paid'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-07-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-08-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-09-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-10-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-11-01', 2025, 'open'),
    (bid1, apt1_3, 'hausgeld', 305.00, '2025-12-01', 2025, 'open'),
    -- WE04 (280 €/Monat)
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-01-01', 2025, 'paid'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-02-01', 2025, 'paid'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-03-01', 2025, 'paid'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-04-01', 2025, 'paid'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-05-01', 2025, 'paid'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-06-01', 2025, 'paid'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-07-01', 2025, 'open'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-08-01', 2025, 'open'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-09-01', 2025, 'open'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-10-01', 2025, 'open'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-11-01', 2025, 'open'),
    (bid1, apt1_4, 'hausgeld', 280.00, '2025-12-01', 2025, 'open'),
    -- WE05 (200 €/Monat) — leerstand ab Apr, Mar + Apr überfällig
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-01-01', 2025, 'paid'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-02-01', 2025, 'paid'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-03-01', 2025, 'overdue'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-04-01', 2025, 'overdue'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-05-01', 2025, 'open'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-06-01', 2025, 'open'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-07-01', 2025, 'open'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-08-01', 2025, 'open'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-09-01', 2025, 'open'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-10-01', 2025, 'open'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-11-01', 2025, 'open'),
    (bid1, apt1_5, 'hausgeld', 200.00, '2025-12-01', 2025, 'open');

-- ── Buchungsjournal 2025 ──────────────────────────────────────────
-- Zahlungseingänge Jan–Jun (WE01–WE04 pünktlich, WE05 nur Jan–Feb)
INSERT INTO journal_entries (building_id, apartment_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year, reference_number) VALUES
    (bid1, apt1_1, '2025-01-03', 'Hausgeld-Eingang WE01 Jan', 250.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0101'),
    (bid1, apt1_1, '2025-02-03', 'Hausgeld-Eingang WE01 Feb', 250.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0102'),
    (bid1, apt1_1, '2025-03-03', 'Hausgeld-Eingang WE01 Mrz', 250.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0103'),
    (bid1, apt1_1, '2025-04-03', 'Hausgeld-Eingang WE01 Apr', 250.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0104'),
    (bid1, apt1_1, '2025-05-03', 'Hausgeld-Eingang WE01 Mai', 250.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0105'),
    (bid1, apt1_1, '2025-06-03', 'Hausgeld-Eingang WE01 Jun', 250.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0106'),
    (bid1, apt1_2, '2025-01-05', 'Hausgeld-Eingang WE02 Jan', 235.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0201'),
    (bid1, apt1_2, '2025-02-05', 'Hausgeld-Eingang WE02 Feb', 235.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0202'),
    (bid1, apt1_2, '2025-03-05', 'Hausgeld-Eingang WE02 Mrz', 235.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0203'),
    (bid1, apt1_2, '2025-04-05', 'Hausgeld-Eingang WE02 Apr', 235.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0204'),
    (bid1, apt1_2, '2025-05-05', 'Hausgeld-Eingang WE02 Mai', 235.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0205'),
    (bid1, apt1_2, '2025-06-05', 'Hausgeld-Eingang WE02 Jun', 235.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0206'),
    (bid1, apt1_3, '2025-01-05', 'Hausgeld-Eingang WE03 Jan', 305.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0301'),
    (bid1, apt1_3, '2025-02-05', 'Hausgeld-Eingang WE03 Feb', 305.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0302'),
    (bid1, apt1_3, '2025-03-05', 'Hausgeld-Eingang WE03 Mrz', 305.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0303'),
    (bid1, apt1_3, '2025-04-05', 'Hausgeld-Eingang WE03 Apr', 305.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0304'),
    (bid1, apt1_3, '2025-05-05', 'Hausgeld-Eingang WE03 Mai', 305.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0305'),
    (bid1, apt1_3, '2025-06-05', 'Hausgeld-Eingang WE03 Jun', 305.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0306'),
    (bid1, apt1_4, '2025-01-07', 'Hausgeld-Eingang WE04 Jan', 280.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0401'),
    (bid1, apt1_4, '2025-02-07', 'Hausgeld-Eingang WE04 Feb', 280.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0402'),
    (bid1, apt1_4, '2025-03-07', 'Hausgeld-Eingang WE04 Mrz', 280.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0403'),
    (bid1, apt1_4, '2025-04-07', 'Hausgeld-Eingang WE04 Apr', 280.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0404'),
    (bid1, apt1_4, '2025-05-07', 'Hausgeld-Eingang WE04 Mai', 280.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0405'),
    (bid1, apt1_4, '2025-06-07', 'Hausgeld-Eingang WE04 Jun', 280.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0406'),
    (bid1, apt1_5, '2025-01-08', 'Hausgeld-Eingang WE05 Jan', 200.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0501'),
    (bid1, apt1_5, '2025-02-08', 'Hausgeld-Eingang WE05 Feb', 200.00, a1_1200, a1_1400, 'manual', 2025, 'RE-2025-0502');

-- Betriebskosten 2025
INSERT INTO journal_entries (building_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year, reference_number) VALUES
    (bid1, '2025-01-15', 'Gasrechnung Januar 2025',              520.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-01'),
    (bid1, '2025-02-15', 'Gasrechnung Februar 2025',             495.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-02'),
    (bid1, '2025-03-15', 'Gasrechnung März 2025',                470.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-03'),
    (bid1, '2025-04-15', 'Gasrechnung April 2025',               390.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-04'),
    (bid1, '2025-05-15', 'Gasrechnung Mai 2025',                 340.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-05'),
    (bid1, '2025-06-15', 'Gasrechnung Juni 2025',                310.00, a1_4100, a1_1200, 'manual', 2025, 'GAS-2025-06'),
    (bid1, '2025-01-20', 'Wassergeld Q1 2025',                   360.00, a1_4110, a1_1200, 'manual', 2025, 'WAT-2025-01'),
    (bid1, '2025-04-20', 'Wassergeld Q2 2025',                   375.00, a1_4110, a1_1200, 'manual', 2025, 'WAT-2025-02'),
    (bid1, '2025-01-28', 'Müllabfuhr Januar 2025',                60.00, a1_4120, a1_1200, 'manual', 2025, 'MUE-2025-01'),
    (bid1, '2025-02-28', 'Müllabfuhr Februar 2025',               60.00, a1_4120, a1_1200, 'manual', 2025, 'MUE-2025-02'),
    (bid1, '2025-03-31', 'Müllabfuhr März 2025',                  60.00, a1_4120, a1_1200, 'manual', 2025, 'MUE-2025-03'),
    (bid1, '2025-04-30', 'Müllabfuhr April 2025',                 60.00, a1_4120, a1_1200, 'manual', 2025, 'MUE-2025-04'),
    (bid1, '2025-05-31', 'Müllabfuhr Mai 2025',                   60.00, a1_4120, a1_1200, 'manual', 2025, 'MUE-2025-05'),
    (bid1, '2025-01-01', 'Gebäudeversicherung Jahresprämie 2025', 2800.00, a1_4130, a1_1200, 'manual', 2025, 'VER-2025-01'),
    (bid1, '2025-01-25', 'Hausmeister Januar 2025',               350.00, a1_4140, a1_1200, 'manual', 2025, 'HM-2025-01'),
    (bid1, '2025-02-25', 'Hausmeister Februar 2025',              350.00, a1_4140, a1_1200, 'manual', 2025, 'HM-2025-02'),
    (bid1, '2025-03-25', 'Hausmeister März 2025 + §35a',          350.00, a1_4140, a1_1200, 'manual', 2025, 'HM-2025-03'),
    (bid1, '2025-04-25', 'Hausmeister April 2025',                350.00, a1_4140, a1_1200, 'manual', 2025, 'HM-2025-04'),
    (bid1, '2025-05-25', 'Hausmeister Mai 2025',                  350.00, a1_4140, a1_1200, 'manual', 2025, 'HM-2025-05'),
    (bid1, '2025-06-25', 'Hausmeister Juni 2025',                 350.00, a1_4140, a1_1200, 'manual', 2025, 'HM-2025-06'),
    (bid1, '2025-01-31', 'Verwaltungskosten Q1 2025',             750.00, a1_4150, a1_1200, 'manual', 2025, 'VW-2025-01'),
    (bid1, '2025-04-30', 'Verwaltungskosten Q2 2025',             750.00, a1_4150, a1_1200, 'manual', 2025, 'VW-2025-02'),
    (bid1, '2025-03-10', 'Reparatur Hauseingang',                1050.00, a1_4160, a1_1200, 'manual', 2025, 'REP-2025-01'),
    (bid1, '2025-05-22', 'Rohrreinigung Keller',                  480.00, a1_4160, a1_1200, 'manual', 2025, 'REP-2025-02'),
    (bid1, '2025-06-15', 'TÜV Aufzug Hauptinspektion',           1200.00, a1_4160, a1_1200, 'manual', 2025, 'REP-2025-03');

-- §35a-Lohnanteil für Hausmeister März
UPDATE journal_entries SET lohn_anteil_35a = 245.00
WHERE building_id = bid1 AND entry_date = '2025-03-25' AND description = 'Hausmeister März 2025 + §35a';

-- Rücklage-Zuführung (monatlich Jan–Jun)
INSERT INTO journal_entries (building_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year) VALUES
    (bid1, '2025-01-31', 'Zuführung Instandhaltungsrücklage Jan', 480.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-02-28', 'Zuführung Instandhaltungsrücklage Feb', 480.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-03-31', 'Zuführung Instandhaltungsrücklage Mrz', 480.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-04-30', 'Zuführung Instandhaltungsrücklage Apr', 480.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-05-31', 'Zuführung Instandhaltungsrücklage Mai', 480.00, a1_1210, a1_3000, 'ruecklage', 2025),
    (bid1, '2025-06-30', 'Zuführung Instandhaltungsrücklage Jun', 480.00, a1_1210, a1_3000, 'ruecklage', 2025);

-- Eröffnungsbilanz
INSERT INTO journal_entries (building_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year) VALUES
    (bid1, '2025-01-01', 'Eröffnungsbilanz Girokonto 01.01.2025',     15200.00, a1_1200, a1_8400, 'erhoeffnungsbilanz', 2025),
    (bid1, '2025-01-01', 'Eröffnungsbilanz Rücklagenkonto 01.01.2025', 28500.00, a1_1210, a1_3000, 'erhoeffnungsbilanz', 2025);


-- ════════════════════════════════════════════════════════════════
-- GEBÄUDE 2: Parkweg 5, Hamburg  (TEST-002)
-- ════════════════════════════════════════════════════════════════

INSERT INTO buildings (
    name, street, house_number, zip_code, city, file_number,
    construction_year, heating_type, energy_source, status, total_mea,
    energy_certificate_type, energy_certificate_expiry,
    next_fire_safety_check, fiscal_year_start, fiscal_year_end, creditor_id
) VALUES (
    'Testgebäude Parkweg', 'Parkweg', '5', '20099', 'Hamburg', 'TEST-002',
    1995, 'Fernwärme', 'Fernwärme', 'active', 1000,
    'Energieverbrauchsausweis', '2028-12-31',
    '2026-04-01', '01-01', '12-31', 'DE98ZZZ09999999998'
) RETURNING id INTO bid2;

-- ── Einheiten ────────────────────────────────────────────────────
INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, tenant_status)
VALUES (bid2, 'WE01 – EG', 'Wohnung', 'EG', 90.0, 4,
    320.00, 55.00, 28.5, 285, 1000, 'ST-002-WE01', 'WW-002-WE01', 'occupied')
RETURNING id INTO apt2_1;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, tenant_status)
VALUES (bid2, 'WE02 – 1.OG links', 'Wohnung', '1. OG', 75.0, 3,
    270.00, 46.00, 23.8, 238, 1000, 'ST-002-WE02', 'WW-002-WE02', 'occupied')
RETURNING id INTO apt2_2;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, tenant_status)
VALUES (bid2, 'WE03 – 1.OG rechts', 'Wohnung', '1. OG', 72.0, 3,
    260.00, 44.00, 22.8, 228, 1000, 'ST-002-WE03', 'WW-002-WE03', 'occupied')
RETURNING id INTO apt2_3;

INSERT INTO apartments (building_id, apartment_number, type, floor, sq_meters, rooms,
    hausgeld, ruecklage, mea, mea_numerator, mea_denominator,
    meter_electricity, meter_water, tenant_status)
VALUES (bid2, 'WE04 – 2.OG', 'Wohnung', '2. OG', 80.0, 3,
    285.00, 48.00, 24.9, 249, 1000, 'ST-002-WE04', 'WW-002-WE04', 'occupied')
RETURNING id INTO apt2_4;

-- ── Bankkonten ───────────────────────────────────────────────────
INSERT INTO building_bank_accounts (building_id, account_type, bank_name, iban, bic, current_balance)
VALUES
    (bid2, 'giro',      'Hamburger Sparkasse', 'DE12200505501234567890', 'HASPDEHHXXX', 11380.50),
    (bid2, 'ruecklage', 'Hamburger Sparkasse', 'DE12200505501234567891', 'HASPDEHHXXX', 18600.00);

-- ── Kontenrahmen ─────────────────────────────────────────────────
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'1200','Girokonto Hausgeld','asset','bank',false,null,true,10) RETURNING id INTO a2_1200;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'1400','Forderungen Hausgeld','asset','receivable',false,null,true,30) RETURNING id INTO a2_1400;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'3000','Erhaltungsrücklage','liability','reserve',true,'Erhaltungsrücklage',true,50) RETURNING id INTO a2_3000;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'8400','Hausgeld-Einnahmen','revenue','hausgeld',false,null,true,70) RETURNING id INTO a2_8400;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'4100','Heizung & Energie','expense','operating',false,null,true,90) RETURNING id INTO a2_4100;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'4110','Wasser & Abwasser','expense','operating',false,null,true,100) RETURNING id INTO a2_4110;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'4130','Versicherungen','expense','operating',false,null,true,120) RETURNING id INTO a2_4130;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'4140','Hausmeister / Reinigung','expense','operating',false,null,true,130) RETURNING id INTO a2_4140;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'4150','Verwaltungskosten','expense','operating',false,null,true,140) RETURNING id INTO a2_4150;
INSERT INTO accounts (building_id, account_number, account_name, account_type, account_subtype, is_reserve_account, reserve_label, is_active, sort_order)
VALUES (bid2,'4160','Instandhaltung allgemein','expense','maintenance',false,null,true,150) RETURNING id INTO a2_4160;

-- ── Zähler (2 pro Einheit = 8 Stück) ────────────────────────────
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_1,'ST-002-WE01','electricity',true) RETURNING id INTO m2_1_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_1,'WW-002-WE01','water',true)       RETURNING id INTO m2_1_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_2,'ST-002-WE02','electricity',true) RETURNING id INTO m2_2_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_2,'WW-002-WE02','water',true)       RETURNING id INTO m2_2_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_3,'ST-002-WE03','electricity',true) RETURNING id INTO m2_3_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_3,'WW-002-WE03','water',true)       RETURNING id INTO m2_3_wa;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_4,'ST-002-WE04','electricity',true) RETURNING id INTO m2_4_el;
INSERT INTO meters (apartment_id, meter_number, meter_type, is_active) VALUES (apt2_4,'WW-002-WE04','water',true)       RETURNING id INTO m2_4_wa;

-- ── Zählerstände: Jahresanfang 2025-01-01 ────────────────────────
INSERT INTO meter_readings (meter_id, reading_value, reading_date, reading_type) VALUES
    (m2_1_el, 8540.0,  '2025-01-01', 'jahresablesung'),
    (m2_1_wa,  420.0,  '2025-01-01', 'jahresablesung'),
    (m2_2_el, 6830.0,  '2025-01-01', 'jahresablesung'),
    (m2_2_wa,  350.0,  '2025-01-01', 'jahresablesung'),
    (m2_3_el, 7240.0,  '2025-01-01', 'jahresablesung'),
    (m2_3_wa,  368.0,  '2025-01-01', 'jahresablesung'),
    (m2_4_el, 9120.0,  '2025-01-01', 'jahresablesung'),
    (m2_4_wa,  440.0,  '2025-01-01', 'jahresablesung');

-- ── Zählerstände: Jahresende 2025-12-31 ──────────────────────────
INSERT INTO meter_readings (meter_id, reading_value, reading_date, reading_type) VALUES
    (m2_1_el, 9380.0,  '2025-12-31', 'jahresablesung'),
    (m2_1_wa,  468.0,  '2025-12-31', 'jahresablesung'),
    (m2_2_el, 7530.0,  '2025-12-31', 'jahresablesung'),
    (m2_2_wa,  390.0,  '2025-12-31', 'jahresablesung'),
    (m2_3_el, 7990.0,  '2025-12-31', 'jahresablesung'),
    (m2_3_wa,  410.0,  '2025-12-31', 'jahresablesung'),
    (m2_4_el, 9960.0,  '2025-12-31', 'jahresablesung'),
    (m2_4_wa,  488.0,  '2025-12-31', 'jahresablesung');

-- ── Wirtschaftsplan 2025 (aktiv) ─────────────────────────────────
INSERT INTO budget_plans (building_id, fiscal_year, status, approved_at, valid_from, created_at, updated_at)
VALUES (bid2, 2025, 'active', NOW() - interval '60 days', '2025-01-01', NOW() - interval '65 days', NOW())
RETURNING id INTO bp2_2025;

INSERT INTO budget_plan_items (budget_plan_id, account_id, planned_amount, prior_year_actual, adjustment_percent)
VALUES
    (bp2_2025, a2_4100,  4800.00,  4400.00,  9.1),
    (bp2_2025, a2_4130,  2200.00,  2200.00,  0.0),
    (bp2_2025, a2_4140,  3200.00,  2900.00, 10.3),
    (bp2_2025, a2_4150,  2400.00,  2400.00,  0.0),
    (bp2_2025, a2_4160,  1800.00,  1500.00, 20.0);

-- ── Wirtschaftsplan 2026 (Entwurf) ───────────────────────────────
INSERT INTO budget_plans (building_id, fiscal_year, status, created_at, updated_at)
VALUES (bid2, 2026, 'draft', NOW() - interval '3 days', NOW())
RETURNING id INTO bp2_2026;

INSERT INTO budget_plan_items (budget_plan_id, account_id, planned_amount, prior_year_actual, adjustment_percent)
VALUES
    (bp2_2026, a2_4100,  5100.00,  4800.00,  6.3),
    (bp2_2026, a2_4130,  2300.00,  2200.00,  4.5),
    (bp2_2026, a2_4140,  3400.00,  3200.00,  6.3),
    (bp2_2026, a2_4150,  2500.00,  2400.00,  4.2),
    (bp2_2026, a2_4160,  2200.00,  1800.00, 22.2);

-- ── Sollstellungen 2025 ───────────────────────────────────────────
INSERT INTO payment_demands (building_id, apartment_id, demand_type, amount, due_date, fiscal_year, status) VALUES
    -- WE01 (320 €/Monat)
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-01-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-02-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-03-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-04-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-05-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-06-01', 2025, 'paid'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-07-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-08-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-09-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-10-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-11-01', 2025, 'open'),
    (bid2, apt2_1, 'hausgeld', 320.00, '2025-12-01', 2025, 'open'),
    -- WE02 (270 €/Monat)
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-01-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-02-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-03-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-04-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-05-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-06-01', 2025, 'paid'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-07-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-08-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-09-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-10-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-11-01', 2025, 'open'),
    (bid2, apt2_2, 'hausgeld', 270.00, '2025-12-01', 2025, 'open'),
    -- WE03 (260 €/Monat)
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-01-01', 2025, 'paid'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-02-01', 2025, 'paid'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-03-01', 2025, 'paid'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-04-01', 2025, 'paid'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-05-01', 2025, 'paid'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-06-01', 2025, 'paid'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-07-01', 2025, 'open'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-08-01', 2025, 'open'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-09-01', 2025, 'open'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-10-01', 2025, 'open'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-11-01', 2025, 'open'),
    (bid2, apt2_3, 'hausgeld', 260.00, '2025-12-01', 2025, 'open'),
    -- WE04 (285 €/Monat)
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-01-01', 2025, 'paid'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-02-01', 2025, 'paid'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-03-01', 2025, 'paid'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-04-01', 2025, 'paid'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-05-01', 2025, 'paid'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-06-01', 2025, 'paid'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-07-01', 2025, 'open'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-08-01', 2025, 'open'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-09-01', 2025, 'open'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-10-01', 2025, 'open'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-11-01', 2025, 'open'),
    (bid2, apt2_4, 'hausgeld', 285.00, '2025-12-01', 2025, 'open');

-- ── Buchungsjournal 2025 ──────────────────────────────────────────
INSERT INTO journal_entries (building_id, apartment_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year, reference_number) VALUES
    (bid2, apt2_1, '2025-01-03', 'Hausgeld-Eingang WE01 Jan', 320.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0101'),
    (bid2, apt2_1, '2025-02-03', 'Hausgeld-Eingang WE01 Feb', 320.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0102'),
    (bid2, apt2_1, '2025-03-03', 'Hausgeld-Eingang WE01 Mrz', 320.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0103'),
    (bid2, apt2_1, '2025-04-03', 'Hausgeld-Eingang WE01 Apr', 320.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0104'),
    (bid2, apt2_1, '2025-05-03', 'Hausgeld-Eingang WE01 Mai', 320.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0105'),
    (bid2, apt2_1, '2025-06-03', 'Hausgeld-Eingang WE01 Jun', 320.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0106'),
    (bid2, apt2_2, '2025-01-05', 'Hausgeld-Eingang WE02 Jan', 270.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0201'),
    (bid2, apt2_2, '2025-02-05', 'Hausgeld-Eingang WE02 Feb', 270.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0202'),
    (bid2, apt2_2, '2025-03-05', 'Hausgeld-Eingang WE02 Mrz', 270.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0203'),
    (bid2, apt2_2, '2025-04-05', 'Hausgeld-Eingang WE02 Apr', 270.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0204'),
    (bid2, apt2_2, '2025-05-05', 'Hausgeld-Eingang WE02 Mai', 270.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0205'),
    (bid2, apt2_2, '2025-06-05', 'Hausgeld-Eingang WE02 Jun', 270.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0206'),
    (bid2, apt2_3, '2025-01-06', 'Hausgeld-Eingang WE03 Jan', 260.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0301'),
    (bid2, apt2_3, '2025-02-06', 'Hausgeld-Eingang WE03 Feb', 260.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0302'),
    (bid2, apt2_3, '2025-03-06', 'Hausgeld-Eingang WE03 Mrz', 260.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0303'),
    (bid2, apt2_3, '2025-04-06', 'Hausgeld-Eingang WE03 Apr', 260.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0304'),
    (bid2, apt2_3, '2025-05-06', 'Hausgeld-Eingang WE03 Mai', 260.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0305'),
    (bid2, apt2_3, '2025-06-06', 'Hausgeld-Eingang WE03 Jun', 260.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0306'),
    (bid2, apt2_4, '2025-01-07', 'Hausgeld-Eingang WE04 Jan', 285.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0401'),
    (bid2, apt2_4, '2025-02-07', 'Hausgeld-Eingang WE04 Feb', 285.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0402'),
    (bid2, apt2_4, '2025-03-07', 'Hausgeld-Eingang WE04 Mrz', 285.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0403'),
    (bid2, apt2_4, '2025-04-07', 'Hausgeld-Eingang WE04 Apr', 285.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0404'),
    (bid2, apt2_4, '2025-05-07', 'Hausgeld-Eingang WE04 Mai', 285.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0405'),
    (bid2, apt2_4, '2025-06-07', 'Hausgeld-Eingang WE04 Jun', 285.00, a2_1200, a2_1400, 'manual', 2025, 'RE2-2025-0406');

INSERT INTO journal_entries (building_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year, reference_number) VALUES
    (bid2, '2025-01-15', 'Fernwärme Januar 2025',            380.00, a2_4100, a2_1200, 'manual', 2025, 'FW-2025-01'),
    (bid2, '2025-02-15', 'Fernwärme Februar 2025',           365.00, a2_4100, a2_1200, 'manual', 2025, 'FW-2025-02'),
    (bid2, '2025-03-15', 'Fernwärme März 2025',              350.00, a2_4100, a2_1200, 'manual', 2025, 'FW-2025-03'),
    (bid2, '2025-04-15', 'Fernwärme April 2025',             290.00, a2_4100, a2_1200, 'manual', 2025, 'FW-2025-04'),
    (bid2, '2025-05-15', 'Fernwärme Mai 2025',               260.00, a2_4100, a2_1200, 'manual', 2025, 'FW-2025-05'),
    (bid2, '2025-06-15', 'Fernwärme Juni 2025',              240.00, a2_4100, a2_1200, 'manual', 2025, 'FW-2025-06'),
    (bid2, '2025-01-20', 'Wassergeld Q1 2025',               310.00, a2_4110, a2_1200, 'manual', 2025, 'WAT2-2025-01'),
    (bid2, '2025-04-20', 'Wassergeld Q2 2025',               325.00, a2_4110, a2_1200, 'manual', 2025, 'WAT2-2025-02'),
    (bid2, '2025-01-01', 'Gebäudeversicherung 2025',        2200.00, a2_4130, a2_1200, 'manual', 2025, 'VER2-2025-01'),
    (bid2, '2025-01-25', 'Hausmeister Q1 2025',              780.00, a2_4140, a2_1200, 'manual', 2025, 'HM2-2025-01'),
    (bid2, '2025-04-25', 'Hausmeister Q2 2025',              780.00, a2_4140, a2_1200, 'manual', 2025, 'HM2-2025-02'),
    (bid2, '2025-01-31', 'Verwaltungskosten Q1 2025',        600.00, a2_4150, a2_1200, 'manual', 2025, 'VW2-2025-01'),
    (bid2, '2025-04-30', 'Verwaltungskosten Q2 2025',        600.00, a2_4150, a2_1200, 'manual', 2025, 'VW2-2025-02'),
    (bid2, '2025-04-12', 'Reparatur Dachrinne',              420.00, a2_4160, a2_1200, 'manual', 2025, 'REP2-2025-01'),
    (bid2, '2025-06-08', 'Wartung Heizungsanlage',           680.00, a2_4160, a2_1200, 'manual', 2025, 'REP2-2025-02');

-- Eröffnungsbilanz
INSERT INTO journal_entries (building_id, entry_date, description, amount, debit_account_id, credit_account_id, entry_type, fiscal_year) VALUES
    (bid2, '2025-01-01', 'Eröffnungsbilanz Girokonto 01.01.2025',     9800.00, a2_1200, a2_8400, 'erhoeffnungsbilanz', 2025),
    (bid2, '2025-01-01', 'Eröffnungsbilanz Rücklagenkonto 01.01.2025', 16200.00, a2_1200, a2_3000, 'erhoeffnungsbilanz', 2025);

RAISE NOTICE '✓ TEST-001 (bid=%): % WE, % Buchungen, % Sollstellungen',
    bid1,
    (SELECT COUNT(*) FROM apartments WHERE building_id = bid1),
    (SELECT COUNT(*) FROM journal_entries WHERE building_id = bid1),
    (SELECT COUNT(*) FROM payment_demands WHERE building_id = bid1);
RAISE NOTICE '✓ TEST-002 (bid=%): % WE, % Buchungen, % Sollstellungen',
    bid2,
    (SELECT COUNT(*) FROM apartments WHERE building_id = bid2),
    (SELECT COUNT(*) FROM journal_entries WHERE building_id = bid2),
    (SELECT COUNT(*) FROM payment_demands WHERE building_id = bid2);
RAISE NOTICE '  Zählerstände gesamt: %', (SELECT COUNT(*) FROM meter_readings WHERE meter_id IN (
    SELECT id FROM meters WHERE apartment_id IN (apt1_1,apt1_2,apt1_3,apt1_4,apt1_5,apt2_1,apt2_2,apt2_3,apt2_4)));
RAISE NOTICE 'Testdaten erfolgreich eingespielt.';

END $$;
