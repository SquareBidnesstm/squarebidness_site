import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authorized = await verifyAdminSession(req, shopSlug);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  const { data, error } = await supabaseServer
    .from("services")
    .select("id, slug, name, duration_minutes, price, deposit_eligible, deposit_amount, active, sort_order")
    .eq("shop_id", shop.id)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, services: data || [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authorized = await verifyAdminSession(req, shopSlug);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, duration_minutes, price } = body;

  if (!name || !duration_minutes || price == null) {
    return NextResponse.json({ ok: false, error: "Name, duration, and price are required." }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data: maxOrder } = await supabaseServer
    .from("services")
    .select("sort_order")
    .eq("shop_id", shop.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.sort_order ?? 0) + 1;

  const { data, error } = await supabaseServer
    .from("services")
    .insert({
      shop_id: shop.id,
      slug: `${slug}-${Date.now()}`,
      name,
      duration_minutes: Number(duration_minutes),
      price: Number(price),
      deposit_eligible: false,
      active: true,
      sort_order: nextOrder,
    })
    .select("id, slug, name, duration_minutes, price, deposit_eligible, deposit_amount, active, sort_order")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to create service." }, { status: 500 });
  }

  // Assign new service to all active barbers
  const { data: barbers } = await supabaseServer
    .from("barbers")
    .select("id")
    .eq("shop_id", shop.id)
    .eq("active", true);

  if (barbers && barbers.length > 0) {
    await supabaseServer.from("barber_services").insert(
      barbers.map((b) => ({
        shop_id: shop.id,
        barber_id: b.id,
        service_id: data.id,
        active: true,
      }))
    );
  }

  return NextResponse.json({ ok: true, service: data });
}
