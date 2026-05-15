import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberId: string }> }
) {
  const { shopSlug, barberId } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer.from("shops").select("id").eq("slug", shopSlug).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: hours } = await supabaseServer
    .from("barber_hours")
    .select("day_of_week, is_closed, open_time, close_time")
    .eq("barber_id", barberId)
    .order("day_of_week");

  return NextResponse.json({ ok: true, hours: hours ?? [] });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberId: string }> }
) {
  const { shopSlug, barberId } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer.from("shops").select("id").eq("slug", shopSlug).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  // Verify barber belongs to shop
  const { data: barber } = await supabaseServer
    .from("barbers").select("id").eq("id", barberId).eq("shop_id", shop.id).single();
  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });

  const body = await req.json();
  const { hours } = body as {
    hours: { day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null }[];
  };

  if (!Array.isArray(hours)) return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });

  // Validate open < close for each non-closed day
  const timeRe = /^\d{2}:\d{2}$/;
  const toMins = (t: string) => { const [hh, mm] = t.split(":").map(Number); return hh * 60 + mm; };
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

  const upsertRows = hours.map((h) => ({
    barber_id: barberId,
    day_of_week: h.day_of_week,
    is_closed: h.is_closed,
    open_time: h.is_closed ? null : h.open_time,
    close_time: h.is_closed ? null : h.close_time,
  }));

  const { error } = await supabaseServer
    .from("barber_hours")
    .upsert(upsertRows, { onConflict: "barber_id,day_of_week" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberId: string }> }
) {
  const { shopSlug, barberId } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // Clear custom hours — barber reverts to shop hours
  await supabaseServer.from("barber_hours").delete().eq("barber_id", barberId);

  return NextResponse.json({ ok: true });
}
