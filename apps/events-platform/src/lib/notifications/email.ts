import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/** Escape user-supplied strings before interpolating into HTML templates. */
function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
      &nbsp;·&nbsp;
      <a href="mailto:unsubscribe@squarebidness.com" style="color:#444;">Unsubscribe</a>
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
      <p style="color:#ef4444;font-size:10px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 6px;">${escHtml(t.tierName)}</p>
      <p style="color:#fff;font-family:'Courier New',monospace;font-size:14px;letter-spacing:0.06em;margin:0 0 18px;background:#111;display:inline-block;padding:6px 14px;border-radius:6px;">${escHtml(t.ticketCode)}</p>
      ${t.qrDataUrl ? `
      <div style="background:#fff;border-radius:12px;padding:12px;display:inline-block;margin-bottom:10px;">
        <img src="${escHtml(t.qrDataUrl)}" alt="QR Code" width="168" height="168" style="display:block;border-radius:4px;" />
      </div>` : ""}
      <p style="color:#555;font-size:11px;margin:8px 0 0;">Show this QR code at the door</p>
    </div>
  `).join("");

  const location = [p.venueName, p.city, p.state].filter(Boolean).map(escHtml).join(", ");
  // eventSlug and orderId are internal IDs — still escape for defense-in-depth
  const safeEventSlug = encodeURIComponent(p.eventSlug ?? "");
  const safeOrderId = encodeURIComponent(p.orderId);
  const eventUrl = p.eventSlug ? `https://events.squarebidness.com/events/${safeEventSlug}` : "https://events.squarebidness.com";

  return emailShell(`
    <!-- Cover -->
    ${p.coverImageUrl ? `<div style="margin-bottom:24px;border-radius:14px;overflow:hidden;"><img src="${escHtml(p.coverImageUrl)}" alt="${escHtml(p.eventTitle)}" width="528" style="width:100%;display:block;" /></div>` : ""}

    <!-- Confirmation badge -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#0a2a0a;border:1px solid #166534;border-radius:999px;padding:8px 20px;margin-bottom:14px;">
        <span style="color:#22c55e;font-size:13px;font-weight:900;letter-spacing:0.04em;">✓ &nbsp;Order Confirmed</span>
      </div>
      <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.04em;margin:0 0 6px;line-height:1.1;">You're going!<br/><span style="color:#ef4444;">${escHtml(p.eventTitle)}</span></h1>
      <p style="color:#71717a;margin:8px 0 0;font-size:14px;">Order <strong style="color:#fff;font-family:monospace;">${escHtml(p.orderCode)}</strong></p>
    </div>

    <!-- Event details -->
    <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:14px;padding:20px;margin-bottom:24px;">
      <p style="color:#a1a1aa;font-size:13px;margin:0 0 6px;">📅 <strong style="color:#fff;">${escHtml(p.eventDate)}</strong> at ${escHtml(p.eventTime)}</p>
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
      <a href="https://events.squarebidness.com/orders/${safeOrderId}"
         style="display:inline-block;background:#ef4444;color:#fff;font-weight:900;font-size:15px;padding:14px 32px;border-radius:999px;text-decoration:none;letter-spacing:-0.02em;">
        View My Tickets →
      </a>
    </div>
    <div style="text-align:center;">
      <a href="${eventUrl}" style="color:#555;font-size:12px;text-decoration:none;">View event page</a>
    </div>
  `);
}

