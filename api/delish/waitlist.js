// FILE: /api/delish/waitlist.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();

    if (!name && !phone && !email) {
      return res.status(400).json({
        ok: false,
        error: "Missing waitlist info."
      });
    }

    if (!phone && !email) {
      return res.status(400).json({
        ok: false,
        error: "Phone or email is required."
      });
    }

    if (!process.env.DELISH_APPS_SCRIPT_URL) {
      return res.status(500).json({
        ok: false,
        error: "Missing DELISH_APPS_SCRIPT_URL."
      });
    }

    const payload = {
      _brand: "Delish",
      _form: "waitlist",
      _source: body.source || "delish-order-page",
      _submittedAt: body.submittedAt || new Date().toISOString(),
      name,
      phone,
      email,
      interest: body.interest || "opening-notification",
      viewedMenuDay: body.viewedMenuDay || "",
      status: "WAITLIST"
    };

    const upstream = await fetch(process.env.DELISH_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const upstreamJson = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return res.status(500).json({
        ok: false,
        error: "WAITLIST_SAVE_FAILED",
        details: upstreamJson
      });
    }

    return res.status(200).json({
      ok: true
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Unable to join waitlist."
    });
  }
}
