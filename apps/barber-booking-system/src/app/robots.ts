import { MetadataRoute } from "next";

const BASE_URL = "https://booking.squarebidness.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/platform/",
          "*/admin/",
          "*/admin",
          "*/login",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
