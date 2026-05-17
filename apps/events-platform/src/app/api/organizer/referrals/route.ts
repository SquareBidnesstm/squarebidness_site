import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../lib/auth";

async function getOrganizer(req: Request) {
  const slug = await getVerifiedOrganizerSlug(req);
  if (!slug) return null;
  const { data } = await supabaseServer.from("organizers").select("id").eq("slug", slug).single();
  return data;
}

export async function GET(req: NextRequest) {
  const org = await getOrganizer(req);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseServer
    .from("referral_codes")
    .select("id, code, name, event_id, uses, created_at, events ( title )")
    .eq("organizer_id", org.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ codes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const org = await getOrganizer(req);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, eventId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Validate that eventId (if provided) belongs to this organizer
  if (eventId) {
    const { data: ownedEvent } = await supabaseServer
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("organizer_id", org.id)
      .maybeSingle();
    if (!ownedEvent) {
      return NextResponse.json({ error: "Event not found or does not belong to you." }, { status: 403 });
    }
  }

  // Generate unique code — retry up to 3 times on 23505 unique-violation collision
  let data = null;
  let lastError: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = `REF-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const { data: inserted, error } = await supabaseServer
      .from("referral_codes")
      .insert({
        organizer_id: org.id,
        event_id: eventId || null,
        code,
        name: name.trim(),
      })
      .select()
      .single();

    if (!error) { data = inserted; break; }
    lastError = error;
    if (error.code !== "23505") break; // non-collision error — don't retry
  }

  if (!data) return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  return NextResponse.json({ code: data });
}
