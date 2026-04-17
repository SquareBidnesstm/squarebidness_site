"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const services = [
  { id: "cut", name: "Haircut", price: 30 },
  { id: "beard", name: "Beard Trim", price: 15 },
  { id: "combo", name: "Cut + Beard", price: 40 },
];

const times = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
];

export default function BarberBookingPage() {
  const params = useParams();
  const barberId = params.barberId as string;

  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleBooking() {
    if (!name || !service || !time) {
      alert("Fill everything out");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/bookings/create", {
      method: "POST",
      body: JSON.stringify({
        barber_id: barberId,
        customer_name: name,
        service,
        time,
      }),
    });

    setLoading(false);

    if (res.ok) {
      alert("Booking confirmed");
      setName("");
      setService("");
      setTime("");
    } else {
      alert("Error booking appointment");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "56px 24px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 900 }}>
          Booking: {barberId}
        </h1>

        {/* Name */}
        <div style={{ marginTop: 24 }}>
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              background: "#111",
              border: "1px solid #333",
              color: "#fff",
            }}
          />
        </div>

        {/* Service */}
        <div style={{ marginTop: 24 }}>
          <label>Service</label>
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              background: "#111",
              border: "1px solid #333",
              color: "#fff",
            }}
          >
            <option value="">Select service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} - ${s.price}
              </option>
            ))}
          </select>
        </div>

        {/* Time */}
        <div style={{ marginTop: 24 }}>
          <label>Time</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              background: "#111",
              border: "1px solid #333",
              color: "#fff",
            }}
          >
            <option value="">Select time</option>
            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleBooking}
          disabled={loading}
          style={{
            marginTop: 30,
            width: "100%",
            padding: 14,
            background: "#d4af37",
            color: "#000",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Booking..." : "Confirm Booking"}
        </button>
      </section>
    </main>
  );
}
