import Link from "next/link";

const barbers = [
  { id: "josh", name: "Josh Watkins", role: "Head Barber" },
  { id: "jj", name: "Jeramiah (J.J.)", role: "Barber" },
  { id: "jmike", name: "J-Mike", role: "Barber" },
];

export default function BookingPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              color: "#d4af37",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            Dapper Lounge
          </div>
          <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900 }}>
            Book an Appointment
          </h1>
          <p style={{ color: "#a3a3a3", fontSize: 18, lineHeight: 1.6 }}>
            Choose a barber and enter that barber’s booking lane.
          </p>
        </div>

        <div
          style={{
            border: "1px solid #232323",
            background: "#111",
            borderRadius: 28,
            padding: 24,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 28 }}>Barbers</h2>

          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {barbers.map((barber) => (
              <Link
                key={barber.id}
                href={`/book/${barber.id}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "#fff",
                  border: "1px solid #232323",
                  borderRadius: 20,
                  padding: "18px 18px",
                  background: "#0d0d0d",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 20 }}>{barber.name}</div>
                <div style={{ color: "#999", marginTop: 6 }}>{barber.role}</div>
                <div style={{ color: "#d4af37", marginTop: 8, fontSize: 14 }}>
                  Open booking lane →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
