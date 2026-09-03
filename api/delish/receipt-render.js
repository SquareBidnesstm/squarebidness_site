// FILE: /api/delish/receipt-render.js
// Dynamic receipt renderer — serves HTML for orders not yet baked to static files.
// Static files in public/delish/receipt/[ORDER]/ take priority (served by Vercel first).
// This endpoint handles everything else via the vercel.json rewrite.
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_HOLDINGS_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function formatDate(ts, opts) {
  return new Date(ts * 1000).toLocaleDateString("en-US", opts);
}

function formatPickupDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function cardBrandLabel(brand) {
  const map = {
    amex: "American Express",
    visa: "Visa",
    mastercard: "Mastercard",
    discover: "Discover",
    cashapp: "Cash App",
  };
  return map[(brand || "").toLowerCase()] || brand || "";
}

function cardBrandBadge(brand) {
  const bg = { amex: "#2176C7", visa: "#1A1F71", mastercard: "#EB001B", discover: "#FF6600", cashapp: "#00D632" };
  const abbrev = { amex: "AMEX", visa: "VISA", mastercard: "MC", discover: "DISC", cashapp: "CASH" };
  const b = (brand || "").toLowerCase();
  const color = bg[b] || "#555";
  const text = abbrev[b] || (brand || "").toUpperCase().slice(0, 4);
  return `<span style="background:${color};color:#fff;font-size:10px;font-weight:800;letter-spacing:.06em;padding:3px 7px;border-radius:4px;flex-shrink:0;">${text}</span>`;
}

function parseItemName(fullName) {
  const match = (fullName || "").match(/^(.+?)\s*\((.+)\)$/);
  if (match) return { name: match[1].trim(), sides: match[2].trim() };
  return { name: fullName || "", sides: null };
}

function renderItemRows(lineItems) {
  return lineItems
    .filter((li) => li.description !== "Sales Tax")
    .map((li) => {
      const { name, sides } = parseItemName(li.description);
      const amount = `$${((li.amount_total || 0) / 100).toFixed(2)}`;
      const sidesHtml = sides
        ? `<span class="sides">${sides}</span>`
        : "";
      return `
        <div class="item-row">
          <div class="item-name">${name}${sidesHtml}</div>
          <div class="item-qty">×${li.quantity}</div>
          <div class="item-price">${amount}</div>
        </div>`;
    })
    .join("");
}

