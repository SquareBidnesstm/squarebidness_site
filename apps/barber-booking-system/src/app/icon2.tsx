import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon2() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#050505",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        <span
          style={{
            fontSize: 200,
            color: "#d4af37",
            lineHeight: 1,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          ✂
        </span>
        <span
          style={{
            fontSize: 148,
            fontWeight: 900,
            color: "#d4af37",
            fontFamily: "system-ui, sans-serif",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            marginTop: -8,
          }}
        >
          SB
        </span>
      </div>
    ),
    { ...size }
  );
}
