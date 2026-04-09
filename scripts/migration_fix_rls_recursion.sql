-- ── FIX: Infinite Recursion in RLS-Policies entfernen ──────────
-- Die landlord-spezifischen Policies verursachen Endlosschleifen,
-- weil sie auf dieselbe Tabelle zurückverweisen.
-- Sie sind ohnehin redundant — apartments_select_authenticated,
-- buildings_select_authenticated und profiles_select_authenticated
-- erlauben bereits allen authentifizierten Usern den Lesezugriff.

DROP POLICY IF EXISTS "landlord_select_apartments" ON apartments;
DROP POLICY IF EXISTS "landlord_select_persons" ON persons;
DROP POLICY IF EXISTS "landlord_select_documents" ON documents;
