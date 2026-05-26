import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/organizer/dashboard", "/admin", "/scan"] },
    sitemap: "https://events.squarebidness.com/sitemap.xml",
  };
}
