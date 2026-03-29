// /api/puffs/catering-request/index.js
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanString(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function makeRequestId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PCAT-${y}${m}${d}-${rand}`;
}

async function redisPost(pathname) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${REDIS_URL}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Redis request failed (${res.status})`);
  }
  return data;
}

async function redisSet(key, value) {
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(JSON.stringify(value));
  return redisPost(`/set/${encodedKey}/${encodedValue}`);
}

async function redisLPush(key, value) {
  return redisPost(`/lpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`);
}

async function redisLTrim(key, start, stop) {
  return redisPost(`/ltrim/${encodeURIComponent(key)}/${start}/${stop}`);
}

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed."
    });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "Missing Upstash Redis env vars."
    });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const customerName = cleanString(body.customerName, 120);
    const phone = digitsOnly(body.phone);
    const email = cleanString(body.email, 160).toLowerCase();
    const eventType = cleanString(body.eventType, 120);
    const eventDate = cleanString(body.eventDate, 40);
    const eventTime = cleanString(body.eventTime, 80);
    const guestCount = cleanString(body.guestCount, 40);
    const serviceType = cleanString(body.serviceType, 80);
    const budget = cleanString(body.budget, 80);
    const servingStyle = cleanString(body.servingStyle, 120);
    const eventAddress = cleanString(body.eventAddress, 220);
    const requestedItems = cleanString(body.requestedItems, 2000);
    const notes = cleanString(body.notes, 2000);
    const source = cleanString(body.source || "puffs_catering_request", 80);

    if (!customerName) {
      return res.status(400).json({
        ok: false,
        error: "Customer name is required."
      });
    }

    if (!phone && !email) {
      return res.status(400).json({
        ok: false,
        error: "Phone or email is required."
      });
    }

    if (!eventDate) {
      return res.status(400).json({
        ok: false,
        error: "Event date is required."
      });
    }

    if (!guestCount) {
      return res.status(400).json({
        ok: false,
        error: "Guest count is required."
      });
    }

    if (!requestedItems) {
      return res.status(400).json({
        ok: false,
        error: "Requested items are required."
      });
    }

    const id = makeRequestId();

    const requestRecord = {
      id,
      requestNumber: id,
      customerName,
      phone,
      email,
      eventType,
      eventDate,
      eventTime,
      guestCount,
      serviceType,
      budget,
      servingStyle,
      eventAddress,
      requestedItems,
      notes,
      status: "new_request",
      depositAmount: "",
      depositLink: "",
      depositSentAt: "",
      depositPaidAt: "",
      createdAt: new Date().toISOString(),
      source
    };

    await redisSet(`puffs:catering:request:${id}`, requestRecord);
    await redisLPush("puffs:catering:requests", id);
    await redisLTrim("puffs:catering:requests", 0, 199);

    return res.status(200).json({
      ok: true,
      id,
      requestNumber: id,
      request: requestRecord
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to submit catering request."
    });
  }
}
