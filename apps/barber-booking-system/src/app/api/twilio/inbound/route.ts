import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { normalizePhone } from "../../../../lib/utils";
import { smsOptOut, smsOptIn, isSmsOptedOut, STOP_KEYWORDS, START_KEYWORDS } from "../../../../lib/sms-opt-out";

export const runtime = "nodejs";

const TWIML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

// ─── Twilio signature validation ────────────────────────────────────────────
async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  const sortedStr = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], "");
  const message = url + sortedStr;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return computed === signature;
}

// ─── SMS send helper ─────────────────────────────────────────────────────────
// Always checks sms_opt_outs before sending — respects user opt-out status.
async function sendSms(to: string, body: string): Promise<void> {
  // Skip send if recipient has opted out
  const optedOut = await isSmsOptedOut(to).catch(() => false);
  if (optedOut) return;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.PLATFORM_FROM_NUMBER;
  if (!sid || !token || (!messagingSid && !fromNumber)) return;

  const msgParams = new URLSearchParams({ To: to, Body: body });
  if (messagingSid) {
    msgParams.set("MessagingServiceSid", messagingSid);
  } else {
    msgParams.set("From", fromNumber!);
  }
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: msgParams.toString(),
  });
}

// ─── Time parser ─────────────────────────────────────────────────────────────
// Parses flexible SMS time inputs like "11", "2pm", "11:30 AM", "14:00"
// Returns { display: "2:30 PM", h24: "14:30" } or null
function parseSmsTime(raw: string): { display: string; h24: string } | null {
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
    // No meridiem: treat values >= 13 as 24-hr, otherwise assume AM
    h24 = hour >= 13 && hour <= 23 ? hour : hour >= 0 && hour <= 12 ? hour : -1;
  }
  if (h24 < 0 || h24 > 23) return null;

  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const amPm = h24 >= 12 ? "PM" : "AM";
  const display = `${h12}:${String(minute).padStart(2, "0")} ${amPm}`;
  const h24Str = `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { display, h24: h24Str };
}

// ─── Format a date string for SMS ────────────────────────────────────────────
function fmtDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ─── Parse an ACCEPT price from "accept $150" / "accept 150" ─────────────────
function parseAcceptPrice(msg: string): number | null | "too_high" {
  const m = msg.match(/^accept\s*\$?(\d+(?:\.\d{1,2})?)$/i);
  if (!m) return null;
  const dollars = parseFloat(m[1]);
  if (isNaN(dollars) || dollars < 1) return null;
  if (dollars > 10000) return "too_high";
  return Math.round(dollars * 100);
}

// ─── Handle barber reply to a pending_approval booking ───────────────────────
async function handleBarberReply(barberPhone: string, messageBody: string) {
  const { data: barbers } = await supabaseServer
    .from("barbers")
    .select("id, slug, name, display_name, shop_id, special_sessions_price_cents")
    .eq("phone", barberPhone)
    .eq("active", true)
    .limit(5);

  if (!barbers || barbers.length === 0) return false;

  for (const barber of barbers) {
    const { data: rows } = await supabaseServer
      .from("bookings")
      .select(
        "id, booking_code, customer_name, customer_phone, appointment_date, starts_at, ends_at, service_id, cancel_token, is_special_session"
      )
      .eq("barber_id", barber.id)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!rows || rows.length === 0) continue;

    const booking = rows[0];
    const clientPhone = normalizePhone(booking.customer_phone ?? "");
    const barberName = barber.display_name || barber.name;
    const rebookBase = "https://booking.squarebidness.com";
    const cancelUrl = booking.cancel_token ? `${rebookBase}/cancel/${booking.cancel_token}` : null;
    const msg = messageBody.trim().toLowerCase();

    // ── Branch: special session vs regular ───────────────────────────────────
    if (booking.is_special_session) {
      // Fetch shop slug once — used in both ACCEPT and DECLINE branches
      const { data: shop } = await supabaseServer
        .from("shops").select("slug").eq("id", barber.shop_id).single();
      const shopSlug = shop?.slug ?? "shop";

      // ── ACCEPT (with optional price override) ──────────────────────────────
      const isAccept = msg === "accept" || msg === "yes" || msg === "ok" || msg === "approve";
      const parsedPrice = parseAcceptPrice(msg);

      if (parsedPrice === "too_high") {
        await sendSms(barberPhone, `Price too high. Max $10,000.`).catch(console.error);
        return true;
      }

      const customPriceCents = parsedPrice as number | null;

      if (isAccept || customPriceCents !== null) {
        const priceCents = customPriceCents
          ?? barber.special_sessions_price_cents
          ?? 15000;

        // C-2: Optimistic lock — claim the booking BEFORE creating the Stripe session.
        // If 0 rows updated, another ACCEPT already won the race; ack silently.
        const { data: claimedRows } = await supabaseServer
          .from("bookings")
          .update({ status: "awaiting_payment", special_session_price_cents: priceCents })
          .eq("id", booking.id)
          .eq("status", "pending_approval")
          .select("id");

        if (!claimedRows || claimedRows.length === 0) {
          // Race lost — already claimed by a concurrent ACCEPT. Ack and exit.
          await sendSms(barberPhone,
            `Payment link already sent for ${booking.customer_name}. No action needed.`
          ).catch(console.error);
          return true;
        }

        // Create Stripe Checkout for full payment
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });
        const { data: svc } = await supabaseServer
          .from("services").select("name").eq("id", booking.service_id).single();

        const dateLabel = fmtDate(booking.appointment_date);
        const timeLabel = new Date(booking.starts_at).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit",
        });
        const priceDollars = (priceCents / 100).toFixed(2);

        let checkoutUrl = "";
        let checkoutSessionId = "";
        try {
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{
              price_data: {
                currency: "usd",
                unit_amount: priceCents,
                product_data: {
                  name: `Special Session ⚡ — ${svc?.name ?? "Service"}`,
                  description: `${booking.customer_name} · ${dateLabel} at ${timeLabel}`,
                },
              },
              quantity: 1,
            }],
            success_url: `https://booking.squarebidness.com/api/${shopSlug}/booking/special-session/confirm?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://booking.squarebidness.com/${shopSlug}`,
            metadata: { booking_id: booking.id, shop_slug: shopSlug },
            expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hrs
          });
          checkoutUrl = session.url ?? "";
          checkoutSessionId = session.id;
        } catch (err) {
          console.error("SPECIAL SESSION: Stripe checkout error:", err instanceof Error ? err.message : err);
          // Roll back the optimistic claim so barber can try again
          await supabaseServer
            .from("bookings")
            .update({ status: "pending_approval" })
            .eq("id", booking.id)
            .then(({ error }) => { if (error) console.error("SPECIAL SESSION: rollback error:", error); });
          await sendSms(barberPhone, `Could not create payment link. Try replying ACCEPT again.`).catch(console.error);
          return true;
        }

        // Persist the checkout session ID
        await supabaseServer.from("bookings").update({
          special_session_checkout_id: checkoutSessionId,
        }).eq("id", booking.id);

        // SMS to client with payment link
        if (clientPhone) {
          await sendSms(clientPhone, [
            `Special session accepted! ⚡`,
            ``,
            `${booking.customer_name}`,
            `${svc?.name ?? "Service"} — ${dateLabel} at ${timeLabel}`,
            `Barber: ${barberName}`,
            ``,
            `Full payment: $${priceDollars}`,
            `Pay to confirm (link expires in 24 hrs):`,
            checkoutUrl,
            cancelUrl ? `\nCancel instead: ${cancelUrl}` : null,
          ].filter(Boolean).join("\n")).catch(console.error);
        }

        // Ack barber
        await sendSms(barberPhone,
          `Payment link sent to ${booking.customer_name} for $${priceDollars}. Waiting for payment.`
        ).catch(console.error);

        return true;
      }

      // ── DECLINE ────────────────────────────────────────────────────────────
      if (msg === "decline" || msg === "no" || msg === "cancel" || msg === "reject") {
        await supabaseServer.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
        if (clientPhone) {
          // H-2: Use shopSlug (fetched above), not barber.shop_id (a UUID)
          await sendSms(clientPhone, [
            `Sorry — your special session request wasn't accepted. ⚡`,
            `Book a regular appointment: ${rebookBase}/${shopSlug}`,
          ].join("\n")).catch(console.error);
        }
        return true;
      }

      // Unrecognized — prompt
      await sendSms(barberPhone,
        `Reply ACCEPT (or ACCEPT $200 for custom price) or DECLINE for ${booking.customer_name}'s special session request.`
      ).catch(console.error);
      return true;
    }

    // ── Regular pending_approval (manual approval flow) ──────────────────────

    // ── CONFIRM / YES ────────────────────────────────────────────────────────
    if (msg === "confirm" || msg === "yes" || msg === "ok" || msg === "approve") {
      await supabaseServer
        .from("bookings")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", booking.id);

      if (clientPhone) {
        const dateLabel = fmtDate(booking.appointment_date);
        const timeLabel = new Date(booking.starts_at).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit",
        });
        await sendSms(clientPhone, [
          `You're confirmed! ✂️`,
          ``,
          `${booking.customer_name}`,
          `${dateLabel} at ${timeLabel}`,
          `Barber: ${barberName}`,
          `Code: ${booking.booking_code}`,
          cancelUrl ? `\nCancel: ${cancelUrl}` : null,
        ].filter(Boolean).join("\n")).catch(console.error);
      }
      return true;
    }

    // ── DECLINE / NO / CANCEL ────────────────────────────────────────────────
    if (msg === "decline" || msg === "no" || msg === "cancel" || msg === "reject") {
      await supabaseServer.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
      if (clientPhone) {
        await sendSms(clientPhone, [
          `Sorry — your booking request wasn't accepted. ✂️`,
          ``,
          booking.cancel_token
            ? `Book another time: ${rebookBase}/cancel/${booking.cancel_token}`
            : `Visit us to book again.`,
        ].join("\n")).catch(console.error);
      }
      return true;
    }

    // ── ALT TIME (counter-proposal) ──────────────────────────────────────────
    const parsed = parseSmsTime(messageBody.trim());
    if (parsed) {
      await supabaseServer
        .from("bookings")
        .update({ status: "counter_proposed", counter_time: parsed.display })
        .eq("id", booking.id);

      if (clientPhone) {
        const dateLabel = fmtDate(booking.appointment_date);
        const originalTime = new Date(booking.starts_at).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit",
        });
        await sendSms(clientPhone, [
          `Update on your booking request ✂️`,
          ``,
          `${barberName} can't do ${originalTime} on ${dateLabel}.`,
          `They proposed ${parsed.display} instead.`,
          ``,
          `Reply YES to accept or NO to cancel.`,
        ].join("\n")).catch(console.error);
      }

      await sendSms(barberPhone,
        `Counter-proposal sent to ${booking.customer_name} for ${parsed.display}. Waiting for their reply.`
      ).catch(console.error);
      return true;
    }

    // Reply not recognized
    await sendSms(barberPhone,
      `Reply CONFIRM, DECLINE, or a time (e.g. 2:00 PM) for ${booking.customer_name}'s booking request.`
    ).catch(console.error);
    return true;
  }

  return false;
}

