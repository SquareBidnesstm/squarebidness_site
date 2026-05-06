import { ImageResponse } from "next/og";
import { supabaseServer } from "../../lib/supabase/server";

export const runtime = "nodejs";
export const alt = "Book your appointment";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SHOP_TYPE_LABELS: Record<string, string> = {
  barbershop: "Barbershop",
  beauty_salon: "Beauty Salon",
  nail_salon: "Nail Salon",
  spa: "Spa",
  lash_studio: "Lash Studio",
  other: "Appointment Booking",
};

export default async function Image({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, city, state, owner_name")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();

  const { data: typeSetting } = shop
    ? await supabaseServer
        .from("shop_settings")
        .select("value_json")
        .eq("shop_id", shop.id)
        .eq("key", "shop_type")
        .single()
    : { data: null };

  const shopType = (typeSetting?.value_json as { type?: string } | null)?.type ?? "barbershop";
  const typeLabel = SHOP_TYPE_LABELS[shopType] ?? "Appointment Booking";

  const shopName = shop?.name ?? "Book Your Appointment";
  const location = shop ? `${shop.city}, ${shop.state}` : "squarebidness.com";

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
            background: "radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Top row: brand + type badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
              PREMIUM APPOINTMENT BOOKING
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
            {typeLabel}
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
          <div
            style={{
              color: "#ffffff",
              fontSize: shopName.length > 20 ? "72px" : "88px",
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {shopName}
          </div>
          <div
            style={{
              color: "#d4af37",
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            Book your appointment →
          </div>
        </div>

        {/* Bottom row: URL + CTA pill */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
              booking.squarebidness.com/{shopSlug}
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
            BOOK NOW
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
