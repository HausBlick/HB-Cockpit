-- Fix: documents.status CHECK-Constraint um 'released' erweitern
-- Hintergrund: Phase 6.15-D hat Status 'released' eingeführt, aber den
-- CHECK-Constraint nicht aktualisiert → INSERT mit status='released' schlug fehl.

ALTER TABLE documents
    DROP CONSTRAINT documents_status_check,
    ADD CONSTRAINT documents_status_check
        CHECK (status = ANY (ARRAY['draft', 'active', 'archived', 'released']));
