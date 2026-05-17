import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { sendBuyerConfirmation } from "../../../../lib/notifications/email";
import { checkRateLimit, recordAttempt, isSafeOrigin } from "../../../../lib/utils";

export async function POST(req: NextRequest) {
  // CSRF origin check
  if (!isSafeOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 5 resends per 15 min per IP (prevents email spam)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`resend_email:${ip}`);
  const { limited, retryAfterSeconds } = checkRateLimit(`resend_email:${ip}`, 5);
  if (limited) {
    return NextResponse.redirect(
      new URL(`/orders?error=too_many_requests&retry=${Math.ceil(retryAfterSeconds / 60)}`, req.url),
      303
    );
  }

  const formData = await req.formData();
  const orderId = formData.get("orderId") as string;
  const buyerEmail = (formData.get("buyerEmail") as string | null)?.trim().toLowerCase();

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const { data: order } = await supabaseServer
    .from("orders")
    .select("*, events ( title, slug, starts_at, ends_at, venue_name, city, state, cover_image_url ), tickets ( id, ticket_code, tier_name, qr_code )")
    .eq("id", orderId)
    .eq("status", "paid")
    .single();

  if (!order) {
    return NextResponse.redirect(new URL(`/orders/${orderId}?resend=error`, req.url), 303);
  }

  // Verify the requester owns this order — prevents unauthenticated email spam.
  // Use the same redirect as not-found so callers cannot distinguish a valid
  // order ID from an invalid one (prevents order enumeration).
  if (!buyerEmail || buyerEmail !== order.buyer_email.trim().toLowerCase()) {
    return NextResponse.redirect(new URL(`/orders/${orderId}?resend=error`, req.url), 303);
  }

  const ev = order.events as any;
  const tickets = (order.tickets as any[]) ?? [];

  const eventDate = ev?.starts_at
    ? new Date(ev.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "";
  const eventTime = ev?.starts_at
    ? new Date(ev.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";

  try {
    await sendBuyerConfirmation({
      buyerName: order.buyer_name,
      buyerEmail: order.buyer_email,
      orderCode: order.order_code,
      orderId: order.id,
      eventTitle: ev?.title ?? "",
      eventDate,
      eventTime,
      venueName: ev?.venue_name ?? null,
      city: ev?.city ?? null,
      state: ev?.state ?? null,
      tickets: tickets.map((t: any) => ({
        ticketCode: t.ticket_code,
        tierName: t.tier_name ?? "Ticket",
        qrDataUrl: t.qr_code ?? "",
      })),
      total: Number(order.total),
      coverImageUrl: ev?.cover_image_url ?? null,
      eventSlug: ev?.slug ?? undefined,
    });
  } catch (err) {
    console.error("[resend-email] Failed to resend confirmation email:", err);
    return NextResponse.redirect(new URL(`/orders/${orderId}?resend=error`, req.url), 303);
  }

  return NextResponse.redirect(new URL(`/orders/${orderId}?resend=sent`, req.url), 303);
}
