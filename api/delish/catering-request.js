// FILE: /api/delish/catering-request.js
import nodemailer from "nodemailer";
import twilio from "twilio";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.DELISH_SMTP_USER,
    pass: process.env.DELISH_SMTP_PASS,
  },
});

const hasTwilio =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_FROM_NUMBER &&
  process.env.TWILIO_TO_NUMBER;

const twilioClient = hasTwilio
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidPayload(body) {
  return (
    body &&
    requiredString(body.fullName) &&
    requiredString(body.phone) &&
    requiredString(body.eventType) &&
    requiredString(body.eventDate) &&
    requiredString(body.guestCount) &&
    requiredString(body.serviceType) &&
    requiredString(body.requestedItems) &&
    (body.policyAgree === "on" || body.policyAgree === true)
  );
}

function line(label, value) {
  return `${label}: ${value || "Not provided"}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: "Method not allowed.",
    });
  }

  try {
    if (!process.env.DELISH_SMTP_USER || !process.env.DELISH_SMTP_PASS) {
      return res.status(500).json({
        ok: false,
        error: "Missing Delish email environment variables.",
      });
    }

    const body = req.body || {};

    if (!isValidPayload(body)) {
      return res.status(400).json({
        ok: false,
        error: "Missing required catering fields.",
      });
    }

    const subject = `Delish Catering Request — ${body.fullName} — ${body.eventDate}`;

    const text = `
New Delish Catering Request

${line("Full Name", body.fullName)}
${line("Phone", body.phone)}
${line("Email", body.email)}
${line("Event Type", body.eventType)}
${line("Event Date", body.eventDate)}
${line("Event Time", body.eventTime)}
${line("Guest Count", body.guestCount)}
${line("Pickup or Delivery", body.serviceType)}
${line("Budget Range", body.budget)}
${line("Serving Style", body.headcountStyle)}
${line("Event Address", body.eventAddress)}

Requested Menu Items:
${body.requestedItems || "Not provided"}

Additional Details:
${body.notes || "None"}

Deposit Policy:
${body.depositPolicy || "25% non-refundable deposit required on approved catering orders"}

System Metadata:
${line("Brand", body._brand)}
${line("Form", body._form)}
${line("Source", body._source)}
${line("Page", body._page)}
${line("Submitted At", body._submittedAt)}
    `.trim();

    await transporter.sendMail({
      from: `"Delish Catering" <${process.env.DELISH_SMTP_USER}>`,
      to: process.env.DELISH_NOTIFY_EMAIL || "delishcatering33@gmail.com",
      subject,
      text,
      replyTo: body.email || process.env.DELISH_NOTIFY_EMAIL || "delishcatering33@gmail.com",
    });

    if (twilioClient) {
      try {
        await twilioClient.messages.create({
          body: `New Delish catering request from ${body.fullName} for ${body.eventDate}. Check email.`,
          from: process.env.TWILIO_FROM_NUMBER,
          to: process.env.TWILIO_TO_NUMBER,
        });
      } catch (smsError) {
        console.error("DELISH CATERING SMS ERROR:", smsError);
      }
    }

    return res.status(200).json({
      ok: true,
      message: "Catering request submitted successfully.",
    });
  } catch (error) {
    console.error("DELISH CATERING REQUEST ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to submit catering request.",
    });
  }
}
