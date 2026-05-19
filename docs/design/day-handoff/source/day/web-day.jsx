// Web Day Control Panel — tabbed interface for leders/admins
// Used inside an artboard on the design canvas AND as a standalone interactive prototype.

const TABS = [
  { key: "overview",    label: "Oversikt",     icon: "home" },
  { key: "timeline",    label: "Dagslinjen",   icon: "clock" },
  { key: "roster",      label: "Bemanning",    icon: "users" },
  { key: "tasks",       label: "Oppgaver",     icon: "check" },
  { key: "deviations",  label: "Avvik",        icon: "alert" },
  { key: "broadcast",   label: "Melding",      icon: "chat" },
  { key: "signoff",     label: "Oppgjør",      icon: "shield" },
];

function SubNav({ tab, setTab }) {
  return (
    <div style={{ display: "flex", gap: 2, padding: "0 0 0 0", borderBottom: `1px solid ${SO.border}` }}>
      {TABS.map(t => {
        const active = tab === t.key;
        return (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 16px",
            background: "transparent", border: "none", borderBottom: `2px solid ${active ? SO.orange : "transparent"}`,
            color: active ? SO.fg : SO.muted, fontSize: 13, fontWeight: active ? 600 : 500,
            cursor: "pointer", marginBottom: -1,
          }}>
            <Icon name={t.icon} size={14} color={active ? SO.orange : SO.muted} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function OverviewTab({ phase }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {DATA.KPIS.slice(0, 6).map(k => <KpiTile key={k.key} tile={k} variant="compact" />)}
        </div>
        <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 20 }}>Dagens forløp</div>
            <span style={{ fontSize: 11, color: SO.muted, fontFamily: "Geist Mono, monospace" }}>5 hooks · 2 ferdig</span>
          </div>
          <PhaseTimeline hooks={DATA.HOOKS} phase={phase} nowPct={34} />
        </div>
        <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Aktiv bemanning nå</div>
            <span style={{ fontSize: 11, color: SO.muted }}>{DATA.SHIFTS.filter(s => s.status === "active").length} på vakt</span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {DATA.SHIFTS.filter(s => s.status === "active").map(s => <ShiftCard key={s.id} shift={s} variant="compact" />)}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        {DATA.DEVIATIONS.filter(d => d.status === "open").map(d => <DeviationCard key={d.id} deviation={d} variant="compact" />)}
        <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Siste meldinger</div>
          <div style={{ display: "grid", gap: 12 }}>
            {DATA.BROADCASTS.slice(0, 3).map(b => (
              <div key={b.id} style={{ fontSize: 12, lineHeight: 1.4 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{b.title}</div>
                <div style={{ color: SO.muted, fontSize: 11 }}>{b.author} · {b.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ phase }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, padding: 20 }}>
        <PhaseTimeline hooks={DATA.HOOKS} phase={phase} nowPct={34} />
      </div>
      {DATA.HOOKS.map(h => <HookTile key={h.id} hook={h} defaultOpen={h.state === "in_progress"} />)}
    </div>
  );
}

function RosterTab() {
  const [dept, setDept] = React.useState("all");
  const filtered = dept === "all" ? DATA.SHIFTS : DATA.SHIFTS.filter(s => s.dept === dept);
  const depts = [
    { key: "all", label: "Alle", color: SO.muted },
    { key: "kjokken", label: "Kjøkken", color: "#ee560c" },
    { key: "sal", label: "Sal", color: "#00ab93" },
  ];
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {depts.map(d => (
          <button key={d.key} onClick={() => setDept(d.key)} style={{
            height: 30, padding: "0 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600,
            border: `1px solid ${dept === d.key ? d.color : SO.border}`,
            background: dept === d.key ? `${d.color}14` : "transparent",
            color: dept === d.key ? d.color : SO.muted, cursor: "pointer",
          }}>{d.label}</button>
        ))}
      </div>
      <div style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px 120px 100px", padding: "10px 16px", fontSize: 10, fontWeight: 600, color: SO.muted, letterSpacing: "0.12em", textTransform: "uppercase", background: SO.secondary, borderBottom: `1px solid ${SO.border}` }}>
          <span>Tid</span><span>Person</span><span>Planlagt</span><span>Faktisk</span><span>Status</span>
        </div>
        {filtered.map(s => {
          const statusColor = s.status === "active" ? SO.success : s.status === "completed" ? SO.muted : SO.info;
          const statusLabel = s.status === "active" ? (s.break === "pause" ? "Pause" : "Aktiv") : s.status === "completed" ? "Ferdig" : "Kommer";
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px 120px 100px", padding: "12px 16px", fontSize: 13, alignItems: "center", borderBottom: `1px solid ${SO.border}` }}>
              <span style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600 }}>{s.start}–{s.end}</span>
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: SO.muted }}>{s.role}</div>
              </div>
              <span style={{ fontFamily: "Geist Mono, monospace", color: SO.muted }}>{s.planned.toFixed(1)}t</span>
              <span style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600 }}>{s.actual.toFixed(1)}t</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: statusColor }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: statusColor, animation: s.live ? "soPulse 1.8s infinite" : "none" }} />
                {statusLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasksTab() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {DATA.HOOKS.map(h => <HookTile key={h.id} hook={h} defaultOpen={h.state !== "completed"} />)}
    </div>
  );
}

