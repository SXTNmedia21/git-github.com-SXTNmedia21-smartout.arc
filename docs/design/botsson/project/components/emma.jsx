/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Emma — the identity glyph
   Living gradient orb with a breathing geometric mark
   Works at any size from 24px to 400px
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function EmmaAvatar({ size = 36, variant = "default", pulse = false, className = "", style = {} }) {
  // variant: default | ring | spark | wave | dark
  const id = React.useId();
  const core = `url(#${id}-core)`;
  const rim = `url(#${id}-rim)`;

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
        <defs>
          <radialGradient id={`${id}-core`} cx="38%" cy="34%" r="72%">
            <stop offset="0%"   stopColor="oklch(0.85 0.12 55)" />
            <stop offset="40%"  stopColor="oklch(0.72 0.19 42)" />
            <stop offset="100%" stopColor="oklch(0.52 0.20 38)" />
          </radialGradient>
          <radialGradient id={`${id}-rim`} cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="transparent" />
            <stop offset="100%" stopColor="oklch(0.45 0.18 38 / 0.4)" />
          </radialGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* Core gradient orb */}
        <circle cx="50" cy="50" r="48" fill={core} />
        {/* Inner depth */}
        <circle cx="50" cy="50" r="48" fill={rim} />

        {/* Glyph — a soft pulse-wave 'sigil': three arcs + center spark */}
        {variant !== "blank" && (
          <g
            stroke="oklch(1 0 0 / 0.85)"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            style={pulse ? { animation: "botsson-breathe 3s ease-in-out infinite" } : {}}
          >
            {/* Inner ring */}
            <circle cx="50" cy="50" r="14" strokeWidth="1.6" opacity="0.55" />
            {/* Arc top */}
            <path d="M 30 40 Q 50 26 70 40" opacity="0.9" />
            {/* Arc bottom */}
            <path d="M 30 60 Q 50 74 70 60" opacity="0.6" />
            {/* Center spark */}
            <circle cx="50" cy="50" r="2.6" fill="oklch(1 0 0 / 0.95)" stroke="none" filter={`url(#${id}-glow)`} />
          </g>
        )}

        {/* Highlight */}
        <ellipse cx="36" cy="28" rx="14" ry="8" fill="oklch(1 0 0 / 0.28)" />
      </svg>
    </div>
  );
}

/* Pure abstract variant — just the living gradient, no glyph */
function EmmaOrb({ size = 50, className = "", style = {} }) {
  const id = React.useId();
  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
        <defs>
          <radialGradient id={`${id}-c`} cx="38%" cy="34%" r="72%">
            <stop offset="0%"   stopColor="oklch(0.88 0.11 55)" />
            <stop offset="45%"  stopColor="oklch(0.72 0.20 42)" />
            <stop offset="100%" stopColor="oklch(0.50 0.22 38)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill={`url(#${id}-c)`} />
        <ellipse cx="36" cy="28" rx="14" ry="8" fill="oklch(1 0 0 / 0.32)" />
      </svg>
    </div>
  );
}

/* Small status dot — 8px with 2px border */
function StatusDot({ state = "idle", size = 10 }) {
  const colorMap = {
    idle: "var(--muted-fg)",
    connected: "oklch(0.68 0.15 145)",
    speaking: "var(--brand-orange)",
    thinking: "oklch(0.65 0.13 225)",
    error: "oklch(0.60 0.20 25)"
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: colorMap[state] || colorMap.idle,
        border: "2px solid var(--card)",
        boxShadow: state === "speaking" ? "0 0 0 0 oklch(0.65 0.22 40 / 0.4)" : "none",
        animation: state === "speaking" ? "botsson-notify-throb 1.8s ease-in-out infinite" : "none",
      }}
    />
  );
}

Object.assign(window, { EmmaAvatar, EmmaOrb, StatusDot });
