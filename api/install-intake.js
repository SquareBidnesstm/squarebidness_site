export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const {
      name = "",
      business = "",
      phone = "",
      email = "",
      city = "",
      state = "",
      orderFlow = "",
      prepaidInterest = "",
      cateringNeeded = "",
      budgetRange = "",
      notes = "",
      source = "install-page",
      submittedAt = new Date().toISOString()
    } = req.body || {};

    if (!name.trim() || !business.trim() || !phone.trim() || !city.trim() || !state.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields."
      });
    }

    const scriptUrl = "YOUR_GOOGLE_SCRIPT_URL_HERE";

    const upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        submittedAt,
        name: name.trim(),
        business: business.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        state: state.trim(),
        orderFlow: orderFlow.trim(),
        prepaidInterest: prepaidInterest.trim(),
        cateringNeeded: cateringNeeded.trim(),
        budgetRange: budgetRange.trim(),
        notes: notes.trim(),
        source: source.trim(),
        status: "NEW_INSTALL_LEAD"
      })
    });

    const text = await upstream.text();
    let data = {};

    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: upstream.ok, raw: text };
    }

    if (!upstream.ok || data.ok === false) {
      return res.status(502).json({
        ok: false,
        error: data.error || "Failed to submit install intake."
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("POST /api/install-intake error:", error);
    return res.status(500).json({
      ok: false,
      error: "Server error."
    });
  }
}
