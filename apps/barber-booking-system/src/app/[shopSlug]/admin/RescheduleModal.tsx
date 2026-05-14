"use client";

import { useState, useEffect } from "react";

interface Booking {
  id: string;
  customer_name: string;
  booking_code: string;
  barbers: { slug: string; name: string; display_name: string | null } | null;
  services: { slug: string; name: string; duration_minutes: number } | null;
}

interface Props {
  shopSlug: string;
  booking: Booking;
  onClose: () => void;
  onRescheduled: (bookingId: string, newDate: string, newStartsAt: string) => void;
}

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function RescheduleModal({ shopSlug, booking, onClose, onRescheduled }: Props) {
  const [date, setDate] = useState(getTodayString());
  const [slots, setSlots] = useState<{ time: string; label: string }[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);

  const barberSlug = booking.barbers?.slug ?? "";
  const duration = booking.services?.duration_minutes ?? 30;

  useEffect(() => {
    if (!barberSlug || !date) return;
    setLoadingSlots(true);
    setSelectedTime("");
    setError("");
    setClosed(false);

    fetch(`/api/${shopSlug}/availability?barber=${barberSlug}&date=${date}&duration=${duration}&excludeBooking=${booking.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.closed) { setClosed(true); setSlots([]); }
        else { setSlots(data.slots ?? []); }
      })
      .catch(() => setError("Could not load slots"))
      .finally(() => setLoadingSlots(false));
  }, [date, barberSlug, duration, shopSlug, booking.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTime) { setError("Select a time slot"); return; }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/${shopSlug}/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reschedule: { date, time: selectedTime } }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? "Reschedule failed"); return; }
      onRescheduled(booking.id, data.booking.appointment_date, data.booking.starts_at);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0d0d0d", border: "1px solid #2d2d2d", borderRadius: 24, padding: 32, width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Reschedule</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>
          {booking.customer_name} · {booking.services?.name ?? ""} · {booking.barbers?.display_name || booking.barbers?.name}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={labelStyle}>New Date *</label>
            <input
              type="date"
              value={date}
              min={getTodayString()}
              onChange={e => setDate(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {loadingSlots && <p style={{ color: "#888", fontSize: 14 }}>Loading available slots…</p>}
          {closed && !loadingSlots && <p style={{ color: "#ef4444", fontSize: 14 }}>Shop is closed on this day.</p>}

          {!loadingSlots && !closed && slots.length > 0 && (
            <div>
              <label style={labelStyle}>New Time *</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {slots.map(slot => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => setSelectedTime(slot.time)}
                    style={{
                      padding: "10px 8px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                      border: selectedTime === slot.time ? "none" : "1px solid #2d2d2d",
                      background: selectedTime === slot.time ? "#d4af37" : "#111",
                      color: selectedTime === slot.time ? "#000" : "#fff",
                    }}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loadingSlots && !closed && slots.length === 0 && date && (
            <p style={{ color: "#888", fontSize: 14 }}>No available slots on this date.</p>
          )}

          {error && <p style={{ color: "#ef4444", fontSize: 14, margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={secondaryBtn}>Cancel</button>
            <button type="submit" disabled={submitting || !selectedTime} style={{ ...goldBtn, opacity: !selectedTime ? 0.5 : 1 }}>
              {submitting ? "Rescheduling…" : "Confirm Reschedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #2d2d2d", background: "#070707", color: "#fff", fontSize: 15, boxSizing: "border-box" };
const goldBtn: React.CSSProperties = { flex: 1, padding: "14px 20px", borderRadius: 12, border: "none", background: "#d4af37", color: "#000", fontWeight: 800, cursor: "pointer", fontSize: 15 };
const secondaryBtn: React.CSSProperties = { padding: "14px 20px", borderRadius: 12, border: "1px solid #2d2d2d", background: "#111", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15 };
