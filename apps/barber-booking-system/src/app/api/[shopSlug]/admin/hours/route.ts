import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .single();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  const { data: hours, error } = await supabaseServer
    .from("shop_hours")
    .select("id, day_of_week, is_closed, open_time, close_time")
    .eq("shop_id", shop.id)
    .order("day_of_week");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, hours: hours ?? [] });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .single();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  const body = await req.json();
  const { hours } = body as {
    hours: {
      day_of_week: number;
      is_closed: boolean;
      open_time: string | null;
      close_time: string | null;
    }[];
  };

  if (!Array.isArray(hours) || hours.length === 0) {
    return NextResponse.json({ ok: false, error: "Invalid hours payload" }, { status: 400 });
  }

  // Validate open < close for each non-closed day
  const timeRe = /^\d{2}:\d{2}$/;
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  for (const h of hours) {
    if (!h.is_closed) {
      if (!h.open_time || !h.close_time || !timeRe.test(h.open_time) || !timeRe.test(h.close_time)) {
        return NextResponse.json({ ok: false, error: `Invalid time format for day ${h.day_of_week}` }, { status: 400 });
      }
      if (toMins(h.open_time) >= toMins(h.close_time)) {
        return NextResponse.json({ ok: false, error: `Open time must be before close time (day ${h.day_of_week})` }, { status: 400 });
      }
    }
  }

  // Upsert each day
  const upsertRows = hours.map((h) => ({
    shop_id: shop.id,
    day_of_week: h.day_of_week,
    is_closed: h.is_closed,
    open_time: h.is_closed ? null : h.open_time,
    close_time: h.is_closed ? null : h.close_time,
  }));

  const { error } = await supabaseServer
    .from("shop_hours")
    .upsert(upsertRows, { onConflict: "shop_id,day_of_week" });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
