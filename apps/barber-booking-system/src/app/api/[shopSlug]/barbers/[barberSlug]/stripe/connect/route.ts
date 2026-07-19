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
  if (!authed) {
    return NextResponse.redirect(new URL(`/${shopSlug}/${barberSlug}/login`, req.url));
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, name, stripe_account_id")
    .eq("slug", barberSlug)
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
        metadata: { platform: "squarebidness", shop_slug: shopSlug, barber_slug: barberSlug },
      });
      accountId = account.id;
      await supabaseServer.from("barbers").update({ stripe_account_id: accountId }).eq("id", barber.id);
    } catch (err: any) {
      console.error("[barber/stripe/connect] account creation failed:", err);
      return NextResponse.json({ ok: false, error: "Could not create Stripe account.", detail: err?.message || String(err) }, { status: 500 });
    }
  }

  const origin = `https://booking.squarebidness.com`;
  try {
    const returnUrl = new URL(`/${shopSlug}/${barberSlug}/stripe-return`, origin);
    const refreshUrl = new URL(`/api/${shopSlug}/barbers/${barberSlug}/stripe/connect`, origin);

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl.toString(),
      refresh_url: refreshUrl.toString(),
    });
    return NextResponse.redirect(link.url);
  } catch (err: any) {
    console.error("[barber/stripe/connect] accountLinks.create failed:", err);
    return NextResponse.json({ ok: false, error: "Could not generate Stripe setup link.", detail: err?.message }, { status: 500 });
  }
}
