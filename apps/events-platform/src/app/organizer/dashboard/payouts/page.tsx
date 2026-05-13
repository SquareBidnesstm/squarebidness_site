import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../lib/auth";
import NavLogo from "../../../../components/NavLogo";

export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export default async function PayoutsPage() {
  // Auth
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
  if (!sessionCookie) redirect("/organizer/login");

  const organizerSlug = sessionCookie.name.replace("org_session_", "");
  const expectedToken = await computeOrganizerSessionToken(organizerSlug);
  if (sessionCookie.value !== expectedToken) redirect("/organizer/login");

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name, stripe_account_id, stripe_onboarding_complete")
    .eq("slug", organizerSlug)
    .single();

  if (!organizer) redirect("/organizer/login");

  // If no Stripe account, show connect prompt
  if (!organizer.stripe_account_id || !organizer.stripe_onboarding_complete) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000" }}>
          <NavLogo />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/organizer/dashboard" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← Dashboard</Link>
            <a href="/api/organizer/logout" className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>Sign Out</a>
          </div>
        </nav>
        <main style={{ padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontSize: "2.5rem", marginBottom: 16 }}>💳</p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 950, marginBottom: 8 }}>Connect Stripe to view payouts</h1>
          <p style={{ color: "#a1a1aa", marginBottom: 24 }}>You need a Stripe account to receive payments and see payout history.</p>
          <a href="/api/organizer/stripe-connect" className="btn btn--primary">Connect Stripe</a>
        </main>
      </div>
    );
  }

  // Fetch Stripe balance + payouts
  let balance: Stripe.Balance | null = null;
  let payouts: Stripe.Payout[] = [];
  let stripeError: string | null = null;

  try {
    [balance] = await Promise.all([
      stripe.balance.retrieve({ stripeAccount: organizer.stripe_account_id }),
    ]);

    const payoutList = await stripe.payouts.list(
      { limit: 20 },
      { stripeAccount: organizer.stripe_account_id }
    );
    payouts = payoutList.data;
  } catch (err: any) {
    stripeError = err.message ?? "Could not load Stripe data";
  }

  // Available + pending balance in USD
  const available = (balance?.available ?? []).find((b) => b.currency === "usd");
  const pending = (balance?.pending ?? []).find((b) => b.currency === "b");
  const pendingUsd = (balance?.pending ?? []).find((b) => b.currency === "usd");

  // Fetch platform payout totals from our DB
  const { data: platformPayouts } = await supabaseServer
    .from("platform_payouts")
    .select("amount_cents")
    .eq("status", "paid");

  const totalPlatformFees = (platformPayouts ?? []).reduce(
    (s: number, p: any) => s + p.amount_cents, 0
  ) / 100;

  // Fetch all-time order revenue for this organizer
  const { data: events } = await supabaseServer
    .from("events")
    .select("id")
    .eq("organizer_id", organizer.id);

  const eventIds = (events ?? []).map((e: any) => e.id);

  let totalGMV = 0;
  if (eventIds.length > 0) {
    const { data: orders } = await supabaseServer
      .from("orders")
      .select("total")
      .in("event_id", eventIds)
      .eq("status", "paid");
    totalGMV = (orders ?? []).reduce((s: number, o: any) => s + Number(o.total), 0);
  }

  function formatCents(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function payoutStatusColor(status: string) {
    if (status === "paid") return "#22c55e";
    if (status === "in_transit") return "#eab308";
    if (status === "failed") return "#ef4444";
    return "#a1a1aa";
  }

  function payoutStatusBg(status: string) {
    if (status === "paid") return "#0a2a0a";
    if (status === "in_transit") return "#1a1500";
    if (status === "failed") return "#1a0a0a";
    return "#111";
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000" }}>
        <NavLogo />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/organizer/dashboard" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← Dashboard</Link>
          <a href="/api/organizer/logout" className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>Sign Out</a>
        </div>
      </nav>

      <main style={{ padding: "32px 14px 80px" }}>
        <div className="wrap">

          <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>Payouts</h1>
          <p style={{ color: "#a1a1aa", marginBottom: 28, fontSize: "0.9rem" }}>{organizer.name}</p>

          {stripeError && (
            <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 12, padding: 16, marginBottom: 24, color: "#f87171", fontSize: "0.9rem" }}>
              Could not load Stripe data: {stripeError}
            </div>
          )}

          {/* Balance cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Available</p>
              <p style={{ fontSize: "1.8rem", fontWeight: 950, color: "#22c55e" }}>
                {available ? formatCents(available.amount) : "—"}
              </p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>ready to pay out</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Pending</p>
              <p style={{ fontSize: "1.8rem", fontWeight: 950, color: "#eab308" }}>
                {pendingUsd ? formatCents(pendingUsd.amount) : "—"}
              </p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>processing (2–7 days)</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Gross Sales</p>
              <p style={{ fontSize: "1.8rem", fontWeight: 950 }}>${totalGMV.toFixed(2)}</p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>all-time</p>
            </div>
          </div>

          {/* Payout history */}
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
              Payout History
            </p>
            {payouts.length === 0 ? (
              <p style={{ color: "#555", fontSize: "0.9rem" }}>No payouts yet. Funds appear here once Stripe sends them to your bank.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {payouts.map((payout) => (
                  <div key={payout.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 14px", background: "#050505", borderRadius: 10,
                    border: "1px solid #1d1d1f", gap: 12,
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ fontWeight: 800, fontSize: "0.9rem" }}>
                          {formatCents(payout.amount)}
                        </p>
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 900, padding: "2px 8px", borderRadius: 99,
                          background: payoutStatusBg(payout.status),
                          color: payoutStatusColor(payout.status),
                          border: `1px solid ${payoutStatusColor(payout.status)}33`,
                          textTransform: "uppercase",
                        }}>
                          {payout.status === "in_transit" ? "In Transit" : payout.status}
                        </span>
                      </div>
                      <p style={{ color: "#555", fontSize: "0.75rem" }}>
                        {payout.description ?? "Stripe Payout"} · {payout.destination_payment_method_details ? "Bank" : "Bank account"}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ color: "#a1a1aa", fontSize: "0.8rem" }}>
                        {new Date(payout.arrival_date * 1000).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                      <p style={{ color: "#333", fontSize: "0.7rem" }}>arrival date</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stripe dashboard link */}
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontWeight: 900, marginBottom: 4 }}>Stripe Express Dashboard</p>
              <p style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>View full payout details, bank accounts, and tax documents.</p>
            </div>
            <a
              href={`https://connect.stripe.com/express_login`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--outline"
              style={{ whiteSpace: "nowrap", marginLeft: 16, minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}
            >
              Open Stripe ↗
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
