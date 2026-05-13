import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#d4af37",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://booking.squarebidness.com"),
  applicationName: "SquareBidness Booking",
  manifest: "/manifest.json",
  title: {
    default: "Online Booking App for Barbers, Nail Techs & Hair Stylists | SquareBidness",
    template: "%s | SquareBidness Booking",
  },
  description: "Free online booking app for barbers, nail technicians, hair stylists, lash artists, and beauty salons. Let clients book appointments 24/7. Get your shop online in minutes.",
  keywords: [
    "booking app for barbers",
    "barber booking software",
    "nail tech booking app",
    "hair stylist appointment booking",
    "beauty salon booking system",
    "online booking for barbershops",
    "appointment scheduling for nail technicians",
    "lash artist booking app",
    "spa booking software",
    "free barber booking app",
    "hairstylist scheduling app",
    "beauty professional booking",
    "online appointment booking",
    "barbershop scheduling software",
  ],
  appleWebApp: {
    capable: true,
    title: "Booking",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/booking-16.png", sizes: "16x16", type: "image/png" },
      { url: "/booking-32.png", sizes: "32x32", type: "image/png" },
      { url: "/booking-48.png", sizes: "48x48", type: "image/png" },
      { url: "/booking-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/booking-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    siteName: "SquareBidness Booking",
    title: "Online Booking App for Barbers, Nail Techs & Hair Stylists",
    description: "Free online booking app for barbers, nail technicians, hair stylists, lash artists, and beauty salons. Let clients book 24/7.",
    type: "website",
    url: "https://booking.squarebidness.com",
    images: [{ url: "/booking-meta-1200x630.png", width: 1200, height: 630, alt: "SquareBidness — Online Booking for Barbers and Beauty Professionals" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Online Booking App for Barbers, Nail Techs & Hair Stylists",
    description: "Free online booking app for barbers, nail technicians, hair stylists, lash artists, and beauty salons.",
    images: ["/booking-meta-1200x630.png"],
  },
  alternates: {
    canonical: "https://booking.squarebidness.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-title" content="Booking" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
