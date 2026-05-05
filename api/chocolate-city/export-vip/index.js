// /api/chocolate-city/export-vip/index.js
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

  const providedToken = String(
    req.headers["x-admin-token"] || req.query.token || ""
  ).trim();

  if (providedToken !== expectedToken) {
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ ok: false, error: "Missing Redis env vars." });
  }

  try {
    const data = await redis("GET", "chocolate-city:vip:bookings");
    const bookings = data?.result ? JSON.parse(data.result) : [];

    const header = csvRow([
      "Session ID", "Paid At", "Customer Name", "Phone", "Email",
      "Package", "Full Price", "Deposit Paid", "Remaining Balance", "Payment Status"
    ]);

    const rows = bookings.map(b => csvRow([
      b.sessionId || "",
      b.paidAt || "",
      b.customerName || "",
      b.customerPhone || "",
      b.customerEmail || "",
      b.packageName || "",
      Number(b.fullPrice || 0).toFixed(2),
      Number(b.deposit || 0).toFixed(2),
      Number(b.remainingBalance || 0).toFixed(2),
      b.paymentStatus || ""
    ]));

    const csv = [header, ...rows].join("\r\n");
    const filename = `chocolate-city-vip-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
