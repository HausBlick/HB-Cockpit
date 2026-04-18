-- ============================================================
-- Phase 7.2 — E-Mail-Benachrichtigungen
-- Neue Tabellen: notification_preferences, email_log
-- global_settings Erweiterung: notifications_enabled, sender
-- ============================================================

-- 1. Notification Preferences (pro User, pro Trigger-Typ)
-- Default-Verhalten: opt-in (wer keinen Eintrag hat, bekommt Benachrichtigungen)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'ticket_new', 'ticket_status', 'document_released', 'news_new'
    )),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, trigger_type)
);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
    ON notification_preferences FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
    ON notification_preferences FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admin kann alle lesen (Debugging)
CREATE POLICY "Admin can read all preferences"
    ON notification_preferences FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Index
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
    ON notification_preferences(user_id);

-- 2. Email Log (Audit-Trail, DSGVO-konform, append-only)
CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_user_id UUID REFERENCES profiles(id),
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: nur Admin/Manager lesen, kein Update/Delete (Audit-Trail)
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can read email log"
    ON email_log FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Insert nur via service_role (Edge Function) — kein Insert für normale User
-- Edge Functions nutzen den service_role Key, der RLS umgeht

-- Index
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_trigger ON email_log(trigger_type, created_at DESC);

-- 3. global_settings Erweiterung
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT false;
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS notification_sender_email TEXT DEFAULT 'noreply@portal.hausblick-fn.de';
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS notification_sender_name TEXT DEFAULT 'HausBlick Portal';
