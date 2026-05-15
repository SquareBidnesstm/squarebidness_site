"use client";

import { useState, useEffect } from "react";

type Barber = { id: string; name: string; display_name: string | null; active: boolean };
type Service = { id: string; name: string; price: number; duration_minutes: number; active: boolean };

interface Props {
  shopSlug: string;
  onClose: () => void;
  onCreated: (booking: { booking_code: string; customer_name: string; barber: string; service: string }) => void;
}

export default function WalkInModal({ shopSlug, onClose, onCreated }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  useEffect(() => {
    async function load() {
      const [barbersRes, servicesRes] = await Promise.all([
        fetch(`/api/${shopSlug}/admin/barbers`),
        fetch(`/api/${shopSlug}/admin/services`),
      ]);
      const barbersData = await barbersRes.json();
      const servicesData = await servicesRes.json();
      const activeBarbers = (barbersData.barbers ?? []).filter((b: Barber) => b.active);
      const activeServices = (servicesData.services ?? []).filter((s: Service) => s.active);
      setBarbers(activeBarbers);
      setServices(activeServices);
      if (activeBarbers.length > 0) setBarberId(activeBarbers[0].id);
      if (activeServices.length > 0) setServiceId(activeServices[0].id);
      setLoading(false);
    }
    load();
  }, [shopSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barberId || !serviceId) { setError("Select a barber and service."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/${shopSlug}/admin/walkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barber_id: barberId, service_id: serviceId, customer_name: customerName, customer_phone: customerPhone, client_notes: clientNotes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? "Failed to create walk-in"); return; }
      onCreated({ booking_code: data.booking.booking_code, customer_name: data.booking.customer_name, barber: data.barber, service: data.service });
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0d0d0d", border: "1px solid #2d2d2d", borderRadius: 24, padding: 32, width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Walk-In</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {loading ? (
          <p style={{ color: "#888" }}>Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={labelStyle}>Barber *</label>
              <select value={barberId} onChange={e => setBarberId(e.target.value)} required style={inputStyle}>
                {barbers.map(b => (
                  <option key={b.id} value={b.id}>{b.display_name || b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Service *</label>
              <select value={serviceId} onChange={e => setServiceId(e.target.value)} required style={inputStyle}>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — ${Number(s.price).toFixed(2)}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Walk-in"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Phone (optional — for SMS)</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="(555) 555-5555"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                value={clientNotes}
                onChange={e => setClientNotes(e.target.value)}
                placeholder="Any special requests or notes…"
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: 14, margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="button" onClick={onClose} style={secondaryBtn}>Cancel</button>
              <button type="submit" disabled={submitting} style={goldBtn}>
                {submitting ? "Checking in…" : "Check In Now"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #2d2d2d", background: "#070707", color: "#fff", fontSize: 15, boxSizing: "border-box" };
const goldBtn: React.CSSProperties = { flex: 1, padding: "14px 20px", borderRadius: 12, border: "none", background: "#d4af37", color: "#000", fontWeight: 800, cursor: "pointer", fontSize: 15 };
const secondaryBtn: React.CSSProperties = { padding: "14px 20px", borderRadius: 12, border: "1px solid #2d2d2d", background: "#111", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15 };
