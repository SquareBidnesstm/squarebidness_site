import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Square Bidness Events",
  description: "Comedy shows, trail rides, concerts, and community events across Louisiana.",
  metadataBase: new URL("https://events.squarebidness.com"),
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
    type: "website",
    images: [{ url: "/events-meta-1200x630.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Square Bidness Events",
    description: "Comedy shows, trail rides, concerts, and community events across Louisiana.",
    images: ["/events-meta-1200x630.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
