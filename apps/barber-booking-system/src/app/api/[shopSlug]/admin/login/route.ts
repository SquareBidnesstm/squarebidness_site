import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { computeSessionToken, sessionCookieName } from "../../../../../lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin || "").trim();

  if (!pin) {
    return NextResponse.json({ ok: false, error: "PIN required." }, { status: 400 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 404 });
  }

  const { data: setting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shop.id)
    .eq("key", "admin_auth")
    .single();

  const storedPin = (setting?.value_json as { pin?: string } | null)?.pin ?? "";

  if (!storedPin || pin !== storedPin) {
    return NextResponse.json({ ok: false, error: "Incorrect PIN." }, { status: 401 });
  }

  const sessionToken = await computeSessionToken(shopSlug);
  const cookieName = sessionCookieName(shopSlug);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 12,
    path: "/",
  });

  return res;
}
