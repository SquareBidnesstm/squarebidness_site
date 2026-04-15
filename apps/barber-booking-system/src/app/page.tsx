import Link from "next/link";

const barbers = [
  { id: "josh", name: "Josh Watkins", role: "Head Barber" },
  { id: "jj", name: "Jeramiah (J.J.)", role: "Barber" },
  { id: "jmike", name: "J-Mike", role: "Barber" },
];

const services = [
  { id: "haircut", name: "Haircut", price: 35, duration: 45 },
  { id: "haircut-beard", name: "Haircut + Beard", price: 45, duration: 60 },
  { id: "kids-cut", name: "Kids Cut", price: 25, duration: 30 },
  { id: "enhancements", name: "Cut + Enhancements", price: 50, duration: 60 },
  { id: "vip", name: "VIP Appointment", price: 75, duration: 90 },
];

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "56px 24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "1.15fr 0.85fr",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "8px 14px",
                border: "1px solid #333",
                borderRadius: 999,
                color: "#d4af37",
                marginBottom: 18,
              }}
            >
              Duplicatable Barber Booking System
            </div>

            <h1
              style={{
                fontSize: 56,
                lineHeight: 1.05,
                margin: "0 0 18px",
                fontWeight: 900,
                maxWidth: 760,
              }}
            >
              Dapper Lounge
            </h1>

            <p
              style={{
                fontSize: 20,
                lineHeight: 1.6,
                color: "#b3b3b3",
                maxWidth: 720,
                margin: "0 0 24px",
              }}
            >
              Shop-owned booking system for a shared-account barber model.
              Josh runs the shop account, and each barber operates inside the
              same system.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href="/book"
                style={{
                  background: "#d4af37",
                  color: "#0a0a0a",
                  padding: "14px 18px",
                  borderRadius: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Open Booking
              </Link>

              <Link
                href="/admin"
                style={{
                  border: "1px solid #333",
                  background: "#111",
                  color: "#fff",
                  padding: "14px 18px",
                  borderRadius: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Open Admin
              </Link>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 16,
                marginTop: 28,
              }}
            >
              <div
                style={{
                  border: "1px solid #232323",
                  background: "#111",
                  borderRadius: 24,
                  padding: 20,
                }}
              >
                <div style={{ color: "#999", fontSize: 14 }}>Owner</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                  Josh Watkins
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #232323",
                  background: "#111",
                  borderRadius: 24,
                  padding: 20,
                }}
              >
                <div style={{ color: "#999", fontSize: 14 }}>Barbers</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                  {barbers.length}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #232323",
                  background: "#111",
                  borderRadius: 24,
                  padding: 20,
                }}
              >
                <div style={{ color: "#999", fontSize: 14 }}>Model</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                  Shared
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #232323",
              background: "#111",
              borderRadius: 28,
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 28 }}>Starter Services</h2>

            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {services.map((service) => (
                <div
                  key={service.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid #232323",
                    borderRadius: 18,
                    padding: "14px 16px",
                    background: "#0d0d0d",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{service.name}</div>
                    <div style={{ fontSize: 14, color: "#999", marginTop: 4 }}>
                      {service.duration} min
                    </div>
                  </div>
                  <div style={{ fontWeight: 800 }}>${service.price}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
