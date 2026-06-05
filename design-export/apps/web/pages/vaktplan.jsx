// ===== Vaktplan — manager scheduling cockpit (page) =====
// Registers window.SO_PAGES.vaktplan. Depends on pages/vaktplan-parts.jsx (window.VP, VP* overlays).
(function () {
  const { useState, useMemo, useEffect } = React;
  const Ic = window.Ic;
  const VP = window.VP;
  const Av = window.VPAv;
  const { DEPT, EMP, empById, DAYS, TODAY, COV } = VP;

  const dnLong = { Man: "Mandag", Tir: "Tirsdag", Ons: "Onsdag", Tor: "Torsdag", Fre: "Fredag", Lør: "Lørdag", Søn: "Søndag" };

  // ---------- shift chip ----------
  function Chip({ s, onEdit, onCopy, onLifecycle }) {
    const e = empById(s.e);
    const locked = !!s.lock;
    const [tip, setTip] = useState(null);
    const stateLbl = s.lock ? "Avregnet · låst" : s.status === "draft" ? "Utkast" : s.status === "changed" ? "Endret — må publiseres" : s.lc === "active" ? "Aktiv nå" : "Publisert";
    const stateCls = s.lock ? "muted" : s.status === "draft" ? "draft" : s.status === "changed" ? "warn" : s.lc === "active" ? "active" : "ok";
    const show = (ev) => { const r = ev.currentTarget.getBoundingClientRect(); setTip({ x: r.left + r.width / 2, y: r.top - 8 }); };
    return (
      <div className={`vp-chip ${s.status === "draft" ? "draft" : ""} ${s.status === "changed" ? "changed" : ""} ${locked ? "locked" : ""}`} style={{ "--dep": DEPT[s.dep].c }}
        onClick={() => locked ? onLifecycle(s) : onEdit(s)} onMouseEnter={show} onMouseLeave={() => setTip(null)}>
        <span className="vp-chip-flags">
          {s.lock && <span className="vp-chip-flag lock"><Ic n="lock" s={10} /></span>}
          {s.status === "changed" && <span className="vp-chip-flag warn"><Ic n="megaphone" s={10} /></span>}
          {s.warn && <span className="vp-chip-flag warn"><Ic n="alert" s={10} /></span>}
          {s.ok && <span className="vp-chip-flag ok"><Ic n="check" s={10} sw={2.6} /></span>}
        </span>
        <span className="vp-chip-role">{s.role}</span>
        <span className="vp-chip-time">{s.t}</span>
        {!locked && (
          <span className="vp-chip-qa">
            <button title="Rediger" onClick={(ev) => { ev.stopPropagation(); onEdit(s); }}><Ic n="pen" s={12} /></button>
            <button title="Kopier" onClick={(ev) => { ev.stopPropagation(); onCopy(s); }}><Ic n="copy" s={12} /></button>
            <button title="Livsløp" onClick={(ev) => { ev.stopPropagation(); onLifecycle(s); }}><Ic n="layers" s={12} /></button>
          </span>
        )}
        {tip && (
          <div className="vp-chip-tip" style={{ left: tip.x, top: tip.y }} onMouseEnter={() => setTip(null)}>
            <div className="vp-chip-tip-h"><span className="dep" style={{ background: DEPT[s.dep].c }} />{s.role}<span className={`vp-chip-tip-st ${stateCls}`}>{stateLbl}</span></div>
            <div className="vp-chip-tip-emp">{e ? <><span className="vp-emp-av" style={{ width: 20, height: 20, background: e.c, fontSize: 9 }}>{e.init}</span> {e.name}</> : <><Ic n="user" s={13} c="var(--error)" /> Åpen vakt</>}</div>
            <div className="vp-chip-tip-rows">
              <span><Ic n="clock" s={11} /> {s.t} · {s.en - s.st}t</span>
              <span><Ic n="mappin" s={11} /> {DEPT[s.dep].name}</span>
              <span><Ic n="coffee" s={11} /> {s.en - s.st >= 6 ? "45" : "30"} min pause</span>
            </div>
            {s.warn && <div className="vp-chip-tip-warn"><Ic n="alert" s={11} /> {s.warn}</div>}
            <div className="vp-chip-tip-hint">Klikk for å {locked ? "se livsløp" : "redigere"}</div>
          </div>
        )}
      </div>
    );
  }

  function VaktplanPage({ setRoute }) {
    const toast = window.useToast();
    const [mode, setMode] = useState("vaktplan");     // vaktplan | vaktbors | bytter
    const [groupBy, setGroupBy] = useState("ansatt");  // ansatt | jobb | team
    const [deps, setDeps] = useState(new Set(Object.keys(DEPT)));
    const [shifts, setShifts] = useState([...VP.SHIFTS]);
    const [gaps, setGaps] = useState([...VP.GAPS]);
    const [inspDay, setInspDay] = useState(null);
    const [planner, setPlanner] = useState(false);
    const [shiftCtl, setShiftCtl] = useState(null); // { shift?, slot?, tab? }
    const openCtl = (shift, tab, slot) => setShiftCtl({ shift: shift || null, slot: slot || null, tab: tab || "detaljer" });
    // global «Skap → Vakt» opens the Shift Controller (Vaktkontroll) for a new shift
    useEffect(() => { if (window.__pendingCreate === "vakt") { window.__pendingCreate = null; setShiftCtl({ shift: null, slot: null, tab: "detaljer" }); } }, []);
    const [profile, setProfile] = useState(null); // { empId, section?, fit? }
    const openProfile = (empId, section, fit) => setProfile({ empId, section: section || "oversikt", fit: fit || null });
    const assignToShift = (empId, fit) => {      const ns = { id: "a" + Date.now(), e: empId, d: fit.d, role: fit.role, dep: fit.dep, t: fit.t, st: fit.st, en: fit.en, status: "draft", pub: { kind: "new", changes: [{ t: `Tildelt ${empById(empId) ? empById(empId).name : "ansatt"} fra profil`, who: "Maria A.", time: "nå" }] } };
      setShifts(s => [...s, ns]);
      setGaps(g => g.filter(x => !(x.d === fit.d && x.role === fit.role)));
      setProfile(null);
      toast(`${empById(empId).name.split(" ")[0]} tildelt ${fit.role} ${DAYS[fit.d].dn}`, { undo: () => setShifts(s => s.filter(x => x.id !== ns.id)) });
    };
    const offerFit = (o) => {
      const dmap = { Man: 0, Tir: 1, Ons: 2, Tor: 3, Fre: 4, Lør: 5, Søn: 6 };
      const d = dmap[o.day.split(" ")[0]] != null ? dmap[o.day.split(" ")[0]] : TODAY;
      const parts = o.t.split("–").map(x => parseInt(x));
      return { role: o.role, dep: o.dep, d, t: o.t, st: parts[0], en: parts[1] };
    };
    const [banner, setBanner] = useState(null);
    const [swapsDone, setSwapsDone] = useState({});
    const [offersDone, setOffersDone] = useState({});
    const [weekOff, setWeekOff] = useState(0);   // 0 = uke 22 (the live week)
    const MON = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"];
    const weekLabel = (() => {
      const s = new Date(2026, 4, 25); s.setDate(s.getDate() + weekOff * 7);
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return { range: `${s.getDate()}. ${MON[s.getMonth()]} – ${e.getDate()}. ${MON[e.getMonth()]}`, wk: 22 + weekOff };
    })();
    const shiftWeek = (d) => { setWeekOff((w) => { const n = w + d; toast(`Uke ${22 + n}`); return n; }); };
    const [pubScope, setPubScope] = useState(undefined); // undefined=closed | null=week | dayIdx
    const [printOpen, setPrintOpen] = useState(false);
    const [matchCtx, setMatchCtx] = useState(null);
    const [span, setSpan] = useState("1");          // 1 | 2 weeks
    const [density, setDensity] = useState({ count: true, bar: true, hours: true });
    const [densityOpen, setDensityOpen] = useState(false);
    const compact = !density.count && !density.bar && !density.hours;
    const W2 = [["Man", "3"], ["Tir", "4"], ["Ons", "5"], ["Tor", "6"], ["Fre", "7"], ["Lør", "8"], ["Søn", "9"]];
    const gridDays = span === "2"
      ? [...DAYS.map((d, i) => ({ ...d, src: i })), ...W2.map(([dn, num], i) => ({ dn, num, mon: "6", we: i >= 5, today: false, src: null, w2: true }))]
      : DAYS.map((d, i) => ({ ...d, src: i }));

    const drafts = shifts.filter(s => s.status === "draft");
    const changed = shifts.filter(s => s.status === "changed");
    const publishable = [...drafts, ...changed];
    const overtimeWarns = shifts.filter(s => s.warn).length;

    // build publish rows for the modal (assigned drafts/changed + any blocking open gap in scope)
    const buildPubRows = (scope) => {
      const inScope = (d) => scope == null || d === scope;
      const rows = shifts
        .filter(s => (s.status === "draft" || s.status === "changed") && inScope(s.d))
        .map(s => ({ id: s.id, e: s.e, role: s.role, dep: s.dep, d: s.d, t: s.t, pub: s.pub || { kind: s.status === "changed" ? "changed" : "new", changes: [{ t: "Vakt endret", who: "Maria A.", time: "nå" }] } }));
      gaps.filter(g => g.dep === "bar" && inScope(g.d)).forEach(g => rows.push({
        id: "gap-" + g.d + g.dep, e: "", role: g.role, dep: g.dep, d: g.d, t: g.t, ai: true,
        pub: { kind: "new", ai: true, issue: { sev: "block", text: "Ingen ansatt tildelt — kan ikke publiseres" }, changes: [{ t: "Foreslått av Botsson for å dekke bemanningshull", ai: true, time: "i dag 08:14" }, { t: "Mangler tildelt ansatt", sys: true, time: "i dag 08:14" }] },
      }));
      return rows;
    };
    const depOn = (d) => deps.has(d);
    const toggleDep = (d) => setDeps(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n.size ? n : prev; });

    const visShifts = shifts.filter(s => depOn(s.dep));

    // register structured context for Mr. Botsson (stable identifiers, no UI text)
    useEffect(() => {
      if (window.SmartoutContext) window.SmartoutContext.set({ route: "vaktplan", view: mode, week: "Uke 22", grouping: groupBy, filters: [...deps].map(d => DEPT[d].name), role: "Driftsleder", drafts: publishable.length });
      return () => { if (window.SmartoutContext) window.SmartoutContext.set({ route: null }); };
    }, [mode, groupBy, deps, publishable.length]);

    // group rows
    const groups = useMemo(() => {
      if (groupBy === "jobb") {
        const roles = [...new Set(EMP.map(e => e.role))];
        return roles.map(r => ({ label: r, emps: EMP.filter(e => e.role === r) }));
      }
      if (groupBy === "team") {
        return Object.keys(DEPT).map(d => ({ label: DEPT[d].name, dep: d, emps: EMP.filter(e => e.dep === d) })).filter(g => g.emps.length && depOn(g.dep));
      }
      return [{ label: null, emps: EMP }];
    }, [groupBy, deps]);

    // per-day coverage (gap-aware)
    const dayCov = (i) => {
      const hasGap = gaps.some(g => g.d === i);
      const pct = hasGap ? COV[i].pct : Math.max(COV[i].pct, 97);
      return { pct, hasGap, demand: COV[i].demand };
    };
    const dayHours = (i) => visShifts.filter(s => s.d === i).reduce((a, s) => a + (s.en - s.st), 0);
    const empHours = (id) => visShifts.filter(s => s.e === id).reduce((a, s) => a + (s.en - s.st), 0);

    // ---------- actions ----------
    const publish = (scope = null) => {
      const rows = buildPubRows(scope);
      if (!rows.length) { toast("Ingenting å publisere"); return; }
      setPubScope(scope);
    };
    const confirmPublish = (ids) => {
      const prev = shifts;
      setShifts(shifts.map(s => ids.includes(s.id) ? { ...s, status: undefined, lc: "published", pub: undefined, ok: false } : s));
      setBanner({ t: `${ids.length} ${ids.length === 1 ? "vakt" : "vakter"} publisert`, s: "De berørte ansatte er varslet og kan bekrefte i appen." });
      toast(`${ids.length} ${ids.length === 1 ? "vakt" : "vakter"} publisert`, { undo: () => { setShifts(prev); setBanner(null); } });
    };

    const saveShift = (data) => {
      if (data.id) {
        setShifts(shifts.map(s => {
          if (s.id !== data.id) return s;
          const wasPublished = !s.status && (s.lc === "published" || s.lc === "active");
          const crumbs = [];
          if (s.t !== data.t) crumbs.push({ t: `Tid endret fra ${String(s.st).padStart(2, "0")}:00–${String(s.en).padStart(2, "0")}:00 til ${String(data.st).padStart(2, "0")}:00–${String(data.en).padStart(2, "0")}:00`, who: "Maria A.", time: "nå" });
          if (s.e !== data.e) crumbs.push({ t: `Ansatt endret fra ${empById(s.e) ? empById(s.e).name : "Åpen vakt"} til ${empById(data.e) ? empById(data.e).name : "Åpen vakt"}`, who: "Maria A.", time: "nå" });
          if (s.role !== data.role) crumbs.push({ t: `Rolle endret fra ${s.role} til ${data.role}`, who: "Maria A.", time: "nå" });
          if (wasPublished) {
            crumbs.push({ t: "Avpublisert fordi vakten ble endret", sys: true, time: "nå" });
            return { ...s, ...data, status: "changed", pub: { kind: "changed", changes: crumbs.length ? crumbs : [{ t: "Vakt endret", who: "Maria A.", time: "nå" }] } };
          }
          const base = s.pub || { kind: "new", changes: [] };
          return { ...s, ...data, status: s.status || "draft", pub: { ...base, changes: [...base.changes, ...crumbs] } };
        }));
        toast("Vakt oppdatert", { undo: () => {} });
      } else {
        const ns = { ...data, id: "n" + Date.now(), pub: { kind: "new", changes: [{ t: "Ny vakt opprettet", who: "Maria A.", time: "nå" }] } };
        setShifts([...shifts, ns]);
        toast("Vakt lagt til som utkast", { undo: () => setShifts(sh => sh.filter(x => x.id !== ns.id)) });
      }
      setShiftCtl(null);
    };
    const deleteShift = (s) => {
      const prev = shifts;
      setShifts(shifts.filter(x => x.id !== s.id));
      setShiftCtl(null);
      toast("Vakt slettet", { undo: () => setShifts(prev) });
    };
    const copyShift = (s) => {
      const ns = { ...s, id: "c" + Date.now(), status: "draft", lc: "draft", lock: false, ok: false };
      setShifts([...shifts, ns]);
      toast("Vakt kopiert som utkast", { undo: () => setShifts(sh => sh.filter(x => x.id !== ns.id)) });
    };
    const fillGap = (g) => {
      const fit = { role: g.role, dep: g.dep, d: g.d, t: g.t, st: parseInt(g.t), en: parseInt(g.t.split("–")[1]), sick: g.sick };
      setMatchCtx(fit);
      setMode("tilgjengelighet");
      setInspDay(null);
    };

    const ctlAction = (type, data) => {
      const id = data.id;
      if (type === "publish" || type === "republish") {
        if (id) {
          const prev = shifts;
          setShifts(shifts.map(s => s.id === id ? { ...s, ...data, status: undefined, lc: "published", pub: undefined, ok: false } : s));
          toast(type === "republish" ? "Vakt republisert" : "Vakt publisert", { undo: () => setShifts(prev) });
        } else {
          const ns = { ...data, id: "n" + Date.now(), status: undefined, lc: "published" };
          setShifts([...shifts, ns]);
          toast("Vakt publisert", { undo: () => setShifts(sh => sh.filter(x => x.id !== ns.id)) });
        }
        setBanner({ t: "1 vakt publisert", s: "Den berørte ansatte er varslet." });
      } else if (type === "unpublish") {
        const prev = shifts;
        setShifts(shifts.map(s => s.id === id ? { ...s, status: "draft", lc: "published" } : s));
        toast("Vakt avpublisert", { undo: () => setShifts(prev) });
      } else if (type === "revert") {
        const prev = shifts;
        setShifts(shifts.map(s => s.id === id ? { ...s, status: undefined, pub: undefined } : s));
        toast("Endringer angret", { undo: () => setShifts(prev) });
      } else if (type === "duplicate") {
        copyShift(data); 
      } else if (type === "marketplace") {
        toast("Lagt ut på vaktbørs", { undo: () => {} }); setMode("vaktbors");
      } else if (type === "swap") {
        toast("Bytteforespørsel opprettet"); setMode("bytter");
      } else if (type === "sendupdate") {
        toast("Oppdatering sendt til ansatt");
      } else if (type === "approve") {
        toast("Vakt godkjent for lønn", { undo: () => {} });
      }
      setShiftCtl(null);
    };

    const acceptPlan = () => {
      const prevS = shifts, prevG = gaps;
      let next = shifts.map(s => {
        if (s.e === "ea" && s.d === 4) return { ...s, t: "16–22", st: 16, en: 22 };
        if (s.e === "pk" && s.d === 5) return { ...s, t: "16–22", st: 16, en: 22, warn: null };
        return s;
      });
      next = [...next,
        { id: "ai1", e: "jh", d: 4, role: "Bartender", dep: "bar", t: "17–23", st: 17, en: 23, lc: "published", ok: true },
        { id: "ai2", e: "ao", d: 6, role: "Kokk", dep: "kjokken", t: "12–20", st: 12, en: 20, lc: "published", ok: true },
      ];
      setShifts(next);
      setGaps([]);
      setPlanner(false);
      setBanner({ t: "AI-forslag tatt i bruk · 4 endringer", s: "Dekning hevet til 97 %. Endringene ligger som utkast — husk å publisere." });
      toast("AI-forslag tatt i bruk", { undo: () => { setShifts(prevS); setGaps(prevG); setBanner(null); } });
    };

    const [swapModal, setSwapModal] = useState(null);
    const resolveSwap = (id, ok, opts = {}) => {
      setSwapsDone(d => ({ ...d, [id]: ok ? "approved" : "declined" }));
      setSwapModal(null);
      toast(ok ? (opts.notify === false ? "Bytte godkjent" : "Bytte godkjent — begge varslet") : "Bytte avslått", { undo: () => setSwapsDone(d => ({ ...d, [id]: undefined })) });
    };
    const [offerModal, setOfferModal] = useState(null);
    const [assignModal, setAssignModal] = useState(null); // { empId, fit }
    // assignment from Availability now goes through the offer/ranking modal (message + window + adjustments)
    const requestAssign = (empId, fit) => setAssignModal({ empId, fit });
    const confirmAssign = (empId, fit) => {
      const ns = { id: "a" + Date.now(), e: empId, d: fit.d, role: fit.role, dep: fit.dep, t: fit.t || `${fit.st}–${fit.en}`, st: fit.st, en: fit.en, status: "draft", pub: { kind: "new", changes: [{ t: `Tildelt ${empById(empId) ? empById(empId).name : "ansatt"}${fit.auto ? ` · svarfrist ${fit.auto}t` : ""}`, who: "Maria A.", time: "nå" }] } };
      setShifts(s => [...s, ns]);
      setGaps(g => g.filter(x => !(x.d === fit.d && x.role === fit.role)));
      setMatchCtx(null);
      setAssignModal(null);
      const nm = empById(empId) ? empById(empId).name.split(" ")[0] : "ansatt";
      toast(fit.auto ? `Sendt til ${nm} — svarfrist ${fit.auto}t` : `${nm} tildelt ${fit.role} ${DAYS[fit.d].dn}`, { undo: () => setShifts(s => s.filter(x => x.id !== ns.id)) });
    };
    const approveOffer = (id, empId, auto) => {
      setOffersDone(d => ({ ...d, [id]: { emp: empId, status: "pending", auto } }));
      const e = empById(empId);
      toast(`Sendt til ${e ? e.name.split(" ")[0] : "ansatt"} — venter bekreftelse`, { undo: () => setOffersDone(d => ({ ...d, [id]: undefined })) });
    };

    return (
      <div className="vp">
        {/* toolbar */}
        <div className="vp-bar">
          <div className="vp-seg">
            {[["vaktplan", "Vaktplan", "grid", 0], ["turnus", "Turnus", "layers", 0], ["tilgjengelighet", "Tilgjengelighet", "users", 0], ["vaktbors", "Vaktbørs", "route", VP.OFFERS.filter(o => !offersDone[o.id]).length], ["bytter", "Bytteforespørsler", "swap", VP.SWAPS.filter(s => !swapsDone[s.id]).length]].map(([k, l, ic, badge]) => (
              <button key={k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>
                <Ic n={ic} s={14} /> {l}{badge ? <span className="vp-segbadge">{badge}</span> : null}
              </button>
            ))}
          </div>
          <span className="vp-bar-sp" />
          {mode === "vaktplan" && (
            <>
              <div className="vp-weeknav">
                <button title="Forrige uke" onClick={() => shiftWeek(-1)}><Ic n="chevLeft" s={15} /></button>
                <span className="lbl">{weekLabel.range} <span className="wk">· Uke {weekLabel.wk}</span></span>
                <button title="Neste uke" onClick={() => shiftWeek(1)}><Ic n="chevRight" s={15} /></button>
              </div>
              <button className="vp-ai" onClick={() => setPlanner(true)}><Ic n="sparkle" s={15} /> AI-planlegger</button>
              <button className="sk-ghost" style={{ height: 32, width: 36, padding: 0, justifyContent: "center" }} title="Eksporter / Skriv ut" onClick={() => setPrintOpen(true)}><Ic n="download" s={16} /></button>
              <button className="vp-publish" onClick={() => publish(null)} disabled={!publishable.length}>
                <Ic n="megaphone" s={15} /> Publiser {publishable.length > 0 && <span className="vp-pcount">{publishable.length}</span>}
              </button>
            </>
          )}
        </div>

        {/* group-by sub bar (grid only) */}
        {mode === "vaktplan" && (
          <div className="vp-sub">
            <span className="vp-sub-lbl">Grupper</span>
            <div className="vp-grp">
              {[["ansatt", "Ansatt"], ["jobb", "Jobb"], ["team", "Team"]].map(([k, l]) => (
                <button key={k} className={groupBy === k ? "on" : ""} onClick={() => setGroupBy(k)}>{l}</button>
              ))}
            </div>
            <span className="vp-divider" />
            <div className="vp-chips">
              {Object.entries(DEPT).map(([k, d]) => (
                <button key={k} className={`vp-deptchip ${depOn(k) ? "on" : "off"}`} onClick={() => toggleDep(k)}>
                  <span className="d" style={{ background: d.c }} /> {d.name}
                </button>
              ))}
            </div>
            <span className="vp-bar-sp" style={{ flex: 1 }} />
            <div className="vp-seg sm">
              {[["1", "1 uke"], ["2", "2 uker"]].map(([k, l]) => <button key={k} className={span === k ? "on" : ""} onClick={() => setSpan(k)}>{l}</button>)}
            </div>
            <div style={{ position: "relative" }}>
              <button className={`vp-sub-cog ${densityOpen || compact ? "on" : ""}`} title="Visningstetthet" onClick={() => setDensityOpen(o => !o)}><Ic n="sliders" s={16} /></button>
              {densityOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 39 }} onClick={() => setDensityOpen(false)} />
                  <div className="vp-dens-pop">
                    <div className="sk-pop-sec">Vis i rad</div>
                    {[["count", "Vaktantall", "Antall vakter per rad/dag"], ["hours", "Timetotal", "Planlagte timer mot kontrakt"], ["bar", "Timeprogresjon", "Fremdriftslinje for timer"]].map(([k, t, s]) => (
                      <button key={k} className="vp-dens-row" onClick={() => setDensity(d => ({ ...d, [k]: !d[k] }))}>
                        <span className="vp-dens-t">{t}<span className="vp-dens-s">{s}</span></span>
                        <span className={`sk-switch ${density[k] ? "on" : ""}`}><span /></span>
                      </button>
                    ))}
                    <div className="sk-pop-div" />
                    <button className="sk-pop-item" onClick={() => setDensity({ count: false, bar: false, hours: false })}><Ic n="layers" s={15} c="var(--muted)" /> Kompakt visning</button>
                    <button className="sk-pop-item" onClick={() => setDensity({ count: true, bar: true, hours: true })}><Ic n="eye" s={15} c="var(--muted)" /> Vis alt</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* success banner */}
        {banner && (
          <div className="vp-banner">
            <span className="ic"><Ic n="check" s={18} sw={2.4} /></span>
            <div className="vp-banner-body"><div className="t">{banner.t}</div><div className="s">{banner.s}</div></div>
            <button className="x" onClick={() => setBanner(null)}><Ic n="x" s={15} /></button>
          </div>
        )}

        {/* body */}
        <div className="vp-scroll">
          {mode === "vaktplan" && (
            <div className={`vp-grid ${span === "2" ? "span2" : ""} ${compact ? "compact" : ""}`}>
              {/* head */}
              <div className="vp-grid-head">
                <div className="vp-cell-emp head">
                  <span className="vp-emp-htitle"><Ic n="users" s={13} /> Ansatte</span>
                  <span className="vp-emp-count">{EMP.length}</span>
                </div>
                {gridDays.map((d, i) => {
                  const c = d.src != null ? dayCov(d.src) : null;
                  return (
                    <div key={i} className={`vp-day-head ${d.we ? "we" : ""} ${d.today ? "today" : ""} ${d.w2 && i === 7 ? "w2start" : ""} ${d.w2 ? "w2" : ""}`} onClick={() => d.src != null && setInspDay(d.src)} title={d.src != null ? "Åpne dagsinspektør" : "Neste uke"}>
                      <div className="vp-dh-top">
                        <span className="vp-dh-dn">{d.dn}</span>
                        <span className="vp-dh-num">{d.num}</span>
                        {d.today && <span className="vp-dh-today">I DAG</span>}
                        {d.w2 && i === 7 && <span className="vp-dh-wklbl">Uke 23</span>}
                      </div>
                      {c ? (
                        <>
                          <div className="vp-dh-cov">
                            <span className="vp-dh-covbar"><span style={{ width: c.pct + "%", background: VP.COV_COLOR(c.pct) }} /></span>
                            <span className={`vp-dh-covtxt ${c.hasGap ? "gap" : ""}`}>{c.pct}%</span>
                          </div>
                          {density.count && (
                            <div className="vp-dh-meta">
                              <span>{visShifts.filter(s => s.d === d.src).length}/{c.demand} på vakt</span>
                              {c.hasGap && <span className="g">· 1 hull</span>}
                            </div>
                          )}
                        </>
                      ) : <div className="vp-dh-meta empty">Ikke planlagt</div>}
                    </div>
                  );
                })}
              </div>

              {/* group rows */}
              {groups.map((g, gi) => (
                <React.Fragment key={gi}>
                  {g.label && (
                    <div className="vp-row" style={{ gridTemplateColumns: "1fr" }}>
                      <div className="vp-cell-emp" style={{ position: "static", flexDirection: "row", alignItems: "center", gap: 8, gridColumn: "1 / -1", padding: "8px 14px", background: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                        {g.dep && <span style={{ width: 8, height: 8, borderRadius: "50%", background: DEPT[g.dep].c }} />}
                        <span className="vp-tot-lbl">{g.label}</span>
                        <span className="vp-emp-count">{g.emps.length}</span>
                      </div>
                    </div>
                  )}
                  {g.emps.map(emp => {
                    const hrs = empHours(emp.id);
                    const over = hrs > emp.contract;
                    const barPct = Math.min((hrs / emp.contract) * 100, 100);
                    const barColor = over ? "var(--warning)" : hrs >= emp.contract * 0.95 ? "var(--success)" : "var(--orange)";
                    return (
                      <div key={emp.id} className="vp-row">
                        <div className="vp-cell-emp">
                          <div className="vp-emp clickable" onClick={() => openProfile(emp.id, "oversikt")} title={`Åpne profil · ${emp.name}`}>
                            <Av e={emp} size={compact ? 22 : 30} />
                            <div className="vp-emp-id">
                              <div className="vp-emp-name">{emp.name}</div>
                              <div className="vp-emp-role">{emp.role}</div>
                            </div>
                          </div>
                          {(density.bar || density.count || density.hours) && (
                            <div className="vp-emp-hours">
                              {density.bar && <span className="vp-emp-bar"><span style={{ width: barPct + "%", background: barColor }} /></span>}
                              {(density.count || density.hours) && (
                                <span className="vp-emp-hrow">
                                  {density.count ? <span>{visShifts.filter(s => s.e === emp.id).length} vakter</span> : <span />}
                                  {density.hours && <span className={over ? "ot" : ""}>{hrs.toFixed(1)}/{emp.contract}t</span>}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {gridDays.map((d, gi) => {
                          const di = d.src;
                          const cell = di != null ? visShifts.filter(s => s.e === emp.id && s.d === di) : [];
                          return (
                            <div key={gi} className={`vp-cell ${d.we ? "we" : ""} ${d.w2 && gi === 7 ? "w2start" : ""}`}>
                              {cell.map(s => <Chip key={s.id} s={s} onEdit={(sh) => openCtl(sh, "detaljer")} onCopy={copyShift} onLifecycle={(sh) => openCtl(sh, "livslop")} />)}
                              {(d.w2 || di >= TODAY) && <button className="vp-add" onClick={() => openCtl(null, "detaljer", { d: di != null ? di : 0, dep: emp.dep })} title="Legg til vakt"><Ic n="plus" s={15} /></button>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* uncovered / open shifts row */}
              {gaps.some(g => depOn(g.dep)) && (
                <div className="vp-row" style={{ background: "rgba(231,0,11,0.025)" }}>
                  <div className="vp-cell-emp">
                    <div className="vp-emp">
                      <span className="vp-emp-av" style={{ width: 30, height: 30, background: "var(--bg)", color: "var(--error)", border: "1.5px dashed var(--error)" }}><Ic n="user" s={14} /></span>
                      <div className="vp-emp-id"><div className="vp-emp-name" style={{ color: "var(--error)" }}>Udekket</div><div className="vp-emp-role">åpne vakter</div></div>
                    </div>
                  </div>
                  {gridDays.map((d, gi) => {
                    const di = d.src;
                    const dg = di != null ? gaps.filter(g => g.d === di && depOn(g.dep)) : [];
                    return (
                      <div key={gi} className={`vp-cell ${d.we ? "we" : ""} ${d.w2 && gi === 7 ? "w2start" : ""}`}>
                        {dg.map((g, j) => (
                          <button key={j} className="vp-gap" onClick={() => fillGap(g)}>
                            <span className="r">{g.role}</span>
                            <span className="t">{g.t} · {DEPT[g.dep].name}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* totals */}
              <div className="vp-row totals">
                <div className="vp-cell-emp"><span className="vp-tot-lbl">Sum</span></div>
                {gridDays.map((d, gi) => d.src != null ? (
                  <div key={gi} className={`vp-tot ${dayCov(d.src).hasGap ? "gap" : ""} ${d.w2 && gi === 7 ? "w2start" : ""}`}>
                    <span className="v">{visShifts.filter(s => s.d === d.src).length}<span style={{ fontSize: 10, color: "var(--muted-soft)", fontWeight: 500 }}> p</span></span>
                    <span className="k">{dayHours(d.src)}t · {dayCov(d.src).pct}%</span>
                  </div>
                ) : <div key={gi} className={`vp-tot ${d.w2 && gi === 7 ? "w2start" : ""}`}><span className="v" style={{ color: "var(--muted-soft)" }}>—</span></div>)}
              </div>
            </div>
          )}

          {/* TURNUS MANAGER */}
          {mode === "turnus" && <window.VPTurnus shifts={visShifts} gaps={gaps} onOpenCtl={openCtl} onOpenProfile={openProfile} onPublish={publish} onPrint={() => setPrintOpen(true)} toast={toast} />}

          {/* TILGJENGELIGHET */}
          {mode === "tilgjengelighet" && <window.VPAvailability shifts={visShifts} gaps={gaps} matchCtx={matchCtx} onAssign={requestAssign} onOpenProfile={openProfile} onOpenShift={(id) => { const s = shifts.find(x => x.id === id); if (s) openCtl(s, "detaljer"); else toast("Fant ikke vakten"); }} onClearMatch={() => setMatchCtx(null)} toast={toast} />}

          {/* MARKETPLACE */}
          {mode === "vaktbors" && (
            <div className="vp-mkt">
              <div style={{ marginBottom: 16 }}>
                <div className="sk-eyebrow">Vaktbørs · Uke 22</div>
                <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 400, letterSpacing: "-0.02em", margin: "2px 0 6px" }}>Åpne vakter</h2>
                <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>Vakter som er lyst ut til kvalifiserte ansatte. Trykk <strong>Behandle</strong> for å se hvem som har meldt interesse, prioritere køen og sette automatisk tildeling — den tildelte bekrefter selv i appen.</p>
              </div>
              <div className="vp-mkt-grid">
                {VP.OFFERS.map(o => {
                  const done = offersDone[o.id];
                  return (
                    <div key={o.id} className={`vp-offer ${o.urgent ? "urgent" : ""} ${done ? "filled" : ""}`} onClick={() => openCtl(null, "detaljer", offerFit(o))} title="Åpne vaktkontroller" role="button" tabIndex={0}>
                      <div className="vp-offer-top">
                        <span className="vp-offer-dep" style={{ background: DEPT[o.dep].c }}><Ic n="grid" s={17} /></span>
                        <div className="vp-offer-id">
                          <div className="vp-offer-role">{o.role}</div>
                          <div className="vp-offer-meta">{o.day} · {o.t}</div>
                        </div>
                        {o.urgent && !done && <span className="vp-offer-urgent">Haster</span>}
                      </div>
                      <div className="vp-offer-line"><span className="ic"><Ic n="alert" s={14} /></span> {o.reason}</div>
                      <div className="vp-offer-claims">
                        {o.claims.length ? (
                          <>
                            <span className="so-av-stack">
                              {o.claims.map((c, i) => { const e = empById(c.id); return <span key={i} className="so-av" onClick={(ev) => { ev.stopPropagation(); e && openProfile(c.id, "oversikt", offerFit(o)); }} style={{ width: 26, height: 26, background: e ? e.c : "var(--muted)", cursor: e ? "pointer" : "default" }} title={e ? `Profil · ${e.name}` : "Ekstern"}>{e ? e.init : "?"}</span>; })}
                            </span>
                            <span className="lbl">{o.claims.length} har meldt interesse</span>
                          </>
                        ) : <span className="lbl"><Ic n="clock" s={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Ingen har meldt seg ennå</span>}
                      </div>
                      {done ? (
                        <span className="vp-offer-done pending"><Ic n="clock" s={14} /> Venter bekreftelse · {empById(done.emp) ? empById(done.emp).name.split(" ")[0] : "ansatt"}</span>
                      ) : (
                        <div className="vp-offer-foot">
                          <button className="ghost" onClick={(ev) => { ev.stopPropagation(); toast("Påminnelse sendt til kvalifiserte"); }}>Del på nytt</button>
                          <button className="approve" onClick={(ev) => { ev.stopPropagation(); setOfferModal(o); }}><Ic n="route" s={14} sw={2.3} /> Behandle{o.claims.length ? ` (${o.claims.length})` : ""}</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SWAP REQUESTS */}
          {mode === "bytter" && (
            <div className="vp-swaps">
              <div style={{ marginBottom: 2 }}>
                <div className="sk-eyebrow">Bytteforespørsler</div>
                <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 400, letterSpacing: "-0.02em", margin: "2px 0 6px" }}>Til godkjenning</h2>
                <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0, maxWidth: "62ch" }}>Botsson har sjekket regler og kvalifikasjoner. Du tar siste avgjørelse — ingen bytter gjennomføres uten din godkjenning.</p>
              </div>
              {VP.SWAPS.map(w => {
                const a = empById(w.from.id), b = empById(w.to.id);
                const done = swapsDone[w.id];
                return (
                  <div key={w.id} className={`vp-swap ${done ? "resolved" : ""}`} onClick={() => setSwapModal(w)} role="button" tabIndex={0} title="Åpne bytteforespørsel">
                    <div className="vp-swap-top">
                      <span className="vp-swap-kind">{w.kind}</span>
                      <span className="vp-swap-time">{w.time}</span>
                    </div>
                    <div className="vp-swap-trade">
                      <div className="vp-swap-side">
                        <div className="who clickable" onClick={(ev) => { ev.stopPropagation(); openProfile(w.from.id, "oversikt"); }}><Av e={a} size={22} /> {a.name}</div>
                        <div className="det">{w.from.role} · {w.from.day} · {w.from.t}</div>
                      </div>
                      <span className="vp-swap-arrow"><Ic n="swap" s={15} /></span>
                      <div className="vp-swap-side">
                        <div className="who clickable" onClick={(ev) => { ev.stopPropagation(); openProfile(w.to.id, "oversikt"); }}><Av e={b} size={22} /> {b.name}</div>
                        <div className="det">{w.to.role} · {w.to.day} · {w.to.t}</div>
                      </div>
                    </div>
                    <div className="vp-swap-note">{w.note}</div>
                    <div className="vp-swap-check">
                      {w.checks.map((c, i) => <div key={i} className="vp-swap-ck"><span className="ic"><Ic n="check" s={13} sw={2.6} /></span> {c}</div>)}
                    </div>
                    {done ? (
                      <span className="vp-swap-resolved"><Ic n={done === "approved" ? "check" : "x"} s={16} sw={2.3} /> {done === "approved" ? "Godkjent — begge er varslet" : "Avslått"}</span>
                    ) : (
                      <div className="vp-swap-foot">
                        <button className="approve" onClick={(ev) => { ev.stopPropagation(); setSwapModal(w); }}><Ic n="check" s={15} sw={2.3} /> Godkjenn bytte</button>
                        <button className="decline" onClick={(ev) => { ev.stopPropagation(); resolveSwap(w.id, false); }}>Avslå</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {VP.SWAPS.every(s => swapsDone[s.id]) && (
                <div className="vp-empty"><span className="ic"><Ic n="check" s={24} /></span><div className="t">Alt behandlet</div><div className="s">Ingen flere bytteforespørsler venter på deg.</div></div>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        {mode === "vaktplan" && (
          <div className="vp-foot">
            <span className={`vp-risk ${gaps.length ? "crit" : ""}`}><span className="dot" /> Dekningsrisiko <span className="n">{gaps.length}</span></span>
            <span className={`vp-risk ${overtimeWarns ? "warn" : ""}`}><span className="dot" /> Overtidsrisiko <span className="n">{overtimeWarns}</span></span>
            <span className="vp-risk"><span className="dot" /> AML-brudd <span className="n">0</span></span>
            <span className="vp-foot-sep" />
            <span className="vp-risk"><span className="dot" /> Ledige vakter <span className="n">{VP.OFFERS.filter(o => !offersDone[o.id]).length}</span></span>
            <span className="vp-bar-sp" />
            <span className="vp-statedot"><span className="sq" style={{ background: "var(--orange)" }} /> Utkast {drafts.length}</span>
            {changed.length > 0 && <span className="vp-statedot"><span className="sq" style={{ background: "var(--warning)" }} /> Må publiseres {changed.length}</span>}
            <span className="vp-statedot"><span className="sq" style={{ background: "var(--success)" }} /> Publisert {shifts.filter(s => !s.status && s.lc !== "active" && !s.lock).length}</span>
            <span className="vp-statedot"><span className="sq" style={{ background: "var(--info)" }} /> Aktiv {shifts.filter(s => s.lc === "active").length}</span>
            <span className="vp-statedot"><span className="sq" style={{ background: "var(--muted-soft)" }} /> Avregnet {shifts.filter(s => s.lock).length}</span>
          </div>
        )}

        {/* overlays */}
        {inspDay !== null && <window.VPInspector dayIdx={inspDay} onClose={() => setInspDay(null)} onPlanner={() => { setInspDay(null); setPlanner(true); }} onFillGap={fillGap} onPublishDay={() => { setInspDay(null); publish(inspDay); }} dayPub={buildPubRows(inspDay).filter(r => !(r.pub.issue && r.pub.issue.sev === "block")).length} onShift={(s, slot) => { setInspDay(null); s ? openCtl(s, s.lock ? "livslop" : "detaljer") : openCtl(null, "detaljer", slot); }} toast={toast} />}
        {planner && <window.VPPlanner onClose={() => setPlanner(false)} onAccept={acceptPlan} toast={toast} />}
        {shiftCtl && <window.VPController shift={shiftCtl.shift} slot={shiftCtl.slot} initialTab={shiftCtl.tab} onClose={() => setShiftCtl(null)} onOpenProfile={(id) => { setShiftCtl(null); openProfile(id); }} onSave={saveShift} onDelete={deleteShift} onAction={ctlAction} toast={toast} />}
        {profile && <window.VPProfile empId={profile.empId} section={profile.section} fit={profile.fit} onClose={() => setProfile(null)} onFullPlan={(id) => { setProfile(null); try { window.__openAnsattId = id || profile.empId; } catch (e) {} if (setRoute) setRoute("ansatte"); else toast("Åpner profil"); }} onOpenShift={(id) => { setProfile(null); toast("Åpner full plan for " + (empById(id) ? empById(id).name.split(" ")[0] : "ansatt")); }} onAssign={assignToShift} toast={toast} />}
        {offerModal && <window.VPOfferModal offer={offerModal} onClose={() => setOfferModal(null)} onAssign={(id, empId, auto) => { approveOffer(id, empId, auto); setOfferModal(null); }} openProfile={(id) => { setOfferModal(null); openProfile(id, "oversikt", offerFit(offerModal)); }} toast={toast} />}
        {assignModal && <window.VPAssignModal fit={assignModal.fit} empId={assignModal.empId} onClose={() => setAssignModal(null)} onAssign={confirmAssign} openProfile={(id) => { setAssignModal(null); openProfile(id, "oversikt"); }} toast={toast} />}
        {swapModal && <window.VPSwapModal swap={swapModal} resolved={swapsDone[swapModal.id]} onClose={() => setSwapModal(null)} onResolve={resolveSwap} openProfile={(id) => { setSwapModal(null); openProfile(id, "oversikt"); }} toast={toast} />}
        {printOpen && <window.VPPrint shifts={visShifts} groups={groups} gaps={gaps.filter(g => depOn(g.dep))} meta={{ weekLabel: "Uke 22", dateRange: "27. mai – 2. juni 2026", grouping: groupBy === "ansatt" ? "ansatt" : groupBy === "jobb" ? "jobb / vakttype" : "team", filters: deps.size === Object.keys(DEPT).length ? "alle" : [...deps].map(d => DEPT[d].name).join(", ") }} onClose={() => setPrintOpen(false)} />}
        {pubScope !== undefined && <window.VPPublishModal rows={buildPubRows(pubScope)} onConfirm={confirmPublish} onClose={() => setPubScope(undefined)} toast={toast} />}
      </div>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { vaktplan: VaktplanPage });
})();
