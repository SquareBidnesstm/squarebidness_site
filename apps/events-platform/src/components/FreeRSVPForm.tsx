"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FreeRSVPForm({
  eventId,
  tiers,
}: {
  eventId: string;
  tiers: { id: string; name: string; description?: string; quantity: number; quantity_sold: number }[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const available = tiers.filter((t) => t.quantity - t.quantity_sold > 0);
  const totalSelected = Object.values(qty).reduce((s, n) => s + n, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    if (totalSelected === 0) { setError("Select at least 1 spot."); return; }

    setLoading(true);
    setError(null);

    // Submit one tier at a time (pick first selected)
    const selected = Object.entries(qty).find(([, q]) => q > 0);
    if (!selected) { setLoading(false); return; }
    const [tierId, q] = selected;

    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, tierId, name: name.trim(), email: email.trim(), phone: phone.trim(), qty: q }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      router.push(`/orders/${data.orderId}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      {error && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: 12, padding: "8px 12px", background: "#1a0a0a", borderRadius: 8, border: "1px solid #7f1d1d" }}>
          {error}
        </p>
      )}
      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        {available.map((tier) => {
          const spots = tier.quantity - tier.quantity_sold;
          return (
            <div key={tier.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor={`qty_${tier.id}`} style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                {tier.name}
                <span style={{ color: "#22c55e", marginLeft: 8, fontWeight: 900 }}>Free</span>
              </label>
              <select
                id={`qty_${tier.id}`}
                className="input"
                style={{ width: 80 }}
                value={qty[tier.id] ?? 0}
                onChange={(e) => setQty((prev) => ({ ...prev, [tier.id]: Number(e.target.value) }))}
              >
                {Array.from({ length: Math.min(spots, 10) + 1 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          );
        })}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          className="input"
          required
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Your Email"
          className="input"
          required
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          placeholder="Phone (optional)"
          className="input"
        />
      </div>
      <button
        type="submit"
        disabled={loading || totalSelected === 0 || !name.trim() || !email.trim()}
        className="btn btn--primary btn--wide"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {loading ? "Reserving…" : `RSVP Free${totalSelected > 0 ? ` (${totalSelected})` : ""}`}
      </button>
      <p style={{ color: "#555", fontSize: "0.78rem", textAlign: "center", marginTop: 10 }}>
        Free event · No payment required
      </p>
    </form>
  );
}
