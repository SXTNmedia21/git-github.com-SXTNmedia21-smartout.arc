// ===== HMS — page host (tabs + nav-stack entity routing + wizard + context) =====
(function () {
  const { useState, useEffect } = React;

  const TABS = [
    ["oversikt", "Oversikt", "home"],
    ["protokoller", "Protokoller", "shield"],
    ["opplaring", "Opplæring", "cap"],
    ["avvik", "Avvik", "alert"],
    ["logg", "Logg", "history"],
  ];

  function HmsPage({ setRoute }) {
    const toast = window.useToast();
    const SD = window.SmartoutData;
    const H = window.Hms;
    const [tab, setTab] = useState("oversikt");
    const [stack, setStack] = useState([]);      // nav frames: {type, id}
    const [drawer, setDrawer] = useState(null);  // comment drawer payload
    const [wizard, setWizard] = useState(false);
    const [genEvi, setGenEvi] = useState({});     // protoId -> [evidence] generated at runtime
    const [avvikFocus, setAvvikFocus] = useState(null); // deep-link: open this avvik's drawer on the Avvik tab

    // jump to the Avvik tab and auto-open a specific avvik's drawer
    const openAvvik = (id) => { setStack([]); setTab("avvik"); setAvvikFocus(id || true); };

    // global «Skap → Avvik» lands on the Avvik tab; HmsDeviations opens the Meld-avvik intake
    useEffect(() => { if (window.__pendingCreate === "avvik") setTab("avvik"); }, []);

    const top = stack[stack.length - 1] || null;
    useEffect(() => { window.scrollTo({ top: 0 }); const m = document.querySelector(".sk-main"); if (m) m.scrollTop = 0; }, [tab, stack]);

    // ----- nav primitives -----
    const push = (f) => setStack((s) => { const i = s.findIndex((x) => x.type === f.type && x.id === f.id); return i >= 0 ? s.slice(0, i + 1) : [...s, f]; });
    const openEntity = (type, id) => push({ type, id: id || (type === "handbook" ? "hms" : id) });
    const popTo = (i) => setStack((s) => s.slice(0, i + 1));
    const back = () => setStack((s) => s.slice(0, -1));
    const goTab = (t) => { setStack([]); setTab(t || tab); };
    const openProto = (id) => openEntity("proto", id);
    const openCat = (id) => openEntity("cat", id);
    const openComments = (payload) => setDrawer(payload);
    const addEvi = (protoId, evi) => setGenEvi((g) => ({ ...g, [protoId]: [evi, ...(g[protoId] || [])] }));

    // Botsson context
    useEffect(() => {
      if (!window.SmartoutContext || !window.SmartoutContext.set) return;
      const view = top ? top.type : tab;
      let subject = null;
      if (top) {
        if (top.type === "proto") subject = (SD.HMS_PROTO_BY_ID[top.id] || {}).title;
        else if (top.type === "cat") subject = (SD.HMS_CATEGORIES[top.id] || {}).name;
        else if (top.type === "handbook") subject = "HMS-håndbok";
      }
      window.SmartoutContext.set({ route: "hms", view, subject, role: "admin" });
    }, [tab, stack]);

    // ----- breadcrumb from stack -----
    const frameLabel = (f) => {
      switch (f.type) {
        case "cat": return (SD.HMS_CATEGORIES[f.id] || {}).name;
        case "proto": return (SD.HMS_PROTO_BY_ID[f.id] || {}).code || "Protokoll";
        case "handbook": return "HMS-håndbok";
        case "procedure": return "Prosedyre";
        case "routine": return "Rutine";
        case "training": return (H.training(f.id) || {}).title;
        case "quiz": return (H.quiz(f.id) || {}).title;
        case "manual": return (H.manual(f.id) || {}).title;
        case "legal": return (H.legal(f.id) || {}).name;
        case "process": return (H.process(f.id) || {}).name;
        default: return f.type;
      }
    };
    const crumbs = [{ label: "HMS", ic: "shield", onClick: () => goTab(tab) }, ...stack.map((f, i) => ({ label: frameLabel(f), onClick: i < stack.length - 1 ? () => popTo(i) : undefined }))];

    const Drawer = () => drawer ? <H.CommentDrawer open={true} onClose={() => setDrawer(null)} title={drawer.title} anchorLabel={drawer.anchorLabel} comments={drawer.comments} toast={toast} /> : null;
    const Wizard = () => wizard ? <window.HmsProtocolWizard open={true} onClose={() => setWizard(false)} onCreated={(id) => openEntity("proto", id)} toast={toast} /> : null;

    // ----- detail (entity) views replace the page -----
    if (top) {
      const common = { crumbs, openEntity, openProto, openCat, openComments, goTab, addEvi, toast, back };
      let body = null;
      switch (top.type) {
        case "cat": body = <window.HmsCategoryDetail catId={top.id} onBack={back} openProto={openProto} openComments={openComments} toast={toast} />; break;
        case "proto": body = <window.HmsProtocolDetail protoId={top.id} onBack={back} crumbs={crumbs} openEntity={openEntity} openProto={openProto} openCat={openCat} openComments={openComments} goTab={goTab} addEvi={addEvi} genEvi={genEvi[top.id] || []} toast={toast} />; break;
        case "handbook": body = <window.HmsHandbookDetail {...common} />; break;
        case "procedure": body = <window.HmsProcedureDetail frameId={top.id} {...common} />; break;
        case "routine": body = <window.HmsRoutineDetail frameId={top.id} {...common} />; break;
        case "training": body = <window.HmsTrainingDetail frameId={top.id} {...common} />; break;
        case "quiz": body = <window.HmsQuizDetail frameId={top.id} {...common} />; break;
        case "manual": body = <window.HmsManualDetail frameId={top.id} {...common} />; break;
        case "legal": body = <window.HmsLegalDetail frameId={top.id} {...common} />; break;
        case "process": body = <window.HmsProcessDetail frameId={top.id} {...common} />; break;
        default: body = null;
      }
      return <>{body}<Drawer /><Wizard /></>;
    }

    // ----- tab chrome -----
    const maxWidth = tab === "oversikt" ? 1240 : tab === "opplaring" ? 1180 : 1100;

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth }}>
          {/* page head */}
          <div className="hms-head">
            <div>
              <div className="sk-eyebrow">Team · Bistro Nord</div>
              <h1 className="hms-title">HMS</h1>
              <div className="hms-sub">
                <span className="seg">Helse, miljø og sikkerhet</span>
                <span className="sep" />
                <span className="seg"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0e8c8c", display: "inline-block" }} /> Helse</span>
                <span className="seg"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3c8c4a", display: "inline-block" }} /> Miljø</span>
                <span className="seg"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c2700c", display: "inline-block" }} /> Sikkerhet</span>
              </div>
            </div>
            <div className="sk-page-actions">
              <button className="sk-ghost" onClick={() => openEntity("handbook")}><window.Ic n="book" s={15} /> Bibliotek</button>
              <button className="sk-primary" onClick={() => setWizard(true)}><window.Ic n="plus" s={15} c="#fff" sw={2.3} /> Ny protokoll</button>
            </div>
          </div>

          {/* tab bar */}
          <div className="hms-tabs">
            {TABS.map(([id, label, ic]) => {
              const cnt = id === "protokoller" ? SD.HMS_PROTOCOLS.length
                : id === "avvik" ? SD.HMS_DEVIATIONS.filter((t) => t.status !== "lukket" && t.sev === "kritisk").length
                : id === "opplaring" ? SD.HMS_TRACKING.filter((t) => t.status === "overdue" || t.status === "missing").length
                : null;
              const crit = id === "avvik" || id === "opplaring";
              return (
                <button key={id} className={`hms-tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
                  <span className="tic"><window.Ic n={ic} s={15} /></span>{label}
                  {cnt ? <span className={`c ${crit ? "crit" : ""}`}>{cnt}</span> : null}
                </button>
              );
            })}
          </div>

          {/* content */}
          {tab === "oversikt" && <window.HmsDashboard openCat={openCat} openProto={openProto} openTab={(t) => setTab(t)} openAvvik={openAvvik} openBib={() => openEntity("handbook")} toast={toast} />}
          {tab === "protokoller" && <window.HmsProtocols openProto={openProto} openCat={openCat} openBib={() => openEntity("handbook")} onNewProtocol={() => setWizard(true)} toast={toast} />}
          {tab === "opplaring" && <window.HmsTraining toast={toast} openProto={openProto} openEntity={openEntity} />}
          {tab === "avvik" && <window.HmsDeviations toast={toast} openComments={openComments} openProto={openProto} openEntity={openEntity} focusId={avvikFocus} onFocusHandled={() => setAvvikFocus(null)} />}
          {tab === "logg" && <window.HmsActivity toast={toast} openProto={openProto} />}
        </div>

        <Drawer /><Wizard />
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { hms: HmsPage });
})();
