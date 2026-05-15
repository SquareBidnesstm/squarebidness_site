import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "../../../../lib/utils";
import { smsOptOut, smsOptIn, STOP_KEYWORDS, START_KEYWORDS } from "../../../../lib/sms-opt-out";

export const runtime = "nodejs";

const TWIML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

/**
 * Validate Twilio's X-Twilio-Signature using Web Crypto (no twilio SDK needed).
 * Algorithm: HMAC-SHA1(authToken, url + sorted_params_concat) → base64
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
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

/**
 * Twilio inbound SMS webhook.
 * Configure in Twilio console → Messaging Service → Settings → Inbound Messages
 * → Send a webhook: https://booking.squarebidness.com/api/twilio/inbound
 *
 * Handles STOP / UNSTOP keywords for our own opt-out tracking.
 */
export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Always read body as text so we can both validate signature and parse params
  const body = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) {
    params[k] = v;
  }

  // Validate Twilio signature when auth token is configured
  if (authToken) {
    const signature = req.headers.get("x-twilio-signature") ?? "";
    const url = `https://booking.squarebidness.com/api/twilio/inbound`;
    const valid = await validateTwilioSignature(authToken, signature, url, params);
    if (!valid) {
      return new NextResponse(TWIML_EMPTY, { status: 403, headers: { "Content-Type": "text/xml" } });
    }
  }

  const from = params["From"] ?? "";
  const messageBody = (params["Body"] ?? "").trim().toLowerCase();

  const phone = normalizePhone(from);
  if (phone) {
    if (STOP_KEYWORDS.has(messageBody)) {
      await smsOptOut(phone);
    } else if (START_KEYWORDS.has(messageBody)) {
      await smsOptIn(phone);
    }
  }

  // Twilio requires a valid TwiML response
  return new NextResponse(TWIML_EMPTY, { status: 200, headers: { "Content-Type": "text/xml" } });
}
