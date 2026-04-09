-- ── RPC: Prüft ob der eingeloggte User aktives Beiratsmitglied ist ──
-- Gibt true/false zurück. SECURITY DEFINER für RLS-Bypass.

CREATE OR REPLACE FUNCTION check_is_advisory()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM board_members bm
        JOIN persons p ON p.id = bm.person_id
        WHERE p.auth_user_id = auth.uid()
          AND bm.valid_to IS NULL
    );
$$;
