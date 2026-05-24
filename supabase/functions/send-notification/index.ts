import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { EMAIL_BUTTON_TEXT, EMAIL_CONTENT, EMAIL_FOOTER } from "./email-content.ts";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const PORTAL_URL = "https://portal.hausblick-fn.de";

interface NotificationRequest {
  type: "ticket_new" | "ticket_status" | "ticket_reply" | "document_released" | "news_new";
  payload: {
    ticket_id?: string;
    document_id?: number;
    news_id?: number;
    building_id?: number;
    unit_id?: number;
    visibility_scope?: string;
    new_status?: string;
    old_status?: string;
    title?: string;
  };
}

interface Recipient {
  user_id: string;
  email: string;
  full_name: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";

    if (!brevoKey) return jsonResponse({ error: "BREVO_API_KEY not configured" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);
    const callerId = user.id;

    const body: NotificationRequest = await req.json();
    const { type, payload } = body;
    if (!type || !payload) return jsonResponse({ error: "Missing type or payload" }, 400);

    const { data: settings } = await supabase
      .from("global_settings")
      .select("notifications_enabled, notification_sender_email, notification_sender_name, company_name")
      .eq("id", 1)
      .single();

    if (!settings?.notifications_enabled) {
      return jsonResponse({ sent: 0, skipped: 0, reason: "notifications_disabled" });
    }

    const recipients = await resolveRecipients(supabase, type, payload, callerId);
    if (!recipients.length) return jsonResponse({ sent: 0, skipped: 0, reason: "no_recipients" });

    const userIds = recipients.map((r) => r.user_id);
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("user_id, enabled")
      .eq("trigger_type", type)
      .in("user_id", userIds);

    const disabledUsers = new Set(
      (prefs || []).filter((p) => !p.enabled).map((p) => p.user_id)
    );

    const emailContent = buildEmailContent(type, payload, settings);
    let sent = 0, skipped = 0, failed = 0;

    for (const recipient of recipients) {
      if (disabledUsers.has(recipient.user_id)) {
        await logEmail(supabase, type, recipient, emailContent.subject, "skipped", "user_opted_out", payload);
        skipped++;
        continue;
      }

      try {
        const brevoPayload = {
          sender: {
            name: settings.notification_sender_name || "HausBlick Portal",
            email: settings.notification_sender_email || "noreply@portal.hausblick-fn.de",
          },
          to: [{ email: recipient.email, name: recipient.full_name }],
          subject: emailContent.subject,
          htmlContent: emailContent.html(recipient.full_name),
        };

        const brevoResp = await fetch(BREVO_API_URL, {
          method: "POST",
          headers: {
            "accept": "application/json",
            "api-key": brevoKey,
            "content-type": "application/json",
          },
          body: JSON.stringify(brevoPayload),
        });

        if (brevoResp.ok) {
          await logEmail(supabase, type, recipient, emailContent.subject, "sent", null, payload);
          sent++;
        } else {
          const errBody = await brevoResp.text();
          await logEmail(supabase, type, recipient, emailContent.subject, "failed", errBody, payload);
          failed++;
        }
      } catch (e) {
        await logEmail(supabase, type, recipient, emailContent.subject, "failed", String(e), payload);
        failed++;
      }
    }

    return jsonResponse({ sent, skipped, failed });
  } catch (e) {
    console.error("send-notification error:", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ─── Empfänger-Auflösung ────────────────────────────────────
async function resolveRecipients(
  supabase: any, type: string, payload: any, callerId: string
): Promise<Recipient[]> {
  const recipients: Recipient[] = [];

  switch (type) {
    case "ticket_new": {
      const { data: ticket } = await supabase
        .from("tickets").select("assigned_to, building_id").eq("id", payload.ticket_id).single();
      if (!ticket) break;

      const targetIds = new Set<string>();
      if (ticket.assigned_to) targetIds.add(ticket.assigned_to);

      const { data: admins } = await supabase.from("profiles").select("id").in("role", ["admin", "manager"]);
      (admins || []).forEach((a: any) => targetIds.add(a.id));
      targetIds.delete(callerId);

      for (const uid of targetIds) {
        const r = await resolveEmail(supabase, uid);
        if (r) recipients.push(r);
      }
      break;
    }

    case "ticket_reply": {
      const { data: ticket } = await supabase
        .from("tickets").select("title, creator_id, assigned_to").eq("id", payload.ticket_id).single();
      if (!ticket) break;
      if (ticket.title && !payload.title) payload.title = ticket.title;

      // Empfänger ist die Partei, die NICHT der Absender ist
      const recipientId: string | null =
        ticket.creator_id === callerId ? (ticket.assigned_to || null) : (ticket.creator_id || null);
      if (!recipientId) break;

      const r = await resolveEmail(supabase, recipientId);
      if (r) recipients.push(r);
      break;
    }

    case "ticket_status": {
      const { data: ticket } = await supabase
        .from("tickets").select("creator_id, assigned_to").eq("id", payload.ticket_id).single();
      if (!ticket) break;

      const targetIds = new Set<string>();
      if (ticket.creator_id) targetIds.add(ticket.creator_id);
      if (ticket.assigned_to) targetIds.add(ticket.assigned_to);
      targetIds.delete(callerId);

      for (const uid of targetIds) {
        const r = await resolveEmail(supabase, uid);
        if (r) recipients.push(r);
      }
      break;
    }

    case "document_released": {
      // Dokumente gehen NIE automatisch an Mieter.
      // Mieter bekommen Dokumente nur, wenn der Vermieter sie explizit weiterreicht (Phase 5.7-B).
      const scope = payload.visibility_scope || "building";

      if (scope === "unit" && payload.unit_id) {
        // Nur der aktuelle Eigentümer dieser Einheit
        const owner = await getUnitOwner(supabase, payload.unit_id);
        if (owner && owner.user_id !== callerId) recipients.push(owner);
      } else if (scope === "person" && payload.document_id) {
        // Nur die explizit verknüpfte Person aus document_links
        const person = await getDocumentLinkPerson(supabase, payload.document_id);
        if (person && person.user_id !== callerId) recipients.push(person);
      } else if (payload.building_id) {
        // Building-Scope: nur Eigentümer, keine Mieter
        const owners = await getBuildingOwners(supabase, payload.building_id);
        for (const u of owners) { if (u.user_id !== callerId) recipients.push(u); }
      }
      break;
    }

    case "news_new": {
      // Schwarzes Brett: alle Bewohner (Eigentümer + Mieter)
      const buildingId = payload.building_id;
      if (buildingId) {
        const users = await getBuildingUsers(supabase, buildingId);
        for (const u of users) { if (u.user_id !== callerId) recipients.push(u); }
      } else {
        const { data: allProfiles } = await supabase.from("profiles").select("id, full_name").neq("id", callerId);
        for (const p of allProfiles || []) {
          const r = await resolveEmail(supabase, p.id);
          if (r) recipients.push(r);
        }
      }
      break;
    }
  }

  return recipients;
}

// ─── Nur der aktuelle Eigentümer einer Einheit ───────────────
async function getUnitOwner(supabase: any, unitId: number): Promise<Recipient | null> {
  const today = new Date().toISOString().split("T")[0];
  const { data: ownership } = await supabase
    .from("ownerships").select("owner_id").eq("apartment_id", unitId)
    .or(`end_date.is.null,end_date.gte.${today}`).limit(1).single();
  if (!ownership) return null;

  const { data: person } = await supabase
    .from("persons").select("auth_user_id, email, full_name")
    .eq("id", ownership.owner_id).not("auth_user_id", "is", null).single();
  if (!person?.auth_user_id || !person.email) return null;

  return { user_id: person.auth_user_id, email: person.email, full_name: person.full_name || "" };
}

// ─── Person aus document_links (person-scope) ────────────────
async function getDocumentLinkPerson(supabase: any, documentId: number): Promise<Recipient | null> {
  const { data: link } = await supabase
    .from("document_links").select("person_id").eq("document_id", documentId).limit(1).single();
  if (!link) return null;

  const { data: person } = await supabase
    .from("persons").select("auth_user_id, email, full_name")
    .eq("id", link.person_id).not("auth_user_id", "is", null).single();
  if (!person?.auth_user_id || !person.email) return null;

  return { user_id: person.auth_user_id, email: person.email, full_name: person.full_name || "" };
}

// ─── Nur Eigentümer eines Gebäudes (keine Mieter) ────────────
async function getBuildingOwners(supabase: any, buildingId: number): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  const seen = new Set<string>();

  const { data: apts } = await supabase.from("apartments").select("id").eq("building_id", buildingId);
  if (!apts?.length) return recipients;
  const aptIds = apts.map((a: any) => a.id);

  const today = new Date().toISOString().split("T")[0];
  const { data: ownerships } = await supabase.from("ownerships").select("owner_id")
    .in("apartment_id", aptIds).or(`end_date.is.null,end_date.gte.${today}`);

  for (const o of ownerships || []) {
    const { data: person } = await supabase.from("persons")
      .select("auth_user_id, email, full_name").eq("id", o.owner_id)
      .not("auth_user_id", "is", null).single();
    if (person?.auth_user_id && person.email && !seen.has(person.auth_user_id)) {
      seen.add(person.auth_user_id);
      recipients.push({ user_id: person.auth_user_id, email: person.email, full_name: person.full_name || "" });
    }
  }
  return recipients;
}

// ─── Alle Bewohner eines Gebäudes (Eigentümer + Mieter) ──────
async function getBuildingUsers(supabase: any, buildingId: number): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  const seen = new Set<string>();

  const { data: apts } = await supabase.from("apartments").select("id").eq("building_id", buildingId);
  if (!apts?.length) return recipients;
  const aptIds = apts.map((a: any) => a.id);

  const today = new Date().toISOString().split("T")[0];

  const { data: tenancies } = await supabase.from("tenancies").select("tenant_id")
    .in("apartment_id", aptIds).or(`end_date.is.null,end_date.gte.${today}`);
  for (const t of tenancies || []) {
    const { data: person } = await supabase.from("persons")
      .select("auth_user_id, email, full_name").eq("id", t.tenant_id).not("auth_user_id", "is", null).single();
    if (person?.auth_user_id && person.email && !seen.has(person.auth_user_id)) {
      seen.add(person.auth_user_id);
      recipients.push({ user_id: person.auth_user_id, email: person.email, full_name: person.full_name || "" });
    }
  }

  const { data: ownerships } = await supabase.from("ownerships").select("owner_id")
    .in("apartment_id", aptIds).or(`end_date.is.null,end_date.gte.${today}`);
  for (const o of ownerships || []) {
    const { data: person } = await supabase.from("persons")
      .select("auth_user_id, email, full_name").eq("id", o.owner_id).not("auth_user_id", "is", null).single();
    if (person?.auth_user_id && person.email && !seen.has(person.auth_user_id)) {
      seen.add(person.auth_user_id);
      recipients.push({ user_id: person.auth_user_id, email: person.email, full_name: person.full_name || "" });
    }
  }
  return recipients;
}

// ─── E-Mail-Adresse auflösen ─────────────────────────────────
async function resolveEmail(supabase: any, userId: string): Promise<Recipient | null> {
  const { data: person } = await supabase
    .from("persons").select("email, full_name").eq("auth_user_id", userId).limit(1).single();
  if (person?.email) return { user_id: userId, email: person.email, full_name: person.full_name || "" };

  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  if (user?.email) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
    return { user_id: userId, email: user.email, full_name: profile?.full_name || "" };
  }
  return null;
}

