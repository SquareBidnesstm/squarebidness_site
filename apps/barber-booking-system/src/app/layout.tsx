import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#d4af37",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  applicationName: "SquareBidness Booking",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "SB Booking",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/booking-16.png", sizes: "16x16", type: "image/png" },
      { url: "/booking-32.png", sizes: "32x32", type: "image/png" },
      { url: "/booking-48.png", sizes: "48x48", type: "image/png" },
      { url: "/booking-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/booking-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    siteName: "SquareBidness Booking",
    title: "SquareBidness Booking — Professional Booking Made Simple",
    description: "Book barber, beauty, nail, spa, and lash appointments. Your time. Your style. Our priority.",
    type: "website",
    images: [{ url: "/booking-meta-1200x630.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SquareBidness Booking",
    description: "Book barber, beauty, nail, spa, and lash appointments.",
    images: ["/booking-meta-1200x630.png"],
  },
  metadataBase: new URL("https://booking.squarebidness.com"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
