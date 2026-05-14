"use client";
import { useState } from "react";

export default function CancelEventButton({
  eventId,
  eventTitle,
  paidOrderCount,
}: {
  eventId: string;
  eventTitle: string;
  paidOrderCount: number;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ refundedCount: number; failedCount: number } | null>(null);
  const [errMsg, setErrMsg] = useState("");

  async function cancel() {
    const warning = paidOrderCount > 0
      ? `Cancel "${eventTitle}"?\n\nThis will refund all ${paidOrderCount} paid order${paidOrderCount !== 1 ? "s" : ""} and email every buyer. This cannot be undone.`
      : `Cancel "${eventTitle}"?\n\nThis cannot be undone.`;

    if (!confirm(warning)) return;

    setStatus("loading");
    const res = await fetch("/api/organizer/events/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult({ refundedCount: data.refundedCount, failedCount: data.failedCount });
      setStatus("done");
    } else {
      setErrMsg(data.error ?? "Failed to cancel");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div style={{ display: "inline-block", padding: "8px 14px", background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 10, fontSize: "0.85rem" }}>
        <span style={{ color: "#ef4444", fontWeight: 800 }}>Event cancelled.</span>
        {result && result.refundedCount > 0 && (
          <span style={{ color: "#a1a1aa", marginLeft: 8 }}>
            {result.refundedCount} refund{result.refundedCount !== 1 ? "s" : ""} issued
            {result.failedCount > 0 ? `, ${result.failedCount} failed` : ""}.
          </span>
        )}
      </div>
    );
  }

  if (status === "error") {
    return <span style={{ color: "#ef4444", fontSize: "0.85rem" }}>{errMsg}</span>;
  }

  return (
    <button
      onClick={cancel}
      disabled={status === "loading"}
      style={{
        background: "transparent",
        border: "1px solid #7f1d1d",
        borderRadius: 10,
        color: "#ef4444",
        fontSize: "0.85rem",
        fontWeight: 800,
        padding: "0 16px",
        height: 40,
        cursor: "pointer",
        opacity: status === "loading" ? 0.5 : 1,
      }}
    >
      {status === "loading" ? "Cancelling…" : "🚫 Cancel Event"}
    </button>
  );
}
