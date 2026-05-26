import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyPlatformSession } from "../../../../../lib/auth";

export async function GET(req: NextRequest) {
  const authed = await verifyPlatformSession(req);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shops } = await supabaseServer
    .from("shops")
    .select("id, slug, name, city, state, owner_name, active, created_at")
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
