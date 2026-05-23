import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../lib/supabase/server";
import { getVerifiedOrganizerSlugFromHeader } from "../../../../lib/auth";
import { EVENT_CATEGORIES } from "../../../../lib/constants";
import NavLogo from "../../../../components/NavLogo";

export const revalidate = 0;

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Auth check
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  const organizerSlug = await getVerifiedOrganizerSlugFromHeader(cookieHeader);
  if (!organizerSlug) redirect("/organizer/login");

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name, stripe_onboarding_complete")
    .eq("slug", organizerSlug)
    .single();

  if (!organizer) redirect("/organizer/login");

  const { error } = await searchParams;

  const ERROR_MESSAGES: Record<string, string> = {
    missing_fields: "Please fill in all required fields.",
    db_error: "Could not save event. Please try again.",
    server_error: "Something went wrong. Please try again.",
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000" }}>
        <NavLogo />
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/organizer/dashboard" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← Dashboard</Link>
          <span style={{ color: "#555", fontSize: "0.85rem" }}>{organizer.name}</span>
        </div>
      </nav>

      <main style={{ padding: "32px 14px 80px" }}>
        <div className="wrap" style={{ maxWidth: 680, margin: "0 auto" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>New Event</h1>
          <p style={{ color: "#a1a1aa", marginBottom: 32 }}>Fill in the details below. You can edit everything before publishing.</p>

          {error && (
            <div style={{ background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", marginBottom: 20, color: "#fca5a5", fontSize: "0.9rem" }}>
              {ERROR_MESSAGES[error] ?? "An error occurred."}
            </div>
          )}

          <form action="/api/organizer/events/create" method="POST" style={{ display: "grid", gap: 20 }}>

            {/* Basic Info */}
            <div className="card" style={{ display: "grid", gap: 14 }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Event Info</p>

              <div className="form-group">
                <label className="label">Event Title *</label>
                <input name="title" className="input" required placeholder="e.g. Louisiana Comedy Night" />
              </div>

              <div className="form-group">
                <label className="label">Category *</label>
                <select name="category" className="input" required>
                  <option value="">Select a category</option>
                  {EVENT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Description</label>
                <textarea name="description" className="input" rows={4} placeholder="Tell people what to expect…" style={{ resize: "vertical" }} />
              </div>

              <div className="form-group">
                <label className="label">Cover Image URL</label>
                <input name="cover_image_url" className="input" type="url" placeholder="https://…" />
                <p style={{ color: "#555", fontSize: "0.8rem", marginTop: 4 }}>Upload your image to a service like Imgur or Cloudinary and paste the URL.</p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="card" style={{ display: "grid", gap: 14 }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Date & Time</p>
              <p style={{ color: "#555", fontSize: "0.8rem", marginBottom: 8 }}>Multi-day events are supported — just set the end date to a different day.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="label">Start *</label>
                  <input name="starts_at" type="datetime-local" className="input" required />
                </div>
                <div className="form-group">
                  <label className="label">End *</label>
                  <input name="ends_at" type="datetime-local" className="input" required />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="card" style={{ display: "grid", gap: 14 }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Location</p>
              <div className="form-group">
                <label className="label">Venue Name</label>
                <input name="venue_name" className="input" placeholder="e.g. House of Blues New Orleans" />
              </div>
              <div className="form-group">
                <label className="label">Address</label>
                <input name="address" className="input" placeholder="225 Decatur St" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="label">City</label>
                  <input name="city" className="input" placeholder="New Orleans" />
                </div>
                <div className="form-group">
                  <label className="label">State</label>
                  <input name="state" className="input" placeholder="LA" maxLength={2} />
                </div>
                <div className="form-group">
                  <label className="label">ZIP</label>
                  <input name="zip" className="input" placeholder="70130" />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Location Notes</label>
                <input name="location_notes" className="input" placeholder="e.g. Enter through the side door" />
              </div>
            </div>

            {/* Refund Policy */}
            <div className="card" style={{ display: "grid", gap: 14 }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Refund Policy</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="label">Policy</label>
                  <select name="refund_policy" className="input" defaultValue="no_refunds">
                    <option value="no_refunds">No Refunds</option>
                    <option value="up_to_24h">Refunds up to 24 hours before</option>
                    <option value="up_to_48h">Refunds up to 48 hours before</option>
                    <option value="up_to_7d">Refunds up to 7 days before</option>
                    <option value="custom">Custom Policy</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="label">Policy Notes (optional)</label>
                <input name="refund_policy_notes" className="input" placeholder="e.g. All sales final. Contact us at events@example.com for exceptions." />
              </div>
            </div>

            {/* Ticket Tiers */}
            <div className="card" style={{ display: "grid", gap: 14 }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Ticket Tiers</p>
              <p style={{ color: "#555", fontSize: "0.85rem" }}>Add up to 3 tiers (e.g. General Admission, VIP). You can add more after creating the event.</p>

              {[1, 2, 3].map((n) => (
                <div key={n} style={{ padding: 14, border: "1px solid #1d1d1f", borderRadius: 10, display: "grid", gap: 10 }}>
                  <p style={{ fontWeight: 800, fontSize: "0.9rem", color: "#a1a1aa" }}>Tier {n} {n === 1 && <span style={{ color: "#22c55e", fontSize: "0.75rem" }}>required</span>}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label className="label">Name</label>
                      <input name={`tier_${n}_name`} className="input" placeholder="General Admission" required={n === 1} />
                    </div>
                    <div className="form-group">
                      <label className="label">Price ($)</label>
                      <input name={`tier_${n}_price`} className="input" type="number" min="0" step="0.01" placeholder="0.00" required={n === 1} />
                    </div>
                    <div className="form-group">
                      <label className="label">Qty</label>
                      <input name={`tier_${n}_quantity`} className="input" type="number" min="1" placeholder="100" required={n === 1} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label">Description (optional)</label>
                    <input name={`tier_${n}_description`} className="input" placeholder="What's included?" />
                  </div>
                </div>
              ))}
            </div>

            {/* Recurrence */}
            <div className="card" style={{ display: "grid", gap: 14 }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Recurrence</p>
              <p style={{ color: "#555", fontSize: "0.82rem" }}>
                Schedule multiple dates at once. Each copy is saved as a draft so you can review before publishing.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="label">Repeat</label>
                  <select name="recurrence_rule" className="input" defaultValue="">
                    <option value="">One-time (no repeat)</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Number of dates</label>
                  <select name="recurrence_count" className="input" defaultValue="4">
                    {[2, 3, 4, 6, 8, 10, 12].map(n => (
                      <option key={n} value={n}>{n} dates total</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" name="action" value="draft" className="btn btn--ghost btn--wide">
                Save as Draft
              </button>
              <button type="submit" name="action" value="publish" className="btn btn--primary btn--wide">
                Publish Event
              </button>
            </div>
          </form>

          {/* Convert datetime-local values to UTC ISO strings before POST.
              Without this, the server (UTC) would misread the organizer's local time as UTC,
              storing the wrong time (e.g. 2pm Central becomes 2pm UTC = 9am Central displayed). */}
          <script dangerouslySetInnerHTML={{ __html: `
            document.querySelector('form').addEventListener('submit', function() {
              var starts = document.querySelector('[name=starts_at]');
              var ends = document.querySelector('[name=ends_at]');
              if (starts && starts.value) {
                var d = new Date(starts.value);
                if (!isNaN(d.getTime())) starts.value = d.toISOString();
              }
              if (ends && ends.value) {
                var d = new Date(ends.value);
                if (!isNaN(d.getTime())) ends.value = d.toISOString();
              }
            });
          ` }} />
        </div>
      </main>
    </div>
  );
}
