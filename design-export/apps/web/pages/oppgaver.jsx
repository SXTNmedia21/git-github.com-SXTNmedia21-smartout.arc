// ===== Oppgaver — Shift Task Board (operativt) =====
// Two perspectives on the operation: PROAKTIVT (rutiner → genererte oppgaver) og
// REAKTIVT (ad-hoc + avviksoppfølging). Three tabs: Oversikt · Oppgaver (rak liste)
// · Rutiner. The reusable task control element is <TaskRow/>. Documentation &
// training live in Bibliotek / Opplæring — this surface is execution only.
(function () {
  const { useState, useMemo, useRef, useEffect } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  const TEAM = ["jh", "sl", "pk", "ib", "ma"];
  const BOOK = {
    hms: { label: "HMS", color: "#f97316" },
    bedrift: { label: "Bedrift", color: "#8b5cf6" },
    personal: { label: "Personal", color: "#008388" },
  };
  const deadlineTone = (t) =>
    t.status === "overdue" ? "crit" : t.priority === "critical" ? "crit" : t.priority === "high" ? "warn" : "";
  const isProactive = (t) => t.origin === "session" || t.origin === "protocol";

  // ---------- small shared bits ----------
  function Av({ id, size = 26 }) {
    const u = D().USERS[id];
    if (!u) return null;
    return <span className="so-av" style={{ width: size, height: size, background: u.color, fontSize: size * 0.4 }}>{u.initials}</span>;
  }
  const ORIGIN_CAT = {
    ikmat: { label: "IK-mat", color: "#c2700c" },
    oppgave: { label: "Oppgave", color: "#7a756e" },
    vern: { label: "Vernerunde", color: "#3c8c4a" },
    brann: { label: "Brannvern", color: "#e7000b" },
  };
  function Origin({ task, o }) {
    const c = task && task.cat ? ORIGIN_CAT[task.cat] : null;
    const m = c || D().ORIGIN[o != null ? o : (task ? task.origin : "adhoc")];
    return <span className="opp-origin" style={{ color: m.color, background: m.color + "1c" }}>{m.label}</span>;
  }
  function useOutside(ref, on) {
    useEffect(() => {
      if (!on) return;
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) on(); };
      document.addEventListener("mousedown", h);
      return () => document.removeEventListener("mousedown", h);
    }, [on]);
  }

  function ChapterLink({ book, chapter, onOpen }) {
    if (!book) return <span className="opp-chap none" onClick={(e) => { e.stopPropagation(); onOpen && onOpen(null); }}><Ic n="link" s={12} /> Ikke knyttet</span>;
    const b = BOOK[book];
    return (
      <span className="opp-chap" style={{ color: b.color }} title={`${b.label}-håndbok › ${chapter}`} onClick={(e) => { e.stopPropagation(); onOpen && onOpen(book, chapter); }}>
        <span className="dot" style={{ background: b.color }} /><span className="bk">{b.label}</span><span className="sl">›</span>{chapter}
      </span>
    );
  }

  const makeMutators = (setTasks, toast) => ({
    toggleStatus: (id) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done", completedAt: t.status === "done" ? null : "Nettopp" } : t)),
    reassign: (id, uid) => { setTasks((ts) => ts.map((t) => t.id === id ? { ...t, assignee: uid } : t)); toast(`Tildelt ${D().USERS[uid].name.split(" ")[0]}`, { undo: () => {} }); },
    duplicate: (id) => { setTasks((ts) => { const t = ts.find((x) => x.id === id); if (!t) return ts; const copy = { ...t, id: "t" + Date.now(), title: t.title + " (kopi)", status: "todo", origin: "adhoc", subtasks: t.subtasks.map((s) => ({ ...s, done: false })) }; return [copy, ...ts]; }); toast("Oppgave duplisert"); },
  });

  // ===================================================================
  // THE TASK CONTROL ELEMENT
  // ===================================================================
  function TaskRow({ task, coord, selected, onToggleSel, onToggleStatus, onReassign, onOpen, onDuplicate, onChapter, toast }) {
    const { USERS, FOLDERS } = D();
    const folder = FOLDERS.find((f) => f.id === task.folder);
    const subDone = task.subtasks.filter((s) => s.done).length;
    const subTotal = task.subtasks.length;
    const [reassign, setReassign] = useState(false);
    const [more, setMore] = useState(false);
    const raRef = useRef(null), moRef = useRef(null);
    useOutside(raRef, () => setReassign(false));
    useOutside(moRef, () => setMore(false));
    const done = task.status === "done";

    return (
      <div
        className={`opp-row ${coord ? "coord" : ""} ${selected ? "sel" : ""} ${done ? "done" : ""}`}
        data-pri={task.priority} data-status={task.status}
        onClick={() => (coord ? onToggleSel(task.id) : onOpen(task.id))}
      >
        {coord && (
          <span className={`opp-pick ${selected ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); onToggleSel(task.id); }}>
            {selected && <Ic n="check" s={13} sw={3} />}
          </span>
        )}

        <button
          className={`opp-toggle ${task.status}`}
          title={done ? "Gjenåpne" : "Marker ferdig"}
          onClick={(e) => { e.stopPropagation(); onToggleStatus(task.id); }}
        >
          {done && <Ic n="check" s={13} sw={3} />}
        </button>

        <div className="opp-row-main">
          <div className="opp-row-top">
            <Origin task={task} />
            <span className="opp-row-title">{task.title}</span>
          </div>
          <div className="opp-row-meta">
            {task.deadline && (
              <span className={`deadline ${deadlineTone(task)}`}>
                {task.deadline}{task.deadlineRel ? ` · ${task.deadlineRel}` : ""}
              </span>
            )}
            {task.deadline && <span className="sep" />}
            <ChapterLink book={task.book} chapter={task.chapter} onOpen={onChapter} />
            {task.location && (<><span className="sep" /><span className="loc"><Ic n="mappin" s={11} /> {task.location}</span></>)}
          </div>
        </div>

        <div className="opp-row-side">
          {subTotal > 0 && (
            <span className="opp-prog" title={`${subDone} av ${subTotal} delsteg`}>
              {subDone === subTotal && <span className="ring" />}{subDone}/{subTotal}
            </span>
          )}
          <span className="opp-row-flags">
            {task.manual && <Ic n="book" s={14} title="Tilknyttet manual" />}
            {task.requiresEvidence && <Ic n="camera" s={14} title="Krever bevis" />}
            {task.requiresApproval && <Ic n="checkdoc" s={14} title="Krever godkjenning" />}
          </span>

          {/* assignee — click to reassign (koordinere) */}
          <span className="opp-assign" ref={raRef}>
            <span onClick={(e) => { e.stopPropagation(); setReassign((v) => !v); }} style={{ cursor: "pointer", display: "inline-flex" }} title="Tildel på nytt">
              {task.assignee ? <Av id={task.assignee} size={26} /> : task.audience ? <span className="add-av" title={task.audience.label} style={{ background: "var(--fg)", color: "var(--bg)" }}><Ic n="users" s={13} /></span> : <span className="add-av"><Ic n="plus" s={13} /></span>}
            </span>
            {reassign && (
              <div className="opp-menu right" onClick={(e) => e.stopPropagation()}>
                <div className="opp-menu-head">Tildel til</div>
                {TEAM.map((uid) => (
                  <div key={uid} className={`opp-menu-item ${task.assignee === uid ? "active" : ""}`}
                    onClick={() => { onReassign(task.id, uid); setReassign(false); }}>
                    <Av id={uid} size={22} /> {USERS[uid].name}
                    {task.assignee === uid && <span className="check"><Ic n="check" s={14} sw={2.6} /></span>}
                  </div>
                ))}
              </div>
            )}
          </span>

          {!coord && (
            <span className="opp-row-acts" ref={moRef}>
              <button className="opp-act" title="Rediger" onClick={(e) => { e.stopPropagation(); onOpen(task.id); }}><Ic n="pen" s={15} /></button>
              <button className="opp-act" title="Mer" onClick={(e) => { e.stopPropagation(); setMore((v) => !v); }}><Ic n="sliders" s={15} /></button>
              {more && (
                <div className="opp-menu right" onClick={(e) => e.stopPropagation()} style={{ top: "calc(100% + 4px)" }}>
                  <div className="opp-menu-item" onClick={() => { setMore(false); onDuplicate(task.id); }}><Ic n="copy" s={15} /> Dupliser</div>
                  <div className="opp-menu-item" onClick={() => { setMore(false); toast("Påminnelse sendt"); }}><Ic n="bell" s={15} /> Send påminnelse</div>
                  <div className="opp-menu-item" onClick={() => { setMore(false); toast("Oppgave flyttet til Dagslinjen"); }}><Ic n="route" s={15} /> Til Dagslinjen</div>
                  <div className="opp-menu-item" onClick={() => { setMore(false); onToggleStatus(task.id); }}><Ic n="check" s={15} /> {done ? "Gjenåpne" : "Marker ferdig"}</div>
                </div>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ===================================================================
  // OVERVIEW
  // ===================================================================
  function Overview({ tasks, setTab, onAdhoc, toast, onOpenRoutine, focusCompose }) {
    const { ROUTINES, TASK_BOARD, USERS } = D();
    const open = tasks.filter((t) => t.status !== "done");
    const doneToday = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter((t) => t.status === "overdue").length;
    const proactive = tasks.filter(isProactive).length;
    const reactive = tasks.length - proactive;
    const activeRoutines = ROUTINES.filter((r) => r.active).length;
    const behindRoutines = ROUTINES.filter((r) => r.active && r.behind).length;
    const onTrack = Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);

    // split segments by origin
    const byOrigin = ["session", "protocol", "adhoc", "deviation"].map((o) => ({
      o, n: tasks.filter((t) => t.origin === o).length, m: D().ORIGIN[o],
    }));
    const maxBoard = Math.max(...TASK_BOARD.map((b) => b.done));

    return (
      <>
        <div className="opp-pulse">
          <div className="pulse" onClick={() => setTab("oppgaver")}>
            <span className="pulse-edge" style={{ background: "var(--success)" }} />
            <div className="pulse-lbl"><span className="ico"><Ic n="check" s={13} /></span>Fullført i dag</div>
            <div className="pulse-val ok">{doneToday}<span className="u">/ {tasks.length}</span></div>
            <div className="pulse-sub">{onTrack}% av dagens oppgaver</div>
          </div>
          <div className="pulse" onClick={() => setTab("oppgaver")}>
            <span className="pulse-edge" style={{ background: "var(--error)" }} />
            <div className="pulse-lbl"><span className="ico"><Ic n="alert" s={13} /></span>Forsinket</div>
            <div className="pulse-val crit">{overdue}</div>
            <div className="pulse-sub">{open.length} aktive totalt</div>
          </div>
          <div className="pulse" onClick={() => setTab("rutiner")}>
            <span className="pulse-edge" style={{ background: behindRoutines ? "var(--warning)" : "var(--success)" }} />
            <div className="pulse-lbl"><span className="ico"><Ic n="repeat" s={13} /></span>Aktive rutiner</div>
            <div className={`pulse-val ${behindRoutines ? "warn" : ""}`}>{activeRoutines}</div>
            <div className="pulse-sub">{behindRoutines ? `${behindRoutines} ligger bak` : "alle i rute"}</div>
          </div>
          <div className="pulse" onClick={() => setTab("oppgaver")}>
            <span className="pulse-edge" style={{ background: "var(--orange)" }} />
            <div className="pulse-lbl"><span className="ico"><Ic n="layers" s={13} /></span>Proaktiv andel</div>
            <div className="pulse-val">{Math.round((proactive / tasks.length) * 100)}<span className="u">%</span></div>
            <div className="pulse-sub">{proactive} rutine · {reactive} reaktivt</div>
          </div>
        </div>

        {/* Botsson assist */}
        <div className="so-panel" style={{ marginBottom: 16 }}>
          <div className="opp-ai">
            <span className="opp-ai-av"><Ic n="bot" s={19} /></span>
            <div className="opp-ai-body">
              <div className="n">Botsson <span className="tag">FORSLAG</span></div>
              <p>
                <strong>Renhold gjestetoaletter</strong> ligger bak skjema — morgenøkten er ikke kvittert ut, og kveldsøkten starter 16:00. Jeg kan tildele den til <strong>Ida B.</strong> som er på vakt nå. <strong>Petter</strong> har lav belastning i dag.
              </p>
              <div className="opp-ai-acts">
                <button className="opp-ai-btn primary" onClick={() => toast("Renhold tildelt Ida B.", { undo: () => {} })}><Ic n="user" s={14} /> Tildel Ida B.</button>
                <button className="opp-ai-btn" onClick={() => toast("Forslaget avvist")}>Avvis</button>
                <button className="opp-ai-btn" onClick={() => setTab("rutiner")}><Ic n="eye" s={14} /> Se rutinen</button>
              </div>
            </div>
          </div>
        </div>

        <div className="so-grid-2">
          <div className="so-stack">
            {/* Proaktiv vs reaktiv */}
            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="layers" s={15} /></span>Proaktivt vs. reaktivt</span><span className="spacer" /><span className="so-eyebrow-lbl">I dag</span></div>
              <div className="opp-split">
                <div className="opp-split-bar">
                  {byOrigin.map((b) => b.n > 0 && (
                    <span key={b.o} style={{ width: `${(b.n / tasks.length) * 100}%`, background: b.m.color }} />
                  ))}
                </div>
                <div className="opp-split-legend">
                  {byOrigin.map((b) => (
                    <div key={b.o} className="opp-split-leg">
                      <span className="sw" style={{ background: b.m.color }} />
                      <span className="lbl">{b.m.label}<small>{b.o === "session" ? "Generert av rutiner" : b.o === "protocol" ? "Fra opplæringsprotokoll" : b.o === "adhoc" ? "Manuelt opprettet" : "Oppfølging av avvik"}</small></span>
                      <span className="cnt" style={{ color: b.m.color }}>{b.n}</span>
                      <span className="pct">{Math.round((b.n / tasks.length) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Routine status */}
            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="repeat" s={15} /></span>Rutine-status</span><span className="cnt">{ROUTINES.filter((r) => r.active).length}</span><span className="spacer" /><button className="link" onClick={() => setTab("rutiner")}>Alle rutiner <Ic n="arrowRight" s={13} /></button></div>
              <div className="opp-rs">
                {ROUTINES.filter((r) => r.active).slice(0, 6).map((r) => {
                  const pct = Math.round(r.completion * 100);
                  return (
                    <div key={r.id} className="opp-rs-row" onClick={() => onOpenRoutine(r.id)}>
                      <span className={`opp-rs-ic ${r.behind ? "behind" : "ok"}`}><Ic n={r.behind ? "alert" : "repeat"} s={15} /></span>
                      <div className="opp-rs-main">
                        <div className="opp-rs-title">{r.title}</div>
                        <div className="opp-rs-meta">{r.trigger} · {r.scope}</div>
                      </div>
                      <div className="opp-rs-side">
                        <span className={`opp-rs-pct ${r.behind ? "behind" : "ok"}`}>{pct}%</span>
                        <span className="opp-rs-track"><span style={{ width: `${pct}%`, background: r.behind ? "var(--warning)" : "var(--success)" }} /></span>
                      </div>
                      <span className="opp-rs-go"><Ic n="chevRight" s={16} /></span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="so-stack">
            {/* Ad-hoc compose */}
            <AdhocCompose onAdd={onAdhoc} toast={toast} focusSignal={focusCompose} />

            {/* Scoreboard */}
            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="star" s={15} /></span>Toppliste · denne uka</span><span className="spacer" /><span className="so-eyebrow-lbl">Fullførte</span></div>
              <div className="opp-board">
                {TASK_BOARD.map((b, i) => {
                  const u = USERS[b.id];
                  return (
                    <div key={b.id} className={`opp-board-row ${i === 0 ? "top1" : ""}`}>
                      <span className="opp-board-rank">{i + 1}</span>
                      <span className="opp-board-id">
                        <Av id={b.id} size={30} />
                        <span style={{ minWidth: 0 }}><span className="nm">{u.name}</span><span className="rl" style={{ display: "block" }}>{u.role}</span></span>
                      </span>
                      <span className="opp-board-bar"><span style={{ width: `${(b.done / maxBoard) * 100}%` }} /></span>
                      <span className="opp-board-num">
                        <span className="v">{i === 0 && <span className="opp-board-crown"><Ic n="star" s={12} c="var(--orange)" /></span>} {b.done}</span>
                        <span className="k">{Math.round(b.ontime * 100)}% i tide</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  function AdhocCompose({ onAdd, toast, focusSignal }) {
    const SD = D();
    const { USERS, PRIORITY } = SD;
    const DEPARTMENTS = SD.DEPARTMENTS || {}, TEAMS = SD.TEAMS || {}, LOCATIONS = SD.LOCATIONS || {};
    const [title, setTitle] = useState("");
    const [target, setTarget] = useState({ kind: "person", id: "ma" });
    const [atab, setATab] = useState("person");
    const [pri, setPri] = useState("normal");
    const [when, setWhen] = useState("I dag");
    const [aOpen, setAOpen] = useState(false), [pOpen, setPOpen] = useState(false), [wOpen, setWOpen] = useState(false);
    const aRef = useRef(null), pRef = useRef(null), wRef = useRef(null);
    const inputRef = useRef(null);
    useEffect(() => { if (focusSignal) { try { inputRef.current && inputRef.current.focus(); } catch (e) {} } }, [focusSignal]);
    useOutside(aRef, () => setAOpen(false));
    useOutside(pRef, () => setPOpen(false));
    useOutside(wRef, () => setWOpen(false));
    const GROUP_META = { dept: { label: "Avdeling", src: DEPARTMENTS }, loc: { label: "Område", src: LOCATIONS }, team: { label: "Lag", src: TEAMS } };
    const targetLabel = () => target.kind === "person" ? USERS[target.id].name.split(" ")[0] : ((GROUP_META[target.kind].src[target.id] || {}).name || target.id);
    const targetColor = () => target.kind === "dept" ? (DEPARTMENTS[target.id] || {}).color : null;
    const submit = () => {
      if (!title.trim()) return;
      const isP = target.kind === "person";
      const audience = isP ? null : { kind: target.kind, id: target.id, label: targetLabel() };
      const assignee = isP ? target.id : ((GROUP_META[target.kind].src[target.id] || {}).leader || null);
      onAdd({ title: title.trim(), assignee, audience, priority: pri, when });
      toast(`Oppgave tildelt ${isP ? USERS[target.id].name.split(" ")[0] : targetLabel() + " (gruppe)"}`, { undo: () => {} });
      setTitle(""); setPri("normal"); setWhen("I dag");
    };
    return (
      <div className="so-panel opp-compose-panel">
        <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="zap" s={15} /></span>Legg til ad-hoc oppgave</span></div>
        <div className="opp-compose">
          <div className="opp-compose-field">
            <span className="ic"><Ic n="plus" s={16} /></span>
            <input ref={inputRef} value={title} placeholder="Hva må gjøres? F.eks. «Bytt ølfat – IPA»" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          <div className="opp-compose-opts">
            <span style={{ position: "relative" }} ref={aRef}>
              <button className="opp-mini set" onClick={() => setAOpen((v) => !v)}>
                {target.kind === "person"
                  ? <><Av id={target.id} size={18} /> {targetLabel()}</>
                  : <><span style={{ width: 17, height: 17, borderRadius: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", background: targetColor() || "var(--fg)", color: "#fff" }}><Ic n="users" s={11} /></span> {targetLabel()}</>}
              </button>
              {aOpen && (
                <div className="opp-menu" style={{ width: 256 }}>
                  <div className="opp-menu-head">Tildel til</div>
                  <div style={{ display: "flex", gap: 4, padding: "0 8px 8px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
                    {[["person", "Person"], ["dept", "Avdeling"], ["loc", "Område"], ["team", "Lag"]].map(([k, l]) => (
                      <button key={k} onClick={() => setATab(k)} style={{ flex: 1, fontSize: 10.5, fontWeight: 600, padding: "5px 3px", borderRadius: 7, border: "1px solid " + (atab === k ? "var(--border-strong)" : "transparent"), background: atab === k ? "var(--secondary)" : "transparent", color: atab === k ? "var(--fg)" : "var(--muted)", cursor: "pointer" }}>{l}</button>
                    ))}
                  </div>
                  {atab === "person" && TEAM.map((uid) => (
                    <div key={uid} className={`opp-menu-item ${target.kind === "person" && target.id === uid ? "active" : ""}`} onClick={() => { setTarget({ kind: "person", id: uid }); setAOpen(false); }}>
                      <Av id={uid} size={22} /> {USERS[uid].name}{target.kind === "person" && target.id === uid && <span className="check"><Ic n="check" s={14} sw={2.6} /></span>}
                    </div>
                  ))}
                  {atab !== "person" && Object.values(GROUP_META[atab].src).map((g) => (
                    <div key={g.id} className={`opp-menu-item ${target.kind === atab && target.id === g.id ? "active" : ""}`} onClick={() => { setTarget({ kind: atab, id: g.id }); setAOpen(false); }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", background: g.color || "var(--fg)", color: "#fff" }}><Ic n="users" s={13} /></span> {g.name}
                      {target.kind === atab && target.id === g.id && <span className="check"><Ic n="check" s={14} sw={2.6} /></span>}
                    </div>
                  ))}
                </div>
              )}
            </span>
            <span style={{ position: "relative" }} ref={pRef}>
              <button className={`opp-mini ${pri !== "normal" ? "set" : ""}`} onClick={() => setPOpen((v) => !v)} style={{ color: pri !== "normal" ? PRIORITY[pri].color : undefined }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY[pri].color, display: "inline-block" }} /> {PRIORITY[pri].label}
              </button>
              {pOpen && (
                <div className="opp-menu"><div className="opp-menu-head">Prioritet</div>
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <div key={k} className={`opp-menu-item ${pri === k ? "active" : ""}`} onClick={() => { setPri(k); setPOpen(false); }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, display: "inline-block" }} /> {v.label}
                    </div>
                  ))}
                </div>
              )}
            </span>
            <span style={{ position: "relative" }} ref={wRef}>
              <button className={`opp-mini ${when !== "I dag" ? "set" : ""}`} onClick={() => setWOpen((v) => !v)}><Ic n="clock" s={14} /> {when}</button>
              {wOpen && (
                <div className="opp-menu"><div className="opp-menu-head">Frist</div>
                  {["Nå", "I dag", "Før 12:00", "Før vaktslutt", "I morgen"].map((w) => (
                    <div key={w} className={`opp-menu-item ${when === w ? "active" : ""}`} onClick={() => { setWhen(w); setWOpen(false); }}>{w}</div>
                  ))}
                </div>
              )}
            </span>
          </div>
          <div className="opp-compose-foot">
            <span className="hint">Tildel en <strong>person</strong> — eller en <strong>Avdeling</strong>, <strong>Område</strong> eller <strong>Lag</strong>. Havner i <strong>Oppgaver</strong>, <strong>Dagslinjen</strong> og <strong>Min dag</strong> for alle i målgruppen.</span>
            <button className="btn btn-primary btn-sm" disabled={!title.trim()} onClick={submit} style={{ opacity: title.trim() ? 1 : 0.5 }}><Ic n="send" s={14} /> Opprett & tildel</button>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================================
  // FLAT TASK LIST (rak liste)
  // ===================================================================
  const FILTERS = [
    { id: "all", label: "Alle" },
    { id: "me", label: "Tildelt meg" },
    { id: "critical", label: "Kritisk" },
    { id: "inprogress", label: "Pågår" },
    { id: "overdue", label: "Forsinket" },
    { id: "done", label: "Ferdig" },
  ];
  const ORIGIN_FILTERS = [
    { id: "all", label: "Alle kilder" },
    { id: "proactive", label: "Proaktivt" },
    { id: "reactive", label: "Reaktivt" },
  ];

  function TaskList({ tasks, setTasks, toast, onOpen, onChapter }) {
    const { ME } = D();
    const [filter, setFilter] = useState("all");
    const [origin, setOrigin] = useState("all");
    const [q, setQ] = useState("");
    const [sort, setSort] = useState("priority");
    const [coord, setCoord] = useState(false);
    const [sel, setSel] = useState(() => new Set());
    const [sortOpen, setSortOpen] = useState(false);
    const sortRef = useRef(null);
    useOutside(sortRef, () => setSortOpen(false));

    const counts = useMemo(() => ({
      all: tasks.length,
      me: tasks.filter((t) => t.assignee === ME.id).length,
      critical: tasks.filter((t) => t.priority === "critical").length,
      inprogress: tasks.filter((t) => t.status === "inprogress").length,
      overdue: tasks.filter((t) => t.status === "overdue").length,
      done: tasks.filter((t) => t.status === "done").length,
    }), [tasks]);

    const filtered = useMemo(() => {
      let r = tasks;
      if (filter === "me") r = r.filter((t) => t.assignee === ME.id);
      else if (filter === "critical") r = r.filter((t) => t.priority === "critical");
      else if (filter === "inprogress") r = r.filter((t) => t.status === "inprogress");
      else if (filter === "overdue") r = r.filter((t) => t.status === "overdue");
      else if (filter === "done") r = r.filter((t) => t.status === "done");
      if (origin === "proactive") r = r.filter(isProactive);
      else if (origin === "reactive") r = r.filter((t) => !isProactive(t));
      if (q.trim()) { const s = q.toLowerCase(); r = r.filter((t) => t.title.toLowerCase().includes(s) || (t.location || "").toLowerCase().includes(s) || t.tags.some((tg) => tg.includes(s))); }
      const pOrd = D().PRIORITY;
      r = [...r].sort((a, b) => {
        if (sort === "priority") return pOrd[a.priority].order - pOrd[b.priority].order;
        if (sort === "deadline") return (a.deadline || "~").localeCompare(b.deadline || "~");
        if (sort === "assignee") return (a.assignee || "").localeCompare(b.assignee || "");
        return 0;
      });
      return r;
    }, [tasks, filter, origin, q, sort]);

    const openTasks = filtered.filter((t) => t.status !== "done");
    const doneTasks = filtered.filter((t) => t.status === "done");

    const toggleStatus = (id) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done", completedAt: t.status === "done" ? null : "Nettopp" } : t));
    const { reassign, duplicate } = makeMutators(setTasks, toast);

    const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const exitCoord = () => { setCoord(false); setSel(new Set()); };
    const bulkDone = () => { setTasks((ts) => ts.map((t) => sel.has(t.id) ? { ...t, status: "done" } : t)); toast(`${sel.size} oppgaver markert ferdig`, { undo: () => {} }); exitCoord(); };
    const bulkAssign = (uid) => { setTasks((ts) => ts.map((t) => sel.has(t.id) ? { ...t, assignee: uid } : t)); toast(`${sel.size} oppgaver tildelt ${D().USERS[uid].name.split(" ")[0]}`, { undo: () => {} }); exitCoord(); };

    const rowProps = { coord, onToggleSel: toggleSel, onToggleStatus: toggleStatus, onReassign: reassign, onOpen, onDuplicate: duplicate, onChapter, toast };

    return (
      <>
        <div className="opp-toolbar">
          <div className="opp-search"><span className="ic"><Ic n="search" s={16} /></span><input value={q} placeholder="Søk i oppgaver, sted, tagger…" onChange={(e) => setQ(e.target.value)} /></div>
          <div className="opp-toolbar-spacer" />
          <span style={{ position: "relative" }} ref={sortRef}>
            <button className="opp-iconbtn" onClick={() => setSortOpen((v) => !v)}><Ic n="filter" s={15} /> Sortér</button>
            {sortOpen && (
              <div className="opp-menu right"><div className="opp-menu-head">Sortér etter</div>
                {[["priority", "Prioritet"], ["deadline", "Frist"], ["assignee", "Ansvarlig"]].map(([k, l]) => (
                  <div key={k} className={`opp-menu-item ${sort === k ? "active" : ""}`} onClick={() => { setSort(k); setSortOpen(false); }}>{l}{sort === k && <span className="check"><Ic n="check" s={14} sw={2.6} /></span>}</div>
                ))}
              </div>
            )}
          </span>
          <button className={`opp-iconbtn ${coord ? "active" : ""}`} onClick={() => (coord ? exitCoord() : setCoord(true))}><Ic n={coord ? "x" : "checkdoc"} s={15} /> {coord ? "Avbryt" : "Koordinér"}</button>
        </div>

        <div className="opp-filters">
          {FILTERS.map((f) => (
            <button key={f.id} className={`chip ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>{f.label} <span className="chip-count">{counts[f.id]}</span></button>
          ))}
          <div className="filter-row-spacer" style={{ flex: 1 }} />
          {ORIGIN_FILTERS.map((f) => (
            <button key={f.id} className={`chip ${origin === f.id ? "active" : ""}`} onClick={() => setOrigin(f.id)}>{f.label}</button>
          ))}
        </div>

        {coord && (
          <div className="opp-bulk">
            <span className="cnt">{sel.size}</span><span className="lbl">valgt</span>
            <span className="spacer" />
            <button className="opp-bulk-btn" onClick={bulkDone}><Ic n="check" s={14} /> Marker ferdig</button>
            <BulkAssign onAssign={bulkAssign} />
            <button className="opp-bulk-btn" onClick={() => { toast(`${sel.size} oppgaver flyttet til Dagslinjen`); exitCoord(); }}><Ic n="route" s={14} /> Til Dagslinjen</button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="so-panel"><div className="so-empty"><span className="ic"><Ic n="check" s={22} /></span><div className="t">Ingen oppgaver her</div><div className="s">Ingen oppgaver matcher filteret. Prøv «Alle» eller fjern søket.</div></div></div>
        ) : (
          <div className="opp-list">
            {openTasks.length > 0 && (
              <>
                <div className="opp-group-head"><span className="gt">Aktive</span><span className="gc">{openTasks.length}</span></div>
                {openTasks.map((t) => <TaskRow key={t.id} task={t} selected={sel.has(t.id)} {...rowProps} />)}
              </>
            )}
            {doneTasks.length > 0 && (
              <>
                <div className="opp-group-head"><span className="gt">Fullført</span><span className="gc">{doneTasks.length}</span></div>
                {doneTasks.map((t) => <TaskRow key={t.id} task={t} selected={sel.has(t.id)} {...rowProps} />)}
              </>
            )}
          </div>
        )}
      </>
    );
  }

  function BulkAssign({ onAssign }) {
    const { USERS } = D();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useOutside(ref, () => setOpen(false));
    return (
      <span style={{ position: "relative" }} ref={ref}>
        <button className="opp-bulk-btn" onClick={() => setOpen((v) => !v)}><Ic n="user" s={14} /> Tildel <Ic n="chevDown" s={13} /></button>
        {open && (
          <div className="opp-menu right" style={{ bottom: "calc(100% + 6px)", top: "auto" }}><div className="opp-menu-head">Tildel alle til</div>
            {TEAM.map((uid) => (<div key={uid} className="opp-menu-item" onClick={() => { onAssign(uid); setOpen(false); }}><Av id={uid} size={22} /> {USERS[uid].name}</div>))}
          </div>
        )}
      </span>
    );
  }

  // ===================================================================
  // ROUTINES TAB
  // ===================================================================
  function Routines({ toast, onOpenTask, onChapter, focusId, clearFocus }) {
    const { ROUTINES, USERS, PRIORITY, ROUTINE_CATEGORIES, ROUTINE_CADENCE } = D();
    const CAT = ROUTINE_CATEGORIES;
    const [active, setActive] = useState(() => Object.fromEntries(ROUTINES.map((r) => [r.id, r.active])));
    const [cat, setCat] = useState("all");
    const [cad, setCad] = useState("all");
    const [hl, setHl] = useState(null);
    const cardRefs = React.useRef({});

    // open the respective control card when navigated from Overview
    React.useEffect(() => {
      if (!focusId) return;
      setCat("all"); setCad("all"); setHl(focusId);
      const tmr = requestAnimationFrame(() => {
        const card = cardRefs.current[focusId];
        if (card) {
          let p = card.parentElement;
          while (p) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight) break; p = p.parentElement; }
          if (p) { const cr = card.getBoundingClientRect(), pr = p.getBoundingClientRect(); p.scrollTop += (cr.top - pr.top) - 96; }
        }
      });
      const t1 = setTimeout(() => setHl(null), 2400);
      const t2 = setTimeout(() => clearFocus && clearFocus(), 250);
      return () => { cancelAnimationFrame(tmr); clearTimeout(t1); clearTimeout(t2); };
    }, [focusId]);

    const toggle = (r) => { const next = !active[r.id]; setActive((a) => ({ ...a, [r.id]: next })); toast(next ? `Rutine aktivert: ${r.title}` : `Rutine pauset: ${r.title}`, { undo: () => setActive((a) => ({ ...a, [r.id]: !next })) }); };
    const catCount = (c) => ROUTINES.filter((r) => r.category === c).length;
    const cadCount = (c) => ROUTINES.filter((r) => r.cadence === c).length;
    const cats = Object.keys(CAT).filter((c) => catCount(c) > 0);
    const cads = ROUTINE_CADENCE.filter((c) => cadCount(c) > 0);
    const list = ROUTINES.filter((r) => (cat === "all" || r.category === cat) && (cad === "all" || r.cadence === cad));
    return (
      <>
        <div className="opp-toolbar">
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Proaktive prosedyrer som genererer oppgaver automatisk. <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{list.filter((r) => active[r.id]).length}</strong> aktive{(cat !== "all" || cad !== "all") ? ` av ${list.length} i utvalg` : ""}.</div>
          <div className="opp-toolbar-spacer" />
          <button className="opp-iconbtn" onClick={() => toast("Botsson kladder ny rutine — bekreft før aktivering")}><Ic n="bot" s={15} /> Foreslå rutine</button>
          <button className="opp-iconbtn active" onClick={() => toast("Ny rutine — veiviser åpnet")}><Ic n="plus" s={15} /> Ny rutine</button>
        </div>

        <div className="opp-filter-row">
          <span className="opp-filter-lbl">Kategori</span>
          <button className={`chip ${cat === "all" ? "active" : ""}`} onClick={() => setCat("all")}>Alle <span className="chip-count">{ROUTINES.length}</span></button>
          {cats.map((c) => (
            <button key={c} className={`chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
              <span className="opp-chip-ic"><Ic n={CAT[c].icon} s={13} /></span>{CAT[c].label} <span className="chip-count">{catCount(c)}</span>
            </button>
          ))}
        </div>
        <div className="opp-filter-row">
          <span className="opp-filter-lbl">Intensitet</span>
          <button className={`chip ${cad === "all" ? "active" : ""}`} onClick={() => setCad("all")}>Alle</button>
          {cads.map((c) => (
            <button key={c} className={`chip ${cad === c ? "active" : ""}`} onClick={() => setCad(c)}>{c} <span className="chip-count">{cadCount(c)}</span></button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="so-panel"><div className="so-empty"><span className="ic"><Ic n="repeat" s={22} /></span><div className="t">Ingen rutiner i utvalget</div><div className="s">Juster kategori eller intensitet.</div></div></div>
        ) : (
        <div className="opp-rut-grid">
          {list.map((r) => {
            const on = active[r.id];
            const book = BOOK[r.book];
            const cinfo = CAT[r.category];
            const pct = Math.round(r.completion * 100);
            return (
              <div key={r.id} ref={(el) => (cardRefs.current[r.id] = el)} className={`opp-rut ${on ? "" : "paused"} ${hl === r.id ? "focus" : ""}`}>
                <div className="opp-rut-top">
                  <span className="opp-rut-ic" style={{ background: PRIORITY[r.priority].color }}><Ic n="repeat" s={18} /></span>
                  <div className="opp-rut-h">
                    <div className="ttl">{r.title}</div>
                    <div className="sub">
                      <span className="book" style={{ color: book.color, background: book.color + "1c", cursor: "pointer" }} onClick={() => onChapter(r.book, r.chapter)}>{book.label}-håndbok</span>
                      <span className="opp-chap" style={{ color: book.color }} onClick={() => onChapter(r.book, r.chapter)}><span className="sl">›</span> {r.chapter}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Ic n={cinfo.icon} s={12} /> {cinfo.label}</span>
                    </div>
                  </div>
                  <span className={`opp-switch ${on ? "on" : ""}`} onClick={() => toggle(r)} role="switch" aria-checked={on} title={on ? "Aktiv" : "Pauset"} />
                </div>

                <div className="opp-proc"><b>Prosedyre · {r.steps} steg:</b> {r.procedure}</div>

                <div className="opp-rut-grid2">
                  <div className="opp-rut-fact"><div className="k"><Ic n="clock" s={11} /> Trigger</div><div className="v">{r.trigger}</div></div>
                  <div className="opp-rut-fact"><div className="k"><Ic n="users" s={11} /> Omfang</div><div className="v">{r.scope}</div></div>
                  <div className="opp-rut-fact"><div className="k"><Ic n="user" s={11} /> Ansvarlig rolle</div><div className="v">{r.responsible}</div></div>
                  <div className="opp-rut-fact"><div className="k"><Ic n="flag" s={11} /> Eier</div><div className="v" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Av id={r.owner} size={18} /> {USERS[r.owner].name.split(" ")[0]}</div></div>
                  <div className="opp-rut-fact"><div className="k"><Ic n="history" s={11} /> Sist kjørt</div><div className="v mono">{r.lastRun}</div></div>
                  <div className="opp-rut-fact"><div className="k"><Ic n="arrowRight" s={11} /> Neste</div><div className="v mono">{on ? r.nextRun : "Pauset"}</div></div>
                </div>

                <div className="opp-rut-foot">
                  <span className={`opp-rut-stat ${r.behind ? "behind" : "ok"}`}><Ic n={r.behind ? "alert" : "trendUp"} s={14} /> <span className="v">{pct}%</span> fullført</span>
                  {r.streak > 0 && <span className="opp-rut-stat" style={{ color: "var(--muted)" }}><Ic n="zap" s={14} /> <span className="v">{r.streak}</span> på rad</span>}
                  <span className="spacer" />
                  {r.evidence && <span title="Krever bevis" style={{ color: "var(--muted-soft)" }}><Ic n="camera" s={15} /></span>}
                  {r.task && <button className="opp-act" title="Se generert oppgave" onClick={() => onOpenTask(r.task)} style={{ color: "var(--muted)" }}><Ic n="arrowRight" s={16} /></button>}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </>
    );
  }

  // ===================================================================
  // QUICK-EDIT DRAWER
  // ===================================================================
  function Drawer({ task, setTasks, onClose, toast, onChapter, onOpenManual, onOpenChapter }) {
    const { USERS, FOLDERS, MANUALS, ME, STATUS, PRIORITY } = D();
    if (!task) return null;
    const folder = FOLDERS.find((f) => f.id === task.folder);
    const manual = task.manual ? MANUALS[task.manual] : null;
    const subDone = task.subtasks.filter((s) => s.done).length;
    const [edit, setEdit] = useState(false);
    const [draft, setDraft] = useState("");
    const addComment = () => { if (!draft.trim()) return; setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, activity: [...t.activity, { type: "comment", user: ME.id, text: draft.trim(), time: "Nå" }] } : t)); setDraft(""); toast("Kommentar lagt til"); };
    const addMedia = (kind) => { setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, activity: [...t.activity, { type: "media", user: ME.id, text: "la til " + kind.toLowerCase(), time: "Nå" }] } : t)); toast(kind + " lagt til"); };
    const tone = task.priority === "critical" || task.status === "overdue" ? "crit" : task.priority === "high" ? "warn" : "";
    const patch = (p) => setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, ...p } : t));
    const setStatus = (s) => patch({ status: s, completedAt: s === "done" ? "Nettopp" : null });
    const setPri = (p) => patch({ priority: p });
    const setAssignee = (a) => { patch({ assignee: a }); toast(`Tildelt ${USERS[a].name.split(" ")[0]}`); };
    const toggleSub = (sid) => setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, subtasks: t.subtasks.map((s) => s.id === sid ? { ...s, done: !s.done } : s) } : t));

    const STATUS_SEG = [["todo", "Ikke startet", ""], ["inprogress", "Pågår", "info"], ["done", "Ferdig", "ok"]];
    const PRI_SEG = [["low", "Lav", ""], ["normal", "Normal", ""], ["high", "Høy", "warn"], ["critical", "Kritisk", "crit"]];

    return (
      <>
        <div className="opp-backdrop" onClick={onClose} />
        <aside className="opp-drawer">
          <div className={`opp-dh ${tone}`}>
            <div className="opp-dh-row">
              <Origin task={task} />
              <span className={`status-pill status-${task.status}`} style={{ color: STATUS[task.status].color }}>{STATUS[task.status].label}</span>
              {task.requiresApproval && <span className="status-pill status-awaiting" style={{ color: "var(--purple)" }}>Godkjenning</span>}
              <span className="spacer" />
              <button className="opp-dh-close" onClick={() => setEdit((v) => !v)} title="Rediger" style={{ marginRight: 2, color: edit ? "var(--orange)" : undefined }}><Ic n="pen" s={16} /></button>
              <button className="opp-dh-close" onClick={onClose}><Ic n="x" s={18} /></button>
            </div>
            <h2>{task.title}</h2>
            {task.description && <p>{task.description}</p>}
          </div>

          <div className="opp-db">
            {edit ? (
              <>
                <div className="opp-field">
                  <label>Status</label>
                  <div className="opp-seg">
                    {STATUS_SEG.map(([k, l, t]) => <button key={k} className={task.status === k ? "on" : ""} data-tone={t} onClick={() => setStatus(k)}>{l}</button>)}
                  </div>
                </div>
                <div className="opp-field">
                  <label>Prioritet</label>
                  <div className="opp-seg">
                    {PRI_SEG.map(([k, l, t]) => <button key={k} className={task.priority === k ? "on" : ""} data-tone={t} onClick={() => setPri(k)}>{l}</button>)}
                  </div>
                </div>
                <div className="opp-field">
                  <label>Ansvarlig</label>
                  <div className="opp-people">
                    {TEAM.map((uid) => (
                      <button key={uid} className={`opp-person ${task.assignee === uid ? "on" : ""}`} onClick={() => setAssignee(uid)}>
                        <Av id={uid} size={24} /> {USERS[uid].name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="opp-field">
                <label>Status & prioritet</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className={`status-pill status-${task.status}`} style={{ color: STATUS[task.status].color }}>{STATUS[task.status].label}</span>
                  <span className="status-pill" style={{ color: PRIORITY[task.priority].color, background: PRIORITY[task.priority].color + "1c" }}>{PRIORITY[task.priority].label}</span>
                  <span style={{ flex: 1 }} />
                  {task.status !== "done" && task.status !== "inprogress" && <button className="btn btn-secondary btn-sm" onClick={() => setStatus("inprogress")}><Ic n="clock" s={13} /> Marker pågår</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}><Ic n="pen" s={13} /> Rediger</button>
                </div>
              </div>
            )}

            <div className="opp-field">
              <label>Kontekst</label>
              <div className="opp-row-meta" style={{ fontSize: 13 }}>
                {task.deadline && <span className={`deadline ${tone}`}><Ic n="clock" s={13} /> {task.deadline}{task.deadlineRel ? ` · ${task.deadlineRel}` : ""}</span>}
                {folder && <><span className="sep" /><span className="fold" style={{ color: folder.color }}><span className="fd" style={{ background: folder.color }} />{folder.name}</span></>}
                {task.location && <><span className="sep" /><span className="loc"><Ic n="mappin" s={12} /> {task.location}</span></>}
                {task.estimate && <><span className="sep" /><span className="mono">~{task.estimate} min</span></>}
              </div>
            </div>

            <div className="opp-field">
              <label>Tilhører kapittel</label>
              {task.book ? (
                <div className="opp-manual-link" onClick={() => onOpenChapter({ book: task.book, chapter: task.chapter })}>
                  <span className="mi" style={{ background: BOOK[task.book].color + "1c", color: BOOK[task.book].color }}><Ic n="book" s={17} /></span>
                  <div className="mt"><div className="t">{task.chapter}</div><div className="m">{BOOK[task.book].label}-håndbok</div></div>
                  <Ic n="chevRight" s={16} c="var(--muted)" />
                </div>
              ) : (
                <div className="opp-manual-link" onClick={() => onChapter(null)}>
                  <span className="mi"><Ic n="link" s={16} /></span>
                  <div className="mt"><div className="t">Ikke knyttet til håndbok</div><div className="m">Velg kapittel</div></div>
                  <Ic n="chevRight" s={16} c="var(--muted)" />
                </div>
              )}
            </div>

            {manual && (
              <div className="opp-field">
                <label>Tilknyttet manual</label>
                <div className="opp-manual-link" onClick={() => onOpenManual(manual)}>
                  <span className="mi"><Ic n="book" s={17} /></span>
                  <div className="mt"><div className="t">{manual.title}</div><div className="m">v{manual.version} · {manual.sections.length} seksjoner · ~{manual.estimatedReadTime} min</div></div>
                  <Ic n="chevRight" s={16} c="var(--muted)" />
                </div>
              </div>
            )}

            {task.subtasks.length > 0 && (
              <div className="opp-field">
                <label>Delsteg · {subDone}/{task.subtasks.length}</label>
                <div className="opp-sub">
                  {task.subtasks.map((s) => (
                    <div key={s.id} className={`opp-sub-item ${s.done ? "done" : ""}`} onClick={() => toggleSub(s.id)}>
                      <span className={`opp-sub-check ${s.done ? "done" : ""}`}>{s.done && <Ic n="check" s={12} sw={3} />}</span>
                      <span className="opp-sub-title">{s.title}</span>
                      {s.value && <span className="opp-sub-val">{s.value}</span>}
                      {s.user && <Av id={s.user} size={20} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {task.requiresEvidence && (
              <div className="opp-field">
                <label>Bevis kreves</label>
                <div className="opp-ev">
                  <button className="btn btn-secondary btn-sm" onClick={() => toast("Kamera åpnet")}><Ic n="camera" s={14} /> Ta bilde</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => toast("Vedlegg lagt til")}><Ic n="file" s={14} /> Vedlegg</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => toast("Signert")}><Ic n="pen" s={14} /> Signér</button>
                </div>
              </div>
            )}

            {task.activity.length > 0 && (
              <div className="opp-field">
                <label>Aktivitet · {task.activity.length}</label>
                <div className="opp-act-list">
                  {task.activity.map((a, i) => (
                    <div key={i} className={`opp-act-item ${a.type === "comment" ? "note" : ""}`}>
                      <span className="av"><Av id={a.user} size={26} /></span>
                      {a.type === "comment" ? (
                        <div className="bd"><span className="who">{USERS[a.user]?.name}<span className="tm">{a.time}</span></span><div style={{ marginTop: 3 }}>{a.text}</div></div>
                      ) : (
                        <div style={{ flex: 1, paddingTop: 4 }}><span className="who">{USERS[a.user]?.name}</span> {a.text}<span className="tm">{a.time}</span></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="opp-field">
              <label>Kommentar & vedlegg</label>
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Skriv en kommentar…" style={{ width: "100%", border: "none", outline: "none", resize: "vertical", minHeight: 54, padding: "10px 12px", fontFamily: "inherit", fontSize: 13.5, background: "var(--card)", color: "var(--fg)", boxSizing: "border-box" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderTop: "1px solid var(--border)" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => addMedia("Bilde")}><Ic n="camera" s={14} /> Bilde</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => addMedia("Video")}><Ic n="video" s={14} /> Video</button>
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-sm" disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : .5 }} onClick={addComment}><Ic n="send" s={13} /> Kommentér</button>
                </div>
              </div>
            </div>
          </div>

          <div className="opp-df">
            <button className="btn btn-ghost btn-sm" onClick={() => toast("Du følger oppgaven")}><Ic n="bell" s={14} /> Følg</button>
            <span className="spacer" />
            {task.status === "done" ? (
              <button className="btn btn-secondary btn-lg" onClick={() => setStatus("todo")}><Ic n="undo" s={14} /> Gjenåpne</button>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={() => { setStatus("done"); toast("Oppgave fullført", { undo: () => setStatus("todo") }); }}><Ic n="check" s={14} sw={2.5} /> Marker ferdig</button>
            )}
          </div>
        </aside>
      </>
    );
  }

  // ===================================================================
  // DAG (today board) + DAGSLINJE (per-person timeline)
  // ===================================================================
  function DayBoard({ tasks, setTasks, onOpen, onChapter, toast }) {
    const { toggleStatus, reassign, duplicate } = makeMutators(setTasks, toast);
    const rowProps = { coord: false, onToggleSel: () => {}, onToggleStatus: toggleStatus, onReassign: reassign, onOpen, onDuplicate: duplicate, onChapter, toast };
    const open = tasks.filter((t) => t.status !== "done");
    const mustNow = open.filter((t) => t.status === "overdue" || t.priority === "critical");
    const later = open.filter((t) => !(t.status === "overdue" || t.priority === "critical"));
    const done = tasks.filter((t) => t.status === "done");
    const C = 2 * Math.PI * 24;
    const frac = tasks.length ? done.length / tasks.length : 0;
    const Group = ({ crit, title, items }) => items.length === 0 ? null : (
      <div className="opp-day-section">
        <div className={`opp-day-shead ${crit ? "crit" : ""}`}><span className="bar" /><h3>{title}</h3><span className="c">{items.length}</span></div>
        <div className="opp-list">{items.map((t) => <TaskRow key={t.id} task={t} selected={false} {...rowProps} />)}</div>
      </div>
    );
    return (
      <>
        <div className="so-panel">
          <div className="opp-daymeter">
            <div className="ring">
              <svg width="58" height="58"><circle cx="29" cy="29" r="24" fill="none" stroke="var(--secondary)" strokeWidth="6" /><circle cx="29" cy="29" r="24" fill="none" stroke="var(--success)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} /></svg>
              <span className="pc">{Math.round(frac * 100)}%</span>
            </div>
            <div className="dm-main">
              <div className="h">Torsdag 30. mai</div>
              <div className="s"><b>{done.length} av {tasks.length}</b> oppgaver fullført · {mustNow.length > 0 ? <span className="crit">{mustNow.length} må løses nå</span> : "alt i rute"} · {later.length} senere</div>
            </div>
          </div>
        </div>
        <Group crit title="Må løses nå" items={mustNow} />
        <Group title="Senere i dag" items={later} />
        <Group title="Fullført i dag" items={done} />
      </>
    );
  }

  function Dagslinje({ tasks, setTasks, onOpen, toast }) {
    const { USERS, PRIORITY } = D();
    const SD = D();
    const EMP = SD.EMP_BY_ID || {};
    const DEP = SD.DEPARTMENTS || {};
    const TM = SD.TEAMS || {};
    const [mode, setMode] = useState("ansatt");
    const [dragId, setDragId] = useState(null);
    const S = 6, E = 24, NOW = 10.5, span = E - S;
    const pos = (h) => `${((h - S) / span) * 100}%`;
    const parse = (t) => { const m = (t.deadline || "").match(/(\d{1,2}):(\d{2})/); return m ? +m[1] + +m[2] / 60 : null; };
    const tone = (t) => t.status === "overdue" || t.priority === "critical" ? "crit" : t.priority === "high" ? "warn" : "";
    const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
    const fmt = (h) => { const hh = Math.floor(h); const mm = Math.round((h - hh) * 60); return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); };
    const deptOf = (uid) => EMP[uid] ? EMP[uid].placement.primary : null;
    const teamOf = (uid) => EMP[uid] ? EMP[uid].placement.team : null;

    let groups, cornerLabel;
    if (mode === "avdeling") {
      cornerLabel = "Avdeling";
      const ids = [...new Set(TEAM.map(deptOf).filter(Boolean))];
      groups = ids.map((d) => ({ key: d, label: DEP[d] ? DEP[d].name : d, color: DEP[d] && DEP[d].color, match: (t) => deptOf(t.assignee) === d, set: (t) => t }));
    } else if (mode === "omrade") {
      cornerLabel = "Område";
      const locs = [...new Set(tasks.map((t) => t.location).filter(Boolean))];
      groups = locs.map((l) => ({ key: l, label: l, match: (t) => t.location === l, set: (t) => ({ ...t, location: l }) }));
      groups.push({ key: "__noloc", label: "Uten område", match: (t) => !t.location, set: (t) => t });
    } else if (mode === "lag") {
      cornerLabel = "Lag";
      const teamIds = [...new Set(TEAM.map(teamOf).filter(Boolean))];
      groups = teamIds.map((tm) => ({ key: tm, label: TM[tm] ? TM[tm].name : tm, color: TM[tm] && DEP[TM[tm].dept] && DEP[TM[tm].dept].color, match: (t) => teamOf(t.assignee) === tm, set: (t) => t }));
      groups.push({ key: "__none", label: "Uten lag · hele avdelingen", match: (t) => !teamOf(t.assignee), set: (t) => t });
    } else {
      cornerLabel = "Ansatt";
      groups = TEAM.map((uid) => ({ key: uid, label: USERS[uid].name.split(" ")[0], sub: USERS[uid].role, av: uid, match: (t) => t.assignee === uid, set: (t) => ({ ...t, assignee: uid }) }));
    }

    const drop = (g, e) => {
      e.preventDefault();
      if (!dragId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const h = Math.round((S + x * span) * 4) / 4;
      setTasks((ts) => ts.map((t) => t.id === dragId ? g.set({ ...t, deadline: fmt(h), deadlineRel: null }) : t));
      toast("Flyttet til " + fmt(h) + (g.av || mode === "omrade" ? " · " + g.label : ""));
      setDragId(null);
    };
    const MODES = [["ansatt", "Ansatt"], ["avdeling", "Avdeling"], ["omrade", "Område"], ["lag", "Lag"]];
    const unscheduled = tasks.filter((t) => parse(t) == null);
    return (
      <div className="opp-dl">
        <div className="opp-dl-modebar">
          <span className="opp-dl-modelbl">Grupper etter</span>
          <div className="opp-seg opp-dl-modes">{MODES.map(([k, l]) => <button key={k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}</div>
          <span className="opp-dl-hint"><Ic n="route" s={13} /> Dra oppgaver for å flytte tid eller rad</span>
        </div>
        <div className="opp-dl-ruler">
          <div className="corner">{cornerLabel}</div>
          <div className="opp-dl-hours">{hours.map((h) => <span key={h} className="h" style={{ left: pos(h) }}>{String(h % 24).padStart(2, "0")}</span>)}</div>
        </div>
        {groups.map((g) => {
          const lt = tasks.filter(g.match);
          const sched = lt.filter((t) => parse(t) != null);
          return (
            <div key={g.key} className="opp-dl-lane">
              <div className="opp-dl-emp">
                {g.av ? <Av id={g.av} size={28} /> : <span className="opp-dl-gdot" style={{ background: g.color || "var(--muted-soft)" }} />}
                <span style={{ minWidth: 0 }}><span className="nm">{g.label}</span>{g.sub && <span className="rl" style={{ display: "block" }}>{g.sub}</span>}</span>
                <span className="cnt">{lt.length}</span>
              </div>
              <div className="opp-dl-track" onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(g, e)}>
                <div className="opp-dl-grid">{hours.map((h) => <span key={h} style={{ left: pos(h) }} />)}</div>
                <span className="opp-dl-now" style={{ left: pos(NOW) }} />
                {sched.map((t) => { const h = parse(t); const near = h >= 20; return (
                  <span key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} className={`opp-dl-chip ${tone(t)} ${t.status === "done" ? "done" : ""} ${dragId === t.id ? "dragging" : ""}`} style={{ left: pos(h), transform: near ? "translateX(-100%)" : "none", marginLeft: near ? -6 : 6 }} onClick={() => onOpen(t.id)} title={t.title}>
                    <span className="pdot" style={{ background: PRIORITY[t.priority].color }} /><span className="tm">{t.deadline}</span><span className="t">{t.title}</span>
                  </span>
                ); })}
              </div>
            </div>
          );
        })}
        {unscheduled.length > 0 && (
          <div className="opp-dl-lane unscheduled">
            <div className="opp-dl-emp" style={{ alignItems: "center" }}><span className="rl" style={{ fontWeight: 600, color: "var(--muted)" }}>Uten klokkeslett</span><span className="cnt">{unscheduled.length}</span></div>
            <div className="opp-dl-unsched">{unscheduled.map((t) => (
              <span key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} className={`opp-dl-chip ${tone(t)} ${t.status === "done" ? "done" : ""}`} style={{ position: "static" }} onClick={() => onOpen(t.id)} title={t.title}>
                <span className="pdot" style={{ background: PRIORITY[t.priority].color }} /><span className="t">{t.title}</span>
              </span>
            ))}</div>
          </div>
        )}
        <div className="opp-dl-legend">
          <span><i style={{ background: "var(--error)" }} />Kritisk / forsinket</span>
          <span><i style={{ background: "var(--warning)" }} />Høy prioritet</span>
          <span><i style={{ background: "var(--orange)" }} />Nå-linje (10:30)</span>
          <span>Klikk en oppgave for å åpne</span>
        </div>
      </div>
    );
  }

  // ===================================================================
  // PAGE
  // ===================================================================
  function OppgaverPage({ setRoute }) {
    const toast = window.useToast();
    const [tab, setTab] = useState("oversikt");
    const [composeFocus, setComposeFocus] = useState(0);
    useEffect(() => {
      if (window.__pendingCreate === "oppgave") { window.__pendingCreate = null; setTab("oversikt"); setComposeFocus((n) => n + 1); }
    }, []);
    const [routineFocus, setRoutineFocus] = useState(null);
    const openRoutine = (id) => { setRoutineFocus(id); setTab("rutiner"); };
    const [tasks, setTasks] = useState(() => D().TASKS.map((t) => ({ ...t, subtasks: t.subtasks.map((s) => ({ ...s })), activity: [...t.activity] })));
    const [openId, setOpenId] = useState(null);
    const [formId, setFormId] = useState(null);
    const [flow, setFlow] = useState(null);
    const [chap, setChap] = useState(null);
    const [returnId, setReturnId] = useState(null);
    const openManual = (m) => { setReturnId(openId); setOpenId(null); setFlow(m); };
    const openChapterDoc = (c) => { setReturnId(openId); setOpenId(null); setChap(c); };
    const backToTask = () => { if (returnId) setOpenId(returnId); setReturnId(null); };
    const openTask = openId ? tasks.find((t) => t.id === openId) : null;
    const formTask = formId ? tasks.find((t) => t.id === formId) : null;
    const openItem = (id) => { const t = tasks.find((x) => x.id === id); if (window.OppHasForm && window.OppHasForm(t)) setFormId(id); else setOpenId(id); };
    const completeForm = (id) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, status: "done", completedAt: "Nettopp" } : t));

    const addAdhoc = ({ title, assignee, priority, when, audience }) => {
      const t = {
        id: "t" + Date.now(), title, description: "Ad-hoc oppgave opprettet av Maria A.",
        priority, status: "todo", origin: "adhoc", folder: "drift", tags: ["ekstra"],
        deadline: when, deadlineRel: null, estimate: null, location: null, assignee, audience: audience || null,
        requiresEvidence: false, requiresApproval: false, manual: null, subtasks: [],
        activity: [{ type: "create", user: "ma", text: "opprettet og tildelte oppgaven", time: "Nå" }],
      };
      setTasks((ts) => [t, ...ts]);
    };

    const open = tasks.filter((t) => t.status !== "done").length;
    const overdue = tasks.filter((t) => t.status === "overdue").length;
    const doneToday = tasks.filter((t) => t.status === "done").length;
    const openChapter = (book, chapter) => toast(book ? `Åpner ${BOOK[book].label}-håndbok › ${chapter} i Bibliotek` : "Knytt oppgaven til et kapittel");

    const TABS = [
      { id: "oversikt", label: "Oversikt", ic: "gauge" },
      { id: "dag", label: "Dag", ic: "sun" },
      { id: "dagslinje", label: "Dagslinje", ic: "clock" },
      { id: "oppgaver", label: "Oppgaver", ic: "list", n: open },
      { id: "rutiner", label: "Rutiner", ic: "repeat", n: D().ROUTINES.filter((r) => r.active).length },
    ];

    return (
      <main className="sk-main">
        <div className="sk-wrap">
          <div className="opp-head">
            <div>
              <div className="sk-eyebrow">Drift · Oppgaver</div>
              <h1 className="opp-title">Oppgaver</h1>
              <div className="opp-statusline">
                <span className="seg"><span className="dot" style={{ background: "var(--success)" }} /><strong>{doneToday}</strong> fullført i dag</span>
                <span className="sep" />
                <span className="seg"><span className="dot" style={{ background: "var(--error)" }} /><strong>{overdue}</strong> forsinket</span>
                <span className="sep" />
                <span className="seg"><span className="dot" style={{ background: "var(--orange)" }} /><strong>{open}</strong> aktive</span>
              </div>
            </div>
            <div className="sk-page-actions">
              <button className="sk-ghost" onClick={() => setTab("rutiner")}><Ic n="repeat" s={15} /> Rutiner</button>
              {window.CreateButton ? <window.CreateButton /> : null}
            </div>
          </div>

          <div className="opp-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`opp-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                <span className="ic"><Ic n={t.ic} s={15} /></span>{t.label}{typeof t.n === "number" && <span className="n">{t.n}</span>}
              </button>
            ))}
          </div>

          {tab === "oversikt" && <Overview tasks={tasks} setTab={setTab} onAdhoc={addAdhoc} toast={toast} onOpenRoutine={openRoutine} focusCompose={composeFocus} />}
          {tab === "dag" && <DayBoard tasks={tasks} setTasks={setTasks} onOpen={openItem} onChapter={openChapter} toast={toast} />}
          {tab === "dagslinje" && <Dagslinje tasks={tasks} setTasks={setTasks} onOpen={openItem} toast={toast} />}
          {tab === "oppgaver" && <TaskList tasks={tasks} setTasks={setTasks} toast={toast} onOpen={openItem} onChapter={openChapter} />}
          {tab === "rutiner" && <Routines toast={toast} onOpenTask={(id) => { setTab("oppgaver"); openItem(id); }} onChapter={openChapter} focusId={routineFocus} clearFocus={() => setRoutineFocus(null)} />}
        </div>

        {openTask && <Drawer task={openTask} setTasks={setTasks} onClose={() => setOpenId(null)} toast={toast} onChapter={openChapter} onOpenManual={openManual} onOpenChapter={openChapterDoc} />}
        {formTask && window.OppFormViewer && <window.OppFormViewer task={formTask} onClose={() => setFormId(null)} onComplete={completeForm} toast={toast} />}
        {flow && window.OppFlowPlayer && <window.OppFlowPlayer manual={flow} onClose={() => { setFlow(null); backToTask(); }} toast={toast} />}
        {chap && window.OppChapterViewer && <window.OppChapterViewer book={chap.book} chapter={chap.chapter} onClose={() => { setChap(null); backToTask(); }} toast={toast} />}
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { oppgaver: OppgaverPage });
})();
