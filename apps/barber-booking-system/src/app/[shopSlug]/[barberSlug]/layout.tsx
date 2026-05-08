import type { Metadata } from "next";
import { supabaseServer } from "../../../lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string; barberSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug, barberSlug } = await params;

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, city, state")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  if (!shop) return { title: "Barber Schedule" };

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("name, display_name")
    .eq("shop_id", shop.id)
    .eq("slug", barberSlug)
    .eq("active", true)
    .single();

  const barberName = barber?.display_name || barber?.name || barberSlug;
  const url = `https://booking.squarebidness.com/${shopSlug}/${barberSlug}`;

  return {
    title: `${barberName} — ${shop.name}`,
    description: `${barberName}'s personal schedule at ${shop.name} in ${shop.city}, ${shop.state}.`,
    openGraph: {
      title: `${barberName} · ${shop.name}`,
      description: `${barberName}'s appointments at ${shop.name} — ${shop.city}, ${shop.state}`,
      url,
      siteName: "SquareBidness",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${barberName} · ${shop.name}`,
      description: `${barberName}'s appointments at ${shop.name} — ${shop.city}, ${shop.state}`,
    },
  };
}

export default function BarberLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
