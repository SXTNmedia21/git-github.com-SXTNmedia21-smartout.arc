/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Sticky — 250×200 post-it with personality
   Modes: extended | retracted | hover (with voice controls)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function BotssonSticky({ mode = "extended", content = "speech", side = "right", unread = 0 }) {
  const isRight = side === "right";

  if (mode === "retracted") {
    return (
      <div style={{
        position: "relative",
        width: 32,
        height: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: isRight ? "flex-end" : "flex-start",
      }}>
        {/* Vertical neon sliver */}
        <span style={{
          position: "absolute",
          [isRight ? "right" : "left"]: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 3, height: 28,
          borderRadius: 2,
          background: "var(--brand-orange)",
          color: "var(--brand-orange)",
          animation: "botsson-neon-blink 2.5s ease-in-out infinite",
        }} />
        {unread > 0 && (
          <span style={{
            position: "absolute",
            [isRight ? "right" : "left"]: 10,
            top: "calc(50% - 30px)",
            width: 14, height: 14,
            borderRadius: "50%",
            background: "var(--brand-orange)",
            color: "white",
            fontSize: 8,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 2px var(--background), 0 2px 6px oklch(0.65 0.22 40 / 0.5)",
          }}>{unread}</span>
        )}
      </div>
    );
  }

  // Extended
  return (
    <div style={{
      position: "relative",
      width: 250, height: 200,
      borderRadius: 12,
      background: "var(--card)",
      border: "1px solid var(--border)",
      boxShadow: content === "live" ? "0 4px 24px -4px oklch(0.65 0.22 40 / 0.25)" : "0 4px 20px -4px rgba(0,0,0,0.1)",
      padding: 14,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Mini header: avatar + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <EmmaOrb size={22} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>Emma</span>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted-fg)", marginLeft: "auto" }}>
          {content === "live" ? "Snakker" : content === "tasks" ? "Oppgaver" : content === "note" ? "Notat" : content === "chat" ? "Chat" : "Ledig"}
        </span>
      </div>

      {/* Content by type */}
      {content === "live" && (
        <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: "var(--foreground)", fontFamily: "var(--font-heading)", fontStyle: "italic" }}>
          <div style={{ opacity: 0.35 }}>— Skal jeg ta en rask telling på</div>
          <div style={{ opacity: 0.55 }}>kjølerommet før</div>
          <div style={{ opacity: 0.8 }}>vi går gjennom vaktene</div>
          <div style={{ opacity: 1, display: "flex", alignItems: "center", gap: 4 }}>
            i morgen
            <span style={{ display: "inline-block", width: 2, height: 12, background: "var(--brand-orange)", animation: "botsson-pulse 1s infinite" }} />
          </div>
        </div>
      )}

      {content === "tasks" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { t: "Ring inn til Tine — melk", d: false, p: "high" },
            { t: "Godkjenne vakter uke 18", d: false, p: "med" },
            { t: "HMS-sjekk fryser", d: true, p: "low" },
          ].map((task, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
              <span style={{
                width: 14, height: 14,
                borderRadius: 4,
                border: `1.5px solid ${task.d ? "var(--success)" : "var(--border)"}`,
                background: task.d ? "var(--success)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {task.d && <svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
              <span style={{
                width: 3, height: 10, borderRadius: 1,
                background: task.p === "high" ? "var(--brand-orange)" : task.p === "med" ? "var(--info)" : "var(--muted-fg)",
              }} />
              <span style={{
                color: task.d ? "var(--muted-fg)" : "var(--foreground)",
                textDecoration: task.d ? "line-through" : "none",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{task.t}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--muted-fg)", marginTop: 2 }}>+2 til</div>
        </div>
      )}

      {content === "note" && (
        <div style={{ flex: 1, fontSize: 11, color: "var(--foreground)", lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Teamlunsj 23. april</div>
          <div style={{ fontSize: 10, color: "var(--muted-fg)", marginBottom: 8 }}>7 til stede</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <li>— Ny driftsplan godkjent</li>
            <li>— Flytte HMS til tirsdag</li>
            <li>— <span style={{ color: "var(--brand-orange)", fontWeight: 600 }}>@sofia</span> tar innkjøp</li>
          </ul>
        </div>
      )}

      {content === "chat" && (
        <div style={{ flex: 1, fontSize: 11, color: "var(--foreground)", lineHeight: 1.5 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Emma</div>
          <div>Du har tre vakter som mangler bekreftelse for neste uke. Skal jeg sende påminnelse til Lars, Ida og Mikkel?</div>
        </div>
      )}

      {content === "empty" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-heading)", fontSize: 20, color: "var(--foreground)", opacity: 0.22 }}>
          Emma
        </div>
      )}

      {/* Voice mic in sticky corner (hover-spawned) */}
      {content === "hover" && (
        <>
          <div style={{ flex: 1, fontSize: 11, color: "var(--muted-fg)", lineHeight: 1.5 }}>
            Tilkoblet. Klar når du er.
          </div>
          <div style={{ position: "absolute", top: 14, [isRight ? "left" : "right"]: -20, display: "flex", flexDirection: "column", gap: 8 }}>
            <VoiceBubble icon="mic" active />
            <VoiceBubble icon="hangup" destructive />
          </div>
        </>
      )}

      {/* corner activity pulse */}
      {content === "live" && (
        <span style={{
          position: "absolute",
          top: 12, right: 12,
          width: 6, height: 6,
          borderRadius: "50%",
          background: "var(--brand-orange)",
          boxShadow: "0 0 0 0 oklch(0.65 0.22 40 / 0.5)",
          animation: "botsson-notify-throb 1.5s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}

function VoiceBubble({ icon, active = false, destructive = false }) {
  const bg = destructive ? "var(--card)" : active ? "var(--brand-orange)" : "var(--card)";
  const color = destructive ? "var(--destructive)" : active ? "white" : "var(--foreground)";
  const border = destructive ? "1.5px solid oklch(0.60 0.20 25 / 0.5)" : active ? "none" : "1px solid var(--border)";

  return (
    <div style={{
      width: 40, height: 40,
      borderRadius: "50%",
      background: bg,
      color,
      border,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: active ? "0 4px 12px oklch(0.65 0.22 40 / 0.35)" : "0 2px 6px rgba(0,0,0,0.08)",
      cursor: "pointer",
    }}>
      {icon === "mic" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
      {icon === "hangup" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" transform="rotate(135 12 12)" />
        </svg>
      )}
    </div>
  );
}

Object.assign(window, { BotssonSticky, VoiceBubble });