function DeviationsTab() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {DATA.DEVIATIONS.map(d => <DeviationCard key={d.id} deviation={d} />)}
    </div>
  );
}

function BroadcastTab() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <BroadcastComposer />
      <div style={{ display: "grid", gap: 10 }}>
        {DATA.BROADCASTS.map(b => {
          const color = b.type === "alert" ? SO.warning : b.type === "reminder" ? SO.muted : SO.info;
          return (
            <div key={b.id} style={{ background: SO.bg, border: `1px solid ${SO.border}`, borderLeft: `3px solid ${color}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: "0.16em", textTransform: "uppercase" }}>{b.type === "alert" ? "Alert" : b.type === "reminder" ? "Påminnelse" : "Melding"}</span>
                <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: SO.muted }}>{b.time}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{b.title}</div>
              <div style={{ fontSize: 13, color: SO.muted, marginBottom: 6 }}>{b.body}</div>
              <div style={{ fontSize: 11, color: SO.muted }}>{b.author} · {b.role}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SignoffTab({ phase }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <SignoffPanel />
      <ReconSummary data={{ phase }} />
    </div>
  );
}

function WebDayControl({ phase = "active", initialTab = "overview", height = 820, onClose }) {
  const [tab, setTab] = React.useState(initialTab);
  return (
    <div style={{ width: "100%", height, background: SO.secondary, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Geist, sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 24px", background: SO.bg, borderBottom: `1px solid ${SO.border}` }}>
        <Wordmark size={18} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: SO.muted }}>
          <Icon name="user" size={14} />
          Marcus Lien · Leder · Café Skuta
        </div>
      </div>
      {/* Session header */}
      <div style={{ padding: "22px 28px 18px", background: SO.bg, borderBottom: `1px solid ${SO.border}` }}>
        <SessionHeader session={DATA.SESSION} phase={phase} onClose={onClose} />
      </div>
      {/* Sub-nav */}
      <div style={{ padding: "0 28px", background: SO.bg, borderBottom: `1px solid ${SO.border}` }}>
        <SubNav tab={tab} setTab={setTab} />
      </div>
      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {tab === "overview"   && <OverviewTab phase={phase} />}
        {tab === "timeline"   && <TimelineTab phase={phase} />}
        {tab === "roster"     && <RosterTab />}
        {tab === "tasks"      && <TasksTab />}
        {tab === "deviations" && <DeviationsTab />}
        {tab === "broadcast"  && <BroadcastTab />}
        {tab === "signoff"    && <SignoffTab phase={phase} />}
      </div>
    </div>
  );
}

Object.assign(window, { WebDayControl, SubNav, OverviewTab, TimelineTab, RosterTab, TasksTab, DeviationsTab, BroadcastTab, SignoffTab });
