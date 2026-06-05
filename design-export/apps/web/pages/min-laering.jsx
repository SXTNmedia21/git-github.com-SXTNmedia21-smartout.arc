// ===== Min opplæring — employee-facing training (private mode) =====
// Staff see their assigned menu quizzes + readiness and take them on the phone.
// Registers window.SO_PAGES["min-laering"].
(function () {
  const { useState } = React;
  function MinLaeringPage() {
    const toast = window.useToast();
    const M = window.Mk;
    const D = window.SmartoutData;
    const Ic = window.Ic;
    const { Ring } = M;
    const [play, setPlay] = useState(null);

    const menus = D.MK_MENUS.filter((m) => m.status === "publisert");
    // the signed-in employee's own per-menu results (sample — "deg")
    const MY = {
      "vinter-mat": { score: 91, status: "bestatt" },
      "vinkart": { score: 0, status: "ikke-tatt", required: true },
      "cocktail": { score: 68, status: "ny-test", required: false },
    };
    const STAT = {
      bestatt: { lbl: "Bestått", cls: "klar", ic: "check" },
      "ny-test": { lbl: "Trenger ny test", cls: "retake", ic: "repeat" },
      "ikke-tatt": { lbl: "Ikke tatt", cls: "ikke-klar", ic: "clock" },
    };
    const passed = menus.filter((m) => (MY[m.id] || {}).status === "bestatt").length;
    const requiredOpen = menus.filter((m) => (MY[m.id] || {}).required && (MY[m.id] || {}).status !== "bestatt");
    const overall = Math.round(menus.reduce((a, m) => a + ((MY[m.id] || {}).score || 0), 0) / menus.length);
    const ready = requiredOpen.length === 0;

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 940 }}>
          <div className="sk-page-head" style={{ marginBottom: 18 }}>
            <div><div className="sk-eyebrow">Bistro Nord · ansatt</div><h1 className="sk-page-title">Min opplæring</h1></div>
            <div className="mk-streak" style={{ fontSize: 14 }}><Ic n="zap" s={16} c="var(--orange)" /> 5 dagers streak</div>
          </div>

          {/* readiness hero */}
          <div className="mk-ready-hero" style={{ marginBottom: 18 }}>
            <Ring value={overall} size={92} stroke={9} sub="snitt" />
            <div className="mk-ready-stat">
              <div className="mk-ready-line">
                {ready
                  ? <>Du er <b>skiftklar</b> på det som kreves. Fint jobba — ta gjerne de andre quizene for å klatre på tavla.</>
                  : <>Du mangler <b>{requiredOpen.length} påkrevd quiz</b> før du er skiftklar. Det tar bare et par minutter — feil svar lærer deg noe, ingen som dømmer.</>}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="mk-chip"><Ic n="check" s={11} c="var(--success)" /> {passed} bestått</span>
                <span className="mk-chip"><Ic n="lock" s={11} /> Påkrevd: 80 %</span>
                <span className="mk-chip"><Ic n="star" s={11} c="var(--orange)" /> 3. plass på tavla</span>
              </div>
            </div>
          </div>

          {requiredOpen.length > 0 && (
            <div className="mk-unv-banner" style={{ borderRadius: "var(--r-card)", border: "1px solid rgba(193,130,0,0.25)", marginBottom: 18, padding: "12px 16px" }}>
              <Ic n="alert" s={15} /> Påkrevd før neste skift: {requiredOpen.map((m) => m.name).join(", ")}
            </div>
          )}

          <div className="so-panel-head" style={{ border: "none", padding: "2px 2px 12px" }}>
            <span className="t" style={{ fontSize: 13 }}><span className="ico"><Ic n="cap" s={15} /></span>Quizene dine</span>
          </div>
          <div className="mk-menus">
            {menus.map((m) => {
              const my = MY[m.id] || { score: 0, status: "ikke-tatt" };
              const s = STAT[my.status];
              return (
                <div key={m.id} className="mk-menu" onClick={() => setPlay({ menu: m.id })}>
                  <div className="mk-menu-top">
                    <span className="mk-menu-ic"><Ic n={m.icon} s={19} /></span>
                    <div className="mk-menu-id">
                      <div className="mk-menu-name">{m.name}</div>
                      <div className="mk-menu-meta"><span className="mk-chip">{(D.MK_KIND_LABEL || {})[m.kind]}</span><span className="mono">{m.items} elementer</span></div>
                    </div>
                    {my.required && my.status !== "bestatt" && <span className="mk-statepill review"><Ic n="lock" s={10} /> Påkrevd</span>}
                  </div>
                  <div className="mk-menu-foot" style={{ borderTop: "none", paddingTop: 4 }}>
                    <span className={`mk-badge ${s.cls}`}><Ic n={s.ic} s={11} sw={2.4} /> {s.lbl}{my.status !== "ikke-tatt" ? ` · ${my.score}%` : ""}</span>
                    <button className="mk-btn primary" style={{ height: 32 }} onClick={(e) => { e.stopPropagation(); setPlay({ menu: m.id }); }}>
                      <Ic n="play" s={13} c="#fff" /> {my.status === "bestatt" ? "Øv igjen" : my.status === "ny-test" ? "Ta på nytt" : "Start quiz"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {play && window.MkQuizPlay && <window.MkQuizPlay staff toast={toast} onClose={() => setPlay(null)} />}
      </main>
    );
  }
  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { "min-laering": MinLaeringPage });
})();
