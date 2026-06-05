// ===== Rapporter — Innsikt (AI insight engine) =====
// Foregrounded feed of Botsson insights. Each is assistive: explains its reasoning,
// cites connected data sources, shows a confidence level, recommends an action, and
// lets the user godkjenn / avvis / tildel / eksporter. Never auto-acts. Activity log.
(function () {
  const { useState, useEffect } = React;

  function RapInsikt({ scope, role, openId, onClearOpen, toast }) {
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;
    const all = D.RAP_INSIGHTS;

    const [filter, setFilter] = useState("all"); // all/crit/warn/info/ok
    const [status, setStatus] = useState({}); // id -> approved/dismissed/assigned
    const [expanded, setExpanded] = useState(openId || null);

    useEffect(() => { if (openId) { setExpanded(openId); onClearOpen && onClearOpen(); } }, [openId]);

    const venueOk = (i) => scope === "all" || i.venue === scope || (scope === "nord" && i.venue === "nord");
    const list = all.filter((i) => (filter === "all" || i.sev === filter) && venueOk(i));

    const FILTERS = [
      ["all", "Alle", all.filter(venueOk).length],
      ["crit", "Kritisk", all.filter((i) => i.sev === "crit" && venueOk(i)).length],
      ["warn", "Følg med", all.filter((i) => i.sev === "warn" && venueOk(i)).length],
      ["ok", "Positivt", all.filter((i) => i.sev === "ok" && venueOk(i)).length],
    ];

    const act = (i, kind, label) => {
      setStatus((s) => ({ ...s, [i.id]: kind }));
      toast(label, { undo: () => setStatus((s) => { const n = { ...s }; delete n[i.id]; return n; }) });
    };

    const counts = {
      open: all.filter((i) => !status[i.id]).length,
      crit: all.filter((i) => i.sev === "crit" && !status[i.id]).length,
    };

    return (
      <div className="so-grid-2">
        <div className="so-stack">
          {/* assistive header */}
          <div className="rap-warn info" style={{ alignItems: "center" }}>
            <span className="ic"><Ic n="bot" s={18} /></span>
            <div style={{ flex: 1 }}>
              <div className="bt">Botsson overvåker {scope === "all" ? "alle steder" : R.venue(scope).name} kontinuerlig</div>
              <div className="bs">{counts.open} åpne innsikter · {counts.crit} kritiske. Forslag iverksettes aldri uten din godkjenning.</div>
            </div>
            <button className="rap-btn sm" onClick={() => toast("Botsson kjører ny analyse…")}><Ic n="repeat" s={13} /> Oppdater</button>
          </div>

          {/* filters */}
          <div className="rap-scope" style={{ margin: "0 0 2px" }}>
            <div className="grp">
              {FILTERS.map(([k, l, n]) => (
                <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}<span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: .65 }}>{n}</span></button>
              ))}
            </div>
          </div>

          {/* feed */}
          <div className="rap-insights">
            {list.length === 0 ? (
              <div className="so-panel"><R.Empty icon="check" title="Ingen innsikter her" sub="Ingen innsikter matcher filteret for valgt sted og periode." /></div>
            ) : list.map((i) => (
              <InsightCard key={i.id} i={i} expanded={expanded === i.id} status={status[i.id]}
                onToggle={() => setExpanded((e) => e === i.id ? null : i.id)} onAct={act} />
            ))}
          </div>
        </div>

        {/* activity log */}
        <div className="so-stack">
          <R.Panel icon="history" title="Aktivitetslogg">
            <div className="rap-act">
              {D.RAP_ACTIVITY.map((a) => (
                <div key={a.id} className="rap-act-row">
                  <span className={`rap-act-ic ${a.kind}`}><Ic n={a.ic} s={13} /></span>
                  <div className="rap-act-body">
                    <span className="who">{a.who === "bot" ? "Botsson" : (D.USERS[a.who] || {}).name || a.who}</span> {a.text}
                    <div className="rap-act-time">{a.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </R.Panel>

          <R.Panel icon="gauge" title="Slik vekter Botsson">
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["Datadekning", 92, "POS + Vaktplan i sanntid"],
                ["Historikk", 88, "8 uker mønstergrunnlag"],
                ["Prognosesikkerhet", 86, "uke 23 etterspørsel"],
              ].map(([l, v, s]) => (
                <div key={l}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}><span style={{ fontWeight: 600 }}>{l}</span><span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{v}%</span></div>
                  <div style={{ height: 5, borderRadius: 999, background: "var(--secondary)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: v + "%", borderRadius: 999, background: "var(--success)" }} /></div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{s}</div>
                </div>
              ))}
            </div>
          </R.Panel>
        </div>
      </div>
    );
  }

  function InsightCard({ i, expanded, status, onToggle, onAct }) {
    const R = window.Rap; const { Ic } = R;
    const sevIc = i.sev === "crit" ? "alert" : i.sev === "ok" ? "check" : i.sev === "info" ? "sparkle" : "trendUp";
    const sevLabel = { crit: "Kritisk", warn: "Følg med", info: "Forslag", ok: "Positivt" }[i.sev];
    const done = !!status;
    return (
      <div className={`rap-ins ${i.sev} ${done ? "done" : ""}`}>
        <div className="rap-ins-top" onClick={onToggle}>
          <span className={`rap-ins-ic ${i.sev}`}><Ic n={sevIc} s={17} /></span>
          <div className="rap-ins-main">
            <div className="rap-ins-tl">
              <span className={`rap-ins-sev ${i.sev}`}>{sevLabel}</span>
              <span className="rap-ins-venue"><R.VDot id={i.venue} size={7} />{R.venue(i.venue).short}</span>
              {done && <span className="rap-ins-sev ok" style={{ background: "var(--secondary)", color: "var(--muted)" }}>{status === "approved" ? "Godkjent" : status === "dismissed" ? "Avvist" : "Tildelt"}</span>}
            </div>
            <div className="rap-ins-title">{i.title}</div>
            <div className="rap-ins-summary">{i.summary}</div>
          </div>
          <div className="rap-ins-side">
            <span className="rap-ins-change">{i.change}</span>
            <R.Conf v={i.conf} />
            <span style={{ color: "var(--muted-soft)" }}><Ic n={expanded ? "chevUp" : "chevDown"} s={16} /></span>
          </div>
        </div>

        {expanded && (
          <div className="rap-ins-exp">
            <div className="rap-ins-block">
              <h5><Ic n="eye" s={12} /> Hvorfor Botsson sier dette</h5>
              <p className="rap-ins-why">{i.why}</p>
              <div className="rap-ins-rec">
                <span className="ic"><Ic n="sparkle" s={16} /></span>
                <div><strong>Anbefaling.</strong> {i.rec} <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>· {i.impact}</span></div>
              </div>
            </div>
            <div className="rap-ins-block">
              <h5><Ic n="layers" s={12} /> Datagrunnlag</h5>
              <div className="rap-src-list">
                {i.sources.map((s, idx) => (
                  <div key={idx} className="rap-src">
                    <span className="ic"><Ic n={s.ic} s={14} /></span>
                    <span className="t">{s.t}</span>
                    <span className="meta">{s.meta}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rap-ins-actions">
              <button className="rap-iact primary" disabled={done} onClick={() => onAct(i, "approved", `Godkjent: ${i.title}`)}><Ic n="check" s={14} /> Godkjenn forslag</button>
              <button className="rap-iact" disabled={done} onClick={() => onAct(i, "assigned", `Tildelt til ansvarlig: ${i.title}`)}><Ic n="userCheck" s={14} /> Tildel</button>
              <button className="rap-iact" disabled={done} onClick={() => onAct(i, "dismissed", `Avvist: ${i.title}`)}><Ic n="x" s={14} /> Avvis</button>
              <button className="rap-iact" onClick={() => onAct(i, status, "Innsikt eksportert til PDF")}><Ic n="download" s={14} /> Eksporter</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  window.RapInsikt = RapInsikt;
})();
