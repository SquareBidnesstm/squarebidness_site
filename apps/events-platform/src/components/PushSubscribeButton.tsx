"use client";
import { useState, useEffect } from "react";

export default function PushSubscribeButton({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "subscribed" | "unsupported" | "denied">("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") setStatus("denied");
  }, []);

  async function subscribe() {
    if (!("serviceWorker" in navigator)) return;
    setStatus("loading");

    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus("denied"); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), orderId }),
      });

      setStatus("subscribed");
    } catch (err) {
      console.error("Push subscribe failed:", err);
      setStatus("idle");
    }
  }

  if (status === "unsupported" || status === "denied") return null;

  if (status === "subscribed") {
    return (
      <p style={{ color: "#22c55e", fontSize: "0.85rem", fontWeight: 700, textAlign: "center", marginTop: 12 }}>
        🔔 You'll get a reminder before the event
      </p>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={status === "loading"}
      style={{
        width: "100%", marginTop: 12, padding: "12px 0",
        background: "transparent", border: "1px solid #2a2a2d",
        borderRadius: 999, color: "#a1a1aa", fontWeight: 800,
        fontSize: "0.9rem", cursor: "pointer",
        opacity: status === "loading" ? 0.5 : 1,
      }}
    >
      {status === "loading" ? "Setting up…" : "🔔 Get day-of reminder"}
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
