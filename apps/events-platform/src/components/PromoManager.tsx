"use client";
import { useState } from "react";

interface Promo {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  active: boolean;
  events?: { title: string } | null;
}

interface Event { id: string; title: string; }

export default function PromoManager({ promos: initial, events }: { promos: Promo[]; events: Event[] }) {
  const [promos, setPromos] = useState(initial);
  const [form, setForm] = useState({ code: "", discount_type: "percent", discount_value: "", max_uses: "", expires_at: "", event_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/organizer/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed"); setSaving(false); return; }
    setPromos([data.promo, ...promos]);
    setForm({ code: "", discount_type: "percent", discount_value: "", max_uses: "", expires_at: "", event_id: "" });
    setSaving(false);
  }

  async function deletePromo(id: string) {
    await fetch("/api/organizer/promos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promoId: id }) });
    setPromos(promos.filter(p => p.id !== id));
  }

  return (
    <div>
      {/* Create Form */}
      <div className="card" style={{ marginBottom: 28 }}>
        <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Create Promo Code</p>
        <form onSubmit={createPromo} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="label">Code</label>
              <input className="input" placeholder="SUMMER20" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
            </div>
            <div className="form-group">
              <label className="label">Discount Type</label>
              <select className="input" value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="label">{form.discount_type === "percent" ? "Discount %" : "Discount $"}</label>
              <input className="input" type="number" min="1" max={form.discount_type === "percent" ? "100" : undefined} placeholder={form.discount_type === "percent" ? "20" : "10.00"} value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="label">Max Uses (optional)</label>
              <input className="input" type="number" min="1" placeholder="Unlimited" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="label">Expires (optional)</label>
              <input className="input" type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Event (optional)</label>
              <select className="input" value={form.event_id} onChange={e => setForm({ ...form, event_id: e.target.value })}>
                <option value="">All Events</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>{error}</p>}
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? "Creating…" : "Create Code"}</button>
        </form>
      </div>

      {/* Promo List */}
      {promos.length === 0 ? (
        <p style={{ color: "#555", fontSize: "0.9rem" }}>No promo codes yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {promos.map(p => (
            <div key={p.id} style={{ background: "#050505", border: "1px solid #1d1d1f", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "0.95rem" }}>{p.code}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 900, padding: "2px 8px", borderRadius: 99, background: "#0a2a0a", color: "#22c55e", border: "1px solid #166534" }}>
                    {p.discount_type === "percent" ? `${p.discount_value}% off` : `$${p.discount_value} off`}
                  </span>
                  {!p.active && <span style={{ fontSize: "0.72rem", color: "#ef4444" }}>Inactive</span>}
                </div>
                <p style={{ color: "#555", fontSize: "0.78rem" }}>
                  {p.uses} uses{p.max_uses ? ` / ${p.max_uses}` : ""} · {p.events?.title ?? "All Events"}{p.expires_at ? ` · Expires ${new Date(p.expires_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <button onClick={() => deletePromo(p.id)} style={{ background: "transparent", border: "1px solid #1d1d1f", borderRadius: 8, color: "#ef4444", fontSize: "0.8rem", padding: "6px 12px", cursor: "pointer" }}>
                Disable
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
