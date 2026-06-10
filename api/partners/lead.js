import { sendInstallSms } from "../_lib/send-install-sms.js";

const DEFAULT_PARTNER_ALERT_EMAIL = "marcusbuckner@squarebidness.com";
const PARTNER_STATUSES = [
  "NEW",
  "CONTACTED",
  "DISCOVERY SCHEDULED",
  "PROPOSAL SENT",
  "ACTIVATED",
  "PAID"
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function buildPartnerLeadId() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const t = String(d.getTime()).slice(-6);
    return `SBP-${y}${m}${day}-${t}`;
  }

  try {
    const body = req.body || {};

    const partnerName = clean(body.partnerName);
    const partnerPhone = clean(body.partnerPhone);
    const partnerEmail = clean(body.partnerEmail);
    const relationshipToLead = clean(body.relationshipToLead);

    const ownerName = clean(body.ownerName);
    const businessName = clean(body.businessName);
    const businessPhone = clean(body.businessPhone);
    const businessEmail = clean(body.businessEmail);
    const businessType = clean(body.businessType);
    const platformLane = clean(body.platformLane);
    const problemToSolve = clean(body.problemToSolve);
    const bestContactTime = clean(body.bestContactTime);
    const notes = clean(body.notes);
    const source = clean(body.source || "partner_program");

    if (!partnerName || !partnerPhone || !ownerName || !businessName || !businessPhone || !platformLane) {
      return res.status(400).json({
        ok: false,
        error: "Partner name, partner phone, owner name, business name, business phone, and platform lane are required."
      });
    }

    const now = new Date().toISOString();
    const leadId = buildPartnerLeadId();

    const payload = {
      submittedAt: now,
      source,
      leadId,
      status: PARTNER_STATUSES[0],
      statusUpdatedAt: now,

      partnerName,
      partnerPhone,
      partnerEmail,
      relationshipToLead,

      ownerName,
      businessName,
      businessPhone,
      businessEmail,
      businessType,
      platformLane,
      problemToSolve,
      bestContactTime,
      notes,

      leadValue: "",
      platformActivated: "",
      referralAmount: "",
      internalNotes: "",
      ownerAssigned: "Marcus",
      nextStep: "Review partner lead and contact business owner",
      nextStepDate: "",
      payoutStatus: "Not Eligible Yet",
      payoutNotes: "",
      allowedStatuses: PARTNER_STATUSES.join(" | ")
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
      console.error("Partner lead upstream error:", {
        status: upstream.status,
        statusText: upstream.statusText,
        data
      });

      return res.status(502).json({
        ok: false,
        error: data.error || "Failed to submit partner lead.",
        detail: data
      });
    }

    const smsBody =
`NEW PARTNER LEAD
Partner: ${partnerName}
Business: ${businessName}
Owner: ${ownerName}
Lane: ${platformLane}
Phone: ${businessPhone}
Lead ID: ${leadId}`;

    const smsResult = await sendInstallSms({
      to: process.env.SB_INSTALL_ALERT_TO,
      body: smsBody
    });

    const emailResult = await sendPartnerLeadEmail({
      to: process.env.SB_PARTNER_ALERT_EMAIL || process.env.SB_INSTALL_ALERT_EMAIL || DEFAULT_PARTNER_ALERT_EMAIL,
      subject: `New Partner Lead: ${businessName} (${leadId})`,
      lead: payload
    });

    return res.status(200).json({
      ok: true,
      leadId,
      status: payload.status,
      sms: smsResult,
      email: emailResult
    });
  } catch (error) {
    console.error("POST /api/partners/lead error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Server error."
    });
  }
}

async function sendPartnerLeadEmail({ to, subject, lead }) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Square Bidness <noreply@squarebidness.com>";

  if (!resendKey) {
    console.warn("Missing RESEND_API_KEY. Partner lead accepted but email alert was not sent.");
    return { ok: false, skipped: true, reason: "Missing RESEND_API_KEY" };
  }

  const text = `
New Square Bidness partner lead received.

Lead ID: ${lead.leadId}
Status: ${lead.status}
Submitted At: ${lead.submittedAt}
Source: ${lead.source}

Partner
Name: ${lead.partnerName}
Phone: ${lead.partnerPhone}
Email: ${lead.partnerEmail || "Not provided"}
Relationship To Lead: ${lead.relationshipToLead || "Not provided"}

Business Owner
Owner Name: ${lead.ownerName}
Business: ${lead.businessName}
Phone: ${lead.businessPhone}
Email: ${lead.businessEmail || "Not provided"}
Business Type: ${lead.businessType || "Not provided"}
Platform Lane: ${lead.platformLane}
Best Contact Time: ${lead.bestContactTime || "Not provided"}

Problem To Solve:
${lead.problemToSolve || "Not provided"}

Partner Notes:
${lead.notes || "None"}

Internal Fields
Lead Value: ${lead.leadValue || "TBD"}
Platform Activated: ${lead.platformActivated || "TBD"}
Referral Amount: ${lead.referralAmount || "TBD"}
Owner Assigned: ${lead.ownerAssigned}
Allowed Statuses: ${lead.allowedStatuses}
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
    console.error("Partner lead email failed:", errorText);
    return { ok: false, error: "Email delivery failed" };
  }

  return { ok: true, to };
}
