-- ── RPC: Mögliche Ticket-Empfänger für ein Gebäude ─────────────
-- Gibt Personen zurück, an die der aktuelle User Tickets senden kann.
-- Admin/Manager: alle Eigentümer/Vermieter/Beiräte des Gebäudes
-- Landlord: Mieter seiner Einheiten im Gebäude
-- SECURITY DEFINER für RLS-Bypass.

CREATE OR REPLACE FUNCTION get_ticket_recipients(bld_id BIGINT)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    role TEXT,
    apartment_number TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    -- Eigentümer/Vermieter/Beiräte des Gebäudes (für admin/manager)
    SELECT DISTINCT pr.id, pr.full_name, pr.role, a.apartment_number
    FROM ownerships o
    JOIN apartments a ON a.id = o.apartment_id
    JOIN persons p ON p.id = o.owner_id
    JOIN profiles pr ON pr.id = p.auth_user_id
    WHERE a.building_id = bld_id
      AND o.is_active = true
      AND p.auth_user_id IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM profiles caller WHERE caller.id = auth.uid() AND caller.role IN ('admin', 'manager')
      )

    UNION

    -- Mieter der Einheiten des Landlords im Gebäude (für landlord)
    SELECT DISTINCT pr.id, pr.full_name, pr.role, a.apartment_number
    FROM tenancies t
    JOIN apartments a ON a.id = t.apartment_id
    JOIN persons p ON p.id = t.tenant_id
    JOIN profiles pr ON pr.id = p.auth_user_id
    WHERE a.building_id = bld_id
      AND t.status = 'Aktiv'
      AND p.auth_user_id IS NOT NULL
      AND EXISTS (
          -- Nur Mieter von Einheiten die dem aufrufenden Landlord gehören
          SELECT 1 FROM ownerships o2
          JOIN persons p2 ON p2.id = o2.owner_id
          WHERE o2.apartment_id = t.apartment_id
            AND o2.is_active = true
            AND p2.auth_user_id = auth.uid()
      );
$$;
