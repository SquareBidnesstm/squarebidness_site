// FILE: /api/delish/catering-request.js
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import twilio from "twilio";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

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
  process.env.DELISH_TWILIO_FROM_NUMBER;

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

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function line(label, value) {
  return `${label}: ${value || "Not provided"}`;
}

function makeRequestNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DC-${y}${m}${d}-${rand}`;
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (String(phone || "").trim().startsWith("+")) {
    return String(phone).trim();
  }

  return null;
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

    if (
      !process.env.DELISH_UPSTASH_REDIS_REST_URL ||
      !process.env.DELISH_UPSTASH_REDIS_REST_TOKEN
    ) {
      return res.status(500).json({
        ok: false,
        error: "Missing Delish Redis environment variables.",
      });
    }

    const body = req.body || {};

    if (!isValidPayload(body)) {
      return res.status(400).json({
        ok: false,
        error: "Missing required catering fields.",
      });
    }

    const normalizedPhone = normalizePhone(body.phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        ok: false,
        error: "A valid phone number is required.",
      });
    }

    const id = crypto.randomUUID();
    const requestNumber = makeRequestNumber();
    const createdAt = new Date().toISOString();

    const initialStatus = hasTwilio ? "awaiting_sms_confirmation" : "new_request";

    const record = {
      id,
      requestNumber,
      createdAt,
      updatedAt: createdAt,
      completedAt: "",
      status: initialStatus,

      verified: hasTwilio ? "no" : "unknown",
      verifiedAt: "",
      smsSentAt: "",

      customerName: clean(body.fullName),
      phone: normalizedPhone,
      email: clean(body.email),
      smsConsent: "yes",

      eventType: clean(body.eventType),
      eventDate: clean(body.eventDate),
      eventTime: clean(body.eventTime),
      guestCount: clean(body.guestCount),
      serviceType: clean(body.serviceType),
      budget: clean(body.budget),
      servingStyle: clean(body.headcountStyle),
      eventAddress: clean(body.eventAddress),

      requestedItems: clean(body.requestedItems),
      notes: clean(body.notes),

      depositPolicy:
        clean(body.depositPolicy) ||
        "25% non-refundable deposit required on approved catering orders",

      depositAmount: "",
      depositLink: "",
      depositSessionId: "",
      depositSentAt: "",
      depositPaidAt: "",
      depositPaymentIntentId: "",
      depositAmountPaid: "",

      source: clean(body._source) || "delish-catering-page",
      brand: clean(body._brand) || "Delish",
      form: clean(body._form) || "delish_catering_request",
      page: clean(body._page),
      submittedAt: clean(body._submittedAt) || createdAt,
    };

    await redis.set(`delish:catering:${id}`, record);
    await redis.lpush("delish:catering:list", id);

    if (hasTwilio) {
      await redis.set(`delish:catering:phone:${normalizedPhone}`, id);
    }

    const subject = `Delish Catering Request — ${record.customerName} — ${record.eventDate}`;

    const text = `
New Delish Catering Request

Request #: ${requestNumber}
Status: ${record.status}
Verified: ${record.verified}

${line("Full Name", record.customerName)}
${line("Phone", record.phone)}
${line("Email", record.email)}
${line("Event Type", record.eventType)}
${line("Event Date", record.eventDate)}
${line("Event Time", record.eventTime)}
${line("Guest Count", record.guestCount)}
${line("Pickup or Delivery", record.serviceType)}
${line("Budget Range", record.budget)}
${line("Serving Style", record.servingStyle)}
${line("Event Address", record.eventAddress)}

Requested Menu Items:
${record.requestedItems || "Not provided"}

Additional Details:
${record.notes || "None"}

Deposit Policy:
${record.depositPolicy}

System Metadata:
${line("Brand", record.brand)}
${line("Form", record.form)}
${line("Source", record.source)}
${line("Page", record.page)}
${line("Submitted At", record.submittedAt)}
    `.trim();

    await transporter.sendMail({
      from: `"Delish Catering" <${process.env.DELISH_SMTP_USER}>`,
      to: process.env.DELISH_NOTIFY_EMAIL || "delishcatering33@gmail.com",
      subject,
      text,
      replyTo:
        record.email ||
        process.env.DELISH_NOTIFY_EMAIL ||
        "delishcatering33@gmail.com",
    });

    if (twilioClient && process.env.TWILIO_TO_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: `New Delish catering request ${requestNumber} from ${record.customerName} for ${record.eventDate}${record.eventTime ? ` at ${record.eventTime}` : ""}.`,
          from: process.env.DELISH_TWILIO_FROM_NUMBER,
          to: process.env.TWILIO_TO_NUMBER,
        });
      } catch (smsError) {
        console.error("DELISH CATERING OPERATOR SMS ERROR:", smsError);
      }
    }

    if (twilioClient) {
      try {
        await twilioClient.messages.create({
          body: "Hey, confirming your catering request with Delish — reply YES to confirm your request.",
          from: process.env.TWILIO_FROM_NUMBER,
          to: normalizedPhone,
        });

        record.smsSentAt = new Date().toISOString();
        await redis.set(`delish:catering:${id}`, record);
      } catch (smsError) {
        console.error("DELISH CATERING CUSTOMER SMS ERROR:", smsError);
      }
    }

    return res.status(200).json({
      ok: true,
      id,
      requestNumber,
      status: record.status,
      verified: record.verified,
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
