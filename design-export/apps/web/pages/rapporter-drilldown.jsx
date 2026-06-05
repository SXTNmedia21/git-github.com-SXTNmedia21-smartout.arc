// ===== Rapporter — KPI drill-down (slide-over drawer) =====
// Opens from any KPI card. Big value + target + trend, breakdown by department
// (bars vs target marks), by-day series, contributing factors, related insight,
// and export. Reads RAP_DRILL[kpiId] when present, else derives a breakdown.
(function () {
  function RapDrilldown({ kpiId, onClose, onOpenInsight, toast }) {
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;
    const k = D.RAP_KPIS.find((x) => x.id === kpiId) || D.RAP_KPIS_MORE.find((x) => x.id === kpiId);
    if (!k) return null;

    const drill = D.RAP_DRILL[kpiId] || genericDrill(k);
    const relIns = D.RAP_INSIGHTS.find((i) => i.kpi === kpiId);
    const sparkColor = k.tone === "crit" ? "var(--error)" : k.tone === "warn" ? "var(--warning)" : k.tone === "ok" ? "var(--success)" : "var(--orange)";
    const unit = k.unit || "";

    const maxDept = Math.max(...drill.byDept.map((d) => Math.max(d.val, d.target || 0))) * 1.1;
    const maxDay = Math.max(...drill.byDay.map((d) => d.val)) * 1.1;

    return (
      <>
        <div className="rap-scrim" onClick={onClose} />
        <aside className="rap-drawer">
          <div className="rap-drawer-head">
            <div className="rap-drawer-r1">
              <span className={`rap-ins-ic ${k.tone || "info"}`} style={{ width: 30, height: 30 }}><Ic n={k.icon} s={16} /></span>
              <span className="rap-drawer-ey">KPI · drilldown · Uke 22</span>
              <span className="spacer" />
              <button className="rap-iconbtn" onClick={() => toast("Eksportert til PDF")}><Ic n="download" s={17} /></button>
              <button className="rap-iconbtn" onClick={onClose}><Ic n="x" s={18} /></button>
            </div>
            <h2 className="rap-drawer-title">{k.label}</h2>
            <div className="rap-statline" style={{ marginTop: 14 }}>
              <div className="rap-stat">
                <div className="l">Faktisk</div>
                <div className={`v ${k.tone || ""}`}>{R.fmtVal(k.value, k.fmt)}<span style={{ fontSize: 14, color: "var(--muted-soft)", marginLeft: 3 }}>{R.unitFor ? R.unitFor(k) : unit}</span></div>
              </div>
              {k.target != null && (
                <div className="rap-stat"><div className="l">Mål</div><div className="v" style={{ color: "var(--muted)" }}>{R.fmtVal(k.target, k.fmt)}{unit}</div></div>
              )}
              {k.prev != null && (
                <div className="rap-stat"><div className="l">Forrige uke</div><div className="v" style={{ color: "var(--muted)" }}>{R.fmtVal(k.prev, k.fmt)}{unit}</div></div>
              )}
              <div className="rap-stat"><div className="l">Endring</div><div className="v" style={{ fontSize: 20, alignSelf: "center" }}>{k.deltaLabel || k.delta}</div></div>
            </div>
          </div>

          <div className="rap-drawer-body">
            {/* note */}
            {k.note && (
              <div className="rap-warn info" style={{ marginBottom: 18 }}>
                <span className="ic"><Ic n="info" s={16} /></span>
                <div className="bs" style={{ color: "var(--fg)" }}>{k.note}</div>
              </div>
            )}

            {/* trend */}
            {k.spark && (
              <div style={{ marginBottom: 22 }}>
                <h4 className="rap-secttl"><Ic n="trendUp" s={12} /> Trend · 8 uker</h4>
                <div className="so-panel" style={{ padding: "16px 18px" }}>
                  <R.Spark data={k.spark} color={sparkColor} w={760} h={70} fill />
                </div>
              </div>
            )}

            {/* breakdown by department */}
            <div style={{ marginBottom: 22 }}>
              <h4 className="rap-secttl"><Ic n="building" s={12} /> Per avdeling</h4>
              <div className="so-panel" style={{ padding: "10px 18px" }}>
                <div className="rap-bd">
                  {drill.byDept.map((d) => {
                    const tone = d.target != null && (k.dir === "down" ? d.val > d.target : d.val < d.target);
                    return (
                      <div key={d.id} className="rap-bd-row">
                        <span className="rap-bd-name"><span className="dot" style={{ background: d.color }} />{d.name}</span>
                        <div className="rap-bd-track">
                          <span className="rap-bd-fill" style={{ width: (d.val / maxDept * 100) + "%", background: tone ? "var(--warning)" : d.color, opacity: tone ? 1 : .8 }} />
                          {d.target != null && <span className="rap-bd-tmark" style={{ left: (d.target / maxDept * 100) + "%" }} />}
                        </div>
                        <span className="rap-bd-val">{R.fmtVal(d.val, k.fmt)}{unit}{d.target != null && <span className="t">mål {R.fmtVal(d.target, k.fmt)}{unit}</span>}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* by day */}
            <div style={{ marginBottom: 22 }}>
              <h4 className="rap-secttl"><Ic n="calendar" s={12} /> Per dag · uke 22</h4>
              <div className="so-panel rap-chart">
                <svg viewBox="0 0 640 150" preserveAspectRatio="none" style={{ height: 150 }}>
                  {[0, .33, .66, 1].map((t, idx) => <line key={idx} className="gl" x1="8" x2="632" y1={12 + t * 110} y2={12 + t * 110} />)}
                  {drill.byDay.map((d, i) => {
                    const n = drill.byDay.length, iw = 624, bw = (iw / n) * 0.5;
                    const x = 8 + (i + 0.5) * (iw / n);
                    const bh = (d.val / maxDay) * 110;
                    return (
                      <g key={i}>
                        <rect x={x - bw / 2} y={12 + 110 - bh} width={bw} height={bh} rx="3" fill={sparkColor} opacity=".85" />
                        <text className="axlbl" x={x} y={146} textAnchor="middle">{d.d}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* contributing factors */}
            {drill.factors && (
              <div style={{ marginBottom: 22 }}>
                <h4 className="rap-secttl"><Ic n="diff" s={12} /> Hva driver tallet</h4>
                <div className="so-panel" style={{ padding: "6px 18px" }}>
                  {drill.factors.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 0", borderBottom: i < drill.factors.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span className={`rap-ins-ic ${f.sev}`} style={{ width: 28, height: 28 }}><Ic n={f.ic} s={14} /></span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{f.t}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: f.sev === "crit" ? "var(--error)" : f.sev === "warn" ? "var(--warning)" : "var(--muted)" }}>{f.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* related insight */}
            {relIns && (
              <div>
                <h4 className="rap-secttl"><Ic n="sparkle" s={12} /> Relatert innsikt</h4>
                <div className="rap-ins" style={{ cursor: "pointer" }} onClick={() => { onClose(); onOpenInsight(relIns.id); }}>
                  <div className="rap-ins-top" style={{ paddingRight: 16 }}>
                    <span className={`rap-ins-ic ${relIns.sev}`} style={{ width: 30, height: 30 }}><Ic n="sparkle" s={15} /></span>
                    <div className="rap-ins-main">
                      <div className="rap-ins-title" style={{ fontSize: 14 }}>{relIns.title}</div>
                      <div className="rap-ins-summary" style={{ fontSize: 12.5 }}>{relIns.rec}</div>
                    </div>
                    <span style={{ color: "var(--muted-soft)", alignSelf: "center" }}><Ic n="arrowRight" s={16} /></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </>
    );
  }

  // derive a plausible dept breakdown for KPIs without explicit drill data
  function genericDrill(k) {
    const D = window.SmartoutData;
    const base = k.value;
    const depts = [
      { id: "kjokken", name: "Kjøkken", color: "#ee560c", f: 1.18 },
      { id: "sal", name: "Sal", color: "#00ab93", f: 0.96 },
      { id: "bar", name: "Bar", color: "#864ad2", f: 0.88 },
      { id: "event", name: "Event", color: "#c18200", f: 1.04 },
      { id: "lager", name: "Lager", color: "#008388", f: 0.74 },
    ];
    return {
      byDept: depts.map((d) => ({ id: d.id, name: d.name, color: d.color, val: +(base * d.f).toFixed(k.fmt === "pct" || k.fmt === "hour" ? 1 : 0), target: k.target != null ? +(k.target * d.f).toFixed(1) : null })),
      byDay: (D.RAP_TREND_DAYS).map((x, i) => ({ d: x.d, val: +(base * (0.85 + (i % 4) * 0.09)).toFixed(k.fmt === "pct" || k.fmt === "hour" ? 1 : 0) })),
      factors: null,
    };
  }

  window.RapDrilldown = RapDrilldown;
})();
