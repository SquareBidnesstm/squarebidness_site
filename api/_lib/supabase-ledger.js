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
