import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
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
