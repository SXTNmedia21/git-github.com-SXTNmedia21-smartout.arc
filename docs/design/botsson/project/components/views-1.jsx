/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Arena views — part 1
   visualizer, chat, notepad, tasks, calculator, settings
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ═══ 1. VISUALIZER — the 4 concentric ring voice orb ═══ */
function ViewVisualizer({ state = "idle" }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 20,
      background: "radial-gradient(ellipse at center top, oklch(0.99 0.01 60), var(--card))",
      overflow: "hidden",
    }}>
      {/* idle: aurora + glitter */}
      {state === "idle" && <IdleAmbient />}

      {/* 4 concentric layers */}
      <div style={{ position: "relative", width: 220, height: 220 }}>
        {/* Outer ring (200) conic halo */}
        <div style={{
          position: "absolute", inset: 10, borderRadius: "50%",
          background: "conic-gradient(from 0deg, transparent, oklch(0.65 0.22 40 / 0.6), transparent 70%)",
          animation: "botsson-orb-ring-slow 8s linear infinite",
          maskImage: "radial-gradient(circle, transparent 60%, black 64%, black 78%, transparent 82%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 60%, black 64%, black 78%, transparent 82%)",
        }} />

        {/* Middle ring (150) */}
        <div style={{
          position: "absolute", inset: 35, borderRadius: "50%",
          border: state === "thinking" ? "1.5px dashed oklch(0.65 0.22 40 / 0.55)" : "1.5px solid oklch(0.65 0.22 40 / 0.4)",
          animation: state === "thinking"
            ? "botsson-orb-think 3s linear infinite"
            : state === "speaking"
              ? "botsson-orb-ring-reverse 5s linear infinite, botsson-orb-speak-pulse 1.2s ease-in-out infinite"
              : "botsson-orb-ring-reverse 12s linear infinite",
        }} />

        {/* Inner glow ring (96) */}
        <div style={{
          position: "absolute", inset: 62, borderRadius: "50%",
          background: "radial-gradient(circle, oklch(0.65 0.22 40 / 0.35), transparent 70%)",
          animation: state === "listening" ? "botsson-orb-listen 3s ease-in-out infinite" : "none",
        }} />

        {/* Core (64) */}
        <div style={{
          position: "absolute", inset: 78, borderRadius: "50%",
          background: "radial-gradient(circle at 38% 34%, oklch(0.88 0.11 55), oklch(0.72 0.20 42) 45%, oklch(0.50 0.22 38))",
          boxShadow: "0 8px 32px oklch(0.65 0.22 40 / 0.55)",
          transform: state === "speaking" ? "scale(1.08)" : "scale(1)",
          transition: "transform 300ms var(--ease-primary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {/* Speaking bars inside core */}
          {state === "speaking" && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <span key={i} style={{
                  width: 3, height: 24,
                  borderRadius: 2,
                  background: "white",
                  transformOrigin: "center",
                  animation: `botsson-waveform-${(i % 3) + 1} ${0.6 + i * 0.1}s ease-in-out infinite`,
                }} />
              ))}
            </div>
          )}
          {/* Listening solid */}
          {state === "listening" && (
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "oklch(1 0 0 / 0.7)" }} />
          )}
          {/* Thinking dot */}
          {state === "thinking" && (
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "white", animation: "botsson-pulse 1.5s ease-in-out infinite" }} />
          )}
          {/* Idle: soft highlight */}
          {state === "idle" && (
            <span style={{ width: 50, height: 24, borderRadius: "50%", background: "oklch(1 0 0 / 0.3)", transform: "translate(-20px, -20px)", filter: "blur(2px)" }} />
          )}
        </div>

        {/* Speaking radial particles */}
        {state === "speaking" && [...Array(12)].map((_, i) => {
          const deg = (i / 12) * 360;
          const rad = deg * Math.PI / 180;
          return (
            <span key={i} style={{
              position: "absolute", top: "50%", left: "50%",
              width: 4, height: 4, marginLeft: -2, marginTop: -2,
              borderRadius: "50%",
              background: "oklch(0.65 0.22 40)",
              boxShadow: "0 0 6px oklch(0.65 0.22 40)",
              "--tx": `${Math.cos(rad) * 110}px`,
              "--ty": `${Math.sin(rad) * 110}px`,
              animation: `botsson-orb-particle ${1.2 + (i % 3) * 0.3}s ease-out ${i * 0.08}s infinite`,
            }} />
          );
        })}
      </div>

      {/* Live-text caption */}
      <div style={{
        maxWidth: 420,
        minHeight: 42,
        textAlign: "center",
        fontFamily: "var(--font-heading)",
        fontStyle: "italic",
        fontSize: 18,
        color: "var(--foreground)",
        lineHeight: 1.35,
        padding: "0 20px",
      }}>
        {state === "speaking" && "Skal jeg sende bekreftelse til Lars med en gang, eller venter vi til i morgen tidlig?"}
        {state === "listening" && <span style={{ color: "var(--muted-fg)" }}>Lytter…</span>}
        {state === "thinking" && <span style={{ color: "var(--muted-fg)" }}>Tenker…</span>}
        {state === "idle" && <span style={{ color: "var(--muted-fg)", opacity: 0.7 }}>Trykk mic for å snakke</span>}
      </div>
    </div>
  );
}

