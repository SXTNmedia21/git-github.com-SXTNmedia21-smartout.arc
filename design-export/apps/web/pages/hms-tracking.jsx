// ===== HMS — Training/Quiz/Manual tracking · Readiness · Tasks · Activity log =====
// Exposes window.HmsTraining, window.HmsTasks, window.HmsActivity, window.HmsTaskRow.
(function () {
  const { useState, useMemo } = React;
  const H = window.Hms;
  const { Ic, SD, cat, emp, empName, loc, Av, Ring, CatChip } = H;

  const STATUS_META = {
    completed: { label: "Fullført", ic: "check" },
    inprogress: { label: "Pågår", ic: "clock" },
    due: { label: "Frist nær", ic: "clock" },
    overdue: { label: "Forfalt", ic: "alert" },
    missing: { label: "Mangler", ic: "ban" },
  };
  const KIND_META = { training: { label: "Opplæring", ic: "cap" }, quiz: { label: "Quiz", ic: "help" }, manual: { label: "Manual", ic: "file" } };

  // ============================================================
  // shared TASK ROW (used by task view + protocol detail)
  // ============================================================
  function HmsTaskRow({ t, toast, openComments, onOpen }) {
    const [status, setStatus] = useState(t.status);
    const c = cat(t.cat);
    const done = status === "done";
    const overdue = status === "overdue";
    const toggle = (e) => {
      e.stopPropagation();
      const next = done ? "open" : "done";
      setStatus(next);
      toast && toast(done ? "Oppgave gjenåpnet" : "Oppgave fullført", { undo: () => setStatus(t.status) });
    };
    return (
      <div className={`hms-tk hms-cat-${t.cat} ${t.critical ? "critical" : ""}`} data-st={done ? "done" : status} onClick={() => onOpen && onOpen(t)}>
        <button className={`hms-tk-check ${done ? "done" : overdue ? "overdue" : ""}`} onClick={toggle}>
          {done && <Ic n="check" s={13} sw={2.6} />}
        </button>
        <div className="hms-tk-b">
          <div className="hms-tk-nm">
            {t.title}
            {t.critical && <span className="hms-tk-crit"><Ic n="alert" s={9} /> Samsvarskritisk</span>}
          </div>
          <div className="hms-tk-meta">
            <span><span className="d" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cat)", display: "inline-block" }} /> {c.name}</span>
            <span><Ic n="user" s={11} /> {t.role}</span>
            <span><Ic n="mappin" s={11} /> {loc(t.location).name}</span>
            <span className={`due ${overdue ? "crit" : ""}`}><Ic n="clock" s={11} /> {t.due}</span>
          </div>
        </div>
        <div className="hms-tk-side">
          {t.deviation && <span className="hms-evi-tag dev"><Ic n="alert" s={11} /> Avvik</span>}
          {t.evidenceRequired && <span className={`hms-evi-tag ${t.photos > 0 || done ? "has" : ""}`}><Ic n="camera" s={11} /> {t.photos > 0 ? `${t.photos} foto` : "Bevis"}</span>}
          {t.comments > 0 && <button className="hms-evi-tag" onClick={(e) => { e.stopPropagation(); openComments && openComments({ title: t.title, anchorLabel: t.title, comments: SD.HMS_COMMENTS.filter((cm) => cm.anchor === t.id) }); }}><Ic n="message" s={11} /> {t.comments}</button>}
        </div>
      </div>
    );
  }

  // ============================================================
  // TRAINING / QUIZ / MANUAL + READINESS
  // ============================================================
  function HmsTraining({ toast, openProto, openEntity }) {
    const resolveEntity = (t) => {
      const map = t.kind === "training" ? SD.HMS_TRAININGS : t.kind === "quiz" ? SD.HMS_QUIZZES : SD.HMS_MANUALS;
      const found = Object.values(map || {}).find((x) => x.title === t.item);
      return found ? { type: t.kind, id: found.id } : null;
    };
    const [view, setView] = useState("completion"); // completion | readiness
    const [q, setQ] = useState("");
    const [kindF, setKindF] = useState("all");
    const [catF, setCatF] = useState("all");
    const [statusF, setStatusF] = useState("all");

    const rows = useMemo(() => SD.HMS_TRACKING.filter((t) => {
      if (kindF !== "all" && t.kind !== kindF) return false;
      if (catF !== "all" && t.cat !== catF) return false;
      if (statusF !== "all" && t.status !== statusF) return false;
      if (q) { const s = (empName(t.emp) + " " + t.item + " " + emp(t.emp).stilling).toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
      return true;
    }), [q, kindF, catF, statusF]);

    const kpis = {
      completed: SD.HMS_TRACKING.filter((t) => t.status === "completed").length,
      overdue: SD.HMS_TRACKING.filter((t) => t.status === "overdue").length,
      missing: SD.HMS_TRACKING.filter((t) => t.status === "missing").length,
      cleared: SD.HMS_READINESS.filter((r) => r.status === "cleared").length,
    };

    return (
      <div>
        {/* sub KPIs */}
        <div className="dash-pulse" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          <div className="pulse"><span className="pulse-edge" style={{ background: "var(--success)" }} /><div className="pulse-lbl"><span className="ico"><Ic n="check" s={13} /></span>Fullført</div><div className="pulse-val ok">{kpis.completed}</div><div className="pulse-sub">kurs/quiz/manualer</div></div>
          <div className="pulse"><span className="pulse-edge" style={{ background: "var(--error)" }} /><div className="pulse-lbl"><span className="ico"><Ic n="alert" s={13} /></span>Forfalt</div><div className="pulse-val crit">{kpis.overdue}</div><div className="pulse-sub">over frist</div></div>
          <div className="pulse"><span className="pulse-edge" style={{ background: "var(--error)" }} /><div className="pulse-lbl"><span className="ico"><Ic n="ban" s={13} /></span>Mangler</div><div className="pulse-val crit">{kpis.missing}</div><div className="pulse-sub">aldri startet</div></div>
          <div className="pulse"><span className="pulse-edge" style={{ background: "var(--success)" }} /><div className="pulse-lbl"><span className="ico"><Ic n="shield" s={13} /></span>Klarert</div><div className="pulse-val ok">{kpis.cleared}</div><div className="pulse-sub">av {SD.HMS_READINESS.length} ansatte</div></div>
        </div>

        {/* view switch */}
        <div className="hms-toolbar">
          <div className="hms-seg">
            <button className={view === "completion" ? "on" : ""} onClick={() => setView("completion")}><Ic n="list" s={14} /> Gjennomføring</button>
            <button className={view === "readiness" ? "on" : ""} onClick={() => setView("readiness")}><Ic n="shield" s={14} /> Beredskap</button>
          </div>
          <span className="spc" />
          <button className="sk-ghost" onClick={() => toast("Eksporterer opplæringsstatus")}><Ic n="download" s={15} /> Eksport</button>
        </div>

        {view === "completion" ? (
          <>
            <div className="hms-toolbar">
              <div className="hms-srch"><Ic n="search" s={15} c="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk ansatt, kurs, quiz…" /></div>
              <button className={`hms-fchip ${kindF === "all" ? "on" : ""}`} onClick={() => setKindF("all")}>Alle typer</button>
              {Object.entries(KIND_META).map(([k, m]) => <button key={k} className={`hms-fchip ${kindF === k ? "on" : ""}`} onClick={() => setKindF(k)}><Ic n={m.ic} s={12} /> {m.label}</button>)}
              <span className="spc" />
              {SD.HMS_CAT_ORDER.map((id) => <button key={id} className={`hms-fchip hms-cat-${id} ${catF === id ? "on" : ""}`} onClick={() => setCatF(catF === id ? "all" : id)} style={catF === id ? { color: "var(--cat)", borderColor: "var(--cat)", background: "var(--cat-soft)" } : {}}><span className="d" style={{ background: "var(--cat)" }} />{cat(id).name}</button>)}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {["all", "completed", "inprogress", "overdue", "missing"].map((s) => <button key={s} className={`hms-fchip ${statusF === s ? "on" : ""}`} onClick={() => setStatusF(s)}>{s === "all" ? "Alle statuser" : STATUS_META[s].label}</button>)}
            </div>

            <div className="hms-table">
              <div className="hms-thead"><div className="hms-tr"><span className="hms-th">Ansatt</span><span className="hms-th">Krav</span><span className="hms-th">Type</span><span className="hms-th loc">Lokasjon</span><span className="hms-th deadline">Frist / score</span><span className="hms-th cert">Sertifikat</span></div></div>
              {rows.length === 0 ? <div className="so-empty"><span className="ic"><Ic n="cap" s={22} /></span><div className="t">Ingen treff</div><div className="s">Juster søk eller filter.</div></div> :
                rows.map((t) => {
                  const e = emp(t.emp); const sm = STATUS_META[t.status];
                  const primaryLoc = (e.placement && e.placement.locations && e.placement.locations[0]) || "loc-rest";
                  const ent = openEntity ? resolveEntity(t) : null;
                  return (
                    <div key={t.id} className="hms-tr hms-row" data-st={t.status} style={ent ? { cursor: "pointer" } : {}} onClick={ent ? () => openEntity(ent.type, ent.id) : undefined}>
                      <div className="hms-empcell"><Av id={t.emp} size={34} /><div className="meta"><div className="nm">{e.display}</div><div className="sb">{e.stilling}</div></div></div>
                      <div className="hms-cell">{t.item}<div className="s"><CatChip id={t.cat} /></div></div>
                      <div className="hms-cell"><span className="hms-kindpill"><span className="ic"><Ic n={KIND_META[t.kind].ic} s={11} /></span>{KIND_META[t.kind].label}</span></div>
                      <div className="hms-cell loc">{loc(primaryLoc).name}</div>
                      <div className="hms-cell deadline"><span className={`hms-cstat ${t.status}`}><Ic n={sm.ic} s={12} />{t.status === "completed" ? (t.score || "Fullført") : sm.label}</span>{t.status !== "completed" && t.deadline && <div className="s mono">{t.deadline}</div>}</div>
                      <div className="hms-cell cert"><span className={`hms-cert ${t.cert}`}><span className="d" />{t.cert === "valid" ? "Gyldig" : t.cert === "expiring" ? "Utløper" : t.cert === "expired" ? "Utløpt" : "Ingen"}</span></div>
                    </div>
                  );
                })}
            </div>
          </>
        ) : (
          <>
            <div className="botsson-card" style={{ marginBottom: 18 }}>
              <div className="bot-icon"><span>B</span></div>
              <div className="bot-text"><span className="bot-label">Botsson · HMS</span><p><strong>2 ansatte</strong> er blokkert fra selvstendig ansvar: Petter K. (branninstruks ulest, mangler hygienesertifikat) og Nora V. (mangler HMS-grunnkurs). Ingen kan settes på beredskapsrolle før dette er lukket.</p></div>
              <button className="bot-cta" onClick={() => toast("Påminnelse sendt til 2 ansatte")}>Send påminnelse <Ic n="arrowRight" s={13} /></button>
            </div>
            <div className="hms-rdgrid">
              {SD.HMS_READINESS.map((r) => {
                const e = emp(r.emp);
                return (
                  <div key={r.emp} className="hms-rdcard" data-st={r.status}>
                    <div className="hms-rdcard-top">
                      <Av id={r.emp} size={38} />
                      <div className="meta"><div className="nm">{e.display}</div><div className="sb">{e.stilling}</div></div>
                      <span className={`hms-rdverdict ${r.status}`}>{r.status === "cleared" ? "Klarert" : r.status === "overdue" ? "Forsinket" : "Blokkert"}</span>
                    </div>
                    <div className="hms-rditems">
                      {r.items.map((it, i) => <div key={i} className="hms-rditem"><span className={`d ${it.t}`} />{it.k}</div>)}
                    </div>
                    {r.blockedFrom.length > 0 && <div className="hms-rdblock"><span className="ic"><Ic n="ban" s={13} /></span> Blokkert fra: {r.blockedFrom.join(", ")}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ============================================================
  // TASKS & CHECKLISTS + MOBILE EXEC PREVIEW
  // ============================================================
  function MobilePreview({ toast }) {
    const tasks = SD.HMS_TASKS.filter((t) => t.status !== "done").slice(0, 3);
    return (
      <div className="hms-phone-wrap">
        <div className="hms-phone hms-cat-sikkerhet">
          <div className="hms-phone-status"><span>09:41</span><span style={{ display: "inline-flex", gap: 4 }}><Ic n="shield" s={12} /> Bistro Nord</span></div>
          <div className="hms-phone-screen">
            <div className="hms-phone-h">HMS i dag</div>
            <div className="hms-phone-sub">3 oppgaver venter på deg · Sal-vakt</div>
            <div className="hms-minstr">
              <span className="ic"><Ic n="info" s={15} /></span>
              <div className="b"><div className="t">Les før du starter</div><div className="s">Branninstruks og møteplass — 1 min lesetid.</div></div>
            </div>
            {tasks.map((t) => {
              const c = cat(t.cat);
              return (
                <div key={t.id} className={`hms-mtask hms-cat-${t.cat} ${t.critical ? "crit" : ""}`}>
                  <div className="top"><H.CatChip id={t.cat} />{t.critical && <span className="hms-tk-crit"><Ic n="alert" s={9} /> Kritisk</span>}</div>
                  <div className="nm">{t.title}</div>
                  <div className="mt"><span><Ic n="clock" s={11} /> {t.due}</span>{t.evidenceRequired && <span><Ic n="camera" s={11} /> Bevis kreves</span>}</div>
                  <button className="hms-mbtn" onClick={() => toast(`«${t.title}» fullført fra mobil`)}><Ic n="camera" s={14} c="#fff" /> {t.evidenceRequired ? "Ta bilde og fullfør" : "Marker fullført"}</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function HmsTasks({ toast, openComments, openProto }) {
    const [view, setView] = useState("liste"); // liste | mobil
    const [catF, setCatF] = useState("all");
    const [q, setQ] = useState("");

    const all = useMemo(() => SD.HMS_TASKS.filter((t) => {
      if (catF !== "all" && t.cat !== catF) return false;
      if (q && !(t.title + " " + t.role).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }), [catF, q]);

    const overdue = all.filter((t) => t.status === "overdue");
    const open = all.filter((t) => t.status === "open");
    const done = all.filter((t) => t.status === "done");

    const Group = ({ title, tone, items }) => items.length === 0 ? null : (
      <div className="task-section">
        <div className={`section-header ${tone === "crit" ? "crit" : ""}`}><span className="section-bar" style={tone === "crit" ? {} : { background: tone === "ok" ? "var(--success)" : "var(--warning)" }} /><h3>{title}</h3><span className="count">{items.length}</span></div>
        <div className="hms-tasklist">{items.map((t) => <HmsTaskRow key={t.id} t={t} toast={toast} openComments={openComments} onOpen={() => openProto(t.proto)} />)}</div>
      </div>
    );

    return (
      <div>
        <div className="hms-toolbar">
          <div className="hms-seg">
            <button className={view === "liste" ? "on" : ""} onClick={() => setView("liste")}><Ic n="list" s={14} /> Oppgaveliste</button>
            <button className={view === "mobil" ? "on" : ""} onClick={() => setView("mobil")}><Ic n="phone" s={14} /> Mobilvisning</button>
          </div>
          {view === "liste" && <>
            <div className="hms-srch" style={{ maxWidth: 260 }}><Ic n="search" s={15} c="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk oppgave…" /></div>
            <button className={`hms-fchip ${catF === "all" ? "on" : ""}`} onClick={() => setCatF("all")}>Alle</button>
            {SD.HMS_CAT_ORDER.map((id) => <button key={id} className={`hms-fchip hms-cat-${id} ${catF === id ? "on" : ""}`} onClick={() => setCatF(catF === id ? "all" : id)} style={catF === id ? { color: "var(--cat)", borderColor: "var(--cat)", background: "var(--cat-soft)" } : {}}><span className="d" style={{ background: "var(--cat)" }} />{cat(id).name}</button>)}
          </>}
          <span className="spc" />
          {view === "liste" && <window.CreateButton label="Ny HMS-oppgave" onAction={(x) => { if (x === "Oppgave") { toast("HMS-oppgave opprettet"); return true; } return false; }} />}
        </div>

        {view === "mobil" ? (
          <div className="hms-grid2" style={{ gridTemplateColumns: "1fr 1.1fr" }}>
            <div>
              <MobilePreview toast={toast} />
            </div>
            <div className="hms-stack">
              <H.Panel icon="phone" title="Mobil HMS-utførelse">
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--fg)", margin: 0, maxWidth: "48ch" }}>
                  Ansatte ser bare sine egne HMS-oppgaver for dagen — prioritert med de mest kritiske øverst. De leser tilknyttet instruks, fullfører sjekklisten, laster opp bilde som bevis, og ser påminnelser om opplæring de mangler.
                </p>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[["camera", "Bevis ved fullføring", "Foto eller signering kreves på samsvarskritiske oppgaver"], ["book", "Instruks i kontekst", "Håndbok og manual åpnes rett fra oppgaven"], ["cap", "Opplæringspåminnelser", "Mangler kurs blokkerer ansvar — vises tydelig"]].map(([ic, t, s]) => (
                    <div key={t} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--secondary)", color: "var(--muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic n={ic} s={15} /></span>
                      <div><div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{s}</div></div>
                    </div>
                  ))}
                </div>
              </H.Panel>
            </div>
          </div>
        ) : (
          <>
            <Group title="Forsinket — krever handling" tone="crit" items={overdue} />
            <Group title="Åpne i dag" tone="warn" items={open} />
            <Group title="Fullført" tone="ok" items={done} />
            {all.length === 0 && <div className="so-panel"><div className="so-empty"><span className="ic"><Ic n="check" s={22} /></span><div className="t">Ingen oppgaver</div><div className="s">Ingen HMS-oppgaver for dette filteret.</div></div></div>}
          </>
        )}
      </div>
    );
  }

  // ============================================================
  // ACTIVITY / AUDIT LOG
  // ============================================================
  const LOG_KINDS = [["all", "Alt"], ["routine", "Rutiner"], ["quiz", "Quiz"], ["training", "Opplæring"], ["comment", "Kommentar"], ["evidence", "Bevis"], ["approval", "Godkjenning"], ["ai", "AI"], ["handbook", "Håndbok"], ["protocol", "Protokoll"]];
  function HmsActivity({ toast, openProto }) {
    const [kindF, setKindF] = useState("all");
    const [catF, setCatF] = useState("all");
    const rows = SD.HMS_ACTIVITY.filter((a) => (kindF === "all" || a.kind === kindF) && (catF === "all" || a.cat === catF));
    return (
      <div>
        <div className="hms-toolbar">
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginRight: 4 }}>Type</span>
          {LOG_KINDS.map(([k, l]) => <button key={k} className={`hms-fchip ${kindF === k ? "on" : ""}`} onClick={() => setKindF(k)}>{l}</button>)}
          <span className="spc" />
          <button className="sk-ghost" onClick={() => toast("Logg eksportert (CSV)")}><Ic n="download" s={15} /> Eksport</button>
        </div>
        <div className="hms-toolbar" style={{ marginTop: -6 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginRight: 4 }}>Område</span>
          <button className={`hms-fchip ${catF === "all" ? "on" : ""}`} onClick={() => setCatF("all")}>Alle</button>
          {SD.HMS_CAT_ORDER.map((id) => <button key={id} className={`hms-fchip hms-cat-${id} ${catF === id ? "on" : ""}`} onClick={() => setCatF(catF === id ? "all" : id)} style={catF === id ? { color: "var(--cat)", borderColor: "var(--cat)", background: "var(--cat-soft)" } : {}}><span className="d" style={{ background: "var(--cat)" }} />{cat(id).name}</button>)}
        </div>
        <div className="so-panel">
          <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="history" s={15} /></span>Aktivitetslogg</span><span className="cnt">{rows.length}</span><span className="spacer" /><span style={{ fontSize: 11.5, color: "var(--muted)" }}>Tilsynsklar · eksporterbar</span></div>
          {rows.length === 0 ? <div className="so-empty"><span className="ic"><Ic n="history" s={22} /></span><div className="t">Ingen hendelser</div><div className="s">Ingen logg for dette filteret.</div></div> : (
            <div className="hms-tl">
              {rows.map((a) => (
                <div key={a.id} className="hms-tl-item" style={{ cursor: a.ref ? "pointer" : "default" }} onClick={() => a.ref && openProto(a.ref)}>
                  <span className={`hms-tl-ic ${a.kind}`}><Ic n={a.kind === "ai" ? "bot" : a.kind === "evidence" ? "camera" : a.kind === "quiz" ? "help" : a.kind === "comment" ? "message" : a.kind === "handbook" ? "book" : a.kind === "protocol" ? "shield" : a.kind === "training" ? "cap" : "check"} s={15} /></span>
                  <div className="hms-tl-b"><span className="who">{empName(a.who)}</span> {a.what} <span style={{ marginLeft: 6 }}><H.CatChip id={a.cat} /></span><div className="kind">{a.kind}</div></div>
                  <span className="hms-tl-when">{a.when}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  window.HmsTaskRow = HmsTaskRow;
  window.HmsTraining = HmsTraining;
  window.HmsTasks = HmsTasks;
  window.HmsActivity = HmsActivity;
})();
