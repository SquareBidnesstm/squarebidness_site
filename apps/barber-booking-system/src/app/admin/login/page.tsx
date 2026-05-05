"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Incorrect PIN.");
        setPin("");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          style={{
            color: "#d4af37",
            fontSize: 12,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginBottom: 10,
            textAlign: "center",
          }}
        >
          Dapper Lounge
        </div>

        <h1
          style={{
            fontSize: 36,
            fontWeight: 900,
            textAlign: "center",
            margin: "0 0 8px",
          }}
        >
          Admin Access
        </h1>

        <p
          style={{
            color: "#666",
            textAlign: "center",
            fontSize: 15,
            marginBottom: 32,
          }}
        >
          Enter your PIN to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            autoFocus
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 12,
              border: error ? "1px solid #553333" : "1px solid #2b2b2b",
              background: "#0d0d0d",
              color: "#ffffff",
              fontSize: 22,
              textAlign: "center",
              letterSpacing: "0.3em",
              outline: "none",
            }}
          />

          {error && (
            <div
              style={{
                color: "#ff7070",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !pin}
            style={{
              padding: "16px",
              borderRadius: 12,
              border: "none",
              background: loading || !pin ? "#7a6520" : "#d4af37",
              color: "#000000",
              fontWeight: 800,
              fontSize: 16,
              cursor: loading || !pin ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Checking..." : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}
