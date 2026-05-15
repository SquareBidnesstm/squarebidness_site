"use client";

import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ConfirmedContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const code = searchParams.get("code") ?? "—";
  const shopSlug = params.shopSlug as string;
  const barberSlug = params.barberId as string;

  const startsAt = searchParams.get("starts");
  const endsAt = searchParams.get("ends");
  const serviceName = searchParams.get("service");
  const barberName = searchParams.get("barber");

  const calendarUrl = (() => {
    if (!startsAt || !endsAt) return null;
    const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const title = encodeURIComponent(`${serviceName ?? "Appointment"}${barberName ? ` with ${barberName}` : ""}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(startsAt)}/${fmt(endsAt)}&details=${encodeURIComponent(`Booking code: ${code}`)}`;
  })();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 440, width: "100%" }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✂️</div>
        <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
          You&apos;re Confirmed!
        </h2>
        <p style={{ color: "#888", marginBottom: 24 }}>
          Check your phone — a confirmation text is on its way.
        </p>
        <div
          style={{
            background: "#0d0d0d",
            border: "1px solid #1f1f1f",
            borderRadius: 12,
            padding: "20px 28px",
            marginBottom: 28,
          }}
        >
          <div style={{ color: "#555", fontSize: 12, marginBottom: 4 }}>
            Booking Code
          </div>
          <div
            style={{
              color: "#d4af37",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "0.1em",
            }}
          >
            {code}
          </div>
        </div>

        {calendarUrl && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              padding: "12px 20px",
              borderRadius: 10,
              border: "1px solid #2a2a2a",
              background: "#0d0d0d",
              color: "#aaa",
              fontSize: 14,
              textDecoration: "none",
              marginBottom: 16,
            }}
          >
            📅 Add to Google Calendar
          </a>
        )}

        <div
          style={{
            background:
              "linear-gradient(180deg,rgba(212,175,55,.1),rgba(255,255,255,.03))",
            border: "1px solid rgba(212,175,55,.25)",
            borderRadius: 16,
            padding: "18px 20px",
            marginBottom: 20,
            textAlign: "left",
          }}
        >
          <strong
            style={{
              display: "block",
              fontSize: "1rem",
              marginBottom: 6,
              color: "#fff",
            }}
          >
            📲 Add SB Booking to your home screen
          </strong>
          <p
            style={{
              margin: "0 0 14px",
              color: "#a1a1aa",
              fontSize: "0.85rem",
              lineHeight: 1.5,
            }}
          >
            Next time, tap the icon on your phone and book in seconds.
          </p>
          <a
            href="/add-homescreen"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 20px",
              borderRadius: 10,
              background: "#d4af37",
              color: "#000",
              fontWeight: 900,
              fontSize: "0.9rem",
              textDecoration: "none",
            }}
          >
            Add Web App →
          </a>
        </div>

        <Link
          href={`/${shopSlug}/book/${barberSlug}`}
          style={{
            display: "inline-block",
            padding: "12px 24px",
            borderRadius: 10,
            border: "1px solid #2a2a2a",
            background: "transparent",
            color: "#888",
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Book Again
        </Link>
      </div>
    </main>
  );
}

export default function ConfirmedPage() {
  return (
    <Suspense>
      <ConfirmedContent />
    </Suspense>
  );
}
