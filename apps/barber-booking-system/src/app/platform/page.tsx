"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type ShopRow = {
  id: string; slug: string; name: string; city: string; state: string;
  owner_name: string; active: boolean; created_at: string;
  plan: string; subscription_status: string;
  total_bookings: number; total_revenue: number; completed_revenue: number;
  bypass_stripe_requirement: boolean;
};

type PlanModal = { shop: ShopRow; plan: string; status: string };

type Stats = {
  totalShops: number; activeShops: number; proShops: number;
  totalBookingsAll: number; totalRevenueAll: number;
  signupsToday: number; signupsThisWeek: number; signupsThisMonth: number;
};

const fmt$ = (n: number) => `$${Number(n).toFixed(2)}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function PlatformAdminPage() {
  const router = useRouter();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [confirmDelete, setConfirmDelete] = useState<ShopRow | null>(null);
  const [working, setWorking] = useState<string | null>(null); // shopId of in-flight action
  const [planModal, setPlanModal] = useState<PlanModal | null>(null);
  const [addShopOpen, setAddShopOpen] = useState(false);
  const [addShopForm, setAddShopForm] = useState({ name: "", slug: "", ownerName: "", city: "", state: "LA", barberName: "", pin: "" });
  const [addShopError, setAddShopError] = useState("");
  const [addShopWorking, setAddShopWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/admin/shops");
      if (res.status === 401) { router.push("/platform/login"); return; }
      const data = await res.json();
      if (data.ok) { setShops(data.shops); setStats(data.stats); }
      else setError(data.error || "Failed to load.");
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await fetch("/api/platform/admin/logout", { method: "POST" }).catch(() => {});
    router.push("/platform/login");
  }

  async function toggleActive(shop: ShopRow) {
    setWorking(shop.id);
    try {
      const res = await fetch(`/api/platform/admin/shops/${shop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !shop.active }),
      });
      if (res.ok) {
        setShops((prev) => prev.map((s) => s.id === shop.id ? { ...s, active: !shop.active } : s));
      }
    } finally { setWorking(null); }
  }

  async function toggleBypass(shop: ShopRow) {
    setWorking(shop.id);
    try {
      const res = await fetch(`/api/platform/admin/shops/${shop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bypass_stripe_requirement: !shop.bypass_stripe_requirement }),
      });
      if (res.ok) {
        setShops((prev) => prev.map((s) => s.id === shop.id ? { ...s, bypass_stripe_requirement: !shop.bypass_stripe_requirement } : s));
      }
    } finally { setWorking(null); }
  }

  async function createShop() {
    setAddShopError("");
    setAddShopWorking(true);
    try {
      const res = await fetch("/api/platform/admin/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addShopForm.name, slug: addShopForm.slug,
          ownerName: addShopForm.ownerName, city: addShopForm.city, state: addShopForm.state,
          barberName: addShopForm.barberName, pin: addShopForm.pin,
          timezone: "America/Chicago",
        }),
      });
      const data = await res.json();
      if (!data.ok) { setAddShopError(data.error || "Failed."); return; }
      setAddShopOpen(false);
      setAddShopForm({ name: "", slug: "", ownerName: "", city: "", state: "LA", barberName: "", pin: "" });
      await load();
      alert(`✅ ${data.shopName} created!\nBooking: ${data.bookingUrl}\nAdmin: ${data.adminUrl}\nPIN: ${addShopForm.pin}`);
    } finally { setAddShopWorking(false); }
  }

  async function savePlan(modal: PlanModal) {
    setWorking(modal.shop.id);
    setPlanModal(null);
    try {
      const res = await fetch(`/api/platform/admin/shops/${modal.shop.id}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: modal.plan, status: modal.status }),
      });
      if (res.ok) {
        setShops((prev) => prev.map((s) =>
          s.id === modal.shop.id
            ? { ...s, plan: modal.plan, subscription_status: modal.status }
            : s
        ));
      }
    } finally { setWorking(null); }
  }

  async function deleteShop(shop: ShopRow) {
    setWorking(shop.id);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/platform/admin/shops/${shop.id}`, { method: "DELETE" });
      if (res.ok) {
        setShops((prev) => prev.filter((s) => s.id !== shop.id));
        await load(); // refresh stats
      }
    } finally { setWorking(null); }
  }

  const filtered = shops.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.slug.includes(q)
      || s.city.toLowerCase().includes(q) || s.owner_name.toLowerCase().includes(q);
    const matchFilter = filterActive === "all" || (filterActive === "active" ? s.active : !s.active);
    return matchSearch && matchFilter;
  });

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", padding: "40px 24px" }}>
      <section style={{ maxWidth: 1500, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <div style={{ color: "#d4af37", fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 6 }}>SquareBidness</div>
            <h1 style={{ fontSize: 42, fontWeight: 900, margin: 0 }}>Platform Admin</h1>
            <p style={{ color: "#444", marginTop: 6, fontSize: 14 }}>Full control over all shops on the platform.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setAddShopOpen(true)} style={{ ...btnSecondary, background: "#d4af37", color: "#000", border: "none" }}>+ Add Shop</button>
            <button onClick={handleLogout} style={btnSecondary}>Sign out</button>
          </div>
        </div>

        {/* Stats — two rows */}
        {stats && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
              <StatCard label="Total Shops" value={stats.totalShops} />
              <StatCard label="Active Shops" value={stats.activeShops} />
              <StatCard label="Pro Shops" value={stats.proShops} gold />
              <StatCard label="Total Bookings" value={stats.totalBookingsAll} />
              <StatCard label="Platform Revenue" value={fmt$(stats.totalRevenueAll)} gold />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
              <StatCard label="New Shops Today" value={stats.signupsToday} accent />
              <StatCard label="New Shops This Week" value={stats.signupsThisWeek} accent />
              <StatCard label="New Shops This Month" value={stats.signupsThisMonth} accent />
            </div>
          </>
        )}

        {/* Shops table */}
        <div style={{ border: "1px solid #1a1a1a", background: "#080808", borderRadius: 20, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
              Shops <span style={{ color: "#444", fontWeight: 400, fontSize: 15 }}>({filtered.length})</span>
            </h2>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {/* Filter tabs */}
              {(["all", "active", "inactive"] as const).map((f) => (
                <button key={f} onClick={() => setFilterActive(f)} style={{
                  padding: "7px 14px", borderRadius: 8, border: "1px solid",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: filterActive === f ? "#1a1a1a" : "transparent",
                  color: filterActive === f ? "#fff" : "#555",
                  borderColor: filterActive === f ? "#333" : "#1a1a1a",
                }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search shops..."
                style={{ padding: "9px 14px", background: "#111", border: "1px solid #222", color: "#fff", borderRadius: 10, fontSize: 14, outline: "none", width: 220 }}
              />
            </div>
          </div>

          {loading ? (
            <div style={emptyBox}>Loading shops...</div>
          ) : error ? (
            <div style={{ ...emptyBox, color: "#ffb3b3" }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={emptyBox}>No shops found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                    {["Shop", "Owner", "Location", "Plan", "Status", "Bookings", "Revenue", "Joined", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#444", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #111", opacity: working === s.id ? 0.5 : 1 }}>
                      <td style={{ padding: "13px 12px", fontWeight: 700 }}>
                        <div>{s.name}</div>
                        <div style={{ color: "#444", fontSize: 11, marginTop: 2 }}>/{s.slug}</div>
                      </td>
                      <td style={{ padding: "13px 12px", color: "#ccc" }}>{s.owner_name}</td>
                      <td style={{ padding: "13px 12px", color: "#777" }}>{s.city}, {s.state}</td>
                      <td style={{ padding: "13px 12px" }}>
                        {(() => {
                          const isPaid = s.plan !== "free";
                          const isTrialing = s.subscription_status === "trialing";
                          return (
                            <span style={{
                              padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                              background: isPaid ? "#1a1200" : "#111",
                              color: isPaid ? (isTrialing ? "#f97316" : "#d4af37") : "#555",
                              border: `1px solid ${isPaid ? "#3a2a00" : "#1f1f1f"}`,
                            }}>
                              {isPaid ? `${s.plan.charAt(0).toUpperCase() + s.plan.slice(1)}${isTrialing ? " (trial)" : ""}` : "Free"}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "13px 12px" }}>
                        <span style={{
                          padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: s.active ? "#001a0a" : "#1a0000",
                          color: s.active ? "#22c55e" : "#ef4444",
                          border: `1px solid ${s.active ? "#003a1a" : "#3a0000"}`,
                        }}>
                          {s.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "13px 12px", color: "#777" }}>{s.total_bookings}</td>
                      <td style={{ padding: "13px 12px", color: "#d4af37", fontWeight: 700 }}>{fmt$(s.total_revenue)}</td>
                      <td style={{ padding: "13px 12px", color: "#444" }}>{fmtDate(s.created_at)}</td>
                      <td style={{ padding: "13px 12px" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <a
                            href={`https://booking.squarebidness.com/${s.slug}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ ...btnTiny, color: "#d4af37", borderColor: "#3a2a00", background: "#0d0900", textDecoration: "none" }}
                          >
                            View
                          </a>
                          <a
                            href={`https://booking.squarebidness.com/${s.slug}/admin`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ ...btnTiny, color: "#888", borderColor: "#222", background: "#111", textDecoration: "none" }}
                          >
                            Admin
                          </a>
                          <button
                            onClick={() => toggleActive(s)}
                            disabled={working === s.id}
                            style={{ ...btnTiny, color: s.active ? "#f97316" : "#22c55e", borderColor: s.active ? "#3a1a00" : "#003a1a", background: s.active ? "#1a0a00" : "#001a0a", cursor: "pointer" }}
                          >
                            {s.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => toggleBypass(s)}
                            disabled={working === s.id}
                            title={s.bypass_stripe_requirement ? "Stripe gate bypassed — click to enforce" : "Bypass Stripe requirement for this shop"}
                            style={{ ...btnTiny, color: s.bypass_stripe_requirement ? "#22c55e" : "#555", borderColor: s.bypass_stripe_requirement ? "#003a1a" : "#1f1f1f", background: s.bypass_stripe_requirement ? "#001a0a" : "#0a0a0a", cursor: "pointer" }}
                          >
                            {s.bypass_stripe_requirement ? "Bypass ON" : "Bypass"}
                          </button>
                          <button
                            onClick={() => setPlanModal({ shop: s, plan: s.plan, status: s.subscription_status })}
                            disabled={working === s.id}
                            style={{ ...btnTiny, color: "#38bdf8", borderColor: "#002a3a", background: "#00111a", cursor: "pointer" }}
                          >
                            Set Plan
                          </button>
                          <button
                            onClick={() => setConfirmDelete(s)}
                            disabled={working === s.id}
                            style={{ ...btnTiny, color: "#ef4444", borderColor: "#3a0000", background: "#1a0000", cursor: "pointer" }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Add Shop modal */}
      {addShopOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24 }}>
          <div style={{ background: "#0d0d0d", border: "1px solid #2a1a00", borderRadius: 20, padding: 32, maxWidth: 480, width: "100%" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: "#d4af37" }}>Add Shop</h3>
            <p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>Lifetime free · bypass enabled · bookings open immediately</p>
            {addShopError && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "#1a0000", borderRadius: 8 }}>{addShopError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {[
                { label: "SHOP NAME", key: "name", placeholder: "e.g. Green Kutz Barbershop" },
                { label: "URL SLUG", key: "slug", placeholder: "e.g. greenkutz" },
                { label: "OWNER NAME", key: "ownerName", placeholder: "e.g. Sedrick Rogers" },
                { label: "CITY", key: "city", placeholder: "e.g. Natchitoches" },
                { label: "STATE", key: "state", placeholder: "LA" },
                { label: "PRIMARY BARBER NAME", key: "barberName", placeholder: "e.g. Sedrick Rogers" },
                { label: "ADMIN + BARBER PIN (4 digits)", key: "pin", placeholder: "e.g. 1234" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <div style={{ color: "#888", fontSize: 11, letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
                  <input
                    type={key === "pin" ? "password" : "text"}
                    value={(addShopForm as Record<string, string>)[key]}
                    onChange={(e) => setAddShopForm({ ...addShopForm, [key]: e.target.value })}
                    placeholder={placeholder}
                    style={{ width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #222", color: "#fff", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={createShop}
                disabled={addShopWorking}
                style={{ flex: 1, padding: "13px", borderRadius: 10, border: "none", background: "#d4af37", color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: addShopWorking ? 0.6 : 1 }}
              >
                {addShopWorking ? "Creating..." : "Create Shop"}
              </button>
              <button
                onClick={() => { setAddShopOpen(false); setAddShopError(""); }}
                style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid #222", background: "#111", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Plan modal */}
      {planModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24 }}>
          <div style={{ background: "#0d0d0d", border: "1px solid #002a3a", borderRadius: 20, padding: 32, maxWidth: 400, width: "100%" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "#38bdf8" }}>Set Subscription</h3>
            <p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>{planModal.shop.name} / /{planModal.shop.slug}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
              <div>
                <div style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>PLAN</div>
                <select
                  value={planModal.plan}
                  onChange={(e) => setPlanModal({ ...planModal, plan: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #222", color: "#fff", borderRadius: 8, fontSize: 14 }}
                >
                  <option value="free">Free</option>
                  <option value="solo">Solo</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <div style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>STATUS</div>
                <select
                  value={planModal.status}
                  onChange={(e) => setPlanModal({ ...planModal, status: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", background: "#111", border: "1px solid #222", color: "#fff", borderRadius: 8, fontSize: 14 }}
                >
                  <option value="active">Active (bookings allowed)</option>
                  <option value="trialing">Trialing (bookings allowed)</option>
                  <option value="free">Inactive (bookings blocked)</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => savePlan(planModal)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#38bdf8", color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}
              >
                Save
              </button>
              <button
                onClick={() => setPlanModal(null)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #222", background: "#111", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24 }}>
          <div style={{ background: "#0d0d0d", border: "1px solid #2a0000", borderRadius: 20, padding: 32, maxWidth: 420, width: "100%" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#ef4444" }}>Delete Shop?</h3>
            <p style={{ color: "#aaa", marginBottom: 8, lineHeight: 1.6 }}>
              This will permanently delete <strong style={{ color: "#fff" }}>{confirmDelete.name}</strong> and all its bookings, barbers, and settings.
            </p>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => deleteShop(confirmDelete)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}
              >
                Yes, Delete Forever
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #222", background: "#111", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ label, value, gold, accent }: { label: string; value: string | number; gold?: boolean; accent?: boolean }) {
  return (
    <div style={{ border: `1px solid ${gold ? "#2a1a00" : accent ? "#001a2a" : "#161616"}`, background: "#0a0a0a", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ color: "#555", fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: gold ? "#d4af37" : accent ? "#38bdf8" : "#fff" }}>{value}</div>
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 10, border: "1px solid #2a2a2a",
  background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
};

const btnTiny: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, border: "1px solid",
  fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
};

const emptyBox: React.CSSProperties = {
  border: "1px dashed #1a1a1a", borderRadius: 14, padding: 28,
  textAlign: "center", color: "#555", background: "#070707",
};
