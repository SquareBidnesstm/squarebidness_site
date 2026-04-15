"use client";

import { useMemo, useState } from "react";

const starterBookings = [
  {
    id: "DL-1001",
    customer: "Chris Jordan",
    barber: "Josh Watkins",
    barberId: "josh",
    service: "Haircut + Beard",
    price: 45,
    time: "10:00 AM",
    day: "Tuesday",
    status: "Confirmed",
    phone: "(407) 555-0102",
    source: "Booking Link",
  },
  {
    id: "DL-1002",
    customer: "Darnell Brooks",
    barber: "Jeramiah (J.J.)",
    barberId: "jj",
    service: "Haircut",
    price: 35,
    time: "11:30 AM",
    day: "Tuesday",
    status: "Confirmed",
    phone: "(407) 555-0197",
    source: "Instagram",
  },
  {
    id: "DL-1003",
    customer: "Malik Evans",
    barber: "Josh Watkins",
    barberId: "josh",
    service: "VIP Appointment",
    price: 75,
    time: "1:00 PM",
    day: "Wednesday",
    status: "Pending",
    phone: "(407) 555-0110",
    source: "Direct",
  },
  {
    id: "DL-1004",
    customer: "Ty Reese",
    barber: "J-Mike",
    barberId: "jmike",
    service: "Cut + Enhancements",
    price: 50,
    time: "2:00 PM",
    day: "Friday",
    status: "Pending",
    phone: "(407) 555-0152",
    source: "Google",
  },
  {
    id: "DL-1005",
    customer: "Aaron Miles",
    barber: "J-Mike",
    barberId: "jmike",
    service: "Haircut",
    price: 35,
    time: "9:00 AM",
    day: "Saturday",
    status: "Confirmed",
    phone: "(407) 555-0188",
    source: "Booking Link",
  },
];

export default function AdminDashboardPage() {
  const [barberFilter, setBarberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredBookings = useMemo(() => {
    return starterBookings.filter((booking) => {
      const matchesBarber =
        barberFilter === "all" || booking.barberId === barberFilter;

      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;

      const q = search.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        booking.customer.toLowerCase().includes(q) ||
        booking.barber.toLowerCase().includes(q) ||
        booking.service.toLowerCase().includes(q) ||
        booking.phone.toLowerCase().includes(q) ||
        booking.id.toLowerCase().includes(q);

      return matchesBarber && matchesStatus && matchesSearch;
    });
  }, [barberFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const totalBookings = starterBookings.length;
    const confirmed = starterBookings.filter(
      (b) => b.status === "Confirmed"
    ).length;
    const pending = starterBookings.filter((b) => b.status === "Pending").length;
    const projectedRevenue = starterBookings.reduce(
      (sum, booking) => sum + booking.price,
      0
    );

    return {
      totalBookings,
      confirmed,
      pending,
      projectedRevenue,
    };
  }, []);

  const barberStats = useMemo(() => {
    const groups = [
      { id: "josh", name: "Josh Watkins" },
      { id: "jj", name: "Jeramiah (J.J.)" },
      { id: "jmike", name: "J-Mike" },
    ];

    return groups.map((barber) => {
      const bookings = starterBookings.filter((b) => b.barberId === barber.id);
      const revenue = bookings.reduce((sum, booking) => sum + booking.price, 0);

      return {
        ...barber,
        bookings: bookings.length,
        revenue,
      };
    });
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              color: "#d4af37",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            Dapper Lounge
          </div>
          <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900 }}>
            Admin Dashboard
          </h1>
          <p style={{ color: "#a3a3a3", fontSize: 18, lineHeight: 1.6 }}>
            Shared-account shop control panel for Josh. All barber bookings flow
            through one system.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <StatCard label="Total Bookings" value={stats.totalBookings} />
          <StatCard label="Confirmed" value={stats.confirmed} />
          <StatCard label="Pending" value={stats.pending} />
          <StatCard label="Projected Revenue" value={`$${stats.projectedRevenue}`} />
        </div>

        <div
          style={{
            border: "1px solid #232323",
            background: "#111",
            borderRadius: 28,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 28 }}>Barber Performance</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
              marginTop: 18,
            }}
          >
            {barberStats.map((barber) => (
              <div
                key={barber.id}
                style={{
                  border: "1px solid #232323",
                  borderRadius: 20,
                  padding: 18,
                  background: "#0d0d0d",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 800 }}>{barber.name}</div>
                <div style={{ color: "#999", marginTop: 8 }}>
                  {barber.bookings} bookings
                </div>
                <div style={{ color: "#d4af37", marginTop: 8, fontWeight: 700 }}>
                  ${barber.revenue} projected
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #232323",
            background: "#111",
            borderRadius: 28,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 220px 220px",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, barber, service, phone, booking ID"
              style={inputStyle}
            />

            <select
              value={barberFilter}
              onChange={(e) => setBarberFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All barbers</option>
              <option value="josh">Josh Watkins</option>
              <option value="jj">Jeramiah (J.J.)</option>
              <option value="jmike">J-Mike</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          <h2 style={{ marginTop: 0, fontSize: 28 }}>Bookings</h2>

          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                style={{
                  border: "1px solid #232323",
                  borderRadius: 20,
                  padding: 18,
                  background: "#0d0d0d",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 20, fontWeight: 800 }}>
                      {booking.customer}
                    </span>

                    <span style={pillWhite}>{booking.barber}</span>
                    <span style={pillDark}>{booking.status}</span>
                  </div>

                  <div style={{ color: "#d4af37", fontWeight: 700 }}>
                    {booking.service} · ${booking.price}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 16,
                      color: "#999",
                      marginTop: 10,
                      fontSize: 14,
                    }}
                  >
                    <span>{booking.id}</span>
                    <span>{booking.day}</span>
                    <span>{booking.time}</span>
                    <span>{booking.phone}</span>
                    <span>{booking.source}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={darkButton}>Manage</button>
                  <button style={goldButton}>Message</button>
                </div>
              </div>
            ))}

            {filteredBookings.length === 0 && (
              <div
                style={{
                  border: "1px dashed #333",
                  borderRadius: 20,
                  padding: 28,
                  textAlign: "center",
                  color: "#999",
                }}
              >
                No bookings match this filter.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        border: "1px solid #232323",
        background: "#111",
        borderRadius: 24,
        padding: 20,
      }}
    >
      <div style={{ color: "#999", fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, marginTop: 10 }}>{value}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 14px",
  borderRadius: 14,
  border: "1px solid #333",
  background: "#0d0d0d",
  color: "#fff",
  outline: "none",
};

const goldButton: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: 800,
  cursor: "pointer",
};

const darkButton: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #333",
  background: "#111",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const pillWhite: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#fff",
  color: "#000",
  fontSize: 12,
  fontWeight: 700,
};

const pillDark: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #333",
  color: "#ddd",
  fontSize: 12,
  fontWeight: 700,
};
