import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";

  let query = supabaseServer
    .from("bookings")
    .select("customer_name, customer_phone, customer_email, starts_at, status, services(name)")
    .eq("shop_id", shop.id)
    .not("customer_phone", "is", null);

  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
  }

  const { data: rows, error } = await query.order("starts_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Group by phone number
  const byPhone = new Map<string, {
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    visits: number;
    no_shows: number;
    last_visit: string;
    services: string[];
  }>();

  for (const row of rows ?? []) {
    const phone = row.customer_phone as string;
    const svcName = (row.services as any)?.name ?? null;
    const isNoShow = row.status === "no_show";
    const existing = byPhone.get(phone);
    if (existing) {
      existing.visits += 1;
      if (isNoShow) existing.no_shows += 1;
      if (row.starts_at > existing.last_visit) {
        existing.last_visit = row.starts_at;
        existing.customer_name = row.customer_name;
      }
      if (svcName && !existing.services.includes(svcName)) existing.services.push(svcName);
    } else {
      byPhone.set(phone, {
        customer_name: row.customer_name,
        customer_phone: phone,
        customer_email: row.customer_email ?? null,
        visits: 1,
        no_shows: isNoShow ? 1 : 0,
        last_visit: row.starts_at,
        services: svcName ? [svcName] : [],
      });
    }
  }

  const clients = Array.from(byPhone.values()).sort(
    (a, b) => new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime()
  );

  return NextResponse.json({ ok: true, clients });
}
