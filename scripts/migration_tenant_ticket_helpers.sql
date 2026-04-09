-- ── RPC: Tenant-Einheiten für Ticket-Erstellung ────────────────
-- Gibt die Einheiten des Tenants mit Gebäude-Infos zurück.
-- SECURITY DEFINER: Tenant hat kein RLS auf apartments/buildings.

CREATE OR REPLACE FUNCTION get_my_units_for_tickets()
RETURNS TABLE (
    apt_id BIGINT,
    apartment_number TEXT,
    building_id BIGINT,
    building_name TEXT,
    file_number TEXT,
    street TEXT,
    house_number TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    -- Tenant: über tenancies
    SELECT a.id, a.apartment_number, b.id, b.name, b.file_number, b.street, b.house_number
    FROM tenancies t
    JOIN persons p ON p.id = t.tenant_id
    JOIN apartments a ON a.id = t.apartment_id
    JOIN buildings b ON b.id = a.building_id
    WHERE p.auth_user_id = auth.uid()
      AND t.status = 'Aktiv'
    UNION
    -- Owner/Landlord/Advisory: über ownerships
    SELECT a.id, a.apartment_number, b.id, b.name, b.file_number, b.street, b.house_number
    FROM ownerships o
    JOIN persons p ON p.id = o.owner_id
    JOIN apartments a ON a.id = o.apartment_id
    JOIN buildings b ON b.id = a.building_id
    WHERE p.auth_user_id = auth.uid()
      AND o.is_active = true;
$$;
