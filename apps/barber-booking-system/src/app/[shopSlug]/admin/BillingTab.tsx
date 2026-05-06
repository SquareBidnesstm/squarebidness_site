"use client";

import { useEffect, useState } from "react";

type SubInfo = {
  plan: "free" | "pro";
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

  async function handleUpgrade() {
    setWorking(true);
    setError("");
    try {
      const res = await fetch(`/api/${shopSlug}/billing/checkout`, { method: "POST" });
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

  if (loading) {
    return <div style={emptyBox}>Loading billing info...</div>;
  }

  const isPro = sub?.plan === "pro" && sub?.status === "active";
  const isPastDue = sub?.status === "past_due";
  const isCanceled = sub?.status === "canceled";
  const hasCustomer = sub?.status !== "free" && sub?.status !== "incomplete";

  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Billing</h2>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 14 }}>
        Manage your SquareBidness subscription.
      </p>

      {/* Current plan card */}
      <div
        style={{
          border: isPro ? "1px solid #3a3000" : "1px solid #232323",
          background: isPro ? "#0f0c00" : "#0d0d0d",
          borderRadius: 20,
          padding: "24px 28px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: "#666", fontSize: 13, marginBottom: 4 }}>Current Plan</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: isPro ? "#d4af37" : "#fff" }}>
              {isPro ? "Pro" : "Free"}
            </div>
            {isPro && periodEnd && (
              <div style={{ color: "#666", fontSize: 13, marginTop: 6 }}>
                Renews {periodEnd}
              </div>
            )}
            {isPastDue && (
              <div style={{ color: "#ff7070", fontSize: 13, marginTop: 6 }}>
                ⚠ Payment past due — update your payment method to keep Pro features.
              </div>
            )}
            {isCanceled && (
              <div style={{ color: "#ff9955", fontSize: 13, marginTop: 6 }}>
                Subscription canceled. Upgrade anytime to restore Pro.
              </div>
            )}
          </div>

          <div>
            {isPro || isPastDue ? (
              <button
                onClick={handlePortal}
                disabled={working}
                style={secondaryButton}
              >
                {working ? "Opening..." : "Manage Subscription"}
              </button>
            ) : isCanceled && hasCustomer ? (
              <button
                onClick={handlePortal}
                disabled={working}
                style={goldButton}
              >
                {working ? "Opening..." : "Resubscribe"}
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={working}
                style={goldButton}
              >
                {working ? "Loading..." : "Upgrade to Pro — $29/mo"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feature comparison */}
      <div
        style={{
          border: "1px solid #1a1a1a",
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div style={{ background: "#111", padding: "14px 20px", borderBottom: "1px solid #1a1a1a" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>What&apos;s included</span>
        </div>
        {[
          { feature: "Booking pages", free: "✓", pro: "✓" },
          { feature: "Unlimited bookings", free: "✓", pro: "✓" },
          { feature: "Services management", free: "✓", pro: "✓" },
          { feature: "Admin dashboard", free: "✓", pro: "✓" },
          { feature: "SMS confirmations", free: "—", pro: "✓" },
          { feature: "Priority support", free: "—", pro: "✓" },
          { feature: "Custom branding", free: "—", pro: "Coming soon" },
        ].map(({ feature, free, pro }) => (
          <div
            key={feature}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 80px",
              padding: "14px 20px",
              borderBottom: "1px solid #111",
              fontSize: 14,
              alignItems: "center",
            }}
          >
            <span style={{ color: "#ccc" }}>{feature}</span>
            <span style={{ color: free === "✓" ? "#5cd600" : "#555", textAlign: "center", fontWeight: 700 }}>{free}</span>
            <span style={{ color: pro === "✓" ? "#d4af37" : pro === "—" ? "#555" : "#888", textAlign: "center", fontWeight: 700 }}>{pro}</span>
          </div>
        ))}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 80px",
            padding: "10px 20px",
            background: "#0a0a0a",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#555" }}></span>
          <span style={{ color: "#666", textAlign: "center", fontWeight: 600 }}>Free</span>
          <span style={{ color: "#d4af37", textAlign: "center", fontWeight: 600 }}>Pro</span>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "#1a0a0a", border: "1px solid #440000", borderRadius: 10, color: "#ff7070", fontSize: 14 }}>
          {error}
        </div>
      )}

    </div>
  );
}

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
