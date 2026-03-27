-- ============================================================
-- Phase 6-D.3: WEG-Standard-Kontenrahmen Ergänzungen
--              + is_allocatable Flag für 4100-4199
-- ============================================================

-- 1. Fehlende System-Template-Konten hinzufügen (building_id = NULL)
--    Ausführen nur wenn noch nicht vorhanden.

INSERT INTO accounts (building_id, account_number, account_name, account_type, is_system_account, is_allocatable, is_active, sort_order)
SELECT NULL, v.account_number, v.account_name, v.account_type, true, false, true, v.sort_order
FROM (VALUES
    ('1420', 'Forderungen aus Mahnwesen',  'asset',   36),
    ('8010', 'Verzugszinserträge',         'revenue', 122),
    ('8020', 'Mahngebühren-Erstattung',    'revenue', 124)
) AS v(account_number, account_name, account_type, sort_order)
WHERE NOT EXISTS (
    SELECT 1 FROM accounts e
    WHERE e.building_id IS NULL AND e.account_number = v.account_number
);

-- 2. Dieselben Konten in alle bestehenden Gebäude kopieren
--    (nur wenn dort noch nicht vorhanden)

INSERT INTO accounts (building_id, account_number, account_name, account_type, is_system_account, is_allocatable, is_active, sort_order)
SELECT b.building_id, t.account_number, t.account_name, t.account_type, t.is_system_account, t.is_allocatable, true, t.sort_order
FROM accounts t
CROSS JOIN (
    SELECT DISTINCT building_id FROM accounts WHERE building_id IS NOT NULL
) AS b
WHERE t.building_id IS NULL
  AND t.account_number IN ('1420', '8010', '8020')
  AND NOT EXISTS (
    SELECT 1 FROM accounts e
    WHERE e.building_id = b.building_id AND e.account_number = t.account_number
);

-- 3. is_allocatable = true für alle 4100–4199 Konten setzen
--    (Templates UND Gebäude-Kopien)

UPDATE accounts
SET is_allocatable = true
WHERE account_number >= '4100' AND account_number <= '4199'
  AND (is_allocatable = false OR is_allocatable IS NULL);
