-- ── RLS: Beirat-Lesezugriff auf Finanztabellen ─────────────────
-- Owner mit board_members-Eintrag soll journal_entries, accounts,
-- journal_attachments und audit_protocols lesen können.
-- global_settings ist für alle authenticated lesbar.

-- ═══ journal_entries: Beirat darf Buchungen lesen ═══
DROP POLICY IF EXISTS "beirat_select_journal_entries" ON journal_entries;
CREATE POLICY "beirat_select_journal_entries"
ON journal_entries FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM board_members bm
        JOIN persons p ON p.id = bm.person_id
        JOIN beirat_access_periods bap ON bap.building_id = bm.building_id
        WHERE p.auth_user_id = auth.uid()
          AND bm.valid_to IS NULL
          AND bm.building_id = journal_entries.building_id
          AND bap.fiscal_year = journal_entries.fiscal_year
          AND bap.access_from <= CURRENT_DATE
          AND bap.access_to >= CURRENT_DATE
    )
);

-- ═══ accounts: Beirat darf Konten lesen ═══
DROP POLICY IF EXISTS "beirat_select_accounts" ON accounts;
CREATE POLICY "beirat_select_accounts"
ON accounts FOR SELECT TO authenticated
USING (
    building_id IS NULL  -- globale Kontenrahmen-Vorlagen immer lesbar
    OR EXISTS (
        SELECT 1
        FROM board_members bm
        JOIN persons p ON p.id = bm.person_id
        WHERE p.auth_user_id = auth.uid()
          AND bm.valid_to IS NULL
          AND bm.building_id = accounts.building_id
    )
);

-- ═══ journal_attachments: Beirat darf Belege lesen ═══
DROP POLICY IF EXISTS "beirat_select_journal_attachments" ON journal_attachments;
CREATE POLICY "beirat_select_journal_attachments"
ON journal_attachments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM journal_entries je
        JOIN board_members bm ON bm.building_id = je.building_id
        JOIN persons p ON p.id = bm.person_id
        JOIN beirat_access_periods bap ON bap.building_id = bm.building_id AND bap.fiscal_year = je.fiscal_year
        WHERE je.id = journal_attachments.journal_entry_id
          AND p.auth_user_id = auth.uid()
          AND bm.valid_to IS NULL
          AND bap.access_from <= CURRENT_DATE
          AND bap.access_to >= CURRENT_DATE
    )
);

-- ═══ audit_protocols: Eigene Protokolle lesen + schreiben ═══
DROP POLICY IF EXISTS "beirat_select_audit_protocols" ON audit_protocols;
CREATE POLICY "beirat_select_audit_protocols"
ON audit_protocols FOR SELECT TO authenticated
USING (auditor_id = auth.uid());

DROP POLICY IF EXISTS "beirat_insert_audit_protocols" ON audit_protocols;
CREATE POLICY "beirat_insert_audit_protocols"
ON audit_protocols FOR INSERT TO authenticated
WITH CHECK (auditor_id = auth.uid());

DROP POLICY IF EXISTS "beirat_update_audit_protocols" ON audit_protocols;
CREATE POLICY "beirat_update_audit_protocols"
ON audit_protocols FOR UPDATE TO authenticated
USING (auditor_id = auth.uid());
