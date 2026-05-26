import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdminSession(req);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, action } = await req.json();
  if (!eventId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (action === "toggle_featured") {
    const { data: ev } = await supabaseServer.from("events").select("is_featured").eq("id", eventId).single();
    if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await supabaseServer.from("events").update({ is_featured: !ev.is_featured }).eq("id", eventId);
    return NextResponse.json({ is_featured: !ev.is_featured });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
