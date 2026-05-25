import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";
import { hashPin } from "../../../lib/utils";
import { sendShopSignupNotification } from "../../../lib/email";

// Protect onboard with a shared platform secret so only the internal
// onboarding wizard (or Marcus) can create new shops.
function verifyOnboardSecret(req: NextRequest): boolean {
  const secret = process.env.ONBOARD_SECRET;
  if (!secret) return false; // If env var not set, deny all
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

type OnboardPayload = {
  shopType?: string;
  shopName?: string;
  slug?: string;
  city?: string;
  state?: string;
  timezone?: string;
  ownerName?: string;
  ownerEmail?: string;
  barbers?: { name: string; role: string }[];
  pin?: string;
};

type ServiceDef = { slug: string; name: string; duration_minutes: number; price: number; sort_order: number };

const SERVICES_BY_TYPE: Record<string, ServiceDef[]> = {
  barbershop: [
    { slug: "haircut", name: "Haircut", duration_minutes: 45, price: 35.00, sort_order: 1 },
    { slug: "haircut-beard", name: "Haircut + Beard", duration_minutes: 60, price: 45.00, sort_order: 2 },
    { slug: "kids-cut", name: "Kids Cut", duration_minutes: 30, price: 25.00, sort_order: 3 },
    { slug: "enhancements", name: "Cut + Enhancements", duration_minutes: 60, price: 50.00, sort_order: 4 },
    { slug: "vip", name: "VIP Appointment", duration_minutes: 90, price: 75.00, sort_order: 5 },
  ],
  beauty_salon: [
    { slug: "wash-style", name: "Wash & Style", duration_minutes: 60, price: 45.00, sort_order: 1 },
    { slug: "blowout", name: "Blowout", duration_minutes: 45, price: 40.00, sort_order: 2 },
    { slug: "cut-style", name: "Cut & Style", duration_minutes: 60, price: 55.00, sort_order: 3 },
    { slug: "hair-color", name: "Hair Color", duration_minutes: 120, price: 80.00, sort_order: 4 },
    { slug: "braids-natural", name: "Braids / Natural", duration_minutes: 90, price: 65.00, sort_order: 5 },
    { slug: "vip", name: "VIP Appointment", duration_minutes: 90, price: 100.00, sort_order: 6 },
  ],
  nail_salon: [
    { slug: "manicure", name: "Manicure", duration_minutes: 30, price: 25.00, sort_order: 1 },
    { slug: "pedicure", name: "Pedicure", duration_minutes: 45, price: 35.00, sort_order: 2 },
    { slug: "gel-manicure", name: "Gel Manicure", duration_minutes: 45, price: 40.00, sort_order: 3 },
    { slug: "full-set", name: "Full Set Acrylics", duration_minutes: 60, price: 55.00, sort_order: 4 },
    { slug: "fill-in", name: "Fill-In", duration_minutes: 45, price: 35.00, sort_order: 5 },
  ],
  spa: [
    { slug: "swedish-massage", name: "Swedish Massage", duration_minutes: 60, price: 75.00, sort_order: 1 },
    { slug: "deep-tissue", name: "Deep Tissue", duration_minutes: 60, price: 85.00, sort_order: 2 },
    { slug: "facial", name: "Facial", duration_minutes: 60, price: 65.00, sort_order: 3 },
    { slug: "body-wrap", name: "Body Wrap", duration_minutes: 75, price: 90.00, sort_order: 4 },
  ],
  lash_studio: [
    { slug: "classic-full-set", name: "Classic Full Set", duration_minutes: 90, price: 85.00, sort_order: 1 },
    { slug: "volume-full-set", name: "Volume Full Set", duration_minutes: 120, price: 110.00, sort_order: 2 },
    { slug: "fill", name: "Fill", duration_minutes: 60, price: 55.00, sort_order: 3 },
    { slug: "lash-lift", name: "Lash Lift", duration_minutes: 45, price: 65.00, sort_order: 4 },
  ],
  other: [
    { slug: "service-1", name: "Service 1", duration_minutes: 30, price: 30.00, sort_order: 1 },
    { slug: "service-2", name: "Service 2", duration_minutes: 60, price: 50.00, sort_order: 2 },
  ],
};

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
  // Gate: requires Authorization: Bearer <ONBOARD_SECRET>
  if (!verifyOnboardSecret(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as OnboardPayload;

    const { shopType, shopName, slug, city, state, timezone, ownerName, ownerEmail, barbers, pin } = body;
    const cleanShopType = shopType && SERVICES_BY_TYPE[shopType] ? shopType : "barbershop";
    const DEFAULT_SERVICES = SERVICES_BY_TYPE[cleanShopType];

    if (!shopName || !slug || !city || !state || !ownerName || !pin) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }

    if (!barbers || barbers.length === 0 || barbers.some((b) => !b.name?.trim())) {
      return NextResponse.json({ ok: false, error: "At least one barber with a name is required." }, { status: 400 });
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ ok: false, error: "PIN must be exactly 4 digits." }, { status: 400 });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-|-$/g, "");
    if (!cleanSlug) {
      return NextResponse.json({ ok: false, error: "Invalid slug." }, { status: 400 });
    }

    // Block slugs that conflict with built-in app routes
    const RESERVED_SLUGS = new Set([
      "admin", "book", "onboard", "login", "api", "_next",
      "platform", "favicon.ico", "cancel", "reschedule", "book",
    ]);
    if (RESERVED_SLUGS.has(cleanSlug)) {
      return NextResponse.json(
        { ok: false, error: `"/${cleanSlug}" is a reserved path. Please choose a different slug.` },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseServer
      .from("shops")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

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

    const { hash: pin_hash, salt: pin_salt } = await hashPin(pin);

    await supabaseServer.from("shop_settings").insert([
      {
        shop_id: shop.id,
        key: "admin_auth",
        value_json: { pin_hash, pin_salt },
      },
      {
        shop_id: shop.id,
        key: "shop_type",
        value_json: { type: cleanShopType },
      },
      {
        shop_id: shop.id,
        key: "booking_rules",
        value_json: { slot_interval_minutes: 30, min_lead_time_minutes: 0, max_days_out: 30 },
      },
      {
        shop_id: shop.id,
        key: "notifications",
        value_json: { sms_enabled: false, email_enabled: false },
      },
    ]);

    // Create a free subscription row for the new shop
    await supabaseServer.from("subscriptions").insert({
      shop_id: shop.id,
      plan: "free",
      status: "free",
    });

    // Fire signup notification (non-blocking — never fails the onboard response)
    sendShopSignupNotification({
      shopName: shop.name,
      shopSlug: shop.slug,
      ownerName,
      ownerEmail: ownerEmail?.trim() || null,
      city,
      state,
      shopType: cleanShopType,
    }).catch((err) => console.error("[onboard] signup notification error:", err));

    return NextResponse.json({ ok: true, shopSlug: shop.slug, shopName: shop.name });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
