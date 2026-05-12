import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Square Bidness Events",
  description: "Comedy shows, trail rides, concerts, and community events across Louisiana.",
  metadataBase: new URL("https://events.squarebidness.com"),
  openGraph: {
    siteName: "Square Bidness Events",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
