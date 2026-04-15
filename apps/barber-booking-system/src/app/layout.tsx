export const metadata = {
  title: "Dapper Lounge Booking System",
  description: "Multi-barber shared-account booking system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, Helvetica, sans-serif",
          background: "#0a0a0a",
          color: "#ffffff",
        }}
      >
        {children}
      </body>
    </html>
  );
}
