import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const LOGO = `<a href="https://events.squarebidness.com" style="text-decoration:none;display:inline-block;">
  <img src="https://events.squarebidness.com/events-192.png" alt="SB Events" width="48" height="48" style="border-radius:11px;display:block;margin:0 auto 6px;" />
  <p style="color:#a1a1aa;font-size:9px;font-weight:900;letter-spacing:0.22em;text-transform:uppercase;margin:0;text-align:center;">Square Bidness Events</p>
</a>`;

function emailShell(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:36px;">${LOGO}</div>
    ${body}
    <p style="color:#2a2a2a;font-size:11px;text-align:center;margin-top:40px;border-top:1px solid #111;padding-top:20px;">
      © ${new Date().getFullYear()} Square Bidness Events &nbsp;·&nbsp;
      <a href="https://events.squarebidness.com" style="color:#444;">events.squarebidness.com</a>
    </p>
  </div>
</body>
</html>`;
}

// ─── Buyer Ticket Confirmation ────────────────────────────────────────────────

interface TicketInfo {
  ticketCode: string;
  tierName: string;
  qrDataUrl: string;
}

interface SendBuyerConfirmationParams {
  buyerName: string;
  buyerEmail: string;
  orderCode: string;
  orderId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venueName: string | null;
  city: string | null;
  state: string | null;
  tickets: TicketInfo[];
  total: number;
  coverImageUrl?: string | null;
  eventSlug?: string;
}

function buildBuyerEmailHtml(p: SendBuyerConfirmationParams): string {
  const ticketsHtml = p.tickets.map((t) => `
    <div style="background:#0d0d0d;border:1px solid #1e1e1e;border-radius:14px;padding:24px 20px;margin-bottom:14px;text-align:center;">
      <p style="color:#ef4444;font-size:10px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 6px;">${t.tierName}</p>
      <p style="color:#fff;font-family:'Courier New',monospace;font-size:14px;letter-spacing:0.06em;margin:0 0 18px;background:#111;display:inline-block;padding:6px 14px;border-radius:6px;">${t.ticketCode}</p>
      ${t.qrDataUrl ? `
      <div style="background:#fff;border-radius:12px;padding:12px;display:inline-block;margin-bottom:10px;">
        <img src="${t.qrDataUrl}" alt="QR Code" width="168" height="168" style="display:block;border-radius:4px;" />
      </div>` : ""}
      <p style="color:#555;font-size:11px;margin:8px 0 0;">Show this QR code at the door</p>
    </div>
  `).join("");

  const location = [p.venueName, p.city, p.state].filter(Boolean).join(", ");
  const eventUrl = p.eventSlug ? `https://events.squarebidness.com/events/${p.eventSlug}` : "https://events.squarebidness.com";

  return emailShell(`
    <!-- Cover -->
    ${p.coverImageUrl ? `<div style="margin-bottom:24px;border-radius:14px;overflow:hidden;"><img src="${p.coverImageUrl}" alt="${p.eventTitle}" width="528" style="width:100%;display:block;" /></div>` : ""}

    <!-- Confirmation badge -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#0a2a0a;border:1px solid #166534;border-radius:999px;padding:8px 20px;margin-bottom:14px;">
        <span style="color:#22c55e;font-size:13px;font-weight:900;letter-spacing:0.04em;">✓ &nbsp;Order Confirmed</span>
      </div>
      <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.04em;margin:0 0 6px;line-height:1.1;">You're going!<br/><span style="color:#ef4444;">${p.eventTitle}</span></h1>
      <p style="color:#71717a;margin:8px 0 0;font-size:14px;">Order <strong style="color:#fff;font-family:monospace;">${p.orderCode}</strong></p>
    </div>

    <!-- Event details -->
    <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:14px;padding:20px;margin-bottom:24px;">
      <p style="color:#a1a1aa;font-size:13px;margin:0 0 6px;">📅 <strong style="color:#fff;">${p.eventDate}</strong> at ${p.eventTime}</p>
      ${location ? `<p style="color:#a1a1aa;font-size:13px;margin:0;">📍 ${location}</p>` : ""}
    </div>

    <!-- Tickets -->
    <p style="font-size:12px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#555;margin:0 0 12px;">
      Your Ticket${p.tickets.length !== 1 ? "s" : ""} (${p.tickets.length})
    </p>
    ${ticketsHtml}

    <!-- Total -->
    <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:12px;padding:16px 20px;margin-bottom:28px;display:flex;justify-content:space-between;">
      <span style="color:#a1a1aa;font-size:14px;">Total Paid</span>
      <span style="font-weight:900;color:#22c55e;font-size:16px;">${p.total === 0 ? "Free" : `$${p.total.toFixed(2)}`}</span>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:8px;">
      <a href="https://events.squarebidness.com/orders/${p.orderId}"
         style="display:inline-block;background:#ef4444;color:#fff;font-weight:900;font-size:15px;padding:14px 32px;border-radius:999px;text-decoration:none;letter-spacing:-0.02em;">
        View My Tickets →
      </a>
    </div>
    <div style="text-align:center;">
      <a href="${eventUrl}" style="color:#555;font-size:12px;text-decoration:none;">View event page</a>
    </div>
  `);
}

