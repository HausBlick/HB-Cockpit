-- Fix: documents RLS für owner/tenant/landlord — 'released' sichtbar machen
-- Hintergrund: docs_select_owner + docs_select_tenant hatten status='active'
-- hardcoded → Dokumente mit status='released' (z.B. Protokoll-PDF, JAB)
-- waren für Eigentümer/Mieter unsichtbar. Fix: status IN ('active','released').

DROP POLICY IF EXISTS docs_select_owner            ON documents;
DROP POLICY IF EXISTS docs_select_tenant           ON documents;
DROP POLICY IF EXISTS landlord_read_own_documents  ON documents;

CREATE POLICY docs_select_owner ON documents FOR SELECT
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    AND is_deleted = false
    AND status IN ('active', 'released')
    AND (
        uploaded_by = auth.uid()
        OR visibility_scope = 'global'
        OR (visibility_scope = 'building' AND building_id IN (SELECT get_my_owned_building_ids()))
        OR (visibility_scope = 'unit'     AND apartment_id IN (SELECT get_my_owned_apartment_ids()))
        OR (visibility_scope = 'person'   AND id IN (SELECT document_id FROM document_links WHERE profile_id = auth.uid()))
    )
);

CREATE POLICY docs_select_tenant ON documents FOR SELECT
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'tenant'
    AND is_deleted = false
    AND status IN ('active', 'released')
    AND (
        visibility_scope = 'global'
        OR (visibility_scope = 'building' AND building_id IN (
            SELECT ap.building_id FROM apartments ap
            WHERE ap.id = (SELECT apartment_id FROM profiles WHERE id = auth.uid())
        ))
        OR (visibility_scope = 'unit' AND apartment_id = (SELECT apartment_id FROM profiles WHERE id = auth.uid()))
        OR (visibility_scope = 'person' AND id IN (SELECT document_id FROM document_links WHERE profile_id = auth.uid()))
    )
);

CREATE POLICY landlord_read_own_documents ON documents FOR SELECT
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    AND (SELECT is_landlord FROM profiles WHERE id = auth.uid()) = true
    AND is_deleted = false
    AND status IN ('active', 'released')
    AND (
        apartment_id IN (SELECT get_my_owned_apartment_ids())
        OR building_id IN (SELECT get_my_owned_building_ids())
    )
);
