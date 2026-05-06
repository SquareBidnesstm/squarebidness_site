import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

  const { data: barbers, error } = await supabaseServer
    .from("barbers")
    .select("id, slug, name, display_name, role, active, sort_order")
    .eq("shop_id", shop.id)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, barbers: barbers ?? [] });
}

export async function POST(
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
  const { name, display_name, role } = body;

  if (!name?.trim()) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }

  // Get current max sort_order
  const { data: existing } = await supabaseServer
    .from("barbers")
    .select("sort_order")
    .eq("shop_id", shop.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (existing?.sort_order ?? 0) + 1;

  // Generate a unique slug
  let baseSlug = nameToSlug(name.trim()) || `barber-${nextOrder}`;
  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const { data: conflict } = await supabaseServer
      .from("barbers")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("slug", slug)
      .single();
    if (!conflict) break;
    slug = `${baseSlug}-${attempt++}`;
  }

  const { data: barber, error } = await supabaseServer
    .from("barbers")
    .insert({
      shop_id: shop.id,
      slug,
      name: name.trim(),
      display_name: display_name?.trim() || name.trim(),
      role: role || "Barber",
      active: true,
      sort_order: nextOrder,
    })
    .select("id, slug, name, display_name, role, active, sort_order")
    .single();

  if (error || !barber) {
    return NextResponse.json({ ok: false, error: error?.message || "Could not create barber." }, { status: 500 });
  }

  // Auto-assign all active services to this new barber
  const { data: services } = await supabaseServer
    .from("services")
    .select("id")
    .eq("shop_id", shop.id)
    .eq("active", true);

  if (services && services.length > 0) {
    await supabaseServer.from("barber_services").insert(
      services.map((s) => ({
        shop_id: shop.id,
        barber_id: barber.id,
        service_id: s.id,
        active: true,
      }))
    );
  }

  return NextResponse.json({ ok: true, barber });
}
