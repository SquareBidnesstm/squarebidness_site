import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../lib/auth";
import NavLogo from "../../../../components/NavLogo";
import PromoManager from "../../../../components/PromoManager";

export const revalidate = 0;

export default async function PromosPage() {
  const cookieStore = await cookies();
  const session = cookieStore.getAll().find(c => c.name.startsWith("org_session_"));
  if (!session) redirect("/organizer/login");
  const slug = session.name.replace("org_session_", "");
  const expected = await computeOrganizerSessionToken(slug);
  if (session.value !== expected) redirect("/organizer/login");

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name")
    .eq("slug", slug)
    .single();
  if (!organizer) redirect("/organizer/login");

  const { data: events } = await supabaseServer
    .from("events")
    .select("id, title")
    .eq("organizer_id", organizer.id)
    .eq("status", "published")
    .order("starts_at", { ascending: false });

  const { data: promos } = await supabaseServer
    .from("promo_codes")
    .select("*, events(title)")
    .eq("organizer_id", organizer.id)
    .order("created_at", { ascending: false });

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
        <div className="wrap">
          <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>Promo Codes</h1>
          <p style={{ color: "#a1a1aa", marginBottom: 28, fontSize: "0.9rem" }}>{organizer.name}</p>
          <PromoManager
            promos={promos ?? []}
            events={events ?? []}
          />
        </div>
      </main>
    </div>
  );
}
