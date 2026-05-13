import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  const { eventId, email, name } = await req.json();
  if (!eventId || !email || !name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("waitlist")
    .insert({ event_id: eventId, email: email.trim().toLowerCase(), name: name.trim() });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
