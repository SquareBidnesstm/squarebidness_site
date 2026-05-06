"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type ServiceOption = { id: string; name: string; price: number; duration_minutes: number };

type TimeSlot = { time: string; label: string };

type Props = {
  shopSlug: string;
  shopName: string;
  barberSlug: string;
  barberName: string;
  services: ServiceOption[];
};

export default function BookingForm({ shopSlug, shopName, barberSlug, barberName, services }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(() => getTodayDateString());
  const [service, setService] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{ code: string } | null>(null);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [shopClosed, setShopClosed] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);

  const selectedService = services.find((s) => s.id === service);

  // Fetch available slots whenever date or service changes
  useEffect(() => {
    if (!date || !selectedService) {
      setSlots([]);
      setTime("");
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setShopClosed(false);
    setTime("");

    fetch(
      `/api/${shopSlug}/availability?barber=${barberSlug}&date=${date}&duration=${selectedService.duration_minutes}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) {
          setSlots(data.slots ?? []);
          setShopClosed(data.closed ?? false);
        } else {
          setSlots([]);
        }
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => { cancelled = true; };
  }, [date, service, selectedService, shopSlug, barberSlug]);

  async function handleBooking() {
    if (!name || !phone || !date || !service || !time) {
      setError("Name, phone, date, service, and time are required.");
      return;
    }

    setLoading(true);
    setError("");

    // Check if deposit is required
    const depositRes = await fetch(`/api/${shopSlug}/admin/deposit-settings`).catch(() => null);
    if (depositRes?.ok) {
      const depositData = await depositRes.json().catch(() => null);
      if (depositData?.settings?.enabled) {
        const dep = await fetch(`/api/${shopSlug}/booking/deposit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barber_id: barberSlug, customer_name: name, customer_phone: phone,
            customer_email: email || null, service,
            time: slots.find((s) => s.time === time)?.label ?? time, date,
          }),
        });
        const depData = await dep.json().catch(() => null);
        if (dep.ok && depData?.url) {
          setDepositAmount(depData.depositAmount);
          window.location.href = depData.url;
          return;
        }
      }
    }

    const res = await fetch(`/api/${shopSlug}/bookings/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: barberSlug,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        service,
        time: slots.find((s) => s.time === time)?.label ?? time,
        date,
      }),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      setConfirmed({ code: data.booking?.booking_code || "—" });
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Error booking appointment. Try again.");
    }
  }

  if (confirmed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#050505",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>✂️</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
            You&apos;re Confirmed!
          </h2>
          <p style={{ color: "#888", marginBottom: 24 }}>
            Check your phone — a confirmation text is on its way.
          </p>
          <div
            style={{
              background: "#0d0d0d",
              border: "1px solid #1f1f1f",
              borderRadius: 12,
              padding: "20px 28px",
              marginBottom: 28,
            }}
          >
            <div style={{ color: "#555", fontSize: 12, marginBottom: 4 }}>
              Booking Code
            </div>
            <div
              style={{
                color: "#d4af37",
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "0.1em",
              }}
            >
              {confirmed.code}
            </div>
          </div>
          <button
            onClick={() => {
              setConfirmed(null);
              setName("");
              setPhone("");
              setEmail("");
              setDate(getTodayDateString());
              setService("");
              setTime("");
            }}
            style={{
              padding: "12px 24px",
              borderRadius: 10,
              border: "1px solid #2a2a2a",
              background: "transparent",
              color: "#888",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Book Another
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff" }}>
      <section style={{ maxWidth: 560, margin: "0 auto", padding: "56px 24px" }}>
        <Link
          href={`/${shopSlug}`}
          style={{
            color: "#555",
            fontSize: 13,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 28,
          }}
        >
          ← Back
        </Link>

        <div
          style={{
            color: "#d4af37",
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {shopName}
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>
          Book with {barberName}
        </h1>
        <p style={{ color: "#555", marginBottom: 36, fontSize: 14 }}>
          Fill out the form below to request your appointment.
        </p>

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

          <Field label="Service" required>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              style={fieldStyle}
            >
              <option value="">Select service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — ${s.price} ({s.duration_minutes} min)
                </option>
              ))}
            </select>
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

          <Field label="Time" required>
            {!selectedService ? (
              <div style={{ ...fieldStyle, color: "#555", display: "flex", alignItems: "center" }}>
                Select a service first
              </div>
            ) : slotsLoading ? (
              <div style={{ ...fieldStyle, color: "#666", display: "flex", alignItems: "center" }}>
                Checking availability...
              </div>
            ) : shopClosed ? (
              <div
                style={{
                  ...fieldStyle,
                  color: "#ff7070",
                  display: "flex",
                  alignItems: "center",
                  background: "#1a0a0a",
                  borderColor: "#440000",
                }}
              >
                Shop is closed on this day
              </div>
            ) : slots.length === 0 ? (
              <div
                style={{
                  ...fieldStyle,
                  color: "#ff9955",
                  display: "flex",
                  alignItems: "center",
                  background: "#1a0800",
                  borderColor: "#3a2000",
                }}
              >
                No available times — try another date
              </div>
            ) : (
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={fieldStyle}
              >
                <option value="">Select time</option>
                {slots.map((s) => (
                  <option key={s.time} value={s.time}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <button
          onClick={handleBooking}
          disabled={loading || slotsLoading || slots.length === 0 || !time}
          style={{
            marginTop: 30,
            width: "100%",
            padding: 16,
            background: loading ? "#a88d20" : "#d4af37",
            color: "#000",
            fontWeight: 800,
            border: "none",
            cursor: loading || slotsLoading || slots.length === 0 || !time ? "not-allowed" : "pointer",
            borderRadius: 10,
            fontSize: 16,
            opacity: slotsLoading || (selectedService && slots.length === 0 && !shopClosed && !slotsLoading) ? 0.5 : 1,
          }}
        >
          {loading ? "Booking..." : "Confirm Booking"}
        </button>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "#1a0a0a",
              border: "1px solid #440000",
              borderRadius: 8,
              color: "#ff7070",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <p style={{ color: "#555", fontSize: 13, marginTop: 14, textAlign: "center" }}>
          You&apos;ll receive a text confirmation after booking.
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
