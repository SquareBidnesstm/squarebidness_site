import { notFound } from "next/navigation";
import { supabaseServer } from "../../../../lib/supabase/server";
import BookingForm from "./BookingForm";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ shopSlug: string; barberId: string }>;
}) {
  const { shopSlug, barberId } = await params;

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, city, state")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) notFound();

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("slug, name, display_name, role")
    .eq("shop_id", shop.id)
    .eq("slug", barberId)
    .eq("active", true)
    .single();

  if (!barber) notFound();

  const { data: services } = await supabaseServer
    .from("services")
    .select("id, slug, name, duration_minutes, price")
    .eq("shop_id", shop.id)
    .eq("active", true)
    .order("sort_order");

  return (
    <BookingForm
      shopSlug={shopSlug}
      shopName={shop.name}
      barberSlug={barberId}
      barberName={barber.display_name || barber.name}
      services={(services ?? []).map((s) => ({
        id: s.slug,
        name: s.name,
        price: Number(s.price),
        duration_minutes: s.duration_minutes,
      }))}
    />
  );
}
