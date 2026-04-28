export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    const fullName = clean(body.fullName);
    const phone = clean(body.phone);
    const email = clean(body.email);
    const city = clean(body.city);
    const state = clean(body.state);
    const requestedAmount = clean(body.requestedAmount);
    const incomeStatus = clean(body.incomeStatus);
    const bestTime = clean(body.bestTime);
    const notes = clean(body.notes);

    if (!fullName || !phone || !city || !state || !requestedAmount || !incomeStatus || !bestTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const leadId = makeLeadId();

    const to = process.env.LOAN_LEAD_TO || "hammondcreditla@bellsouth.net";
    const cc = process.env.LOAN_LEAD_CC || "";
    const from = process.env.RESEND_FROM || "Square Bidness <noreply@squarebidness.com>";
    const resendKey = process.env.RESEND_API_KEY;

    const subject = `New Loan Review Lead: ${leadId}`;

    const text = `
New loan review lead received.

Lead ID: ${leadId}

Name: ${fullName}
Phone: ${phone}
Email: ${email || "Not provided"}
City: ${city}
State: ${state}

Requested Amount: ${requestedAmount}
Employment / Income Status: ${incomeStatus}
Best Time to Call: ${bestTime}

Notes:
${notes || "None"}

Referral Source: Square Bidness Intake
Submitted At: ${new Date().toISOString()}
`.trim();

    if (resendKey) {
      const emailPayload = {
        from,
        to: [to],
        subject,
        text,
      };

      if (cc) {
        emailPayload.cc = cc.split(",").map((x) => x.trim()).filter(Boolean);
      }

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error("Resend failed:", errText);
        return res.status(500).json({ error: "Email delivery failed" });
      }
    } else {
      console.warn("Missing RESEND_API_KEY. Lead was accepted but no email was sent.");
    }

    return res.status(200).json({
      ok: true,
      leadId,
    });
  } catch (err) {
    console.error("Loan intake error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

function clean(value) {
  return String(value || "").trim().slice(0, 1000);
}

function makeLeadId() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LOAN-${yy}${mm}${dd}-${rand}`;
}
