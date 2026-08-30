import { getExpiredPaymentOrders, updateOrder } from "../_lib/supabase-philson.js";

export default async function handler(req, res) {
  // Allow Vercel cron (GET) or internal calls (POST)
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const expired = await getExpiredPaymentOrders();
  if (!expired.length) return res.status(200).json({ ok: true, expired: 0 });

  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.PHILSON_TWILIO_FROM_NUMBER;

  const normalizePhone = (p) => {
    const d = String(p || "").replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
    return null;
  };

  let count = 0;
  for (const order of expired) {
    await updateOrder(order.id, { status: "expired" });
    count++;

    const customerPhone = normalizePhone(order.phone);
    if (customerPhone && sid && token && from) {
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const msg = `Philson Le Fleuriste\n\nHi ${order.full_name}, your payment window for ${order.design || order.project_type} has expired and the order was canceled.\n\nIf you'd like to reorder, visit:\nhttps://www.squarebidness.com/philson-le-fleuriste/casket-sprays/\n\nReply STOP to opt out.`;
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: customerPhone, From: from, Body: msg }),
      }).catch(() => {});
    }
  }

  return res.status(200).json({ ok: true, expired: count });
}
