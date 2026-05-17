// =========================================================
// POST /api/organizer/events/create
// Creates a new event + ticket tiers for an organizer
// =========================================================

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";

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
    const organizerSlug = await getVerifiedOrganizerSlug(req);
    if (!organizerSlug) return NextResponse.redirect(new URL("/organizer/login", req.url));

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
    const recurrenceRule = (formData.get("recurrence_rule") as string)?.trim() || null;
    const recurrenceCount = parseInt((formData.get("recurrence_count") as string) ?? "1") || 1;

    if (!title || !category || !startsAt || !endsAt) {
      return NextResponse.redirect(
        new URL("/organizer/dashboard/new-event?error=missing_fields", req.url)
      );
    }

    // Validate recurrence_rule against known values to prevent arbitrary strings in DB
    const VALID_RECURRENCE_RULES = ["weekly", "biweekly", "monthly"];
    if (recurrenceRule && !VALID_RECURRENCE_RULES.includes(recurrenceRule)) {
      return NextResponse.redirect(
        new URL("/organizer/dashboard/new-event?error=invalid_recurrence_rule", req.url)
      );
    }

    // Validate cover_image_url — must be https:// to prevent javascript: URIs
    if (coverImageUrl && !coverImageUrl.startsWith("https://")) {
      return NextResponse.redirect(
        new URL("/organizer/dashboard/new-event?error=invalid_image_url", req.url)
      );
    }

    // Validate dates
    const startsMs = new Date(startsAt).getTime();
    const endsMs = new Date(endsAt).getTime();
    if (isNaN(startsMs) || isNaN(endsMs)) {
      return NextResponse.redirect(
        new URL("/organizer/dashboard/new-event?error=invalid_dates", req.url)
      );
    }
    if (startsMs <= Date.now()) {
      return NextResponse.redirect(
        new URL("/organizer/dashboard/new-event?error=date_in_past", req.url)
      );
    }
    if (endsMs <= startsMs) {
      return NextResponse.redirect(
        new URL("/organizer/dashboard/new-event?error=end_before_start", req.url)
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

    // Recurrence group ID (shared across all copies)
    const recurrenceGroupId = recurrenceRule ? crypto.randomUUID() : null;

    // Build starts/ends offsets for each occurrence
    function addOffset(dateStr: string, rule: string, n: number): string {
      const d = new Date(dateStr);
      if (rule === "weekly") d.setDate(d.getDate() + 7 * n);
      else if (rule === "biweekly") d.setDate(d.getDate() + 14 * n);
      else if (rule === "monthly") d.setMonth(d.getMonth() + n);
      return d.toISOString();
    }

    const startsIso = new Date(startsAt).toISOString();
    const endsIso = new Date(endsAt).toISOString();

    // Prepare base tiers payload
    const tierPayload: { name: string; price: number; quantity: number; description: string | null; sort_order: number }[] = [];
    for (let n = 1; n <= 3; n++) {
      const tierName = (formData.get(`tier_${n}_name`) as string)?.trim();
      if (!tierName) continue;
      const price = parseFloat(formData.get(`tier_${n}_price`) as string) || 0;
      const quantity = parseInt(formData.get(`tier_${n}_quantity`) as string) || 0;

      if (!Number.isFinite(price) || price < 0 || price > 100_000) {
        return NextResponse.redirect(
          new URL("/organizer/dashboard/new-event?error=invalid_tier_price", req.url)
        );
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) {
        return NextResponse.redirect(
          new URL("/organizer/dashboard/new-event?error=invalid_tier_quantity", req.url)
        );
      }

      tierPayload.push({
        name: tierName,
        price,
        quantity,
        description: (formData.get(`tier_${n}_description`) as string)?.trim() || null,
        sort_order: n,
      });
    }

    const totalOccurrences = recurrenceRule ? Math.min(recurrenceCount, 12) : 1;
    let firstEventId = "";

    for (let i = 0; i < totalOccurrences; i++) {
      const occurrenceStartsAt = i === 0 ? startsIso : addOffset(startsIso, recurrenceRule!, i);
      const occurrenceEndsAt = i === 0 ? endsIso : addOffset(endsIso, recurrenceRule!, i);

      // Validate that each occurrence (beyond the first) doesn't land in the past.
      // The first occurrence is already validated above. Skip rather than hard-fail
      // to tolerate benign timezone drift near the boundary.
      if (i > 0) {
        const occurrenceStart = new Date(occurrenceStartsAt);
        if (occurrenceStart.getTime() <= Date.now()) {
          console.warn(`Skipping past recurrence occurrence: ${occurrenceStartsAt}`);
          continue; // skip this occurrence, continue loop
        }
      }

      // Each occurrence after the first is always draft
      const occurrenceStatus = i === 0 ? status : "draft";

      let occurrenceSlug = i === 0 ? eventSlug : slugify(`${title}-${i + 1}`);
      if (i > 0) {
        const { data: slugCheck } = await supabaseServer.from("events").select("id").eq("slug", occurrenceSlug).maybeSingle();
        if (slugCheck) occurrenceSlug = `${occurrenceSlug}-${Date.now().toString(36)}`;
      }

      const eventData = {
        organizer_id: organizer.id,
        title: totalOccurrences > 1 ? `${title} (${i + 1}/${totalOccurrences})` : title,
        category,
        description,
        cover_image_url: coverImageUrl,
        starts_at: occurrenceStartsAt,
        ends_at: occurrenceEndsAt,
        venue_name: venueName,
        address,
        city,
        state,
        zip,
        location_notes: locationNotes,
        status: occurrenceStatus,
        is_public: occurrenceStatus === "published",
        refund_policy: refundPolicy,
        refund_policy_notes: refundPolicyNotes,
        recurrence_group_id: recurrenceGroupId,
        recurrence_rule: recurrenceRule,
      };

      let { data: ev, error: evErr } = await supabaseServer
        .from("events")
        .insert({ ...eventData, slug: occurrenceSlug })
        .select("id")
        .single();

      if (evErr?.code === "23505") {
        // Slug collision from a concurrent insert — append a random suffix and retry once.
        const retrySlug = `${occurrenceSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: retryEv, error: retryErr } = await supabaseServer
          .from("events")
          .insert({ ...eventData, slug: retrySlug })
          .select("id")
          .single();
        if (retryErr) {
          console.error("Failed to insert recurring event occurrence after slug-collision retry:", retryErr);
          if (i === 0) return NextResponse.redirect(new URL("/organizer/dashboard/new-event?error=db_error", req.url));
          // Non-first occurrence: log and skip rather than aborting the whole request.
          continue;
        }
        ev = retryEv;
        evErr = null;
      }

      if (evErr || !ev) {
        console.error("Event create error:", evErr);
        if (i === 0) return NextResponse.redirect(new URL("/organizer/dashboard/new-event?error=db_error", req.url));
        break;
      }

      if (i === 0) firstEventId = ev.id;

      if (tierPayload.length > 0) {
        await supabaseServer.from("ticket_tiers").insert(
          tierPayload.map(t => ({ ...t, event_id: ev.id, quantity_sold: 0, active: true }))
        );
      }
    }

    return NextResponse.redirect(
      new URL(`/organizer/dashboard/events/${firstEventId}`, req.url)
    );
  } catch (err) {
    console.error("Create event error:", err);
    return NextResponse.redirect(
      new URL("/organizer/dashboard/new-event?error=server_error", req.url)
    );
  }
}
