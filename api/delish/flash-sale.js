import { getDelishFlashSale } from "../_lib/delish-flash-sale.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const sale = await getDelishFlashSale();
    return res.status(200).json({ ok: true, sale });
  } catch (error) {
    console.error("GET /api/delish/flash-sale error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to load flash sale.",
    });
  }
}
