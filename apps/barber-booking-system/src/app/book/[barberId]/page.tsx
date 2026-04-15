"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

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
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
  "04:30 PM",
];

export default function BarberBookingPage() {
  const params = useParams();
  const barberId = params.barberId as string;

  const barber = barbers[barberId as keyof typeof barbers];

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");

  if (!barber) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Barber not found</h1>
      </main>
    );
  }

  const selectedServiceData = services.find(
    (s) => s.id === selectedService
  );

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px" }}>
        
        {/* HEADER */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: "#d4af37", fontSize: 12, marginBottom: 8 }}>
            Dapper Lounge
          </div>
          <h1 style={{ fontSize: 40, margin: 0 }}>
            Book with {barber.name}
          </h1>
          <p style={{ color: "#999" }}>{barber.role}</p>
        </div>

        {/* SERVICES */}
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

        {/* TIME */}
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
                {time}
              </button>
            ))}
          </div>
        </div>

        {/* CLIENT INFO */}
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
          </div>
        </div>

        {/* SUMMARY */}
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
          <p>Time: {selectedTime || "-"}</p>
        </div>

        {/* ACTION */}
        <button
          disabled={
            !selectedService || !selectedTime || !clientName || !phone
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
              !selectedService || !selectedTime || !clientName || !phone
                ? 0.5
                : 1,
          }}
          onClick={() => {
            alert("Booking submitted (next step: save to database)");
          }}
        >
          Confirm Booking
        </button>
      </section>
    </main>
  );
}
