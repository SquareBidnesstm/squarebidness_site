"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type BookingInfo = {
  status: string;
  payment_status: string;
  starts_at: string;
  customer_name: string;
  shop_name: string;
  barber_name: string;
  service_name: string;
  deposit_amount: number | null;
  will_refund: boolean;
  hours_until: number;
};

export default function CancelPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<{ refunded: boolean; refundFailed: boolean; refundAmount: number; forfeitReason: string | null } | null>(null);

  useEffect(() => {
    fetch(`/api/cancel/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setInfo(d.booking);
        else setError(d.error ?? "Invalid cancel link");
      })
      .catch(() => setError("Could not load booking"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCancel() {
    setCancelling(true);
    const res = await fetch(`/api/cancel/${token}`, { method: "POST" });
    const d = await res.json();
    if (d.ok) setResult(d);
    else setError(d.error ?? "Cancellation failed");
    setCancelling(false);
  }

  if (loading) return <Screen><p style={{ color: "#888" }}>Loading…</p></Screen>;
  if (error) return <Screen><p style={{ color: "#ef4444", fontWeight: 700 }}>{error}</p></Screen>;
  if (!info) return null;

  if (info.status === "cancelled") {
    return (
      <Screen>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Already Cancelled</h2>
        <p style={{ color: "#888" }}>This appointment was already cancelled.</p>
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✂️</div>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Appointment Cancelled</h2>
        {result.refunded && result.refundAmount > 0 ? (
          <p style={{ color: "#5cd600" }}>
            Your ${result.refundAmount.toFixed(2)} deposit has been refunded. Allow 5–10 business days.
          </p>
        ) : result.refundFailed ? (
          <p style={{ color: "#ff9955" }}>
            Your appointment was cancelled, but there was an issue processing your refund. The shop has been notified and will contact you shortly.
          </p>
        ) : result.forfeitReason ? (
          <p style={{ color: "#ff9955" }}>{result.forfeitReason}</p>
        ) : (
          <p style={{ color: "#888" }}>Your appointment has been cancelled.</p>
        )}
      </Screen>
    );
  }

  const apptDate = new Date(info.starts_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const apptTime = new Date(info.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <Screen>
      <div style={{ fontSize: 40, marginBottom: 16 }}>✂️</div>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Cancel Appointment</h1>
      <p style={{ color: "#888", marginBottom: 28 }}>{info.shop_name}</p>

      <div style={{ background: "#0d0d0d", border: "1px solid #1d1d1d", borderRadius: 14, padding: "20px 24px", marginBottom: 24, textAlign: "left", width: "100%" }}>
        <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{info.customer_name}</p>
        <p style={{ color: "#aaa", marginBottom: 4 }}>{info.service_name} with {info.barber_name}</p>
        <p style={{ color: "#d4af37", fontWeight: 700 }}>{apptDate} at {apptTime}</p>
      </div>

      {info.deposit_amount && (
        <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 20, border: `1px solid ${info.will_refund ? "#1e4400" : "#3d1a00"}`, background: info.will_refund ? "#0a1a00" : "#1a0d00" }}>
          <p style={{ fontWeight: 800, color: info.will_refund ? "#5cd600" : "#ff9955", marginBottom: 4 }}>
            {info.will_refund ? `$${info.deposit_amount.toFixed(2)} deposit will be refunded` : `$${info.deposit_amount.toFixed(2)} deposit will be forfeited`}
          </p>
          <p style={{ color: "#666", fontSize: 13 }}>
            {info.will_refund
              ? "Cancellations more than 24 hours in advance receive a full deposit refund."
              : "Cancellations within 24 hours of the appointment forfeit the deposit."}
          </p>
        </div>
      )}

      <button
        onClick={handleCancel}
        disabled={cancelling}
        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1px solid #440000", background: "#1a0000", color: "#ff7070", fontWeight: 800, fontSize: 15, cursor: cancelling ? "not-allowed" : "pointer", opacity: cancelling ? 0.6 : 1 }}
      >
        {cancelling ? "Cancelling…" : "Yes, Cancel My Appointment"}
      </button>
      <Link href="/" style={{ display: "block", marginTop: 14, color: "#555", fontSize: 14, textAlign: "center" }}>
        Keep my appointment
      </Link>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>{children}</div>
    </main>
  );
}
