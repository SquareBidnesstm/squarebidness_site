import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const viewport: Viewport = {
  themeColor: "#d8b35a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://network.squarebidness.com"),
  title: {
    default: "SB Network | Square Bidness",
    template: "%s | SB Network",
  },
  description:
    "Louisiana-rooted content platform from Square Bidness Holdings. Covering community, business, culture, and health across the region.",
  icons: {
    icon: [
      { url: "/gold-network-16.png", sizes: "16x16", type: "image/png" },
      { url: "/gold-network-32.png", sizes: "32x32", type: "image/png" },
      { url: "/gold-network-48.png", sizes: "48x48", type: "image/png" },
      { url: "/gold-network-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/gold-network-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    siteName: "SB Network",
    type: "website",
    url: "https://network.squarebidness.com",
    images: [{ url: "/gold-network-512.png" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/gold-network-512.png"],
  },
  alternates: {
    canonical: "https://network.squarebidness.com",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
