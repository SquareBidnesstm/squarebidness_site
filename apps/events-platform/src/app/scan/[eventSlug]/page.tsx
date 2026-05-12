"use client";

import { useState, useRef } from "react";

export default function ScanPage() {
  const [ticketCode, setTicketCode] = useState("");
  const [result, setResult] = useState<null | { ok: boolean; message: string; ticket?: any }>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleScan(code: string) {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/tickets/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketCode: code.trim() }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, message: "Network error. Try again." });
    } finally {
      setLoading(false);
      setTicketCode("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#000" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6, textAlign: "center" }}>
          Door Scanner
        </h1>
        <p style={{ color: "#a1a1aa", textAlign: "center", marginBottom: 28, fontSize: "0.9rem" }}>
          Scan QR or enter ticket code manually
        </p>

        {/* Result */}
        {result && (
          <div style={{
            padding: 20, borderRadius: 14, marginBottom: 20, textAlign: "center",
            background: result.ok ? "#0a1a0a" : "#1a0a0a",
            border: `1px solid ${result.ok ? "#166534" : "#7f1d1d"}`,
          }}>
            <p style={{ fontSize: "2rem", marginBottom: 8 }}>{result.ok ? "✅" : "❌"}</p>
            <p style={{ fontWeight: 900, color: result.ok ? "#22c55e" : "#f87171", fontSize: "1.1rem" }}>
              {result.message}
            </p>
            {result.ticket && (
              <div style={{ marginTop: 12, color: "#a1a1aa", fontSize: "0.85rem", display: "grid", gap: 4 }}>
                <p>{result.ticket.buyer_name}</p>
                <p>{result.ticket.tier_name}</p>
              </div>
            )}
          </div>
        )}

        {/* Manual input */}
        <div style={{ display: "grid", gap: 10 }}>
          <input
            ref={inputRef}
            value={ticketCode}
            onChange={(e) => setTicketCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan(ticketCode)}
            placeholder="TKT-XXXXXXXX or scan QR"
            className="input"
            style={{ textAlign: "center", fontFamily: "monospace", fontSize: "1.1rem", letterSpacing: "0.06em" }}
            autoFocus
          />
          <button
            onClick={() => handleScan(ticketCode)}
            disabled={loading || !ticketCode.trim()}
            className="btn btn--primary btn--wide"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Checking..." : "Check In"}
          </button>
        </div>

        <p style={{ textAlign: "center", color: "#333", fontSize: "0.78rem", marginTop: 20 }}>
          Square Bidness Events · Door Staff Only
        </p>
      </div>
    </div>
  );
}
