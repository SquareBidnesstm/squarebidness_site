import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer.from("shops").select("id").eq("slug", shopSlug).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let q = supabaseServer
    .from("blocked_times")
    .select("id, barber_id, title, reason, starts_at, ends_at, barbers(name, display_name)")
    .eq("shop_id", shop.id)
    .order("starts_at");

  if (from) q = q.gte("starts_at", from);
  if (to) q = q.lte("ends_at", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, blocks: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer.from("shops").select("id").eq("slug", shopSlug).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { barber_id, title, date, start_time, end_time, all_day } = body;

  if (!date) return NextResponse.json({ ok: false, error: "Date is required" }, { status: 400 });

  let startsAt: string;
  let endsAt: string;

  if (all_day) {
    startsAt = `${date}T00:00:00`;
    endsAt = `${date}T23:59:59`;
  } else {
    if (!start_time || !end_time) return NextResponse.json({ ok: false, error: "start_time and end_time required" }, { status: 400 });
    startsAt = `${date}T${start_time}:00`;
    endsAt = `${date}T${end_time}:00`;
  }

  const { data: block, error } = await supabaseServer
    .from("blocked_times")
    .insert({
      shop_id: shop.id,
      barber_id: barber_id || null,
      title: title || (all_day ? "Day Off" : "Blocked"),
      starts_at: startsAt,
      ends_at: endsAt,
      created_by: "admin",
    })
    .select("id, barber_id, title, starts_at, ends_at")
    .single();

  if (error || !block) return NextResponse.json({ ok: false, error: error?.message || "Failed" }, { status: 500 });
  return NextResponse.json({ ok: true, block });
}
