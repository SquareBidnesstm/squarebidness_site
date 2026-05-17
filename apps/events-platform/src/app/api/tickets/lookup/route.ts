import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { checkRateLimit, recordAttempt } from "../../../../lib/utils";

export async function POST(req: NextRequest) {
  // Rate limit: 10 lookups per 15 min per IP (prevents order/email enumeration)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`ticket_lookup:${ip}`);
  const { limited, retryAfterSeconds } = await checkRateLimit(`ticket_lookup:${ip}`, 10);
  if (limited) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { email } = await req.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const { data: orders } = await supabaseServer
    .from("orders")
    .select(`
      id, order_code, status, total, created_at,
      events ( title, slug, starts_at, venue_name, city, state, cover_image_url ),
      tickets ( id, ticket_code, tier_name, status, qr_code )
    `)
    .eq("buyer_email", email.trim().toLowerCase())
    .in("status", ["paid", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ orders: orders ?? [] });
}
