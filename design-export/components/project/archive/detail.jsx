// DayDetail — header, preflight, tabs, action bar
const TABS = [
  { key: "oversikt",  label: "Oversikt" },
  { key: "omsetning", label: "Omsetning" },
  { key: "vakter",    label: "Vakter", count: 3 },
  { key: "avvik",     label: "Avvik", count: 5, warn: true },
  { key: "oppgaver",  label: "Oppgaver", count: 6 },
  { key: "logg",      label: "Revisjonslogg" },
];

const fmt = (n) => n?.toLocaleString("nb-NO");

const KPIStrip = ({ kpis }) => (
  <div className="kpi-strip">
    {kpis.map((k, i) => (
      <div key={i} className="kpi-item">
        <div className="kpi-label">{k.label}</div>
        <div className="kpi-value">
          {k.value}
          <span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>{k.unit}</span>
        </div>
        <div className="kpi-sub">
          <span className={k.deltaDir === "up" ? "kpi-delta-up" : k.deltaDir === "down" ? "kpi-delta-down" : ""}>
            {k.delta}
          </span>
          <span style={{ color: "var(--border)", margin: "0 6px" }}>·</span>
          {k.sub}
        </div>
      </div>
    ))}
  </div>
);

const Preflight = ({ items, onJump }) => {
  const blockers = items.filter((i) => !i.done);
  return (
    <div className={`preflight ${blockers.length === 0 ? "clean" : "blocked"}`}>
      <div className="preflight-title">
        {blockers.length === 0 ? (
          <><Ic name="checkCircle" size={18} style={{ color: "var(--success)" }} /> Klar for godkjenning</>
        ) : (
          <><Ic name="alertCircle" size={18} style={{ color: "var(--warning)" }} /> {blockers.length} punkter må løses før godkjenning</>
        )}
      </div>
      <div className="preflight-sub">
        Klikk på hvert punkt for å hoppe til riktig sted i dagen.
      </div>
      <div className="preflight-list">
        {items.map((it) => (
          <div
            key={it.id}
            className={`preflight-row ${it.done ? "done" : ""}`}
            onClick={() => !it.done && onJump(it.tab)}
          >
            <div>
              {it.done
                ? <Ic name="checkCircle" size={18} style={{ color: "var(--success)" }} />
                : <Ic name="alertCircle" size={18} style={{ color: "var(--warning)" }} />}
            </div>
            <div>
              <div className="preflight-row-text">{it.text}</div>
            </div>
            <div className="preflight-row-hint">{it.hint}</div>
            <div className="preflight-row-chev">
              {!it.done && <Ic name="chevronRight" size={16} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Tab panes ────────────────────────────────────────────

const OversiktPane = ({ day }) => (
  <div className="tab-pane stack-lg">
    <div>
      <div className="section-label">Sammendrag</div>
      <div className="card">
        <div style={{ fontSize: 15, lineHeight: 1.55, marginBottom: 12 }}>
          Fredagsskiftet leverte <strong className="font-mono">94 200 kr</strong> mot budsjett 88 200 kr — <strong style={{ color: "var(--success)" }}>+6.8%</strong>.
          Labor-prosenten havnet på <strong className="font-mono">31.4%</strong>, <strong style={{ color: "var(--warning)" }}>3.4pp over mål</strong> pga. overtid og sen close-out.
          <span style={{ color: "var(--muted)" }}> Kontantdiff på −318 kr er over toleranse og kommer som andre gang denne uken — handoff til Iselin er aktiv.</span>
        </div>
      </div>
    </div>

    <div>
      <div className="section-label">Tidslinje</div>
      <div className="card">
        <div className="timeline">
          {day.timeline.map((t, i) => (
            <div key={i} className={`tl-row ${t.state === "done" ? "tl-done" : ""} ${t.state === "active" ? "tl-active" : ""}`}>
              <div>
                <div className="tl-title">{t.title}</div>
                <div className="tl-sub">{t.sub}</div>
              </div>
              <div className="tl-time">{t.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const OmsetningPane = ({ day }) => {
  const r = day.revenue;
  return (
    <div className="tab-pane stack-lg">
      <div>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div className="section-label">Registrert omsetning</div>
          <button className="btn btn-sm btn-secondary"><Ic name="edit" size={12} /> Juster</button>
        </div>
        <div className="rev-grid">
          <div className="rev-cell">
            <div className="rev-cell-label">Total omsetning</div>
            <div className="rev-cell-val">{fmt(r.total)} kr</div>
            <div className="rev-cell-sub">Budsjett 88 200 kr · +6.8%</div>
          </div>
          <div className="rev-cell">
            <div className="rev-cell-label">MVA</div>
            <div className="rev-cell-val">{fmt(r.vat)} kr</div>
            <div className="rev-cell-sub">25% standard</div>
          </div>
          <div className="rev-cell">
            <div className="rev-cell-label">Kort</div>
            <div className="rev-cell-val">{fmt(r.card)} kr</div>
            <div className="rev-cell-sub">76% av total</div>
          </div>
          <div className="rev-cell">
            <div className="rev-cell-label">Kontant</div>
            <div className="rev-cell-val">{fmt(r.cash)} kr</div>
            <div className="rev-cell-sub" style={{ color: "var(--warning)" }}>Diff −318 kr · over toleranse</div>
          </div>
          <div className="rev-cell">
            <div className="rev-cell-label">Transaksjoner</div>
            <div className="rev-cell-val">{r.transactions}</div>
            <div className="rev-cell-sub">Snitt 328 kr / kvittering</div>
          </div>
          <div className="rev-cell">
            <div className="rev-cell-label">Kilde</div>
            <div className="rev-cell-val" style={{ fontSize: 16 }}>iSettle Z-report</div>
            <div className="rev-cell-sub">OCR validert · 22:40</div>
          </div>
        </div>
      </div>

      <div>
        <div className="section-label">Opplastede kilder</div>
        <div className="ocr-strip">
          {["Z-report", "Kontantkasse", "iZettle kvittering", "Tips-ark"].map((t, i) => (
            <div key={i} className="ocr-thumb">
              <div className="ocr-thumb-tag">{t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ShiftRow = ({ shift }) => {
  const diff = shift.calculated - shift.planned;
  return (
    <div className={`shift-row dept-${shift.dept}`}>
      <div className="avatar">{shift.initials}</div>
      <div>
        <div className="shift-name">{shift.name}</div>
        <div className="shift-sub">{shift.role}{shift.diff ? ` · ${shift.diff} over plan` : ""}</div>
      </div>
      <div className="shift-hours">
        <div className="shift-hours-label">Plan</div>
        <div className="shift-hours-label">Beregnet</div>
        <div className="shift-hours-label">Godkjent</div>
        <div className="shift-hours-val">{shift.planned.toFixed(2)}</div>
        <div className={`shift-hours-val ${diff > 0 ? "diff-up" : ""}`}>{shift.calculated.toFixed(2)}</div>
        <div className="shift-hours-val">{shift.approved != null ? shift.approved.toFixed(2) : "—"}</div>
      </div>
      <div>
        {shift.status === "approved" && <StatusPill status="approved" />}
        {shift.status === "pending" && <StatusPill status="awaiting_approval" />}
        {shift.status === "disputed" && <StatusPill status="unreconciled" />}
      </div>
      <div className="row">
        {shift.status !== "approved" && (
          <button className="btn btn-sm btn-primary">Godkjenn</button>
        )}
        <button className="btn btn-sm btn-ghost" title="Mer"><Ic name="moreHorizontal" size={16} /></button>
      </div>
    </div>
  );
};

const VakterPane = ({ day }) => (
  <div className="tab-pane stack">
    <div className="row-between">
      <div className="section-label" style={{ margin: 0 }}>8 vakter · 82.5t totalt · 3 venter</div>
      <button className="btn btn-sm btn-secondary"><Ic name="check" size={14} /> Godkjenn alle klare (5)</button>
    </div>
    <div className="card flush">
      <div className="shift-list">
        {day.shifts.map((s, i) => <ShiftRow key={i} shift={s} />)}
      </div>
    </div>
  </div>
);

const SEV_META = {
  CRITICAL: { cls: "sev-critical", label: "Kritisk", dot: "sev-critical-dot" },
  HIGH:     { cls: "sev-high",     label: "Høy",     dot: "sev-high-dot" },
  MEDIUM:   { cls: "sev-medium",   label: "Medium",  dot: "sev-medium-dot" },
  LOW:      { cls: "sev-low",      label: "Lav",     dot: "sev-low-dot" },
};

const AvvikPane = ({ day, onRequestHandoff }) => {
  const [open, setOpen] = React.useState({ CRITICAL: true, HIGH: true, MEDIUM: true, LOW: false });
  return (
    <div className="tab-pane stack">
      {Object.entries(day.deviations).map(([sev, items]) => {
        const meta = SEV_META[sev];
        const isOpen = open[sev];
        return (
          <div key={sev} className="dev-group">
            <div className="dev-group-header" onClick={() => setOpen({ ...open, [sev]: !isOpen })}>
              <Ic name={isOpen ? "chevronDown" : "chevronRight"} size={14} />
              <span className={`sev-dot ${meta.dot}`} />
              {meta.label}
              <span className="count">{items.length}</span>
            </div>
            {isOpen && items.map((d) => (
              <div key={d.id} className={`dev-item ${meta.cls}`}>
                <div className="sev-bar" />
                <div>
                  <div className="dev-item-title">{d.title}</div>
                  <div className="dev-item-desc">{d.desc}</div>
                  <div className="dev-item-meta">
                    <span>{d.owner}</span>
                    <span>·</span>
                    <span className="mono">{d.time}</span>
                    {d.cost != null && <><span>·</span><span className="mono" style={{ color: "var(--warning)" }}>{fmt(d.cost)} kr</span></>}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-sm btn-secondary">Løs</button>
                  <button className="btn btn-sm btn-ghost" onClick={onRequestHandoff}><Ic name="phoneForwarded" size={12} /> Handoff</button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

const OppgaverPane = ({ day }) => (
  <div className="tab-pane">
    <div className="card flush">
      {day.tasks.map((t, i) => (
        <div key={i} style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr auto",
          gap: 14, padding: "14px 18px",
          borderBottom: i < day.tasks.length - 1 ? "1px solid var(--border)" : "none",
          alignItems: "flex-start",
        }}>
          <div style={{ paddingTop: 2 }}>
            {t.done
              ? <div style={{ width: 20, height: 20, borderRadius: 6, background: "var(--success)", display: "grid", placeItems: "center" }}><Ic name="check" size={12} style={{ color: "white" }} /></div>
              : <div style={{ width: 20, height: 20, borderRadius: 6, border: "1.5px solid var(--warning)" }} />}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, textDecoration: t.done ? "none" : "none" }}>{t.label}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{t.by}</div>
            {t.note && <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 6, padding: "6px 8px", background: "color-mix(in oklab, var(--warning) 8%, transparent)", borderRadius: 6, display: "inline-block" }}>{t.note}</div>}
          </div>
          <div>{!t.done && <StatusPill status="awaiting_approval" />}</div>
        </div>
      ))}
    </div>
  </div>
);

const LoggPane = ({ day }) => (
  <div className="tab-pane">
    <div className="card">
      <div className="timeline">
        {[...day.timeline].reverse().map((t, i) => (
          <div key={i} className={`tl-row ${t.state === "active" ? "tl-active" : "tl-done"}`}>
            <div>
              <div className="tl-title">{t.title}</div>
              <div className="tl-sub">{t.sub}</div>
            </div>
            <div className="tl-time">{t.time}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, {
  TABS, KPIStrip, Preflight,
  OversiktPane, OmsetningPane, VakterPane, AvvikPane, OppgaverPane, LoggPane,
});
