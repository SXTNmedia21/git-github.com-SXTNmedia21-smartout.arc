/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Immersive mode — full viewport voice session
   Nordic Split dark with drifting orbs + central visualizer
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ImmersiveView({ state = "listening", width = 1080, height = 620 }) {
  return (
    <div style={{
      position: "relative",
      width, height,
      borderRadius: 16,
      overflow: "hidden",
      background: "oklch(0.08 0.02 50)",
      color: "oklch(0.95 0.005 55)",
    }}>
      {/* Deep warm dark base */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 40%, oklch(0.22 0.06 40), oklch(0.06 0.015 50) 70%)",
      }} />

      {/* Two drifting orbs */}
      <div style={{
        position: "absolute",
        width: "70%", height: "70%",
        left: "-10%", top: "-15%",
        borderRadius: "50%",
        background: "radial-gradient(circle, oklch(0.45 0.18 40 / 0.35), transparent 60%)",
        filter: "blur(60px)",
        animation: "botsson-aurora 22s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute",
        width: "60%", height: "60%",
        right: "-15%", bottom: "-20%",
        borderRadius: "50%",
        background: "radial-gradient(circle, oklch(0.35 0.14 35 / 0.4), transparent 60%)",
        filter: "blur(80px)",
        animation: "botsson-aurora 28s ease-in-out infinite reverse",
      }} />

      {/* Noise overlay */}
      <div className="botsson-noise dark" />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 56,
        display: "flex", alignItems: "center", gap: 14,
        padding: "0 28px",
        zIndex: 3,
      }}>
        <EmmaOrb size={28} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Emma</span>
          <span style={{ fontSize: 10, color: "oklch(1 0 0 / 0.5)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>STEMMESESJON · 03:42</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(1 0 0 / 0.5)", padding: "4px 10px", borderRadius: 999, border: "1px solid oklch(1 0 0 / 0.15)" }}>IMMERSIVE</span>
        <button style={{ width: 32, height: 32, borderRadius: 8, background: "oklch(1 0 0 / 0.06)", border: "1px solid oklch(1 0 0 / 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "oklch(1 0 0 / 0.7)", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>
        </button>
      </div>

      {/* The mega orb */}
      <div style={{
        position: "absolute",
        left: "50%", top: "45%", transform: "translate(-50%, -50%)",
        width: 360, height: 360,
      }}>
        {/* Ring 1 — huge conic */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "conic-gradient(from 0deg, transparent, oklch(0.65 0.22 40 / 0.55), transparent 65%)",
          animation: "botsson-orb-ring-slow 10s linear infinite",
          maskImage: "radial-gradient(circle, transparent 58%, black 62%, black 82%, transparent 86%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, black 62%, black 82%, transparent 86%)",
        }} />
        {/* Ring 2 */}
        <div style={{
          position: "absolute", inset: "15%", borderRadius: "50%",
          border: "1.5px solid oklch(0.65 0.22 40 / 0.55)",
          animation: state === "speaking" ? "botsson-orb-ring-reverse 6s linear infinite, botsson-orb-speak-pulse 1.2s ease-in-out infinite" : "botsson-orb-ring-reverse 14s linear infinite",
        }} />
        {/* Glow ring */}
        <div style={{
          position: "absolute", inset: "28%", borderRadius: "50%",
          background: "radial-gradient(circle, oklch(0.65 0.22 40 / 0.5), transparent 75%)",
          filter: "blur(16px)",
          animation: "botsson-orb-listen 3s ease-in-out infinite",
        }} />
        {/* Core */}
        <div style={{
          position: "absolute", inset: "38%", borderRadius: "50%",
          background: "radial-gradient(circle at 38% 34%, oklch(0.95 0.08 55), oklch(0.72 0.20 42) 45%, oklch(0.45 0.22 38))",
          boxShadow: "0 16px 80px oklch(0.65 0.22 40 / 0.7), inset 0 0 40px oklch(1 0 0 / 0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {state === "listening" && <span style={{ width: 44, height: 44, borderRadius: "50%", background: "oklch(1 0 0 / 0.75)" }} />}
          {state === "speaking" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <span key={i} style={{ width: 4, height: 40, borderRadius: 2, background: "white", transformOrigin: "center", animation: `botsson-waveform-${(i % 3) + 1} ${0.6 + i * 0.1}s ease-in-out infinite` }} />
              ))}
            </div>
          )}
        </div>

        {/* Outer particles */}
        {[...Array(16)].map((_, i) => {
          const deg = (i / 16) * 360;
          const rad = deg * Math.PI / 180;
          return (
            <span key={i} style={{
              position: "absolute", top: "50%", left: "50%",
              width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5,
              borderRadius: "50%",
              background: "oklch(0.72 0.19 42)",
              boxShadow: "0 0 8px oklch(0.72 0.19 42)",
              "--tx": `${Math.cos(rad) * 200}px`,
              "--ty": `${Math.sin(rad) * 200}px`,
              animation: `botsson-orb-particle ${1.8 + (i % 4) * 0.3}s ease-out ${i * 0.1}s infinite`,
            }} />
          );
        })}
      </div>

      {/* Live caption */}
      <div style={{
        position: "absolute",
        left: "50%", bottom: 120,
        transform: "translateX(-50%)",
        textAlign: "center",
        maxWidth: 640,
        fontFamily: "var(--font-heading)",
        fontStyle: "italic",
        fontSize: 28,
        lineHeight: 1.3,
        letterSpacing: "-0.01em",
        color: "oklch(0.98 0.01 55)",
        padding: "0 40px",
        zIndex: 3,
      }}>
        {state === "speaking" && "Greit. Jeg har sendt melding til Ida — hun svarer vanligvis innen 15 minutter."}
        {state === "listening" && <span style={{ color: "oklch(1 0 0 / 0.5)" }}>Lytter…</span>}
      </div>

      {/* Bottom controls */}
      <div style={{
        position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 14, alignItems: "center",
        padding: "10px 14px",
        borderRadius: 999,
        background: "oklch(1 0 0 / 0.06)",
        border: "1px solid oklch(1 0 0 / 0.1)",
        backdropFilter: "blur(20px)",
        zIndex: 3,
      }}>
        <button style={{ width: 42, height: 42, borderRadius: "50%", background: "oklch(1 0 0 / 0.08)", border: "1px solid oklch(1 0 0 / 0.12)", color: "oklch(1 0 0 / 0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
        </button>
        <button style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--brand-orange)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 28px oklch(0.65 0.22 40 / 0.7)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
        </button>
        <button style={{ width: 42, height: 42, borderRadius: "50%", background: "oklch(0.60 0.20 25 / 0.2)", border: "1px solid oklch(0.60 0.20 25 / 0.4)", color: "oklch(0.75 0.15 25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(135deg)" }}><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /></svg>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ImmersiveView });
