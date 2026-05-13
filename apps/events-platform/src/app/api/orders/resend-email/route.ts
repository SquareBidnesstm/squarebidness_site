import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { sendBuyerConfirmation } from "../../../../lib/notifications/email";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const orderId = formData.get("orderId") as string;

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
  } catch {
    return NextResponse.redirect(new URL(`/orders/${orderId}?resend=error`, req.url), 303);
  }

  return NextResponse.redirect(new URL(`/orders/${orderId}?resend=sent`, req.url), 303);
}
