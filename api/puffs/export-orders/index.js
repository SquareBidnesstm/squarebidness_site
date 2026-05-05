// /api/puffs/export-orders/index.js
function csvField(value) {
  const str = String(value ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

function csvRow(fields) {
  return fields.map(csvField).join(",");
}

function safeJsonParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

async function redisPost(pathname) {
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Redis error ${res.status}`);
  return data;
}

async function redisGet(key) {
  const result = await redisPost(`/get/${encodeURIComponent(key)}`);
  if (!result || typeof result.result !== "string") return null;
  return safeJsonParse(result.result);
}

async function redisLRange(key, start = 0, stop = 199) {
  const result = await redisPost(`/lrange/${encodeURIComponent(key)}/${start}/${stop}`);
  return Array.isArray(result.result) ? result.result : [];
}

export default async function handler(req, res) {
  const expectedToken = process.env.PUFFS_OPERATOR_TOKEN || "";
  if (!expectedToken) {
    return res.status(500).json({ ok: false, error: "Export token not configured." });
  }

  const providedToken = String(
    req.headers["x-puffs-operator-token"] || req.query.token || ""
  ).trim();

  if (providedToken !== expectedToken) {
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ ok: false, error: "Missing Redis env vars." });
  }

  try {
    const rawOrders = await redisLRange("puffs:orders", 0, 199);

    const rows = [];

    for (const raw of rawOrders) {
      const order = safeJsonParse(raw);
      if (!order || !order.orderNumber) continue;

      const meta = await redisGet(`puffs:order-meta:${order.orderNumber}`);
      const status = String(meta?.status || order.status || "new");

      const itemsSummary = Array.isArray(order.items)
        ? order.items.map(i => `${i.qty}x ${i.name}`).join("; ")
        : "";

      rows.push(csvRow([
        order.orderNumber || "",
        order.paidAt || order.createdAt || "",
        order.customerName || "",
        order.customerPhone || "",
        order.pickupTime || "ASAP",
        order.menuDay || "",
        status,
        itemsSummary,
        Number(order.subtotal || 0).toFixed(2),
        Number(order.tax || 0).toFixed(2),
        Number(order.total || 0).toFixed(2),
        order.paymentStatus || "",
        order.notes || ""
      ]));
    }

    const header = csvRow([
      "Order Number", "Paid At", "Customer Name", "Phone",
      "Pickup Time", "Menu Day", "Status", "Items",
      "Subtotal", "Tax", "Total", "Payment Status", "Notes"
    ]);

    const csv = [header, ...rows].join("\r\n");
    const filename = `puffs-orders-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
