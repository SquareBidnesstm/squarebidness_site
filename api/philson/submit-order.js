import { createOrder, isConfigured } from "../_lib/supabase-philson.js";

const BASE_URL = process.env.SITE_URL || "https://www.squarebidness.com";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const body = req.body || {};
  const fullName    = String(body.fullName    || "").trim();
  const phone       = String(body.phone       || "").trim();
  const email       = String(body.email       || "").trim();
  const projectType = String(body.projectType || "").trim();
  const eventDate   = String(body.eventDate   || "").trim();
  const design      = String(body.design      || "").trim();
  const listedPrice = String(body.listedPrice || "").trim();
  const deliveryType= String(body.deliveryType|| "").trim();
  const details     = String(body.details     || "").trim();
  const isRush      = Boolean(body.is_rush);

  if (!fullName || !phone || !projectType) {
    return res.status(400).json({ ok: false, error: "Name, phone, and project type are required." });
  }

  if (!isConfigured()) {
    console.error("PHILSON SUBMIT: Supabase not configured");
    return res.status(500).json({ ok: false, error: "Order system unavailable." });
  }

  let order;
  try {
    order = await createOrder({
      full_name: fullName,
      phone,
      email,
      project_type: projectType,
      event_date: eventDate,
      design,
      listed_price: listedPrice,
      delivery_type: deliveryType,
      details,
      is_rush: isRush,
      status: "pending_review",
    });
  } catch (err) {
    console.error("PHILSON ORDER CREATE ERROR:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to create order." });
  }

  // SMS Eddie — fire and forget
  const alertTo   = process.env.PHILSON_ALERT_TO;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom  = process.env.PHILSON_TWILIO_FROM_NUMBER;
  if (alertTo && twilioSid && twilioToken && twilioFrom) {
    const adminUrl = `${BASE_URL}/philson-le-fleuriste/admin/order/?token=${order.eddie_token}`;
    const rushLine = isRush ? "\n⚡ RUSH — 24-48 HOUR\n" : "";
    const smsBody = [
      `PHILSON ORDER${rushLine}`,
      `${design || projectType}${listedPrice ? ` — ${listedPrice}` : ""}`,
      `${fullName} · ${phone}`,
      eventDate ? `Date: ${eventDate}` : "",
      details ? `Notes: ${details.slice(0, 100)}` : "",
      `\nReview & respond (1hr):\n${adminUrl}`,
    ].filter(Boolean).join("\n");

    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
    fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: alertTo, From: twilioFrom, Body: smsBody }),
    }).catch(() => {});
  }

  // SMS customer confirmation — fire and forget
  const normalizePhone = (p) => {
    const d = String(p || "").replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
    return null;
  };
  const customerPhone = normalizePhone(phone);
  if (customerPhone && twilioSid && twilioToken && twilioFrom) {
    const rushLine = isRush ? "This is a rush order (24-48 hr). " : "";
    const customerSms = `Philson Le Fleuriste\n\nHi ${fullName}, your order request was received!\n\n${design || projectType}${listedPrice ? ` — ${listedPrice}` : ""}\n\n${rushLine}Philson will check availability and reach out within the hour to confirm.\n\nReply STOP to opt out.`;
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
    fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: customerPhone, From: twilioFrom, Body: customerSms }),
    }).catch(() => {});
  }

  return res.status(200).json({ ok: true, orderId: order.id });
}
