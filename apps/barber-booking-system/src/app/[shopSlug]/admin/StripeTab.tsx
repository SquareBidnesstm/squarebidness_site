"use client";

import { useEffect, useState } from "react";

type BarberStripeRow = {
  id: string;
  name: string;
  display_name: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
};

function StatusPill({ accountId, complete }: { accountId: string | null; complete: boolean }) {
  if (!accountId) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "#1a1a1a", color: "#666", letterSpacing: "0.04em" }}>
        NOT CONNECTED
      </span>
    );
  }
  if (complete) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "#0a2a00", color: "#44cc44", letterSpacing: "0.04em" }}>
        ACTIVE
      </span>
    );
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "#1a1000", color: "#d4af37", letterSpacing: "0.04em" }}>
      PENDING
    </span>
  );
}

export default function StripeTab({ shopSlug }: { shopSlug: string }) {
  const [barbers, setBarbers] = useState<BarberStripeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/${shopSlug}/admin/stripe/status`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setBarbers(d.barbers); })
      .finally(() => setLoading(false));
  }, [shopSlug]);

  if (loading) return null;

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
          Each barber connects their own Stripe account so deposits route directly to them.
          Stripe is required before a barber can accept booking deposits.
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {barbers.map((barber) => (
          <div
            key={barber.id}
            style={{
              border: "1px solid #1f1f1f",
              borderRadius: 12,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>
                {barber.display_name || barber.name}
              </div>
              <StatusPill accountId={barber.stripe_account_id} complete={barber.stripe_onboarding_complete} />
            </div>

            {!barber.stripe_onboarding_complete && (
              <a
                href={`/api/${shopSlug}/admin/stripe/connect?barberId=${barber.id}`}
                style={{
                  flexShrink: 0,
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#d4af37",
                  color: "#000",
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {barber.stripe_account_id ? "Continue Setup →" : "Connect →"}
              </a>
            )}
          </div>
        ))}

        {barbers.length === 0 && (
          <p style={{ color: "#555", fontSize: 13 }}>No active barbers found.</p>
        )}
      </div>
    </div>
  );
}
