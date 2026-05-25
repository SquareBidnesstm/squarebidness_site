"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✂️</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#666", fontSize: 15, margin: "0 0 28px" }}>
          An unexpected error occurred. Our team has been notified.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "12px 28px",
            background: "#d4af37",
            color: "#000",
            border: "none",
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
