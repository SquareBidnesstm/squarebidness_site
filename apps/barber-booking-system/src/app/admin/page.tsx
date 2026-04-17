"use client";

import { useEffect, useMemo, useState } from "react";

type BookingRow = {
  id: string;
  booking_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  appointment_date: string;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: string;
  source: string | null;
  client_notes: string | null;
  created_at: string;
  barbers: {
    slug: string;
    name: string;
    display_name: string | null;
  } | null;
  services: {
    slug: string;
    name: string;
    duration_minutes: number;
    price: number;
  } | null;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [barberFilter, setBarberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadBookings() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/bookings", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error || "Could not load bookings.");
          return;
        }

        setBookings(data.bookings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    }

    loadBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const barberSlug = booking.barbers?.slug || "";
      const matchesBarber =
        barberFilter === "all" || barberSlug === barberFilter;

      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;

      const q = search.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        booking.customer_name.toLowerCase().includes(q) ||
        (booking.barbers?.display_name || booking.barbers?.name || "")
          .toLowerCase()
          .includes(q) ||
        (booking.services?.name || "").toLowerCase().includes(q) ||
        (booking.customer_phone || "").toLowerCase().includes(q) ||
        booking.booking_code.toLowerCase().includes(q);

      return matchesBarber && matchesStatus && matchesSearch;
    });
  }, [bookings, barberFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const totalBookings = bookings.length;
    const confirmed = bookings.filter((b) => b.status === "confirmed").length;
    const pending = bookings.filter((b) => b.status === "pending").length;
    const projectedRevenue = bookings.reduce(
      (sum, booking) => sum + Number(booking.services?.price || 0),
      0
    );

    return {
      totalBookings,
      confirmed,
      pending,
      projectedRevenue,
    };
  }, [bookings]);

  const uniqueBarbers = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach((booking) => {
      if (booking.barbers?.slug) {
        map.set(
          booking.barbers.slug,
          booking.barbers.display_name || booking.barbers.name
        );
      }
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [bookings]);

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
            Live bookings from Supabase.
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
          <StatCard label="Projected Revenue" value={formatMoney(stats.projectedRevenue)} />
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
              placeholder="Search client, barber, service, phone, booking code"
              style={inputStyle}
            />

            <select
              value={barberFilter}
              onChange={(e) => setBarberFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All barbers</option>
              {uniqueBarbers.map((barber) => (
                <option key={barber.slug} value={barber.slug}>
                  {barber.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

          <h2 style={{ marginTop: 0, fontSize: 28 }}>Bookings</h2>

          {loading ? (
            <div style={{ color: "#999", marginTop: 18 }}>Loading bookings...</div>
          ) : error ? (
            <div style={{ color: "#ffb3b3", marginTop: 18 }}>{error}</div>
          ) : (
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
                        {booking.customer_name}
                      </span>

                      <span style={pillWhite}>
                        {booking.barbers?.display_name || booking.barbers?.name || "Unknown Barber"}
                      </span>
                      <span style={pillDark}>{booking.status}</span>
                    </div>

                    <div style={{ color: "#d4af37", fontWeight: 700 }}>
                      {booking.services?.name || "Unknown Service"} ·{" "}
                      {formatMoney(Number(booking.services?.price || 0))}
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
                      <span>{booking.booking_code}</span>
                      <span>{booking.appointment_date}</span>
                      <span>{formatDateTime(booking.starts_at)}</span>
                      <span>{booking.customer_phone || "-"}</span>
                      <span>{booking.source || "-"}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={darkButton}>Manage</button>
                  </div>
                </div>
              ))}

              {filteredBookings.length === 0 ? (
                <div
                  style={{
                    border: "1px dashed #333",
                    borderRadius: 20,
                    padding: 28,
                    textAlign: "center",
                    color: "#999",
                  }}
                >
                  No bookings found.
                </div>
              ) : null}
            </div>
          )}
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
