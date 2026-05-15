import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authorized = await verifyAdminSession(req, shopSlug);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: shop, error: shopError } = await supabaseServer
    .from("shops")
    .select("id, name, slug, logo_url")
    .eq("slug", shopSlug)
    .single();

  if (shopError || !shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  const { data, error } = await supabaseServer
    .from("bookings")
    .select(`
      id,
      booking_code,
      customer_name,
      customer_phone,
      customer_email,
      appointment_date,
      starts_at,
      ends_at,
      status,
      payment_status,
      source,
      client_notes,
      created_at,
      barbers (
        slug,
        name,
        display_name
      ),
      services (
        slug,
        name,
        duration_minutes,
        price
      ),
      payments (
        id,
        amount,
        payment_type,
        provider,
        status
      )
    `)
    .eq("shop_id", shop.id)
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    shop: { name: shop.name, slug: shop.slug, logo_url: shop.logo_url ?? null },
    bookings: data || [],
  });
}
