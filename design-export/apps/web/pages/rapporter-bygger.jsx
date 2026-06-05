// ===== Rapporter — Rapportbygger (dynamic report builder) =====
// Left rail: preset quick-starts + dimensions (period/sted/avd/…) + metric library.
// Right: a live preview that reflows as you pick metrics and a group-by dimension.
// "Lagre som mal" / "Planlegg" / "Eksporter" hand off to the rest of the module.
(function () {
  const { useState, useRef } = React;

  // deterministic preview rows by group-by dimension (sted | avdeling | rolle | dag)
  const DEPT_ROWS = [
    { name: "Kjøkken", color: "#ee560c", f: 1.18 },
    { name: "Sal", color: "#00ab93", f: 0.94 },
    { name: "Bar", color: "#864ad2", f: 0.86 },
    { name: "Event", color: "#c18200", f: 1.05 },
  ];
  const metricBase = { labor_pct: 29.4, rev_per_hour: 842, overtime: 18.5, avg_check: 412, guests: 3118, absence: 4.8, coverage: 91, margin: 62.3 };
  const metricFmt = { labor_pct: ["pct", "%"], rev_per_hour: ["kr", ""], overtime: ["hour", "t"], avg_check: ["kr", ""], guests: ["num", ""], absence: ["pct", "%"], coverage: ["pct", "%"], margin: ["pct", "%"] };

  function DimRow({ dim, value, onPick }) {
    const R = window.Rap; const { Ic } = R;
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    R.useOutside(ref, open ? () => setOpen(false) : null);
    return (
      <div className="rap-dim-row" ref={ref}>
        <button className="rap-dim-btn" onClick={() => setOpen((o) => !o)}>
          <span className="ico"><Ic n={dim.icon} s={16} /></span>
          <span style={{ minWidth: 0 }}>
            <span className="l" style={{ display: "block" }}>{dim.label}</span>
            <span className="v">{value}</span>
          </span>
          <span className="cap"><Ic n="chevDown" s={14} /></span>
        </button>
        {open && (
          <div className="rap-pop" style={{ minWidth: 200 }}>
            {dim.opts.map((o) => (
              <div key={o} className={`row ${o === value ? "on" : ""}`} onClick={() => { onPick(o); setOpen(false); }}>
                {o === value && <Ic n="check" s={13} c="var(--orange)" sw={2.6} />}
                <span style={{ fontWeight: o === value ? 600 : 500 }}>{o}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function RapBygger({ scope, period, toast }) {
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;

    const [dimVals, setDimVals] = useState(() => Object.fromEntries(D.RAP_DIMENSIONS.map((d) => [d.id, d.value])));
    const [metrics, setMetrics] = useState(() => D.RAP_METRIC_LIB.filter((m) => m.on).map((m) => m.id));
    const [preset, setPreset] = useState(null);
    const [groupBy, setGroupBy] = useState("Avdeling");

    const setDim = (id, v) => setDimVals((s) => ({ ...s, [id]: v }));
    const toggleMetric = (id) => setMetrics((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);

    const applyPreset = (p) => {
      setPreset(p.id);
      // light remap of metrics to the preset's intent
      const map = {
        p1: ["labor_pct", "overtime", "coverage"], p2: ["labor_pct", "margin"],
        p3: ["rev_per_hour", "labor_pct", "guests"], p4: ["coverage", "guests"],
        p5: ["margin", "labor_pct", "avg_check"], p6: ["overtime", "absence", "labor_pct"],
      };
      if (map[p.id]) setMetrics(map[p.id]);
      toast(`Mal lastet: ${p.name}`);
    };

    const activeMetrics = D.RAP_METRIC_LIB.filter((m) => metrics.includes(m.id));
    const rows = DEPT_ROWS.map((d) => ({
      ...d,
      vals: activeMetrics.map((m) => {
        const base = metricBase[m.id] ?? 0;
        const [fmt] = metricFmt[m.id] || ["num", ""];
        const v = base * d.f * (0.92 + (d.name.length % 4) * 0.04);
        return { v: +(fmt === "pct" || fmt === "hour" ? v.toFixed(1) : v.toFixed(0)), fmt, unit: (metricFmt[m.id] || [])[1] || "" };
      }),
    }));
    const totals = activeMetrics.map((m, ci) => {
      const [fmt] = metricFmt[m.id] || ["num", ""];
      if (fmt === "pct") return { v: metricBase[m.id], fmt, unit: "%" };
      const sum = rows.reduce((a, r) => a + r.vals[ci].v, 0);
      return { v: +sum.toFixed(fmt === "hour" ? 1 : 0), fmt, unit: (metricFmt[m.id] || [])[1] || "" };
    });

    return (
      <div className="rap-build">
        {/* config rail */}
        <div className="rap-build-rail">
          <div>
            <h4 className="rap-secttl"><Ic n="filter" s={12} /> Dimensjoner</h4>
            <div className="rap-dim">
              {D.RAP_DIMENSIONS.slice(0, 5).map((dim) => (
                <DimRow key={dim.id} dim={dim} value={dimVals[dim.id]} onPick={(v) => setDim(dim.id, v)} />
              ))}
            </div>
          </div>

          <div>
            <h4 className="rap-secttl"><Ic n="layers" s={12} /> Grupper etter</h4>
            <div className="rap-seg">
              {["Avdeling", "Sted", "Rolle", "Dag"].map((g) => (
                <button key={g} className={groupBy === g ? "on" : ""} onClick={() => setGroupBy(g)}>{g}</button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="rap-secttl"><Ic n="hash" s={12} /> Nøkkeltall ({metrics.length})</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {D.RAP_METRIC_LIB.map((m) => (
                <button key={m.id} className={`rap-metric-pill ${metrics.includes(m.id) ? "on" : ""}`} onClick={() => toggleMetric(m.id)}>
                  <span className="ck">{metrics.includes(m.id) && <Ic n="check" s={11} sw={3} />}</span>{m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* presets + live preview */}
        <div className="so-stack">
          <div>
            <h4 className="rap-secttl"><Ic n="bookmark" s={12} /> Start fra en mal</h4>
            <div className="rap-presets-grid">
              {D.RAP_PRESETS.map((p) => (
                <div key={p.id} className={`rap-preset-card ${preset === p.id ? "on" : ""}`} onClick={() => applyPreset(p)}>
                  {p.hot && <span className="rap-hot">Mye brukt</span>}
                  <div className="rap-preset-top">
                    <span className="rap-preset-ic"><Ic n={p.ic} s={16} /></span>
                    <span className="rap-preset-name">{p.name}</span>
                  </div>
                  <div className="rap-preset-desc">{p.desc}</div>
                  <div className="rap-preset-tags">
                    {p.dims.map((d) => <span key={d} className="rap-tag">{d}</span>)}
                    {p.sources.map((s) => <span key={s} className="rap-tag" style={{ background: "var(--orange-soft)", color: "var(--orange-dark)" }}>{s}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <R.Panel icon="chart" title="Forhåndsvisning" right={
            <span className="so-eyebrow-lbl" style={{ marginRight: 8, fontSize: 11, color: "var(--muted)" }}>{dimVals.period} · {dimVals.location} · per {groupBy.toLowerCase()}</span>
          }>
            {activeMetrics.length === 0 ? (
              <R.Empty icon="hash" title="Velg minst ett nøkkeltall" sub="Huk av nøkkeltall i venstre kolonne for å bygge rapporten." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="rap-preview-table">
                  <thead>
                    <tr>
                      <th>{groupBy}</th>
                      {activeMetrics.map((m) => <th key={m.id}>{m.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.name}>
                        <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: r.color }} />{r.name}</span></td>
                        {r.vals.map((c, ci) => <td key={ci}>{R.fmtVal(c.v, c.fmt)}{c.unit}</td>)}
                      </tr>
                    ))}
                    <tr className="tot">
                      <td>Totalt</td>
                      {totals.map((c, ci) => <td key={ci}>{R.fmtVal(c.v, c.fmt)}{c.unit}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, padding: "14px 18px 16px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
              <button className="rap-btn" onClick={() => toast("Rapport lagret som mal")}><Ic n="bookmark" s={15} /> Lagre som mal</button>
              <button className="rap-btn" onClick={() => toast("Åpne i Planlagte for å sette mottakere")}><Ic n="timer" s={15} /> Planlegg</button>
              <span style={{ flex: 1 }} />
              <button className="rap-btn primary" onClick={() => toast("Rapport eksportert til PDF")}><Ic n="download" s={15} /> Eksporter</button>
            </div>
          </R.Panel>
        </div>
      </div>
    );
  }

  window.RapBygger = RapBygger;
})();
