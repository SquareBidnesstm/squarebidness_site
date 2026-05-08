import { writeLedgerEvent } from "../_lib/supabase-ledger.js";

function getToken(req) {
  return String(
    req.headers["x-ledger-token"] ||
      req.query?.token ||
      ""
  ).trim();
}

function expectedToken() {
  return String(
    process.env.SQUARE_BIDNESS_LEDGER_TOKEN ||
      process.env.LEDGER_EXPORT_TOKEN ||
      ""
  ).trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET,POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const expected = expectedToken();
  const token = getToken(req);

  if (!expected || token !== expected) {
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }

  const timestamp = new Date().toISOString();
  const result = await writeLedgerEvent({
    brand: "square_bidness",
    system: "ledger",
    eventType: "ledger_test",
    entityId: `ledger_test_${Date.now()}`,
    payload: {
      ok: true,
      message: "Square Bidness ledger test write.",
      timestamp,
    },
    source: "api/ledger/test-write",
  });

  if (!result.ok) {
    return res.status(500).json({
      ok: false,
      error: result.error || "Ledger test write failed.",
      result,
    });
  }

  return res.status(200).json({
    ok: true,
    message: "Ledger test write saved.",
    timestamp,
  });
}
