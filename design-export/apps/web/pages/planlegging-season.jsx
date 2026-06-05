// ===== Planlegging — season detail + Machine Room (årshjul edit) =====
// Brings the old Year Wheel's editable season model into the calendar.
// Exposes window.PLSeason = { SeasonPanel }.
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const PL = window.PL;

  const fmtKr = (v) => v == null ? "—" : v >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + " M" : Math.round(v).toLocaleString("nb-NO");
  const DAYKEYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
  const ST = {
    active: { label: "Aktiv", c: "var(--success)" },
    planned: { label: "Planlagt", c: "var(--warning)" },
    draft: { label: "Utkast", c: "var(--muted)" },
    archived: { label: "Arkivert", c: "var(--muted)" },
  };

  function StatusPill({ status }) {
    const m = ST[status] || ST.draft;
    return <span className="pl-spill" style={{ background: `color-mix(in oklab, ${m.c} 13%, transparent)`, color: m.c }}><span className="d" style={{ background: m.c }} />{m.label}</span>;
  }

  // ---------------- Machine Room ----------------
  function MachineRoom({ season, onClose }) {
    const toast = window.useToast();
    const [budget, setBudget] = useState(season.revenue || 12000000);
    const [laborPct, setLaborPct] = useState(season.laborPct || 30);
    const [seasonFactor, setSeasonFactor] = useState(season.seasonFactor || 1.0);
    const [factors, setFactors] = useState({ ...(season.dayFactors || {}) });
    const [hourFactors, setHourFactors] = useState([...(season.hourFactors || [])]);
    const avgWage = season.avgWage || 280;
    const days = season.days || 90;

    const weeklySum = DAYKEYS.reduce((s, k) => s + (factors[k] || 0), 0) || 1;
    const avgDaily = budget / days;
    const fridayTarget = avgDaily * 7 * ((factors.Fre || 0) / weeklySum) * seasonFactor;
    const peakIdx = hourFactors.indexOf(Math.max(...hourFactors));
    const hourSum = hourFactors.reduce((s, h) => s + h, 0) || 1;
    const peakTarget = fridayTarget * (hourFactors[peakIdx] / hourSum);
    const peakStaff = Math.max(1, Math.ceil((peakTarget * (laborPct / 100)) / avgWage));
    const maxHF = Math.max(...hourFactors, 1);

    const BField = ({ label, value, suffix, onChange, step, readOnly }) => (
      <div className="pl-bfield">
        <span className="lbl">{label}</span>
        <span className="inp"><input type="number" value={value} step={step} readOnly={readOnly} onChange={e => onChange && onChange(parseFloat(e.target.value) || 0)} />{suffix && <span className="sfx">{suffix}</span>}</span>
      </div>
    );
    const Conseq = ({ label, value, small }) => (
      <div className={`pl-conseq ${small ? "sm" : ""}`}><span>{label}</span><b>{value}</b></div>
    );

    return (
      <div className="pl-mr-scrim" onClick={onClose}>
        <div className="pl-mr" onClick={e => e.stopPropagation()}>
          <div className="pl-mr-head">
            <div><div className="eyebrow">Machine Room</div><h3>{season.name} <span>· 2026</span></h3></div>
            <button className="pl-act" onClick={onClose}>Lukk</button>
          </div>
          <div className="pl-mr-grid">
            <div>
              <div className="pl-mr-lbl">Budsjett-oppsett</div>
              <div className="pl-bfields">
                <BField label="Inntektsmål" value={budget} suffix="kr" onChange={setBudget} />
                <BField label="Sesongfaktor" value={seasonFactor} step="0.1" onChange={setSeasonFactor} />
                <BField label="Lønnsmål" value={laborPct} suffix="%" onChange={setLaborPct} />
                <BField label="Snittlønn" value={avgWage} suffix="kr/t" readOnly />
              </div>
            </div>
            <div>
              <div className="pl-mr-lbl">Beregnet konsekvens</div>
              <div className="pl-conseq-box">
                <Conseq label="Dagsmål (fredag)" value={`${fmtKr(fridayTarget)} kr`} />
                <Conseq label={`Topptime (kl. ${peakIdx}:00)`} value={`${fmtKr(peakTarget)} kr`} />
                <Conseq label="Bemanning topp" value={`~${peakStaff} personer`} />
                <div className="pl-conseq-div">
                  <Conseq label="Antall dager" value={days} small />
                  <Conseq label="Snitt per dag" value={`${fmtKr(avgDaily)} kr`} small />
                </div>
              </div>
            </div>
          </div>
          <div className="pl-mr-sec">
            <div className="pl-mr-lbl">Dagfaktorer (relative vekter)</div>
            <div className="pl-factors">
              {DAYKEYS.map(d => {
                const pct = Math.min(1, (factors[d] || 0) / 3);
                return (
                  <div key={d} className="pl-factor">
                    <div className="fill" style={{ top: `${(1 - pct) * 100}%` }} />
                    <div className="fl">{d}</div>
                    <input type="number" value={factors[d] || 0} step="0.1" min="0" max="3" onChange={e => setFactors(f => ({ ...f, [d]: parseFloat(e.target.value) || 0 }))} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pl-mr-sec">
            <div className="pl-mr-lbl">Timefaktorer (24t) <span className="hint">— klikk en søyle for å justere</span></div>
            <div className="pl-hbars">
              {hourFactors.map((h, i) => (
                <div key={i} className="pl-hbar">
                  <div className="bar" style={{ height: `${(h / maxHF) * 100}%`, background: i === peakIdx ? "var(--orange)" : `color-mix(in oklab, var(--orange) ${Math.round(28 + (h / maxHF) * 55)}%, var(--border))` }}
                    onClick={() => { const v = parseFloat(prompt(`Faktor for kl. ${i}:00`, h) || h); if (!isNaN(v)) setHourFactors(hf => hf.map((x, j) => j === i ? Math.max(0, v) : x)); }} />
                  <span className="hl">{i}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pl-mr-foot">
            <button className="pl-act" onClick={() => { toast("Lagret som utkast"); }}>Lagre utkast</button>
            <button className="pl-act primary" onClick={() => { toast("Propagert til workspace-budsjett", { undo: () => {} }); onClose(); }}><Ic n="zap" s={14} /> Propager til budsjett</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Season slide-over ----------------
  function SeasonPanel({ id, onClose, goRoute }) {
    const toast = window.useToast();
    const season = PL.SEASONS.find(x => x.id === id) || PL.SEASONS[1];
    const [tab, setTab] = useState("oversikt");
    const [machine, setMachine] = useState(false);
    const [status, setStatus] = useState(season.status);
    const [goals, setGoals] = useState(season.goals.map((g, i) => ({ id: i, text: g, done: season.status === "archived" ? true : season.status === "active" ? i < 1 : false })));
    const missing = season.missing || [];
    const eventCount = season.events.length;

    const TABS = [
      { k: "oversikt", l: "Oversikt" },
      { k: "hours", l: "Åpningstider" },
      { k: "goals", l: "Mål", c: goals.length },
      { k: "events", l: "Hendelser", c: eventCount },
    ];

    const toggleGoal = (gid) => setGoals(gs => gs.map(x => x.id === gid ? { ...x, done: !x.done } : x));
    const canActivate = status !== "active" && missing.length === 0;
    const doActivate = () => {
      if (status === "active") { setStatus("archived"); toast("Sesong arkivert", { undo: () => setStatus("active") }); }
      else { setStatus("active"); toast(`${season.name} aktivert`, { undo: () => setStatus(season.status) }); }
    };

    return (
      <>
        <div className="pl-over-scrim" onClick={onClose} />
        <aside className="pl-over wide" role="dialog">
          <div className="pl-over-head">
            <div className="toprow">
              <span className="pl-over-kind" style={{ background: `color-mix(in oklab, ${season.c} 14%, transparent)`, color: season.c }}><Ic n="wheel" s={11} />Sesong</span>
              <StatusPill status={status} />
              <span style={{ flex: 1 }} />
              <button className="icbtn" onClick={onClose}><Ic n="x" s={18} /></button>
            </div>
            <h2 className="pl-over-title">{season.name}</h2>
            <div className="pl-over-sub mono">{season.range} · {season.days} dager · 2026</div>
          </div>

          <div className="pl-tabs">
            {TABS.map(t => <button key={t.k} className={tab === t.k ? "on" : ""} onClick={() => setTab(t.k)}>{t.l}{t.c != null && <span className="ct">{t.c}</span>}</button>)}
          </div>

          <div className="pl-over-body">
            {tab === "oversikt" && <>
              <div className={`pl-gate ${missing.length ? "warn" : "ok"}`} style={{ marginTop: 14 }}>
                <div className="top">
                  <span className="t">{status === "active" ? "Aktiv sesong" : missing.length ? `${missing.length} ting mangler før aktivering` : "Klar til aktivering"}</span>
                  <button className="pl-act" style={{ height: 32 }} disabled={!canActivate && status !== "active"} onClick={doActivate}>{status === "active" ? "Arkiver" : "Aktiver sesong"}</button>
                </div>
                {missing.length > 0 && <ul>{missing.map(m => <li key={m}><span className="b" />{m}</li>)}</ul>}
              </div>
              <div className="pl-sec">
                <h5>Oppsummering</h5>
                <div className="pl-srows">
                  <div className="pl-srow"><span className="k">Inntektsmål</span><span className="v">{fmtKr(season.revenue)} kr{season.revenueActual != null && <small>så langt {fmtKr(season.revenueActual)} kr</small>}</span></div>
                  <div className="pl-srow"><span className="k">Lønnsmål</span><span className="v">{season.laborPct} %</span></div>
                  <div className="pl-srow"><span className="k">Snittbong</span><span className="v">{season.avgTicket} kr</span></div>
                  <div className="pl-srow"><span className="k">Aktive team</span><span className="v">{season.teams}</span></div>
                  <div className="pl-srow"><span className="k">Hendelser i periode</span><span className="v">{eventCount}</span></div>
                  <div className="pl-srow"><span className="k">Demand</span><span className="v" style={{ color: season.c }}>{season.demand}</span></div>
                </div>
                {season.seededFrom && <div className="pl-seed"><Ic n="star" s={13} /> Seedet fra <strong>{season.seededFrom}</strong></div>}
              </div>
              <button className="pl-mr-btn" onClick={() => setMachine(true)}>
                <span className="mric"><Ic n="settings" s={17} /></span>
                <span className="mrb"><span className="t">Machine Room</span><span className="s">Budsjett · dag-faktorer · time-faktorer</span></span>
                <Ic n="chevRight" s={16} />
              </button>
            </>}

            {tab === "hours" && <>
              <div className="pl-sec" style={{ borderBottom: "none" }}>
                <h5>Sesongåpningstider</h5>
                <div className="pl-ohlist">
                  {DAYKEYS.map((d, i) => { const v = season.openHours[d] || "—"; const override = i === 3 || i === 4; return (
                    <div key={d} className="pl-ohrow">
                      <span className="dn">{d}</span>
                      <span className={`tm ${v === "Stengt" ? "closed" : ""}`}>{v}</span>
                      <span className={`prov ${override ? "season" : ""}`}>{override ? "Sesong" : "Workspace"}</span>
                    </div>
                  ); })}
                </div>
              </div>
              <div className="pl-sec">
                <h5>Dato-overrides ({season.overrides})</h5>
                <div className="pl-oh-exc"><span className="badge" style={{ background: "rgba(39,132,213,0.13)", color: "var(--info)" }}>Spesial</span><div className="b"><div className="d">17. mai · 13–23</div><div className="n">Grunnet nasjonaldag</div></div></div>
                <div className="pl-oh-exc"><span className="badge" style={{ background: "var(--secondary)", color: "var(--muted)" }}>Stengt</span><div className="b"><div className="d">24. juni</div><div className="n">Sommerferie start</div></div></div>
                <button className="pl-act" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => toast("Ny dato-override")}><Ic n="plus" s={15} /> Override for enkeltdato</button>
              </div>
            </>}

            {tab === "goals" && <div className="pl-sec" style={{ borderBottom: "none" }}>
              <h5>Sesongmål</h5>
              <div className="pl-goals">
                {goals.map(g => (
                  <button key={g.id} className={`pl-goal ${g.done ? "done" : ""}`} onClick={() => toggleGoal(g.id)}>
                    <span className="box">{g.done && <Ic n="check" s={12} sw={3} c="#fff" />}</span>
                    <span className="tx">{g.text}</span>
                  </button>
                ))}
              </div>
              <button className="pl-act" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => toast("Nytt mål")}><Ic n="plus" s={15} /> Nytt mål</button>
            </div>}

            {tab === "events" && <div className="pl-sec" style={{ borderBottom: "none" }}>
              <h5>Planlagte hendelser</h5>
              <div className="pl-evlist">
                {season.events.map(ev => <div key={ev} className="pl-evrow"><span className="d" style={{ background: season.c }} />{ev}<Ic n="chevRight" s={14} c="var(--muted)" style={{ marginLeft: "auto" }} /></div>)}
              </div>
              <div className="pl-callout info" style={{ marginTop: 12 }}><span className="ic"><Ic n="info" s={16} /></span><div className="ct-body">Hendelser fra årshjulet driver konkret operativ planlegging — meny, bemanning og bookinger kobles hit.</div></div>
            </div>}
          </div>

          <div className="pl-over-foot">
            <button className="pl-act" onClick={() => goRoute("vaktplan")}><Ic n="grid" s={15} /> Planlegg bemanning</button>
            <span className="sp" />
            <button className="pl-act primary" onClick={() => setMachine(true)}><Ic n="settings" s={15} /> Machine Room</button>
          </div>
        </aside>
        {machine && <MachineRoom season={season} onClose={() => setMachine(false)} />}
      </>
    );
  }

  window.PLSeason = { SeasonPanel, MachineRoom };
})();
