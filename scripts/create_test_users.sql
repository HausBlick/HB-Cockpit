-- ── Test-User für alle Rollen anlegen (WEG Zeppelinstraße 8) ──
-- Passwort für ALLE: Test1234!
-- Ausführen im Supabase SQL-Editor (als postgres/service_role).
--
-- Realistisches Setup:
--   Einheit 1 → Erika Eigentümer (owner) — reine Selbstnutzerin
--   Einheit 2 → Viktor Vermieter (landlord) — vermietet an Max Mustermann
--   Einheit 3 → Berta Beirat (advisory/owner) — Eigentümerin + Beiratsmitglied
--   Max Mustermann (tenant) — Mieter in Einheit 2
--
-- IDEMPOTENT: Kann mehrfach ausgeführt werden (löscht alte Test-User zuerst).

DO $$
DECLARE
    _tenant_id   UUID;
    _owner_id    UUID;
    _landlord_id UUID;
    _advisory_id UUID;
    _pw_hash     TEXT;
    _building_id BIGINT;
    _apt1_id     BIGINT;
    _apt2_id     BIGINT;
    _apt3_id     BIGINT;
    _person_tenant   UUID;
    _person_owner    UUID;
    _person_landlord UUID;
    _person_advisory UUID;
    _emails       TEXT[] := ARRAY[
        'mieter@test.hausblick.de',
        'eigentuemer@test.hausblick.de',
        'vermieter@test.hausblick.de',
        'beirat@test.hausblick.de'
    ];
    _old_uid UUID;
    _old_pid UUID;