const UNSUBSCRIBE_HEADERS = {
  "List-Unsubscribe": "<mailto:unsubscribe@squarebidness.com>",
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
};

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
    headers: UNSUBSCRIBE_HEADERS,
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
    headers: UNSUBSCRIBE_HEADERS,
    html: emailShell(`
      <h1 style="font-size:22px;font-weight:900;margin:0 0 6px;">New Sale 🎉</h1>
      <p style="color:#a1a1aa;margin:0 0 24px;">Hey ${escHtml(params.organizerName)}, someone just bought tickets.</p>
      <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:14px;padding:20px;margin-bottom:24px;">
        <p style="font-weight:900;font-size:16px;margin:0 0 12px;">${escHtml(params.eventTitle)}</p>
        <p style="color:#a1a1aa;font-size:13px;margin:0 0 4px;">Buyer: <strong style="color:#fff;">${escHtml(params.buyerName)}</strong></p>
        <p style="color:#a1a1aa;font-size:13px;margin:0 0 4px;">Tickets: <strong style="color:#fff;">${params.ticketCount}</strong></p>
        <p style="color:#a1a1aa;font-size:13px;margin:0 0 12px;">Order: <strong style="color:#fff;font-family:monospace;">${escHtml(params.orderCode)}</strong></p>
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
    headers: UNSUBSCRIBE_HEADERS,
    html: emailShell(`
      <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.04em;margin:0 0 8px;">Welcome, ${escHtml(params.organizerName)}! 🎉</h1>
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
        <a href="${escHtml(params.dashboardUrl)}"
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

  // Hard cap to prevent accidental runaway blasts
  const MAX_RECIPIENTS = 2000;
  let recipients = params.recipients;
  if (recipients.length > MAX_RECIPIENTS) {
    console.warn(`sendEventBlast: recipient count ${recipients.length} exceeds cap of ${MAX_RECIPIENTS}; truncating.`);
    recipients = recipients.slice(0, MAX_RECIPIENTS);
  }

  const eventUrl = `https://events.squarebidness.com/events/${encodeURIComponent(params.eventSlug)}`;
  let sent = 0;

  // Build the HTML body once (same for every recipient in this blast)
  const buildHtml = (_r: { email: string; name: string }) => emailShell(`
    <h1 style="font-size:22px;font-weight:900;letter-spacing:-0.04em;margin:0 0 6px;">${escHtml(params.subject)}</h1>
    <p style="color:#555;font-size:12px;margin:0 0 24px;">From ${escHtml(params.organizerName)} · re: ${escHtml(params.eventTitle)}</p>
    <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:14px;padding:20px;margin-bottom:24px;white-space:pre-line;font-size:15px;line-height:1.65;color:#d4d4d8;">
      ${params.message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "<br>")}
    </div>
    <div style="text-align:center;">
      <a href="${eventUrl}"
         style="display:inline-block;background:#ef4444;color:#fff;font-weight:900;font-size:14px;padding:12px 28px;border-radius:999px;text-decoration:none;">
        View Event →
      </a>
    </div>
    <p style="color:#333;font-size:11px;text-align:center;margin-top:20px;">
      You're receiving this because you bought a ticket to ${escHtml(params.eventTitle)}.
    </p>
  `);

  // Process in batches of 50 to avoid sequential timeout on large lists
  const BATCH_SIZE = 50;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (r) => {
        try {
          await resend.emails.send({
            from: "SB Events <tickets@squarebidness.com>",
            to: r.email,
            subject: params.subject,
            headers: UNSUBSCRIBE_HEADERS,
            html: buildHtml(r),
          });
          return 1;
        } catch {
          console.error(`Blast failed for ${r.email}`);
          return 0;
        }
      })
    );
    sent += results.reduce((a, b) => a + b, 0);
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

// ─── Event Cancellation ───────────────────────────────────────────────────────

interface SendEventCancellationParams {
  buyerName: string;
  buyerEmail: string;
  eventTitle: string;
  eventDate: string;
  orderCode: string;
  total: number;
  refunded: boolean;
}

