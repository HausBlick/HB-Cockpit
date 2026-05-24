-- Migration: ticket_reads
-- Zweck: Gelesen-Tracking pro User + Ticket für Ungelesen-Badge in der Ticket-Liste.

CREATE TABLE IF NOT EXISTS ticket_reads (
    user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticket_id    uuid        NOT NULL REFERENCES tickets(id)    ON DELETE CASCADE,
    last_read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ticket_id)
);

ALTER TABLE ticket_reads ENABLE ROW LEVEL SECURITY;

-- Jeder User darf nur eigene Zeilen sehen, anlegen und aktualisieren.
CREATE POLICY "ticket_reads_select" ON ticket_reads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ticket_reads_insert" ON ticket_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ticket_reads_update" ON ticket_reads
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
