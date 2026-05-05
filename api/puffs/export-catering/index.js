// /api/puffs/export-catering/index.js
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
    const ids = await redisLRange("puffs:catering:requests", 0, 199);

    const rows = [];

    for (const id of ids) {
      const cleanId = String(id || "").trim();
      if (!cleanId) continue;

      const record = await redisGet(`puffs:catering:request:${cleanId}`);
      if (!record) continue;

      rows.push(csvRow([
        record.requestNumber || record.id || "",
        record.createdAt || "",
        record.customerName || "",
        record.phone || "",
        record.email || "",
        record.eventType || "",
        record.eventDate || "",
        record.eventTime || "",
        record.guestCount || "",
        record.serviceType || "",
        record.budget || "",
        record.servingStyle || "",
        record.eventAddress || "",
        record.requestedItems || "",
        record.notes || "",
        record.status || "",
        record.depositAmount || "",
        record.depositPaidAt || ""
      ]));
    }

    const header = csvRow([
      "Request Number", "Submitted At", "Customer Name", "Phone", "Email",
      "Event Type", "Event Date", "Event Time", "Guest Count",
      "Service Type", "Budget", "Serving Style", "Event Address",
      "Requested Items", "Notes", "Status", "Deposit Amount", "Deposit Paid At"
    ]);

    const csv = [header, ...rows].join("\r\n");
    const filename = `puffs-catering-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
