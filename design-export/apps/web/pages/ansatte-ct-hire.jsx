// ===== Kontrakter — Hire / Invite wizard (parameter automation → handoff) =====
(function () {
  const { useState } = React;
  const C = window.Ct;
  const { Ic, SD, A, tplById, groupById, gradeById, fmtKr } = C;
  const { Av, emp, empName, dept } = A;
  const PROV = SD.CT_PROVIDER;
  const EMP = SD.EMPLOYEES;
  const PUB = SD.CT_TEMPLATES.filter((t) => t.status === "published");

  const STEPS = ["Ansatt", "Velg mal", "Bekreft & generer", "Send"];

  function CtHire({ onClose, onOnboard, toast }) {
    const [step, setStep] = useState(0);
    const [type, setType] = useState("new");
    const [name, setName] = useState("Pontus Lindroth");
    const [email, setEmail] = useState("pontus@epost.no");
    const [empId, setEmpId] = useState("");
    const [tplId, setTplId] = useState("ct-kjokken-fast");
    const [grade, setGrade] = useState("g-fag");
    const [start, setStart] = useState("10.06.2026");
    const [manager, setManager] = useState("jh");
    const [preview, setPreview] = useState(false);
    const [sent, setSent] = useState(false);

    const tpl = tplById(tplId);
    const grp = groupById(tpl.group);
    const g = gradeById(grade);
    const e = type === "existing" && empId ? emp(empId) : null;
    const who = e ? e.display : name;

    // synthetic generated draft for preview/handoff
    const draft = {
      id: "k-draft", name: who, role: tpl.role || "Kokk", dept: grp.dept === "admin" ? "sal" : grp.dept,
      form: tpl.form || "Fast", pct: tpl.form === "Tilkalling" ? null : 100, grade, hourly: g.floor,
      start: start.replace(/\./g, ". ").replace(/(\d)\s/, "$1"), template: tplId, manager,
      status: "draft", completion: type === "new" ? 72 : 100, isNew: type === "new",
      missing: type === "new" ? ["m-fnr", "m-konto", "m-paror"] : [],
      note: "Auto-generert fra mal.",
    };
    const reqMissing = draft.missing.filter((m) => SD.CT_MISSING[m] && SD.CT_MISSING[m].required);

    const next = () => step < STEPS.length - 1 && setStep(step + 1);
    const back = () => step > 0 && setStep(step - 1);
    const canNext = step === 0 ? (type === "new" ? name.trim() : empId) : true;

    if (sent) {
      return (
        <div className="ct-take" role="dialog">
          <div className="ct-take-top"><button className="ct-back" onClick={onClose}><Ic n="chevLeft" s={16} /> Kontrakter</button><span className="ct-take-ttl">Sendt til signering</span></div>
          <div className="ct-splash">
            <span className="ct-splash-ring"><Ic n="send" s={40} /></span>
            <h1 className="ct-splash-title">Invitasjon sendt til {who}</h1>
            <p className="ct-splash-sub">Avtalen er auto-generert fra «{tpl.name}» og sendt til {PROV.name} for signering med {PROV.method}.{reqMissing.length || draft.missing.length ? " De manglende opplysningene samles inn når " + (who.split(" ")[0]) + " logger inn første gang." : ""}</p>
            <div className="ct-handoff-flow">
              <div className="ct-flow-node smart"><span className="b"><Ic n="checkdoc" s={22} /></span><span className="l">Smartout</span></div>
              <span className="ct-flow-arrow"><span className="dots"><span /><span /><span /></span></span>
              <div className="ct-flow-node ext"><span className="b"><Ic n="pen" s={20} /></span><span className="l">{PROV.short}</span></div>
            </div>
            <div className="ct-splash-acts">
              <button className="ct-btn" onClick={() => onOnboard && onOnboard()}><Ic n="user" s={15} /> Se ansatt-opplevelsen</button>
              <button className="ct-btn primary" onClick={onClose}><Ic n="check" s={15} c="#fff" sw={2.2} /> Ferdig</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="ct-take" role="dialog" aria-label="Ansett og inviter">
        <div className="ct-take-top">
          <button className="ct-back" onClick={onClose}><Ic n="chevLeft" s={16} /> Kontrakter</button>
          <span className="ct-take-ttl">Ansett & inviter <span className="badge">Auto-generert</span></span>
          <span className="gr" />
        </div>

        {/* stepper */}
        <div className="ct-wz-steps">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className={`ct-wz-sep ${i <= step ? "done" : ""}`} />}
              <button className={`ct-wz-step ${step === i ? "on" : ""} ${step > i ? "done" : ""}`} onClick={() => i < step && setStep(i)}>
                <span className="num">{step > i ? <Ic n="check" s={13} sw={2.5} /> : i + 1}</span><span className="lb">{s}</span>
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="ct-wz-body">
          <div className="ct-wz-wrap">
            {/* STEP 0 — employee */}
            {step === 0 && (
              <React.Fragment>
                <div className="ct-wz-h"><div className="ct-wz-eyebrow">Steg 1</div><h1 className="ct-wz-title">Hvem ansetter du?</h1><p className="ct-wz-sub">Start en ny ansettelse eller lag en avtale for en eksisterende ansatt. Du trenger bare det aller mest nødvendige — resten samler vi inn underveis.</p></div>
                <div className="ct-params" style={{ marginTop: 22 }}>
                  <button className={`ct-tplcard ${type === "new" ? "on" : ""}`} onClick={() => setType("new")}>
                    <div className="ct-tplcard-top"><span className="ct-tplcard-ic" style={{ background: "var(--info)" }}><Ic n="user" s={18} /></span><div><div className="ct-tplcard-nm">Ny ansatt</div><div className="ct-tplcard-meta">Starter onboarding</div></div></div>
                    <p className="ct-tplcard-desc">Inviter en ny person. Smartout oppretter profilen og samler inn manglende info ved første innlogging.</p>
                    {type === "new" && <span className="check"><Ic n="check" s={13} sw={2.5} /></span>}
                  </button>
                  <button className={`ct-tplcard ${type === "existing" ? "on" : ""}`} onClick={() => setType("existing")}>
                    <div className="ct-tplcard-top"><span className="ct-tplcard-ic" style={{ background: "var(--dept-sal)" }}><Ic n="users" s={18} /></span><div><div className="ct-tplcard-nm">Eksisterende ansatt</div><div className="ct-tplcard-meta">Ny / endret avtale</div></div></div>
                    <p className="ct-tplcard-desc">Lag en ny avtale, et tillegg eller en reforhandling for noen som allerede er ansatt.</p>
                    {type === "existing" && <span className="check"><Ic n="check" s={13} sw={2.5} /></span>}
                  </button>
                </div>
                <div className="ct-wz-sec">
                  {type === "new" ? (
                    <div className="ct-params">
                      <div className="ct-param"><div className="ct-param-k">Fullt navn</div><input value={name} onChange={(ev) => setName(ev.target.value)} /></div>
                      <div className="ct-param"><div className="ct-param-k">E-post (for invitasjon)</div><input value={email} onChange={(ev) => setEmail(ev.target.value)} /></div>
                    </div>
                  ) : (
                    <div className="ct-param" style={{ maxWidth: 380 }}><div className="ct-param-k">Velg ansatt</div>
                      <select value={empId} onChange={(ev) => setEmpId(ev.target.value)}><option value="">Velg …</option>{EMP.map((x) => <option key={x.id} value={x.id}>{x.display} · {x.stilling}</option>)}</select>
                    </div>
                  )}
                </div>
              </React.Fragment>
            )}

            {/* STEP 1 — template */}
            {step === 1 && (
              <React.Fragment>
                <div className="ct-wz-h"><div className="ct-wz-eyebrow">Steg 2</div><h1 className="ct-wz-title">Velg kontraktsmal</h1><p className="ct-wz-sub">Malen bestemmer struktur, tariff-binding og standardverdier. Botsson foreslår en mal basert på {type === "new" ? name.split(" ")[0] : (e ? e.display.split(" ")[0] : "ansatt")}s rolle.</p></div>
                <div className="ct-advise" style={{ marginTop: 18 }}>
                  <span className="ct-advise-av"><Ic n="bot" s={18} /></span>
                  <div className="ct-advise-b"><div className="ct-advise-id">Botsson <span className="tag">Forslag</span></div><p className="ct-advise-txt" style={{ margin: "6px 0 0" }}>Basert på rollen anbefaler jeg <strong>«Kjøkken · Fast ansettelse»</strong> — den er 100 % komplett og bundet til Riksavtalen fagbrev-trinn.</p></div>
                </div>
                <div className="ct-tplgrid" style={{ marginTop: 16 }}>
                  {PUB.map((t) => {
                    const tg = groupById(t.group);
                    return (
                      <button key={t.id} className={`ct-tplcard ${tplId === t.id ? "on" : ""}`} onClick={() => setTplId(t.id)}>
                        <div className="ct-tplcard-top"><span className="ct-tplcard-ic" style={{ background: `var(--dept-${tg.dept === "admin" ? "event" : tg.dept}, var(--orange))` }}><Ic n={tg.icon} s={18} /></span><div style={{ minWidth: 0 }}><div className="ct-tplcard-nm">{t.name}</div><div className="ct-tplcard-meta">v{t.version} · {t.uses} i bruk</div></div></div>
                        <p className="ct-tplcard-desc">{t.desc}</p>
                        <div className="ct-tplcard-foot"><span className="ct-completebar"><span style={{ width: t.completeness + "%" }} /></span><span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--success)" }}>{t.completeness}%</span></div>
                        {tplId === t.id && <span className="check"><Ic n="check" s={13} sw={2.5} /></span>}
                      </button>
                    );
                  })}
                </div>
              </React.Fragment>
            )}

            {/* STEP 2 — params + generate + missing */}
            {step === 2 && (
              <React.Fragment>
                <div className="ct-wz-h"><div className="ct-wz-eyebrow">Steg 3</div><h1 className="ct-wz-title">Bekreft parametrene</h1><p className="ct-wz-sub">Smartout har fylt ut avtalen fra malen og det vi vet. Bekreft det viktigste — resten er allerede på plass.</p></div>
                <div className="ct-params">
                  <div className="ct-param"><div className="ct-param-k">Ansattgruppe <span className="auto">auto</span></div><div className="static"><Ic n={grp.icon} s={15} c="var(--muted)" /> {grp.label}</div></div>
                  <div className="ct-param"><div className="ct-param-k">Rolle <span className="auto">auto</span></div><div className="static">{tpl.role}</div></div>
                  <div className="ct-param"><div className="ct-param-k">Arbeidssted <span className="auto">auto</span></div><div className="static"><Ic n="building" s={14} c="var(--muted)" /> Bistro Nord, Oslo</div></div>
                  <div className="ct-param"><div className="ct-param-k">Ansettelsesform <span className="auto">auto</span></div><div className="static">{tpl.form}</div></div>
                  <div className="ct-param"><div className="ct-param-k">Startdato</div><input value={start} onChange={(ev) => setStart(ev.target.value)} /></div>
                  <div className="ct-param"><div className="ct-param-k">Nærmeste leder</div><select value={manager} onChange={(ev) => setManager(ev.target.value)}>{EMP.filter((x) => x.access === "leder" || x.access === "admin" || x.access === "eier" || ["ma", "jh", "es"].includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.display}</option>)}</select></div>
                  <div className="ct-param"><div className="ct-param-k">Lønnstrinn (tariff)</div>
                    <select value={grade} onChange={(ev) => setGrade(ev.target.value)}>{SD.CT_TARIFF.grades.map((gr) => <option key={gr.id} value={gr.id}>{gr.code} · {gr.label} ({gr.floor} kr/t)</option>)}</select>
                    <div className="ct-param-note"><Ic n="bot" s={13} className="ic" /> Botsson anbefaler {gradeById("g-fag").code} · Fagarbeider (fagbrev). Endrer du, logges det.</div>
                  </div>
                  <div className="ct-param"><div className="ct-param-k">Tariffavtale <span className="auto">auto</span></div><div className="static"><Ic n="scale" s={14} c="var(--muted)" /> {SD.CT_TARIFF.name}</div></div>
                </div>

                {/* generated note */}
                <div className="ct-advise" style={{ marginTop: 18 }}>
                  <span className="ct-advise-av"><Ic n="sparkle" s={18} /></span>
                  <div className="ct-advise-b"><div className="ct-advise-id">Smartout <span className="tag">Generert</span></div><p className="ct-advise-txt" style={{ margin: "6px 0 11px" }}>Avtaleutkastet er klart — <strong>{draft.completion}% komplett</strong>. Alle lovpålagte vilkår, tillegg og opplæringsplan er fylt inn automatisk fra malen.</p><div className="ct-advise-acts"><button className="ct-btn sm" onClick={() => setPreview(true)}><Ic n="eye" s={14} /> Se kontrakten</button></div></div>
                </div>

                {/* missing info */}
                {draft.missing.length > 0 && (
                  <div className="ct-miss" style={{ marginTop: 16 }}>
                    <div className="ct-miss-head"><span className="ic"><Ic n="alert" s={18} /></span><div className="b"><div className="t">Manglende opplysninger</div><div className="s">Trenger ikke stoppe prosessen</div></div><span className="cnt">{draft.missing.length}</span></div>
                    {draft.missing.map((mid) => { const m = SD.CT_MISSING[mid]; return (
                      <div key={mid} className="ct-miss-row">
                        <span className={`ct-miss-ic ${m.required ? "req" : ""}`}><Ic n={m.required ? "alert" : "clock"} s={14} /></span>
                        <div className="ct-miss-b"><div className="t">{m.label}</div><div className="s">{m.why}</div></div>
                        <div className="ct-miss-who">{m.who}</div>
                        <div className="ct-miss-tags"><span className={`ct-tag-sm ${m.required ? "req" : "opt"}`}>{m.required ? "Påkrevd før signering" : "Ikke påkrevd"}</span>{m.collect && <span className="ct-tag-sm collect">Samles ved onboarding</span>}</div>
                      </div>
                    ); })}
                  </div>
                )}
              </React.Fragment>
            )}

            {/* STEP 3 — handoff */}
            {step === 3 && (
              <div className="ct-handoff">
                <span className="ct-handoff-ic"><Ic n="send" s={32} /></span>
                <h1 className="ct-handoff-title">Klar for signering</h1>
                <p className="ct-handoff-sub">Avtalen sendes til en ekstern signeringsleverandør. Smartout holder oversikt før og etter — selve signeringen skjer der, med {PROV.method}.</p>
                <div className="ct-handoff-flow">
                  <div className="ct-flow-node smart"><span className="b"><Ic n="checkdoc" s={22} /></span><span className="l">Smartout</span></div>
                  <span className="ct-flow-arrow"><span className="dots"><span /><span /><span /></span></span>
                  <div className="ct-flow-node ext"><span className="b"><Ic n="pen" s={20} /></span><span className="l">{PROV.short}</span></div>
                </div>
                <div className="ct-handoff-card">
                  <div className="ct-handoff-row"><span className="k">Avtale</span><span className="v">{tpl.name}</span></div>
                  <div className="ct-handoff-row"><span className="k">Parter</span><span className="v">{who} · Bistro Nord (v/ {empName(manager)})</span></div>
                  <div className="ct-handoff-row"><span className="k">Leverandør</span><span className="v">{PROV.short} · {PROV.method}</span></div>
                  <div className="ct-handoff-row"><span className="k">Fullstendighet</span><span className="v"><span className="ct-completebar" style={{ maxWidth: 90 }}><span className={draft.completion < 100 ? "warn" : ""} style={{ width: draft.completion + "%" }} /></span> {draft.completion}%</span></div>
                  {draft.missing.length > 0 && <div className="ct-handoff-row"><span className="k">Mangler</span><span className="v"><span className="ct-missing-tag"><Ic n="clock" s={12} /> {draft.missing.length} samles ved onboarding</span></span></div>}
                </div>
                <div className="ct-boundary"><Ic n="shield" s={13} className="ic" /> Smartout sender aldri en avtale uten din bekreftelse, og du kan trekke den tilbake når som helst.</div>
                <div className="ct-splash-acts" style={{ marginTop: 18 }}>
                  <button className="ct-btn" onClick={() => setPreview(true)}><Ic n="eye" s={15} /> Se kontrakten</button>
                  <button className="ct-btn primary" onClick={() => setSent(true)}><Ic n="send" s={15} c="#fff" /> Send & inviter</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        {step < 3 && (
          <div className="ct-foot">
            <button className="ct-btn ghost" onClick={step === 0 ? onClose : back}>{step === 0 ? "Avbryt" : <React.Fragment><Ic n="chevLeft" s={15} /> Tilbake</React.Fragment>}</button>
            <span className="gr" />
            <span className="step-of">Steg {step + 1} av {STEPS.length}</span>
            <span className="gr" />
            <button className="ct-btn primary" onClick={next} disabled={!canNext}>{step === 2 ? "Til sending" : "Neste"} <Ic n="arrowRight" s={15} c="#fff" /></button>
          </div>
        )}

        {preview && <window.CtDoc contract={draft} onClose={() => setPreview(false)} onSend={() => { setPreview(false); setSent(true); }} toast={toast} />}
      </div>
    );
  }

  window.CtHire = CtHire;
})();
