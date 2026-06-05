// Mobile Home — Before / During / After phase views
// Lives inside iOS frame; shows Anna Olsen (ansatt) perspective

function MobilePhaseHeader({ phase, shift }) {
  const s = PHASE_STYLES[phase];
  return (
    <div style={{ padding: "14px 20px 10px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: s.fg, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: 9999, background: s.dot, animation: s.pulse ? "soPulse 1.8s infinite" : "none" }} />
        {s.label}
      </div>
      <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 30, letterSpacing: "-0.02em", lineHeight: 1.02, color: SO.fg }}>
        God dag, Anna
      </div>
      <div style={{ fontSize: 12, color: SO.muted, marginTop: 2 }}>
        {shift ? <>Din vakt <span style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600 }}>{shift.start}–{shift.end}</span> · {shift.dept}</> : "Ingen vakt i dag"}
      </div>
    </div>
  );
}

function MobileWeekStrip({ onSelect, selectedDate }) {
  return (
    <div style={{ padding: "6px 16px 14px", display: "flex", gap: 6, overflowX: "auto" }}>
      {DATA.MY_WEEK.map(d => {
        const selected = d.date === selectedDate;
        const today = d.isToday;
        return (
          <button key={d.date} onClick={() => onSelect && onSelect(d.date)} style={{
            flexShrink: 0, width: 46, padding: "8px 0", borderRadius: 12, border: "none", cursor: "pointer", textAlign: "center",
            background: selected ? SO.fg : today ? "rgba(249,115,22,0.1)" : "transparent",
            color: selected ? SO.bg : SO.fg,
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em" }}>{d.dayShort}</div>
            <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 16, fontWeight: 700, marginTop: 2 }}>{d.dayNum}</div>
            <div style={{ width: 5, height: 5, borderRadius: 9999, background: d.hasShift ? (selected ? SO.orange : SO.orange) : "transparent", margin: "3px auto 0" }} />
          </button>
        );
      })}
    </div>
  );
}

