const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
).trim();

function isLedgerConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function cleanText(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

export async function writeLedgerEvent({
  brand = "square_bidness",
  system = "general",
  eventType = "",
  entityId = "",
  payload = {},
  source = "squarebidness_site",
} = {}) {
  if (!isLedgerConfigured() || !eventType) {
    return { ok: false, skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/event_ledger`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        brand: cleanText(brand),
        system: cleanText(system),
        event_type: cleanText(eventType),
        entity_id: cleanText(entityId, 200),
        payload: payload && typeof payload === "object" ? payload : {},
        source: cleanText(source),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn("SUPABASE LEDGER WRITE FAILED:", response.status, errorText.slice(0, 300));
      return { ok: false, status: response.status };
    }

    return { ok: true };
  } catch (error) {
    console.warn("SUPABASE LEDGER WRITE ERROR:", error?.message || error);
    return { ok: false, error: error?.message || "Ledger write failed." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchLedgerEvents({
  brand = "",
  system = "",
  eventType = "",
  date = "",
  start = "",
  end = "",
  limit = 1000,
} = {}) {
  if (!isLedgerConfigured()) {
    return { ok: false, error: "SUPABASE_LEDGER_NOT_CONFIGURED" };
  }

  const params = new URLSearchParams();
  params.set("select", "id,brand,system,event_type,entity_id,payload,source,created_at");
  params.set("order", "created_at.desc");
  params.set("limit", String(Math.min(5000, Math.max(1, Number(limit || 1000)))));

  if (brand) params.set("brand", `eq.${cleanText(brand)}`);
  if (system) params.set("system", `eq.${cleanText(system)}`);
  if (eventType) params.set("event_type", `eq.${cleanText(eventType)}`);

  if (date) {
    params.append("created_at", `gte.${date}T00:00:00.000Z`);
    params.append("created_at", `lt.${date}T23:59:59.999Z`);
  } else {
    if (start) params.append("created_at", `gte.${start}`);
    if (end) params.append("created_at", `lte.${end}`);
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/event_ledger?${params.toString()}`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => []);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: Array.isArray(data) ? "LEDGER_FETCH_FAILED" : data?.message || "LEDGER_FETCH_FAILED",
      };
    }

    return { ok: true, events: Array.isArray(data) ? data : [] };
  } catch (error) {
    return { ok: false, error: error?.message || "LEDGER_FETCH_FAILED" };
  }
}
