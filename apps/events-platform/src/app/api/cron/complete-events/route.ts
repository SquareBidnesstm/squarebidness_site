import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Verify cron secret — must match CRON_SECRET env var
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Transition published events whose end time has passed to completed
  const { data, error } = await supabaseServer
    .from("events")
    .update({ status: "completed" })
    .eq("status", "published")
    .lt("ends_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("cron/complete-events error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const completed = data?.length ?? 0;
  console.log(`cron/complete-events: marked ${completed} event(s) as completed`);
  return NextResponse.json({ ok: true, completed });
}
