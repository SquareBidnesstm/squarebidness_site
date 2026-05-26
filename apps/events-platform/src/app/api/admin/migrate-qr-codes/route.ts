// =========================================================
// POST /api/admin/migrate-qr-codes
//
// One-shot backfill: re-generates QR images for all existing
// tickets that still have a base64 data URL in qr_code
// (i.e. tickets created before migration 012 deployed),
// uploads them to Supabase Storage, and updates qr_code to
// the public Storage URL.
//
// Requires Bearer token matching CRON_SECRET env var.
// Safe to call multiple times — skips tickets already migrated.
// Processes in batches of 50 to stay within serverless timeouts.
// =========================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { uploadQRToStorage } from "../../../../lib/qr";

const BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  // Admin-only: require CRON_SECRET bearer token
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch tickets whose qr_code is still a data URL (starts with "data:")
  // Only look at non-cancelled/non-refunded tickets to skip dead records
  const { data: tickets, error } = await supabaseServer
    .from("tickets")
    .select("id, ticket_code, qr_code")
    .like("qr_code", "data:%")
    .in("status", ["valid", "checked_in"])
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[migrate-qr-codes] fetch error:", error.message);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }

  if (!tickets || tickets.length === 0) {
    return NextResponse.json({ ok: true, migrated: 0, message: "Nothing to migrate." });
  }

  let migrated = 0;
  let failed = 0;

  for (const ticket of tickets) {
    try {
      const newUrl = await uploadQRToStorage(ticket.ticket_code, supabaseServer);

      // Only update if we got a Storage URL (not another data URL fallback)
      if (!newUrl.startsWith("data:")) {
        const { error: updateErr } = await supabaseServer
          .from("tickets")
          .update({ qr_code: newUrl })
          .eq("id", ticket.id);

        if (updateErr) {
          console.error(`[migrate-qr-codes] update failed for ticket ${ticket.id}:`, updateErr.message);
          failed++;
        } else {
          migrated++;
        }
      } else {
        // uploadQRToStorage returned a fallback — storage upload failed
        console.error(`[migrate-qr-codes] storage upload failed for ticket ${ticket.id}`);
        failed++;
      }
    } catch (err) {
      console.error(`[migrate-qr-codes] error for ticket ${ticket.id}:`, err);
      failed++;
    }
  }

  const remaining = tickets.length === BATCH_SIZE
    ? "possibly more — run again to continue"
    : "none";

  return NextResponse.json({
    ok: true,
    migrated,
    failed,
    batchSize: tickets.length,
    remaining,
  });
}
