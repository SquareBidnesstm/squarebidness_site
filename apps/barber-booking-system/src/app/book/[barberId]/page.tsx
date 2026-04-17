"use client";

import { useEffect, useMemo, useState } from "react";
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
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
];

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function BarberBookingPage() {
  const params = useParams();
  const barberId = params.barberId as string;

  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState(getTodayDateString());
  const [loading, setLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [unavailableTimes, setUnavailableTimes] = useState<string[]>([]);
  const [availabilityError, setAvailabilityError] = useState("");

  const availableTimes = useMemo(() => {
    return times.filter((slot) => !unavailableTimes.includes(slot));
  }, [unavailableTimes]);

  useEffect(() => {
    let active = true;

    async function loadAvailability() {
      try {
        setAvailabilityLoading(true);
        setAvailabilityError("");
        setTime("");

        const res = await fetch(
          `/api/bookings/availability/?barberSlug=${encodeURIComponent(
            barberId
          )}&date=${encodeURIComponent(date)}`,
          { cache: "no-store" }
        );

        const data = await res.json();

        if (!res.ok || !data.ok) {
          if (!active) return;
          setAvailabilityError(data.error || "Could not load availability");
          setUnavailableTimes([]);
          return;
        }

        if (!active) return;
        setUnavailableTimes(data.unavailableTimes || []);
      } catch (error) {
        if (!active) return;
        setAvailabilityError(
          error instanceof Error ? error.message : "Could not load availability"
        );
        setUnavailableTimes([]);
      } finally {
        if (active) setAvailabilityLoading(false);
      }
    }

    if (barberId && date) {
      loadAvailability();
    }

    return () => {
      active = false;
    };
  }, [barberId, date]);

  async function handleBooking() {
    if (!name || !service || !time) {
      alert("Fill everything out");
      return;
    }

    if (unavailableTimes.includes(time)) {
      alert("That time is no longer available");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/bookings/create/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        barber_id: barberId,
        customer_name: name,
        service,
        time,
        appointment_date: date,
      }),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.booking?.booking_code ? `Booking confirmed: ${data.booking.booking_code}` : "Booking confirmed");
      setName("");
      setService("");
      setTime("");

      const refreshRes = await fetch(
        `/api/bookings/availability/?barberSlug=${encodeURIComponent(
          barberId
        )}&date=${encodeURIComponent(date)}`,
        { cache: "no-store" }
      );
      const refreshData = await refreshRes.json().catch(() => null);
      setUnavailableTimes(refreshData?.unavailableTimes || []);
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Error booking appointment");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "56px 24px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 900 }}>
          Booking: {barberId}
        </h1>

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

        <div style={{ marginTop: 24 }}>
          <label>Date</label>
          <input
            type="date"
            value={date}
            min={getTodayDateString()}
            onChange={(e) => setDate(e.target.value)}
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

        <div style={{ marginTop: 24 }}>
          <label>Time</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={availabilityLoading}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              background: "#111",
              border: "1px solid #333",
              color: "#fff",
            }}
          >
            <option value="">
              {availabilityLoading ? "Loading times..." : "Select time"}
            </option>
            {availableTimes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {availabilityError ? (
            <div style={{ color: "#ff9f9f", marginTop: 8, fontSize: 14 }}>
              {availabilityError}
            </div>
          ) : null}
          {unavailableTimes.length > 0 ? (
            <div style={{ color: "#999", marginTop: 8, fontSize: 14 }}>
              Unavailable: {unavailableTimes.join(", ")}
            </div>
          ) : null}
        </div>

        <button
          onClick={handleBooking}
          disabled={loading || availabilityLoading}
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
