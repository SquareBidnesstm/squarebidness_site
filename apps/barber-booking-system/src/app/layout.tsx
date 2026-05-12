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
    images: [{ url: "/og-platform.png", width: 1200, height: 630 }],
  },
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
