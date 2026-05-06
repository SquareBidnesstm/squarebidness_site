import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";

type OnboardPayload = {
  shopName?: string;
  slug?: string;
  city?: string;
  state?: string;
  timezone?: string;
  ownerName?: string;
  barbers?: { name: string; role: string }[];
  pin?: string;
};

const DEFAULT_SERVICES = [
  { slug: "haircut", name: "Haircut", duration_minutes: 45, price: 35.00, sort_order: 1 },
  { slug: "haircut-beard", name: "Haircut + Beard", duration_minutes: 60, price: 45.00, sort_order: 2 },
  { slug: "kids-cut", name: "Kids Cut", duration_minutes: 30, price: 25.00, sort_order: 3 },
  { slug: "enhancements", name: "Cut + Enhancements", duration_minutes: 60, price: 50.00, sort_order: 4 },
  { slug: "vip", name: "VIP Appointment", duration_minutes: 90, price: 75.00, sort_order: 5 },
];

const DEFAULT_HOURS = [
  { day_of_week: 0, is_closed: true, open_time: null, close_time: null },
  { day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 2, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 3, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 4, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 5, is_closed: false, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 6, is_closed: false, open_time: "08:00", close_time: "16:00" },
];

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OnboardPayload;

    const { shopName, slug, city, state, timezone, ownerName, barbers, pin } = body;

    if (!shopName || !slug || !city || !state || !ownerName || !pin) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }

    if (!barbers || barbers.length === 0 || barbers.some((b) => !b.name?.trim())) {
      return NextResponse.json({ ok: false, error: "At least one barber with a name is required." }, { status: 400 });
    }

    if (pin.length < 4) {
      return NextResponse.json({ ok: false, error: "PIN must be at least 4 digits." }, { status: 400 });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-|-$/g, "");
    if (!cleanSlug) {
      return NextResponse.json({ ok: false, error: "Invalid slug." }, { status: 400 });
    }

    const { data: existing } = await supabaseServer
      .from("shops")
      .select("id")
      .eq("slug", cleanSlug)
      .single();

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `The URL "/${cleanSlug}" is already taken. Choose a different slug.` },
        { status: 409 }
      );
    }

    const { data: shop, error: shopError } = await supabaseServer
      .from("shops")
      .insert({
        slug: cleanSlug,
        name: shopName,
        owner_name: ownerName,
        city,
        state,
        timezone: timezone || "America/Chicago",
        booking_base_path: "/book",
        require_deposit: false,
        active: true,
      })
      .select("id, slug, name")
      .single();

    if (shopError || !shop) {
      return NextResponse.json(
        { ok: false, error: shopError?.message || "Could not create shop." },
        { status: 500 }
      );
    }

    const { data: createdServices } = await supabaseServer
      .from("services")
      .insert(
        DEFAULT_SERVICES.map((s) => ({
          shop_id: shop.id,
          slug: s.slug,
          name: s.name,
          duration_minutes: s.duration_minutes,
          price: s.price,
          deposit_eligible: false,
          active: true,
          sort_order: s.sort_order,
        }))
      )
      .select("id");

    const createdBarbers = [];
    for (let i = 0; i < barbers.length; i++) {
      const b = barbers[i];
      const barberSlug = nameToSlug(b.name) || `barber-${i + 1}`;
      const { data: createdBarber } = await supabaseServer
        .from("barbers")
        .insert({
          shop_id: shop.id,
          slug: barberSlug,
          name: b.name,
          display_name: b.name,
          role: b.role || "Barber",
          active: true,
          sort_order: i + 1,
        })
        .select("id")
        .single();
      if (createdBarber) createdBarbers.push(createdBarber);
    }

    if (createdBarbers.length > 0 && createdServices && createdServices.length > 0) {
      const assignments = createdBarbers.flatMap((barber) =>
        createdServices.map((service) => ({
          shop_id: shop.id,
          barber_id: barber.id,
          service_id: service.id,
          active: true,
        }))
      );
      await supabaseServer.from("barber_services").insert(assignments);
    }

    await supabaseServer.from("shop_hours").insert(
      DEFAULT_HOURS.map((h) => ({ shop_id: shop.id, ...h }))
    );

    await supabaseServer.from("shop_settings").insert([
      {
        shop_id: shop.id,
        key: "admin_auth",
        value_json: { pin },
      },
      {
        shop_id: shop.id,
        key: "booking_rules",
        value_json: { slot_interval_minutes: 30, lead_time_minutes: 0, max_days_out: 30 },
      },
      {
        shop_id: shop.id,
        key: "notifications",
        value_json: { sms_enabled: false, email_enabled: false },
      },
    ]);

    return NextResponse.json({ ok: true, shopSlug: shop.slug, shopName: shop.name });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
