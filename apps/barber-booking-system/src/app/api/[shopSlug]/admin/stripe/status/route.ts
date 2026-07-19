import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const barberId = req.nextUrl.searchParams.get("barberId");

  if (!barberId) {
    // Return all barbers with their stripe status
    const { data: barbers } = await supabaseServer
      .from("barbers")
      .select("id, name, display_name, stripe_account_id, stripe_onboarding_complete")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("sort_order");

    return NextResponse.json({ ok: true, barbers: barbers ?? [] });
  }

  // Single barber status
  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, name, stripe_account_id, stripe_onboarding_complete")
    .eq("id", barberId)
    .eq("shop_id", shop.id)
    .single();

  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });

  const accountId = barber.stripe_account_id as string | null;

  if (!accountId) {
    return NextResponse.json({
      ok: true,
      connected: false,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      currently_due: [],
    });
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);

    const nowComplete = account.payouts_enabled === true;
    if (nowComplete && !barber.stripe_onboarding_complete) {
      await supabaseServer.from("barbers")
        .update({ stripe_onboarding_complete: true })
        .eq("id", barberId);
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      currently_due: account.requirements?.currently_due ?? [],
      eventually_due: account.requirements?.eventually_due ?? [],
    });
  } catch (err) {
    console.error("[stripe/status] retrieve failed:", err);
    return NextResponse.json({ ok: false, error: "Could not fetch Stripe status." }, { status: 500 });
  }
}
