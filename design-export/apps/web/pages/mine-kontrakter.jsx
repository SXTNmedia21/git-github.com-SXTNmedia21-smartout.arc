// ===== Mine kontrakter — employee's own agreements (private route "mine-kontrakter") =====
// The employee's view of their contracts: a clear terms summary, the list of all
// signed agreements (→ detail drawer with the full sheet + download), and a calm
// way to ask HR. Persona: Jonas H. (Sous-chef). Read-only & trygt.
(function () {
  const { useState, useEffect } = React;
  const Ic = window.Ic;

  // Jonas Haugen — grounded in shared/ansatte-data.js (id "jh") contract
  const C = {
    position: "Sous-chef", form: "Fast", pct: 100, weeklyHours: 37.5, scheme: "Turnus",
    payType: "Fastlønn", monthly: 44500, start: "3. mar 2022", trial: "Fullført", overtime: "Avtalt — inntil 100 t/år",
    notice: "1 måned", employer: "Bistro Nord AS", orgnr: "923 118 442", employeeNo: "BN-0118",
  };
  const kr = (n) => new Intl.NumberFormat("nb-NO").format(n) + " kr";

  const AGREEMENTS = [
    { id: "a1", title: "Arbeidsavtale — fast ansettelse", type: "Arbeidsavtale", icon: "checkdoc", version: "3.1",
      signed: "3. mar 2022", status: "signed", primary: true,
      desc: "Hovedavtalen din som Sous-chef. Følger Riksavtalen og arbeidsmiljøloven §14-6.",
      fields: [
        ["Stilling", C.position], ["Ansettelsesform", `${C.form} · ${C.pct} %`], ["Arbeidstid", `${String(C.weeklyHours).replace(".", ",")} t/uke · ${C.scheme}`],
        ["Lønn", `${kr(C.monthly)}/mnd · ${C.payType}`], ["Tiltredelse", C.start], ["Prøvetid", C.trial],
        ["Overtid", C.overtime], ["Oppsigelsestid", C.notice],
      ] },
    { id: "a2", title: "Tillegg — Lagleder kveld", type: "Tilleggsavtale", icon: "trendUp", version: "1.0",
      signed: "12. apr 2024", status: "signed",
      desc: "Ansvarstillegg for å lede kveldslaget på kjøkkenet, inkl. stedfortrederansvar for kjøkkensjef.",
      fields: [["Tillegg", "Ansvarstillegg lagleder"], ["Gjelder fra", "12. apr 2024"], ["Kompensasjon", "+ 18 kr/t på kveldsvakter"], ["Knyttet til", "Arbeidsavtale 3.1"]] },
    { id: "a3", title: "Bekreftelse — stedfortrederansvar", type: "Rolleavtale", icon: "shield", version: "1.0",
      signed: "12. nov 2023", status: "signed",
      desc: "Bekrefter at du kan tre inn som ansvarlig på kjøkkenet ved kjøkkensjefens fravær.",
      fields: [["Rolle", "Stedfortreder kjøkkensjef"], ["Gjelder fra", "12. nov 2023"], ["Ansvar", "Drift, HACCP, avvik i vakt"]] },
    { id: "a4", title: "Taushetserklæring", type: "Erklæring", icon: "lock", version: "1.2",
      signed: "3. mar 2022", status: "signed",
      desc: "Taushetsplikt om gjester, kolleger og forretningsforhold — også etter at arbeidsforholdet tar slutt.",
      fields: [["Omfang", "Gjester, ansatte, drift"], ["Varighet", "Også etter ansettelse"], ["Signert", "3. mar 2022"]] },
    { id: "a5", title: "Personvernerklæring", type: "Erklæring", icon: "lock", version: "1.3",
      signed: "3. mar 2022", status: "signed",
      desc: "Hvordan Smartout og Bistro Nord behandler personopplysningene dine — innsyn, retting og oppbevaring.",
      fields: [["Behandles", "Profil, vakter, lønn, telemetri"], ["Dine rettigheter", "Innsyn · retting · sletting"], ["Kilde", "Systemmanual · Datapolicy"]] },
  ];

  function Panel({ icon, title, action, children }) {
    return (
      <div className="so-panel">
        <div className="so-panel-head">
          <span className="t"><span className="ico"><Ic n={icon} s={15} /></span>{title}</span>
          {action ? <><span className="spacer" />{action}</> : null}
        </div>
        {children}
      </div>
    );
  }

  function MineKontrakterPage() {
    const toast = window.useToast();
    const [open, setOpen] = useState(null);
    useEffect(() => {
      if (window.SmartoutContext && window.SmartoutContext.set)
        window.SmartoutContext.set({ route: "mine-kontrakter", view: "oversikt", role: "ansatt", subject: "Mine kontrakter" });
      return () => { if (window.SmartoutContext && window.SmartoutContext.set) window.SmartoutContext.set({ route: null }); };
    }, []);
    const ag = open ? AGREEMENTS.find(a => a.id === open) : null;
    const dl = (name) => toast(`Laster ned «${name}» (PDF)`);

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 980 }}>
          <div className="ms-head">
            <div>
              <div className="sk-eyebrow">Min side · Kontrakter</div>
              <h1 className="ms-h1">Mine kontrakter</h1>
              <div className="ms-sub">Alle avtalene dine samlet og signert — med et tydelig sammendrag av vilkårene. Du kan lese, laste ned og spørre HR om du lurer på noe.</div>
            </div>
            <div className="ms-headacts">
              <button className="ms-btn" onClick={() => dl("Alle avtaler")}><Ic n="download" s={15} /> Last ned alle</button>
            </div>
          </div>

          {/* terms summary */}
          <div className="msk-summary">
            <div className="msk-sumcell"><div className="l">Stilling</div><div className="v">{C.position}</div><div className="s">{C.form} · {C.pct} %</div></div>
            <div className="msk-sumcell"><div className="l">Lønn</div><div className="v mono">{kr(C.monthly)}</div><div className="s">{C.payType} · per måned</div></div>
            <div className="msk-sumcell"><div className="l">Arbeidstid</div><div className="v mono">{String(C.weeklyHours).replace(".", ",")} t</div><div className="s">per uke · {C.scheme}</div></div>
            <div className="msk-sumcell"><div className="l">Oppsigelse</div><div className="v">{C.notice}</div><div className="s">ansatt siden {C.start}</div></div>
          </div>

          <div style={{ height: 18 }} />

          <Panel icon="checkdoc" title="Mine avtaler" action={<span className="so-eyebrow-lbl">{AGREEMENTS.length} signert</span>}>
            <div>
              {AGREEMENTS.map(a => (
                <div key={a.id} className="msk-row" onClick={() => setOpen(a.id)}>
                  <span className="msk-row-ic"><Ic n={a.icon} s={19} /></span>
                  <div className="msk-row-b">
                    <div className="msk-row-t">{a.title}</div>
                    <div className="msk-row-m">
                      <span>{a.type}</span><span className="sep" /><span className="mono">v{a.version}</span>
                      <span className="sep" /><span>Signert {a.signed}</span>
                    </div>
                  </div>
                  <span className="ms-pill signed"><Ic n="check" s={11} /> Signert</span>
                  <Ic n="chevRight" s={16} c="var(--muted-soft)" />
                </div>
              ))}
            </div>
          </Panel>

          <div style={{ height: 16 }} />

          {/* ask HR */}
          <div className="so-panel">
            <div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "16px 18px" }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--orange-soft)", color: "var(--orange-dark)" }}><Ic n="bot" s={18} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 650 }}>Lurer du på noe i avtalen din?</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 3 }}>Spør HR direkte i en privat sak — Botsson kan forklare vilkårene dine, men endringer går alltid til en leder for godkjenning.</div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="ms-btn sm primary" onClick={() => { if (window.SmartoutChat) window.SmartoutChat.open(); else toast("Åpner privat sak i #HR og personal"); }}><Ic n="message" s={13} /> Spør HR</button>
                  <button className="ms-btn sm" onClick={() => toast("Forespørsel om endring sendt til leder")}><Ic n="pen" s={13} /> Be om endring</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* contract detail drawer */}
        {ag && (
          <div className="ms-scrim" onClick={() => setOpen(null)}>
            <div className="ms-drawer" onClick={e => e.stopPropagation()}>
              <div className="ms-dhead">
                <div className="ms-dhead-top">
                  <button className="ms-x" onClick={() => setOpen(null)}><Ic n="x" s={18} /></button>
                  <span style={{ flex: 1 }} />
                  <span className="ms-pill signed"><Ic n="check" s={11} /> Signert {ag.signed}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>{ag.type} · v{ag.version}</div>
                <div className="ms-dtitle" style={{ marginTop: 3 }}>{ag.title}</div>
              </div>
              <div className="ms-dbody">
                <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>{ag.desc}</div>

                <div className="msk-doc">
                  <h3>Vilkår</h3>
                  <div className="doc-sub">{C.employer} · org.nr {C.orgnr} · ansattnr {C.employeeNo}</div>
                  <div style={{ marginTop: 12 }}>
                    {ag.fields.map(([k, v], i) => (
                      <div key={i} className="msk-field"><span className="k">{k}</span><span className={`v ${/kr|%|\bt\b/.test(v) ? "mono" : ""}`}>{v}</span></div>
                    ))}
                  </div>
                </div>

                <div className="lo-infonote" style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--orange-soft)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                  <Ic n="bot" s={15} c="var(--orange-dark)" />
                  <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>Dette er din signerte versjon. Botsson kan forklare et hvilket som helst punkt — spør i en privat HR-sak. Endringer krever ny signering.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 9, padding: "14px 22px calc(14px + env(safe-area-inset-bottom,0px))", borderTop: "1px solid var(--border)" }}>
                <button className="ms-btn primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => dl(ag.title)}><Ic n="download" s={15} /> Last ned PDF</button>
                <button className="ms-btn" onClick={() => { if (window.SmartoutChat) window.SmartoutChat.open(); else toast("Åpner privat HR-sak"); }}><Ic n="message" s={15} /> Spør HR</button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { "mine-kontrakter": MineKontrakterPage });
})();
