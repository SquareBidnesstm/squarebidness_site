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
  if (!authed) {
    return NextResponse.redirect(new URL(`/${shopSlug}/admin/login`, req.url));
  }

  const barberId = req.nextUrl.searchParams.get("barberId");
  if (!barberId) {
    return NextResponse.json({ ok: false, error: "barberId is required." }, { status: 400 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, name, stripe_account_id")
    .eq("id", barberId)
    .eq("shop_id", shop.id)
    .eq("active", true)
    .single();

  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });

  let accountId = barber.stripe_account_id as string | null;

  if (!accountId) {
    try {
      const account = await stripe.accounts.create({
        type: "custom",
        country: "US",
        business_profile: {
          name: barber.name,
          mcc: "7230",
          url: "https://booking.squarebidness.com",
        },
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: { platform: "squarebidness", shop_slug: shopSlug, barber_id: barberId },
      });
      accountId = account.id;
      await supabaseServer.from("barbers").update({ stripe_account_id: accountId }).eq("id", barberId);
    } catch (err: any) {
      console.error("[stripe/connect] account creation failed:", err);
      return NextResponse.json({ ok: false, error: "Could not create Stripe account.", detail: err?.message || String(err) }, { status: 500 });
    }
  }

  const origin = `https://booking.squarebidness.com`;
  try {
    const returnUrl = new URL(`/${shopSlug}/admin/stripe-return`, origin);
    returnUrl.searchParams.set("barberId", barberId);

    const refreshUrl = new URL(`/api/${shopSlug}/admin/stripe/connect`, origin);
    refreshUrl.searchParams.set("barberId", barberId);

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl.toString(),
      refresh_url: refreshUrl.toString(),
    });
    return NextResponse.redirect(link.url);
  } catch (err: any) {
    console.error("[stripe/connect] accountLinks.create failed:", err);
    return NextResponse.json({ ok: false, error: "Could not generate Stripe setup link.", detail: err?.message }, { status: 500 });
  }
}
