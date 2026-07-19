import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { verifyBarberSession } from "../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

export default async function BarberStripeReturnPage({
  params,
}: {
  params: Promise<{ shopSlug: string; barberSlug: string }>;
}) {
  const { shopSlug, barberSlug } = await params;

  const cookieStore = await cookies();
  const req = { headers: { get: (k: string) => cookieStore.get(k)?.value ?? null } } as any;
  const authed = await verifyBarberSession(req, shopSlug, barberSlug);
  if (!authed) redirect(`/${shopSlug}/${barberSlug}/login`);

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) redirect(`/${shopSlug}/${barberSlug}`);

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, name, stripe_account_id, stripe_onboarding_complete")
    .eq("slug", barberSlug)
    .eq("shop_id", shop.id)
    .single();

  if (!barber || !barber.stripe_account_id) redirect(`/${shopSlug}/${barberSlug}`);

  let payoutsEnabled = false;
  let detailsSubmitted = false;
  let currentlyDue: string[] = [];

  try {
    const account = await stripe.accounts.retrieve(barber.stripe_account_id as string);
    payoutsEnabled = account.payouts_enabled === true;
    detailsSubmitted = account.details_submitted === true;
    currentlyDue = account.requirements?.currently_due ?? [];

    if (payoutsEnabled && !barber.stripe_onboarding_complete) {
      await supabaseServer.from("barbers")
        .update({ stripe_onboarding_complete: true })
        .eq("id", barber.id);
    }
  } catch {
    // Non-fatal — show incomplete state
  }

  const dashboardUrl = `/${shopSlug}/${barberSlug}`;
  const continueUrl = `/api/${shopSlug}/barbers/${barberSlug}/stripe/connect`;

  return (
    <div style={{ background: "#050505", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 16, padding: "40px 36px", maxWidth: 480, width: "100%" }}>
        <div style={{ borderTop: `4px solid ${payoutsEnabled ? "#d4af37" : "#444"}`, margin: "-40px -36px 32px", borderRadius: "16px 16px 0 0" }} />

        {payoutsEnabled ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "0 0 8px" }}>You're set up!</h1>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 28px" }}>Stripe is verified — booking deposits will route directly to your bank account.</p>
          </>
        ) : detailsSubmitted ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "0 0 8px" }}>Under Review</h1>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 16px" }}>Your info was submitted. Stripe usually approves within 1–2 business days.</p>
            {currentlyDue.length > 0 && (
              <div style={{ background: "#1a0a00", border: "1px solid #331500", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                <p style={{ color: "#ff9955", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>Still needed:</p>
                <ul style={{ color: "#888", fontSize: 13, margin: 0, paddingLeft: 18 }}>
                  {currentlyDue.map((item) => <li key={item}>{item.replace(/_/g, " ")}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "0 0 8px" }}>Setup Incomplete</h1>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 16px" }}>Stripe needs more information before payouts can be enabled.</p>
            {currentlyDue.length > 0 && (
              <div style={{ background: "#1a0a00", border: "1px solid #331500", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                <p style={{ color: "#ff9955", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>Required:</p>
                <ul style={{ color: "#888", fontSize: 13, margin: 0, paddingLeft: 18 }}>
                  {currentlyDue.map((item) => <li key={item}>{item.replace(/_/g, " ")}</li>)}
                </ul>
              </div>
            )}
            <a
              href={continueUrl}
              style={{ display: "block", background: "#d4af37", color: "#000", fontWeight: 800, fontSize: 15, textAlign: "center", padding: "14px 0", borderRadius: 10, textDecoration: "none", marginBottom: 12 }}
            >
              Continue Setup →
            </a>
          </>
        )}

        <a
          href={dashboardUrl}
          style={{ display: "block", color: "#555", fontSize: 13, textAlign: "center", textDecoration: "none", marginTop: 8 }}
        >
          ← Back to my dashboard
        </a>
      </div>
    </div>
  );
}