BEGIN
    -- ═══ 0. Cleanup: alte Test-User entfernen (falls vorhanden) ═══
    FOR _old_uid IN SELECT id FROM auth.users WHERE email = ANY(_emails) LOOP
        -- persons-Verknüpfungen löschen
        SELECT id INTO _old_pid FROM persons WHERE auth_user_id = _old_uid;
        IF _old_pid IS NOT NULL THEN
            DELETE FROM tenancies WHERE tenant_id = _old_pid;
            DELETE FROM ownerships WHERE owner_id = _old_pid;
            DELETE FROM board_members WHERE person_id = _old_pid;
            DELETE FROM persons WHERE id = _old_pid;
        END IF;
        DELETE FROM profiles WHERE id = _old_uid;
        DELETE FROM auth.identities WHERE user_id = _old_uid;
        DELETE FROM auth.users WHERE id = _old_uid;
    END LOOP;

    -- Gebäude 0002 (WEG Zeppelinstraße 8) suchen
    SELECT id INTO _building_id FROM buildings
    WHERE file_number = '0002' OR name ILIKE '%Zeppelin%'
    ORDER BY id LIMIT 1;

    IF _building_id IS NULL THEN
        RAISE EXCEPTION 'Gebäude 0002 (Zeppelinstraße) nicht gefunden!';
    END IF;

    -- Erste 3 Einheiten dieses Gebäudes holen
    SELECT id INTO _apt1_id FROM apartments WHERE building_id = _building_id ORDER BY apartment_number LIMIT 1;
    SELECT id INTO _apt2_id FROM apartments WHERE building_id = _building_id ORDER BY apartment_number LIMIT 1 OFFSET 1;
    SELECT id INTO _apt3_id FROM apartments WHERE building_id = _building_id ORDER BY apartment_number LIMIT 1 OFFSET 2;

    IF _apt1_id IS NULL OR _apt2_id IS NULL OR _apt3_id IS NULL THEN
        RAISE EXCEPTION 'Gebäude hat weniger als 3 Einheiten. Gefunden: %, %, %', _apt1_id, _apt2_id, _apt3_id;
    END IF;

    -- Passwort-Hash für "Test1234!"
    _pw_hash := crypt('Test1234!', gen_salt('bf'));

    -- ═══ 1. Auth-User anlegen ═══

    _tenant_id := gen_random_uuid();
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', _tenant_id, 'authenticated', 'authenticated',
        'mieter@test.hausblick.de', _pw_hash, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Max Mustermann"}',
        NOW(), NOW(), '', '', '', ''
    );

    _owner_id := gen_random_uuid();
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', _owner_id, 'authenticated', 'authenticated',
        'eigentuemer@test.hausblick.de', _pw_hash, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Erika Eigentümer"}',
        NOW(), NOW(), '', '', '', ''
    );

    _landlord_id := gen_random_uuid();
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', _landlord_id, 'authenticated', 'authenticated',
        'vermieter@test.hausblick.de', _pw_hash, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Viktor Vermieter"}',
        NOW(), NOW(), '', '', '', ''
    );

    _advisory_id := gen_random_uuid();
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', _advisory_id, 'authenticated', 'authenticated',
        'beirat@test.hausblick.de', _pw_hash, NOW(),
        '{"provider":"email","providers":["email"]}', '{"full_name":"Berta Beirat"}',
        NOW(), NOW(), '', '', '', ''
    );

    -- ═══ 2. Identities ═══

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES
        (gen_random_uuid(), _tenant_id,   jsonb_build_object('sub', _tenant_id::text,   'email', 'mieter@test.hausblick.de'),      'email', _tenant_id::text,   NOW(), NOW(), NOW()),
        (gen_random_uuid(), _owner_id,    jsonb_build_object('sub', _owner_id::text,    'email', 'eigentuemer@test.hausblick.de'),  'email', _owner_id::text,    NOW(), NOW(), NOW()),
        (gen_random_uuid(), _landlord_id, jsonb_build_object('sub', _landlord_id::text, 'email', 'vermieter@test.hausblick.de'),   'email', _landlord_id::text, NOW(), NOW(), NOW()),
        (gen_random_uuid(), _advisory_id, jsonb_build_object('sub', _advisory_id::text, 'email', 'beirat@test.hausblick.de'),      'email', _advisory_id::text, NOW(), NOW(), NOW());

    -- ═══ 3. Profiles — Rollen setzen (handle_new_user-Trigger erstellt sie automatisch) ═══

    UPDATE profiles SET role = 'tenant',   full_name = 'Max Mustermann'   WHERE id = _tenant_id;
    UPDATE profiles SET role = 'owner',    full_name = 'Erika Eigentümer' WHERE id = _owner_id;
    UPDATE profiles SET role = 'landlord', full_name = 'Viktor Vermieter' WHERE id = _landlord_id;
    UPDATE profiles SET role = 'advisory', full_name = 'Berta Beirat'     WHERE id = _advisory_id;

    -- ═══ 4. Persons-Einträge (auth_user_id als TEXT casten, da Spalte ggf. TEXT) ═══

    INSERT INTO persons (first_name, last_name, email, auth_user_id)
    VALUES ('Max', 'Mustermann', 'mieter@test.hausblick.de', _tenant_id)
    RETURNING id INTO _person_tenant;

    INSERT INTO persons (first_name, last_name, email, auth_user_id)
    VALUES ('Erika', 'Eigentümer', 'eigentuemer@test.hausblick.de', _owner_id)
    RETURNING id INTO _person_owner;

    INSERT INTO persons (first_name, last_name, email, auth_user_id)
    VALUES ('Viktor', 'Vermieter', 'vermieter@test.hausblick.de', _landlord_id)
    RETURNING id INTO _person_landlord;

    INSERT INTO persons (first_name, last_name, email, auth_user_id)
    VALUES ('Berta', 'Beirat', 'beirat@test.hausblick.de', _advisory_id)
    RETURNING id INTO _person_advisory;

    -- ═══ 5. Verknüpfungen ═══

    -- Einheit 1 → Erika Eigentümer (owner, Selbstnutzerin)
    INSERT INTO ownerships (owner_id, apartment_id, valid_from, is_active)
    VALUES (_person_owner, _apt1_id, '2020-01-01', true);

    -- Einheit 2 → Viktor Vermieter (landlord, vermietet an Max)
    INSERT INTO ownerships (owner_id, apartment_id, valid_from, is_active)
    VALUES (_person_landlord, _apt2_id, '2020-01-01', true);

    -- Einheit 2 → Max Mustermann (tenant, Mieter bei Viktor)
    INSERT INTO tenancies (tenant_id, apartment_id, start_date, status)
    VALUES (_person_tenant, _apt2_id, '2025-01-01', 'Aktiv');

    -- Einheit 3 → Berta Beirat (owner + Beiratsmitglied)
    INSERT INTO ownerships (owner_id, apartment_id, valid_from, is_active)
    VALUES (_person_advisory, _apt3_id, '2020-01-01', true);

    INSERT INTO board_members (person_id, building_id, valid_from)
    VALUES (_person_advisory, _building_id, '2025-01-01');

    -- ═══ Ergebnis ═══
    RAISE NOTICE '4 Test-User angelegt — Passwort: Test1234!';
    RAISE NOTICE 'mieter@test.hausblick.de → tenant (Einheit 1)';
    RAISE NOTICE 'eigentuemer@test.hausblick.de → owner (Einheit 1)';
    RAISE NOTICE 'vermieter@test.hausblick.de → landlord (Einheit 2)';
    RAISE NOTICE 'beirat@test.hausblick.de → advisory (Einheit 3)';
END $$;
