import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName } from "../../../../../lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const cookieName = sessionCookieName(shopSlug);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });

  return res;
}
