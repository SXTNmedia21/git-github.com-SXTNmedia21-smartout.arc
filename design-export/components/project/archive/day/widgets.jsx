// Day-info — 10 canonical widgets (web + mobile shared)
// Uses SO, Icon, Badge from primitives.jsx

const PHASE_STYLES = {
  upcoming:        { bg: "rgba(122,117,110,0.10)", fg: "#5a544c", dot: "#7a756e", label: "Starter snart" },
  active:          { bg: "rgba(17,173,50,0.10)",   fg: "#0a7a22", dot: "#11ad32", label: "Pågår",              pulse: true },
  pending_signoff: { bg: "rgba(193,130,0,0.12)",   fg: "#8a5d00", dot: "#c18200", label: "Venter på oppgjør" },
  closed:          { bg: "rgba(122,117,110,0.08)", fg: "#7a756e", dot: "#908a82", label: "Stengt" },
  missed:          { bg: "rgba(231,0,11,0.10)",    fg: "#9a000a", dot: "#e7000b", label: "Ikke åpnet" },
  locked:          { bg: "rgba(249,115,22,0.10)",  fg: "#c2410c", dot: "#f97316", label: "Låst" },
};

function PhaseBadge({ phase, size = "md" }) {
  const s = PHASE_STYLES[phase] || PHASE_STYLES.upcoming;
  const fs = size === "sm" ? 10 : 11;
  const pad = size === "sm" ? "3px 8px" : "4px 10px";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: pad, borderRadius: 9999,
      fontSize: fs, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
      background: s.bg, color: s.fg,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 9999, background: s.dot,
        animation: s.pulse ? "soPulse 1.8s ease-in-out infinite" : "none",
      }} />
      {s.label}
    </span>
  );
}

// 1. SessionHeader
function SessionHeader({ session, phase = "active", variant = "full", onClose }) {
  const elapsed = phase === "active" ? "3t 34m" : phase === "upcoming" ? "om 2t 28m" : phase === "pending_signoff" ? "siste ut 23:12" : "stengt";
  return (
    <div style={{ padding: variant === "full" ? 0 : 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: SO.muted, marginBottom: 6 }}>
            {session.relativeLabel} · {session.dept} · {session.location}
          </div>
          <div style={{ fontFamily: "Instrument Serif, serif", fontSize: variant === "full" ? 44 : 28, letterSpacing: "-0.02em", lineHeight: 1.02, color: SO.fg }}>
            {session.dayLong} {session.dayNum}. {session.month}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <PhaseBadge phase={phase} />
            <span style={{ fontSize: 13, color: SO.muted }}>
              <span style={{ fontFamily: "Geist Mono, monospace" }}>{session.plannedOpen}–{session.plannedClose}</span>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
              {phase === "upcoming" ? "Starter om 2t 28m" : phase === "missed" ? "Grace overskredet" : phase === "locked" ? "Låst 20. april" : <>Åpnet <span style={{ fontFamily: "Geist Mono, monospace" }}>{session.openedAt}</span> · {elapsed}</>}
            </span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", color: SO.muted }}>
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

// 2. PhaseTimeline
function PhaseTimeline({ hooks, phase = "active", density = "sparse", nowPct = 34, onHookClick }) {
  const hookColor = (h) => h.state === "completed" ? SO.success : h.state === "in_progress" ? SO.orange : SO.muted;
  const hookBg    = (h) => h.state === "completed" ? "rgba(17,173,50,0.12)" : h.state === "in_progress" ? "rgba(249,115,22,0.15)" : SO.secondary;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: SO.muted, marginBottom: 12 }}>
        <span>10:30</span>
        <span>Dagens forløp</span>
        <span>23:00</span>
      </div>
      <div style={{ position: "relative", height: 44 }}>
        <div style={{ position: "absolute", top: 20, left: 0, right: 0, height: 4, background: SO.secondary, borderRadius: 2 }} />
        <div style={{ position: "absolute", top: 20, left: 0, width: `${nowPct}%`, height: 4, background: SO.orange, borderRadius: 2 }} />
        {hooks.map((h, i) => {
          const pct = 4 + (i / (hooks.length - 1)) * 92;
          return (
            <div key={h.id} onClick={() => onHookClick && onHookClick(h)} style={{ position: "absolute", left: `${pct}%`, top: 0, transform: "translateX(-50%)", cursor: onHookClick ? "pointer" : "default" }}>
              <div style={{ textAlign: "center", fontSize: 10, fontFamily: "Geist Mono, monospace", color: SO.muted, marginBottom: 4 }}>{h.time}</div>
              <div style={{ width: 14, height: 14, borderRadius: 9999, background: hookBg(h), border: `2px solid ${hookColor(h)}`, margin: "0 auto", display: "grid", placeItems: "center" }}>
                {h.state === "completed" && <Icon name="check" size={8} color={SO.success} strokeWidth={3} />}
              </div>
            </div>
          );
        })}
        {/* now marker */}
        <div style={{ position: "absolute", left: `${nowPct}%`, top: -4, transform: "translateX(-50%)", height: 32 }}>
          <div style={{ width: 2, height: 32, background: SO.orange, borderRadius: 1 }} />
          <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: SO.orange, letterSpacing: "0.12em" }}>NÅ</div>
        </div>
      </div>
    </div>
  );
}

