import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, stripe_account_id, stripe_onboarding_complete")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const accountId = shop.stripe_account_id as string | null;

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

    // Sync DB if payouts just became enabled
    const nowComplete = account.payouts_enabled === true;
    if (nowComplete && !shop.stripe_onboarding_complete) {
      await supabaseServer.from("shops")
        .update({ stripe_onboarding_complete: true })
        .eq("id", shop.id);
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
