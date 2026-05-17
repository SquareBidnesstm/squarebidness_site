// /api/phomatic/booking/session.js
// GET /api/phomatic/booking/session?id=cs_live_xxxxx
// Used by the confirmation page to retrieve booking details after Stripe redirects back.
// Only returns safe fields — no sensitive payment details.

import Stripe from "stripe";
import { sbSelect } from "../_config.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { id } = req.query;
  if (!id || !String(id).startsWith("cs_")) {
    return res.status(400).json({ ok: false, error: "Invalid session ID" });
  }

  try {
    // Verify session with Stripe (ensures it actually completed)
    const stripe = new Stripe(process.env.PHOMATIC_STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.retrieve(id);

    if (session.payment_status !== "paid") {
      return res.status(402).json({ ok: false, error: "Payment not completed" });
    }

    const bookingCode = session.metadata?.booking_code;
    if (!bookingCode) return res.status(404).json({ ok: false, error: "Booking reference not found" });

    // Fetch booking from Supabase
    const { data: rows } = await sbSelect("phomatic_bookings",
      { booking_code: `eq.${bookingCode}` },
      {
        select: "booking_code,service_name,session_date,session_time,client_name,client_phone,client_email,client_notes,total_price_cents,deposit_cents,balance_due_cents,status,created_at",
        limit: 1,
      }
    );
    const booking = Array.isArray(rows) ? rows[0] : null;
    if (!booking) return res.status(404).json({ ok: false, error: "Booking not found" });

    return res.status(200).json({ ok: true, booking });
  } catch (err) {
    console.error("PHOMATIC SESSION LOOKUP ERROR:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Failed to retrieve session" });
  }
}
