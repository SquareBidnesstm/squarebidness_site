"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ServicesTab from "./ServicesTab";
import BillingTab from "./BillingTab";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

type AdminBooking = {
  id: string;
  booking_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  appointment_date: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  payment_status: "unpaid" | "deposit_paid" | "paid" | "refunded";
  source: string | null;
  client_notes: string | null;
  created_at: string;
  barbers: { slug: string; name: string; display_name: string | null } | null;
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

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

const STATUS_COLORS: Record<BookingStatus, React.CSSProperties> = {
  pending: { background: "#2b2b00", color: "#e0d000", borderColor: "#4a4a00" },
  confirmed: { background: "#0d2200", color: "#5cd600", borderColor: "#1e4400" },
  completed: { background: "#002233", color: "#4dcfff", borderColor: "#003344" },
  cancelled: { background: "#220000", color: "#ff5555", borderColor: "#440000" },
  no_show: { background: "#1a0a00", color: "#ff9955", borderColor: "#331500" },
};

export default function AdminPage() {
  const params = useParams();
  const shopSlug = params.shopSlug as string;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"bookings" | "services" | "billing">("bookings");
  const [shopName, setShopName] = useState("");
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [barberFilter, setBarberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const today = useMemo(() => getTodayString(), []);

  useEffect(() => {
    async function loadBookings() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/${shopSlug}/admin/bookings`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error || "Could not load bookings.");
          return;
        }
        if (data.shop?.name) setShopName(data.shop.name);
        setBookings(data.bookings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, [shopSlug]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch(`/api/${shopSlug}/admin/logout`, { method: "POST" });
    router.push(`/${shopSlug}/admin/login`);
  }

  const updateStatus = useCallback(
    async (bookingId: string, newStatus: BookingStatus) => {
      setUpdatingId(bookingId);
      try {
        const res = await fetch(`/api/${shopSlug}/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === bookingId ? { ...b, status: newStatus } : b
            )
          );
          setManagingId(null);
        }
      } finally {
        setUpdatingId(null);
      }
    },
    [shopSlug]
  );

  const uniqueBarbers = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach((b) => {
      const slug = b.barbers?.slug;
      const name = b.barbers?.display_name || b.barbers?.name;
      if (slug && name) map.set(slug, name);
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) => {
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
        const matchesToday =
          !showTodayOnly || booking.appointment_date === today;
        return matchesSearch && matchesBarber && matchesStatus && matchesToday;
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
  }, [bookings, search, barberFilter, statusFilter, showTodayOnly, today]);

  const nextUpcomingBookingId = useMemo(() => {
    const upcoming = filteredBookings
      .filter(
        (b) =>
          b.status === "confirmed" &&
          new Date(b.starts_at).getTime() > Date.now()
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
    return upcoming[0]?.id ?? null;
  }, [filteredBookings]);

  useEffect(() => {
    if (!nextUpcomingBookingId) return;
    const el = document.getElementById(`booking-${nextUpcomingBookingId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [nextUpcomingBookingId]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === "confirmed").length;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const todayCount = bookings.filter(
      (b) => b.appointment_date === today
    ).length;
    const bookedRevenue = bookings.reduce(
      (sum, b) => sum + Number(b.services?.price || 0),
      0
    );
    const completedRevenue = bookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + Number(b.services?.price || 0), 0);
    const todayBookedRevenue = bookings
      .filter((b) => b.appointment_date === today)
      .reduce((sum, b) => sum + Number(b.services?.price || 0), 0);
    const todayCompletedRevenue = bookings
      .filter((b) => b.appointment_date === today && b.status === "completed")
      .reduce((sum, b) => sum + Number(b.services?.price || 0), 0);
    return {
      total, confirmed, completed, todayCount,
      bookedRevenue, completedRevenue, todayBookedRevenue, todayCompletedRevenue,
    };
  }, [bookings, today]);

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
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                color: "#d4af37",
                fontSize: 12,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {shopName || shopSlug}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              style={secondaryButton}
            >
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
          <h1 style={{ fontSize: 52, lineHeight: 1.05, fontWeight: 900, margin: 0 }}>
            Admin Dashboard
          </h1>
          <p style={{ color: "#9a9a9a", fontSize: 18, marginTop: 14, maxWidth: 760 }}>
            Live shop view for bookings coming into the system.
          </p>
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {(["bookings", "services", "billing"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: activeTab === tab ? "none" : "1px solid #2d2d2d",
                background: activeTab === tab ? "#d4af37" : "#111",
                color: activeTab === tab ? "#000" : "#888",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "services" ? (
          <ServicesTab shopSlug={shopSlug} />
        ) : activeTab === "billing" ? (
          <BillingTab shopSlug={shopSlug} />
        ) : (
        <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <StatCard label="Total Bookings" value={stats.total} sub={`${stats.todayCount} today`} />
          <StatCard label="Confirmed" value={stats.confirmed} />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard
            label="Today's Bookings"
            value={stats.todayCount}
            sub={formatMoney(stats.todayBookedRevenue) + " on deck"}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatCard label="Total Booked" value={formatMoney(stats.bookedRevenue)} />
          <StatCard label="Earned (Completed)" value={formatMoney(stats.completedRevenue)} gold />
          <StatCard label="Today Booked" value={formatMoney(stats.todayBookedRevenue)} />
          <StatCard label="Today Earned" value={formatMoney(stats.todayCompletedRevenue)} gold />
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
              gridTemplateColumns: "1.3fr 200px 200px auto",
              gap: 14,
              marginBottom: 24,
              alignItems: "center",
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
              {uniqueBarbers.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
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
            <button
              type="button"
              onClick={() => setShowTodayOnly((v) => !v)}
              style={showTodayOnly ? goldButton : secondaryButton}
            >
              Today Only
            </button>
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
                  booking.barbers?.display_name || booking.barbers?.name || "—";
                const serviceName = booking.services?.name || "—";
                const servicePrice = Number(booking.services?.price || 0);
                const isExpanded = expandedId === booking.id;
                const isManaging = managingId === booking.id;
                const isUpdating = updatingId === booking.id;
                const statusStyle = STATUS_COLORS[booking.status];

                return (
                  <div
                    key={booking.id}
                    id={`booking-${booking.id}`}
                    style={{
                      border: "1px solid #232323",
                      background: "#070707",
                      borderRadius: 22,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
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
                          <span style={{ fontSize: 24, fontWeight: 800 }}>
                            {booking.customer_name}
                          </span>
                          <span style={whitePill}>{barberName}</span>
                          <span style={{ ...darkPill, ...statusStyle }}>
                            {STATUS_LABELS[booking.status]}
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
                          <span>{booking.customer_phone || "—"}</span>
                          <span>{booking.source || "—"}</span>
                        </div>

                        {booking.client_notes && (
                          <div
                            style={{
                              marginTop: 12,
                              color: "#bbbbbb",
                              fontSize: 14,
                            }}
                          >
                            Notes: {booking.client_notes}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          style={secondaryButton}
                          type="button"
                          onClick={() => {
                            setExpandedId(isExpanded ? null : booking.id);
                            setManagingId(null);
                          }}
                        >
                          {isExpanded ? "Close" : "View"}
                        </button>
                        <button
                          style={
                            isManaging
                              ? { ...goldButton, background: "#a88d20" }
                              : goldButton
                          }
                          type="button"
                          onClick={() => {
                            setManagingId(isManaging ? null : booking.id);
                            setExpandedId(null);
                          }}
                        >
                          Manage
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 16,
                          borderTop: "1px solid #1e1e1e",
                          display: "grid",
                          gap: 8,
                          color: "#aaaaaa",
                          fontSize: 14,
                        }}
                      >
                        <div>
                          <span style={{ color: "#666" }}>Email: </span>
                          {booking.customer_email || "—"}
                        </div>
                        <div>
                          <span style={{ color: "#666" }}>Duration: </span>
                          {booking.services?.duration_minutes ?? "—"} min
                        </div>
                        <div>
                          <span style={{ color: "#666" }}>Ends at: </span>
                          {formatTime(booking.ends_at)}
                        </div>
                        <div>
                          <span style={{ color: "#666" }}>Created: </span>
                          {new Date(booking.created_at).toLocaleString()}
                        </div>
                      </div>
                    )}

                    {isManaging && (
                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 16,
                          borderTop: "1px solid #1e1e1e",
                        }}
                      >
                        <div
                          style={{ color: "#666", fontSize: 13, marginBottom: 10 }}
                        >
                          Set status:
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {(
                            [
                              "confirmed",
                              "completed",
                              "cancelled",
                              "no_show",
                              "pending",
                            ] as BookingStatus[]
                          )
                            .filter((s) => s !== booking.status)
                            .map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={isUpdating}
                                onClick={() => updateStatus(booking.id, s)}
                                style={{
                                  padding: "10px 14px",
                                  borderRadius: 10,
                                  border: `1px solid ${STATUS_COLORS[s].borderColor as string}`,
                                  background: STATUS_COLORS[s].background as string,
                                  color: STATUS_COLORS[s].color as string,
                                  fontWeight: 700,
                                  fontSize: 13,
                                  cursor: isUpdating ? "not-allowed" : "pointer",
                                  opacity: isUpdating ? 0.5 : 1,
                                }}
                              >
                                {isUpdating ? "Updating..." : STATUS_LABELS[s]}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  gold,
}: {
  label: string;
  value: string | number;
  sub?: string;
  gold?: boolean;
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
          color: gold ? "#d4af37" : "#ffffff",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ color: "#555", fontSize: 13, marginTop: 6 }}>{sub}</div>
      )}
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
  whiteSpace: "nowrap",
};

const secondaryButton: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #2d2d2d",
  background: "#111111",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
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
