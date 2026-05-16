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
  shopLogoUrl?: string | null;
  barberSlug: string;
  barberName: string;
  barberPhotoUrl?: string | null;
  barberBio?: string | null;
  services: ServiceOption[];
};

// Shape of data saved in localStorage for returning customers
type SavedCustomer = { name: string; phone: string; email: string; lastService: string };

const LS_KEY = (shopSlug: string) => `sbb_customer_${shopSlug}`;

export default function BookingForm({ shopSlug, shopName, shopLogoUrl, barberSlug, barberName, barberPhotoUrl, barberBio, services }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => getTodayDateString());
  const [service, setService] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{
    code: string;
    startsAt?: string;
    endsAt?: string;
    barber?: string;
    service?: string;
  } | null>(null);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [shopClosed, setShopClosed] = useState(false);
  const [depositInfo, setDepositInfo] = useState<{ enabled: boolean; amount: number; type: "fixed" | "percent" } | null>(null);
  const [serverDepositAmount, setServerDepositAmount] = useState<number | null>(null);
  // Unique key per form session — prevents duplicate bookings on network retry
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Returning-customer pre-fill
  const [savedCustomer, setSavedCustomer] = useState<SavedCustomer | null>(null);
  const [showReturnBanner, setShowReturnBanner] = useState(false);

  const selectedService = services.find((s) => s.id === service);

  // On mount: check localStorage for returning customer info
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY(shopSlug));
      if (raw) {
        const parsed: SavedCustomer = JSON.parse(raw);
        if (parsed.name && parsed.phone) {
          setSavedCustomer(parsed);
          setShowReturnBanner(true);
        }
      }
    } catch { /* localStorage unavailable (private mode, etc.) */ }
  }, [shopSlug]);

  // Apply saved customer info when they accept the pre-fill prompt
  function applySavedCustomer() {
    if (!savedCustomer) return;
    setName(savedCustomer.name);
    setPhone(savedCustomer.phone);
    setEmail(savedCustomer.email ?? "");
    if (savedCustomer.lastService && services.some((s) => s.id === savedCustomer.lastService)) {
      setService(savedCustomer.lastService);
    }
    setShowReturnBanner(false);
  }

  // Persist customer info after a successful booking
  function persistCustomerInfo() {
    try {
      const data: SavedCustomer = { name, phone, email, lastService: service };
      localStorage.setItem(LS_KEY(shopSlug), JSON.stringify(data));
      setSavedCustomer(data);
    } catch { /* ignore write errors */ }
  }

  // Fetch deposit settings once on load
  useEffect(() => {
    fetch(`/api/${shopSlug}/admin/deposit-settings`)
      .then((r) => r.json())
      .then((d) => { if (d.ok && d.settings?.enabled) setDepositInfo(d.settings); })
      .catch(() => {});
  }, [shopSlug]);

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

  function validateForm(): boolean {
    if (!name || !phone || !date || !service || !time) {
      setError("Name, phone, date, service, and time are required.");
      return false;
    }
    return true;
  }

  function bookingPayload() {
    return {
      barber_id: barberSlug,
      customer_name: name,
      customer_phone: phone,
      customer_email: email || null,
      client_notes: notes.trim() || null,
      service,
      time: slots.find((s) => s.time === time)?.label ?? time,
      date,
    };
  }

  async function handlePayDeposit() {
    if (!validateForm()) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/${shopSlug}/booking/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingPayload()),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok && data?.url) {
      // Use server-confirmed deposit amount for display accuracy
      if (data.depositAmount != null) setServerDepositAmount(Number(data.depositAmount));
      window.location.href = data.url;
    } else {
      setError(data?.error || "Could not start deposit. Try booking without deposit.");
    }
  }

  async function handleBooking() {
    if (!validateForm()) return;
    setLoading(true);
    setError("");

    const res = await fetch(`/api/${shopSlug}/bookings/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(bookingPayload()),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      persistCustomerInfo();
      setConfirmed({
        code: data.booking?.booking_code || "—",
        startsAt: data.booking?.starts_at,
        endsAt: data.booking?.ends_at,
        barber: data.barber,
        service: data.service,
      });
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
          {/* Add to Calendar */}
          {confirmed?.startsAt && confirmed?.endsAt && (() => {
            const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
            const title = encodeURIComponent(`${confirmed.service ?? "Appointment"} with ${confirmed.barber ?? "Barber"}`);
            const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(confirmed.startsAt)}/${fmt(confirmed.endsAt)}&details=${encodeURIComponent(`Booking code: ${confirmed.code}`)}`;
            return (
              <a
                href={calUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: "1px solid #2a2a2a",
                  background: "#0d0d0d",
                  color: "#aaa",
                  fontSize: 14,
                  textDecoration: "none",
                  marginBottom: 16,
                }}
              >
                📅 Add to Google Calendar
              </a>
            );
          })()}

          {/* Add to home screen prompt */}
          <div style={{ background: "linear-gradient(180deg,rgba(212,175,55,.1),rgba(255,255,255,.03))", border: "1px solid rgba(212,175,55,.25)", borderRadius: 16, padding: "18px 20px", marginBottom: 20, textAlign: "left" }}>
            <strong style={{ display: "block", fontSize: "1rem", marginBottom: 6, color: "#fff" }}>📲 Add SB Booking to your home screen</strong>
            <p style={{ margin: "0 0 14px", color: "#a1a1aa", fontSize: "0.85rem", lineHeight: 1.5 }}>
              Next time, tap the icon on your phone and book in seconds.
            </p>
            <a href="/add-homescreen" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 20px", borderRadius: 10, background: "#d4af37", color: "#000", fontWeight: 900, fontSize: "0.9rem", textDecoration: "none" }}>
              Add Web App →
            </a>
          </div>

          <button
            onClick={() => {
              // Keep personal info from saved customer — only reset appointment details
              setConfirmed(null);
              setNotes("");
              setDate(getTodayDateString());
              // Pre-select the same service they just booked
              if (savedCustomer?.lastService && services.some((s) => s.id === savedCustomer.lastService)) {
                setService(savedCustomer.lastService);
              } else {
                setService("");
              }
              setTime("");
              setError("");
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
            Book Again
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

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          {shopLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shopLogoUrl} alt={shopName} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
          )}
          {barberPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={barberPhotoUrl} alt={barberName} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          )}
          <div>
            <div style={{ color: "#d4af37", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 2 }}>
              {shopName}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>
              Book with {barberName}
            </h1>
          </div>
        </div>
        {barberBio ? (
          <p style={{ color: "#aaa", marginBottom: 28, fontSize: 14, lineHeight: 1.6 }}>
            {barberBio}
          </p>
        ) : (
          <p style={{ color: "#555", marginBottom: 36, fontSize: 14 }}>
            Fill out the form below to request your appointment.
          </p>
        )}

        {/* Welcome back banner — shown to returning customers */}
        {showReturnBanner && savedCustomer && (
          <div style={{
            marginBottom: 24,
            padding: "14px 16px",
            background: "linear-gradient(135deg, #0d0900, #1a1200)",
            border: "1px solid rgba(212,175,55,0.35)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <div>
              <div style={{ color: "#d4af37", fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                Welcome back, {savedCustomer.name.split(" ")[0]}! ✂️
              </div>
              <div style={{ color: "#888", fontSize: 12 }}>
                Use your saved info to book faster.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={applySavedCustomer}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  background: "#d4af37", color: "#000",
                  fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
                }}
              >
                Use Saved
              </button>
              <button
                onClick={() => setShowReturnBanner(false)}
                style={{
                  padding: "8px 10px", borderRadius: 8,
                  background: "transparent", color: "#555",
                  fontSize: 13, border: "1px solid #2a2a2a", cursor: "pointer",
                }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

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

          <Field label="Notes" hint="optional">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything your barber should know (style, allergies, etc.)"
              rows={3}
              style={{ ...fieldStyle, resize: "vertical" }}
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

        {/* Deposit banner — shown when deposit is required */}
        {depositInfo?.enabled && !slotsLoading && slots.length > 0 && time && (
          <div style={{
            marginTop: 24,
            padding: "14px 16px",
            background: "#0d0c00",
            border: "1px solid #3a2a00",
            borderRadius: 10,
            fontSize: 13,
            color: "#aaa",
          }}>
            <span style={{ color: "#d4af37", fontWeight: 700 }}>
              ${serverDepositAmount != null
                ? serverDepositAmount.toFixed(2)
                : depositInfo.type === "percent"
                  ? ((selectedService ? selectedService.price * depositInfo.amount / 100 : 0).toFixed(2))
                  : depositInfo.amount.toFixed(2)} deposit required
            </span>
            {" "}— holds your spot. Pay the rest at your appointment.
          </div>
        )}

        <div style={{ marginTop: 30, display: "grid", gap: 10 }}>
          {depositInfo?.enabled ? (
            <button
              onClick={handlePayDeposit}
              disabled={loading || slotsLoading || slots.length === 0 || !time}
              style={{
                width: "100%", padding: 16,
                background: loading ? "#a88d20" : "#d4af37",
                color: "#000", fontWeight: 800, border: "none",
                cursor: loading || !time ? "not-allowed" : "pointer",
                borderRadius: 10, fontSize: 15,
                opacity: !time ? 0.5 : 1,
              }}
            >
              {loading ? "Loading..." : "Pay Deposit & Book"}
            </button>
          ) : (
            <button
              onClick={handleBooking}
              disabled={loading || slotsLoading || slots.length === 0 || !time}
              style={{
                width: "100%", padding: 16,
                background: loading ? "#a88d20" : "#d4af37",
                color: "#000", fontWeight: 800, border: "none",
                cursor: loading || slotsLoading || slots.length === 0 || !time ? "not-allowed" : "pointer",
                borderRadius: 10, fontSize: 16,
                opacity: slotsLoading || (selectedService && slots.length === 0 && !shopClosed && !slotsLoading) ? 0.5 : 1,
              }}
            >
              {loading ? "Booking..." : "Confirm Booking"}
            </button>
          )}
        </div>

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
