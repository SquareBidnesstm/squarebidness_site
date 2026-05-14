import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const phone = new URL(req.url).searchParams.get("phone");
  if (!phone) return NextResponse.json({ ok: false, error: "Missing phone" }, { status: 400 });

  const { data: rows, error } = await supabaseServer
    .from("bookings")
    .select("id, booking_code, starts_at, status, price_snapshot, services(name), barbers(name, display_name)")
    .eq("shop_id", shop.id)
    .eq("customer_phone", phone)
    .order("starts_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const bookings = (rows ?? []).map((b) => ({
    id: b.id,
    booking_code: b.booking_code,
    starts_at: b.starts_at,
    status: b.status,
    service_name: (b.services as any)?.name ?? "Unknown",
    barber_name: (b.barbers as any)?.display_name || (b.barbers as any)?.name || "Unknown",
    price_snapshot: Number(b.price_snapshot),
  }));

  return NextResponse.json({ ok: true, bookings });
}
