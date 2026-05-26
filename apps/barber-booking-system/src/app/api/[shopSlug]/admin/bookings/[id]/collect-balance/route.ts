import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../../lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; id: string }> }
) {
  const { shopSlug, id } = await params;
  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: booking } = await supabaseServer
    .from("bookings")
    .select("id, shop_id, payment_status, price_snapshot, payments(amount, payment_type, status)")
    .eq("id", id)
    .eq("shop_id", shop.id)
    .single();

  if (!booking) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
  if (booking.payment_status === "paid") return NextResponse.json({ ok: false, error: "Already paid in full" }, { status: 400 });

  // BH-6: Validate price_snapshot before computing remaining balance
  const totalPrice = Number(booking.price_snapshot);
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    return NextResponse.json({ error: "Invalid booking price." }, { status: 400 });
  }

  const totalPaid = (booking.payments as any[] ?? [])
    .filter((p: any) => p.status === "succeeded")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const remaining = Math.max(0, totalPrice - totalPaid);
  if (remaining <= 0) return NextResponse.json({ error: "No balance remaining on this booking." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  // Accept explicit method: cash | check | zelle | venmo | other (default: cash)
  const validMethods = ["cash", "check", "zelle", "venmo", "other"];
  const method = validMethods.includes(body.method) ? body.method : "cash";

  await supabaseServer.from("payments").insert({
    booking_id: id,
    shop_id: booking.shop_id,
    amount: remaining.toFixed(2),
    payment_type: "balance",
    provider: method,
    status: "succeeded",
    // notes captured as stringified JSON so it survives without a schema change
  });

  const { data: updated } = await supabaseServer
    .from("bookings")
    .update({ payment_status: "paid" })
    .eq("id", id)
    .select("id, payment_status")
    .single();

  return NextResponse.json({ ok: true, booking: updated, amount_collected: remaining });
}
