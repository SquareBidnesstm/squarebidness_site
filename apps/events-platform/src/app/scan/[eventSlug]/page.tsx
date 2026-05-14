import { notFound } from "next/navigation";
import { supabaseServer } from "../../../lib/supabase/server";
import ScannerClient from "../../../components/ScannerClient";

export const revalidate = 0;

export default async function ScanPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;

  const { data: event } = await supabaseServer
    .from("events")
    .select("id, title, starts_at, venue_name, city, state")
    .eq("slug", eventSlug)
    .single();

  if (!event) notFound();

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
