// StatusPill — ikon + label + semantic color
const STATUS_META = {
  open:              { icon: "circle",         label: "Åpen",          cls: "status-open" },
  submitted:         { icon: "clock",          label: "Innsendt",      cls: "status-submitted" },
  awaiting_approval: { icon: "alertCircle",    label: "Venter",        cls: "status-awaiting" },
  approved:          { icon: "checkCircle",    label: "Godkjent",      cls: "status-approved" },
  locked:            { icon: "lock",           label: "Låst",          cls: "status-locked" },
  unreconciled:      { icon: "alertTriangle",  label: "Ikke avstemt",  cls: "status-unreconciled" },
};

const StatusPill = ({ status, size = "md" }) => {
  const meta = STATUS_META[status];
  if (!meta) return null;
  return (
    <span className={`status-pill ${meta.cls}`}>
      <Ic name={meta.icon} size={12} />
      {meta.label}
    </span>
  );
};

const DeptDot = ({ dept }) => (
  <span className="dept-dot" style={{ background: `var(--dept-${dept})` }} />
);

// ── Sidebar ─────────────────────────────────────────────
const Sidebar = () => (
  <aside className="sidebar">
    <div className="sidebar-logo">
      <div className="sidebar-logo-mark">S</div>
      <div className="sidebar-logo-name">Smartout</div>
    </div>

    <div className="nav-group-label">Drift</div>
    <a className="nav-item"><Ic name="home" size={18} /> Hjem</a>
    <a className="nav-item"><Ic name="calendar" size={18} /> Vakter</a>
    <a className="nav-item"><Ic name="users" size={18} /> Ansatte</a>

    <div className="nav-group-label">Økonomi</div>
    <a className="nav-item active">
      <Ic name="clipboardCheck" size={18} />
      Avstemming
      <span className="nav-badge">7</span>
    </a>
    <a className="nav-item"><Ic name="inbox" size={18} /> Handoffs <span className="nav-badge" style={{ background: "var(--warning)" }}>2</span></a>
    <a className="nav-item"><Ic name="trendingUp" size={18} /> Rapporter</a>

    <div className="nav-group-label">System</div>
    <a className="nav-item"><Ic name="graduation" size={18} /> Opplæring</a>
    <a className="nav-item"><Ic name="shield" size={18} /> HMS</a>
    <a className="nav-item"><Ic name="settings" size={18} /> Innstillinger</a>

    <div className="sidebar-foot">
      <div className="avatar">PS</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Pontus Sjögren</div>
        <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Fjorden Restaurant</div>
      </div>
    </div>
  </aside>
);

// ── DayList ─────────────────────────────────────────────
const FILTERS = [
  { key: "all",        label: "Alle" },
  { key: "needs",      label: "Trenger handling" },
  { key: "awaiting_approval", label: "Venter" },
  { key: "unreconciled", label: "Ikke avstemt" },
  { key: "approved",   label: "Godkjent" },
];

const DayList = ({ selectedId, onSelect, filter, setFilter, search, setSearch }) => {
  const fmtNok = (n) => n?.toLocaleString("nb-NO");

  const needsAction = (s) => ["submitted", "awaiting_approval", "unreconciled", "open"].includes(s);

  const match = (day) => {
    if (search) {
      const hay = `${day.day} ${day.date} ${day.dept}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    if (filter === "all") return true;
    if (filter === "needs") return needsAction(day.status);
    return day.status === filter;
  };

  return (
    <section className="daylist">
      <div className="daylist-header">
        <div className="daylist-title-row">
          <h1 className="daylist-title">Avstemming</h1>
          <button className="btn btn-sm btn-ghost" title="Filter">
            <Ic name="sliders" size={14} />
          </button>
        </div>
        <div className="search-wrap">
          <Ic name="search" size={14} />
          <input
            className="search"
            placeholder="Søk etter dag, avdeling…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-chips">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key === "needs" && <span className="chip-count">7</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="daylist-body">
        {WEEKS.map((w) => {
          const visible = w.days.filter(match);
          if (!visible.length) return null;
          return (
            <div key={w.label} className="week-group">
              <div className="week-header">
                <div className="week-label">{w.label}</div>
                <div />
                <div className="caption font-mono" style={{ fontSize: 11 }}>
                  {fmtNok(w.revenue)} kr
                </div>
                <div className="week-stats">
                  <span>Omsetning <span className="mono">{fmtNok(w.revenue)} kr</span></span>
                  <span>Labor <span className="mono">{w.labor}%</span></span>
                </div>
              </div>
              {visible.map((d) => (
                <div
                  key={d.id}
                  className={`day-row ${selectedId === d.id ? "selected" : ""}`}
                  onClick={() => onSelect(d.id)}
                >
                  <div className="day-row-status">
                    <StatusDot status={d.status} />
                  </div>
                  <div className="day-row-mid">
                    <div className="day-row-title">
                      <span className="day-row-date-day">{d.dayShort}</span>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{d.day}</span>
                    </div>
                    <div className="day-row-sub">
                      <DeptDot dept={d.deptKey} />
                      {d.dept}
                      <StatusPill status={d.status} />
                    </div>
                  </div>
                  <div className="day-row-right">
                    <div className="day-row-revenue">
                      {d.revenue ? `${fmtNok(d.revenue)} kr` : "—"}
                    </div>
                    {d.labor != null && (
                      <div className="caption font-mono" style={{ fontSize: 11 }}>
                        {d.labor}% labor
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const StatusDot = ({ status }) => {
  const meta = STATUS_META[status];
  if (!meta) return null;
  return (
    <span className={`status-pill ${meta.cls}`} style={{ padding: 4, borderRadius: 9999 }}>
      <Ic name={meta.icon} size={14} />
    </span>
  );
};

Object.assign(window, { StatusPill, DeptDot, Sidebar, DayList, STATUS_META });
