// FILE: /api/delish/clear-catering-request.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

const RESTORE_FALLBACK_STATUS = "new_request";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    if (
      !process.env.DELISH_UPSTASH_REDIS_REST_URL ||
      !process.env.DELISH_UPSTASH_REDIS_REST_TOKEN
    ) {
      return res.status(500).json({
        ok: false,
        error: "Missing Delish Redis environment variables.",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const id = String(body.id || "").trim();
    const action = String(body.action || "clear").toLowerCase().trim();

    if (!id) {
      return res.status(400).json({ ok: false, error: "Missing catering request id." });
    }

    const key = `delish:catering:${id}`;
    const existing = await redis.get(key);

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Catering request not found." });
    }

    const now = new Date().toISOString();
    let updated;

    if (action === "restore") {
      const restoredStatus =
        existing.previousStatus && existing.previousStatus !== "cleared"
          ? existing.previousStatus
          : RESTORE_FALLBACK_STATUS;

      updated = {
        ...existing,
        status: restoredStatus,
        restoredAt: now,
        updatedAt: now,
      };
    } else {
      updated = {
        ...existing,
        previousStatus: existing.status || RESTORE_FALLBACK_STATUS,
        status: "cleared",
        clearedAt: now,
        updatedAt: now,
      };
    }

    await redis.set(key, updated);

    return res.status(200).json({
      ok: true,
      id: updated.id,
      requestNumber: updated.requestNumber,
      status: updated.status,
      previousStatus: updated.previousStatus || "",
    });
  } catch (error) {
    console.error("POST /api/delish/clear-catering-request error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to update catering request.",
    });
  }
}
