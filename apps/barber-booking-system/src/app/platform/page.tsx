"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type ShopRow = {
  id: string; slug: string; name: string; city: string; state: string;
  owner_name: string; active: boolean; created_at: string;
  plan: string; subscription_status: string;
  total_bookings: number; total_revenue: number; completed_revenue: number;
};

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
          <button onClick={handleLogout} style={btnSecondary}>Sign out</button>
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
                        <span style={{
                          padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: s.plan === "pro" ? "#1a1200" : "#111",
                          color: s.plan === "pro" ? "#d4af37" : "#555",
                          border: `1px solid ${s.plan === "pro" ? "#3a2a00" : "#1f1f1f"}`,
                        }}>
                          {s.plan === "pro" ? "Pro" : "Free"}
                        </span>
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
