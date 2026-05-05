import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("bookings")
    .select(`
      id,
      booking_code,
      customer_name,
      customer_phone,
      customer_email,
      appointment_date,
      starts_at,
      ends_at,
      status,
      payment_status,
      source,
      client_notes,
      created_at,
      barbers (
        slug,
        name,
        display_name
      ),
      services (
        slug,
        name,
        duration_minutes,
        price
      )
    `)
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    bookings: data || [],
  });
}
