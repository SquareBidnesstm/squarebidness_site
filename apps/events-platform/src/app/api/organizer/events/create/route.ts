// =========================================================
// POST /api/organizer/events/create
// Creates a new event + ticket tiers for an organizer
// =========================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../../lib/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export async function POST(req: Request) {
  try {
    // Auth
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
    if (!sessionCookie) return NextResponse.redirect(new URL("/organizer/login", req.url));

    const organizerSlug = sessionCookie.name.replace("org_session_", "");
    const expectedToken = await computeOrganizerSessionToken(organizerSlug);
    if (sessionCookie.value !== expectedToken) return NextResponse.redirect(new URL("/organizer/login", req.url));

    const { data: organizer } = await supabaseServer
      .from("organizers")
      .select("id")
      .eq("slug", organizerSlug)
      .single();

    if (!organizer) return NextResponse.redirect(new URL("/organizer/login", req.url));

    const formData = await req.formData();
    const title = (formData.get("title") as string)?.trim() ?? "";
    const category = (formData.get("category") as string)?.trim() ?? "";
    const description = (formData.get("description") as string)?.trim() || null;
    const coverImageUrl = (formData.get("cover_image_url") as string)?.trim() || null;
    const startsAt = formData.get("starts_at") as string;
    const endsAt = formData.get("ends_at") as string;
    const venueName = (formData.get("venue_name") as string)?.trim() || null;
    const address = (formData.get("address") as string)?.trim() || null;
    const city = (formData.get("city") as string)?.trim() || null;
    const state = (formData.get("state") as string)?.trim() || null;
    const zip = (formData.get("zip") as string)?.trim() || null;
    const locationNotes = (formData.get("location_notes") as string)?.trim() || null;
    const refundPolicy = (formData.get("refund_policy") as string)?.trim() || "no_refunds";
    const refundPolicyNotes = (formData.get("refund_policy_notes") as string)?.trim() || null;
    const action = (formData.get("action") as string) ?? "draft";

    if (!title || !category || !startsAt || !endsAt) {
      return NextResponse.redirect(
        new URL("/organizer/dashboard/new-event?error=missing_fields", req.url)
      );
    }

    // Generate unique slug
    let eventSlug = slugify(title);
    const { data: slugCheck } = await supabaseServer
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .maybeSingle();

    if (slugCheck) {
      eventSlug = `${eventSlug}-${Date.now().toString(36)}`;
    }

    const status = action === "publish" ? "published" : "draft";

    // Create event
    const { data: event, error: eventError } = await supabaseServer
      .from("events")
      .insert({
        organizer_id: organizer.id,
        title,
        slug: eventSlug,
        category,
        description,
        cover_image_url: coverImageUrl,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        venue_name: venueName,
        address,
        city,
        state,
        zip,
        location_notes: locationNotes,
        status,
        is_public: status === "published",
        refund_policy: refundPolicy,
        refund_policy_notes: refundPolicyNotes,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      console.error("Event create error:", eventError);
      return NextResponse.redirect(
        new URL("/organizer/dashboard/new-event?error=db_error", req.url)
      );
    }

    // Create ticket tiers
    const tierInserts = [];
    for (let n = 1; n <= 3; n++) {
      const tierName = (formData.get(`tier_${n}_name`) as string)?.trim();
      const tierPrice = formData.get(`tier_${n}_price`) as string;
      const tierQty = formData.get(`tier_${n}_quantity`) as string;
      const tierDesc = (formData.get(`tier_${n}_description`) as string)?.trim() || null;

      if (!tierName) continue;

      tierInserts.push({
        event_id: event.id,
        name: tierName,
        price: parseFloat(tierPrice) || 0,
        quantity: parseInt(tierQty) || 0,
        quantity_sold: 0,
        description: tierDesc,
        sort_order: n,
        active: true,
      });
    }

    if (tierInserts.length > 0) {
      await supabaseServer.from("ticket_tiers").insert(tierInserts);
    }

    return NextResponse.redirect(
      new URL(`/organizer/dashboard/events/${event.id}`, req.url)
    );
  } catch (err) {
    console.error("Create event error:", err);
    return NextResponse.redirect(
      new URL("/organizer/dashboard/new-event?error=server_error", req.url)
    );
  }
}
