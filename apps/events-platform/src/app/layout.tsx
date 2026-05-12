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
    icon: "/icon.svg",
    apple: "/sb-mark.png",
    shortcut: "/icon.svg",
  },
  openGraph: {
    siteName: "Square Bidness Events",
    type: "website",
    images: [{ url: "/icon.svg", width: 512, height: 600 }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
