import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const organizerSlug = await getVerifiedOrganizerSlug(req);
  if (!organizerSlug) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  // Verify the organizer owns this event
  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id")
    .eq("slug", organizerSlug)
    .single();

  if (!organizer) return NextResponse.json({ error: "Organizer not found" }, { status: 404 });

  const { data: event } = await supabaseServer
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("organizer_id", organizer.id)
    .single();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: orders, error, count } = await supabaseServer
    .from("orders")
    .select("id, order_code, buyer_name, buyer_email, total, status, created_at", { count: "exact" })
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: orders ?? [], total: count ?? 0 });
}
