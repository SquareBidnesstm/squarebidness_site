"use client";

import { useEffect, useMemo, useState } from "react";

type AdminBooking = {
  id: string;
  booking_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  appointment_date: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  payment_status: "unpaid" | "deposit_paid" | "paid" | "refunded";
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

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString();
}

function formatTime(dateTime: string) {
  return new Date(dateTime).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [barberFilter, setBarberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function loadBookings() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/bookings/", {
          cache: "no-store",
        });

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

  async function updateStatus(bookingId: string, status: string) {
  try {
    const res = await fetch("/api/bookings/update-status/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bookingId, status }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Failed to update status");
      return;
    }

    // refresh bookings after update
    const refresh = await fetch("/api/bookings/", { cache: "no-store" });
    const refreshedData = await refresh.json();

    setBookings(refreshedData.bookings || []);
  } catch (err) {
    alert("Error updating booking");
  }
}

  const uniqueBarbers = useMemo(() => {
    const map = new Map<string, string>();

    bookings.forEach((booking) => {
      const slug = booking.barbers?.slug;
      const name = booking.barbers?.display_name || booking.barbers?.name;
      if (slug && name) map.set(slug, name);
    });

    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const q = search.trim().toLowerCase();

      const matchesSearch =
        q.length === 0 ||
        booking.customer_name.toLowerCase().includes(q) ||
        booking.booking_code.toLowerCase().includes(q) ||
        (booking.customer_phone || "").toLowerCase().includes(q) ||
        (booking.barbers?.display_name || booking.barbers?.name || "")
          .toLowerCase()
          .includes(q) ||
        (booking.services?.name || "").toLowerCase().includes(q);

      const matchesBarber =
        barberFilter === "all" || booking.barbers?.slug === barberFilter;

      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;

      return matchesSearch && matchesBarber && matchesStatus;
    });
  }, [bookings, search, barberFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === "confirmed").length;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const revenue = bookings.reduce(
      (sum, booking) => sum + Number(booking.services?.price || 0),
      0
    );

    return { total, confirmed, completed, revenue };
  }, [bookings]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#ffffff",
        padding: "48px 24px",
      }}
    >
      <section style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              color: "#d4af37",
              fontSize: 12,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Dapper Lounge
          </div>
          <h1
            style={{
              fontSize: 52,
              lineHeight: 1.05,
              fontWeight: 900,
              margin: 0,
            }}
          >
            Admin Dashboard
          </h1>
          <p
            style={{
              color: "#9a9a9a",
              fontSize: 18,
              lineHeight: 1.6,
              marginTop: 14,
              maxWidth: 760,
            }}
          >
            Live shop view for bookings coming into the system.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatCard label="Total Bookings" value={stats.total} />
          <StatCard label="Confirmed" value={stats.confirmed} />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard label="Projected Revenue" value={formatMoney(stats.revenue)} />
        </div>

        <div
          style={{
            border: "1px solid #232323",
            background: "#0d0d0d",
            borderRadius: 28,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 220px 220px",
              gap: 14,
              marginBottom: 24,
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, barber, service, phone"
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
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>Bookings</h2>
            <div style={{ color: "#8f8f8f", fontSize: 14 }}>
              {filteredBookings.length} shown
            </div>
          </div>

          {loading ? (
            <div style={emptyBox}>Loading bookings...</div>
          ) : error ? (
            <div style={{ ...emptyBox, color: "#ffb3b3", borderColor: "#532323" }}>
              {error}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div style={emptyBox}>No bookings found.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {filteredBookings.map((booking) => {
                const barberName =
                  booking.barbers?.display_name || booking.barbers?.name || "Unknown Barber";
                const serviceName = booking.services?.name || "Unknown Service";
                const servicePrice = Number(booking.services?.price || 0);

                return (
                  <div
  key={booking.id}
  style={{
    border: "1px solid #232323",
    background: "#070707",
    borderRadius: 22,
    padding: 18,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 18,
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
        marginBottom: 10,
      }}
    >
      <span
        style={{
          fontSize: 24,
          fontWeight: 800,
          lineHeight: 1.1,
        }}
      >
        {booking.customer_name}
      </span>

      <span style={whitePill}>{barberName}</span>

      <span
        style={{
          ...darkPill,
          ...(booking.status === "completed"
            ? {
                background: "#122b1d",
                border: "1px solid #214d2f",
                color: "#b7f5c6",
              }
            : booking.status === "confirmed"
            ? {
                background: "#2a2110",
                border: "1px solid #5a4717",
                color: "#f5d77a",
              }
            : booking.status === "cancelled"
            ? {
                background: "#2b1414",
                border: "1px solid #5a2323",
                color: "#ffb3b3",
              }
            : booking.status === "no_show"
            ? {
                background: "#1d1d1d",
                border: "1px solid #3a3a3a",
                color: "#c7c7c7",
              }
            : {}),
        }}
      >
        {booking.status}
      </span>

      <span style={darkPill}>{booking.payment_status}</span>
    </div>

    <div
      style={{
        color: "#d4af37",
        fontWeight: 800,
        fontSize: 18,
        marginBottom: 10,
      }}
    >
      {serviceName} · {formatMoney(servicePrice)}
    </div>

    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        color: "#9a9a9a",
        fontSize: 14,
      }}
    >
      <span>{booking.booking_code}</span>
      <span>{formatDate(booking.appointment_date)}</span>
      <span>{formatTime(booking.starts_at)}</span>
      <span>{booking.customer_phone || "-"}</span>
      <span>{booking.source || "-"}</span>
    </div>

    {booking.client_notes ? (
      <div
        style={{
          marginTop: 12,
          color: "#bbbbbb",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        Notes: {booking.client_notes}
      </div>
    ) : null}
  </div>

  <div
    style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    }}
  >
    {booking.status !== "completed" && (
      <button
        style={goldButton}
        onClick={() => updateStatus(booking.id, "completed")}
      >
        Complete
      </button>
    )}

    {booking.status !== "confirmed" && (
      <button
        style={secondaryButton}
        onClick={() => updateStatus(booking.id, "confirmed")}
      >
        Confirm
      </button>
    )}

    {booking.status !== "cancelled" && (
      <button
        style={secondaryButton}
        onClick={() => updateStatus(booking.id, "cancelled")}
      >
        Cancel
      </button>
    )}

    {booking.status !== "no_show" && (
      <button
        style={secondaryButton}
        onClick={() => updateStatus(booking.id, "no_show")}
      >
        No Show
      </button>
    )}
  </div>
</div>
                );
              })}
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
        background: "#0d0d0d",
        borderRadius: 24,
        padding: 20,
      }}
    >
      <div style={{ color: "#8f8f8f", fontSize: 14 }}>{label}</div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 900,
          lineHeight: 1.1,
          marginTop: 10,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #2b2b2b",
  background: "#050505",
  color: "#ffffff",
  outline: "none",
  fontSize: 16,
};

const emptyBox: React.CSSProperties = {
  border: "1px dashed #2a2a2a",
  borderRadius: 18,
  padding: 28,
  textAlign: "center",
  color: "#9a9a9a",
  background: "#070707",
};

const goldButton: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "#d4af37",
  color: "#000000",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #2d2d2d",
  background: "#111111",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const whitePill: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#ffffff",
  color: "#000000",
  fontSize: 12,
  fontWeight: 800,
};

const darkPill: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #303030",
  background: "#111111",
  color: "#d7d7d7",
  fontSize: 12,
  fontWeight: 800,
};
