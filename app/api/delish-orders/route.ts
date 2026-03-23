// FILE: /app/api/delish-orders/route.ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const redis = Redis.fromEnv();

type DelishOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupDate: string;
  pickupWindow: string;
  notes?: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: "paid";
  source: string;
};

export async function GET() {
  try {
    const ids = await redis.lrange<string>("delish:orders:list", 0, 49);

    if (!ids?.length) {
      return NextResponse.json({ ok: true, orders: [] });
    }

    const orderKeys = ids.map((id) => `delish:order:${id}`);
    const orders = await redis.mget<DelishOrder[]>(...orderKeys);

    const cleanOrders = (orders || []).filter(Boolean);

    return NextResponse.json({
      ok: true,
      orders: cleanOrders,
    });
  } catch (error) {
    console.error("GET /api/delish-orders error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load orders." },
      { status: 500 }
    );
  }
}
