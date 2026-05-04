import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Smash Courts Kuwait — Book a court in Salmiya";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0F766E, #0D5F58)",
          color: "white",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            opacity: 0.9,
            fontSize: "32px",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 9999,
              background: "white",
              color: "#0F766E",
              fontWeight: 800,
              fontSize: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            S
          </div>
          <span>Smash Courts Kuwait</span>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1.05,
            display: "flex",
          }}
        >
          Book Your Court. Play Today.
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 36,
            opacity: 0.9,
            display: "flex",
          }}
        >
          Padel · Tennis · Football · Salmiya · 8 AM – 11 PM
        </div>
      </div>
    ),
    size,
  );
}
