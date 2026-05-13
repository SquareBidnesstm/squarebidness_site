import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../../lib/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
  if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizerSlug = sessionCookie.name.replace("org_session_", "");
  const expectedToken = await computeOrganizerSessionToken(organizerSlug);
  if (sessionCookie.value !== expectedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  while (true) {
    const { data: existing } = await supabaseServer
      .from("events")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
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
