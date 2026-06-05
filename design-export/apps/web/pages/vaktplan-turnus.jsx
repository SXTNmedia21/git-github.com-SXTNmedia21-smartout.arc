// ===== Vaktplan — Turnus Manager (multi-week rota builder + month overview) =====
// Loads after vaktplan-availability.jsx, before vaktplan.jsx. Exposes window.VPTurnus.
(function () {
  const { useState, useMemo, useRef } = React;
  const Ic = window.Ic;
  const VP = window.VP;
  const { DEPT, EMP, empById, DAYS } = VP;

  const LOCATIONS = [
    { id: "sal", name: "Sal A", dep: "sal", zone: "Hovedsal" },
    { id: "bar", name: "Bar", dep: "bar", zone: "Barområde" },
    { id: "kjokken", name: "Kjøkken", dep: "kjokken", zone: "Varm + kald sone" },
    { id: "ute", name: "Uteservering", dep: "event", zone: "Terrasse" },
  ];
  const ROLES = ["Driftsleder", "Kokk", "Servitør", "Vertinne", "Bartender"];
  const ROLE_DEP = { Driftsleder: "sal", Kokk: "kjokken", Servitør: "sal", Vertinne: "sal", Bartender: "bar" };
  const ROLE_DEMAND = { Driftsleder: 1, Kokk: 2, Servitør: 2, Vertinne: 1, Bartender: 1 };

  const WK_RANGES = { 22: "27. mai – 2. jun", 23: "3. – 9. juni", 24: "10. – 16. juni", 25: "17. – 23. juni", 26: "24. – 30. juni", 27: "1. – 7. juli" };
  const STATUS = { draft: ["Utkast", "draft"], ready: ["Klar", "ready"], published: ["Publisert", "published"], republish: ["Må republiseres", "republish"], empty: ["Tom", "empty"] };

  let _uid = 5000;

  function Turnus({ shifts, gaps, onOpenCtl, onOpenProfile, onPublish, onPrint, toast }) {
    const [sub, setSub] = useState("maned");     // maned | bygg
    const [grp, setGrp] = useState("ansatt");    // ansatt | jobb | lokasjon
    const [weeks, setWeeks] = useState([{ wk: 22, range: WK_RANGES[22], status: "published", own: false }]);
    const [collapsed, setCollapsed] = useState({});
    const [addOpen, setAddOpen] = useState(false);
    const [pickSrc, setPickSrc] = useState(false);   // "Kopier en bestemt uke" → week picker
    const addRef = useRef(null);

    const weekShifts = (w) => w.own ? w.shifts : shifts;
    const weekGaps = (w) => w.own ? (w.gaps || []) : gaps;
    const totalHours = (ws) => ws.reduce((a, s) => a + (s.en - s.st), 0);

    const cols = useMemo(() => {
      if (grp === "jobb") return ROLES.map(r => ({ key: r, type: "job", role: r }));
      if (grp === "lokasjon") return LOCATIONS.map(l => ({ key: l.id, type: "loc", loc: l }));
      return EMP.map(e => ({ key: e.id, type: "emp", emp: e }));
    }, [grp]);

    const cellShifts = (ws, di, c) => {
      if (c.type === "emp") return ws.filter(s => s.e === c.emp.id && s.d === di);
      if (c.type === "job") return ws.filter(s => s.role === c.role && s.d === di);
      return ws.filter(s => s.dep === c.loc.dep && s.d === di);
    };

    const addWeek = (kind, srcWk) => {
      setAddOpen(false);
      setPickSrc(false);
      const nextWk = Math.max(...weeks.map(w => w.wk)) + 1;
      let ws = [], status = "draft";
      if (kind !== "scratch") {
        const srcW = (srcWk != null && weeks.find(w => w.wk === srcWk)) || weeks[weeks.length - 1];
        const src = weekShifts(srcW);
        const crumb = kind === "ai" ? "Foreslått av Botsson" : kind === "template" ? "Opprettet fra mal Standarduke" : ("Kopiert fra uke " + srcW.wk);
        ws = src.filter(s => !s.lock).map(s => {
          const pub = { kind: "new", changes: [{ t: crumb, who: kind === "ai" ? "Botsson" : "Maria A.", time: "nå", ai: kind === "ai" }] };
          return { ...s, id: "tw" + (++_uid), status: "draft", lc: "draft", lock: false, ok: false, pub: pub };
        });
        status = kind === "ai" ? "ready" : "draft";
      }
      const w = { wk: nextWk, range: WK_RANGES[nextWk] || ("Uke " + nextWk), status: ws.length ? status : "empty", own: true, shifts: ws, gaps: [], src: kind };
      setWeeks(prev => [...prev, w]);
      toast(kind === "scratch" ? `Uke ${nextWk} lagt til (tom)` : kind === "ai" ? `Uke ${nextWk} foreslått av Botsson` : `Uke ${nextWk} kopiert`, { undo: () => setWeeks(prev => prev.filter(x => x.wk !== nextWk)) });
    };
    const removeWeek = (wk) => {
      const prev = weeks;
      setWeeks(weeks.filter(w => w.wk !== wk));
      toast(`Uke ${wk} fjernet`, { undo: () => setWeeks(prev) });
    };

    // ---- month overview model (4 weeks) ----
    const MONTH = [22, 23, 24, 25].map(wk => {
      const w = weeks.find(x => x.wk === wk);
      if (!w) return { wk, range: WK_RANGES[wk], empty: true };
      const ws = weekShifts(w), wg = weekGaps(w);
      return {
        wk, range: w.range, status: w.status,
        days: DAYS.map((d, i) => { const n = ws.filter(s => s.d === i).length; const gap = wg.some(g => g.d === i); const draft = ws.some(s => s.d === i && (s.status === "draft" || s.status === "changed")); return { n, gap, draft, cov: gap ? "gap" : n >= 4 ? "ok" : n > 0 ? "thin" : "none" }; }),
        hours: totalHours(ws), gaps: wg.length, warns: wg.length + ws.filter(s => s.warn || s.status === "changed").length,
      };
    });

    const ADD_OPTS = [
      ["prev", "Kopier forrige uke", "copy", "Tar med vakter, roller, ansatte, tider og notater"],
      ["specific", "Kopier en bestemt uke", "layers", "Velg hvilken uke som skal kopieres"],
      ["scratch", "Start på nytt", "plus", "Tom uke uten vakter"],
      ["template", "Bruk mal", "file", "Standarduke for Bistro Nord"],
      ["ai", "AI-forslag", "sparkle", "La Botsson foreslå en balansert uke"],
    ];

    return (
      <div className="vpt">
        {/* header */}
        <div className="vpt-head">
          <div className="vp-seg">
            {[["maned", "Måned", "calendar"], ["bygg", "Bygg turnus", "layers"]].map(([k, l, ic]) => (
              <button key={k} className={sub === k ? "on" : ""} onClick={() => setSub(k)}><Ic n={ic} s={14} /> {l}</button>
            ))}
          </div>
          {sub === "bygg" && (
            <>
              <span className="vpt-div" />
              <span className="vpt-grplbl">Kolonner</span>
              <div className="vp-seg sm">
                {[["ansatt", "Ansatt"], ["jobb", "Jobb"], ["lokasjon", "Lokasjon"]].map(([k, l]) => <button key={k} className={grp === k ? "on" : ""} onClick={() => setGrp(k)}>{l}</button>)}
              </div>
              <span className="vpt-wkcount"><Ic n="layers" s={13} /> {weeks.length} {weeks.length === 1 ? "uke" : "uker"}</span>
            </>
          )}
          <span style={{ flex: 1 }} />
          <button className="sk-ghost" style={{ height: 32 }} onClick={onPrint}><Ic n="download" s={15} /> Skriv ut turnus</button>
          <button className="vp-publish" onClick={() => onPublish(null)}><Ic n="megaphone" s={15} /> Publiser</button>
        </div>

        {/* ---- MONTH OVERVIEW ---- */}
        {sub === "maned" ? (
          <div className="vpt-scroll">
            <div className="vpt-month">
              <div className="vpt-month-head">
                <div><div className="sk-eyebrow">Turnus · juni 2026</div><h2 className="vpt-month-title">Månedsoversikt</h2></div>
                <div className="vpt-month-legend">
                  <span><i style={{ background: "var(--success)" }} />Dekket</span>
                  <span><i style={{ background: "var(--warning)" }} />Stramt</span>
                  <span><i style={{ background: "var(--error)" }} />Hull</span>
                  <span><i style={{ background: "var(--orange)" }} />Utkast</span>
                </div>
              </div>
              <div className="vpt-month-grid">
                <div className="vpt-month-colhead"><span className="wkh">Uke</span>{DAYS.map((d, i) => <span key={i} className={`dh ${d.we ? "we" : ""}`}>{d.dn} <em>{d.num}</em></span>)}<span className="sumh">Sum</span></div>
                {MONTH.map(m => (
                  <div key={m.wk} className={`vpt-month-row ${m.empty ? "empty" : ""}`}>
                    <button className="vpt-month-wk" onClick={() => { if (!m.empty) { setSub("bygg"); setTimeout(() => { const el = document.getElementById("vpt-wk-" + m.wk); if (el) el.scrollIntoView({ block: "start" }); }, 60); } else { setSub("bygg"); } }}>
                      <span className="n">Uke {m.wk}</span><span className="r">{m.range}</span>
                      {!m.empty && <span className={`vpt-statuspill ${STATUS[m.status][1]}`}>{STATUS[m.status][0]}</span>}
                    </button>
                    {m.empty
                      ? DAYS.map((d, i) => <span key={i} className={`vpt-month-cell empty ${d.we ? "we" : ""}`}>—</span>)
                      : m.days.map((d, i) => (
                        <span key={i} className={`vpt-month-cell ${DAYS[i].we ? "we" : ""}`}>
                          {d.n > 0 ? <><span className={`vpt-cov ${d.cov}`} /><span className="cnt">{d.n}</span>{d.draft && <span className="vpt-draftdot" />}</> : <span className="vpt-month-none">·</span>}
                        </span>
                      ))}
                    {m.empty ? <span className="vpt-month-cell empty">—</span> : <span className="vpt-month-cell sum"><b>{m.hours}t</b>{m.warns > 0 && <span className="vpt-month-warn"><Ic n="alert" s={10} /> {m.warns}</span>}</span>}
                  </div>
                ))}
              </div>
              <div className="vpt-month-foot">
                <span><Ic n="sparkle" s={13} c="var(--orange)" /> Botsson: uke 22 er publisert og balansert. Uke 23–25 er ikke planlagt ennå — start fra forrige uke for et raskt utkast.</span>
                <button className="sk-primary" style={{ height: 32 }} onClick={() => setSub("bygg")}><Ic n="layers" s={14} /> Åpne turnusbygger</button>
              </div>
            </div>
          </div>
        ) : (
          /* ---- MULTI-WEEK BUILDER ---- */
          <div className="vpt-scroll">
            {weeks.map(w => {
              const ws = weekShifts(w), wg = weekGaps(w);
              const isCol = collapsed[w.wk];
              const drafts = ws.filter(s => s.status === "draft" || s.status === "changed").length;
              return (
                <div key={w.wk} id={"vpt-wk-" + w.wk} className="vpt-week">
                  <div className="vpt-week-head">
                    <button className="vpt-week-collapse" onClick={() => setCollapsed(c => ({ ...c, [w.wk]: !c[w.wk] }))}><Ic n={isCol ? "chevRight" : "chevDown"} s={16} /></button>
                    <div className="vpt-week-id"><span className="wk">Uke {w.wk}</span><span className="rg">{w.range}</span></div>
                    <span className={`vpt-statuspill ${STATUS[w.status][1]}`}>{STATUS[w.status][0]}</span>
                    {w.src && w.src !== "scratch" && <span className="vpt-srcpill"><Ic n={w.src === "ai" ? "sparkle" : "copy"} s={11} /> {w.src === "ai" ? "AI-forslag" : w.src === "template" ? "Fra mal" : "Kopiert"}</span>}
                    <span className="vpt-week-prog">{ws.length} vakter · {totalHours(ws)}t{drafts ? ` · ${drafts} utkast` : ""}{wg.length ? ` · ${wg.length} hull` : ""}</span>
                    <span style={{ flex: 1 }} />
                    {drafts > 0 && <button className="vpt-week-pub" onClick={() => onPublish(null)}><Ic n="megaphone" s={13} /> Publiser uke</button>}
                    {w.own && <button className="vpt-week-x" onClick={() => removeWeek(w.wk)} title="Fjern uke"><Ic n="trash" s={14} /></button>}
                  </div>

                  {!isCol && (ws.length === 0 && w.status === "empty" ? (
                    <div className="vpt-week-empty">
                      <span className="ic"><Ic n="calendar" s={22} /></span>
                      <div className="t">Tom uke</div>
                      <div className="s">Ingen vakter ennå. Kopier en uke eller legg til vakter dag for dag.</div>
                      <button className="sk-ghost" style={{ height: 32 }} onClick={() => addWeek("prev")}><Ic n="copy" s={14} /> Kopier forrige uke hit</button>
                    </div>
                  ) : (
                    <div className="vpt-grid-wrap">
                      <div className="vpt-grid" style={{ gridTemplateColumns: `92px repeat(${cols.length}, minmax(116px, 1fr))` }}>
                        {/* col headers */}
                        <div className="vpt-grid-corner">{grp === "ansatt" ? "Ansatt →" : grp === "jobb" ? "Jobb →" : "Lokasjon →"}<span className="sub">Dag ↓</span></div>
                        {cols.map(c => <ColHead key={c.key} c={c} ws={ws} onOpenProfile={onOpenProfile} />)}
                        {/* day rows */}
                        {DAYS.map((d, di) => (
                          <React.Fragment key={di}>
                            <div className={`vpt-day ${d.today ? "today" : ""} ${d.we ? "we" : ""}`}><span className="dn">{d.dn}</span><span className="dnum">{d.num}/{d.mon}</span></div>
                            {cols.map(c => {
                              const ss = cellShifts(ws, di, c);
                              return (
                                <div key={c.key} className={`vpt-cell ${d.we ? "we" : ""}`}>
                                  {ss.map(s => (
                                    <button key={s.id} className={`vpt-chip ${s.status === "draft" ? "draft" : s.status === "changed" ? "changed" : ""} ${s.lock ? "locked" : ""}`} style={{ "--dep": DEPT[s.dep].c }} onClick={() => onOpenCtl(s, s.lock ? "livslop" : "detaljer")}>
                                      <span className="r">{c.type === "emp" ? s.role : c.type === "job" ? (empById(s.e) ? empById(s.e).name.split(" ")[0] : "Åpen") : (empById(s.e) ? empById(s.e).init : "—")}</span>
                                      <span className="t">{s.t}</span>
                                      {s.lock && <span className="lk"><Ic n="lock" s={9} /></span>}
                                    </button>
                                  ))}
                                  <button className="vpt-add" onClick={() => onOpenCtl(null, "detaljer", { d: di, dep: c.type === "loc" ? c.loc.dep : c.type === "job" ? ROLE_DEP[c.role] : c.emp.dep })}><Ic n="plus" s={14} /></button>
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* add week */}
            <div className="vpt-addbar" ref={addRef}>
              <button className="vpt-addweek" onClick={() => { setAddOpen(o => !o); setPickSrc(false); }} disabled={weeks.length >= 12}><Ic n="plus" s={16} /> Legg til uke {weeks.length >= 12 ? "(maks 12)" : ""}</button>
              {addOpen && (
                <div className="vpt-addmenu">
                  {pickSrc ? (
                    <>
                      <div className="vpt-addmenu-h"><button className="vpt-addback" onClick={() => setPickSrc(false)}><Ic n="chevLeft" s={14} /></button> Hvilken uke skal kopieres?</div>
                      {weeks.map(w => {
                        const n = weekShifts(w).filter(s => !s.lock).length;
                        return (
                          <button key={w.wk} className="vpt-addopt" disabled={n === 0} onClick={() => addWeek("specific", w.wk)}>
                            <span className="ic"><Ic n="layers" s={15} /></span>
                            <span className="b"><span className="t">Uke {w.wk}</span><span className="d">{w.range} · {n} {n === 1 ? "vakt" : "vakter"}</span></span>
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <div className="vpt-addmenu-h">Hvordan skal uken lages?</div>
                      {ADD_OPTS.map(([k, l, ic, d]) => (
                        <button key={k} className="vpt-addopt" onClick={() => k === "specific" ? setPickSrc(true) : addWeek(k)}>
                          <span className="ic"><Ic n={ic} s={15} /></span>
                          <span className="b"><span className="t">{l}</span><span className="d">{d}</span></span>
                          {k === "specific" && <Ic n="chevRight" s={14} c="var(--muted-soft)" />}
                          {k === "ai" && <span className="vpt-addai">AI</span>}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function ColHead({ c, ws, onOpenProfile }) {
    if (c.type === "emp") {
      const e = c.emp;
      const hrs = ws.filter(s => s.e === e.id).reduce((a, s) => a + (s.en - s.st), 0);
      const over = hrs > e.contract;
      return (
        <div className="vpt-colhead emp" onClick={() => onOpenProfile(e.id, "avtale")} title={`Profil · ${e.name}`}>
          <span className="vp-emp-av" style={{ width: 26, height: 26, background: e.c, fontSize: 10 }}>{e.init}</span>
          <span className="vpt-ch-id"><span className="nm">{e.name.split(" ")[0]} {e.name.split(" ")[1] || ""}</span><span className="rl">{e.role}</span></span>
          <span className={`vpt-ch-hrs ${over ? "over" : ""}`}>{hrs}/{e.contract}t</span>
        </div>
      );
    }
    if (c.type === "job") {
      const filled = ws.filter(s => s.role === c.role).length;
      const demand = ROLE_DEMAND[c.role] * 5;
      const miss = Math.max(0, demand - filled);
      return (
        <div className="vpt-colhead job">
          <span className="vpt-ch-jobic" style={{ background: DEPT[ROLE_DEP[c.role]].c }}><Ic n="cap" s={13} /></span>
          <span className="vpt-ch-id"><span className="nm">{c.role}</span><span className="rl">{filled} planlagt{miss ? ` · ${miss} mangler` : ""}</span></span>
          {miss > 0 && <span className="vpt-ch-warn"><Ic n="alert" s={12} /></span>}
        </div>
      );
    }
    const loc = c.loc;
    const cnt = ws.filter(s => s.dep === loc.dep).length;
    return (
      <div className="vpt-colhead loc">
        <span className="vpt-ch-jobic" style={{ background: DEPT[loc.dep].c }}><Ic n="mappin" s={13} /></span>
        <span className="vpt-ch-id"><span className="nm">{loc.name}</span><span className="rl">{loc.zone} · {cnt} vakter</span></span>
      </div>
    );
  }

  window.VPTurnus = Turnus;
})();
