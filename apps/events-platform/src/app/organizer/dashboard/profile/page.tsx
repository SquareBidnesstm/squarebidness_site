import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../lib/auth";
import NavLogo from "../../../../components/NavLogo";

export const revalidate = 0;

export default async function OrganizerProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
  if (!sessionCookie) redirect("/organizer/login");

  const organizerSlug = sessionCookie.name.replace("org_session_", "");
  const expectedToken = await computeOrganizerSessionToken(organizerSlug);
  if (sessionCookie.value !== expectedToken) redirect("/organizer/login");

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name, email, slug, bio, logo_url")
    .eq("slug", organizerSlug)
    .single();

  if (!organizer) redirect("/organizer/login");

  const inputStyle = {
    width: "100%", background: "#0a0a0a", border: "1px solid #2a2a2d",
    borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: "0.95rem",
    outline: "none", boxSizing: "border-box" as const,
  };
  const labelStyle = {
    fontSize: "0.8rem", fontWeight: 900 as const, color: "#a1a1aa",
    letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6, display: "block",
  };

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
        <div className="wrap" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>Organizer Profile</h1>
          <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginBottom: 28 }}>
            This info appears on your public profile at{" "}
            <a href={`https://events.squarebidness.com/organizer/${organizer.slug}`} target="_blank" style={{ color: "#d4af37" }}>
              /organizer/{organizer.slug}
            </a>
          </p>

          {saved && (
            <div style={{ background: "#0a2a0a", border: "1px solid #166534", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#22c55e", fontSize: "0.9rem" }}>
              ✓ Profile saved.
            </div>
          )}
          {error && (
            <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#f87171", fontSize: "0.9rem" }}>
              Something went wrong. Please try again.
            </div>
          )}

          <form action="/api/organizer/update-profile" method="POST">
            <div style={{ display: "grid", gap: 20 }}>

              <div className="card">
                <p style={{ fontWeight: 900, marginBottom: 16 }}>Public Info</p>
                <div style={{ display: "grid", gap: 14 }}>

                  {organizer.logo_url && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
                      <img src={organizer.logo_url} alt="Logo" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid #2a2a2d" }} />
                      <p style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>Current logo</p>
                    </div>
                  )}

                  <div>
                    <label style={labelStyle}>Logo URL</label>
                    <input
                      name="logo_url"
                      type="url"
                      defaultValue={organizer.logo_url ?? ""}
                      placeholder="https://..."
                      style={inputStyle}
                    />
                    <p style={{ color: "#555", fontSize: "0.78rem", marginTop: 4 }}>Paste a direct image link. Square images work best.</p>
                  </div>

                  <div>
                    <label style={labelStyle}>Display Name</label>
                    <input
                      name="name"
                      defaultValue={organizer.name}
                      required
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Bio</label>
                    <textarea
                      name="bio"
                      defaultValue={organizer.bio ?? ""}
                      rows={4}
                      placeholder="Tell attendees about your events and brand…"
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn btn--primary" style={{ flex: 1, minHeight: 48 }}>
                  Save Profile
                </button>
                <Link href="/organizer/dashboard" className="btn btn--ghost" style={{ minHeight: 48, padding: "0 20px" }}>
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