// BEFORE — vakt ligger foran i tid
function MobileHomeBefore() {
  const shift = DATA.MY_WEEK.find(d => d.isToday);
  return (
    <div style={{ height: "100%", background: SO.secondary, overflowY: "auto", paddingBottom: 100 }}>
      <MobilePhaseHeader phase="upcoming" shift={shift} />
      <MobileWeekStrip selectedDate="2026-04-19" />
      <div style={{ padding: "0 16px", display: "grid", gap: 12 }}>
        <div style={{ background: SO.bg, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Din neste vakt</div>
          <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>15:00 – 23:00</div>
          <div style={{ fontSize: 13, color: SO.muted, marginTop: 2 }}>Starter om <strong style={{ color: SO.orange, fontWeight: 600 }}>2t 28m</strong></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "10px 12px", background: SO.secondary, borderRadius: 10 }}>
            <div style={{ width: 3, height: 28, borderRadius: 2, background: "#ee560c" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Café Skuta · Kjøkken</div>
              <div style={{ fontSize: 11, color: SO.muted }}>Rolle: Servitør · Sone B</div>
            </div>
          </div>
          <button style={{ width: "100%", marginTop: 12, height: 44, borderRadius: 12, border: `1px solid ${SO.border}`, background: SO.bg, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Se vaktdetaljer</button>
        </div>

        <div style={{ background: SO.bg, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Hvem er på i dag</div>
          <div style={{ display: "grid", gap: 10 }}>
            {DATA.SHIFTS.filter(s => s.status === "active" || (s.status === "upcoming" && !s.isMe)).slice(0, 4).map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9999, background: SO.secondary, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600 }}>{s.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: SO.muted }}>{s.role} · {s.start}–{s.end}</div>
                </div>
                {s.live && <span style={{ width: 6, height: 6, borderRadius: 9999, background: SO.success, animation: "soPulse 1.8s infinite" }} />}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: SO.bg, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Meldinger til teamet</div>
          {DATA.BROADCASTS.slice(0, 2).map(b => (
            <div key={b.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${SO.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{b.title}</div>
              <div style={{ fontSize: 11, color: SO.muted, marginTop: 3 }}>{b.body}</div>
              <div style={{ fontSize: 10, color: SO.muted, marginTop: 4 }}>{b.author} · {b.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// DURING — ansatt er på vakt akkurat nå
function MobileHomeDuring() {
  const ms = DATA.MY_SHIFT;
  const [elapsed, setElapsed] = React.useState(ms.elapsed);
  // Live ticker
  React.useEffect(() => {
    const start = Date.now() - 3 * 3600 * 1000 - 34 * 60 * 1000 - 15 * 1000;
    const i = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      setElapsed(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`);
    }, 1000);
    return () => clearInterval(i);
  }, []);
  const progressPct = Math.min(100, (ms.hoursSoFar / 8) * 100);
  return (
    <div style={{ height: "100%", background: SO.secondary, overflowY: "auto", paddingBottom: 100 }}>
      <MobilePhaseHeader phase="active" shift={{ start: "15:00", end: "23:00", dept: "Kjøkken" }} />
      {/* Big live timer */}
      <div style={{ margin: "4px 16px 14px", padding: 22, borderRadius: 20, background: `linear-gradient(160deg, ${SO.fg} 0%, #25201a 100%)`, color: SO.bg, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: 9999, background: "radial-gradient(circle, rgba(249,115,22,0.4), transparent 70%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: 9999, background: "#11ad32", animation: "soPulse 1.8s infinite" }} />
            Klokket inn
          </div>
          <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>
            {elapsed}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>Inn 14:58 · {ms.hoursSoFar}t av 8t</div>
          {/* progress */}
          <div style={{ marginTop: 14, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: SO.orange, borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12 }}>
            <div>
              <div style={{ opacity: 0.6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em" }}>Tjent</div>
              <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, marginTop: 3 }}>{ms.earned} kr</div>
            </div>
            <div>
              <div style={{ opacity: 0.6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em" }}>Pause</div>
              <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, marginTop: 3 }}>0 min</div>
            </div>
            <div>
              <div style={{ opacity: 0.6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em" }}>Tillegg</div>
              <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, marginTop: 3 }}>+{ms.bonus} kr</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: SO.bg, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ta pause</button>
            <button style={{ flex: 1, height: 40, borderRadius: 10, border: "none", background: SO.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Klokk ut</button>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px", display: "grid", gap: 12 }}>
        {/* Neste oppgave */}
        <div style={{ background: SO.bg, borderRadius: 18, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.14em", textTransform: "uppercase" }}>Neste oppgave</div>
            <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: SO.orange, fontWeight: 700 }}>kl 18:00</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Temperaturlogg kjøleskap</div>
          <div style={{ fontSize: 12, color: SO.muted, marginTop: 4 }}>Loggfør temp i alle tre skap · bilde kreves</div>
          <button style={{ marginTop: 12, width: "100%", height: 42, borderRadius: 10, border: "none", background: SO.fg, color: SO.bg, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Se alle oppgaver (3)</button>
        </div>

        {/* Kolleger på vakt */}
        <div style={{ background: SO.bg, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>På vakt nå</div>
          <div style={{ display: "grid", gap: 8 }}>
            {DATA.SHIFTS.filter(s => s.status === "active" && !s.isMe).map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9999, background: SO.secondary, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600 }}>{s.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: SO.muted }}>{s.role}{s.break === "pause" ? " · pause" : ""}</div>
                </div>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: s.break ? SO.warning : SO.success }} />
              </div>
            ))}
          </div>
        </div>

        {/* Kvikk-action */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button style={{ padding: 14, borderRadius: 14, border: "none", background: SO.bg, textAlign: "left", cursor: "pointer" }}>
            <Icon name="alert" size={18} color={SO.error} />
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>Rapportér avvik</div>
            <div style={{ fontSize: 11, color: SO.muted, marginTop: 2 }}>Hygiene, temp, HMS</div>
          </button>
          <button style={{ padding: 14, borderRadius: 14, border: "none", background: SO.bg, textAlign: "left", cursor: "pointer" }}>
            <Icon name="chat" size={18} color={SO.info} />
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>Meld til leder</div>
            <div style={{ fontSize: 11, color: SO.muted, marginTop: 2 }}>Marcus er på</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// AFTER — vakt ferdig, venter på oppgjør
function MobileHomeAfter() {
  return (
    <div style={{ height: "100%", background: SO.secondary, overflowY: "auto", paddingBottom: 100 }}>
      <MobilePhaseHeader phase="pending_signoff" shift={{ start: "15:00", end: "23:00", dept: "Kjøkken" }} />
      <div style={{ padding: "0 16px", display: "grid", gap: 12 }}>
        <div style={{ background: SO.bg, borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: SO.success, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="check" size={12} color={SO.success} strokeWidth={3} /> Vakten er ferdig
          </div>
          <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 26, letterSpacing: "-0.02em" }}>God jobb i dag.</div>
          <div style={{ fontSize: 13, color: SO.muted, marginTop: 4 }}>Du klokket ut 23:08.</div>
          <div style={{ marginTop: 16, padding: 14, background: SO.secondary, borderRadius: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><div style={{ fontSize: 10, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Timer</div><div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, marginTop: 3 }}>8.1t</div></div>
            <div><div style={{ fontSize: 10, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Lønn</div><div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, marginTop: 3 }}>2 065</div></div>
            <div><div style={{ fontSize: 10, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Tillegg</div><div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, marginTop: 3 }}>+58</div></div>
          </div>
        </div>

        <div style={{ background: "linear-gradient(180deg, rgba(193,130,0,0.08), transparent)", border: `1px solid ${SO.border}`, borderRadius: 18, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="clock" size={16} color={SO.warning} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Venter på oppgjør</div>
          </div>
          <div style={{ fontSize: 12, color: SO.muted, lineHeight: 1.5 }}>
            Marcus godkjenner dagen før timene låses. Du får varsel når oppgjøret er ferdig.
          </div>
        </div>

        <div style={{ background: SO.bg, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Neste vakt</div>
          <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 20, fontWeight: 700 }}>tirsdag 14:00 – 22:00</div>
          <div style={{ fontSize: 12, color: SO.muted, marginTop: 2 }}>Café Skuta · Bar · 14t fri</div>
        </div>
      </div>
    </div>
  );
}

function MobileTabBar({ active = "home" }) {
  const items = [
    { key: "home", label: "Hjem", icon: "home" },
    { key: "shifts", label: "Vakter", icon: "calendar" },
    { key: "tasks", label: "Oppgaver", icon: "check" },
    { key: "me", label: "Meg", icon: "user" },
  ];
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: SO.bg, borderTop: `1px solid ${SO.border}`, padding: "8px 0 26px", display: "flex", justifyContent: "space-around" }}>
      {items.map(i => (
        <button key={i.key} style={{ background: "transparent", border: "none", display: "grid", placeItems: "center", gap: 3, padding: "4px 10px", cursor: "pointer" }}>
          <Icon name={i.icon} size={20} color={active === i.key ? SO.orange : SO.muted} />
          <span style={{ fontSize: 10, fontWeight: 600, color: active === i.key ? SO.orange : SO.muted }}>{i.label}</span>
        </button>
      ))}
    </div>
  );
}

function MobileHomeFrame({ phase = "active" }) {
  return (
    <div style={{ position: "relative", height: "100%", background: SO.secondary, fontFamily: "Geist, sans-serif" }}>
      {/* iOS status bar */}
      <div style={{ height: 44, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: SO.fg }}>
        <span>14:32</span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <svg width="16" height="11" viewBox="0 0 16 11"><g fill={SO.fg}><rect x="0" y="7" width="3" height="4" rx="0.5"/><rect x="4" y="5" width="3" height="6" rx="0.5"/><rect x="8" y="3" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="11" rx="0.5"/></g></svg>
          <svg width="22" height="11" viewBox="0 0 22 11"><rect x="0.5" y="0.5" width="18" height="10" rx="2" fill="none" stroke={SO.fg} strokeWidth="1"/><rect x="2" y="2" width="15" height="7" rx="1" fill={SO.fg}/><rect x="19" y="3" width="2" height="5" rx="0.5" fill={SO.fg} opacity="0.5"/></svg>
        </div>
      </div>
      {/* Content */}
      <div style={{ position: "absolute", top: 44, bottom: 0, left: 0, right: 0 }}>
        {phase === "upcoming" && <MobileHomeBefore />}
        {phase === "active"   && <MobileHomeDuring />}
        {phase === "pending_signoff" && <MobileHomeAfter />}
        {phase === "closed"   && <MobileHomeAfter />}
      </div>
      <MobileTabBar />
    </div>
  );
}

Object.assign(window, { MobileHomeFrame, MobileHomeBefore, MobileHomeDuring, MobileHomeAfter });
