import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyBarberSession } from "../../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;

  const authed = await verifyBarberSession(req, shopSlug, barberSlug);
  if (!authed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 404 });
  }

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, name, display_name")
    .eq("shop_id", shop.id)
    .eq("slug", barberSlug)
    .eq("active", true)
    .single();

  if (!barber) {
    return NextResponse.json({ ok: false, error: "Barber not found." }, { status: 404 });
  }

  const { data: bookings, error } = await supabaseServer
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
      client_notes,
      services (
        name,
        duration_minutes,
        price
      )
    `)
    .eq("shop_id", shop.id)
    .eq("barber_id", barber.id)
    .order("starts_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Fetch permissions for this barber
  const { data: permSetting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shop.id)
    .eq("key", `barber_perms_${barber.id}`)
    .single();

  const perms = {
    can_edit_hours: (permSetting?.value_json as Record<string, boolean> | null)?.can_edit_hours ?? false,
    can_edit_prices: (permSetting?.value_json as Record<string, boolean> | null)?.can_edit_prices ?? false,
  };

  return NextResponse.json({
    ok: true,
    barberName: barber.display_name || barber.name,
    bookings: bookings ?? [],
    perms,
  });
}
