import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../lib/auth";
import NavLogo from "../../../../components/NavLogo";
import ReferralManager from "../../../../components/ReferralManager";

export const revalidate = 0;

const BASE_URL = "https://events.squarebidness.com";

export default async function ReferralsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.getAll().find(c => c.name.startsWith("org_session_"));
  if (!session) redirect("/organizer/login");
  const slug = session.name.replace("org_session_", "");
  const expected = await computeOrganizerSessionToken(slug);
  if (session.value !== expected) redirect("/organizer/login");

  const { data: organizer } = await supabaseServer
    .from("organizers").select("id, name").eq("slug", slug).single();
  if (!organizer) redirect("/organizer/login");

  const [{ data: codes }, { data: events }] = await Promise.all([
    supabaseServer
      .from("referral_codes")
      .select(`id, code, name, event_id, uses, created_at, events ( title, slug )`)
      .eq("organizer_id", organizer.id)
      .order("created_at", { ascending: false }),
    supabaseServer
      .from("events")
      .select("id, title, slug")
      .eq("organizer_id", organizer.id)
      .eq("status", "published")
      .order("starts_at", { ascending: false }),
  ]);

  // For each code, count revenue from orders with that ref_code
  const codeList = codes ?? [];
  const orderStats: Record<string, { orders: number; revenue: number }> = {};
  if (codeList.length > 0) {
    const allCodes = codeList.map(c => c.code);
    const { data: orders } = await supabaseServer
      .from("orders")
      .select("ref_code, total")
      .in("ref_code", allCodes)
      .eq("status", "paid");
    for (const o of orders ?? []) {
      if (!o.ref_code) continue;
      orderStats[o.ref_code] = orderStats[o.ref_code] ?? { orders: 0, revenue: 0 };
      orderStats[o.ref_code].orders++;
      orderStats[o.ref_code].revenue += Number(o.total);
    }
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000" }}>
        <NavLogo />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/organizer/dashboard" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← Dashboard</Link>
          <a href="/api/organizer/logout" className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>Sign Out</a>
        </div>
      </nav>

      <main style={{ padding: "32px 14px 80px" }}>
        <div className="wrap" style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>Referral Links</h1>
          <p style={{ color: "#a1a1aa", marginBottom: 28, fontSize: "0.9rem" }}>
            Create trackable links to see who's driving your ticket sales. Share them with influencers, street teams, or anyone repping your event.
          </p>

          <ReferralManager
            events={(events ?? []).map(e => ({ id: e.id, title: e.title, slug: e.slug }))}
            baseUrl={BASE_URL}
          />

          {/* Existing codes */}
          {codeList.length > 0 && (
            <div className="card" style={{ marginTop: 28, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #111" }}>
                <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Your Codes ({codeList.length})
                </p>
              </div>
              {codeList.map((rc: any) => {
                const stats = orderStats[rc.code] ?? { orders: 0, revenue: 0 };
                const eventSlug = rc.events?.slug;
                const link = eventSlug
                  ? `${BASE_URL}/events/${eventSlug}?ref=${rc.code}`
                  : `${BASE_URL}/?ref=${rc.code}`;
                return (
                  <div key={rc.id} style={{ padding: "14px 16px", borderBottom: "1px solid #0a0a0a", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 900, marginBottom: 2 }}>{rc.name}</p>
                      <p style={{ color: "#555", fontSize: "0.75rem", fontFamily: "monospace", marginBottom: 6 }}>{rc.code}</p>
                      {rc.events?.title && (
                        <p style={{ color: "#a1a1aa", fontSize: "0.78rem", marginBottom: 6 }}>
                          For: {rc.events.title}
                        </p>
                      )}
                      <p style={{ color: "#555", fontSize: "0.75rem", wordBreak: "break-all" }}>{link}</p>
                    </div>
                    <div style={{ display: "flex", gap: 20, flexShrink: 0, textAlign: "center" }}>
                      <div>
                        <p style={{ fontSize: "1.3rem", fontWeight: 950, color: "#22c55e" }}>{stats.orders}</p>
                        <p style={{ color: "#555", fontSize: "0.7rem" }}>orders</p>
                      </div>
                      <div>
                        <p style={{ fontSize: "1.3rem", fontWeight: 950 }}>${stats.revenue.toFixed(0)}</p>
                        <p style={{ color: "#555", fontSize: "0.7rem" }}>revenue</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
