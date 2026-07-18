import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../../../lib/supabase/server";
import { verifyBarberSession } from "../../../../../../../../lib/auth";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  confirmed:  ["completed", "no_show"],
  pending:    ["completed", "no_show"],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string; id: string }> }
) {
  const { shopSlug, barberSlug, id } = await params;

  const authed = await verifyBarberSession(req, shopSlug, barberSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const newStatus: string = body.status;

  if (!newStatus) return NextResponse.json({ ok: false, error: "status required" }, { status: 400 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: barber } = await supabaseServer
    .from("barbers").select("id").eq("shop_id", shop.id).eq("slug", barberSlug).eq("active", true).single();
  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });

  const { data: booking } = await supabaseServer
    .from("bookings").select("id, status, barber_id").eq("id", id).eq("shop_id", shop.id).single();

  if (!booking) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
  if (booking.barber_id !== barber.id) return NextResponse.json({ ok: false, error: "Not your booking" }, { status: 403 });

  const allowed = ALLOWED_TRANSITIONS[booking.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { ok: false, error: `Cannot transition from ${booking.status} to ${newStatus}` },
      { status: 400 }
    );
  }

  const updateFields: Record<string, string> = { status: newStatus };
  if (newStatus === "completed") updateFields.completed_at = new Date().toISOString();

  const { data: updated, error } = await supabaseServer
    .from("bookings").update(updateFields).eq("id", id).select("id, status").single();

  if (error || !updated) {
    console.error("[barber status] update error:", error);
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, booking: updated });
}
