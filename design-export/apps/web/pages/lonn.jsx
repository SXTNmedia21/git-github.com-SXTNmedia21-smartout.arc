// ===== Lønn — admin host (route "lonn") =====
// Close-the-period flow for daglig leder. Calc-engine derives every line;
// the human confirms deviations and locks. Tabs: Oversikt · Linjer · Avvik
// · Regler · Innstillinger. Drilldown drawer + lock modal + manual-supplement
// modal ride on top. AI (Mr. Botsson) is assistive — confirms with sources,
// never auto-locks. Everything toasts + undoes.
(function () {
  const { useState, useEffect, useMemo, useRef } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  function LonnPage({ setRoute }) {
    const toast = window.useToast();
    const L = window.Lo;
    const { Oversikt, Linjer, Avvik } = window.LoViews;
    const { Regler, Innstillinger } = window.LoConfig;
    const { Drilldown, LockModal, SupplementForm } = window.LoOverlays;

    const [tab, setTab] = useState("oversikt");
    const [periodId, setPeriodId] = useState("2026-04");
    const [periodOpen, setPeriodOpen] = useState(false);
    const [devs, setDevs] = useState(() => D().LO_DEVIATIONS.map((d) => ({ ...d })));
    const [rules, setRules] = useState(() => D().LO_RULES.map((r) => ({ ...r })));
    const [policies, setPolicies] = useState(() => D().LO_SETTINGS.confirmations.map((p) => ({ ...p })));
    const [assistDone, setAssistDone] = useState(false);
    const [openEmp, setOpenEmp] = useState(null);
    const [lockOpen, setLockOpen] = useState(false);
    const [supplement, setSupplement] = useState(undefined); // undefined=closed, null=no emp, uid=emp
    const [locked, setLocked] = useState(false);

    const periods = D().LO_PERIODS;
    const period = periods.find((p) => p.id === periodId) || periods[0];
    const emps = D().LO_EMPLOYEES;
    const totals = D().LO_TOTALS;
    const errorsOpen = devs.filter((d) => d.kind === "error" && d.status === "open").length;

    const periodView = locked && period.id === "2026-04" ? { ...period, status: "locked" } : period;
    const isOpen = period.status === "open" && !locked;

    // ---- Botsson context ----
    useEffect(() => {
      if (window.SmartoutContext && window.SmartoutContext.set) {
        window.SmartoutContext.set({ route: "lonn", view: tab, subject: period.label, role: "admin", drafts: errorsOpen });
      }
      return () => { if (window.SmartoutContext && window.SmartoutContext.set) window.SmartoutContext.set({ route: null }); };
    }, [tab, periodId, errorsOpen, locked]);

    // ---- mutators ----
    const confirmDev = (id) => {
      const d = devs.find((x) => x.id === id);
      if (!d || d.status === "ack") return;
      setDevs((ds) => ds.map((x) => x.id === id ? { ...x, status: "ack" } : x));
      toast(`Avvik ${id} bekreftet`, { undo: () => setDevs((ds) => ds.map((x) => x.id === id ? { ...x, status: d.status } : x)) });
    };
    const confirmMany = (ids, label) => {
      const prev = devs.map((x) => ({ ...x }));
      setDevs((ds) => ds.map((x) => ids.includes(x.id) ? { ...x, status: "ack" } : x));
      toast(label || `${ids.length} avvik bekreftet`, { undo: () => setDevs(prev) });
    };
    const confirmAll = (code) => {
      const ids = devs.filter((d) => d.kind === "error" && d.status === "open" && (!code || d.code === code)).map((d) => d.id);
      if (!ids.length) { toast("Ingen åpne avvik av denne typen"); return; }
      confirmMany(ids, `${ids.length} avvik bekreftet (${code === "HELLIGDAG_KOLLISJON" ? "rød dag" : code})`);
    };
    const toggleRule = (code) => {
      const r = rules.find((x) => x.code === code);
      setRules((rs) => rs.map((x) => x.code === code ? { ...x, active: !x.active } : x));
      toast(`${code} ${r.active ? "deaktivert" : "aktivert"}`, { undo: () => setRules((rs) => rs.map((x) => x.code === code ? { ...x, active: r.active } : x)) });
    };
    const togglePolicy = (key) => {
      const p = policies.find((x) => x.key === key);
      setPolicies((ps) => ps.map((x) => x.key === key ? { ...x, on: !x.on } : x));
      toast(`«${p.label}» ${p.on ? "av" : "på"}`, { undo: () => setPolicies((ps) => ps.map((x) => x.key === key ? { ...x, on: p.on } : x)) });
    };
    const doLock = () => {
      setLocked(true); setLockOpen(false);
      toast(`${period.label} er låst · lønnsslipper sendes ${"28.04"}`, { undo: () => setLocked(false) });
    };
    const submitSupplement = (data) => {
      setSupplement(undefined);
      const nm = data.uid ? (D().LO_EMP_BY_ID[data.uid] || {}).name : "ansatt";
      toast(`Manuelt tillegg lagt til for ${nm}`, { undo: () => {} });
    };

    const TABS = [
      ["oversikt", "Oversikt", "gauge", null],
      ["linjer", "Linjer", "list", period.emp],
      ["avvik", "Avvik", "alert", devs.filter((d) => d.status === "open").length],
      ["regler", "Regler", "sparkle", null],
      ["innstillinger", "Innstillinger", "settings", null],
    ];

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 1240 }}>
          {/* head */}
          <div className="lo-head">
            <div>
              <div className="sk-eyebrow">Økonomi · Lønn</div>
              <h1 className="lo-h1">Lønn</h1>
              <div className="lo-sub">Lukk én måned i gangen — calc-engine deriverer, du bekrefter avvik og låser.</div>
            </div>
            <div className="lo-head-actions">
              <PeriodSwitcher periods={periods} current={period} open={periodOpen} setOpen={setPeriodOpen} onSelect={(id) => { setPeriodId(id); setPeriodOpen(false); setTab("oversikt"); }} />
              <button className="lo-btn" onClick={() => { const open = window.openReportDoc || window.openDagsrapport; if (open) { window.openReportDoc({ src: ((window.SmartoutReportDocs || {}).lonnskjoring) || "reports/L%C3%B8nnskj%C3%B8ringsrapport.html", title: "Lønnskjøringsrapport", subtitle: `Bistro Nord · ${period.label} · klar for utskrift`, frameTitle: "Lønnskjøringsrapport — Bistro Nord", filterLabel: "Vis / skriv ut", filters: [ { id: "all", label: "Komplett", keys: ["*"] }, { id: "sum", label: "Sammendrag", keys: ["sum"] }, { id: "avvik", label: "Avvik", keys: ["avvik"] }, { id: "ansatte", label: "Ansatte (kalkyle)", keys: ["ansatte"] }, { id: "tillegg", label: "Tillegg & eksport", keys: ["tillegg"] } ] }); } else { window.open(((window.SmartoutReportDocs || {}).lonnskjoring) || "reports/L%C3%B8nnskj%C3%B8ringsrapport.html", "_blank", "noopener"); } }}><Ic n="file" s={15} /> Rapport</button>
              <button className="lo-btn" onClick={() => { if (window.openReportDoc) window.openReportDoc({ src: ((window.SmartoutReportDocs || {}).lonnsgrunnlag) || "reports/L%C3%B8nnsgrunnlag.html", title: "Lønnsgrunnlag", subtitle: `Bistro Nord · ${period.label} · klar for utskrift`, frameTitle: "Lønnsgrunnlag — Bistro Nord", filterLabel: "Vis / skriv ut", filters: [ { id: "all", label: "Komplett", keys: ["*"] }, { id: "sum", label: "Oppsummering", keys: ["sum"] }, { id: "timer", label: "Timegrunnlag", keys: ["timer"] }, { id: "tillegg", label: "Tillegg", keys: ["tillegg"] }, { id: "linjer", label: "Lønnslinjer", keys: ["linjer"] } ] }); }}><Ic n="download" s={15} /> Eksport</button>
              <button className={`lo-btn ${isOpen && errorsOpen === 0 ? "primary" : ""}`} disabled={!isOpen} onClick={() => setLockOpen(true)}><Ic n="lock" s={15} /> {locked ? "Låst" : "Lås periode"}</button>
            </div>
          </div>

          {/* locked success banner */}
          {locked && period.id === "2026-04" && (
            <div className="lo-banner ok" style={{ marginBottom: 16 }}>
              <div className="ic"><Ic n="check" s={18} /></div>
              <div className="bd"><div className="bt">{period.label} er låst</div><div className="bs">Linjene er fryst. Lønnsslipper blir tilgjengelige for ansatte 28.04. Eksport til A-melding er klar.</div></div>
              <button className="lo-btn sm" onClick={() => setLocked(false)}><Ic n="undo" s={14} /> Åpne på nytt</button>
            </div>
          )}

          {/* tabs */}
          <div className="lo-tabs">
            {TABS.map(([k, l, ic, n]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                <Ic n={ic} s={15} /> {l}{n != null && <span className={`cnt ${k === "avvik" && errorsOpen > 0 ? "crit" : ""}`}>{n}</span>}
              </button>
            ))}
          </div>

          {/* closed-period read-only notice */}
          {!isOpen && tab !== "regler" && tab !== "innstillinger" && period.id !== "2026-04" ? (
            <ClosedPeriod period={period} onBack={() => { setPeriodId("2026-04"); }} />
          ) : (
            <>
              {tab === "oversikt" && (
                <Oversikt period={periodView} devs={devs} emps={emps} totals={totals} assistDone={assistDone}
                  onAssist={(ids) => confirmMany(ids, `${ids.length} rød-dag avvik bekreftet`)} onDismissAssist={() => setAssistDone(true)}
                  onConfirmDev={confirmDev} onOpenEmp={setOpenEmp} onLock={() => setLockOpen(true)} onGoTab={setTab} onSelectPeriod={(id) => { setPeriodId(id); setTab("oversikt"); }} />
              )}
              {tab === "linjer" && <Linjer emps={emps} devs={devs} totals={totals} onOpenEmp={setOpenEmp} onSupplement={(uid) => setSupplement(uid === undefined ? null : uid)} />}
              {tab === "avvik" && <Avvik period={periodView} devs={devs} onConfirmDev={confirmDev} onConfirmAll={confirmAll} onOpenEmp={(uid) => { setOpenEmp(uid); }} onLock={() => setLockOpen(true)} />}
              {tab === "regler" && <Regler rules={rules} onToggle={toggleRule} toast={toast} />}
              {tab === "innstillinger" && <Innstillinger policies={policies} onTogglePolicy={togglePolicy} toast={toast} />}
            </>
          )}
        </div>

        {/* overlays */}
        {openEmp && <Drilldown uid={openEmp} devs={devs} onClose={() => setOpenEmp(null)} onSupplement={(uid) => { setOpenEmp(null); setSupplement(uid); }} onOpenProfile={(uid) => { try { window.__openAnsattId = uid; } catch (e) {} setOpenEmp(null); setRoute && setRoute("ansatte"); }} />}
        {lockOpen && <LockModal period={periodView} devs={devs} totals={totals} onClose={() => setLockOpen(false)} onConfirm={doLock} toast={toast} />}
        {supplement !== undefined && <SupplementForm uid={supplement} onClose={() => setSupplement(undefined)} onSubmit={submitSupplement} />}
      </main>
    );
  }

  // ---- period switcher ----
  function PeriodSwitcher({ periods, current, open, setOpen, onSelect }) {
    const { Badge } = window.Lo;
    const ref = useRef(null);
    window.Lo.useOutside(ref, open ? () => setOpen(false) : null);
    return (
      <div style={{ position: "relative" }} ref={ref}>
        <button className="lo-periodchip" onClick={() => setOpen((o) => !o)}>
          <span className="lbl">{current.label}</span><Badge kind={current.status} /><span className="ic"><Ic n="chevDown" s={14} /></span>
        </button>
        {open && (
          <div className="lo-periodpop">
            {periods.map((p) => (
              <div key={p.id} className={`row ${p.id === current.id ? "on" : ""}`} onClick={() => onSelect(p.id)}>
                <span className="nm">{p.label}</span><span className="dt">{p.start}–{p.end}</span><Badge kind={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- closed period read-only ----
  function ClosedPeriod({ period, onBack }) {
    const { kr, Badge, Panel, Empty } = window.Lo;
    return (
      <div className="lo-stack">
        <div className="lo-feature" style={{ background: "var(--card)" }}>
          <div className="main">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Badge kind={period.status} /><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{period.start} – {period.end} · {period.emp} ansatte · {period.lines} linjer</span></div>
            <div className="title">{period.label}</div>
            <div className="note">Perioden er {period.status === "approved" ? "godkjent" : "eksportert"} og fryst. Linjene kan ikke endres uten å åpne perioden på nytt.</div>
          </div>
          <div className="stats">
            <div className="lo-fstat"><div className="l">Brutto</div><div className="v">{kr(period.gross)}</div></div>
            <div className="lo-fstat"><div className="l">Netto</div><div className="v">{kr(period.net)}</div></div>
            <div className="lo-fstat"><div className="l">Avvik</div><div className="v">0</div></div>
          </div>
          <div className="actions"><button className="lo-btn" onClick={onBack}><Ic n="chevLeft" s={15} /> Til April 2026</button></div>
        </div>
        <Panel icon="checkdoc" title="Eksport-logg">
          <div style={{ padding: "4px 18px 14px" }}>
            <Empty icon="checkdoc" title="Ferdig behandlet" sub="A-melding sendt, bankfil eksportert, lønnsslipper publisert. Åpne April 2026 for den aktive jobben." />
          </div>
        </Panel>
      </div>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { lonn: LonnPage });
})();
