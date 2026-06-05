// ===== HMS — entity detail readers (handbook · chapter · procedure · routine ·
// training · quiz · manual · legal · process). Everything links to a parent. =====
// Exposes window.Hms<Entity>Detail. Driven by the host nav-stack via props:
//   { crumbs, openEntity, openProto, openCat, openComments, goTab, addEvi, toast }
(function () {
  const { useState, useEffect } = React;
  const H = window.Hms;
  const { Ic, SD, cat, emp, empName, loc, pos, Av, Ring, TypeBadge, Breadcrumb, CatChip, ImpBadge } = H;

  // shared detail hero
  function Hero({ type, catId, title, parent, meta, actions }) {
    const c = cat(catId);
    return (
      <div className="hms-detail-hero">
        <span className="hms-detail-ic" style={catId ? {} : { background: "var(--orange-soft)", color: "var(--orange-dark)" }}><Ic n={(H.TYPE_META[type] || {}).ic || "file"} s={24} /></span>
        <div className="hms-detail-hid">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <TypeBadge type={type} cat={catId} />
            {parent && <button className="hms-typebadge t-muted" onClick={parent.onClick} style={{ cursor: parent.onClick ? "pointer" : "default" }}><Ic n={parent.ic || "link"} s={11} /> {parent.label}</button>}
          </div>
          <div className="hms-detail-nm" style={{ marginTop: 7 }}>{title}</div>
          {meta && <div className="hms-detail-metarow">{meta}</div>}
        </div>
        {actions && <div className="hms-detail-actions">{actions}</div>}
      </div>
    );
  }

  // relation card
  function Rel({ type, tone, title, sub, badge, onClick, disabled }) {
    return (
      <button className={`hms-rel ${disabled ? "disabled" : ""}`} onClick={disabled ? undefined : onClick}>
        <span className={`hms-rel-ic ${tone || ""}`}><Ic n={(H.TYPE_META[type] || {}).ic || "file"} s={18} /></span>
        <span className="hms-rel-b">
          <span className="t">{title} {badge}</span>
          {sub && <span className="s">{sub}</span>}
        </span>
        {!disabled && <span className="hms-rel-go"><Ic n="arrowRight" s={16} /></span>}
      </button>
    );
  }

  // ============================================================
  // HANDBOOK DETAIL (Bibliotek → HMS-håndbok)
  // ============================================================
  function HmsHandbookDetail({ crumbs, openEntity, openProto, goTab, toast }) {
    const b = SD.HMS_BOOK;
    const protocols = SD.HMS_PROTOCOLS;
    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 1000 }}>
          <Breadcrumb items={crumbs} />
          <Hero type="handbok" title={b.name}
            parent={{ label: "Bibliotek", ic: "book", onClick: () => goTab("protokoller") }}
            meta={<>
              <span><Ic n="user" s={13} /> Eier {empName(b.owner)}</span>
              <span><Ic n="shield" s={13} /> Lovpålagt internkontroll</span>
              <span className="mono">{protocols.length} protokoller · {b.chapters.length} kapitler</span>
            </>}
            actions={<button className="sk-ghost" style={{ height: 32 }} onClick={() => toast("Åpner full HMS-håndbok i Bibliotek (Dokumentmodus)")}><Ic n="book" s={14} /> Åpne i Bibliotek</button>}
          />
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px", maxWidth: "64ch" }}>{b.desc}</p>

          {/* chapters → protocols */}
          {b.chapters.map((ch) => (
            <div key={ch.id} className={`hms-cat-${ch.cat}`} style={{ marginBottom: 22 }}>
              <div className="hms-protogroup-head" style={{ marginBottom: 10 }}>
                <span className="bar" style={{ background: "var(--cat)" }} />
                <span className="nm" style={{ fontSize: 19 }}>{ch.title}</span>
                <TypeBadge type="kapittel" />
                <span className="spc" />
                <span className="ct">{ch.path}</span>
              </div>
              <div className="hms-rel-grid">
                {ch.protocols.map((pid) => {
                  const p = SD.HMS_PROTO_BY_ID[pid];
                  return <Rel key={pid} type="protokoll" tone="cat" title={p.title}
                    badge={<><span className="hms-proto-code">{p.code}</span><ImpBadge id={p.importance} /></>}
                    sub={<><span><Ic n="user" s={11} /> {p.ownerRole}</span><span className="mono">Samsvar {p.compliance}%</span><span>{p.routines.length} rutiner · {p.trainingIds.length} kurs</span></>}
                    onClick={() => openProto(pid)} />;
                })}
              </div>
            </div>
          ))}

          <H.Panel icon="info" title="Slik henger det sammen">
            <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--fg)", maxWidth: "66ch" }}>
              <strong>Håndbok</strong> → <strong>Kapittel</strong> → <strong>Protokoll</strong> (policy som håndheves) → <strong>Prosedyrer</strong> (hvordan) → <strong>Rutiner</strong> (når + oppgaver) → <strong>Bevis</strong> (dokumentasjon). Opplæring, quiz, manualer og lovverk knyttes til protokollen.
            </div>
          </H.Panel>
        </div>
      </main>
    );
  }

  // ============================================================
  // PROCEDURE DETAIL (readable content)
  // ============================================================
  function HmsProcedureDetail({ frameId, crumbs, openEntity, openProto, toast }) {
    const pr = H.procedure(frameId);
    if (!pr) return null;
    const p = SD.HMS_PROTO_BY_ID[pr.protocol];
    return (
      <main className={`sk-main hms-cat-${pr.cat}`}>
        <div className="sk-wrap" style={{ maxWidth: 920 }}>
          <Breadcrumb items={crumbs} />
          <Hero type="prosedyre" catId={pr.cat} title={pr.title}
            parent={{ label: "Protokoll: " + p.code, ic: "shield", onClick: () => openProto(p.id) }}
            meta={<>
              <span><Ic n="user" s={13} /> {pr.ownerRole}</span>
              <span><Ic n="repeat" s={13} /> {pr.cadence}</span>
              <span><Ic n="book" s={13} /> {p.handbook.path}</span>
            </>}
            actions={<button className="sk-ghost" style={{ height: 32 }} onClick={() => openEntity("rutine", pr.routine)}><Ic n="repeat" s={14} /> Åpne rutinen</button>}
          />
          <div className="hms-grid2">
            <div className="hms-reader">
              {pr.content.map((s, i) => (
                <div key={i} className="hms-reader-section">
                  {s.h ? <h3>{s.h}</h3> : null}
                  {i === 0 && !s.h ? <p className="hms-reader-lead">{s.p}</p> : <p>{s.p}</p>}
                </div>
              ))}
            </div>
            <div className="hms-stack">
              <H.Panel icon="repeat" title="Brukes av rutinen">
                <Rel type="rutine" tone="cat" title={pr.title} sub={pr.cadence + " · " + pr.ownerRole} onClick={() => openEntity("rutine", pr.routine)} />
              </H.Panel>
              <H.Panel icon="scale" title="Rettslig grunnlag">
                <div className="hms-rel-grid">
                  {(pr.legalIds || []).map((lid) => { const l = H.legal(lid); return <Rel key={lid} type="lovverk" title={l.name} sub={l.basis} onClick={() => openEntity("legal", lid)} />; })}
                </div>
              </H.Panel>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // ROUTINE DETAIL (wraps a procedure · contains tasks · completion → evidence)
  // ============================================================
  function HmsRoutineDetail({ frameId, crumbs, openEntity, openProto, addEvi, toast }) {
    // find the routine inside its protocol
    let r = null, p = null;
    for (const pp of SD.HMS_PROTOCOLS) { const f = (pp.routines || []).find((x) => x.id === frameId); if (f) { r = f; p = pp; break; } }
    if (!r) return null;
    const [tasks, setTasks] = useState(r.tasks.map((t) => ({ ...t })));
    const [completed, setCompleted] = useState(false);
    const allDone = tasks.every((t) => t.status === "done");
    const toggleTask = (id) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, status: t.status === "done" ? "open" : "done" } : t));
    const complete = () => {
      setTasks((ts) => ts.map((t) => ({ ...t, status: "done" })));
      setCompleted(true);
      addEvi && addEvi(p.id, { kind: "signoff", label: "Signert: " + r.name, by: "Maria A.", at: "Nå" });
      toast && toast("Rutine fullført — bevis generert", { undo: () => setCompleted(false) });
    };
    return (
      <main className={`sk-main hms-cat-${p.cat}`}>
        <div className="sk-wrap" style={{ maxWidth: 920 }}>
          <Breadcrumb items={crumbs} />
          <Hero type="rutine" catId={p.cat} title={r.name}
            parent={{ label: "Protokoll: " + p.code, ic: "shield", onClick: () => openProto(p.id) }}
            meta={<>
              <span className="hms-cadence">{r.cadence}</span>
              <span><Ic n="user" s={13} /> {r.ownerRole}</span>
              <span className="mono">Neste: {r.next}</span>
            </>}
            actions={completed
              ? <span className="hms-ai-act done" style={{ height: 34 }}><Ic n="check" s={14} sw={2.4} /> Fullført</span>
              : <button className="sk-primary" style={{ height: 34 }} onClick={complete}><Ic n="check" s={14} c="#fff" sw={2.3} /> Marker rutine fullført</button>}
          />
          <div className="hms-grid2">
            <div className="hms-stack">
              <H.Panel icon="check" title="Oppgaver i rutinen" >
                <div className="hms-tasklist">
                  {tasks.map((t) => {
                    const done = t.status === "done";
                    return (
                      <div key={t.id} className={`hms-tk hms-cat-${p.cat}`} data-st={done ? "done" : t.status} onClick={() => toggleTask(t.id)}>
                        <button className={`hms-tk-check ${done ? "done" : t.status === "overdue" ? "overdue" : ""}`} onClick={(e) => { e.stopPropagation(); toggleTask(t.id); }}>{done && <Ic n="check" s={13} sw={2.6} />}</button>
                        <div className="hms-tk-b">
                          <div className="hms-tk-nm">{t.title}</div>
                          <div className="hms-tk-meta"><span><Ic n="user" s={11} /> {t.role}</span><TypeBadge type="oppgave" /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(allDone || completed) && (
                  <div className="hms-policy-note" style={{ marginTop: 12, borderRadius: "var(--r-md)", border: "1px solid rgba(17,173,50,.3)", background: "rgba(17,173,50,.06)", color: "var(--success)" }}>
                    <span className="ic"><Ic n="camera" s={14} /></span> Alle oppgaver fullført — bevis er generert og lagt på protokollen.
                  </div>
                )}
              </H.Panel>
            </div>
            <div className="hms-stack">
              <H.Panel icon="clipcheck" title="Tilknyttet prosedyre">
                <Rel type="prosedyre" tone="info" title={r.name} sub="Hvordan rutinen utføres — les prosedyren" onClick={() => openEntity("prosedyre", r.procedure)} />
              </H.Panel>
              <H.Panel icon="camera" title="Bevis">
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>Når rutinen fullføres, genereres bevis (signering / foto) automatisk og knyttes til protokollen <strong style={{ color: "var(--fg)" }}>{p.title}</strong>.</div>
                {completed && <div className="hms-evi-grid" style={{ marginTop: 12 }}><div className="hms-evi-thumb"><div className="hms-evi-img signoff"><Ic n="check" s={22} /></div><div className="hms-evi-cap"><div className="t">Signert: {r.name}</div><div className="m">Maria A. · Nå</div></div></div></div>}
              </H.Panel>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // TRAINING PLAYER (flow) — steps through modules, hands off to quiz
  // ============================================================
  const moduleBody = (m, tr) => ([
    `I denne modulen ser vi på «${m.title.toLowerCase()}». Målet er at du trygt kan bruke dette på neste vakt — ikke pugge, men kjenne igjen og handle riktig.`,
    `Det hører til protokollen «${tr.title}», og gjelder for din rolle i daglig drift.`,
  ]);
  const moduleTip = (i) => [
    "Tips: stopp og spør skiftleder hvis noe er uklart — det er alltid bedre enn å gjette.",
    "Husk: avvik registreres i Smartout samme dag, med kort beskrivelse og tiltak.",
    "Bevis: der det kreves foto eller signering, gjør du det rett fra oppgaven på mobilen.",
    "Repetisjon: du kan åpne denne opplæringen igjen når som helst fra protokollen.",
  ][i % 4];

  function HmsTrainingPlayer({ training, p, onClose, openEntity, onTakeQuiz, toast }) {
    const mods = training.modules;
    const total = mods.length;
    const [idx, setIdx] = useState(0);          // 0=cover · 1..total=modul · total+1=fullført
    const quizId = (p.quizIds || [])[0];
    const pct = idx === 0 ? 0 : idx > total ? 100 : Math.round((idx / total) * 100);
    const next = () => { const n = idx + 1; if (n > total) toast && toast("Opplæring fullført — registrert"); setIdx(n); };
    const mins = mods.reduce((s, m) => s + m.mins, 0);
    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, []);
    const m = idx >= 1 && idx <= total ? mods[idx - 1] : null;
    return (
      <div className="guide-viewer" onMouseDown={onClose}>
        <div className={`guide-shell hms-player hms-cat-${training.cat}`} onMouseDown={(e) => e.stopPropagation()}>
          <div className="guide-topbar">
            <button className="guide-close" onClick={onClose}><Ic n="x" s={16} /></button>
            <div className="guide-progress"><div className="guide-progress-bar" style={{ width: pct + "%" }} /></div>
            <span className="guide-progress-label">{pct}%</span>
          </div>
          <div className="guide-content">
            {idx === 0 && (
              <div className="guide-cover">
                <span className="hms-player-kicker"><Ic n="cap" s={12} /> Opplæring</span>
                <h1>{training.title}</h1>
                <p className="guide-sub">{total} moduler · ~{mins} min · knyttet til {p.title}</p>
                <button className="guide-cta btn-lg" onClick={next}><Ic n="play" s={15} c="#fff" /> Start opplæring</button>
                <div className="hms-player-modlist">
                  {mods.map((mm, i) => <div key={i} className="hms-player-modrow"><span className="n">{i + 1}</span><span className="mt">{mm.title}</span><span className="mm">{mm.mins} min</span></div>)}
                </div>
              </div>
            )}
            {m && (
              <div className="guide-step">
                <div className="guide-step-head">
                  <div className="guide-eyebrow">Modul {idx} av {total} · {m.mins} min</div>
                  <h2>{m.title}</h2>
                </div>
                <div className="guide-step-body">
                  {moduleBody(m, training).map((t, i) => <p key={i} className="guide-text">{t}</p>)}
                  <div className="guide-callout tone-tip"><Ic n="sparkle" s={18} /><p>{moduleTip(idx - 1)}</p></div>
                </div>
              </div>
            )}
            {idx > total && (
              <div className="guide-cover">
                <span className="guide-done-ico"><Ic n="check" s={34} c="#fff" sw={2.6} /></span>
                <h1>Fullført!</h1>
                <p className="guide-sub">Du har gjennomført «{training.title}». {quizId ? "Ta quizen for å bekrefte forståelsen." : "Gjennomføringen er registrert på protokollen."}</p>
                {quizId
                  ? <button className="guide-cta btn-lg" onClick={() => (onTakeQuiz ? onTakeQuiz(quizId) : (onClose(), openEntity("quiz", quizId)))}><Ic n="help" s={15} c="#fff" /> Ta quiz nå</button>
                  : <button className="guide-cta btn-lg" onClick={onClose}><Ic n="check" s={15} c="#fff" sw={2.3} /> Lukk</button>}
              </div>
            )}
          </div>
          {idx >= 1 && idx <= total && (
            <div className="hms-player-foot">
              <button className="hms-player-back" onClick={() => setIdx((i) => i - 1)}><Ic n="chevLeft" s={15} /> Tilbake</button>
              <span className="spc" />
              <button className="hms-player-next" onClick={next}>{idx === total ? "Fullfør" : "Neste"} <Ic n="arrowRight" s={15} c="#fff" sw={2.2} /></button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // TRAINING DETAIL
  // ============================================================
  function HmsTrainingDetail({ frameId, crumbs, openEntity, openProto, toast }) {
    const tr = H.training(frameId);
    const [playing, setPlaying] = useState(false);
    const [takeQuiz, setTakeQuiz] = useState(null);
    if (!tr) return null;
    const p = SD.HMS_PROTO_BY_ID[tr.protocol];
    const recs = SD.HMS_TRACKING.filter((t) => t.kind === "training" && t.item === tr.title);
    const completedBy = recs.filter((r) => r.status === "completed");
    return (
      <main className={`sk-main hms-cat-${tr.cat}`}>
        <div className="sk-wrap" style={{ maxWidth: 980 }}>
          <Breadcrumb items={crumbs} />
          <Hero type="opplaring" catId={tr.cat} title={tr.title}
            parent={{ label: "Protokoll: " + p.code, ic: "shield", onClick: () => openProto(p.id) }}
            meta={<><span><Ic n="clock" s={13} /> ~{tr.modules.reduce((s, m) => s + m.mins, 0)} min</span><span className="mono">{tr.modules.length} moduler</span></>}
            actions={<button className="sk-primary" style={{ height: 34 }} onClick={() => setPlaying(true)}><Ic n="play" s={13} c="#fff" /> Start opplæring</button>}
          />
          <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px", lineHeight: 1.6, maxWidth: "62ch" }}>{tr.summary}</p>
          <div className="hms-grid2">
            <H.Panel icon="cap" title="Innhold" flush>
              {tr.modules.map((m, i) => (
                <div key={i} className="hms-mod"><span className="n">{i + 1}</span><span className="mt">{m.title}</span><span className="mm">{m.mins} min</span></div>
              ))}
            </H.Panel>
            <div className="hms-stack">
              <H.Panel icon="users" title="Hvem har fullført" flush>
                <div className="hms-policy-note" style={{ background: "var(--secondary)", color: "var(--muted)" }}><span className="ic"><Ic n="check" s={14} /></span>{completedBy.length} av {recs.length} har fullført</div>
                {recs.map((rec) => (
                  <div key={rec.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                    <Av id={rec.emp} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{empName(rec.emp)}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{emp(rec.emp).stilling}</div></div>
                    <span className={`hms-cstat ${rec.status}`}><Ic n={rec.status === "completed" ? "check" : rec.status === "overdue" || rec.status === "missing" ? "alert" : "clock"} s={12} />{rec.status === "completed" ? "Fullført" : rec.status === "overdue" ? "Forfalt" : rec.status === "missing" ? "Mangler" : "Pågår"}</span>
                  </div>
                ))}
                {recs.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: "var(--muted)" }}>Ingen registreringer ennå.</div>}
              </H.Panel>
              {p.quizIds.length > 0 && (
                <H.Panel icon="help" title="Tilhørende quiz">
                  {p.quizIds.map((qid) => { const q = H.quiz(qid); return <Rel key={qid} type="quiz" tone="purple" title={q.title} sub={"Bestått ≥ " + q.pass + "%"} onClick={() => openEntity("quiz", qid)} />; })}
                </H.Panel>
              )}
            </div>
          </div>
          {playing && <HmsTrainingPlayer training={tr} p={p} onClose={() => setPlaying(false)} openEntity={openEntity} onTakeQuiz={(qid) => { setPlaying(false); setTakeQuiz(qid); }} toast={toast} />}
          {takeQuiz && <HmsQuizPlayer quiz={H.quiz(takeQuiz)} onClose={() => setTakeQuiz(null)} onDone={(sc) => toast && toast(`Quiz registrert — ${sc}%`)} toast={toast} />}
        </div>
      </main>
    );
  }

  // ============================================================
  // QUIZ DETAIL
  // ============================================================
  function HmsQuizDetail({ frameId, crumbs, openProto, toast }) {
    const q = H.quiz(frameId);
    if (!q) return null;
    const p = SD.HMS_PROTO_BY_ID[q.protocol];
    const recs = SD.HMS_TRACKING.filter((t) => t.kind === "quiz" && t.item === q.title);
    const [showAns, setShowAns] = useState(false);
    const [taking, setTaking] = useState(false);
    return (
      <main className={`sk-main hms-cat-${q.cat}`}>
        <div className="sk-wrap" style={{ maxWidth: 980 }}>
          <Breadcrumb items={crumbs} />
          <Hero type="quiz" catId={q.cat} title={q.title}
            parent={{ label: "Protokoll: " + p.code, ic: "shield", onClick: () => openProto(p.id) }}
            meta={<><span className="mono">{q.questions.length} spørsmål</span><span><Ic n="check" s={13} /> Bestått ≥ {q.pass}%</span></>}
            actions={<><button className="btn btn-primary btn-sm" style={{ height: 32 }} onClick={() => setTaking(true)}><Ic n="play" s={14} c="#fff" /> Ta quiz</button><button className="sk-ghost" style={{ height: 32 }} onClick={() => setShowAns((v) => !v)}><Ic n="eye" s={14} /> {showAns ? "Skjul fasit" : "Vis fasit"}</button></>}
          />
          <div className="hms-grid2">
            <H.Panel icon="help" title="Spørsmål" flush>
              {q.questions.map((qq, i) => (
                <div key={i} className="hms-q">
                  <div className="qt"><span className="qn">{i + 1}.</span> {qq.q}</div>
                  {qq.choices.map((ch, ci) => (
                    <div key={ci} className={`hms-q-choice ${showAns && ci === qq.correct ? "correct" : ""}`}>
                      <span className="ck">{showAns && ci === qq.correct && <Ic n="check" s={10} sw={2.8} />}</span>{ch}
                    </div>
                  ))}
                </div>
              ))}
            </H.Panel>
            <H.Panel icon="users" title="Resultater" flush>
              {recs.map((rec) => (
                <div key={rec.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <Av id={rec.emp} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{empName(rec.emp)}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{emp(rec.emp).stilling}</div></div>
                  {rec.status === "completed" ? <span className="mono" style={{ fontWeight: 700, color: "var(--success)" }}>{rec.score}</span> : <span className={`hms-cstat ${rec.status}`}><Ic n="clock" s={12} />{rec.status === "overdue" ? "Forfalt" : rec.status === "missing" ? "Mangler" : "Pågår"}</span>}
                </div>
              ))}
              {recs.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: "var(--muted)" }}>Ingen forsøk ennå.</div>}
            </H.Panel>
          </div>
        </div>
        {taking && <HmsQuizPlayer quiz={q} onClose={() => setTaking(false)} onDone={(sc) => toast && toast(`Quiz registrert — ${sc}%`)} toast={toast} />}
      </main>
    );
  }

  // ============================================================
  // QUIZ PLAYER (interactive) — actually take the quiz, scored, pass/fail
  // ============================================================
  function HmsQuizPlayer({ quiz, onClose, onDone, toast }) {
    const qs = quiz.questions;
    const total = qs.length;
    const [phase, setPhase] = useState("cover");   // cover · q · done
    const [qIdx, setQIdx] = useState(0);
    const [answers, setAnswers] = useState({});
    const [fired, setFired] = useState(false);
    useEffect(() => { const h = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
    const correct = qs.reduce((a, qq, i) => a + (answers[i] === qq.correct ? 1 : 0), 0);
    const score = Math.round((correct / total) * 100);
    const passed = score >= quiz.pass;
    const pct = phase === "cover" ? 0 : phase === "done" ? 100 : Math.round((qIdx / total) * 100);
    useEffect(() => { if (phase === "done" && passed && !fired) { setFired(true); onDone && onDone(score); } }, [phase]);
    const pick = (ci) => setAnswers((a) => ({ ...a, [qIdx]: ci }));
    const advance = () => { if (qIdx + 1 >= total) setPhase("done"); else setQIdx((i) => i + 1); };
    const retry = () => { setAnswers({}); setQIdx(0); setFired(false); setPhase("q"); };
    const m = qs[qIdx];
    const chosen = answers[qIdx];
    return (
      <div className="guide-viewer" onMouseDown={onClose}>
        <div className={`guide-shell hms-player hms-cat-${quiz.cat}`} onMouseDown={(e) => e.stopPropagation()}>
          <div className="guide-topbar">
            <button className="guide-close" onClick={onClose}><Ic n="x" s={16} /></button>
            <div className="guide-progress"><div className="guide-progress-bar" style={{ width: pct + "%" }} /></div>
            <span className="guide-progress-label">{phase === "q" ? `${qIdx + 1}/${total}` : pct + "%"}</span>
          </div>
          <div className="guide-content">
            {phase === "cover" && (
              <div className="guide-cover">
                <span className="hms-player-kicker"><Ic n="help" s={12} /> Quiz</span>
                <h1>{quiz.title}</h1>
                <p className="guide-sub">{total} spørsmål · bestått ved ≥ {quiz.pass}% riktig</p>
                <button className="guide-cta btn-lg" onClick={() => setPhase("q")}><Ic n="play" s={15} c="#fff" /> Start quiz</button>
                <p className="guide-hint">Svar på alle spørsmålene. Du får resultatet til slutt og kan ta den på nytt.</p>
              </div>
            )}
            {phase === "q" && m && (
              <div className="guide-step">
                <div className="guide-step-head">
                  <div className="guide-eyebrow">Spørsmål {qIdx + 1} av {total}</div>
                  <h2>{m.q}</h2>
                </div>
                <div className="guide-step-body">
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {m.choices.map((ch, ci) => {
                      const on = chosen === ci;
                      return (
                        <button key={ci} onClick={() => pick(ci)} style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", padding: "13px 15px", borderRadius: 12, border: "1.5px solid " + (on ? "var(--cat, var(--orange))" : "var(--border)"), background: on ? "var(--cat-soft, var(--secondary))" : "var(--card)", color: "var(--fg)", fontSize: 14, cursor: "pointer", transition: ".12s" }}>
                          <span style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, border: "1.7px solid " + (on ? "var(--cat, var(--orange))" : "var(--border-strong)"), borderWidth: on ? 6 : 1.7, transition: ".12s" }} />
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {phase === "done" && (
              <div className="guide-cover">
                <span className="guide-done-ico" style={{ background: passed ? "var(--success)" : "var(--error)" }}><Ic n={passed ? "check" : "x"} s={34} c="#fff" sw={2.6} /></span>
                <h1>{passed ? "Bestått!" : "Ikke bestått"}</h1>
                <p className="guide-sub">Du fikk <strong>{correct} av {total}</strong> riktig — {score}%. {passed ? "Gjennomføringen er registrert på protokollen." : `Du trenger ${quiz.pass}% for å bestå. Prøv igjen.`}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%", maxWidth: 460, margin: "4px auto 16px", textAlign: "left" }}>
                  {qs.map((qq, i) => {
                    const ok = answers[i] === qq.correct;
                    return (
                      <div key={i} style={{ display: "flex", gap: 9, padding: "9px 12px", borderRadius: 10, background: "var(--secondary)", fontSize: 12.5 }}>
                        <span style={{ color: ok ? "var(--success)" : "var(--error)", flexShrink: 0, marginTop: 1 }}><Ic n={ok ? "check" : "x"} s={14} sw={2.4} /></span>
                        <div><div style={{ fontWeight: 600 }}>{qq.q}</div>{!ok && <div style={{ color: "var(--muted)", marginTop: 2 }}>Riktig: {qq.choices[qq.correct]}</div>}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 9, justifyContent: "center" }}>
                  <button className="btn btn-secondary" onClick={retry}><Ic n="undo" s={14} /> Ta på nytt</button>
                  <button className="guide-cta" style={{ marginTop: 0 }} onClick={onClose}><Ic n="check" s={15} c="#fff" sw={2.3} /> Lukk</button>
                </div>
              </div>
            )}
          </div>
          {phase === "q" && (
            <div className="hms-player-foot">
              <button className="hms-player-back" onClick={() => (qIdx === 0 ? setPhase("cover") : setQIdx((i) => i - 1))}><Ic n="chevLeft" s={15} /> Tilbake</button>
              <span className="spc" />
              <button className="hms-player-next" disabled={chosen == null} onClick={advance} style={{ opacity: chosen == null ? 0.5 : 1 }}>{qIdx + 1 === total ? "Se resultat" : "Neste"} <Ic n="arrowRight" s={15} c="#fff" sw={2.2} /></button>
            </div>
          )}
        </div>
      </div>
    );
  }
  // ============================================================
  function HmsManualPlayer({ manual, p, onClose, onComplete, toast }) {
    const secs = manual.sections;
    const total = secs.length;
    const [idx, setIdx] = useState(0);          // 0=cover · 1..total=seksjon · total+1=lest
    const [fired, setFired] = useState(false);
    const pct = idx === 0 ? 0 : idx > total ? 100 : Math.round((idx / total) * 100);
    const next = () => { const n = idx + 1; if (n > total && !fired) { setFired(true); onComplete && onComplete(); toast && toast("Manual registrert som lest"); } setIdx(n); };
    useEffect(() => { const h = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
    const s = idx >= 1 && idx <= total ? secs[idx - 1] : null;
    return (
      <div className="guide-viewer" onMouseDown={onClose}>
        <div className={`guide-shell hms-player hms-cat-${manual.cat}`} onMouseDown={(e) => e.stopPropagation()}>
          <div className="guide-topbar">
            <button className="guide-close" onClick={onClose}><Ic n="x" s={16} /></button>
            <div className="guide-progress"><div className="guide-progress-bar" style={{ width: pct + "%" }} /></div>
            <span className="guide-progress-label">{pct}%</span>
          </div>
          <div className="guide-content">
            {idx === 0 && (
              <div className="guide-cover">
                <span className="hms-player-kicker"><Ic n="file" s={12} /> Manual</span>
                <h1>{manual.title}</h1>
                <p className="guide-sub">{total} seksjoner · les gjennom for å bekrefte</p>
                <button className="guide-cta btn-lg" onClick={next}><Ic n="book" s={15} c="#fff" /> Les manualen</button>
                <p className="guide-hint">Lesekvittering registreres først når du har vært gjennom alle seksjonene.</p>
              </div>
            )}
            {s && (
              <div className="guide-step">
                <div className="guide-step-head">
                  <div className="guide-eyebrow">Del {idx} av {total}</div>
                  <h2>{s.h}</h2>
                </div>
                <div className="guide-step-body"><p className="guide-text">{s.p}</p></div>
              </div>
            )}
            {idx > total && (
              <div className="guide-cover">
                <span className="guide-done-ico"><Ic n="check" s={34} c="#fff" sw={2.6} /></span>
                <h1>Lest og bekreftet</h1>
                <p className="guide-sub">«{manual.title}» er registrert som lest på din profil, med tidspunkt.</p>
                <button className="guide-cta btn-lg" onClick={onClose}><Ic n="check" s={15} c="#fff" sw={2.3} /> Lukk</button>
              </div>
            )}
          </div>
          {idx >= 1 && idx <= total && (
            <div className="hms-player-foot">
              <button className="hms-player-back" onClick={() => setIdx((i) => i - 1)}><Ic n="chevLeft" s={15} /> Tilbake</button>
              <span className="spc" />
              <button className="hms-player-next" onClick={next}>{idx === total ? "Bekreft lest" : "Neste"} <Ic n="arrowRight" s={15} c="#fff" sw={2.2} /></button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // MANUAL DETAIL (readable — clearly distinct from handbook/protocol)
  // ============================================================
  function HmsManualDetail({ frameId, crumbs, openProto, toast }) {
    const m = H.manual(frameId);
    const [playing, setPlaying] = useState(false);
    const [read, setRead] = useState(false);
    if (!m) return null;
    const p = SD.HMS_PROTO_BY_ID[m.protocol];
    const reads = SD.HMS_TRACKING.filter((t) => t.kind === "manual" && t.item === m.title);
    return (
      <main className={`sk-main hms-cat-${m.cat}`}>
        <div className="sk-wrap" style={{ maxWidth: 860 }}>
          <Breadcrumb items={crumbs} />
          <Hero type="manual" catId={m.cat} title={m.title}
            parent={{ label: "Protokoll: " + p.code, ic: "shield", onClick: () => openProto(p.id) }}
            meta={<><span><Ic n="file" s={13} /> Lesbar manual</span><span className="mono">{m.sections.length} seksjoner</span></>}
            actions={read
              ? <span className="hms-ai-act done" style={{ height: 34 }}><Ic n="check" s={14} sw={2.4} /> Lest og bekreftet</span>
              : <button className="sk-primary" style={{ height: 34 }} onClick={() => setPlaying(true)}><Ic n="book" s={13} c="#fff" /> Les manualen</button>}
          />
          <div className="hms-policy-note" style={{ borderRadius: "var(--r-lg)", border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--muted)", marginBottom: 18 }}>
            <span className="ic"><Ic n="info" s={14} /></span> Lesekvittering registreres først når du har lest manualen gjennom i <strong style={{ color: "var(--fg)", margin: "0 4px" }}>Veiledning</strong> — ikke ved étt klikk.
          </div>
          <div className="manual-cover" style={{ borderLeftColor: "var(--cat)", marginBottom: 24 }}>
            <div className="label" style={{ color: "var(--cat)" }}>Manual · {p.title}</div>
            <p className="desc" style={{ marginBottom: 0 }}>{m.summary}</p>
          </div>
          <div className="hms-reader">
            {m.sections.map((s, i) => (
              <div key={i} className="hms-reader-section"><h3>{s.h}</h3><p>{s.p}</p></div>
            ))}
          </div>
          {reads.length > 0 && (
            <H.Panel icon="users" title="Lesekvitteringer" flush>
              {reads.map((rec) => (
                <div key={rec.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <Av id={rec.emp} size={30} /><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{empName(rec.emp)}</div></div>
                  <span className={`hms-cstat ${rec.status}`}><Ic n={rec.status === "completed" ? "check" : "alert"} s={12} />{rec.status === "completed" ? "Lest" : rec.status === "missing" ? "Ikke lest" : "Pågår"}</span>
                </div>
              ))}
            </H.Panel>
          )}
          {playing && <HmsManualPlayer manual={m} p={p} onClose={() => setPlaying(false)} onComplete={() => setRead(true)} toast={toast} />}
        </div>
      </main>
    );
  }

  // ============================================================
  // LEGAL + PROCESS (compact)
  // ============================================================
  function HmsLegalDetail({ frameId, crumbs, openProto }) {
    const l = H.legal(frameId);
    if (!l) return null;
    const related = SD.HMS_PROTOCOLS.filter((p) => (p.legalIds || []).includes(frameId));
    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 880 }}>
          <Breadcrumb items={crumbs} />
          <Hero type="lovverk" title={l.name} meta={<><span className="mono">{l.basis}</span><span>{l.scope}</span></>}
            actions={<button className="sk-ghost" style={{ height: 32 }} onClick={() => { const u = String(l.url || ""); window.open(/^https?:\/\//.test(u) ? u : "https://" + u, "_blank", "noopener"); }}><Ic n="link" s={14} /> {l.url}</button>} />
          <H.Panel icon="shield" title="Protokoller som bygger på dette lovverket">
            <div className="hms-rel-grid">
              {related.map((p) => <Rel key={p.id} type="protokoll" tone="cat" title={p.title} badge={<span className="hms-proto-code">{p.code}</span>} sub={<CatChip id={p.cat} />} onClick={() => openProto(p.id)} />)}
              {related.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Ingen protokoller knyttet ennå.</div>}
            </div>
          </H.Panel>
        </div>
      </main>
    );
  }

  function HmsProcessDetail({ frameId, crumbs, openProto, toast }) {
    const x = H.process(frameId);
    if (!x) return null;
    const related = SD.HMS_PROTOCOLS.filter((p) => (p.processIds || []).includes(frameId));
    const bookName = x.book === "hms" ? "HMS-håndbok" : x.book === "bedrift" ? "Bedriftshåndbok" : "Personalhåndbok";
    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 880 }}>
          <Breadcrumb items={crumbs} />
          <Hero type="prosess" title={x.name}
            parent={{ label: bookName + " › " + x.chapter, ic: "book", onClick: () => toast("Åpner " + bookName + " i Bibliotek") }}
            meta={<span>{x.desc}</span>} />
          <H.Panel icon="shield" title="Protokoller som inngår i prosessen">
            <div className="hms-rel-grid">
              {related.map((p) => <Rel key={p.id} type="protokoll" tone="cat" title={p.title} badge={<span className="hms-proto-code">{p.code}</span>} sub={<CatChip id={p.cat} />} onClick={() => openProto(p.id)} />)}
              {related.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Ingen protokoller knyttet ennå.</div>}
            </div>
          </H.Panel>
        </div>
      </main>
    );
  }

  Object.assign(window, {
    HmsHandbookDetail, HmsProcedureDetail, HmsRoutineDetail,
    HmsTrainingDetail, HmsQuizDetail, HmsManualDetail, HmsLegalDetail, HmsProcessDetail, HmsRel: Rel, HmsHero: Hero,
  });
})();
