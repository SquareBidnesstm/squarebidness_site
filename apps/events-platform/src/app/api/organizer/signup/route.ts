// =========================================================
// POST /api/organizer/signup
// Creates a new organizer account, hashes password, sets session
// =========================================================

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import {
  computeOrganizerSessionToken,
  organizerSessionCookieName,
} from "../../../../lib/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256
  );
  const hashHex = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const name = (formData.get("name") as string | null)?.trim() ?? "";
    const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
    const phone = (formData.get("phone") as string | null)?.trim() ?? null;
    const password = (formData.get("password") as string | null) ?? "";

    if (!name || !email || !password) {
      return NextResponse.redirect(
        new URL("/organizer/signup?error=missing_fields", req.url)
      );
    }
    if (password.length < 8) {
      return NextResponse.redirect(
        new URL("/organizer/signup?error=password_too_short", req.url)
      );
    }

    // Check for existing account
    const { data: existing } = await supabaseServer
      .from("organizers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.redirect(
        new URL("/organizer/signup?error=email_exists", req.url)
      );
    }

    // Generate unique slug
    let slug = slugify(name);
    const { data: slugCheck } = await supabaseServer
      .from("organizers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (slugCheck) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const passwordHash = await hashPassword(password);

    const { data: organizer, error } = await supabaseServer
      .from("organizers")
      .insert({
        name,
        slug,
        email,
        phone,
        password_hash: passwordHash,
        stripe_onboarding_complete: false,
        active: true,
      })
      .select("slug")
      .single();

    if (error || !organizer) {
      console.error("Signup DB error:", error);
      return NextResponse.redirect(
        new URL("/organizer/signup?error=db_error", req.url)
      );
    }

    // Set session cookie
    const token = await computeOrganizerSessionToken(organizer.slug);
    const cookieName = organizerSessionCookieName(organizer.slug);
    const res = NextResponse.redirect(
      new URL("/organizer/dashboard", req.url)
    );
    res.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res;
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.redirect(
      new URL("/organizer/signup?error=server_error", req.url)
    );
  }
}
