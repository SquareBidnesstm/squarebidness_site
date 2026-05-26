"use client";
import { useState } from "react";

export default function PushBlastButton({ eventId }: { eventId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [sent, setSent] = useState(0);
  const [errMsg, setErrMsg] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setStatus("loading");
    const res = await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, title, body }),
    });
    const data = await res.json();
    if (res.ok) {
      setSent(data.sent);
      setStatus("done");
    } else {
      setErrMsg(data.error ?? "Failed");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p style={{ color: "#22c55e", fontSize: "0.85rem", fontWeight: 800 }}>
        ✓ Push sent to {sent} subscriber{sent !== 1 ? "s" : ""}
      </p>
    );
  }

  return (
    <form onSubmit={send} style={{ display: "grid", gap: 10 }}>
      <input
        className="input"
        placeholder="Notification title (e.g. Doors open at 7pm!)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
      />
      <input
        className="input"
        placeholder="Body (optional)"
        value={body}
        onChange={e => setBody(e.target.value)}
      />
      {status === "error" && <p style={{ color: "#ef4444", fontSize: "0.82rem" }}>{errMsg}</p>}
      <button
        type="submit"
        className="btn btn--ghost"
        disabled={status === "loading" || !title.trim()}
        style={{ minHeight: 40, fontSize: "0.85rem" }}
      >
        {status === "loading" ? "Sending…" : "🔔 Send Push Notification"}
      </button>
    </form>
  );
}
