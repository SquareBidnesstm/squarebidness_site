import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#e8711a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://taxpass.squarebidness.com"),
  title: {
    default: "Tax Pass™ — Digital Intake for Tax Offices",
    template: "%s | Tax Pass™",
  },
  description:
    "Tax Pass gives independent tax offices a digital intake link. Clients send W-2s, IDs, and documents from their phone. You get everything organized and ready to file.",
  openGraph: {
    siteName: "Tax Pass™",
    type: "website",
    url: "https://taxpass.squarebidness.com",
    images: [{ url: "/og-taxpass.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-taxpass.png"],
  },
  alternates: {
    canonical: "https://taxpass.squarebidness.com",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
