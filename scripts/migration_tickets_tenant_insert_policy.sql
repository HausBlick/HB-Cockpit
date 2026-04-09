-- ── FIX: Tenant darf Tickets erstellen ─────────────────────────
-- Fügt eine INSERT-Policy für authenticated Users auf tickets hinzu.
-- Bedingung: creator_id muss der eingeloggte User sein.

-- Bestehende INSERT-Policies prüfen und ggf. droppen
DROP POLICY IF EXISTS "tickets_insert_own" ON tickets;
DROP POLICY IF EXISTS "tickets_insert" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;

-- Alle authentifizierten User dürfen Tickets erstellen (mit eigener creator_id)
CREATE POLICY "tickets_insert_own"
ON tickets
FOR INSERT
TO authenticated
WITH CHECK (creator_id = auth.uid());
