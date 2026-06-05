// ===== Planlegging — calendar view renderers =====
// Exposes window.PLViews = { WeekView, MonthView, DayView, AgendaView, YearView }.
// Depends on window.PL (planlegging-data.jsx) + window.Ic.
(function () {
  const Ic = window.Ic;
  const PL = window.PL;
  const HOURPX = 46;                       // must match CSS --pl-hour
  const { GRID_START, GRID_END } = PL;
  const NOW = { dec: 14.3, label: "14:18", iso: PL.TODAY_ISO };
  const topOf = (h) => (h - GRID_START) * HOURPX;
  const hgtOf = (st, en) => Math.max(15, (en - Math.max(st, GRID_START)) * HOURPX);
  const HOURS = []; for (let h = GRID_START; h < GRID_END; h++) HOURS.push(h);
  const hh = (h) => String(Math.floor(h) % 24).padStart(2, "0");
  const PASS = () => true;

  // ---------- greedy lane packing (Google-Calendar style) ----------
  function pack(items) {
    const evs = [...items].sort((a, b) => a.st - b.st || b.en - b.en);
    const res = []; let cluster = [], colEnds = [], clusterEnd = 0;
    const flush = () => { const w = colEnds.length || 1; cluster.forEach(c => c.lanes = w); colEnds = []; cluster = []; clusterEnd = 0; };
    evs.forEach(ev => {
      if (cluster.length && ev.st >= clusterEnd) flush();
      let lane = colEnds.findIndex(end => end <= ev.st);
      if (lane === -1) { lane = colEnds.length; colEnds.push(ev.en); } else colEnds[lane] = ev.en;
      const it = Object.assign({}, ev, { lane }); cluster.push(it); res.push(it);
      clusterEnd = Math.max(clusterEnd, ev.en);
    });
    flush();
    return res;
  }
  const laneStyle = (it) => {
    const gap = 2, lanes = it.lanes || 1;
    return { top: topOf(it.st), height: hgtOf(it.st, it.en),
      left: `calc(3px + ${it.lane} * ((100% - 6px) / ${lanes}))`,
      width: `calc((100% - 6px) / ${lanes} - ${gap}px)`, right: "auto" };
  };

  // ---------- a single timed block (shift or booking) ----------
  function TimeBlock({ it, onOpen, compactOk = true }) {
    const compact = compactOk && (it.en - it.st) <= 1.25;
    if (it.type === "shift") {
      const e = PL.empById(it.e), dc = PL.DEPT[it.dep].c;
      return (
        <div className={`pl-blk shift ${it.status === "draft" ? "draft" : ""} ${compact ? "compact" : ""}`} style={Object.assign({ "--bc": dc }, laneStyle(it))} onClick={() => onOpen(it)} title={`${e.name} · ${it.role}`}>
          <div className="brow"><span className="pl-bav" style={{ background: e.c }}>{e.init}</span><span className="bt">{e.name.split(" ")[0]}</span>{it.now && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: 9, background: "var(--success)" }} />}</div>
          {!compact && <span className="bs">{it.role} · {it.t}</span>}
        </div>
      );
    }
    // booking
    const bc = PL.ETYPE.booking.c, st = PL.BSTATUS[it.status] || PL.BSTATUS.confirmed;
    return (
      <div className={`pl-blk booking ${it.status} ${compact ? "compact" : ""}`} style={Object.assign({ "--bc": bc }, laneStyle(it))} onClick={() => onOpen(it)} title={`${it.name} · ${it.guests} gj.`}>
        <div className="brow"><span className="pl-bstatus" style={{ background: st.c }} /><span className="bt">{it.name}</span>{it.conflict && <span className="pl-flag"><Ic n="alert" s={11} /></span>}</div>
        {!compact && <div className="brow" style={{ justifyContent: "space-between" }}><span className="bs">{it.table}</span><span className="bg-guests"><Ic n="user" s={9} sw={2.2} />{it.guests}</span></div>}
      </div>
    );
  }

  // ---------- closed-hours shading ----------
  function ClosedZones({ iso, wd, show }) {
    if (!show) return null;
    const h = PL.hoursFor(iso, wd);
    if (h.open == null) return <div className="pl-closed full" style={{ top: 0, height: topOf(GRID_END) }}><span className="lbl">Stengt</span></div>;
    const zones = [];
    if (h.open > GRID_START) zones.push(<div key="t" className="pl-closed" style={{ top: 0, height: topOf(h.open) }} />);
    if (h.close < GRID_END) zones.push(<div key="b" className="pl-closed" style={{ top: topOf(h.close), height: topOf(GRID_END) - topOf(h.close) }} />);
    return zones;
  }

  // ---------- hour grid lines ----------
  const HourLines = () => HOURS.map((h, i) => <div key={h} className={`pl-tg-line ${i === 0 ? "" : "soft"}`} style={{ top: topOf(h) }} />);

  // ================================================================ WEEK
  function WeekView({ show, match = PASS, onOpen, onCreate, onOpenDay }) {
    const season = PL.seasonForMonth(5);
    const weekEvents = PL.WEEK.map(w => PL.eventsOn(w.iso).filter(match));
    const weekLeave = PL.WEEK.map(w => PL.leaveOn(w.iso).filter(match));
    const anyEvents = show.event && weekEvents.some(a => a.length);
    const anyLeave = show.leave && weekLeave.some(a => a.length);
    const total = topOf(GRID_END);

    return (
      <div className="pl-week">
        <div className="pl-allday">
          {show.season && (
            <div className="pl-wkhead" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="pl-gut-cell" />
              <div className="pl-season-band" style={{ background: `color-mix(in oklab, ${season.c} 12%, transparent)` }} onClick={() => onOpen({ type: "season", id: season.id })}>
                <span className="dot" style={{ background: season.c }} /><span className="nm">{season.name}</span>
                <span className="meta">· {season.concept} · demand {season.demand.toLowerCase()}</span>
                <span className="lk">Årshjul <Ic n="arrowRight" s={12} /></span>
              </div>
            </div>
          )}
          <div className="pl-wkhead">
            <div className="pl-gut-cell" />
            {PL.WEEK.map((w, i) => {
              const h = PL.hoursFor(w.iso, w.wd);
              return (
                <div key={w.iso} className={`pl-dayhead ${w.we ? "we" : ""} ${w.today ? "today" : ""} ${onOpenDay ? "clickable" : ""}`} onClick={onOpenDay ? () => onOpenDay(i) : undefined} role={onOpenDay ? "button" : undefined} title={onOpenDay ? "Åpne dagskontroller" : undefined}>
                  <div className="dn">{w.dn}</div>
                  <div className="num">{w.d}</div>
                  {show.hours && <div className={`pl-dh-hours ${h.exception ? (h.open == null ? "closed" : "exc") : ""}`}>{h.open == null ? <><Ic n="ban" s={9} /> Stengt</> : <>{h.exception && <Ic n="door" s={9} />}{h.label}</>}</div>}
                </div>
              );
            })}
          </div>
          {anyEvents && (
            <div className="pl-adrow">
              <div className="pl-ad-lbl"><Ic n="ticket" s={11} /></div>
              {PL.WEEK.map((w, i) => (
                <div key={w.iso} className={`pl-ad-cell ${w.we ? "we" : ""}`}>
                  {weekEvents[i].map(e => (
                    <div key={e.id} className={`pl-evbar demand-${e.demand}`} onClick={() => onOpen(e)} title={e.title}>
                      <Ic n="ticket" s={10} />{e.title}<span className="em">{e.allday ? "Heldags" : e.t}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {anyLeave && (
            <div className="pl-adrow">
              <div className="pl-ad-lbl"><Ic n="umbrella" s={11} /></div>
              {PL.WEEK.map((w, i) => (
                <div key={w.iso} className={`pl-ad-cell ${w.we ? "we" : ""}`}>
                  {weekLeave[i].map(l => { const e = PL.empById(l.e); return (
                    <div key={l.id} className={`pl-lvbar ${l.status} ${l.conflict ? "conflict" : ""}`} onClick={() => onOpen(l)} title={`${e.name} · ${l.kind}`}>
                      <span className="av" style={{ background: e.c }}>{e.init}</span>{e.name.split(" ")[0]} · {l.kind}
                    </div>
                  ); })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pl-tg">
          <div className="pl-tg-gut" style={{ height: total }}>
            {HOURS.map(h => <div key={h} className="pl-tg-hr"><span className="pl-tg-hrlbl">{hh(h)}</span></div>)}
          </div>
          {PL.WEEK.map(w => {
            const timed = [];
            if (show.shift) PL.shiftsOn(w.iso).filter(match).forEach(s => timed.push(s));
            if (show.booking) PL.bookingsOn(w.iso).filter(match).forEach(b => timed.push(b));
            const packed = pack(timed);
            return (
              <div key={w.iso} className={`pl-tg-col ${w.we ? "we" : ""}`} style={{ height: total }}
                onClick={(ev) => { if (ev.target.classList.contains("pl-tg-col")) { const rect = ev.currentTarget.getBoundingClientRect(); const hr = Math.floor((ev.clientY - rect.top) / HOURPX) + GRID_START; onCreate({ iso: w.iso, wd: w.wd, st: hr }); } }}>
                <HourLines />
                <ClosedZones iso={w.iso} wd={w.wd} show={show.hours} />
                {packed.map(it => <TimeBlock key={it.id} it={it} onOpen={onOpen} />)}
                {w.today && <div className="pl-now" style={{ top: topOf(NOW.dec) }}><div className="line" /><div className="dot" /><div className="tag">NÅ {NOW.label}</div></div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ================================================================ MONTH
  function monthCells(m) {
    const mm = PL.monthMeta(m);
    const cells = [];
    const prevM = m === 1 ? 12 : m - 1, prevDays = PL.DAYS_IN[prevM];
    for (let i = 0; i < mm.firstWd; i++) cells.push({ pad: true, d: prevDays - mm.firstWd + 1 + i, m: prevM });
    for (let d = 1; d <= mm.days; d++) cells.push({ pad: false, d, m, iso: PL.isoOf(m, d), wd: (mm.firstWd + d - 1) % 7 });
    while (cells.length % 7 !== 0) { const d = cells.length - (mm.firstWd + mm.days) + 1; cells.push({ pad: true, d, m: m === 12 ? 1 : m + 1 }); }
    const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }
  function monthItems(iso, m, d, show, match) {
    const out = [];
    if (show.event) PL.eventsOn(iso).filter(match).forEach(e => out.push({ k: "event", srt: e.st == null ? -1 : e.st, tm: e.allday ? "" : PL.pad(e.st), nm: e.title, raw: e }));
    if (show.shift) PL.shiftsOn(iso).filter(match).forEach(s => { const e = PL.empById(s.e); out.push({ k: "shift", srt: s.st, tm: PL.pad(s.st), nm: e.name.split(" ")[0], bc: PL.DEPT[s.dep].c, raw: s }); });
    if (show.booking) PL.bookingsOn(iso).filter(match).forEach(b => out.push({ k: "booking", srt: b.st, tm: PL.pad(b.st), nm: b.name, raw: b }));
    if (show.leave) PL.LEAVE.filter(match).forEach(l => { const f = l.from.split("-").map(Number), t = l.to.split("-").map(Number); if (m === f[0] && d >= f[1] && (m < t[0] || d <= t[1])) { const e = PL.empById(l.e); out.push({ k: "leave", srt: -2, tm: "", nm: `${e.name.split(" ")[0]} fri`, raw: l }); } });
    return out.sort((a, b) => a.srt - b.srt);
  }
  function MonthView({ m, show, match = PASS, onOpen, onPickDay }) {
    const mm = PL.monthMeta(m), weeks = monthCells(m), season = PL.seasonForMonth(m);
    return (
      <div className="pl-month">
        <div className="pl-m-grid">
          <div className="pl-m-dow">{["Man","Tir","Ons","Tor","Fre","Lør","Søn"].map(d => <div key={d}>{d}</div>)}</div>
          <div className="pl-m-weeks">
            {weeks.map((wk, wi) => (
              <div key={wi} className="pl-m-week">
                {wk.map((c, ci) => {
                  if (c.pad) return <div key={ci} className="pl-m-cell pad"><div className="pl-m-top"><span className="pl-m-num">{c.d}</span></div></div>;
                  const items = monthItems(c.iso, c.m, c.d, show, match);
                  const h = PL.hoursFor(c.iso, c.wd), today = c.iso === PL.TODAY_ISO;
                  return (
                    <div key={ci} className={`pl-m-cell ${c.wd >= 5 ? "we" : ""} ${today ? "today" : ""}`} onClick={() => onPickDay(c.iso)}>
                      <div className="pl-m-top">
                        <span className="pl-m-num">{c.d}</span>
                        {show.hours && <span className={`pl-m-hours ${h.open == null ? "closed" : ""}`}>{h.open == null ? "Stengt" : h.label}</span>}
                      </div>
                      <div className="pl-m-items">
                        {items.slice(0, 3).map((it, i) => (
                          <div key={i} className={`pl-m-chip ${it.k}`} style={it.bc ? { "--bc": it.bc } : null} onClick={(e) => { e.stopPropagation(); onOpen(it.raw); }}>
                            {it.k === "shift" && <span className="dot" style={{ background: it.bc }} />}
                            {it.tm && <span className="tm">{it.tm}</span>}<span className="nm">{it.nm}</span>
                          </div>
                        ))}
                        {items.length > 3 && <div className="pl-m-more">+{items.length - 3} til</div>}
                      </div>
                      {show.season && <div className="pl-m-seasonband" style={{ background: season.c }} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ================================================================ DAY
  function DayView({ iso, show, match = PASS, onOpen, onCreate, attention = [], botCard, onOpenDay }) {
    const w = PL.WEEK.find(x => x.iso === iso) || { iso, wd: 3, dl: "Dag", d: iso.split("-")[1], today: iso === PL.TODAY_ISO, we: false };
    const shifts = show.shift ? PL.shiftsOn(iso).filter(match) : [];
    const bookings = show.booking ? PL.bookingsOn(iso).filter(match) : [];
    const events = show.event ? PL.eventsOn(iso).filter(match) : [];
    const leave = show.leave ? PL.leaveOn(iso).filter(match) : [];
    const timed = pack([...shifts, ...bookings]);
    const total = topOf(GRID_END);
    const shiftHours = shifts.reduce((a, s) => a + (s.en - s.st), 0);
    const guests = bookings.filter(b => b.status !== "cancelled").reduce((a, b) => a + b.guests, 0);
    const h = PL.hoursFor(iso, w.wd);
    const dayAttn = attention.filter(a => a.iso === iso);

    return (
      <div className="pl-day">
        <div className="pl-day-main">
          <div className={`pl-day-stats ${onOpenDay ? "clickable" : ""}`} onClick={onOpenDay ? () => onOpenDay() : undefined} role={onOpenDay ? "button" : undefined} title={onOpenDay ? "Åpne dagskontroller" : undefined}>
            <div className="pl-stat"><span className="k"><Ic n="grid" s={11} /> Vakter</span><span className="v">{shifts.length}</span><span className="sub">{shiftHours} t bemanning</span></div>
            <div className="pl-stat"><span className="k"><Ic n="utensils" s={11} /> Bookinger</span><span className="v">{bookings.filter(b => b.status !== "cancelled").length}</span><span className="sub">{guests} gjester</span></div>
            <div className="pl-stat"><span className="k"><Ic n="ticket" s={11} /> Eventer</span><span className={`v ${events.some(e => e.demand === "high") ? "warn" : ""}`}>{events.length}</span><span className="sub">{events.some(e => e.demand === "high") ? "høy demand" : "normal"}</span></div>
            <div className="pl-stat"><span className="k"><Ic n="door" s={11} /> Åpent</span><span className={`v ${h.open == null ? "crit" : ""}`} style={{ fontSize: 19, paddingTop: 5 }}>{h.open == null ? "Mangler" : h.label}</span><span className="sub">{h.exception ? "Unntak" : "Standard"}</span></div>
            {onOpenDay && <span className="pl-day-stats-cta"><Ic n="layers" s={13} /> Dagskontroller <Ic n="chevRight" s={13} /></span>}
          </div>
          <div className="pl-day-tg">
            <div className="pl-tg-gut" style={{ height: total }}>{HOURS.map(hr => <div key={hr} className="pl-tg-hr"><span className="pl-tg-hrlbl">{hh(hr)}</span></div>)}</div>
            <div className="pl-tg-col" style={{ height: total }}
              onClick={(ev) => { if (ev.target.classList.contains("pl-tg-col")) { const rect = ev.currentTarget.getBoundingClientRect(); const hr = Math.floor((ev.clientY - rect.top) / HOURPX) + GRID_START; onCreate({ iso, wd: w.wd, st: hr }); } }}>
              <HourLines />
              <ClosedZones iso={iso} wd={w.wd} show={show.hours} />
              {timed.map(it => <TimeBlock key={it.id} it={it} onOpen={onOpen} compactOk={false} />)}
              {w.today && <div className="pl-now" style={{ top: topOf(NOW.dec) }}><div className="line" /><div className="dot" /><div className="tag">NÅ {NOW.label}</div></div>}
            </div>
          </div>
        </div>
        <div className="pl-day-side">
          {botCard}
          {events.length > 0 && <><h4>Eventer & demand</h4>{events.map(e => (
            <div key={e.id} className={`pl-evbar demand-${e.demand}`} style={{ height: "auto", padding: "7px 9px", marginBottom: 6, whiteSpace: "normal" }} onClick={() => onOpen(e)}>
              <Ic n="ticket" s={11} /><span style={{ flex: 1 }}>{e.title}</span><span className="em">{e.allday ? "Heldags" : e.t}</span>
            </div>
          ))}</>}
          {leave.length > 0 && <><h4 style={{ marginTop: 14 }}>Fravær</h4>{leave.map(l => { const e = PL.empById(l.e); return (
            <div key={l.id} className={`pl-lvbar ${l.status} ${l.conflict ? "conflict" : ""}`} style={{ height: "auto", padding: "7px 9px", marginBottom: 6 }} onClick={() => onOpen(l)}>
              <span className="av" style={{ background: e.c }}>{e.init}</span>{e.name.split(" ")[0]} · {l.kind} · {PL.LSTATUS[l.status].label}
            </div>
          ); })}</>}
          {dayAttn.length > 0 && <><h4 style={{ marginTop: 14 }}>Krever oppmerksomhet</h4>{dayAttn.map(a => (
            <div key={a.id} className={`pl-callout ${a.sev}`} style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => onOpen({ type: "attention", id: a.id })}>
              <span className="ic"><Ic n={a.icon} s={15} /></span><div className="ct-body"><strong>{a.title}</strong></div>
            </div>
          ))}</>}
        </div>
      </div>
    );
  }

  // ================================================================ AGENDA
  function AgendaView({ show, match = PASS, onOpen }) {
    return (
      <div className="pl-agenda">
        {PL.WEEK.map(w => {
          const rows = [];
          if (show.event) PL.eventsOn(w.iso).filter(match).forEach(e => rows.push({ srt: e.st == null ? -1 : e.st, type: "event", tm: e.allday ? "Heldags" : e.t, rail: PL.ETYPE.event.c, t: e.title, s: `${PL.DEMAND[e.demand].label} demand${e.staffing ? " · " + e.staffing : ""}`, raw: e }));
          if (show.leave) PL.leaveOn(w.iso).filter(match).forEach(l => { const e = PL.empById(l.e); rows.push({ srt: -2, type: "leave", tm: PL.LSTATUS[l.status].label, rail: PL.ETYPE.leave.c, t: `${e.name} · ${l.kind}`, s: l.note, raw: l }); });
          if (show.shift) PL.shiftsOn(w.iso).filter(match).forEach(s => { const e = PL.empById(s.e); rows.push({ srt: s.st, type: "shift", tm: s.t, rail: PL.DEPT[s.dep].c, t: `${e.name} · ${s.role}`, s: `${PL.DEPT[s.dep].name}${s.status === "draft" ? " · utkast" : ""}`, raw: s }); });
          if (show.booking) PL.bookingsOn(w.iso).filter(match).forEach(b => rows.push({ srt: b.st, type: "booking", tm: b.t, rail: PL.ETYPE.booking.c, t: b.name, s: `${b.guests} gj. · ${b.table} · ${PL.BSTATUS[b.status].label}`, raw: b }));
          rows.sort((a, b) => a.srt - b.srt);
          const h = PL.hoursFor(w.iso, w.wd);
          return (
            <div key={w.iso} className="pl-ag-day">
              <div className={`pl-ag-dh ${w.today ? "today" : ""}`}>
                <span className="dn">{w.dl}</span><span className="num">{w.d}. {PL.MONTH_NAMES[w.m - 1].toLowerCase()}</span>
                <span className="cnt">{rows.length} oppføringer</span>
                {show.hours && <span className="hrs">{h.open == null ? "Stengt" : "Åpent " + h.label}</span>}
              </div>
              <div className="pl-ag-list">
                {rows.length === 0 ? <div className="pl-ag-empty">Ingenting planlagt</div> : rows.map((r, i) => {
                  const et = PL.ETYPE[r.type];
                  return (
                    <div key={i} className="pl-ag-item" onClick={() => onOpen(r.raw)}>
                      <span className="pl-ag-time">{r.tm}</span>
                      <span className="pl-ag-rail" style={{ background: r.rail }} />
                      <span className="pl-ag-body"><span className="t">{r.t}</span><span className="s">{r.s}</span></span>
                      <span className="pl-ag-type" style={{ background: `color-mix(in oklab, ${r.rail} 13%, transparent)`, color: r.rail }}>{et.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ================================================================ YEAR (årshjul)
  function YearView({ show, onOpen, onPickMonth }) {
    const months = []; for (let m = 1; m <= 12; m++) months.push(m);
    const nowM = 5, nowFrac = 30 / 31;
    return (
      <div className="pl-year">
        <div className="pl-y-head">
          <div><div className="t">Årshjul 2026</div><div className="s">Sesonger, demand & årsplan — koblet til drift</div></div>
          <div className="pl-y-legend">
            {PL.SEASONS.map(s => <span key={s.id} className="pl-y-legrow"><span className="dot" style={{ background: s.c }} />{s.name.split(" ")[0]}</span>)}
          </div>
        </div>
        <div className="pl-y-grid">
          <div className="pl-y-months">
            {months.map(m => {
              const season = PL.seasonForMonth(m), pins = PL.YEAR_PINS.filter(p => p.m === m);
              const isNow = m === nowM;
              return (
                <div key={m} className="pl-y-row">
                  <div className={`pl-y-mlabel ${isNow ? "now" : ""}`} onClick={() => onPickMonth && onPickMonth(m)}>
                    <span className="mn">{PL.MONTH_NAMES[m - 1]}</span><span className="my">2026{isNow ? " · nå" : ""}</span>
                  </div>
                  <div className="pl-y-track">
                    {show.season && <div className="pl-y-seasonfill" style={{ background: season.c }} />}
                    {show.event && pins.map(p => { const s = PL.SEASONS.find(x => x.id === p.season); return (
                      <div key={p.iso} className="pl-y-pin" onClick={() => onOpen({ type: "pin", id: p.iso })} title={p.title}>
                        <span className="pd" style={{ background: s ? s.c : "var(--orange)" }} /><span className="pdate">{p.d}.</span>{p.title}
                      </div>
                    ); })}
                    {show.season && <span className="pl-y-seasonchip">{season.name.split(" ")[0]} · {season.demand}</span>}
                    {isNow && <div className="pl-y-now-line" style={{ left: `calc(${nowFrac * 100}% )` }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="pl-y-seasons">
          {PL.SEASONS.map(s => (
            <div key={s.id} className="pl-y-scard" style={{ "--sc": s.c }} onClick={() => onOpen({ type: "season", id: s.id })}>
              <div className="top">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.c }} /><span className="nm">{s.name}</span>
                <span className="st" style={{ background: s.status === "active" ? "var(--orange-soft)" : "var(--secondary)", color: s.status === "active" ? "var(--orange-dark)" : "var(--muted)" }}>{s.status === "active" ? "Aktiv" : s.status === "planned" ? "Planlagt" : "Arkiv"}</span>
              </div>
              <div className="concept">{s.concept}</div>
              <div className="note">{s.note}</div>
              <div className="demand"><Ic n="trendUp" s={13} /> Demand: {s.demand}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  window.PLViews = { WeekView, MonthView, DayView, AgendaView, YearView, NOW };
})();