// ─── E-Mail-Inhalt zusammenbauen ─────────────────────────────
function buildEmailContent(
  type: string, payload: any, settings: any
): { subject: string; html: (name: string) => string } {
  const companyName = settings?.company_name || "HausBlick Portal";
  const title = payload.title || "";
  const content = EMAIL_CONTENT[type as keyof typeof EMAIL_CONTENT];

  const subject = content.subject(escHtml(title));
  let bodyText = "";
  if (type === "ticket_status") {
    bodyText = (content as typeof EMAIL_CONTENT.ticket_status).body(escHtml(title), escHtml(payload.new_status || ""));
  } else {
    bodyText = (content as typeof EMAIL_CONTENT.ticket_new).body(escHtml(title));
  }

  const ctaUrls: Record<string, string> = {
    ticket_new: `${PORTAL_URL}/dashboard.html?m=loadTickets`,
    ticket_status: `${PORTAL_URL}/dashboard.html?m=loadTickets`,
    ticket_reply: `${PORTAL_URL}/dashboard.html?m=loadTickets`,
    document_released: `${PORTAL_URL}/dashboard.html?m=loadDocuments`,
    news_new: `${PORTAL_URL}/dashboard.html?m=loadNews`,
  };
  const ctaUrl = ctaUrls[type] || PORTAL_URL;

  const footerText = EMAIL_FOOTER.unsubscribe_text.replace("{{company}}", escHtml(companyName));

  const html = (recipientName: string) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#F5F5F5;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

    <div style="background-color:#687451;padding:32px 40px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${escHtml(companyName)}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:2px;margin-top:4px;">HB-Cockpit</div>
    </div>

    <div style="padding:40px;">
      <p style="color:#555555;font-size:15px;line-height:1.6;margin:0 0 8px 0;">Hallo ${escHtml(recipientName)}${recipientName ? "," : ""}</p>
      <p style="color:#555555;font-size:15px;line-height:1.6;margin:0 0 32px 0;">${bodyText}</p>
      <a href="${ctaUrl}" style="display:inline-block;background-color:#687451;color:#ffffff;font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;">
        ${EMAIL_BUTTON_TEXT}
      </a>
    </div>

    <div style="padding:20px 40px;background:#f5f5f5;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px 0;">${footerText}</p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        <a href="${PORTAL_URL}/dashboard.html?m=loadProfile" style="color:#687451;text-decoration:none;">${EMAIL_FOOTER.manage_link_text}</a>
      </p>
    </div>

  </div>
</body></html>`;

  return { subject, html };
}

// ─── Email-Log ───────────────────────────────────────────────
async function logEmail(
  supabase: any, triggerType: string, recipient: Recipient,
  subject: string, status: string, errorMessage: string | null, payload: any
) {
  await supabase.from("email_log").insert([{
    trigger_type: triggerType,
    recipient_email: recipient.email,
    recipient_user_id: recipient.user_id,
    subject, status,
    error_message: errorMessage,
    metadata: payload || {},
  }]);
}

// ─── Helpers ─────────────────────────────────────────────────
function escHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Connection": "keep-alive" },
  });
}
