// ===== Ansatte — profile v2 (static menu · paged content · summary on right) =====
(function () {
  const { useState } = React;
  const A = window.An;
  const P = window.AnPanels;
  const { Ic, SD, Av, Badge, AccessBadge, AuthorityBadge, ConfirmModal, dept, loc } = A;

  function SummaryRow({ k, children }) {
    return <div className="an-sum-row"><span className="k">{k}</span><span className="v">{children}</span></div>;
  }

  // right-hand static summary card (+ ring/call button)
  function Summary({ e, toast }) {
    const r = A.readiness(e);
    const life = SD.LIFECYCLE[e.lifecycle];
    const d = dept(e.placement.primary);
    const [activate, setActivate] = useState(false);
    const lifeStyle = {
      active: { color: "var(--success)", background: "rgba(17,173,50,.1)" },
      trainee: { color: "var(--info)", background: "rgba(39,132,213,.1)" },
      inactive: { color: "var(--muted)", background: "var(--secondary)" },
      offboarding: { color: "var(--warning)", background: "rgba(193,130,0,.12)" },
    }[e.lifecycle];

    let primary;
    if (e.lifecycle === "trainee") primary = { label: "Aktiver ansatt", ic: "check", cls: "primary", run: () => setActivate(true) };
    else if (e.lifecycle === "offboarding") primary = { label: "Avslutningsløp", ic: "logout", cls: "dark", run: () => toast("Avslutningsløp åpnet") };
    else if (e.lifecycle === "inactive") primary = { label: "Reaktiver", ic: "sunrise", cls: "primary", run: () => toast(`${e.display} reaktivert`, { undo: () => {} }) };
    else primary = { label: "Rediger profil", ic: "pen", cls: "primary", run: () => window.AnCtl.open("profile") };

    const syncLbl = e.sync === "synced" ? "Synkronisert" : e.sync === "pending" ? "Synk venter" : "Synk feilet";
    return (
      <div className="an-sum-card">
        <div className={`an-sum-hero life-${e.lifecycle}`}>
          <Av e={e} size={72} style={{ display: "inline-flex" }} />
          <div className="an-sum-name">{e.display}</div>
          <div className="an-sum-stilling">{e.stilling} · {d.name}</div>
          <div className="an-sum-ids"><span className="mono">{e.employeeNo}</span><span className="sep" /><span className="mono">{e.profileCode}</span></div>
          <div className="an-sum-life" style={lifeStyle}><span className="dot" style={{ background: "currentColor" }} />{life.label}</div>
        </div>
        <div className="an-sum-body">
          <SummaryRow k="Tilgang"><AccessBadge id={e.access} /></SummaryRow>
          <SummaryRow k="Ansvar"><AuthorityBadge id={e.authority} /></SummaryRow>
          <SummaryRow k="Avdeling"><span className="an-deptchip"><span className="d" style={{ background: d.color }} />{d.name}{e.placement.depts.length > 1 && <span className="plus">+{e.placement.depts.length - 1}</span>}</span></SummaryRow>
          <SummaryRow k="Språk">{e.language}</SummaryRow>
          <SummaryRow k="Ansatt">{e.started}</SummaryRow>
          <SummaryRow k="Synk"><span className={`an-sync ${e.sync}`}><span className="d" />{syncLbl}</span></SummaryRow>
        </div>
        <div className="an-sum-readiness">
          <div className="an-sum-rtop">
            <div className="an-bigring" style={{ "--p": r.score, "--rc": r.color }}><span className="pct">{r.score}%</span></div>
            <div className="an-sum-rinfo">
              <div className="t" style={{ color: r.ready ? "var(--success)" : "var(--fg)" }}>{r.ready ? "Klar for vakt" : e.lifecycle === "trainee" ? "Under opplæring" : e.lifecycle === "offboarding" ? "Avslutter" : e.lifecycle === "inactive" ? "Inaktiv" : "Ikke klar"}</div>
              <div className="s">{r.ready ? "Alle krav oppfylt" : `${r.blockers.length} forhold å løse`}</div>
            </div>
          </div>
        </div>
        <div className="an-sum-actions">
          <button className={`an-btn ${primary.cls}`} onClick={primary.run}><Ic n={primary.ic} s={15} sw={primary.ic === "check" ? 2.3 : 1.8} /> {primary.label}</button>
          <div className="an-quick">
            <button className="call" onClick={() => window.AnCtl.open("call")}><span className="qic"><Ic n="phone" s={16} /></span>Ring</button>
            <button className="msg" onClick={() => window.AnCtl.open("message")}><span className="qic"><Ic n="message" s={16} /></span>Melding</button>
            <button className="assign" onClick={() => window.AnCtl.open("assign")}><span className="qic"><Ic n="cap" s={16} /></span>Tildel</button>
          </div>
        </div>

        <ConfirmModal open={activate} onClose={() => setActivate(false)} tone={r.ready ? "ok" : "warn"} ic="check"
          title={r.ready ? `Aktiver ${e.display}?` : `${e.display} er ikke klar`}
          body={r.ready ? "Ansatt settes til aktiv og kan settes opp på selvstendige vakter." : `${r.blockers.length} forhold gjenstår før ansatt er klar for selvstendig vakt.`}
          note={r.ready ? "Aktivering er en bevisst lederhandling og logges. Botsson kan ikke aktivere ansatte automatisk." : "Du kan aktivere likevel som leder, men de gjenstående forholdene logges som overstyrt. Anbefales ikke."}
          confirmLabel={r.ready ? "Aktiver ansatt" : "Aktiver likevel (overstyr)"} confirmTone={r.ready ? "primary" : "danger"}
          onConfirm={() => toast(`${e.display} aktivert`, { undo: () => {} })} />
      </div>
    );
  }

  function Profile({ e, onBack, toast, initialTab }) {
    const r = A.readiness(e);
    const tabs = [
      { id: "beredskap", label: "Beredskap", icon: "gauge", dot: r.ready ? null : (r.hasExpired || r.blockers.some((b) => b.sev === "crit") ? "crit" : "warn") },
      { id: "kontrakt", label: "Kontrakt", icon: "checkdoc", dot: e.contract.signed !== "signed" ? "warn" : null },
      { id: "kompetanse", label: "Kompetanse", icon: "cap" },
      { id: "tilgang", label: "Tilgang & ansvar", icon: "lock" },
      { id: "plassering", label: "Plassering", icon: "mappin" },
      { id: "fravaer", label: "Fravær", icon: "umbrella" },
      { id: "sensitivt", label: "Sensitivt", icon: "eye", dot: e.lifecycle === "trainee" ? "crit" : null },
      ...(e.offboarding ? [{ id: "avslutning", label: "Avslutning", icon: "logout", dot: "warn" }] : []),
      { id: "logg", label: "Aktivitetslogg", icon: "history" },
    ];
    const valid = tabs.some((t) => t.id === initialTab);
    const [tab, setTab] = useState(valid ? initialTab : (e.offboarding ? "avslutning" : "beredskap"));

    const pages = {
      beredskap: <><P.AssistCard e={e} toast={toast} /><P.ReadinessPanel e={e} toast={toast} /></>,
      kontrakt: <P.ContractPanel e={e} toast={toast} />,
      kompetanse: <P.CompetencePanel e={e} toast={toast} />,
      tilgang: <P.AccessPanel e={e} toast={toast} />,
      plassering: <P.PlacementPanel e={e} toast={toast} />,
      fravaer: <P.AbsencePanel e={e} toast={toast} />,
      sensitivt: <P.PiiPanel e={e} toast={toast} />,
      avslutning: e.offboarding ? <P.OffboardingPanel e={e} toast={toast} /> : null,
      logg: <P.AuditPanel e={e} toast={toast} />,
    };

    return (
      <main className="sk-main full">
        <div className="an-prof-full">
          {/* tab bar above the pages */}
          <div className="an-prof-top">
            <button className="an-prof-back" onClick={onBack}><Ic n="chevLeft" s={15} /> <span>Alle ansatte</span></button>
            <div className="an-tabbar">
              {tabs.map((t) => (
                <button key={t.id} className={`an-tabbtn ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
                  <span className="ic"><Ic n={t.icon} s={16} /></span>
                  <span className="lbl">{t.label}</span>
                  {t.dot && tab !== t.id && <span className={`nd ${t.dot}`} />}
                </button>
              ))}
            </div>
            <button className="an-prof-botbtn" onClick={() => toast("Mr. Botsson åpnet for " + e.display)}><Ic n="bot" s={16} /> Botsson</button>
          </div>

          {/* page content + static right summary */}
          <div className="an-prof-lower">
            <div className="an-prof-content" key={tab}>
              {pages[tab]}
            </div>
            <aside className="an-prof-aside">
              <Summary e={e} toast={toast} />
            </aside>
          </div>
          {window.AnCtlHost && <window.AnCtlHost e={e} toast={toast} />}
        </div>
      </main>
    );
  }

  window.AnProfile = Profile;
})();
