-- ── RPC: Aktiven Beirat-Zugang für den eingeloggten User finden ──
-- Gibt building_id + fiscal_year des ersten aktiven Freigabezeitraums zurück.
-- NULL wenn kein Zugang. SECURITY DEFINER für RLS-Bypass.

CREATE OR REPLACE FUNCTION get_beirat_access()
RETURNS TABLE (building_id BIGINT, fiscal_year INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT bap.building_id, bap.fiscal_year
    FROM beirat_access_periods bap
    JOIN board_members bm ON bm.building_id = bap.building_id
    JOIN persons p ON p.id = bm.person_id
    WHERE p.auth_user_id = auth.uid()
      AND bm.valid_to IS NULL
      AND bap.access_from <= CURRENT_DATE
      AND bap.access_to >= CURRENT_DATE
    LIMIT 1;
$$;
