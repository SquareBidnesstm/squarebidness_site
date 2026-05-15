import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";
import { normalizePhone } from "../../../../../lib/utils";
import { isSmsOptedOut } from "../../../../../lib/sms-opt-out";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id, name").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { message, audience } = body as {
    message?: string;
    // "all" | "upcoming" | "recent_30" | "recent_90"
    audience?: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });
  }
  if (message.trim().length > 1000) {
    return NextResponse.json({ ok: false, error: "Message too long (max 1000 chars)" }, { status: 400 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.DAPPER_FROM_NUMBER;

  if (!sid || !token || (!messagingSid && !fromNumber)) {
    return NextResponse.json({ ok: false, error: "SMS not configured" }, { status: 500 });
  }

  // Build audience query
  const now = new Date();
  let phoneQuery = supabaseServer
    .from("bookings")
    .select("customer_phone")
    .eq("shop_id", shop.id)
    .not("customer_phone", "is", null)
    .neq("status", "cancelled");

  if (audience === "upcoming") {
    phoneQuery = phoneQuery
      .in("status", ["confirmed", "pending"])
      .gte("starts_at", now.toISOString());
  } else if (audience === "recent_30") {
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    phoneQuery = phoneQuery.gte("starts_at", cutoff.toISOString()).lte("starts_at", now.toISOString());
  } else if (audience === "recent_90") {
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    phoneQuery = phoneQuery.gte("starts_at", cutoff.toISOString()).lte("starts_at", now.toISOString());
  }
  // default "all" = no extra filter

  const { data: phoneRows } = await phoneQuery;

  // Deduplicate phones
  const uniquePhones = new Set<string>();
  for (const row of phoneRows ?? []) {
    const normalized = normalizePhone(row.customer_phone as string);
    if (normalized) uniquePhones.add(normalized);
  }

  if (uniquePhones.size === 0) {
    return NextResponse.json({ ok: false, error: "No recipients found for this audience" }, { status: 400 });
  }

  // Filter out phones that have opted out of SMS
  const optOutChecks = await Promise.all(
    Array.from(uniquePhones).map(async (phone) => ({ phone, optedOut: await isSmsOptedOut(phone) }))
  );
  for (const { phone, optedOut } of optOutChecks) {
    if (optedOut) uniquePhones.delete(phone);
  }

  if (uniquePhones.size === 0) {
    return NextResponse.json({ ok: false, error: "All recipients have opted out of SMS" }, { status: 400 });
  }

  const shopBookingUrl = `https://booking.squarebidness.com/${shopSlug}`;
  const fullMessage = `${message.trim()}\n\nBook: ${shopBookingUrl}`;

  const creds = Buffer.from(`${sid}:${token}`).toString("base64");
  let sent = 0;
  let failed = 0;

  // Send in parallel batches of 10 to balance speed vs. Twilio rate limits
  const BATCH_SIZE = 10;
  const phones = Array.from(uniquePhones);

  async function sendOne(phone: string): Promise<boolean> {
    const msgParams = new URLSearchParams({ To: phone, Body: fullMessage });
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
      return res.ok;
    } catch {
      return false;
    }
  }

  for (let i = 0; i < phones.length; i += BATCH_SIZE) {
    const batch = phones.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(sendOne));
    for (const ok of results) { if (ok) sent++; else failed++; }
  }

  return NextResponse.json({ ok: true, sent, failed, total: uniquePhones.size });
}
