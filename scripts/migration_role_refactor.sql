-- ── Rollenbausteine: landlord/advisory → Flags statt eigene Rollen ──
-- Basis-Rollen: admin, manager, owner, tenant
-- Landlord-Feature: profiles.is_landlord BOOLEAN
-- Advisory-Feature: board_members-Tabelle (pro Gebäude, existiert bereits)
--
-- Migrationsstrategie:
-- 1. Neue Spalte is_landlord hinzufügen
-- 2. Bestehende landlord-User → owner + is_landlord=true
-- 3. Bestehende advisory-User → owner (board_members-Eintrag bleibt bestehen)
-- 4. CHECK-Constraint auf 4 Rollen ändern

-- ═══ 1. Neue Spalte ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_landlord BOOLEAN DEFAULT false;

-- ═══ 2. Bestehende Rollen migrieren ═══
-- landlord → owner + is_landlord=true
UPDATE profiles SET role = 'owner', is_landlord = true WHERE role = 'landlord';

-- advisory → owner (board_members-Einträge bleiben erhalten)
UPDATE profiles SET role = 'owner' WHERE role = 'advisory';

-- ═══ 3. CHECK-Constraint aktualisieren (6→4 Rollen) ═══
-- Alten Constraint finden und droppen
DO $$
DECLARE
    _con_name TEXT;
BEGIN
    SELECT conname INTO _con_name
    FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%';
    IF _con_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || quote_ident(_con_name);
    END IF;
END $$;

-- Neuen Constraint setzen
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'manager', 'owner', 'tenant'));

-- ═══ 4. RLS-Policies für landlord/advisory anpassen ═══

-- Landlord-Policies: role='landlord' → role='owner' AND is_landlord=true
-- (Diese Policies gaben landlord Zugriff auf apartments, persons, documents via ownerships)

DROP POLICY IF EXISTS "landlord_select_apartments" ON apartments;
CREATE POLICY "landlord_select_apartments" ON apartments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM ownerships o
        JOIN persons p ON p.id = o.owner_id
        JOIN profiles pr ON pr.id = p.auth_user_id
        WHERE o.apartment_id = apartments.id
          AND o.is_active = true
          AND p.auth_user_id = auth.uid()
          AND pr.is_landlord = true
    )
);

DROP POLICY IF EXISTS "landlord_select_persons" ON persons;
CREATE POLICY "landlord_select_persons" ON persons FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tenancies t
        JOIN ownerships o ON o.apartment_id = t.apartment_id AND o.is_active = true
        JOIN persons owner_p ON owner_p.id = o.owner_id
        JOIN profiles pr ON pr.id = owner_p.auth_user_id
        WHERE t.tenant_id = persons.id
          AND t.status = 'Aktiv'
          AND owner_p.auth_user_id = auth.uid()
          AND pr.is_landlord = true
    )
);

DROP POLICY IF EXISTS "landlord_select_documents" ON documents;
CREATE POLICY "landlord_select_documents" ON documents FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM ownerships o
        JOIN persons p ON p.id = o.owner_id
        JOIN profiles pr ON pr.id = p.auth_user_id
        WHERE o.apartment_id = documents.apartment_id
          AND o.is_active = true
          AND p.auth_user_id = auth.uid()
          AND pr.is_landlord = true
    )
);

-- Advisory-Policies: role='advisory' → board_members-basiert (unverändert)
-- Diese prüfen bereits board_members + valid_to, nicht die Rolle.
-- Keine Änderung nötig, da advisory-User jetzt role='owner' haben
-- und der Zugriff über board_members gesteuert wird.

-- ═══ 5. Index auf is_landlord ═══
CREATE INDEX IF NOT EXISTS idx_profiles_is_landlord ON profiles(is_landlord) WHERE is_landlord = true;
