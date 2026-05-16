import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession, checkActiveSubscription } from "../../../../../lib/auth";
import { sendPushToBarber, sendPushToShopAdmins } from "../../../../../lib/push";
import { normalizePhone } from "../../../../../lib/utils";
import { isSmsOptedOut } from "../../../../../lib/sms-opt-out";
import { sendConfirmationEmail } from "../../../../../lib/email";

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authorized = await verifyAdminSession(req, shopSlug);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { barber_id, service_id, customer_name, customer_phone, client_notes } = body;

  if (!barber_id || !service_id) {
    return NextResponse.json({ ok: false, error: "Barber and service are required" }, { status: 400 });
  }

  const { data: shop } = await supabaseServer
    .from("shops").select("id, slug, name, timezone").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const hasActivePlan = await checkActiveSubscription(shop.id);
  if (!hasActivePlan) {
    return NextResponse.json({ ok: false, error: "Subscription inactive. Upgrade to accept bookings." }, { status: 402 });
  }

  const { data: barber } = await supabaseServer
    .from("barbers").select("id, slug, name, display_name").eq("shop_id", shop.id).eq("id", barber_id).eq("active", true).single();
  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });

  const { data: service } = await supabaseServer
    .from("services").select("id, name, price, duration_minutes").eq("shop_id", shop.id).eq("id", service_id).eq("active", true).single();
  if (!service) return NextResponse.json({ ok: false, error: "Service not found" }, { status: 404 });

  const appointmentDate = getTodayString();
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

  // Overlap check — same guard used in bookings/create/route.ts
  const { data: overlaps } = await supabaseServer
    .from("bookings")
    .select("id")
    .eq("barber_id", barber.id)
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());

  if (overlaps && overlaps.length > 0) {
    return NextResponse.json(
      { ok: false, error: "That barber has an existing booking at this time." },
      { status: 409 }
    );
  }

  const { data: rpcCode } = await supabaseServer.rpc("generate_booking_code", { shop_slug: shop.slug });
  const bookingCode = rpcCode ?? `${shopSlug.slice(0, 2).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const name = customer_name?.trim() || "Walk-in";
  const { data: customer } = await supabaseServer
    .from("customers").insert({ shop_id: shop.id, full_name: name }).select("id").single();

  const { data: booking, error: bookingError } = await supabaseServer
    .from("bookings").insert({
      booking_code: bookingCode,
      shop_id: shop.id,
      barber_id: barber.id,
      service_id: service.id,
      customer_id: customer?.id ?? null,
      customer_name: name,
      customer_phone: customer_phone || null,
      client_notes: client_notes || null,
      appointment_date: appointmentDate,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_snapshot: service.price,
      duration_snapshot_minutes: service.duration_minutes,
      status: "confirmed",
      payment_status: "unpaid",
      source: "walk_in",
      confirmed_at: new Date().toISOString(),
    }).select("id, booking_code, customer_name, starts_at, cancel_token").single();

  if (bookingError || !booking) {
    const isOverlap = (bookingError as any)?.code === "23P01";
    return NextResponse.json(
      { ok: false, error: isOverlap ? "That time slot is already booked." : (bookingError?.message || "Could not create booking") },
      { status: isOverlap ? 409 : 500 }
    );
  }

  // Send SMS if phone provided and not opted out
  const normalizedPhone = normalizePhone(customer_phone ?? "");
  const optedOut = normalizedPhone ? await isSmsOptedOut(normalizedPhone) : false;
  if (normalizedPhone && !optedOut) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.DAPPER_FROM_NUMBER;

    if (sid && token && (messagingSid || fromNumber)) {
      const timeStr = new Date(booking.starts_at).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: shop.timezone,
      });
      const body = [
        `You're checked in! ✂️`,
        ``,
        `${name}`,
        `${service.name}`,
        `Today at ${timeStr}`,
        `Barber: ${barber.display_name || barber.name}`,
        `Code: ${booking.booking_code}`,
      ].join("\n");

      const msgParams = new URLSearchParams({ To: normalizedPhone, Body: body });
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

  // Email confirmation if customer provided email
  const customerEmail = (body.customer_email as string | undefined)?.trim() || null;
  if (customerEmail) {
    sendConfirmationEmail({
      to: customerEmail,
      customerName: name,
      shopName: shop.name,
      barberName: barber.display_name || barber.name,
      serviceName: service.name,
      appointmentDate: appointmentDate,
      startsAt: booking.starts_at,
      bookingCode: booking.booking_code,
      timezone: shop.timezone,
      cancelToken: (booking as any).cancel_token ?? null,
    }).catch((err) => console.error("WALKIN EMAIL ERROR:", err instanceof Error ? err.message : err));
  }

  // Push notifications to barber and shop admins
  const apptStr = new Date(booking.starts_at).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: shop.timezone ?? "America/New_York",
  });
  const pushTitle = "Walk-in Booking";
  const pushBody = `${name} — ${service.name} at ${apptStr}`;
  const pushUrl = `/${shopSlug}/admin`;
  sendPushToBarber(barber.id, { title: pushTitle, body: pushBody, url: pushUrl }).catch(console.error);
  sendPushToShopAdmins(shop.id, { title: pushTitle, body: pushBody, url: pushUrl }).catch(console.error);

  return NextResponse.json({
    ok: true,
    booking,
    barber: barber.display_name || barber.name,
    service: service.name,
  });
}
