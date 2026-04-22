/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Arena shell — 600×500 floating workspace
   Header, content slot, voice footer, FAB bloom
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ArenaShell({
  viewTitle = "Botsson",
  status = "connected",
  children,
  width = 600,
  height = 500,
  fabLeftOpen = false,
  fabRightOpen = false,
  fabLeftActive = "chat",
  fabRightActive = "history",
  showVoice = true,
  voiceState = "idle",
}) {
  return (
    <div style={{
      position: "relative",
      width, height,
      borderRadius: 16,
      background: "var(--card)",
      border: "1px solid var(--border)",
      boxShadow: "0 8px 40px -8px oklch(0.65 0.22 40 / 0.12), 0 2px 8px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      fontFamily: "var(--font-body)",
    }}>
      {/* noise texture */}
      <div className="botsson-noise" />

      {/* Header */}
      <ArenaHeader viewTitle={viewTitle} status={status} />

      {/* Active view slot */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        {children}
      </div>

      {/* Voice footer */}
      {showVoice && <VoiceFooter state={voiceState} />}

      {/* Left FAB — Create (+) */}
      <FAB side="left" open={fabLeftOpen} active={fabLeftActive} glyph="plus" items={[
        { id: "note",    icon: "note",    label: "Notat" },
        { id: "task",    icon: "check",   label: "Oppgave" },
        { id: "shift",   icon: "clock",   label: "Vakt" },
        { id: "booking", icon: "calendar", label: "Booking" },
      ]} />

      {/* Right FAB — Layers (context + tools) */}
      <FAB side="right" open={fabRightOpen} active={fabRightActive} glyph="layers" items={[
        { id: "voice",   icon: "waves",   label: "Stemme" },
        { id: "chat",    icon: "chat",    label: "Samtale" },
        { id: "memory",  icon: "brain",   label: "Minne" },
        { id: "history", icon: "history", label: "Historikk" },
      ]} />

      {/* Resize grip */}
      <ResizeGrip />
    </div>
  );
}

function ArenaHeader({ viewTitle, status }) {
  const statusText = {
    connected: "Tilkoblet",
    speaking: "Snakker",
    thinking: "Tenker…",
    listening: "Lytter",
    idle: "Ikke tilkoblet",
  }[status] || "Tilkoblet";

  const statusColor = {
    connected: "var(--success)",
    speaking: "var(--brand-orange)",
    thinking: "var(--info)",
    listening: "var(--brand-orange)",
    idle: "var(--muted-fg)",
  }[status] || "var(--muted-fg)";

  return (
    <div style={{
      height: 64,
      flexShrink: 0,
      display: "flex", alignItems: "center",
      gap: 12,
      padding: "0 16px",
      borderBottom: "1px solid var(--border)",
      cursor: "grab",
    }}>
      {/* Avatar with status dot */}
      <div style={{ position: "relative" }}>
        <EmmaOrb size={36} />
        <span style={{
          position: "absolute", bottom: 0, right: 0,
          width: 10, height: 10,
          borderRadius: "50%",
          background: statusColor,
          border: "2px solid var(--card)",
          animation: status === "speaking" ? "botsson-notify-throb 1.5s ease-in-out infinite" : "none",
        }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Emma</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-fg)" }}>Puls</span>
          {status === "speaking" && (
            <span style={{ display: "inline-flex", gap: 2, marginLeft: 4, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 2, height: 10, background: "var(--brand-orange)", borderRadius: 1,
                  animation: `botsson-bar 0.8s ease-in-out ${i * 0.07}s infinite`,
                  transformOrigin: "center",
                }} />
              ))}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--muted-fg)" }}>{statusText}</span>
      </div>

      <div style={{ flex: 1 }} />

      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.15em",
        textTransform: "uppercase", color: "var(--muted-fg)",
      }}>
        {viewTitle}
      </span>
      <button style={{
        width: 28, height: 28,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}

function VoiceFooter({ state = "idle" }) {
  return (
    <div style={{
      height: 68,
      flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 24,
      padding: "0 16px",
      borderTop: "1px solid var(--border)",
      position: "relative",
    }}>
      {/* Sleep button */}
      <button style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "1px solid var(--border)",
        background: "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: "var(--muted-fg)",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>

      {/* Central mic */}
      <button style={{
        width: 52, height: 52, borderRadius: "50%",
        background: state === "speaking" || state === "listening" ? "var(--brand-orange)" : "var(--brand-orange)",
        color: "white",
        border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 4px 16px oklch(0.65 0.22 40 / 0.45)",
        position: "relative",
      }}>
        {state === "listening" && (
          <span style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            border: "2px solid oklch(0.65 0.22 40 / 0.45)",
            animation: "botsson-breathe 2s ease-in-out infinite",
          }} />
        )}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>

      {/* Waveform mini */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, width: 56, justifyContent: "center" }}>
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} style={{
            width: 2.5,
            height: state === "speaking" ? 18 : 8,
            borderRadius: 1,
            background: state === "speaking" ? "var(--brand-orange)" : "var(--border)",
            transformOrigin: "center",
            animation: state === "speaking" ? `botsson-bar 0.8s ease-in-out ${i * 0.07}s infinite` : "none",
          }} />
        ))}
      </div>
    </div>
  );
}

