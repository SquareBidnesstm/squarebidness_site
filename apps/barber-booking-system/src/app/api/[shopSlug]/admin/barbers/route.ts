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
    .select("id, slug, name, display_name, role, active, sort_order, photo_url")
    .eq("shop_id", shop.id)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Fetch PIN presence for each barber
  const barberIds = (barbers ?? []).map((b) => b.id);
  let pinSet: Record<string, boolean> = {};
  if (barberIds.length > 0) {
    const { data: settings } = await supabaseServer
      .from("shop_settings")
      .select("key, value_json")
      .eq("shop_id", shop.id)
      .in("key", barberIds.map((id) => `barber_auth_${id}`));
    for (const s of settings ?? []) {
      const bid = (s.key as string).replace("barber_auth_", "");
      pinSet[bid] = !!(s.value_json as { pin?: string } | null)?.pin;
    }
  }

  // Compute barber limit
  const { data: sub } = await supabaseServer
    .from("subscriptions")
    .select("plan, status")
    .eq("shop_id", shop.id)
    .single();

  const { data: limitSetting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shop.id)
    .eq("key", "barber_limit")
    .single();

  const activePlan = sub?.status === "active" ? sub?.plan : "free";
  const defaultLimit = activePlan === "pro" ? 10 : activePlan === "solo" ? 1 : 0;
  const customLimit = (limitSetting?.value_json as { limit?: number } | null)?.limit;
  const barberLimit = customLimit ?? defaultLimit;

  const barbersWithPin = (barbers ?? []).map((b) => ({
    ...b,
    has_pin: pinSet[b.id] ?? false,
  }));

  return NextResponse.json({ ok: true, barbers: barbersWithPin, barberLimit });
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

  // Enforce barber limit based on subscription plan
  const { data: sub } = await supabaseServer
    .from("subscriptions")
    .select("plan, status")
    .eq("shop_id", shop.id)
    .single();

  // Check for custom limit in shop_settings (platform admin can override)
  const { data: limitSetting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shop.id)
    .eq("key", "barber_limit")
    .single();

  const activePlan = sub?.status === "active" ? sub?.plan : "free";
  const defaultLimit = activePlan === "pro" ? 10 : activePlan === "solo" ? 1 : 0;
  const customLimit = (limitSetting?.value_json as { limit?: number } | null)?.limit;
  const barberLimit = customLimit ?? defaultLimit;

  if (barberLimit === 0) {
    return NextResponse.json(
      { ok: false, error: "Upgrade to Pro to add barbers." },
      { status: 403 }
    );
  }

  const { count: activeCount } = await supabaseServer
    .from("barbers")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id)
    .eq("active", true);

  if ((activeCount ?? 0) >= barberLimit) {
    return NextResponse.json(
      { ok: false, error: `Barber limit reached (${barberLimit}). Upgrade your plan to add more.` },
      { status: 403 }
    );
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

  // Generate a unique slug (capped at 20 attempts to prevent infinite loop on network errors)
  let baseSlug = nameToSlug(name.trim()) || `barber-${nextOrder}`;
  let slug = baseSlug;
  let attempts = 0;
  while (attempts++ < 20) {
    const { data: conflict } = await supabaseServer
      .from("barbers")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("slug", slug)
      .maybeSingle();
    if (!conflict) break;
    if (attempts >= 20) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
      break;
    }
    slug = `${baseSlug}-${attempts}`;
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
    .select("id, slug, name, display_name, role, active, sort_order, photo_url")
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
