// =========================================================
// GET /api/organizer/stripe-connect
// Initiates Stripe Connect OAuth onboarding for an organizer
// =========================================================

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function GET(req: Request) {
  // Identify organizer from session cookie
  const organizerSlug = await getVerifiedOrganizerSlug(req);

  if (!organizerSlug) {
    return NextResponse.redirect(new URL("/organizer/login", req.url));
  }

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, email, name")
    .eq("slug", organizerSlug)
    .single();

  if (!organizer) {
    return NextResponse.redirect(new URL("/organizer/login", req.url));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://events.squarebidness.com";

  try {
    // Use Stripe Connect Express account onboarding
    // First create an Express account if needed
    const { data: existing } = await supabaseServer
      .from("organizers")
      .select("stripe_account_id")
      .eq("id", organizer.id)
      .single();

    let stripeAccountId = existing?.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: organizer.email,
        business_profile: {
          name: organizer.name,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;

      // Save the account ID; flip onboarding flag if already fully submitted
      await supabaseServer
        .from("organizers")
        .update({
          stripe_account_id: stripeAccountId,
          stripe_onboarding_complete: account.details_submitted ?? false,
        })
        .eq("id", organizer.id);
    } else {
      // Account already exists — check if it's fully onboarded and update flag if so
      const account = await stripe.accounts.retrieve(stripeAccountId);
      if (account.details_submitted) {
        await supabaseServer
          .from("organizers")
          .update({ stripe_onboarding_complete: true })
          .eq("id", organizer.id);
      }
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl}/api/organizer/stripe-connect`,
      return_url: `${appUrl}/organizer/dashboard?stripe=connected`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url);
  } catch (err) {
    console.error("Stripe Connect error:", err);
    return NextResponse.redirect(
      new URL("/organizer/dashboard?error=stripe_connect_failed", req.url)
    );
  }
}
