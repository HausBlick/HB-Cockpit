// ============================================================
// E-Mail-Inhalte für Benachrichtigungen
// Hier Betreff, Texte und Button-Beschriftung anpassen.
// Nach Änderungen: "supabase functions deploy send-notification" ausführen
// oder Claude Code bitten, die Funktion neu zu deployen.
// ============================================================

export const EMAIL_BUTTON_TEXT = "Im Portal ansehen";

export const EMAIL_FOOTER = {
    // {{company}} wird durch den Firmennamen aus den Einstellungen ersetzt
    unsubscribe_text: "Sie erhalten diese E-Mail, weil Sie im HB-Cockpit registriert sind.",
    manage_link_text: "Benachrichtigungen verwalten",
};

export const EMAIL_CONTENT = {

    ticket_new: {
        subject: (title: string) =>
            `HB-Cockpit | Neues Ticket: ${title}`,
        body: (title: string) =>
            `Ein neues Ticket wurde erstellt: <strong>„${title}"</strong>.`,
    },

    ticket_status: {
        subject: (title: string) =>
            `HB-Cockpit | Ticket-Update: ${title}`,
        body: (title: string, newStatus: string) =>
            `Das Ticket <strong>„${title}"</strong> wurde auf <strong>„${newStatus}"</strong> gesetzt.`,
    },

    document_released: {
        subject: (title: string) =>
            `HB-Cockpit | Neues Dokument: ${title}`,
        body: (title: string) =>
            `Ein neues Dokument wurde für Sie freigegeben: <strong>„${title}"</strong>.`,
    },

    news_new: {
        subject: (title: string) =>
            `HB-Cockpit | Neuer Beitrag: ${title}`,
        body: (title: string) =>
            `Ein neuer Beitrag wurde auf dem Schwarzen Brett veröffentlicht: <strong>„${title}"</strong>.`,
    },

    ticket_reply: {
        subject: (title: string) =>
            `HB-Cockpit | Neue Antwort: ${title}`,
        body: (title: string) =>
            `Es gibt eine neue Antwort im Ticket <strong>„${title}"</strong>.`,
    },
};
