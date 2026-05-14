"use client";

import { useState } from "react";

type Props = {
  shopSlug: string;
  onClose: () => void;
};

const AUDIENCES = [
  { value: "all", label: "All clients (ever booked)" },
  { value: "upcoming", label: "Upcoming appointments" },
  { value: "recent_30", label: "Visited in last 30 days" },
  { value: "recent_90", label: "Visited in last 90 days" },
];

const MAX_CHARS = 1000;

export default function SmsBlastModal({ shopSlug, onClose }: Props) {
  const [audience, setAudience] = useState("all");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!message.trim()) { setError("Message is required."); return; }
    setSending(true);
    setError("");
    const res = await fetch(`/api/${shopSlug}/admin/sms-blast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, audience }),
    });
    const d = await res.json().catch(() => null);
    setSending(false);
    if (d?.ok) {
      setResult(d);
    } else {
      setError(d?.error || "Failed to send blast.");
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#0d0d0d", border: "1px solid #2d2d2d", borderRadius: 16,
          padding: 28, maxWidth: 480, width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontWeight: 900, fontSize: 20 }}>SMS Blast</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {result ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📲</div>
            <p style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Blast Sent!</p>
            <p style={{ color: "#5cd600", fontSize: 15 }}>{result.sent} sent successfully</p>
            {result.failed > 0 && (
              <p style={{ color: "#ff9955", fontSize: 14, marginTop: 4 }}>{result.failed} failed</p>
            )}
            <button
              onClick={onClose}
              style={{ marginTop: 20, padding: "12px 28px", borderRadius: 10, border: "none", background: "#d4af37", color: "#000", fontWeight: 800, cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 6 }}>Audience</span>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid #2d2d2d", background: "#111", color: "#fff", fontSize: 14,
                }}
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "block", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 6 }}>
                Message
                <span style={{ float: "right", color: message.length > MAX_CHARS * 0.9 ? "#ff9955" : "#555" }}>
                  {message.length}/{MAX_CHARS}
                </span>
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                rows={5}
                placeholder="Hey! We have open spots this week — book now at the link below."
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid #2d2d2d", background: "#111", color: "#fff",
                  fontSize: 14, resize: "vertical", boxSizing: "border-box",
                }}
              />
            </label>
            <p style={{ color: "#555", fontSize: 12, marginBottom: 18 }}>
              Your booking link will be appended automatically.
            </p>

            {error && (
              <p style={{ color: "#ff6060", fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}

            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: sending || !message.trim() ? "#333" : "#d4af37",
                color: sending || !message.trim() ? "#666" : "#000",
                fontWeight: 800, fontSize: 15, cursor: sending || !message.trim() ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "Sending…" : "Send SMS Blast"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
