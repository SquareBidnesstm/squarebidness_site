import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { checkRateLimit, isValidSlug, recordAttempt } from "../../../../lib/utils";

// Convert "HH:MM" to total minutes from midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Convert minutes-from-midnight to "HH:MM"
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Format "HH:MM" to "H:MM AM/PM"
function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${suffix}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  if (!isValidSlug(shopSlug)) {
    return NextResponse.json({ ok: false, error: "Invalid shop" }, { status: 400 });
  }

  // Rate limit: 60 checks per 15 min per IP per shop (prevents slot scraping)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  recordAttempt(`avail:${shopSlug}:${ip}`);
  const { limited } = await checkRateLimit(`avail:${shopSlug}:${ip}`, 60);
  if (limited) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);

  const barberSlug = searchParams.get("barber");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const durationStr = searchParams.get("duration"); // minutes
  const excludeBookingId = searchParams.get("excludeBooking") ?? null;

  if (!barberSlug || !date || !durationStr) {
    return NextResponse.json({ ok: false, error: "Missing barber, date, or duration" }, { status: 400 });
  }

  if (!isValidSlug(barberSlug)) {
    return NextResponse.json({ ok: false, error: "Invalid barber" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date format" }, { status: 400 });
  }

  // Enforce past-date and max 90-day booking window
  const requestedDate = new Date(`${date}T12:00:00`);
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const yesterdayUTC = new Date(todayUTC.getTime() - 1); // anything before today
  if (requestedDate < yesterdayUTC) {
    return NextResponse.json({ ok: false, closed: true, slots: [], error: "Cannot book appointments in the past." });
  }
  const maxAllowed = new Date();
  maxAllowed.setDate(maxAllowed.getDate() + 90);
  if (requestedDate > maxAllowed) {
    return NextResponse.json({ ok: false, closed: true, slots: [], error: "Bookings can only be made up to 90 days in advance." });
  }

  const duration = parseInt(durationStr, 10);
  if (isNaN(duration) || duration < 1 || duration > 480) {
    return NextResponse.json({ ok: false, error: "Invalid duration" }, { status: 400 });
  }

  if (excludeBookingId && !/^[0-9a-f-]{16,80}$/i.test(excludeBookingId)) {
    return NextResponse.json({ ok: false, error: "Invalid exclude booking" }, { status: 400 });
  }

  // Get shop
  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, timezone")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  // Get barber
  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id")
    .eq("shop_id", shop.id)
    .eq("slug", barberSlug)
    .eq("active", true)
    .single();

  if (!barber) {
    return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });
  }

  // Get day of week (0=Sun ... 6=Sat) for the given date
  const [year, month, day] = date.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();

  // Check barber-specific hours first, fall back to shop hours
  const { data: barberHoursRow } = await supabaseServer
    .from("barber_hours")
    .select("is_closed, open_time, close_time")
    .eq("barber_id", barber.id)
    .eq("day_of_week", dayOfWeek)
    .single();

  let hoursRow: { is_closed: boolean; open_time: string | null; close_time: string | null } | null = null;

  if (barberHoursRow) {
    // Barber has custom hours set for this day — use them
    hoursRow = barberHoursRow;
  } else {
    // Fall back to shop hours
    const { data: shopHoursRow } = await supabaseServer
      .from("shop_hours")
      .select("is_closed, open_time, close_time")
      .eq("shop_id", shop.id)
      .eq("day_of_week", dayOfWeek)
      .single();
    hoursRow = shopHoursRow;
  }

  if (!hoursRow || hoursRow.is_closed || !hoursRow.open_time || !hoursRow.close_time) {
    return NextResponse.json({ ok: true, slots: [], closed: true });
  }

  // Get booking rules (slot interval)
  const { data: rulesSetting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shop.id)
    .eq("key", "booking_rules")
    .single();

  const rules = rulesSetting?.value_json as { slot_interval_minutes?: number; min_lead_time_minutes?: number } | null;
  const slotInterval: number = rules?.slot_interval_minutes ?? 30;
  const minLeadMinutes: number = rules?.min_lead_time_minutes ?? 120; // default 2 hours

  // Get existing bookings for this barber on this date (exclude current booking when rescheduling)
  let bookingsQuery = supabaseServer
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("barber_id", barber.id)
    .eq("appointment_date", date)
    .in("status", ["pending", "confirmed"]);

  if (excludeBookingId) bookingsQuery = bookingsQuery.neq("id", excludeBookingId);

  const { data: existingBookings } = await bookingsQuery;

  // Also block any blocked_times for this barber (or shop-wide blocks) on this date
  const { data: blockedTimes } = await supabaseServer
    .from("blocked_times")
    .select("starts_at, ends_at")
    .eq("shop_id", shop.id)
    .or(`barber_id.eq.${barber.id},barber_id.is.null`)
    .lte("starts_at", `${date}T23:59:59`)
    .gte("ends_at", `${date}T00:00:00`);

  // Parse existing bookings into minute ranges
  const allBlocked = [
    ...(existingBookings ?? []),
    ...(blockedTimes ?? []),
  ];

  const bookedRanges = allBlocked.map((b) => {
    const start = new Date(b.starts_at);
    const end = new Date(b.ends_at);
    // Convert UTC ISO to local minutes-from-midnight for this date
    // Since we store times as naive UTC (created as `${date}T${time}:00`),
    // we can extract hours/minutes directly from the ISO string
    const startStr = b.starts_at.substring(11, 16); // "HH:MM"
    const endStr = b.ends_at.substring(11, 16);
    return {
      start: timeToMinutes(startStr),
      end: timeToMinutes(endStr),
      // Handle bookings that might end past midnight (edge case)
      endRaw: end.getTime() - start.getTime() + timeToMinutes(startStr),
    };
  });

  const openMinutes = timeToMinutes(hoursRow.open_time);
  const closeMinutes = timeToMinutes(hoursRow.close_time);

  // Figure out "now" in the shop's local timezone (times are stored as naive-UTC clock strings)
  const nowUTC = new Date();
  const shopTz = shop.timezone ?? "America/Chicago";
  // toLocaleString in the shop's timezone gives us the local wall-clock time
  const shopNow = new Date(nowUTC.toLocaleString("en-US", { timeZone: shopTz }));
  const todayStr = `${shopNow.getFullYear()}-${String(shopNow.getMonth() + 1).padStart(2, "0")}-${String(shopNow.getDate()).padStart(2, "0")}`;
  const isToday = date === todayStr;
  const nowMinutes = isToday ? shopNow.getHours() * 60 + shopNow.getMinutes() + minLeadMinutes : 0;

  const slots: { time: string; label: string }[] = [];

  for (let slotStart = openMinutes; slotStart + duration <= closeMinutes; slotStart += slotInterval) {
    const slotEnd = slotStart + duration;

    // Skip past times (today only)
    if (isToday && slotStart < nowMinutes) continue;

    // Check for conflicts with existing bookings
    const hasConflict = bookedRanges.some((b) => {
      const bEnd = b.endRaw ?? b.end;
      return slotStart < bEnd && slotEnd > b.start;
    });

    if (!hasConflict) {
      const timeStr = minutesToTime(slotStart);
      slots.push({ time: timeStr, label: formatTime(timeStr) });
    }
  }

  return NextResponse.json({ ok: true, slots, closed: false });
}
