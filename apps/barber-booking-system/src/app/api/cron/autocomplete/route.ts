import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mark confirmed/pending bookings whose ends_at is in the past as completed
  const { data, error } = await supabaseServer
    .from("bookings")
    .update({ status: "completed" })
    .in("status", ["confirmed", "pending"])
    .lt("ends_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("Auto-complete error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, completed: data?.length ?? 0 });
}
