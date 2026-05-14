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

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

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

  // --- Reschedule path ---
  if (body.reschedule) {
    const { date, time } = body.reschedule as { date: string; time: string };
    if (!date || !time) {
      return NextResponse.json({ ok: false, error: "Reschedule requires date and time" }, { status: 400 });
    }

    // Fetch the booking + service duration + shop timezone
    const { data: booking } = await supabaseServer
      .from("bookings")
      .select(`id, barber_id, customer_name, customer_phone, booking_code, services ( duration_minutes ), shops ( id, slug, timezone )`)
      .eq("id", id)
      .single();

    if (!booking) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });

    const svc = booking.services as any;
    const shop = booking.shops as any;
    const duration = svc?.duration_minutes ?? 30;

    // time comes in as "HH:MM" from the availability slots (24-hour internal format)
    const time24 = time.includes(":") && !time.includes(" ") ? time : convertDisplayTimeTo24Hour(time);
    if (!time24) return NextResponse.json({ ok: false, error: "Invalid time format" }, { status: 400 });

    const startsAt = new Date(`${date}T${time24}:00`);
    const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);

    // Conflict check (exclude this booking)
    const { data: overlaps } = await supabaseServer
      .from("bookings")
      .select("id")
      .eq("barber_id", booking.barber_id)
      .neq("id", id)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString());

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({ ok: false, error: "That time slot is already booked" }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabaseServer
      .from("bookings")
      .update({
        appointment_date: date,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .eq("id", id)
      .select("id, booking_code, customer_name, customer_phone, appointment_date, starts_at")
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ ok: false, error: updateError?.message || "Update failed" }, { status: 500 });
    }

    // Notify customer by SMS
    const normalizedPhone = normalizePhone(updated.customer_phone ?? "");
    if (normalizedPhone && shop?.timezone) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
      const fromNumber = process.env.DAPPER_FROM_NUMBER;

      if (sid && token && (messagingSid || fromNumber)) {
        const dateStr = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        const timeStr = new Date(updated.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: shop.timezone });
        const smsBody = [
          `Your appointment has been rescheduled ✂️`,
          ``,
          `${updated.customer_name}`,
          `${dateStr} at ${timeStr}`,
          `Code: ${updated.booking_code}`,
        ].join("\n");

        const msgParams = new URLSearchParams({ To: normalizedPhone, Body: smsBody });
        if (messagingSid) msgParams.set("MessagingServiceSid", messagingSid);
        else msgParams.set("From", fromNumber!);
        const creds = Buffer.from(`${sid}:${token}`).toString("base64");
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: msgParams.toString(),
        }).catch(console.error);
      }
    }

    return NextResponse.json({ ok: true, booking: updated });
  }

  // --- Status update path ---
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
