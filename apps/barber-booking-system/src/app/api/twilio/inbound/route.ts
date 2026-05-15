import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { normalizePhone } from "../../../../lib/utils";
import { smsOptOut, smsOptIn, STOP_KEYWORDS, START_KEYWORDS } from "../../../../lib/sms-opt-out";

export const runtime = "nodejs";

/**
 * Twilio inbound SMS webhook.
 * Configure this URL in your Twilio console → Messaging → Phone Numbers (or Messaging Service)
 * → Incoming Messages: https://booking.squarebidness.com/api/twilio/inbound
 *
 * Handles STOP / UNSTOP keywords for our own opt-out tracking.
 * Twilio already suppresses delivery automatically, but we track it ourselves
 * so we can filter before even attempting to send (saves Twilio credits + avoids errors).
 */
export async function POST(req: NextRequest) {
  // Validate Twilio signature
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = req.headers.get("x-twilio-signature") ?? "";
    const url = `https://booking.squarebidness.com/api/twilio/inbound`;
    const body = await req.text();
    const params: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(body)) {
      params[k] = v;
    }

    const valid = twilio.validateRequest(authToken, signature, url, params);
    if (!valid) {
      // Return 403 but still send a TwiML empty response so Twilio doesn't retry
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 403, headers: { "Content-Type": "text/xml" } }
      );
    }

    // Re-parse from already-consumed body
    const formData = new URLSearchParams(body);
    const from = formData.get("From") ?? "";
    const messageBody = (formData.get("Body") ?? "").trim().toLowerCase();

    const phone = normalizePhone(from);
    if (phone) {
      if (STOP_KEYWORDS.has(messageBody)) {
        await smsOptOut(phone);
      } else if (START_KEYWORDS.has(messageBody)) {
        await smsOptIn(phone);
      }
    }
  } else {
    // No auth token configured — just parse and handle
    const formData = await req.formData();
    const from = formData.get("From")?.toString() ?? "";
    const messageBody = (formData.get("Body")?.toString() ?? "").trim().toLowerCase();

    const phone = normalizePhone(from);
    if (phone) {
      if (STOP_KEYWORDS.has(messageBody)) {
        await smsOptOut(phone);
      } else if (START_KEYWORDS.has(messageBody)) {
        await smsOptIn(phone);
      }
    }
  }

  // Return empty TwiML — Twilio requires a valid XML response
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}
