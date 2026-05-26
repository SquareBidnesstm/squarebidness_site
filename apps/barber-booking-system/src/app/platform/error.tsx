"use client";

import { useEffect } from "react";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Platform Error]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050505",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
          Platform error
        </h2>
        <p style={{ color: "#666", fontSize: 14, margin: "0 0 20px" }}>
          Something went wrong in the platform dashboard.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "12px 24px",
            background: "#d4af37",
            color: "#000",
            border: "none",
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
