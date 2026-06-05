/* Remote control — state machine UI for running test scenarios.
 * Exposes: <Remote scenario={...} />
 * State machine: ready → running ⇆ paused → running → done
 *   REC toggles recording (independent orthogonal state)
 *   Screenshot is a one-shot that flashes the indicator
 */

const REMOTE_TOKENS = {
  // Pull from Smartout palette but define locally for clarity
  bg:         "#fdfcfa",
  surface:    "#ffffff",
  surfaceDim: "#f5f3f0",
  fg:         "#1c1814",
  muted:      "#7a756e",
  border:     "#e8e5e1",
  borderSoft: "#efece8",

  orange:     "#f97316",
  orangeSoft: "rgba(249,115,22,0.12)",
  purple:     "#8b5cf6",

  // State colors
  ready:      "#7a756e",  // muted / neutral
  running:    "#11ad32",  // success green — "live and healthy"
  paused:     "#c18200",  // amber
  done:       "#2784d5",  // info blue
  error:      "#e7000b",
  rec:        "#e7000b",  // classic record red

  eventBlue:  "#2784d5",
  eventGreen: "#11ad32",
  eventAmber: "#c18200",
  eventRed:   "#e7000b",
  eventMuted: "#7a756e",
};

const RT = REMOTE_TOKENS;

// ─── event icon/color palette ───────────────────────────────────────────────
const EVENT_META = {
  nav:    { color: RT.purple,      symbol: "→" },
  click:  { color: RT.orange,      symbol: "◉" },
  input:  { color: RT.orange,      symbol: "⌨" },
  net:    { color: RT.eventBlue,   symbol: "↔" },
  render: { color: RT.eventMuted,  symbol: "▢" },
  assert: { color: RT.eventGreen,  symbol: "✓" },
  ok:     { color: RT.eventGreen,  symbol: "●" },
  warn:   { color: RT.eventAmber,  symbol: "!" },
  error:  { color: RT.eventRed,    symbol: "✕" },
};

const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
};

// ─── State label + dot ──────────────────────────────────────────────────────
function StateBadge({ state, large }) {
  const conf = {
    ready:   { label: "Klar",    color: RT.ready,   pulse: false },
    running: { label: "Kjører",  color: RT.running, pulse: true  },
    paused:  { label: "Pauset",  color: RT.paused,  pulse: false },
    done:    { label: "Fullført",color: RT.done,    pulse: false },
    error:   { label: "Feilet",  color: RT.error,   pulse: false },
  }[state] || { label: state, color: RT.muted, pulse: false };

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: large ? "6px 14px 6px 10px" : "4px 10px 4px 8px",
      borderRadius: 999,
      background: `color-mix(in oklab, ${conf.color} 10%, transparent)`,
      border: `1px solid color-mix(in oklab, ${conf.color} 30%, transparent)`,
      color: conf.color,
      fontFamily: "Geist, sans-serif",
      fontSize: large ? 12 : 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    }}>
      <span style={{ position: "relative", width: large ? 8 : 7, height: large ? 8 : 7 }}>
        <span style={{
          position: "absolute", inset: 0, borderRadius: 999, background: conf.color,
        }} />
        {conf.pulse && (
          <span style={{
            position: "absolute", inset: -2, borderRadius: 999,
            background: conf.color, opacity: 0.35,
            animation: "remotePulse 1.4s ease-out infinite",
          }} />
        )}
      </span>
      {conf.label}
    </div>
  );
}

// ─── Round transport button (start/pause/…) ─────────────────────────────────
function TransportButton({ icon, label, onClick, variant = "default", size = 56, disabled }) {
  const styles = {
    default: { bg: RT.surface,  fg: RT.fg,      border: RT.border,     shadow: "0 1px 2px rgba(0,0,0,0.04)" },
    primary: { bg: RT.orange,   fg: "#fff",     border: RT.orange,     shadow: "0 4px 14px rgba(249,115,22,0.32)" },
    pause:   { bg: "#fff8ea",   fg: "#8f5f00",  border: "#f4d98a",     shadow: "0 1px 2px rgba(0,0,0,0.04)" },
    ghost:   { bg: "transparent", fg: RT.fg,    border: "transparent", shadow: "none" },
  }[variant];
  const [hover, setHover] = React.useState(false);

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      title={label}
      style={{
        width: size, height: size, borderRadius: size / 2,
        border: `1px solid ${styles.border}`,
        background: styles.bg, color: styles.fg,
        boxShadow: hover && !disabled ? "0 6px 20px rgba(0,0,0,0.12)" : styles.shadow,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 120ms ease, box-shadow 180ms ease",
        transform: hover && !disabled ? "translateY(-1px)" : "none",
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
}

// ─── Icons (inline SVG) ─────────────────────────────────────────────────────
const Icon = {
  play: (s=16, c="currentColor") => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M8 5.5v13L19 12 8 5.5z"/></svg>,
  pause: (s=16, c="currentColor") => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><rect x="7" y="5" width="3.5" height="14" rx="0.8"/><rect x="13.5" y="5" width="3.5" height="14" rx="0.8"/></svg>,
  stop: (s=14, c="currentColor") => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>,
  step: (s=14, c="currentColor") => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M6 5.5v13L15 12 6 5.5zM16.5 5h2v14h-2z"/></svg>,
  back: (s=14, c="currentColor") => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M5.5 5h2v14h-2zM18 5.5v13L9 12l9-6.5z"/></svg>,
  rec:  (s=10, c="currentColor") => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><circle cx="12" cy="12" r="7"/></svg>,
  cam:  (s=16, c="currentColor") => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.2"/></svg>,
  chev: (s=12, c="currentColor", rot=0) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rot}deg)`, transition: "transform 180ms" }}><polyline points="9 18 15 12 9 6"/></svg>,
  check:(s=12, c="currentColor") => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7"/></svg>,
  clock:(s=12, c="currentColor") => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round"/></svg>,
  dot:  (s=8, c="currentColor") => <svg width={s} height={s} viewBox="0 0 10 10" fill={c}><circle cx="5" cy="5" r="3.2"/></svg>,
};

Object.assign(window, { REMOTE_TOKENS, RT, EVENT_META, fmtTime, StateBadge, TransportButton, Icon });
