/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Arena views — part 2
   log, memory, history, form, video, admin-chat
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ═══ LOG — tool calls + telemetry ═══ */
function ViewLog() {
  const logs = [
    { t: "12:04:22", type: "tool", title: "fetchShifts", args: "week=18, dept=all", ms: 142, ok: true },
    { t: "12:04:22", type: "tool", title: "summarize", args: "context=unread-chat", ms: 384, ok: true },
    { t: "12:04:18", type: "tele", title: "voice.partial", meta: "Lars kan ikke ta…", ms: 28 },
    { t: "12:04:15", type: "tool", title: "getUser", args: "id=lars-h", ms: 61, ok: true },
    { t: "12:04:10", type: "tele", title: "stt.final", meta: "gi meg kjapt", ms: 1124 },
    { t: "12:04:01", type: "tool", title: "listEmployees", args: "available=2026-04-22T17:00", ms: 72, ok: false },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", padding: "0 16px" }}>
        {["Tool Calls", "Telemetri"].map((t, i) => (
          <button key={t} style={{
            padding: "10px 14px",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
            border: "none", background: "transparent",
            color: i === 0 ? "var(--foreground)" : "var(--muted-fg)",
            borderBottom: i === 0 ? "2px solid var(--brand-orange)" : "2px solid transparent",
            cursor: "pointer",
          }}>{t}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        {logs.map((l, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "68px 60px 1fr 44px",
            gap: 8, alignItems: "center",
            padding: "6px 10px",
            borderRadius: 6,
            background: i === 0 ? "oklch(0.65 0.22 40 / 0.04)" : "transparent",
            borderLeft: `2px solid ${l.type === "tool" ? (l.ok ? "var(--success)" : "var(--destructive)") : "var(--info)"}`,
            marginBottom: 2,
          }}>
            <span style={{ color: "var(--muted-fg)" }}>{l.t}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "2px 6px", borderRadius: 4,
              background: l.type === "tool" ? "oklch(0.68 0.15 145 / 0.15)" : "oklch(0.65 0.13 225 / 0.15)",
              color: l.type === "tool" ? "var(--success)" : "var(--info)",
              textAlign: "center",
            }}>{l.type}</span>
            <span style={{ color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong style={{ color: l.ok === false ? "var(--destructive)" : "var(--foreground)" }}>{l.title}</strong>
              <span style={{ color: "var(--muted-fg)" }}>  {l.args || l.meta}</span>
            </span>
            <span style={{ color: "var(--muted-fg)", textAlign: "right" }}>{l.ms}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ MEMORY ═══ */
function ViewMemory() {
  const types = {
    pref:   { label: "Preferanse",  bg: "oklch(0.65 0.22 40 / 0.12)", fg: "var(--brand-orange)" },
    fakta:  { label: "Fakta",       bg: "oklch(0.65 0.13 225 / 0.12)", fg: "var(--info)" },
    inst:   { label: "Instruks",    bg: "oklch(0.55 0.20 300 / 0.12)", fg: "var(--brand-purple)" },
    rel:    { label: "Relasjon",    bg: "oklch(0.68 0.15 145 / 0.12)", fg: "var(--success)" },
    obs:    { label: "Observasjon", bg: "var(--secondary)", fg: "var(--muted-fg)" },
  };
  const mems = [
    { type: "pref", t: "Sofia foretrekker kortformat-oppsummering før kl 09", when: "2 dager siden" },
    { type: "fakta", t: "Åpningstider restaurant: tir–søn 15–23", when: "1 uke siden" },
    { type: "inst", t: "Aldri send vaktpåminnelse før kl 08 lokal tid", when: "3 dager siden" },
    { type: "rel", t: "Lars (bartender) og Ida (servitør) bytter ofte vakter seg imellom", when: "5 dager siden" },
    { type: "obs", t: "Tirsdager har systematisk lav bemanning i køkken", when: "I dag 09:14" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 20px", overflowY: "auto" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12 }}>5 minner · lagret lokalt</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mems.map((m, i) => (
          <div key={i} style={{
            padding: 12,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: 999,
                background: types[m.type].bg, color: types[m.type].fg,
              }}>{types[m.type].label}</span>
              <span style={{ fontSize: 10, color: "var(--muted-fg)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{m.when}</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: "var(--foreground)" }}>{m.t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ HISTORY ═══ */
function ViewHistory() {
  const sessions = [
    { day: "I dag", items: [{ t: "Vaktplanlegging uke 18", time: "12:04", n: 24 }, { t: "Innkjøpsliste Lagerberg", time: "09:22", n: 8 }] },
    { day: "I går", items: [{ t: "Sykemelding Lars — vikar?", time: "17:30", n: 12 }, { t: "HMS-gjennomgang", time: "14:00", n: 6 }] },
    { day: "Mandag 20. apr", items: [{ t: "Referat teamlunsj", time: "12:45", n: 18 }] },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 20px", overflowY: "auto" }}>
      {sessions.map((s, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted-fg)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>{s.day}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {s.items.map((it, j) => (
              <div key={j} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}>
                <EmmaOrb size={22} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.t}</div>
                  <div style={{ fontSize: 10, color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>{it.time} · {it.n} meldinger</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted-fg)" }}><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ FORM — designed placeholder, dynamic form Emma leads through ═══ */
function ViewForm() {
  return (
    <div style={{ position: "absolute", inset: 0, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--secondary)", overflow: "hidden" }}>
          <div style={{ width: "60%", height: "100%", background: "var(--brand-orange)" }} />
        </div>
        <span style={{ fontSize: 10, color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>3 / 5</span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <EmmaOrb size={28} />
        <div style={{
          flex: 1,
          padding: "10px 14px",
          background: "var(--secondary)",
          borderRadius: "14px 14px 14px 4px",
          border: "1px solid var(--border)",
          fontSize: 13.5, lineHeight: 1.5,
          fontFamily: "var(--font-heading)",
          fontStyle: "italic",
        }}>
          La oss registrere avviket. Hvilken avdeling gjelder det?
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {[
          { l: "Kjøkken", color: "var(--dept-kitchen)", active: true },
          { l: "Servering", color: "var(--dept-floor)" },
          { l: "Bar", color: "var(--dept-bar)" },
          { l: "Event", color: "var(--dept-event)" },
        ].map((d, i) => (
          <button key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 14px",
            background: d.active ? "oklch(0.65 0.22 40 / 0.08)" : "var(--card)",
            border: d.active ? `1.5px solid ${d.color}` : "1px solid var(--border)",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 13, fontWeight: 500,
            color: "var(--foreground)",
            textAlign: "left",
          }}>
            <span style={{ width: 3, height: 16, borderRadius: 1, background: d.color }} />
            {d.l}
            {d.active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={d.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}><path d="M20 6 9 17l-5-5" /></svg>}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", fontSize: 13, cursor: "pointer" }}>← Tilbake</button>
        <button style={{ flex: 2, height: 40, borderRadius: 10, border: "none", background: "var(--brand-orange)", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px oklch(0.65 0.22 40 / 0.35)" }}>Neste →</button>
      </div>
    </div>
  );
}

/* ═══ VIDEO — designed player ═══ */
function ViewVideo() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "oklch(0.12 0.015 50)" }}>
      {/* Video frame */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Fake frame content */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 30% 40%, oklch(0.30 0.08 40), oklch(0.10 0.02 50))",
        }} />
        {/* Hint of scene */}
        <div style={{
          position: "absolute", left: "50%", top: "42%", transform: "translate(-50%, -50%)",
          width: 160, height: 100, borderRadius: 10,
          background: "oklch(0.25 0.04 40 / 0.8)",
          border: "1px solid oklch(1 0 0 / 0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "oklch(1 0 0 / 0.3)", fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.2em",
        }}>SCENE · 00:42</div>

        {/* Play button */}
        <button style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          width: 72, height: 72, borderRadius: "50%",
          background: "oklch(1 0 0 / 0.95)",
          border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="black" style={{ marginLeft: 4 }}><polygon points="5 3 19 12 5 21 5 3" /></svg>
        </button>

        {/* Chapter overlay */}
        <div style={{
          position: "absolute", top: 16, left: 16,
          padding: "6px 12px",
          borderRadius: 999,
          background: "oklch(0 0 0 / 0.5)",
          border: "1px solid oklch(1 0 0 / 0.15)",
          color: "oklch(1 0 0 / 0.85)",
          fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase",
          backdropFilter: "blur(8px)",
        }}>Onboarding · Kapittel 3</div>
      </div>
      {/* Timeline */}
      <div style={{ padding: "12px 16px", background: "oklch(0.08 0.01 50)", borderTop: "1px solid oklch(1 0 0 / 0.06)" }}>
        <div style={{ color: "oklch(1 0 0 / 0.95)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Din første vakt — HMS-rutiner</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: "oklch(1 0 0 / 0.5)", fontFamily: "var(--font-mono)" }}>1:42</span>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: "oklch(1 0 0 / 0.15)", position: "relative" }}>
            <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "42%", background: "var(--brand-orange)", borderRadius: 2 }} />
            <span style={{ position: "absolute", left: "40%", top: -4, width: 11, height: 11, borderRadius: "50%", background: "var(--brand-orange)", boxShadow: "0 0 0 3px oklch(1 0 0 / 0.08)" }} />
          </div>
          <span style={{ fontSize: 10, color: "oklch(1 0 0 / 0.5)", fontFamily: "var(--font-mono)" }}>4:08</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ ADMIN-CHAT (typed assist, like screenshot) ═══ */
function ViewAdminChat() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: "var(--secondary)",
          border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--muted-fg)",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="12" rx="2" />
            <path d="M12 2v6M8 8h8" />
            <circle cx="9" cy="14" r="1" fill="currentColor" />
            <circle cx="15" cy="14" r="1" fill="currentColor" />
          </svg>
        </div>
        <div style={{ fontFamily: "var(--font-heading)", fontStyle: "italic", fontSize: 18, color: "var(--muted-fg)" }}>Hei. Hva trenger du hjelp med?</div>
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, minHeight: 40, padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--background)", fontSize: 13, color: "var(--muted-fg)" }}>
          Skriv en melding til Botsson… <span style={{ fontSize: 10, marginLeft: 6 }}>(Enter for å sende)</span>
        </div>
        <button style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--border)", background: "var(--secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-fg)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ViewLog, ViewMemory, ViewHistory, ViewForm, ViewVideo, ViewAdminChat });
