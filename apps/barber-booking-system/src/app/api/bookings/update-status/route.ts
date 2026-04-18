import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { bookingId, status } = body;

    if (!bookingId || !status) {
      return NextResponse.json(
        { ok: false, error: "Missing bookingId or status" },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
