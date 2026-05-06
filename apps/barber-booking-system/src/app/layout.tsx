import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#d4af37",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  applicationName: "SquareBidness Booking",
  appleWebApp: {
    capable: true,
    title: "SquareBidness",
    statusBarStyle: "black-translucent",
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
