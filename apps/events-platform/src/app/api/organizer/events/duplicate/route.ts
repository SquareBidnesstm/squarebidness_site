import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  const organizerSlug = await getVerifiedOrganizerSlug(req);
  if (!organizerSlug) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id")
    .eq("slug", organizerSlug)
    .single();
  if (!organizer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const eventId = formData.get("eventId") as string;

  const { data: event } = await supabaseServer
    .from("events")
    .select("*, ticket_tiers ( * )")
    .eq("id", eventId)
    .eq("organizer_id", organizer.id)
    .single();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const baseSlug = slugify(`${event.title}-copy`);
  let slug = baseSlug;
  let suffix = 2;
  let attempts = 0;
  while (attempts++ < 20) {
    const { data: existing, error } = await supabaseServer
      .from("events")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error && !existing) break; // network/DB error — stop looping, use current slug
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
  }
  // After 20 attempts without finding a free slug, append a random 4-char suffix
  if (attempts > 20) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: newEvent, error } = await supabaseServer
    .from("events")
    .insert({
      organizer_id: organizer.id,
      title: `${event.title} (Copy)`,
      slug,
      description: event.description,
      category: event.category,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      venue_name: event.venue_name,
      address: event.address,
      city: event.city,
      state: event.state,
      cover_image_url: event.cover_image_url,
      is_public: event.is_public,
      refund_policy: event.refund_policy,
      refund_policy_notes: event.refund_policy_notes,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !newEvent) {
    return NextResponse.redirect(
      new URL(`/organizer/dashboard/events/${eventId}?dup=error`, req.url),
      303
    );
  }

  // Copy ticket tiers (reset quantity_sold)
  const tiers = (event.ticket_tiers ?? []) as any[];
  for (const tier of tiers) {
    await supabaseServer.from("ticket_tiers").insert({
      event_id: newEvent.id,
      name: tier.name,
      description: tier.description,
      price: tier.price,
      quantity: tier.quantity,
      quantity_sold: 0,
      sort_order: tier.sort_order,
      active: tier.active,
    });
  }

  return NextResponse.redirect(
    new URL(`/organizer/dashboard/events/${newEvent.id}/edit`, req.url),
    303
  );
}
