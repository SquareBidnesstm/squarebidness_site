import QRCode from "qrcode";
import { buildVipCode } from "../_lib/chocolate-city-vip.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const sessionId = String(req.query.session_id || "").trim();
    const vipCode = buildVipCode(sessionId);

    if (!vipCode) {
      return res.status(400).json({ ok: false, error: "Missing session_id" });
    }

    const svg = await QRCode.toString(vipCode, {
      type: "svg",
      margin: 1,
      width: 280,
      errorCorrectionLevel: "M",
      color: {
        dark: "#130c0a",
        light: "#fff7ea"
      }
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(svg);
  } catch (err) {
    console.error("Chocolate City VIP QR error:", err);
    return res.status(500).json({ ok: false, error: "Unable to generate VIP QR" });
  }
}
