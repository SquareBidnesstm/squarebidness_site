import { MetadataRoute } from "next";
import { supabaseServer } from "../lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://events.squarebidness.com";

  const { data: events } = await supabaseServer
    .from("events")
    .select("slug, starts_at, updated_at")
    .eq("status", "published")
    .eq("is_public", true)
    .order("starts_at", { ascending: false });

  const eventUrls: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
    url: `${base}/events/${e.slug}`,
    lastModified: e.updated_at ?? e.starts_at,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    { url: base, lastModified: new Date(), changeFrequency: "hourly", priority: 1 },
    { url: `${base}/organizer/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/organizer/signup`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    ...eventUrls,
  ];
}
