import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Barber Booking System",
  description: "Duplicatable booking system for barbershops."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
