import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { normalizePhone } from "../../../../lib/utils";
import { isSmsOptedOut } from "../../../../lib/sms-opt-out";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Protect with a shared secret set in CRON_SECRET env var
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // +23h
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // +25h

  // Fetch upcoming confirmed bookings with a phone number that haven't been reminded yet
  const { data: bookings, error } = await supabaseServer
    .from("bookings")
    .select(`
      id, customer_name, customer_phone, appointment_date, starts_at, booking_code, cancel_token,
      shops ( slug, timezone ),
      barbers ( slug, name, display_name ),
      services ( name )
    `)
    .in("status", ["confirmed", "pending"])
    .not("customer_phone", "is", null)
    .is("reminder_sent_at", null)
    .gte("starts_at", windowStart.toISOString())
    .lte("starts_at", windowEnd.toISOString());

  if (error) {
    console.error("Reminders query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.DAPPER_FROM_NUMBER;

  if (!sid || !token || (!messagingSid && !fromNumber)) {
    return NextResponse.json({ ok: true, skipped: bookings?.length ?? 0, reason: "Twilio not configured" });
  }

  const creds = Buffer.from(`${sid}:${token}`).toString("base64");
  let sent = 0;
  let failed = 0;

  for (const booking of bookings ?? []) {
    const shop = booking.shops as any;
    const barber = booking.barbers as any;
    const service = booking.services as any;
    const normalizedPhone = normalizePhone(booking.customer_phone ?? "");
    if (!normalizedPhone || !shop || !barber || !service) continue;
    if (await isSmsOptedOut(normalizedPhone)) continue;

    const dateStr = new Date(`${booking.appointment_date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
    const timeStr = new Date(booking.starts_at).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: shop.timezone ?? "America/New_York",
    });
    const rebookUrl = `https://booking.squarebidness.com/${shop.slug}/book/${barber.slug}`;
    const cancelToken = (booking as any).cancel_token ?? null;
    const rescheduleUrl = cancelToken ? `https://booking.squarebidness.com/reschedule/${cancelToken}` : null;
    const cancelUrl = cancelToken ? `https://booking.squarebidness.com/cancel/${cancelToken}` : null;
    const body = [
      `Reminder ✂️ Your appointment is tomorrow!`,
      ``,
      `${booking.customer_name}`,
      `${service.name}`,
      `${dateStr} at ${timeStr}`,
      `Barber: ${barber.display_name || barber.name}`,
      `Code: ${booking.booking_code}`,
      ``,
      rescheduleUrl ? `Reschedule: ${rescheduleUrl}` : null,
      cancelUrl ? `Cancel: ${cancelUrl}` : null,
    ].filter(Boolean).join("\n");

    const msgParams = new URLSearchParams({ To: normalizedPhone, Body: body });
    if (messagingSid) msgParams.set("MessagingServiceSid", messagingSid);
    else msgParams.set("From", fromNumber!);

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: msgParams.toString(),
        }
      );

      if (res.ok) {
        await supabaseServer
          .from("bookings")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", booking.id);
        sent++;
      } else {
        console.error(`SMS failed for booking ${booking.id}:`, await res.text());
        failed++;
      }
    } catch (err) {
      console.error(`SMS error for booking ${booking.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, total: bookings?.length ?? 0 });
}
