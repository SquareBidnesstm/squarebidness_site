import { fetchLedgerEvents } from "../_lib/supabase-ledger.js";

function getToken(req) {
  return String(
    req.headers["x-ledger-token"] ||
      req.headers["x-operator-token"] ||
      req.query?.token ||
      ""
  ).trim();
}

function expectedToken() {
  return String(
    process.env.SQUARE_BIDNESS_LEDGER_TOKEN ||
      process.env.LEDGER_EXPORT_TOKEN ||
      process.env.DELISH_OPERATOR_TOKEN ||
      ""
  ).trim();
}

function csvCell(value) {
  const text =
    typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function eventsToCsv(events) {
  const header = [
    "id",
    "created_at",
    "brand",
    "system",
    "event_type",
    "entity_id",
    "source",
    "payload",
  ];

  const rows = (events || []).map(event => [
    event.id,
    event.created_at,
    event.brand,
    event.system,
    event.event_type,
    event.entity_id,
    event.source,
    event.payload,
  ]);

  return [header, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
}

function eventsToJsonl(events) {
  return (events || []).map(event => JSON.stringify(event)).join("\n");
}

function fileSafe(value, fallback) {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const expected = expectedToken();
  const token = getToken(req);

  if (!expected || token !== expected) {
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }

  const brand = String(req.query?.brand || "").trim();
  const system = String(req.query?.system || "").trim();
  const eventType = String(req.query?.event_type || req.query?.eventType || "").trim();
  const date = String(req.query?.date || "").trim();
  const start = String(req.query?.start || "").trim();
  const end = String(req.query?.end || "").trim();
  const limit = Number(req.query?.limit || 1000);
  const format = String(req.query?.format || "jsonl").toLowerCase().trim();

  const result = await fetchLedgerEvents({
    brand,
    system,
    eventType,
    date,
    start,
    end,
    limit,
  });

  if (!result.ok) {
    return res.status(result.status || 500).json({
      ok: false,
      error: result.error || "Failed to export ledger.",
    });
  }

  const suffixParts = [
    fileSafe(brand, "all"),
    fileSafe(system, "systems"),
    fileSafe(date || start || "ledger", "ledger"),
  ];
  const baseName = `square-bidness-ledger-${suffixParts.join("-")}`;

  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.csv"`);
    return res.status(200).send(eventsToCsv(result.events));
  }

  if (format === "json") {
    return res.status(200).json({
      ok: true,
      count: result.events.length,
      events: result.events,
    });
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${baseName}.jsonl"`);
  return res.status(200).send(eventsToJsonl(result.events));
}
