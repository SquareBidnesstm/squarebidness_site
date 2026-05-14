import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../../lib/auth";

export async function GET(req: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const session = cookieStore.getAll().find((c) => c.name.startsWith("org_session_"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizerSlug = session.name.replace("org_session_", "");
  const expected = await computeOrganizerSessionToken(organizerSlug);
  if (session.value !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabaseServer
    .from("organizers").select("id").eq("slug", organizerSlug).single();
  if (!organizer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  // Verify ownership
  const { data: event } = await supabaseServer
    .from("events")
    .select("id, title, organizer_id")
    .eq("id", eventId)
    .single();

  if (!event || event.organizer_id !== organizer.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch all tickets with order info
  const { data: tickets } = await supabaseServer
    .from("tickets")
    .select(`
      ticket_code, tier_name, status, price_snapshot,
      buyer_name, buyer_email,
      orders ( order_code, buyer_phone, total, created_at, ref_code )
    `)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  const rows = tickets ?? [];

  const escape = (v: string | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const header = ["Name", "Email", "Phone", "Order Code", "Ticket Code", "Tier", "Price", "Ticket Status", "Order Total", "Ref Code", "Purchase Date"].join(",");

  const lines = rows.map((t: any) => {
    const o = t.orders as any;
    return [
      escape(t.buyer_name),
      escape(t.buyer_email),
      escape(o?.buyer_phone),
      escape(o?.order_code),
      escape(t.ticket_code),
      escape(t.tier_name),
      t.price_snapshot != null ? Number(t.price_snapshot).toFixed(2) : "0.00",
      escape(t.status),
      o?.total != null ? Number(o.total).toFixed(2) : "",
      escape(o?.ref_code),
      o?.created_at ? new Date(o.created_at).toLocaleDateString("en-US") : "",
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");
  const filename = `${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-attendees.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
