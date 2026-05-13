"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type ScanResult = {
  ok: boolean;
  message: string;
  ticket?: { buyer_name: string; tier_name: string };
};

export default function ScannerClient({
  eventId,
  eventTitle,
  eventDate,
  venueName,
}: {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
}) {
  const [ticketCode, setTicketCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScannedRef = useRef<string>("");
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHasBarcodeDetector("BarcodeDetector" in window);
    return () => {
      stopCamera();
    };
  }, []);

  const checkIn = useCallback(async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean || clean === lastScannedRef.current) return;
    lastScannedRef.current = clean;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/tickets/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketCode: clean }),
      });
      const data: ScanResult = await res.json();
      setResult(data);
      if (data.ok) setSessionCount((n) => n + 1);
    } catch {
      setResult({ ok: false, message: "Network error. Try again." });
    } finally {
      setLoading(false);
      setTicketCode("");

      // Clear result after 4s and allow re-scan
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = setTimeout(() => {
        setResult(null);
        lastScannedRef.current = "";
        if (!cameraActive) inputRef.current?.focus();
      }, 4000);
    }
  }, [cameraActive]);

  // Camera scanning loop
  const scanFrame = useCallback(async (detector: any) => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        try {
          const codes = await detector.detect(canvas);
          if (codes.length > 0) {
            const raw = codes[0].rawValue as string;
            if (raw && raw !== lastScannedRef.current) {
              await checkIn(raw);
            }
          }
        } catch {
          // detector may fail on some frames — ignore
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(() => scanFrame(detector));
  }, [checkIn]);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      setCameraActive(true);
      animFrameRef.current = requestAnimationFrame(() => scanFrame(detector));
    } catch (err: any) {
      setCameraError(err.message ?? "Camera access denied");
    }
  }

  function stopCamera() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const resultBg = result
    ? result.ok ? "#0a1a0a" : "#1a0a0a"
    : "transparent";
  const resultBorder = result
    ? result.ok ? "#166534" : "#7f1d1d"
    : "transparent";

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #111" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: "0.7rem", color: "#555", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Door Scanner</p>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 950, letterSpacing: "-0.03em", marginBottom: 2 }}>{eventTitle}</h1>
            <p style={{ color: "#a1a1aa", fontSize: "0.8rem" }}>{eventDate}{venueName ? ` · ${venueName}` : ""}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "0.7rem", color: "#555", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>Checked In</p>
            <p style={{ fontSize: "1.8rem", fontWeight: 950, color: "#22c55e", lineHeight: 1 }}>{sessionCount}</p>
            <p style={{ fontSize: "0.65rem", color: "#333" }}>this session</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto", width: "100%" }}>

        {/* Result banner */}
        {result && (
          <div style={{
            width: "100%", padding: "16px 20px", borderRadius: 14, marginBottom: 16,
            textAlign: "center", background: resultBg, border: `1px solid ${resultBorder}`,
            transition: "all 0.2s",
          }}>
            <p style={{ fontSize: "2rem", marginBottom: 6 }}>{result.ok ? "✅" : "❌"}</p>
            <p style={{ fontWeight: 900, color: result.ok ? "#22c55e" : "#f87171", fontSize: "1.15rem" }}>
              {result.message}
            </p>
            {result.ticket && (
              <div style={{ marginTop: 8, color: "#a1a1aa", fontSize: "0.85rem", display: "grid", gap: 2 }}>
                <p style={{ fontWeight: 700, color: "#fff" }}>{result.ticket.buyer_name}</p>
                <p>{result.ticket.tier_name}</p>
              </div>
            )}
          </div>
        )}

        {/* Camera viewfinder */}
        <div style={{
          width: "100%", aspectRatio: "1", borderRadius: 16, overflow: "hidden",
          position: "relative", background: "#0a0a0a", border: "1px solid #1d1d1f",
          marginBottom: 16, display: cameraActive ? "block" : "none",
        }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Corner brackets */}
          {["tl", "tr", "bl", "br"].map((pos) => (
            <div key={pos} style={{
              position: "absolute",
              top: pos.startsWith("t") ? 20 : undefined,
              bottom: pos.startsWith("b") ? 20 : undefined,
              left: pos.endsWith("l") ? 20 : undefined,
              right: pos.endsWith("r") ? 20 : undefined,
              width: 28, height: 28,
              borderTop: pos.startsWith("t") ? "3px solid #22c55e" : "none",
              borderBottom: pos.startsWith("b") ? "3px solid #22c55e" : "none",
              borderLeft: pos.endsWith("l") ? "3px solid #22c55e" : "none",
              borderRight: pos.endsWith("r") ? "3px solid #22c55e" : "none",
            }} />
          ))}
          <p style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", color: "#a1a1aa", fontSize: "0.75rem" }}>
            Point at QR code
          </p>
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Camera placeholder when off */}
        {!cameraActive && (
          <div style={{
            width: "100%", aspectRatio: "1", borderRadius: 16,
            background: "#050505", border: "1px dashed #1d1d1f",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            marginBottom: 16, gap: 8,
          }}>
            <p style={{ fontSize: "3rem" }}>📷</p>
            <p style={{ color: "#555", fontSize: "0.85rem" }}>Camera off</p>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: 12, textAlign: "center" }}>
            {cameraError}
          </p>
        )}

        {/* Camera toggle */}
        {hasBarcodeDetector && (
          <button
            onClick={cameraActive ? stopCamera : startCamera}
            className="btn btn--wide"
            style={{
              marginBottom: 16, minHeight: 48,
              background: cameraActive ? "#1a0a0a" : "#0a2a0a",
              border: `1px solid ${cameraActive ? "#7f1d1d" : "#166534"}`,
              color: cameraActive ? "#ef4444" : "#22c55e",
              fontWeight: 900, borderRadius: 12,
            }}
          >
            {cameraActive ? "⏹ Stop Camera" : "📷 Start Camera"}
          </button>
        )}

        {!hasBarcodeDetector && (
          <p style={{ color: "#555", fontSize: "0.78rem", textAlign: "center", marginBottom: 12 }}>
            Camera scanning not supported in this browser. Use manual entry below.
          </p>
        )}

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "#111" }} />
          <p style={{ color: "#333", fontSize: "0.75rem", fontWeight: 700 }}>OR ENTER MANUALLY</p>
          <div style={{ flex: 1, height: 1, background: "#111" }} />
        </div>

        {/* Manual input */}
        <div style={{ display: "grid", gap: 10, width: "100%" }}>
          <input
            ref={inputRef}
            value={ticketCode}
            onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && checkIn(ticketCode)}
            placeholder="TKT-XXXXXXXX"
            className="input"
            style={{ textAlign: "center", fontFamily: "monospace", fontSize: "1rem", letterSpacing: "0.06em" }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            onClick={() => checkIn(ticketCode)}
            disabled={loading || !ticketCode.trim()}
            className="btn btn--primary btn--wide"
            style={{ minHeight: 48, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Checking…" : "Check In"}
          </button>
        </div>

        <p style={{ textAlign: "center", color: "#222", fontSize: "0.75rem", marginTop: 24 }}>
          Square Bidness Events · Door Staff Only
        </p>
      </div>
    </div>
  );
}
