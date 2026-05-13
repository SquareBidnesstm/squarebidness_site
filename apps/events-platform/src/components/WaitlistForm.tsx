"use client";
import { useState } from "react";

export default function WaitlistForm({ eventId }: { eventId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, name, email }),
    });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <div style={{ background: "#0a1a0a", border: "1px solid #166534", borderRadius: 12, padding: "20px", textAlign: "center" }}>
        <p style={{ fontSize: "1.3rem", marginBottom: 6 }}>✓</p>
        <p style={{ fontWeight: 900, marginBottom: 4 }}>You're on the waitlist!</p>
        <p style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>We'll email you if a ticket opens up.</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#080808", border: "1px solid #1d1d1f", borderRadius: 14, padding: 20 }}>
      <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Sold Out — Join Waitlist</p>
      <p style={{ color: "#71717a", fontSize: "0.85rem", marginBottom: 16 }}>Get notified if a ticket becomes available.</p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          className="input"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
        <input
          className="input"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        {status === "error" && (
          <p style={{ color: "#ef4444", fontSize: "0.82rem" }}>Something went wrong. Try again.</p>
        )}
        <button type="submit" className="btn btn--primary btn--wide" disabled={status === "loading"}>
          {status === "loading" ? "Joining…" : "Notify Me"}
        </button>
      </form>
    </div>
  );
}
