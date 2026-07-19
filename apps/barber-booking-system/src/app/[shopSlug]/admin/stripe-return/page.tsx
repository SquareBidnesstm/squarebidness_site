import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

export default async function StripeReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<{ barberId?: string }>;
}) {
  const { shopSlug } = await params;
  const { barberId } = await searchParams;

  const cookieStore = await cookies();
  const req = { headers: { get: (k: string) => cookieStore.get(k)?.value ?? null } } as any;
  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) redirect(`/${shopSlug}/admin/login`);

  if (!barberId) redirect(`/${shopSlug}/admin`);

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) redirect(`/${shopSlug}/admin`);

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, name, stripe_account_id, stripe_onboarding_complete")
    .eq("id", barberId)
    .eq("shop_id", shop.id)
    .single();

  if (!barber || !barber.stripe_account_id) redirect(`/${shopSlug}/admin`);

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
        .eq("id", barberId);
    }
  } catch {
    // Non-fatal — show incomplete state
  }

  const adminUrl = `/${shopSlug}/admin`;
  const continueUrl = `/api/${shopSlug}/admin/stripe/connect?barberId=${barberId}`;
  const barberName = barber.name;

  return (
    <div style={{ background: "#050505", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 16, padding: "40px 36px", maxWidth: 480, width: "100%" }}>
        <div style={{ borderTop: `4px solid ${payoutsEnabled ? "#d4af37" : "#444"}`, margin: "-40px -36px 32px", borderRadius: "16px 16px 0 0" }} />

        {payoutsEnabled ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "0 0 8px" }}>Payouts Active</h1>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 28px" }}>{barberName} is verified — deposits will route directly to their bank.</p>
          </>
        ) : detailsSubmitted ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "0 0 8px" }}>Under Review</h1>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 16px" }}>{barberName}'s information has been submitted. Stripe is reviewing — this usually takes 1–2 business days.</p>
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
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 16px" }}>Stripe needs more info from {barberName} before payouts can be enabled.</p>
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
          href={adminUrl}
          style={{ display: "block", color: "#555", fontSize: 13, textAlign: "center", textDecoration: "none", marginTop: 8 }}
        >
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}
