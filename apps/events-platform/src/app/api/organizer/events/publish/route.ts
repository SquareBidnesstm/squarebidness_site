import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";

export async function POST(req: Request) {
  const organizerSlug = await getVerifiedOrganizerSlug(req);
  if (!organizerSlug) return NextResponse.redirect(new URL("/organizer/login", req.url));

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, stripe_onboarding_complete")
    .eq("slug", organizerSlug)
    .single();
  if (!organizer) return NextResponse.redirect(new URL("/organizer/login", req.url));

  const formData = await req.formData();
  const eventId = formData.get("eventId") as string;

  // Check if the event has any paid tiers — free events can be published without Stripe
  const { data: paidTiers } = await supabaseServer
    .from("ticket_tiers")
    .select("id")
    .eq("event_id", eventId)
    .gt("price", 0)
    .limit(1);

  const hasPaidTiers = (paidTiers?.length ?? 0) > 0;

  if (hasPaidTiers && !(organizer as any).stripe_onboarding_complete) {
    return NextResponse.redirect(
      new URL(`/organizer/dashboard/events/${eventId}?error=stripe_required`, req.url)
    );
  }

  await supabaseServer
    .from("events")
    .update({ status: "published", is_public: true })
    .eq("id", eventId)
    .eq("organizer_id", organizer.id);

  return NextResponse.redirect(new URL(`/organizer/dashboard/events/${eventId}`, req.url));
}
