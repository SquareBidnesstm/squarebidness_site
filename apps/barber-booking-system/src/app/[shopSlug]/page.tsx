import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "../../lib/supabase/server";

const SHOP_TYPE_LABELS: Record<string, string> = {
  barbershop: "Barbershop",
  beauty_salon: "Beauty Salon",
  nail_salon: "Nail Salon",
  spa: "Spa",
  lash_studio: "Lash Studio",
  other: "Appointment Booking",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug } = await params;

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, city, state")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) return { title: "Book an Appointment" };

  const { data: typeSetting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shop.id)
    .eq("key", "shop_type")
    .single();

  const shopType = (typeSetting?.value_json as { type?: string } | null)?.type ?? "barbershop";
  const typeLabel = SHOP_TYPE_LABELS[shopType] ?? "Appointment Booking";
  const url = `https://booking.squarebidness.com/${shopSlug}`;

  return {
    title: `${shop.name} — Book an Appointment`,
    description: `Book your appointment at ${shop.name} in ${shop.city}, ${shop.state}. ${typeLabel} powered by SquareBidness.`,
    openGraph: {
      title: shop.name,
      description: `Book your appointment at ${shop.name} — ${shop.city}, ${shop.state}`,
      url,
      siteName: "SquareBidness",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: shop.name,
      description: `Book your appointment at ${shop.name} — ${shop.city}, ${shop.state}`,
    },
  };
}

export default async function ShopLanding({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, city, state")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  const { data: shopTypeSetting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shop?.id ?? "")
    .eq("key", "shop_type")
    .single();

  const shopType = (shopTypeSetting?.value_json as { type?: string } | null)?.type ?? "barbershop";

  const specialistLabel: Record<string, string> = {
    barbershop: "barber",
    beauty_salon: "stylist",
    nail_salon: "nail tech",
    spa: "specialist",
    lash_studio: "lash artist",
    other: "specialist",
  };

  const label = specialistLabel[shopType] ?? "specialist";

  if (!shop) notFound();

  const { data: barbers } = await supabaseServer
    .from("barbers")
    .select("slug, name, display_name, role")
    .eq("shop_id", shop.id)
    .eq("active", true)
    .order("sort_order");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "56px 24px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 48, maxWidth: 560 }}>
        <div
          style={{
            color: "#d4af37",
            fontSize: 12,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          {shop.city}, {shop.state}
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 900, margin: "0 0 12px" }}>
          {shop.name}
        </h1>
        <p style={{ color: "#666", fontSize: 16, margin: 0 }}>
          Select your {label} to book an appointment.
        </p>
      </div>

      <div style={{ display: "grid", gap: 16, width: "100%", maxWidth: 480 }}>
        {(barbers ?? []).map((b) => (
          <Link
            key={b.slug}
            href={`/${shopSlug}/book/${b.slug}`}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                background: "#0d0d0d",
                border: "1px solid #1f1f1f",
                borderRadius: 14,
                padding: "22px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                  {b.display_name || b.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#d4af37",
                    marginTop: 3,
                    letterSpacing: "0.05em",
                  }}
                >
                  {b.role}
                </div>
              </div>
              <div style={{ color: "#444", fontSize: 20 }}>→</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
