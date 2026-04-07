export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function buildLeadId() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const t = String(d.getTime()).slice(-6);
    return `SBI-${y}${m}${day}-${t}`;
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
      monthlyVolume = "",
      launchTimeline = "",
      notes = "",
      source = "install-page"
    } = req.body || {};

    if (
      !clean(name) ||
      !clean(business) ||
      !clean(phone) ||
      !clean(city) ||
      !clean(state)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields."
      });
    }

    const now = new Date().toISOString();
    const leadId = buildLeadId();

    const payload = {
      timestamp: now,
      leadId,
      contactName: clean(name),
      businessName: clean(business),
      phone: clean(phone),
      email: clean(email),
      city: clean(city),
      state: clean(state),
      businessType: "Restaurant",
      currentOrderMethod: clean(orderFlow),
      wantsPrepaidSystem: clean(prepaidInterest),
      cateringNeeded: clean(cateringNeeded),
      budgetRange: clean(budgetRange),
      monthlyVolume: clean(monthlyVolume),
      launchTimeline: clean(launchTimeline),
      notes: clean(notes),
      source: clean(source),
      status: "New Lead",
      statusUpdatedAt: now,
      internalOwner: "Marcus",
      smsAlertSent: "No",
      lastContactDate: "",
      nextStep: "Review lead and contact operator",
      nextStepDate: "",
      installPackage: "",
      estimatedValue: "",
      depositStatus: "Not Sent",
      onboardingLink: "",
      goLiveDate: ""
    };

    const scriptUrl =
      "https://script.google.com/a/macros/squarebidness.com/s/AKfycby040eNFYM4H_VbohTxA3OLrph18eOIg71CWufV6SyhBCqmdVNg3wHmWtYq9JGPbrD6/exec";

    const upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
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
        error: data.error || "Failed to submit install intake.",
        detail: data
      });
    }

    return res.status(200).json({
      ok: true,
      leadId
    });
  } catch (error) {
    console.error("POST /api/install-intake error:", error);
    return res.status(500).json({
      ok: false,
      error: "Server error."
    });
  }
}
