"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefundButton({
  orderId,
  orderCode,
  buyerName,
  total,
}: {
  orderId: string;
  orderCode: string;
  buyerName: string;
  total: number;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRefund() {
    const confirmed = window.confirm(
      `Refund order ${orderCode} for ${buyerName}?\n\n$${total.toFixed(2)} will be returned to their card.\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch("/api/organizer/orders/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Refund failed: ${data.error ?? "Unknown error"}`);
      } else {
        router.refresh();
      }
    } catch {
      alert("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRefund}
      disabled={loading}
      style={{
        background: "transparent",
        border: "1px solid #7f1d1d",
        color: "#ef4444",
        borderRadius: 8,
        padding: "4px 12px",
        fontSize: "0.8rem",
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {loading ? "Refunding…" : "Refund"}
    </button>
  );
}