function buildHtml({ orderNumber, customerName, pickupDate, pickupWindow, cardBrand, cardLast4, chargedDate, subtotal, tax, total, lineItems }) {
  const pickupDateFmt = formatPickupDate(pickupDate) || chargedDate;
  const itemsHtml = renderItemRows(lineItems);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Delish Receipt — ${orderNumber}</title>
  <meta name="robots" content="noindex,nofollow" />
  <meta name="theme-color" content="#0b0b0b" />
  <link rel="icon" sizes="32x32" href="/delish/assets/delish-favicon-32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/delish/assets/delish-logo-mark-180.png" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0b0b0b; color: #fff; font-family: 'DM Sans', system-ui, sans-serif; font-size: 15px; line-height: 1.5; min-height: 100vh; padding: 40px 16px 64px; }
    .receipt { max-width: 520px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; }
    .brand-logo { width: 72px; height: 72px; border-radius: 18px; object-fit: cover; display: block; margin: 0 auto 12px; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
    .brand-name { font-size: 28px; font-weight: 700; letter-spacing: -0.03em; color: #D4AF37; }
    .brand-sub { font-size: 12px; color: #6b6b6b; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 4px; }
    .card { background: #121212; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
    .confirmed-strip { background: rgba(212,175,55,0.12); border-bottom: 1px solid rgba(212,175,55,0.2); padding: 14px 24px; display: flex; align-items: center; gap: 10px; }
    .check-circle { width: 22px; height: 22px; border-radius: 50%; background: #D4AF37; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .check-circle svg { width: 12px; height: 12px; }
    .confirmed-text { font-size: 13px; font-weight: 600; color: #D4AF37; letter-spacing: 0.04em; }
    .meta { padding: 24px 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .order-number { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 16px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .meta-item label { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b; margin-bottom: 3px; }
    .meta-item span { font-size: 14px; color: #e0e0e0; font-weight: 500; }
    .pickup-window { color: #D4AF37; font-weight: 600; }
    .items-section { padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b; margin-bottom: 14px; }
    .item-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .item-row:last-child { border-bottom: none; }
    .item-name { font-size: 14px; color: #e8e8e8; font-weight: 500; flex: 1; }
    .item-name .sides { display: block; font-size: 12px; color: #7a7a7a; font-weight: 400; margin-top: 2px; }
    .item-qty { font-size: 13px; color: #7a7a7a; white-space: nowrap; padding-top: 1px; }
    .item-price { font-size: 14px; font-weight: 600; color: #e8e8e8; font-variant-numeric: tabular-nums; white-space: nowrap; padding-top: 1px; min-width: 52px; text-align: right; }
    .totals { padding: 18px 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .total-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; }
    .total-row .label { font-size: 13px; color: #8a8a8a; }
    .total-row .value { font-size: 13px; color: #c8c8c8; font-variant-numeric: tabular-nums; }
    .total-row.grand { margin-top: 10px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.1); }
    .total-row.grand .label { font-size: 15px; font-weight: 700; color: #fff; }
    .total-row.grand .value { font-size: 18px; font-weight: 700; color: #D4AF37; }
    .payment-section { padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; gap: 12px; }
    .payment-detail { font-size: 13px; color: #a0a0a0; }
    .payment-detail strong { color: #d0d0d0; font-weight: 600; }
    .footer { padding: 20px 24px; text-align: center; }
    .footer p { font-size: 12px; color: #5a5a5a; line-height: 1.6; }
    .footer a { color: #D4AF37; text-decoration: none; }
    .support-note { text-align: center; margin-top: 28px; font-size: 13px; color: #555; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <img class="brand-logo" src="/delish/assets/delish-logo-mark-192.png" alt="Delish" />
      <div class="brand-name">Delish</div>
      <div class="brand-sub">Alexandria, Louisiana · Pickup Only</div>
    </div>
    <div class="card">
      <div class="confirmed-strip">
        <div class="check-circle">
          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 6l3 3 5-5" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="confirmed-text">Payment Confirmed</span>
      </div>
      <div class="meta">
        <div class="order-number">Order #${orderNumber}</div>
        <div class="meta-grid">
          <div class="meta-item"><label>Customer</label><span>${customerName || "—"}</span></div>
          <div class="meta-item"><label>Date</label><span>${pickupDateFmt}</span></div>
          <div class="meta-item"><label>Pickup Window</label><span class="pickup-window">${pickupWindow || "—"}</span></div>
          <div class="meta-item"><label>Order #</label><span>${orderNumber}</span></div>
        </div>
      </div>
      <div class="items-section">
        <div class="section-label">Items</div>
        ${itemsHtml}
      </div>
      <div class="totals">
        <div class="total-row"><span class="label">Subtotal</span><span class="value">$${subtotal}</span></div>
        <div class="total-row"><span class="label">Sales Tax</span><span class="value">$${tax}</span></div>
        <div class="total-row grand"><span class="label">Total Paid</span><span class="value">$${total}</span></div>
      </div>
      <div class="payment-section">
        ${cardBrandBadge(cardBrand)}
        <span class="payment-detail">
          <strong>${cardBrandLabel(cardBrand)}</strong>${cardLast4 ? ` ending in ${cardLast4}` : ""} · Charged ${chargedDate}
        </span>
      </div>
      <div class="footer">
        <p>Questions? Call us at <a href="tel:+13187879407">(318) 787-9407</a><br>
        3710 S MacArthur · Alexandria, Louisiana</p>
      </div>
    </div>
    <div class="support-note">Delish · 3710 S MacArthur · Alexandria, LA · (318) 787-9407</div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method Not Allowed");
  }

  const orderNumber = String(req.query.order || "").trim().toUpperCase();
  if (!orderNumber || !orderNumber.startsWith("DL-")) {
    return res.status(400).send("<h1>Invalid order number</h1>");
  }

  try {
    const result = await stripe.checkout.sessions.search({
      query: `metadata["orderNumber"]:"${orderNumber}"`,
      limit: 1,
      expand: ["data.line_items"],
    });

    if (!result.data.length) {
      return res
        .status(404)
        .send(
          `<!doctype html><html><head><meta charset="utf-8"><title>Not Found</title></head><body style="font-family:sans-serif;padding:40px;background:#0b0b0b;color:#fff;"><h2 style="color:#D4AF37;">Order not found</h2><p>Order ${orderNumber} could not be located.</p></body></html>`
        );
    }

    const session = result.data[0];
    const meta = session.metadata || {};

    let cardBrand = "", cardLast4 = "", chargedDate = "";
    if (session.payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
          expand: ["payment_method"],
        });
        chargedDate = formatDate(pi.created, { month: "short", day: "numeric", year: "numeric" });
        const pm = pi.payment_method;
        if (pm?.card) {
          cardBrand = pm.card.brand;
          cardLast4 = pm.card.last4;
        } else if (pm?.cashapp) {
          cardBrand = "cashapp";
        }
      } catch (_) {}
    }

    if (!chargedDate) {
      chargedDate = formatDate(session.created, { month: "short", day: "numeric", year: "numeric" });
    }

    const lineItems = session.line_items?.data || [];
    const subtotal = Number(meta.subtotal || 0).toFixed(2);
    const tax = Number(meta.tax || 0).toFixed(2);
    const total = Number(
      meta.total || (session.amount_total || 0) / 100
    ).toFixed(2);

    const html = buildHtml({
      orderNumber,
      customerName: meta.customerName || "",
      pickupDate: meta.pickupDate || "",
      pickupWindow: meta.pickupWindow || "",
      cardBrand,
      cardLast4,
      chargedDate,
      subtotal,
      tax,
      total,
      lineItems,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.status(200).send(html);
  } catch (err) {
    console.error("DELISH RECEIPT RENDER ERROR:", err);
    return res.status(500).send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head><body style="font-family:sans-serif;padding:40px;background:#0b0b0b;color:#fff;"><h2 style="color:#D4AF37;">Error loading receipt</h2><p>${err.message}</p></body></html>`
    );
  }
}
