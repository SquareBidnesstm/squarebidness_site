"use client";

import { useState } from "react";

export default function EmailBlastForm({
  eventId,
  recipientCount,
}: {
  eventId: string;
  recipientCount: number;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sent?: number; error?: string } | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/organizer/events/email-blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error ?? "Failed to send" });
      else {
        setResult({ sent: data.sent });
        setSubject("");
        setMessage("");
      }
    } catch {
      setResult({ error: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  }

  if (recipientCount === 0) {
    return (
      <p style={{ color: "#555", fontSize: "0.9rem" }}>No paid attendees yet — nothing to blast.</p>
    );
  }

  return (
    <form onSubmit={handleSend} style={{ display: "grid", gap: 12 }}>
      <p style={{ color: "#a1a1aa", fontSize: "0.85rem", margin: 0 }}>
        Send an email to all <strong style={{ color: "#fff" }}>{recipientCount}</strong> paid attendee{recipientCount !== 1 ? "s" : ""}.
      </p>

      {result?.sent != null && (
        <div style={{ background: "#0a2a0a", border: "1px solid #166534", borderRadius: 8, padding: "10px 14px", color: "#22c55e", fontSize: "0.85rem" }}>
          ✓ Sent to {result.sent} attendee{result.sent !== 1 ? "s" : ""}.
        </div>
      )}
      {result?.error && (
        <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: "0.85rem" }}>
          {result.error}
        </div>
      )}

      <input
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="Subject line"
        className="input"
        required
        maxLength={200}
      />
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Your message to attendees..."
        className="input"
        required
        rows={5}
        maxLength={2000}
        style={{ resize: "vertical", lineHeight: 1.5 }}
      />
      <button
        type="submit"
        className="btn btn--primary"
        disabled={loading || !subject.trim() || !message.trim()}
        style={{ minHeight: 44, opacity: loading ? 0.6 : 1 }}
      >
        {loading ? "Sending…" : "Send Email Blast"}
      </button>
    </form>
  );
}
