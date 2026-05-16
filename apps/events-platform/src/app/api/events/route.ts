import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";
import { checkRateLimit, recordAttempt } from "../../../lib/utils";

export async function GET(req: NextRequest) {
  // Rate limit: 20 requests per 15 min per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`events_list:${ip}`);
  const { limited, retryAfterSeconds } = checkRateLimit(`events_list:${ip}`, 20);
  if (limited) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  let query = supabaseServer
    .from("events")
    .select(
      "id, title, slug, starts_at, ends_at, venue_name, city, state, cover_image_url, category, is_featured, organizers ( name )",
      { count: "exact" }
    )
    .eq("status", "published")
    .gte("ends_at", new Date().toISOString())
    .order("is_featured", { ascending: false })
    .order("starts_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq("category", category);
  }

  const { data: events, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: events ?? [], total: count ?? 0 });
}
