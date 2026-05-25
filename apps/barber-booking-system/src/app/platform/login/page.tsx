"use client";

import { useState } from "react";

export default function PlatformLoginPage() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.ok) {
        // Hard redirect so the browser sends the freshly-set cookie in the next request.
        window.location.href = "/platform";
      } else {
        setError(data.error || "Invalid PIN.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ color: "#d4af37", fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>
          SquareBidness
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4, textAlign: "center" }}>Platform Admin</h1>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 32, textAlign: "center" }}>Internal access only.</p>

        <form onSubmit={handleLogin} style={{ display: "grid", gap: 16 }}>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Platform PIN"
            autoFocus
            style={{
              width: "100%", padding: "14px", background: "#111", border: "1px solid #2a2a2a",
              color: "#fff", borderRadius: 10, fontSize: 18, outline: "none",
              textAlign: "center", letterSpacing: "0.2em",
            }}
          />
          {error && (
            <div style={{ padding: "12px", background: "#1a0a0a", border: "1px solid #440000", borderRadius: 8, color: "#ff7070", fontSize: 14, textAlign: "center" }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !pin}
            style={{
              padding: "14px", borderRadius: 10, border: "none", background: loading ? "#a88d20" : "#d4af37",
              color: "#000", fontWeight: 800, fontSize: 16, cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}
