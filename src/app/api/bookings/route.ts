import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { SHOP } from "@/lib/config/shop";

type CreateBookingBody = {
  barberSlug?: string;
  serviceSlug?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  appointmentDate?: string; // YYYY-MM-DD
  appointmentTime?: string; // HH:MM
  clientNotes?: string;
};

function combineLocalDateTime(dateStr: string, timeStr: string) {
  return new Date(`${dateStr}T${timeStr}:00`);
}

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
    .order("starts_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, bookings: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateBookingBody;

    if (!body.barberSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing barberSlug" },
        { status: 400 }
      );
    }

    if (!body.serviceSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing serviceSlug" },
        { status: 400 }
      );
    }

    if (!body.customerName) {
      return NextResponse.json(
        { ok: false, error: "Missing customerName" },
        { status: 400 }
      );
    }

    if (!body.customerPhone) {
      return NextResponse.json(
        { ok: false, error: "Missing customerPhone" },
        { status: 400 }
      );
    }

    if (!body.appointmentDate) {
      return NextResponse.json(
        { ok: false, error: "Missing appointmentDate" },
        { status: 400 }
      );
    }

    if (!body.appointmentTime) {
      return NextResponse.json(
        { ok: false, error: "Missing appointmentTime" },
        { status: 400 }
      );
    }

    const { data: shop, error: shopError } = await supabaseServer
      .from("shops")
      .select("id, slug, timezone")
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
      .select("id, slug, name, display_name, shop_id")
      .eq("shop_id", shop.id)
      .eq("slug", body.barberSlug)
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
      .select("id, slug, name, duration_minutes, price, active")
      .eq("shop_id", shop.id)
      .eq("slug", body.serviceSlug)
      .eq("active", true)
      .single();

    if (serviceError || !service) {
      return NextResponse.json(
        { ok: false, error: "Service not found" },
        { status: 404 }
      );
    }

    const startsAt = combineLocalDateTime(
      body.appointmentDate,
      body.appointmentTime
    );

    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Invalid appointment date/time" },
        { status: 400 }
      );
    }

    const endsAt = new Date(
      startsAt.getTime() + service.duration_minutes * 60 * 1000
    );

    const { data: overlapping, error: overlapError } = await supabaseServer
      .from("bookings")
      .select("id, starts_at, ends_at, status")
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

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { ok: false, error: "That time is no longer available" },
        { status: 409 }
      );
    }

    const { data: bookingCodeData, error: codeError } = await supabaseServer.rpc(
      "generate_booking_code",
      { shop_slug: shop.slug }
    );

    if (codeError || !bookingCodeData) {
      return NextResponse.json(
        { ok: false, error: "Could not generate booking code" },
        { status: 500 }
      );
    }

    const { data: customer, error: customerError } = await supabaseServer
      .from("customers")
      .insert({
        shop_id: shop.id,
        full_name: body.customerName,
        phone: body.customerPhone,
        email: body.customerEmail || null,
        notes: body.clientNotes || null,
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
        booking_code: bookingCodeData,
        shop_id: shop.id,
        barber_id: barber.id,
        service_id: service.id,
        customer_id: customer.id,
        customer_name: body.customerName,
        customer_phone: body.customerPhone,
        customer_email: body.customerEmail || null,
        appointment_date: body.appointmentDate,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price_snapshot: service.price,
        duration_snapshot_minutes: service.duration_minutes,
        status: "confirmed",
        payment_status: "unpaid",
        source: "shop_booking_page",
        client_notes: body.clientNotes || null,
        confirmed_at: new Date().toISOString(),
      })
      .select(`
        id,
        booking_code,
        customer_name,
        appointment_date,
        starts_at,
        ends_at,
        status,
        payment_status
      `)
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
      barber: {
        id: barber.id,
        slug: barber.slug,
        name: barber.display_name || barber.name,
      },
      service: {
        id: service.id,
        slug: service.slug,
        name: service.name,
        durationMinutes: service.duration_minutes,
        price: service.price,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
