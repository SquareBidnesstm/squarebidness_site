// /api/chocolate-city/export-drinks/index.js
import { normalizeDrinkCredit } from "../../_lib/chocolate-city-drinks.js";

function csvField(value) {
  const str = String(value ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

function csvRow(fields) {
  return fields.map(csvField).join(",");
}

async function redis(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Upstash env vars");

  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  const expectedToken = process.env.CHOCOLATE_CITY_ADMIN_TOKEN || "";
  if (!expectedToken) {
    return res.status(500).json({ ok: false, error: "Admin token not configured." });
  }

  const providedToken = String(req.headers["x-admin-token"] || "").trim();

  if (providedToken !== expectedToken) {
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ ok: false, error: "Missing Redis env vars." });
  }

  try {
    const data = await redis("GET", "chocolate-city:drink:credits");
    const credits = data?.result ? JSON.parse(data.result).map(normalizeDrinkCredit) : [];

    const header = csvRow([
      "Session ID", "Claim Code", "Service Date", "Service Label", "Paid At", "Recipient Name", "Sender Name", "Message",
      "Label", "Amount", "Phone", "Email",
      "Payment Status", "Redeemed", "Redeemed At"
    ]);

    const rows = credits.map(c => csvRow([
      c.sessionId || "",
      c.claimCode || "",
      c.serviceDate || "",
      c.serviceLabel || "",
      c.paidAt || "",
      c.recipientName || "",
      c.senderName || "",
      c.message || "",
      c.label || "",
      Number(c.amount || 0).toFixed(2),
      c.customerPhone || "",
      c.customerEmail || "",
      c.paymentStatus || "",
      c.redeemed ? "Yes" : "No",
      c.redeemedAt || ""
    ]));

    const csv = [header, ...rows].join("\r\n");
    const filename = `chocolate-city-drinks-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Unable to export drink credits." });
  }
}
