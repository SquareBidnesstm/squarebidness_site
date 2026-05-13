"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NavLogo from "../../../components/NavLogo";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/organizer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setDone(true);
      setTimeout(() => router.push("/organizer/login"), 2500);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: 16 }}>❌</p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 950, marginBottom: 8 }}>Invalid link</h1>
        <p style={{ color: "#a1a1aa", marginBottom: 24 }}>This reset link is missing or invalid.</p>
        <Link href="/organizer/forgot-password" className="btn btn--primary">Request a new link</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: 16 }}>✅</p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 950, marginBottom: 8 }}>Password updated</h1>
        <p style={{ color: "#a1a1aa" }}>Redirecting to login…</p>
      </div>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6, textAlign: "center" }}>New password</h1>
      <p style={{ color: "#a1a1aa", textAlign: "center", marginBottom: 28, fontSize: "0.9rem" }}>Choose a strong password for your account.</p>

      {error && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: 14, padding: "8px 12px", background: "#1a0a0a", borderRadius: 8, border: "1px solid #7f1d1d" }}>{error}</p>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min 8 characters)"
          className="input"
          required
          minLength={8}
          autoFocus
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="input"
          required
        />
        <button type="submit" disabled={loading} className="btn btn--primary btn--wide" style={{ minHeight: 48, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Saving…" : "Set New Password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "center", height: 64, background: "#000" }}>
        <NavLogo />
      </nav>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <Suspense fallback={<p style={{ color: "#555", textAlign: "center" }}>Loading…</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
