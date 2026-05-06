import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#050505",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 120,
        }}
      >
        {/* Gold scissors blades top */}
        <span
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "#d4af37",
            fontFamily: "system-ui, sans-serif",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          SB
        </span>
      </div>
    ),
    { ...size }
  );
}