export async function sendBuyerConfirmation(params: SendBuyerConfirmationParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return;
  }
  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: params.buyerEmail,
    subject: `🎟️ You're going to ${params.eventTitle} — ${params.orderCode}`,
    html: buildBuyerEmailHtml(params),
  });
}

// ─── Organizer Sale Notification ──────────────────────────────────────────────

interface SendOrganizerSaleParams {
  organizerEmail: string;
  organizerName: string;
  eventTitle: string;
  buyerName: string;
  ticketCount: number;
  total: number;
  orderCode: string;
}

export async function sendOrganizerSaleNotification(params: SendOrganizerSaleParams) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: params.organizerEmail,
    subject: `🎟️ ${params.ticketCount} ticket${params.ticketCount !== 1 ? "s" : ""} sold — ${params.eventTitle}`,
    html: emailShell(`
      <h1 style="font-size:22px;font-weight:900;margin:0 0 6px;">New Sale 🎉</h1>
      <p style="color:#a1a1aa;margin:0 0 24px;">Hey ${params.organizerName}, someone just bought tickets.</p>
      <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:14px;padding:20px;margin-bottom:24px;">
        <p style="font-weight:900;font-size:16px;margin:0 0 12px;">${params.eventTitle}</p>
        <p style="color:#a1a1aa;font-size:13px;margin:0 0 4px;">Buyer: <strong style="color:#fff;">${params.buyerName}</strong></p>
        <p style="color:#a1a1aa;font-size:13px;margin:0 0 4px;">Tickets: <strong style="color:#fff;">${params.ticketCount}</strong></p>
        <p style="color:#a1a1aa;font-size:13px;margin:0 0 12px;">Order: <strong style="color:#fff;font-family:monospace;">${params.orderCode}</strong></p>
        <p style="color:#22c55e;font-weight:900;font-size:22px;margin:0;">+$${params.total.toFixed(2)}</p>
      </div>
      <a href="https://events.squarebidness.com/organizer/dashboard"
         style="display:inline-block;background:#fff;color:#000;font-weight:900;font-size:14px;padding:12px 28px;border-radius:999px;text-decoration:none;">
        View Dashboard →
      </a>
    `),
  });
}

// ─── Organizer Welcome Email ───────────────────────────────────────────────────

interface SendOrganizerWelcomeParams {
  organizerEmail: string;
  organizerName: string;
  dashboardUrl: string;
}

