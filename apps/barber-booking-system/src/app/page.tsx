import Link from "next/link";

const barbers = [
  {
    slug: "josh",
    name: "Josh Watkins",
    role: "Head Barber",
  },
  {
    slug: "jj",
    name: "Jeramiah (J.J.)",
    role: "Barber",
  },
  {
    slug: "jmike",
    name: "J-Mike",
    role: "Barber",
  },
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "56px 24px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 48, maxWidth: 560 }}>
        <div
          style={{
            color: "#d4af37",
            fontSize: 12,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Hammond, LA
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 900, margin: "0 0 12px" }}>
          Dapper Lounge
        </h1>
        <p style={{ color: "#666", fontSize: 16, margin: 0 }}>
          Select your barber to book an appointment.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          width: "100%",
          maxWidth: 480,
        }}
      >
        {barbers.map((b) => (
          <Link
            key={b.slug}
            href={`/book/${b.slug}`}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                background: "#0d0d0d",
                border: "1px solid #1f1f1f",
                borderRadius: 14,
                padding: "22px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 18, fontWeight: 700, color: "#ffffff" }}
                >
                  {b.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#d4af37",
                    marginTop: 3,
                    letterSpacing: "0.05em",
                  }}
                >
                  {b.role}
                </div>
              </div>
              <div style={{ color: "#444", fontSize: 20 }}>→</div>
            </div>
          </Link>
        ))}
      </div>

      <p
        style={{
          color: "#333",
          fontSize: 12,
          marginTop: 48,
          textAlign: "center",
        }}
      >
        Mon – Fri 9am–6pm &nbsp;·&nbsp; Sat 8am–4pm &nbsp;·&nbsp; Sun Closed
      </p>
    </main>
  );
}
