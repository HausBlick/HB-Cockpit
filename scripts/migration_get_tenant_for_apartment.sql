-- ── RPC: Tenant für eine Einheit finden ─────────────────────────
-- Gibt die auth_user_id (UUID) des aktiven Mieters zurück.
-- NULL wenn kein Mieter zugewiesen. SECURITY DEFINER für RLS-Bypass.

CREATE OR REPLACE FUNCTION get_tenant_for_apartment(apt_id BIGINT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.auth_user_id
    FROM tenancies t
    JOIN persons p ON p.id = t.tenant_id
    WHERE t.apartment_id = apt_id
      AND t.status = 'Aktiv'
      AND p.auth_user_id IS NOT NULL
    LIMIT 1;
$$;
