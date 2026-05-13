"use client";

import { useState } from "react";
import Link from "next/link";
import NavLogo from "../../../components/NavLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/organizer/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "center", height: 64, background: "#000" }}>
        <NavLogo />
      </nav>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "2.5rem", marginBottom: 16 }}>📧</p>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 950, marginBottom: 8 }}>Check your email</h1>
              <p style={{ color: "#a1a1aa", marginBottom: 24 }}>If an account exists for {email}, we sent a reset link. Check your inbox.</p>
              <Link href="/organizer/login" style={{ color: "#a1a1aa", fontSize: "0.9rem" }}>← Back to login</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6, textAlign: "center" }}>Reset password</h1>
              <p style={{ color: "#a1a1aa", textAlign: "center", marginBottom: 28, fontSize: "0.9rem" }}>Enter your email and we'll send a reset link.</p>

              {error && (
                <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: 14, padding: "8px 12px", background: "#1a0a0a", borderRadius: 8, border: "1px solid #7f1d1d" }}>{error}</p>
              )}

              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input"
                  required
                  autoFocus
                />
                <button type="submit" disabled={loading} className="btn btn--primary btn--wide" style={{ minHeight: 48, opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
              <p style={{ textAlign: "center", marginTop: 20, color: "#555", fontSize: "0.85rem" }}>
                <Link href="/organizer/login" style={{ color: "#a1a1aa" }}>← Back to login</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
