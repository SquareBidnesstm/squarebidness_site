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

  return (
    <ScannerClient
      eventId={event.id}
      eventTitle={event.title}
      eventDate={new Date(event.starts_at).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      })}
      venueName={[event.venue_name, event.city, event.state].filter(Boolean).join(" · ")}
    />
  );
}
