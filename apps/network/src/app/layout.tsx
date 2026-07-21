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
  openGraph: {
    siteName: "SB Network",
    type: "website",
    url: "https://network.squarebidness.com",
  },
  twitter: {
    card: "summary_large_image",
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
