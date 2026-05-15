"use client";

import { useEffect, useState } from "react";

type SubInfo = {
  plan: "free" | "solo" | "pro";
  status: "free" | "active" | "past_due" | "canceled" | "incomplete";
  current_period_end: string | null;
};

type Props = { shopSlug: string };

export default function BillingTab({ shopSlug }: Props) {
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/${shopSlug}/admin/billing`);
        const data = await res.json();
        if (data.ok) setSub(data.subscription);
        else setError(data.error || "Could not load billing info.");
      } catch {
        setError("Network error loading billing.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shopSlug]);

  async function handleCheckout(plan: "solo" | "pro") {
    setWorking(true);
    setError("");
    try {
      const res = await fetch(`/api/${shopSlug}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Could not start checkout.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setWorking(false);
    }
  }

  async function handlePortal() {
    setWorking(true);
    setError("");
    try {
      const res = await fetch(`/api/${shopSlug}/billing/portal`, { method: "POST" });
      const data = await res.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Could not open billing portal.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div style={emptyBox}>Loading billing info...</div>;

  const isActive = sub?.status === "active";
  const isSolo = isActive && sub?.plan === "solo";
  const isPro = isActive && sub?.plan === "pro";
  const isPastDue = sub?.status === "past_due";
  const isCanceled = sub?.status === "canceled";
  const hasCustomer = sub?.status !== "free" && sub?.status !== "incomplete" && sub != null;

  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : null;

  const currentPlanLabel = isPro ? "Pro" : isSolo ? "Solo" : "Free";

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Billing</h2>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 14 }}>
        Manage your SquareBidness subscription.
      </p>

      {/* Current plan status */}
      {(isActive || isPastDue || isCanceled) && (
        <div style={{
          border: isPro ? "1px solid #3a3000" : isSolo ? "1px solid #1a2a1a" : "1px solid #232323",
          background: isPro ? "#0f0c00" : isSolo ? "#0a0f0a" : "#0d0d0d",
          borderRadius: 20, padding: "20px 24px", marginBottom: 24,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>Current Plan</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: isPro ? "#d4af37" : isSolo ? "#5cd600" : "#fff" }}>
              {currentPlanLabel}
            </div>
            {isActive && periodEnd && (
              <div style={{ color: "#555", fontSize: 13, marginTop: 4 }}>Renews {periodEnd}</div>
            )}
            {isPastDue && (
              <div style={{ color: "#ff7070", fontSize: 13, marginTop: 4 }}>
                ⚠ Payment past due — update your payment method.
              </div>
            )}
            {isCanceled && (
              <div style={{ color: "#ff9955", fontSize: 13, marginTop: 4 }}>
                Canceled. Choose a plan below to resubscribe.
              </div>
            )}
          </div>
          <button onClick={handlePortal} disabled={working} style={secondaryButton}>
            {working ? "Opening..." : "Manage Subscription"}
          </button>
        </div>
      )}

      {/* Plan cards */}
      {!isPastDue && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

          {/* Solo card */}
          <div style={{
            border: isSolo ? "2px solid #5cd600" : "1px solid #232323",
            background: isSolo ? "#060f06" : "#0d0d0d",
            borderRadius: 20, padding: "24px 22px",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#5cd600", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
                Solo
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>
                $19<span style={{ fontSize: 16, color: "#555", fontWeight: 400 }}>/mo</span>
              </div>
              <div style={{ color: "#555", fontSize: 13, marginTop: 6 }}>
                Perfect for independent contractors
              </div>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {[
                "1 barber seat",
                "Booking page",
                "Unlimited bookings",
                "Admin dashboard",
                "Personal schedule page",
                "30-day free trial",
              ].map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#aaa" }}>
                  <span style={{ color: "#5cd600", fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            {isSolo ? (
              <div style={{ padding: "10px 16px", borderRadius: 10, background: "#0d2200", border: "1px solid #1e4400", color: "#5cd600", fontWeight: 700, fontSize: 14, textAlign: "center" }}>
                Current Plan
              </div>
            ) : isActive ? (
              <button onClick={handlePortal} disabled={working} style={{ ...secondaryButton, textAlign: "center" }}>
                {working ? "Opening..." : isPro ? "Switch via Portal" : "Manage"}
              </button>
            ) : (
              <button onClick={() => handleCheckout("solo")} disabled={working} style={{ ...outlineGreenBtn }}>
                {working ? "Loading..." : isCanceled && hasCustomer ? "Resubscribe — Solo" : "Start Free Trial"}
              </button>
            )}
          </div>

          {/* Pro card */}
          <div style={{
            border: isPro ? "2px solid #d4af37" : "1px solid #232323",
            background: isPro ? "#0f0c00" : "#0d0d0d",
            borderRadius: 20, padding: "24px 22px",
            display: "flex", flexDirection: "column", gap: 16,
            position: "relative", overflow: "hidden",
          }}>
            {!isPro && (
              <div style={{
                position: "absolute", top: 14, right: -22,
                background: "#d4af37", color: "#000", fontSize: 10, fontWeight: 900,
                padding: "4px 32px", transform: "rotate(35deg)", letterSpacing: "0.1em",
              }}>
                POPULAR
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#d4af37", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
                Pro
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>
                $29<span style={{ fontSize: 16, color: "#555", fontWeight: 400 }}>/mo</span>
              </div>
              <div style={{ color: "#555", fontSize: 13, marginTop: 6 }}>
                For shops with multiple barbers
              </div>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {[
                "Up to 10 barber seats",
                "Everything in Solo",
                "Per-barber schedule pages",
                "Admin-controlled permissions",
                "Custom hours per barber",
                "Custom prices per barber",
                "30-day free trial",
              ].map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#aaa" }}>
                  <span style={{ color: "#d4af37", fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            {isPro ? (
              <div style={{ padding: "10px 16px", borderRadius: 10, background: "#1a1000", border: "1px solid #3a3000", color: "#d4af37", fontWeight: 700, fontSize: 14, textAlign: "center" }}>
                Current Plan
              </div>
            ) : isActive ? (
              <button onClick={handlePortal} disabled={working} style={{ ...goldButton, textAlign: "center" }}>
                {working ? "Opening..." : "Upgrade via Portal"}
              </button>
            ) : (
              <button onClick={() => handleCheckout("pro")} disabled={working} style={goldButton}>
                {working ? "Loading..." : isCanceled && hasCustomer ? "Resubscribe — Pro" : "Start Free Trial"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Past due — show portal CTA */}
      {isPastDue && (
        <div style={{ padding: "16px 20px", background: "#1a0a0a", border: "1px solid #440000", borderRadius: 12, marginBottom: 24 }}>
          <div style={{ color: "#ff7070", fontWeight: 700, marginBottom: 8 }}>Payment past due</div>
          <p style={{ color: "#888", fontSize: 13, margin: "0 0 12px" }}>
            Update your payment method to keep your {currentPlanLabel} features active.
          </p>
          <button onClick={handlePortal} disabled={working} style={goldButton}>
            {working ? "Opening..." : "Update Payment Method"}
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 16px", background: "#1a0a0a", border: "1px solid #440000", borderRadius: 10, color: "#ff7070", fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Feature comparison table */}
      <div style={{ border: "1px solid #1a1a1a", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ background: "#111", padding: "14px 20px", borderBottom: "1px solid #1a1a1a" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Plan comparison</span>
        </div>
        {[
          { feature: "Booking page",               free: "✓", solo: "✓",  pro: "✓" },
          { feature: "Unlimited bookings",          free: "✓", solo: "✓",  pro: "✓" },
          { feature: "Admin dashboard",             free: "✓", solo: "✓",  pro: "✓" },
          { feature: "Barber seats",                free: "—", solo: "1",  pro: "10" },
          { feature: "Personal schedule pages",     free: "—", solo: "✓",  pro: "✓" },
          { feature: "Custom hours per barber",     free: "—", solo: "✓",  pro: "✓" },
          { feature: "Custom prices per barber",    free: "—", solo: "✓",  pro: "✓" },
          { feature: "Priority support",            free: "—", solo: "—",  pro: "✓" },
        ].map(({ feature, free, solo, pro }) => (
          <div key={feature} style={{
            display: "grid", gridTemplateColumns: "1fr 70px 70px 70px",
            padding: "13px 20px", borderBottom: "1px solid #0d0d0d",
            fontSize: 13, alignItems: "center",
          }}>
            <span style={{ color: "#bbb" }}>{feature}</span>
            <span style={{ color: free === "✓" ? "#5cd600" : "#333", textAlign: "center", fontWeight: 700 }}>{free}</span>
            <span style={{ color: solo === "✓" || (solo !== "—") ? "#5cd600" : "#333", textAlign: "center", fontWeight: 700 }}>{solo}</span>
            <span style={{ color: pro === "✓" || (pro !== "—") ? "#d4af37" : "#333", textAlign: "center", fontWeight: 700 }}>{pro}</span>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 70px", padding: "10px 20px", background: "#0a0a0a", fontSize: 12 }}>
          <span />
          <span style={{ color: "#444", textAlign: "center", fontWeight: 600 }}>Free</span>
          <span style={{ color: "#5cd600", textAlign: "center", fontWeight: 600 }}>Solo</span>
          <span style={{ color: "#d4af37", textAlign: "center", fontWeight: 600 }}>Pro</span>
        </div>
      </div>

    </div>
  );
}

const goldBtnSm: React.CSSProperties = {
  padding: "8px 18px", borderRadius: 8, border: "none",
  background: "#d4af37", color: "#000", fontWeight: 800, fontSize: 13, cursor: "pointer",
};

const goldButton: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap",
  width: "100%",
};

const outlineGreenBtn: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  border: "1px solid #2a4a2a",
  background: "#050f05",
  color: "#5cd600",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap",
  width: "100%",
};

const secondaryButton: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  border: "1px solid #2d2d2d",
  background: "#111",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const emptyBox: React.CSSProperties = {
  border: "1px dashed #2a2a2a",
  borderRadius: 18,
  padding: 28,
  textAlign: "center",
  color: "#9a9a9a",
  background: "#070707",
};
