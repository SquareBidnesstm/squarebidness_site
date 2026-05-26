"use client";

import { useEffect, useState } from "react";

export default function DepositsTab({ shopSlug }: { shopSlug: string }) {
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("10");
  const [type, setType] = useState<"fixed" | "percent">("fixed");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/${shopSlug}/admin/deposit-settings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setEnabled(d.settings.enabled);
          setAmount(String(d.settings.amount));
          setType(d.settings.type);
        }
      })
      .finally(() => setLoading(false));
  }, [shopSlug]);

  async function save() {
    setSaving(true);
    await fetch(`/api/${shopSlug}/admin/deposit-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, amount: parseFloat(amount) || 0, type }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return null;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ border: "1px solid #1a1a1a", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ background: "#111", padding: "14px 20px", borderBottom: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Deposit Settings</span>
          <span style={{ color: "#555", fontSize: 12 }}>Require a deposit at booking</span>
        </div>
        <div style={{ padding: "20px 20px", display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              style={{
                width: 44, height: 24, borderRadius: 999, border: "none",
                background: enabled ? "#d4af37" : "#333", position: "relative", cursor: "pointer",
              }}
            >
              <span style={{
                position: "absolute", top: 4, left: enabled ? 23 : 4,
                width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.15s",
              }} />
            </button>
            <span style={{ fontSize: 14, color: enabled ? "#fff" : "#666" }}>
              {enabled ? "Deposits enabled" : "Deposits disabled"}
            </span>
          </div>

          {enabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 6, fontWeight: 600 }}>Amount</div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                  style={{ width: "100%", padding: "10px 12px", background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 6, fontWeight: 600 }}>Type</div>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "fixed" | "percent")}
                  style={{ width: "100%", padding: "10px 12px", background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 8, fontSize: 15, outline: "none" }}
                >
                  <option value="fixed">Fixed ($)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "8px 18px", borderRadius: 8, border: "none",
                background: "#d4af37", color: "#000", fontWeight: 800, fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : saved ? "✓ Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
