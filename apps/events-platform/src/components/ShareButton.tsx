"use client";
import { useState } from "react";

export default function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 16px", borderRadius: 999, border: "1px solid #242427",
        background: "#0b0b0b", color: copied ? "#22c55e" : "#a1a1aa",
        fontSize: "0.82rem", fontWeight: 800, cursor: "pointer",
        transition: "color 0.15s",
      }}
    >
      {copied ? "✓ Copied!" : "↗ Share"}
    </button>
  );
}
