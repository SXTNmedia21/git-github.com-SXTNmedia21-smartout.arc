// ===== Vaktplan — shared data + overlay components =====
// Loads BEFORE pages/vaktplan.jsx. Exposes window.VP (data) + overlay components.
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.Ic;

  // ---------- Botsson context registry (structured, stable identifiers) ----------
  window.SmartoutContext = window.SmartoutContext || {
    _data: { route: null }, _subs: [],
    set(patch) { this._data = { ...this._data, ...patch }; this._subs.forEach(f => { try { f(this._data); } catch (e) {} }); },
    get() { return this._data; },
    subscribe(f) { this._subs.push(f); return () => { this._subs = this._subs.filter(x => x !== f); }; },
    describe(lc) {
      const d = this._data || {};
      lc = lc || "";
      // page-supplied describe wins (lets any module answer for its own route)
      if (typeof d.describe === "function" && d.route && d.route !== "vaktplan" && d.route !== "planlegging") {
        try { const r = d.describe(lc); if (r) return r; } catch (e) {}
      }
      if (d.route === "planlegging") {
        const viewName = { day: "Dag", week: "Uke", month: "Måned", agenda: "Agenda", year: "Årshjul" }[d.view] || d.view;
        const filt = (d.filters && d.filters.length) ? `filtrert på ${d.filters.join(", ")}` : "alle avdelinger";
        const types = (d.types && d.types.length) ? d.types.join(", ") : "ingen lag";
        if (lc.includes("oppmerksomhet") || lc.includes("konflikt") || lc.includes("haster")) return `Du er i kalenderen (${viewName}, ${d.week}). Denne uka er fredag tettest: Live jazz gir høy demand samtidig som det mangler bemanning og en booking ligger utenfor åpningstid. Trykk «Krever oppmerksomhet» for hele lista.`;
        if (lc.includes("booking") || lc.includes("reserv")) return `Du står i kalenderen, ${viewName}-visning. Klikk eller dra i et tidsfelt for å opprette en booking — jeg validerer mot åpningstid og varsler ved overbooking.`;
        if (lc.includes("åpningstid") || lc.includes("stengt")) return `Åpningstider ligger som et eget lag i kalenderen. Trykk «Åpningstider» i verktøylinja for å sette standard uke, unntak og spesialdager. Søndag 2/6 mangler åpningstid akkurat nå.`;
        return `Du er i den globale kalenderen — ${viewName}-visning for ${d.week}, ${filt}. Synlige lag: ${types}. Herfra kan du opprette bookinger, vurdere fravær, sjekke dekning mot eventer, og hoppe til årshjulet for sesongkontekst. Hva vil du gjøre?`;
      }
      if (d.route !== "vaktplan") return "Jeg ser ikke nok kontekst om hvor du er akkurat nå. Åpne en side i Smartout, så hjelper jeg deg der — uten å gjette på data jeg ikke har.";
      const viewName = { vaktplan: "ukerutenettet (Vaktplan)", vaktbors: "Vaktbørs", bytter: "Bytteforespørsler", tilgjengelighet: "Tilgjengelighet" }[d.view] || d.view;
      const grp = { ansatt: "ansatt", jobb: "jobb/vakttype", team: "team" }[d.grouping] || d.grouping;
      const filt = (d.filters && d.filters.length && d.filters.length < 4) ? `filtrert på ${d.filters.join(", ")}` : "alle avdelinger";
      lc = lc || "";
      if (lc.includes("eksport") || lc.includes("pdf") || lc.includes("skriv ut")) return `Du står i ${viewName} for ${d.week}. Trykk «Eksporter» i verktøylinja — du får en A4-forhåndsvisning (uke eller måned) som du kan skrive ut eller lagre som PDF. Den tar med gjeldende gruppering og filter, men ikke interne notater.`;
      if (lc.includes("publiser")) return d.drafts ? `Du er i ${viewName}, ${d.week}. Du har ${d.drafts} vakt(er) som venter på publisering — trykk «Publiser» for en bekreftelse der du kan holde tilbake enkeltvakter før de blir synlige.` : `Du er i ${viewName}, ${d.week}. Alt er publisert akkurat nå — ingenting venter.`;
      return `Du er i ${viewName} for ${d.week}, gruppert etter ${grp}, ${filt}. Logget inn som ${d.role || "leder"}. Herfra kan du opprette og redigere vakter, kjøre AI-planlegger, eksportere PDF, eller publisere. Hva vil du gjøre?`;
    },
  };

  // ---------- domain data (coherent with Bistro Nord cast) ----------
  const DEPT = {
    kjokken: { name: "Kjøkken", c: "#ee560c" },
    sal: { name: "Sal", c: "#00ab93" },
    bar: { name: "Bar", c: "#864ad2" },
    event: { name: "Event", c: "#c18200" },
  };

  const EMP = [
    { id: "ma", name: "Maria A.", init: "MA", c: "#FF7849", role: "Driftsleder", dep: "sal", contract: 37.5 },
    { id: "jh", name: "Jonas H.", init: "JH", c: "#3B82F6", role: "Kokk", dep: "kjokken", contract: 37.5 },
    { id: "ao", name: "Anna O.", init: "AO", c: "#f59e0b", role: "Kokk", dep: "kjokken", contract: 30 },
    { id: "sl", name: "Selma L.", init: "SL", c: "#10B981", role: "Servitør", dep: "sal", contract: 37.5 },
    { id: "pk", name: "Petter K.", init: "PK", c: "#A855F7", role: "Servitør", dep: "sal", contract: 30 },
    { id: "ea", name: "Even A.", init: "EA", c: "#14b8a6", role: "Vertinne", dep: "sal", contract: 25 },
    { id: "mh", name: "Mats H.", init: "MH", c: "#864ad2", role: "Bartender", dep: "bar", contract: 30 },
  ];
  const empById = (id) => EMP.find(e => e.id === id);

  // Week 22 · today = Tor 30/5 (idx 3), matches dashboard
  const DAYS = [
    { dn: "Man", num: "27", mon: "5", we: false },
    { dn: "Tir", num: "28", mon: "5", we: false },
    { dn: "Ons", num: "29", mon: "5", we: false },
    { dn: "Tor", num: "30", mon: "5", we: false, today: true },
    { dn: "Fre", num: "31", mon: "5", we: false },
    { dn: "Lør", num: "1", mon: "6", we: true },
    { dn: "Søn", num: "2", mon: "6", we: true },
  ];
  const TODAY = 3;

  // lifecycle by day position: before today closed/settled (locked), today active, after editable
  // s/e = start/end hour. status: published | draft. lc: closed|settled|active|published|draft
  let _id = 0;
  const sh = (e, d, role, dep, t, st, en, opt = {}) => ({ id: "s" + (++_id), e, d, role, dep, t, st, en, ...opt });
  const SHIFTS = [
    // Maria — drift, sal, full week
    sh("ma", 0, "Driftsleder", "sal", "09–17", 9, 17, { lc: "closed", lock: true }),
    sh("ma", 1, "Driftsleder", "sal", "09–17", 9, 17, { lc: "settled", lock: true }),
    sh("ma", 2, "Driftsleder", "sal", "09–17", 9, 17, { lc: "settled", lock: true }),
    sh("ma", 3, "Driftsleder", "sal", "09–17", 9, 17, { lc: "active", ok: true }),
    sh("ma", 4, "Driftsleder", "sal", "09–17", 9, 17, { lc: "published" }),
    // Jonas — kokk
    sh("jh", 1, "Kokk", "kjokken", "11–20", 11, 20, { lc: "settled", lock: true }),
    sh("jh", 3, "Kokk", "kjokken", "11–20", 11, 20, { lc: "active", ok: true }),
    sh("jh", 4, "Kokk", "kjokken", "14–23", 14, 23, { lc: "published" }),
    sh("jh", 5, "Kokk", "kjokken", "12–22", 12, 22, { lc: "published" }),
    // Anna — kokk
    sh("ao", 0, "Kokk", "kjokken", "08–16", 8, 16, { lc: "closed", lock: true }),
    sh("ao", 2, "Kokk", "kjokken", "08–16", 8, 16, { lc: "settled", lock: true }),
    sh("ao", 3, "Kokk", "kjokken", "08–16", 8, 16, { lc: "active", ok: true }),
    sh("ao", 5, "Kokk", "kjokken", "08–16", 8, 16, { lc: "published" }),
    // Selma — servitør
    sh("sl", 0, "Servitør", "sal", "16–23", 16, 23, { lc: "closed", lock: true }),
    sh("sl", 3, "Servitør", "sal", "16–23", 16, 23, { lc: "draft", status: "draft", pub: { kind: "new", changes: [{ t: "Ny vakt opprettet", who: "Maria A.", time: "i dag 08:02" }] } }),
    sh("sl", 4, "Servitør", "sal", "16–23", 16, 23, { lc: "published" }),
    sh("sl", 5, "Servitør", "sal", "11–19", 11, 19, { lc: "published" }),
    sh("sl", 6, "Servitør", "sal", "11–19", 11, 19, { lc: "published" }),
    // Petter — servitør
    sh("pk", 2, "Servitør", "sal", "11–19", 11, 19, { lc: "settled", lock: true }),
    sh("pk", 4, "Servitør", "sal", "11–19", 11, 19, { lc: "draft", status: "draft", pub: { kind: "new", changes: [{ t: "Ny vakt opprettet", who: "Maria A.", time: "i dag 08:04" }], issue: { sev: "warn", text: "Petter passerer 37,5t denne uka — gir overtidstillegg" } } }),
    sh("pk", 5, "Servitør", "sal", "16–23", 16, 23, { lc: "published", warn: "Nærmer seg 37,5t" }),
    // Even — vertinne
    sh("ea", 1, "Vertinne", "sal", "12–20", 12, 20, { lc: "settled", lock: true }),
    sh("ea", 4, "Vertinne", "sal", "18–00", 18, 24, { lc: "published", status: "changed", pub: { kind: "changed", changes: [{ t: "Tid endret fra 17:00–23:00 til 18:00–00:00", who: "Maria A.", time: "i dag 09:11" }, { t: "Pause endret fra 30 min til 45 min", who: "Maria A.", time: "i dag 09:11" }, { t: "Avpublisert fordi vakten ble endret", sys: true, time: "i dag 09:11" }] } }),
    sh("ea", 5, "Vertinne", "sal", "10–18", 10, 18, { lc: "published" }),
    sh("ea", 6, "Vertinne", "sal", "11–17", 11, 17, { lc: "published" }),
    // Mats — bartender (NOT friday → gap)
    sh("mh", 2, "Bartender", "bar", "17–23", 17, 23, { lc: "settled", lock: true }),
    sh("mh", 3, "Bartender", "bar", "17–23", 17, 23, { lc: "active", ok: true }),
    sh("mh", 5, "Bartender", "bar", "17–23", 17, 23, { lc: "published" }),
  ];

  // open staffing gaps (uncovered demand)
  const GAPS = [
    { d: 4, role: "Bartender", dep: "bar", t: "17–23", sev: "crit" },
    { d: 6, role: "Kokk", dep: "kjokken", t: "12–20", sev: "warn" },
  ];

  // per-day coverage % (demand met) + demand/staffed counts
  const COV = [
    { pct: 96, staffed: 4, demand: 4 },
    { pct: 92, staffed: 4, demand: 4 },
    { pct: 94, staffed: 5, demand: 5 },
    { pct: 92, staffed: 5, demand: 5 },
    { pct: 83, staffed: 4, demand: 5, gap: 1 },
    { pct: 88, staffed: 5, demand: 6, gap: 1 },
    { pct: 100, staffed: 2, demand: 2 },
  ];

  const covColor = (p) => p >= 95 ? "var(--success)" : p >= 85 ? "var(--warning)" : "var(--error)";

  // marketplace offers (Vaktbørs)
  const OFFERS = [
    { id: "o1", role: "Bartender", dep: "bar", day: "Fre 31/5", t: "17–23", reason: "Bemanningshull — ingen bartender", urgent: true, claims: [{ id: "mh", from: "ekstern" }, { id: "jh" }], note: "Krever erfaring med kasse + skjenkebevilling." },
    { id: "o2", role: "Servitør", dep: "sal", day: "Lør 1/6", t: "12–18", reason: "Ekstra ved fullt hus", urgent: false, claims: [{ id: "pk" }, { id: "ea" }, { id: "sl" }], note: "3 ansatte har meldt interesse." },
    { id: "o3", role: "Kokk", dep: "kjokken", day: "Søn 2/6", t: "12–20", reason: "Even brunsj", urgent: false, claims: [], note: "Ingen har meldt seg ennå." },
  ];

  // swap requests (Bytteforespørsler)
  const SWAPS = [
    {
      id: "w1", kind: "Vaktbytte", time: "for 2 t siden",
      from: { id: "sl", role: "Servitør", day: "Lør 1/6", t: "11–19" },
      to: { id: "pk", role: "Servitør", day: "Søn 2/6", t: "11–19" },
      note: "Selma vil bytte lørdag mot Petters søndag — begge har sagt ja.",
      checks: ["Begge kvalifisert (Servitør)", "Ingen overtidskonflikt", "Hviletid ivaretatt (>11t)"],
    },
    {
      id: "w2", kind: "Gi bort vakt", time: "i går 19:42",
      from: { id: "ea", role: "Vertinne", day: "Søn 2/6", t: "11–17" },
      to: { id: "sl", role: "Servitør", day: "Søn 2/6", t: "11–17" },
      note: "Even gir bort søndagsvakt. Selma har takket ja og er kvalifisert som vertinne.",
      checks: ["Selma kvalifisert (Vertinne)", "Ingen overtidskonflikt", "Innenfor kontrakt (37,5t)"],
    },
  ];

  window.VP = { DEPT, EMP, empById, DAYS, TODAY, SHIFTS, GAPS, COV, COV_COLOR: covColor, OFFERS, SWAPS };

  // ---------- shared bits ----------
  function Av({ e, size = 28 }) {
    return <span className="vp-emp-av" style={{ width: size, height: size, background: e.c, fontSize: size * 0.37 }}>{e.init}</span>;
  }
  window.VPAv = Av;

  // ====================================================================
  // DAY INSPECTOR — operational cockpit for the selected day
  // ====================================================================
  function Inspector({ dayIdx, onClose, onPlanner, onFillGap, onShift, onPublishDay, dayPub, toast }) {
    const day = DAYS[dayIdx];
    const cov = COV[dayIdx];
    const shifts = SHIFTS.filter(s => s.d === dayIdx);
    const gaps = GAPS.filter(g => g.d === dayIdx);
    const hours = shifts.reduce((a, s) => a + (s.en - s.st), 0);
    const cost = Math.round(hours * 255);
    const state = day.today ? "active" : dayIdx < TODAY ? "locked" : (shifts.some(s => s.status === "draft") ? "draft" : "published");
    const span = 18, H0 = 6; // 06..24
    const pct = (h) => `${((h - H0) / span) * 100}%`;
    const NOW = 14.2;

    const [tab, setTab] = useState("daginfo");
    const [dlShift, setDlShift] = useState("all");
    const [dlSort, setDlSort] = useState("tid");
    const ITABS = [["daginfo", "Daginfo", "gauge"], ["bookinger", "Bookinger", "calendar"], ["dagslinje", "Dagslinje", "clock"], ["okonomi", "Økonomi", "wallet"]];

    // revenue derived from the day's actual roster at a realistic labour share (keeps the tab internally consistent)
    const laborShare = [0.281, 0.274, 0.286, 0.279, 0.268, 0.262, 0.292][dayIdx] || 0.28;
    const dayRev = cost > 0 ? Math.round(cost / laborShare / 500) * 500 : 0;
    const REV_SHAPE = [[10, .30], [11, .55], [12, .92], [13, .84], [14, .48], [15, .34], [16, .44], [17, .66], [18, .92], [19, 1.0], [20, .82], [21, .58], [22, .40]];
    const shapeSum = REV_SHAPE.reduce((a, x) => a + x[1], 0);
    const hourly = REV_SHAPE.map(([h, f]) => ({ h, rev: Math.round(dayRev * f / shapeSum) }));
    const maxHourly = Math.max.apply(null, hourly.map(x => x.rev)) || 1;
    const peak = hourly.reduce((a, b) => b.rev > a.rev ? b : a, hourly[0]);
    const avgHour = Math.round(dayRev / hourly.length);

    // economy (editable forventet → live labor share)
    const [expRev, setExpRev] = useState(dayRev);
    const budgetRev = Math.round(dayRev * 1.04 / 1000) * 1000;
    const laborPct = expRev > 0 ? (cost / expRev * 100) : 0;
    const dbEst = Math.round(expRev - cost - expRev * 0.31);

    // bookings for the day (weekend busier)
    const BK_ALL = [
      { t: "12:00", name: "Berg", pax: 2, area: "Vindusrekke", st: "bekreftet" },
      { t: "13:15", name: "Nordby AS", pax: 8, area: "Sal B", st: "bekreftet", note: "Lunsjmøte" },
      { t: "18:30", name: "Hansen", pax: 4, area: "Sal A", st: "bekreftet" },
      { t: "19:00", name: "Lie", pax: 2, area: "Bar", st: "venteliste" },
      { t: "20:00", name: "Sundgården", pax: 12, area: "Selskapslokale", st: "bekreftet", note: "Bursdag · meny 3" },
      { t: "20:30", name: "Aas", pax: 5, area: "Sal A", st: "bekreftet" },
    ];
    const bookings = day.we ? BK_ALL : BK_ALL.slice(0, 4);
    const covers = bookings.reduce((a, b) => a + b.pax, 0);
    const maxParty = bookings.reduce((a, b) => Math.max(a, b.pax), 0);

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    return (
      <>
        <div className="vp-insp-scrim" onClick={onClose} />
        <aside className="vp-insp" role="dialog" aria-label={`Dagsinspektør ${day.dn} ${day.num}`}>
          <div className="vp-insp-head">
            <div className="vp-insp-eyebrow">
              <span>Dagsinspektør · Uke 22</span>
              <button className="vp-insp-close" onClick={onClose}><Ic n="x" s={16} /></button>
            </div>
            <div className="vp-insp-title">{day.dn === "Tor" ? "Torsdag" : day.dn === "Fre" ? "Fredag" : day.dn === "Lør" ? "Lørdag" : day.dn === "Søn" ? "Søndag" : day.dn === "Man" ? "Mandag" : day.dn === "Tir" ? "Tirsdag" : "Onsdag"} {day.num}/{day.mon}</div>
            <div className="vp-insp-sub">
              <span className={`vp-statepill ${state}`}>
                {state === "active" ? <><span className="vp-pdot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} /> Aktiv nå</> : state === "locked" ? <><Ic n="lock" s={11} /> Avregnet</> : state === "draft" ? "Utkast" : "Publisert"}
              </span>
              <span>Åpent 10:00–23:00</span>
            </div>
            <div className="vp-insp-tabs">
              {ITABS.map(([k, l, ic]) => (
                <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                  <Ic n={ic} s={13} /> {l}
                  {k === "daginfo" && (gaps.length + shifts.filter(s => s.warn).length) > 0 && <span className="dot" />}
                </button>
              ))}
            </div>
          </div>

          <div className="vp-insp-body">
            {tab === "daginfo" && (<>
              {/* omsetning per time */}
              <div className="vp-insp-sec">
                <h4><Ic n="trendUp" s={13} /> Omsetning per time <span className="vp-insp-h4meta">forventet</span></h4>
                <div className="vp-revbars">
                  {hourly.map(x => (
                    <div key={x.h} className="vp-revbar">
                      <span className="bar" style={{ height: Math.max(5, x.rev / maxHourly * 100) + "%", background: x.rev === maxHourly ? "var(--orange)" : "rgba(249,115,22,0.32)" }} title={x.rev.toLocaleString("nb-NO") + " kr"} />
                      <span className="hh">{x.h}</span>
                    </div>
                  ))}
                </div>
                <div className="vp-revfoot">
                  <div><span className="k">Topp</span><span className="v">{peak.h}:00 · {peak.rev.toLocaleString("nb-NO")}</span></div>
                  <div><span className="k">Snitt</span><span className="v">{avgHour.toLocaleString("nb-NO")} kr/t</span></div>
                  <div><span className="k">Dag</span><span className="v">{dayRev.toLocaleString("nb-NO")} kr</span></div>
                </div>
              </div>

              {/* varsler */}
              {(gaps.length > 0 || shifts.some(s => s.warn)) && (
                <div className="vp-insp-sec">
                  <h4><Ic n="alert" s={13} /> Varsler <span className="cnt">{gaps.length + shifts.filter(s => s.warn).length}</span></h4>
                  {gaps.map((g, i) => (
                    <div key={i} className={`vp-issue ${g.sev}`}>
                      <span className="vp-issue-ic"><Ic n="user" s={15} /></span>
                      <div className="vp-issue-body"><div className="t">{g.role} {g.t} udekket</div><div className="s">{DEPT[g.dep].name} · ingen kvalifisert tildelt</div></div>
                      <button className="vp-issue-btn" onClick={() => onFillGap(g)}>Finn vikar</button>
                    </div>
                  ))}
                  {shifts.filter(s => s.warn).map((s, i) => {
                    const e = empById(s.e);
                    return (
                      <div key={i} className="vp-issue warn">
                        <span className="vp-issue-ic"><Ic n="clock" s={15} /></span>
                        <div className="vp-issue-body"><div className="t">{e.name} — {s.warn}</div><div className="s">{s.role} {s.t} · vurder kortere vakt</div></div>
                        <button className="vp-issue-btn" onClick={() => onShift(s)}>Se</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* aktivitet */}
              <div className="vp-insp-sec">
                <h4><Ic n="history" s={13} /> Aktivitet</h4>
                {[
                  { c: "var(--orange)", who: "Botsson", t: " foreslo bartender-vikar for hullet 17–23", time: "08:14" },
                  { c: "var(--info)", who: "Selma L.", t: " bekreftet kveldsvakt 16–23", time: "i går 20:10" },
                  { c: "var(--success)", who: "Maria A.", t: " publiserte vaktplan for uke 22", time: "i går 17:02" },
                ].map((a, i, arr) => (
                  <div key={i} className="vp-act">
                    <span className="vp-act-rail"><span className="vp-act-dot" style={{ background: a.c }} />{i < arr.length - 1 && <span className="vp-act-line" />}</span>
                    <div className="vp-act-body"><span><span className="who">{a.who}</span>{a.t}</span><div className="time">{a.time}</div></div>
                  </div>
                ))}
              </div>
            </>)}

            {tab === "bookinger" && (
              <div className="vp-insp-sec">
                <h4><Ic n="calendar" s={13} /> Bookinger <span className="cnt">{bookings.length}</span></h4>
                <div className="vp-bk-sum">
                  <div className="vp-bk-stat"><span className="k">Gjester</span><span className="v">{covers}</span></div>
                  <div className="vp-bk-stat"><span className="k">Bord</span><span className="v">{bookings.length}</span></div>
                  <div className="vp-bk-stat"><span className="k">Største</span><span className="v">{maxParty}<span className="u"> pers</span></span></div>
                </div>
                <div className="vp-bk-list">
                  {bookings.map((b, i) => (
                    <div key={i} className="vp-bk">
                      <span className="vp-bk-t">{b.t}</span>
                      <div className="vp-bk-b"><div className="t">{b.name} <span className="pax">{b.pax} pers</span></div><div className="s">{b.area}{b.note ? " · " + b.note : ""}</div></div>
                      <span className={`vp-bk-st ${b.st === "bekreftet" ? "ok" : "wait"}`}>{b.st === "bekreftet" ? "Bekreftet" : "Venteliste"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "dagslinje" && (() => {
              const ft = (t) => String(Math.floor(t)).padStart(2, "0") + ":" + String(Math.round((t - Math.floor(t)) * 60)).padStart(2, "0");
              const dayTasks = [
                { t: 9.5, title: "Temperaturkontroll kjøl & frys", dep: "kjokken" },
                { t: 10.5, title: "Klargjør stasjoner før åpning", dep: "sal" },
                { t: 15, title: "Varemottak og innlevering", dep: "kjokken" },
                { t: 17.5, title: "Brief før kveldsservering", dep: "sal" },
                { t: 22.5, title: "Kassaoppgjør", dep: "bar" },
                { t: 23, title: "Stengerutine og lås", dep: "kjokken" },
              ];
              const selShift = dlShift !== "all" ? shifts.find(s => s.id === dlShift) : null;
              let items = [];
              shifts.forEach(s => { const e = empById(s.e); items.push({ time: s.st, kind: "vakt", c: DEPT[s.dep].c, icon: "user", title: e.name.split(" ")[0] + " starter", sub: s.role + " · " + s.t, shift: s.id }); });
              dayTasks.forEach(t => items.push({ time: t.t, kind: "oppgave", c: DEPT[t.dep] ? DEPT[t.dep].c : "var(--muted)", icon: "check", title: t.title, sub: "Oppgave · " + (DEPT[t.dep] ? DEPT[t.dep].name : "") }));
              bookings.forEach(bk => { const m = /(\d+):(\d+)/.exec(bk.t); const tt = m ? (+m[1] + (+m[2]) / 60) : 12; items.push({ time: tt, kind: "booking", c: "var(--info)", icon: "calendar", title: bk.name + " · " + bk.pax + " pers", sub: bk.area + (bk.note ? " · " + bk.note : "") }); });
              if (selShift) items = items.filter(it => it.shift === selShift.id || (it.time >= selShift.st && it.time <= selShift.en));
              items.sort((a, z) => dlSort === "type" ? (a.kind.localeCompare(z.kind) || a.time - z.time) : a.time - z.time);
              if (day.today && dlSort === "tid") { const ni = items.findIndex(it => it.time > NOW); const nowItem = { time: NOW, kind: "now" }; ni === -1 ? items.push(nowItem) : items.splice(ni, 0, nowItem); }
              return (
                <div className="vp-insp-sec">
                  <h4><Ic n="clock" s={13} /> Dagslinje · hele dagen <span className="vp-insp-h4meta">{items.filter(i => i.kind !== "now").length} hendelser</span></h4>
                  <div className="vp-dl-filter">
                    <button className={`vp-dl-chip ${dlShift === "all" ? "on" : ""}`} onClick={() => setDlShift("all")}>Hele dagen</button>
                    {shifts.map(s => { const e = empById(s.e); return <button key={s.id} className={`vp-dl-chip ${dlShift === s.id ? "on" : ""}`} onClick={() => setDlShift(s.id)}><span className="d" style={{ background: DEPT[s.dep].c }} />{e.name.split(" ")[0]}</button>; })}
                    <span className="vp-dl-sp" />
                    <button className="vp-dl-sort" onClick={() => setDlSort(x => x === "tid" ? "type" : "tid")} title="Sorter"><Ic n="filter" s={12} /> {dlSort === "tid" ? "Tid" : "Type"}</button>
                  </div>
                  <div className="vp-dl">
                    {items.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 2px" }}>Ingen hendelser å vise.</div>}
                    {items.map((it, i) => it.kind === "now" ? (
                      <div key={"now"} className="vp-dl-now"><span className="lbl">Nå · {ft(NOW)}</span><span className="ln" /></div>
                    ) : (
                      <div key={i} className={`vp-dl-item ${day.today && it.time < NOW ? "past" : ""}`}>
                        <div className="vp-dl-time">{ft(it.time)}</div>
                        <div className="vp-dl-rail"><span className="dot" style={{ background: it.c }} /></div>
                        <div className="vp-dl-card"><span className="ic" style={{ color: it.c }}><Ic n={it.icon} s={13} /></span><div className="b"><div className="t">{it.title}</div><div className="s">{it.sub}</div></div><span className={`vp-dl-tag ${it.kind}`}>{it.kind === "vakt" ? "Vakt" : it.kind === "oppgave" ? "Oppgave" : "Booking"}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {tab === "okonomi" && (<>
              <div className="vp-insp-sec">
                <div className="vp-eco-hero">
                  <div className="vp-eco-hero-main">
                    <span className="lbl">Estimert lønnsdekning</span>
                    <span className={`big ${cov.pct >= 95 ? "ok" : cov.pct >= 85 ? "warn" : "crit"}`}>{cov.pct}%</span>
                    <span className="sub">bemanning mot forventet behov</span>
                  </div>
                  <div className="vp-eco-ring" style={{ background: `conic-gradient(var(--orange) ${cov.pct * 3.6}deg, var(--secondary) 0)` }}><span>{cov.pct}%</span></div>
                </div>
              </div>

              <div className="vp-insp-sec">
                <h4><Ic n="wallet" s={13} /> Budsjett &amp; omsetning</h4>
                <div className="vp-eco-field">
                  <label>Forventet omsetning {state === "locked" ? "(faktisk)" : ""}</label>
                  <div className="vp-eco-input">
                    <input type="text" inputMode="numeric" value={expRev.toLocaleString("nb-NO")} onChange={e => { const n = parseInt(e.target.value.replace(/[^\d]/g, "")) || 0; setExpRev(n); }} />
                    <span className="suf">kr</span>
                  </div>
                  <div className="vp-eco-hint">Budsjett {budgetRev.toLocaleString("nb-NO")} kr · <span className={expRev >= budgetRev ? "up" : "down"}>{expRev >= budgetRev ? "+" : "−"}{Math.abs(expRev - budgetRev).toLocaleString("nb-NO")} kr</span></div>
                </div>
                <div className="vp-eco-rows">
                  <div className="vp-eco-row"><span className="k">Lønnskostnad</span><span className="v">{cost.toLocaleString("nb-NO")} kr</span><span className="s">oppregnet · {hours}t × 255</span></div>
                  <div className="vp-eco-row"><span className="k">Lønnsandel</span><span className={`v ${laborPct <= 28 ? "ok" : laborPct <= 31 ? "warn" : "crit"}`}>{laborPct.toFixed(1)}%</span><span className="s">mål 28 %</span></div>
                  <div className="vp-eco-row"><span className="k">Dekningsbidrag est.</span><span className="v">{dbEst.toLocaleString("nb-NO")} kr</span><span className="s">etter lønn &amp; est. varekost 31 %</span></div>
                </div>
              </div>
            </>)}
          </div>

          <div className="vp-insp-foot">
            {state === "locked" ? (
              <button className="sk-primary" onClick={() => { onShift(shifts[0]); }}><Ic n="layers" s={15} /> Se livsløp</button>
            ) : (
              <>
                <button className="sk-ghost" onClick={onPlanner}><Ic n="sparkle" s={15} /> AI</button>
                {dayPub > 0
                  ? <button className="sk-primary" onClick={onPublishDay}><Ic n="megaphone" s={15} /> Publiser dag ({dayPub})</button>
                  : <button className="sk-primary" onClick={() => onShift(null, { d: dayIdx })}><Ic n="plus" s={15} sw={2.2} /> Ny vakt</button>}
              </>
            )}
          </div>
        </aside>
      </>
    );
  }

  // ====================================================================
  // AI PLANNER — command center (generate → review → accept/reject atomic)
  // ====================================================================
  const PL_STEPS = ["Leser bemanningsbehov og åpningstider", "Sjekker kompetanse, kontrakter og AML-regler", "Matcher tilgjengelige ansatte mot hull", "Optimaliserer dekning mot lønnsbudsjett"];
  const PL_CHANGES = [
    { ic: "user", kind: "assign", emp: "jh", dep: "bar", role: "Bartender", t: "Tildel Jonas H. til bartender-hullet", tag: "fre 31/5 · 17–23", why: "Jonas er kvalifisert, har 14t denne uka og ingen kollisjon. Lukker det største hullet.", src: ["Kompetanse", "Timebank", "Vaktplan fre"] },
    { ic: "user", kind: "assign", emp: "ao", dep: "kjokken", role: "Kokk", t: "Tildel Anna O. til kokk søndag", tag: "søn 2/6 · 12–20", why: "Dekker brunsj-behovet. Anna er kvalifisert og har ledig kapasitet på kontrakten.", src: ["Kompetanse", "Tilgjengelighet"] },
    { ic: "swap", kind: "adjust", emp: "ea", t: "Flytt Even A. fra 17–23 til 16–22", tag: "fre 31/5", why: "Jevner ut kveldsbemanning i sal og unngår overlapp mot stengetid.", src: ["Dekningskurve", "Sal"] },
    { ic: "clock", kind: "adjust", emp: "pk", t: "Kort Petter K. sin lørdagsvakt med 1t", tag: "lør 1/6 · 16–22", why: "Holder Petter under 37,5t og unngår overtidstillegg.", src: ["Timebank", "Lønnsregler"], flag: "Reduserer overtid" },
  ];

  function Planner({ onClose, onAccept, toast }) {
    const [phase, setPhase] = useState("loading"); // loading | review
    const [step, setStep] = useState(0);
    const [rows, setRows] = useState(() => PL_CHANGES.map(c => ({ include: true, mode: c.kind === "assign" ? "assign" : "confirm", emp: c.emp })));
    const setRow = (i, patch) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
    const selCount = rows.filter(r => r.include).length;
    const modeVerb = { assign: "tildeles", request: "forespørres", open: "legges åpen", confirm: "bekreftes" };
    const acceptSel = () => {
      const used = rows.filter(r => r.include);
      const reqs = used.filter(r => r.mode === "request" || r.mode === "assign").length;
      onAccept();
      toast(`${used.length} ${used.length === 1 ? "endring" : "endringer"} iverksatt${reqs ? ` · ${reqs} sendt til bekreftelse` : ""}`, { undo: () => {} });
    };
    const discussBotsson = () => { onClose(); if (window.SmartoutBot && window.SmartoutBot.open) window.SmartoutBot.open(); toast("Åpner Botsson — drøft forslaget"); };
    useEffect(() => {
      if (phase !== "loading") return;
      if (step >= PL_STEPS.length) { const t = setTimeout(() => setPhase("review"), 420); return () => clearTimeout(t); }
      const t = setTimeout(() => setStep(s => s + 1), 620);
      return () => clearTimeout(t);
    }, [step, phase]);
    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    return (
      <div className="vp-ov-scrim" onMouseDown={onClose}>
        <div className="vp-ov" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="AI-planlegger">
          <div className="vp-ov-head">
            <span className="vp-ov-av"><Ic n="sparkle" s={19} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-ov-htitle">AI-planlegger</div>
              <div className="vp-ov-hsub"><span className="live">BOTSSON</span> Forslag for uke 22 · Bistro Nord</div>
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          <div className="vp-ov-body">
            {phase === "loading" ? (
              <div className="vp-loading">
                <div className="vp-loading-ring" />
                <div className="vp-loading-t">Bygger forslag…</div>
                <div className="vp-loading-s">Botsson lager et utkast du kan godta, justere eller forkaste. Ingenting publiseres automatisk.</div>
                <div className="vp-loading-steps">
                  {PL_STEPS.map((s, i) => (
                    <div key={i} className={`vp-loading-step ${i < step ? "done" : i === step ? "active" : ""}`}>
                      <span className="ic">{i < step ? <Ic n="check" s={12} sw={2.6} /> : i === step ? <Ic n="zap" s={11} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted-soft)" }} />}</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p className="vp-pl-lead">Jeg fant <strong>4 endringer</strong> som lukker <span className="hl">2 bemanningshull</span> og hever ukedekningen fra <strong>89 %</strong> til <strong>97 %</strong> — uten å øke lønnskostnaden. Velg hvilke du vil bruke, og hvordan — tildel direkte, forespør ansatt, eller legg vakten åpen.</p>

                <div className="vp-pl-compare">
                  <div className="vp-pl-card">
                    <div className="lbl"><Ic n="gauge" s={12} /> Nå</div>
                    <div className="vp-pl-cov">89%</div>
                    <div className="vp-pl-meter"><span style={{ width: "70%", background: "var(--success)" }} /><span style={{ width: "16%", background: "var(--warning)" }} /><span style={{ width: "14%", background: "var(--error)" }} /></div>
                    <div className="vp-pl-stat"><span>Udekket</span><b>2 vakter</b></div>
                  </div>
                  <div className="vp-pl-card after">
                    <div className="lbl"><Ic n="check" s={12} sw={2.4} /> Etter forslag</div>
                    <div className="vp-pl-cov">97%</div>
                    <div className="vp-pl-meter"><span style={{ width: "90%", background: "var(--success)" }} /><span style={{ width: "10%", background: "var(--warning)" }} /></div>
                    <div className="vp-pl-stat"><span>Udekket</span><b>0 vakter</b></div>
                  </div>
                </div>

                <h4 style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 4px" }}>Foreslåtte endringer · 4</h4>
                {PL_CHANGES.map((c, i) => {
                  const r = rows[i];
                  const modeOpts = c.kind === "assign"
                    ? [["assign", "Tildel"], ["request", "Forespør"], ["open", "La stå åpen"]]
                    : [["confirm", "Bekreft"], ["request", "Forespør"]];
                  return (
                    <div key={i} className={`vp-pl-change ${r.include ? "" : "off"}`}>
                      <button className={`vp-pl-check ${r.include ? "on" : ""}`} onClick={() => setRow(i, { include: !r.include })} aria-label={r.include ? "Fjern fra pakke" : "Legg til i pakke"}>{r.include && <Ic n="check" s={12} sw={2.8} />}</button>
                      <span className="vp-pl-change-ic"><Ic n={c.ic} s={16} /></span>
                      <div className="vp-pl-change-body">
                        <div className="vp-pl-change-t">{c.t}<span className="tag">{c.tag}</span></div>
                        <div className="vp-pl-change-why">{c.why}</div>
                        <div className="vp-pl-change-src">
                          {c.src.map(s => <span key={s} className="c">{s}</span>)}
                          {c.flag && <span className="vp-pl-change-flag warn">{c.flag}</span>}
                        </div>
                        {r.include && (
                          <div className="vp-pl-change-ctl">
                            <div className="vp-pl-modeseg">
                              {modeOpts.map(([k, l]) => <button key={k} className={r.mode === k ? "on" : ""} onClick={() => setRow(i, { mode: k })}>{l}</button>)}
                            </div>
                            {c.kind === "assign" && r.mode !== "open" && (
                              <div className="vp-pl-empsel">
                                <span className="lbl">{r.mode === "request" ? "Forespør" : "Tildel"}</span>
                                <div className="vp-fselect inline">
                                  <select value={r.emp} onChange={e => setRow(i, { emp: e.target.value })}>
                                    {EMP.filter(e => !c.dep || e.dep === c.dep || e.id === r.emp).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                  </select>
                                  <span className="vp-fselect-chev"><Ic n="chevDown" s={13} /></span>
                                </div>
                              </div>
                            )}
                            {r.mode === "open" && <span className="vp-pl-modehint"><Ic n="megaphone" s={12} /> Legges ut på Vaktbørs</span>}
                            {r.mode === "request" && <span className="vp-pl-modehint"><Ic n="send" s={12} /> Må bekreftes av ansatt</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {phase === "review" && (
            <div className="vp-ov-foot">
              <span className="vp-ov-disc"><Ic n="shield" s={13} /> Du bekrefter — ingenting publiseres uten deg.</span>
              <span className="sp" />
              <button className="sk-ghost" onClick={discussBotsson}><Ic n="bot" s={15} /> Drøft med Botsson</button>
              <button className="sk-ghost" onClick={onClose}><Ic n="x" s={15} /> Forkast</button>
              <button className="sk-primary" disabled={selCount === 0} onClick={acceptSel}><Ic n="check" s={15} sw={2.3} /> Godta valgte ({selCount})</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ====================================================================
  // VAKTBØRS — OFFER MODAL (interest queue · priority · auto-assign · confirm)
  // ====================================================================
  function OfferModal({ offer, onClose, onAssign, openProfile, toast }) {
    const dmap = { Man: 0, Tir: 1, Ons: 2, Tor: 3, Fre: 4, Lør: 5, Søn: 6 };
    const dIdx = dmap[offer.day.split(" ")[0]] != null ? dmap[offer.day.split(" ")[0]] : TODAY;
    const [queue, setQueue] = useState(() => offer.claims.map(c => c.id));
    const [declined, setDeclined] = useState([]);
    const [auto, setAuto] = useState("6"); // off | 2 | 6 | 24
    const [sent, setSent] = useState(false);

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    const move = (i, dir) => setQueue(q => { const n = [...q]; const j = i + dir; if (j < 0 || j >= n.length) return q; [n[i], n[j]] = [n[j], n[i]]; return n; });
    const decline = (id) => { setQueue(q => q.filter(x => x !== id)); setDeclined(d => [...d, id]); };
    const restore = (id) => { setDeclined(d => d.filter(x => x !== id)); setQueue(q => [...q, id]); };
    const fitOf = (e) => {
      const match = e.role === offer.role || (offer.role === "Servitør" && ["Servitør", "Vertinne"].includes(e.role)) || (offer.role === "Kokk" && e.role === "Kokk") || (offer.role === "Bartender" && ["Bartender", "Kokk"].includes(e.role));
      return match ? { v: "good", l: "God match" } : { v: "warn", l: "Mulig" };
    };
    const first = queue[0] ? empById(queue[0]) : null;

    return (
      <div className="vp-ov-scrim" onMouseDown={onClose}>
        <div className="vp-ov sm" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label={`Vaktbørs ${offer.role}`}>
          <div className="vp-ov-head">
            <span className="vp-ov-av" style={{ background: DEPT[offer.dep].c }}><Ic n="route" s={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-ov-htitle">{offer.role} · {offer.day}</div>
              <div className="vp-ov-hsub"><span className="live">VAKTBØRS</span> {offer.t} · {DEPT[offer.dep].name}{offer.urgent ? " · haster" : ""}</div>
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          <div className="vp-ov-body">
            <div className="vp-omx-reason"><Ic n="alert" s={14} /> {offer.reason}. {offer.note}</div>

            {/* auto-assign timeline */}
            <div className="vp-omx-sec">
              <div className="vp-omx-sech"><Ic n="clock" s={13} /> Automatisk tildeling</div>
              <div className="vp-omx-autoseg">
                {[["off", "Av"], ["2", "Om 2t"], ["6", "Om 6t"], ["24", "Om 24t"]].map(([k, l]) => (
                  <button key={k} className={auto === k ? "on" : ""} onClick={() => setAuto(k)}>{l}</button>
                ))}
              </div>
              <div className="vp-omx-autohint">
                {auto === "off"
                  ? "Du tildeler manuelt. Ingen automatisk videreføring."
                  : `Svarer ikke #1 innen ${auto}t, går tilbudet automatisk videre til neste i køen — helt ned til siste.`}
              </div>
            </div>

            {/* priority queue */}
            <div className="vp-omx-sec">
              <div className="vp-omx-sech"><Ic n="layers" s={13} /> Prioritert kø <span className="cnt">{queue.length}</span></div>
              {queue.length === 0 ? (
                <div className="vp-omx-empty"><span className="ic"><Ic n="clock" s={20} /></span><div className="t">Ingen i køen</div><div className="s">Ingen har meldt interesse ennå. Del vakten på nytt eller la den ligge åpen.</div></div>
              ) : (
                <div className="vp-omx-queue">
                  {queue.map((id, i) => {
                    const e = empById(id); if (!e) return null;
                    const fit = fitOf(e);
                    const claim = offer.claims.find(c => c.id === id);
                    return (
                      <div key={id} className={`vp-omx-row ${i === 0 ? "lead" : ""}`}>
                        <span className="vp-omx-rank">{i + 1}</span>
                        <button className="vp-omx-av" onClick={() => openProfile(id)} title={`Profil · ${e.name}`}><span className="vp-emp-av" style={{ width: 32, height: 32, background: e.c, fontSize: 11 }}>{e.init}</span></button>
                        <div className="vp-omx-id">
                          <div className="nm">{e.name}{claim && claim.from === "ekstern" && <span className="vp-omx-ext">ekstern</span>}</div>
                          <div className="rl"><span className="dot" style={{ background: DEPT[e.dep].c }} /> {e.role}</div>
                        </div>
                        <span className={`vp-omx-fit ${fit.v}`}>{fit.l}</span>
                        <div className="vp-omx-reorder">
                          <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Opp"><Ic n="chevUp" s={14} /></button>
                          <button onClick={() => move(i, 1)} disabled={i === queue.length - 1} aria-label="Ned"><Ic n="chevDown" s={14} /></button>
                        </div>
                        <button className="vp-omx-decline" onClick={() => decline(id)} title="Avbøy"><Ic n="x" s={14} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              {declined.length > 0 && (
                <div className="vp-omx-declined">
                  <span className="lbl">Avbøyd</span>
                  {declined.map(id => { const e = empById(id); return e ? <button key={id} className="vp-omx-dchip" onClick={() => restore(id)}>{e.name.split(" ")[0]} <Ic n="repeat" s={11} /></button> : null; })}
                </div>
              )}
              <button className="vp-omx-share" onClick={() => toast("Vakten delt på nytt til kvalifiserte")}><Ic n="megaphone" s={13} /> Del på nytt til flere</button>
            </div>
          </div>

          <div className="vp-ov-foot">
            <span className="vp-ov-disc"><Ic n="shield" s={13} /> Tildelt ansatt må bekrefte vakten i appen.</span>
            <span className="sp" />
            <button className="sk-ghost" onClick={onClose}><Ic n="x" s={15} /> Lukk</button>
            <button className="sk-primary" disabled={!first} onClick={() => onAssign(offer.id, queue[0], auto !== "off" ? auto : null)}>
              <Ic n="send" s={15} /> {first ? `Send til ${first.name.split(" ")[0]} (#1)` : "Ingen i køen"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // DIRECT ASSIGN MODAL — manager assigns a shift to a chosen employee,
  // but still offers it down a ranked queue with an offer-window + message.
  // ====================================================================
  function AssignModal({ fit, empId, onClose, onAssign, openProfile, toast }) {
    const chosen = empById(empId);
    const roleMatch = (e) => e.role === fit.role
      || (fit.role === "Servitør" && ["Servitør", "Vertinne"].includes(e.role))
      || (fit.role === "Kokk" && e.role === "Kokk")
      || (fit.role === "Bartender" && ["Bartender", "Kokk"].includes(e.role));
    // queue: chosen first, then other qualified, then the rest
    const initialQueue = [empId, ...EMP.filter(e => e.id !== empId && roleMatch(e)).map(e => e.id)].slice(0, 5);
    const [queue, setQueue] = useState(initialQueue);
    const [declined, setDeclined] = useState([]);
    const [auto, setAuto] = useState("2");          // off | 2 | 6 | 24
    const [st, setSt] = useState(fit.st != null ? fit.st : 16);
    const [en, setEn] = useState(fit.en != null ? fit.en : 23);
    const [msg, setMsg] = useState("");

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    const move = (i, dir) => setQueue(q => { const n = [...q]; const j = i + dir; if (j < 0 || j >= n.length) return q; [n[i], n[j]] = [n[j], n[i]]; return n; });
    const decline = (id) => { setQueue(q => q.filter(x => x !== id)); setDeclined(d => [...d, id]); };
    const restore = (id) => { setDeclined(d => d.filter(x => x !== id)); setQueue(q => [...q, id]); };
    const fitOf = (e) => roleMatch(e) ? { v: "good", l: "God match" } : { v: "warn", l: "Mulig" };
    const hhmm = (h) => `${String(Math.floor(h)).padStart(2, "0")}:00`;
    const first = queue[0] ? empById(queue[0]) : null;

    return (
      <div className="vp-ov-scrim" onMouseDown={onClose}>
        <div className="vp-ov sm" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label={`Tildel ${fit.role}`}>
          <div className="vp-ov-head">
            <span className="vp-ov-av" style={{ background: DEPT[fit.dep].c }}>{chosen ? chosen.init : <Ic n="user" s={18} />}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-ov-htitle">Tildel {fit.role} · {chosen ? chosen.name : "ansatt"}</div>
              <div className="vp-ov-hsub"><span className="live">TILDELING</span> {DAYS[fit.d].dn} {DAYS[fit.d].num}/{DAYS[fit.d].mon} · {hhmm(st)}–{hhmm(en)} · {DEPT[fit.dep].name}{fit.sick ? " · sykefravær" : ""}</div>
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          <div className="vp-ov-body">
            <div className="vp-omx-reason"><Ic n="shield" s={14} /> Du tildeler direkte, men {first ? first.name.split(" ")[0] : "ansatt"} må bekrefte i appen. Svarer ikke #1, går vakten videre i køen.</div>

            {/* shift adjustments */}
            <div className="vp-omx-sec">
              <div className="vp-omx-sech"><Ic n="clock" s={13} /> Juster vakten</div>
              <div className="vp-assign-times">
                <label><span>Start</span><input className="vp-finput" type="time" value={hhmm(st)} onChange={e => setSt(parseInt(e.target.value) || 0)} /></label>
                <label><span>Slutt</span><input className="vp-finput" type="time" value={hhmm(en)} onChange={e => setEn(parseInt(e.target.value) || 0)} /></label>
                <span className="vp-assign-dur">{Math.max(0, en - st)}t</span>
              </div>
            </div>

            {/* auto-assign timeline */}
            <div className="vp-omx-sec">
              <div className="vp-omx-sech"><Ic n="clock" s={13} /> Svarfrist før vakten går videre</div>
              <div className="vp-omx-autoseg">
                {[["off", "Av"], ["2", "Om 2t"], ["6", "Om 6t"], ["24", "Om 24t"]].map(([k, l]) => (
                  <button key={k} className={auto === k ? "on" : ""} onClick={() => setAuto(k)}>{l}</button>
                ))}
              </div>
              <div className="vp-omx-autohint">
                {auto === "off"
                  ? "Vakten venter på #1 til du griper inn manuelt."
                  : `Bekrefter ikke ${first ? first.name.split(" ")[0] : "#1"} innen ${auto}t, går tilbudet automatisk videre til neste i køen.`}
              </div>
            </div>

            {/* priority queue */}
            <div className="vp-omx-sec">
              <div className="vp-omx-sech"><Ic n="layers" s={13} /> Prioritert kø <span className="cnt">{queue.length}</span></div>
              {queue.length === 0 ? (
                <div className="vp-omx-empty"><span className="ic"><Ic n="clock" s={20} /></span><div className="t">Ingen i køen</div><div className="s">Legg tilbake en ansatt eller lukk for å la vakten stå åpen.</div></div>
              ) : (
                <div className="vp-omx-queue">
                  {queue.map((id, i) => {
                    const e = empById(id); if (!e) return null;
                    const f = fitOf(e);
                    return (
                      <div key={id} className={`vp-omx-row ${i === 0 ? "lead" : ""}`}>
                        <span className="vp-omx-rank">{i + 1}</span>
                        <button className="vp-omx-av" onClick={() => openProfile(id)} title={`Profil · ${e.name}`}><span className="vp-emp-av" style={{ width: 32, height: 32, background: e.c, fontSize: 11 }}>{e.init}</span></button>
                        <div className="vp-omx-id">
                          <div className="nm">{e.name}{i === 0 && <span className="vp-omx-ext" style={{ background: "var(--orange-soft)", color: "var(--orange-dark)" }}>valgt</span>}</div>
                          <div className="rl"><span className="dot" style={{ background: DEPT[e.dep].c }} /> {e.role}</div>
                        </div>
                        <span className={`vp-omx-fit ${f.v}`}>{f.l}</span>
                        <div className="vp-omx-reorder">
                          <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Opp"><Ic n="chevUp" s={14} /></button>
                          <button onClick={() => move(i, 1)} disabled={i === queue.length - 1} aria-label="Ned"><Ic n="chevDown" s={14} /></button>
                        </div>
                        <button className="vp-omx-decline" onClick={() => decline(id)} title="Fjern fra kø"><Ic n="x" s={14} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              {declined.length > 0 && (
                <div className="vp-omx-declined">
                  <span className="lbl">Fjernet</span>
                  {declined.map(id => { const e = empById(id); return e ? <button key={id} className="vp-omx-dchip" onClick={() => restore(id)}>{e.name.split(" ")[0]} <Ic n="repeat" s={11} /></button> : null; })}
                </div>
              )}
            </div>

            {/* message */}
            <div className="vp-omx-sec">
              <div className="vp-omx-sech"><Ic n="send" s={13} /> Melding til ansatt <span className="cnt" style={{ background: "transparent", color: "var(--muted-soft)" }}>valgfritt</span></div>
              <textarea className="vp-finput" style={{ minHeight: 64, width: "100%" }} value={msg} onChange={e => setMsg(e.target.value)} placeholder={`Hei ${first ? first.name.split(" ")[0] : ""} — kan du ta denne vakten? Gi beskjed om det passer.`} />
            </div>
          </div>

          <div className="vp-ov-foot">
            <span className="vp-ov-disc"><Ic n="shield" s={13} /> {auto === "off" ? "Tildelt ansatt må bekrefte i appen." : `Går videre automatisk etter ${auto}t.`}</span>
            <span className="sp" />
            <button className="sk-ghost" onClick={onClose}><Ic n="x" s={15} /> Avbryt</button>
            <button className="sk-primary" disabled={!first} onClick={() => onAssign(queue[0], { ...fit, st, en, t: `${st}–${en}`, auto: auto !== "off" ? auto : null, msg: msg.trim() })}>
              <Ic n="send" s={15} /> {first ? `Send til ${first.name.split(" ")[0]} (#1)` : "Ingen i køen"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // SWAP CONFIRM MODAL — review a swap request, add a message, decide.
  // ====================================================================
  function SwapModal({ swap, resolved, onClose, onResolve, openProfile, toast }) {
    const a = empById(swap.from.id), b = empById(swap.to.id);
    const [msg, setMsg] = useState("");
    const [notify, setNotify] = useState(true);
    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);
    const Side = ({ p, e, dir }) => (
      <div className="vp-swapm-side">
        <button className="vp-swapm-av" onClick={() => openProfile(p.id)} title={`Profil · ${e.name}`}><span className="vp-emp-av" style={{ width: 38, height: 38, background: e.c, fontSize: 13 }}>{e.init}</span></button>
        <div className="vp-swapm-id"><div className="nm">{e.name}</div><div className="rl">{dir === "from" ? "Gir fra seg" : "Tar over"}</div></div>
        <div className="vp-swapm-shift"><div className="r">{p.role}</div><div className="t">{p.day} · {p.t}</div></div>
      </div>
    );
    return (
      <div className="vp-ov-scrim" onMouseDown={onClose}>
        <div className="vp-ov sm" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Bekreft bytte">
          <div className="vp-ov-head">
            <span className="vp-ov-av" style={{ background: "var(--orange)" }}><Ic n="swap" s={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-ov-htitle">{swap.kind}</div>
              <div className="vp-ov-hsub"><span className="live">BYTTE</span> Forespurt {swap.time}</div>
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          <div className="vp-ov-body">
            <div className="vp-swapm-trade">
              <Side p={swap.from} e={a} dir="from" />
              <span className="vp-swapm-arrow"><Ic n="swap" s={16} /></span>
              <Side p={swap.to} e={b} dir="to" />
            </div>

            {swap.note && <div className="vp-omx-reason"><Ic n="message" s={14} /> «{swap.note}»</div>}

            <div className="vp-omx-sec">
              <div className="vp-omx-sech"><Ic n="sparkle" s={13} /> Botsson har sjekket</div>
              <div className="vp-swapm-checks">
                {swap.checks.map((c, i) => <div key={i} className="vp-swapm-ck"><span className="ic"><Ic n="check" s={13} sw={2.6} /></span> {c}</div>)}
              </div>
            </div>

            {!resolved && (
              <>
                <div className="vp-omx-sec">
                  <div className="vp-omx-sech"><Ic n="send" s={13} /> Melding til begge <span className="cnt" style={{ background: "transparent", color: "var(--muted-soft)" }}>valgfritt</span></div>
                  <textarea className="vp-finput" style={{ minHeight: 60, width: "100%" }} value={msg} onChange={e => setMsg(e.target.value)} placeholder="F.eks. «Godkjent — husk å oppdatere åpningsansvar.»" />
                </div>
                <button type="button" className={`vp-swapm-toggle ${notify ? "on" : ""}`} role="switch" aria-checked={notify} onClick={() => setNotify(v => !v)}>
                  <span className="sw"><span className="knob" /></span>
                  <span className="tx">Varsle begge ansatte i appen</span>
                </button>
              </>
            )}
            {resolved && (
              <div className="vp-swapm-resolved"><Ic n={resolved === "approved" ? "check" : "x"} s={16} sw={2.3} /> {resolved === "approved" ? "Bytte godkjent — begge er varslet" : "Bytte avslått"}</div>
            )}
          </div>

          <div className="vp-ov-foot">
            <span className="vp-ov-disc"><Ic n="shield" s={13} /> Ingen bytter gjennomføres uten din godkjenning.</span>
            <span className="sp" />
            {resolved ? (
              <button className="sk-ghost" onClick={onClose}>Lukk</button>
            ) : (
              <>
                <button className="sk-ghost" style={{ color: "var(--error)" }} onClick={() => onResolve(swap.id, false, { msg, notify })}>Avslå</button>
                <button className="sk-primary" onClick={() => onResolve(swap.id, true, { msg, notify })}><Ic n="check" s={15} sw={2.3} /> Godkjenn bytte</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // SHIFT CREATE / EDIT MODAL
  // ====================================================================
  function ShiftModal({ shift, slot, onClose, onSave, onDelete, toast }) {
    const editing = !!shift;
    const locked = shift && shift.lock;
    const e0 = shift ? empById(shift.e) : null;
    const [empId, setEmpId] = useState(shift ? shift.e : "");
    const [role, setRole] = useState(shift ? shift.role : "");
    const [dep, setDep] = useState(shift ? shift.dep : (slot && slot.dep) || "sal");
    const [start, setStart] = useState(shift ? String(shift.st).padStart(2, "0") + ":00" : "16:00");
    const [end, setEnd] = useState(shift ? String(shift.en).padStart(2, "0") + ":00" : "23:00");
    const dayIdx = shift ? shift.d : (slot && slot.d) || TODAY;
    const day = DAYS[dayIdx];
    const emp = empById(empId);
    const hrs = (parseInt(end) - parseInt(start)) || 0;
    const conflict = empId === "pk" && hrs >= 7; // demo overtime conflict

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    return (
      <div className="vp-ov-scrim" onMouseDown={onClose}>
        <div className="vp-ov sm" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label={editing ? "Rediger vakt" : "Ny vakt"}>
          <div className="vp-ov-head">
            <span className="vp-ov-av plain"><Ic n="grid" s={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-ov-htitle">{editing ? "Rediger vakt" : "Ny vakt"}</div>
              <div className="vp-ov-hsub">{day.dn} {day.num}/{day.mon} · Uke 22</div>
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          <div className="vp-ov-body">
            {locked && (
              <div className="vp-lc-locknote" style={{ marginBottom: 18 }}>
                <span className="ic"><Ic n="lock" s={16} /></span>
                <span>Denne vakten er <strong>avregnet og låst</strong>. Historiske vakter kan ikke endres — åpne livsløpet for å se data og godkjenning.</span>
              </div>
            )}
            <div className="vp-form" style={locked ? { opacity: .6, pointerEvents: "none" } : {}}>
              <div className="vp-frow">
                <span className="vp-flbl">Ansatt</span>
                <div className="vp-fchips">
                  {EMP.map(e => (
                    <button key={e.id} className={`vp-fchip ${empId === e.id ? "on" : ""}`} onClick={() => { setEmpId(e.id); setRole(e.role); setDep(e.dep); }}>
                      <Av e={e} size={20} /> {e.name}
                    </button>
                  ))}
                  <button className={`vp-fchip ${empId === "" ? "on" : ""}`} onClick={() => setEmpId("")}><Ic n="user" s={14} c="var(--muted)" /> Åpen vakt</button>
                </div>
              </div>
              <div className="vp-frow two">
                <div className="vp-frow"><span className="vp-flbl">Rolle</span><input className="vp-finput" value={role} onChange={e => setRole(e.target.value)} placeholder="f.eks. Servitør" /></div>
                <div className="vp-frow"><span className="vp-flbl">Avdeling</span>
                  <div className="vp-fchips">
                    {Object.entries(DEPT).map(([k, d]) => (
                      <button key={k} className={`vp-fchip ${dep === k ? "on" : ""}`} onClick={() => setDep(k)} style={{ height: 34 }}><span className="d" style={{ background: d.c }} /> {d.name}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="vp-frow two">
                <div className="vp-frow"><span className="vp-flbl">Start</span><input className="vp-finput" type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
                <div className="vp-frow"><span className="vp-flbl">Slutt</span><input className="vp-finput" type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
              </div>
              {conflict && (
                <div className="vp-fconflict"><Ic n="alert" s={15} /> {emp ? emp.name : "Ansatt"} passerer 37,5t denne uka med denne vakten — gir overtidstillegg.</div>
              )}
              <div className="vp-frow"><span className="vp-flbl">Notat (valgfritt)</span><textarea className="vp-finput" placeholder="Synlig for ansatt — f.eks. oppmøtested, ansvar…" /></div>
            </div>
          </div>

          <div className="vp-ov-foot">
            {editing && !locked && <button className="sk-ghost" style={{ color: "var(--error)" }} onClick={() => { onDelete(shift); }}><Ic n="trash" s={15} /> Slett</button>}
            <span className="sp" />
            <button className="sk-ghost" onClick={onClose}>Avbryt</button>
            {!locked && <button className="sk-primary" onClick={() => onSave({ id: shift ? shift.id : null, e: empId, d: dayIdx, role, dep, t: `${parseInt(start)}–${parseInt(end)}`, st: parseInt(start), en: parseInt(end), status: "draft" })}><Ic n="check" s={15} sw={2.3} /> {editing ? "Lagre" : "Legg til (utkast)"}</button>}
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // SHIFT LIFECYCLE DETAIL
  // ====================================================================
  const LC_PHASES = [
    { k: "planned", l: "Planlagt", ic: "grid" },
    { k: "published", l: "Publisert", ic: "megaphone" },
    { k: "active", l: "Aktiv", ic: "play" },
    { k: "interpreted", l: "Tolket", ic: "clock" },
    { k: "settled", l: "Avregnet", ic: "wallet" },
    { k: "approved", l: "Godkjent", ic: "check" },
    { k: "closed", l: "Lukket", ic: "lock" },
  ];
  const LC_ORDER = ["planned", "published", "active", "interpreted", "settled", "approved", "closed"];

  function Lifecycle({ shift, onClose, toast }) {
    const e = empById(shift.e);
    const day = DAYS[shift.d];
    const curKey = shift.lc === "closed" ? "closed" : shift.lc === "settled" ? "settled" : shift.lc === "active" ? "active" : "published";
    const curIdx = LC_ORDER.indexOf(curKey);
    const isHistoric = curKey === "closed" || curKey === "settled";

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    return (
      <div className="vp-ov-scrim" onMouseDown={onClose}>
        <div className="vp-ov" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Vaktens livsløp">
          <div className="vp-ov-head">
            <span className="vp-ov-av plain" style={{ background: DEPT[shift.dep].c, color: "#fff" }}><Ic n="layers" s={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-ov-htitle">{shift.role} · {e ? e.name : "Åpen vakt"}</div>
              <div className="vp-ov-hsub">{day.dn} {day.num}/{day.mon} · {shift.t} · {DEPT[shift.dep].name}</div>
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          <div className="vp-ov-body">
            {isHistoric && (
              <div className="vp-lc-locknote">
                <span className="ic"><Ic n="lock" s={16} /></span>
                <span>Vakten er <strong>{curKey === "closed" ? "lukket" : "avregnet"}</strong> og kan ikke endres. Den viser nå full sporbarhet fra plan til lønn.</span>
              </div>
            )}

            {/* phase flow */}
            <div className="vp-lc-flow">
              {LC_PHASES.map((p, i) => {
                const pi = LC_ORDER.indexOf(p.k);
                const cls = pi < curIdx ? "done" : pi === curIdx ? "current" : "";
                return (
                  <div key={p.k} className={`vp-lc-phase ${cls}`}>
                    <span className="vp-lc-node"><Ic n={p.ic} s={14} sw={cls === "done" ? 2.4 : 1.8} /></span>
                    <span className="vp-lc-plabel">{p.l}</span>
                    <span className="vp-lc-ptime">{["27/5 17:02", "27/5 17:05", isHistoric ? "fullført" : "nå", isHistoric ? "auto" : "—", isHistoric ? "29/5" : "—", isHistoric ? "Maria A." : "—", isHistoric && curKey === "closed" ? "låst" : "—"][i]}</span>
                  </div>
                );
              })}
            </div>

            {/* provenance */}
            <div className="vp-lc-prov">
              <div className="vp-lc-block">
                <div className="h"><Ic n="grid" s={12} /> Planlagt vakt</div>
                <div className="vp-lc-line"><span className="k">Rolle</span><span className="v">{shift.role}</span></div>
                <div className="vp-lc-line"><span className="k">Planlagt tid</span><span className="v">{shift.t}</span></div>
                <div className="vp-lc-line"><span className="k">Avdeling</span><span className="v">{DEPT[shift.dep].name}</span></div>
                <div className="vp-lc-line"><span className="k">Publisert av</span><span className="v">Maria A.</span></div>
              </div>
              <div className="vp-lc-block">
                <div className="h"><Ic n="clock" s={12} /> Stempling</div>
                {isHistoric ? (
                  <>
                    <div className="vp-lc-line"><span className="k">Inn</span><span className="v ok">{shift.st}:58</span></div>
                    <div className="vp-lc-line"><span className="k">Ut</span><span className="v">{shift.en}:06</span></div>
                    <div className="vp-lc-line"><span className="k">Pause</span><span className="v">30 min</span></div>
                    <div className="vp-lc-line"><span className="k">Avvik</span><span className="v warn">+8 min</span></div>
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "6px 0" }}>Stemplingsdata kommer når vakten starter.</div>
                )}
              </div>
              <div className="vp-lc-block">
                <div className="h"><Ic n="wallet" s={12} /> Timetolkning</div>
                {isHistoric ? (
                  <>
                    <div className="vp-lc-line"><span className="k">Normaltimer</span><span className="v">{shift.en - shift.st - 0.5}t</span></div>
                    <div className="vp-lc-line"><span className="k">Kveldstillegg</span><span className="v">2,0t</span></div>
                    <div className="vp-lc-line"><span className="k">Overtid</span><span className="v">0t</span></div>
                    <div className="vp-lc-line"><span className="k">Sats</span><span className="v">255 kr/t</span></div>
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "6px 0" }}>Tolkes automatisk etter stempling.</div>
                )}
              </div>
              <div className="vp-lc-block">
                <div className="h"><Ic n="checkdoc" s={12} /> Kostnad & godkjenning</div>
                {isHistoric ? (
                  <>
                    <div className="vp-lc-line"><span className="k">Kostnadsbilde</span><span className="v">{((shift.en - shift.st) * 255).toLocaleString("nb-NO")} kr</span></div>
                    <div className="vp-lc-line"><span className="k">Status</span><span className="v ok">Godkjent</span></div>
                    <div className="vp-lc-line"><span className="k">Av</span><span className="v">Maria A.</span></div>
                    <div className="vp-lc-line"><span className="k">Til lønn</span><span className="v ok">Klar</span></div>
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "6px 0" }}>Avregnes og sendes til godkjenning etter vakten.</div>
                )}
              </div>
            </div>
          </div>

          <div className="vp-ov-foot">
            <span className="vp-ov-disc"><Ic n="history" s={13} /> Full revisjonslogg tilgjengelig</span>
            <span className="sp" />
            {isHistoric && curKey === "settled" ? (
              <button className="sk-primary" onClick={() => { toast("Vakt godkjent for lønn", { undo: () => {} }); onClose(); }}><Ic n="check" s={15} sw={2.3} /> Godkjenn for lønn</button>
            ) : (
              <button className="sk-ghost" onClick={onClose}>Lukk</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // PUBLISH CONFIRMATION — high-trust checkpoint before committing shifts
  // ====================================================================
  function PublishModal({ rows, onConfirm, onClose, toast }) {
    const [sel, setSel] = useState(() => new Set(rows.map(r => r.id)));
    const [open, setOpen] = useState(() => new Set());
    const [done, setDone] = useState(null); // array of published ids after confirm
    const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleOpen = (id) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    const isBlock = (r) => r.pub.issue && r.pub.issue.sev === "block";
    const isWarn = (r) => r.pub.issue && r.pub.issue.sev === "warn";
    const ready = rows.filter(r => sel.has(r.id) && !isBlock(r));
    const held = rows.filter(r => !sel.has(r.id));
    const warnings = rows.filter(r => sel.has(r.id) && isWarn(r));
    const blocking = rows.filter(r => sel.has(r.id) && isBlock(r));
    const canPublish = blocking.length === 0 && ready.length > 0;

    const dayLbl = (d) => `${DAYS[d].dn} ${DAYS[d].num}/${DAYS[d].mon}`;

    const confirm = () => {
      const ids = ready.map(r => r.id);
      onConfirm(ids);
      setDone(ready.map(r => ({ ...r })));
    };

    return (
      <div className="vp-ov-scrim" onMouseDown={onClose}>
        <div className="vp-ov" style={{ width: "min(760px, 100%)" }} onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Publiser vaktplan">
          <div className="vp-ov-head">
            <span className="vp-ov-av" style={done ? { background: "var(--success)" } : {}}><Ic n={done ? "check" : "megaphone"} s={19} sw={done ? 2.4 : 1.8} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-ov-htitle">{done ? "Publisert" : "Publiser vaktplan"}</div>
              <div className="vp-ov-hsub">Uke 22 · 27. mai – 2. jun · Bistro Nord</div>
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          {done ? (
            <>
              <div className="vp-ov-body">
                <div className="vp-pub-success">
                  <span className="ring"><Ic n="check" s={28} sw={2.4} /></span>
                  <div className="t">{done.length} {done.length === 1 ? "vakt" : "vakter"} publisert</div>
                  <div className="s">De berørte ansatte er varslet og kan bekrefte vaktene i appen.{held.length ? ` ${held.length} ${held.length === 1 ? "vakt holdes" : "vakter holdes"} fortsatt tilbake som utkast.` : ""}</div>
                  <div className="vp-pub-donelist">
                    {done.map(r => { const e = empById(r.e); return (
                      <div key={r.id} className="vp-pub-doneitem"><Ic n="check" s={13} sw={2.6} c="var(--success)" /> <span>{e ? e.name : "Åpen vakt"} · {r.role} · {dayLbl(r.d)} {r.t}</span></div>
                    ); })}
                  </div>
                </div>
              </div>
              <div className="vp-ov-foot"><span className="sp" /><button className="sk-primary" onClick={onClose}><Ic n="check" s={15} sw={2.3} /> Ferdig</button></div>
            </>
          ) : (
            <>
              <div className="vp-ov-body">
                {/* validation summary */}
                <div className="vp-pub-summary">
                  <div className="vp-pub-stat ok"><span className="n">{ready.length}</span><span className="l">Klar</span></div>
                  <div className="vp-pub-stat"><span className="n">{held.length}</span><span className="l">Holdt tilbake</span></div>
                  <div className={`vp-pub-stat ${warnings.length ? "warn" : ""}`}><span className="n">{warnings.length}</span><span className="l">Advarsler</span></div>
                  <div className={`vp-pub-stat ${blocking.length ? "block" : ""}`}><span className="n">{blocking.length}</span><span className="l">Blokkerende</span></div>
                  <div className="vp-pub-rule">
                    <span className={`vp-pub-ruledot ${blocking.length ? "block" : warnings.length ? "warn" : "ok"}`} />
                    <span>{blocking.length ? "Regelsjekk: løs blokkerende først" : warnings.length ? "Regelsjekk: bestått med advarsler" : "Regelsjekk: bestått"}</span>
                  </div>
                </div>

                <div className="vp-pub-hint">Alle vakter er forhåndsvalgt. Hold tilbake de du ikke vil publisere ennå.</div>

                {/* per-shift rows */}
                <div className="vp-pub-list">
                  {rows.map(r => {
                    const e = empById(r.e);
                    const on = sel.has(r.id);
                    const block = isBlock(r), warn = isWarn(r);
                    const isOpen = open.has(r.id);
                    return (
                      <div key={r.id} className={`vp-pub-row ${on ? "" : "held"} ${block ? "block" : ""}`}>
                        <div className="vp-pub-main">
                          <button className={`vp-pub-ck ${on ? "on" : ""} ${block && on ? "block" : ""}`} onClick={() => toggle(r.id)} title={on ? "Hold tilbake" : "Velg for publisering"} aria-pressed={on}>
                            {on && <Ic n="check" s={13} sw={2.8} />}
                          </button>
                          <span className="vp-pub-av">
                            {e ? <span className="vp-emp-av" style={{ width: 30, height: 30, background: e.c }}>{e.init}</span>
                              : <span className="vp-emp-av" style={{ width: 30, height: 30, background: "var(--bg)", color: block ? "var(--error)" : "var(--muted)", border: `1.5px dashed ${block ? "var(--error)" : "var(--border-strong)"}` }}><Ic n="user" s={14} /></span>}
                          </span>
                          <div className="vp-pub-id">
                            <div className="vp-pub-nm">{e ? e.name : "Åpen vakt"}{r.pub.ai && <span className="vp-pub-ai"><Ic n="sparkle" s={10} /> Botsson</span>}</div>
                            <div className="vp-pub-role">{r.role} · {DEPT[r.dep].name}</div>
                          </div>
                          <div className="vp-pub-time"><span className="d">{dayLbl(r.d)}</span><span className="t">{r.t}</span></div>
                          <div className="vp-pub-states">
                            <span className={`vp-pub-changepill ${r.pub.kind}`}>{r.pub.kind === "changed" ? "Endret etter publisering" : "Ny vakt"}</span>
                            {warn && <span className="vp-pub-issue warn" title={r.pub.issue.text}><Ic n="alert" s={12} /> Advarsel</span>}
                            {block && <span className="vp-pub-issue block" title={r.pub.issue.text}><Ic n="ban" s={12} /> Blokkerende</span>}
                          </div>
                          <div className="vp-pub-acts">
                            <button className="vp-pub-exp" onClick={() => toggleOpen(r.id)} title="Hva endret seg"><Ic n={isOpen ? "chevUp" : "history"} s={14} />{r.pub.changes.length > 1 && <span className="cnt">{r.pub.changes.length}</span>}</button>
                            <button className="vp-pub-hold" onClick={() => toggle(r.id)} title={on ? "Hold tilbake" : "Ta med igjen"}><Ic n={on ? "x" : "undo"} s={14} /></button>
                          </div>
                        </div>
                        {(r.pub.issue && (warn || block)) && (
                          <div className={`vp-pub-issuebar ${block ? "block" : "warn"}`}><Ic n={block ? "ban" : "alert"} s={13} /> {r.pub.issue.text}{block && <span className="vp-pub-resolve" onClick={() => fillGapHint(toast)}>Tildel ansatt</span>}</div>
                        )}
                        {isOpen && (
                          <div className="vp-pub-crumbs">
                            <div className="vp-pub-crumbs-h">Endringer siden sist publisert</div>
                            {r.pub.changes.map((c, i) => (
                              <div key={i} className={`vp-pub-crumb ${c.sys ? "sys" : ""} ${c.ai ? "ai" : ""}`}>
                                <span className="ic"><Ic n={c.ai ? "sparkle" : c.sys ? "undo" : "pen"} s={11} /></span>
                                <span className="b"><span className="t">{c.t}</span><span className="m">{c.who ? c.who + " · " : c.ai ? "Botsson · " : c.sys ? "System · " : ""}{c.time}</span></span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {rows.length === 0 && <div className="vp-empty" style={{ minHeight: 160 }}><span className="ic"><Ic n="check" s={22} /></span><div className="t">Ingenting å publisere</div><div className="s">Alle vakter er allerede publisert og uendret.</div></div>}
                </div>

                {/* manager confidence layer */}
                <div className="vp-pub-confidence">
                  <span className="ic"><Ic n="shield" s={15} /></span>
                  <div>
                    <strong>Etter publisering:</strong> de {ready.length} valgte vaktene blir synlige for ansatte, og varsler sendes til de berørte. {held.length > 0 ? `${held.length} ${held.length === 1 ? "vakt forblir" : "vakter forblir"} utkast og påvirkes ikke.` : "Ingen vakter holdes tilbake."} Endrede vakter er avpublisert til du republiserer dem.
                  </div>
                </div>
              </div>

              <div className="vp-ov-foot">
                {blocking.length > 0
                  ? <span className="vp-ov-disc" style={{ color: "var(--error)" }}><Ic n="ban" s={13} /> Hold tilbake eller løs {blocking.length} blokkerende {blocking.length === 1 ? "vakt" : "vakter"} for å publisere.</span>
                  : held.length > 0
                    ? <span className="vp-ov-disc"><Ic n="pin" s={13} /> {held.length} {held.length === 1 ? "vakt holdes" : "vakter holdes"} tilbake.</span>
                    : <span className="vp-ov-disc"><Ic n="check" s={13} /> Alle vakter klare.</span>}
                <span className="sp" />
                <button className="sk-ghost" onClick={onClose}>Avbryt</button>
                <button className="sk-primary" disabled={!canPublish} style={!canPublish ? { opacity: .5, cursor: "default" } : {}} onClick={() => canPublish && confirm()}>
                  <Ic n="megaphone" s={15} /> Publiser {ready.length} {ready.length === 1 ? "vakt" : "vakter"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  function fillGapHint(toast) { toast && toast("Åpne vaktbørs for å tildele ansatt"); }

  Object.assign(window, { VPInspector: Inspector, VPPlanner: Planner, VPOfferModal: OfferModal, VPAssignModal: AssignModal, VPSwapModal: SwapModal, VPShiftModal: ShiftModal, VPLifecycle: Lifecycle, VPPublishModal: PublishModal });
})();
