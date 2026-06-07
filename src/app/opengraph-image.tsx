import { ImageResponse } from "next/og";

// Social share card (Facebook, Twitter, …). Auto-detected by Next and exposed
// as og:image + twitter:image.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "VM 2026 — Tippebongen";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #0f1a2e 0%, #1d2e4c 100%)",
          color: "#f3f6fb",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#3b6fc0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            VM
          </div>
          <div style={{ fontSize: 30, letterSpacing: 6, color: "#9db6dd" }}>
            FOTBALL-VM 2026
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1 }}>Tippebongen</div>
          <div style={{ fontSize: 38, color: "#aebfd9" }}>
            Gruppespill · Sluttspill · Special bets
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <div style={{ height: 10, width: 140, borderRadius: 9, background: "#3b6fc0" }} />
          <div style={{ height: 10, width: 70, borderRadius: 9, background: "#d6a23c" }} />
          <div style={{ height: 10, width: 40, borderRadius: 9, background: "#4f9d6b" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
