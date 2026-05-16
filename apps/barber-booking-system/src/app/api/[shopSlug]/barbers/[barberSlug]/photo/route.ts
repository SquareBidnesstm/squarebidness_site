import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyBarberSession } from "../../../../../../lib/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;

  const authed = await verifyBarberSession(req, shopSlug, barberSlug);
  if (!authed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: barber } = await supabaseServer
    .from("barbers").select("id").eq("shop_id", shop.id).eq("slug", barberSlug).eq("active", true).single();
  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "File must be JPEG, PNG, WebP, or GIF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File too large — max 5 MB" }, { status: 400 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `barbers/${barber.id}/photo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseServer.storage
    .from("shop-assets")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseServer.storage.from("shop-assets").getPublicUrl(path);
  // Append a cache-busting timestamp so browsers immediately display the new
  // photo rather than serving a stale version from their cache.
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  await supabaseServer.from("barbers").update({ photo_url: publicUrl }).eq("id", barber.id);

  return NextResponse.json({ ok: true, url: publicUrl });
}
