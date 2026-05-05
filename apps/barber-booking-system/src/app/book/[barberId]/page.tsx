"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const services = [
  { id: "haircut", name: "Haircut", price: 35 },
  { id: "haircut-beard", name: "Haircut + Beard", price: 45 },
  { id: "kids-cut", name: "Kids Cut", price: 25 },
  { id: "enhancements", name: "Cut + Enhancements", price: 50 },
  { id: "vip", name: "VIP Appointment", price: 75 },
];

const times = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
];

function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function BarberBookingPage() {
  const params = useParams();
  const barberId = params.barberId as string;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(() => getTodayDateString());
  const [service, setService] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleBooking() {
    if (!name || !phone || !date || !service || !time) {
      alert("Name, phone, date, service, and time are required.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: barberId,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        service,
        time,
        date,
      }),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      alert(
        `Booking confirmed! Code: ${data.booking?.booking_code || "—"}\nCheck your phone for a confirmation text.`
      );
      setName("");
      setPhone("");
      setEmail("");
      setDate(getTodayDateString());
      setService("");
      setTime("");
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Error booking appointment");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "56px 24px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 4 }}>
          Book Your Appointment
        </h1>
        <p style={{ color: "#888", marginBottom: 32 }}>{barberId}</p>

        <div style={{ display: "grid", gap: 20 }}>
          <Field label="Full Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={fieldStyle}
            />
          </Field>

          <Field label="Phone" required>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              style={fieldStyle}
            />
          </Field>

          <Field label="Email" hint="optional">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              style={fieldStyle}
            />
          </Field>

          <Field label="Date" required>
            <input
              type="date"
              value={date}
              min={getTodayDateString()}
              onChange={(e) => setDate(e.target.value)}
              style={fieldStyle}
            />
          </Field>

          <Field label="Service" required>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              style={fieldStyle}
            >
              <option value="">Select service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — ${s.price}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Time" required>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={fieldStyle}
            >
              <option value="">Select time</option>
              {times.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <button
          onClick={handleBooking}
          disabled={loading}
          style={{
            marginTop: 30,
            width: "100%",
            padding: 16,
            background: loading ? "#a88d20" : "#d4af37",
            color: "#000",
            fontWeight: 800,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            borderRadius: 10,
            fontSize: 16,
          }}
        >
          {loading ? "Booking..." : "Confirm Booking"}
        </button>

        <p style={{ color: "#555", fontSize: 13, marginTop: 14, textAlign: "center" }}>
          You'll receive a text confirmation after booking.
        </p>
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <label style={{ fontSize: 14, fontWeight: 600 }}>{label}</label>
        {required && (
          <span style={{ color: "#d4af37", fontSize: 12 }}>required</span>
        )}
        {hint && <span style={{ color: "#555", fontSize: 12 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "#111",
  border: "1px solid #2a2a2a",
  color: "#fff",
  borderRadius: 8,
  fontSize: 15,
  outline: "none",
};
