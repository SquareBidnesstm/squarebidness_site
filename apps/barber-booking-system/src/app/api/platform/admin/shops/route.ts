import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

async function verifyPlatformSession(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get("platform_session")?.value;
  if (!cookie) return false;
  const secret = process.env.APP_SECRET ?? "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("platform-admin"));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return cookie === expected;
}

export async function GET(req: NextRequest) {
  const authed = await verifyPlatformSession(req);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shops } = await supabaseServer
    .from("shops")
    .select("id, slug, name, city, state, owner_name, active, created_at")
    .order("created_at", { ascending: false });

  if (!shops) return NextResponse.json({ ok: true, shops: [], stats: {} });

  // Get subscription data for all shops
  const { data: subscriptions } = await supabaseServer
    .from("subscriptions")
    .select("shop_id, plan, status, current_period_end");

  // Get booking counts per shop
  const { data: bookingCounts } = await supabaseServer
    .from("bookings")
    .select("shop_id, status, price_snapshot");

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

  const totalShops = shopData.length;
  const proShops = shopData.filter((s) => s.plan === "pro").length;
  const totalBookingsAll = shopData.reduce((sum, s) => sum + s.total_bookings, 0);
  const totalRevenueAll = shopData.reduce((sum, s) => sum + s.total_revenue, 0);

  return NextResponse.json({
    ok: true,
    shops: shopData,
    stats: { totalShops, proShops, totalBookingsAll, totalRevenueAll },
  });
}
