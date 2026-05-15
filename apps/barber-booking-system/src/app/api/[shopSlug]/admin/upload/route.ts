import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

export const runtime = "nodejs";

// POST /api/[shopSlug]/admin/upload
// Body: multipart/form-data with:
//   file        — the image file
//   type        — "shop_logo" | "barber_photo"
//   barber_id   — (required when type === "barber_photo")
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;
  const barberId = formData.get("barber_id") as string | null;

  if (!file || !type) {
    return NextResponse.json({ ok: false, error: "Missing file or type" }, { status: 400 });
  }

  if (!["shop_logo", "barber_photo"].includes(type)) {
    return NextResponse.json({ ok: false, error: "Invalid type" }, { status: 400 });
  }

  if (type === "barber_photo" && !barberId) {
    return NextResponse.json({ ok: false, error: "barber_id required for barber_photo" }, { status: 400 });
  }

  // Validate mime type
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "File must be JPEG, PNG, WebP, or GIF" }, { status: 400 });
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "File must be under 5MB" }, { status: 400 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = type === "shop_logo"
    ? `shops/${shop.id}/logo.${ext}`
    : `shops/${shop.id}/barbers/${barberId}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseServer.storage
    .from("shop-assets")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseServer.storage
    .from("shop-assets")
    .getPublicUrl(path);

  // Bust cache by appending timestamp
  const url = `${publicUrl}?t=${Date.now()}`;

  // Persist URL to DB
  if (type === "shop_logo") {
    await supabaseServer.from("shops").update({ logo_url: url }).eq("id", shop.id);
  } else {
    await supabaseServer.from("barbers").update({ photo_url: url }).eq("id", barberId).eq("shop_id", shop.id);
  }

  return NextResponse.json({ ok: true, url });
}
