/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Orb — 50×50 the passive state
   States: idle | listening | thinking | speaking | notification
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function BotssonOrb({ state = "idle", unread = 0, notifyType = "task", size = 56, label = true }) {
  return (
    <div style={{ position: "relative", width: size + 40, height: size + 40, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {/* Ambient breath ring */}
      {state === "idle" && (
        <span
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: "50%",
            border: "2px solid oklch(0.65 0.22 40 / 0.4)",
            animation: "botsson-breathe 3s ease-in-out infinite",
          }}
        />
      )}

      {/* Listening: hollow breathing ring */}
      {state === "listening" && (
        <>
          <span style={{
            position: "absolute", width: size + 18, height: size + 18, borderRadius: "50%",
            border: "1.5px solid oklch(0.65 0.22 40 / 0.35)",
            animation: "botsson-breathe 2s ease-in-out infinite",
          }} />
        </>
      )}

      {/* Thinking: dashed outer ring */}
      {state === "thinking" && (
        <span style={{
          position: "absolute", width: size + 22, height: size + 22, borderRadius: "50%",
          border: "1.5px dashed oklch(0.65 0.22 40 / 0.55)",
          animation: "botsson-orb-think 3s linear infinite",
        }} />
      )}

      {/* Notification halo + ripples */}
      {state === "notification" && <NotificationLayer type={notifyType} size={size} />}

      {/* The orb itself */}
      <OrbCore state={state} size={size} notifyType={notifyType} />

      {/* Unread badge */}
      {unread > 0 && (
        <span style={{
          position: "absolute",
          top: 4, right: 4,
          minWidth: 18, height: 18,
          padding: "0 5px",
          borderRadius: 9,
          background: "var(--brand-orange)",
          color: "white",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid var(--background)",
          boxShadow: "0 2px 6px oklch(0.65 0.22 40 / 0.5)",
        }}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}

      {/* Label underneath */}
      {label && (
        <span style={{
          position: "absolute",
          bottom: -8,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--muted-fg)",
          fontFamily: "var(--font-body)",
          whiteSpace: "nowrap",
        }}>
          {state}
        </span>
      )}
    </div>
  );
}

function OrbCore({ state, size, notifyType }) {
  const isNotify = state === "notification";
  const isSpeaking = state === "speaking";
  const isThinking = state === "thinking";
  const isListening = state === "listening";

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        background: isNotify
          ? "radial-gradient(circle at 38% 34%, oklch(0.28 0.02 50), oklch(0.08 0.01 50))"
          : "radial-gradient(circle at 38% 34%, oklch(0.88 0.11 55), oklch(0.72 0.20 42) 45%, oklch(0.50 0.22 38))",
        boxShadow: isNotify
          ? "0 0 0 1px oklch(0.65 0.22 40 / 0.3), 0 4px 24px oklch(0.65 0.22 40 / 0.45)"
          : "0 4px 16px oklch(0.65 0.22 40 / 0.35)",
        animation: isNotify ? "botsson-notify-throb 2s ease-in-out infinite" : "none",
        cursor: "pointer",
        transition: "transform 200ms var(--ease-primary)",
      }}
    >
      {/* Highlight */}
      {!isNotify && (
        <span style={{
          position: "absolute",
          top: "14%", left: "22%",
          width: "40%", height: "24%",
          borderRadius: "50%",
          background: "oklch(1 0 0 / 0.32)",
          filter: "blur(1px)",
        }} />
      )}

      {/* Listening: solid inner */}
      {isListening && (
        <span style={{
          position: "absolute", inset: "28%",
          borderRadius: "50%",
          background: "oklch(1 0 0 / 0.85)",
        }} />
      )}

      {/* Thinking: small pulsing dot */}
      {isThinking && (
        <span style={{
          position: "absolute", top: "50%", left: "50%",
          width: 10, height: 10, marginLeft: -5, marginTop: -5,
          borderRadius: "50%",
          background: "white",
          animation: "botsson-pulse 1.5s ease-in-out infinite",
        }} />
      )}

      {/* Speaking: 5 waveform bars */}
      {isSpeaking && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 3,
        }}>
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} style={{
              width: 3,
              height: 18,
              borderRadius: 2,
              background: "white",
              transformOrigin: "center",
              animation: `botsson-bar 0.8s ease-in-out ${i * 0.07}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Notification center icon */}
      {isNotify && <NotifyIcon type={notifyType} />}
    </div>
  );
}

/* 5 notification variants */
function NotifyIcon({ type }) {
  const common = {
    position: "absolute", top: "50%", left: "50%",
    width: 24, height: 24, marginLeft: -12, marginTop: -12,
    color: "var(--brand-orange)",
    filter: "drop-shadow(0 0 6px oklch(0.65 0.22 40 / 0.8))",
  };
  const icons = {
    task: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={common}>
        <path d="M12 2a10 10 0 1 0 10 10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    mention: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 1 0 6 0v-1a10 10 0 1 0-4 8" />
      </svg>
    ),
    input: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={common}>
        <path d="M8 10h.01M12 10h.01M16 10h.01" />
        <path d="M21 12a9 9 0 1 1-4-7.5L21 3" />
      </svg>
    ),
    insight: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={common}>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
    error: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={common}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  };
  return icons[type] || icons.task;
}

function NotificationLayer({ type, size }) {
  const accentColor = {
    task: "oklch(0.65 0.22 40)",
    mention: "oklch(0.65 0.13 225)",
    input: "oklch(0.72 0.19 42)",
    insight: "oklch(0.68 0.18 85)",
    error: "oklch(0.60 0.20 25)",
  }[type] || "oklch(0.65 0.22 40)";

  return (
    <>
      {/* 3 ripple rings */}
      {[0, 0.8, 1.6].map((delay, i) => (
        <span key={i} style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: "50%",
          border: `1.5px solid ${accentColor}`,
          animation: `botsson-notify-ripple 2.4s ease-out ${delay}s infinite`,
        }} />
      ))}

      {/* Rotating conic halo */}
      <span style={{
        position: "absolute",
        width: size + 10,
        height: size + 10,
        borderRadius: "50%",
        background: `conic-gradient(from 0deg, transparent, ${accentColor}, transparent 60%)`,
        animation: "botsson-notify-rotate 3s linear infinite",
        opacity: 0.6,
        maskImage: "radial-gradient(circle, transparent 48%, black 52%)",
        WebkitMaskImage: "radial-gradient(circle, transparent 48%, black 52%)",
      }} />

      {/* 5 floating particles */}
      {[30, 110, 200, 280, 340].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const r = size / 2 + 14;
        const px = Math.cos(rad) * r;
        const py = Math.sin(rad) * r;
        return (
          <span key={i} style={{
            position: "absolute",
            width: 4, height: 4,
            borderRadius: "50%",
            background: accentColor,
            boxShadow: `0 0 6px ${accentColor}`,
            "--px": `${px}px`,
            "--py": `${py}px`,
            animation: `botsson-particle-float 2s ease-in-out ${i * 0.15}s infinite`,
          }} />
        );
      })}
    </>
  );
}

Object.assign(window, { BotssonOrb, OrbCore, NotifyIcon, NotificationLayer });
