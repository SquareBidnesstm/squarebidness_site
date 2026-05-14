"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tier = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  quantity: number;
  quantity_sold: number;
  groupMinQty?: number | null;
  groupDiscountPct?: number | null;
};

function TierRow({ tier }: { tier: Tier }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tier.name);
  const [description, setDescription] = useState(tier.description ?? "");
  const [price, setPrice] = useState(String(tier.price));
  const [quantity, setQuantity] = useState(String(tier.quantity));
  const [groupMinQty, setGroupMinQty] = useState(tier.groupMinQty ? String(tier.groupMinQty) : "");
  const [groupDiscountPct, setGroupDiscountPct] = useState(tier.groupDiscountPct ? String(tier.groupDiscountPct) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const canEditPrice = tier.quantity_sold === 0;

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organizer/events/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: tier.id, name, description, price, quantity, groupMinQty: groupMinQty || null, groupDiscountPct: groupDiscountPct || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "#0a0a0a", border: "1px solid #2a2a2d", borderRadius: 8,
    padding: "6px 10px", color: "#fff", fontSize: "0.85rem", width: "100%",
  };

  return (
    <div style={{ padding: "12px 14px", background: "#050505", borderRadius: 10, border: "1px solid #1d1d1f" }}>
      {!editing ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontWeight: 800 }}>{tier.name}</p>
            {tier.description && <p style={{ color: "#555", fontSize: "0.8rem", marginTop: 2 }}>{tier.description}</p>}
            {tier.groupMinQty && tier.groupDiscountPct && (
              <p style={{ color: "#facc15", fontSize: "0.75rem", marginTop: 2 }}>Buy {tier.groupMinQty}+ save {tier.groupDiscountPct}%</p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontWeight: 900 }}>{Number(tier.price) === 0 ? "Free" : `$${Number(tier.price).toFixed(2)}`}</p>
              <p style={{ color: "#a1a1aa", fontSize: "0.8rem" }}>{tier.quantity_sold} / {tier.quantity} sold</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              style={{ background: "transparent", border: "1px solid #2a2a2d", color: "#a1a1aa", borderRadius: 8, padding: "4px 12px", fontSize: "0.8rem", cursor: "pointer" }}
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {error && <p style={{ color: "#f87171", fontSize: "0.8rem" }}>{error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <p style={{ color: "#555", fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Name</p>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <p style={{ color: "#555", fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Price {!canEditPrice && <span style={{ color: "#333" }}>(locked — tickets sold)</span>}
              </p>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                disabled={!canEditPrice}
                style={{ ...inputStyle, opacity: canEditPrice ? 1 : 0.4 }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10 }}>
            <div>
              <p style={{ color: "#555", fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Description</p>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" style={inputStyle} />
            </div>
            <div>
              <p style={{ color: "#555", fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Capacity</p>
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min={tier.quantity_sold} style={inputStyle} />
            </div>
          </div>
          <p style={{ color: "#333", fontSize: "0.75rem" }}>Min capacity: {tier.quantity_sold} (already sold)</p>
          {Number(tier.price) > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <p style={{ color: "#555", fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Group min qty</p>
                <input value={groupMinQty} onChange={e => setGroupMinQty(e.target.value)} type="number" min="2" placeholder="e.g. 4" style={inputStyle} />
              </div>
              <div>
                <p style={{ color: "#555", fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Discount %</p>
                <input value={groupDiscountPct} onChange={e => setGroupDiscountPct(e.target.value)} type="number" min="1" max="99" step="0.01" placeholder="e.g. 10" style={inputStyle} />
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={loading || !name.trim()}
              style={{ flex: 1, background: "#22c55e", border: "none", color: "#000", borderRadius: 8, padding: "8px 0", fontWeight: 900, fontSize: "0.85rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null); }}
              style={{ background: "transparent", border: "1px solid #2a2a2d", color: "#a1a1aa", borderRadius: 8, padding: "8px 16px", fontSize: "0.85rem", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TierEditor({ tiers }: { tiers: Tier[] }) {
  if (!tiers.length) return <p style={{ color: "#555" }}>No ticket tiers yet.</p>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tiers.map((tier) => <TierRow key={tier.id} tier={tier} />)}
    </div>
  );
}
