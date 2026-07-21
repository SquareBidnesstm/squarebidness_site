import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { supabaseServer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function getShop(shopSlug: string) {
  const { data } = await supabaseServer
    .from("shops")
    .select("id, name, city, state")
    .eq("slug", shopSlug)
    .eq("active", true)
    .single();
  return data;
}

export default async function ShopQRPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const shop = await getShop(shopSlug);
  if (!shop) notFound();

  const bookingUrl = `https://booking.squarebidness.com/${shopSlug}`;
  const svgString = await QRCode.toString(bookingUrl, {
    type: "svg",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  const label = shop.name;
  const sub = [shop.city, shop.state].filter(Boolean).join(", ");

  return (
    <html lang="en">
      <head>
        <title>{label} — QR Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #0a0a0a;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .card {
            background: #111;
            border: 1px solid #222;
            border-radius: 20px;
            padding: 36px 32px 32px;
            max-width: 380px;
            width: 90%;
            text-align: center;
          }
          .gold-bar { height: 5px; background: #d4af37; border-radius: 3px; margin-bottom: 28px; }
          .shop-name { font-size: 22px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; color: #d4af37; }
          .location { font-size: 13px; color: #666; margin-top: 4px; letter-spacing: 0.04em; text-transform: uppercase; }
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
          .cta { font-size: 14px; color: #d4af37; font-weight: 700; margin-bottom: 6px; }
          .url { font-size: 11px; color: #444; font-family: monospace; margin-bottom: 20px; word-break: break-all; }
          .btn {
            display: inline-block;
            background: #d4af37;
            color: #000;
            font-weight: 800;
            font-size: 14px;
            padding: 12px 28px;
            border-radius: 10px;
            text-decoration: none;
            margin-bottom: 14px;
          }
          .brand { font-size: 11px; color: #333; margin-top: 10px; }
          @media print {
            body { background: #fff; }
            .card { border: none; box-shadow: none; max-width: 100%; }
            .btn, .brand { display: none; }
            .shop-name { color: #000; }
            .location { color: #555; }
            .url { color: #888; }
            .cta { color: #c8a800; }
          }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="gold-bar" />
          <div className="shop-name">{label}</div>
          {sub && <div className="location">{sub}</div>}
          <div className="divider" />
          <div
            className="qr-wrap"
            dangerouslySetInnerHTML={{ __html: svgString }}
          />
          <div className="cta">Scan to Book an Appointment</div>
          <a href={bookingUrl} className="btn">Open Booking Page</a>
          <div className="brand">Powered by SquareBidness</div>
        </div>
      </body>
    </html>
  );
}
