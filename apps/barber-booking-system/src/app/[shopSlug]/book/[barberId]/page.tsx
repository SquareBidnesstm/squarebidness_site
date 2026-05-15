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
    .select("id, name, city, state, logo_url")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) notFound();

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, slug, name, display_name, role, photo_url")
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

  // Load barber-specific price overrides and bio in parallel
  const [{ data: overrideSetting }, { data: bioSetting }] = await Promise.all([
    supabaseServer
      .from("shop_settings")
      .select("value_json")
      .eq("shop_id", shop.id)
      .eq("key", `barber_price_overrides_${barber.id}`)
      .single(),
    supabaseServer
      .from("shop_settings")
      .select("value_json")
      .eq("shop_id", shop.id)
      .eq("key", `barber_bio_${barber.id}`)
      .single(),
  ]);

  const priceOverrides = (overrideSetting?.value_json as Record<string, number> | null) ?? {};
  const barberBio = (bioSetting?.value_json as { bio?: string } | null)?.bio ?? null;

  return (
    <BookingForm
      shopSlug={shopSlug}
      shopName={shop.name}
      shopLogoUrl={(shop as any).logo_url ?? null}
      barberSlug={barberId}
      barberName={barber.display_name || barber.name}
      barberPhotoUrl={(barber as any).photo_url ?? null}
      barberBio={barberBio}
      services={(services ?? []).map((s) => ({
        id: s.slug,
        name: s.name,
        price: priceOverrides[s.id] !== undefined ? Number(priceOverrides[s.id]) : Number(s.price),
        duration_minutes: s.duration_minutes,
      }))}
    />
  );
}
