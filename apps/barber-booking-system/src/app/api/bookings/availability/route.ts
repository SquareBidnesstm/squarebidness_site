import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { SHOP } from "../../../../lib/config/shop";

function toDateString(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDisplayTime(dateTime: string) {
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return null;

  let hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  const suffix = hour >= 12 ? "PM" : "AM";

  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;

  return `${hour}:${minute} ${suffix}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barberSlug = searchParams.get("barberSlug");
    const date = searchParams.get("date");

    if (!barberSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing barberSlug" },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { ok: false, error: "Missing date" },
        { status: 400 }
      );
    }

    const { data: shop, error: shopError } = await supabaseServer
      .from("shops")
      .select("id, slug")
      .eq("slug", SHOP.slug)
      .single();

    if (shopError || !shop) {
      return NextResponse.json(
        { ok: false, error: "Shop not found" },
        { status: 500 }
      );
    }

    const { data: barber, error: barberError } = await supabaseServer
      .from("barbers")
      .select("id, slug")
      .eq("shop_id", shop.id)
      .eq("slug", barberSlug)
      .eq("active", true)
      .single();

    if (barberError || !barber) {
      return NextResponse.json(
        { ok: false, error: "Barber not found" },
        { status: 404 }
      );
    }

    const { data: bookings, error: bookingsError } = await supabaseServer
      .from("bookings")
      .select("starts_at, appointment_date, status")
      .eq("barber_id", barber.id)
      .eq("appointment_date", date)
      .in("status", ["pending", "confirmed", "completed"])
      .order("starts_at", { ascending: true });

    if (bookingsError) {
      return NextResponse.json(
        { ok: false, error: bookingsError.message },
        { status: 500 }
      );
    }

    const unavailableTimes =
      bookings
        ?.filter((booking) => toDateString(booking.starts_at) === date)
        .map((booking) => toDisplayTime(booking.starts_at))
        .filter(Boolean) || [];

    return NextResponse.json({
      ok: true,
      barberSlug,
      date,
      unavailableTimes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
