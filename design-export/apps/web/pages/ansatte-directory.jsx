// ===== Ansatte — directory (table/cards · filters · bulk · states) =====
(function () {
  const { useState, useEffect, useMemo } = React;
  const A = window.An;
  const { Ic, SD, Av, Badge, AccessBadge, AuthorityBadge, dept, Pop } = A;
  const EMP = SD.EMPLOYEES;

  const LIFE_TABS = [
    { id: "all", label: "Alle" },
    { id: "active", label: "Aktive" },
    { id: "trainee", label: "Under opplæring" },
    { id: "inactive", label: "Inaktive" },
    { id: "offboarding", label: "Avslutter" },
  ];

  function Pulse({ lbl, ic, val, unit, sub, tone, edge, onClick }) {
    return (
      <div className="pulse" onClick={onClick}>
        {edge && <span className="pulse-edge" style={{ background: edge }} />}
        <div className="pulse-lbl"><span className="ico"><Ic n={ic} s={13} /></span>{lbl}</div>
        <div className={`pulse-val ${tone || ""}`}>{val}{unit && <span className="u">{unit}</span>}</div>
        <div className="pulse-sub">{sub}</div>
      </div>
    );
  }

  // directory-level Botsson assist (assistive, undoable)
  function DirAssist({ toast, onOpen }) {
    const [done, setDone] = useState({});
    const act = (id, t) => { if (done[id]) return; setDone((d) => ({ ...d, [id]: true })); toast(t, { undo: () => setDone((d) => ({ ...d, [id]: false })) }); };
    return (
      <div className="botsson-card" style={{ marginBottom: 18 }}>
        <div className="bot-icon"><span>B</span></div>
        <div className="bot-text">
          <span className="bot-label">Botsson</span>
          <p><strong>3 forhold</strong> i staben krever deg: Petter K. mangler signert avtale, Nora V. sin profil feilet synk, og Selma L. sitt førstehjelp utløper om 5 uker. Ingen blokkerer drift i dag.</p>
        </div>
        <button className="bot-cta" onClick={() => onOpen("pk")}>Se Petter <Ic n="arrowRight" s={13} /></button>
      </div>
    );
  }

  function ReadyCell({ e }) {
    const r = A.readiness(e);
    if (r.ready) return <span className="an-ready"><span className="an-ready-ring full" /><span className="lbl ok">Klar</span></span>;
    return <span className="an-ready"><span className="an-ready-ring" style={{ "--p": r.score, "--rc": r.color }} /><span className="lbl no">{e.lifecycle === "trainee" ? "Opplæring" : r.blockers.length + " å løse"}</span></span>;
  }

  function Row({ e, sel, onToggle, onOpen }) {
    const d = dept(e.placement.primary);
    const life = SD.LIFECYCLE[e.lifecycle];
    const unsigned = e.contract.signed !== "signed";
    return (
      <div className={`an-tr an-row ${sel ? "sel" : ""}`} data-life={e.lifecycle} onClick={() => onOpen(e.id)}>
        <span className="an-th chk" onClick={(ev) => { ev.stopPropagation(); onToggle(e.id); }}>
          <span className={`an-check ${sel ? "on" : ""}`}>{sel && <Ic n="check" s={12} sw={2.6} />}</span>
        </span>
        <div className="an-emp">
          <Av e={e} size={38} />
          <div className="meta">
            <div className="nm">{e.display} <Badge tone={life.tone} dot>{life.label}</Badge></div>
            <div className="sub">{e.stilling}<span style={{ color: "var(--border-strong)" }}>·</span><span className="mono">{e.employeeNo}</span></div>
          </div>
        </div>
        <div className="an-cell-txt an-col-dept">
          <span className="an-deptchip"><span className="d" style={{ background: d.color }} />{d.name}{e.placement.depts.length > 1 && <span className="plus">+{e.placement.depts.length - 1}</span>}</span>
        </div>
        <div className="an-col-access">{<AccessBadge id={e.access} />}</div>
        <div className="an-col-auth">{<AuthorityBadge id={e.authority} />}</div>
        <div>
          <ReadyCell e={e} />
          {unsigned && <div style={{ marginTop: 4 }}><span className="an-badge" data-tone="warning" style={{ fontSize: 10, padding: "2px 7px" }}><Ic n="pen" s={10} /> Usignert</span></div>}
        </div>
        <div className="an-rowact"><span className="an-iconbtn"><Ic n="chevRight" s={16} /></span></div>
      </div>
    );
  }

  function Card({ e, onOpen }) {
    const d = dept(e.placement.primary);
    const r = A.readiness(e);
    const life = SD.LIFECYCLE[e.lifecycle];
    return (
      <div className="an-card" data-life={e.lifecycle} onClick={() => onOpen(e.id)}>
        <div className="an-card-top">
          <Av e={e} size={44} />
          <div className="meta"><div className="nm">{e.display}</div><div className="st">{e.stilling} · {d.name}</div></div>
          <span className="an-ready-ring" style={r.ready ? {} : { "--p": r.score, "--rc": r.color }}>{r.ready ? "" : ""}</span>
        </div>
        <div className="an-card-badges">
          <Badge tone={life.tone} dot>{life.label}</Badge>
          <AccessBadge id={e.access} />
          <AuthorityBadge id={e.authority} />
        </div>
        <div className="an-card-foot">
          <span style={{ fontSize: 12, fontWeight: 600, color: r.ready ? "var(--success)" : "var(--muted)" }}>{r.ready ? "Klar for vakt" : `${r.score}% klar`}</span>
          <span className="gr" />
          {e.contract.signed !== "signed" && <Badge tone="warning" ic="pen">Usignert</Badge>}
        </div>
      </div>
    );
  }

  function Skeleton() {
    return (
      <div className="an-table">
        <div className="an-thead"><div className="an-tr"><span /><span className="an-th">Ansatt</span><span className="an-th">Avdeling</span><span className="an-th">Tilgang</span><span className="an-th">Ansvar</span><span className="an-th">Beredskap</span><span /></div></div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="an-sk-row">
            <span className="an-sk" style={{ width: 19, height: 19, borderRadius: 6 }} />
            <span style={{ display: "flex", gap: 11, alignItems: "center" }}><span className="an-sk" style={{ width: 38, height: 38, borderRadius: "50%" }} /><span><span className="an-sk" style={{ display: "block", width: 120, height: 11, marginBottom: 6 }} /><span className="an-sk" style={{ display: "block", width: 80, height: 9 }} /></span></span>
            <span className="an-sk" style={{ width: 90, height: 11 }} />
            <span className="an-sk" style={{ width: 56, height: 18, borderRadius: 999 }} />
            <span className="an-sk" style={{ width: 70, height: 18, borderRadius: 999 }} />
            <span className="an-sk" style={{ width: 60, height: 18, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    );
  }

  function Directory({ onOpen, toast }) {
    const [tab, setTab] = useState("all");
    const [q, setQ] = useState("");
    const [view, setView] = useState("table");
    const [deptF, setDeptF] = useState(null);
    const [deptOpen, setDeptOpen] = useState(false);
    const [sel, setSel] = useState({});
    const [loading, setLoading] = useState(true);
    const [surface, setSurface] = useState("ansatte"); // ansatte | kontrakter

    useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, []);

    const counts = useMemo(() => {
      const c = { all: EMP.length };
      LIFE_TABS.slice(1).forEach((t) => (c[t.id] = EMP.filter((e) => e.lifecycle === t.id).length));
      return c;
    }, []);
    const kpis = useMemo(() => ({
      trainees: EMP.filter((e) => e.lifecycle === "trainee").length,
      ready: EMP.filter((e) => A.readiness(e).ready).length,
      unsigned: EMP.filter((e) => e.contract.signed !== "signed").length,
      attention: EMP.filter((e) => (e.readiness.blockers || []).some((b) => b.sev === "crit" || b.sev === "warn") || (e.protocols || []).some((p) => p.status === "expired")).length,
    }), []);

    const list = useMemo(() => EMP.filter((e) => {
      if (tab !== "all" && e.lifecycle !== tab) return false;
      if (deptF && !e.placement.depts.includes(deptF)) return false;
      if (q) { const s = (e.display + " " + e.name + " " + e.stilling + " " + e.employeeNo).toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
      return true;
    }), [tab, deptF, q]);

    const selIds = Object.keys(sel).filter((k) => sel[k]);
    const allSel = list.length > 0 && list.every((e) => sel[e.id]);
    const toggleAll = () => { if (allSel) setSel({}); else { const n = {}; list.forEach((e) => (n[e.id] = true)); setSel(n); } };
    const bulk = (label) => { toast(`${label} · ${selIds.length} ansatte`, { undo: () => {} }); setSel({}); };

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 1240 }}>
          {/* head */}
          <div className="an-dir-head">
            <div>
              <div className="sk-eyebrow">Team · Bistro Nord</div>
              <h1 className="an-dir-title">Ansatte</h1>
              <div className="an-dir-sub">
                <span className="seg"><strong>{EMP.length}</strong> profiler</span>
                <span className="sep" />
                <span className="seg"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--info)", display: "inline-block" }} /><strong>{kpis.trainees}</strong> under opplæring</span>
                <span className="sep" />
                <span className="seg"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} /><strong>{kpis.ready}</strong> klare for vakt</span>
              </div>
            </div>
            <div className="sk-page-actions">
              <div className="an-surf-switch">
                <button className={surface === "ansatte" ? "on" : ""} onClick={() => setSurface("ansatte")}><Ic n="users" s={14} /> Ansatte</button>
                <button className={surface === "kontrakter" ? "on" : ""} onClick={() => setSurface("kontrakter")}><Ic n="checkdoc" s={14} /> Kontrakter</button>
              </div>
              {surface === "ansatte"
                ? <button className="sk-primary" onClick={() => toast("Ny ansatt — onboarding-veiviser åpnet")}><Ic n="plus" s={15} c="#fff" sw={2.3} /> Ny ansatt</button>
                : <button className="sk-ghost" onClick={() => toast("Eksporterer kontrakter")}><Ic n="download" s={15} /> Eksport</button>}
            </div>
          </div>

          {surface === "kontrakter" ? (
            <window.AnContracts onOpen={onOpen} toast={toast} />
          ) : (
          <React.Fragment>
          {/* KPIs */}
          <div className="dash-pulse" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <Pulse lbl="Totalt" ic="users" val={EMP.length} sub="aktive profiler" edge="var(--border-strong)" onClick={() => setTab("all")} />
            <Pulse lbl="Under opplæring" ic="cap" val={kpis.trainees} sub="onboardes nå" tone="" edge="var(--info)" onClick={() => setTab("trainee")} />
            <Pulse lbl="Klare for vakt" ic="check" val={kpis.ready} unit={`/ ${EMP.length}`} sub="alle krav oppfylt" tone="ok" edge="var(--success)" onClick={() => setTab("all")} />
            <Pulse lbl="Usignerte avtaler" ic="pen" val={kpis.unsigned} sub={`${kpis.attention} krever oppmerksomhet`} tone={kpis.unsigned ? "warn" : ""} edge="var(--warning)" onClick={() => setTab("all")} />
          </div>

          <DirAssist toast={toast} onOpen={onOpen} />

          {/* lifecycle tabs */}
          <div className="an-tabs">
            {LIFE_TABS.map((t) => (
              <button key={t.id} className={`an-tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}<span className="c">{counts[t.id]}</span>
              </button>
            ))}
          </div>

          {/* toolbar */}
          <div className="an-toolbar">
            <div className="an-srch"><Ic n="search" s={15} c="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk navn, stilling, ansattnr…" /></div>
            <div style={{ position: "relative" }}>
              <button className="an-filterbtn" onClick={() => setDeptOpen((o) => !o)}><Ic n="filter" s={14} /> {deptF ? dept(deptF).name : "Avdeling"}{deptF && <span className="c">1</span>}<Ic n="chevDown" s={13} c="var(--muted)" /></button>
              {deptOpen && (
                <Pop onClose={() => setDeptOpen(false)} style={{ top: 44, left: 0, width: 200 }}>
                  <div className="sk-pop-sec">Avdeling</div>
                  <button className="sk-pop-item" onClick={() => { setDeptF(null); setDeptOpen(false); }}><Ic n="users" s={15} c="var(--muted)" /> Alle avdelinger {!deptF && <span className="sk-dot-ok" />}</button>
                  {Object.values(SD.DEPARTMENTS).map((d) => (
                    <button key={d.id} className="sk-pop-item" onClick={() => { setDeptF(d.id); setDeptOpen(false); }}><span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} /> {d.name} {deptF === d.id && <span className="sk-dot-ok" />}</button>
                  ))}
                </Pop>
              )}
            </div>
            <span className="spacer" />
            <div className="an-segctrl">
              <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}><Ic n="list" s={14} /> Tabell</button>
              <button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}><Ic n="grid" s={14} /> Kort</button>
            </div>
          </div>

          {/* bulk bar */}
          {selIds.length > 0 && (
            <div className="an-bulk">
              <span className="n"><span className="mono">{selIds.length}</span> valgt</span>
              <span className="spacer" />
              <button onClick={() => bulk("Tildelt opplæring")}><Ic n="cap" s={14} /> Tildel opplæring</button>
              <button onClick={() => bulk("Sendt melding")}><Ic n="message" s={14} /> Melding</button>
              <button onClick={() => bulk("Satt avdeling")}><Ic n="mappin" s={14} /> Sett avdeling</button>
              <button className="x" onClick={() => setSel({})}><Ic n="x" s={15} /></button>
            </div>
          )}

          {/* body */}
          {loading ? <Skeleton />
            : list.length === 0 ? (
              <div className="an-table"><div className="so-empty"><span className="ic"><Ic n="users" s={22} /></span><div className="t">Ingen ansatte</div><div className="s">Ingen treff for dette filteret. Juster søk eller status.</div></div></div>
            ) : view === "cards" ? (
              <div className="an-cards">{list.map((e) => <Card key={e.id} e={e} onOpen={onOpen} />)}</div>
            ) : (
              <div className="an-table">
                <div className="an-thead">
                  <div className="an-tr">
                    <span className="an-th chk" onClick={toggleAll}><span className={`an-check ${allSel ? "on" : ""}`}>{allSel && <Ic n="check" s={12} sw={2.6} />}</span></span>
                    <span className="an-th">Ansatt</span>
                    <span className="an-th dept">Avdeling</span>
                    <span className="an-th access">Tilgang</span>
                    <span className="an-th auth">Ansvar</span>
                    <span className="an-th">Beredskap</span>
                    <span className="an-th" />
                  </div>
                </div>
                {list.map((e) => <Row key={e.id} e={e} sel={!!sel[e.id]} onToggle={(id) => setSel((s) => ({ ...s, [id]: !s[id] }))} onOpen={onOpen} />)}
              </div>
            )}
          </React.Fragment>
          )}
        </div>
      </main>
    );
  }

  window.AnDirectory = Directory;
})();
