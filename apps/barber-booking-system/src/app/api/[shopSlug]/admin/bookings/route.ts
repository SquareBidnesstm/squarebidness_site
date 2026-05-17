import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;

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
    .select("id, name, slug, logo_url, timezone")
    .eq("slug", shopSlug)
    .single();

  if (shopError || !shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  // Pagination params
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10)));
  const offset = (page - 1) * limit;

  // Optional date range — defaults to 90 days ago through future
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 90);
  const dateFrom = url.searchParams.get("date_from") ?? defaultFrom.toISOString().slice(0, 10);
  const dateTo = url.searchParams.get("date_to") ?? null;

  let query = supabaseServer
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
      price_snapshot,
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
    `, { count: "exact" })
    .eq("shop_id", shop.id)
    .gte("appointment_date", dateFrom)
    .order("starts_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (dateTo) {
    query = query.lte("appointment_date", dateTo);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[admin/bookings GET] DB error:", error);
    return NextResponse.json({ ok: false, error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    shop: { name: shop.name, slug: shop.slug, logo_url: shop.logo_url ?? null, timezone: shop.timezone ?? "America/New_York" },
    bookings: data || [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      has_more: offset + limit < (count ?? 0),
    },
  });
}