/* FAB bloom — hugs the bottom border of the arena shell.
   Transparent at rest, pops on hover. Left = Create (+), Right = Layers (stack). */
function FAB({ side = "left", open = false, active = null, items = [], glyph = "plus" }) {
  const isLeft = side === "left";
  const [hover, setHover] = React.useState(false);
  const lit = open || hover;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        bottom: 50, // sits on the voice-footer border, half-protruding
        [isLeft ? "left" : "right"]: 14,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        zIndex: 5,
      }}
    >
      {/* Unfolded items */}
      {open && items.map((it, i) => (
        <button key={it.id} style={{
          width: 38, height: 38,
          borderRadius: "50%",
          background: active === it.id ? "var(--brand-orange)" : "var(--card)",
          color: active === it.id ? "white" : "var(--foreground)",
          border: active === it.id ? "none" : "1px solid var(--border)",
          boxShadow: active === it.id ? "0 4px 14px oklch(0.65 0.22 40 / 0.4)" : "0 2px 6px rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          animation: `botsson-pop-in 260ms ${i * 0.04}s cubic-bezier(0.34, 1.3, 0.64, 1) both`,
        }}>
          <FabIcon name={it.icon} size={17} />
        </button>
      ))}

      {/* Main trigger — transparent at rest, lit on hover/open, morphs to × when open */}
      <button style={{
        width: 42, height: 42,
        borderRadius: "50%",
        background: open
          ? "var(--foreground)"
          : hover
          ? "var(--card)"
          : "transparent",
        color: open
          ? "var(--background)"
          : lit
          ? "var(--foreground)"
          : "var(--muted-fg)",
        border: "1px solid " + (open ? "var(--foreground)" : lit ? "var(--border)" : "transparent"),
        opacity: lit ? 1 : 0.55,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        boxShadow: lit && !open ? "0 4px 14px rgba(0,0,0,0.10)" : open ? "0 4px 14px rgba(0,0,0,0.20)" : "none",
        transition: "background 180ms, color 180ms, opacity 180ms, border-color 180ms, box-shadow 180ms, transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        transform: open ? "rotate(45deg) scale(1)" : hover ? "scale(1.06)" : "scale(1)",
      }}>
        {open ? (
          /* Close × — achieved by rotating the plus 45deg */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ) : glyph === "plus" ? (
          /* Create (+) */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ) : (
          /* Layers — stacked diamonds */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 3 7.5 12 12l9-4.5L12 3z" />
            <path d="M3 12.5 12 17l9-4.5" />
            <path d="M3 17.5 12 22l9-4.5" />
          </svg>
        )}
      </button>
    </div>
  );
}

function FabIcon({ name, size = 18 }) {
  const sp = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    waves:   <svg {...sp}><path d="M2 12h2M6 6v12M10 9v6M14 4v16M18 9v6M22 12h-2" /></svg>,
    note:    <svg {...sp}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
    check:   <svg {...sp}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m7 11 3 3 7-7" /></svg>,
    calc:    <svg {...sp}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><circle cx="8" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="16" cy="12" r="1" /><circle cx="8" cy="16" r="1" /><circle cx="12" cy="16" r="1" /><circle cx="16" cy="16" r="1" /></svg>,
    clock:   <svg {...sp}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>,
    calendar:<svg {...sp}><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>,
    chat:    <svg {...sp}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    log:     <svg {...sp}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    brain:   <svg {...sp}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z" /><path d="M14.5 2a2.5 2.5 0 0 0-2.5 2.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z" /></svg>,
    history: <svg {...sp}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>,
  };
  return icons[name] || null;
}

function ResizeGrip() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{
      position: "absolute", right: 4, bottom: 4,
      opacity: 0.35,
      pointerEvents: "none",
    }}>
      <line x1="14" y1="6"  x2="6"  y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="14" y1="10" x2="10" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="14" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

Object.assign(window, { ArenaShell, ArenaHeader, VoiceFooter, FAB, FabIcon, ResizeGrip });