export async function sendOrganizerWelcome(params: SendOrganizerWelcomeParams) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: params.organizerEmail,
    subject: `Welcome to SB Events, ${params.organizerName}! 🎟️`,
    html: emailShell(`
      <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.04em;margin:0 0 8px;">Welcome, ${params.organizerName}! 🎉</h1>
      <p style="color:#a1a1aa;font-size:15px;margin:0 0 28px;line-height:1.6;">
        Your organizer account is verified and ready to go. Let's get your first event live.
      </p>

      <div style="display:grid;gap:12px;margin-bottom:28px;">
        ${[
          ["🎟️", "Create your event", "Add your event details, set ticket prices, and go live in minutes."],
          ["📊", "Track your sales", "Real-time analytics, order management, and payout tracking in your dashboard."],
          ["📱", "Share anywhere", "Every event gets its own link and QR code — perfect for Instagram, flyers, and more."],
        ].map(([icon, title, desc]) => `
        <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:12px;padding:16px 18px;display:flex;gap:14px;align-items:flex-start;">
          <span style="font-size:22px;flex-shrink:0;">${icon}</span>
          <div>
            <p style="font-weight:900;font-size:14px;margin:0 0 3px;">${title}</p>
            <p style="color:#71717a;font-size:13px;margin:0;line-height:1.5;">${desc}</p>
          </div>
        </div>`).join("")}
      </div>

      <div style="text-align:center;">
        <a href="${params.dashboardUrl}"
           style="display:inline-block;background:#ef4444;color:#fff;font-weight:900;font-size:15px;padding:14px 36px;border-radius:999px;text-decoration:none;">
          Go to Your Dashboard →
        </a>
      </div>
      <p style="color:#555;font-size:12px;text-align:center;margin-top:16px;">
        Questions? Reply to this email — we're here.
      </p>
    `),
  });
}

// ─── Organizer Event Blast ────────────────────────────────────────────────────

interface SendEventBlastParams {
  organizerName: string;
  eventTitle: string;
  eventSlug: string;
  subject: string;
  message: string;
  recipients: { email: string; name: string }[];
}

export async function sendEventBlast(params: SendEventBlastParams): Promise<number> {
  if (!process.env.RESEND_API_KEY) return 0;
  const eventUrl = `https://events.squarebidness.com/events/${params.eventSlug}`;
  let sent = 0;
  for (const r of params.recipients) {
    try {
      await resend.emails.send({
        from: "SB Events <tickets@squarebidness.com>",
        to: r.email,
        subject: params.subject,
        html: emailShell(`
          <h1 style="font-size:22px;font-weight:900;letter-spacing:-0.04em;margin:0 0 6px;">${params.subject}</h1>
          <p style="color:#555;font-size:12px;margin:0 0 24px;">From ${params.organizerName} · re: ${params.eventTitle}</p>
          <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:14px;padding:20px;margin-bottom:24px;white-space:pre-line;font-size:15px;line-height:1.65;color:#d4d4d8;">
            ${params.message.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}
          </div>
          <div style="text-align:center;">
            <a href="${eventUrl}"
               style="display:inline-block;background:#ef4444;color:#fff;font-weight:900;font-size:14px;padding:12px 28px;border-radius:999px;text-decoration:none;">
              View Event →
            </a>
          </div>
          <p style="color:#333;font-size:11px;text-align:center;margin-top:20px;">
            You're receiving this because you bought a ticket to ${params.eventTitle}.
          </p>
        `),
      });
      sent++;
    } catch {
      // non-fatal — log and continue
      console.error(`Blast failed for ${r.email}`);
    }
  }
  return sent;
}

// ─── Waitlist Notification ────────────────────────────────────────────────────

interface SendWaitlistNotificationParams {
  email: string;
  name: string;
  eventTitle: string;
  eventSlug: string;
}

export async function sendWaitlistNotification(params: SendWaitlistNotificationParams) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: params.email,
    subject: `Tickets available — ${params.eventTitle}`,
    html: emailShell(`
      <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.04em;margin:0 0 8px;">Good news, ${params.name}! 🎟️</h1>
      <p style="color:#a1a1aa;font-size:15px;margin:0 0 24px;line-height:1.6;">
        A ticket to <strong style="color:#fff;">${params.eventTitle}</strong> just opened up. Grab it before it's gone — waitlist spots go fast.
      </p>
      <div style="text-align:center;">
        <a href="https://events.squarebidness.com/events/${params.eventSlug}"
           style="display:inline-block;background:#ef4444;color:#fff;font-weight:900;font-size:15px;padding:14px 36px;border-radius:999px;text-decoration:none;">
          Get Your Ticket →
        </a>
      </div>
    `),
  });
}
