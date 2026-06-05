// ===== Planlegging — global calendar command center (page) =====
// Registers window.SO_PAGES.planlegging. Depends on planlegging-data/views/panels.
(function () {
  const { useState, useEffect, useMemo, useRef } = React;
  const Ic = window.Ic;
  const PL = window.PL;
  const V = window.PLViews;
  const P = window.PLPanels;

  const VIEWS = [
    { id: "day", label: "Dag", icon: "clock" },
    { id: "week", label: "Uke", icon: "calendar" },
    { id: "month", label: "Måned", icon: "grid" },
    { id: "agenda", label: "Agenda", icon: "list" },
    { id: "year", label: "År", icon: "wheel" },
  ];
  const emptySets = () => ({ location: new Set(), dept: new Set(), role: new Set(), bstatus: new Set(), lstatus: new Set() });

  function PlanleggingPage({ setRoute }) {
    const toast = window.useToast();
    const [view, setView] = useState("week");
    const [show, setShow] = useState({ shift: true, booking: true, event: true, leave: true, hours: true, season: true });
    const [savedView, setSavedView] = useState(null);
    const [filters, setFilters] = useState(emptySets());
    const [menu, setMenu] = useState(null);            // null | 'views' | 'lag' | 'filter' | 'tools'
    const [dayIdx, setDayIdx] = useState(3);          // 0..6 within demo week
    const [monthM, setMonthM] = useState(5);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState(null);        // entity / {type,id}
    const [booking, setBooking] = useState(null);      // slot or null
    const [hoursOpen, setHoursOpen] = useState(false);
    const [attnOpen, setAttnOpen] = useState(false);
    const [inspDay, setInspDay] = useState(null);   // VP day index for the day controller (Dagsinspektør)
    const [shiftCtl, setShiftCtl] = useState(null);  // { shift?, slot?, tab? } — opened from the inspector

    const dayIso = PL.WEEK[dayIdx].iso;

    useEffect(() => { const t = setTimeout(() => setLoading(false), 650); return () => clearTimeout(t); }, []);
    // global «Skap → Booking / Event» opens the right create surface on arrival
    useEffect(() => {
      const k = window.__pendingCreate;
      if (k === "booking") { window.__pendingCreate = null; setView("day"); setBooking({ iso: dayIso, st: 18 }); }
      else if (k === "event") { window.__pendingCreate = null; setView("day"); toast("Nytt event — kladd opprettet", { undo: () => {} }); }
    }, []);
    // expose opener for cross-panel jumps (attention → entity)
    useEffect(() => { window.__plOpen = (e) => { setAttnOpen(false); setDetail(e); }; return () => { delete window.__plOpen; }; }, []);

    // ---- filter matcher ----
    const activeFilterCount = Object.values(filters).reduce((a, s) => a + s.size, 0);
    const match = useMemo(() => {
      const f = filters;
      const has = (set, v) => set.size === 0 || set.has(v);
      return (e) => {
        if (!e || !e.type) return true;
        if (e.type === "shift") return has(f.dept, e.dep) && has(f.role, e.role);
        if (e.type === "booking") return has(f.dept, e.dep) && has(f.bstatus, e.status);
        if (e.type === "event") return has(f.dept, e.dep);
        if (e.type === "leave") { const emp = PL.empById(e.e); return has(f.lstatus, e.status) && has(f.dept, emp.dep); }
        return true;
      };
    }, [filters]);

    // ---- Botsson structured context ----
    useEffect(() => {
      if (window.SmartoutContext) window.SmartoutContext.set({
        route: "planlegging", view, week: "Uke 22 · 27/5–2/6", grouping: "kalender",
        filters: [...filters.dept].map(d => PL.DEPT[d].name),
        types: PL.TYPE_ORDER.filter(t => show[t]), role: "Driftsleder", drafts: 0,
      });
      return () => { if (window.SmartoutContext) window.SmartoutContext.set({ route: null }); };
    }, [view, show, filters]);

    const counts = PL.weekCounts();
    const allOff = PL.TYPE_ORDER.every(t => !show[t]);
    const toggleType = (t) => { setShow(s => ({ ...s, [t]: !s[t] })); setSavedView(null); };
    const toggleFilter = (grp, v) => setFilters(f => { const n = { ...f, [grp]: new Set(f[grp]) }; n[grp].has(v) ? n[grp].delete(v) : n[grp].add(v); return n; });

    const applySaved = (v) => {
      setSavedView(v.id); setMenu(null);
      const ns = {}; PL.TYPE_ORDER.forEach(t => ns[t] = v.entities.includes(t)); setShow(ns);
      setView(v.view);
      if (v.view === "year") setMonthM(5);
      setLoading(true); setTimeout(() => setLoading(false), 420);
    };

    // ---- nav ----
    const navLabel = () => {
      if (view === "month" || view === "year") { const mm = PL.monthMeta(monthM); return view === "year" ? "2026" : `${mm.name} ${mm.year}`; }
      if (view === "day") { const w = PL.WEEK[dayIdx]; return `${w.dl} ${w.d}. ${PL.MONTH_NAMES[w.m - 1].toLowerCase()}`; }
      return "27. mai – 2. juni";
    };
    const nav = (dir) => {
      if (view === "day") setDayIdx(i => Math.min(6, Math.max(0, i + dir)));
      else if (view === "month") setMonthM(m => Math.min(7, Math.max(3, m + dir)));
      else if (view === "year") { /* single year */ }
      else toast("Demo-data finnes for uke 22");
    };
    const onToday = view === "day" ? dayIdx === 3 : view === "month" ? monthM === 5 : true;
    const goToday = () => {
      if (onToday) { toast("Du er allerede på i dag"); return; }
      setDayIdx(3); setMonthM(5); toast("Hopper til i dag");
    };

    const goRoute = (r) => { setDetail(null); setRoute && setRoute(r); toast(`Åpner ${r === "vaktplan" ? "Vaktplan" : r}`); };
    const botCard = view === "day" && dayIso === PL.TODAY_ISO ? (
      <P.BotCard text={<span>I dag er <strong>rolig på dagtid</strong>, men <span className="hl">Bama-leveransen 09:30</span> krever en hånd på kjøkkenet. Kveldsbookingene er under kontroll — 3 bord, 12 gjester.</span>} src={["Vakter", "Bookinger", "Eventer"]} cta="Oppsummer dagen" toastMsg="Dagsoppsummering åpnet i Botsson" onConfirm={() => { if (window.SmartoutBot) window.SmartoutBot.ask("Oppsummer dagen"); }} />
    ) : null;

    const savedViewName = (PL.SAVED_VIEWS.find(v => v.id === savedView) || {}).name;
    const activeLayers = PL.TYPE_ORDER.filter(t => show[t]).length;
    const DD = ({ id, children, label, icon, badge, accent, width = 248, align = "left", title }) => (
      <div className="pl-dd">
        <button className={`pl-btn ${accent ? "acc" : ""}`} onClick={() => setMenu(m => m === id ? null : id)} title={title}>
          <Ic n={icon} s={14} />{label && <span className="pl-dd-lbl">{label}</span>}{badge != null && <span className="ct">{badge}</span>}<Ic n="chevDown" s={12} c="var(--muted)" />
        </button>
        {menu === id && <>
          <div className="pl-dd-scrim" onClick={() => setMenu(null)} />
          <div className="pl-dd-menu" style={{ width, [align]: 0 }}>{children}</div>
        </>}
      </div>
    );

    return (
      <main className="sk-main full">
        <div className="pl">
          {/* ---------- single compact toolbar ---------- */}
          <div className="pl-bar">
            <div className="pl-seg">
              {VIEWS.map(v => <button key={v.id} className={view === v.id ? "on" : ""} onClick={() => { setView(v.id); setSavedView(null); }}><Ic n={v.icon} s={14} /> <span className="pl-seg-lbl">{v.label}</span></button>)}
            </div>
            <div className="pl-nav">
              <button onClick={() => nav(-1)} title="Forrige"><Ic n="chevLeft" s={16} /></button>
              <span className="lbl">{navLabel()}{view === "week" || view === "agenda" ? <span className="wk">U22</span> : null}</span>
              <button onClick={() => nav(1)} title="Neste"><Ic n="chevRight" s={16} /></button>
            </div>
            <button className="pl-today" onClick={goToday}>I dag</button>

            <div className="pl-bar-right">
            {/* Visninger — saved-view dropdown */}
            <DD id="views" icon="bookmark" label={savedViewName || "Visninger"} accent={!!savedView} width={264} title="Lagrede visninger">
              <div className="pl-dd-sec">Lagrede visninger</div>
              {PL.SAVED_VIEWS.map(v => (
                <button key={v.id} className={`pl-dd-item view ${savedView === v.id ? "on" : ""}`} onClick={() => applySaved(v)}>
                  <span className="pl-dd-ic"><Ic n={v.icon} s={15} /></span>
                  <span className="pl-dd-tx"><span className="t">{v.name}</span><span className="s">{v.desc}</span></span>
                  {savedView === v.id && <Ic n="check" s={15} sw={2.4} c="var(--orange)" />}
                </button>
              ))}
              <div className="pl-dd-div" />
              <button className="pl-dd-item plain" onClick={() => { setSavedView(null); setShow({ shift: true, booking: true, event: true, leave: true, hours: true, season: true }); setMenu(null); }}><span className="pl-dd-ic"><Ic n="eye" s={15} /></span><span className="pl-dd-tx"><span className="t">Vis alt</span></span></button>
            </DD>

            {/* Lag — entity-type multiselect */}
            <DD id="lag" icon="layers" label="Lag" badge={activeLayers} width={240} title="Velg oppføringstyper">
              <div className="pl-dd-sec">Vis i kalenderen</div>
              {PL.TYPE_ORDER.map(t => { const et = PL.ETYPE[t]; const c = t === "shift" ? "var(--muted)" : et.c; return (
                <button key={t} className="pl-dd-item check" onClick={() => toggleType(t)}>
                  <span className={`pl-dd-box ${show[t] ? "on" : ""}`} style={show[t] ? { background: c, borderColor: c } : null}>{show[t] && <Ic n="check" s={11} sw={3} c="#fff" />}</span>
                  <span className="sw" style={{ background: c }} />
                  <span className="pl-dd-tx"><span className="t">{et.plural}</span></span>
                  <span className="pl-dd-ct">{counts[t]}</span>
                </button>
              ); })}
              <div className="pl-dd-div" />
              <div className="pl-dd-foot">
                <button className="pl-dd-mini" onClick={() => setShow({ shift: true, booking: true, event: true, leave: true, hours: true, season: true })}>Alle</button>
                <button className="pl-dd-mini" onClick={() => setShow({ shift: false, booking: false, event: false, leave: false, hours: false, season: false })}>Ingen</button>
              </div>
            </DD>

            {/* Filter — facet multiselect */}
            <DD id="filter" icon="filter" label="Filter" badge={activeFilterCount || null} accent={!!activeFilterCount} width={300} title="Filtrer">
              <div className="pl-dd-sec">Filtrer kalender</div>
              <div className="pl-filt-body">
                {Object.entries(PL.FILTERS).map(([key, grp]) => (
                  <div key={key} className="pl-filt-grp">
                    <h5>{grp.label}</h5>
                    <div className="pl-filt-opts">
                      {grp.opts.map(([val, lbl]) => (
                        <button key={val} className={`pl-fopt ${filters[key] && filters[key].has(val) ? "on" : ""}`} onClick={() => toggleFilter(key, val)}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pl-filt-foot">
                <button className="pl-act" style={{ height: 34, flex: 1, justifyContent: "center" }} onClick={() => setFilters(emptySets())}>Nullstill</button>
                <button className="pl-act primary" style={{ height: 34, flex: 1, justifyContent: "center" }} onClick={() => setMenu(null)}>Ferdig</button>
              </div>
            </DD>

            {/* Verktøy — grouped tools menu */}
            <DD id="tools" icon="sliders" width={236} align="right" title="Verktøy">
              <div className="pl-dd-sec">Verktøy</div>
              <button className="pl-dd-item plain" onClick={() => { setMenu(null); setHoursOpen(true); }}><span className="pl-dd-ic"><Ic n="door" s={15} /></span><span className="pl-dd-tx"><span className="t">Åpningstider</span><span className="s">Standard uke & unntak</span></span></button>
              <button className="pl-dd-item plain" onClick={() => { setMenu(null); setView("year"); }}><span className="pl-dd-ic"><Ic n="wheel" s={15} /></span><span className="pl-dd-tx"><span className="t">Årshjul</span><span className="s">Sesonger & årsplan</span></span></button>
              <button className="pl-dd-item plain" onClick={() => { setMenu(null); toast("Eksporterer kalender til PDF…"); }}><span className="pl-dd-ic"><Ic n="download" s={15} /></span><span className="pl-dd-tx"><span className="t">Eksporter PDF</span><span className="s">Gjeldende visning</span></span></button>
              <div className="pl-dd-div" />
              <button className="pl-dd-item plain" onClick={() => { setMenu(null); toast("Kalenderinnstillinger"); }}><span className="pl-dd-ic"><Ic n="settings" s={15} /></span><span className="pl-dd-tx"><span className="t">Kalenderinnstillinger</span></span></button>
            </DD>

            <button className="pl-iconbtn attn" onClick={() => setAttnOpen(true)} title="Krever oppmerksomhet">
              <Ic n="alert" s={16} /><span className="pl-iconbtn-ct">{PL.ATTENTION.length}</span>
            </button>

            {window.CreateButton && <window.CreateButton onAction={(x) => {
              if (x === "Booking") { setBooking({ iso: dayIso, st: 18 }); return true; }
              if (x === "Event") { toast("Nytt event — kladd opprettet", { undo: () => {} }); return true; }
              if (x === "Vakt") { goRoute("vaktplan"); return true; }
              return false;
            }} />}
            </div>
          </div>

          {/* ---------- surface ---------- */}
          <div className="pl-body">
            {loading ? <CalSkeleton view={view} />
              : (
              <>
                {allOff && (
                  <div className="pl-layerhint">
                    <span className="ic"><Ic n="layers" s={14} /></span>
                    <span className="tx">Ingen lag valgt — kalenderen vises tom.</span>
                    <button className="ln" onClick={() => setShow({ shift: true, booking: true, event: true, leave: true, hours: true, season: true })}><Ic n="eye" s={13} /> Vis alt</button>
                  </div>
                )}
                {view === "week" ? <V.WeekView show={show} match={match} onOpen={setDetail} onCreate={(slot) => setBooking(slot)} onOpenDay={(i) => setInspDay(i)} />
                : view === "month" ? <V.MonthView m={monthM} show={show} match={match} onOpen={setDetail} onPickDay={(iso) => { const i = PL.WEEK.findIndex(w => w.iso === iso); if (i >= 0) { setDayIdx(i); setView("day"); } else { toast("Åpner dag"); } }} />
                : view === "day" ? <V.DayView iso={dayIso} show={show} match={match} onOpen={setDetail} onCreate={(slot) => setBooking(slot)} attention={PL.ATTENTION} botCard={botCard} onOpenDay={() => setInspDay(dayIdx)} />
                : view === "agenda" ? <V.AgendaView show={show} match={match} onOpen={setDetail} />
                : <V.YearView show={show} onOpen={setDetail} onPickMonth={(m) => { setMonthM(m); setView("month"); }} />}
              </>
              )}
          </div>
        </div>

        {/* ---------- panels ---------- */}
        {detail && detail.type === "season" ? <window.PLSeason.SeasonPanel id={detail.id} onClose={() => setDetail(null)} goRoute={goRoute} />
          : detail ? <P.DetailPanel item={detail} onClose={() => setDetail(null)} goRoute={goRoute} openHours={() => { setDetail(null); setHoursOpen(true); }} /> : null}
        {booking && <P.BookingCreatePanel slot={booking} onClose={() => setBooking(null)} />}
        {hoursOpen && <P.OpeningHoursPanel onClose={() => setHoursOpen(false)} />}
        {attnOpen && <P.AttentionPanel onClose={() => setAttnOpen(false)} onOpen={setDetail} />}

        {/* day controller (shared Dagsinspektør) + shift controller, opened from the day view */}
        {inspDay !== null && window.VPInspector && (
          <window.VPInspector
            dayIdx={inspDay}
            onClose={() => setInspDay(null)}
            onPlanner={() => { setInspDay(null); goRoute("vaktplan"); }}
            onFillGap={() => { setInspDay(null); goRoute("vaktplan"); }}
            onPublishDay={() => { setInspDay(null); goRoute("vaktplan"); }}
            dayPub={(window.VP ? window.VP.SHIFTS.filter(s => s.d === inspDay && s.status === "draft").length : 0)}
            onShift={(s, slot) => { setInspDay(null); setShiftCtl({ shift: s || null, slot: slot || null, tab: s && s.lock ? "livslop" : "detaljer" }); }}
            toast={toast}
          />
        )}
        {shiftCtl && window.VPController && (
          <window.VPController
            shift={shiftCtl.shift} slot={shiftCtl.slot} initialTab={shiftCtl.tab}
            onClose={() => setShiftCtl(null)}
            onOpenProfile={() => { setShiftCtl(null); goRoute("vaktplan"); }}
            onSave={() => { setShiftCtl(null); toast("Endring lagret — åpne Vaktplan for å publisere"); }}
            onDelete={() => { setShiftCtl(null); toast("Vakt slettet"); }}
            onAction={(type) => { setShiftCtl(null); goRoute("vaktplan"); }}
            toast={toast}
          />
        )}
      </main>
    );
  }

  // ---------- loading skeleton ----------
  function CalSkeleton({ view }) {
    if (view === "year" || view === "agenda" || view === "month") {
      return <div style={{ padding: 22 }}>
        <div className="pl-skel" style={{ height: 30, width: 220, marginBottom: 16 }} />
        <div style={{ display: "grid", gridTemplateColumns: view === "agenda" ? "1fr" : "repeat(7,1fr)", gap: 8 }}>
          {Array.from({ length: view === "agenda" ? 6 : 28 }).map((_, i) => <div key={i} className="pl-skel" style={{ height: view === "agenda" ? 58 : 100 }} />)}
        </div>
      </div>;
    }
    return <div style={{ display: "grid", gridTemplateColumns: "58px repeat(7,1fr)", padding: "12px 0", gap: 0 }}>
      <div />
      {Array.from({ length: 7 }).map((_, c) => (
        <div key={c} style={{ padding: "8px 6px", display: "flex", flexDirection: "column", gap: 8, borderLeft: "1px solid var(--border)" }}>
          <div className="pl-skel" style={{ height: 18, width: "55%", margin: "0 auto" }} />
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="pl-skel" style={{ height: 38 + (i % 2) * 22, marginTop: 18 + i * 30 }} />)}
        </div>
      ))}
    </div>;
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { planlegging: PlanleggingPage });
})();
