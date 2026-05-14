import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { checkActiveSubscription } from "../../../../../lib/auth";
import { sendPushToBarber, sendPushToShopAdmins } from "../../../../../lib/push";
import { sendConfirmationEmail } from "../../../../../lib/email";

type CreateBookingPayload = {
  barber_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string | null;
  service?: string;
  time?: string;
  date?: string;
};

function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function convertDisplayTimeTo24Hour(time: string) {
  const [clock, suffix] = time.trim().split(" ");
  if (!clock || !suffix) return null;
  const [rawHour, rawMinute] = clock.split(":");
  let hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const upper = suffix.toUpperCase();
  if (upper === "PM" && hour !== 12) hour += 12;
  if (upper === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function sendConfirmationSMS({
  to,
  customerName,
  barberName,
  barberSlug,
  shopSlug,
  serviceName,
  appointmentDate,
  startsAt,
  bookingCode,
  timezone,
  cancelToken,
}: {
  to: string;
  customerName: string;
  barberName: string;
  barberSlug: string;
  shopSlug: string;
  serviceName: string;
  appointmentDate: string;
  startsAt: string;
  bookingCode: string;
  timezone: string;
  cancelToken?: string | null;
}) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.DAPPER_FROM_NUMBER;

  if (!sid || !token || (!messagingSid && !fromNumber)) return;

  const date = new Date(`${appointmentDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const time = new Date(startsAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });

  const rebookUrl = `https://booking.squarebidness.com/${shopSlug}/book/${barberSlug}`;
  const cancelUrl = cancelToken ? `https://booking.squarebidness.com/cancel/${cancelToken}` : null;
  const rescheduleUrl = cancelToken ? `https://booking.squarebidness.com/reschedule/${cancelToken}` : null;
  const body = [
    `You're confirmed! ✂️`,
    ``,
    `${customerName}`,
    `${serviceName}`,
    `${date} at ${time}`,
    `Barber: ${barberName}`,
    `Code: ${bookingCode}`,
    ``,
    rescheduleUrl ? `Reschedule: ${rescheduleUrl}` : null,
    cancelUrl ? `Cancel: ${cancelUrl}` : null,
    `Book again: ${rebookUrl}`,
  ].filter(Boolean).join("\n");

  const msgParams = new URLSearchParams({ To: to, Body: body });
  if (messagingSid) {
    msgParams.set("MessagingServiceSid", messagingSid);
  } else {
    msgParams.set("From", fromNumber!);
  }

  const credentials = Buffer.from(`${sid}:${token}`).toString("base64");

  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: msgParams.toString(),
    }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  try {
    const { shopSlug } = await params;
    const body = (await req.json()) as CreateBookingPayload;

    if (!body.barber_id) return NextResponse.json({ ok: false, error: "Missing barber_id" }, { status: 400 });
    if (!body.customer_name) return NextResponse.json({ ok: false, error: "Missing customer_name" }, { status: 400 });
    if (!body.customer_phone) return NextResponse.json({ ok: false, error: "Phone number is required" }, { status: 400 });
    if (!body.service) return NextResponse.json({ ok: false, error: "Missing service" }, { status: 400 });
    if (!body.time) return NextResponse.json({ ok: false, error: "Missing time" }, { status: 400 });

    const appointmentDate =
      body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : getTodayDateString();

    const time24 = convertDisplayTimeTo24Hour(body.time);
    if (!time24) return NextResponse.json({ ok: false, error: "Invalid time format" }, { status: 400 });

    const { data: shop, error: shopError } = await supabaseServer
      .from("shops")
      .select("id, slug, timezone")
      .eq("slug", shopSlug)
      .eq("active", true)
      .single();

    if (shopError || !shop) {
      return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
    }

    const hasActivePlan = await checkActiveSubscription(shop.id);
    if (!hasActivePlan) {
      return NextResponse.json({ ok: false, error: "This shop's subscription is inactive. Online booking is unavailable." }, { status: 402 });
    }

    const { data: barber, error: barberError } = await supabaseServer
      .from("barbers")
      .select("id, slug, name, display_name")
      .eq("shop_id", shop.id)
      .eq("slug", body.barber_id)
      .eq("active", true)
      .single();

    if (barberError || !barber) {
      return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });
    }

    const { data: service, error: serviceError } = await supabaseServer
      .from("services")
      .select("id, slug, name, duration_minutes, price")
      .eq("shop_id", shop.id)
      .eq("slug", body.service)
      .eq("active", true)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ ok: false, error: "Service not found" }, { status: 404 });
    }

    const startsAt = new Date(`${appointmentDate}T${time24}:00`);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid appointment time" }, { status: 400 });
    }

    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

    const { data: overlaps } = await supabaseServer
      .from("bookings")
      .select("id")
      .eq("barber_id", barber.id)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString());

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({ ok: false, error: "That time is already booked" }, { status: 409 });
    }

    const { data: bookingCode, error: bookingCodeError } = await supabaseServer.rpc(
      "generate_booking_code",
      { shop_slug: shop.slug }
    );

    if (bookingCodeError || !bookingCode) {
      return NextResponse.json({ ok: false, error: "Could not generate booking code" }, { status: 500 });
    }

    const { data: customer } = await supabaseServer
      .from("customers")
      .insert({ shop_id: shop.id, full_name: body.customer_name })
      .select("id")
      .single();

    const { data: booking, error: bookingError } = await supabaseServer
      .from("bookings")
      .insert({
        booking_code: bookingCode,
        shop_id: shop.id,
        barber_id: barber.id,
        service_id: service.id,
        customer_id: customer?.id ?? null,
        customer_name: body.customer_name,
        customer_phone: body.customer_phone,
        customer_email: body.customer_email || null,
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
      .select("id, booking_code, customer_name, starts_at, ends_at, status, cancel_token")
      .single();

    if (bookingError || !booking) {
      const isOverlap = (bookingError as any)?.code === "23P01";
      return NextResponse.json(
        { ok: false, error: isOverlap ? "That time slot was just taken. Please pick another time." : (bookingError?.message || "Could not create booking") },
        { status: isOverlap ? 409 : 500 }
      );
    }

    const normalizedPhone = normalizePhone(body.customer_phone);
    if (normalizedPhone) {
      sendConfirmationSMS({
        to: normalizedPhone,
        customerName: body.customer_name,
        barberName: barber.display_name || barber.name,
        barberSlug: barber.slug,
        shopSlug,
        serviceName: service.name,
        appointmentDate,
        startsAt: booking.starts_at,
        bookingCode: booking.booking_code,
        timezone: shop.timezone,
        cancelToken: booking.cancel_token ?? null,
      }).catch((err) =>
        console.error("SMS ERROR:", err instanceof Error ? err.message : err)
      );
    }

    // Send email confirmation if address provided (non-blocking)
    if (body.customer_email) {
      sendConfirmationEmail({
        to: body.customer_email,
        customerName: body.customer_name,
        shopName: shop.name ?? shopSlug,
        barberName: barber.display_name || barber.name,
        serviceName: service.name,
        appointmentDate,
        startsAt: booking.starts_at,
        bookingCode: booking.booking_code,
        timezone: shop.timezone,
        cancelToken: booking.cancel_token ?? null,
      }).catch((err) => console.error("EMAIL ERROR:", err instanceof Error ? err.message : err));
    }

    // Fire push notifications (non-blocking)
    const pushTitle = "New Booking";
    const pushBody = `${body.customer_name} — ${service.name} on ${appointmentDate}`;
    const pushUrl = `/${shopSlug}/admin`;
    sendPushToBarber(barber.id, { title: pushTitle, body: pushBody, url: pushUrl }).catch(console.error);
    sendPushToShopAdmins(shop.id, { title: pushTitle, body: pushBody, url: pushUrl }).catch(console.error);

    return NextResponse.json({ ok: true, booking, barber: barber.display_name || barber.name, service: service.name });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
