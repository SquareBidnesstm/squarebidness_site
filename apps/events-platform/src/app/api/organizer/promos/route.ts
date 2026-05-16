import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../lib/auth";

async function getOrganizer(req: NextRequest) {
  const slug = await getVerifiedOrganizerSlug(req);
  if (!slug) return null;
  const { data } = await supabaseServer.from("organizers").select("id").eq("slug", slug).single();
  return data;
}

// GET — list promos for organizer
export async function GET(req: NextRequest) {
  const org = await getOrganizer(req);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseServer
    .from("promo_codes")
    .select("*, events(title)")
    .eq("organizer_id", org.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ promos: data ?? [] });
}

// POST — create promo
export async function POST(req: NextRequest) {
  const org = await getOrganizer(req);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { code, discount_type, discount_value, max_uses, expires_at, event_id } = body;

  if (!code || !discount_type || !discount_value) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("promo_codes")
    .insert({
      organizer_id: org.id,
      code: code.trim().toUpperCase(),
      discount_type,
      discount_value: parseFloat(discount_value),
      max_uses: max_uses ? parseInt(max_uses) : null,
      expires_at: expires_at || null,
      event_id: event_id || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Code already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to create promo" }, { status: 500 });
  }

  return NextResponse.json({ promo: data });
}

// DELETE — deactivate promo
export async function DELETE(req: NextRequest) {
  const org = await getOrganizer(req);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { promoId } = await req.json();
  await supabaseServer
    .from("promo_codes")
    .update({ active: false })
    .eq("id", promoId)
    .eq("organizer_id", org.id);

  return NextResponse.json({ ok: true });
}
