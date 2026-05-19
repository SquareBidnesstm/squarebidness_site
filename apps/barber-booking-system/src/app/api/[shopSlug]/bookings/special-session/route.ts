// POST /api/[shopSlug]/bookings/special-session
// Client submits an off-hours "Special Session" request.
// Creates a pending_approval booking flagged as is_special_session.
// Notifies client (request received) and barber (ACCEPT / ACCEPT $X / DECLINE).

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { checkActiveSubscription } from "../../../../../lib/auth";
import { normalizePhone, checkRateLimit, recordFailedAttempt } from "../../../../../lib/utils";
import { isSmsOptedOut } from "../../../../../lib/sms-opt-out";

// ─── Time parser (same logic as twilio inbound) ───────────────────────────────
function parseSmsTime(raw: string): { display: string; h24: string } | null {
  const lower = raw.trim().toLowerCase();
  // handle common keywords
  if (lower === "midnight") return { display: "12:00 AM", h24: "00:00" };
  if (lower === "noon") return { display: "12:00 PM", h24: "12:00" };

  const s = raw.trim().replace(/\s+/g, "");
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2] ?? "0", 10);
  const meridiem = (m[3] ?? "").toLowerCase();
  if (isNaN(hour) || isNaN(minute) || minute < 0 || minute > 59) return null;

  let h24: number;
  if (meridiem === "pm") {
    h24 = hour === 12 ? 12 : hour >= 1 && hour <= 11 ? hour + 12 : -1;
  } else if (meridiem === "am") {
    h24 = hour === 12 ? 0 : hour >= 1 && hour <= 11 ? hour : -1;
  } else {
    h24 = hour >= 13 && hour <= 23 ? hour : hour >= 0 && hour <= 12 ? hour : -1;
  }
  if (h24 < 0 || h24 > 23) return null;

  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const amPm = h24 >= 12 ? "PM" : "AM";
  return {
    display: `${h12}:${String(minute).padStart(2, "0")} ${amPm}`,
    h24: `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.DAPPER_FROM_NUMBER;
  if (!sid || !token || (!messagingSid && !fromNumber)) return;

  const p = new URLSearchParams({ To: to, Body: body });
  if (messagingSid) p.set("MessagingServiceSid", messagingSid);
  else p.set("From", fromNumber!);

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: p.toString(),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  // Rate limit: 5 special session requests per 15 min per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  recordFailedAttempt(`ss:${shopSlug}:${ip}`);
  const { limited } = await checkRateLimit(`ss:${shopSlug}:${ip}`, 5);
  if (limited) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const {
    barber_id,       // barber slug
    customer_name,
    customer_phone,
    customer_email,
    service,         // service slug
    requested_date,  // YYYY-MM-DD
    requested_time,  // free text: "11 PM", "midnight", "3 AM"
    client_notes,
  } = body;

  if (!barber_id || !customer_name || !customer_phone || !service || !requested_date || !requested_time) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  // Validate date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(`${requested_date}T12:00:00`);
  if (isNaN(targetDate.getTime()) || targetDate < today) {
    return NextResponse.json({ ok: false, error: "Invalid or past date." }, { status: 400 });
  }

  // Fetch shop
  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, slug, name, timezone")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 404 });

  const hasActivePlan = await checkActiveSubscription(shop.id);
  if (!hasActivePlan) {
    return NextResponse.json({ ok: false, error: "This shop's subscription is inactive." }, { status: 402 });
  }

  // Fetch barber — must have special sessions enabled
  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, slug, name, display_name, phone, special_sessions_enabled, special_sessions_price_cents")
    .eq("shop_id", shop.id)
    .eq("slug", barber_id)
    .eq("active", true)
    .single();

  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found." }, { status: 404 });
  if (!barber.special_sessions_enabled) {
    return NextResponse.json({ ok: false, error: "This barber does not offer special sessions." }, { status: 400 });
  }

  // Fetch service
  const { data: svc } = await supabaseServer
    .from("services")
    .select("id, name, duration_minutes")
    .eq("shop_id", shop.id)
    .eq("slug", service)
    .eq("active", true)
    .single();
  if (!svc) return NextResponse.json({ ok: false, error: "Service not found." }, { status: 404 });

  // Parse requested time → starts_at
  const parsed = parseSmsTime(requested_time);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "Could not parse requested time. Try formats like '11 PM', 'midnight', '3:00 AM', or '23:30'." },
      { status: 400 }
    );
  }
  const startsAt = new Date(`${requested_date}T${parsed.h24}:00`);
  const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60 * 1000);

  // Generate booking code
  const { data: rpcCode } = await supabaseServer.rpc("generate_booking_code", { shop_slug: shop.slug });
  const bookingCode = rpcCode ?? `SS-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

  // Insert customer record
  const { data: customer } = await supabaseServer
    .from("customers")
    .insert({ shop_id: shop.id, full_name: customer_name })
    .select("id")
    .single();

  const notesParts = [
    `Special session requested for: ${requested_time}`,
    client_notes?.trim() ? client_notes.trim() : null,
  ].filter(Boolean).join("\n");

  // Create booking: pending_approval + is_special_session
  const { data: booking, error: bookingError } = await supabaseServer
    .from("bookings")
    .insert({
      booking_code: bookingCode,
      shop_id: shop.id,
      barber_id: barber.id,
      service_id: svc.id,
      customer_id: customer?.id ?? null,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      client_notes: notesParts,
      appointment_date: requested_date,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_snapshot: barber.special_sessions_price_cents
        ? Math.round(barber.special_sessions_price_cents / 100)
        : 150,
      duration_snapshot_minutes: svc.duration_minutes,
      status: "pending_approval",
      payment_status: "unpaid",
      source: "special_session_request",
      is_special_session: true,
    })
    .select("id, booking_code")
    .single();

  if (bookingError || !booking) {
    console.error("[special-session] Insert error:", bookingError);
    return NextResponse.json({ ok: false, error: "Could not create request." }, { status: 500 });
  }

  // ── SMS to client ────────────────────────────────────────────────────────────
  const clientPhone = normalizePhone(customer_phone);
  const clientOptedOut = clientPhone ? await isSmsOptedOut(clientPhone) : true;
  if (clientPhone && !clientOptedOut) {
    const dateLabel = new Date(`${requested_date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
    sendSms(clientPhone, [
      `Special session request received! ⚡`,
      ``,
      `${customer_name}`,
      `${svc.name} — ${dateLabel} at ${requested_time}`,
      `Barber: ${barber.display_name || barber.name}`,
      ``,
      `Your barber will text you to confirm details and send a payment link.`,
    ].join("\n")).catch(console.error);
  }

  // ── SMS to barber ────────────────────────────────────────────────────────────
  const barberPhone = normalizePhone(barber.phone ?? "");
  if (barberPhone) {
    const dateLabel = new Date(`${requested_date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    const defaultDollars = barber.special_sessions_price_cents
      ? Math.round(barber.special_sessions_price_cents / 100)
      : 150;
    sendSms(barberPhone, [
      `Special session request! ⚡`,
      ``,
      `${svc.name}`,
      `${dateLabel} at ${requested_time}`,
      `Client: ${customer_name} · ${customer_phone}`,
      client_notes?.trim() ? `Note: ${client_notes.trim()}` : null,
      ``,
      `Reply:`,
      `ACCEPT — confirm at your default $${defaultDollars}`,
      `ACCEPT $200 — confirm at a custom price`,
      `DECLINE — pass on this one`,
    ].filter(Boolean).join("\n")).catch(console.error);
  }

  return NextResponse.json({ ok: true, bookingCode: booking.booking_code });
}
