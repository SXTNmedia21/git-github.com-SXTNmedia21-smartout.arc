// ===== Vaktplan — Shift Controller (tabbed command center for one shift) =====
// Loads after vaktplan-parts.jsx, before vaktplan.jsx. Exposes window.VPController.
(function () {
  const { useState, useEffect, useMemo } = React;
  const Ic = window.Ic;
  const VP = window.VP;
  const { DEPT, EMP, empById, DAYS, TODAY } = VP;

  const dnLong = { Man: "Mandag", Tir: "Tirsdag", Ons: "Onsdag", Tor: "Torsdag", Fre: "Fredag", Lør: "Lørdag", Søn: "Søndag" };
  const dayLbl = (d) => `${dnLong[DAYS[d].dn]} ${DAYS[d].num}/${DAYS[d].mon}`;
  const hhmm = (h) => `${String(Math.floor(h)).padStart(2, "0")}:00`;

  const ROLE_FUNCS = {
    "Servitør": ["Servering", "Kassehåndtering", "Allergenkunnskap"],
    "Bartender": ["Skjenkebevilling", "Kassehåndtering", "Kassaoppgjør"],
    "Kokk": ["IK-mat / HACCP", "Allergenkunnskap", "Knivhåndtering"],
    "Vertinne": ["Servering", "Bordkart / booking"],
    "Driftsleder": ["Personalansvar", "Kassaoppgjør", "Nøkkelansvar"],
  };
  // zones / stations per department (location tags)
  const ZONES = {
    sal: ["Sone A", "Sone B", "Uteservering", "Lounge", "Vindusrekke"],
    bar: ["Hovedbar", "Uterservering", "Lounge"],
    kjokken: ["Varm", "Kald", "Dessert", "Oppvask", "Prep"],
    event: ["Selskapslokale", "Scene", "Event-bar"],
    lager: ["Tørrlager", "Kjøl", "Frys"],
  };

  const EMP_SKILLS = {
    ma: ["Servering", "Kassehåndtering", "Kassaoppgjør", "Nøkkelansvar", "Personalansvar", "Allergenkunnskap"],
    jh: ["IK-mat / HACCP", "Allergenkunnskap", "Knivhåndtering", "Kassaoppgjør"],
    ao: ["IK-mat / HACCP", "Allergenkunnskap"],
    sl: ["Servering", "Kassehåndtering", "Allergenkunnskap", "Bordkart / booking"],
    pk: ["Servering", "Allergenkunnskap"],
    ea: ["Servering", "Bordkart / booking"],
    mh: ["Kassehåndtering", "Kassaoppgjør"],
  };

  // competence metadata — what each function is + how it's earned
  const FUNC_INFO = {
    "Servering": { kind: "Protokoll", desc: "Grunnopplæring i servering, hygiene og gjesteflyt." },
    "Kassehåndtering": { kind: "Protokoll", desc: "Betaling, retur og kontanthåndtering i kassa." },
    "Allergenkunnskap": { kind: "Sertifikat", desc: "Kjennskap til de 14 allergenene og rutiner ved spørsmål.", exp: true },
    "Skjenkebevilling": { kind: "Bevilling", desc: "Personlig kunnskapsprøve for skjenking av alkohol.", exp: true },
    "Kassaoppgjør": { kind: "Protokoll", desc: "Telle opp, avstemme og låse kassa ved stenging." },
    "IK-mat / HACCP": { kind: "Sertifikat", desc: "Internkontroll mat — temperatur, sporbarhet og avvik.", exp: true },
    "Knivhåndtering": { kind: "Protokoll", desc: "Sikker bruk og vedlikehold av kniv på kjøkken." },
    "Bordkart / booking": { kind: "Protokoll", desc: "Bordkart, reservasjoner og sitteplassflyt." },
    "Personalansvar": { kind: "Rolle", desc: "Personalledelse, vakthåndtering og oppfølging." },
    "Nøkkelansvar": { kind: "Ansvar", desc: "Nøkkel, alarm og stengeansvar for lokalet." },
  };
  const funcInfo = (f) => FUNC_INFO[f] || { kind: "Kompetanse", desc: "Påkrevd kompetanse for rollen." };

  const TABS = [
    ["detaljer", "Detaljer", "file"],
    ["funksjoner", "Funksjoner", "clipcheck"],
    ["historikk", "Historikk", "history"],
    ["lonn", "Lønnsgrunnlag", "wallet"],
    ["oppgaver", "Oppgaver", "list"],
    ["livslop", "Livsløp", "layers"],
    ["innst", "Innstillinger", "settings"],
  ];

  const LC_PHASES = [
    { k: "created", l: "Opprettet" }, { k: "assigned", l: "Tildelt" }, { k: "published", l: "Publisert" },
    { k: "active", l: "Aktiv" }, { k: "completed", l: "Fullført" }, { k: "interpreted", l: "Tolket" },
    { k: "settled", l: "Avregnet" }, { k: "approved", l: "Godkjent" },
  ];

  function TaskDrawer({ mode, task, emp, shiftWindow, locked, onClose, onToggle, onCreate, onUpdate, onDelete }) {
    const isNew = mode === "new";
    const validTime = (v) => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);
    const [title, setTitle] = useState(task ? task.title : "");
    const [prio, setPrio] = useState(task ? task.prio : "Normal");
    const [due, setDue] = useState(task && validTime(task.due) ? task.due : hhmm(shiftWindow[0]));
    const [note, setNote] = useState(task ? (task.note || "") : "");
    useEffect(() => { const h = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
    const canSave = title.trim().length > 0;
    const save = () => { const data = { title: title.trim(), prio, due, note }; isNew ? onCreate(data) : onUpdate(data); };
    return (
      <div className="vp-ctl-drawerscrim" onMouseDown={onClose}>
        <div className="vp-ctl-drawer" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label={isNew ? "Ny oppgave" : "Oppgave"}>
          <div className="vp-ctl-drawer-head">
            <span className="vp-ctl-drawer-ic"><Ic n={isNew ? "plus" : "list"} s={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-ctl-drawer-t">{isNew ? "Ny oppgave" : "Oppgavedetaljer"}</div>
              <div className="vp-ctl-drawer-s">{emp ? emp.name : "Vakt"} · {isNew ? "ny oppgave" : (task && task.done ? "fullført" : "åpen")}</div>
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>
          <div className="vp-ctl-drawer-body">
            {!isNew && task && (
              <button className={`vp-ctl-drawer-status ${task.done ? "done" : ""}`} onClick={onToggle} disabled={locked}>
                <span className="ck">{task.done && <Ic n="check" s={13} sw={2.8} />}</span>
                {task.done ? "Fullført — trykk for å gjenåpne" : "Marker som fullført"}
              </button>
            )}
            <div className="vp-ctl-field full"><span className="vp-ctl-flbl">Oppgave</span><input className="vp-finput" value={title} onChange={e => setTitle(e.target.value)} placeholder="Hva skal gjøres?" disabled={locked} autoFocus /></div>
            <div className="vp-ctl-drawer-row">
              <div className="vp-ctl-field"><span className="vp-ctl-flbl">Prioritet</span>
                <div className="vp-fselect"><select className="vp-finput" value={prio} onChange={e => setPrio(e.target.value)} disabled={locked}>{["Høy", "Normal", "Lav"].map(o => <option key={o} value={o}>{o}</option>)}</select><span className="vp-fselect-chev"><Ic n="chevDown" s={15} /></span></div>
              </div>
              <div className="vp-ctl-field"><span className="vp-ctl-flbl">Frist</span><input className="vp-finput" type="time" value={due} onChange={e => setDue(e.target.value)} disabled={locked} /></div>
            </div>
            <div className="vp-ctl-field full"><span className="vp-ctl-flbl">Notat (valgfritt)</span><textarea className="vp-finput" style={{ minHeight: 70 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Detaljer, utstyr, hvor…" disabled={locked} /></div>
          </div>
          <div className="vp-ctl-drawer-foot">
            {!isNew && !locked && <button className="sk-ghost" style={{ color: "var(--error)" }} onClick={onDelete}><Ic n="trash" s={14} /> Slett</button>}
            <span className="sp" />
            <button className="sk-ghost" onClick={onClose}>Avbryt</button>
            {!locked && <button className="sk-primary" disabled={!canSave} onClick={save}><Ic n="check" s={14} sw={2.3} /> {isNew ? "Legg til" : "Lagre"}</button>}
          </div>
        </div>
      </div>
    );
  }

  function CompetenceDrawer({ func, currentEmpId, dep, onClose, onAssign, toast }) {
    const info = funcInfo(func);
    const holders = EMP.filter(e => (EMP_SKILLS[e.id] || []).includes(func));
    const cur = currentEmpId ? empById(currentEmpId) : null;
    const curHas = cur && (EMP_SKILLS[cur.id] || []).includes(func);
    useEffect(() => { const h = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
    const sorted = [...holders].sort((a, b) => (a.dep === dep ? -1 : 0) - (b.dep === dep ? -1 : 0));
    return (
      <div className="vp-ctl-drawerscrim" onMouseDown={onClose}>
        <div className="vp-ctl-drawer" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label={`Kompetanse ${func}`}>
          <div className="vp-ctl-drawer-head">
            <span className="vp-ctl-drawer-ic"><Ic n="clipcheck" s={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vp-ctl-drawer-t">{func}</div>
              <div className="vp-ctl-drawer-s">{info.kind} · {holders.length} kvalifisert</div>
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>
          <div className="vp-ctl-drawer-body">
            <div className="vp-cmp-desc"><span className={`vp-cmp-kind ${info.kind.toLowerCase()}`}>{info.kind}</span>{info.desc}{info.exp ? " Fornyes jevnlig." : ""}</div>

            {cur && (
              <div className={`vp-cmp-cur ${curHas ? "ok" : "miss"}`}>
                <span className="vp-emp-av" style={{ width: 30, height: 30, background: cur.c, fontSize: 11 }}>{cur.init}</span>
                <div className="vp-cmp-cur-id"><div className="nm">{cur.name}</div><div className="rl">{curHas ? "Har kompetansen" : "Mangler — kreves for rollen"}</div></div>
                {curHas ? <span className="vp-cmp-badge ok"><Ic n="check" s={12} sw={2.6} /> OK</span>
                  : <button className="vp-cmp-courb" onClick={() => { toast(`Kurskrav sendt til ${cur.name.split(" ")[0]}: ${func}`, { undo: () => {} }); onClose(); }}><Ic n="send" s={13} /> Send kurskrav</button>}
              </div>
            )}

            <div className="vp-ctl-drawer-seclbl">Hvem har den · {holders.length}</div>
            <div className="vp-cmp-list">
              {sorted.length === 0 ? (
                <div className="vp-cmp-empty">Ingen i teamet er registrert med «{func}». Send kurskrav eller registrer kurs.</div>
              ) : sorted.map(e => (
                <div key={e.id} className="vp-cmp-row">
                  <span className="vp-emp-av" style={{ width: 28, height: 28, background: e.c, fontSize: 10 }}>{e.init}</span>
                  <div className="vp-cmp-id"><div className="nm">{e.name}</div><div className="rl"><span className="dot" style={{ background: DEPT[e.dep].c }} /> {e.role}</div></div>
                  {e.id === currentEmpId
                    ? <span className="vp-cmp-badge cur">På vakten</span>
                    : <button className="vp-cmp-assign" onClick={() => { onAssign(e.id); toast(`${e.name.split(" ")[0]} satt på vakten`); onClose(); }}>{cur ? "Bytt til" : "Tildel"}</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="vp-ctl-drawer-foot">
            <span className="vp-ctl-drawer-foothint"><Ic n="shield" s={12} /> Kompetanse styres i Bibliotek · HMS</span>
            <span className="sp" />
            <button className="sk-ghost" onClick={onClose}>Lukk</button>
          </div>
        </div>
      </div>
    );
  }

  function Controller({ shift, slot, initialTab, onClose, onSave, onDelete, onAction, onOpenProfile, toast }) {    const editing = !!shift;
    const locked = !!(shift && shift.lock);
    const [tab, setTab] = useState(initialTab || "detaljer");
    const [empId, setEmpId] = useState(shift ? shift.e : (slot && slot.e) || "");
    const [role, setRole] = useState(shift ? shift.role : (slot && slot.role) || "");
    const [dep, setDep] = useState(shift ? shift.dep : (slot && slot.dep) || "sal");
    const [st, setSt] = useState(shift ? shift.st : (slot && slot.st != null) ? slot.st : 16);
    const [en, setEn] = useState(shift ? shift.en : (slot && slot.en != null) ? slot.en : 23);
    const [brk, setBrk] = useState(shift && shift.en - shift.st >= 6 ? 45 : 30);
    const [notes, setNotes] = useState("");
    const [team, setTeam] = useState(shift && shift.team ? shift.team : null);
    const [zones, setZones] = useState(shift && shift.zones ? shift.zones : []);
    const [respVakt, setRespVakt] = useState(shift && shift.respVakt != null ? shift.respVakt : (shift ? shift.role === "Driftsleder" : false));
    const [respNokkel, setRespNokkel] = useState(shift && shift.respNokkel != null ? shift.respNokkel : (shift ? (shift.role === "Driftsleder" || shift.en >= 22) : false));
    const [empPick, setEmpPick] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [compare, setCompare] = useState(false);
    const [tasks, setTasks] = useState(null);
    const [settings, setSettings] = useState({ notify: true, marketplace: true, swap: true, template: false, audit: true });
    const [justify, setJustify] = useState(null); // null | { type, reason }
    const [taskPanel, setTaskPanel] = useState(null); // null | { mode:'new'|'view', id? }
    const [dagslinje, setDagslinje] = useState(false);
    const [fixOpen, setFixOpen] = useState(null); // issue index
    const [funcPanel, setFuncPanel] = useState(null); // competence name

    const dayIdx = shift ? shift.d : (slot && slot.d) != null ? slot.d : TODAY;
    const day = DAYS[dayIdx];
    const emp = empById(empId);
    const mark = () => { setDirty(true); setSavedAt(null); };

    // status derivation
    const state = !editing ? "new" : locked ? (shift.lc === "closed" ? "closed" : "settled") : shift.status === "changed" ? "changed" : shift.status === "draft" ? "draft" : shift.lc === "active" ? "active" : "published";
    const pubLbl = { new: "Ikke publisert", draft: "Utkast", changed: "Avpublisert — endret", published: "Publisert", active: "Publisert · aktiv", settled: "Avregnet", closed: "Lukket" }[state];

    // functions / qualification
    const reqFuncs = ROLE_FUNCS[role] || [];
    const skills = EMP_SKILLS[empId] || [];
    const missingFuncs = empId ? reqFuncs.filter(f => !skills.includes(f)) : [];
    const opening = st <= 10, closing = en >= 22, cash = ["Servitør", "Bartender", "Driftsleder"].includes(role), keyholder = role === "Driftsleder" || closing;

    // overlap (same emp, same day, other shift)
    const overlap = useMemo(() => {
      if (!empId) return null;
      return VP.SHIFTS.find(s => s.e === empId && s.d === dayIdx && (!shift || s.id !== shift.id) && st < s.en && en > s.st);
    }, [empId, dayIdx, st, en]);

    // issues
    const issues = [];
    if (!empId) issues.push({ sev: "block", t: "Ingen ansatt tildelt", s: "Vakten kan ikke publiseres uten en tildelt ansatt.", ai: true });
    if (!role) issues.push({ sev: "block", t: "Mangler rolle", s: "Velg rolle for vakten." });
    if (overlap) issues.push({ sev: "block", t: "Overlappende vakt", s: `${emp ? emp.name : "Ansatt"} har allerede ${overlap.role} ${overlap.t} samme dag.` });
    missingFuncs.forEach(f => issues.push({ sev: "warn", t: `Mangler funksjon: ${f}`, s: `${emp ? emp.name : "Ansatt"} er ikke registrert med «${f}».`, ai: true }));
    if (empId === "pk" && en - st >= 7) issues.push({ sev: "warn", t: "Passerer 37,5t", s: "Vakten gir Petter overtidstillegg denne uka.", ai: true });
    if (st < 8) issues.push({ sev: "warn", t: "Kort hviletid", s: "Mindre enn 11t siden forrige vakt — sjekk AML." });
    if (state === "changed") issues.push({ sev: "warn", t: "Endret etter publisering", s: "Vakten er avpublisert og må republiseres for å bli synlig igjen." });
    if (locked) issues.push({ sev: "info", t: "Historisk vakt er låst", s: "Avregnede vakter kan ikke endres — data vises for sporbarhet." });

    // tasks (synthesized once)
    const baseTasks = useMemo(() => {
      const t = [];
      if (opening) { t.push({ id: "t1", title: "Temperaturkontroll kjøl & frys", prio: "Høy", due: hhmm(st), done: false, owner: empId }); t.push({ id: "t2", title: "Klargjør stasjon før åpning", prio: "Normal", due: hhmm(st + 1), done: false, owner: empId }); }
      if (cash) t.push({ id: "t3", title: "Tell opp kasse ved oppstart", prio: "Normal", due: hhmm(st), done: false, owner: empId });
      if (closing) { t.push({ id: "t4", title: "Kassaoppgjør", prio: "Høy", due: hhmm(en - 0.5), done: false, owner: empId }); t.push({ id: "t5", title: "Rengjør og lås opp/ned", prio: "Normal", due: hhmm(en), done: false, owner: empId }); }
      if (!t.length) t.push({ id: "t0", title: "Følg dagslinjen for vakten", prio: "Normal", due: hhmm(en), done: false, owner: empId });
      return t;
    }, [opening, cash, closing, st, en, empId]);
    const taskList = tasks || baseTasks;
    const toggleTask = (id) => setTasks((tasks || baseTasks).map(t => t.id === id ? { ...t, done: !t.done } : t));
    const addTask = (t) => { const id = "tn" + Date.now(); setTasks([...(tasks || baseTasks), { id, done: false, owner: empId, ...t }]); return id; };
    const updateTask = (id, patch) => setTasks((tasks || baseTasks).map(t => t.id === id ? { ...t, ...patch } : t));
    const deleteTask = (id) => setTasks((tasks || baseTasks).filter(t => t.id !== id));
    const panelTask = taskPanel && taskPanel.id ? taskList.find(t => t.id === taskPanel.id) : null;

    // history (from pub.changes or synthesized)
    const history = useMemo(() => {
      const h = [];
      if (shift && shift.pub && shift.pub.changes) {
        shift.pub.changes.forEach(c => h.push({ t: c.t, who: c.who || (c.ai ? "Botsson" : c.sys ? "System" : "Maria A."), src: c.ai ? "ai" : c.sys ? "system" : "manager", time: c.time, unpub: /avpublisert/i.test(c.t) }));
      }
      h.push({ t: "Tildelt " + (emp ? emp.name : "åpen vakt"), who: "Maria A.", src: "manager", time: "27/5 17:01" });
      h.push({ t: "Opprettet fra mal «Helg kveld»", who: "Maria A.", src: "template", time: "27/5 17:00" });
      return h;
    }, [shift, emp]);

    // salary
    const totalH = en - st;
    const breakH = brk / 60;
    const nightH = Math.max(0, en - Math.max(21, st)) ; // hours after 21:00
    const weekendH = day.we ? totalH - breakH : 0;
    const overtimeH = (empId === "pk" && totalH >= 7) ? 1 : 0;
    const regularH = Math.max(0, totalH - breakH - overtimeH);
    const base = 255;
    const gross = Math.round(regularH * base + overtimeH * base * 1.5 + nightH * 26 + (day.we ? regularH * 22 : 0));

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);

    const doSave = () => {
      onSave({ id: shift ? shift.id : null, e: empId, d: dayIdx, role, dep, t: `${st}–${en}`, st, en, status: state === "published" || state === "active" ? "changed" : (shift ? shift.status : "draft") });
      setDirty(false); setSavedAt("nå");
    };
    const act = (type) => onAction(type, { id: shift ? shift.id : null, e: empId, d: dayIdx, role, dep, t: `${st}–${en}`, st, en });

    const Field = ({ label, children, full }) => (
      <div className={`vp-ctl-field ${full ? "full" : ""}`}><span className="vp-ctl-flbl">{label}</span>{children}</div>
    );

    // footer actions by state
    const footActions = () => {
      if (locked) return state === "settled"
        ? [{ k: "approve", l: "Godkjenn for lønn", primary: true, ic: "check" }, { k: "duplicate", l: "Dupliser", ic: "copy" }]
        : [{ k: "duplicate", l: "Dupliser", ic: "copy" }];
      if (state === "new") return [{ k: "savedraft", l: "Lagre utkast", ic: "file" }, { k: "publish", l: "Publiser vakt", primary: true, ic: "megaphone" }];
      if (state === "draft") return [{ k: "delete", l: "", ic: "trash", danger: true }, { k: "duplicate", l: "Dupliser", ic: "copy" }, { k: "savedraft", l: "Lagre", ic: "check" }, { k: "publish", l: "Publiser vakt", primary: true, ic: "megaphone" }];
      if (state === "changed") return [{ k: "revert", l: "Angre endringer", ic: "undo" }, { k: "duplicate", l: "Dupliser", ic: "copy" }, { k: "republish", l: "Republiser", primary: true, ic: "megaphone" }];
      // published / active
      return [{ k: "marketplace", l: "Til vaktbørs", ic: "route" }, { k: "swap", l: "Be om bytte", ic: "swap" }, { k: "unpublish", l: "Avpubliser", ic: "eye" }, { k: "sendupdate", l: "Send oppdatering", primary: true, ic: "send" }];
    };

    return (
      <div className="vp-ov-scrim" onMouseDown={onClose}>
        <div className="vp-ctl" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Vaktkontroller">
          {/* header */}
          <div className="vp-ctl-head">
            {emp ? (
              <button className="vp-ctl-av asbtn" style={{ background: DEPT[dep].c }} title={`Åpne profil · ${emp.name}`} onClick={() => onOpenProfile && onOpenProfile(empId)}>{emp.init}</button>
            ) : (
              <span className="vp-ctl-av" style={{ background: DEPT[dep].c }}><Ic n="grid" s={18} /></span>
            )}
            <div className="vp-ctl-htxt">
              <div className={`vp-ctl-title ${emp ? "link" : ""}`} onClick={() => emp && onOpenProfile && onOpenProfile(empId)} role={emp ? "button" : undefined}>{editing ? `${role || "Vakt"} · ${emp ? emp.name : "Åpen vakt"}` : "Ny vakt"}</div>
              <div className="vp-ctl-hsub">{dayLbl(dayIdx)} · {hhmm(st)}–{hhmm(en)} · {DEPT[dep].name}</div>
            </div>
            <div className="vp-ctl-badges">
              <span className={`vp-statepill ${state === "published" || state === "active" ? "published" : state === "draft" || state === "new" || state === "changed" ? "draft" : "locked"}`}>{pubLbl}</span>
              {locked && <span className="vp-statepill locked"><Ic n="lock" s={10} /> Låst</span>}
            </div>
            <button className="vp-ov-x" onClick={onClose}><Ic n="x" s={18} /></button>
          </div>

          {/* tabs */}
          <div className="vp-ctl-tabs">
            {TABS.map(([k, l, ic]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                <Ic n={ic} s={14} /> {l}
                {k === "historikk" && history.length > 0 && <span className="n">{history.length}</span>}
                {k === "funksjoner" && missingFuncs.length > 0 && <span className="dot" />}
              </button>
            ))}
          </div>

          {/* body */}
          <div className="vp-ctl-body">
            {issues.length > 0 && (
              <div className="vp-ctl-issues">
                {issues.map((iss, i) => {
                  const getFix = () => {
                    if (iss.t === "Ingen ansatt tildelt") return { text: "Jonas H. er kvalifisert, ledig og under timegrensa for denne vakten.", actions: [{ label: "Tildel Jonas H.", icon: "check", primary: true, run: () => { setEmpId("jh"); if (!role) setRole("Bartender"); mark(); setFixOpen(null); } }, { label: "Velg en annen", icon: "user", run: () => { setEmpPick(true); setFixOpen(null); } }] };
                    if (iss.t.startsWith("Mangler funksjon")) { const fn = iss.t.split(": ")[1] || "funksjonen"; return { text: `${fn} kreves for rollen. Tildel en som har den, eller send kurskrav til ${emp ? emp.name.split(" ")[0] : "ansatt"}.`, actions: [{ label: "Send kurskrav", icon: "send", primary: true, run: () => { toast(`Kurskrav sendt${emp ? " til " + emp.name.split(" ")[0] : ""}: ${fn}`, { undo: () => {} }); setFixOpen(null); } }, { label: "Se hvem som har den", icon: "users", run: () => { setFuncPanel(fn); setFixOpen(null); } }] }; }
                    if (iss.t === "Passerer 37,5t") return { text: "Kort vakten med 1 time for å holde under 37,5t og unngå overtidstillegg.", actions: [{ label: "Kort med 1 time", icon: "clock", primary: true, run: () => { setEn(en - 1); mark(); setFixOpen(null); } }] };
                    return { text: "Botsson ser på saken og foreslår en justering du kan godta.", actions: [] };
                  };
                  const fx = getFix();
                  return (
                    <div key={i} className="vp-ctl-issuewrap">
                      <div className={`vp-ctl-issue ${iss.sev}`}>
                        <Ic n={iss.sev === "block" ? "ban" : iss.sev === "warn" ? "alert" : "lock"} s={13} />
                        <span className="t">{iss.t}</span>
                        <span className="s">{iss.s}</span>
                        {iss.ai && !locked && <button className={`fix ${fixOpen === i ? "on" : ""}`} onClick={() => setFixOpen(fixOpen === i ? null : i)}><Ic n="sparkle" s={11} /> Fiks</button>}
                      </div>
                      {fixOpen === i && (
                        <div className="vp-ctl-fixbox">
                          <span className="vp-ctl-fix-av"><Ic n="sparkle" s={13} /></span>
                          <div className="vp-ctl-fix-body">
                            <div className="vp-ctl-fix-tag">BOTSSON FORESLÅR</div>
                            <div className="vp-ctl-fix-txt">{fx.text}</div>
                            {fx.actions.length > 0 && (
                              <div className="vp-ctl-fix-actions">
                                {fx.actions.map((a, ai) => <button key={ai} className={`vp-ctl-fix-apply ${a.primary ? "" : "ghost"}`} onClick={a.run}><Ic n={a.icon} s={13} sw={2.3} /> {a.label}</button>)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {tab === "detaljer" && (
              <div className="vp-ctl-tabpane" style={locked ? { opacity: .65, pointerEvents: "none" } : {}}>
                <div className="vp-ctl-grid">
                  <Field label="Dato"><div className="vp-finput readonly">{dayLbl(dayIdx)}</div></Field>
                  <Field label="Ansatt">
                    <button className="vp-femp" onClick={() => setEmpPick(p => !p)}>
                      {emp ? <><span className="vp-emp-av" style={{ width: 24, height: 24, background: emp.c, fontSize: 9 }}>{emp.init}</span> {emp.name}</> : <span style={{ color: "var(--muted)" }}><Ic n="user" s={14} /> Åpen vakt — velg ansatt</span>}
                      <Ic n="chevDown" s={14} c="var(--muted)" style={{ marginLeft: "auto" }} />
                    </button>
                    {empPick && (
                      <div className="vp-ctl-emppick">
                        <button onClick={() => { setEmpId(""); setEmpPick(false); mark(); }}><Ic n="user" s={13} c="var(--muted)" /> Åpen vakt</button>
                        {EMP.map(e => { const miss = (ROLE_FUNCS[role] || []).filter(f => !(EMP_SKILLS[e.id] || []).includes(f)); return (
                          <button key={e.id} onClick={() => { setEmpId(e.id); if (!role) setRole(e.role); setEmpPick(false); mark(); }}>
                            <span className="vp-emp-av" style={{ width: 22, height: 22, background: e.c, fontSize: 9 }}>{e.init}</span>
                            <span style={{ flex: 1, textAlign: "left" }}>{e.name}<span style={{ color: "var(--muted)", fontWeight: 400 }}> · {e.role}</span></span>
                            {role && (miss.length ? <span className="vp-ctl-qual warn"><Ic n="alert" s={11} /> {miss.length}</span> : <span className="vp-ctl-qual ok"><Ic n="check" s={11} sw={2.6} /></span>)}
                          </button>
                        ); })}
                      </div>
                    )}
                  </Field>
                  <Field label="Start"><input className="vp-finput" type="time" value={hhmm(st)} onChange={e => { setSt(parseInt(e.target.value) || 0); mark(); }} /></Field>
                  <Field label="Slutt"><input className="vp-finput" type="time" value={hhmm(en)} onChange={e => { setEn(parseInt(e.target.value) || 0); mark(); }} /></Field>
                  <Field label="Pause">
                    <div className="vp-ctl-seg">{[0, 30, 45, 60].map(b => <button key={b} className={brk === b ? "on" : ""} onClick={() => { setBrk(b); mark(); }}>{b} min</button>)}</div>
                  </Field>
                  <Field label="Rolle">
                    <div className="vp-fselect">
                      <select className="vp-finput" value={role || ""} onChange={e => { setRole(e.target.value); mark(); }}>
                        <option value="" disabled>Velg rolle…</option>
                        {[...Object.keys(ROLE_FUNCS), ...(role && !ROLE_FUNCS[role] ? [role] : [])].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className="vp-fselect-chev"><Ic n="chevDown" s={15} /></span>
                    </div>
                  </Field>
                  <Field label="Avdeling">
                    <div className="vp-ctl-seg">{Object.entries(DEPT).map(([k, d]) => <button key={k} className={dep === k ? "on" : ""} onClick={() => { setDep(k); mark(); }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: d.c, marginRight: 5 }} />{d.name}</button>)}</div>
                  </Field>
                  <Field label="Team">
                    <div className="vp-fselect">
                      <select className="vp-finput" value={team || (role === "Bartender" ? "Bar-laget" : dep === "kjokken" ? "Kjøkken-laget" : "Sal-laget")} onChange={e => { setTeam(e.target.value); mark(); }}>
                        {["Bar-laget", "Kjøkken-laget", "Sal-laget", "Vertskap", "Renhold"].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <span className="vp-fselect-chev"><Ic n="chevDown" s={15} /></span>
                    </div>
                  </Field>
                  <Field label="Sone / stasjon (valgfritt)" full>
                    <div className="vp-ctl-zones">
                      {zones.map(z => (
                        <span key={z} className="vp-ctl-zone"><span className="d" style={{ background: DEPT[dep].c }} />{z}<button onClick={() => { setZones(zones.filter(x => x !== z)); mark(); }} aria-label={`Fjern ${z}`}><Ic n="x" s={11} /></button></span>
                      ))}
                      {(ZONES[dep] || []).filter(z => !zones.includes(z)).length > 0 && (
                        <div className="vp-fselect inline">
                          <select className="vp-ctl-zoneadd" value="" onChange={e => { if (e.target.value) { setZones([...zones, e.target.value]); mark(); } }}>
                            <option value="">+ Legg til sone…</option>
                            {(ZONES[dep] || []).filter(z => !zones.includes(z)).map(z => <option key={z} value={z}>{z}</option>)}
                          </select>
                          <span className="vp-fselect-chev"><Ic n="chevDown" s={14} /></span>
                        </div>
                      )}
                      {zones.length === 0 && (ZONES[dep] || []).length === 0 && <span className="vp-ctl-zonenone">Ingen soner for denne avdelingen</span>}
                    </div>
                  </Field>
                  <Field label="Ansvar" full>
                    <div className="vp-ctl-resptoggles">
                      <button type="button" className={`vp-ctl-toggle ${respVakt ? "on" : ""}`} role="switch" aria-checked={respVakt} onClick={() => { setRespVakt(v => !v); mark(); }}>
                        <span className="ic"><Ic n="shield" s={15} /></span>
                        <span className="tx"><span className="t">Vaktansvarlig</span><span className="s">Leder vakten og håndterer avvik</span></span>
                        <span className="sw"><span className="knob" /></span>
                      </button>
                      <button type="button" className={`vp-ctl-toggle ${respNokkel ? "on" : ""}`} role="switch" aria-checked={respNokkel} onClick={() => { setRespNokkel(v => !v); mark(); }}>
                        <span className="ic"><Ic n="lock" s={15} /></span>
                        <span className="tx"><span className="t">Nøkkel- / stengeansvar</span><span className="s">Låser og setter alarm ved stenging</span></span>
                        <span className="sw"><span className="knob" /></span>
                      </button>
                    </div>
                  </Field>
                  <Field label="Notat (synlig for ansatt)" full><textarea className="vp-finput" value={notes} onChange={e => { setNotes(e.target.value); mark(); }} placeholder="Oppmøtested, ansvar, beskjeder…" /></Field>
                </div>
                <div className="vp-ctl-statusrow">
                  <div><span className="k">Vaktstatus</span><span className="v">{state === "active" ? "Aktiv" : state === "settled" || state === "closed" ? "Fullført" : "Planlagt"}</span></div>
                  <div><span className="k">Publisering</span><span className="v">{pubLbl}</span></div>
                  <div><span className="k">Lås</span><span className="v">{locked ? "Låst" : "Åpen"}</span></div>
                </div>
              </div>
            )}

            {tab === "funksjoner" && (
              <div className="vp-ctl-tabpane">
                <div className="vp-ctl-sec">
                  <div className="vp-ctl-sech">Påkrevd kompetanse <span className="vp-ctl-sechsub">match mot {emp ? emp.name : "ansatt"}</span></div>
                  <div className="vp-ctl-funcs">
                    {reqFuncs.length === 0 && <div className="vp-ctl-muted">Velg rolle for å se påkrevd kompetanse.</div>}
                    {reqFuncs.map(f => { const has = skills.includes(f); return (
                      <button key={f} className={`vp-ctl-func ${has ? "ok" : "miss"} clickable`} onClick={() => setFuncPanel(f)} title={`Åpne ${f}`}>
                        <span className="ic"><Ic n={has ? "check" : "alert"} s={13} sw={has ? 2.6 : 1.8} /></span>
                        <span className="t">{f}</span>
                        <span className="st">{has ? "Oppfylt" : empId ? "Mangler" : "—"}</span>
                        <Ic n="chevRight" s={14} c="var(--muted-soft)" />
                      </button>
                    ); })}
                  </div>
                  {missingFuncs.length > 0 && empId && <div className="vp-ctl-funcwarn"><Ic n="alert" s={13} /> {emp.name} mangler {missingFuncs.length} påkrevd funksjon. Vurder opplæring eller en annen ansatt.</div>}
                </div>
                <div className="vp-ctl-sec">
                  <div className="vp-ctl-sech">Ansvar & tilgang</div>
                  <div className="vp-ctl-resp">
                    {[["Vaktansvarlig", respVakt ? "Ja" : "Nei", "shield"], ["Stasjon / sone", zones.length ? zones.join(", ") : (dep === "kjokken" ? "Varm sone" : role === "Bartender" ? "Bar" : "Sal A"), "mappin"], ["Åpningsansvar", opening ? "Ja" : "Nei", "sun"], ["Nøkkel- / stengeansvar", respNokkel ? "Ja" : "Nei", "lock"], ["Kontanthåndtering", cash ? "Ja" : "Nei", "wallet"], ["Opplæringsansvar", role === "Driftsleder" ? "Ja" : "Nei", "cap"]].map(([k, v, ic]) => (
                      <div key={k} className="vp-ctl-respitem"><span className="ic"><Ic n={ic} s={14} /></span><span className="k">{k}</span><span className={`v ${v === "Ja" ? "on" : ""}`}>{v}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "historikk" && (
              <div className="vp-ctl-tabpane">
                <div className="vp-ctl-sechrow">
                  <div className="vp-ctl-sech">Revisjonshistorikk</div>
                  {state === "changed" && <button className={`vp-ctl-comparebtn ${compare ? "on" : ""}`} onClick={() => setCompare(c => !c)}><Ic n="diff" s={13} /> Sammenlign med sist publisert</button>}
                </div>
                {compare && state === "changed" && (
                  <div className="vp-ctl-compare">
                    <div className="col"><div className="h">Sist publisert</div><div className="r"><span>Tid</span><b>17:00–23:00</b></div><div className="r"><span>Pause</span><b>30 min</b></div><div className="r"><span>Status</span><b>Publisert</b></div></div>
                    <span className="vp-ctl-comparearrow"><Ic n="arrowRight" s={16} /></span>
                    <div className="col now"><div className="h">Nå</div><div className="r ch"><span>Tid</span><b>{hhmm(st)}–{hhmm(en)}</b></div><div className="r ch"><span>Pause</span><b>{brk} min</b></div><div className="r ch"><span>Status</span><b>Avpublisert</b></div></div>
                  </div>
                )}
                <div className="vp-ctl-timeline">
                  {history.map((h, i) => (
                    <div key={i} className="vp-ctl-tl">
                      <span className="vp-ctl-tl-rail"><span className={`vp-ctl-tl-dot ${h.src}`}>{h.src === "ai" ? <Ic n="sparkle" s={9} /> : h.src === "template" ? <Ic n="copy" s={9} /> : h.unpub ? <Ic n="undo" s={9} /> : <Ic n="pen" s={9} />}</span>{i < history.length - 1 && <span className="vp-ctl-tl-line" />}</span>
                      <div className="vp-ctl-tl-body">
                        <div className="t">{h.t}{h.unpub && <span className="vp-ctl-tl-unpub">avpublisert</span>}</div>
                        <div className="m"><span className={`vp-ctl-srcpill ${h.src}`}>{h.src === "ai" ? "Botsson" : h.src === "template" ? "Mal" : h.src === "system" ? "System" : "Leder"}</span> {h.who} · {h.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "lonn" && (
              <div className="vp-ctl-tabpane">
                <div className="vp-ctl-locknote"><Ic n="lock" s={14} /> <span>Lønnsgrunnlag er <strong>skrivebeskyttet</strong>. Manuelle endringer krever begrunnelse og overskriver aldri stemplingsdata.</span></div>
                <div className="vp-ctl-sech">Timegrunnlag</div>
                <div className="vp-ctl-salary">
                  {[["Normaltimer", `${regularH.toFixed(1)}t`, ""], ["Overtid", `${overtimeH.toFixed(1)}t`, overtimeH ? "warn" : ""], ["Nattillegg", `${nightH.toFixed(1)}t`, ""], ["Helg/høytid", `${weekendH > 0 ? weekendH.toFixed(1) : 0}t`, day.we ? "ok" : ""], ["Pausetrekk", `${(brk).toFixed(0)} min`, ""], ["Tariff / sats", `${base} kr/t`, ""]].map(([k, v, t]) => (
                    <div key={k} className="vp-ctl-salrow"><span className="k">{k}</span><span className={`v ${t}`}>{v}</span></div>
                  ))}
                </div>
                <div className="vp-ctl-grosscard">
                  <div><span className="k">Estimert bruttokostnad <span className="vp-ctl-mgr">kun leder</span></span><span className="v">{gross.toLocaleString("nb-NO")} kr</span></div>
                  <span className="vp-ctl-mask"><Ic n="eye" s={13} /> Skjult for ansatt</span>
                </div>
                <div className="vp-ctl-sallink">
                  <Ic n="layers" s={14} c="var(--muted)" />
                  <span>Tolkning & oppgjør: <strong>{state === "settled" || state === "closed" ? "Avregnet og godkjent" : state === "active" ? "Tolkes etter stempling" : "Avventer vakt"}</strong></span>
                  <button onClick={() => setTab("livslop")}>Se livsløp <Ic n="arrowRight" s={12} /></button>
                </div>
                {!locked && (justify ? (
                  <div className="vp-ctl-justbox">
                    <div className="vp-ctl-justhead"><Ic n="pen" s={13} /> Foreslå manuell justering<button className="vp-ctl-justx" onClick={() => setJustify(null)}><Ic n="x" s={14} /></button></div>
                    <div className="vp-ctl-field" style={{ marginBottom: 10 }}>
                      <span className="vp-ctl-flbl">Hva justeres</span>
                      <div className="vp-fselect">
                        <select className="vp-finput" value={justify.type} onChange={e => setJustify(j => ({ ...j, type: e.target.value }))}>
                          {["Overtidstimer", "Nattillegg", "Helg-/høytidstillegg", "Pausetrekk", "Tariff / sats", "Annet"].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <span className="vp-fselect-chev"><Ic n="chevDown" s={15} /></span>
                      </div>
                    </div>
                    <div className="vp-ctl-field">
                      <span className="vp-ctl-flbl">Begrunnelse <span style={{ color: "var(--error)" }}>*</span></span>
                      <textarea className="vp-finput" style={{ minHeight: 64 }} value={justify.reason} onChange={e => setJustify(j => ({ ...j, reason: e.target.value }))} placeholder="Forklar hvorfor grunnlaget skal endres — logges i revisjonssporet." />
                    </div>
                    <div className="vp-ctl-justfoot">
                      <span className="vp-ctl-justnote"><Ic n="shield" s={12} /> Går til godkjenning · overskriver ikke stempling.</span>
                      <button className="sk-ghost" onClick={() => setJustify(null)}>Avbryt</button>
                      <button className="sk-primary" disabled={!justify.reason.trim()} onClick={() => { const t = justify.type; setJustify(null); toast(`Justeringsforslag sendt til godkjenning · ${t}`, { undo: () => {} }); }}><Ic n="check" s={14} sw={2.3} /> Send forslag</button>
                    </div>
                  </div>
                ) : (
                  <button className="vp-ctl-justify" onClick={() => setJustify({ type: "Overtidstimer", reason: "" })}><Ic n="pen" s={13} /> Foreslå manuell justering (krever begrunnelse)</button>
                ))}
              </div>
            )}

            {tab === "oppgaver" && (
              <div className="vp-ctl-tabpane">
                <div className="vp-ctl-sechrow"><div className="vp-ctl-sech">Vaktoppgaver <span className="vp-ctl-sechsub">{taskList.filter(t => t.done).length}/{taskList.length} fullført</span></div><button className={`vp-ctl-comparebtn ${dagslinje ? "on" : ""}`} onClick={() => setDagslinje(v => !v)}><Ic n="link" s={12} /> Koblet til dagslinjen</button></div>
                {dagslinje && (
                  <div className="vp-ctl-dagslinje">
                    <div className="vp-ctl-dl-head"><Ic n="layers" s={13} /> Slik ligger oppgavene på dagslinjen <span className="vp-ctl-dl-win">{hhmm(st)}–{hhmm(en)}</span></div>
                    <div className="vp-ctl-dl-track">
                      {taskList.map(t => {
                        const m = /(\d{1,2}):(\d{2})/.exec(t.due || "");
                        const mins = m ? (+m[1]) * 60 + (+m[2]) : st * 60;
                        const pct = Math.max(2, Math.min(98, ((mins - st * 60) / Math.max(1, (en - st) * 60)) * 100));
                        return <span key={t.id} className={`vp-ctl-dl-pin ${t.done ? "done" : t.prio === "Høy" ? "hi" : ""}`} style={{ left: pct + "%" }} title={`${t.title} · frist ${t.due}`} />;
                      })}
                    </div>
                    <div className="vp-ctl-dl-note">Oppgavene er forankret til klokkeslett, så de dukker opp til rett tid på den felles dagslinjen — fullføres ett sted, oppdateres begge.</div>
                  </div>
                )}
                <div className="vp-ctl-tasks">
                  {taskList.map(t => (
                    <div key={t.id} className={`vp-ctl-task clickable ${t.done ? "done" : ""}`} onClick={() => setTaskPanel({ mode: "view", id: t.id })} role="button" tabIndex={0}>
                      <button className={`vp-ctl-taskck ${t.done ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); !locked && toggleTask(t.id); }}>{t.done && <Ic n="check" s={12} sw={2.8} />}</button>
                      <div className="vp-ctl-taskbody">
                        <div className="t">{t.title}</div>
                        <div className="m"><span className={`vp-ctl-prio ${t.prio === "Høy" ? "hi" : ""}`}>{t.prio}</span> <Ic n="clock" s={11} /> frist {t.due}</div>
                      </div>
                      {emp && <span className="vp-emp-av" style={{ width: 24, height: 24, background: emp.c, fontSize: 9 }}>{emp.init}</span>}
                      <Ic n="chevRight" s={15} c="var(--muted-soft)" />
                    </div>
                  ))}
                </div>
                {!locked && <button className="vp-ctl-addtask" onClick={() => setTaskPanel({ mode: "new" })}><Ic n="plus" s={14} /> Legg til oppgave</button>}
              </div>
            )}

            {tab === "livslop" && (
              <div className="vp-ctl-tabpane">
                {(() => {
                  const curKey = state === "closed" || state === "settled" ? "settled" : state === "active" ? "active" : state === "published" ? "published" : empId ? "assigned" : "created";
                  const order = LC_PHASES.map(p => p.k);
                  const ci = order.indexOf(state === "settled" || state === "closed" ? "approved" : curKey);
                  const next = { new: "Tildel ansatt", created: "Tildel ansatt", draft: "Publiser vakten", assigned: "Publiser vakten", published: "Venter på vaktstart", active: "Vakt pågår — stemples ut ved slutt", changed: "Republiser vakten" }[state] || (state === "settled" ? "Godkjenn for lønn" : "Fullført");
                  return (
                    <>
                      <div className="vp-ctl-lc">
                        {LC_PHASES.map((p, i) => {
                          const cls = i < ci ? "done" : i === ci ? "current" : "";
                          return (
                            <div key={p.k} className={`vp-ctl-lcphase ${cls}`}>
                              <span className="node">{i < ci ? <Ic n="check" s={12} sw={2.6} /> : i + 1}</span>
                              <span className="l">{p.l}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="vp-ctl-lcnext"><span className="ic"><Ic n="arrowRight" s={15} /></span><div><span className="k">Neste steg</span><span className="v">{next}</span></div>{!locked && state !== "active" && <button onClick={() => act(state === "changed" ? "republish" : state === "settled" ? "approve" : state === "published" ? "" : "publish")}>{state === "changed" ? "Republiser" : state === "settled" ? "Godkjenn" : state === "published" ? "" : "Publiser"}</button>}</div>
                      <div className="vp-ctl-lclog">
                        {[["created", "Opprettet 27/5 17:00", true], ["assigned", `Tildelt ${emp ? emp.name : "—"}`, !!empId], ["published", "Publisert 27/5 17:05", ci >= 2], ["active", "Aktiv", ci >= 3], ["settled", "Avregnet", ci >= 6], ["approved", "Godkjent av Maria A.", ci >= 7]].map(([k, l, done], i) => (
                          <div key={i} className={`vp-ctl-lclog ${done ? "done" : ""}`}><Ic n={done ? "check" : "clock"} s={12} sw={done ? 2.4 : 1.8} /> {l}</div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {tab === "innst" && (
              <div className="vp-ctl-tabpane">
                <div className="vp-ctl-sets">
                  {[["notify", "Varsle ansatt ved publisering", "Push + i appen når vakten publiseres"], ["marketplace", "Tilgjengelig på vaktbørs", "Kan lyses ut hvis ansatt melder forfall"], ["swap", "Kan byttes", "Ansatt kan be om bytte med kvalifiserte"], ["template", "Inkluder i mal", "Tas med når uka kopieres til mal"], ["audit", "Synlig i revisjonslogg", "Endringer spores for innsyn"]].map(([k, t, s]) => (
                    <button key={k} className="vp-ctl-set" onClick={() => !locked && setSettings(v => ({ ...v, [k]: !v[k] }))} disabled={locked}>
                      <span className="b"><span className="t">{t}</span><span className="s">{s}</span></span>
                      <span className={`sk-switch ${settings[k] ? "on" : ""}`}><span /></span>
                    </button>
                  ))}
                </div>
                {locked && <div className="vp-ctl-lockoverride"><Ic n="lock" s={14} /> <div><strong>Låsforklaring:</strong> vakten er avregnet ({dayLbl(dayIdx)}) og inngår i et godkjent lønnsgrunnlag. Overstyring krever låsopphevelse fra Eier og loggføres.</div></div>}
                <div className="vp-ctl-field full" style={{ marginTop: 4 }}><span className="vp-ctl-flbl">Intern lederNotat <span className="vp-ctl-mgr">kun leder</span></span><textarea className="vp-finput" placeholder="Synlig kun for ledere — ikke for ansatt." disabled={locked} /></div>
              </div>
            )}
          </div>

          {/* footer */}
          <div className="vp-ctl-foot">
            <span className="vp-ctl-autosave">{dirty ? <><span className="dot live" /> Ikke lagret</> : savedAt ? <><Ic n="check" s={12} c="var(--success)" sw={2.4} /> Lagret {savedAt}</> : <><span className="dot" /> {locked ? "Skrivebeskyttet" : "Autolagres som utkast"}</>}</span>
            <span className="sp" />
            {footActions().map((a, i) => (
              <button key={a.k} className={a.primary ? "sk-primary" : "sk-ghost"} style={a.danger ? { color: "var(--error)" } : {}}
                onClick={() => {
                  if (a.k === "savedraft") return doSave();
                  if (a.k === "delete") return onDelete(shift);
                  return act(a.k);
                }}>
                <Ic n={a.ic} s={15} sw={a.k === "publish" || a.k === "republish" ? 1.8 : 1.7} /> {a.l}
              </button>
            ))}
          </div>

          {taskPanel && (
            <TaskDrawer
              key={taskPanel.mode + (taskPanel.id || "new")}
              mode={taskPanel.mode}
              task={panelTask}
              emp={emp}
              shiftWindow={[st, en]}
              locked={locked}
              onClose={() => setTaskPanel(null)}
              onToggle={() => panelTask && toggleTask(panelTask.id)}
              onCreate={(t) => { addTask(t); setTaskPanel(null); toast("Oppgave lagt til"); }}
              onUpdate={(patch) => { if (panelTask) { updateTask(panelTask.id, patch); setTaskPanel(null); toast("Oppgave oppdatert"); } }}
              onDelete={() => { if (panelTask) { deleteTask(panelTask.id); setTaskPanel(null); toast("Oppgave slettet", { undo: () => {} }); } }}
            />
          )}
          {funcPanel && (
            <CompetenceDrawer
              func={funcPanel}
              currentEmpId={empId}
              dep={dep}
              onClose={() => setFuncPanel(null)}
              onAssign={(id) => { setEmpId(id); mark(); }}
              toast={toast}
            />
          )}
        </div>
      </div>
    );
  }

  window.VPController = Controller;
})();
