import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

const VALID_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

type BookingStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; id: string }> }
) {
  const { shopSlug, id } = await params;

  const authorized = await verifyAdminSession(req, shopSlug);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing booking id" }, { status: 400 });
  }

  const body = await req.json();
  const status = body.status as string;

  if (!VALID_STATUSES.includes(status as BookingStatus)) {
    return NextResponse.json(
      { ok: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select("id, status, booking_code")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, booking: data });
}
