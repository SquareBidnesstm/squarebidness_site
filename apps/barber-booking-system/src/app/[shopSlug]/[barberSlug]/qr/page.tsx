import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { supabaseServer } from "../../../../lib/supabase/server";
import ShareButton from "./ShareButton";

export const dynamic = "force-dynamic";

async function getShopAndBarber(shopSlug: string, barberSlug: string) {
  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, city, state")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();
  if (!shop) return { shop: null, barber: null };

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id, display_name, name, role")
    .eq("shop_id", shop.id)
    .eq("slug", barberSlug)
    .eq("active", true)
    .single();

  return { shop, barber };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string; barberSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug, barberSlug } = await params;
  const { shop, barber } = await getShopAndBarber(shopSlug, barberSlug);
  if (!shop || !barber) return { title: "Not Found" };

  const barberName = barber.display_name || barber.name;
  const shortName = barberName.split(" ")[0];
  const imageUrl = `https://booking.squarebidness.com/${shopSlug}/${barberSlug}/qr/image`;

  return {
    title: `${shortName} QR | ${shop.name}`,
    description: `Scan to book your appointment with ${shortName} at ${shop.name}.`,
    appleWebApp: {
      capable: true,
      title: `Book ${shortName}`,
      statusBarStyle: "black",
    },
    icons: {
      apple: [{ url: imageUrl, sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: `${shortName} QR | ${shop.name}`,
      description: `Scan to book your appointment with ${shortName} at ${shop.name}.`,
      images: [{ url: imageUrl, width: 600, height: 600 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${shortName} QR | ${shop.name}`,
      images: [imageUrl],
    },
  };
}

export default async function BarberQRPage({
  params,
}: {
  params: Promise<{ shopSlug: string; barberSlug: string }>;
}) {
  const { shopSlug, barberSlug } = await params;
  const { shop, barber } = await getShopAndBarber(shopSlug, barberSlug);
  if (!shop || !barber) notFound();

  const bookingUrl = `https://booking.squarebidness.com/${shopSlug}/book/${barberSlug}`;
  const scheduleUrl = `https://booking.squarebidness.com/${shopSlug}/${barberSlug}`;
  const svgString = await QRCode.toString(bookingUrl, {
    type: "svg",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  const barberName = barber.display_name || barber.name;
  const shortName = barberName.split(" ")[0];

  return (
    <>
      <style>{`
        body {
          background: #0a0a0a;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .qr-card {
          background: #111;
          border: 1px solid #222;
          border-radius: 20px;
          padding: 36px 32px 32px;
          max-width: 380px;
          width: 90%;
          text-align: center;
        }
        .gold-bar { height: 5px; background: #d4af37; border-radius: 3px; margin-bottom: 28px; }
        .shop-name { font-size: 13px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
        .barber-name { font-size: 26px; font-weight: 900; color: #fff; margin: 6px 0 2px; }
        .barber-role { font-size: 13px; color: #d4af37; font-weight: 600; letter-spacing: 0.04em; }
        .divider { height: 1px; background: #222; margin: 18px 0; }
        .qr-wrap {
          background: #fff;
          border-radius: 12px;
          padding: 14px;
          border: 2px solid #d4af37;
          display: inline-block;
          margin: 4px 0 16px;
        }
        .qr-wrap svg { display: block; width: 240px; height: 240px; }
        .cta { font-size: 14px; color: #d4af37; font-weight: 700; margin-bottom: 20px; }
        .btn {
          display: inline-block;
          background: #d4af37;
          color: #000;
          font-weight: 800;
          font-size: 14px;
          padding: 12px 28px;
          border-radius: 10px;
          text-decoration: none;
          margin-bottom: 10px;
        }
        .btn--outline {
          display: inline-block;
          background: transparent;
          color: #d4af37;
          font-weight: 700;
          font-size: 13px;
          padding: 10px 28px;
          border-radius: 10px;
          text-decoration: none;
          border: 1px solid #d4af37;
          margin-bottom: 14px;
        }
        .brand { font-size: 11px; color: #333; margin-top: 10px; }
        @media print {
          body { background: #fff; }
          .qr-card { border: none; box-shadow: none; max-width: 100%; }
          .btn, .brand { display: none; }
          .shop-name { color: #888; }
          .barber-name { color: #000; }
          .barber-role { color: #c8a800; }
          .cta { color: #c8a800; }
        }
      `}</style>
      <div className="qr-card">
        <div className="gold-bar" />
        <div className="shop-name">{shop.name}</div>
        <div className="barber-name">{barberName}</div>
        <div className="barber-role">{barber.role}</div>
        <div className="divider" />
        <div className="qr-wrap" dangerouslySetInnerHTML={{ __html: svgString }} />
        <div className="cta">Scan to Book with {shortName}</div>
        <a href={scheduleUrl} className="btn">View Schedule</a>
        <br />
        <ShareButton url={`https://booking.squarebidness.com/${shopSlug}/${barberSlug}/qr`} title={`Book with ${barberName} · ${shop.name}`} />
        <div className="brand">Powered by SquareBidness</div>
      </div>
    </>
  );
}
