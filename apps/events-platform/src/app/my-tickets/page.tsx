"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "sb_tickets_email";
import Link from "next/link";
import NavLogo from "../../components/NavLogo";

interface Ticket {
  id: string;
  ticket_code: string;
  tier_name: string;
  status: string;
  qr_code: string | null;
}

interface Order {
  id: string;
  order_code: string;
  status: string;
  total: number;
  created_at: string;
  events: {
    title: string;
    slug: string;
    starts_at: string;
    venue_name: string | null;
    city: string | null;
    state: string | null;
    cover_image_url: string | null;
  };
  tickets: Ticket[];
}

export default function MyTicketsPage() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  // Auto-lookup if email saved from previous visit
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setEmail(saved);
      lookup(saved);
    }
  }, []);

  async function lookup(addr: string) {
    if (!addr.trim()) return;
    setLoading(true);
    setError("");
    setOrders(null);
    setSearched(false);
    try {
      const res = await fetch("/api/tickets/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
      setOrders(data.orders);
      setSearched(true);
      localStorage.setItem(STORAGE_KEY, addr);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    await lookup(email);
  }

  function handleForget() {
    localStorage.removeItem(STORAGE_KEY);
    setEmail("");
    setOrders(null);
    setSearched(false);
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000", position: "sticky", top: 0, zIndex: 50 }}>
        <NavLogo />
        <Link href="/" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← All Events</Link>
      </nav>

      <main style={{ padding: "40px 14px 80px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>

          <h1 style={{ fontSize: "2rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 8 }}>My Tickets</h1>
          <p style={{ color: "#a1a1aa", marginBottom: 32, fontSize: "0.95rem" }}>
            Enter the email you used when buying tickets to find your orders.
          </p>

          <form onSubmit={handleLookup} style={{ display: "flex", gap: 10, marginBottom: 32 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input"
              required
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn--primary" disabled={loading} style={{ minHeight: 48, padding: "0 24px" }}>
              {loading ? "…" : "Find"}
            </button>
          </form>

          {searched && (
            <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: 16, marginTop: -20 }}>
              Showing tickets for <strong style={{ color: "#a1a1aa" }}>{email}</strong> ·{" "}
              <button onClick={handleForget} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}>
                Not you?
              </button>
            </p>
          )}

          {error && (
            <p style={{ color: "#ef4444", fontSize: "0.9rem", marginBottom: 20 }}>{error}</p>
          )}

          {searched && orders?.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#a1a1aa" }}>
              <p style={{ fontSize: "1.5rem", marginBottom: 12 }}>🎟️</p>
              <p style={{ fontWeight: 700, marginBottom: 8 }}>No tickets found</p>
              <p style={{ fontSize: "0.9rem" }}>No orders found for <strong style={{ color: "#fff" }}>{email}</strong>. Double-check the email you used at checkout.</p>
            </div>
          )}

          {orders && orders.length > 0 && (
            <div style={{ display: "grid", gap: 16 }}>
              {orders.map((order) => {
                const ev = order.events as any;
                const eventDate = ev?.starts_at
                  ? new Date(ev.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                  : "";
                const location = [ev?.venue_name, ev?.city, ev?.state].filter(Boolean).join(" · ");
                const isCancelled = order.status === "cancelled";

                return (
                  <div key={order.id} className="card" style={{ padding: 0, overflow: "hidden", opacity: isCancelled ? 0.6 : 1 }}>
                    {/* Event header */}
                    <div style={{ display: "flex", gap: 14, padding: "16px 16px 12px", alignItems: "center" }}>
                      {ev?.cover_image_url && (
                        <img src={ev.cover_image_url} alt={ev.title} style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <p style={{ fontWeight: 900, fontSize: "0.95rem" }}>{ev?.title}</p>
                          <span style={{
                            fontSize: "0.7rem", fontWeight: 900, padding: "2px 8px", borderRadius: 99,
                            background: isCancelled ? "#1a0a0a" : "#0a2a0a",
                            color: isCancelled ? "#ef4444" : "#22c55e",
                            border: `1px solid ${isCancelled ? "#7f1d1d" : "#166534"}`,
                            textTransform: "uppercase",
                          }}>
                            {order.status}
                          </span>
                        </div>
                        <p style={{ color: "#a1a1aa", fontSize: "0.82rem" }}>{eventDate}</p>
                        {location && <p style={{ color: "#555", fontSize: "0.8rem" }}>{location}</p>}
                      </div>
                    </div>

                    {/* Order meta */}
                    <div style={{ borderTop: "1px solid #111", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
                      <span style={{ color: "#555", fontFamily: "monospace" }}>{order.order_code}</span>
                      <span style={{ fontWeight: 900, color: "#22c55e" }}>${Number(order.total).toFixed(2)}</span>
                    </div>

                    {/* Tickets */}
                    {order.tickets?.length > 0 && (
                      <div style={{ borderTop: "1px solid #111", padding: "12px 16px", display: "grid", gap: 8 }}>
                        {order.tickets.map((ticket) => (
                          <div key={ticket.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                            <div>
                              <p style={{ fontWeight: 700, fontSize: "0.85rem" }}>{ticket.tier_name}</p>
                              <p style={{ color: "#555", fontSize: "0.75rem", fontFamily: "monospace" }}>{ticket.ticket_code}</p>
                            </div>
                            <span style={{
                              fontSize: "0.7rem", fontWeight: 900, padding: "2px 8px", borderRadius: 99,
                              background: ticket.status === "checked_in" ? "#0a1a2a" : ticket.status === "valid" ? "#0a0a0a" : "#1a0a0a",
                              color: ticket.status === "checked_in" ? "#60a5fa" : ticket.status === "valid" ? "#a1a1aa" : "#ef4444",
                              border: `1px solid ${ticket.status === "checked_in" ? "#1d4ed8" : ticket.status === "valid" ? "#2a2a2d" : "#7f1d1d"}`,
                              textTransform: "uppercase", whiteSpace: "nowrap",
                            }}>
                              {ticket.status === "checked_in" ? "✓ Checked In" : ticket.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* View order link */}
                    <div style={{ borderTop: "1px solid #111", padding: "10px 16px" }}>
                      <Link href={`/orders/${order.id}`} style={{ color: "#ef4444", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}>
                        View full order & QR codes →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
