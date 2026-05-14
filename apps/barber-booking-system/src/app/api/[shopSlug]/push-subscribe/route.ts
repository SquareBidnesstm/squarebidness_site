import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { verifyAdminSession, verifyBarberSession } from "../../../../lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const body = await req.json().catch(() => ({}));
  const { subscription, barber_slug } = body as {
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
    barber_slug?: string;
  };

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
  }

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  let barberId: string | null = null;

  if (barber_slug) {
    const authed = await verifyBarberSession(req, shopSlug, barber_slug);
    if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { data: barber } = await supabaseServer
      .from("barbers").select("id").eq("shop_id", shop.id).eq("slug", barber_slug).eq("active", true).single();
    if (!barber) return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });
    barberId = barber.id;
  } else {
    const authed = await verifyAdminSession(req, shopSlug);
    if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseServer
    .from("push_subscriptions")
    .upsert(
      {
        shop_id: shop.id,
        barber_id: barberId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: "barber_id,endpoint" }
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const body = await req.json().catch(() => ({}));
  const { endpoint, barber_slug } = body as { endpoint?: string; barber_slug?: string };

  if (!endpoint) return NextResponse.json({ ok: false, error: "Missing endpoint" }, { status: 400 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  let deleteQuery = supabaseServer
    .from("push_subscriptions")
    .delete()
    .eq("shop_id", shop.id)
    .eq("endpoint", endpoint);

  if (barber_slug) {
    const { data: barber } = await supabaseServer
      .from("barbers").select("id").eq("shop_id", shop.id).eq("slug", barber_slug).single();
    if (barber) deleteQuery = deleteQuery.eq("barber_id", barber.id);
  }

  await deleteQuery;

  return NextResponse.json({ ok: true });
}
