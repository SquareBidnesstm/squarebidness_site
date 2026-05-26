import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyBarberSession } from "../../../../../../lib/auth";

async function resolveBarber(shopSlug: string, barberSlug: string) {
  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();
  if (!shop) return { shop: null, barber: null };

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id")
    .eq("shop_id", shop.id)
    .eq("slug", barberSlug)
    .eq("active", true)
    .single();

  return { shop, barber };
}

async function checkPricePerm(shopId: string, barberId: string) {
  const { data: setting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shopId)
    .eq("key", `barber_perms_${barberId}`)
    .single();
  return (setting?.value_json as Record<string, boolean> | null)?.can_edit_prices === true;
}

// GET — return barber's services with base price + their override price
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;

  const authed = await verifyBarberSession(req, shopSlug, barberSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { shop, barber } = await resolveBarber(shopSlug, barberSlug);
  if (!shop || !barber) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const allowed = await checkPricePerm(shop.id, barber.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Not permitted" }, { status: 403 });

  // Get services assigned to this barber
  const { data: barberServices } = await supabaseServer
    .from("barber_services")
    .select("service_id, active, services(id, name, duration_minutes, price)")
    .eq("barber_id", barber.id)
    .eq("shop_id", shop.id)
    .eq("active", true);

  // Get price overrides stored in shop_settings
  const { data: overrideSetting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shop.id)
    .eq("key", `barber_price_overrides_${barber.id}`)
    .single();

  const overrides = (overrideSetting?.value_json as Record<string, number> | null) ?? {};

  const services = (barberServices ?? []).map((bs) => {
    const svc = bs.services as unknown as { id: string; name: string; duration_minutes: number; price: number } | null;
    if (!svc) return null;
    return {
      id: svc.id,
      name: svc.name,
      duration_minutes: svc.duration_minutes,
      base_price: svc.price,
      price: overrides[svc.id] ?? svc.price,
      has_override: svc.id in overrides,
    };
  }).filter(Boolean);

  return NextResponse.json({ ok: true, services });
}

// PUT — save price overrides { overrides: { [serviceId]: price } }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;

  const authed = await verifyBarberSession(req, shopSlug, barberSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { shop, barber } = await resolveBarber(shopSlug, barberSlug);
  if (!shop || !barber) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const allowed = await checkPricePerm(shop.id, barber.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Not permitted" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const overrides = body.overrides as Record<string, number>;

  if (!overrides || typeof overrides !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  // Validate all values are positive numbers
  for (const [, val] of Object.entries(overrides)) {
    if (typeof val !== "number" || val < 0) {
      return NextResponse.json({ ok: false, error: "Prices must be positive numbers." }, { status: 400 });
    }
  }

  // Validate that every service ID in the overrides belongs to this barber/shop
  const { data: assignedServices } = await supabaseServer
    .from("barber_services")
    .select("service_id")
    .eq("barber_id", barber.id)
    .eq("shop_id", shop.id)
    .eq("active", true);

  const validServiceIds = new Set((assignedServices ?? []).map((s) => s.service_id as string));
  for (const id of Object.keys(overrides)) {
    if (!validServiceIds.has(id)) {
      return NextResponse.json({ error: "Invalid service ID in overrides." }, { status: 400 });
    }
  }

  const { error } = await supabaseServer
    .from("shop_settings")
    .upsert(
      { shop_id: shop.id, key: `barber_price_overrides_${barber.id}`, value_json: overrides },
      { onConflict: "shop_id,key" }
    );

  if (error) {
    console.error("[barbers/prices PUT] DB error:", error);
    return NextResponse.json({ ok: false, error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
