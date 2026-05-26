"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type BookingInfo = {
  status: string;
  starts_at: string;
  appointment_date: string;
  customer_name: string;
  shop_name: string;
  shop_slug: string;
  shop_timezone: string;
  barber_name: string;
  barber_slug: string;
  service_name: string;
  service_slug: string;
  service_duration: number;
};

type Slot = { time: string; label: string };

function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function ReschedulePage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState(() => getTodayDateString());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ new_starts_at: string } | null>(null);

  useEffect(() => {
    fetch(`/api/reschedule/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setInfo(d.booking);
        else setError(d.error ?? "Invalid reschedule link");
      })
      .catch(() => setError("Could not load booking"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!info || !date) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedTime("");
    fetch(`/api/${info.shop_slug}/availability?barber=${info.barber_slug}&date=${date}&duration=${info.service_duration}&excludeBooking=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setSlots(d.slots ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [info, date, token]);

  async function handleSubmit() {
    if (!selectedTime || !info) return;
    setSubmitting(true);
    setError("");
    const slotLabel = slots.find((s) => s.time === selectedTime)?.label ?? selectedTime;
    const res = await fetch(`/api/reschedule/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time: slotLabel }),
    });
    const d = await res.json();
    if (d.ok) setDone(d);
    else setError(d.error ?? "Could not reschedule. Try another time.");
    setSubmitting(false);
  }

  if (loading) return <Screen><p style={{ color: "#888" }}>Loading…</p></Screen>;
  if (error && !info) return <Screen><p style={{ color: "#ef4444", fontWeight: 700 }}>{error}</p></Screen>;
  if (!info) return null;

  if (done) {
    const newDate = new Date(done.new_starts_at).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
    const newTime = new Date(done.new_starts_at).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: info.shop_timezone,
    });
    return (
      <Screen>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Rescheduled!</h2>
        <p style={{ color: "#aaa", marginBottom: 4 }}>
          {info.service_name} with {info.barber_name}
        </p>
        <p style={{ color: "#d4af37", fontWeight: 700, fontSize: 18 }}>
          {newDate} at {newTime}
        </p>
        <p style={{ color: "#555", fontSize: 13, marginTop: 12 }}>
          A confirmation text has been sent.
        </p>
      </Screen>
    );
  }

  const currentDate = new Date(info.starts_at).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const currentTime = new Date(info.starts_at).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: info.shop_timezone,
  });

  return (
    <Screen>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Reschedule Appointment</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>{info.shop_name}</p>

      {/* Current appointment */}
      <div style={{ background: "#0d0d0d", border: "1px solid #1d1d1d", borderRadius: 14, padding: "16px 20px", marginBottom: 24, textAlign: "left", width: "100%" }}>
        <p style={{ color: "#555", fontSize: 12, marginBottom: 4 }}>CURRENT APPOINTMENT</p>
        <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{info.customer_name}</p>
        <p style={{ color: "#aaa", fontSize: 13, marginBottom: 4 }}>{info.service_name} with {info.barber_name}</p>
        <p style={{ color: "#d4af37", fontWeight: 700 }}>{currentDate} at {currentTime}</p>
      </div>

      {/* Date picker */}
      <div style={{ width: "100%", marginBottom: 16, textAlign: "left" }}>
        <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 6 }}>New Date</label>
        <input
          type="date"
          value={date}
          min={getTodayDateString()}
          onChange={(e) => setDate(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            border: "1px solid #2d2d2d", background: "#111", color: "#fff",
            fontSize: 14, boxSizing: "border-box",
          }}
        />
      </div>

      {/* Time slots */}
      <div style={{ width: "100%", marginBottom: 20, textAlign: "left" }}>
        <label style={{ display: "block", fontSize: 13, color: "#888", marginBottom: 8 }}>New Time</label>
        {slotsLoading ? (
          <p style={{ color: "#555", fontSize: 13 }}>Loading available times…</p>
        ) : slots.length === 0 ? (
          <p style={{ color: "#555", fontSize: 13 }}>No available times on this date.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {slots.map((s) => (
              <button
                key={s.time}
                onClick={() => setSelectedTime(s.time)}
                style={{
                  padding: "10px 6px", borderRadius: 8, border: "1px solid",
                  borderColor: selectedTime === s.time ? "#d4af37" : "#2d2d2d",
                  background: selectedTime === s.time ? "#1a1200" : "#111",
                  color: selectedTime === s.time ? "#d4af37" : "#aaa",
                  fontWeight: selectedTime === s.time ? 800 : 400,
                  fontSize: 13, cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p style={{ color: "#ff6060", fontSize: 13, marginBottom: 12, width: "100%", textAlign: "left" }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!selectedTime || submitting}
        style={{
          width: "100%", padding: 14, borderRadius: 12, border: "none",
          background: !selectedTime || submitting ? "#222" : "#d4af37",
          color: !selectedTime || submitting ? "#555" : "#000",
          fontWeight: 800, fontSize: 15,
          cursor: !selectedTime || submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Rescheduling…" : "Confirm New Time"}
      </button>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: "100vh", background: "#050505", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>{children}</div>
    </main>
  );
}
