import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../../../lib/auth";
import { EVENT_CATEGORIES } from "../../../../../../lib/constants";
import NavLogo from "../../../../../../components/NavLogo";

export const revalidate = 0;

function toLocalDatetimeValue(isoString: string) {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
  if (!sessionCookie) redirect("/organizer/login");

  const organizerSlug = sessionCookie.name.replace("org_session_", "");
  const expectedToken = await computeOrganizerSessionToken(organizerSlug);
  if (sessionCookie.value !== expectedToken) redirect("/organizer/login");

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name")
    .eq("slug", organizerSlug)
    .single();
  if (!organizer) redirect("/organizer/login");

  const { data: event } = await supabaseServer
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("organizer_id", organizer.id)
    .single();

  if (!event) notFound();

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
          <Link href={`/organizer/dashboard/events/${id}`} style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← Back</Link>
          <a href="/api/organizer/logout" className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>Sign Out</a>
        </div>
      </nav>

      <main style={{ padding: "32px 14px 80px" }}>
        <div className="wrap" style={{ maxWidth: 640, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>Edit Event</h1>
          <p style={{ color: "#a1a1aa", marginBottom: 28, fontSize: "0.9rem" }}>{event.title}</p>

          {error && (
            <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#f87171", fontSize: "0.9rem" }}>
              Please fill in all required fields.
            </div>
          )}

          <form action="/api/organizer/events/update" method="POST">
            <input type="hidden" name="eventId" value={event.id} />

            <div style={{ display: "grid", gap: 20 }}>

              <div className="card">
                <p style={{ fontWeight: 900, marginBottom: 16 }}>Event Details</p>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Title *</label>
                    <input name="title" defaultValue={event.title} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select name="category" defaultValue={event.category} style={{ ...inputStyle, cursor: "pointer" }}>
                      {EVENT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Description</label>
                    <textarea
                      name="description"
                      defaultValue={event.description ?? ""}
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Cover Image URL</label>
                    <input name="cover_image_url" type="url" defaultValue={event.cover_image_url ?? ""} placeholder="https://..." style={inputStyle} />
                  </div>
                </div>
              </div>

              <div className="card">
                <p style={{ fontWeight: 900, marginBottom: 16 }}>Date & Time</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Start *</label>
                    <input name="starts_at" type="datetime-local" defaultValue={toLocalDatetimeValue(event.starts_at)} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>End *</label>
                    <input name="ends_at" type="datetime-local" defaultValue={toLocalDatetimeValue(event.ends_at)} required style={inputStyle} />
                  </div>
                </div>
              </div>

              <div className="card">
                <p style={{ fontWeight: 900, marginBottom: 16 }}>Location</p>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Venue Name</label>
                    <input name="venue_name" defaultValue={event.venue_name ?? ""} placeholder="e.g. The Civic Center" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Address</label>
                    <input name="address" defaultValue={event.address ?? ""} placeholder="Street address" style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10 }}>
                    <div>
                      <label style={labelStyle}>City</label>
                      <input name="city" defaultValue={event.city ?? ""} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>State</label>
                      <input name="state" defaultValue={event.state ?? ""} placeholder="LA" maxLength={2} style={inputStyle} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <p style={{ fontWeight: 900, marginBottom: 16 }}>Refund Policy</p>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Policy</label>
                    <select name="refund_policy" defaultValue={event.refund_policy ?? "no_refunds"} style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="no_refunds">No Refunds</option>
                      <option value="up_to_24h">Refunds up to 24 hours before event</option>
                      <option value="up_to_48h">Refunds up to 48 hours before event</option>
                      <option value="up_to_7d">Refunds up to 7 days before event</option>
                      <option value="custom">Custom Policy</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Policy Notes (optional)</label>
                    <input name="refund_policy_notes" defaultValue={event.refund_policy_notes ?? ""} placeholder="Any additional details..." style={inputStyle} />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn btn--primary" style={{ flex: 1, minHeight: 48 }}>
                  Save Changes
                </button>
                <Link href={`/organizer/dashboard/events/${id}`} className="btn btn--ghost" style={{ minHeight: 48, padding: "0 20px" }}>
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
