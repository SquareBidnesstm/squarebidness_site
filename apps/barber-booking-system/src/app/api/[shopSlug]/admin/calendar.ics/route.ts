import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

function icsDate(iso: string): string {
  // "20260514T130000Z"
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: shop } = await supabaseServer
    .from("shops").select("id, name, timezone").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return new NextResponse("Shop not found", { status: 404 });

  // Optional barber filter
  const barberSlug = new URL(req.url).searchParams.get("barber");

  let query = supabaseServer
    .from("bookings")
    .select("id, booking_code, starts_at, ends_at, customer_name, customer_phone, barbers(name, display_name, slug), services(name)")
    .eq("shop_id", shop.id)
    .in("status", ["confirmed", "pending", "completed"]);

  if (barberSlug) {
    const { data: barber } = await supabaseServer
      .from("barbers").select("id").eq("shop_id", shop.id).eq("slug", barberSlug).single();
    if (barber) query = query.eq("barber_id", barber.id);
  }

  // Bookings in the last 30 days + all upcoming
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  query = query.gte("starts_at", cutoff).order("starts_at");

  const { data: bookings } = await query;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//SquareBidness//Barber Booking//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(shop.name)} Bookings`,
    `X-WR-TIMEZONE:${shop.timezone}`,
  ];

  for (const b of bookings ?? []) {
    const barberName = (b.barbers as any)?.display_name || (b.barbers as any)?.name || "";
    const serviceName = (b.services as any)?.name || "";
    const summary = `${escape(b.customer_name)} — ${escape(serviceName)}`;
    const description = [
      `Customer: ${b.customer_name}`,
      `Phone: ${b.customer_phone}`,
      `Service: ${serviceName}`,
      `Barber: ${barberName}`,
      `Code: ${b.booking_code}`,
    ].join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@squarebidness.com`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(b.starts_at)}`,
      `DTEND:${icsDate(b.ends_at)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  const ics = lines.join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${shopSlug}-bookings.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
