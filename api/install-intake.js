import { sendInstallSms } from "./_lib/send-install-sms.js";

const DEFAULT_INSTALL_ALERT_EMAIL = "marcusbuckner@squarebidness.com";

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
    const body = req.body || {};
    const name = clean(body.name || body.contactName || body.ownerName);
    const business = clean(body.business || body.businessName);
    const phone = clean(body.phone);
    const email = clean(body.email);
    const city = clean(body.city);
    const state = clean(body.state);
    const businessType = clean(body.businessType);
    const orderFlow = clean(body.orderFlow || body.currentOrderFlow);
    const cateringNeeded = clean(body.cateringNeeded);
    const budgetRange = clean(body.budgetRange);
    const monthlyVolume = clean(body.monthlyVolume);
    const launchTimeline = clean(body.launchTimeline);
    const notes = clean(body.notes);
    const source = clean(body.source || "install-page");
    const serviceStyle = clean(body.serviceStyle);
    const currentTools = clean(body.currentTools);
    const mustHave = clean(body.mustHave);

    if (
      !name ||
      !business ||
      !phone
    ) {
      return res.status(400).json({
        ok: false,
        error: "Name, business, and phone are required."
      });
    }

    const now = new Date().toISOString();
    const leadId = buildLeadId();

    const payload = {
      submittedAt: now,
      name: clean(name),
      business: clean(business),
      phone: clean(phone),
      email: clean(email),
      city: clean(city),
      state: clean(state),
      businessType: clean(businessType),
      orderFlow: clean(orderFlow),
      cateringNeeded: clean(cateringNeeded),
      budgetRange: clean(budgetRange),
      monthlyVolume: clean(monthlyVolume),
      launchTimeline: clean(launchTimeline),
      notes: clean(notes),
      source: clean(source),
      leadId,
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
      goLiveDate: "",
      serviceStyle,
      currentTools,
      mustHave
    };

    const scriptUrl =
      "https://script.google.com/macros/s/AKfycby040eNFYM4H_VbohTxA3OLrph18eOIg71CWufV6SyhBCqmdVNg3wHmWtYq9JGPbrD6/exec";

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
      console.error("Install intake upstream error:", {
        status: upstream.status,
        statusText: upstream.statusText,
        data
      });

      return res.status(502).json({
        ok: false,
        error: data.error || "Failed to submit install intake.",
        detail: data
      });
    }

    const smsBody =
`NEW INSTALL LEAD
Business: ${business}
Contact: ${name}
Type: ${businessType || "Not provided"}
City: ${city || "Not provided"}, ${state || "Not provided"}
Phone: ${phone}
Budget: ${budgetRange || "Not provided"}
Timeline: ${launchTimeline || "Not provided"}
Lead ID: ${leadId}`;

    const smsResult = await sendInstallSms({
      to: process.env.SB_INSTALL_ALERT_TO,
      body: smsBody
    });

    const emailResult = await sendInstallEmail({
      to: process.env.SB_INSTALL_ALERT_EMAIL || DEFAULT_INSTALL_ALERT_EMAIL,
      subject: `New Install Lead: ${business} (${leadId})`,
      lead: payload
    });

    return res.status(200).json({
      ok: true,
      leadId,
      sms: smsResult,
      email: emailResult
    });
  } catch (error) {
    console.error("POST /api/install-intake error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Server error."
    });
  }
}

async function sendInstallEmail({ to, subject, lead }) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Square Bidness <noreply@squarebidness.com>";

  if (!resendKey) {
    console.warn("Missing RESEND_API_KEY. Install lead accepted but email alert was not sent.");
    return { ok: false, skipped: true, reason: "Missing RESEND_API_KEY" };
  }

  const text = `
New Square Bidness install lead received.

Lead ID: ${lead.leadId}
Submitted At: ${lead.submittedAt}
Source: ${lead.source}

Contact
Name: ${lead.name}
Business: ${lead.business}
Phone: ${lead.phone}
Email: ${lead.email || "Not provided"}
City/State: ${lead.city || "Not provided"}, ${lead.state || "Not provided"}

Install Details
Business Type: ${lead.businessType || "Not provided"}
Service Style: ${lead.serviceStyle || "Not provided"}
Current Order Flow: ${lead.orderFlow || "Not provided"}
Current Tools: ${lead.currentTools || "Not provided"}
Catering Needed: ${lead.cateringNeeded || "Not provided"}
Monthly Volume: ${lead.monthlyVolume || "Not provided"}
Budget Range: ${lead.budgetRange || "Not provided"}
Launch Timeline: ${lead.launchTimeline || "Not provided"}
Must Have: ${lead.mustHave || "Not provided"}

Notes:
${lead.notes || "None"}
`.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Install intake email failed:", errorText);
    return { ok: false, error: "Email delivery failed" };
  }

  return { ok: true, to };
}
