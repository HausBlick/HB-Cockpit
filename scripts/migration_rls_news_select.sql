-- ── RLS: News für alle Rollen lesbar ───────────────────────────
-- Nicht-Admins sehen nur:
-- 1. Globale News (building_id IS NULL)
-- 2. News für Gebäude in denen sie Eigentümer oder Mieter sind

DROP POLICY IF EXISTS "news_select_authenticated" ON news;
CREATE POLICY "news_select_authenticated"
ON news FOR SELECT TO authenticated
USING (
    -- Admins/Manager sehen alles
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    -- Globale News (kein Gebäude)
    OR building_id IS NULL
    -- Gebäude-News: User ist Eigentümer in diesem Gebäude
    OR building_id IN (
        SELECT a.building_id FROM ownerships o
        JOIN apartments a ON a.id = o.apartment_id
        JOIN persons p ON p.id = o.owner_id
        WHERE p.auth_user_id = auth.uid() AND o.is_active = true
    )
    -- Gebäude-News: User ist Mieter in diesem Gebäude
    OR building_id IN (
        SELECT a.building_id FROM tenancies t
        JOIN apartments a ON a.id = t.apartment_id
        JOIN persons p ON p.id = t.tenant_id
        WHERE p.auth_user_id = auth.uid() AND t.status = 'Aktiv'
    )
);
