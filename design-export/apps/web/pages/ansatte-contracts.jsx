// ===== Ansatte — Kontrakter (orchestration controller + status dashboard) =====
// Premium uplift of the Kontrakter surface. Internal views: board (status
// tracking) + maler (templates). Launches full-bleed overlays:
//   CtBuilder · CtHire · CtDetail · CtDoc · CtOnboard
(function () {
  const { useState } = React;
  const C = window.Ct;
  const { Ic, SD, A, statusMeta, tplById, groupById, gradeById, fmtKr } = C;
  const { Av, dept, emp } = A;
  const CONTRACTS = SD.CT_CONTRACTS;
  const TEMPLATES = SD.CT_TEMPLATES;

  // ---------- pipeline stages ----------
  const STAGES = [
    { id: "draft",  label: "Utkast",        ic: "file",     edge: "var(--info)",    test: (c) => c.status === "draft" },
    { id: "sent",   label: "Sendt",         ic: "send",     edge: "var(--warning)", test: (c) => c.status === "sent" },
    { id: "viewed", label: "Åpnet",         ic: "eye",      edge: "var(--purple)",  test: (c) => c.status === "viewed" },
    { id: "signed", label: "Signert",       ic: "check",    edge: "var(--success)", test: (c) => c.status === "signed" },
    { id: "att",    label: "Krever handling", ic: "alert",  edge: "var(--error)",   test: (c) => ["expired", "rejected", "failed"].includes(c.status) },
  ];
  const attention = CONTRACTS.filter((c) => ["expired", "rejected", "failed"].includes(c.status));

  function Board({ onDetail, onHire, onOnboard, toast }) {
    const [filter, setFilter] = useState("alle");
    const rows = filter === "alle" ? CONTRACTS
      : filter === "att" ? attention
      : CONTRACTS.filter((c) => STAGES.find((s) => s.id === filter).test(c));
    const pontus = CONTRACTS.find((c) => c.id === "k-pontus");

    return (
      <div className="ct-board">
        {/* pipeline */}
        <div className="ct-pipe">
          {STAGES.map((s) => {
            const n = CONTRACTS.filter(s.test).length;
            return (
              <button key={s.id} className={`ct-pstage ${filter === s.id ? "on" : ""}`} style={{ "--edge": s.edge }} onClick={() => setFilter(filter === s.id ? "alle" : s.id)}>
                <div className="ct-pstage-top"><span className="ic"><Ic n={s.ic} s={13} /></span>{s.label}</div>
                <div className="ct-pstage-n" style={{ color: n && s.id === "att" ? "var(--error)" : "var(--fg)" }}>{n}</div>
                <div className="ct-pstage-s">{s.id === "att" ? "utløpt / avvist" : s.id === "signed" ? "aktive avtaler" : "kontrakter"}</div>
              </button>
            );
          })}
        </div>

        {/* Botsson advisory — missing-info nudge (assistive) */}
        {pontus && (
          <div className="ct-advise">
            <span className="ct-advise-av"><Ic n="bot" s={18} /></span>
            <div className="ct-advise-b">
              <div className="ct-advise-id">Botsson <span className="tag">Forslag</span></div>
              <p className="ct-advise-txt"><strong>Pontus Lindroth</strong> sin avtale er auto-generert fra malen og <strong>72 % komplett</strong>. Den mangler 3 opplysninger fra ansatt (fødselsnummer, konto, pårørende) — bare fødselsnummer er påkrevd før signering. Du kan sende invitasjonen nå, så samler jeg inn resten ved første innlogging.</p>
              <div className="ct-advise-acts">
                <button className="ct-btn purple sm" onClick={() => onDetail("k-pontus")}><Ic n="arrowRight" s={14} /> Se og send</button>
                <button className="ct-btn sm" onClick={() => onOnboard()}><Ic n="user" s={14} /> Forhåndsvis ansatt-opplevelsen</button>
              </div>
            </div>
          </div>
        )}

        {/* attention */}
        {attention.length > 0 && filter === "alle" && (
          <React.Fragment>
            <div className="ct-shead"><span className="t">Krever handling nå</span><span className="c">{attention.length}</span></div>
            <ContractList rows={attention} onDetail={onDetail} toast={toast} />
          </React.Fragment>
        )}

        {/* main list */}
        <div className="ct-shead">
          <span className="t">{filter === "alle" ? "Alle kontrakter" : STAGES.find((s) => s.id === filter)?.label || "Kontrakter"}</span>
          <span className="c">{rows.length}</span>
          <span className="gr" />
          {filter !== "alle" && <button className="ct-btn sm ghost" onClick={() => setFilter("alle")}>Vis alle</button>}
        </div>
        {rows.length === 0 ? (
          <div className="ct-empty">
            <span className="ic"><Ic n="checkdoc" s={26} /></span>
            <div className="t">Ingen kontrakter her</div>
            <div className="s">Ingen avtaler i dette steget akkurat nå.</div>
            <div className="acts"><button className="ct-btn primary" onClick={onHire}><Ic n="plus" s={15} sw={2.3} c="#fff" /> Ansett & inviter</button></div>
          </div>
        ) : (
          <ContractList rows={rows} onDetail={onDetail} toast={toast} hideAttention={filter === "alle"} attentionIds={attention.map((a) => a.id)} />
        )}
      </div>
    );
  }

  function ContractList({ rows, onDetail, toast, hideAttention, attentionIds }) {
    let list = rows;
    if (hideAttention) list = rows.filter((c) => !attentionIds.includes(c.id));
    if (list.length === 0) return null;
    return (
      <div className="ct-list">
        <div className="ct-lhead">
          <span className="th">Ansatt</span>
          <span className="th">Rolle · form</span>
          <span className="th ct-col-tpl">Lønn</span>
          <span className="th ct-col-comp">Fullstendighet</span>
          <span className="th">Status</span>
          <span className="th" />
        </div>
        {list.map((c) => {
          const st = statusMeta(c.status); const d = dept(c.dept);
          const g = gradeById(c.grade);
          const pay = c.monthly ? `${fmtKr(c.monthly)} kr/mnd` : c.hourly ? `${fmtKr(c.hourly)} kr/t` : "—";
          return (
            <div key={c.id} className="ct-row" data-s={c.status} onClick={() => onDetail(c.id)}>
              <div className="ct-emp">
                {emp(c.who) ? <Av e={emp(c.who)} size={36} /> : <span className="so-av" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--info)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>PL</span>}
                <div className="meta">
                  <div className="nm">{c.name}{c.isNew && <span className="new">Ny</span>}</div>
                  <div className="sub">{c.kind ? c.kind + (c.kindNote ? " · " + c.kindNote : "") : "Ny avtale"}</div>
                </div>
              </div>
              <div className="ct-cell">{c.role}<div className="s">{c.form} · <span style={{ color: d.color }}>{d.name}</span></div></div>
              <div className="ct-cell ct-col-tpl"><span className="mono">{pay}</span><div className="s">{g.code ? g.code + " · " + g.label : "—"}</div></div>
              <div className="ct-cell ct-col-comp">
                <div className="ct-comp">
                  <span className="ct-comp-bar"><span className={c.completion < 100 ? "warn" : ""} style={{ width: c.completion + "%" }} /></span>
                  <span className="pct">{c.completion}%</span>
                </div>
                {c.missing && c.missing.length > 0 && <span className="ct-missing-tag"><Ic n="alert" s={11} /> {c.missing.length} mangler</span>}
              </div>
              <div><span className="ct-pill" data-s={st.tone}><span className="d" />{st.label}</span></div>
              <div className="ct-rowchev"><Ic n="chevRight" s={16} /></div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---------- templates (Maler) — index that hands off to Dokumentmodus ----------
  function Maler({ onOpenDoc }) {
    return (
      <React.Fragment>
        <div className="ct-advise" style={{ marginBottom: 16 }}>
          <span className="ct-advise-av"><Ic n="book" s={18} /></span>
          <div className="ct-advise-b">
            <div className="ct-advise-id">Kontraktsmaler bor i Bedriftshåndboken</div>
            <p className="ct-advise-txt">Malene er styrte dokumenter i <strong>Dokumentmodus → Bedriftshåndbok</strong>. Der bygger du dem i den guidede mal-generatoren med Botssons jus-rådgiver — og Kontrakter bruker dem til å auto-generere avtaler. Trykk en mal for å åpne den i generatoren.</p>
            <div className="ct-advise-acts"><button className="ct-btn purple sm" onClick={onOpenDoc}><Ic n="arrowRight" s={14} /> Åpne malgeneratoren i Dokumentmodus</button></div>
          </div>
        </div>
        <div className="ct-tplgrid">
          {TEMPLATES.map((t) => {
            const g = groupById(t.group);
            return (
              <button key={t.id} className={`ct-tplcard ${t.status === "draft" ? "draft" : ""}`} onClick={onOpenDoc}>
                <div className="ct-tplcard-top">
                  <span className="ct-tplcard-ic" style={{ background: `var(--dept-${g.dept === "admin" ? "event" : g.dept}, var(--orange))` }}><Ic n={g.icon || "checkdoc"} s={18} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="ct-tplcard-nm">{t.name}</div>
                    <div className="ct-tplcard-meta">v{t.version} · {t.status === "published" ? "Publisert" : "Utkast"} · {t.uses} i bruk</div>
                  </div>
                </div>
                <p className="ct-tplcard-desc">{t.desc}</p>
                <div className="ct-tplcard-foot">
                  <span className="ct-completebar"><span className={t.completeness < 100 ? "warn" : ""} style={{ width: t.completeness + "%" }} /></span>
                  <span className="pct mono" style={{ fontSize: 11, fontWeight: 600, color: t.completeness < 100 ? "var(--warning)" : "var(--success)" }}>{t.completeness}%</span>
                </div>
              </button>
            );
          })}
          <button className="ct-tplcard" style={{ borderStyle: "dashed", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 170, color: "var(--muted)" }} onClick={onOpenDoc}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--secondary)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic n="plus" s={20} sw={2.2} /></span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Ny mal</span>
            <span style={{ fontSize: 11.5 }}>Bygg en mal i Dokumentmodus</span>
          </button>
        </div>
      </React.Fragment>
    );
  }

  // ---------- module controller ----------
  function Contracts({ onOpen, toast }) {
    const [view, setView] = useState("avtaler");          // avtaler | maler
    const [hire, setHire] = useState(false);
    const [detail, setDetail] = useState(null);           // contract id
    const [onboard, setOnboard] = useState(false);
    const [doc, setDoc] = useState(null);                 // contract obj for standalone preview

    // Maler are governed in Dokumentmodus → Bedriftshåndbok (dedicated chapter).
    const openDocMode = () => {
      window.__hbTarget = { bookId: "bedrift", chapterId: "b-contracts" };
      if (window.SmartoutCreate) window.SmartoutCreate("dokument");
      else toast("Åpne Bibliotek (Dokumentmodus) for å bygge maler");
    };

    return (
      <React.Fragment>
        <div className="an-toolbar" style={{ marginBottom: 16 }}>
          <div className="an-segctrl">
            <button className={view === "avtaler" ? "on" : ""} onClick={() => setView("avtaler")}><Ic n="checkdoc" s={14} /> Avtaler</button>
            <button className={view === "maler" ? "on" : ""} onClick={() => setView("maler")}><Ic n="file" s={14} /> Maler <span className="c">{TEMPLATES.length}</span></button>
          </div>
          <span className="spacer" />
          {view === "avtaler"
            ? <button className="ct-btn primary sm" onClick={() => setHire(true)}><Ic n="plus" s={15} sw={2.3} c="#fff" /> Ansett & inviter</button>
            : <button className="ct-btn sm" onClick={openDocMode}><Ic n="arrowRight" s={15} sw={2.2} /> Åpne i Dokumentmodus</button>}
        </div>

        {view === "avtaler"
          ? <Board onDetail={setDetail} onHire={() => setHire(true)} onOnboard={() => setOnboard(true)} toast={toast} />
          : <Maler onOpenDoc={openDocMode} />}

        {/* overlays */}
        {hire && <window.CtHire onClose={() => setHire(false)} onOnboard={() => { setHire(false); setOnboard(true); }} toast={toast} />}
        {detail && <window.CtDetail id={detail} onClose={() => setDetail(null)} onDoc={(c) => setDoc(c)} onOpen={onOpen} toast={toast} />}
        {doc && <window.CtDoc contract={doc} onClose={() => setDoc(null)} toast={toast} />}
        {onboard && <window.CtOnboard onClose={() => setOnboard(false)} toast={toast} />}
      </React.Fragment>
    );
  }

  window.AnContracts = Contracts;
})();
