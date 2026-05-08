import { ImageResponse } from "next/og";
import { supabaseServer } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const alt = "Barber schedule";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ shopSlug: string; barberSlug: string }>;
}) {
  const { shopSlug, barberSlug } = await params;

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, city, state")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  const { data: barber } = shop
    ? await supabaseServer
        .from("barbers")
        .select("name, display_name, role")
        .eq("shop_id", shop.id)
        .eq("slug", barberSlug)
        .eq("active", true)
        .single()
    : { data: null };

  const barberName = barber?.display_name || barber?.name || barberSlug;
  const role = barber?.role || "Barber";
  const shopName = shop?.name ?? "SquareBidness";
  const location = shop ? `${shop.city}, ${shop.state}` : "";

  // Initials for the avatar circle
  const initials = barberName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#050505",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gold top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "5px",
            background: "linear-gradient(90deg, #d4af37, #f5d87a, #d4af37)",
          }}
        />

        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            right: "-200px",
            width: "600px",
            height: "600px",
            background:
              "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Top row: brand + shop name */}
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              style={{
                color: "#d4af37",
                fontSize: "14px",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              SquareBidness
            </span>
            <span style={{ color: "#444", fontSize: "12px", letterSpacing: "0.15em" }}>
              BARBER SCHEDULE
            </span>
          </div>
          <div
            style={{
              background: "#111",
              border: "1px solid #2a2a2a",
              borderRadius: "999px",
              padding: "8px 20px",
              color: "#888",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            {shopName}
          </div>
        </div>

        {/* Main content: avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: "48px" }}>
          {/* Avatar circle */}
          <div
            style={{
              width: "160px",
              height: "160px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1a1400, #2e2400)",
              border: "3px solid #d4af37",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                color: "#d4af37",
                fontSize: "64px",
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              {initials}
            </span>
          </div>

          {/* Name + role + location */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {location ? (
              <div
                style={{
                  color: "#555",
                  fontSize: "18px",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {location}
              </div>
            ) : null}
            <div
              style={{
                color: "#ffffff",
                fontSize: barberName.length > 14 ? "72px" : "88px",
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {barberName}
            </div>
            <div
              style={{
                color: "#d4af37",
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {role}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#d4af37",
              }}
            />
            <span style={{ color: "#444", fontSize: "16px", letterSpacing: "0.05em" }}>
              booking.squarebidness.com/{shopSlug}/{barberSlug}
            </span>
          </div>
          <div
            style={{
              background: "#d4af37",
              borderRadius: "12px",
              padding: "14px 32px",
              color: "#000",
              fontSize: "16px",
              fontWeight: 900,
              letterSpacing: "0.05em",
            }}
          >
            MY SCHEDULE
          </div>
        </div>

        {/* Bottom gold bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "linear-gradient(90deg, transparent, #d4af37, transparent)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
