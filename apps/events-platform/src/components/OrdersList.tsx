"use client";

import { useState } from "react";
import RefundButton from "./RefundButton";

interface Order {
  id: string;
  order_code: string;
  buyer_name: string;
  buyer_email: string;
  total: number;
  status: string;
  created_at: string;
}

interface OrdersListProps {
  eventId: string;
  initialOrders: Order[];
  initialTotal: number;
}

const PAGE_SIZE = 20;

export default function OrdersList({ eventId, initialOrders, initialTotal }: OrdersListProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [offset, setOffset] = useState(initialOrders.length);
  const [loading, setLoading] = useState(false);
  const hasMore = offset < initialTotal;

  async function loadMore() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/organizer/orders?eventId=${eventId}&offset=${offset}&limit=${PAGE_SIZE}`
      );
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders((prev) => [...prev, ...data.orders]);
        setOffset((prev) => prev + data.orders.length);
      }
    } finally {
      setLoading(false);
    }
  }

  if (orders.length === 0) {
    return <p style={{ color: "#555", fontSize: "0.9rem" }}>No orders yet.</p>;
  }

  return (
    <div>
      <div style={{ display: "grid", gap: 8, marginBottom: hasMore ? 16 : 0 }}>
        {orders.map((order) => (
          <div
            key={order.id}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 14px", background: "#050505", borderRadius: 10,
              border: "1px solid #1d1d1f", gap: 12, flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <p style={{ fontWeight: 800, fontSize: "0.9rem", fontFamily: "monospace" }}>{order.order_code}</p>
                <span style={{
                  fontSize: "0.7rem", fontWeight: 900, padding: "2px 8px", borderRadius: 99,
                  background: order.status === "paid" ? "#0a2a0a" : order.status === "cancelled" ? "#1a0a0a" : "#1a1a0a",
                  color: order.status === "paid" ? "#22c55e" : order.status === "cancelled" ? "#ef4444" : "#eab308",
                  border: `1px solid ${order.status === "paid" ? "#166534" : order.status === "cancelled" ? "#7f1d1d" : "#713f12"}`,
                  textTransform: "uppercase" as const,
                }}>
                  {order.status}
                </span>
              </div>
              <p style={{ color: "#a1a1aa", fontSize: "0.8rem" }}>{order.buyer_name} · {order.buyer_email}</p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>
                {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <p style={{ fontWeight: 900, color: "#22c55e", fontSize: "0.95rem" }}>
                ${Number(order.total).toFixed(2)}
              </p>
              {order.status === "paid" && (
                <RefundButton
                  orderId={order.id}
                  orderCode={order.order_code}
                  buyerName={order.buyer_name}
                  total={Number(order.total)}
                />
              )}
              {order.status === "cancelled" && (
                <span style={{ fontSize: "0.75rem", color: "#555" }}>Refunded</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="btn btn--ghost"
          style={{ width: "100%", minHeight: 40, fontSize: "0.85rem", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Loading…" : `Load more (${initialTotal - offset} remaining)`}
        </button>
      )}
    </div>
  );
}
