import { NextRequest, NextResponse } from "next/server";
import { barberSessionCookieName } from "../../../../../../lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;
  const cookieName = barberSessionCookieName(shopSlug, barberSlug);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, "", { maxAge: 0, path: "/" });
  return res;
}