// 3. ShiftCard
function ShiftCard({ shift, variant = "default", onClick }) {
  const statusColor = shift.status === "active" ? SO.success : shift.status === "completed" ? SO.muted : SO.info;
  const statusLabel = shift.status === "active" ? (shift.break === "pause" ? "Pause" : "Aktiv") : shift.status === "completed" ? "Ferdig" : "Kommer";
  const deptColor = { kjokken: "#ee560c", sal: "#00ab93", bar: "#864ad2", event: "#c18200" }[shift.dept] || SO.muted;

  if (variant === "compact") {
    return (
      <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: SO.bg, border: `1px solid ${SO.border}`, cursor: onClick ? "pointer" : "default" }}>
        <div style={{ width: 3, height: 32, borderRadius: 2, background: deptColor }} />
        <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 13, fontWeight: 600, width: 90 }}>{shift.start}–{shift.end}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shift.name}</div>
          <div style={{ fontSize: 11, color: SO.muted }}>{shift.role}</div>
        </div>
        <span style={{ width: 6, height: 6, borderRadius: 9999, background: statusColor, animation: shift.live ? "soPulse 1.8s infinite" : "none" }} />
        <span style={{ fontSize: 11, color: statusColor, fontWeight: 600, width: 50, textAlign: "right" }}>{statusLabel}</span>
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{ padding: 16, borderRadius: 14, background: SO.bg, border: `1px solid ${SO.border}`, cursor: onClick ? "pointer" : "default", borderLeft: `3px solid ${deptColor}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 15, fontWeight: 600 }}>{shift.start} – {shift.end}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 9999, background: statusColor, animation: shift.live ? "soPulse 1.8s infinite" : "none" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>{statusLabel}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9999, background: SO.secondary, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, color: SO.fg }}>{shift.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{shift.name}{shift.isMe ? <span style={{ fontWeight: 500, color: SO.orange, fontSize: 11, marginLeft: 6 }}>(deg)</span> : null}</div>
          <div style={{ fontSize: 12, color: SO.muted }}>{shift.role}</div>
        </div>
        {variant === "detailed" && (
          <div style={{ textAlign: "right", fontFamily: "Geist Mono, monospace", fontSize: 11, color: SO.muted }}>
            <div>{shift.actual.toFixed(1)}t / {shift.planned.toFixed(1)}t</div>
          </div>
        )}
      </div>
    </div>
  );
}

// 4. TaskRow
function TaskRow({ task, onToggle }) {
  const done = task.done;
  const active = task.active;
  const overdue = task.overdue;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${SO.border}`, borderLeft: overdue ? `2px solid ${SO.error}` : "none", paddingLeft: overdue ? 8 : 0 }}>
      <button onClick={onToggle} style={{
        flexShrink: 0, width: 22, height: 22, borderRadius: 6, cursor: "pointer",
        border: `1.75px solid ${done ? SO.success : active ? SO.orange : SO.border}`,
        background: done ? SO.success : "transparent",
        display: "grid", placeItems: "center",
        boxShadow: active ? "0 0 0 3px rgba(249,115,22,0.15)" : "none",
      }}>
        {done && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: done ? SO.muted : SO.fg, textDecoration: done ? "line-through" : "none" }}>
          {task.title}
        </div>
        {task.note && <div style={{ fontSize: 11, color: SO.muted, marginTop: 2 }}>{task.note}</div>}
      </div>
      {task.compliance && <Icon name="shield" size={13} color={done ? SO.muted : SO.warning} />}
      {task.evidence && <span style={{ fontSize: 11, fontFamily: "Geist Mono, monospace", color: SO.muted }}>📷 {task.evidence}</span>}
      <span style={{ fontSize: 11, color: SO.muted, minWidth: 60, textAlign: "right" }}>{task.owner}</span>
    </div>
  );
}

