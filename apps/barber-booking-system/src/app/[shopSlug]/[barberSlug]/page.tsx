"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

type Booking = {
  id: string;
  booking_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  appointment_date: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  payment_status: string;
  price_snapshot: number | null;
  client_notes: string | null;
  services: { name: string; duration_minutes: number; price: number } | null;
};

type Perms = { can_edit_hours: boolean; can_edit_prices: boolean };

type HourRow = { day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null };

type ServicePrice = {
  id: string;
  name: string;
  duration_minutes: number;
  base_price: number;
  price: number;
  has_override: boolean;
};

const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const suf = h >= 12 ? "PM" : "AM";
    const dh = h % 12 === 0 ? 12 : h % 12;
    TIME_OPTIONS.push({ value: v, label: `${dh}:${String(m).padStart(2, "0")} ${suf}` });
  }
}

const DEFAULT_HOURS: HourRow[] = [
  { day_of_week: 0, is_closed: true, open_time: null, close_time: null },
  { day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 2, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 3, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 4, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 5, is_closed: false, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 6, is_closed: false, open_time: "08:00", close_time: "16:00" },
];

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

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString();
}
function formatTime(dateTime: string) {
  return new Date(dateTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type Tab = "schedule" | "earnings" | "hours" | "prices" | "stripe";

export default function BarberPage() {
  const params = useParams();
  const shopSlug = params.shopSlug as string;
  const barberSlug = params.barberSlug as string;
  const router = useRouter();

  const [barberName, setBarberName] = useState("");
  const [barberPhotoUrl, setBarberPhotoUrl] = useState<string | null>(null);
  const [shopTimezone, setShopTimezone] = useState("America/Chicago");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [perms, setPerms] = useState<Perms>({ can_edit_hours: false, can_edit_prices: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("schedule");

  // Hours state
  const [hours, setHours] = useState<HourRow[]>(DEFAULT_HOURS);
  const [hoursLoaded, setHoursLoaded] = useState(false);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  // Prices state
  const [services, setServices] = useState<ServicePrice[]>([]);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [pricesSaving, setPricesSaving] = useState(false);
  const [pricesSaved, setPricesSaved] = useState(false);

  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const updateBookingStatus = async (bookingId: string, newStatus: "completed" | "no_show") => {
    setStatusUpdating(bookingId);
    try {
      const res = await fetch(
        `/api/${shopSlug}/barbers/${barberSlug}/appointments/${bookingId}/status`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) }
      );
      const d = await res.json();
      if (d.ok) {
        setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: newStatus as BookingStatus } : b));
      } else {
        alert(d.error ?? "Could not update status");
      }
    } catch {
      alert("Network error — please try again");
    } finally {
      setStatusUpdating(null);
    }
  };

  const today = useMemo(() => getTodayString(), []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/${shopSlug}/barbers/${barberSlug}/appointments`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error || "Could not load appointments.");
          return;
        }
        setBarberName(data.barberName || barberSlug);
        if (data.barberPhotoUrl) setBarberPhotoUrl(data.barberPhotoUrl);
        if (data.timezone) setShopTimezone(data.timezone);
        setBookings(data.bookings || []);
        setPerms(data.perms ?? { can_edit_hours: false, can_edit_prices: false });
      } catch {
        setError("Unexpected error.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shopSlug, barberSlug]);

  const loadHours = useCallback(async () => {
    if (hoursLoaded) return;
    const res = await fetch(`/api/${shopSlug}/barbers/${barberSlug}/hours`);
    const data = await res.json();
    if (data.ok) {
      const loaded: HourRow[] = data.hours;
      const merged = DEFAULT_HOURS.map((def) => loaded.find((h) => h.day_of_week === def.day_of_week) ?? def);
      setHours(merged);
    }
    setHoursLoaded(true);
  }, [shopSlug, barberSlug, hoursLoaded]);

  const loadPrices = useCallback(async () => {
    if (pricesLoaded) return;
    const res = await fetch(`/api/${shopSlug}/barbers/${barberSlug}/prices`);
    const data = await res.json();
    if (data.ok) {
      setServices(data.services);
      const inputs: Record<string, string> = {};
      for (const s of data.services as ServicePrice[]) {
        inputs[s.id] = String(s.price);
      }
      setPriceInputs(inputs);
    }
    setPricesLoaded(true);
  }, [shopSlug, barberSlug, pricesLoaded]);

  // Check push permission state on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setPushEnabled(true);
        });
      }).catch(() => {});
    }
  }, []);

  async function togglePushNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch(`/api/${shopSlug}/push-subscribe`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint, barber_slug: barberSlug }),
          });
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setPushLoading(false); return; }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
        await fetch(`/api/${shopSlug}/push-subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON(), barber_slug: barberSlug }),
        });
        setPushEnabled(true);
      }
    } catch (e) {
      console.error("Push toggle error:", e);
    }
    setPushLoading(false);
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "hours" && !hoursLoaded) loadHours();
    if (tab === "prices" && !pricesLoaded) loadPrices();
  }

  function updateHourDay(dayIndex: number, field: keyof HourRow, value: string | boolean | null) {
    setHours((prev) =>
      prev.map((h) => (h.day_of_week === dayIndex ? { ...h, [field]: value } : h))
    );
    setHoursSaved(false);
  }

  async function saveHours() {
    setHoursSaving(true);
    const res = await fetch(`/api/${shopSlug}/barbers/${barberSlug}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    const data = await res.json();
    if (data.ok) {
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 3000);
    }
    setHoursSaving(false);
  }

  async function savePrices() {
    setPricesSaving(true);
    const overrides: Record<string, number> = {};
    for (const s of services) {
      const val = parseFloat(priceInputs[s.id] ?? String(s.price));
      if (!isNaN(val) && val >= 0) overrides[s.id] = val;
    }
    const res = await fetch(`/api/${shopSlug}/barbers/${barberSlug}/prices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    const data = await res.json();
    if (data.ok) {
      setPricesSaved(true);
      setTimeout(() => setPricesSaved(false), 3000);
    }
    setPricesSaving(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch(`/api/${shopSlug}/barbers/${barberSlug}/logout`, { method: "POST" });
    router.push(`/${shopSlug}/${barberSlug}/login`);
  }

  const filtered = useMemo(() => {
    return bookings
      .filter((b) => {
        const matchesToday = !showTodayOnly || b.appointment_date === today;
        const matchesStatus = statusFilter === "all" || b.status === statusFilter;
        return matchesToday && matchesStatus;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [bookings, showTodayOnly, statusFilter, today]);

  const stats = useMemo(() => {
    const todayBookings = bookings.filter((b) => b.appointment_date === today);
    const confirmed = bookings.filter((b) => b.status === "confirmed").length;
    const completedRevenue = bookings
      .filter((b) => b.status === "completed")
      .reduce((s, b) => s + Number(b.price_snapshot ?? b.services?.price ?? 0), 0);
    return {
      total: bookings.length,
      confirmed,
      todayCount: todayBookings.length,
      completedRevenue,
    };
  }, [bookings, today]);

  const hasTabs = true; // always show tabs (earnings always visible)

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", padding: "48px 24px" }}>
      <section style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Clickable photo upload */}
            <div
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/jpeg,image/png,image/webp,image/gif";
                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  fd.append("type", "barber_photo");
                  // Need barber id — get from admin upload endpoint via barber slug
                  fd.append("barber_slug", barberSlug);
                  const res = await fetch(`/api/${shopSlug}/barbers/${barberSlug}/photo`, { method: "POST", body: fd });
                  const data = await res.json();
                  if (data.ok) setBarberPhotoUrl(`${data.url}?v=${Date.now()}`);
                };
                input.click();
              }}
              title={barberPhotoUrl ? "Click to change photo" : "Click to add your photo"}
              style={{
                width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                cursor: "pointer", overflow: "hidden",
                border: barberPhotoUrl ? "2px solid #d4af37" : "2px dashed #3a3a3a",
                background: barberPhotoUrl ? "transparent" : "#111",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {barberPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={barberPhotoUrl} alt={barberName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 22, opacity: 0.35 }}>📷</span>
              )}
            </div>
            <div>
              <div style={{ color: "#d4af37", fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 10 }}>
                My Schedule
              </div>
              <h1 style={{ fontSize: 44, fontWeight: 900, margin: 0 }}>{barberName || barberSlug}</h1>
              <p style={{ color: "#666", fontSize: 15, marginTop: 8 }}>Your appointments only.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StripeConnectBadge shopSlug={shopSlug} barberSlug={barberSlug} />
            {"Notification" in (typeof window !== "undefined" ? window : {}) && (
              <button
                onClick={togglePushNotifications}
                disabled={pushLoading}
                title={pushEnabled ? "Disable push notifications" : "Enable push notifications"}
                style={{ ...secondaryBtn, fontSize: 18, padding: "8px 12px" }}
              >
                {pushLoading ? "…" : pushEnabled ? "🔔" : "🔕"}
              </button>
            )}
            <button onClick={handleLogout} disabled={loggingOut} style={secondaryBtn}>
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total Bookings", value: stats.total },
            { label: "Confirmed", value: stats.confirmed },
            { label: "Today", value: stats.todayCount },
            { label: "Earned", value: `$${stats.completedRevenue.toFixed(2)}`, gold: true },
          ].map((s) => (
            <div key={s.label} style={{ background: "#0d0d0d", border: "1px solid #232323", borderRadius: 20, padding: 18 }}>
              <div style={{ color: "#666", fontSize: 13 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.gold ? "#d4af37" : "#fff", marginTop: 8 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs — only shown if admin gave edit permissions */}
        {hasTabs && (
          <div style={{ display: "flex", gap: 6, marginBottom: 28, borderBottom: "1px solid #1a1a1a", paddingBottom: 0 }}>
            {(["schedule", "earnings", ...(perms.can_edit_hours ? ["hours"] : []), ...(perms.can_edit_prices ? ["prices"] : []), "stripe"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid #d4af37" : "2px solid transparent",
                  color: activeTab === tab ? "#d4af37" : "#555",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                  textTransform: "capitalize",
                  marginBottom: -1,
                }}
              >
                {tab === "schedule" ? "Schedule" : tab === "earnings" ? "Earnings" : tab === "hours" ? "My Hours" : tab === "prices" ? "My Prices" : "Payouts"}
              </button>
            ))}
          </div>
        )}

        {/* ── SCHEDULE TAB ── */}
        {activeTab === "schedule" && (
          <>
            {/* Filters */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => setShowTodayOnly((v) => !v)} style={showTodayOnly ? goldBtn : secondaryBtn}>
                Today Only
              </button>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <div style={{ color: "#555", fontSize: 14 }}>{filtered.length} shown</div>
            </div>

            {loading ? (
              <div style={emptyBox}>Loading appointments...</div>
            ) : error ? (
              <div style={{ ...emptyBox, color: "#ffb3b3", borderColor: "#532323" }}>{error}</div>
            ) : filtered.length === 0 ? (
              <div style={emptyBox}>No appointments found.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {filtered.map((b) => {
                  const isExpanded = expandedId === b.id;
                  const statusStyle = STATUS_COLORS[b.status];
                  return (
                    <div key={b.id} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 20, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 20, fontWeight: 800 }}>{b.customer_name}</span>
                            <span style={{
                              display: "inline-block", padding: "4px 10px", borderRadius: 999,
                              border: `1px solid ${statusStyle.borderColor as string}`,
                              background: statusStyle.background as string, color: statusStyle.color as string,
                              fontSize: 12, fontWeight: 700,
                            }}>
                              {STATUS_LABELS[b.status]}
                            </span>
                          </div>
                          <div style={{ color: "#d4af37", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                            {b.services?.name || "—"} · ${Number(b.services?.price || 0).toFixed(2)}
                          </div>
                          <div style={{ color: "#666", fontSize: 13, display: "flex", gap: 14, flexWrap: "wrap" }}>
                            <span>{formatDate(b.appointment_date)}</span>
                            <span>{formatTime(b.starts_at)} – {formatTime(b.ends_at)}</span>
                            <span>{b.customer_phone || "—"}</span>
                            <span style={{ color: "#444" }}>{b.booking_code}</span>
                          </div>
                        </div>
                        <button onClick={() => setExpandedId(isExpanded ? null : b.id)} style={secondaryBtn}>
                          {isExpanded ? "Close" : "View"}
                        </button>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1a1a1a", color: "#888", fontSize: 14, display: "grid", gap: 6 }}>
                          <div><span style={{ color: "#555" }}>Email: </span>{b.customer_email || "—"}</div>
                          <div><span style={{ color: "#555" }}>Duration: </span>{b.services?.duration_minutes ?? "—"} min</div>
                          <div><span style={{ color: "#555" }}>Payment: </span>{b.payment_status}</div>
                          {b.client_notes && <div><span style={{ color: "#555" }}>Notes: </span><span style={{ color: "#ccc" }}>{b.client_notes}</span></div>}
                          {(b.status === "confirmed" || b.status === "pending") && (
                            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                disabled={statusUpdating === b.id}
                                onClick={() => updateBookingStatus(b.id, "completed")}
                                style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#1e4400", color: "#5cd600", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: statusUpdating === b.id ? 0.6 : 1 }}
                              >
                                ✓ Mark Complete
                              </button>
                              <button
                                type="button"
                                disabled={statusUpdating === b.id}
                                onClick={() => {
                                  if (window.confirm(`Mark ${b.customer_name} as no-show?`)) updateBookingStatus(b.id, "no_show");
                                }}
                                style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #331500", background: "#1a0a00", color: "#ff9955", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: statusUpdating === b.id ? 0.6 : 1 }}
                              >
                                No Show
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── EARNINGS TAB ── */}
        {activeTab === "earnings" && (
          <EarningsTab bookings={bookings} timezone={shopTimezone} />
        )}

        {/* ── HOURS TAB ── */}
        {activeTab === "hours" && perms.can_edit_hours && (
          <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 20, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ color: "#d4af37", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>My Hours</div>
                <p style={{ color: "#555", fontSize: 13, margin: 0 }}>Set your own availability. Overrides shop hours.</p>
              </div>
              <button
                onClick={saveHours}
                disabled={hoursSaving}
                style={{ ...goldBtn, opacity: hoursSaving ? 0.6 : 1 }}
              >
                {hoursSaving ? "Saving..." : hoursSaved ? "✓ Saved" : "Save Hours"}
              </button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {hours.map((h) => (
                <div key={h.day_of_week} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => updateHourDay(h.day_of_week, "is_closed", !h.is_closed)}
                      style={{
                        width: 36, height: 20, borderRadius: 999, border: "none",
                        background: !h.is_closed ? "#d4af37" : "#2a2a2a",
                        position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.15s",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 3,
                        left: !h.is_closed ? 19 : 3, width: 14, height: 14,
                        borderRadius: "50%", background: "#fff", transition: "left 0.15s",
                      }} />
                    </button>
                    <span style={{ fontSize: 14, color: h.is_closed ? "#444" : "#fff", fontWeight: 600, width: 36 }}>
                      {DAY_FULL[h.day_of_week].slice(0, 3)}
                    </span>
                  </div>
                  {h.is_closed ? (
                    <span style={{ fontSize: 13, color: "#444" }}>Closed</span>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <select
                        value={h.open_time ?? "09:00"}
                        onChange={(e) => updateHourDay(h.day_of_week, "open_time", e.target.value)}
                        style={selectStyle}
                      >
                        {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <span style={{ color: "#444" }}>–</span>
                      <select
                        value={h.close_time ?? "18:00"}
                        onChange={(e) => updateHourDay(h.day_of_week, "close_time", e.target.value)}
                        style={selectStyle}
                      >
                        {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PRICES TAB ── */}
        {activeTab === "prices" && perms.can_edit_prices && (
          <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 20, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ color: "#d4af37", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>My Prices</div>
                <p style={{ color: "#555", fontSize: 13, margin: 0 }}>Set your own rates. Overrides shop prices for your bookings.</p>
              </div>
              <button
                onClick={savePrices}
                disabled={pricesSaving}
                style={{ ...goldBtn, opacity: pricesSaving ? 0.6 : 1 }}
              >
                {pricesSaving ? "Saving..." : pricesSaved ? "✓ Saved" : "Save Prices"}
              </button>
            </div>

            {services.length === 0 ? (
              <div style={emptyBox}>No services assigned yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {services.map((svc) => (
                  <div key={svc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "1px solid #141414" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{svc.name}</div>
                      <div style={{ color: "#555", fontSize: 13, marginTop: 3 }}>
                        {svc.duration_minutes} min
                        {svc.has_override && svc.price !== svc.base_price && (
                          <span style={{ color: "#444", marginLeft: 10, textDecoration: "line-through" }}>
                            shop: ${svc.base_price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#555", fontSize: 16 }}>$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceInputs[svc.id] ?? String(svc.price)}
                        onChange={(e) => {
                          setPriceInputs((prev) => ({ ...prev, [svc.id]: e.target.value }));
                          setPricesSaved(false);
                        }}
                        style={{
                          width: 90,
                          padding: "8px 12px",
                          background: "#111",
                          border: "1px solid #2a2a2a",
                          color: "#fff",
                          borderRadius: 8,
                          fontSize: 16,
                          fontWeight: 700,
                          outline: "none",
                          textAlign: "right",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PAYOUTS (STRIPE) TAB ── */}
        {activeTab === "stripe" && (
          <StripeConnectPanel shopSlug={shopSlug} barberSlug={barberSlug} />
        )}

      </section>
    </main>
  );
}

function StripeConnectBadge({ shopSlug, barberSlug }: { shopSlug: string; barberSlug: string }) {
  const [payoutsEnabled, setPayoutsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/${shopSlug}/barbers/${barberSlug}/stripe/status`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPayoutsEnabled(d.payouts_enabled); });
  }, [shopSlug, barberSlug]);

  if (payoutsEnabled === null || payoutsEnabled) return null;

  return (
    <a
      href={`/api/${shopSlug}/barbers/${barberSlug}/stripe/connect`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "#d4af37",
        color: "#000",
        fontWeight: 800,
        fontSize: 12,
        letterSpacing: "0.04em",
        padding: "8px 14px",
        borderRadius: 999,
        textDecoration: "none",
        animation: "stripe-pulse 1.8s ease-in-out infinite",
      }}
    >
      <style>{`@keyframes stripe-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }`}</style>
      ⚡ Connect Stripe
    </a>
  );
}

function StripeConnectPanel({ shopSlug, barberSlug }: { shopSlug: string; barberSlug: string }) {
  const [status, setStatus] = useState<{ connected: boolean; payouts_enabled: boolean; details_submitted: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/${shopSlug}/barbers/${barberSlug}/stripe/status`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setStatus(d); })
      .finally(() => setLoading(false));
  }, [shopSlug, barberSlug]);

  if (loading) return null;

  const connectUrl = `/api/${shopSlug}/barbers/${barberSlug}/stripe/connect`;

  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 20, padding: 28, maxWidth: 480 }}>
      <div style={{ color: "#d4af37", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>Payouts</div>
      <p style={{ color: "#555", fontSize: 13, margin: "0 0 20px" }}>
        Connect your Stripe account so booking deposits go directly to your bank.
      </p>

      {status?.payouts_enabled ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Payouts Active</div>
            <div style={{ color: "#555", fontSize: 13 }}>Deposits route directly to your bank account.</div>
          </div>
        </div>
      ) : status?.details_submitted ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⏳</span>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Under Review</div>
            <div style={{ color: "#555", fontSize: 13 }}>Stripe is reviewing your info — usually 1–2 business days.</div>
          </div>
        </div>
      ) : (
        <a
          href={connectUrl}
          style={{ display: "inline-block", background: "#d4af37", color: "#000", fontWeight: 800, fontSize: 14, padding: "12px 24px", borderRadius: 10, textDecoration: "none" }}
        >
          {status?.connected ? "Continue Setup →" : "Set Up Payouts →"}
        </a>
      )}
    </div>
  );
}

const secondaryBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #2d2d2d",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const goldBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const selectStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#111",
  border: "1px solid #2d2d2d",
  color: "#fff",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  cursor: "pointer",
};

const emptyBox: React.CSSProperties = {
  border: "1px dashed #2a2a2a",
  borderRadius: 18,
  padding: 28,
  textAlign: "center",
  color: "#9a9a9a",
  background: "#070707",
};

function EarningsTab({ bookings, timezone }: { bookings: Booking[]; timezone: string }) {
  const tz = timezone || "America/Chicago";

  // Get "today" as YYYY-MM-DD in the shop's timezone
  const nowInTz = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // en-CA gives YYYY-MM-DD
  const [y, mo, d] = nowInTz.split("-").map(Number);

  // Start of current month (YYYY-MM-01) in shop tz
  const monthStart = `${y}-${String(mo).padStart(2, "0")}-01`;

  // Start of current week (Sunday) in shop tz — treat the date as UTC to get correct day-of-week
  const nowDateUTC = new Date(Date.UTC(y, mo - 1, d));
  const dowSunday = nowDateUTC.getUTCDay(); // 0=Sun
  const weekStartUTC = new Date(Date.UTC(y, mo - 1, d - dowSunday));
  const weekStart = weekStartUTC.toISOString().slice(0, 10); // YYYY-MM-DD

  // Get an appointment's date in the shop timezone for comparison
  function apptDateInTz(isoStr: string) {
    return new Date(isoStr).toLocaleDateString("en-CA", { timeZone: tz });
  }

  const completed = bookings.filter((b) => b.status === "completed");

  function rev(list: Booking[]) {
    return list.reduce((s, b) => s + Number(b.price_snapshot ?? b.services?.price ?? 0), 0);
  }

  const totalEarned = rev(completed);
  const weekEarned = rev(completed.filter((b) => apptDateInTz(b.starts_at) >= weekStart));
  const monthEarned = rev(completed.filter((b) => apptDateInTz(b.starts_at) >= monthStart));

  // By service
  const bySvc = new Map<string, { name: string; count: number; revenue: number }>();
  for (const b of completed) {
    const name = b.services?.name ?? "Unknown";
    const price = Number(b.price_snapshot ?? b.services?.price ?? 0);
    const existing = bySvc.get(name);
    if (existing) { existing.count++; existing.revenue += price; }
    else bySvc.set(name, { name, count: 1, revenue: price });
  }
  const byService = Array.from(bySvc.values()).sort((a, b) => b.revenue - a.revenue);

  // Last 30 days by day for a simple trend
  const last30: Record<string, number> = {};
  const cutoffUTC = new Date(Date.UTC(y, mo - 1, d - 30));
  const cutoffStr = cutoffUTC.toISOString().slice(0, 10); // YYYY-MM-DD
  for (const b of completed) {
    const apptDate = apptDateInTz(b.starts_at);
    if (apptDate >= cutoffStr) {
      last30[apptDate] = (last30[apptDate] ?? 0) + Number(b.price_snapshot ?? b.services?.price ?? 0);
    }
  }

  const card = (label: string, value: string, gold = false) => (
    <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ color: "#555", fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: gold ? "#d4af37" : "#fff" }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
        {card("This Week", `$${weekEarned.toFixed(2)}`, true)}
        {card("This Month", `$${monthEarned.toFixed(2)}`)}
        {card("All Time", `$${totalEarned.toFixed(2)}`)}
      </div>

      {byService.length > 0 && (
        <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 16, padding: 22, marginBottom: 20 }}>
          <p style={{ color: "#555", fontSize: 12, marginBottom: 14, fontWeight: 700 }}>REVENUE BY SERVICE</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {byService.map((s) => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{s.name}</span>
                  <span style={{ color: "#555", fontSize: 13, marginLeft: 8 }}>{s.count}×</span>
                </div>
                <span style={{ color: "#d4af37", fontWeight: 800 }}>${s.revenue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(last30).length > 0 && (
        <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 16, padding: 22 }}>
          <p style={{ color: "#555", fontSize: 12, marginBottom: 14, fontWeight: 700 }}>LAST 30 DAYS</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(last30)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([date, amount]) => (
                <div key={date} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#888", fontSize: 14 }}>
                    {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span style={{ fontWeight: 700 }}>${amount.toFixed(2)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {completed.length === 0 && (
        <div style={{ color: "#555", textAlign: "center", padding: 40 }}>No completed bookings yet.</div>
      )}
    </div>
  );
}
