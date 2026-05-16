import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { isSafeOrigin, checkRateLimit, recordAttempt } from "../../../../lib/utils";

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function POST(req: NextRequest) {
  // CSRF origin check
  if (!isSafeOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 10 per 15 min per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`reset_pw:${ip}`);
  const { limited, retryAfterSeconds } = checkRateLimit(`reset_pw:${ip}`, 10);
  if (limited) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, reset_token, reset_token_expires_at")
    .eq("reset_token", token)
    .maybeSingle();

  if (!organizer) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  if (!organizer.reset_token_expires_at || new Date(organizer.reset_token_expires_at) < new Date()) {
    return NextResponse.json({ error: "Reset link has expired" }, { status: 400 });
  }

  const password_hash = await hashPassword(password);

  await supabaseServer
    .from("organizers")
    .update({ password_hash, reset_token: null, reset_token_expires_at: null })
    .eq("id", organizer.id);

  return NextResponse.json({ ok: true });
}
