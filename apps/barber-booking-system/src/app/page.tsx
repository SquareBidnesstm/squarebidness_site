import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Online Booking App for Barbers, Nail Techs & Hair Stylists | SquareBidness",
  description:
    "The free online booking app built for barbers, nail technicians, hair stylists, lash artists, and beauty salons. Clients book 24/7. No-show protection. Get your shop online in minutes.",
  alternates: { canonical: "https://booking.squarebidness.com" },
};

const SERVICES = [
  { emoji: "✂️", title: "Barbershops", desc: "Let walk-ins book online. Manage multiple barbers, chairs, and schedules from one dashboard." },
  { emoji: "💇🏿", title: "Hair Stylists", desc: "Take appointments around the clock. Show your portfolio, services, and pricing in one link." },
  { emoji: "💅🏽", title: "Nail Technicians", desc: "Fill your nail table every day. Clients pick their tech, service, and time — you just show up." },
  { emoji: "👁️", title: "Lash Artists", desc: "Book fills, new sets, and removals online. Automated reminders keep clients coming back." },
  { emoji: "🧖", title: "Beauty Salons", desc: "One booking page for your whole salon. Multiple staff, services, and locations supported." },
  { emoji: "🌿", title: "Spas & Wellness", desc: "Streamline massage, facial, and wellness bookings with a professional online presence." },
];

const FEATURES = [
  { icon: "📅", title: "24/7 Online Booking", desc: "Clients book while you sleep. No more missed calls or back-and-forth texts." },
  { icon: "🔔", title: "Automatic Reminders", desc: "SMS and email reminders cut no-shows so your chair stays filled." },
  { icon: "💳", title: "Secure Payments", desc: "Collect deposits or full payment at booking. Apple Pay and Google Pay ready." },
  { icon: "📱", title: "Mobile-First Design", desc: "Works perfectly on every phone. Clients can even add it to their home screen." },
  { icon: "⚡", title: "Setup in Minutes", desc: "Add your services, set your hours, share your link. Live in under 10 minutes." },
  { icon: "📊", title: "Client Management", desc: "Track appointment history, client notes, and rebooking reminders automatically." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "SquareBidness Booking",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      url: "https://booking.squarebidness.com",
      description:
        "Free online booking app for barbers, nail technicians, hair stylists, lash artists, and beauty salons. Let clients book appointments 24/7.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Online appointment booking for barbershops",
        "Booking app for nail technicians",
        "Hair stylist scheduling software",
        "Lash artist appointment management",
        "Beauty salon booking system",
        "Automated SMS and email reminders",
        "Secure online payments",
        "Client management dashboard",
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "120",
      },
    },
    {
      "@type": "WebSite",
      url: "https://booking.squarebidness.com",
      name: "SquareBidness Booking",
      description: "Online booking app for barbers, nail techs, hair stylists, and beauty professionals.",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://booking.squarebidness.com/{search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      name: "SquareBidness",
      url: "https://squarebidness.com",
      logo: "https://booking.squarebidness.com/booking-192.png",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "support@squarebidness.com",
      },
    },
  ],
};

