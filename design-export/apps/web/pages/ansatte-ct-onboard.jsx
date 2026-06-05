// ===== Kontrakter — Employee first-login onboarding (mobile-first, responsive) =====
(function () {
  const { useState, useEffect } = React;
  const C = window.Ct;
  const { Ic, SD } = C;
  const O = SD.CT_ONBOARD;

  function CtOnboard({ onClose, toast }) {
    const [i, setI] = useState(0);
    const steps = O.steps;
    const step = steps[i];
    const isLast = i === steps.length - 1;
    useEffect(() => { const h = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
    useEffect(() => { const el = document.querySelector(".ct-onb-scroll"); if (el) el.scrollTop = 0; }, [i]);

    const next = () => { if (isLast) { toast("Sendt til BankID-signering"); onClose(); } else setI(i + 1); };
    const back = () => i > 0 && setI(i - 1);

    return (
      <div className="ct-onb" role="dialog" aria-label="Onboarding">
        <div className="ct-onb-top">
          <div className="ct-onb-brand"><span className="mark"><Ic n="checkdoc" s={16} /></span><span className="nm">Bistro Nord</span></div>
          <span className="gr" />
          <button className="ct-onb-exit" onClick={onClose}>Lukk forhåndsvisning</button>
        </div>
        <div className="ct-onb-prog">
          {steps.map((s, k) => <span key={s.id} className={`seg ${k < i ? "done" : k === i ? "curr" : ""}`}><span /></span>)}
        </div>

        <div className="ct-onb-scroll">
          <div className="ct-onb-card" key={step.id}>
            {step.kind !== "done" && step.kind !== "intro" && <div className="ct-onb-step-n">Steg {i} av {steps.length - 2}</div>}
            <span className={`ct-onb-icbig ${step.privacy ? "privacy" : ""}`} style={step.kind === "intro" ? { background: "var(--orange-soft)", color: "var(--orange-dark)" } : {}}><Ic n={step.icon} s={28} /></span>
            <h1 className="ct-onb-title">{step.title}</h1>
            <p className="ct-onb-body">{step.body}</p>

            {/* form */}
            {step.kind === "form" && (
              <React.Fragment>
                <div className="ct-onb-fields">
                  {step.fields.map((f, k) => (
                    <div key={k} className="ct-onb-f">
                      <label>{f.label}{f.prefilled && <span className="pre">Forhåndsutfylt</span>}</label>
                      <input className={f.sensitive ? "sensitive" : ""} defaultValue={f.val || ""} placeholder={f.placeholder || ""} />
                      {f.prefilled && <span className="valid"><Ic n="check" s={12} sw={2.4} /> Bekreftet fra invitasjonen</span>}
                    </div>
                  ))}
                </div>
                {step.privacy && <div className="ct-onb-privacy"><Ic n="lock" s={15} className="ic" /> Personnummeret ditt lagres kryptert og deles kun med Skatteetaten for lønn og skatt. Smartout viser det aldri åpent.</div>}
              </React.Fragment>
            )}

            {/* confirm */}
            {step.kind === "confirm" && (
              <div className="ct-onb-confirm">
                {step.rows.map((r, k) => <div key={k} className="ct-onb-crow"><span className="k">{r.k}</span><span className="v">{r.v}</span></div>)}
              </div>
            )}

            {/* training */}
            {step.kind === "training" && (
              <div className="ct-onb-train">
                {step.items.map((it, k) => (
                  <div key={k} className="ct-onb-trow">
                    <span className="ic"><Ic n="cap" s={18} /></span>
                    <div className="b"><div className="t">{it.t}</div><div className="s">{it.s}</div></div>
                    {it.req && <span className="req">Påkrevd</span>}
                  </div>
                ))}
              </div>
            )}

            {/* terms */}
            {step.kind === "terms" && (
              <div className="ct-onb-confirm">
                {step.rows.map((r, k) => <div key={k} className="ct-onb-crow"><span className="k">{r.k}</span><span className="v">{r.v}</span></div>)}
              </div>
            )}

            {/* done */}
            {step.kind === "done" && (
              <div className="ct-onb-done" style={{ marginTop: 4 }}>
                <span className="ct-onb-done-ring"><Ic n="check" s={42} sw={2.4} /></span>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--muted)" }}><Ic n="shield" s={13} /> Du signerer den fullstendige avtalen med BankID</div>
              </div>
            )}
          </div>
        </div>

        <div className="ct-onb-foot">
          <div className="ct-onb-foot-wrap">
            {i > 0 && step.kind !== "done" && <button className="ct-onb-back" onClick={back}><Ic n="chevLeft" s={20} /></button>}
            <button className="ct-onb-cta" onClick={next}>
              {step.kind === "intro" ? "Kom i gang" : step.kind === "done" ? "Signer med BankID" : isLast ? "Fullfør" : "Fortsett"}
              <Ic n={step.kind === "done" ? "pen" : "arrowRight"} s={18} c="#fff" />
            </button>
            {step.optional && <button className="ct-onb-skip" onClick={next}>Hopp over</button>}
          </div>
        </div>
      </div>
    );
  }

  window.CtOnboard = CtOnboard;
})();
