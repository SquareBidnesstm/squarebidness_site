import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyPlatformSession } from "../../../../../lib/auth";
import { hashPin } from "../../../../../lib/utils";

export async function GET(req: NextRequest) {
  const authed = await verifyPlatformSession(req);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shops } = await supabaseServer
    .from("shops")
    .select("id, slug, name, city, state, owner_name, active, created_at, bypass_stripe_requirement")
    .order("created_at", { ascending: false });

  if (!shops) return NextResponse.json({ ok: true, shops: [], stats: {} });

  const { data: subscriptions } = await supabaseServer
    .from("subscriptions")
    .select("shop_id, plan, status, current_period_end");

  const { data: bookingCounts } = await supabaseServer
    .from("bookings")
    .select("shop_id, status, price_snapshot")
    .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .limit(5000);

  type SubRow = { shop_id: string; plan: string; status: string; current_period_end: string | null };
  const subMap = new Map((subscriptions ?? []).map((s) => [s.shop_id, s as SubRow]));

  const shopData = shops.map((shop) => {
    const sub = subMap.get(shop.id);
    const shopBookings = (bookingCounts ?? []).filter((b) => b.shop_id === shop.id);
    const totalBookings = shopBookings.length;
    const totalRevenue = shopBookings.reduce((sum, b) => sum + Number(b.price_snapshot || 0), 0);
    const completedRevenue = shopBookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + Number(b.price_snapshot || 0), 0);
    return {
      ...shop,
      plan: sub?.plan ?? "free",
      subscription_status: sub?.status ?? "free",
      total_bookings: totalBookings,
      total_revenue: totalRevenue,
      completed_revenue: completedRevenue,
    };
  });

  // Signup trends
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const signupsToday = shops.filter((s) => new Date(s.created_at) >= todayStart).length;
  const signupsThisWeek = shops.filter((s) => new Date(s.created_at) >= weekAgo).length;
  const signupsThisMonth = shops.filter((s) => new Date(s.created_at) >= monthAgo).length;

  const totalShops = shopData.length;
  const activeShops = shopData.filter((s) => s.active).length;
  const proShops = shopData.filter((s) => s.plan === "pro").length;
  const totalBookingsAll = shopData.reduce((sum, s) => sum + s.total_bookings, 0);
  const totalRevenueAll = shopData.reduce((sum, s) => sum + s.total_revenue, 0);

  return NextResponse.json({
    ok: true,
    shops: shopData,
    stats: { totalShops, activeShops, proShops, totalBookingsAll, totalRevenueAll, signupsToday, signupsThisWeek, signupsThisMonth },
  });
}

