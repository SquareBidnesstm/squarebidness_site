"use client";

import { useState } from "react";

export function FeaturedToggle({ eventId, initialFeatured }: { eventId: string; initialFeatured: boolean }) {
  const [featured, setFeatured] = useState(initialFeatured);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, action: "toggle_featured" }),
    });
    const data = await res.json();
    if (res.ok) setFeatured(data.is_featured);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        fontSize: "0.7rem", fontWeight: 900, padding: "3px 10px", borderRadius: 99,
        cursor: "pointer", border: "none", opacity: loading ? 0.5 : 1,
        background: featured ? "#422006" : "#0a0a0a",
        color: featured ? "#fb923c" : "#555",
        outline: featured ? "1px solid #92400e" : "1px solid #2a2a2d",
      }}
    >
      {featured ? "⭐ Featured" : "☆ Feature"}
    </button>
  );
}

export function RefulfillButton({ orderId, orderCode }: { orderId: string; orderCode: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [count, setCount] = useState(0);
  const [errMsg, setErrMsg] = useState("");

  async function refulfill() {
    if (!confirm(`Re-fulfill order ${orderCode}? This will issue tickets and resend the confirmation email.`)) return;
    setStatus("loading");
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, action: "refulfill" }),
    });
    const data = await res.json();
    if (res.ok) {
      setCount(data.ticketsIssued);
      setStatus("done");
    } else {
      setErrMsg(data.error ?? "Failed");
      setStatus("error");
    }
  }

  if (status === "done") return <span style={{ color: "#22c55e", fontSize: "0.75rem", fontWeight: 800 }}>✓ {count} ticket{count !== 1 ? "s" : ""} issued</span>;
  if (status === "error") return <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errMsg}</span>;

  return (
    <button
      onClick={refulfill}
      disabled={status === "loading"}
      style={{
        fontSize: "0.7rem", fontWeight: 900, padding: "4px 12px", borderRadius: 99,
        cursor: "pointer", border: "1px solid #713f12",
        background: "#1a0f00", color: "#fb923c",
        opacity: status === "loading" ? 0.5 : 1,
      }}
    >
      {status === "loading" ? "Working…" : "Re-fulfill"}
    </button>
  );
}

export function OrganizerActiveToggle({ organizerId, initialActive }: { organizerId: string; initialActive: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch("/api/admin/organizers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizerId, action: "toggle_active" }),
    });
    const data = await res.json();
    if (res.ok) setActive(data.active);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        fontSize: "0.7rem", fontWeight: 900, padding: "3px 10px", borderRadius: 99,
        cursor: "pointer", border: "none", opacity: loading ? 0.5 : 1,
        background: active ? "#0a2a0a" : "#1a0a0a",
        color: active ? "#22c55e" : "#ef4444",
        outline: active ? "1px solid #166534" : "1px solid #7f1d1d",
      }}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}
