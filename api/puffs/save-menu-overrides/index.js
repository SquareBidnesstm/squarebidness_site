function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-operator-token,x-puffs-operator-token");
}

function cleanString(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function cleanArray(value, maxItems = 200) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, 120))
    .filter(Boolean)
    .slice(0, maxItems);
}

async function redisPost(pathname) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${REDIS_URL}${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Redis request failed (${res.status})`);
  return data;
}

async function redisSet(key, value) {
  return redisPost(
    `/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`
  );
}

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const expectedToken = process.env.PUFFS_OPERATOR_TOKEN || process.env.DELISH_OPERATOR_TOKEN || "";
  const providedToken =
    req.headers["x-puffs-operator-token"] ||
    req.headers["x-operator-token"] ||
    "";

  if (expectedToken && String(providedToken).trim() !== String(expectedToken).trim()) {
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ ok: false, error: "Missing Upstash Redis env vars." });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const overrides = {
      sections: {
        individual: body?.sections?.individual !== false,
        plates: body?.sections?.plates !== false,
        sundaySides: body?.sections?.sundaySides !== false,
        saturdayAddOns: body?.sections?.saturdayAddOns !== false
      },
      itemsOff: cleanArray(body.itemsOff),
      itemsSoldOut: cleanArray(body.itemsSoldOut),
      customerMessage: cleanString(body.customerMessage, 220),
      updatedAt: new Date().toISOString()
    };

    await redisSet("puffs:menu:overrides", overrides);

    return res.status(200).json({ ok: true, overrides });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to save Puff’s menu overrides."
    });
  }
}
