// ===== Menykunnskap — training cockpit (embedded in the Opplæring book detail) =====
// Renders inside HbHandbookDetail when book.training. Surfaces the operational side
// of training — readiness, leaderboard, knowledge gaps — plus production CTAs.
// window.MkTrainingPanel.
(function () {
  const { useState } = React;
  const M = () => window.Mk;
  const D = () => window.SmartoutData;
  const Ic = window.Ic;

  function MkTrainingPanel({ book, nav, toast }) {
    const { Ring, Bar, MkAv } = M();
    const staff = [...D().MK_STAFF].sort((a, b) => b.score - a.score);
    const menus = D().MK_MENUS;
    const gaps = D().MK_GAP_BY_DISH;
    const [showSrc, setShowSrc] = useState(false);

    const ready = staff.filter((s) => s.status === "klar" || s.status === "topp").length;
    const retake = staff.filter((s) => s.status === "retake").length;
    const notReady = staff.filter((s) => s.status === "ikke-klar").length;
    const total = staff.length;
    const avg = Math.round(staff.reduce((a, s) => a + s.score, 0) / total);
    const reviewCount = menus.reduce((a, m) => a + m.review, 0);
    const tone = (v) => (v >= 80 ? "var(--success)" : v >= 65 ? "var(--warning)" : "var(--error)");
    const STATUS_LBL = { topp: "Toppscorer", klar: "Skiftklar", retake: "Ny test", "ikke-klar": "Ikke klar" };

    const KPIS = [
      { lbl: "Skiftklare", val: ready, u: `/${total}`, tone: notReady ? "warn" : "ok", edge: notReady ? "var(--warning)" : "var(--success)" },
      { lbl: "Snitt-score", val: avg, u: "%", tone: avg >= 80 ? "ok" : "warn", edge: tone(avg) },
      { lbl: "Aktive moduler", val: menus.filter((m) => m.status === "publisert").length, u: "", tone: "", edge: "var(--acc, var(--orange))" },
      { lbl: "Krever bekreftelse", val: reviewCount, u: "", tone: reviewCount ? "warn" : "ok", edge: reviewCount ? "var(--warning)" : "var(--success)" },
    ];

    const seg = [
      { c: "var(--success)", w: (ready / total) * 100 },
      { c: "var(--warning)", w: (retake / total) * 100 },
      { c: "var(--error)", w: (notReady / total) * 100 },
    ];

    return (
      <div className="mk-training-cockpit" style={{ marginBottom: 26 }}>
        {/* Botsson brief */}
        <div className="brief" style={{ marginBottom: 16 }}>
          <div className="brief-top">
            <span className="brief-av"><Ic n="bot" s={18} /></span>
            <div className="brief-id">
              <div className="n">Mr. Botsson <span className="tag">OPPLÆRING</span></div>
              <div className="m">Oppdatert 08:42 · fredag 31. mai</div>
            </div>
            <span className="spacer" />
            <button className="brief-why" onClick={() => setShowSrc((v) => !v)}><Ic n="eye" s={13} /> {showSrc ? "Skjul kilder" : "Hvorfor?"}</button>
          </div>
          <p className="brief-body">
            <strong>Lunsjmenyen er lest</strong> og venter på at du bekrefter allergener før quizen bygges. <span className="hl-crit">Petter og Sara er ikke skiftklare</span> (74 % / 61 %), og vinkartet har <strong>{reviewCount} ubekreftede fakta</strong>. Jeg foreslår å fullføre lunsjmenyen først.
          </p>
          {showSrc && (
            <div className="brief-sources">
              {[["camera", "Lunsjmeny — foto"], ["chart", "Score · 6 ansatte"], ["wallet", "Vinkart · ubekreftet"], ["calendar", "Helgevakter"]].map(([ic, t]) => (
                <span key={t} className="brief-src"><span className="ic"><Ic n={ic} s={12} /></span>{t}</span>
              ))}
            </div>
          )}
          <div className="brief-actions">
            <button className="brief-act" onClick={() => nav.doc(book.id, "o-mat", "o-mat-2")}><span className="num">1</span> Fullfør lunsjmenyen <Ic n="arrowRight" s={13} /></button>
            <button className="brief-act" onClick={() => nav.menuflow(book.id)}><span className="num">2</span> Lag ny modul fra meny</button>
            <button className="brief-act" onClick={() => nav.playquiz({})}><span className="num">3</span> Spill quizen som ansatt</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mk-pulse" style={{ marginBottom: 18 }}>
          {KPIS.map((k) => (
            <div key={k.lbl} className="mk-kpi">
              <span className="edge" style={{ background: k.edge }} />
              <span className="mk-kpi-lbl">{k.lbl}</span>
              <div className={`mk-kpi-val ${k.tone}`}>{k.val}<span className="u">{k.u}</span></div>
            </div>
          ))}
        </div>

        <div className="so-grid-2">
          {/* leaderboard + readiness */}
          <div className="so-panel">
            <div className="so-panel-head">
              <span className="t"><span className="ico"><Ic n="star" s={15} /></span>Ledertavle & skiftklar</span>
              <span className="spacer" />
              <span className="mk-chip"><Ic n="lock" s={10} /> Påkrevd: 80 %</span>
            </div>
            <div style={{ padding: "12px 18px 4px" }}>
              <div className="mk-readybar" style={{ height: 10, marginBottom: 8 }}>{seg.map((s, i) => <span key={i} style={{ width: s.w + "%", background: s.c }} />)}</div>
              <div className="mk-readylegend" style={{ fontSize: 11 }}>
                <span><i style={{ background: "var(--success)" }} />{ready} skiftklare</span>
                <span><i style={{ background: "var(--warning)" }} />{retake} ny test</span>
                <span><i style={{ background: "var(--error)" }} />{notReady} ikke klare</span>
              </div>
            </div>
            <div className="mk-lb">
              {staff.map((s, i) => (
                <div key={s.id} className="mk-lb-row" onClick={() => toast(`Åpner profilen til ${s.name}`)}>
                  <span className={`mk-lb-rank ${i === 0 ? "top" : ""}`}>{i === 0 ? <Ic n="star" s={15} c="var(--orange)" /> : i + 1}</span>
                  <MkAv p={s} size={34} />
                  <div className="mk-lb-id">
                    <div className="mk-lb-name">{s.name}{s.streak > 0 && <span className="mk-streak"><Ic n="zap" s={11} c="var(--orange)" /> {s.streak}</span>}</div>
                    <div className="mk-lb-role">{s.role}{s.weak ? ` · svak: ${s.weak}` : " · alt på stell"}</div>
                  </div>
                  <span className={`mk-badge ${s.status}`}>
                    {s.status === "topp" && <Ic n="star" s={11} />}{s.status === "klar" && <Ic n="check" s={11} sw={2.6} />}
                    {s.status === "retake" && <Ic n="repeat" s={11} />}{s.status === "ikke-klar" && <Ic n="clock" s={11} />}
                    {STATUS_LBL[s.status]}
                  </span>
                  <span className="mk-lb-score" style={{ color: tone(s.score) }}>{s.score}%</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "11px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
              <button className="mk-btn" onClick={() => toast("Vennlig påminnelse sendt til Petter K. og Sara M.", { undo: () => {} })}><Ic n="bell" s={14} /> Send påminnelse</button>
              <button className="mk-btn" onClick={() => toast("Tildeler påkrevd quiz")}><Ic n="userCheck" s={14} /> Tildel påkrevd quiz</button>
            </div>
          </div>

          {/* knowledge gaps */}
          <div className="so-stack">
            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="alert" s={15} /></span>Kunnskapshull</span><span className="spacer" /><span className="so-panel-head" style={{ border: "none", padding: 0 }}><span className="cnt">{gaps.length}</span></span></div>
              <div className="mk-gap">
                {gaps.slice(0, 4).map((g) => (
                  <div key={g.name} className="mk-gap-row" style={{ gridTemplateColumns: "1fr 90px auto", padding: "11px 18px" }}>
                    <div className="mk-gap-id"><div className="nm">{g.name}</div><div className="kn">{g.kind}</div></div>
                    <div className="mk-gap-track"><span style={{ width: g.correct + "%", background: tone(g.correct) }} /></div>
                    <span className="mk-gap-pct" style={{ color: tone(g.correct) }}>{g.correct}%</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "11px 18px", borderTop: "1px solid var(--border)" }}>
                <button className="mk-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => nav.menuflow(book.id)}><Ic n="zap" s={14} /> Lag oppfriskningsrunde fra hullene</button>
              </div>
            </div>

            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="history" s={15} /></span>Faktakilder · logg</span></div>
              <div style={{ padding: "6px 18px 12px" }}>
                {D().MK_LOG.slice(0, 4).map((l) => (
                  <div key={l.id} className="feed-item" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span className="feed-rail"><span className="feed-dot" style={{ background: "var(--muted-soft)" }} /></span>
                    <div className="feed-body"><span className="who">{l.who}</span> {l.text}<div className="feed-time">{l.time} · {(D().MK_SOURCE_LABEL || {})[l.src]}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 2px", fontSize: 11.5, color: "var(--muted)" }}>
          <Ic n="layers" s={14} c="var(--acc, var(--orange))" />
          <span>Innholdet under er kunnskapsbasen — hvert dokument er en modul med retter, allergener, lokal kunnskap og en spillbar quiz.</span>
        </div>
      </div>
    );
  }

  window.MkTrainingPanel = MkTrainingPanel;
})();
