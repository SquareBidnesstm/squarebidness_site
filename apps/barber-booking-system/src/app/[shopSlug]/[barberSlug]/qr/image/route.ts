import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { supabaseServer } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) return new NextResponse("Not Found", { status: 404 });

  const bookingUrl = `https://booking.squarebidness.com/${shopSlug}/book/${barberSlug}`;

  const pngBuffer = await QRCode.toBuffer(bookingUrl, {
    type: "png",
    width: 600,
    margin: 3,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  return new NextResponse(new Uint8Array(pngBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
