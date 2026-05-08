import { MetadataRoute } from "next";
import { supabaseServer } from "../lib/supabase/server";

const BASE_URL = "https://booking.squarebidness.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all active shops
  const { data: shops } = await supabaseServer
    .from("shops")
    .select("slug, updated_at")
    .eq("active", true);

  const shopUrls: MetadataRoute.Sitemap = (shops ?? []).map((shop) => ({
    url: `${BASE_URL}/${shop.slug}`,
    lastModified: shop.updated_at ? new Date(shop.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...shopUrls,
  ];
}
