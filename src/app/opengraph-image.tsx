import { ImageResponse } from "next/og";

// Social share card (Facebook, Twitter, …). Auto-detected by Next and exposed
// as og:image + twitter:image. Mirrors the app's Nordic login hero.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "VM 2026 — Tippebongen";

const chip = {
  display: "flex",
  alignItems: "center",
  padding: "12px 26px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.16)",
  fontSize: 27,
  color: "#dfe8f5",
};

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
          color: "#eef3fb",
          fontFamily: "sans-serif",
          background:
            "radial-gradient(120% 90% at 12% 8%, rgba(74,127,208,0.30), transparent 55%), linear-gradient(155deg, #0e1a2e 0%, #16243c 55%, #1b2c4a 100%)",
        }}
      >
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 20,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            VM
          </div>
          <div style={{ fontSize: 28, letterSpacing: 8, color: "#9db6dd" }}>FOTBALL-VM 2026</div>
        </div>

        {/* headline + feature pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 110, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
              Tippebongen
            </div>
            <div style={{ fontSize: 34, color: "#aebfd9" }}>
              VM-tippekonkurranse
            </div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={chip}>Gruppespill</div>
            <div style={chip}>Sluttspill</div>
            <div style={chip}>Special bets</div>
          </div>
        </div>

        {/* stat line */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 26, color: "#8fa6c8" }}>
          <span style={{ color: "#eef3fb", fontWeight: 600 }}>48</span>
          <span>lag</span>
          <div style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.3)" }} />
          <span style={{ color: "#eef3fb", fontWeight: 600 }}>104</span>
          <span>kamper</span>
          <div style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.3)" }} />
          <span>Live odds &amp; statistikk</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