function IdleAmbient() {
  return (
    <>
      {/* Aurora */}
      <div style={{
        position: "absolute", inset: "-20%",
        background: "radial-gradient(ellipse at 30% 30%, oklch(0.65 0.22 40 / 0.15), transparent 50%), radial-gradient(ellipse at 70% 60%, oklch(0.65 0.18 85 / 0.12), transparent 50%)",
        animation: "botsson-aurora 20s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      {/* Glitter + skyfall */}
      {[...Array(14)].map((_, i) => {
        const x = (i * 73) % 100;
        const y = (i * 37) % 100;
        const isGlitter = i % 2 === 0;
        return (
          <span key={i} style={{
            position: "absolute",
            left: `${x}%`, top: `${y}%`,
            width: isGlitter ? 3 : 2, height: isGlitter ? 3 : 2,
            borderRadius: "50%",
            background: "oklch(0.65 0.22 40 / 0.8)",
            boxShadow: "0 0 4px oklch(0.65 0.22 40 / 0.6)",
            animation: isGlitter
              ? `botsson-glitter ${6 + (i % 5) * 2}s ease-in-out ${i * 0.3}s infinite`
              : `botsson-skyfall ${8 + (i % 4) * 2}s linear ${i * 0.5}s infinite`,
          }} />
        );
      })}
    </>
  );
}

/* ═══ 2. CHAT — transcription ═══ */
function ViewChat() {
  const messages = [
    { who: "emma", t: "Hei Sofia. Du har 12 ulest i admin-chat — én fra Lars om vakten i kveld. Vil du at jeg oppsummerer?" },
    { who: "you",  t: "Ja, gi meg kjapt." },
    { who: "emma", t: "Lars melder at han er syk, kan ikke ta vakten 17–23. Han har allerede prøvd Ida og Mikkel — begge opptatt." },
    { who: "emma", t: "Skal jeg sjekke hvem andre som er ledig, eller vil du ringe inn en vikar?", typing: true },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex",
            gap: 10,
            flexDirection: m.who === "you" ? "row-reverse" : "row",
            alignItems: "flex-end",
          }}>
            {m.who === "emma" && <EmmaOrb size={26} />}
            <div style={{
              maxWidth: "78%",
              padding: "10px 14px",
              borderRadius: m.who === "you" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: m.who === "you" ? "oklch(0.65 0.22 40 / 0.12)" : "var(--secondary)",
              border: "1px solid var(--border)",
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--foreground)",
            }}>
              {m.t}
              {m.typing && (
                <span style={{ display: "inline-flex", gap: 3, marginLeft: 6, verticalAlign: "middle" }}>
                  {[0, 1, 2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--muted-fg)", animation: `botsson-pulse 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{
          flex: 1,
          height: 40,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--background)",
          padding: "0 14px",
          display: "flex", alignItems: "center",
          fontSize: 13,
          color: "var(--muted-fg)",
        }}>
          Skriv en melding til Emma… <span style={{ fontSize: 10, marginLeft: "auto", color: "var(--muted-fg)" }}>Enter for å sende</span>
        </div>
        <button style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: "var(--brand-orange)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px oklch(0.65 0.22 40 / 0.4)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ═══ 3. NOTEPAD — markdown-aware with sidebar ═══ */
function ViewNotepad() {
  const notes = [
    { topic: "Teamlunsj 23. april", time: "I dag 12:10", tags: ["møte"], active: true },
    { topic: "Driftsplan Q2", time: "I går", tags: ["plan", "q2"] },
    { topic: "Innkjøp vin — Lagerberg", time: "20. apr", tags: ["innkjøp"] },
    { topic: "HMS-runde utsatt", time: "19. apr", tags: ["hms"] },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      {/* Sidebar */}
      <div style={{
        width: 160, flexShrink: 0,
        borderRight: "1px solid var(--border)",
        padding: 10,
        display: "flex", flexDirection: "column", gap: 6,
        overflowY: "auto",
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em", padding: "6px 8px 4px" }}>Notater</div>
        {notes.map((n, i) => (
          <div key={i} style={{
            padding: 10,
            borderRadius: 8,
            background: n.active ? "oklch(0.65 0.22 40 / 0.08)" : "transparent",
            border: n.active ? "1px solid oklch(0.65 0.22 40 / 0.25)" : "1px solid transparent",
            cursor: "pointer",
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--foreground)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.topic}</div>
            <div style={{ fontSize: 9.5, color: "var(--muted-fg)", marginBottom: 4 }}>{n.time}</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {n.tags.map(tag => <span key={tag} style={{ fontSize: 8.5, padding: "2px 6px", borderRadius: 999, background: "var(--secondary)", color: "var(--muted-fg)" }}>{tag}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 400, margin: 0, marginBottom: 4, letterSpacing: "-0.02em" }}>Teamlunsj 23. april</h2>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "var(--secondary)", color: "var(--muted-fg)" }}>møte</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "var(--secondary)", color: "var(--muted-fg)" }}>7 til stede</span>
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px" }}>Punkter</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li style={{ fontSize: 13, color: "var(--foreground)" }}>• Ny driftsplan godkjent av alle tilstede</li>
          <li style={{ fontSize: 13, color: "var(--foreground)" }}>• HMS-runde flyttes til <strong>tirsdag 14:00</strong></li>
          <li style={{ fontSize: 13, color: "var(--foreground)" }}>• <span style={{ color: "var(--brand-orange)", fontWeight: 600 }}>@sofia</span> tar innkjøp fra Lagerberg</li>
          <li style={{ fontSize: 13, color: "var(--foreground)" }}>• <span style={{ color: "var(--brand-orange)", fontWeight: 600 }}>@lars</span> oppdaterer vaktplan for uke 18</li>
        </ul>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px" }}>Oppgaver</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <CheckLine done label="Bestille nye uniformer" />
          <CheckLine label="Sende referat til teamet" />
          <CheckLine label="Oppdatere vaktplan uke 18" />
        </div>
      </div>
    </div>
  );
}

function CheckLine({ done, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span style={{
        width: 16, height: 16, borderRadius: 4,
        border: `1.5px solid ${done ? "var(--success)" : "var(--border)"}`,
        background: done ? "var(--success)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {done && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span style={{ color: done ? "var(--muted-fg)" : "var(--foreground)", textDecoration: done ? "line-through" : "none" }}>{label}</span>
    </div>
  );
}

/* ═══ 4. TASKS — priority pills + deadlines ═══ */
function ViewTasks() {
  const priorities = {
    urgent: { bg: "oklch(0.60 0.20 25 / 0.12)", fg: "var(--priority-urgent)", label: "Haster" },
    high:   { bg: "oklch(0.65 0.22 40 / 0.12)", fg: "var(--brand-orange)",    label: "Høy" },
    med:    { bg: "oklch(0.60 0.15 250 / 0.12)", fg: "var(--priority-normal)", label: "Medium" },
    low:    { bg: "var(--secondary)",            fg: "var(--muted-fg)",        label: "Lav" },
  };
  const tasks = [
    { t: "Ring Tine — melk til fredag", p: "urgent", due: "I dag 15:00" },
    { t: "Godkjenne vaktplan uke 18", p: "high", due: "I morgen" },
    { t: "Bestille nye uniformer", p: "med", due: "Denne uken" },
    { t: "Oppdatere HMS-rutiner", p: "low", due: "Q2" },
  ];
  const done = [
    { t: "HMS-sjekk fryser", p: "low" },
    { t: "Lage referat fra teamlunsj", p: "med" },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 20px", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em" }}>Aktive · 4</div>
        <button style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, border: "1px dashed var(--border)", background: "transparent", color: "var(--muted-fg)", cursor: "pointer" }}>+ Legg til</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map((task, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderLeft: `3px solid ${priorities[task.p].fg}`,
            borderRadius: 10,
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4,
              border: "1.5px solid var(--border)",
              flexShrink: 0,
            }} />
            <span style={{ flex: 1, fontSize: 13, color: "var(--foreground)" }}>{task.t}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "3px 8px", borderRadius: 999,
              background: priorities[task.p].bg, color: priorities[task.p].fg,
            }}>{priorities[task.p].label}</span>
            <span style={{ fontSize: 11, color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>{task.due}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.15em", margin: "20px 0 10px" }}>Ferdig · 2</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {done.map((task, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: "oklch(0.68 0.15 145 / 0.06)",
            borderLeft: "3px solid var(--success)",
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4,
              background: "var(--success)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--muted-fg)", textDecoration: "line-through" }}>{task.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ 5. CALCULATOR ═══ */
function ViewCalculator() {
  const buttons = [
    { l: "C", kind: "fn" }, { l: "%", kind: "fn" }, { l: "⌫", kind: "fn" }, { l: "÷", kind: "op" },
    { l: "7" }, { l: "8" }, { l: "9" }, { l: "×", kind: "op" },
    { l: "4" }, { l: "5" }, { l: "6" }, { l: "−", kind: "op" },
    { l: "1" }, { l: "2" }, { l: "3" }, { l: "+", kind: "op" },
    { l: "00" }, { l: "0" }, { l: "." }, { l: "=", kind: "eq" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 20px", display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>Kalkulator</div>
      <div style={{
        padding: "16px 18px",
        background: "var(--secondary)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        marginBottom: 14,
        textAlign: "right",
      }}>
        <div style={{ fontSize: 11, color: "var(--muted-fg)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>32 450 × 1.25</div>
        <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>40 562.50</div>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {buttons.map((b, i) => {
          const isOp = b.kind === "op", isEq = b.kind === "eq", isFn = b.kind === "fn";
          return (
            <button key={i} style={{
              fontSize: 15,
              fontFamily: "var(--font-mono)",
              fontWeight: isEq ? 700 : 500,
              borderRadius: 8,
              border: isOp || isEq || isFn ? "none" : "1px solid var(--border)",
              background: isEq ? "var(--brand-orange)" : isOp ? "oklch(0.65 0.22 40 / 0.12)" : isFn ? "var(--secondary)" : "var(--card)",
              color: isEq ? "white" : isOp ? "var(--brand-orange)" : "var(--foreground)",
              cursor: "pointer",
            }}>{b.l}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ 6. SETTINGS (75% expanded) ═══ */
function ViewSettings() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 200, borderRight: "1px solid var(--border)", padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em", padding: "4px 8px 8px" }}>Innstillinger</div>
        {["Persona", "Stemme", "Atferd", "Personvern", "Tastatur", "Om Botsson"].map((s, i) => (
          <div key={s} style={{
            padding: "8px 10px", borderRadius: 8, fontSize: 12.5,
            background: i === 0 ? "oklch(0.65 0.22 40 / 0.1)" : "transparent",
            color: i === 0 ? "var(--brand-orange)" : "var(--foreground)",
            fontWeight: i === 0 ? 600 : 400,
            cursor: "pointer",
          }}>{s}</div>
        ))}
      </div>

      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>Persona</h2>
        <p style={{ fontSize: 13, color: "var(--muted-fg)", marginTop: 4, marginBottom: 24 }}>Velg hvordan Emma skal opptre for deg.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
          {[
            { n: "Dagsjef", d: "Puls · Admin", t: 0.2, active: true },
            { n: "Mentor", d: "Saga · Manager", t: 0.4 },
            { n: "Nysgjerrig kollega", d: "Gnist · Employee", t: 0.7 },
            { n: "Trygg start", d: "Vakt · Trainee", t: 0.5 },
            { n: "Strategisk rådgiver", d: "Saga · Admin", t: 0.3 },
            { n: "Brannslukker", d: "Puls · Manager", t: 0.2 },
          ].map((p, i) => (
            <div key={i} style={{
              padding: 12, borderRadius: 10,
              background: p.active ? "oklch(0.65 0.22 40 / 0.08)" : "var(--card)",
              border: p.active ? "1.5px solid var(--brand-orange)" : "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{p.n}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted-fg)", marginBottom: 8 }}>{p.d}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>
                <span style={{ width: 40, height: 3, borderRadius: 2, background: "var(--secondary)", position: "relative", overflow: "hidden" }}>
                  <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${p.t * 100}%`, background: "var(--brand-orange)" }} />
                </span>
                t {p.t}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Blend — persona vs rank</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--muted-fg)" }}>Persona</span>
            <div style={{ flex: 1, position: "relative", height: 4, borderRadius: 2, background: "var(--secondary)" }}>
              <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "80%", background: "var(--brand-orange)", borderRadius: 2 }} />
              <span style={{ position: "absolute", left: "78%", top: "-6px", width: 16, height: 16, borderRadius: "50%", background: "var(--brand-orange)", boxShadow: "0 2px 6px oklch(0.65 0.22 40 / 0.5)" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--muted-fg)" }}>Rank</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--brand-orange)", minWidth: 20, textAlign: "right" }}>8</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ViewVisualizer, ViewChat, ViewNotepad, ViewTasks, ViewCalculator, ViewSettings, IdleAmbient, CheckLine });
