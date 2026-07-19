import { notFound } from "next/navigation";
import { supabaseServer } from "../../../../lib/supabase/server";
import BookingForm from "./BookingForm";

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string; barberId: string }>;
  searchParams: Promise<{ conflict?: string; refunded?: string }>;
}) {
  const { shopSlug, barberId } = await params;
  const { conflict, refunded } = await searchParams;

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, city, state, logo_url, stripe_onboarding_complete, bypass_stripe_requirement")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) notFound();

  const stripeReady =
    (shop as any).stripe_onboarding_complete === true ||
    (shop as any).bypass_stripe_requirement === true;

  if (!stripeReady) {
    return (
      <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Online Booking Unavailable</h2>
          <p style={{ color: "#888", marginBottom: 28, lineHeight: 1.6 }}>
            This barber isn&apos;t set up for online payments yet. Please contact the shop directly to schedule your appointment.
          </p>
          <a
            href={`/${shopSlug}`}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 24px", borderRadius: 10, background: "#1a1a1a", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", border: "1px solid #2a2a2a" }}
          >
            ← Back
          </a>
        </div>
      </main>
    );
  }

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, slug, name, display_name, role, photo_url, special_sessions_enabled, special_sessions_price_cents")
    .eq("shop_id", shop.id)
    .eq("slug", barberId)
    .eq("active", true)
    .single();

  if (!barber) notFound();

  // Only show services this barber is assigned to. Falls back to all shop services
  // if no barber_services rows exist (e.g. legacy shops onboarded before assignments).
  const { data: barberServiceRows } = await supabaseServer
    .from("barber_services")
    .select("service_id")
    .eq("barber_id", barber.id)
    .eq("active", true);

  const assignedIds = barberServiceRows?.map((r) => r.service_id) ?? [];

  const servicesQuery = supabaseServer
    .from("services")
    .select("id, slug, name, duration_minutes, price")
    .eq("shop_id", shop.id)
    .eq("active", true)
    .order("sort_order");

  const { data: services } = assignedIds.length > 0
    ? await servicesQuery.in("id", assignedIds)
    : await servicesQuery;

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

  const initialError = conflict === "1"
    ? refunded === "1"
      ? "That time slot was taken — your deposit has been refunded. Please choose a different time."
      : "That time slot was just taken by someone else. Please choose a different time."
    : null;

  return (
    <BookingForm
      shopSlug={shopSlug}
      shopName={shop.name}
      shopLogoUrl={(shop as any).logo_url ?? null}
      barberSlug={barberId}
      barberName={barber.display_name || barber.name}
      barberPhotoUrl={(barber as any).photo_url ?? null}
      barberBio={barberBio}
      specialSessionsEnabled={!!(barber as any).special_sessions_enabled}
      specialSessionsDefaultPrice={
        (barber as any).special_sessions_price_cents
          ? Math.round((barber as any).special_sessions_price_cents / 100)
          : 150
      }
      initialError={initialError}
      services={(services ?? []).map((s) => ({
        id: s.slug,
        name: s.name,
        price: priceOverrides[s.id] !== undefined ? Number(priceOverrides[s.id]) : Number(s.price),
        duration_minutes: s.duration_minutes,
      }))}
    />
  );
}
