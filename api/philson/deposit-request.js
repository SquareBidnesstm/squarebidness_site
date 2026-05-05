export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const scriptUrl = process.env.PHILSON_DEPOSIT_SCRIPT_URL;

    if (!scriptUrl) {
      return res.status(500).json({
        ok: false,
        error: "Missing PHILSON_DEPOSIT_SCRIPT_URL environment variable",
      });
    }

    const body = req.body || {};

    const payload = {
      fullName: String(body.fullName || "").trim(),
      phone: String(body.phone || "").trim(),
      projectType: String(body.projectType || "").trim(),
      eventDate: String(body.eventDate || "").trim(),
      budget: String(body.budget || "").trim(),
      deliveryType: String(body.deliveryType || "").trim(),
      details: String(body.details || "").trim(),
      source: String(body.source || "philson-deposit-page").trim(),
    };

    if (
      !payload.fullName ||
      !payload.phone ||
      !payload.projectType ||
      !payload.eventDate ||
      !payload.budget ||
      !payload.details
    ) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields",
      });
    }

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = {
        ok: response.ok,
        raw: text,
      };
    }

    if (!response.ok || result.ok === false) {
      return res.status(502).json({
        ok: false,
        error: result.error || "Google Apps Script request failed",
        details: result,
      });
    }

    return res.status(200).json({
      ok: true,
      requestId: result.requestId || null,
    });
  } catch (error) {
    console.error("PHILSON DEPOSIT REQUEST ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Unexpected server error",
    });
  }
}
