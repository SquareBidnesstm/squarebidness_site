import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdminSession(req);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { organizerId, action } = await req.json();
  if (!organizerId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (action === "toggle_active") {
    const { data: org } = await supabaseServer.from("organizers").select("active").eq("id", organizerId).single();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await supabaseServer.from("organizers").update({ active: !org.active }).eq("id", organizerId);
    return NextResponse.json({ active: !org.active });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
