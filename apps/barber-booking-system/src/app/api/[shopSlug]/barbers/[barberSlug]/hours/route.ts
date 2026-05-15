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

async function checkPerm(shopId: string, barberId: string, perm: "can_edit_hours" | "can_edit_prices") {
  const { data: setting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shopId)
    .eq("key", `barber_perms_${barberId}`)
    .single();

  return (setting?.value_json as Record<string, boolean> | null)?.[perm] === true;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;

  const authed = await verifyBarberSession(req, shopSlug, barberSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { shop, barber } = await resolveBarber(shopSlug, barberSlug);
  if (!shop || !barber) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const allowed = await checkPerm(shop.id, barber.id, "can_edit_hours");
  if (!allowed) return NextResponse.json({ ok: false, error: "Not permitted" }, { status: 403 });

  const { data: hours } = await supabaseServer
    .from("barber_hours")
    .select("day_of_week, is_closed, open_time, close_time")
    .eq("barber_id", barber.id)
    .order("day_of_week");

  return NextResponse.json({ ok: true, hours: hours ?? [] });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;

  const authed = await verifyBarberSession(req, shopSlug, barberSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { shop, barber } = await resolveBarber(shopSlug, barberSlug);
  if (!shop || !barber) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const allowed = await checkPerm(shop.id, barber.id, "can_edit_hours");
  if (!allowed) return NextResponse.json({ ok: false, error: "Not permitted" }, { status: 403 });

  const body = await req.json();
  const { hours } = body as {
    hours: { day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null }[];
  };

  if (!Array.isArray(hours)) return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });

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

  const upsertRows = hours.map((h) => ({
    barber_id: barber.id,
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
