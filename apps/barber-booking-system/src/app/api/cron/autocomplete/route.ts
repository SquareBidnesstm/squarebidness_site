import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !timingSafeEqual(authHeader ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auto-complete and auto-cancel past bookings within the last 30 days.
  // The date floor prevents unbounded writes on large or idle databases.
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Only confirmed bookings auto-complete — they represent a kept appointment.
  const { data, error } = await supabaseServer
    .from("bookings")
    .update({ status: "completed" })
    .eq("status", "confirmed")
    .lt("ends_at", now.toISOString())
    .gte("ends_at", thirtyDaysAgo.toISOString())
    .limit(500)
    .select("id");

  if (error) {
    console.error("[cron/autocomplete] DB error:", error);
    return NextResponse.json({ ok: false, error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }

  // Pending bookings that were never confirmed auto-cancel — they were never accepted
  // by the barber, so marking them completed would inflate revenue stats incorrectly.
  const { data: autoCancelled, error: cancelError } = await supabaseServer
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .lt("ends_at", now.toISOString())
    .gte("ends_at", thirtyDaysAgo.toISOString())
    .limit(500)
    .select("id");

  if (cancelError) {
    console.error("[cron/autocomplete] pending cancel error:", cancelError);
  }

  // Safety net: cancel awaiting_payment bookings whose appointment has already passed.
  // These are special sessions where the barber sent a Stripe link but the customer
  // never paid. The primary cleanup fires via checkout.session.expired webhook, but
  // this catches anything that slipped through (e.g. webhook delivery failure).
  const { data: expiredPaymentLinks, error: expireError } = await supabaseServer
    .from("bookings")
    .update({ status: "cancelled", special_session_checkout_id: null })
    .eq("status", "awaiting_payment")
    .lt("ends_at", now.toISOString())
    .gte("ends_at", thirtyDaysAgo.toISOString())
    .limit(200)
    .select("id");

  if (expireError) {
    console.error("[cron/autocomplete] awaiting_payment cleanup error:", expireError);
  }

  return NextResponse.json({
    ok: true,
    completed: data?.length ?? 0,
    pending_cancelled: autoCancelled?.length ?? 0,
    expired_payment_links_cancelled: expiredPaymentLinks?.length ?? 0,
  });
}
