-- ── FIX: RLS-Kaskade — board_members + beirat_access_periods lesbar ──
-- Die RLS-Policy auf journal_entries referenziert board_members und
-- beirat_access_periods in einem EXISTS-Subquery. PostgreSQL wertet
-- Subqueries in RLS-Policies mit den Rechten des aktuellen Users aus.
-- Ohne Lesezugriff auf diese Tabellen gibt EXISTS immer false zurück.

-- board_members: Eigene Einträge lesen
DROP POLICY IF EXISTS "board_members_select_own" ON board_members;
CREATE POLICY "board_members_select_own"
ON board_members FOR SELECT TO authenticated
USING (
    person_id IN (
        SELECT id FROM persons WHERE auth_user_id = auth.uid()
    )
);

-- beirat_access_periods: Lesbar für zugewiesene Gebäude
DROP POLICY IF EXISTS "beirat_access_periods_select_own" ON beirat_access_periods;
CREATE POLICY "beirat_access_periods_select_own"
ON beirat_access_periods FOR SELECT TO authenticated
USING (
    building_id IN (
        SELECT bm.building_id FROM board_members bm
        JOIN persons p ON p.id = bm.person_id
        WHERE p.auth_user_id = auth.uid()
          AND bm.valid_to IS NULL
    )
);
