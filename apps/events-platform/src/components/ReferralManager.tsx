"use client";

import { useState } from "react";

interface ReferralEvent { id: string; title: string; slug: string }

export default function ReferralManager({
  events,
  baseUrl,
}: {
  events: ReferralEvent[];
  baseUrl: string;
}) {
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ code: string; link: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setCreated(null);
    const res = await fetch("/api/organizer/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, eventId: eventId || null }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed"); setLoading(false); return; }

    const ev = events.find(e => e.id === eventId);
    const link = ev
      ? `${baseUrl}/events/${ev.slug}?ref=${data.code.code}`
      : `${baseUrl}/?ref=${data.code.code}`;
    setCreated({ code: data.code.code, link });
    setName("");
    setEventId("");
    setLoading(false);
  }

  function copyLink() {
    if (!created) return;
    navigator.clipboard.writeText(created.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Create Referral Link
      </p>

      <form onSubmit={handleCreate} style={{ display: "grid", gap: 10 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Who's sharing? (e.g. DJ Marcus, Instagram Bio)"
          className="input"
          required
        />
        <select value={eventId} onChange={e => setEventId(e.target.value)} className="input">
          <option value="">All events (general link)</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.title}</option>
          ))}
        </select>
        {error && <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>{error}</p>}
        <button
          type="submit"
          className="btn btn--primary"
          disabled={loading || !name.trim()}
          style={{ minHeight: 44, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Creating…" : "Generate Link"}
        </button>
      </form>

      {created && (
        <div style={{ background: "#0a2a0a", border: "1px solid #166534", borderRadius: 10, padding: "14px 16px" }}>
          <p style={{ color: "#22c55e", fontWeight: 900, marginBottom: 6 }}>✓ Link created!</p>
          <p style={{ color: "#a1a1aa", fontSize: "0.78rem", fontFamily: "monospace", wordBreak: "break-all", marginBottom: 10 }}>
            {created.link}
          </p>
          <button
            onClick={copyLink}
            className="btn btn--ghost"
            style={{ minHeight: 36, fontSize: "0.82rem", padding: "0 16px" }}
          >
            {copied ? "✓ Copied!" : "Copy Link"}
          </button>
        </div>
      )}
    </div>
  );
}
