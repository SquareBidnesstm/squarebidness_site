// FILE: /api/delish/twilio-inbound.js
import { Redis } from "@upstash/redis";
import twilio from "twilio";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseFormBody(raw) {
  const params = new URLSearchParams(raw);
  const data = {};
  for (const [key, value] of params.entries()) {
    data[key] = value;
  }
  return data;
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getRequestUrl(req) {
  if (process.env.TWILIO_INBOUND_WEBHOOK_URL) {
    return process.env.TWILIO_INBOUND_WEBHOOK_URL;
  }

  const proto = firstHeader(req.headers["x-forwarded-proto"]) || "https";
  const host = firstHeader(req.headers["x-forwarded-host"]) ||
    firstHeader(req.headers.host);

  if (!host) return "";

  return `${proto}://${host}${req.url || ""}`;
}

function isValidTwilioSignature(req, body) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) return true;

  const signature = firstHeader(req.headers["x-twilio-signature"]) || "";
  const requestUrl = getRequestUrl(req);

  if (!signature || !requestUrl) return false;

  return twilio.validateRequest(authToken, signature, requestUrl, body);
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

function twimlMessage(message) {
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const response = new MessagingResponse();
  response.message(message);
  return response.toString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  try {
    const rawBody = await readRawBody(req);
    const body = parseFormBody(rawBody);

    if (!isValidTwilioSignature(req, body)) {
      console.error("DELISH TWILIO INBOUND SIGNATURE INVALID");
      return res.status(403).send("Forbidden");
    }

    const from = normalizePhone(body.From || "");
    const incomingText = String(body.Body || "").trim().toUpperCase();

    if (!from) {
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(
        twimlMessage("We could not verify this number. Please contact Delish directly.")
      );
    }

    const requestId = await redis.get(`delish:catering:phone:${from}`);

    if (!requestId) {
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(
        twimlMessage("No open Delish catering request was found for this number.")
      );
    }

    const key = `delish:catering:${requestId}`;
    const existing = await redis.get(key);

    if (!existing) {
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(
        twimlMessage("No open Delish catering request was found for this number.")
      );
    }

    // If already verified or later in pipeline, don't regress
    if (
      existing.status === "verified" ||
      existing.status === "deposit_sent" ||
      existing.status === "deposit_paid"
    ) {
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(
        twimlMessage("Your Delish catering request is already confirmed.")
      );
    }

    if (incomingText === "YES") {
      const updated = {
        ...existing,
        updatedAt: new Date().toISOString(),
        status: "verified",
        verified: "yes",
        verifiedAt: new Date().toISOString(),
      };

      await redis.set(key, updated);

      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(
        twimlMessage("Thank you. Your Delish catering request is confirmed.")
      );
    }

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(
      twimlMessage("Reply YES to confirm your Delish catering request.")
    );
  } catch (error) {
    console.error("DELISH TWILIO INBOUND ERROR:", error);

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(
      twimlMessage("We received your message, but could not process it right now.")
    );
  }
}
