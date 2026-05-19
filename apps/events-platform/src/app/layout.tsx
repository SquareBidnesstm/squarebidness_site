import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://events.squarebidness.com"),
  title: {
    default: "Louisiana Events — Concerts, Comedy, Trail Rides & More | SB Events",
    template: "%s | SB Events",
  },
  description: "Find and buy tickets to the best events in Louisiana — concerts, comedy shows, trail rides, pop-ups, and community events. Powered by Square Bidness.",
  keywords: [
    "Louisiana events",
    "events in Louisiana",
    "Louisiana concerts",
    "Louisiana comedy shows",
    "trail rides Louisiana",
    "New Orleans events",
    "Baton Rouge events",
    "Louisiana community events",
    "buy event tickets Louisiana",
    "Louisiana event tickets",
    "Louisiana pop-up events",
    "things to do in Louisiana",
  ],
  applicationName: "SB Events",
  appleWebApp: {
    capable: true,
    title: "SB Events",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/events-16.png",  sizes: "16x16",   type: "image/png" },
      { url: "/events-32.png",  sizes: "32x32",   type: "image/png" },
      { url: "/events-48.png",  sizes: "48x48",   type: "image/png" },
      { url: "/events-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg",       type: "image/svg+xml" },
    ],
    apple: [{ url: "/events-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/events-32.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    siteName: "Square Bidness Events",
    title: "Louisiana Events — Concerts, Comedy, Trail Rides & More",
    description: "Find and buy tickets to the best events in Louisiana — concerts, comedy shows, trail rides, pop-ups, and community events.",
    type: "website",
    url: "https://events.squarebidness.com",
    images: [{ url: "/events-meta-1200x630.png", width: 1200, height: 630, alt: "Square Bidness Events — Louisiana" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Louisiana Events — Concerts, Comedy, Trail Rides & More",
    description: "Find and buy tickets to the best events in Louisiana.",
    images: ["/events-meta-1200x630.png"],
  },
  alternates: { canonical: "https://events.squarebidness.com" },
  other: {
    "fb:app_id": "802680062853443",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
