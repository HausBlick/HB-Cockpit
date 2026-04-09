-- ── RPC: Landlord für eine Einheit finden ──────────────────────
-- Gibt die auth_user_id (UUID) des Landlords zurück, der die
-- angegebene Einheit besitzt. NULL wenn kein Landlord gefunden.
-- SECURITY DEFINER: läuft mit DB-Rechten, umgeht RLS.

CREATE OR REPLACE FUNCTION get_landlord_for_apartment(apt_id BIGINT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.auth_user_id
    FROM ownerships o
    JOIN persons p ON p.id = o.owner_id
    JOIN profiles pr ON pr.id = p.auth_user_id
    WHERE o.apartment_id = apt_id
      AND o.is_active = true
      AND pr.role = 'landlord'
    LIMIT 1;
$$;
