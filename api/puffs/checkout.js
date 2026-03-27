// /api/puffs/checkout.js
import fs from "fs";
import path from "path";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanString(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function makeOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PUFF-${y}${m}${d}-${rand}`;
}

function readMenuFile() {
  const menuPath = path.join(process.cwd(), "public", "puffs", "menu.json");
  const raw = fs.readFileSync(menuPath, "utf8");
  return JSON.parse(raw);
}

function getItemDay(item) {
  const day = String(item?.day || "").toLowerCase().trim();
  return day === "sunday" ? "sunday" : "saturday";
}

function flattenMenu(menu) {
  const map = new Map();

  for (const section of menu.sections || []) {
    for (const item of section.items || []) {
      map.set(String(item.id), {
        id: String(item.id),
        name: String(item.name || ""),
        price: Number(item.price || 0),
        badge: item.badge || "",
        subnote: item.subnote || "",
        section: section.section || "",
        day: getItemDay(item)
      });
    }
  }

  return map;
}

async function redisPost(pathname) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${REDIS_URL}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Redis request failed (${res.status})`);
  }
  return data;
}

async function redisSet(key, value) {
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(JSON.stringify(value));
  return redisPost(`/set/${encodedKey}/${encodedValue}`);
}

function getRequestedMenuDay(value) {
  const day = String(value || "").toLowerCase().trim();
  return day === "sunday" ? "sunday" : "saturday";
}

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN ||
    !process.env.SITE_URL
  ) {
    return res.status(500).json({
      ok: false,
      error: "Missing required env vars."
    });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const customerName = cleanString(body.customerName, 120);
    const customerPhone = digitsOnly(body.customerPhone);
    const pickupTime = cleanString(body.pickupTime, 80) || "ASAP";
    const notes = cleanString(body.notes, 500);
    const smsConsent = body.smsConsent === true;
    const requestedDay = getRequestedMenuDay(body.menuDay);

    const submittedItems = Array.isArray(body.items) ? body.items : [];

    if (!customerName) {
      return res.status(400).json({ ok: false, error: "Customer name is required." });
    }

    if (!submittedItems.length) {
      return res.status(400).json({ ok: false, error: "At least one item is required." });
    }

    const menu = readMenuFile();

    if (menu.open === false) {
      return res.status(400).json({ ok: false, error: "Orders are currently closed." });
    }

    const catalog = flattenMenu(menu);

    const normalizedItems = [];
    for (const rawItem of submittedItems) {
      const id = String(rawItem.id || "");
      const qty = Math.max(0, Number(rawItem.qty || 0));

      if (!id || qty <= 0) continue;

      const match = catalog.get(id);
      if (!match) {
        return res.status(400).json({
          ok: false,
          error: `Invalid item selected: ${id}`
        });
      }

      if (match.day !== requestedDay) {
        return res.status(400).json({
          ok: false,
          error: `${match.name} is only available on ${match.day}.`
        });
      }

      normalizedItems.push({
        id: match.id,
        name: match.name,
        qty,
        price: Number(match.price),
        section: match.section,
        day: match.day
      });
    }

    if (!normalizedItems.length) {
      return res.status(400).json({ ok: false, error: "No valid items were submitted." });
    }

    const taxRate = Number(menu.taxRate || 0.0895);
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    const tax = Number((subtotal * taxRate).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    const orderNumber = makeOrderNumber();

    const line_items = normalizedItems.map((item) => ({
      quantity: item.qty,
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          metadata: {
            item_id: item.id,
            section: item.section || "",
            day: item.day || ""
          }
        },
        unit_amount: Math.round(item.price * 100)
      }
    }));

    if (tax > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: {
            name: "Sales Tax"
          },
          unit_amount: Math.round(tax * 100)
        }
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${process.env.SITE_URL}/puffs/thank-you/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/puffs/menu/?canceled=1`,
      billing_address_collection: "auto",
      phone_number_collection: {
        enabled: true
      },
      metadata: {
        brand: "puffs",
        orderNumber,
        menuDay: requestedDay,
        customerName,
        customerPhone,
        pickupTime,
        notes,
        smsConsent: smsConsent ? "yes" : "no"
      },
      custom_text: {
        submit: {
          message: `Menu: ${requestedDay.charAt(0).toUpperCase() + requestedDay.slice(1)} • Pickup: ${pickupTime}${notes ? ` • Notes: ${notes}` : ""}`
        }
      }
    });

    const pendingOrder = {
      orderNumber,
      createdAt: new Date().toISOString(),
      stripeSessionId: session.id,
      stripeCheckoutUrl: session.url,
      paymentStatus: "pending",
      menuDay: requestedDay,
      pickupTime,
      customerName,
      customerPhone,
      notes,
      smsConsent,
      taxRate,
      subtotal: Number(subtotal.toFixed(2)),
      tax,
      total,
      items: normalizedItems
    };

    await redisSet(`puffs:checkout:${session.id}`, pendingOrder);

    return res.status(200).json({
      ok: true,
      url: session.url,
      orderNumber
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to start checkout."
    });
  }
}
