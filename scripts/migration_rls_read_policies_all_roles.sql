-- ── FIX: Fehlende SELECT-Policies für alle Rollen ──────────────
-- Tenants/Owners/Landlords/Advisory können profiles, buildings,
-- apartments nicht lesen → Joins in Tickets/News/Docs liefern null.
--
-- Fix: SELECT-Policies für authenticated Users auf Basistabellen.

-- ═══ profiles: Alle authentifizierten User dürfen Profile lesen ═══
-- (Name + Rolle anderer User sichtbar, z.B. in Ticket-Ersteller-Anzeige)
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated"
ON profiles FOR SELECT TO authenticated
USING (true);

-- ═══ buildings: Alle authentifizierten User dürfen Gebäude lesen ═══
-- (Gebäudename in Tickets, Dokumenten, News etc.)
DROP POLICY IF EXISTS "buildings_select_authenticated" ON buildings;
CREATE POLICY "buildings_select_authenticated"
ON buildings FOR SELECT TO authenticated
USING (true);

-- ═══ apartments: Alle authentifizierten User dürfen Einheiten lesen ═══
-- (Einheitsnummer in Tickets, Zuweisungen etc.)
DROP POLICY IF EXISTS "apartments_select_authenticated" ON apartments;
CREATE POLICY "apartments_select_authenticated"
ON apartments FOR SELECT TO authenticated
USING (true);

-- ═══ tickets: SELECT für zugewiesene + eigene Tickets ═══
-- (Landlord sieht Tickets die ihm zugewiesen sind oder die er erstellt hat)
DROP POLICY IF EXISTS "tickets_select_own_or_assigned" ON tickets;
CREATE POLICY "tickets_select_own_or_assigned"
ON tickets FOR SELECT TO authenticated
USING (
    creator_id = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
);
