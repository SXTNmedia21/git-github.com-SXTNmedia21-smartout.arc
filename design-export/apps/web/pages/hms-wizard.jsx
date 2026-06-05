// ===== HMS — Protocol creation Control Center (guided handbook→chapter→protocol) =====
// A protocol can NEVER be created without a parent handbook + chapter. If none
// exists the user creates them inline first. Exposes window.HmsProtocolWizard.
(function () {
  const { useState } = React;
  const H = window.Hms;
  const { Ic, SD, cat } = H;

  const STEPS = ["Håndbok", "Kapittel", "Protokoll", "Policy", "Bekreft"];
  const ROLES = ["Daglig leder", "Driftsleder", "HMS-ansvarlig", "Sous-chef", "Renholder", "Verneombud", "Brannvernleder"];

  function HmsProtocolWizard({ open, onClose, onCreated, toast, presetCat }) {
    const [step, setStep] = useState(0);
    const [hbMode, setHbMode] = useState("existing");
    const [hbId, setHbId] = useState("hms");
    const [hbNew, setHbNew] = useState("");
    const [chMode, setChMode] = useState("existing");
    const [chId, setChId] = useState(null);
    const [chNew, setChNew] = useState("");
    const [title, setTitle] = useState("");
    const [catId, setCatId] = useState(presetCat || "sikkerhet");
    const [importance, setImportance] = useState("hoy");
    const [ownerRole, setOwnerRole] = useState("HMS-ansvarlig");
    const [policies, setPolicies] = useState(["", ""]);
    const [legalSel, setLegalSel] = useState({});
    const [procSel, setProcSel] = useState({});

    if (!open) return null;
    const HANDBOOKS = SD.HANDBOOKS || [];
    const hb = hbMode === "new" ? { id: "ny", name: hbNew || "Ny håndbok", chapters: [] } : (HANDBOOKS.find((h) => h.id === hbId) || HANDBOOKS[0]);
    const chapters = (hb && hb.chapters) || [];
    const chapter = chMode === "new" ? { id: "ny", title: chNew || "Nytt kapittel" } : chapters.find((c) => c.id === chId);
    const hbName = hbMode === "new" ? (hbNew || "Ny håndbok") : hb.name;
    const chTitle = chMode === "new" ? (chNew || "Nytt kapittel") : (chapter ? chapter.title : "");
    const cleanPolicies = policies.map((p) => p.trim()).filter(Boolean);

    const canNext = () => {
      if (step === 0) return hbMode === "new" ? hbNew.trim().length > 1 : !!hb;
      if (step === 1) return chMode === "new" ? chNew.trim().length > 1 : !!chId;
      if (step === 2) return title.trim().length > 2;
      return true;
    };

    const create = () => {
      const id = "np-" + Date.now();
      const code = "HMS-" + (catId === "helse" ? "H" : catId === "miljo" ? "M" : "S") + "-NY";
      const np = {
        id, cat: catId, code, title: title.trim(), importance, owner: "ma", ownerRole,
        handbook: { book: hbMode === "new" ? "ny" : hb.id, chapterId: chMode === "new" ? "ny-" + Date.now() : chapter.id, chapterTitle: chTitle, path: hbName + " › " + chTitle },
        roles: [], locations: [], status: "warn", compliance: 0, trend: [0, 0, 0],
        checklist: { done: 0, total: Math.max(1, cleanPolicies.length) }, openTasks: 0, overdue: 0, missingTraining: 0, incidents: 0, comments: 0,
        nextReview: "Ikke satt", lastTask: { title: "Ingen kjøringer ennå", by: "—", at: "—" },
        routines: [], trainings: [], quizzes: [], manuals: [], evidence: [],
        policies: cleanPolicies.length ? cleanPolicies : ["Protokollen er bindende for alle berørte roller."],
        legalIds: Object.keys(legalSel).filter((k) => legalSel[k]), processIds: Object.keys(procSel).filter((k) => procSel[k]),
        procIds: [], trainingIds: [], quizIds: [], manualIds: [],
      };
      SD.HMS_PROTOCOLS.push(np);
      SD.HMS_PROTO_BY_ID[id] = np;
      toast && toast(`Protokoll opprettet under ${hbName} › ${chTitle}`);
      onCreated && onCreated(id);
      onClose();
    };

    const setPolicy = (i, v) => setPolicies((ps) => ps.map((p, j) => (j === i ? v : p)));

    return (
      <div className="hms-wz-scrim" onMouseDown={onClose}>
        <div className="hms-wz" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Ny protokoll">
          <div className="hms-wz-head">
            <span className="ic"><Ic n="shield" s={20} /></span>
            <div className="h">
              <div className="t">Ny HMS-protokoll</div>
              <div className="s">En protokoll må tilhøre en håndbok og et kapittel. Mangler de, oppretter du dem her først.</div>
            </div>
            <button className="icon-btn icon-btn-sm" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          {/* stepper */}
          <div className="hms-wz-steps">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <span className={`hms-wz-stepline ${i <= step ? "done" : ""}`} />}
                <span className={`hms-wz-step ${step === i ? "on" : step > i ? "done" : ""}`}>
                  <span className="n">{step > i ? <Ic n="check" s={12} sw={2.8} /> : i + 1}</span>{s}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div className="hms-wz-body">
            {/* STEP 1 — handbook */}
            {step === 0 && (
              <>
                <div className="hms-wz-h">Steg 1 · Velg håndbok</div>
                <p className="hms-wz-lead">Protokollen forankres i en håndbok i Bibliotek. Velg en eksisterende, eller opprett en ny.</p>
                {HANDBOOKS.map((h) => (
                  <button key={h.id} className={`hms-opt ${hbMode === "existing" && hbId === h.id ? "on" : ""}`} onClick={() => { setHbMode("existing"); setHbId(h.id); setChId(null); setChMode("existing"); }}>
                    <span className="hms-opt-ic" style={{ color: h.accent }}><Ic n={h.icon || "book"} s={18} /></span>
                    <span className="hms-opt-b"><span className="t">{h.name}</span><span className="s">{(h.chapters || []).length} kapitler · {h.tagline || ""}</span></span>
                    <span className="chk">{hbMode === "existing" && hbId === h.id && <Ic n="check" s={12} sw={2.6} />}</span>
                  </button>
                ))}
                <button className={`hms-opt hms-opt-new ${hbMode === "new" ? "on" : ""}`} onClick={() => setHbMode("new")}>
                  <span className="hms-opt-ic"><Ic n="plus" s={18} /></span>
                  <span className="hms-opt-b"><span className="t">Opprett ny håndbok</span><span className="s">Lag en ny håndbok i Bibliotek</span></span>
                  <span className="chk">{hbMode === "new" && <Ic n="check" s={12} sw={2.6} />}</span>
                </button>
                {hbMode === "new" && <div className="hms-frow" style={{ marginTop: 12 }}><label className="hms-flabel">Navn på ny håndbok</label><input className="hms-input" value={hbNew} onChange={(e) => setHbNew(e.target.value)} placeholder="f.eks. Beredskapshåndbok" autoFocus /></div>}
              </>
            )}

            {/* STEP 2 — chapter */}
            {step === 1 && (
              <>
                <div className="hms-wz-h">Steg 2 · Velg kapittel i «{hbName}»</div>
                <p className="hms-wz-lead">Hvert kapittel samler beslektede protokoller. Velg et eksisterende kapittel eller opprett et nytt.</p>
                {chapters.map((c) => (
                  <button key={c.id} className={`hms-opt ${chMode === "existing" && chId === c.id ? "on" : ""}`} onClick={() => { setChMode("existing"); setChId(c.id); }}>
                    <span className="hms-opt-ic"><Ic n="folder" s={18} /></span>
                    <span className="hms-opt-b"><span className="t">{c.title}</span><span className="s">{(c.docs || []).length} dokumenter</span></span>
                    <span className="chk">{chMode === "existing" && chId === c.id && <Ic n="check" s={12} sw={2.6} />}</span>
                  </button>
                ))}
                {chapters.length === 0 && hbMode !== "new" && <div className="hms-wz-lead" style={{ fontStyle: "italic" }}>Denne håndboken har ingen kapitler ennå.</div>}
                <button className={`hms-opt hms-opt-new ${chMode === "new" ? "on" : ""}`} onClick={() => setChMode("new")}>
                  <span className="hms-opt-ic"><Ic n="plus" s={18} /></span>
                  <span className="hms-opt-b"><span className="t">Opprett nytt kapittel</span><span className="s">Lag et nytt kapittel i «{hbName}»</span></span>
                  <span className="chk">{chMode === "new" && <Ic n="check" s={12} sw={2.6} />}</span>
                </button>
                {chMode === "new" && <div className="hms-frow" style={{ marginTop: 12 }}><label className="hms-flabel">Navn på nytt kapittel</label><input className="hms-input" value={chNew} onChange={(e) => setChNew(e.target.value)} placeholder="f.eks. Smittevern" autoFocus /></div>}
              </>
            )}

            {/* STEP 3 — protocol details */}
            {step === 2 && (
              <>
                <div className="hms-wz-h">Steg 3 · Protokolldetaljer</div>
                <p className="hms-wz-lead">Plasseres under <strong>{hbName} › {chTitle}</strong>.</p>
                <div className="hms-frow"><label className="hms-flabel">Tittel på protokoll</label><input className="hms-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="f.eks. Allergenhåndtering ved servering" autoFocus /></div>
                <div className="hms-frow">
                  <label className="hms-flabel">HMS-område</label>
                  <div className="hms-segpick">
                    {SD.HMS_CAT_ORDER.map((id) => (
                      <button key={id} className={`hms-cat-${id} ${catId === id ? "on" : ""}`} onClick={() => setCatId(id)}><span className="d" style={{ background: "var(--cat)" }} />{cat(id).name}</button>
                    ))}
                  </div>
                </div>
                <div className="hms-fgrid">
                  <div className="hms-frow"><label className="hms-flabel">Viktighet</label>
                    <div className="hms-segpick">
                      {["kritisk", "hoy", "normal"].map((id) => <button key={id} className={importance === id ? "on" : ""} onClick={() => setImportance(id)} style={importance === id ? { color: "var(--fg)", borderColor: "var(--border-strong)", background: "var(--secondary)" } : {}}>{SD.HMS_IMPORTANCE[id].label}</button>)}
                    </div>
                  </div>
                  <div className="hms-frow"><label className="hms-flabel">Ansvarsrolle</label>
                    <select className="hms-input" value={ownerRole} onChange={(e) => setOwnerRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                  </div>
                </div>
              </>
            )}

            {/* STEP 4 — enforceable policies */}
            {step === 3 && (
              <>
                <div className="hms-wz-h">Steg 4 · Policy som håndheves</div>
                <p className="hms-wz-lead">Definer reglene som gjelder hele protokollen. Disse er bindende for alle berørte roller, og vises øverst på protokollen.</p>
                {policies.map((p, i) => (
                  <div key={i} className="hms-pol-row">
                    <input className="hms-input" value={p} onChange={(e) => setPolicy(i, e.target.value)} placeholder={`Policy ${i + 1} — f.eks. «Ingen vakt åpner uten gjennomført kontroll»`} />
                    {policies.length > 1 && <button className="hms-pol-del" onClick={() => setPolicies((ps) => ps.filter((_, j) => j !== i))}><Ic n="trash" s={15} /></button>}
                  </div>
                ))}
                <button className="hms-chipbtn" onClick={() => setPolicies((ps) => [...ps, ""])}><Ic n="plus" s={13} /> Legg til policy</button>

                <div className="hms-wz-h" style={{ marginTop: 22 }}>Rettslig grunnlag (valgfritt)</div>
                <div className="hms-segpick">
                  {Object.values(SD.HMS_LEGAL).map((l) => <button key={l.id} className={legalSel[l.id] ? "on" : ""} onClick={() => setLegalSel((s) => ({ ...s, [l.id]: !s[l.id] }))} style={legalSel[l.id] ? { color: "var(--fg)", borderColor: "var(--border-strong)", background: "var(--secondary)" } : {}}><Ic n="scale" s={12} /> {l.name}</button>)}
                </div>
                <div className="hms-wz-h" style={{ marginTop: 18 }}>Tilknyttede prosesser (valgfritt)</div>
                <div className="hms-segpick">
                  {Object.values(SD.HMS_PROCESSES).map((x) => <button key={x.id} className={procSel[x.id] ? "on" : ""} onClick={() => setProcSel((s) => ({ ...s, [x.id]: !s[x.id] }))} style={procSel[x.id] ? { color: "var(--fg)", borderColor: "var(--border-strong)", background: "var(--secondary)" } : {}}><Ic n="route" s={12} /> {x.name}</button>)}
                </div>
              </>
            )}

            {/* STEP 5 — review */}
            {step === 4 && (
              <>
                <div className="hms-wz-h">Steg 5 · Bekreft og opprett</div>
                <p className="hms-wz-lead">Protokollen opprettes med tydelig forelder. Du kan legge til prosedyrer, rutiner og opplæring etterpå.</p>
                <div className="hms-wz-sum">
                  <div className="hms-wz-sumrow"><span className="k">Plassering</span><span className="v"><span className="hms-typebadge t-orange"><Ic n="book" s={11} /> {hbName}</span> <span style={{ color: "var(--muted-soft)" }}>›</span> <span className="hms-typebadge t-muted"><Ic n="folder" s={11} /> {chTitle}</span>{(hbMode === "new" || chMode === "new") && <span style={{ fontSize: 11, color: "var(--orange-dark)", marginLeft: 6 }}>(opprettes nå)</span>}</span></div>
                  <div className="hms-wz-sumrow"><span className="k">Protokoll</span><span className="v" style={{ fontWeight: 600 }}>{title || "—"}</span></div>
                  <div className="hms-wz-sumrow"><span className="k">Område</span><span className="v"><H.CatChip id={catId} /> <H.ImpBadge id={importance} /></span></div>
                  <div className="hms-wz-sumrow"><span className="k">Ansvar</span><span className="v">{ownerRole}</span></div>
                  <div className="hms-wz-sumrow"><span className="k">Policy</span><span className="v">{cleanPolicies.length ? cleanPolicies.map((p, i) => <div key={i} style={{ marginBottom: 4 }}>• {p}</div>) : <span style={{ color: "var(--muted)" }}>Standard policy brukes</span>}</span></div>
                  {(Object.keys(legalSel).filter((k) => legalSel[k]).length > 0) && <div className="hms-wz-sumrow"><span className="k">Lovverk</span><span className="v">{Object.keys(legalSel).filter((k) => legalSel[k]).map((k) => SD.HMS_LEGAL[k].name).join(", ")}</span></div>}
                </div>
              </>
            )}
          </div>

          <div className="hms-wz-foot">
            {step > 0 && <button className="sk-ghost" onClick={() => setStep((s) => s - 1)}><Ic n="chevLeft" s={15} /> Tilbake</button>}
            <span className="spc" />
            <button className="sk-ghost" onClick={onClose}>Avbryt</button>
            {step < 4
              ? <button className="sk-primary" disabled={!canNext()} style={!canNext() ? { opacity: .5, pointerEvents: "none" } : {}} onClick={() => setStep((s) => s + 1)}>Neste <Ic n="arrowRight" s={15} c="#fff" /></button>
              : <button className="sk-primary" onClick={create}><Ic n="check" s={15} c="#fff" sw={2.3} /> Opprett protokoll</button>}
          </div>
        </div>
      </div>
    );
  }

  window.HmsProtocolWizard = HmsProtocolWizard;
})();
