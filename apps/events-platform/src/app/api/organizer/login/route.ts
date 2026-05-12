// =========================================================
// POST /api/organizer/login
// Verifies organizer credentials, sets HMAC session cookie
// =========================================================

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import {
  computeOrganizerSessionToken,
  organizerSessionCookieName,
} from "../../../../lib/auth";

async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [, saltHex, hashHex] = storedHash.split(":");
    const salt = new Uint8Array(
      saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
    );
    const enc = new TextEncoder();
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
    const candidate = Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return candidate === hashHex;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
    const password = (formData.get("password") as string | null) ?? "";

    if (!email || !password) {
      return NextResponse.redirect(
        new URL("/organizer/login?error=missing_fields", req.url)
      );
    }

    const { data: organizer } = await supabaseServer
      .from("organizers")
      .select("id, slug, password_hash, active")
      .eq("email", email)
      .maybeSingle();

    if (!organizer || !organizer.active) {
      return NextResponse.redirect(
        new URL("/organizer/login?error=invalid_credentials", req.url)
      );
    }

    const valid = await verifyPassword(password, organizer.password_hash ?? "");
    if (!valid) {
      return NextResponse.redirect(
        new URL("/organizer/login?error=invalid_credentials", req.url)
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
    console.error("Login error:", err);
    return NextResponse.redirect(
      new URL("/organizer/login?error=server_error", req.url)
    );
  }
}
