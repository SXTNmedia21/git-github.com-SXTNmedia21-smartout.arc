// ===== Vaktplan — Print / PDF export (preview + print-to-PDF) =====
// Loads after vaktplan-profile.jsx, before vaktplan.jsx. Exposes window.VPPrint.
(function () {
  const { useState, useEffect } = React;
  const Ic = window.Ic;
  const VP = window.VP;
  const { DEPT, empById, DAYS } = VP;

  const DEP_LEGEND = [["Kjøkken", DEPT.kjokken.c], ["Sal", DEPT.sal.c], ["Bar", DEPT.bar.c], ["Event", DEPT.event.c]];

  function ShiftCell({ s }) {
    return <div className="vp-print-cell" style={{ borderLeftColor: DEPT[s.dep].c }}><span className="r">{s.role}</span><span className="t">{s.t}{s.status === "draft" ? " (utkast)" : s.status === "changed" ? " (endret)" : ""}</span></div>;
  }

  function Print({ shifts, groups, gaps, meta, onClose }) {
    const [scope, setScope] = useState("uke");     // uke | maned
    const [orient, setOrient] = useState("empday"); // empday (ansatt×dag) | dayemp (dag×ansatt, "revert")
    const [metric, setMetric] = useState("vakter"); // vakter | ansatte  (month view)
    const [weeks, setWeeks] = useState(1);          // how many weeks to print in week view (1 | 2 | 4)
    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);
    const doPrint = () => { document.body.classList.add("vp-printing"); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove("vp-printing"), 300); }, 60); };

    const emps = groups.flatMap(g => g.emps);
    const dayHours = (i) => shifts.filter(s => s.d === i).reduce((a, s) => a + (s.en - s.st), 0);
    const dayShifts = (i) => shifts.filter(s => s.d === i);
    const dayStaff = (i) => new Set(shifts.filter(s => s.d === i).map(s => s.e)).size;
    const totalShifts = shifts.length;
    const gen = new Date().toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" });

    // proper month = 4 weeks, only uke 22 populated (no invented data)
    const WEEKS = [
      { wk: 22, range: "27. mai – 2. jun", active: true },
      { wk: 23, range: "3. – 9. juni", active: false },
      { wk: 24, range: "10. – 16. juni", active: false },
      { wk: 25, range: "17. – 23. juni", active: false },
    ];
    const selWeeks = WEEKS.slice(0, weeks);

    // one week's table (Ansatt × dag or Dag × ansatt), driven by the week's own shift/gap data
    const weekTable = (wShifts, wGaps) => {
      const dShifts = (i) => wShifts.filter(s => s.d === i);
      const dHours = (i) => wShifts.filter(s => s.d === i).reduce((a, s) => a + (s.en - s.st), 0);
      const wTotal = wShifts.length;
      if (orient === "empday") {
        return (
          <table className="vp-print-table">
            <thead>
              <tr><th className="emp">Ansatt</th>{DAYS.map((d, i) => <th key={i} className={d.we ? "we" : ""}>{d.dn} <span className="num">{d.num}/{d.mon}</span></th>)}</tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => (
                <React.Fragment key={gi}>
                  {g.label && <tr className="grp"><td colSpan={8}><span style={g.dep ? { background: DEPT[g.dep].c } : {}} className="grpdot" />{g.label}</td></tr>}
                  {g.emps.map(e => (
                    <tr key={e.id}>
                      <td className="emp"><span className="nm">{e.name}</span><span className="rl">{e.role}</span></td>
                      {DAYS.map((d, i) => { const ss = wShifts.filter(s => s.e === e.id && s.d === i); return <td key={i} className={d.we ? "we" : ""}>{ss.map(s => <ShiftCell key={s.id} s={s} />)}</td>; })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {wGaps.length > 0 && (
                <tr className="gaprow"><td className="emp"><span className="nm">Udekket</span><span className="rl">åpne vakter</span></td>
                  {DAYS.map((d, i) => { const gg = wGaps.filter(x => x.d === i); return <td key={i} className={d.we ? "we" : ""}>{gg.map((g, j) => <div key={j} className="vp-print-cell gap"><span className="r">{g.role}</span><span className="t">{g.t}</span></div>)}</td>; })}
                </tr>
              )}
              <tr className="totrow"><td className="emp">Sum</td>{DAYS.map((d, i) => <td key={i} className={d.we ? "we" : ""}><span className="totn">{dShifts(i).length}</span> vakter<br /><span className="toth">{dHours(i)}t</span></td>)}</tr>
            </tbody>
          </table>
        );
      }
      return (
        <table className="vp-print-table revert">
          <thead>
            <tr><th className="emp">Dag</th>{emps.map(e => <th key={e.id}><span className="rh-nm">{e.name.split(" ")[0]} {e.name.split(" ")[1] || ""}</span><span className="rh-rl">{e.role}</span></th>)}<th className="we">Sum</th></tr>
          </thead>
          <tbody>
            {DAYS.map((d, i) => (
              <tr key={i} className={d.today ? "monthactive" : ""}>
                <td className="emp"><span className="nm">{d.dn}</span><span className="rl">{d.num}/{d.mon}</span></td>
                {emps.map(e => { const ss = wShifts.filter(s => s.e === e.id && s.d === i); return <td key={e.id}>{ss.map(s => <ShiftCell key={s.id} s={s} />)}</td>; })}
                <td className="we"><span className="totn">{dShifts(i).length}</span></td>
              </tr>
            ))}
            {wGaps.length > 0 && (
              <tr className="gaprow"><td className="emp"><span className="nm">Udekket</span></td>{emps.map(e => <td key={e.id} />)}<td className="we"><span className="totn" style={{ color: "#b3000a" }}>{wGaps.length}</span></td></tr>
            )}
            <tr className="totrow"><td className="emp">Sum vakter</td>{emps.map(e => <td key={e.id}><span className="totn">{wShifts.filter(s => s.e === e.id).length}</span></td>)}<td className="we"><span className="totn">{wTotal}</span></td></tr>
          </tbody>
        </table>
      );
    };

    return (
      <div className="vp-print-scrim" onMouseDown={onClose}>
        <div className="vp-print" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Eksporter vaktplan">
          <div className="vp-print-bar">
            <span className="vp-print-barlbl"><Ic n="file" s={16} /> Forhåndsvisning — eksport</span>
            <div className="vp-seg sm">
              {[["uke", "Uke"], ["maned", "Måned"]].map(([k, l]) => <button key={k} className={scope === k ? "on" : ""} onClick={() => setScope(k)}>{l}</button>)}
            </div>
            {scope === "uke" && (
              <div className="vp-seg sm" title="Bytt akse">
                {[["empday", "Ansatt × dag"], ["dayemp", "Dag × ansatt"]].map(([k, l]) => <button key={k} className={orient === k ? "on" : ""} onClick={() => setOrient(k)}>{l}</button>)}
              </div>
            )}
            {scope === "uke" && (
              <div className="vp-seg sm" title="Antall uker som skrives ut">
                {[[1, "1 uke"], [2, "2 uker"], [4, "4 uker"]].map(([k, l]) => <button key={k} className={weeks === k ? "on" : ""} onClick={() => setWeeks(k)}>{l}</button>)}
              </div>
            )}
            {scope === "maned" && (
              <div className="vp-seg sm" title="Vis per dag">
                {[["vakter", "Antall vakter"], ["ansatte", "Antall ansatte"]].map(([k, l]) => <button key={k} className={metric === k ? "on" : ""} onClick={() => setMetric(k)}>{l}</button>)}
              </div>
            )}
            <span style={{ flex: 1 }} />
            <span className="vp-print-hint">A4 · liggende</span>
            <button className="sk-primary" onClick={doPrint}><Ic n="download" s={15} /> Skriv ut / Lagre som PDF</button>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          <div className="vp-print-body">
            <div className="vp-print-sheet" id="vp-print-sheet">
              <div className="vp-print-head">
                <div className="vp-print-brand"><span className="vp-print-mark" /> Bistro Nord</div>
                <div className="vp-print-titleblock">
                  <h1>Vaktplan — {scope === "uke" ? (weeks > 1 ? `${weeks} uker` : meta.weekLabel) : "Måned"}</h1>
                  <div className="vp-print-sub">{scope === "uke" ? (weeks > 1 ? `Uke ${selWeeks[0].wk}–${selWeeks[selWeeks.length - 1].wk} · fra ${selWeeks[0].range.split(" – ")[0]}` : meta.dateRange) : "27. mai – 23. juni 2026 · 4 uker"} · Gruppert etter {meta.grouping}{meta.filters !== "alle" ? ` · ${meta.filters}` : ""}</div>
                </div>
                <div className="vp-print-meta">
                  <div><span className="k">Generert</span><span className="v">{gen}</span></div>
                  <div><span className="k">Av</span><span className="v">Maria A. · Driftsleder</span></div>
                </div>
              </div>

              {totalShifts === 0 ? (
                <div className="vp-print-empty"><Ic n="calendar" s={26} /><div className="t">Ingen vakter i utvalget</div><div className="s">Juster avdelingsfilter eller legg til vakter før eksport.</div></div>
              ) : scope === "uke" ? (
                /* ---- Week view — one labelled table per selected week ---- */
                selWeeks.map((w, wi) => (
                  <div key={w.wk} className={`vp-print-week ${wi > 0 ? "brk" : ""}`}>
                    {weeks > 1 && (
                      <div className="vp-print-weekhd">
                        <span className="wk">Uke {w.wk}</span>
                        <span className="rg">{w.range}</span>
                        {!w.active && <span className="tag">tom — klar til utfylling</span>}
                      </div>
                    )}
                    {weekTable(w.active ? shifts : [], w.active ? gaps : [])}
                  </div>
                ))
              ) : (
                /* ---- Month (4 weeks) ---- */
                <table className="vp-print-table month">
                  <thead><tr><th className="emp">Uke</th>{DAYS.map((d, i) => <th key={i} className={d.we ? "we" : ""}>{d.dn}</th>)}<th className="we">Sum</th></tr></thead>
                  <tbody>
                    {WEEKS.map(w => (
                      <tr key={w.wk} className={w.active ? "monthactive" : ""}>
                        <td className="emp"><span className="nm">Uke {w.wk}</span><span className="rl">{w.range}</span></td>
                        {DAYS.map((d, i) => {
                          const val = w.active ? (metric === "vakter" ? dayShifts(i).length : dayStaff(i)) : null;
                          return <td key={i} className={d.we ? "we" : ""}>{val ? <span className="vp-print-mcount">{val} {metric === "vakter" ? "vakter" : "ansatte"}</span> : <span className="vp-print-mempty">—</span>}</td>;
                        })}
                        <td className="we">{w.active ? <span className="totn">{metric === "vakter" ? totalShifts : emps.filter(e => shifts.some(s => s.e === e.id)).length}</span> : <span className="vp-print-mempty">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="vp-print-legend">
                {DEP_LEGEND.map(([l, c]) => <span key={l}><i style={{ background: c }} />{l}</span>)}
                <span className="vp-print-foot">Bistro Nord · Smartout · {scope === "uke" ? (weeks > 1 ? `${weeks} uker · ${totalShifts} vakter` : `${totalShifts} vakter`) : "4 uker"} · Generert {gen}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.VPPrint = Print;
})();
