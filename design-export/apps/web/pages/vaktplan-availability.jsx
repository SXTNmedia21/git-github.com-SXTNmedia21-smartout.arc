// ===== Vaktplan — Tilgjengelighet (staff-first "skaff vikar" assignment surface) =====
// Loads after vaktplan-print.jsx, before vaktplan.jsx. Exposes window.VPAvailability.
(function () {
  const { useState, useMemo } = React;
  const Ic = window.Ic;
  const VP = window.VP;
  const { DEPT, EMP, empById, DAYS, TODAY } = VP;
  const WD = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
  const TODAY_DN = WD[TODAY];
  const SICK_TODAY = new Set(["ao"]);   // Anna meldt syk i dag
  const AV = window.VP_AVAIL || { preferred: { l: "Foretrukket", c: "var(--success)" }, available: { l: "Tilgjengelig", c: "var(--info)" }, conditional: { l: "Betinget", c: "var(--warning)" }, unavailable: { l: "Utilgjengelig", c: "var(--muted-soft)" } };

  const roleMatches = (need, role) => !need || need === role || (need === "Servitør" && ["Servitør", "Vertinne"].includes(role)) || (need === "Kokk" && role === "Kokk") || (need === "Bartender" && role === "Bartender");

  function Availability({ shifts, gaps, matchCtx, onAssign, onOpenProfile, onOpenShift, onClearMatch, toast }) {
    const [preset, setPreset] = useState(matchCtx ? "best" : "tilgjengelig");
    const [depFilter, setDepFilter] = useState(new Set());
    const [flags, setFlags] = useState(new Set()); // trenger, vil, rolle
    const [sel, setSel] = useState(matchCtx ? null : "sl");

    const getProfile = window.VPGetProfile;

    // per-employee derived model
    const rows = useMemo(() => EMP.map(e => {
      const p = getProfile(e.id);
      const availToday = SICK_TODAY.has(e.id) ? "sick" : (p.avail[TODAY_DN] || "available");
      const weekHrs = VP.SHIFTS.filter(s => s.e === e.id).reduce((a, s) => a + (s.en - s.st), 0);
      const missing = Math.max(0, p.hours.contracted - p.hours.scheduled);
      const extra = Math.max(0, p.hours.scheduled - p.hours.contracted);
      const wants = (p.requests || []).some(r => /turnus|børs|ønske/i.test(r.kind)) || missing >= 12;
      const needs = missing >= 8;
      const over = extra > 0 || weekHrs > e.contract;
      const reqPending = (p.requests || []).filter(r => r.status === "pending" || r.status === "needs-review").length;
      // fit for matchCtx
      let fit = null;
      if (matchCtx) {
        const conflict = VP.SHIFTS.find(s => s.e === e.id && s.d === matchCtx.d);
        const rm = roleMatches(matchCtx.role, e.role);
        const av = p.avail[WD[matchCtx.d]];
        const sick = SICK_TODAY.has(e.id);
        const unav = av === "unavailable" || sick;
        let verdict = "good", score = 100; const reasons = [];
        if (unav) { verdict = "no"; score = 0; reasons.push({ s: "block", t: sick ? "Meldt syk" : "Utilgjengelig denne dagen" }); }
        if (conflict) { verdict = "no"; score = 0; reasons.push({ s: "block", t: `Har ${conflict.role} ${conflict.t}` }); }
        if (!rm) { if (verdict !== "no") verdict = "warn"; score -= 40; reasons.push({ s: "warn", t: `Rolle: er ${e.role}` }); }
        if (av === "conditional" && verdict === "good") { verdict = "warn"; score -= 15; reasons.push({ s: "warn", t: "Betinget tilgjengelig" }); }
        if (verdict === "good") { reasons.push({ s: "ok", t: needs ? "Trenger timer — god fordeling" : "Ledig kapasitet" }); if (needs) score += 10; }
        fit = { verdict, score, reasons, rm, conflict: !!conflict, av };
      }
      return { e, p, availToday, weekHrs, missing, extra, wants, needs, over, reqPending, fit };
    }), [matchCtx]);

    // filter + sort
    let view = rows.filter(r => {
      if (depFilter.size && !depFilter.has(r.e.dep)) return false;
      if (flags.has("trenger") && !r.needs) return false;
      if (flags.has("vil") && !r.wants) return false;
      if (flags.has("rolle") && matchCtx && !roleMatches(matchCtx.role, r.e.role)) return false;
      return true;
    });
    const byAvail = (r) => ({ preferred: 0, available: 1, conditional: 2, unavailable: 3, sick: 4 }[r.availToday] ?? 3);
    if (preset === "tilgjengelig") view = view.filter(r => r.availToday !== "sick").sort((a, b) => byAvail(a) - byAvail(b));
    else if (preset === "trenger") view = view.sort((a, b) => b.missing - a.missing);
    else if (preset === "vil") view = view.filter(r => r.wants).sort((a, b) => b.missing - a.missing);
    else if (preset === "best" && matchCtx) view = view.sort((a, b) => (b.fit ? b.fit.score : 0) - (a.fit ? a.fit.score : 0));
    else if (preset === "syk") view = view.filter(r => r.availToday === "sick" || r.availToday === "unavailable");
    else if (preset === "over") view = view.filter(r => r.over).sort((a, b) => b.extra - a.extra);

    const PRESETS = [
      ["tilgjengelig", "Tilgjengelig nå", "check"],
      ["best", "Best match", "sparkle"],
      ["trenger", "Trenger timer", "trendUp"],
      ["vil", "Vil jobbe", "heart"],
      ["over", "Overbooket", "alert"],
      ["syk", "Syk / utilgjengelig", "thermometer"],
    ].filter(p => p[0] !== "best" || matchCtx);

    // open shifts for the side panel (gaps + marketplace offers)
    const openShifts = useMemo(() => {
      const dmap = { Man: 0, Tir: 1, Ons: 2, Tor: 3, Fre: 4, Lør: 5, Søn: 6 };
      const list = gaps.map(g => ({ id: "g" + g.d + g.dep, role: g.role, dep: g.dep, d: g.d, t: g.t, st: parseInt(g.t), en: parseInt(g.t.split("–")[1]), kind: g.sev === "crit" ? "Bemanningshull" : "Stramt", urgent: g.sev === "crit" }));
      (VP.OFFERS || []).forEach(o => { const d = dmap[o.day.split(" ")[0]] ?? TODAY; list.push({ id: o.id, role: o.role, dep: o.dep, d, t: o.t, st: parseInt(o.t), en: parseInt(o.t.split("–")[1]), kind: "Vaktbørs", urgent: o.urgent }); });
      return list;
    }, [gaps]);

    const selRow = view.find(r => r.e.id === sel) || rows.find(r => r.e.id === sel);
    const matchedOpen = selRow ? openShifts.filter(o => roleMatches(o.role, selRow.e.role)) : [];

    const FlagChip = ({ id, label }) => <button className={`vpa-flag ${flags.has(id) ? "on" : ""}`} onClick={() => setFlags(f => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); return n; })}>{label}</button>;

    return (
      <div className="vpa">
        {matchCtx && (
          <div className="vpa-pinned">
            <span className="vpa-pin-ic" style={{ background: DEPT[matchCtx.dep].c }}><Ic n="zap" s={16} /></span>
            <div className="vpa-pin-b">
              <div className="vpa-pin-t">Skaff vikar — {matchCtx.role}</div>
              <div className="vpa-pin-m">{DAYS[matchCtx.d].dn} {DAYS[matchCtx.d].num}/{DAYS[matchCtx.d].mon} · {matchCtx.t} · {DEPT[matchCtx.dep].name}{matchCtx.sick ? " · sykefravær" : ""}</div>
            </div>
            <span className="vpa-pin-ai"><Ic n="sparkle" s={12} /> Rangert av Botsson</span>
            <button className="vpa-pin-x" onClick={onClearMatch}><Ic n="x" s={15} /> Avslutt</button>
          </div>
        )}

        <div className="vpa-bar">
          <div className="vpa-presets">
            {PRESETS.map(([k, l, ic]) => <button key={k} className={preset === k ? "on" : ""} onClick={() => setPreset(k)}><Ic n={ic} s={13} /> {l}</button>)}
          </div>
          <div className="vpa-filters">
            {Object.entries(DEPT).map(([k, d]) => <button key={k} className={`vpa-dep ${depFilter.has(k) ? "on" : ""}`} onClick={() => setDepFilter(f => { const n = new Set(f); n.has(k) ? n.delete(k) : n.add(k); return n; })}><span className="dot" style={{ background: d.c }} /> {d.name}</button>)}
            <span className="vpa-div" />
            <FlagChip id="trenger" label="Trenger timer" />
            <FlagChip id="vil" label="Vil jobbe" />
            {matchCtx && <FlagChip id="rolle" label="Riktig rolle" />}
          </div>
        </div>

        <div className="vpa-split">
          {/* staff list */}
          <div className="vpa-list">
            <div className="vpa-listhead"><span>{view.length} ansatte</span><span className="vpa-listsub">{preset === "best" ? "Rangert etter match" : preset === "trenger" ? "Sortert etter manglende timer" : preset === "tilgjengelig" ? "Tilgjengelige først" : ""}</span></div>
            {view.length === 0 ? (
              <div className="vpa-empty"><span className="ic"><Ic n="users" s={22} /></span><div className="t">Ingen treff</div><div className="s">Ingen ansatte matcher valgt sortering og filter. Juster filtrene eller legg vakten på Vaktbørs.</div></div>
            ) : view.map(r => {
              const a = r.availToday === "sick" ? { l: "Syk", c: "var(--error)" } : AV[r.availToday] || AV.available;
              return (
                <div key={r.e.id} className={`vpa-row ${sel === r.e.id ? "on" : ""} ${r.availToday === "sick" ? "sick" : ""}`} onClick={() => setSel(r.e.id)}>
                  {matchCtx && r.fit && <span className={`vpa-fitbadge ${r.fit.verdict}`}>{r.fit.verdict === "good" ? "God" : r.fit.verdict === "warn" ? "OK*" : "Nei"}</span>}
                  <button className="vpa-rowav" onClick={(ev) => { ev.stopPropagation(); onOpenProfile(r.e.id, "tilgj"); }} title="Åpne profil · Tilgjengelighet"><span className="vp-emp-av" style={{ width: 38, height: 38, background: r.e.c, fontSize: 13 }}>{r.e.init}</span></button>
                  <div className="vpa-rowid">
                    <div className="vpa-rowname" onClick={(ev) => { ev.stopPropagation(); onOpenProfile(r.e.id, "tilgj"); }} title="Åpne profil · Tilgjengelighet">{r.e.name}</div>
                    <div className="vpa-rowrole"><span className="dot" style={{ background: DEPT[r.e.dep].c }} /> {r.e.role} · {DEPT[r.e.dep].name}</div>
                  </div>
                  <div className="vpa-rowavail"><span className="vpa-avpill" style={{ color: a.c, background: `color-mix(in oklab, ${a.c} 14%, var(--card))` }}><span className="dot" style={{ background: a.c }} /> {a.l}</span><span className="vpa-next">{r.p.hours.next !== "—" ? "Neste: " + r.p.hours.next.replace(" · ", " ") : "Ingen vakt"}</span></div>
                  <div className="vpa-rowhrs">
                    <div className="vpa-hbar"><span style={{ width: Math.min(r.p.hours.scheduled / r.p.hours.contracted * 100, 100) + "%", background: r.over ? "var(--warning)" : r.needs ? "var(--error)" : "var(--success)" }} /></div>
                    <div className="vpa-hlbl"><span className="mono">{r.p.hours.scheduled}/{r.p.hours.contracted}t</span>{r.missing > 0 ? <span className="miss">−{r.missing}t</span> : r.extra > 0 ? <span className="extra">+{r.extra}t</span> : <span className="ok">i mål</span>}</div>
                  </div>
                  <div className="vpa-rowtags">
                    {r.availToday === "sick" && <span className="vpa-tag err"><Ic n="thermometer" s={11} /> Syk</span>}
                    {r.wants && <span className="vpa-tag info"><Ic n="heart" s={11} /> Vil jobbe</span>}
                    {r.reqPending > 0 && <span className="vpa-tag warn">{r.reqPending} forespørsel</span>}
                  </div>
                  <div className="vpa-rowact">
                    {matchCtx
                      ? <button className={`vpa-assign ${r.fit && r.fit.verdict === "no" ? "dis" : r.fit && r.fit.verdict === "warn" ? "warn" : ""}`} disabled={r.fit && r.fit.verdict === "no"} onClick={(ev) => { ev.stopPropagation(); onAssign(r.e.id, matchCtx); }}>{r.fit && r.fit.verdict === "no" ? "Ikke ledig" : "Tildel"}</button>
                      : <button className="vpa-assign ghost" onClick={(ev) => { ev.stopPropagation(); setSel(r.e.id); }}><Ic n="calendar" s={13} /> Se vakter</button>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* side panel */}
          <aside className="vpa-side">
            {matchCtx && selRow && selRow.fit ? (
              <>
                <div className="vpa-side-h">Hvorfor {selRow.e.name.split(" ")[0]}?</div>
                <div className={`vpa-fit ${selRow.fit.verdict}`}>
                  <span className="vpa-fit-ic"><Ic n={selRow.fit.verdict === "good" ? "check" : selRow.fit.verdict === "warn" ? "alert" : "ban"} s={15} sw={selRow.fit.verdict === "good" ? 2.4 : 1.8} /></span>
                  <span className="vpa-fit-v">{selRow.fit.verdict === "good" ? "God match" : selRow.fit.verdict === "warn" ? "Mulig — med forbehold" : "Ikke tilgjengelig"}</span>
                </div>
                <div className="vpa-checks">
                  {[["Tilgjengelig", selRow.fit.av !== "unavailable" && selRow.availToday !== "sick"], ["Riktig rolle", selRow.fit.rm], ["Ingen konflikt", !selRow.fit.conflict], ["Hjelper timebalanse", selRow.needs]].map(([l, ok]) => (
                    <div key={l} className={`vpa-check ${ok ? "ok" : "no"}`}><Ic n={ok ? "check" : "x"} s={12} sw={2.4} /> {l}</div>
                  ))}
                </div>
                {selRow.fit.reasons.filter(x => x.s !== "ok").map((x, i) => <div key={i} className={`vpa-reason ${x.s}`}><Ic n={x.s === "block" ? "ban" : "alert"} s={12} /> {x.t}</div>)}
                <button className="vpa-side-assign" disabled={selRow.fit.verdict === "no"} onClick={() => onAssign(selRow.e.id, matchCtx)}><Ic n="check" s={15} sw={2.2} /> Tildel {selRow.e.name.split(" ")[0]} vakten</button>
                <button className="vpa-side-prof" onClick={() => onOpenProfile(selRow.e.id, "avtale")}><Ic n="user" s={14} /> Se avtale & tilgjengelighet</button>
              </>
            ) : selRow ? (
              <>
                <div className="vpa-side-emp">
                  <span className="vp-emp-av" style={{ width: 34, height: 34, background: selRow.e.c, fontSize: 12 }}>{selRow.e.init}</span>
                  <div><div className="nm">{selRow.e.name}</div><div className="rl">{selRow.e.role} · {selRow.missing > 0 ? `mangler ${selRow.missing}t` : "i mål"}</div></div>
                </div>
                {(() => { const ownShifts = VP.SHIFTS.filter(s => s.e === selRow.e.id); return (
                  <>
                    <div className="vpa-side-h">Vaktene til {selRow.e.name.split(" ")[0]} · uke 22 <span className="cnt">{ownShifts.length}</span></div>
                    {ownShifts.length === 0 ? (
                      <div className="vpa-empty mini"><span className="ic"><Ic n="calendar" s={20} /></span><div className="t">Ingen vakter</div><div className="s">{selRow.e.name.split(" ")[0]} har ingen planlagte vakter denne uka.</div></div>
                    ) : (
                      <div className="vpa-ownshifts">
                        {ownShifts.map(s => (
                          <button key={s.id} className="vpa-ownshift" onClick={() => onOpenShift(s.id)} title="Åpne vakten">
                            <span className="vpa-os-dep" style={{ background: DEPT[s.dep].c }}><Ic n="grid" s={13} /></span>
                            <div className="vpa-os-b"><div className="vpa-os-t">{s.role}</div><div className="vpa-os-m">{DAYS[s.d].dn} {DAYS[s.d].num}/{DAYS[s.d].mon} · {s.t}</div></div>
                            {s.lock ? <span className="vpa-ownlock"><Ic n="lock" s={12} /></span> : <Ic n="chevRight" s={15} c="var(--muted-soft)" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ); })()}
                <div className="vpa-side-h">Åpne vakter som passer <span className="cnt">{matchedOpen.length}</span></div>
                {matchedOpen.length === 0 ? (
                  <div className="vpa-empty mini"><span className="ic"><Ic n="check" s={20} /></span><div className="t">Ingen åpne vakter</div><div className="s">Ingen ledige vakter matcher {selRow.e.name.split(" ")[0]} sin rolle akkurat nå.</div></div>
                ) : matchedOpen.map(o => {
                  const conflict = VP.SHIFTS.find(s => s.e === selRow.e.id && s.d === o.d);
                  const av = selRow.p.avail[WD[o.d]];
                  const warn = conflict || av === "unavailable" || selRow.availToday === "sick";
                  return (
                    <div key={o.id} className={`vpa-openshift ${o.urgent ? "urgent" : ""}`}>
                      <span className="vpa-os-dep" style={{ background: DEPT[o.dep].c }}><Ic n="grid" s={14} /></span>
                      <div className="vpa-os-b">
                        <div className="vpa-os-t">{o.role} {o.urgent && <span className="vpa-os-urgent">Haster</span>}</div>
                        <div className="vpa-os-m">{DAYS[o.d].dn} {DAYS[o.d].num}/{DAYS[o.d].mon} · {o.t} · {o.kind}</div>
                        {warn && <div className="vpa-os-warn"><Ic n="alert" s={11} /> {conflict ? `Konflikt: ${conflict.role} ${conflict.t}` : av === "unavailable" ? "Utilgjengelig denne dagen" : "Meldt syk i dag"}</div>}
                      </div>
                      <button className="vpa-os-assign" disabled={!!warn} onClick={() => onAssign(selRow.e.id, o)}>Tildel</button>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="vpa-side-hint"><span className="ic"><Ic n="users" s={22} /></span><div className="t">Velg en ansatt</div><div className="s">Velg en ansatt for å se åpne vakter som passer{matchCtx ? ", eller tildel direkte fra lista" : ""}.</div></div>
            )}
          </aside>
        </div>
      </div>
    );
  }

  window.VPAvailability = Availability;
})();
