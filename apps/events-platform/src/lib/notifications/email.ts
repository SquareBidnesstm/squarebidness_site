import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
}

function buildBuyerEmailHtml(p: SendBuyerConfirmationParams): string {
  const ticketsHtml = p.tickets.map((t) => `
    <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;">
      <p style="color:#a1a1aa;font-size:11px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 4px;">
        ${t.tierName}
      </p>
      <p style="color:#fff;font-family:monospace;font-size:13px;margin:0 0 16px;">${t.ticketCode}</p>
      ${t.qrDataUrl ? `<img src="${t.qrDataUrl}" alt="QR Code" width="160" height="160" style="border-radius:8px;display:block;margin:0 auto;"/>` : ""}
      <p style="color:#555;font-size:11px;margin:12px 0 0;">Show this QR code at the door</p>
    </div>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <p style="color:#a1a1aa;font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 6px;">Square Bidness</p>
      <p style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.04em;margin:0;">EVENTS</p>
    </div>

    <!-- Confirmation -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:56px;height:56px;border-radius:50%;background:#0a2a0a;border:1px solid #166534;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:12px;">✓</div>
      <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.04em;margin:0 0 6px;">You're going!</h1>
      <p style="color:#a1a1aa;margin:0;">Order <strong style="color:#fff;">${p.orderCode}</strong> confirmed</p>
    </div>

    <!-- Event Info -->
    <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h2 style="font-size:18px;font-weight:900;margin:0 0 12px;letter-spacing:-0.03em;">${p.eventTitle}</h2>
      <p style="color:#a1a1aa;margin:0 0 4px;font-size:14px;">📅 ${p.eventDate} · ${p.eventTime}</p>
      ${p.venueName ? `<p style="color:#a1a1aa;margin:0;font-size:14px;">📍 ${[p.venueName, p.city, p.state].filter(Boolean).join(", ")}</p>` : ""}
    </div>

    <!-- Tickets -->
    <h3 style="font-size:14px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#a1a1aa;margin:0 0 12px;">
      Your Ticket${p.tickets.length !== 1 ? "s" : ""} (${p.tickets.length})
    </h3>
    ${ticketsHtml}

    <!-- Order total -->
    <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:12px;padding:16px;margin-bottom:28px;">
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#a1a1aa;font-size:14px;">Total Paid</span>
        <span style="font-weight:900;color:#22c55e;">$${p.total.toFixed(2)}</span>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://events.squarebidness.com/orders/${p.orderId}"
         style="display:inline-block;background:#fff;color:#000;font-weight:900;font-size:14px;padding:12px 28px;border-radius:999px;text-decoration:none;letter-spacing:-0.02em;">
        View My Tickets
      </a>
    </div>

    <!-- Footer -->
    <p style="color:#333;font-size:12px;text-align:center;margin:0;">
      © ${new Date().getFullYear()} Square Bidness Events · <a href="https://events.squarebidness.com" style="color:#555;">events.squarebidness.com</a>
    </p>
  </div>
</body>
</html>`;
}

export async function sendBuyerConfirmation(params: SendBuyerConfirmationParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return;
  }

  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: params.buyerEmail,
    subject: `Your tickets for ${params.eventTitle} — ${params.orderCode}`,
    html: buildBuyerEmailHtml(params),
  });
}

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
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px 16px;background:#000;font-family:-apple-system,sans-serif;color:#fff;max-width:480px;margin:0 auto;">
  <p style="color:#a1a1aa;font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 24px;">Square Bidness Events</p>
  <h1 style="font-size:22px;font-weight:900;margin:0 0 6px;">New Sale 🎉</h1>
  <p style="color:#a1a1aa;margin:0 0 24px;">Someone just bought tickets to your event.</p>
  <div style="background:#0a0a0a;border:1px solid #1d1d1f;border-radius:12px;padding:20px;margin-bottom:24px;">
    <p style="margin:0 0 8px;"><strong>${params.eventTitle}</strong></p>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 4px;">Buyer: ${params.buyerName}</p>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 4px;">Tickets: ${params.ticketCount}</p>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 4px;">Order: ${params.orderCode}</p>
    <p style="color:#22c55e;font-weight:900;font-size:18px;margin:12px 0 0;">+$${params.total.toFixed(2)}</p>
  </div>
  <a href="https://events.squarebidness.com/organizer/dashboard"
     style="display:inline-block;background:#fff;color:#000;font-weight:900;font-size:14px;padding:10px 24px;border-radius:999px;text-decoration:none;">
    View Dashboard
  </a>
  <p style="color:#333;font-size:12px;margin-top:32px;">© ${new Date().getFullYear()} Square Bidness Events</p>
</body>
</html>`,
  });
}
