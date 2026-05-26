import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../lib/supabase/server";
import { getVerifiedOrganizerSlugFromHeader } from "../../../lib/auth";
import ScannerClient from "../../../components/ScannerClient";

export const revalidate = 0;

export default async function ScanPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  // Auth gate — only verified organizers may access the scanner
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  const organizerSlug = await getVerifiedOrganizerSlugFromHeader(cookieHeader);
  if (!organizerSlug) redirect("/organizer/login");

  const { eventSlug } = await params;

  // Fetch organizer ID so we can verify event ownership below
  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id")
    .eq("slug", organizerSlug)
    .single();

  if (!organizer) redirect("/organizer/login");

  const { data: event } = await supabaseServer
    .from("events")
    .select("id, title, starts_at, venue_name, city, state, organizer_id")
    .eq("slug", eventSlug)
    .single();

  if (!event) notFound();

  // Ownership check: only the event's organizer may access the scanner
  if (event.organizer_id !== organizer.id) notFound();

  const [{ count: checkedInCount }, { count: totalCount }] = await Promise.all([
    supabaseServer
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "checked_in"),
    supabaseServer
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id),
  ]);

  return (
    <ScannerClient
      eventId={event.id}
      eventTitle={event.title}
      eventDate={new Date(event.starts_at).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      })}
      venueName={[event.venue_name, event.city, event.state].filter(Boolean).join(" · ")}
      initialCheckedIn={checkedInCount ?? 0}
      totalTickets={totalCount ?? 0}
    />
  );
}