export async function sendEventCancellationNotice(params: SendEventCancellationParams) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: params.buyerEmail,
    subject: `Event cancelled: ${params.eventTitle}`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailShell(`
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;background:#1a0a0a;border:1px solid #7f1d1d;border-radius:999px;padding:8px 20px;margin-bottom:14px;">
          <span style="color:#ef4444;font-size:13px;font-weight:900;letter-spacing:0.04em;">Event Cancelled</span>
        </div>
        <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.04em;margin:0 0 8px;">Hi ${escHtml(params.buyerName)},</h1>
        <p style="color:#a1a1aa;font-size:15px;margin:0;line-height:1.6;">
          We're sorry to let you know that <strong style="color:#fff;">${escHtml(params.eventTitle)}</strong> on <strong style="color:#fff;">${escHtml(params.eventDate)}</strong> has been cancelled by the organizer.
        </p>
      </div>

      <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:14px;padding:20px;margin-bottom:24px;">
        <p style="color:#a1a1aa;font-size:13px;margin:0 0 6px;">Order <strong style="color:#fff;font-family:monospace;">${escHtml(params.orderCode)}</strong></p>
        ${params.refunded && params.total > 0
          ? `<p style="color:#22c55e;font-size:14px;font-weight:900;margin:0;">✓ Refund of $${params.total.toFixed(2)} has been issued to your original payment method. Allow 5–10 business days.</p>`
          : params.total === 0
          ? `<p style="color:#a1a1aa;font-size:13px;margin:0;">Your free ticket has been voided.</p>`
          : `<p style="color:#eab308;font-size:13px;margin:0;">Your refund is being processed. Contact support if you don't see it within 10 business days.</p>`
        }
      </div>

      <p style="color:#555;font-size:13px;text-align:center;margin:0;">
        Questions? Reply to this email or visit <a href="https://events.squarebidness.com" style="color:#a1a1aa;">events.squarebidness.com</a>
      </p>
    `),
  });
}

// ─── Ticket Transfer Notice (to original holder) ──────────────────────────────

interface SendTicketTransferNoticeParams {
  originalEmail: string;
  originalName: string;
  newName: string;
  newEmail: string;
  ticketCode: string;
  tierName: string;
  eventTitle: string;
}

export async function sendTicketTransferNotice(params: SendTicketTransferNoticeParams) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: params.originalEmail,
    subject: `Your ticket to ${params.eventTitle} has been transferred`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailShell(`
      <h1 style="font-size:22px;font-weight:900;letter-spacing:-0.04em;margin:0 0 8px;">Ticket Transferred</h1>
      <p style="color:#a1a1aa;font-size:15px;margin:0 0 24px;line-height:1.6;">
        Hi ${escHtml(params.originalName)}, your <strong style="color:#fff;">${escHtml(params.tierName)}</strong> ticket
        to <strong style="color:#fff;">${escHtml(params.eventTitle)}</strong> has been successfully transferred.
      </p>
      <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:14px;padding:20px;margin-bottom:24px;">
        <p style="color:#a1a1aa;font-size:13px;margin:0 0 6px;">Ticket: <strong style="color:#fff;font-family:monospace;">${escHtml(params.ticketCode)}</strong></p>
        <p style="color:#a1a1aa;font-size:13px;margin:0;">Transferred to: <strong style="color:#fff;">${escHtml(params.newName)}</strong> (${escHtml(params.newEmail)})</p>
      </div>
      <p style="color:#555;font-size:13px;text-align:center;">
        If you didn't request this transfer, please contact support at
        <a href="https://events.squarebidness.com" style="color:#a1a1aa;">events.squarebidness.com</a>.
      </p>
    `),
  });
}

// ─── Ticket Transfer Received Notice (to new holder) ─────────────────────────

interface SendTicketTransferReceivedParams {
  newName: string;
  newEmail: string;
  ticketCode: string;
  tierName: string;
  eventTitle: string;
  qrDataUrl: string;
}

export async function sendTicketTransferReceived(params: SendTicketTransferReceivedParams) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: params.newEmail,
    subject: `You received a ticket to ${params.eventTitle}`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailShell(`
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;background:#0a2a0a;border:1px solid #166534;border-radius:999px;padding:8px 20px;margin-bottom:14px;">
          <span style="color:#22c55e;font-size:13px;font-weight:900;letter-spacing:0.04em;">✓ &nbsp;Ticket Received</span>
        </div>
        <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.04em;margin:0 0 6px;">You're going!<br/><span style="color:#ef4444;">${escHtml(params.eventTitle)}</span></h1>
        <p style="color:#71717a;margin:8px 0 0;font-size:14px;">A ticket has been transferred to you.</p>
      </div>
      <div style="background:#0d0d0d;border:1px solid #1e1e1e;border-radius:14px;padding:24px 20px;margin-bottom:24px;text-align:center;">
        <p style="color:#ef4444;font-size:10px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 6px;">${escHtml(params.tierName)}</p>
        <p style="color:#fff;font-family:'Courier New',monospace;font-size:14px;letter-spacing:0.06em;margin:0 0 18px;background:#111;display:inline-block;padding:6px 14px;border-radius:6px;">${escHtml(params.ticketCode)}</p>
        ${params.qrDataUrl ? `
        <div style="background:#fff;border-radius:12px;padding:12px;display:inline-block;margin-bottom:10px;">
          <img src="${escHtml(params.qrDataUrl)}" alt="QR Code" width="168" height="168" style="display:block;border-radius:4px;" />
        </div>` : ""}
        <p style="color:#555;font-size:11px;margin:8px 0 0;">Show this QR code at the door</p>
      </div>
      <p style="color:#555;font-size:13px;text-align:center;">
        Questions? Visit <a href="https://events.squarebidness.com" style="color:#a1a1aa;">events.squarebidness.com</a>.
      </p>
    `),
  });
}

export async function sendWaitlistNotification(params: SendWaitlistNotificationParams) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: params.email,
    subject: `Tickets available — ${params.eventTitle}`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailShell(`
      <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.04em;margin:0 0 8px;">Good news, ${escHtml(params.name)}! 🎟️</h1>
      <p style="color:#a1a1aa;font-size:15px;margin:0 0 24px;line-height:1.6;">
        A ticket to <strong style="color:#fff;">${escHtml(params.eventTitle)}</strong> just opened up. Grab it before it's gone — waitlist spots go fast.
      </p>
      <div style="text-align:center;">
        <a href="https://events.squarebidness.com/events/${encodeURIComponent(params.eventSlug)}"
           style="display:inline-block;background:#ef4444;color:#fff;font-weight:900;font-size:15px;padding:14px 36px;border-radius:999px;text-decoration:none;">
          Get Your Ticket →
        </a>
      </div>
    `),
  });
}

// ---------------------------------------------------------------------------
// Internal security alert — sent to platform admin on first account lockout
// ---------------------------------------------------------------------------

export async function sendAccountLockoutAlert(params: {
  email: string;
  organizerName?: string | null;
}): Promise<void> {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  if (!adminEmail || !process.env.RESEND_API_KEY) return;

  await resend.emails.send({
    from: "SB Events Security <noreply@squarebidness.com>",
    to: adminEmail,
    subject: `[Security] Organizer account locked: ${params.email}`,
    html: emailShell(`
      <h1 style="font-size:22px;font-weight:900;letter-spacing:-0.04em;margin:0 0 8px;">Account Locked 🔒</h1>
      <p style="color:#a1a1aa;font-size:15px;margin:0 0 16px;line-height:1.6;">
        The organizer account <strong style="color:#fff;">${escHtml(params.email)}</strong>${params.organizerName ? ` (${escHtml(params.organizerName)})` : ""} has been temporarily locked after too many failed login attempts.
      </p>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 12px;line-height:1.6;">
        The lockout clears automatically after 15 minutes. If this looks like a targeted attack, consider resetting the account or contacting the organizer.
      </p>
      <p style="color:#555;font-size:12px;margin:0;">
        This alert fires at most once per 15-minute lockout window.
      </p>
    `),
  });
}
