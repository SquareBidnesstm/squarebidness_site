"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

const barbers = {
  josh: { name: "Josh Watkins", role: "Head Barber" },
  jj: { name: "Jeramiah (J.J.)", role: "Barber" },
  jmike: { name: "J-Mike", role: "Barber" },
};

const services = [
  { id: "haircut", name: "Haircut", price: 35, duration: 45 },
  { id: "haircut-beard", name: "Haircut + Beard", price: 45, duration: 60 },
  { id: "kids-cut", name: "Kids Cut", price: 25, duration: 30 },
  { id: "enhancements", name: "Cut + Enhancements", price: 50, duration: 60 },
  { id: "vip", name: "VIP Appointment", price: 75, duration: 90 },
];

const timeSlots = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

function toDisplayTime(time24: string) {
  const [hourStr, minute] = time24.split(":");
  let hour = Number(hourStr);
  const suffix = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  if (hour > 12) hour -= 12;
  return `${hour}:${minute} ${suffix}`;
}

function getTodayLocalDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BarberBookingPage() {
  const params = useParams();
  const barberId = params.barberId as string;
  const barber = barbers[barberId as keyof typeof barbers];

  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [appointmentDate, setAppointmentDate] = useState<string>(getTodayLocalDate());
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedServiceData = useMemo(
    () => services.find((s) => s.id === selectedService),
    [selectedService]
  );

  if (!barber) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Barber not found</h1>
      </main>
    );
  }

  async function handleSubmit() {
    setServerError("");
    setSuccessMessage("");

    if (!selectedService || !selectedTime || !clientName || !phone || !appointmentDate) {
      setServerError("Please complete all required booking fields.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barberSlug: barberId,
          serviceSlug: selectedService,
          customerName: clientName,
          customerPhone: phone,
          customerEmail: email,
          appointmentDate,
          appointmentTime: selectedTime,
          clientNotes: notes,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setServerError(data.error || "Booking failed.");
        return;
      }

      setSuccessMessage(
        `Booking confirmed. Code: ${data.booking.booking_code}`
      );

      setSelectedService("");
      setSelectedTime("");
      setClientName("");
      setPhone("");
      setEmail("");
      setNotes("");
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unexpected error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: "#d4af37", fontSize: 12, marginBottom: 8 }}>
            Dapper Lounge
          </div>
          <h1 style={{ fontSize: 40, margin: 0 }}>
            Book with {barber.name}
          </h1>
          <p style={{ color: "#999" }}>{barber.role}</p>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2>Select Service</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {services.map((service) => (
              <div
                key={service.id}
                onClick={() => setSelectedService(service.id)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  cursor: "pointer",
                  border:
                    selectedService === service.id
                      ? "2px solid #d4af37"
                      : "1px solid #333",
                  background: "#111",
                }}
              >
                <strong>{service.name}</strong> — ${service.price}
                <div style={{ fontSize: 12, color: "#888" }}>
                  {service.duration} min
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2>Select Date</h2>
          <input
            type="date"
            value={appointmentDate}
            min={getTodayLocalDate()}
            onChange={(e) => setAppointmentDate(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #333",
              background: "#111",
              color: "#fff",
              width: "100%",
              maxWidth: 320,
            }}
          />
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2>Select Time</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginTop: 12,
            }}
          >
            {timeSlots.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setSelectedTime(time)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border:
                    selectedTime === time
                      ? "2px solid #d4af37"
                      : "1px solid #333",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {toDisplayTime(time)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2>Your Info</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <input
              placeholder="Full Name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #333" }}
            />
            <input
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #333" }}
            />
            <input
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #333" }}
            />
            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #333" }}
            />
          </div>
        </div>

        <div
          style={{
            border: "1px solid #333",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h3>Summary</h3>
          <p>Barber: {barber.name}</p>
          <p>Service: {selectedServiceData?.name || "-"}</p>
          <p>Price: {selectedServiceData ? `$${selectedServiceData.price}` : "-"}</p>
          <p>Date: {appointmentDate || "-"}</p>
          <p>Time: {selectedTime ? toDisplayTime(selectedTime) : "-"}</p>
        </div>

        {serverError ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #5c1f1f",
              background: "#2a1212",
              color: "#ffb3b3",
            }}
          >
            {serverError}
          </div>
        ) : null}

        {successMessage ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #214d2d",
              background: "#122819",
              color: "#b9f5c8",
            }}
          >
            {successMessage}
          </div>
        ) : null}

        <button
          disabled={
            submitting ||
            !selectedService ||
            !selectedTime ||
            !clientName ||
            !phone ||
            !appointmentDate
          }
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 12,
            background: "#d4af37",
            color: "#000",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer",
            opacity:
              submitting ||
              !selectedService ||
              !selectedTime ||
              !clientName ||
              !phone ||
              !appointmentDate
                ? 0.5
                : 1,
          }}
          onClick={handleSubmit}
        >
          {submitting ? "Saving Booking..." : "Confirm Booking"}
        </button>
      </section>
    </main>
  );
}
