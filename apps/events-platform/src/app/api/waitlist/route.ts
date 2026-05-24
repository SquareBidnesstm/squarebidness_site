import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";
import { checkRateLimit, isSafeOrigin } from "../../../lib/utils";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!isSafeOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 10 waitlist joins per 15 min per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const { limited, retryAfterSeconds } = await checkRateLimit(`waitlist:${ip}`, 10);
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

  const cleanEventId = String(eventId).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(name).trim();

  if (!cleanEventId || cleanEventId.length > 120) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  if (!cleanName || cleanName.length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or less." }, { status: 400 });
  }
  if (!emailRegex.test(cleanEmail) || cleanEmail.length > 200) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const emailKey = `waitlist:${cleanEventId}:${cleanEmail}`;
  const emailLimit = await checkRateLimit(emailKey, 3);
  if (emailLimit.limited) {
    return NextResponse.json(
      { error: `Too many waitlist attempts for this email. Try again in ${Math.ceil(emailLimit.retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { error } = await supabaseServer
    .from("waitlist")
    .insert({ event_id: cleanEventId, email: cleanEmail, name: cleanName });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
