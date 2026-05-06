import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; serviceId: string }> }
) {
  const { shopSlug, serviceId } = await params;

  const authorized = await verifyAdminSession(req, shopSlug);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.price !== undefined) updates.price = Number(body.price);
  if (body.duration_minutes !== undefined) updates.duration_minutes = Number(body.duration_minutes);
  if (body.active !== undefined) updates.active = Boolean(body.active);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("services")
    .update(updates)
    .eq("id", serviceId)
    .select("id, slug, name, duration_minutes, price, deposit_eligible, deposit_amount, active, sort_order")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, service: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; serviceId: string }> }
) {
  const { shopSlug, serviceId } = await params;

  const authorized = await verifyAdminSession(req, shopSlug);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseServer
    .from("services")
    .update({ active: false })
    .eq("id", serviceId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