// 5. HookTile
function HookTile({ hook, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const done = hook.state === "completed";
  const inProgress = hook.state === "in_progress";
  const typeLabel = { pre_open: "Pre-open", open: "Åpning", scheduled: "Rutine", pre_close: "Pre-close", close: "Stenging" }[hook.type] || hook.type;
  return (
    <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 32, height: 32, borderRadius: 9999, background: done ? "rgba(17,173,50,0.12)" : inProgress ? "rgba(249,115,22,0.14)" : SO.secondary, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {done ? <Icon name="check" size={14} color={SO.success} strokeWidth={2.5} /> :
           inProgress ? <Icon name="clock" size={14} color={SO.orange} /> :
           <Icon name="clock" size={14} color={SO.muted} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 13, fontWeight: 600 }}>{hook.time}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{hook.title}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: SO.muted, letterSpacing: "0.14em", textTransform: "uppercase", padding: "2px 6px", background: SO.secondary, borderRadius: 4 }}>{typeLabel}</span>
          </div>
        </div>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12, color: done ? SO.success : inProgress ? SO.orange : SO.muted, fontWeight: 600 }}>{hook.progress}</span>
        <Icon name="chevrondown" size={16} color={SO.muted} style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 200ms" }} />
      </button>
      {open && (
        <div style={{ padding: "0 16px 12px 60px" }}>
          {hook.tasks.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
    </div>
  );
}

// 6. KpiTile
function KpiTile({ tile, variant = "default" }) {
  const dir = tile.deltaDir;
  const deltaColor = dir === "up" ? SO.success : dir === "down" ? SO.warning : SO.muted;
  return (
    <div style={{ padding: variant === "compact" ? 14 : 18, borderRadius: 14, background: SO.bg, border: `1px solid ${SO.border}`, position: "relative", overflow: "hidden" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>{tile.label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: variant === "compact" ? 22 : 30, fontWeight: 900, letterSpacing: "-0.02em", color: SO.fg, fontVariantNumeric: "tabular-nums" }}>
          {tile.value}
        </span>
        <span style={{ fontSize: 13, color: SO.muted, fontWeight: 500 }}>{tile.unit}</span>
      </div>
      {tile.sub && (
        <div style={{ fontSize: 11, color: SO.muted, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          {tile.delta && (
            <span style={{ fontWeight: 600, color: deltaColor, fontFamily: "Geist Mono, monospace" }}>
              {tile.deltaDir === "up" ? "↗" : tile.deltaDir === "down" ? "↘" : "·"} {tile.delta}
            </span>
          )}
          <span>{tile.sub}</span>
        </div>
      )}
    </div>
  );
}

// 7. DeviationCard
function DeviationCard({ deviation, variant = "default" }) {
  const sevColor = { critical: SO.error, high: SO.error, medium: SO.warning, low: SO.info }[deviation.severity] || SO.muted;
  const open = deviation.status === "open";
  return (
    <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderLeft: `3px solid ${sevColor}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: sevColor, letterSpacing: "0.18em", textTransform: "uppercase" }}>AVVIK · {deviation.severity}</span>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: SO.muted }}>{deviation.time}</span>
        <div style={{ marginLeft: "auto" }}>
          {open ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: SO.warning, letterSpacing: "0.14em", textTransform: "uppercase", padding: "3px 8px", background: "rgba(193,130,0,0.12)", borderRadius: 9999 }}>● ÅPEN</span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: SO.success, letterSpacing: "0.14em", textTransform: "uppercase", padding: "3px 8px", background: "rgba(17,173,50,0.12)", borderRadius: 9999 }}>✓ LØST</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{deviation.title}</div>
      <div style={{ fontSize: 13, color: SO.muted, lineHeight: 1.5, marginBottom: 10 }}>{deviation.desc}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: SO.muted, flexWrap: "wrap" }}>
        <span>Rapportert av <strong style={{ color: SO.fg, fontWeight: 600 }}>{deviation.reporter}</strong></span>
        {deviation.photos > 0 && <span>📷 {deviation.photos} bilder</span>}
        <span>Tildelt {deviation.assignedTo}</span>
      </div>
      {variant !== "compact" && open && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={{ height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid ${SO.border}`, background: SO.bg, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Se detaljer</button>
          <button style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "none", background: SO.fg, color: SO.bg, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Marker som løst</button>
        </div>
      )}
    </div>
  );
}

// 8. BroadcastComposer
function BroadcastComposer() {
  const [type, setType] = React.useState("note");
  const [text, setText] = React.useState("");
  const types = [
    { key: "note", label: "Melding", color: SO.info },
    { key: "alert", label: "Alert", color: SO.warning },
    { key: "reminder", label: "Påminnelse", color: SO.muted },
  ];
  return (
    <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {types.map(t => (
          <button key={t.key} onClick={() => setType(t.key)} style={{
            height: 28, padding: "0 12px", borderRadius: 9999, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
            border: `1px solid ${type === t.key ? t.color : SO.border}`,
            background: type === t.key ? `${t.color}1a` : "transparent",
            color: type === t.key ? t.color : SO.muted, cursor: "pointer",
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Skriv til teamet…" style={{
          flex: 1, height: 40, padding: "0 14px", borderRadius: 10, border: `1px solid ${SO.border}`, background: SO.bg, fontSize: 14, outline: "none", fontFamily: "inherit",
        }} />
        <button style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: SO.orange, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="send" size={14} /> Send
        </button>
      </div>
    </div>
  );
}

// 9. SignoffPanel
function SignoffPanel({ summary, onConfirm }) {
  const [notes, setNotes] = React.useState("");
  return (
    <div style={{ background: "linear-gradient(180deg, rgba(193,130,0,0.06), transparent 60%)", border: `1px solid ${SO.border}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9999, background: "rgba(193,130,0,0.14)", display: "grid", placeItems: "center" }}>
          <Icon name="check" size={16} color={SO.warning} />
        </div>
        <div>
          <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 22, letterSpacing: "-0.01em" }}>Avslutt dagen</div>
          <div style={{ fontSize: 12, color: SO.muted }}>Gjennomgå og send til oppgjør</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <div><div style={{ fontSize: 10, color: SO.muted, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>Oppgaver</div><div style={{ fontFamily: "Geist Mono, monospace", fontSize: 16, fontWeight: 700, marginTop: 4 }}>22 / 25</div><div style={{ fontSize: 11, color: SO.warning, marginTop: 2 }}>3 uferdig</div></div>
        <div><div style={{ fontSize: 10, color: SO.muted, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>Åpne avvik</div><div style={{ fontFamily: "Geist Mono, monospace", fontSize: 16, fontWeight: 700, marginTop: 4 }}>1</div><div style={{ fontSize: 11, color: SO.muted, marginTop: 2 }}>Kjølerom temp</div></div>
        <div><div style={{ fontSize: 10, color: SO.muted, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>Siste ut</div><div style={{ fontFamily: "Geist Mono, monospace", fontSize: 16, fontWeight: 700, marginTop: 4 }}>23:12</div><div style={{ fontSize: 11, color: SO.muted, marginTop: 2 }}>Marcus Lien</div></div>
      </div>
      <div style={{ fontSize: 11, color: SO.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Notat til oppgjør</div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Valgfritt — kommentar til admin om dagen…" rows={2} style={{
        width: "100%", padding: 12, borderRadius: 10, border: `1px solid ${SO.border}`, background: SO.bg, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none",
      }} />
      <button onClick={onConfirm} style={{
        marginTop: 14, width: "100%", height: 48, borderRadius: 12, border: "none", background: SO.orange, color: "#fff",
        fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px rgba(249,115,22,0.28)",
      }}>Bekreft og send til oppgjør →</button>
    </div>
  );
}

// 10. ReconSummary
function ReconSummary({ data, onApprove }) {
  const { revenue = 87400, hours = 42.5, laborCost = 11900, marginVs = 3.2, phase = "pending_signoff" } = data || {};
  const rows = [
    { label: "Omsetning",   value: "87 400 kr", delta: "+4.0% mot mål",    dir: "up" },
    { label: "Arbeidstid",  value: "42.5 t",    delta: "+1.5t planlagt",   dir: "down" },
    { label: "Lønnskostnad",value: "11 900 kr", delta: "13.6% av omsetn.", dir: "up" },
    { label: "Margin vs mål",value: "+3.2%",    delta: "innenfor ramme",   dir: "up" },
  ];
  return (
    <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 22 }}>Oppgjør — 19. april</div>
          <div style={{ fontSize: 12, color: SO.muted, marginTop: 2 }}>Café Skuta · Kjøkken</div>
        </div>
        <PhaseBadge phase={phase} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: SO.border, border: `1px solid ${SO.border}`, borderRadius: 10, overflow: "hidden" }}>
        {rows.map(r => (
          <div key={r.label} style={{ background: SO.bg, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: SO.muted, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>{r.label}</div>
            <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{r.value}</div>
            <div style={{ fontSize: 11, color: r.dir === "up" ? SO.success : SO.warning, marginTop: 2, fontWeight: 500 }}>{r.dir === "up" ? "↗" : "↘"} {r.delta}</div>
          </div>
        ))}
      </div>
      {phase === "pending_signoff" && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button style={{ flex: 1, height: 42, borderRadius: 10, border: `1px solid ${SO.border}`, background: SO.bg, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Spør om revisjon</button>
          <button onClick={onApprove} style={{ flex: 1, height: 42, borderRadius: 10, border: "none", background: SO.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(249,115,22,0.28)" }}>Godkjenn oppgjør</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  PHASE_STYLES, PhaseBadge,
  SessionHeader, PhaseTimeline, ShiftCard, TaskRow, HookTile,
  KpiTile, DeviationCard, BroadcastComposer, SignoffPanel, ReconSummary,
});
