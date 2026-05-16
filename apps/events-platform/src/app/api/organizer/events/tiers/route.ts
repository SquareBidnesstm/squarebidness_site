import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";

export async function POST(req: NextRequest) {
  // Auth
  const organizerSlug = await getVerifiedOrganizerSlug(req);
  if (!organizerSlug) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabaseServer
    .from("organizers").select("id").eq("slug", organizerSlug).single();
  if (!organizer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tierId, name, description, price, quantity, groupMinQty, groupDiscountPct } = body;

  if (!tierId || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Verify tier belongs to this organizer's event
  const { data: tier } = await supabaseServer
    .from("ticket_tiers")
    .select("id, price, quantity, quantity_sold, events ( organizer_id )")
    .eq("id", tierId)
    .single();

  if (!tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  const event = tier.events as any;
  if (event?.organizer_id !== organizer.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const newQty = parseInt(quantity);
  if (isNaN(newQty) || newQty < tier.quantity_sold) {
    return NextResponse.json({ error: `Quantity can't be less than tickets already sold (${tier.quantity_sold})` }, { status: 400 });
  }

  const updates: Record<string, any> = {
    name: name.trim(),
    description: description?.trim() || null,
    quantity: newQty,
    group_min_qty: groupMinQty ? parseInt(groupMinQty) : null,
    group_discount_pct: groupDiscountPct ? parseFloat(groupDiscountPct) : null,
  };

  // Only allow price edits if no tickets sold yet
  if (tier.quantity_sold === 0 && price !== undefined) {
    const newPrice = parseFloat(price);
    if (!isNaN(newPrice) && newPrice >= 0) {
      updates.price = newPrice;
    }
  }

  await supabaseServer.from("ticket_tiers").update(updates).eq("id", tierId);

  return NextResponse.json({ ok: true });
}