// ─── Handle client reply to counter_proposed booking ─────────────────────────
async function handleClientReply(clientPhone: string, messageBody: string) {
  // Find most recent counter_proposed booking for this client
  const { data: rows } = await supabaseServer
    .from("bookings")
    .select(
      "id, booking_code, customer_name, appointment_date, counter_time, service_id, cancel_token, barber_id"
    )
    .eq("customer_phone", clientPhone)
    .eq("status", "counter_proposed")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!rows || rows.length === 0) return false;

  const booking = rows[0];
  const msg = messageBody.trim().toLowerCase();
  const rebookBase = "https://booking.squarebidness.com";
  const cancelUrl = booking.cancel_token ? `${rebookBase}/cancel/${booking.cancel_token}` : null;

  // Fetch barber info for the notification back
  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("name, display_name, phone")
    .eq("id", booking.barber_id)
    .single();

  const barberPhone = normalizePhone(barber?.phone ?? "");
  const barberName = barber?.display_name || barber?.name || "Your barber";

  // ── YES / ACCEPT ────────────────────────────────────────────────────────────
  if (msg === "yes" || msg === "confirm" || msg === "ok" || msg === "accept") {
    const counterTime = booking.counter_time; // e.g. "2:00 PM"
    let newStartsAt = "";
    let newEndsAt = "";

    if (counterTime) {
      // Parse the counter time and compute new starts_at / ends_at
      const parsed = parseSmsTime(counterTime);
      if (parsed) {
        const apptDate = booking.appointment_date;
        const newStart = new Date(`${apptDate}T${parsed.h24}:00`);

        // Fetch service duration to compute endsAt
        const { data: svc } = await supabaseServer
          .from("services")
          .select("duration_minutes")
          .eq("id", booking.service_id)
          .single();

        const dur = svc?.duration_minutes ?? 60;
        const newEnd = new Date(newStart.getTime() + dur * 60 * 1000);
        newStartsAt = newStart.toISOString();
        newEndsAt = newEnd.toISOString();

        // H-4: Overlap check — make sure the proposed counter time is still open
        const { data: overlaps } = await supabaseServer
          .from("bookings")
          .select("id")
          .eq("barber_id", booking.barber_id)
          .in("status", ["pending", "confirmed", "pending_approval", "awaiting_payment"])
          .neq("id", booking.id)
          .lt("starts_at", newEnd.toISOString())
          .gt("ends_at", newStart.toISOString());

        if (overlaps && overlaps.length > 0) {
          await sendSms(clientPhone, [
            `Sorry — that time is no longer available. ✂️`,
            ``,
            `Reply NO to cancel, or contact us to reschedule.`,
          ].join("\n")).catch(console.error);
          if (barberPhone) {
            await sendSms(barberPhone,
              `${booking.customer_name} tried to accept ${counterTime} but it's now taken. Please contact them directly.`
            ).catch(console.error);
          }
          return true;
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    };
    if (newStartsAt) {
      updatePayload.starts_at = newStartsAt;
      updatePayload.ends_at = newEndsAt;
    }

    await supabaseServer.from("bookings").update(updatePayload).eq("id", booking.id);

    const dateLabel = fmtDate(booking.appointment_date);
    // Confirm SMS to client
    await sendSms(
      clientPhone,
      [
        `You're confirmed! ✂️`,
        ``,
        `${booking.customer_name}`,
        `${dateLabel} at ${counterTime ?? "your requested time"}`,
        `Barber: ${barberName}`,
        `Code: ${booking.booking_code}`,
        cancelUrl ? `\nCancel: ${cancelUrl}` : null,
      ].filter(Boolean).join("\n")
    ).catch(console.error);

    // Notify barber
    if (barberPhone) {
      await sendSms(
        barberPhone,
        `${booking.customer_name} accepted ${counterTime}. ✅ Booking confirmed.`
      ).catch(console.error);
    }

    return true;
  }

  // ── NO / DECLINE ────────────────────────────────────────────────────────────
  if (msg === "no" || msg === "cancel" || msg === "decline" || msg === "reject") {
    await supabaseServer
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    await sendSms(
      clientPhone,
      `No problem. Your booking request has been cancelled. ✂️`
    ).catch(console.error);

    if (barberPhone) {
      await sendSms(
        barberPhone,
        `${booking.customer_name} declined ${booking.counter_time ?? "the proposed time"}. Booking cancelled.`
      ).catch(console.error);
    }

    return true;
  }

  // Unrecognized reply — nudge client
  await sendSms(
    clientPhone,
    `Reply YES to accept ${booking.counter_time ?? "the proposed time"} or NO to cancel your booking.`
  ).catch(console.error);
  return true;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
/**
 * Twilio inbound SMS webhook.
 * Configure in Twilio console → Messaging Service → Settings → Inbound Messages
 * → Webhook URL: https://booking.squarebidness.com/api/twilio/inbound
 *
 * Handles:
 *   1. STOP / UNSTOP opt-out keywords (always checked first)
 *   2. Barber replies to pending_approval bookings (CONFIRM / DECLINE / alt time)
 *   3. Client replies to counter_proposed bookings (YES / NO)
 */
export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // C-1: Refuse to accept ANY inbound webhook without a configured auth token.
  // A missing token means we cannot validate signatures — treat as misconfiguration.
  if (!authToken) {
    console.error("[twilio/inbound] TWILIO_AUTH_TOKEN is not set — rejecting webhook (misconfiguration)");
    return new NextResponse(TWIML_EMPTY, { status: 500, headers: { "Content-Type": "text/xml" } });
  }

  const body = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) {
    params[k] = v;
  }

  // Always validate Twilio signature
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "booking.squarebidness.com";
  const url = `${proto}://${host}/api/twilio/inbound`;
  const valid = await validateTwilioSignature(authToken, signature, url, params);
  if (!valid) {
    return new NextResponse(TWIML_EMPTY, { status: 403, headers: { "Content-Type": "text/xml" } });
  }

  const from = params["From"] ?? "";
  const messageBody = (params["Body"] ?? "").trim();
  const messageLower = messageBody.toLowerCase();

  const phone = normalizePhone(from);
  if (!phone) {
    return new NextResponse(TWIML_EMPTY, { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  // 1. Opt-out handling always runs first
  if (STOP_KEYWORDS.has(messageLower)) {
    await smsOptOut(phone);
    return new NextResponse(TWIML_EMPTY, { status: 200, headers: { "Content-Type": "text/xml" } });
  }
  if (START_KEYWORDS.has(messageLower)) {
    await smsOptIn(phone);
    return new NextResponse(TWIML_EMPTY, { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  // 2. Check if this is a barber replying to a pending_approval booking
  try {
    const handledByBarber = await handleBarberReply(phone, messageBody);
    if (handledByBarber) {
      return new NextResponse(TWIML_EMPTY, { status: 200, headers: { "Content-Type": "text/xml" } });
    }
  } catch (err) {
    console.error("TWILIO INBOUND: barber reply error", err instanceof Error ? err.message : err);
  }

  // 3. Check if this is a client replying to a counter_proposed booking
  try {
    await handleClientReply(phone, messageBody);
  } catch (err) {
    console.error("TWILIO INBOUND: client reply error", err instanceof Error ? err.message : err);
  }

  return new NextResponse(TWIML_EMPTY, { status: 200, headers: { "Content-Type": "text/xml" } });
}