export default function PlatformLanding() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main style={{ minHeight: "100vh", background: "#050505", color: "#fff" }}>

        {/* NAV */}
        <nav style={{ borderBottom: "1px solid #111", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, background: "#050505", zIndex: 50 }}>
          <img src="/booking-192.png" alt="SquareBidness Booking" style={{ height: 36, width: 36, borderRadius: 8 }} />
          <Link href="/onboard" style={{ display: "inline-block", padding: "8px 18px", background: "#d4af37", color: "#000", fontWeight: 800, borderRadius: 8, fontSize: "0.85rem", textDecoration: "none" }}>
            Get Started Free
          </Link>
        </nav>

        {/* HERO */}
        <header style={{ padding: "clamp(60px, 10vw, 100px) 24px clamp(50px, 8vw, 80px)", textAlign: "center", background: "radial-gradient(circle at 50% 0%, rgba(212,175,55,.07), transparent 60%), #050505" }}>
          <p style={{ color: "#d4af37", fontSize: 11, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 20 }}>
            First Month Free
          </p>
          <h1 style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)", fontWeight: 950, letterSpacing: "-0.05em", lineHeight: 1.05, marginBottom: 20, maxWidth: 760, margin: "0 auto 20px" }}>
            The Online Booking App for Barbers, Nail Techs & Hair Stylists
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "clamp(1rem, 2vw, 1.2rem)", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.6 }}>
            Let your clients book appointments 24/7. Built specifically for barbershops, nail technicians, hair stylists, lash artists, and beauty salons across the country.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/onboard" style={{ display: "inline-block", padding: "16px 32px", background: "#d4af37", color: "#000", fontWeight: 900, borderRadius: 12, fontSize: "1rem", textDecoration: "none" }}>
              Get Your Shop Online Free →
            </Link>
            <a href="#how-it-works" style={{ display: "inline-block", padding: "16px 32px", background: "transparent", color: "#fff", fontWeight: 800, borderRadius: 12, fontSize: "1rem", textDecoration: "none", border: "1px solid #222" }}>
              See How It Works
            </a>
          </div>
          <p style={{ color: "#444", fontSize: "0.8rem", marginTop: 20 }}>
            Join barbers, nail techs, and stylists already booking with SquareBidness
          </p>
        </header>

        {/* WHO IT'S FOR */}
        <section style={{ padding: "80px 24px", borderTop: "1px solid #0f0f0f" }} aria-labelledby="services-heading">
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <p style={{ color: "#d4af37", fontSize: 11, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Built For Every Beauty Professional</p>
            <h2 id="services-heading" style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 950, letterSpacing: "-0.04em", textAlign: "center", marginBottom: 48 }}>
              One booking platform. Every beauty profession.
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {SERVICES.map((s) => (
                <article key={s.title} style={{ background: "#080808", border: "1px solid #161616", borderRadius: 16, padding: "24px 20px" }}>
                  <p style={{ fontSize: "1.8rem", marginBottom: 12 }}>{s.emoji}</p>
                  <h3 style={{ fontWeight: 900, fontSize: "1.05rem", marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ color: "#71717a", fontSize: "0.88rem", lineHeight: 1.6 }}>{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section style={{ padding: "80px 24px", background: "#030303", borderTop: "1px solid #0f0f0f" }} aria-labelledby="features-heading">
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <p style={{ color: "#d4af37", fontSize: 11, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Everything You Need</p>
            <h2 id="features-heading" style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 950, letterSpacing: "-0.04em", textAlign: "center", marginBottom: 48 }}>
              Stop losing clients to missed calls
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {FEATURES.map((f) => (
                <div key={f.title} style={{ display: "flex", gap: 16, padding: "20px", background: "#080808", borderRadius: 14, border: "1px solid #161616" }}>
                  <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>{f.icon}</span>
                  <div>
                    <h3 style={{ fontWeight: 900, fontSize: "0.95rem", marginBottom: 4 }}>{f.title}</h3>
                    <p style={{ color: "#71717a", fontSize: "0.85rem", lineHeight: 1.6 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" style={{ padding: "80px 24px", borderTop: "1px solid #0f0f0f" }} aria-labelledby="how-heading">
          <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
            <p style={{ color: "#d4af37", fontSize: 11, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>Simple Setup</p>
            <h2 id="how-heading" style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 48 }}>
              Live in under 10 minutes
            </h2>
            <div style={{ display: "grid", gap: 16, textAlign: "left" }}>
              {[
                { step: "1", title: "Create your free account", desc: "Sign up with your shop name and email. No credit card needed." },
                { step: "2", title: "Add your services & hours", desc: "List your cuts, colors, nail sets, lash services — whatever you offer. Set your availability." },
                { step: "3", title: "Share your booking link", desc: "Put it in your Instagram bio, send it in a text, or add it to your Google Business profile." },
                { step: "4", title: "Get booked around the clock", desc: "Clients pick their time online. You get notified. No more phone tag." },
              ].map((item) => (
                <div key={item.step} style={{ display: "flex", gap: 16, padding: "20px 24px", background: "#080808", borderRadius: 14, border: "1px solid #161616", alignItems: "flex-start" }}>
                  <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#d4af37", color: "#000", fontWeight: 900, fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {item.step}
                  </span>
                  <div>
                    <h3 style={{ fontWeight: 900, fontSize: "0.95rem", marginBottom: 4 }}>{item.title}</h3>
                    <p style={{ color: "#71717a", fontSize: "0.85rem", lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEO TEXT SECTION */}
        <section style={{ padding: "60px 24px", background: "#030303", borderTop: "1px solid #0f0f0f" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <h2 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 20 }}>
              The booking app beauty professionals actually use
            </h2>
            <p style={{ color: "#71717a", lineHeight: 1.8, marginBottom: 16, fontSize: "0.95rem" }}>
              SquareBidness Booking is a free online scheduling platform built for independent beauty professionals and small shops. Whether you're a barber running a one-chair shop, a nail technician with a home studio, or a hair stylist building your clientele — you need a booking system that works as hard as you do.
            </p>
            <p style={{ color: "#71717a", lineHeight: 1.8, marginBottom: 16, fontSize: "0.95rem" }}>
              Unlike generic booking tools, SquareBidness is built specifically for the beauty and grooming industry. Barbershops can manage multiple barbers and walk-in queues. Nail salons can offer online booking by technician or service type. Lash artists can take deposits to protect their time. Hair stylists can display their full menu with pricing.
            </p>
            <p style={{ color: "#71717a", lineHeight: 1.8, fontSize: "0.95rem" }}>
              Available nationwide. Works on every device. Free to get started.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: "80px 24px", textAlign: "center", borderTop: "1px solid #0f0f0f" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h2 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 16 }}>
              Ready to fill your schedule?
            </h2>
            <p style={{ color: "#a1a1aa", marginBottom: 32, fontSize: "1rem", lineHeight: 1.6 }}>
              Get your free booking page live in minutes. No contracts, no setup fees — just more clients.
            </p>
            <Link href="/onboard" style={{ display: "inline-block", padding: "18px 40px", background: "#d4af37", color: "#000", fontWeight: 900, borderRadius: 14, fontSize: "1.1rem", textDecoration: "none" }}>
              Get Your Shop Online Free →
            </Link>
            <p style={{ color: "#333", fontSize: "0.8rem", marginTop: 16 }}>
              Already set up? Visit <span style={{ color: "#555" }}>booking.squarebidness.com/your-shop-name</span>
            </p>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop: "1px solid #0f0f0f", padding: "24px", textAlign: "center", color: "#333", fontSize: "0.8rem" }}>
          <p>© {new Date().getFullYear()} Square Bidness · Online Booking for Barbers, Nail Techs & Beauty Professionals</p>
        </footer>

      </main>
    </>
  );
}
