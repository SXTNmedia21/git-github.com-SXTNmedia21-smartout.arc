/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Subagents — "Pågående arbeid"
   Dispatched subagents with status, next tasks, strategy chat
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ViewAgents() {
  const agents = [
    {
      id: "onboarding",
      name: "Onboarding-agent",
      scope: "Sigrid Bakke · ny servitør",
      persona: "Vakt · Trainee",
      status: "active",
      progress: 0.42,
      nextTask: "Gjennomgang av HMS-rutiner — tirsdag 14:00",
      step: "Dag 3 av 14",
      signal: "green",
    },
    {
      id: "training",
      name: "Opplæring-agent",
      scope: "Kjøkken · 4 personer",
      persona: "Saga · Manager",
      status: "waiting",
      progress: 0.68,
      nextTask: "Venter på godkjenning av modul 4",
      step: "Modul 4 / 6",
      signal: "amber",
      active: true,
    },
    {
      id: "rota",
      name: "Vaktplan-agent",
      scope: "Uke 18 · hele huset",
      persona: "Puls · Admin",
      status: "thinking",
      progress: 0.85,
      nextTask: "Leter etter vikar til bar-vakt torsdag kveld",
      step: "3 av 12 hull igjen",
      signal: "orange",
    },
    {
      id: "incident",
      name: "Avvik-agent",
      scope: "#2041 · fryser stopp",
      persona: "Vakt · Admin",
      status: "done",
      progress: 1,
      nextTask: "Ferdig — rapport sendt til Sofia",
      step: "Lukket",
      signal: "muted",
    },
  ];

  const activeAgent = agents.find(a => a.active) || agents[1];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      {/* Left: list of subagents */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: "1px solid var(--border)",
        padding: 12,
        display: "flex", flexDirection: "column", gap: 6,
        overflowY: "auto",
      }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.18em", padding: "4px 8px 6px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-orange)", boxShadow: "0 0 0 0 oklch(0.65 0.22 40 / 0.5)", animation: "botsson-notify-throb 1.8s ease-in-out infinite" }} />
          Pågående · 4
        </div>
        {agents.map(a => {
          const sig = {
            green:  "var(--success)",
            amber:  "var(--warning)",
            orange: "var(--brand-orange)",
            muted:  "var(--muted-fg)",
          }[a.signal];
          return (
            <div key={a.id} style={{
              padding: "10px 10px 10px 12px",
              borderRadius: 8,
              background: a.active ? "oklch(0.65 0.22 40 / 0.08)" : "transparent",
              border: a.active ? "1px solid oklch(0.65 0.22 40 / 0.3)" : "1px solid transparent",
              borderLeft: `3px solid ${sig}`,
              cursor: "pointer",
              position: "relative",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                {a.name}
                {a.status === "thinking" && (
                  <span style={{ display: "inline-flex", gap: 2 }}>
                    {[0, 1, 2].map(i => <span key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--brand-orange)", animation: `botsson-pulse 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted-fg)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.scope}</div>
              {/* Progress bar */}
              <div style={{ height: 3, borderRadius: 2, background: "var(--secondary)", position: "relative", overflow: "hidden" }}>
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${a.progress * 100}%`, background: sig, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 9, color: "var(--muted-fg)", marginTop: 5, fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>{a.step}</div>
            </div>
          );
        })}

        <button style={{
          marginTop: 6,
          padding: "8px 10px",
          fontSize: 11, fontWeight: 500,
          borderRadius: 8,
          border: "1px dashed var(--border)",
          background: "transparent",
          color: "var(--muted-fg)",
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" strokeDasharray="2 3" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          Dispatch subagent
        </button>
      </div>

      {/* Right: detail of active agent */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header card */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            {/* Agent glyph — small orb variant */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <EmmaOrb size={44} />
              <span style={{
                position: "absolute", bottom: -2, right: -2,
                width: 16, height: 16,
                borderRadius: "50%",
                background: "var(--warning)",
                border: "2px solid var(--card)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6v6l4 2" /></svg>
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>Opplæring-agent</h2>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: "oklch(0.75 0.15 75 / 0.15)", color: "var(--warning)" }}>Venter</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-fg)", marginTop: 2 }}>Kjøkken · 4 personer · Saga × Manager · blend 6</div>
            </div>
            <button style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-fg)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--secondary)", position: "relative", overflow: "hidden" }}>
              <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "68%", background: "var(--warning)", borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, color: "var(--muted-fg)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>Modul 4 av 6 · 68%</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Next tasks */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>Neste skritt</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { t: "Venter på Sofia — godkjenn modul 4: HMS på kjøkken", pending: true },
                { t: "Send oppsummering av modul 3 til Lars, Ida og Mikkel", pending: false },
                { t: "Planlegg quiz for modul 5 (neste uke)", pending: false },
              ].map((s, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  background: s.pending ? "oklch(0.75 0.15 75 / 0.08)" : "var(--card)",
                  border: s.pending ? "1px solid oklch(0.75 0.15 75 / 0.35)" : "1px solid var(--border)",
                  borderRadius: 10,
                }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: `1.5px solid ${s.pending ? "var(--warning)" : "var(--border)"}`,
                    background: "transparent",
                    flexShrink: 0,
                    position: "relative",
                  }}>
                    {s.pending && <span style={{ position: "absolute", inset: 3, borderRadius: "50%", background: "var(--warning)", animation: "botsson-pulse 1.8s ease-in-out infinite" }} />}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--foreground)" }}>{s.t}</span>
                  {s.pending && <button style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--warning)", color: "white", cursor: "pointer" }}>Godkjenn</button>}
                </div>
              ))}
            </div>
          </div>

          {/* Extra instructions */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>Ekstra instrukser · 3</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { t: "Fokus ekstra på allergener — Ida har notert noe.", when: "I går" },
                { t: "Ikke planlegg opplæring fredager (stor servering).", when: "3 dager siden" },
                { t: "Bruk mindre tekst, mer visuelt for Mikkel.", when: "1 uke siden" },
              ].map((ins, i) => (
                <div key={i} style={{
                  display: "flex", gap: 8,
                  padding: "8px 12px",
                  background: "var(--secondary)",
                  borderRadius: 8,
                  fontSize: 12, lineHeight: 1.45,
                  borderLeft: "2px solid var(--brand-orange)",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-orange)", flexShrink: 0, marginTop: 3 }}>
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span style={{ flex: 1, color: "var(--foreground)" }}>{ins.t}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-fg)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap", alignSelf: "flex-end" }}>{ins.when}</span>
                </div>
              ))}
              <button style={{
                padding: "8px 12px",
                fontSize: 11, fontWeight: 500,
                borderRadius: 8,
                border: "1px dashed var(--border)",
                background: "transparent",
                color: "var(--muted-fg)",
                cursor: "pointer",
                textAlign: "left",
              }}>+ Legg til instruks — Emma husker dette</button>
            </div>
          </div>

          {/* Team + strategy chat */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>Team under opplæring</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { name: "Lars", pct: 82, color: "oklch(0.72 0.14 180)" },
                { name: "Ida",  pct: 65, color: "oklch(0.75 0.16 85)" },
                { name: "Mikkel", pct: 44, color: "oklch(0.65 0.22 40)" },
                { name: "Sigrid", pct: 18, color: "oklch(0.60 0.15 250)" },
              ].map(p => (
                <div key={p.name} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px 6px 6px",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: p.color, color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                  }}>{p.name[0]}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 500 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>{p.pct}%</span>
                </div>
              ))}
            </div>

            {/* Strategy bubble from agent */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <EmmaOrb size={24} />
              <div style={{
                flex: 1,
                padding: "10px 14px",
                background: "var(--secondary)",
                border: "1px solid var(--border)",
                borderRadius: "12px 12px 12px 4px",
                fontSize: 12.5, lineHeight: 1.5,
              }}>
                Mikkel henger etter — han bommer på 3 av 5 allergen-spørsmål. Vil du at jeg <span style={{ color: "var(--brand-orange)", fontWeight: 600, borderBottom: "1px dashed var(--brand-orange)" }}>legger inn en 1:1-økt</span> med Lars som mentor før neste modul?
              </div>
            </div>

            {/* Input to talk strategy */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--background)",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted-fg)" }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span style={{ flex: 1, fontSize: 12, color: "var(--muted-fg)" }}>Diskuter ansatte eller juster strategi…</span>
              <span style={{ fontSize: 9, color: "var(--muted-fg)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>⌘ + ⏎</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ViewAgents });
