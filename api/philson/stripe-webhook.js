import Stripe from "stripe";
import { updateOrder } from "../_lib/supabase-philson.js";

const stripe = new Stripe(process.env.STRIPE_HOLDINGS_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function sendSms({ to, message }) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.PHILSON_TWILIO_FROM_NUMBER;
  if (!sid || !token || !from || !to) {
    console.warn("PHILSON SMS skipped — missing env or no recipient");
    return;
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: message }),
  });
  if (!res.ok) console.error("PHILSON SMS ERROR:", await res.text());
}

async function sendEmail({ to, subject, html, text }) {
  const key  = process.env.RESEND_API_KEY;
  const from = "Philson Le Fleuriste <noreply@squarebidness.com>";
  if (!key || !to) {
    console.warn("PHILSON EMAIL skipped — missing RESEND_API_KEY or no recipient");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) console.error("PHILSON EMAIL ERROR:", await res.text());
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  const sig     = req.headers["stripe-signature"];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.PHILSON_STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("PHILSON WEBHOOK SIG ERROR:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session    = event.data.object;
  const metadata   = session.metadata || {};
  const source     = metadata.source  || "";
  const custEmail  = session.customer_details?.email || session.customer_email || "";
  const amountFmt  = typeof session.amount_total === "number"
    ? `$${(session.amount_total / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
    : "";

  try {
    // ---- DEPOSIT PAYMENT ----
    if (source === "philson-bnpl-deposit") {
      const fullName    = metadata.fullName    || "Valued Client";
      const projectType = metadata.projectType || "your project";
      const eventDate   = metadata.eventDate   || "";
      const phone       = normalizePhone(metadata.phone);

      // Customer SMS
      if (phone) {
        await sendSms({
          to: phone,
          message: `Philson Le Fleuriste\n\nThank you, ${fullName}!\n\nYour deposit is confirmed.\n${projectType}${eventDate ? ` — ${eventDate}` : ""}\nAmount: ${amountFmt}\n\nWe'll be in touch to finalize every detail.\n\nReply STOP to opt out.`,
        });
      }

      // Customer email
      if (custEmail) {
        await sendEmail({
          to: custEmail,
          subject: "Deposit Confirmed — Philson Le Fleuriste",
          text: `Thank you, ${fullName}!\n\nYour deposit is confirmed.\n\nProject: ${projectType}${eventDate ? `\nEvent Date: ${eventDate}` : ""}\nAmount Paid: ${amountFmt}\n\nWe'll be in touch to finalize every detail.\n\n— Philson Le Fleuriste\nLuxury Florals · Timeless Memories`,
          html: `
<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1a16">
  <div style="text-align:center;padding:24px 0 16px">
    <img src="https://www.squarebidness.com/philson-le-fleuriste/assets/logo/philson-2014_1200.png" alt="Philson Le Fleuriste" style="width:200px;height:auto" />
  </div>
  <div style="background:#e7f6ec;border-radius:8px;padding:12px 20px;margin-bottom:20px;color:#20482c;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase">
    ✓ Deposit Confirmed
  </div>
  <p style="font-size:16px;margin:0 0 16px">Thank you, <strong>${fullName}</strong>!</p>
  <p style="font-size:15px;margin:0 0 20px;color:#555">Your deposit is confirmed and your date is held with Philson.</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Project</td><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:14px;font-weight:700;text-align:right">${projectType}</td></tr>
    ${eventDate ? `<tr><td style="padding:8px 12px;background:#f2ede4;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Event Date</td><td style="padding:8px 12px;background:#f2ede4;font-size:14px;font-weight:700;text-align:right">${eventDate}</td></tr>` : ""}
    <tr><td style="padding:8px 12px;background:#1a1a1a;border-radius:0 0 6px 6px;font-size:13px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Amount Paid</td><td style="padding:8px 12px;background:#1a1a1a;border-radius:0 0 6px 6px;font-size:18px;font-weight:900;color:#fff;text-align:right">${amountFmt}</td></tr>
  </table>
  <p style="font-size:14px;color:#555;margin:0 0 24px">We'll be in touch to confirm your consultation and finalize every detail. Balance is due before your event date.</p>
  <div style="text-align:center;padding:16px 0;border-top:1px solid #e6ddd0;font-size:12px;color:#888">
    Philson Le Fleuriste &nbsp;·&nbsp; Luxury Florals · Timeless Memories
  </div>
</div>`,
        });
      }
    }

    // ---- PRODUCT CHECKOUT ----
    else if (source === "philson-product-checkout") {
      const productName = metadata.product === "135-roses" ? "135 Roses — Luxury Bouquet" : (metadata.product || "your order");
      const phone       = normalizePhone(metadata.phone);

      if (phone) {
        await sendSms({
          to: phone,
          message: `Philson Le Fleuriste\n\nYour order is confirmed!\n\n${productName}\nAmount: ${amountFmt}\n\nPhilson will reach out to arrange pickup or delivery.\n\nReply STOP to opt out.`,
        });
      }

      if (custEmail) {
        await sendEmail({
          to: custEmail,
          subject: "Order Confirmed — Philson Le Fleuriste",
          text: `Your order is confirmed!\n\n${productName}\nAmount: ${amountFmt}\n\nPhilson will reach out to arrange pickup or delivery.\n\n— Philson Le Fleuriste\nLuxury Florals · Timeless Memories`,
          html: `
<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1a16">
  <div style="text-align:center;padding:24px 0 16px">
    <img src="https://www.squarebidness.com/philson-le-fleuriste/assets/logo/philson-2014_1200.png" alt="Philson Le Fleuriste" style="width:200px;height:auto" />
  </div>
  <div style="background:#e7f6ec;border-radius:8px;padding:12px 20px;margin-bottom:20px;color:#20482c;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase">
    ✓ Order Confirmed
  </div>
  <p style="font-size:15px;margin:0 0 20px;color:#555">Thank you! Your order is confirmed and Philson will be in touch to arrange pickup or delivery.</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Item</td><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:14px;font-weight:700;text-align:right">${productName}</td></tr>
    <tr><td style="padding:8px 12px;background:#1a1a1a;border-radius:0 0 6px 6px;font-size:13px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Amount Paid</td><td style="padding:8px 12px;background:#1a1a1a;border-radius:0 0 6px 6px;font-size:18px;font-weight:900;color:#fff;text-align:right">${amountFmt}</td></tr>
  </table>
  <div style="text-align:center;padding:16px 0;border-top:1px solid #e6ddd0;font-size:12px;color:#888">
    Philson Le Fleuriste &nbsp;·&nbsp; Luxury Florals · Timeless Memories
  </div>
</div>`,
        });
      }
    }

    // ---- ORDER CHECKOUT (casket spray approval flow) ----
    else if (source === "philson-order-checkout") {
      const orderId  = metadata.orderId  || "";
      const fullName = metadata.fullName || "Valued Client";
      const design   = metadata.design   || "your order";
      const phone    = normalizePhone(metadata.phone);

      // Mark order paid in Supabase
      if (orderId) {
        try {
          await updateOrder(orderId, { status: "paid", paid_at: new Date().toISOString() });
        } catch (err) {
          console.error("PHILSON ORDER PAID UPDATE ERROR:", err.message);
        }
      }

      // Customer SMS
      if (phone) {
        await sendSms({
          to: phone,
          message: `Philson Le Fleuriste\n\nThank you, ${fullName}! Your payment for ${design} is confirmed.\nAmount: ${amountFmt}\n\nPhilson will be in touch to finalize delivery and timing.\n\nReply STOP to opt out.`,
        });
      }

      // Customer email
      if (custEmail) {
        await sendEmail({
          to: custEmail,
          subject: "Payment Confirmed — Philson Le Fleuriste",
          text: `Thank you, ${fullName}!\n\nYour payment for ${design} is confirmed.\nAmount: ${amountFmt}\n\nPhilson will reach out to finalize delivery and timing.\n\n— Philson Le Fleuriste\nLuxury Florals · Timeless Memories`,
          html: `
<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1a16">
  <div style="text-align:center;padding:24px 0 16px">
    <img src="https://www.squarebidness.com/philson-le-fleuriste/assets/logo/philson-2014_1200.png" alt="Philson Le Fleuriste" style="width:200px;height:auto" />
  </div>
  <div style="background:#e7f6ec;border-radius:8px;padding:12px 20px;margin-bottom:20px;color:#20482c;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase">
    ✓ Payment Confirmed
  </div>
  <p style="font-size:16px;margin:0 0 16px">Thank you, <strong>${fullName}</strong>!</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Design</td><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:14px;font-weight:700;text-align:right">${design}</td></tr>
    <tr><td style="padding:8px 12px;background:#1a1a1a;border-radius:0 0 6px 6px;font-size:13px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Amount Paid</td><td style="padding:8px 12px;background:#1a1a1a;border-radius:0 0 6px 6px;font-size:18px;font-weight:900;color:#fff;text-align:right">${amountFmt}</td></tr>
  </table>
  <p style="font-size:14px;color:#555;margin:0 0 24px">Philson will reach out to finalize delivery and timing.</p>
  <div style="text-align:center;padding:16px 0;border-top:1px solid #e6ddd0;font-size:12px;color:#888">
    Philson Le Fleuriste &nbsp;·&nbsp; Luxury Florals · Timeless Memories
  </div>
</div>`,
        });
      }
    }

    // ---- INVOICE PAYMENT ----
    else if (source === "philson-invoice-payment") {
      const invoiceNumber = metadata.invoiceNumber || "";
      const clientName    = metadata.clientName    || "Valued Client";

      // Customer email
      if (custEmail) {
        const invLabel = invoiceNumber ? `Invoice ${invoiceNumber}` : "your invoice";
        await sendEmail({
          to: custEmail,
          subject: invoiceNumber
            ? `Payment Received — Invoice ${invoiceNumber} — Philson Le Fleuriste`
            : "Payment Received — Philson Le Fleuriste",
          text: `Thank you, ${clientName}!\n\nYour payment of ${amountFmt} has been received for ${invLabel}.\n\nPhilson will follow up with you shortly.\n\n— Philson Le Fleuriste\nLuxury Florals · Timeless Memories`,
          html: `
<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1d1a16">
  <div style="text-align:center;padding:24px 0 16px">
    <img src="https://www.squarebidness.com/philson-le-fleuriste/assets/logo/philson-2014_1200.png" alt="Philson Le Fleuriste" style="width:200px;height:auto" />
  </div>
  <div style="background:#e7f6ec;border-radius:8px;padding:12px 20px;margin-bottom:20px;color:#20482c;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase">
    ✓ Payment Received
  </div>
  <p style="font-size:16px;margin:0 0 16px">Thank you, <strong>${clientName}</strong>!</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    ${invoiceNumber ? `<tr><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Invoice</td><td style="padding:8px 12px;background:#f8f5ef;border-radius:6px 6px 0 0;font-size:14px;font-weight:700;text-align:right">${invoiceNumber}</td></tr>` : ""}
    <tr><td style="padding:8px 12px;background:#1a1a1a;border-radius:${invoiceNumber ? "0 0 6px 6px" : "6px"};font-size:13px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Amount Paid</td><td style="padding:8px 12px;background:#1a1a1a;border-radius:${invoiceNumber ? "0 0 6px 6px" : "6px"};font-size:18px;font-weight:900;color:#fff;text-align:right">${amountFmt}</td></tr>
  </table>
  <p style="font-size:14px;color:#555;margin:0 0 24px">Philson will follow up with you shortly to confirm next steps.</p>
  <div style="text-align:center;padding:16px 0;border-top:1px solid #e6ddd0;font-size:12px;color:#888">
    Philson Le Fleuriste &nbsp;·&nbsp; Luxury Florals · Timeless Memories
  </div>
</div>`,
        });
      }
      // Note: invoice flow doesn't collect phone, so no SMS to customer
    }

    // ---- ALERT PHILSON on Philson payments only ----
    const alertTo = normalizePhone(process.env.PHILSON_ALERT_TO || "");
    if (alertTo && source.startsWith("philson-")) {
      const who = source === "philson-invoice-payment"
        ? `${metadata.clientName || "Client"} — Invoice ${metadata.invoiceNumber || "?"}`
        : `${metadata.fullName || "Client"} — ${metadata.projectType || "Deposit"}`;
      await sendSms({
        to: alertTo,
        message: `PHILSON PAYMENT\n\n${who}\nAmount: ${amountFmt}\n\nCheck your Stripe dashboard.`,
      });
    }

  } catch (err) {
    console.error("PHILSON WEBHOOK ERROR:", err.message);
  }

  return res.status(200).json({ received: true });
}
