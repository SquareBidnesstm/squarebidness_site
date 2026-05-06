"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ShopRow = {
  id: string; slug: string; name: string; city: string; state: string;
  owner_name: string; active: boolean; created_at: string;
  plan: string; subscription_status: string;
  total_bookings: number; total_revenue: number; completed_revenue: number;
};

type Stats = {
  totalShops: number; proShops: number; totalBookingsAll: number; totalRevenueAll: number;
};

function formatMoney(n: number) { return `$${Number(n).toFixed(2)}`; }
function formatDate(s: string) { return new Date(s).toLocaleDateString(); }

export default function PlatformAdminPage() {
  const router = useRouter();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/platform/admin/shops");
        if (res.status === 401) { router.push("/platform/login"); return; }
        const data = await res.json();
        if (data.ok) { setShops(data.shops); setStats(data.stats); }
        else setError(data.error || "Failed to load.");
      } catch { setError("Network error."); }
      finally { setLoading(false); }
    }
    load();
  }, [router]);

  const filtered = shops.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.slug.includes(q) || s.city.toLowerCase().includes(q) || s.owner_name.toLowerCase().includes(q);
  });

  async function handleLogout() {
    await fetch("/api/platform/admin/logout", { method: "POST" }).catch(() => {});
    router.push("/platform/login");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", padding: "48px 24px" }}>
      <section style={{ maxWidth: 1400, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <div style={{ color: "#d4af37", fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 8 }}>
              SquareBidness
            </div>
            <h1 style={{ fontSize: 48, fontWeight: 900, margin: 0 }}>Platform Admin</h1>
            <p style={{ color: "#555", marginTop: 8, fontSize: 15 }}>All shops across the platform.</p>
          </div>
          <button onClick={handleLogout} style={secondaryBtn}>Sign out</button>
        </div>

        {/* Platform stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard label="Total Shops" value={stats.totalShops} />
            <StatCard label="Pro Shops" value={stats.proShops} gold />
            <StatCard label="Total Bookings" value={stats.totalBookingsAll} />
            <StatCard label="Platform Revenue" value={formatMoney(stats.totalRevenueAll)} gold />
          </div>
        )}

        <div style={{ border: "1px solid #1a1a1a", background: "#0a0a0a", borderRadius: 24, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>
              Shops <span style={{ color: "#555", fontWeight: 400, fontSize: 16 }}>({filtered.length})</span>
            </h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shops..."
              style={{ padding: "10px 14px", background: "#111", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 10, fontSize: 14, outline: "none", width: 240 }}
            />
          </div>

          {loading ? (
            <div style={emptyBox}>Loading shops...</div>
          ) : error ? (
            <div style={{ ...emptyBox, color: "#ffb3b3" }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={emptyBox}>No shops found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1f1f1f" }}>
                    {["Shop", "Owner", "Location", "Plan", "Bookings", "Revenue", "Joined", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #111" }}>
                      <td style={{ padding: "14px", fontWeight: 700 }}>
                        <div>{s.name}</div>
                        <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>/{s.slug}</div>
                      </td>
                      <td style={{ padding: "14px", color: "#aaa" }}>{s.owner_name}</td>
                      <td style={{ padding: "14px", color: "#aaa" }}>{s.city}, {s.state}</td>
                      <td style={{ padding: "14px" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                          background: s.plan === "pro" ? "#1a1200" : "#111",
                          color: s.plan === "pro" ? "#d4af37" : "#555",
                          border: `1px solid ${s.plan === "pro" ? "#3a2a00" : "#222"}`,
                        }}>
                          {s.plan === "pro" ? "Pro" : "Free"}
                        </span>
                      </td>
                      <td style={{ padding: "14px", color: "#aaa" }}>{s.total_bookings}</td>
                      <td style={{ padding: "14px", color: "#d4af37", fontWeight: 700 }}>{formatMoney(s.total_revenue)}</td>
                      <td style={{ padding: "14px", color: "#555" }}>{formatDate(s.created_at)}</td>
                      <td style={{ padding: "14px" }}>
                        <a
                          href={`https://booking.squarebidness.com/${s.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#d4af37", fontSize: 13, textDecoration: "none" }}
                        >
                          View →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div style={{ border: "1px solid #1a1a1a", background: "#0d0d0d", borderRadius: 20, padding: 20 }}>
      <div style={{ color: "#555", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8, color: gold ? "#d4af37" : "#fff" }}>{value}</div>
    </div>
  );
}

const secondaryBtn: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 10, border: "1px solid #2a2a2a",
  background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
};

const emptyBox: React.CSSProperties = {
  border: "1px dashed #1a1a1a", borderRadius: 14, padding: 28,
  textAlign: "center", color: "#555", background: "#070707",
};
