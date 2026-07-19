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

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, stripe_account_id")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  let accountId = shop.stripe_account_id as string | null;

  // Create a connected account on the fly if one doesn't exist yet
  if (!accountId) {
    try {
      // Don't pre-set business_type — let Stripe's hosted form ask.
      // This lets sole proprietors use SSN and businesses use EIN without
      // us needing to know which they are before onboarding starts.
      const account = await stripe.accounts.create({
        type: "custom",
        country: "US",
        business_profile: {
          name: shop.name,
          mcc: "7230",
          url: "https://booking.squarebidness.com",
        },
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        tos_acceptance: { service_agreement: "recipient" },
        metadata: { platform: "squarebidness" },
      });
      accountId = account.id;
      await supabaseServer.from("shops").update({ stripe_account_id: accountId }).eq("id", shop.id);
    } catch (err: any) {
      console.error("[stripe/connect] account creation failed:", err);
      return NextResponse.json({ ok: false, error: "Could not create Stripe account.", detail: err?.message || String(err) }, { status: 500 });
    }
  }

  // Generate an AccountLink — Stripe hosts the KYC form
  const origin = `https://booking.squarebidness.com`;
  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: `${origin}/${shopSlug}/admin/stripe-return`,
      refresh_url: `${origin}/api/${shopSlug}/admin/stripe/connect`,
    });
    return NextResponse.redirect(link.url);
  } catch (err) {
    console.error("[stripe/connect] accountLinks.create failed:", err);
    return NextResponse.json({ ok: false, error: "Could not generate Stripe setup link." }, { status: 500 });
  }
}
