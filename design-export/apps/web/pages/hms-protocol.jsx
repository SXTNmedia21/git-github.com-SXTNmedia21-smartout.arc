// ===== HMS — Protocol library + Protocol detail workspace =====
// Exposes window.HmsProtocols (library) and window.HmsProtocolDetail (workspace).
(function () {
  const { useState, useMemo } = React;
  const H = window.Hms;
  const { Ic, SD, cat, emp, empName, pos, loc, Av, Ring, ImpBadge, CatChip, HandbookLink, TypeBadge, Breadcrumb } = H;

  // affected employees: those whose primary/secondary position is in proto.roles
  function affectedEmps(proto) {
    return SD.EMPLOYEES.filter((e) => (e.positions || []).some((pp) => proto.roles.includes(pp.position)));
  }

  // ---------- LIBRARY ----------
  function ProtoCard({ p, expanded, onToggle, onOpen, openCat }) {
    return (
      <div className={`hms-proto hms-cat-${p.cat} ${p.importance === "kritisk" ? "crit-imp" : ""} ${expanded ? "open" : ""}`}>
        <div className="hms-proto-head" onClick={onToggle}>
          <div className="hms-proto-id">
            <div className="hms-proto-toprow">
              <span className="hms-proto-code">{p.code}</span>
              <ImpBadge id={p.importance} />
              <H.StatusBadge status={p.status} />
            </div>
            <div className="hms-proto-nm">{p.title}</div>
            <div className="hms-proto-meta">
              <span><Ic n="book" s={12} /> {p.handbook.path}</span>
              <span><Ic n="user" s={12} /> {empName(p.owner)} · {p.ownerRole}</span>
              <span><Ic n="repeat" s={12} /> {p.routines.length} rutiner</span>
              {p.overdue > 0 && <span style={{ color: "var(--error)", fontWeight: 600 }}><Ic n="alert" s={12} /> {p.overdue} forsinket</span>}
            </div>
          </div>
          <div className="hms-proto-side">
            <div style={{ textAlign: "center" }}>
              <Ring pct={p.compliance} size="sm" color="var(--cat)" />
            </div>
            <Ic n="chevDown" s={18} c="var(--muted-soft)" style={{ transition: "transform .15s", transform: expanded ? "rotate(180deg)" : "none" }} />
          </div>
        </div>
        {expanded && (
          <div className="hms-proto-body">
            <div className="hms-proto-grid">
              <div className="hms-proto-cell">
                <h5><span className="ic"><Ic n="user" s={12} /></span>Berørte roller</h5>
                <div className="hms-chips">{p.roles.map((r) => <span key={r} className="hms-mini"><span className="d" style={{ background: (SD.DEPARTMENTS[pos(r).dept] || {}).color || "var(--cat)" }} />{pos(r).name}</span>)}</div>
              </div>
              <div className="hms-proto-cell">
                <h5><span className="ic"><Ic n="mappin" s={12} /></span>Lokasjoner</h5>
                <div className="hms-chips">{p.locations.map((l) => <span key={l} className="hms-mini">{loc(l).name}</span>)}</div>
              </div>
              <div className="hms-proto-cell">
                <h5><span className="ic"><Ic n="repeat" s={12} /></span>Aktive rutiner</h5>
                <div className="hms-chips">{p.routines.map((r) => <span key={r.id} className="hms-mini" title={r.cadence}><span className="d" style={{ background: r.status === "behind" ? "var(--error)" : r.status === "due" ? "var(--warning)" : "var(--success)" }} />{r.name}</span>)}</div>
              </div>
              <div className="hms-proto-cell">
                <h5><span className="ic"><Ic n="cap" s={12} /></span>Påkrevd opplæring</h5>
                <div className="hms-chips">{[...p.trainings, ...p.quizzes].map((t, i) => <span key={i} className="hms-mini"><Ic n="cap" s={11} c="var(--muted-soft)" />{t}</span>)}{p.trainings.length + p.quizzes.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>Ingen</span>}</div>
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--card)" }}>
              <HandbookLink hb={p.handbook} onOpen={() => openBib ? openBib() : openCat(p.cat)} />
            </div>
            <div className="hms-proto-bodyfoot">
              <span style={{ fontSize: 12, color: "var(--muted)" }}><Ic n="check" s={12} /> {p.checklist.done}/{p.checklist.total} sjekkpunkt · sist {p.lastTask.at}</span>
              <span className="spc" />
              <button className="sk-primary" style={{ height: 32 }} onClick={() => onOpen(p.id)}>Åpne protokoll <Ic n="arrowRight" s={14} c="#fff" /></button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function HmsProtocols({ openProto, openCat, openBib, onNewProtocol, toast }) {
    const [q, setQ] = useState("");
    const [catF, setCatF] = useState("all");
    const [expanded, setExpanded] = useState({});

    const list = useMemo(() => SD.HMS_PROTOCOLS.filter((p) => {
      if (catF !== "all" && p.cat !== catF) return false;
      if (q) { const s = (p.title + " " + p.code + " " + p.ownerRole + " " + p.handbook.path).toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
      return true;
    }), [q, catF]);

    const groups = SD.HMS_CAT_ORDER.map((id) => ({ id, items: list.filter((p) => p.cat === id) })).filter((g) => g.items.length);

    return (
      <>
          <div className="hms-toolbar">
            <div className="hms-srch"><Ic n="search" s={15} c="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk protokoll, kapittel, ansvarlig…" /></div>
            <button className={`hms-fchip ${catF === "all" ? "on" : ""}`} onClick={() => setCatF("all")}>Alle <span className="c">{SD.HMS_PROTOCOLS.length}</span></button>
            {SD.HMS_CAT_ORDER.map((id) => (
              <button key={id} className={`hms-fchip hms-cat-${id} ${catF === id ? "on" : ""}`} onClick={() => setCatF(id)} style={catF === id ? { color: "var(--cat)", borderColor: "var(--cat)", background: "var(--cat-soft)" } : {}}>
                <span className="d" style={{ background: "var(--cat)" }} />{cat(id).name} <span className="c">{SD.HMS_PROTOCOLS.filter((p) => p.cat === id).length}</span>
              </button>
            ))}
            <span className="spc" />
            <button className="sk-ghost" onClick={() => openBib && openBib()}><Ic n="book" s={15} /> Bibliotek</button>
            <button className="sk-primary" onClick={() => onNewProtocol && onNewProtocol()}><Ic n="plus" s={15} c="#fff" sw={2.3} /> Ny protokoll</button>
          </div>

          {groups.length === 0 && <div className="so-panel"><div className="so-empty"><span className="ic"><Ic n="shield" s={22} /></span><div className="t">Ingen protokoller</div><div className="s">Ingen treff for dette filteret.</div></div></div>}

          {groups.map((g) => (
            <div key={g.id} className={`hms-protogroup hms-cat-${g.id}`}>
              <div className="hms-protogroup-head">
                <span className="bar" />
                <span className="nm">{cat(g.id).name}</span>
                <span className="ct">{g.items.length} protokoller</span>
                <span className="spc" />
                <span className="hms-status ok" style={{ color: "var(--cat)", background: "var(--cat-soft)" }}><span className="d" style={{ background: "var(--cat)" }} />Samsvar {cat(g.id).compliance}%</span>
              </div>
              <div className="hms-protolist">
                {g.items.map((p) => (
                  <ProtoCard key={p.id} p={p} expanded={!!expanded[p.id]} onToggle={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))} onOpen={openProto} openCat={openCat} />
                ))}
              </div>
            </div>
          ))}
      </>
    );
  }

  // ============================================================
  // PROTOCOL DETAIL WORKSPACE — tabs
  // ============================================================
  const DTABS = [
    ["oversikt", "Oversikt", "list"],
    ["handbok", "Håndbok", "book"],
    ["prosedyrer", "Prosedyrer", "clipcheck"],
    ["rutiner", "Rutiner", "repeat"],
    ["oppgaver", "Oppgaver", "check"],
    ["opplaring", "Opplæring", "cap"],
    ["quiz", "Quiz", "help"],
    ["manualer", "Manualer", "file"],
    ["bevis", "Bevis", "camera"],
    ["kommentarer", "Kommentarer", "message"],
    ["ansatte", "Ansatte", "users"],
    ["logg", "Logg", "history"],
  ];

  function HmsProtocolDetail({ protoId, onBack, crumbs, openEntity, openProto, openCat, openComments, goTab, genEvi = [], toast }) {
    const p = SD.HMS_PROTO_BY_ID[protoId];
    const [tab, setTab] = useState("oversikt");
    if (!p) return null;
    const c = cat(p.cat);
    const tasks = SD.HMS_TASKS.filter((t) => t.proto === p.id);
    const tracking = SD.HMS_TRACKING.filter((t) => t.proto === p.id);
    const comments = SD.HMS_COMMENTS.filter((cm) => cm.anchor === p.id);
    const activity = SD.HMS_ACTIVITY.filter((a) => a.ref === p.id);
    const affected = affectedEmps(p);
    const trainings = tracking.filter((t) => t.kind === "training");
    const quizzes = tracking.filter((t) => t.kind === "quiz");
    const manuals = tracking.filter((t) => t.kind === "manual");

    // synthesize procedure steps from checklist + routines
    const steps = p.routines.map((r, i) => ({ n: i + 1, t: r.name, by: r.ownerRole, cad: r.cadence }));
    const Rel = window.HmsRel;
    const allEvi = [...genEvi, ...(p.evidence || [])];

    const cntFor = (id) => ({ oppgaver: tasks.length, opplaring: trainings.length, quiz: quizzes.length, manualer: manuals.length, kommentarer: comments.length, ansatte: affected.length, rutiner: p.routines.length, logg: activity.length }[id]);
    const ndFor = (id) => (id === "oppgaver" && tasks.some((t) => t.status === "overdue")) || (id === "kommentarer" && comments.some((cm) => !cm.resolved));

    const TrackRow = ({ t }) => (
      <div className="hms-tr hms-row" data-st={t.status} style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr" }}>
        <div className="hms-empcell"><Av id={t.emp} size={32} /><div className="meta"><div className="nm">{empName(t.emp)}</div><div className="sb">{emp(t.emp).stilling}</div></div></div>
        <div className="hms-cell">{t.item}</div>
        <div className="hms-cell"><span className="mono">{t.score}</span></div>
        <div className="hms-cell"><span className={`hms-cstat ${t.status}`}><Ic n={t.status === "completed" ? "check" : t.status === "overdue" || t.status === "missing" ? "alert" : "clock"} s={12} />{t.status === "completed" ? "Fullført" : t.status === "overdue" ? "Forfalt" : t.status === "missing" ? "Mangler" : t.status === "due" ? "Frist" : "Pågår"}</span></div>
      </div>
    );

    return (
      <main className={`sk-main hms-cat-${p.cat}`}>
        <div className="sk-wrap" style={{ maxWidth: 1080 }}>
          {crumbs && <Breadcrumb items={crumbs} />}
          <button className="hms-detail-back" onClick={onBack}><Ic n="chevLeft" s={16} /> Tilbake</button>

          {/* hero */}
          <div className="hms-detail-hero">
            <span className="hms-detail-ic"><Ic n={c.icon} s={24} /></span>
            <div className="hms-detail-hid">
              <div className="hms-proto-toprow"><TypeBadge type="protokoll" cat={p.cat} /><span className="hms-proto-code">{p.code}</span><CatChip id={p.cat} /><ImpBadge id={p.importance} /><H.StatusBadge status={p.status} /></div>
              <div className="hms-detail-nm" style={{ marginTop: 6 }}>{p.title}</div>
              <div className="hms-detail-metarow">
                <button className="hms-typebadge t-orange" onClick={() => openEntity && openEntity("handbook")} style={{ cursor: "pointer" }}><Ic n="book" s={11} /> {p.handbook.path}</button>
                <span><Ic n="user" s={13} /> {empName(p.owner)} · {p.ownerRole}</span>
                <span><Ic n="calendar" s={13} /> Neste gjennomgang <strong style={{ color: /forfalt/i.test(p.nextReview) ? "var(--error)" : "var(--fg)" }}>{p.nextReview}</strong></span>
              </div>
            </div>
            <div className="hms-detail-actions">
              <Ring pct={p.compliance} size="lg" color="var(--cat)" />
              <button className="sk-ghost" style={{ height: 32 }} onClick={() => openComments({ title: p.title, anchorLabel: p.code, comments })}><Ic n="message" s={14} /> Kommenter</button>
            </div>
          </div>

          {/* tabbar */}
          <div className="hms-detail-tabbar" style={{ borderBottom: "1px solid var(--border)", marginBottom: 18 }}>
            {DTABS.map(([id, label, ic]) => (
              <button key={id} className={`hms-detail-tabbtn ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
                <Ic n={ic} s={14} /> {label}
                {cntFor(id) != null && <span className="c">{cntFor(id)}</span>}
                {ndFor(id) && <span className="nd" />}
              </button>
            ))}
          </div>

          {/* ---- tab content ---- */}
          {tab === "oversikt" && (
            <div className="hms-grid2">
              <div className="hms-stack">
                <H.Panel icon="shield" title="Policy som håndheves" flush>
                  <div className="hms-policy-note"><span className="ic"><Ic n="lock" s={13} /></span> Bindende for alle berørte roller</div>
                  <div style={{ padding: "4px 18px 8px" }}>
                    {p.policies.map((pol, i) => (<div key={i} className="hms-policy"><span className="pic"><Ic n="check" s={13} sw={2.4} /></span><span className="pt">{pol}</span></div>))}
                  </div>
                </H.Panel>
                <H.Panel icon="list" title="Protokolldetaljer">
                  <div className="hms-fields">
                    <div className="hms-field"><span className="k">Protokoll-ID</span><span className="v mono">{p.code}</span></div>
                    <div className="hms-field"><span className="k">Kategori</span><span className="v"><CatChip id={p.cat} /></span></div>
                    <div className="hms-field"><span className="k">Eier</span><span className="v"><Av id={p.owner} size={20} /> {empName(p.owner)}</span></div>
                    <div className="hms-field"><span className="k">Ansvarsrolle</span><span className="v">{p.ownerRole}</span></div>
                    <div className="hms-field"><span className="k">Viktighet</span><span className="v"><ImpBadge id={p.importance} /></span></div>
                    <div className="hms-field"><span className="k">Neste gjennomgang</span><span className="v"><span style={{ color: /forfalt/i.test(p.nextReview) ? "var(--error)" : "inherit" }}>{p.nextReview}</span></span></div>
                    <div className="hms-field"><span className="k">Sist utført</span><span className="v">{p.lastTask.title} · {p.lastTask.at}</span></div>
                    <div className="hms-field"><span className="k">Sjekkliste</span><span className="v mono">{p.checklist.done}/{p.checklist.total}</span></div>
                  </div>
                </H.Panel>
                <H.Panel icon="user" title="Omfang">
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Berørte roller</div>
                    <div className="hms-chips">{p.roles.map((r) => <span key={r} className="hms-mini"><span className="d" style={{ background: (SD.DEPARTMENTS[pos(r).dept] || {}).color || "var(--cat)" }} />{pos(r).name}</span>)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Lokasjoner</div>
                    <div className="hms-chips">{p.locations.map((l) => <span key={l} className="hms-mini"><Ic n="mappin" s={11} c="var(--muted-soft)" />{loc(l).name}</span>)}</div>
                  </div>
                </H.Panel>
              </div>
              <div className="hms-stack">
                <H.Panel icon="gauge" title="Samsvar">
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                    <Ring pct={p.compliance} size="lg" color="var(--cat)" />
                    <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.compliance}% samsvar</div><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{p.checklist.done} av {p.checklist.total} sjekkpunkt fullført</div></div>
                  </div>
                  <div className="hms-bar" style={{ ["--cat"]: c.accent }}><span style={{ width: p.compliance + "%" }} /></div>
                  <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12 }}>
                    <span style={{ color: "var(--error)" }}><strong style={{ fontFamily: "var(--font-mono)" }}>{p.overdue}</strong> forsinket</span>
                    <span style={{ color: "var(--warning)" }}><strong style={{ fontFamily: "var(--font-mono)" }}>{p.missingTraining}</strong> mangler opplæring</span>
                    <span style={{ color: "var(--muted)" }}><strong style={{ fontFamily: "var(--font-mono)" }}>{p.incidents}</strong> hendelser</span>
                  </div>
                </H.Panel>
                <H.Panel icon="book" title="Tilknyttet håndbok">
                  <HandbookLink hb={p.handbook} onOpen={() => openEntity("handbook")} />
                </H.Panel>
                {p.legalIds.length > 0 && (
                  <H.Panel icon="scale" title="Rettslig grunnlag">
                    <div className="hms-rel-grid">{p.legalIds.map((lid) => { const l = H.legal(lid); return <Rel key={lid} type="lovverk" title={l.name} sub={l.basis} onClick={() => openEntity("legal", lid)} />; })}</div>
                  </H.Panel>
                )}
                {p.processIds.length > 0 && (
                  <H.Panel icon="route" title="Tilknyttede prosesser">
                    <div className="hms-rel-grid">{p.processIds.map((xid) => { const x = H.process(xid); return <Rel key={xid} type="prosess" title={x.name} sub={x.desc} onClick={() => openEntity("process", xid)} />; })}</div>
                  </H.Panel>
                )}
              </div>
            </div>
          )}

          {tab === "handbok" && (
            <div className="hms-stack">
              <H.Panel icon="book" title="Håndbokkapittel" link="Åpne håndbok" onLink={() => openEntity("handbook")}>
                <HandbookLink hb={p.handbook} onOpen={() => openEntity("handbook")} />
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg)", margin: "16px 0 0", maxWidth: "62ch" }}>
                  Denne protokollen er forankret i håndbokkapittelet <strong>{p.handbook.chapterTitle}</strong>. Kapittelet beskriver virksomhetens policy og krav; protokollen gjør policyen om til konkrete prosedyrer, rutiner, oppgaver, opplæring og bevis i daglig drift.
                </p>
              </H.Panel>
              <H.Panel icon="clipcheck" title="Tilknyttede prosedyrer">
                {p.procIds.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Ingen prosedyrer ennå.</div> : (
                  <div className="hms-rel-grid">{p.procIds.map((pid) => { const pr = H.procedure(pid); return <Rel key={pid} type="prosedyre" tone="info" title={pr.title} sub={pr.cadence + " · " + pr.ownerRole} onClick={() => openEntity("prosedyre", pid)} />; })}</div>
                )}
              </H.Panel>
              <H.Panel icon="cap" title="Påkrevd opplæring, quiz og manualer">
                <div className="hms-rel-grid">
                  {p.trainingIds.map((id) => { const t = H.training(id); return <Rel key={id} type="opplaring" tone="info" title={t.title} sub={t.modules.length + " moduler"} onClick={() => openEntity("training", id)} />; })}
                  {p.quizIds.map((id) => { const q = H.quiz(id); return <Rel key={id} type="quiz" tone="purple" title={q.title} sub={"Bestått ≥ " + q.pass + "%"} onClick={() => openEntity("quiz", id)} />; })}
                  {p.manualIds.map((id) => { const m = H.manual(id); return <Rel key={id} type="manual" title={m.title} sub="Lesbar manual" onClick={() => openEntity("manual", id)} />; })}
                  {(p.trainingIds.length + p.quizIds.length + p.manualIds.length) === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>Ingen knyttet ennå.</div>}
                </div>
              </H.Panel>
              {p.legalIds.length > 0 && (
                <H.Panel icon="scale" title="Rettslig grunnlag">
                  <div className="hms-rel-grid">{p.legalIds.map((lid) => { const l = H.legal(lid); return <Rel key={lid} type="lovverk" title={l.name} sub={l.basis + " · " + l.scope} onClick={() => openEntity("legal", lid)} />; })}</div>
                </H.Panel>
              )}
            </div>
          )}

          {tab === "prosedyrer" && (
            <H.Panel icon="clipcheck" title="Prosedyrer og sikre rutiner">
              {p.procIds.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Ingen prosedyrer knyttet til denne protokollen ennå.</div> : (
                <div className="hms-rel-grid">
                  {p.procIds.map((pid) => { const pr = H.procedure(pid); return <Rel key={pid} type="prosedyre" tone="info" title={pr.title} sub={<><span><Ic n="repeat" s={11} /> {pr.cadence}</span><span><Ic n="user" s={11} /> {pr.ownerRole}</span><span>{pr.content.length} avsnitt · åpne for å lese</span></>} onClick={() => openEntity("prosedyre", pid)} />; })}
                </div>
              )}
            </H.Panel>
          )}

          {tab === "rutiner" && (
            <H.Panel icon="repeat" title="Rutiner — klikk for prosedyre, oppgaver og bevis" flush>
              {p.routines.map((r) => (
                <div key={r.id} className="hms-routine" data-st={r.status} style={{ cursor: "pointer" }} onClick={() => openEntity("rutine", r.id)}>
                  <span className="ric"><Ic n={r.status === "behind" ? "alert" : r.status === "due" ? "clock" : "check"} s={15} /></span>
                  <div className="rm">
                    <div className="rn">{r.name}</div>
                    <div className="rs"><span className="hms-cadence">{r.cadence}</span><span><Ic n="user" s={11} /> {r.ownerRole}</span><span className="mono">{(r.tasks || []).length} oppgaver</span></div>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 12, fontWeight: 600, color: r.status === "behind" ? "var(--error)" : r.status === "due" ? "var(--warning)" : "var(--success)", fontFamily: "var(--font-mono)" }}>{r.next}</span><Ic n="chevRight" s={16} c="var(--muted-soft)" /></span>
                </div>
              ))}
            </H.Panel>
          )}

          {tab === "oppgaver" && (
            <H.Panel icon="check" title="Genererte oppgaver" link="Til oppgavetavle" onLink={() => goTab("oppgaver")}>
              {tasks.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Ingen aktive oppgaver fra denne protokollen.</div> : (
                <div className="hms-tasklist">
                  {tasks.map((t) => <window.HmsTaskRow key={t.id} t={t} compact toast={toast} openComments={openComments} />)}
                </div>
              )}
            </H.Panel>
          )}

          {(tab === "opplaring" || tab === "quiz") && (
            <div className="hms-stack">
              <H.Panel icon={tab === "quiz" ? "help" : "cap"} title={tab === "quiz" ? "Quiz i protokollen" : "Opplæring i protokollen"}>
                {(tab === "quiz" ? p.quizIds : p.trainingIds).length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Ingen knyttet ennå.</div> : (
                  <div className="hms-rel-grid">
                    {(tab === "quiz" ? p.quizIds : p.trainingIds).map((id) => { const e = tab === "quiz" ? H.quiz(id) : H.training(id); return <Rel key={id} type={tab === "quiz" ? "quiz" : "opplaring"} tone={tab === "quiz" ? "purple" : "info"} title={e.title} sub={tab === "quiz" ? ("Bestått ≥ " + e.pass + "% · " + e.questions.length + " spørsmål") : (e.modules.length + " moduler · åpne for å starte")} onClick={() => openEntity(tab === "quiz" ? "quiz" : "training", id)} />; })}
                  </div>
                )}
              </H.Panel>
              <H.Panel icon="users" title="Gjennomføring" flush>
                {(tab === "quiz" ? quizzes : trainings).length === 0 ? <div className="hms-pbody" style={{ color: "var(--muted)", fontSize: 13 }}>Ingen registreringer.</div> : (
                  <div className="hms-table" style={{ border: "none", borderRadius: 0 }}>
                    <div className="hms-thead"><div className="hms-tr" style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr" }}><span className="hms-th">Ansatt</span><span className="hms-th">{tab === "quiz" ? "Quiz" : "Kurs"}</span><span className="hms-th">{tab === "quiz" ? "Score" : "Resultat"}</span><span className="hms-th">Status</span></div></div>
                    {(tab === "quiz" ? quizzes : trainings).map((t) => <TrackRow key={t.id} t={t} />)}
                  </div>
                )}
              </H.Panel>
            </div>
          )}

          {tab === "manualer" && (
            <H.Panel icon="file" title="Manualer &amp; lesekvittering" flush>
              <div className="hms-pbody" style={{ paddingBottom: 8 }}>
                <div className="hms-rel-grid">{p.manualIds.map((id) => { const m = H.manual(id); return <Rel key={id} type="manual" title={m.title} sub="Åpne for å lese manualen" onClick={() => openEntity("manual", id)} />; })}{p.manualIds.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>Ingen manualer knyttet ennå.</div>}</div>
              </div>
              {manuals.length === 0 ? <div className="hms-pbody" style={{ color: "var(--muted)", fontSize: 13 }}>Ingen lesekvitteringer registrert.</div> : (
                <div className="hms-table" style={{ border: "none", borderRadius: 0 }}>
                  <div className="hms-thead"><div className="hms-tr" style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr" }}><span className="hms-th">Ansatt</span><span className="hms-th">Manual</span><span className="hms-th">Lest</span><span className="hms-th">Status</span></div></div>
                  {manuals.map((t) => <TrackRow key={t.id} t={t} />)}
                </div>
              )}
            </H.Panel>
          )}

          {tab === "bevis" && (
            <H.Panel icon="camera" title="Bevis og dokumentasjon">
              {allEvi.length === 0 ? <div className="so-empty"><span className="ic"><Ic n="camera" s={22} /></span><div className="t">Ingen bevis ennå</div><div className="s">Bevis genereres når rutiner og oppgaver fullføres.</div></div> : (
                <div className="hms-evi-grid">
                  {allEvi.map((e, i) => (
                    <div key={i} className="hms-evi-thumb">
                      <div className={`hms-evi-img ${e.kind}`}><Ic n={e.kind === "photo" ? "camera" : e.kind === "signoff" ? "check" : "file"} s={22} /></div>
                      <div className="hms-evi-cap"><div className="t">{e.label}</div><div className="m">{e.by} · {e.at}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </H.Panel>
          )}

          {tab === "kommentarer" && (
            <H.Panel icon="message" title="Kommentarer og oppfølging" link="Åpne tråd" onLink={() => openComments({ title: p.title, anchorLabel: p.code, comments })}>
              {comments.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Ingen kommentarer. Åpne tråden for å starte en oppfølging.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {comments.map((cm) => (
                    <div key={cm.id} style={{ display: "flex", gap: 11 }}>
                      <Av id={cm.author} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, marginBottom: 2 }}><strong>{empName(cm.author)}</strong> <span style={{ color: "var(--muted)", fontSize: 11 }}>· {cm.at}</span> {cm.priority !== "normal" && <span className={`hms-cmt-prio ${cm.priority}`}>{cm.priority === "kritisk" ? "Kritisk" : "Høy"}</span>} {cm.resolved && <span className="hms-cstat completed" style={{ padding: "2px 8px", fontSize: 10 }}><Ic n="check" s={10} /> Løst</span>}</div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>{H.withMentions(cm.text)}</div>
                        {cm.owner && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}><Ic n="user" s={11} /> Ansvarlig {empName(cm.owner)}{cm.due ? ` · frist ${cm.due}` : ""}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </H.Panel>
          )}

          {tab === "ansatte" && (
            <H.Panel icon="users" title="Berørte ansatte og beredskap" flush>
              <div className="hms-table" style={{ border: "none", borderRadius: 0 }}>
                <div className="hms-thead"><div className="hms-tr" style={{ gridTemplateColumns: "2fr 1.4fr 1fr" }}><span className="hms-th">Ansatt</span><span className="hms-th">Status på protokoll</span><span className="hms-th">Beredskap</span></div></div>
                {affected.map((e) => {
                  const rec = tracking.find((t) => t.emp === e.id);
                  const rd = SD.HMS_READINESS.find((r) => r.emp === e.id);
                  const st = rec ? rec.status : "due";
                  return (
                    <div key={e.id} className="hms-tr hms-row" data-st={st} style={{ gridTemplateColumns: "2fr 1.4fr 1fr" }}>
                      <div className="hms-empcell"><Av id={e.id} size={32} /><div className="meta"><div className="nm">{e.display}</div><div className="sb">{e.stilling}</div></div></div>
                      <div className="hms-cell"><span className={`hms-cstat ${st}`}><Ic n={st === "completed" ? "check" : st === "overdue" || st === "missing" ? "alert" : "clock"} s={12} />{st === "completed" ? "Oppfylt" : st === "overdue" ? "Forfalt" : st === "missing" ? "Mangler" : "Venter"}</span></div>
                      <div className="hms-cell">{rd ? <span className={`hms-rdverdict ${rd.status}`}>{rd.status === "cleared" ? "Klarert" : rd.status === "overdue" ? "Forsinket" : "Blokkert"}</span> : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}</div>
                    </div>
                  );
                })}
              </div>
            </H.Panel>
          )}

          {tab === "logg" && (
            <H.Panel icon="history" title="Aktivitetslogg" flush>
              {activity.length === 0 ? <div className="hms-pbody" style={{ color: "var(--muted)", fontSize: 13 }}>Ingen aktivitet registrert.</div> : (
                <div className="hms-tl">
                  {activity.map((a) => (
                    <div key={a.id} className="hms-tl-item">
                      <span className={`hms-tl-ic ${a.kind}`}><Ic n={a.kind === "ai" ? "bot" : a.kind === "evidence" ? "camera" : a.kind === "quiz" ? "help" : a.kind === "comment" ? "message" : a.kind === "handbook" ? "book" : a.kind === "protocol" ? "shield" : "check"} s={15} /></span>
                      <div className="hms-tl-b"><span className="who">{empName(a.who)}</span> {a.what}<div className="kind">{a.kind}</div></div>
                      <span className="hms-tl-when">{a.when}</span>
                    </div>
                  ))}
                </div>
              )}
            </H.Panel>
          )}
        </div>
      </main>
    );
  }

  window.HmsProtocols = HmsProtocols;
  window.HmsProtocolDetail = HmsProtocolDetail;
})();
