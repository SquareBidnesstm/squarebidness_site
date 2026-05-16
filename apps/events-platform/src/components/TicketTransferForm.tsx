"use client";

import { useState } from "react";

export default function TicketTransferForm({
  ticketCode,
  tierName,
  buyerEmail,
}: {
  ticketCode: string;
  tierName: string;
  buyerEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; newEmail?: string; error?: string } | null>(null);

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/tickets/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketCode, currentEmail: buyerEmail, newName: name, newEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error ?? "Transfer failed" });
      else {
        setResult({ ok: true, newEmail: data.newEmail });
        setOpen(false);
      }
    } catch {
      setResult({ error: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok) {
    return (
      <p style={{ color: "#22c55e", fontSize: "0.8rem", marginTop: 8 }}>
        ✓ Transferred to {result.newEmail}
      </p>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: "transparent", border: "1px solid #2a2a2d",
            borderRadius: 8, padding: "6px 14px",
            color: "#a1a1aa", fontSize: "0.78rem", fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Transfer Ticket →
        </button>
      ) : (
        <form onSubmit={handleTransfer} style={{ marginTop: 8, display: "grid", gap: 8, padding: "14px", background: "#080808", border: "1px solid #1d1d1f", borderRadius: 10 }}>
          <p style={{ fontWeight: 800, fontSize: "0.82rem", color: "#a1a1aa", margin: 0 }}>
            Transfer <span style={{ color: "#fff" }}>{tierName}</span>
          </p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="New holder's name"
            className="input"
            required
            style={{ fontSize: "0.88rem" }}
          />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="New holder's email"
            className="input"
            required
            style={{ fontSize: "0.88rem" }}
          />
          {result?.error && (
            <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: 0 }}>{result.error}</p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={loading}
              className="btn btn--primary"
              style={{ flex: 1, minHeight: 38, fontSize: "0.85rem", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Transferring…" : "Confirm Transfer"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setResult(null); }}
              style={{ background: "transparent", border: "1px solid #2a2a2d", borderRadius: 8, padding: "0 14px", color: "#a1a1aa", fontSize: "0.85rem", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
