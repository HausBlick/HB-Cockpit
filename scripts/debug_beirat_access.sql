-- ── Diagnose: Warum sieht Berta keine Buchungen? ──────────────

-- 1. Bertas Auth-User + Person
SELECT 'AUTH USER' as check, u.id as auth_uid, u.email, pr.role, pr.is_landlord
FROM auth.users u
JOIN profiles pr ON pr.id = u.id
WHERE u.email = 'beirat@test.hausblick.de';

-- 2. Bertas Person-Eintrag
SELECT 'PERSON' as check, p.id as person_id, p.first_name, p.last_name, p.auth_user_id
FROM persons p
WHERE p.email = 'beirat@test.hausblick.de';

-- 3. Bertas board_members-Einträge
SELECT 'BOARD_MEMBERS' as check, bm.id, bm.person_id, bm.building_id, bm.valid_from, bm.valid_to
FROM board_members bm
JOIN persons p ON p.id = bm.person_id
WHERE p.email = 'beirat@test.hausblick.de';

-- 4. Alle beirat_access_periods
SELECT 'ACCESS_PERIODS' as check, bap.id, bap.building_id, bap.fiscal_year,
       bap.access_from, bap.access_to,
       CASE WHEN bap.access_from <= CURRENT_DATE AND bap.access_to >= CURRENT_DATE
            THEN 'AKTIV' ELSE 'INAKTIV' END as status
FROM beirat_access_periods bap;

-- 5. Journal-Entries pro Gebäude+Jahr (Counts)
SELECT 'JOURNAL_COUNTS' as check, je.building_id, je.fiscal_year, COUNT(*) as count
FROM journal_entries je
GROUP BY je.building_id, je.fiscal_year
ORDER BY je.building_id, je.fiscal_year;

-- 6. Vollständiger Join-Check: Kann Berta die Buchungen sehen?
SELECT 'FULL_JOIN_CHECK' as check,
       bm.building_id as bm_building,
       bap.building_id as bap_building,
       bap.fiscal_year,
       bap.access_from, bap.access_to,
       (SELECT COUNT(*) FROM journal_entries je
        WHERE je.building_id = bm.building_id AND je.fiscal_year = bap.fiscal_year) as matching_entries
FROM board_members bm
JOIN persons p ON p.id = bm.person_id
JOIN beirat_access_periods bap ON bap.building_id = bm.building_id
WHERE p.email = 'beirat@test.hausblick.de'
  AND bm.valid_to IS NULL
  AND bap.access_from <= CURRENT_DATE
  AND bap.access_to >= CURRENT_DATE;
