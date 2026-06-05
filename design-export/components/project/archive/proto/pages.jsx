// ===== Smartout — real page modules (registry: window.SO_PAGES[route]) =====
// Each page is self-contained and owns its main-area layout.
(function () {
  const { useState } = React;
  const DEPT = { kjokken: "#ee560c", sal: "#00ab93", bar: "#864ad2", event: "#c18200", drift: "#2784d5" };

  // ---------------- VAKTPLAN ----------------
  const VP_EMP = [
    { id: "ao", name: "Anna Olsen", role: "Kokk", init: "AO", c: "#f59e0b", v: 4, h: 30.0 },
    { id: "ep", name: "Erik Pedersen", role: "Sous Chef", init: "EP", c: "#ec4899", v: 4, h: 37.0 },
    { id: "ea", name: "Even Aas", role: "Vertinne", init: "EA", c: "#14b8a6", v: 4, h: 26.0 },
    { id: "jb", name: "Jonas Bakken", role: "Kokk", init: "JB", c: "#38bdf8", v: 2, h: 14.0 },
    { id: "kn", name: "Kari Nilsen", role: "Servitør", init: "KN", c: "#a78bfa", v: 4, h: 22.5 },
  ];
  const VP_DAYS = [["Man", 25], ["Tir", 26], ["Ons", 27], ["Tor", 28], ["Fre", 29], ["Lør", 30], ["Søn", 31]];
  const VP_SHIFTS = [
    { e: "ao", d: 0, role: "Kokk", t: "08–16", dep: "kjokken" }, { e: "ao", d: 2, role: "Kokk", t: "08–16", dep: "kjokken" }, { e: "ao", d: 4, role: "Kokk", t: "08–16", dep: "kjokken" }, { e: "ao", d: 5, role: "Kokk", t: "08–16", dep: "kjokken" },
    { e: "ep", d: 1, role: "Kjøkkensjef", t: "10–20", dep: "kjokken" }, { e: "ep", d: 3, role: "Kjøkkensjef", t: "12–22", dep: "kjokken" }, { e: "ep", d: 4, role: "Kjøkkensjef", t: "14–23", dep: "kjokken" }, { e: "ep", d: 5, role: "Kjøkkensjef", t: "12–22", dep: "kjokken" },
    { e: "ea", d: 1, role: "Vertinne", t: "12–20", dep: "sal" }, { e: "ea", d: 4, role: "Vertinne", t: "17–23", dep: "sal" }, { e: "ea", d: 5, role: "Vertinne", t: "10–18", dep: "sal" }, { e: "ea", d: 6, role: "Vertinne", t: "11–17", dep: "sal" },
    { e: "jb", d: 3, role: "Kokk lærling", t: "15–22", dep: "kjokken" }, { e: "jb", d: 5, role: "Kokk lærling", t: "15–23", dep: "kjokken" },
    { e: "kn", d: 0, role: "Servitør", t: "11–19", dep: "sal" }, { e: "kn", d: 4, role: "Servitør", t: "11–19", dep: "sal" }, { e: "kn", d: 5, role: "Servitør", t: "11–19", dep: "sal" },
  ];

  function VPChip({ s }) {
    return (
      <div className="vp-chip" style={{ "--dep": DEPT[s.dep] }}>
        <span className="vp-chip-role">{s.role}</span>
        <span className="vp-chip-time">{s.t}</span>
        <span className="vp-chip-dot" />
      </div>
    );
  }

  function VaktplanPage() {
    const [mode, setMode] = useState("vaktplan");   // vaktplan | vaktbors | ferieplan
    const [view, setView] = useState("ukeplan");    // ukeplan | maned | vaktliste | bemanning
    const [span, setSpan] = useState("1");

    return (
      <div className="vp">
        <div className="vp-bar">
          <div className="seg">
            {[["vaktplan", "Vaktplan"], ["vaktbors", "Vaktbørs"], ["ferieplan", "Ferieplan"]].map(([k, l]) => (
              <button key={k} className={`seg-btn ${mode === k ? "on" : ""}`} onClick={() => setMode(k)}>{l}</button>
            ))}
          </div>
          <div className="vp-bar-right">
            <div className="seg">
              {[["ukeplan", "Ukeplan"], ["maned", "Måned"], ["vaktliste", "Vaktliste"], ["bemanning", "Bemanning"]].map(([k, l]) => (
                <button key={k} className={`seg-btn ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{l}</button>
              ))}
            </div>
            <div className="vp-weeknav"><button>‹</button><span>Uke 22, 2026</span><button>›</button></div>
            <button className="vp-publish">Publiser (2)</button>
          </div>
        </div>

        <div className="vp-sub">
          <span className="vp-sub-title">📅 Vaktplan</span>
          <button className="vp-pill"><span className="vp-pill-dot" />Alle avdelinger ▾</button>
          <span className="vp-divider" />
          {["Ansatt", "Jobb", "Team", "Lokasjon"].map((t, i) => <button key={t} className={`vp-grp ${i === 0 ? "on" : ""}`}>{t}</button>)}
          <span style={{ flex: 1 }} />
          <div className="seg sm">
            {[["1", "1 uke"], ["2", "2 uker"]].map(([k, l]) => <button key={k} className={`seg-btn ${span === k ? "on" : ""}`} onClick={() => setSpan(k)}>{l}</button>)}
          </div>
        </div>

        <div className="vp-scroll">
          {view === "ukeplan" && (
            <div className="vp-grid">
              <div className="vp-grid-head">
                <div className="vp-cell-emp head"><span className="vp-emp-h">👥 Ansatte</span></div>
                {VP_DAYS.map(([d, n], i) => (
                  <div key={d} className={`vp-day-head ${i >= 5 ? "we" : ""}`}><span>{d} {n}/5</span><span className="vp-day-meta">👥 4 · 📋 4</span></div>
                ))}
              </div>
              {VP_EMP.map(emp => (
                <div key={emp.id} className="vp-row">
                  <div className="vp-cell-emp">
                    <span className="vp-emp-av" style={{ background: emp.c }}>{emp.init}</span>
                    <span className="vp-emp-info">
                      <span className="vp-emp-name">{emp.name}</span>
                      <span className="vp-emp-role">{emp.role}</span>
                      <span className="vp-emp-bar"><span style={{ width: `${(emp.h / 37.5) * 100}%`, background: emp.h >= 36 ? "var(--success)" : "var(--orange)" }} /></span>
                      <span className="vp-emp-hrs">{emp.v}V · {emp.h.toFixed(1)}/37.5</span>
                    </span>
                  </div>
                  {VP_DAYS.map(([d], di) => {
                    const s = VP_SHIFTS.find(x => x.e === emp.id && x.d === di);
                    return <div key={d} className={`vp-cell ${di >= 5 ? "we" : ""}`}>{s ? <VPChip s={s} /> : <button className="vp-add">+</button>}</div>;
                  })}
                </div>
              ))}
            </div>
          )}
          {view === "vaktliste" && (
            <div className="vp-list">
              <div className="vp-list-head"><div><div className="vp-list-h1">Uke 22, 2026</div><div className="vp-list-h2">Kompakt vaktliste for utskrift</div></div><button className="sk-ghost">🖨 Skriv ut</button></div>
              {VP_DAYS.slice(0, 4).map(([d, n], di) => {
                const ds = VP_SHIFTS.filter(x => x.d === di);
                return (
                  <div key={d} className="vp-list-day">
                    <div className="vp-list-dayhead"><strong>{d} {n}/5</strong><span>{ds.length} vakter</span></div>
                    <div className="vp-list-cards">
                      {ds.map((s, i) => { const emp = VP_EMP.find(e => e.id === s.e); return (
                        <div key={i} className="vp-list-card"><span className="vp-emp-av sm" style={{ background: emp.c }}>{emp.init}</span><span><span className="vp-lc-name">{emp.name}</span><span className="vp-lc-role">{s.role}</span></span><span className="vp-lc-time">🕒 {s.t}</span></div>
                      ); })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {(view === "maned" || view === "bemanning") && (
            <div className="vp-empty"><div className="vp-empty-ic">📆</div><div className="vp-empty-t">{view === "maned" ? "Månedsvisning" : "Bemanning per vakttype"}</div><div className="vp-empty-s">Interaktiv flate — neste iterasjon</div></div>
          )}
        </div>

        <div className="vp-foot">
          <span className="vp-risk crit">Dekningsrisiko: 6</span>
          <span className="vp-risk">Overtidsrisiko: 0</span>
          <span className="vp-risk">AML-risiko: 0</span>
          <span className="vp-risk">Ledige vakter: 2</span>
          <span className="vp-risk warn">Draft endringer</span>
          <span style={{ flex: 1 }} />
          <span className="vp-stat">Utkast 2</span><span className="vp-stat">Publisert 37</span><span className="vp-stat">Aktiv 0</span><span className="vp-stat warn">Fravær 2</span>
        </div>
      </div>
    );
  }

  // ---------------- PLANLEGGING (calendar) + DAY CONTROLLER ----------------
  const PL_DAYS = [["Man", 25], ["Tir", 26], ["Ons", 27], ["Tor", 28], ["Fre", 29], ["Lør", 30], ["Søn", 31]];
  const PL_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06..23
  const DC_STAFF = [
    { init: "LA", name: "Local Admin", role: "Daglig leder", t: "09:00 – 17:00", s: 9, e: 17, c: "#14b8a6" },
    { init: "EP", name: "Erik Pedersen", role: "Kjøkkensjef", t: "11:00 – 20:00", s: 11, e: 20, c: "#ec4899" },
    { init: "JB", name: "Jonas Bakken", role: "Kokk", t: "12:00 – 22:00", s: 12, e: 22, c: "#38bdf8" },
    { init: "MH", name: "Mats Holm", role: "Bartender", t: "15:00 – 23:00", s: 15, e: 23, c: "#a78bfa" },
    { init: "SB", name: "Sofia Berg", role: "Servitør", t: "16:00 – 23:00", s: 16, e: 23, c: "#f472b6" },
    { init: "EA", name: "Even Aas", role: "Vertinne", t: "17:00 – 23:00", s: 17, e: 23, c: "#34d399" },
  ];
  const DC_TABS = [["oversikt", "Oversikt"], ["dagsinfo", "Dagsinfo", 1], ["reservasjoner", "Reservasjoner"], ["oppgaver", "Oppgaver", 2], ["tidslinje", "Tidslinje"], ["budsjett", "Budsjett"], ["bemanning", "Bemanning"], ["okonomi", "Økonomi"]];

  function DayController({ day, onClose }) {
    const [tab, setTab] = useState("oversikt");
    const span = 17; // 6..23
    return (
      <div className="dc-scrim" onMouseDown={onClose}>
        <div className="dc" onMouseDown={e => e.stopPropagation()}>
          <div className="dc-grab" />
          <div className="dc-head">
            <div><span className="dc-title">{day.dn} {day.n}. MAI</span> <span className="dc-sub">torsdag</span></div>
            <div className="dc-head-right">
              <span className="dc-chip">● 5 ansatte</span>
              <span className="dc-chip">● 0 bookinger</span>
              <button className="dc-ico" title="Utvid">⤢</button>
              <button className="dc-ico" onClick={onClose} title="Lukk">✕</button>
            </div>
          </div>
          <div className="dc-tabs">
            {DC_TABS.map(([k, l, b]) => (
              <button key={k} className={`dc-tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
                {l}{b ? <span className="dc-tabbadge">{b}</span> : null}
              </button>
            ))}
          </div>
          <div className="dc-body">
            {tab === "oversikt" ? (
              <>
                <div className="dc-sec-lbl">Nøkkeltall</div>
                <div className="dc-kpis">
                  {[["Est. kostnad", "11 125 kr"], ["Budsjett", "15 000 kr"], ["Timer", "44t 30m"], ["Ansatte", "5"]].map(([l, v]) => (
                    <div key={l} className="dc-kpi"><span className="dc-kpi-l">{l}</span><span className="dc-kpi-v">{v}</span></div>
                  ))}
                </div>
                <div className="dc-meta">
                  <span>Åpningstider: <strong>10:00 – 23:00</strong></span>
                  <span className="dc-duty">Duty Manager: <button className="dc-select">Ingen ▾</button></span>
                  <span className="dc-prev">Forrige år: 8 ans, 18 400 kr, 52t</span>
                </div>
                <div className="dc-sec-lbl">Tidslinje</div>
                <div className="dc-gantt">
                  <div className="dc-gantt-hours">
                    <span className="dc-gantt-spacer" />
                    {PL_HOURS.map(h => <span key={h} className="dc-gantt-h">{String(h).padStart(2, "0")}</span>)}
                  </div>
                  {DC_STAFF.map(p => (
                    <div key={p.name} className="dc-gantt-row">
                      <span className="dc-gantt-emp"><span className="dc-av" style={{ background: p.c }}>{p.init}</span>{p.name.split(" ")[0]}</span>
                      <span className="dc-gantt-track">
                        <span className="dc-gantt-bar" style={{ left: `${((p.s - 6) / span) * 100}%`, width: `${((p.e - p.s) / span) * 100}%`, background: `color-mix(in oklab, ${p.c} 22%, var(--card))`, borderColor: p.c }}>
                          <span style={{ color: p.c }}>{p.t}</span>
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="dc-sec-lbl">Ansatte på vakt (6)</div>
                <div className="dc-staff">
                  {DC_STAFF.map(p => (
                    <div key={p.name} className="dc-staff-row">
                      <span className="dc-check">✓</span>
                      <span className="dc-av" style={{ background: p.c }}>{p.init}</span>
                      <span className="dc-staff-info"><span className="dc-staff-name">{p.name}</span><span className="dc-staff-role">{p.t} · {p.role}</span></span>
                      <span className="dc-staff-actions"><button className="dc-ico">✆</button><button className="dc-ico">✉</button></span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="dc-empty"><div className="dc-empty-t">{(DC_TABS.find(t => t[0] === tab) || [])[1]}</div><div className="dc-empty-s">Interaktiv flate — neste iterasjon</div></div>
            )}
          </div>
          <div className="dc-foot">
            <span className="dc-foot-lbl">📣 Kringkast (5)</span>
            <span style={{ flex: 1 }} />
            <button className="dc-foot-btn">◔ Push</button>
            <button className="dc-foot-btn warn">✉ SMS</button>
          </div>
        </div>
      </div>
    );
  }

  function PlanleggingPage() {
    const [mode, setMode] = useState("kalender");
    const [view, setView] = useState("uke");
    const [open, setOpen] = useState(null);
    return (
      <div className="pl">
        <div className="vp-bar">
          <div className="seg">
            {[["kalender", "📅 Kalender"], ["arshjul", "✦ Årshjul"], ["eventer", "≡ Eventer"], ["bookinger", "👥 Bookinger"]].map(([k, l]) => (
              <button key={k} className={`seg-btn ${mode === k ? "on" : ""}`} onClick={() => setMode(k)}>{l}</button>
            ))}
          </div>
          <div className="vp-bar-right">
            <button className="vp-pill">I dag</button>
            <div className="vp-weeknav"><button>‹</button><span>25. Mai – 31. Mai 2026</span><button>›</button></div>
            <div className="seg">
              {[["dag", "Dag"], ["uke", "Uke"], ["maned", "Måned"]].map(([k, l]) => <button key={k} className={`seg-btn ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{l}</button>)}
            </div>
            <button className="dc-ico">⚙</button>
          </div>
        </div>
        <div className="vp-scroll">
          <div className="pl-cal">
            <div className="pl-cal-head">
              <span className="pl-time-gut" />
              {PL_DAYS.map(([d, n], i) => (
                <button key={d} className={`pl-day-head ${i === 3 ? "today" : ""} ${i >= 5 ? "we" : ""}`} onClick={() => setOpen({ dn: ["MANDAG", "TIRSDAG", "ONSDAG", "TORSDAG", "FREDAG", "LØRDAG", "SØNDAG"][i], n })}>
                  <span className="pl-dn">{d}</span><span className="pl-dnum">{n}</span>
                </button>
              ))}
            </div>
            <div className="pl-cal-body">
              {PL_HOURS.map(h => (
                <div key={h} className="pl-row">
                  <span className="pl-time">{String(h).padStart(2, "0")}:00</span>
                  {PL_DAYS.map(([d], di) => (
                    <button key={d} className={`pl-cell ${di >= 5 ? "we" : ""}`} onClick={() => setOpen({ dn: ["MANDAG", "TIRSDAG", "ONSDAG", "TORSDAG", "FREDAG", "LØRDAG", "SØNDAG"][di], n: PL_DAYS[di][1] })}>
                      {di === 0 && h === 10 && <span className="pl-event">Sjefsmøte</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        {open && <DayController day={open} onClose={() => setOpen(null)} />}
      </div>
    );
  }

  // ---- inject page CSS (co-located so we don't touch the host HTML) ----
  const css = `
  .pl{display:flex;flex-direction:column;height:100%;min-height:0}
  .pl-cal{min-width:880px}
  .pl-cal-head{display:grid;grid-template-columns:64px repeat(7,1fr);position:sticky;top:0;z-index:3;background:var(--bg);border-bottom:1px solid var(--border)}
  .pl-day-head{border:none;border-left:1px solid var(--border);background:none;cursor:pointer;padding:14px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;font-family:inherit;color:var(--fg)}
  .pl-day-head:hover{background:var(--secondary)}
  .pl-day-head.we{background:rgba(249,115,22,0.03)}
  .pl-dn{font-size:12px;color:var(--muted);font-weight:600}
  .pl-dnum{font-size:20px;font-weight:600}
  .pl-day-head.today .pl-dnum{background:var(--fg);color:var(--bg);width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
  .pl-row{display:grid;grid-template-columns:64px repeat(7,1fr);min-height:54px}
  .pl-time{font-size:11px;color:var(--muted);font-family:var(--font-mono);padding:6px 8px;border-bottom:1px solid var(--border)}
  .pl-cell{border-left:1px solid var(--border);border-bottom:1px solid var(--border);background:none;cursor:pointer;padding:3px;position:relative}
  .pl-cell:hover{background:rgba(249,115,22,0.05)}
  .pl-cell.we{background:rgba(249,115,22,0.02)}
  .pl-event{display:block;background:var(--orange-soft);color:var(--orange-dark);border:1px solid rgba(249,115,22,0.3);border-left:3px solid var(--orange);border-radius:7px;padding:5px 8px;font-size:12px;font-weight:600;text-align:left}

  .dc-scrim{position:fixed;inset:0;background:rgba(28,24,20,0.4);backdrop-filter:blur(3px);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:24px;animation:authfade .2s ease;overflow:auto}
  .dc{width:min(1080px,100%);background:var(--bg);border:1px solid var(--border);border-radius:18px;box-shadow:0 24px 72px rgba(0,0,0,0.28);display:flex;flex-direction:column;max-height:calc(100vh - 48px);overflow:hidden;animation:authfade .25s ease}
  .dc-grab{width:46px;height:4px;border-radius:99px;background:var(--border-strong);margin:10px auto 0}
  .dc-head{display:flex;align-items:center;justify-content:space-between;padding:12px 22px 14px;border-bottom:1px solid var(--border)}
  .dc-title{font-family:var(--font-heading);font-size:22px;letter-spacing:-0.01em}
  .dc-sub{font-size:12px;color:var(--muted);font-family:var(--font-mono);text-transform:lowercase;margin-left:6px}
  .dc-head-right{display:flex;align-items:center;gap:8px}
  .dc-chip{font-size:11px;font-weight:600;color:var(--muted);border:1px solid var(--border);border-radius:999px;padding:5px 11px}
  .dc-ico{width:32px;height:32px;border-radius:9px;border:none;background:none;cursor:pointer;color:var(--muted);font-size:14px}
  .dc-ico:hover{background:var(--secondary);color:var(--fg)}
  .dc-tabs{display:flex;gap:2px;padding:0 18px;border-bottom:1px solid var(--border);overflow-x:auto}
  .dc-tab{display:inline-flex;align-items:center;gap:6px;padding:11px 13px;border:none;background:none;border-bottom:2px solid transparent;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;color:var(--muted);white-space:nowrap}
  .dc-tab.on{color:var(--fg);border-bottom-color:var(--orange);font-weight:600}
  .dc-tabbadge{background:var(--orange);color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
  .dc-body{flex:1;overflow-y:auto;padding:18px 22px}
  .dc-sec-lbl{font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:6px 0 12px}
  .dc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
  .dc-kpi{border:1px solid var(--border);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:8px}
  .dc-kpi-l{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .dc-kpi-v{font-size:24px;font-weight:700;font-family:var(--font-mono);letter-spacing:-0.01em}
  .dc-meta{display:flex;align-items:center;gap:24px;flex-wrap:wrap;padding:13px 16px;border:1px solid var(--border);border-radius:12px;background:var(--secondary);font-size:13px;color:var(--muted);margin-bottom:22px}
  .dc-meta strong{color:var(--fg)}
  .dc-select{border:1px solid var(--border);background:var(--card);border-radius:8px;padding:5px 10px;font-family:inherit;font-size:13px;cursor:pointer;color:var(--fg)}
  .dc-prev{margin-left:auto;font-family:var(--font-mono);font-size:12px}
  .dc-gantt{border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:22px;overflow-x:auto}
  .dc-gantt-hours,.dc-gantt-row{display:grid;grid-template-columns:120px 1fr;align-items:center;min-width:680px}
  .dc-gantt-hours{margin-bottom:6px}
  .dc-gantt-spacer{}
  .dc-gantt-hours{position:relative}
  .dc-gantt-hours>.dc-gantt-h:first-of-type{}
  .dc-gantt-hours{grid-template-columns:120px repeat(18,1fr)}
  .dc-gantt-h{font-size:10px;color:var(--muted);font-family:var(--font-mono);text-align:left}
  .dc-gantt-row{margin:3px 0}
  .dc-gantt-emp{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:500}
  .dc-gantt-track{position:relative;height:26px;background:var(--secondary);border-radius:7px}
  .dc-gantt-bar{position:absolute;top:0;bottom:0;border:1px solid;border-radius:7px;display:flex;align-items:center;padding:0 8px;font-size:10px;font-weight:600;font-family:var(--font-mono);overflow:hidden}
  .dc-av{width:26px;height:26px;border-radius:50%;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;flex-shrink:0}
  .dc-staff{display:flex;flex-direction:column;gap:2px}
  .dc-staff-row{display:flex;align-items:center;gap:11px;padding:11px 8px;border-bottom:1px solid var(--border)}
  .dc-check{width:20px;height:20px;border-radius:50%;background:rgba(17,173,50,0.12);color:var(--success);display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
  .dc-staff-info{display:flex;flex-direction:column;gap:2px;flex:1}
  .dc-staff-name{font-size:13.5px;font-weight:600}
  .dc-staff-role{font-size:11.5px;color:var(--muted);font-family:var(--font-mono)}
  .dc-staff-actions{display:flex;gap:4px}
  .dc-empty{min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
  .dc-empty-t{font-family:var(--font-heading);font-size:22px}
  .dc-empty-s{font-size:13px;color:var(--muted)}
  .dc-foot{display:flex;align-items:center;gap:10px;padding:12px 22px;border-top:1px solid var(--border);background:var(--card)}
  .dc-foot-lbl{font-size:12px;font-weight:600;color:var(--muted)}
  .dc-foot-btn{height:34px;padding:0 16px;border-radius:999px;border:1px solid var(--border);background:var(--card);cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--fg)}
  .dc-foot-btn.warn{border-color:rgba(249,115,22,0.3);color:var(--orange-dark)}
  `;
  if (!document.getElementById("so-pages-css")) {
    const st = document.createElement("style"); st.id = "so-pages-css"; st.textContent = css; document.head.appendChild(st);
  }

  window.SO_PAGES = { vaktplan: VaktplanPage, planlegging: PlanleggingPage };
})();
