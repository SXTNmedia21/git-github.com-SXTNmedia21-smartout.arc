// ===== HMS — Avvik (deviations) Kanban board · window.HmsDeviations =====
// Replaces the old "Oppgaver" tab. Deviations move through a lifecycle
// (Meldt → Under arbeid → Verifisering → Lukket) via drag-and-drop or a
// per-card move menu. AI (Botsson) suggests the next owner/action but never
// closes an avvik itself — closing is a human, verified, logged act.
(function () {
  const { useState, useMemo, useRef, useEffect } = React;
  const H = window.Hms;
  const { Ic, SD, cat, emp, empName, loc, Av, CatChip, AssistStrip } = H;

  const SEV = {
    kritisk: { label: "Kritisk", color: "var(--error)", bg: "rgba(231,0,11,0.10)" },
    hoy: { label: "Høy", color: "var(--warning)", bg: "rgba(193,130,0,0.14)" },
    lav: { label: "Lav", color: "var(--muted)", bg: "var(--secondary)" },
  };
  const STAGE_TONE = { meldt: "crit", arbeid: "warn", verifisering: "info", lukket: "ok" };
  const OWNERS = ["ma", "es", "sk", "ib", "sl", "jh"];
  const isOverdue = (s) => s && /forfalt/i.test(s);

  // where an avvik came IN from — the kanban is an intake hub, not just a list
  const SOURCES = {
    manuell: { label: "Manuell melding", icon: "pen" },
    kontroll: { label: "Egenkontroll", icon: "clipcheck" },
    vernerunde: { label: "Vernerunde", icon: "shield" },
    oppgave: { label: "Fra oppgave", icon: "list" },
    gjest: { label: "Gjest / kunde", icon: "users" },
    tilsyn: { label: "Tilsyn", icon: "building" },
  };

  function HmsDeviations({ toast, openProto, openComments, focusId, onFocusHandled }) {
    const STAGES = SD.HMS_DEV_STAGES;
    const [extra, setExtra] = useState([]);                 // incoming avvik created via intake
    const allDevs = useMemo(() => [...extra, ...SD.HMS_DEVIATIONS], [extra]);
    const [colOf, setColOf] = useState(() => Object.fromEntries(SD.HMS_DEVIATIONS.map((d) => [d.id, d.status])));
    const [ownerOf, setOwnerOf] = useState(() => Object.fromEntries(SD.HMS_DEVIATIONS.map((d) => [d.id, d.owner])));
    const [catF, setCatF] = useState("all");
    const [sevF, setSevF] = useState("all");
    const [drag, setDrag] = useState(null);
    const [over, setOver] = useState(null);
    const [menuId, setMenuId] = useState(null);
    const [openId, setOpenId] = useState(null);
    const [meld, setMeld] = useState(false);                // intake modal
    const seqRef = useRef(219);

    // global «Skap → Avvik» opens the Meld-avvik intake on arrival
    useEffect(() => { if (window.__pendingCreate === "avvik") { window.__pendingCreate = null; setMeld(true); } }, []);

    const visible = useMemo(() => allDevs.filter((d) =>
      (catF === "all" || d.cat === catF) && (sevF === "all" || d.sev === sevF)
    ), [catF, sevF, allDevs]);

    // intake: a newly meldt avvik truly lands in «Meldt» and can be driven through
    const reportDev = (form) => {
      const id = "AV-" + (seqRef.current++);
      const d = { id, status: "meldt", reportedAt: "Nå", comments: 0, photos: 0, cause: null, tiltak: null, due: form.due || null, sla: null, proto: null, ...form, source: form.source || "manuell", incoming: true };
      setExtra((x) => [d, ...x]);
      setColOf((c) => ({ ...c, [id]: "meldt" }));
      setOwnerOf((o) => ({ ...o, [id]: form.owner || "ma" }));
      setMeld(false);
      toast(`${id} meldt — ligger i «Meldt»`, { undo: () => { setExtra((x) => x.filter((y) => y.id !== id)); } });
    };

    const move = (id, to) => {
      setMenuId(null);
      const from = colOf[id];
      if (from === to) return;
      setColOf((c) => ({ ...c, [id]: to }));
      const st = STAGES.find((s) => s.id === to);
      toast(`${id} flyttet til «${st.label}»`, { undo: () => setColOf((c) => ({ ...c, [id]: from })) });
    };

    const setOwner = (id, uid) => {
      const prev = ownerOf[id];
      if (prev === uid) return;
      setOwnerOf((o) => ({ ...o, [id]: uid }));
      toast(`${id} tildelt ${empName(uid)}`, { undo: () => setOwnerOf((o) => ({ ...o, [id]: prev })) });
    };

    const openDev = openId ? allDevs.find((d) => d.id === openId) : null;

    // deep-link: when arriving from the dashboard queue, auto-open that avvik's drawer
    useEffect(() => {
      if (!focusId) return;
      if (focusId !== true) {
        const exists = allDevs.some((d) => d.id === focusId);
        if (exists) setOpenId(focusId);
      }
      onFocusHandled && onFocusHandled();
    }, [focusId]);

    const openCrit = allDevs.filter((d) => colOf[d.id] !== "lukket" && d.sev === "kritisk").length;
    const meldtCount = visible.filter((d) => colOf[d.id] === "meldt").length;

    return (
      <div>
        {/* AI assist */}
        <div style={{ marginBottom: 14 }}>
          <AssistStrip
            text={<>Botsson ser <strong>{openCrit} kritiske avvik</strong> som ikke er lukket. «AV-218 Temperaturavvik Kjøl 3» haster mest — foreslår eier <strong>Maria A.</strong> og kobling til kjøl-protokollen.</>}
            cta="Vis forslag" onCta={() => toast("Botsson: åpner forslag for AV-218 — bekreft eier før varsling")} toast={toast} />
        </div>

        {/* toolbar */}
        <div className="hms-toolbar">
          <button className={`hms-fchip ${catF === "all" ? "on" : ""}`} onClick={() => setCatF("all")}>Alle områder</button>
          {SD.HMS_CAT_ORDER.map((id) => (
            <button key={id} className={`hms-fchip hms-cat-${id} ${catF === id ? "on" : ""}`} onClick={() => setCatF(catF === id ? "all" : id)} style={catF === id ? { color: "var(--cat)", borderColor: "var(--cat)", background: "var(--cat-soft)" } : {}}><span className="d" style={{ background: "var(--cat)" }} />{cat(id).name}</button>
          ))}
          <span className="hms-tb-div" />
          {Object.keys(SEV).map((k) => (
            <button key={k} className={`hms-fchip ${sevF === k ? "on" : ""}`} onClick={() => setSevF(sevF === k ? "all" : k)} style={sevF === k ? { color: SEV[k].color, borderColor: SEV[k].color, background: SEV[k].bg } : {}}><span className="d" style={{ background: SEV[k].color }} />{SEV[k].label}</button>
          ))}
          <span className="spc" />
          <button className="btn btn-primary btn-sm" onClick={() => setMeld(true)}><Ic n="plus" s={14} /> Meld avvik</button>
        </div>

        {/* kanban */}
        <div className="hms-kanban">
          {STAGES.map((stage) => {
            const items = visible.filter((d) => colOf[d.id] === stage.id);
            return (
              <div key={stage.id} className={`hms-kb-col ${over === stage.id ? "over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); if (over !== stage.id) setOver(stage.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
                onDrop={(e) => { e.preventDefault(); if (drag) move(drag, stage.id); setDrag(null); setOver(null); }}>
                <div className="hms-kb-head">
                  <span className="bar" style={{ background: stage.tone }} />
                  <span className="lbl">{stage.label}</span>
                  <span className="cnt">{items.length}</span>
                  <span className="desc">{stage.desc}</span>
                </div>
                <div className="hms-kb-body">
                  {items.length === 0 ? (
                    <div className="hms-kb-empty">Ingen avvik her</div>
                  ) : items.map((d) => (
                    <DevCard key={d.id} d={d} stage={stage} stages={STAGES} colOf={colOf}
                      dragging={drag === d.id} menuOpen={menuId === d.id}
                      onDragStart={() => setDrag(d.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
                      onMenu={() => setMenuId(menuId === d.id ? null : d.id)} onMove={move}
                      onOpen={() => setOpenId(d.id)} onComments={() => openComments && openComments(d.id)} owner={ownerOf[d.id]} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {openDev && (
          <AvvikDrawer d={openDev} stage={colOf[openDev.id]} owner={ownerOf[openDev.id]} stages={STAGES}
            onClose={() => setOpenId(null)} onMove={move} onOwner={setOwner} openProto={openProto}
            openComments={openComments} toast={toast} />
        )}

        {meld && <MeldAvvikModal onClose={() => setMeld(false)} onSubmit={reportDev} />}
      </div>
    );
  }

  function DevCard({ d, stage, stages, colOf, dragging, menuOpen, onDragStart, onDragEnd, onMenu, onMove, onOpen, onComments, owner }) {
    const sev = SEV[d.sev];
    const overdue = isOverdue(d.due) && stage.id !== "lukket";
    const idx = stages.findIndex((s) => s.id === stage.id);
    const next = stages[idx + 1];
    const ownerId = owner || d.owner;
    return (
      <div className={`hms-av-card hms-cat-${d.cat} ${dragging ? "dragging" : ""}`} draggable
        onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}>
        <div className="hms-av-top">
          <span className="hms-av-sev" style={{ color: sev.color, background: sev.bg }}><span className="d" style={{ background: sev.color }} />{sev.label}</span>
          <span className="hms-av-id">{d.id}</span>
          <span className="spc" />
          <span className="hms-av-menwrap">
            <button className="hms-av-men" title="Flytt" onClick={(e) => { e.stopPropagation(); onMenu(); }}><Ic n="sliders" s={14} /></button>
            {menuOpen && (
              <div className="hms-av-menu" onClick={(e) => e.stopPropagation()}>
                <div className="hh">Flytt til</div>
                {stages.map((s) => (
                  <div key={s.id} className={`it ${colOf[d.id] === s.id ? "on" : ""}`} onClick={() => onMove(d.id, s.id)}>
                    <span className="d" style={{ background: s.tone }} />{s.label}{colOf[d.id] === s.id && <span className="ck"><Ic n="check" s={13} sw={2.6} /></span>}
                  </div>
                ))}
              </div>
            )}
          </span>
        </div>

        <div className="hms-av-title">{d.title}</div>

        <div className="hms-av-chips">
          <CatChip id={d.cat} />
          <span className="hms-av-loc"><Ic n="mappin" s={11} /> {loc(d.location).name}</span>
          {d.source && SEV && SOURCES[d.source] && <span className="hms-av-loc"><Ic n={SOURCES[d.source].icon} s={11} /> {SOURCES[d.source].label}</span>}
        </div>

        {(stage.id === "arbeid" || stage.id === "verifisering") && d.tiltak && (
          <div className="hms-av-tiltak"><span className="k">Tiltak</span> {d.tiltak}</div>
        )}

        <div className="hms-av-foot">
          <span className="who" title={`Ansvarlig: ${empName(ownerId)}`}><Av id={ownerId} size={22} /></span>
          <span className={`hms-av-due ${overdue ? "crit" : ""}`}><Ic n="clock" s={11} /> {stage.id === "lukket" ? "Lukket" : (d.due || d.reportedAt)}</span>
          <span className="spc" />
          {d.comments > 0 && <button className="hms-av-meta" onClick={(e) => { e.stopPropagation(); onComments(); }}><Ic n="message" s={12} /> {d.comments}</button>}
          {d.photos > 0 && <span className="hms-av-meta"><Ic n="camera" s={12} /> {d.photos}</span>}
          {next && stage.id !== "lukket" && (
            <button className="hms-av-adv" title={`Flytt til ${next.label}`} onClick={(e) => { e.stopPropagation(); onMove(d.id, next.id); }}>{next.label} <Ic n="arrowRight" s={13} /></button>
          )}
        </div>
      </div>
    );
  }

  // ===================================================================
  // AVVIK DRAWER — full detail + actions (opens when a card is clicked)
  // ===================================================================
  function AvvikDrawer({ d, stage, owner, stages, onClose, onMove, onOwner, openProto, openComments, toast }) {
    const [edit, setEdit] = useState(false);
    const [draft, setDraft] = useState("");
    const sev = SEV[d.sev];
    const st = stages.find((s) => s.id === stage) || stages[0];
    const ownerId = owner || d.owner;
    const overdue = isOverdue(d.due) && stage !== "lukket";
    const tone = d.sev === "kritisk" || overdue ? "crit" : d.sev === "hoy" ? "warn" : "";
    const proto = (SD.HMS_PROTO_BY_ID && SD.HMS_PROTO_BY_ID[d.proto]) || null;
    const idx = stages.findIndex((s) => s.id === stage);
    const next = stages[idx + 1];
    const addComment = () => { if (!draft.trim()) return; setDraft(""); toast("Kommentar lagt til avviket"); };

    return (
      <>
        <div className="opp-backdrop" onClick={onClose} />
        <aside className="opp-drawer">
          <div className={`opp-dh ${tone}`}>
            <div className="opp-dh-row">
              <span className="opp-origin" style={{ background: "var(--cat-soft)", color: "var(--cat)", display: "inline-flex", alignItems: "center", gap: 5 }}><Ic n="alert" s={11} /> Avvik · <span className="mono">{d.id}</span></span>
              <span className={`hms-av-sev`} style={{ color: sev.color, background: sev.bg }}><span className="d" style={{ background: sev.color }} />{sev.label}</span>
              <span className="spacer" />
              <button className="opp-dh-close" onClick={onClose}><Ic n="x" s={18} /></button>
            </div>
            <h2>{d.title}</h2>
            {d.desc && <p>{d.desc}</p>}
          </div>

          <div className={`opp-db hms-cat-${d.cat}`}>
            {/* lifecycle stage */}
            <div className="opp-field">
              <label>Status i livsløpet</label>
              <div className="opp-seg">
                {stages.map((s) => <button key={s.id} className={stage === s.id ? "on" : ""} data-tone={STAGE_TONE[s.id]} onClick={() => onMove(d.id, s.id)}>{s.label}</button>)}
              </div>
              {next && stage !== "lukket" && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 9 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => onMove(d.id, next.id)}><Ic n="arrowRight" s={13} /> Flytt til «{next.label}»</button>
                </div>
              )}
            </div>

            {/* severity + area */}
            <div className="opp-field">
              <label>Alvorlighet og område</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="hms-av-sev" style={{ color: sev.color, background: sev.bg }}><span className="d" style={{ background: sev.color }} />{sev.label}</span>
                <CatChip id={d.cat} />
                <span className="hms-av-loc"><Ic n="mappin" s={12} /> {loc(d.location).name}</span>
              </div>
            </div>

            {/* owner */}
            <div className="opp-field">
              <label>Ansvarlig {edit ? "" : <button className="opp-inline-edit" onClick={() => setEdit(true)}><Ic n="pen" s={11} /> Endre</button>}</label>
              {edit ? (
                <div className="opp-people">
                  {OWNERS.map((uid) => (
                    <button key={uid} className={`opp-person ${ownerId === uid ? "on" : ""}`} onClick={() => { onOwner(d.id, uid); setEdit(false); }}>
                      <Av id={uid} size={24} /> {empName(uid).split(" ")[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Av id={ownerId} size={28} /><div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{empName(ownerId)}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{emp(ownerId).stilling || "Ansvarlig"}</div></div>
                </div>
              )}
            </div>

            {/* context */}
            <div className="opp-field">
              <label>Kontekst</label>
              <div className="opp-row-meta" style={{ fontSize: 13 }}>
                <span className="who-meta"><Av id={d.reporter} size={18} /> Meldt av {empName(d.reporter).split(" ")[0]}</span>
                <span className="sep" /><span className="mono">{d.reportedAt}</span>
                {d.due && <><span className="sep" /><span className={`deadline ${overdue ? "crit" : ""}`}><Ic n="clock" s={13} /> Frist {d.due}</span></>}
                {d.sla && <><span className="sep" /><span className="status-pill" style={{ color: "var(--cat)", background: "var(--cat-soft)" }}>{d.sla}</span></>}
              </div>
            </div>

            {/* cause */}
            {d.cause && (
              <div className="opp-field">
                <label>Årsak</label>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--fg)", margin: 0 }}>{d.cause}</p>
              </div>
            )}

            {/* tiltak */}
            <div className="opp-field">
              <label>Tiltak</label>
              {d.tiltak ? (
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--fg)", margin: 0 }}>{d.tiltak}</p>
              ) : (
                <div className="hms-av-tiltak" style={{ margin: 0 }}>Tiltak ikke registrert ennå. Beskriv hva som skal gjøres for å lukke avviket.</div>
              )}
            </div>

            {/* linked protocol */}
            {proto && (
              <div className="opp-field">
                <label>Kilde · protokoll</label>
                <div className="opp-manual-link" onClick={() => { onClose(); openProto(d.proto); }}>
                  <span className="mi" style={{ background: "var(--cat-soft)", color: "var(--cat)" }}><Ic n="shield" s={17} /></span>
                  <div className="mt"><div className="t">{proto.title}</div><div className="m">HMS-protokoll · åpne for instruks og historikk</div></div>
                  <Ic n="chevRight" s={16} c="var(--muted)" />
                </div>
              </div>
            )}

            {/* evidence */}
            {d.photos > 0 && (
              <div className="opp-field">
                <label>Bevis</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {Array.from({ length: d.photos }).map((_, i) => (
                    <div key={i} className="hms-evi-thumb" style={{ width: 80 }}><div className="hms-evi-img photo" style={{ aspectRatio: "4/3" }}><Ic n="camera" s={18} /></div></div>
                  ))}
                </div>
              </div>
            )}

            {/* comments */}
            <div className="opp-field">
              <label>Oppfølging {d.comments > 0 ? `· ${d.comments}` : ""}</label>
              <div className="opp-comment-box">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()} placeholder="Skriv en kommentar, @nevn en kollega…" />
                <button className="btn btn-primary btn-sm" disabled={!draft.trim()} onClick={addComment} style={{ opacity: draft.trim() ? 1 : 0.5 }}><Ic n="send" s={13} /></button>
              </div>
              {openComments && <button className="opp-inline-edit" style={{ marginTop: 8 }} onClick={() => { onClose(); openComments(d.id); }}><Ic n="message" s={12} /> Åpne full kommentartråd</button>}
            </div>
          </div>
        </aside>
      </>
    );
  }

  // ===================================================================
  // MELD AVVIK — intake form (a new avvik lands in «Meldt» and is driven through)
  // ===================================================================
  function MeldAvvikModal({ onClose, onSubmit }) {
    const locs = Object.entries(SD.LOCATIONS || {});
    const [title, setTitle] = useState("");
    const [catv, setCatv] = useState("helse");
    const [sev, setSev] = useState("hoy");
    const [location, setLocation] = useState((locs[0] || ["loc-kjk"])[0]);
    const [source, setSource] = useState("manuell");
    const [owner, setOwner] = useState("ma");
    const [desc, setDesc] = useState("");
    const [due, setDue] = useState("");
    const valid = title.trim().length > 2;
    const inp = { width: "100%", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "9px 11px", fontSize: 13.5, background: "var(--card)", color: "var(--fg)", fontFamily: "inherit" };
    useEffect(() => { const h = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
    const submit = () => valid && onSubmit({ title: title.trim(), cat: catv, sev, location, source, owner, reporter: "ma", desc: desc.trim(), due: due.trim() });
    return (
      <>
        <div className="opp-backdrop" onClick={onClose} />
        <div role="dialog" aria-modal="true" style={{ position: "fixed", zIndex: 200, top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(540px, calc(100vw - 32px))", maxHeight: "88vh", overflowY: "auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "var(--sh-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--card)" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--cat-soft, var(--secondary))", color: "var(--cat, var(--error))", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic n="alert" s={16} /></span>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 20 }}>Meld avvik</span>
            <span style={{ flex: 1 }} />
            <button className="opp-dh-close" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>
          <div className={`hms-cat-${catv}`} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 15 }}>
            <Fld label="Hva skjedde?" req>
              <input style={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kort beskrivelse av avviket" autoFocus />
            </Fld>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Fld label="Område">
                <div className="opp-seg">
                  {SD.HMS_CAT_ORDER.map((id) => <button key={id} className={catv === id ? "on" : ""} data-tone={STAGE_TONE.meldt} onClick={() => setCatv(id)} style={catv === id ? { color: "var(--cat)" } : {}}>{cat(id).name}</button>)}
                </div>
              </Fld>
              <Fld label="Alvorlighet">
                <div className="opp-seg">
                  {Object.keys(SEV).map((k) => <button key={k} className={sev === k ? "on" : ""} onClick={() => setSev(k)} style={sev === k ? { color: SEV[k].color } : {}}>{SEV[k].label}</button>)}
                </div>
              </Fld>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Fld label="Hvor"><select style={inp} value={location} onChange={(e) => setLocation(e.target.value)}>{locs.map(([id, l]) => <option key={id} value={id}>{l.name}</option>)}</select></Fld>
              <Fld label="Kilde"><select style={inp} value={source} onChange={(e) => setSource(e.target.value)}>{Object.entries(SOURCES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}</select></Fld>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Fld label="Ansvarlig">
                <div className="opp-people" style={{ flexWrap: "wrap" }}>
                  {OWNERS.map((uid) => <button key={uid} className={`opp-person ${owner === uid ? "on" : ""}`} onClick={() => setOwner(uid)}><Av id={uid} size={22} /> {empName(uid).split(" ")[0]}</button>)}
                </div>
              </Fld>
              <Fld label="Frist (valgfritt)"><input style={inp} value={due} onChange={(e) => setDue(e.target.value)} placeholder="f.eks. 31. mai" /></Fld>
            </div>
            <Fld label="Detaljer (valgfritt)"><textarea style={{ ...inp, minHeight: 76, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Hva ble observert? Strakstiltak gjort?" /></Fld>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", background: "var(--secondary)", padding: "9px 12px", borderRadius: 10 }}>
              <Ic n="bot" s={15} c="var(--cat, var(--orange))" /> Botsson foreslår eier og kobler avviket til riktig protokoll etter at det er meldt.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "14px 18px", borderTop: "1px solid var(--border)", position: "sticky", bottom: 0, background: "var(--card)" }}>
            <button className="btn btn-secondary" onClick={onClose}>Avbryt</button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-primary" disabled={!valid} onClick={submit} style={{ opacity: valid ? 1 : 0.5 }}><Ic n="arrowRight" s={14} c="#fff" /> Meld inn — til «Meldt»</button>
          </div>
        </div>
      </>
    );
  }
  function Fld({ label, req, children }) {
    return <div className="opp-field" style={{ margin: 0 }}><label>{label}{req && <span style={{ color: "var(--error)" }}> *</span>}</label>{children}</div>;
  }

  window.HmsDeviations = HmsDeviations;
})();
