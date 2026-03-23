// FILE: /app/api/delish-order-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL!,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN!,
});

type IncomingOrderItem = {
  name: string;
  qty: number;
  price: number;
};

type IncomingOrder = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupDate: string;
  pickupWindow: string;
  notes?: string;
  items: IncomingOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: "paid";
  source?: string;
  stripeSessionId?: string;
};

function makeOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DL-${y}${m}${d}-${rand}`;
}

function isValidOrder(body: Partial<IncomingOrder>) {
  return (
    body &&
    typeof body.customerName === "string" &&
    typeof body.customerPhone === "string" &&
    typeof body.pickupDate === "string" &&
    typeof body.pickupWindow === "string" &&
    Array.isArray(body.items) &&
    body.items.length > 0 &&
    typeof body.total === "number" &&
    body.paymentStatus === "paid"
  );
}

export async function POST(req: NextRequest) {
  try {
    if (
      !process.env.DELISH_UPSTASH_REDIS_REST_URL ||
      !process.env.DELISH_UPSTASH_REDIS_REST_TOKEN
    ) {
      return NextResponse.json(
        { ok: false, error: "Missing Delish Redis environment variables." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Partial<IncomingOrder>;

    if (!isValidOrder(body)) {
      return NextResponse.json(
        { ok: false, error: "Invalid paid order payload." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const orderNumber = makeOrderNumber();

    const orderRecord = {
      id,
      orderNumber,
      createdAt: new Date().toISOString(),
      customerName: body.customerName!,
      customerPhone: body.customerPhone!,
      customerEmail: body.customerEmail || "",
      pickupDate: body.pickupDate!,
      pickupWindow: body.pickupWindow!,
      notes: body.notes || "",
      items: body.items!,
      subtotal: body.subtotal ?? 0,
      tax: body.tax ?? 0,
      total: body.total!,
      paymentStatus: "paid" as const,
      source: body.source || "delish-online-order",
      stripeSessionId: body.stripeSessionId || "",
    };

    await redis.set(`delish:order:${id}`, orderRecord);
    await redis.lpush("delish:orders:list", id);
    await redis.ltrim("delish:orders:list", 0, 99);

    return NextResponse.json({
      ok: true,
      id,
      orderNumber,
    });
  } catch (error) {
    console.error("POST /api/delish-order-webhook error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to store paid order." },
      { status: 500 }
    );
  }
}
