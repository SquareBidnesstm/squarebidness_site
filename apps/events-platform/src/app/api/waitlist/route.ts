import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";
import { checkRateLimit, recordAttempt } from "../../../lib/utils";

export async function POST(req: NextRequest) {
  // Rate limit: 10 waitlist joins per 15 min per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`waitlist:${ip}`);
  const { limited, retryAfterSeconds } = checkRateLimit(`waitlist:${ip}`, 10);
  if (limited) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

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
