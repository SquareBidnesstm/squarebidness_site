import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function convertDisplayTimeTo24Hour(time: string): string | null {
  const [clock, suffix] = time.trim().split(" ");
  if (!clock || !suffix) return null;
  const [rawHour, rawMinute] = clock.split(":");
  let hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (isNaN(hour) || isNaN(minute)) return null;
  if (suffix.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (suffix.toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// GET — return booking info for the reschedule page
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: booking } = await supabaseServer
    .from("bookings")
    .select(`id, status, starts_at, ends_at, appointment_date, customer_name,
      shops(id, name, slug, timezone),
      barbers(id, name, display_name, slug),
      services(id, name, duration_minutes, price, slug)`)
    .eq("cancel_token", token)
    .single();

  if (!booking) return NextResponse.json({ ok: false, error: "Invalid link" }, { status: 404 });

  if (["cancelled", "completed", "no_show"].includes(booking.status)) {
    return NextResponse.json({ ok: false, error: "This appointment cannot be rescheduled." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    booking: {
      id: booking.id,
      status: booking.status,
      starts_at: booking.starts_at,
      appointment_date: booking.appointment_date,
      customer_name: booking.customer_name,
      shop_name: (booking.shops as any)?.name,
      shop_slug: (booking.shops as any)?.slug,
      shop_timezone: (booking.shops as any)?.timezone,
      barber_name: (booking.barbers as any)?.display_name || (booking.barbers as any)?.name,
      barber_slug: (booking.barbers as any)?.slug,
      service_name: (booking.services as any)?.name,
      service_slug: (booking.services as any)?.slug,
      service_duration: (booking.services as any)?.duration_minutes,
    },
  });
}

// POST — perform the reschedule
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const { date, time } = body as { date?: string; time?: string };

  if (!date || !time) {
    return NextResponse.json({ ok: false, error: "Date and time are required." }, { status: 400 });
  }

  const { data: booking } = await supabaseServer
    .from("bookings")
    .select(`id, status, customer_name, customer_phone, payment_status,
      shops(id, slug, timezone, name),
      barbers(id, name, display_name, slug),
      services(id, name, duration_minutes, slug)`)
    .eq("cancel_token", token)
    .single();

  if (!booking) return NextResponse.json({ ok: false, error: "Invalid link" }, { status: 404 });

  if (["cancelled", "completed", "no_show"].includes(booking.status)) {
    return NextResponse.json({ ok: false, error: "Cannot reschedule this appointment." }, { status: 400 });
  }

  const shop = booking.shops as any;
  const barber = booking.barbers as any;
  const service = booking.services as any;

  const time24 = convertDisplayTimeTo24Hour(time);
  if (!time24) return NextResponse.json({ ok: false, error: "Invalid time format." }, { status: 400 });

  const startsAt = new Date(`${date}T${time24}:00`);
  if (isNaN(startsAt.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid date/time." }, { status: 400 });
  }

  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

  // Check for overlaps (exclude current booking)
  const { data: overlaps } = await supabaseServer
    .from("bookings")
    .select("id")
    .eq("barber_id", barber.id)
    .in("status", ["pending", "confirmed"])
    .neq("id", booking.id)
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());

  if (overlaps && overlaps.length > 0) {
    return NextResponse.json({ ok: false, error: "That time slot is no longer available. Please choose another." }, { status: 409 });
  }

  // Check blocked times
  const { data: blockedTimes } = await supabaseServer
    .from("blocked_times")
    .select("id")
    .eq("shop_id", shop.id)
    .or(`barber_id.eq.${barber.id},barber_id.is.null`)
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());

  if (blockedTimes && blockedTimes.length > 0) {
    return NextResponse.json({ ok: false, error: "That time slot is blocked. Please choose another." }, { status: 409 });
  }

  // Perform the reschedule
  await supabaseServer
    .from("bookings")
    .update({
      appointment_date: date,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reminder_sent_at: null,
    })
    .eq("id", booking.id);

  // Send confirmation SMS
  const normalizedPhone = normalizePhone(booking.customer_phone ?? "");
  if (normalizedPhone) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.DAPPER_FROM_NUMBER;

    if (sid && twilioToken && (messagingSid || fromNumber)) {
      const dateStr = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      });
      const timeStr = startsAt.toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: shop.timezone,
      });

      const body = [
        `✅ Rescheduled!`,
        ``,
        `${booking.customer_name}`,
        `${service.name}`,
        `${dateStr} at ${timeStr}`,
        `Barber: ${barber.display_name || barber.name}`,
        ``,
        `Book again: https://booking.squarebidness.com/${shop.slug}/book/${barber.slug}`,
      ].join("\n");

      const msgParams = new URLSearchParams({ To: normalizedPhone, Body: body });
      if (messagingSid) msgParams.set("MessagingServiceSid", messagingSid);
      else msgParams.set("From", fromNumber!);
      const creds = Buffer.from(`${sid}:${twilioToken}`).toString("base64");

      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: msgParams.toString(),
      }).catch(console.error);
    }
  }

  return NextResponse.json({
    ok: true,
    new_starts_at: startsAt.toISOString(),
  });
}
