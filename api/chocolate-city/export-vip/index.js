// /api/chocolate-city/export-vip/index.js
import { getVipBookings } from "../../_lib/chocolate-city-vip.js";

function csvField(value) {
  const str = String(value ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

function csvRow(fields) {
  return fields.map(csvField).join(",");
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
    const bookings = await getVipBookings();

    const header = csvRow([
      "Event Date", "Event Night", "Session ID", "Paid At", "Customer Name", "Phone", "Email",
      "Package", "Full Price", "Deposit Paid", "Remaining Balance", "Payment Status",
      "VIP Code", "Used", "Used At"
    ]);

    const rows = bookings.map(b => csvRow([
      b.eventDate || "",
      b.eventLabel || "",
      b.sessionId || "",
      b.paidAt || "",
      b.customerName || "",
      b.customerPhone || "",
      b.customerEmail || "",
      b.packageName || "",
      Number(b.fullPrice || 0).toFixed(2),
      Number(b.deposit || 0).toFixed(2),
      Number(b.remainingBalance || 0).toFixed(2),
      b.paymentStatus || "",
      b.sessionId ? `VIP-${b.sessionId}` : "",
      b.used ? "yes" : "no",
      b.usedAt || ""
    ]));

    const csv = [header, ...rows].join("\r\n");
    const filename = `chocolate-city-vip-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Unable to export VIP bookings." });
  }
}
