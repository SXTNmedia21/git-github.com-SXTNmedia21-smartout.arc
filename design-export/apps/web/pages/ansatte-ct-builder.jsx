// ===== Kontrakter — guided Template Builder (multi-section + Botsson advisor) =====
(function () {
  const { useState } = React;
  const C = window.Ct;
  const { Ic, SD, A, groupById, gradeById } = C;
  const SECTIONS = SD.CT_BUILDER_SECTIONS;

  const FLAG_LABEL = { required: "Påkrevd", legal: "Lovpålagt", auto: "Auto", optional: "Valgfritt" };

  function CtBuilder({ tpl, onClose, toast }) {
    const isNew = !tpl;
    const base = tpl || { name: "Ny mal", group: "kjokken", version: "0.1", status: "draft" };
    const [active, setActive] = useState(0);
    const [preview, setPreview] = useState(false);
    const [done, setDone] = useState({});          // visited/confirmed sections
    const [applied, setApplied] = useState({});     // Botsson-applied fields
    const [overrides, setOverrides] = useState({}); // field label → value

    const total = SECTIONS.length;
    const progress = Math.round((Object.keys(done).length / total) * 100);

    const onApply = (a) => {
      setApplied((p) => ({ ...p, [a.field]: a.value }));
      if (a.field === "grade") {
        const g = gradeById(a.value);
        setOverrides((o) => ({ ...o, "Lønnstrinn": `${g.code} · ${g.label}`, "Grunnlønn (minstesats)": `${g.floor} kr/t` }));
      }
      if (a.field === "supp") {
        const s = SD.CT_TARIFF.supplements.find((x) => x.id === a.value);
        if (s) setOverrides((o) => ({ ...o, "Bonus / resultatlønn": (o["Bonus / resultatlønn"] || "") }));
      }
      toast("Botsson-forslag lagt til i malen", { undo: () => setApplied((p) => { const n = { ...p }; delete n[a.field]; return n; }) });
    };

    const markDone = (i) => setDone((d) => ({ ...d, [i]: true }));
    const next = () => { markDone(active); if (active < total - 1) setActive(active + 1); else { markDone(total - 1); setPreview(true); } };
    const prev = () => active > 0 && setActive(active - 1);

    const sec = SECTIONS[active];

    return (
      <div className="ct-take" role="dialog" aria-label="Malbygger">
        <div className="ct-take-top">
          <button className="ct-back" onClick={onClose}><Ic n="chevLeft" s={16} /> Maler</button>
          <span className="ct-take-ttl">{isNew ? "Ny kontraktsmal" : base.name} <span className="badge">Malbygger</span></span>
          <span className="gr" />
          <button className={`ct-btn sm ${preview ? "dark" : ""}`} onClick={() => setPreview((p) => !p)}><Ic n="eye" s={14} /> {preview ? "Rediger" : "Forhåndsvis"}</button>
          <button className="ct-btn sm" onClick={() => toast("Mal lagret som utkast", { undo: () => {} })}><Ic n="file" s={14} /> Lagre</button>
          <button className="ct-btn sm primary" onClick={() => { toast("Mal publisert og klar for bruk", { undo: () => {} }); onClose(); }}><Ic n="check" s={14} sw={2.2} /> Publiser</button>
        </div>

        <div className={`ct-take-body`}>
          <div className="ct-bd" style={{ flex: 1 }}>
            {/* left nav */}
            <nav className="ct-bd-nav">
              <div className="ct-bd-prog">
                <span className="lbl">Fullstendighet</span>
                <div className="ring-row">
                  <span className="ct-bd-ring" style={{ "--p": progress }}><span className="pct">{progress}%</span></span>
                  <div className="meta">
                    <div className="t">{Object.keys(done).length} av {total} seksjoner</div>
                    <div className="s">{progress === 100 ? "Klar for publisering" : "Fyll ut for å fullføre"}</div>
                  </div>
                </div>
              </div>
              {SECTIONS.map((s, i) => {
                const hasLegal = s.fields.some((f) => f.k === "legal");
                const dot = done[i] ? "done" : hasLegal ? "legal" : "todo";
                return (
                  <button key={s.id} className={`ct-navitem ${active === i && !preview ? "on" : ""}`} onClick={() => { setPreview(false); setActive(i); }}>
                    <span className="nic" style={active === i && !preview ? { background: s.accent } : {}}><Ic n={s.icon} s={14} /></span>
                    <span className="nb"><span className="nt">{s.title}</span></span>
                    <span className={`ndot ${dot}`} />
                  </button>
                );
              })}
            </nav>

            {/* center canvas */}
            <div className="ct-bd-main">
              <div className="ct-bd-sheet">
                {preview ? (
                  <PreviewAll overrides={overrides} applied={applied} />
                ) : (
                  <div className="ct-bd-sec" key={sec.id}>
                    <div className="ct-bd-sec-head">
                      <span className="ct-bd-sec-ic" style={{ background: sec.accent }}><Ic n={sec.icon} s={21} /></span>
                      <div className="ct-bd-sec-h">
                        <div className="ct-bd-sec-eyebrow">Seksjon {active + 1} / {total}</div>
                        <h2 className="ct-bd-sec-t">{sec.title}</h2>
                        <p className="ct-bd-sec-d">{sec.desc}</p>
                      </div>
                    </div>
                    {sec.fields.map((f, k) => {
                      const val = overrides[f.label] != null ? overrides[f.label] : f.val;
                      const askable = (sec.id === "pay" && /trinn|grunnl/i.test(f.label)) || (f.k === "legal");
                      return (
                        <div key={k} className="ct-fld">
                          <div className="ct-fld-l">
                            <div className="ct-fld-top">
                              <span className="ct-fld-lbl">{f.label}</span>
                              <span className="ct-flag" data-k={f.k}>{FLAG_LABEL[f.k]}</span>
                            </div>
                            <div className="ct-fld-val">
                              {f.k === "legal" ? (
                                <div className="ct-fld-val locked"><Ic n="lock" s={13} className="lk" /> {val}</div>
                              ) : f.k === "auto" ? (
                                <div className="ct-fld-val auto"><Ic n="sparkle" s={13} /> {val}</div>
                              ) : f.collect ? (
                                <div className="ct-fld-val collect"><Ic n="clock" s={13} /> {val}</div>
                              ) : (
                                <input defaultValue={val} key={val} />
                              )}
                            </div>
                            {f.k === "auto" && <div className="ct-fld-hint">Fylles automatisk fra profil/tariff når malen brukes.</div>}
                            {f.collect && <div className="ct-fld-hint">Samles inn fra ansatt ved første innlogging hvis den mangler.</div>}
                          </div>
                          {askable && (
                            <button className="ct-fld-ask" onClick={() => toast("Spør Botsson i panelet til høyre →")}><Ic n="bot" s={13} /> Spør Botsson</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* right advisor */}
            <window.Ct.Advisor onApply={onApply} applied={applied} />
          </div>
        </div>

        {/* footer */}
        <div className="ct-foot">
          <button className="ct-btn ghost" onClick={prev} disabled={active === 0 || preview}><Ic n="chevLeft" s={15} /> Forrige</button>
          <span className="gr" />
          <span className="step-of">{preview ? "Forhåndsvisning" : `Seksjon ${active + 1} av ${total}`}</span>
          <span className="gr" />
          {preview
            ? <button className="ct-btn primary" onClick={() => { toast("Mal publisert og klar for bruk"); onClose(); }}><Ic n="check" s={15} sw={2.2} c="#fff" /> Publiser mal</button>
            : <button className="ct-btn primary" onClick={next}>{active === total - 1 ? "Forhåndsvis" : "Neste"} <Ic n="arrowRight" s={15} c="#fff" /></button>}
        </div>
      </div>
    );
  }

  // read-only preview of all sections
  function PreviewAll({ overrides, applied }) {
    return (
      <div>
        <div className="ct-bd-sec-head" style={{ marginBottom: 22 }}>
          <span className="ct-bd-sec-ic" style={{ background: "var(--orange)" }}><Ic n="eye" s={21} /></span>
          <div className="ct-bd-sec-h">
            <div className="ct-bd-sec-eyebrow">Forhåndsvisning</div>
            <h2 className="ct-bd-sec-t">Slik blir malen</h2>
            <p className="ct-bd-sec-d">Auto- og innsamlingsfelter fylles når malen brukes på en ansatt. Lovpålagt innhold er låst.</p>
          </div>
        </div>
        {SECTIONS.map((s) => (
          <div key={s.id} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: s.accent, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic n={s.icon} s={14} /></span>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>{s.title}</span>
            </div>
            {s.fields.map((f, k) => (
              <div key={k} className="ct-doc-r">
                <span className="k">{f.label}</span>
                <span className="v">{overrides[f.label] != null ? overrides[f.label] : f.val}
                  <span className="ct-flag" data-k={f.k} style={{ marginLeft: 2 }}>{FLAG_LABEL[f.k]}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  window.CtBuilder = CtBuilder;
})();
