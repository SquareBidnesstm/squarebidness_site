import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { SHOP } from "../../../../lib/config/shop";

type CreateBookingPayload = {
  barber_id?: string;
  customer_name?: string;
  service?: string;
  time?: string;
  appointment_date?: string;
};

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function convertDisplayTimeTo24Hour(time: string) {
  const [clock, suffix] = time.trim().split(" ");
  if (!clock || !suffix) return null;

  const [rawHour, rawMinute] = clock.split(":");
  let hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const upperSuffix = suffix.toUpperCase();

  if (upperSuffix === "PM" && hour !== 12) hour += 12;
  if (upperSuffix === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function combineDateAndTime(dateStr: string, time24: string) {
  return new Date(`${dateStr}T${time24}:00`);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateBookingPayload;

    if (!body.barber_id) {
      return NextResponse.json(
        { ok: false, error: "Missing barber_id" },
        { status: 400 }
      );
    }

    if (!body.customer_name) {
      return NextResponse.json(
        { ok: false, error: "Missing customer_name" },
        { status: 400 }
      );
    }

    if (!body.service) {
      return NextResponse.json(
        { ok: false, error: "Missing service" },
        { status: 400 }
      );
    }

    if (!body.time) {
      return NextResponse.json(
        { ok: false, error: "Missing time" },
        { status: 400 }
      );
    }

    const appointmentDate = body.appointment_date || getTodayDateString();
    const time24 = convertDisplayTimeTo24Hour(body.time);

    if (!time24) {
      return NextResponse.json(
        { ok: false, error: "Invalid time format" },
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
      .select("id, slug, name, display_name")
      .eq("shop_id", shop.id)
      .eq("slug", body.barber_id)
      .eq("active", true)
      .single();

    if (barberError || !barber) {
      return NextResponse.json(
        { ok: false, error: "Barber not found" },
        { status: 404 }
      );
    }

    const { data: service, error: serviceError } = await supabaseServer
      .from("services")
      .select("id, slug, name, duration_minutes, price")
      .eq("shop_id", shop.id)
      .eq("slug", body.service)
      .eq("active", true)
      .single();

    if (serviceError || !service) {
      return NextResponse.json(
        { ok: false, error: "Service not found" },
        { status: 404 }
      );
    }

    const startsAt = combineDateAndTime(appointmentDate, time24);

    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Invalid appointment time" },
        { status: 400 }
      );
    }

    const endsAt = new Date(
      startsAt.getTime() + service.duration_minutes * 60 * 1000
    );

    const { data: overlaps, error: overlapError } = await supabaseServer
      .from("bookings")
      .select("id")
      .eq("barber_id", barber.id)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString());

    if (overlapError) {
      return NextResponse.json(
        { ok: false, error: overlapError.message },
        { status: 500 }
      );
    }

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json(
        { ok: false, error: "That time is already booked" },
        { status: 409 }
      );
    }

    const { data: bookingCode, error: bookingCodeError } =
      await supabaseServer.rpc("generate_booking_code", {
        shop_slug: shop.slug,
      });

    if (bookingCodeError || !bookingCode) {
      return NextResponse.json(
        { ok: false, error: "Could not generate booking code" },
        { status: 500 }
      );
    }

    const { data: customer, error: customerError } = await supabaseServer
      .from("customers")
      .insert({
        shop_id: shop.id,
        full_name: body.customer_name,
      })
      .select("id")
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { ok: false, error: customerError?.message || "Could not create customer" },
        { status: 500 }
      );
    }

    const { data: booking, error: bookingError } = await supabaseServer
      .from("bookings")
      .insert({
        booking_code: bookingCode,
        shop_id: shop.id,
        barber_id: barber.id,
        service_id: service.id,
        customer_id: customer.id,
        customer_name: body.customer_name,
        customer_phone: null,
        customer_email: null,
        appointment_date: appointmentDate,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price_snapshot: service.price,
        duration_snapshot_minutes: service.duration_minutes,
        status: "confirmed",
        payment_status: "unpaid",
        source: "shop_booking_page",
        confirmed_at: new Date().toISOString(),
      })
      .select("id, booking_code, customer_name, starts_at, ends_at, status")
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { ok: false, error: bookingError?.message || "Could not create booking" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      booking,
      barber: barber.display_name || barber.name,
      service: service.name,
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
