// ===== Rapporter — Oversikt (executive KPI dashboard) =====
// Foregrounded Botsson insight brief + headline KPIs + labor-vs-revenue trend +
// venue comparison (group scope) / secondary KPIs (venue scope) + insight teaser.
(function () {
  const { useState } = React;

  function RapOversikt({ scope, period, role, onOpenKpi, onGoTab, onOpenInsight, toast }) {
    const R = window.Rap;
    const { Ic } = R;
    const D = window.SmartoutData;
    const KPIS = D.RAP_KPIS;
    const MORE = D.RAP_KPIS_MORE;
    const isGroup = scope === "all";

    // role-ordered headline KPIs (eier=finance emphasis, drift=ops emphasis)
    const ordered = [...KPIS].sort((a, b) => (a.personas[role] || 99) - (b.personas[role] || 99));

    return (
      <div>
        {/* --- foregrounded Botsson insight brief --- */}
        <Brief role={role} onOpenInsight={onOpenInsight} onGoTab={onGoTab} toast={toast} />

        {/* --- headline KPI cards --- */}
        <div className="rap-kpis">
          {ordered.map((k) => <R.KpiCard key={k.id} k={k} onClick={() => onOpenKpi(k.id)} />)}
        </div>

        {/* --- main grid --- */}
        <div className="so-grid-2">
          <div className="so-stack">
            {/* labor vs revenue trend */}
            <R.Panel icon="chart" title="Omsetning vs lønnskostnad" right={
              <span className="rap-legend" style={{ marginRight: 4 }}>
                <span><i className="line" style={{ background: "var(--orange)" }} />Omsetning</span>
                <span><i style={{ background: "var(--border-strong)" }} />Lønn</span>
              </span>
            }>
              <R.DualTrend days={D.RAP_TREND_DAYS} />
              <div style={{ display: "flex", gap: 24, padding: "0 18px 16px", flexWrap: "wrap" }}>
                <Mini l="Omsetning uke 22" v={R.kr(1284500)} d="+6,1 %" dir="up" />
                <Mini l="Lønnskostnad" v={R.kr(378300)} d="+8,4 %" dir="down" />
                <Mini l="Lønnsandel" v="29,4 %" d="+2,3 pp" dir="down" />
              </div>
            </R.Panel>

            {/* venue comparison (group) OR secondary KPI grid (single venue) */}
            {isGroup ? (
              <VenueCompare onOpenVenue={(v) => toast(`Åpner ${R.venue(v).name}`)} />
            ) : (
              <R.Panel icon="grid" title="Flere nøkkeltall" link="Bygg rapport" onLink={() => onGoTab("bygger")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 0 }}>
                  {MORE.map((m, i) => (
                    <div key={m.id} style={{ padding: "14px 16px", borderBottom: i < MORE.length - 2 ? "1px solid var(--border)" : "none", borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none" }}>
                      <div className="rap-kpi-lbl" style={{ marginBottom: 8 }}><span className="ico"><Ic n={m.icon} s={13} /></span><span className="tx">{m.label}</span></div>
                      <div className="rap-kpi-val" style={{ fontSize: 22 }}>{R.fmtVal(m.value, m.fmt)}<span className="u">{m.fmt === "kr0" ? "k kr" : m.unit}</span></div>
                      <div className="rap-kpi-meta" style={{ marginTop: 7 }}>
                        <span className="rap-kpi-sub">{m.sub}</span>
                        <span className={`rap-delta ${m.tone === "ok" ? "up" : m.tone === "crit" ? "down" : "warn"}`}>{m.delta}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </R.Panel>
            )}
          </div>

          <div className="so-stack">
            {/* insight teaser */}
            <InsightTeaser onOpenInsight={onOpenInsight} onGoTab={onGoTab} toast={toast} />
            {/* forecast card */}
            <ForecastCard onGoTab={onGoTab} />
          </div>
        </div>
      </div>
    );
  }

  function Mini({ l, v, d, dir }) {
    return (
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>{l}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>{v}</span>
          <span className={`rap-delta ${dir}`}>{d}</span>
        </div>
      </div>
    );
  }

  // ---- the foregrounded Botsson brief ----
  function Brief({ role, onOpenInsight, onGoTab, toast }) {
    const R = window.Rap; const { Ic } = R;
    const [showWhy, setShowWhy] = useState(false);
    const [done, setDone] = useState({});
    const lead = role === "eier"
      ? <>Gruppen ligger <strong>4,2 % over lønnsbudsjett</strong> denne uka — akkumulert avvik for mai er <span className="hl-crit">+112 400 kr</span>. Snittbong er beste i år (<strong>412 kr</strong>), men <strong>Bistro Nord</strong> trekker lønnsandelen opp.</>
      : <>Dagen er under kontroll, men <span className="hl-crit">lønnskostnaden steg 8,4 %</span> mot forrige uke — drevet av <strong>12,5 t overtid på kjøkken</strong>. Fredag var middagsvakten <strong>overbemannet med 2,5 årsverk</strong>. Jeg har 6 innsikter klare.</>;
    const acts = [
      { id: "b1", label: "Vis kjøkken-overtid", toast: "Åpner innsikt: Overtid kjøkken" },
      { id: "b2", label: "Reduser man–ons bemanning", toast: "Forslag sendt til Vaktplan-utkast" },
      { id: "b3", label: "Eksporter ukesrapport", toast: "Ukesrapport eksportert til PDF" },
    ];
    return (
      <div className="brief" style={{ marginBottom: 20 }}>
        <div className="brief-top">
          <span className="brief-av"><Ic n="bot" s={19} /></span>
          <div className="brief-id">
            <div className="n">Innsikt for uke 22 <span className="tag">BOTSSON</span></div>
            <div className="m">Generert fre 06:00 · {role === "eier" ? "Eier-perspektiv" : "Drift-perspektiv"} · 6 innsikter</div>
          </div>
          <span className="spacer" />
          <button className="brief-why" onClick={() => setShowWhy((s) => !s)}>
            <Ic n={showWhy ? "chevUp" : "eye"} s={13} /> {showWhy ? "Skjul kilder" : "Hvorfor?"}
          </button>
        </div>
        <p className="brief-body">{lead}</p>
        {showWhy && (
          <div className="brief-sources">
            {[["coffee", "POS · 12 480 bonger"], ["grid", "Vaktplan · 1 526 t"], ["wallet", "Lønn · derivert"], ["calendar", "Booking · 214"], ["sparkle", "Prognose uke 23"]].map(([ic, s]) => (
              <span key={s} className="brief-src"><span className="ic"><Ic n={ic} s={12} /></span>{s}</span>
            ))}
          </div>
        )}
        <div className="brief-actions">
          {acts.map((a, i) => (
            <button key={a.id} className={`brief-act ${done[a.id] ? "done" : ""}`}
              onClick={() => {
                if (a.id === "b1") { onOpenInsight && onOpenInsight("ins3"); return; }
                if (done[a.id]) return;
                setDone((d) => ({ ...d, [a.id]: true }));
                toast(a.toast, { undo: () => setDone((d) => ({ ...d, [a.id]: false })) });
              }}>
              {done[a.id] ? <Ic n="check" s={14} sw={2.4} /> : <span className="num">{i + 1}</span>}
              {a.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- venue comparison table ----
  function VenueCompare({ onOpenVenue }) {
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;
    const venues = D.RAP_VENUES.filter((v) => v.type === "venue");
    const VK = D.RAP_VENUE_KPIS;
    const G = D.RAP_GROUP;
    const tone = (key, val) => {
      if (key === "labor_pct") return val > 30 ? "cv-crit" : val > 28 ? "cv-warn" : "cv-ok";
      if (key === "overtime") return val > 12 ? "cv-crit" : val > 8 ? "cv-warn" : "cv-ok";
      if (key === "coverage") return val >= 95 ? "cv-ok" : val >= 90 ? "cv-warn" : "cv-crit";
      return "";
    };
    return (
      <R.Panel icon="building" title="Steder sammenlignet" right={<span className="so-eyebrow-lbl" style={{ marginRight: 6 }}>Uke 22</span>}>
        <div style={{ overflowX: "auto" }}>
          <table className="rap-cmp">
            <thead>
              <tr>
                <th>Sted</th><th>Lønn %</th><th>Oms./t</th><th>Snittbong</th><th>Overtid</th><th>Dekning</th><th>Omsetning</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => {
                const k = VK[v.id];
                return (
                  <tr key={v.id} className="clickable" onClick={() => onOpenVenue(v.id)}>
                    <td className="venue">
                      <span className="vcell">
                        <span className="vdot" style={{ background: v.color }} />
                        <span><span className="vname">{v.name}{v.flagship && <span className="flagtag" style={{ marginLeft: 6 }}>Flaggskip</span>}</span><br /><span className="vcity">{v.city}</span></span>
                      </span>
                    </td>
                    <td><span className={tone("labor_pct", k.labor_pct)}>{String(k.labor_pct).replace(".", ",")} %</span></td>
                    <td>{R.nf(k.rev_per_hour)}</td>
                    <td>{R.nf(k.avg_check)}</td>
                    <td><span className={tone("overtime", k.overtime)}>{String(k.overtime).replace(".", ",")} t</span></td>
                    <td><span className={tone("coverage", k.coverage)}>{k.coverage} %</span></td>
                    <td>{R.nf(k.revenue)}</td>
                  </tr>
                );
              })}
              <tr className="grp-row">
                <td className="venue"><span className="vcell" style={{ paddingLeft: 18 }}>Gruppe totalt</span></td>
                <td>{String(G.labor_pct).replace(".", ",")} %</td>
                <td>{R.nf(G.rev_per_hour)}</td>
                <td>{R.nf(G.avg_check)}</td>
                <td>{String(G.overtime).replace(".", ",")} t</td>
                <td>{G.coverage} %</td>
                <td>{R.nf(G.revenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </R.Panel>
    );
  }

  // ---- insight teaser (top 3) ----
  function InsightTeaser({ onOpenInsight, onGoTab, toast }) {
    const R = window.Rap; const { Ic } = R;
    const ins = window.SmartoutData.RAP_INSIGHTS.filter((i) => i.sev === "crit" || i.sev === "warn").slice(0, 3);
    return (
      <R.Panel icon="sparkle" title="Toppinnsikter" count={6} link="Alle innsikter" onLink={() => onGoTab("innsikt")}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {ins.map((i, idx) => (
            <div key={i.id} onClick={() => onOpenInsight(i.id)}
              style={{ display: "flex", gap: 12, padding: "13px 18px", borderBottom: idx < ins.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}>
              <span className={`rap-ins-ic ${i.sev}`} style={{ width: 30, height: 30 }}><Ic n={i.sev === "crit" ? "alert" : "trendUp"} s={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{i.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
                  <R.VDot id={i.venue} size={7} />{R.venue(i.venue).short} · <R.Conf v={i.conf} label={false} /> {i.conf}%
                </div>
              </div>
              <span className={`rap-ins-change`} style={{ fontSize: 13, alignSelf: "center", color: i.sev === "crit" ? "var(--error)" : "var(--warning)" }}>{i.change}</span>
            </div>
          ))}
        </div>
      </R.Panel>
    );
  }

  // ---- forecast ----
  function ForecastCard({ onGoTab }) {
    const R = window.Rap; const { Ic } = R;
    return (
      <R.Panel icon="sparkle" title="Prognose uke 23">
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>kr 1,31M</span>
            <span className="rap-delta up">+2,0 %</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Forventet omsetning · 86 % sikkerhet</div>
          <div className="rap-warn info">
            <span className="ic"><Ic n="info" s={16} /></span>
            <div><div className="bt">Mandagslunsj ligger lavt</div><div className="bs">Prognosen tilsier 1 færre rolle på lunsj mandag. Botsson har lagt forslaget i vaktplan-utkastet.</div></div>
          </div>
          <button className="rap-btn sm" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} onClick={() => onGoTab("innsikt")}><Ic n="sparkle" s={14} /> Se prognoseinnsikt</button>
        </div>
      </R.Panel>
    );
  }

  window.RapOversikt = RapOversikt;
})();
