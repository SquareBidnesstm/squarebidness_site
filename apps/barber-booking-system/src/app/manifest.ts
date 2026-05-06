import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SquareBidness Booking",
    short_name: "SquareBidness",
    description: "Book your appointment at the best shops near you.",
    start_url: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#d4af37",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
