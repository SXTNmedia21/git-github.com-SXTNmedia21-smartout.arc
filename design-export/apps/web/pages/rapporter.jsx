// ===== Rapporter & innsikt — page controller =====
// One route, five internal tabs (Oversikt · Innsikt · Rapportbygger · Datakilder ·
// Planlagte). Holds shared scope (sted/periode/perspektiv), registers Botsson
// context, and hosts the KPI drill-down drawer. Each tab is its own window.Rap* view.
(function () {
  const { useState, useEffect, useRef } = React;

  // standalone deliverables produced by this module (open in a new tab)
  const DOCS = {
    pdf: "reports/Ukentlig%20l%C3%B8nnsrapport.html",
    driftspuls: "reports/Daglig%20driftspuls.html",
    avdeling: "reports/Avdelingsl%C3%B8nnsomhet.html",
    lonnskjoring: "reports/L%C3%B8nnskj%C3%B8ringsrapport.html",
    lonnsgrunnlag: "reports/L%C3%B8nnsgrunnlag.html",
    email: "emails/Ukesrapport%20klar.html",
  };
  window.SmartoutReportDocs = DOCS;
  const openDoc = (which) => window.open(DOCS[which], "_blank", "noopener");

  function RapPeriodSwitch({ period, setPeriod }) {
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    R.useOutside(ref, open ? () => setOpen(false) : null);
    const cur = D.RAP_PERIODS.find((p) => p.id === period) || D.RAP_PERIODS[0];
    return (
      <div className="rap-dim-row" ref={ref} style={{ position: "relative" }}>
        <button className="rap-btn" onClick={() => setOpen((o) => !o)}>
          <Ic n="calendar" s={15} /> {cur.label}<span style={{ color: "var(--muted)", fontWeight: 500, marginLeft: 2 }}>· {cur.range}</span>
          <Ic n="chevDown" s={13} c="var(--muted)" />
        </button>
        {open && (
          <div className="rap-pop" style={{ minWidth: 240 }}>
            <div className="sk-pop-sec" style={{ padding: "6px 11px 4px" }}>Periode</div>
            {D.RAP_PERIODS.map((p) => (
              <div key={p.id} className={`row ${p.id === period ? "on" : ""}`} onClick={() => { setPeriod(p.id); setOpen(false); }}>
                <Ic n={p.kind === "month" ? "calendar" : p.kind === "quarter" ? "layers" : p.kind === "ytd" ? "history" : "calendar"} s={14} c="var(--muted)" />
                <span style={{ fontWeight: 600 }}>{p.label}</span>
                <span className="dt">{p.range}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function RapporterPage() {
    const toast = window.useToast();
    const R = window.Rap; const { Ic } = R;
    const D = window.SmartoutData;

    const [tab, setTab] = useState("oversikt");
    const [scope, setScope] = useState("nord");   // venue id or "all"
    const [period, setPeriod] = useState("w22");
    const [role, setRole] = useState("drift");     // drift | eier
    const [drillKpi, setDrillKpi] = useState(null);
    const [openInsight, setOpenInsight] = useState(null);

    const scopeName = scope === "all" ? "Nord Gruppen" : R.venue(scope).name;
    const periodLabel = (D.RAP_PERIODS.find((p) => p.id === period) || {}).label || "Uke 22";

    // ---- Botsson context (structured, stable identifiers) ----
    useEffect(() => {
      if (window.SmartoutContext && window.SmartoutContext.set) {
        window.SmartoutContext.set({
          route: "rapporter", view: tab, subject: `${scopeName} · ${periodLabel}`,
          role: "admin", perspective: role,
          describe: (q) => `Rapporter · ${tab}. Du ser på ${scopeName} for ${periodLabel} i ${role === "eier" ? "eier" : "drift"}-perspektiv. ` +
            `Lønnskostnaden er 29,4 % (mål 28 %), 6 innsikter er klare, og 5 rapporter er planlagt. ` +
            (q && /eksport|pdf|skriv ut/.test(q) ? "Bruk «Eksporter» øverst til høyre for PDF/Excel." :
             q && /planlagt|schedule/.test(q) ? "Gå til fanen «Planlagte» for å styre mottakere og frekvens." :
             "Klikk et nøkkeltall for å bore deg ned i avdeling, dag og drivere."),
        });
      }
      return () => { if (window.SmartoutContext && window.SmartoutContext.set) window.SmartoutContext.set({ route: null }); };
    }, [tab, scope, period, role]);

    const venues = D.RAP_VENUES; // [all, nord, brygga, torget, express]

    const TABS = [
      ["oversikt", "Oversikt", "gauge", null],
      ["innsikt", "Innsikt", "sparkle", D.RAP_INSIGHTS.length],
      ["bygger", "Rapportbygger", "sliders", null],
      ["datakilder", "Datakilder", "layers", D.RAP_SOURCES.filter((s) => s.status === "warning" || s.status === "error").length || null],
      ["planlagte", "Planlagte", "timer", D.RAP_SCHEDULED.filter((s) => s.status === "active").length],
    ];

    const openInsightAndTab = (id) => { setOpenInsight(id); setTab("innsikt"); };

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 1280 }}>
          {/* head */}
          <div className="rap-head">
            <div>
              <div className="sk-eyebrow">Økonomi · Innsikt</div>
              <h1 className="rap-h1">Rapporter &amp; innsikt</h1>
              <div className="rap-sub">Botsson leser POS, vaktplan og lønn sammen — så du ser hva som driver tallene, og kan handle før uka er over.</div>
            </div>
            <div className="rap-head-actions">
              <button className="rap-btn" onClick={() => openDoc("email")}><Ic n="send" s={15} /> Forhåndsvis e-post</button>
              <button className="rap-btn" onClick={() => { openDoc("pdf"); toast("Åpner ukentlig lønnsrapport (PDF)"); }}><Ic n="download" s={15} /> Eksporter</button>
              <button className="rap-btn primary" onClick={() => setTab("bygger")}><Ic n="plus" s={15} sw={2.2} /> Bygg rapport</button>
            </div>
          </div>

          {/* scope bar: venue + period + perspective */}
          <div className="rap-scope">
            <div className="grp" role="tablist" aria-label="Sted">
              {venues.map((v) => (
                <button key={v.id} className={scope === v.id ? "on" : ""} onClick={() => setScope(v.id)} title={v.name}>
                  {v.id === "all" ? <Ic n="building" s={13} /> : <span className="vdot" style={{ background: v.color }} />}
                  {v.short}
                </button>
              ))}
            </div>
            <RapPeriodSwitch period={period} setPeriod={setPeriod} />
            <span className="spacer" />
            <div className="rap-roleseg" role="tablist" aria-label="Perspektiv">
              <button className={role === "drift" ? "on" : ""} onClick={() => setRole("drift")}><Ic n="gauge" s={14} /> Drift</button>
              <button className={role === "eier" ? "on" : ""} onClick={() => setRole("eier")}><Ic n="scale" s={14} /> Eier</button>
            </div>
          </div>

          {/* tabs */}
          <div className="rap-tabs" role="tablist">
            {TABS.map(([k, l, ic, n]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}>
                <Ic n={ic} s={15} /> {l}{n != null && <span className={`cnt ${k === "datakilder" ? "crit" : ""}`}>{n}</span>}
              </button>
            ))}
          </div>

          {/* active view */}
          {tab === "oversikt" && (
            <window.RapOversikt scope={scope} period={period} role={role}
              onOpenKpi={setDrillKpi} onGoTab={setTab} onOpenInsight={openInsightAndTab} toast={toast} />
          )}
          {tab === "innsikt" && (
            <window.RapInsikt scope={scope} role={role} openId={openInsight} onClearOpen={() => setOpenInsight(null)} toast={toast} />
          )}
          {tab === "bygger" && (
            <window.RapBygger scope={scope} period={period} onOpenKpi={setDrillKpi} toast={toast} />
          )}
          {tab === "datakilder" && (
            <window.RapDatakilder toast={toast} />
          )}
          {tab === "planlagte" && (
            <window.RapPlanlagte scope={scope} toast={toast} />
          )}
        </div>

        {/* KPI drill-down drawer */}
        {drillKpi && (
          <window.RapDrilldown kpiId={drillKpi} onClose={() => setDrillKpi(null)} onOpenInsight={openInsightAndTab} toast={toast} />
        )}
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { rapporter: RapporterPage });
})();
