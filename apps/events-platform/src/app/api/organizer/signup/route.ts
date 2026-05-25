// =========================================================
// POST /api/organizer/signup
// Creates a new organizer account, hashes password, sets session
// =========================================================

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseServer } from "../../../../lib/supabase/server";
import {
  computeOrganizerSessionToken,
  organizerSessionCookieName,
} from "../../../../lib/auth";
import { PLATFORM_URL } from "../../../../lib/constants";
import { checkRateLimit, recordAttempt, isSafeOrigin } from "../../../../lib/utils";
import { verifyTurnstileToken } from "../../../../lib/turnstile";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    // CSRF origin check
    if (!isSafeOrigin(req)) {
      return NextResponse.redirect(
        new URL("/organizer/signup?error=server_error", req.url)
      );
    }

    // Rate limit: 5 signups per 15 min per IP (prevent account spam)
    const ip =
      (req as any).headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ??
      (req as any).headers?.get?.("x-real-ip") ??
      "unknown";
    recordAttempt(`org_signup:${ip}`);
    const { limited, retryAfterSeconds } = await checkRateLimit(`org_signup:${ip}`, 5);
    if (limited) {
      return NextResponse.redirect(
        new URL(`/organizer/signup?error=too_many_attempts&retry=${Math.ceil(retryAfterSeconds / 60)}`, req.url)
      );
    }

    const formData = await req.formData();
    const turnstileOk = await verifyTurnstileToken(
      formData.get("cf-turnstile-response") as string | null,
      ip
    );
    if (!turnstileOk) {
      return NextResponse.redirect(
        new URL("/organizer/signup?error=verification_failed", req.url)
      );
    }

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

    // Per-email rate limit: 3 signup attempts per email per 15 min (defends against
    // inbox-flooding a target address from rotating IPs)
    recordAttempt(`org_signup:email:${email}`);
    const emailRl = await checkRateLimit(`org_signup:email:${email}`, 3);
    if (emailRl.limited) {
      return NextResponse.redirect(
        new URL("/organizer/signup?error=too_many_attempts", req.url)
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

    // Generate raw token for the email link, store only the SHA-256 hash in DB.
    // Consistent with how reset_token is handled — limits DB leak exposure.
    const rawVerificationToken = crypto.randomUUID();
    const verificationTokenHashBuf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(rawVerificationToken)
    );
    const verificationTokenHash = Array.from(new Uint8Array(verificationTokenHashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: organizer, error } = await supabaseServer
      .from("organizers")
      .insert({
        name,
        slug,
        email,
        phone,
        password_hash: passwordHash,
        stripe_onboarding_complete: false,
        active: false,
        email_verified: false,
        verification_token: verificationTokenHash,
        verification_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("slug")
      .single();

    if (error || !organizer) {
      console.error("Signup DB error:", error);
      // Handle race condition where another request inserted the same email between our
      // SELECT and INSERT (unique violation on the email column).
      if (error?.code === "23505") {
        return NextResponse.redirect(
          new URL("/organizer/signup?error=email_exists", req.url)
        );
      }
      return NextResponse.redirect(
        new URL("/organizer/signup?error=db_error", req.url)
      );
    }

    // Send verification email — skip gracefully if RESEND_API_KEY is not configured
    if (!process.env.RESEND_API_KEY) {
      console.warn("[signup] RESEND_API_KEY not set — verification email skipped for", email);
    } else {
      const verifyUrl = `${PLATFORM_URL}/api/organizer/verify-email?token=${rawVerificationToken}`;
      await resend.emails.send({
        from: "SB Events <noreply@squarebidness.com>",
        to: email,
        subject: "Verify your SB Events account",
        html: `
          <div style="background:#000;color:#fff;font-family:sans-serif;padding:40px 24px;max-width:480px;margin:0 auto;">
            <p style="font-size:1.5rem;font-weight:900;margin-bottom:8px;">Welcome, ${name}!</p>
            <p style="color:#a1a1aa;margin-bottom:24px;">Click below to verify your email and activate your organizer account.</p>
            <a href="${verifyUrl}" style="display:inline-block;background:#ef4444;color:#fff;font-weight:900;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:1rem;">
              Verify Email
            </a>
            <p style="color:#555;font-size:0.8rem;margin-top:24px;">If you didn't sign up for SB Events, ignore this email.</p>
          </div>
        `,
      }).catch((err) => console.error("Verification email error:", err));
    }

    return NextResponse.redirect(
      new URL("/organizer/signup?verify=1", req.url)
    );
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.redirect(
      new URL("/organizer/signup?error=server_error", req.url)
    );
  }
}
