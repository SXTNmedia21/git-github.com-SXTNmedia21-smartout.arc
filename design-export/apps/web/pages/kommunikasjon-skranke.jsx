// ===== Kommunikasjon · Skranke (Helpdesk) — tab host (window.KoSkranke) =====
// Self-contained: owns desks + cases state and the ticket drawer / desk modal
// overlays. Two perspectives in one surface — an overview of ALL desks plus
// "Min kø" (my own queue) — then a full filterable ticket queue, an analytics
// dashboard, and helpdesk setup. Renders inside the Kommunikasjon page when the
// "Skranke" tab is active. Reuses Ko primitives + pages.css .pulse.
(function () {
  const { useState, useEffect, useMemo } = React;
  const Ko = window.Ko, Ic = window.Ic, SD = window.SmartoutData;
  const ME = SD.SK_ME;

  // ---- shared badges from catalogs ----
  const StatusBadge = ({ id }) => { const m = SD.CASE_STATUS[id]; return m ? <Ko.Badge tone={m.tone} ic={m.icon}>{m.label}</Ko.Badge> : null; };
  const PrioBadge = ({ id, outline }) => { const m = SD.CASE_PRIORITY[id]; return m && id !== "normal" && id !== "lav" ? <Ko.Badge tone={m.tone} ic={m.icon} outline={outline}>{m.label}</Ko.Badge> : null; };
  const SlaBadge = ({ id }) => { const m = SD.SLA_STATE[id]; return m && (id === "snart" || id === "forfalt") ? <Ko.Badge tone={m.tone} ic={m.icon}>{m.label}</Ko.Badge> : null; };

  function DeskChip({ id }) { const d = SD.DESK_BY_ID[id] || {}; return <span className="ko-chchip sm" style={{ "--ch": d.color }}><Ic n="lifebuoy" s={11} /><span>{d.slug}</span></span>; }

  // ---- a ticket row (queue + min kø) ----
  function CaseRow({ c, onOpen, compact }) {
    const requester = Ko.person(c.requester);
    const owner = Ko.person(c.owner);
    const cat = SD.SK_CATEGORIES[c.category] || {};
    const sm = SD.CASE_STATUS[c.status] || {};
    return (
      <div className={`ko-caserow ${compact ? "compact" : ""}`} role="button" tabIndex={0} onClick={() => onOpen(c.id)}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(c.id); }}>
        <span className="ko-case-edge" data-tone={sm.tone} />
        <Ko.Av id={c.requester} size={compact ? 30 : 34} />
        <div className="ko-case-main">
          <div className="ko-case-subj">{c.subject}{c.priority === "haster" && <span className="ko-case-urgent"><Ic n="alert" s={13} /></span>}</div>
          <div className="ko-case-meta">
            <DeskChip id={c.desk} />
            <span className="dot" />
            <span className="seg">{requester.name}</span>
            {!compact && <><Ic n="arrowRight" s={11} style={{ opacity: 0.5 }} /><span className="seg">{owner.id === ME ? "deg" : owner.name}</span></>}
            <span className="dot" />
            <span className="mono">{cat.label}</span>
            <span className="dot" />
            <span className="mono">{c.ageLabel}</span>
          </div>
        </div>
        <div className="ko-case-side">
          <SlaBadge id={c.sla} />
          <PrioBadge id={c.priority} />
          <StatusBadge id={c.status} />
        </div>
      </div>
    );
  }

  function KoSkranke() {
    const toast = window.useToast();
    const [sub, setSub] = useState("oversikt"); // oversikt | ko | analyse | innstillinger
    const [desks, setDesks] = useState(() => SD.DESKS.map((d) => ({ ...d })));
    const [cases, setCases] = useState(() => SD.CASES.map((c) => ({ ...c, messages: [...c.messages], notes: [...c.notes], activity: [...c.activity] })));
    const [selId, setSelId] = useState(null);
    const [deskModal, setDeskModal] = useState(null); // { mode, initial }
    const [assistDone, setAssistDone] = useState(false);

    // queue controls
    const [q, setQ] = useState("");
    const [statusF, setStatusF] = useState("open"); // open | mine | overdue | lost | all
    const [deskF, setDeskF] = useState("all");
    const [sort, setSort] = useState("frist");

    const sel = selId ? cases.find((c) => c.id === selId) : null;
    const caseById = (id) => cases.find((c) => c.id === id);

    const openCases = cases.filter((c) => SD.SK_OPEN_STATES.includes(c.status));
    const myOpen = openCases.filter((c) => c.owner === ME);
    const overdue = cases.filter((c) => c.sla === "forfalt");
    const myDesks = desks.filter((d) => d.owners.includes(ME));
    const otherDesks = desks.filter((d) => !d.owners.includes(ME));
    const resolvedToday = cases.filter((c) => c.status === "lost" && (c.updatedAt || "").includes("dag")).length + 2;

    // Botsson assist: most pressing open case I own (overdue first, then waiting w/ a draft)
    const assist = useMemo(() => {
      const mine = openCases.filter((c) => c.owner === ME);
      const pick = mine.find((c) => c.sla === "forfalt") || mine.find((c) => c.aiDraft && c.status === "venter_ansvarlig") || mine.find((c) => c.status === "venter_ansvarlig");
      return pick || null;
    }, [cases]);

    // ---------- actions ----------
    function pushActivity(c, ev) { return { ...c, activity: [...c.activity, ev] }; }
    function setCase(id, fn) { setCases((prev) => prev.map((c) => (c.id === id ? fn(c) : c))); }

    function sendReply(id, body) {
      setCase(id, (c) => ({ ...c, messages: [...c.messages, { from: ME, body, at: "nå", self: true }], status: c.status === "venter_ansvarlig" || c.status === "ny" || c.status === "gjenapnet" ? "venter_ansatt" : c.status, firstResponseMin: c.firstResponseMin == null ? 1 : c.firstResponseMin, activity: [...c.activity, { at: "nå", by: ME, text: "Svar sendt" }] }));
      toast("Svar sendt");
    }
    function changeStatus(c, status) {
      setCase(c.id, (x) => pushActivity({ ...x, status }, { at: "nå", by: ME, text: `Status → ${SD.CASE_STATUS[status].label}` }));
    }
    function changePriority(c, priority) {
      setCase(c.id, (x) => pushActivity({ ...x, priority }, { at: "nå", by: ME, text: `Prioritet → ${SD.CASE_PRIORITY[priority].label}` }));
      toast(`Prioritet satt til ${SD.CASE_PRIORITY[priority].label}`);
    }
    function resolveCase(c) {
      const prev = c.status;
      setCase(c.id, (x) => ({ ...x, status: "lost", sla: "lost", messages: [...x.messages, { from: "sys", body: `${Ko.person(ME).name} markerte saken som løst`, at: "nå" }], activity: [...x.activity, { at: "nå", by: ME, text: "Løst" }] }));
      toast("Sak løst", { undo: () => setCase(c.id, (x) => ({ ...x, status: prev, sla: c.sla })) });
    }
    function reopenCase(c) {
      setCase(c.id, (x) => ({ ...x, status: "gjenapnet", sla: "snart", activity: [...x.activity, { at: "nå", by: ME, text: "Gjenåpnet" }] }));
      toast("Sak gjenåpnet");
    }
    function reassign(c, ownerId) {
      const prev = c.owner;
      setCase(c.id, (x) => pushActivity({ ...x, owner: ownerId }, { at: "nå", by: ME, text: `Tildelt ${Ko.person(ownerId).name}` }));
      toast(`Tildelt ${Ko.person(ownerId).name}`, { undo: () => setCase(c.id, (x) => ({ ...x, owner: prev })) });
    }
    function addNote(id, body) {
      setCase(id, (c) => ({ ...c, notes: [...c.notes, { by: ME, at: "nå", body }] }));
    }
    function acceptDraft(id) { setCase(id, (c) => ({ ...c, draftUsed: true, activity: [...c.activity, { at: "nå", by: "bot", text: "Forslag satt inn av ansvarlig", ai: true }] })); }
    function dismissDraft(id) { setCase(id, (c) => ({ ...c, draftDismissed: true })); }

    // desks
    function upsertDesk(payload) {
      if (payload.id) {
        setDesks((prev) => prev.map((d) => d.id === payload.id ? { ...d, ...payload } : d));
        toast("Skranke oppdatert");
      } else {
        const id = "d-" + Math.random().toString(36).slice(2, 7);
        const area = (Object.values(SD.SK_AREAS).find((a) => a.label === payload.name) || {}).id || "Drift";
        const d = { id, ...payload, area, color: "#f97316", members: 0, lastAt: "nå", openCount: 0, overdueCount: 0, desc: "Ny skranke." };
        setDesks((prev) => [...prev, d]);
        toast(`Skranke #${d.slug} opprettet`, { undo: () => setDesks((prev) => prev.filter((x) => x.id !== id)) });
      }
      setDeskModal(null);
    }

    function openCase(id) { setSelId(id); }
    function gotoQueue(f) { setStatusF(f); setSub("ko"); }

    // ---------- queue filter ----------
    const queue = useMemo(() => {
      let l = cases.slice();
      if (statusF === "open") l = l.filter((c) => SD.SK_OPEN_STATES.includes(c.status));
      else if (statusF === "mine") l = l.filter((c) => c.owner === ME && SD.SK_OPEN_STATES.includes(c.status));
      else if (statusF === "overdue") l = l.filter((c) => c.sla === "forfalt");
      else if (statusF === "lost") l = l.filter((c) => c.status === "lost");
      if (deskF !== "all") l = l.filter((c) => c.desk === deskF);
      const term = q.trim().toLowerCase();
      if (term) l = l.filter((c) => c.subject.toLowerCase().includes(term) || Ko.person(c.requester).name.toLowerCase().includes(term));
      if (sort === "prioritet") l.sort((a, b) => SD.CASE_PRIORITY[b.priority].rank - SD.CASE_PRIORITY[a.priority].rank);
      else if (sort === "frist") l.sort((a, b) => slaRank(b.sla) - slaRank(a.sla));
      return l;
    }, [cases, statusF, deskF, q, sort]);
    function slaRank(s) { return s === "forfalt" ? 3 : s === "snart" ? 2 : s === "innen" ? 1 : 0; }

    // ================= render =================
    return (
      <div className="ko-stack">
        {/* sub-tabs */}
        <div className="ko-subtabs">
          {[["oversikt", "Oversikt", "lifebuoy"], ["ko", "Kø", "inbox"], ["analyse", "Analyse", "chart"], ["innstillinger", "Innstillinger", "sliders"]].map(([k, l, ic]) => (
            <button key={k} className={sub === k ? "on" : ""} onClick={() => setSub(k)}><Ic n={ic} s={14} /> {l}
              {k === "ko" && <span className="cnt">{openCases.length}</span>}
            </button>
          ))}
        </div>

        {sub === "oversikt" && (
          <Oversikt
            kpis={{ open: openCases.length, mine: myOpen.length, overdue: overdue.length, desks: myDesks.length, resolvedToday }}
            assist={assist} assistDone={assistDone} myDesks={myDesks} otherDesks={otherDesks} myOpen={myOpen}
            onAssist={() => { if (assist) { openCase(assist.id); } }} onDismissAssist={() => setAssistDone(true)}
            onOpen={openCase} onGotoQueue={gotoQueue} onConfigure={(d) => setDeskModal({ mode: "edit", initial: d })} />
        )}

        {sub === "ko" && (
          <Queue queue={queue} desks={desks} q={q} setQ={setQ} statusF={statusF} setStatusF={setStatusF}
            deskF={deskF} setDeskF={setDeskF} sort={sort} setSort={setSort} onOpen={openCase} />
        )}

        {sub === "analyse" && <window.KoSkrankeAnalyse desks={desks} cases={cases} />}

        {sub === "innstillinger" && (
          <window.KoSkrankeSetup desks={desks}
            onEdit={(d) => setDeskModal({ mode: "edit", initial: d })}
            onNew={() => setDeskModal({ mode: "create" })}
            onUpgrade={(n) => setDeskModal({ mode: "create", initial: { name: n.name, slug: n.slug, preset: "public", owners: ["ma"], categories: [], ai: "mention", sla: { first: 30, resolve: 8 } } })} />
        )}

        {/* overlays */}
        <window.KoCaseDrawer c={sel} onClose={() => setSelId(null)}
          onSendReply={sendReply} onStatus={changeStatus} onPriority={changePriority}
          onResolve={resolveCase} onReopen={reopenCase} onReassign={reassign}
          onAddNote={addNote} onAcceptDraft={acceptDraft} onDismissDraft={dismissDraft} />

        <window.KoDeskModal open={!!deskModal} mode={deskModal && deskModal.mode} initial={deskModal && deskModal.initial}
          onClose={() => setDeskModal(null)} onSubmit={upsertDesk} />
      </div>
    );
  }

  // ============================================================
  // OVERSIKT
  // ============================================================
  function Oversikt({ kpis, assist, assistDone, myDesks, otherDesks, myOpen, onAssist, onDismissAssist, onOpen, onGotoQueue, onConfigure }) {
    const PULSES = [
      { lbl: "Åpne saker", val: kpis.open, ic: "inbox", f: "open" },
      { lbl: "Venter på deg", val: kpis.mine, ic: "reply", f: "mine", tone: kpis.mine ? "warn" : "ok" },
      { lbl: "Forfalt", val: kpis.overdue, ic: "alert", f: "overdue", tone: kpis.overdue ? "crit" : "ok" },
      { lbl: "Mine skranker", val: kpis.desks, ic: "lifebuoy" },
      { lbl: "Løst i dag", val: kpis.resolvedToday, ic: "check", tone: "ok", f: "lost" },
    ];
    return (
      <div className="ko-stack">
        <div className="ko-pulserow">
          {PULSES.map((p) => (
            <button key={p.lbl} className="pulse" onClick={() => p.f && onGotoQueue(p.f)}>
              <span className="pulse-lbl"><span className="ico"><Ic n={p.ic} s={13} /></span>{p.lbl}</span>
              <span className={`pulse-val ${p.tone || ""}`}>{p.val}</span>
            </button>
          ))}
        </div>

        {/* Botsson assist */}
        {assist && !assistDone && (
          <div className="ko-assist">
            <span className="ko-assist-av"><Ic n="bot" s={17} c="#fff" /></span>
            <div className="ko-assist-body">
              <div className="ko-assist-t"><strong>{Ko.person(assist.requester).name} venter på svar i {assist.channelThread}</strong> — «{assist.subject}»{assist.sla === "forfalt" && <span className="ko-assist-warn"> · frist passert</span>}</div>
              <div className="ko-assist-sources">
                <span className="src"><DeskChip id={assist.desk} /></span>
                {assist.aiDraft ? <span className="src"><Ic n="bot" s={11} /> Forslag til svar klart</span> : <span className="src"><Ic n="timer" s={11} /> {assist.ageLabel} siden</span>}
                <span className="src"><Ic n="file" s={11} /> {(assist.aiSources || []).length} kilder</span>
              </div>
            </div>
            <div className="ko-assist-actions">
              <button className="ko-btn sm primary" onClick={onAssist}><Ic n="arrowRight" s={14} /> Åpne sak</button>
              <button className="ko-btn sm ghost" onClick={onDismissAssist}>Avvis</button>
            </div>
          </div>
        )}

        {/* my desks */}
        <Ko.Panel icon="lifebuoy" iconTone="warn" title="Mine skranker" cnt={myDesks.length}
          action={<button className="ko-linkbtn" onClick={() => onGotoQueue("mine")}>Min kø <Ic n="chevRight" s={13} /></button>}>
          <div className="ko-deskgrid">
            {myDesks.map((d) => <DeskCard key={d.id} d={d} onConfigure={onConfigure} onOpenQueue={() => onGotoQueue("mine")} mine />)}
          </div>
        </Ko.Panel>

        {/* my queue */}
        <Ko.Panel icon="inbox" title="Min kø" sub="Saker du er ansvarlig for" cnt={myOpen.length}
          action={<button className="ko-linkbtn" onClick={() => onGotoQueue("mine")}>Se alle <Ic n="chevRight" s={13} /></button>}>
          {myOpen.length === 0 ? (
            <Ko.Empty icon="check" title="Køen er tom" sub="Ingen åpne saker venter på deg akkurat nå." />
          ) : (
            <div className="ko-caselist">
              {myOpen.slice(0, 5).map((c) => <CaseRow key={c.id} c={c} onOpen={onOpen} compact />)}
            </div>
          )}
        </Ko.Panel>

        {/* other desks */}
        <Ko.Panel icon="hash" title="Andre skranker" sub="Drevet av andre ansvarlige" cnt={otherDesks.length}>
          <div className="ko-deskgrid">
            {otherDesks.map((d) => <DeskCard key={d.id} d={d} onConfigure={onConfigure} onOpenQueue={() => {}} />)}
          </div>
        </Ko.Panel>
      </div>
    );
  }

  function DeskCard({ d, onConfigure, onOpenQueue, mine }) {
    const pre = SD.SKRANKE_PRESETS[d.preset] || {};
    const area = SD.SK_AREAS[d.area] || {};
    return (
      <div className="ko-deskcard" style={{ "--ch": d.color }}>
        <div className="ko-deskcard-top">
          <span className="ic"><Ic n={pre.icon || "lifebuoy"} s={17} /></span>
          <div className="id"><div className="nm">#{d.slug}</div><div className="kd">{d.name}</div></div>
          <span className="spacer" />
          <button className="ko-iconbtn sm" onClick={() => onConfigure(d)} aria-label="Konfigurer"><Ic n="sliders" s={15} /></button>
        </div>
        <div className="ko-deskcard-stats">
          <div className="st"><span className="n mono">{d.openCount}</span><span className="l">åpne</span></div>
          <div className="st"><span className={`n mono ${d.overdueCount ? "crit" : ""}`}>{d.overdueCount}</span><span className="l">forfalt</span></div>
          <div className="st owners">{d.owners.map((id) => <Ko.Av key={id} id={id} size={22} />)}<span className="l">ansvarlig</span></div>
        </div>
        <div className="ko-deskcard-foot">
          <Ko.Badge tone={d.preset === "private" ? "purple" : "orange"} ic={d.preset === "private" ? "lock" : "globe"}>{d.preset === "private" ? "Privat" : "Offentlig"}</Ko.Badge>
          <span className="seg"><Ic n="timer" s={12} /> {d.sla.first} min</span>
          {mine && d.openCount > 0 && <button className="ko-linkbtn" onClick={onOpenQueue}>Åpne kø <Ic n="chevRight" s={13} /></button>}
        </div>
      </div>
    );
  }

  // ============================================================
  // KØ — full ticket queue
  // ============================================================
  function Queue({ queue, desks, q, setQ, statusF, setStatusF, deskF, setDeskF, sort, setSort, onOpen }) {
    const FILTERS = [["open", "Åpne"], ["mine", "Mine"], ["overdue", "Forfalt"], ["lost", "Løst"], ["all", "Alle"]];
    return (
      <div className="ko-stack">
        <div className="ko-toolbar">
          <div className="ko-search"><Ic n="search" s={15} c="var(--muted)" /><input placeholder="Søk i saker…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="ko-segrow">
            {FILTERS.map(([k, l]) => <button key={k} className={`ko-chip ${statusF === k ? "on" : ""}`} onClick={() => setStatusF(k)}>{l}</button>)}
          </div>
          <span className="spacer" />
          <select className="ko-select" value={deskF} onChange={(e) => setDeskF(e.target.value)}>
            <option value="all">Alle skranker</option>
            {desks.map((d) => <option key={d.id} value={d.id}>#{d.slug}</option>)}
          </select>
          <select className="ko-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="frist">Etter frist</option><option value="prioritet">Etter prioritet</option>
          </select>
        </div>

        <Ko.Panel className="flush">
          {queue.length === 0 ? (
            <Ko.Empty icon="inbox" title="Ingen saker" sub="Ingen saker matcher filteret. Juster søk eller status." />
          ) : (
            <div className="ko-caselist boxed">
              {queue.map((c) => <CaseRow key={c.id} c={c} onOpen={onOpen} />)}
            </div>
          )}
        </Ko.Panel>
      </div>
    );
  }

  window.KoSkranke = KoSkranke;
})();
