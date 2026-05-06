import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#050505",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
          }}
        >
          <span
            style={{
              fontSize: 70,
              color: "#d4af37",
              lineHeight: 1,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            ✂
          </span>
          <span
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: "#d4af37",
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              marginTop: -3,
            }}
          >
            SB
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
