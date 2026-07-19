import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../../../lib/supabase/server";
import { verifyBarberSession } from "../../../../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;

  const authed = await verifyBarberSession(req, shopSlug, barberSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, stripe_account_id, stripe_onboarding_complete")
    .eq("slug", barberSlug)
    .eq("shop_id", shop.id)
    .single();

  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });

  const accountId = barber.stripe_account_id as string | null;

  if (!accountId) {
    return NextResponse.json({ ok: true, connected: false, payouts_enabled: false, details_submitted: false });
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);

    if (account.payouts_enabled && !barber.stripe_onboarding_complete) {
      await supabaseServer.from("barbers").update({ stripe_onboarding_complete: true }).eq("id", barber.id);
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    });
  } catch (err) {
    console.error("[barber/stripe/status]", err);
    return NextResponse.json({ ok: false, error: "Could not fetch Stripe status." }, { status: 500 });
  }
}
