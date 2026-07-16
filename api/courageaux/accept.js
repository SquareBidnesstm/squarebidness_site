const BASE        = "https://www.squarebidness.com";
const AMARI_PHONE = "+19853512750";

async function redis(command, ...args) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Upstash env vars");
  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

async function sms(to, body) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_HEALTH_NUMBER;
  if (!sid || !auth || !from) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
}

async function stripePost(path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe error");
  return data;
}

function page(title, heading, bodyHtml, color = "#20c997") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Courageaux</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0b0b0b;color:#fff;font-family:system-ui,-apple-system,sans-serif;padding:48px 20px;text-align:center;line-height:1.6;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center}h2{color:${color};font-size:1.6rem;margin-bottom:14px}.muted{color:#bdbdbd;margin-bottom:4px}.gold{color:#c9a227;font-weight:900;font-size:1.05rem}.note{color:#71717a;font-size:.82rem;margin-top:10px}.btn{display:inline-block;margin-top:28px;padding:14px 28px;background:#c9a227;color:#000;border-radius:12px;font-weight:900;text-decoration:none;font-size:.95rem}</style></head><body><h2>${heading}</h2>${bodyHtml}<a class="btn" href="https://www.squarebidness.com/courageaux/admin/">Back to Admin</a></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { id, token } = req.query || {};
  const adminToken    = process.env.COURAGEAUX_ADMIN_TOKEN || "2750";

  if (!token || token !== adminToken) {
    return res.status(403).send(page("Unauthorized", "🚫 Unauthorized", '<p class="muted">Invalid token.</p>', "#ff5c5c"));
  }

  if (!id) {
    return res.status(400).send(page("Error", "Missing booking ID", '<p class="muted">No ID provided.</p>', "#ff5c5c"));
  }

  let booking;
  try {
    const d = await redis("GET", `courageaux:pending:${id}`);
    if (!d?.result) throw new Error("not found");
    booking = JSON.parse(d.result);
  } catch {
    return res.status(404).send(page("Not Found", "Booking Not Found", '<p class="muted">This request may have expired or already been handled.</p>', "#ff5c5c"));
  }

  if (booking.accepted) {
    return res.status(200).send(page(
      "Already Accepted", "Already Accepted",
      `<p class="muted">Payment link was already sent to</p><p class="gold">${booking.name} · ${booking.phone}</p>`,
      "#c9a227"
    ));
  }

  try {
    const d         = new Date(booking.date + "T12:00:00");
    const dateLabel = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const expiresAt = Math.floor(Date.now() / 1000) + (48 * 60 * 60);

    const session = await stripePost("/checkout/sessions", {
      "mode":                                                     "payment",
      "payment_method_types[0]":                                  "card",
      "line_items[0][price_data][currency]":                      "usd",
      "line_items[0][price_data][product_data][name]":            `Courageaux Aesthetics — ${booking.slot} min`,
      "line_items[0][price_data][product_data][description]":     `${dateLabel} at ${booking.time} · Mobile skincare`,
      "line_items[0][price_data][unit_amount]":                   String(booking.price * 100),
      "line_items[0][quantity]":                                  "1",
      "expires_at":                                               String(expiresAt),
      "metadata[name]":                                           booking.name,
      "metadata[phone]":                                          booking.phone,
      "metadata[address]":                                        booking.address,
      "metadata[slot]":                                           String(booking.slot),
      "metadata[date]":                                           booking.date,
      "metadata[time]":                                           booking.time,
      "metadata[price]":                                          String(booking.price),
      "metadata[concern]":                                        booking.concern,
      "metadata[skinType]":                                       booking.skinType,
      "metadata[breakout]":                                       booking.breakout,
      "metadata[notes]":                                          booking.notes || "",
      "success_url": `${BASE}/courageaux/book/success/?session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url":  `${BASE}/courageaux/book/`,
    });

    await sms(booking.phone, [
      `Hi ${booking.name}! Amari accepted your Courageaux appointment. 🌿`,
      ``,
      `${booking.slot} min · ${dateLabel} at ${booking.time}`,
      `📍 She'll come to you at ${booking.address}`,
      ``,
      `Pay $${booking.price} to confirm your spot:`,
      session.url,
      ``,
      `Link expires in 48 hrs. Questions? Reply here.`,
    ].join("\n"));

    booking.accepted       = true;
    booking.acceptedAt     = new Date().toISOString();
    booking.stripeSession  = session.id;
    await redis("SET",    `courageaux:pending:${id}`, JSON.stringify(booking));
    await redis("EXPIRE", `courageaux:pending:${id}`, String(60 * 60 * 24 * 7));

    return res.status(200).send(page(
      "Accepted", "✅ Accepted",
      `<p class="muted">Payment link sent to</p><p class="gold">${booking.name}</p><p class="muted">${booking.phone}</p><p class="note">They have 48 hours to pay and confirm.</p>`
    ));
  } catch (err) {
    console.error("Accept error:", err.message);
    return res.status(500).send(page("Error", "Something went wrong", `<p class="muted">${err.message}</p>`, "#ff5c5c"));
  }
}
