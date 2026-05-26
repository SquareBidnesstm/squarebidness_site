// /api/phomatic/booking/create.js
// POST /api/phomatic/booking/create
// Validates input, inserts pending booking in Supabase, creates Stripe Checkout Session.
// Returns { ok, checkoutUrl } — frontend redirects to Stripe.

import Stripe from "stripe";
import {
  SERVICES, sbInsert, sbSelect, sbUpdate,
  generateBookingCode, generateCancelToken,
  normalizePhone, isAvailableDay, formatDate, esc,
} from "../_config.js";

const BASE_URL = "https://www.squarebidness.com";

function getStripe() {
  const key = process.env.PHOMATIC_STRIPE_SECRET_KEY;
  if (!key) throw new Error("PHOMATIC_STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = req.body || {};

    // ---- Input extraction ----
    const serviceId    = esc(body.service_id);
    const tierHours    = body.tier_hours ? Number(body.tier_hours) : null;
    const sessionDate  = esc(body.session_date);   // YYYY-MM-DD
    const sessionTime  = esc(body.session_time);   // "10:00 AM"
    const clientName   = esc(body.client_name).slice(0, 120);
    const clientPhoneRaw = esc(body.client_phone);
    const clientEmail  = esc(body.client_email).slice(0, 200) || null;
    const clientNotes  = esc(body.client_notes).slice(0, 1000) || null;

    // ---- Validate required fields ----
    if (!serviceId || !sessionDate || !sessionTime || !clientName || !clientPhoneRaw) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    // ---- Validate service ----
    const service = SERVICES[serviceId];
    if (!service) return res.status(400).json({ ok: false, error: "Invalid service" });

    // ---- Resolve price / deposit ----
    let totalPrice, depositAmount, durationMinutes, serviceName;
    if (service.tiers) {
      // Event or Wedding — tier_hours required
      const tier = service.tiers.find((t) => t.hours === tierHours);
      if (!tier) return res.status(400).json({ ok: false, error: "Invalid tier selection" });
      totalPrice = tier.price;
      depositAmount = tier.deposit;
      durationMinutes = tierHours * 60;
      serviceName = `${service.name} (${tierHours} hrs)`;
    } else {
      totalPrice = service.price;
      depositAmount = service.deposit;
      durationMinutes = service.durationMinutes;
      serviceName = service.name;
    }

    // ---- Validate date ----
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(`${sessionDate}T12:00:00`);
    if (target < today) return res.status(400).json({ ok: false, error: "Date is in the past" });
    if (!isAvailableDay(sessionDate)) return res.status(400).json({ ok: false, error: "Date not available" });

    // ---- Validate phone ----
    const clientPhone = normalizePhone(clientPhoneRaw);
    if (!clientPhone) return res.status(400).json({ ok: false, error: "Invalid phone number" });

    // ---- Check for blocked date ----
    const { data: blocked } = await sbSelect("phomatic_blocked_dates", {
      blocked_date: `eq.${sessionDate}`,
    }, { select: "id", limit: 1 });
    if (Array.isArray(blocked) && blocked.length > 0) {
      return res.status(409).json({ ok: false, error: "This date is unavailable. Please choose another." });
    }

    // ---- Check slot availability ----
    const { data: conflicts } = await sbSelect("phomatic_bookings", {
      session_date: `eq.${sessionDate}`,
      session_time: `eq.${sessionTime}`,
      status: "in.(pending,confirmed)",
    }, { select: "id", limit: 1 });
    if (Array.isArray(conflicts) && conflicts.length > 0) {
      return res.status(409).json({ ok: false, error: "This time slot was just taken. Please pick another." });
    }

    // ---- Generate codes ----
    const bookingCode = generateBookingCode();
    const cancelToken = generateCancelToken();
    const dateFormatted = formatDate(sessionDate);
    const balanceDue = totalPrice - depositAmount;

    // ---- Insert pending booking ----
    const { ok: insertOk, data: insertData, status: insertStatus } = await sbInsert("phomatic_bookings", {
      booking_code: bookingCode,
      cancel_token: cancelToken,
      service_id: serviceId,
      service_name: serviceName,
      duration_minutes: durationMinutes,
      session_date: sessionDate,
      session_time: sessionTime,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail,
      client_notes: clientNotes,
      total_price_cents: totalPrice * 100,
      deposit_cents: depositAmount * 100,
      balance_due_cents: balanceDue * 100,
      status: "pending",
    });

    if (!insertOk) {
      console.error("PHOMATIC BOOKING INSERT FAILED:", insertStatus, insertData);
      // 23505 = unique violation (booking code collision — rare but retry-able)
      return res.status(500).json({ ok: false, error: "Could not create booking. Please try again." });
    }

    const booking = Array.isArray(insertData) ? insertData[0] : insertData;

    // ---- Create Stripe Checkout Session ----
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `${serviceName} — Deposit`,
            description: `${dateFormatted} at ${sessionTime} · Remaining $${balanceDue} due at session`,
            images: [`${BASE_URL}/phomatic/assets/icons/pho-icon-512.png`],
          },
          unit_amount: depositAmount * 100, // cents
        },
        quantity: 1,
      }],
      mode: "payment",
      customer_email: clientEmail || undefined,
      success_url: `${BASE_URL}/phomatic/book/confirmed/?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/phomatic/book/`,
      metadata: {
        booking_id: booking.id,
        booking_code: bookingCode,
        cancel_token: cancelToken,
        tenant: "phomatic",
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min to complete payment
    });

    // ---- Store Stripe session ID on booking ----
    const { ok: updateOk } = await sbUpdate(
      "phomatic_bookings",
      { id: `eq.${booking.id}` },
      { stripe_checkout_session_id: session.id }
    );
    if (!updateOk) {
      // Non-fatal — webhook will still find the booking via metadata
      console.warn("PHOMATIC: Failed to store checkout session ID on booking", booking.id);
    }

    return res.status(200).json({
      ok: true,
      checkoutUrl: session.url,
      bookingCode,
    });

  } catch (err) {
    console.error("PHOMATIC BOOKING CREATE ERROR:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Unexpected error" });
  }
}
