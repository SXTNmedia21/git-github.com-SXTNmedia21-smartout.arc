// ===== Vaktplan — User Profile Drawer (employee context for scheduling) =====
// Loads after vaktplan-controller.jsx, before vaktplan.jsx. Exposes window.VPProfile.
(function () {
  const { useState, useEffect, useMemo } = React;
  const Ic = window.Ic;
  const VP = window.VP;
  const { DEPT, EMP, empById, DAYS, TODAY } = VP;
  const WD = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

  // ---------- per-employee profile data ----------
  const AVAIL = { preferred: { l: "Foretrukket", c: "var(--success)" }, available: { l: "Tilgjengelig", c: "var(--info)" }, conditional: { l: "Betinget", c: "var(--warning)" }, unavailable: { l: "Utilgjengelig", c: "var(--muted-soft)" }, absence: { l: "Fravær", c: "var(--purple)" } };

  const PROFILES = {
    sl: {
      employment: "Fast heltid", status: "Aktiv",
      agreement: { type: "ukestimer", hpw: 37.5, max: 40, rest: 11, pref: ["Tor", "Fre", "Lør"], cannot: [], windows: "11:00–23:00", weekend: "Liker helg", evening: "Foretrekker kveld", notes: "Kan ta ekstravakter på kort varsel.", eff: "01.01.2026", rev: "v2", locked: false },
      avail: { Man: "available", Tir: "available", Ons: "available", Tor: "preferred", Fre: "preferred", Lør: "preferred", Søn: "available" },
      exceptions: [],
      hours: { contracted: 150, scheduled: 142, sick: 0, absence: 0, completed: 96, last: "Ons 28/5 · 16–23", next: "Tor 30/5 · 16–23" },
      requests: [{ kind: "Vaktbytte", status: "pending", t: "Vil bytte lør 1/6 mot Petters søndag", time: "2t siden" }, { kind: "Vaktbørs", status: "approved", t: "Tok ekstravakt søn 25/5", time: "3 dager" }],
      tasks: [{ t: "Bekreft kveldsvakt fredag", kind: "info", due: "i dag", done: false }],
      certs: [{ name: "Hygienesertifikat", state: "ok", exp: "12.2027" }, { name: "Alkohollov §8", state: "ok", exp: "06.2027" }],
      history: [{ t: "Avtale oppdatert til 37,5t/uke", who: "Maria A.", time: "01.01.2026" }, { t: "Tildelt kveldsvakt fredag", who: "Maria A.", time: "27.05" }],
    },
    pk: {
      employment: "Fast deltid", status: "Aktiv",
      agreement: { type: "ukestimer", hpw: 30, max: 35, rest: 11, pref: ["Ons", "Fre"], cannot: ["Man", "Tir"], windows: "11:00–20:00", weekend: "Helst ikke helg", evening: "Fleksibel", notes: "Studerer mandag og tirsdag — kan ikke jobbe da.", eff: "01.01.2026", rev: "v3", locked: false },
      avail: { Man: "unavailable", Tir: "unavailable", Ons: "preferred", Tor: "available", Fre: "preferred", Lør: "conditional", Søn: "available" },
      exceptions: [{ day: "Søn", type: "absence", label: "Avspasering 2/6" }],
      hours: { contracted: 120, scheduled: 104, sick: 8, absence: 0, completed: 72, last: "Ons 28/5 · 11–19", next: "Fre 31/5 · 11–19" },
      requests: [{ kind: "Ønsketurnus", status: "needs-review", t: "Ønsker fri i uke 24 (eksamen)", time: "i går" }, { kind: "Egenmelding", status: "approved", t: "Syk tir 27/5", time: "3 dager" }],
      tasks: [{ t: "Fornye hygienesertifikat", kind: "cert", due: "15.06", done: false }, { t: "Signere oppdatert avtale v3", kind: "info", due: "01.06", done: false }],
      certs: [{ name: "Hygienesertifikat", state: "warn", exp: "15.06.2026" }, { name: "Førstehjelp", state: "ok", exp: "03.2028" }],
      history: [{ t: "Egenmelding registrert (tir 27/5)", who: "System", time: "27.05" }, { t: "Avtale oppdatert til 30t/uke", who: "Maria A.", time: "12.01.2026" }, { t: "Kontrakttimer endret 25 → 30", who: "Erik S. (Eier)", time: "12.01.2026" }],
    },
    mh: {
      employment: "Ekstravakt", status: "Aktiv",
      agreement: null, // no agreement configured → empty state
      avail: { Man: "unavailable", Tir: "unavailable", Ons: "conditional", Tor: "available", Fre: "unavailable", Lør: "available", Søn: "unavailable" },
      exceptions: [],
      hours: { contracted: 0, scheduled: 24, sick: 0, absence: 0, completed: 18, last: "Ons 28/5 · 17–23", next: "Lør 1/6 · 17–23" },
      requests: [],
      tasks: [{ t: "Mangler oppdatert tilgjengelighet", kind: "warn", due: "—", done: false }],
      certs: [{ name: "Skjenkebevilling", state: "ok", exp: "09.2027" }],
      history: [{ t: "La til som ekstravakt", who: "Maria A.", time: "04.2026" }],
    },
  };
  const baseProfile = (e) => ({
    employment: e.contract >= 37 ? "Fast heltid" : "Fast deltid", status: "Aktiv",
    agreement: { type: "fast-turnus", hpw: e.contract || 30, max: (e.contract || 30) + 5, rest: 11, pref: ["Tor", "Fre"], cannot: [], windows: "08:00–20:00", weekend: "Fleksibel", evening: "Fleksibel", notes: "", eff: "01.01.2026", rev: "v1", locked: false },
    avail: { Man: "available", Tir: "available", Ons: "available", Tor: "preferred", Fre: "preferred", Lør: "available", Søn: "available" },
    exceptions: [], hours: { contracted: (e.contract || 30) * 4, scheduled: (e.contract || 30) * 3.6, sick: 0, absence: 0, completed: (e.contract || 30) * 2.4, last: "—", next: "—" },
    requests: [], tasks: [], certs: [{ name: "HMS-kurs", state: "ok", exp: "2027" }], history: [{ t: "Profil opprettet", who: "System", time: "2023" }],
  });
  const getProfile = (id) => ({ ...baseProfile(empById(id) || {}), ...(PROFILES[id] || {}) });

  const AGREEMENTS = {
    "fast-turnus": { l: "Fast turnus", ic: "calendar", d: "Faste vakter i en gjentakende rotasjon." },
    "ukestimer": { l: "Ukestimer", ic: "clock", d: "Avtalt antall timer per uke, fleksibelt fordelt." },
    "fleksitid": { l: "Fleksitid", ic: "sliders", d: "Fleksibel arbeidstid uten fast oppmøtemønster." },
  };

  const SECTIONS = [
    ["oversikt", "Oversikt", "user"],
    ["avtale", "Avtale", "checkdoc"],
    ["tilgj", "Tilgjengelighet", "calendar"],
    ["timer", "Timer", "gauge"],
    ["foresp", "Forespørsler", "swap"],
    ["oppg", "Oppgaver", "list"],
    ["hist", "Historikk", "history"],
    ["detaljer", "Detaljer", "file"],
  ];

  const STATUS_PILL = { pending: ["Venter", "warn"], "needs-review": ["Til vurdering", "info"], approved: ["Godkjent", "ok"], rejected: ["Avslått", "err"], expired: ["Utløpt", "muted"] };

  function Av({ e, size = 30 }) { return <span className="vp-emp-av" style={{ width: size, height: size, background: e.c, fontSize: size * 0.37 }}>{e.init}</span>; }

  // smart scheduling fit
  function computeFit(emp, prof, ctx) {
    if (!ctx) return null;
    const dayName = WD[ctx.d];
    const av = prof.avail[dayName];
    const roleMatch = !ctx.role || ctx.role === emp.role || (ctx.role === "Bartender" && emp.role === "Bartender") || (ctx.role === "Servitør" && ["Servitør", "Vertinne"].includes(emp.role));
    const conflict = VP.SHIFTS.find(s => s.e === emp.id && s.d === ctx.d);
    const unavailable = av === "unavailable" || (prof.exceptions || []).some(x => x.day === dayName);
    const reasons = [];
    let verdict = "good";
    if (unavailable) { verdict = "no"; reasons.push({ sev: "block", t: "Utilgjengelig denne dagen", s: av === "unavailable" ? "Markert som utilgjengelig i avtalen." : "Har godkjent fravær." }); }
    if (conflict) { verdict = "no"; reasons.push({ sev: "block", t: "Overlappende vakt", s: `Har allerede ${conflict.role} ${conflict.t}.` }); }
    if (!roleMatch) { if (verdict !== "no") verdict = "warn"; reasons.push({ sev: "warn", t: "Rolle matcher ikke", s: `Vakten krever ${ctx.role}, ${emp.name} er ${emp.role}.` }); }
    if (av === "conditional" && verdict === "good") { verdict = "warn"; reasons.push({ sev: "warn", t: "Betinget tilgjengelig", s: "Kan jobbe, men har markert dagen som betinget." }); }
    const hrs = VP.SHIFTS.filter(s => s.e === emp.id).reduce((a, s) => a + (s.en - s.st), 0);
    const helpsBalance = hrs < emp.contract;
    return { verdict, reasons, roleMatch, conflict: !!conflict, av, helpsBalance };
  }

  function Profile({ empId, section, fit, onClose, onOpenShift, onFullPlan, onAssign, toast }) {
    const emp = empById(empId);
    const prof = useMemo(() => getProfile(empId), [empId]);
    const [tab, setTab] = useState(section || (fit ? "oversikt" : "oversikt"));
    const [editAgr, setEditAgr] = useState(false);
    const fitData = useMemo(() => computeFit(emp, prof, fit), [empId, fit]);
    const sched = prof.hours.scheduled, contracted = prof.hours.contracted;
    const missing = Math.max(0, contracted - sched), extra = Math.max(0, sched - contracted);
    const planHrs = VP.SHIFTS.filter(s => s.e === empId).reduce((a, s) => a + (s.en - s.st), 0);
    const availHealth = Object.values(prof.avail).filter(v => v === "preferred" || v === "available").length;

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    const Bar = ({ pct, c }) => <span className="vp-prof-bar"><span style={{ width: Math.min(pct, 100) + "%", background: c }} /></span>;

    return (
      <>
        <div className="vp-insp-scrim" onClick={onClose} />
        <aside className={`vp-prof ${editAgr ? "wide" : ""}`} role="dialog" aria-label={`Profil ${emp.name}`}>
          {/* sticky header */}
          <div className="vp-prof-head">
            <div className="vp-prof-headtop">
              <span className="vp-insp-eyebrow" style={{ margin: 0 }}>Ansattprofil</span>
              <button className="vp-insp-close" onClick={onClose}><Ic n="x" s={16} /></button>
            </div>
            <div className="vp-prof-id">
              <Av e={emp} size={52} />
              <div className="vp-prof-idtxt">
                <div className="vp-prof-name">{emp.name}</div>
                <div className="vp-prof-role"><span style={{ width: 7, height: 7, borderRadius: "50%", background: DEPT[emp.dep].c, display: "inline-block" }} /> {emp.role} · {DEPT[emp.dep].name}-laget</div>
              </div>
              <span className="vp-prof-health" title="Tilgjengelighet"><span className="ring" style={{ background: `conic-gradient(var(--success) ${availHealth / 7 * 360}deg, var(--secondary) 0)` }}><b>{availHealth}/7</b></span><span className="l">dager</span></span>
            </div>
            <div className="vp-prof-hmeta">
              <span><Ic n="user" s={12} /> {prof.employment}</span>
              <span><span className="dot" style={{ background: "var(--success)" }} /> {prof.status}</span>
              <span><Ic n="clock" s={12} /> Neste: {prof.hours.next}</span>
              <span><Ic n="gauge" s={12} /> {sched}/{contracted}t denne mnd</span>
            </div>
          </div>

          {/* anchor tabs */}
          <div className="vp-prof-tabs">
            {SECTIONS.map(([k, l, ic]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><Ic n={ic} s={13} /> {l}
                {k === "foresp" && prof.requests.filter(r => r.status === "pending" || r.status === "needs-review").length > 0 && <span className="n">{prof.requests.filter(r => r.status === "pending" || r.status === "needs-review").length}</span>}
              </button>
            ))}
          </div>

          <div className="vp-prof-body">
            {/* smart fit panel (context) */}
            {fitData && tab === "oversikt" && (
              <div className={`vp-fit ${fitData.verdict}`}>
                <div className="vp-fit-top">
                  <span className="vp-fit-ic"><Ic n={fitData.verdict === "good" ? "check" : fitData.verdict === "warn" ? "alert" : "ban"} s={16} sw={fitData.verdict === "good" ? 2.4 : 1.8} /></span>
                  <div><div className="vp-fit-verdict">{fitData.verdict === "good" ? "God match" : fitData.verdict === "warn" ? "Mulig — med forbehold" : "Ikke tilgjengelig"}</div><div className="vp-fit-ctx">For {fit.role} · {DAYS[fit.d].dn} {DAYS[fit.d].num}/{DAYS[fit.d].mon} · {fit.t}</div></div>
                  <span className="vp-fit-ai"><Ic n="sparkle" s={11} /> Botsson</span>
                </div>
                <div className="vp-fit-checks">
                  {[["Rolle", fitData.roleMatch], ["Ingen konflikt", !fitData.conflict], ["Tilgjengelig", fitData.av !== "unavailable"], ["Hjelper timebalanse", fitData.helpsBalance]].map(([l, ok]) => (
                    <span key={l} className={`vp-fit-check ${ok ? "ok" : "no"}`}><Ic n={ok ? "check" : "x"} s={11} sw={2.4} /> {l}</span>
                  ))}
                </div>
                {fitData.reasons.map((r, i) => <div key={i} className={`vp-fit-reason ${r.sev}`}><Ic n={r.sev === "block" ? "ban" : "alert"} s={12} /> <span><strong>{r.t}.</strong> {r.s}</span></div>)}
                {fitData.verdict !== "no" && <button className="vp-fit-assign" onClick={() => { onAssign && onAssign(emp.id, fit); }}><Ic n="check" s={14} sw={2.2} /> Tildel {emp.name.split(" ")[0]} denne vakten</button>}
              </div>
            )}

            {tab === "oversikt" && (
              <>
                <Section t="Timebalanse denne måneden" link="Se detaljer" onLink={() => setTab("timer")}>
                  <div className="vp-prof-hours">
                    <div className="vp-prof-hrow"><span className="k">Planlagt</span><Bar pct={sched / contracted * 100} c="var(--orange)" /><span className="v">{sched}/{contracted}t</span></div>
                    {missing > 0 && <div className="vp-prof-hnote warn"><Ic n="alert" s={12} /> Mangler {missing}t for å nå kontrakt</div>}
                    {extra > 0 && <div className="vp-prof-hnote ok"><Ic n="trendUp" s={12} /> {extra}t over kontrakt</div>}
                  </div>
                </Section>
                <Section t="Denne uka" link="Full plan" onLink={() => onFullPlan && onFullPlan(empId)}>
                  <div className="vp-prof-week">
                    {DAYS.map((d, i) => { const s = VP.SHIFTS.find(x => x.e === empId && x.d === i); const av = prof.avail[d.dn]; return (
                      <div key={i} className={`vp-prof-day ${d.today ? "today" : ""}`}>
                        <span className="dn">{d.dn}</span>
                        {s ? <span className="sh" style={{ background: DEPT[s.dep].c }} title={`${s.role} ${s.t}`}>{s.st}</span> : <span className="av" style={{ background: AVAIL[av].c, opacity: av === "unavailable" ? .3 : .85 }} title={AVAIL[av].l} />}
                      </div>
                    ); })}
                  </div>
                </Section>
                {prof.requests.filter(r => r.status === "pending" || r.status === "needs-review").length > 0 && (
                  <Section t="Venter på deg" link="Alle" onLink={() => setTab("foresp")}>
                    {prof.requests.filter(r => r.status === "pending" || r.status === "needs-review").slice(0, 2).map((r, i) => <ReqRow key={i} r={r} toast={toast} />)}
                  </Section>
                )}
              </>
            )}

            {tab === "avtale" && (
              <div className="vp-prof-pane">
                {!prof.agreement ? (
                  <div className="vp-prof-empty">
                    <span className="ic"><Ic n="checkdoc" s={22} /></span>
                    <div className="t">Ingen avtale satt opp</div>
                    <div className="s">{emp.name} har ingen arbeidstidsavtale ennå. Velg en avtaletype for å planlegge etter tilgjengelighet og timer.</div>
                    <div className="vp-prof-agrcards">
                      {Object.entries(AGREEMENTS).map(([k, a]) => <button key={k} className="vp-prof-agrcard" onClick={() => { setEditAgr(true); toast("Avtaleoppsett åpnet"); }}><span className="ic"><Ic n={a.ic} s={17} /></span><span className="t">{a.l}</span><span className="d">{a.d}</span></button>)}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="vp-prof-agrhead">
                      <div><div className="vp-prof-sech">Arbeidstidsavtale</div><div className="vp-prof-agrtype"><span className="ic"><Ic n={AGREEMENTS[prof.agreement.type].ic} s={14} /></span> {AGREEMENTS[prof.agreement.type].l} · <span className="mono">{prof.agreement.rev}</span></div></div>
                      <button className="vp-prof-editbtn" onClick={() => { setEditAgr(e => !e); }}><Ic n="pen" s={13} /> {editAgr ? "Ferdig" : "Rediger"}</button>
                    </div>
                    <div className="vp-prof-agrcards sel">
                      {Object.entries(AGREEMENTS).map(([k, a]) => <div key={k} className={`vp-prof-agrcard mini ${prof.agreement.type === k ? "on" : ""}`}><span className="ic"><Ic n={a.ic} s={15} /></span><span className="t">{a.l}</span></div>)}
                    </div>
                    <div className="vp-prof-agrgrid">
                      {[["Timer per uke", `${prof.agreement.hpw}t`], ["Maks per uke", `${prof.agreement.max}t`], ["Min. hviletid", `${prof.agreement.rest}t`], ["Tidsvindu", prof.agreement.windows], ["Helg", prof.agreement.weekend], ["Kveld/natt", prof.agreement.evening]].map(([k, v]) => (
                        <div key={k} className="vp-prof-agritem"><span className="k">{k}</span>{editAgr ? <input className="vp-finput" defaultValue={v} style={{ height: 32 }} /> : <span className="v">{v}</span>}</div>
                      ))}
                    </div>
                    <div className="vp-prof-agrdays">
                      <div className="vp-prof-sech" style={{ marginBottom: 8 }}>Foretrukne dager</div>
                      <div className="vp-prof-daychips">{WD.map(d => <span key={d} className={`vp-prof-daychip ${prof.agreement.pref.includes(d) ? "pref" : prof.agreement.cannot.includes(d) ? "no" : ""}`}>{d}{prof.agreement.cannot.includes(d) && <Ic n="x" s={9} sw={2.6} />}</span>)}</div>
                      <div className="vp-prof-daylegend"><span><i style={{ background: "var(--success)" }} />Foretrukket</span><span><i style={{ background: "var(--error)" }} />Kan ikke</span></div>
                    </div>
                    {prof.agreement.notes && <div className="vp-prof-agrnote"><Ic n="file" s={13} /> {prof.agreement.notes}</div>}
                    <div className="vp-prof-agrfoot"><span>Gjelder fra <strong>{prof.agreement.eff}</strong> · {prof.agreement.rev}</span>{editAgr && <button className="sk-primary" style={{ height: 32 }} onClick={() => { setEditAgr(false); toast("Avtale lagret", { undo: () => {} }); }}><Ic n="check" s={14} sw={2.3} /> Lagre avtale</button>}</div>
                  </>
                )}
              </div>
            )}

            {tab === "tilgj" && (
              <div className="vp-prof-pane">
                <div className="vp-prof-sechrow"><div className="vp-prof-sech">Ukentlig tilgjengelighet</div><button className="vp-prof-editbtn" onClick={() => toast("Tilgjengelighetseditor åpnet")}><Ic n="pen" s={13} /> Rediger</button></div>
                <div className="vp-prof-availmap">
                  {DAYS.map((d, i) => { const av = prof.avail[d.dn]; const exc = (prof.exceptions || []).find(x => x.day === d.dn); const a = exc ? AVAIL.absence : AVAIL[av]; return (
                    <div key={i} className={`vp-prof-availrow ${d.today ? "today" : ""}`}>
                      <span className="dn">{d.dn} {d.num}</span>
                      <span className="vp-prof-availbar" style={{ background: `color-mix(in oklab, ${a.c} 16%, var(--card))`, borderColor: `color-mix(in oklab, ${a.c} 40%, var(--border))` }}><span className="dot" style={{ background: a.c }} /> {exc ? exc.label : av === "preferred" ? "Foretrukket · " + (prof.agreement ? prof.agreement.windows : "hele dagen") : a.l}</span>
                    </div>
                  ); })}
                </div>
                <div className="vp-prof-availlegend">{Object.entries(AVAIL).map(([k, v]) => <span key={k}><i style={{ background: v.c }} />{v.l}</span>)}</div>
                {Object.values(prof.avail).every(v => v === "available") && <div className="vp-prof-warnbox"><Ic n="alert" s={13} /> Ingen preferanser satt — be {emp.name.split(" ")[0]} oppdatere tilgjengelighet for bedre planlegging.</div>}
              </div>
            )}

            {tab === "timer" && (
              <div className="vp-prof-pane">
                <div className="vp-prof-bigmetric">
                  <div className="ring" style={{ background: `conic-gradient(var(--orange) ${sched / contracted * 360}deg, var(--secondary) 0)` }}><span className="inner"><b>{Math.round(sched / contracted * 100)}%</b><i>av kontrakt</i></span></div>
                  <div className="vp-prof-bigstats">
                    <div><span className="v">{sched}t</span><span className="k">Planlagt</span></div>
                    <div><span className="v">{contracted}t</span><span className="k">Kontrakt</span></div>
                    <div><span className={`v ${missing ? "warn" : ""}`}>{missing}t</span><span className="k">Mangler</span></div>
                    <div><span className={`v ${extra ? "ok" : ""}`}>{extra}t</span><span className="k">Ekstra</span></div>
                  </div>
                </div>
                <div className="vp-prof-hbreak">
                  {[["Fullført", prof.hours.completed + "t", "ok"], ["Gjenstår planlagt", Math.max(0, sched - prof.hours.completed) + "t", ""], ["Egenmelding/sykt", prof.hours.sick + "t", prof.hours.sick ? "warn" : ""], ["Annet fravær", prof.hours.absence + "t", ""]].map(([k, v, t]) => (
                    <div key={k} className="vp-prof-hbrow"><span className="k">{k}</span><span className={`v ${t}`}>{v}</span></div>
                  ))}
                </div>
                <div className="vp-prof-shctx">
                  <div className="vp-prof-shctxitem"><span className="k">Sist jobbet</span><span className="v">{prof.hours.last}</span></div>
                  <div className="vp-prof-shctxitem"><span className="k">Neste vakt</span><span className="v">{prof.hours.next}</span></div>
                </div>
              </div>
            )}

            {tab === "foresp" && (
              <div className="vp-prof-pane">
                {prof.requests.length === 0 ? <div className="vp-prof-empty mini"><span className="ic"><Ic n="check" s={20} /></span><div className="t">Ingen forespørsler</div></div> : prof.requests.map((r, i) => <ReqRow key={i} r={r} full toast={toast} />)}
              </div>
            )}

            {tab === "oppg" && (
              <div className="vp-prof-pane">
                {prof.tasks.length === 0 ? <div className="vp-prof-empty mini"><span className="ic"><Ic n="check" s={20} /></span><div className="t">Ingen åpne oppgaver</div></div> : prof.tasks.map((t, i) => (
                  <div key={i} className="vp-prof-task">
                    <span className={`vp-prof-taskic ${t.kind}`}><Ic n={t.kind === "cert" ? "cap" : t.kind === "warn" ? "alert" : "file"} s={14} /></span>
                    <div className="vp-prof-taskb"><div className="t">{t.t}</div><div className="m">Frist {t.due}</div></div>
                    <button className="vp-prof-taskbtn" onClick={() => toast("Oppgave fulgt opp")}>Følg opp</button>
                  </div>
                ))}
              </div>
            )}

            {tab === "hist" && (
              <div className="vp-prof-pane">
                <div className="vp-prof-timeline">
                  {prof.history.map((h, i) => (
                    <div key={i} className="vp-prof-tl">
                      <span className="vp-prof-tl-rail"><span className="vp-prof-tl-dot" />{i < prof.history.length - 1 && <span className="vp-prof-tl-line" />}</span>
                      <div className="vp-prof-tl-b"><div className="t">{h.t}</div><div className="m">{h.who} · {h.time}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "detaljer" && (
              <div className="vp-prof-pane">
                <div className="vp-prof-sech" style={{ marginBottom: 10 }}>Kontakt & ansettelse</div>
                <div className="vp-prof-fields">
                  {[["Ansattnr.", "BN-0" + (210 + EMP.indexOf(emp))], ["E-post", emp.name.split(" ")[0].toLowerCase() + "@bistronord.no"], ["Telefon", "+47 9" + (10 + EMP.indexOf(emp) * 7) + " 23 4" + EMP.indexOf(emp)], ["Stilling", emp.role], ["Avdeling", DEPT[emp.dep].name], ["Ansettelse", prof.employment], ["Startdato", "08.2023"]].map(([k, v]) => (
                    <div key={k} className="vp-prof-field"><span className="k">{k}</span><span className="v">{v}</span></div>
                  ))}
                </div>
                <div className="vp-prof-sech" style={{ margin: "20px 0 10px" }}>Kompetanse & sertifikater</div>
                <div className="vp-prof-certs">
                  {prof.certs.map((c, i) => <span key={i} className={`vp-prof-cert ${c.state}`}><Ic n={c.state === "ok" ? "check" : "alert"} s={11} sw={c.state === "ok" ? 2.6 : 1.8} /> {c.name}<em>{c.exp}</em></span>)}
                </div>
                <div className="vp-prof-paymeta"><Ic n="lock" s={13} /> <span>Lønnsdetaljer er <strong>kun synlig for lønnsansvarlig</strong>.</span></div>
              </div>
            )}
          </div>

          {/* footer */}
          <div className="vp-prof-foot">
            <button className="sk-ghost" onClick={() => onFullPlan && onFullPlan(empId)}><Ic n="users" s={15} /> Full plan</button>
            {fit && fitData && fitData.verdict !== "no"
              ? <button className="sk-primary" onClick={() => onAssign && onAssign(emp.id, fit)}><Ic n="check" s={15} sw={2.3} /> Tildel vakt</button>
              : <button className="sk-primary" onClick={() => toast("Sender melding til " + emp.name.split(" ")[0])}><Ic n="message" s={15} /> Melding</button>}
          </div>
        </aside>
      </>
    );

    function Section({ t, link, onLink, children }) {
      return <div className="vp-prof-sec"><div className="vp-prof-sechrow"><div className="vp-prof-sech">{t}</div>{link && <button className="vp-prof-seclink" onClick={onLink}>{link} <Ic n="arrowRight" s={11} /></button>}</div>{children}</div>;
    }
    function ReqRow({ r, full, toast }) {
      const [s, st] = STATUS_PILL[r.status] || ["", "muted"];
      const [done, setDone] = useState(null);
      return (
        <div className="vp-prof-req">
          <div className="vp-prof-reqtop"><span className="kind">{r.kind}</span><span className={`vp-prof-reqstatus ${st}`}>{s}</span><span className="time">{r.time}</span></div>
          <div className="vp-prof-reqt">{r.t}</div>
          {full && (r.status === "pending" || r.status === "needs-review") && !done && (
            <div className="vp-prof-reqacts"><button className="ok" onClick={() => { setDone("ok"); toast("Forespørsel godkjent", { undo: () => setDone(null) }); }}><Ic n="check" s={13} sw={2.3} /> Godkjenn</button><button className="no" onClick={() => { setDone("no"); toast("Forespørsel avslått"); }}>Avslå</button></div>
          )}
          {done && <div className="vp-prof-reqdone"><Ic n={done === "ok" ? "check" : "x"} s={13} sw={2.2} /> {done === "ok" ? "Godkjent" : "Avslått"}</div>}
        </div>
      );
    }
  }

  window.VPProfile = Profile;
  window.VPGetProfile = getProfile;
  window.VP_AVAIL = AVAIL;
})();