export async function POST(req: NextRequest) {
  const authed = await verifyPlatformSession(req);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, slug, ownerName, city, state, timezone, barberName, barberRole, pin, services, hours } = body as {
    name: string; slug: string; ownerName: string; city: string; state: string;
    timezone?: string; barberName: string; barberRole?: string; pin: string;
    services?: { slug: string; name: string; price: number; duration_minutes: number; description?: string }[];
    hours?: { day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null }[];
  };

  if (!name?.trim() || !slug?.trim() || !ownerName?.trim() || !city?.trim() || !state?.trim() || !barberName?.trim() || !pin) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: "PIN must be 4 digits." }, { status: 400 });
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-|-$/g, "");
  const RESERVED = new Set(["admin", "book", "onboard", "login", "api", "_next", "platform"]);
  if (!cleanSlug || RESERVED.has(cleanSlug)) {
    return NextResponse.json({ ok: false, error: "Invalid or reserved slug." }, { status: 400 });
  }

  const { data: existing } = await supabaseServer.from("shops").select("id").eq("slug", cleanSlug).maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: `/${cleanSlug} is already taken.` }, { status: 409 });

  const { data: shop, error: shopError } = await supabaseServer
    .from("shops")
    .insert({
      slug: cleanSlug, name: name.trim(), owner_name: ownerName.trim(),
      city: city.trim(), state: state.trim().toUpperCase(),
      timezone: timezone || "America/Chicago",
      booking_base_path: "/book", require_deposit: false, active: true,
      bypass_stripe_requirement: true,
    })
    .select("id, slug, name")
    .single();

  if (shopError || !shop) {
    return NextResponse.json({ ok: false, error: shopError?.message || "Could not create shop." }, { status: 500 });
  }

  // Subscription: free plan + active status = lifetime free
  await supabaseServer.from("subscriptions").insert({ shop_id: shop.id, plan: "free", status: "active" });

  // Default services (use provided or empty — shop admin can add later)
  let createdServiceIds: string[] = [];
  if (services && services.length > 0) {
    const { data: createdSvcs } = await supabaseServer
      .from("services")
      .insert(services.map((s, i) => ({
        shop_id: shop.id, slug: s.slug, name: s.name,
        duration_minutes: s.duration_minutes, price: s.price,
        description: s.description || null,
        deposit_eligible: false, active: true, sort_order: i + 1,
      })))
      .select("id");
    createdServiceIds = (createdSvcs ?? []).map((s: { id: string }) => s.id);
  }

  // Primary barber
  const barberSlug = barberName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "barber-1";
  const { data: barber } = await supabaseServer
    .from("barbers")
    .insert({ shop_id: shop.id, slug: barberSlug, name: barberName.trim(), display_name: barberName.trim(), role: barberRole || "Barber", active: true, sort_order: 1 })
    .select("id")
    .single();

  if (barber && createdServiceIds.length > 0) {
    await supabaseServer.from("barber_services").insert(
      createdServiceIds.map((sid) => ({ shop_id: shop.id, barber_id: barber.id, service_id: sid, active: true }))
    );
  }

  // Hours
  const shopHours = hours ?? [
    { day_of_week: 0, is_closed: true, open_time: null, close_time: null },
    { day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "18:00" },
    { day_of_week: 2, is_closed: false, open_time: "09:00", close_time: "18:00" },
    { day_of_week: 3, is_closed: false, open_time: "09:00", close_time: "18:00" },
    { day_of_week: 4, is_closed: false, open_time: "09:00", close_time: "18:00" },
    { day_of_week: 5, is_closed: false, open_time: "09:00", close_time: "19:00" },
    { day_of_week: 6, is_closed: true, open_time: null, close_time: null },
  ];
  await supabaseServer.from("shop_hours").insert(shopHours.map((h) => ({ shop_id: shop.id, ...h })));

  const { hash: pin_hash, salt: pin_salt } = await hashPin(pin);
  await supabaseServer.from("shop_settings").insert([
    { shop_id: shop.id, key: "admin_auth", value_json: { pin_hash, pin_salt } },
    { shop_id: shop.id, key: "shop_type", value_json: { type: "barbershop" } },
    { shop_id: shop.id, key: "booking_rules", value_json: { slot_interval_minutes: 30, min_lead_time_minutes: 0, max_days_out: 30 } },
    { shop_id: shop.id, key: "notifications", value_json: { sms_enabled: false, email_enabled: false } },
    ...(barber ? [{ shop_id: shop.id, key: `barber_limit`, value_json: { limit: 5 } }] : []),
  ]);

  // Barber PIN (same as admin PIN for initial setup — they can reset from admin)
  if (barber) {
    const { hash: bpin_hash, salt: bpin_salt } = await hashPin(pin);
    await supabaseServer.from("shop_settings").insert({
      shop_id: shop.id, key: `barber_auth_${barber.id}`, value_json: { pin_hash: bpin_hash, pin_salt: bpin_salt },
    });
  }

  return NextResponse.json({
    ok: true,
    shopSlug: shop.slug,
    shopName: shop.name,
    barberSlug: barber ? barberSlug : null,
    bookingUrl: `https://booking.squarebidness.com/${shop.slug}`,
    adminUrl: `https://booking.squarebidness.com/${shop.slug}/admin`,
  });
}
