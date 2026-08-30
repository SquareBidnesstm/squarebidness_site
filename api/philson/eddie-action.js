import {
  getOrderByToken, updateOrder, parsePriceCents, depositCents, formatDollars, isConfigured,
} from "../_lib/supabase-philson.js";

const BASE_URL = process.env.SITE_URL || "https://www.squarebidness.com";
const PHILSON_DESTINATION_ACCOUNT = "acct_1U9TKsPdN2nTzd6F";
const RUSH_FEE_CENTS = 50000; // $500

function normalizePhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

async function sendSms(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.PHILSON_TWILIO_FROM_NUMBER;
  if (!sid || !token || !from || !to) return;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  }).catch(() => {});
}

async function sendEmail(to, subject, html, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Philson Le Fleuriste <noreply@squarebidness.com>",
      to, subject, html, text,
    }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const body   = req.body || {};
  const token  = String(body.token  || "").trim();
  const action = String(body.action || "").trim(); // approve | alter | decline
  const eddieNotes   = String(body.notes       || "").trim();
  const alteredPrice = String(body.alteredPrice || "").trim();

  if (!token || !["approve", "alter", "decline"].includes(action)) {
    return res.status(400).json({ ok: false, error: "Invalid request" });
  }
  if (!isConfigured()) return res.status(500).json({ ok: false, error: "DB unavailable" });

  const order = await getOrderByToken(token);
  if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
  if (!["pending_review", "approved", "altered"].includes(order.status)) {
    return res.status(409).json({ ok: false, error: `Order already ${order.status}` });
  }

  const customerPhone = normalizePhone(order.phone);

  // ─── DECLINE ──────────────────────────────────────────────────────────────
  if (action === "decline") {
    await updateOrder(order.id, {
      status: "declined",
      eddie_notes: eddieNotes || "Requested design not available at this time.",
      eddie_responded_at: new Date().toISOString(),
    });

    const declineMsg = `Philson Le Fleuriste\n\nHi ${order.full_name},\n\nUnfortunately ${order.design || "the design you selected"} is not available for your requested date.\n\n${eddieNotes || "Please reach out to explore other available options."}\n\nVisit our casket sprays page to see what's available:\n${BASE_URL}/philson-le-fleuriste/casket-sprays/\n\nReply STOP to opt out.`;
    if (customerPhone) await sendSms(customerPhone, declineMsg);
    if (order.email) {
      await sendEmail(order.email, "Regarding Your Philson Order — Philson Le Fleuriste",
        `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1a16"><div style="text-align:center;padding:24px 0 16px"><img src="https://www.squarebidness.com/philson-le-fleuriste/assets/logo/philson-2014_1200.png" alt="Philson Le Fleuriste" style="width:200px;height:auto"/></div><p style="font-size:16px;margin:0 0 16px">Hi <strong>${order.full_name}</strong>,</p><p style="color:#555;margin:0 0 16px">Unfortunately <strong>${order.design || "the design you selected"}</strong> is not available for your requested date.</p><p style="color:#555;margin:0 0 16px">${eddieNotes || "Please reach out to explore other available options."}</p><a href="${BASE_URL}/philson-le-fleuriste/casket-sprays/" style="display:inline-block;background:#111;color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none;font-weight:900">View Available Designs</a><div style="margin-top:32px;padding-top:16px;border-top:1px solid #e6ddd0;font-size:12px;color:#888;text-align:center">Philson Le Fleuriste · Luxury Florals · Timeless Memories</div></div>`,
        declineMsg
      );
    }
    return res.status(200).json({ ok: true, action: "declined" });
  }

  // ─── APPROVE or ALTER ────────────────────────────────────────────────────
  const usePrice  = action === "alter" ? alteredPrice : order.listed_price;
  const priceCents = parsePriceCents(usePrice);

  let chargeableCents;
  if (order.is_rush) {
    // Rush: full price + $500 fee
    chargeableCents = priceCents + RUSH_FEE_CENTS;
  } else {
    // Standard: 25% deposit
    chargeableCents = depositCents(priceCents);
  }

  if (!chargeableCents || chargeableCents < 50) {
    return res.status(400).json({ ok: false, error: "Cannot determine charge amount from price." });
  }

  if (!process.env.STRIPE_HOLDINGS_SECRET_KEY) {
    return res.status(500).json({ ok: false, error: "Missing Stripe key" });
  }

  // Create Stripe checkout session — expires in 1 hour
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  let session;
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_HOLDINGS_SECRET_KEY);

    const rushLabel = order.is_rush ? " — RUSH 24-48hr" : "";
    const depositLabel = order.is_rush
      ? `Full payment (Rush order: ${formatDollars(priceCents)} + $500 rush fee)`
      : `25% deposit — balance due before delivery`;
    const alteredLabel = action === "alter" ? ` (Revised: ${formatDollars(priceCents)})` : "";

    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "affirm", "afterpay_clearpay", "us_bank_account"],
      expires_at: expiresAt,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `${order.design || order.project_type}${rushLabel}${alteredLabel} — Philson Le Fleuriste`,
            description: depositLabel,
          },
          unit_amount: chargeableCents,
        },
        quantity: 1,
      }],
      customer_email: order.email || undefined,
      metadata: {
        orderId: order.id,
        fullName: order.full_name,
        phone: order.phone,
        design: order.design || order.project_type,
        isRush: String(order.is_rush),
        source: "philson-order-checkout",
      },
      payment_intent_data: {
        transfer_data: { destination: PHILSON_DESTINATION_ACCOUNT },
        metadata: { orderId: order.id, design: order.design || order.project_type },
      },
      success_url: `${BASE_URL}/philson-le-fleuriste/deposit/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/philson-le-fleuriste/casket-sprays/`,
    });
  } catch (err) {
    console.error("PHILSON EDDIE ACTION STRIPE ERROR:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }

  const newStatus = action === "alter" ? "altered" : "approved";
  await updateOrder(order.id, {
    status: "payment_sent",
    eddie_notes: eddieNotes,
    altered_price: action === "alter" ? alteredPrice : "",
    eddie_responded_at: new Date().toISOString(),
    deposit_amount: chargeableCents,
    stripe_session_id: session.id,
    stripe_session_url: session.url,
    stripe_session_expires_at: new Date(expiresAt * 1000).toISOString(),
    payment_sent_at: new Date().toISOString(),
  });

  // Text + email customer with payment link (1-hour window)
  const amtLabel = formatDollars(chargeableCents);
  const rushNote  = order.is_rush ? "⚡ Rush order confirmed. " : "";
  const alterNote = action === "alter" && eddieNotes ? `Note from Philson: ${eddieNotes}\n\n` : "";
  const expiryNote = "⏱ Link expires in 1 hour.";

  const customerSms = `Philson Le Fleuriste\n\n${rushNote}Hi ${order.full_name}!\n\n${order.design || order.project_type} is confirmed and available.\n\n${alterNote}Amount due now: ${amtLabel}${order.is_rush ? " (includes $500 rush fee)" : " (25% deposit)"}\n\n${expiryNote}\n\nPay here:\n${session.url}\n\nReply STOP to opt out.`;

  if (customerPhone) await sendSms(customerPhone, customerSms);
  if (order.email) {
    const payBtn = `<a href="${session.url}" style="display:inline-block;background:#111;color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none;font-weight:900;font-size:16px">Pay ${amtLabel} — Affirm · Card · Afterpay</a>`;
    await sendEmail(
      order.email,
      `${order.is_rush ? "⚡ Rush " : ""}Order Approved — Philson Le Fleuriste`,
      `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1a16"><div style="text-align:center;padding:24px 0 16px"><img src="https://www.squarebidness.com/philson-le-fleuriste/assets/logo/philson-2014_1200.png" alt="Philson Le Fleuriste" style="width:200px;height:auto"/></div><div style="background:#e7f6ec;border-radius:8px;padding:12px 20px;margin-bottom:20px;color:#20482c;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase">✓ Order Confirmed — Available</div><p style="font-size:16px;margin:0 0 8px">Hi <strong>${order.full_name}</strong>!</p><p style="color:#555;margin:0 0 20px"><strong>${order.design || order.project_type}</strong> is confirmed and available for your date.${alterNote ? `<br><br>${eddieNotes}` : ""}</p><table style="width:100%;border-collapse:collapse;margin-bottom:24px"><tr><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:13px;color:#888;font-weight:600;text-transform:uppercase">Design</td><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:14px;font-weight:700;text-align:right">${order.design || order.project_type}</td></tr><tr><td style="padding:8px 12px;background:#1a1a1a;border-radius:0 0 6px 6px;font-size:13px;color:#aaa;font-weight:600;text-transform:uppercase">Due Now</td><td style="padding:8px 12px;background:#1a1a1a;border-radius:0 0 6px 6px;font-size:18px;font-weight:900;color:#fff;text-align:right">${amtLabel}</td></tr></table><p style="color:#c0392b;font-weight:700;margin:0 0 20px">⏱ Payment link expires in 1 hour. Order is canceled if not paid in time.</p><div style="text-align:center;margin-bottom:24px">${payBtn}</div><p style="font-size:12px;color:#888;text-align:center">Accept: Affirm · Afterpay · Card · Bank Transfer</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #e6ddd0;font-size:12px;color:#888;text-align:center">Philson Le Fleuriste · Luxury Florals · Timeless Memories</div></div>`,
      customerSms
    );
  }

  return res.status(200).json({ ok: true, action: newStatus, paymentUrl: session.url, expiresAt });
}
