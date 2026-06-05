// ===== Ansatte — Control Centers (popups behind every profile action) =====
// A tiny pub/sub (window.AnCtl) lets any panel open a control center without
// prop-threading. <window.AnCtlHost> is mounted once in the profile and renders
// the active modal. open(kind, payload).
(function () {
  const { useState, useEffect } = React;
  const A = window.An;
  const { Ic, SD, Av, Badge, AccessBadge, AuthorityBadge, dept, loc, team, pos, profession, legalFn, empName } = A;
  const EMP = SD.EMPLOYEES;

  // ---------- bus ----------
  const listeners = new Set();
  window.AnCtl = {
    open: (kind, payload) => listeners.forEach((l) => l({ kind, payload })),
    _sub: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };

  // ---------- shared modal shell ----------
  function Modal({ ic, tone = "info", title, sub, children, footer, onClose, wide, bare }) {
    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, []);
    return (
      <div className="an-scrim" onMouseDown={onClose}>
        <div className={`an-modal ${wide ? "lg" : ""}`} onMouseDown={(e) => e.stopPropagation()} role="dialog">
          {!bare && (
            <div className="an-modal-head">
              <span className={`an-modal-ic ${tone}`}><Ic n={ic} s={20} /></span>
              <div className="h"><div className="t">{title}</div>{sub && <div className="s">{sub}</div>}</div>
              <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose}><Ic n="x" s={18} /></button>
            </div>
          )}
          {bare ? children : <div className="an-modal-body">{children}</div>}
          {footer && <div className="an-modal-foot">{footer}</div>}
        </div>
      </div>
    );
  }
  const FG = ({ label, children }) => <div className="an-fg"><label>{label}</label>{children}</div>;
  const Sec = ({ children }) => <div className="an-fsec">{children}</div>;
  const Foot = ({ onClose, label, onSave, tone = "primary", extra }) => (
    <><button className="an-btn sm" onClick={onClose}>Avbryt</button>{extra}<span className="spacer" /><button className={`an-btn sm ${tone}`} onClick={onSave}>{label}</button></>
  );

  // ---------- 1. Profile control center ----------
  function ProfileCC({ e, toast, close }) {
    return (
      <Modal wide ic="user" tone="info" title="Profilkontrollsenter" sub={`Rediger ${e.display}`} onClose={close}
        footer={<Foot onClose={close} label="Lagre endringer" onSave={() => { toast("Profil oppdatert", { undo: () => {} }); close(); }} />}>
        <div className="an-form">
          <Sec>Identitet</Sec>
          <FG label="Fullt navn"><input defaultValue={e.name} /></FG>
          <div className="an-fg2">
            <FG label="Visningsnavn"><input defaultValue={e.display} /></FG>
            <FG label="Ansattnummer"><input defaultValue={e.employeeNo} /></FG>
          </div>
          <div className="an-fg2">
            <FG label="E-post"><input defaultValue={`${e.id}@bistronord.no`} /></FG>
            <FG label="Telefon"><input defaultValue="+47 901 23 456" /></FG>
          </div>
          <Sec>Arbeid</Sec>
          <div className="an-fg2">
            <FG label="Stilling"><input defaultValue={e.stilling} /></FG>
            <FG label="Avdeling"><select defaultValue={e.placement.primary}>{Object.values(SD.DEPARTMENTS).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></FG>
          </div>
          <div className="an-fg2">
            <FG label="Språk"><select defaultValue={e.language}><option>Norsk (bokmål)</option><option>English</option><option>Svenska</option></select></FG>
            <FG label="Livsløpsstatus"><select defaultValue={e.lifecycle}>{Object.values(SD.LIFECYCLE).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></FG>
          </div>
          <Sec>Andre kontrollsentre</Sec>
          <div className="an-quicklinks">
            <button onClick={() => window.AnCtl.open("access")}><span className="ic"><Ic n="lock" s={18} /></span>Tilgang & ansvar</button>
            <button onClick={() => window.AnCtl.open("placement")}><span className="ic"><Ic n="mappin" s={18} /></span>Plassering</button>
            <button onClick={() => window.AnCtl.open("competence")}><span className="ic"><Ic n="cap" s={18} /></span>Kompetanse</button>
          </div>
        </div>
      </Modal>
    );
  }

  // ---------- 2. Access editor (Tilgangsnivå · Ansvarsnivå · Ledelse · scopes) ----------
  function AccessEdit({ e, toast, close }) {
    const [acc, setAcc] = useState(e.access);
    const [auth, setAuth] = useState(e.authority);
    const scopes = (e.accessScopes || []).map((s) => s.scope);
    const extra = ["employees.read", "pii.reveal", "schedule.publish", "payroll.approve"].filter((s) => !scopes.includes(s));
    return (
      <Modal wide ic="lock" tone="purple" title="Tilgangsredigering" sub={e.display} onClose={close}
        footer={<Foot onClose={close} label="Lagre — logg endring" onSave={() => { toast("Tilgang oppdatert · logget i revisjonslogg", { undo: () => {} }); close(); }} />}>
        <div className="an-form">
          <Sec>Tilgangsnivå · plattform</Sec>
          {Object.values(SD.ACCESS_LEVELS).map((a) => (
            <button key={a.id} className={`an-radio ${acc === a.id ? "on" : ""}`} onClick={() => setAcc(a.id)}>
              <span className="dot" /><div className="rb"><div className="rt">{a.label}</div><div className="rs">{a.grants}</div></div>
            </button>
          ))}
          <Sec>Ansvarsnivå · operativt</Sec>
          <div className="an-seg2">{Object.values(SD.AUTHORITY_LEVELS).map((a) => <button key={a.id} className={auth === a.id ? "on" : ""} onClick={() => setAuth(a.id)}>{a.label}</button>)}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{SD.AUTHORITY_LEVELS[auth].desc}</div>
          <Sec>Ledelse · via avdeling / lag</Sec>
          {["Avdelingsleder · Sal", "Avdelingsleder · Bar", "Lagleder · Sal helg", "Lagleder · Kjøkken kveld"].map((l) => (
            <div key={l} className="an-togrow"><div className="l"><div className="t">{l}</div></div><Toggle on={e.leadership.includes(l)} onToast={toast} /></div>
          ))}
          <Sec>Finmasket tilgang · scopes</Sec>
          {scopes.map((s) => <div key={s} className="an-togrow"><div className="l"><div className="t"><span className="mono">{s}</span></div></div><Toggle on onToast={toast} /></div>)}
          {extra.map((s) => <div key={s} className="an-togrow"><div className="l"><div className="t"><span className="mono">{s}</span></div><div className="s">Ikke tildelt</div></div><Toggle on={false} onToast={toast} /></div>)}
        </div>
      </Modal>
    );
  }
  function Toggle({ on, onToast }) {
    const [v, setV] = useState(on);
    return <button className={`sk-switch ${v ? "on" : ""}`} onClick={() => { setV((x) => !x); onToast && onToast(v ? "Fjernet" : "Lagt til"); }}><span /></button>;
  }

  // ---------- 3. Placement editor ----------
  function PlacementEdit({ e, toast, close }) {
    const [primary, setPrimary] = useState(e.placement.primary);
    const [depts, setDepts] = useState(new Set(e.placement.depts));
    const [locs, setLocs] = useState(new Set(e.placement.locations));
    const tog = (set, setSet, id) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setSet(n); };
    return (
      <Modal wide ic="mappin" tone="info" title="Rediger plassering" sub={e.display} onClose={close}
        footer={<Foot onClose={close} label="Lagre plassering" onSave={() => { toast("Plassering oppdatert", { undo: () => {} }); close(); }} />}>
        <div className="an-form">
          <FG label="Primær avdeling"><select value={primary} onChange={(ev) => setPrimary(ev.target.value)}>{Object.values(SD.DEPARTMENTS).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></FG>
          <Sec>Avdelinger</Sec>
          <div className="an-place-chips">
            {Object.values(SD.DEPARTMENTS).map((d) => <span key={d.id} className={`an-pchip tog ${depts.has(d.id) ? "on" : ""}`} onClick={() => tog(depts, setDepts, d.id)}>{depts.has(d.id) && <span className="ck"><Ic n="check" s={12} sw={2.6} /></span>}<span className="d" style={{ background: d.color }} />{d.name}</span>)}
          </div>
          <Sec>Områder</Sec>
          <div className="an-place-chips">
            {Object.values(SD.LOCATIONS).map((l) => <span key={l.id} className={`an-pchip tog ${locs.has(l.id) ? "on" : ""}`} onClick={() => tog(locs, setLocs, l.id)}>{locs.has(l.id) && <span className="ck"><Ic n="check" s={12} sw={2.6} /></span>}<Ic n="mappin" s={12} c="var(--muted)" />{l.name}</span>)}
          </div>
          <div className="an-fg2">
            <FG label="Lag"><select defaultValue={e.placement.team || ""}><option value="">Ingen</option>{Object.values(SD.TEAMS).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></FG>
            <FG label="Avdelingsleder"><select defaultValue={e.placement.deptLeader || ""}><option value="">—</option>{EMP.map((x) => <option key={x.id} value={x.id}>{x.display}</option>)}</select></FG>
          </div>
        </div>
      </Modal>
    );
  }

  // ---------- 4. Add competence ----------
  function AddCompetence({ e, toast, close }) {
    const [type, setType] = useState("stilling");
    return (
      <Modal wide ic="cap" tone="info" title="Legg til kompetanse" sub={e.display} onClose={close}
        footer={<Foot onClose={close} label="Legg til" onSave={() => { toast("Kompetanse lagt til", { undo: () => {} }); close(); }} />}>
        <div className="an-form">
          <div className="an-seg2">
            {[["stilling", "Stilling"], ["profesjon", "Profesjon"], ["juridisk", "Juridisk"], ["sertifikat", "Sertifikat"]].map(([id, l]) => <button key={id} className={type === id ? "on" : ""} onClick={() => setType(id)}>{l}</button>)}
          </div>
          {type === "stilling" && <><FG label="Stilling"><select>{Object.values(SD.POSITIONS).map((p) => <option key={p.id} value={p.id}>{p.name} · {dept(p.dept).name}</option>)}</select></FG><div className="an-togrow"><div className="l"><div className="t">Sett som primær stilling</div></div><Toggle on={false} onToast={toast} /></div></>}
          {type === "profesjon" && <FG label="Profesjon"><select>{Object.values(SD.PROFESSIONS).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FG>}
          {type === "juridisk" && <><FG label="Juridisk funksjon"><select>{Object.values(SD.LEGAL_FUNCTIONS).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></FG><FG label="Tildelt av"><select>{EMP.map((x) => <option key={x.id}>{x.display}</option>)}</select></FG></>}
          {type === "sertifikat" && <><FG label="Sertifikatnavn"><input placeholder="f.eks. Truckførerbevis" /></FG><div className="an-fg2"><FG label="Utstedt"><input placeholder="2026" /></FG><FG label="Utløper"><input placeholder="2029" /></FG></div></>}
        </div>
      </Modal>
    );
  }

  // ---------- 5. New absence ----------
  function NewAbsence({ e, toast, close }) {
    return (
      <Modal ic="umbrella" tone="info" title="Registrer fravær" sub={e.display} onClose={close}
        footer={<Foot onClose={close} label="Registrer" onSave={() => { toast("Fravær registrert · venter godkjenning", { undo: () => {} }); close(); }} />}>
        <div className="an-form">
          <div className="an-fg">
            <label>Type</label>
            <select>{Object.entries(SD.ABSENCE_TYPES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}</select>
            <div className="an-gov-hint"><span className="ic"><Ic n="book" s={12} /></span>Fraværstyper er definert i <button onClick={() => toast("Åpner Personalhåndbok · Fravær & goder i Bibliotek")}>Personalhåndboken</button></div>
          </div>
          <div className="an-fg2"><FG label="Fra"><input placeholder="dd.mm.åååå" defaultValue="03.06.2026" /></FG><FG label="Til"><input placeholder="dd.mm.åååå" /></FG></div>
          <FG label="Kommentar"><input placeholder="Valgfri begrunnelse" /></FG>
        </div>
      </Modal>
    );
  }

  // ---------- 6. Assignment control center (hub + filterable pickers) ----------
  function AssignCenter({ e, toast, close }) {
    const [mode, setMode] = useState("hub");
    const [sel, setSel] = useState({});
    const [q, setQ] = useState("");
    const [f, setF] = useState("alle");

    const reset = () => { setSel({}); setQ(""); setF("alle"); };
    const goHub = () => { setMode("hub"); reset(); };
    const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }));
    const selIds = Object.keys(sel).filter((k) => sel[k]);

    // --- relevance for training (from profession requirements + assignments) ---
    const reqSet = new Set();
    (e.professions || []).forEach((pid) => (profession(pid).training || []).forEach((t) => { if (t.required) reqSet.add(t.protocol); }));
    const assigned = new Set((e.protocols || []).map((p) => p.protocol));
    const completed = new Set((e.protocols || []).filter((p) => p.status === "completed").map((p) => p.protocol));
    const protoTag = (id) => completed.has(id) ? { label: "Fullført", tone: "success" } : assigned.has(id) ? { label: "Tildelt", tone: "info" } : reqSet.has(id) ? { label: "Påkrevd", tone: "warning" } : { label: "Anbefalt", tone: "muted" };

    // ---- hub ----
    if (mode === "hub") {
      const card = (md, ic, t, s) => <button className="an-assign-card" onClick={() => { reset(); setMode(md); }}><span className="ic"><Ic n={ic} s={18} /></span><span className="at">{t}</span><span className="as">{s}</span></button>;
      const act = (ic, t, s, msg) => <button className="an-assign-card" onClick={() => { toast(msg, { undo: () => {} }); close(); }}><span className="ic"><Ic n={ic} s={18} /></span><span className="at">{t}</span><span className="as">{s}</span></button>;
      return (
        <Modal wide ic="layers" tone="ok" title="Tildel" sub={`Tildel arbeid og opplæring til ${e.display}`} onClose={close}>
          <div className="an-assign-grid">
            {card("opplaering", "cap", "Tildel opplæring", "Velg fra relevante protokoller, kurs og quiz — med filter.")}
            {card("oppgave", "list", "Tildel oppgave", "Engangsoppgave eller oppfølging — kan legges i dagsliste.")}
            {card("dagsliste", "clipcheck", "Legg i dagsliste", "Legg en rutineoppgave på dagens liste.")}
            {card("dokument", "checkdoc", "Send dokument", "Send mal/skjema til signering eller lesing.")}
            {act("grid", "Sett opp vakt", "Plasser på vaktplanen i en avdeling.", "Åpner vaktplan for " + e.display)}
            {act("shield", "Tildel juridisk verv", "Verneombud, brannvernleder m.m.", "Juridisk verv tildelt " + e.display)}
          </div>
        </Modal>
      );
    }

    // ---- shared list shell ----
    const ListShell = ({ title, filters, items, confirmLabel, onConfirm, searchPh }) => (
      <Modal wide ic="layers" tone="ok" title={title} sub={e.display} onClose={close}
        footer={<><button className="an-btn sm" onClick={goHub}>Tilbake</button><span className="an-pick-foot-n" style={{ marginLeft: 8 }}><strong>{selIds.length}</strong> valgt</span><span className="spacer" /><button className="an-btn sm primary" disabled={!selIds.length} onClick={onConfirm}>{confirmLabel}</button></>}>
        <button className="an-pick-back" onClick={goHub}><Ic n="chevLeft" s={15} /> Alle tildelinger</button>
        <div className="an-pick-tools">
          <div className="an-srch" style={{ maxWidth: "none" }}><Ic n="search" s={15} c="var(--muted)" /><input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={searchPh} /></div>
        </div>
        {filters && <div className="filter-row" style={{ marginBottom: 10 }}>{filters.map((x) => <button key={x.id} className={`chip ${f === x.id ? "active" : ""}`} onClick={() => setF(x.id)}>{x.label}{x.c != null && <span className="chip-count">{x.c}</span>}</button>)}</div>}
        <div className="an-pick">
          {items.length === 0 ? <div className="an-pick-empty">Ingen treff.</div> : items.map((it) => (
            <div key={it.id} className={`an-pick-row ${sel[it.id] ? "on" : ""}`} onClick={() => toggle(it.id)}>
              <span className={`an-pick-check ${sel[it.id] ? "on" : ""}`}>{sel[it.id] && <Ic n="check" s={12} sw={2.6} />}</span>
              <div className="an-pick-b"><div className="an-pick-t">{it.title}{it.tag && <Badge tone={it.tag.tone}>{it.tag.label}</Badge>}</div>{it.sub && <div className="an-pick-s">{it.sub}</div>}</div>
              {it.right}
            </div>
          ))}
        </div>
      </Modal>
    );

    // ---- opplæring ----
    if (mode === "opplaering") {
      const all = Object.values(SD.PROTOCOLS);
      const items = all.filter((p) => {
        if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (f === "relevante" && !reqSet.has(p.id)) return false;
        if (f === "mangler" && assigned.has(p.id)) return false;
        if (f === "fullfort" && !completed.has(p.id)) return false;
        return true;
      }).map((p) => ({ id: p.id, title: p.name, tag: protoTag(p.id), sub: `v${p.version} · ${p.procedures} prosedyrer · ${p.tests} tester · ${p.confirmations} signaturer` }));
      const filters = [
        { id: "alle", label: "Alle", c: all.length },
        { id: "relevante", label: "Påkrevd for stilling", c: reqSet.size },
        { id: "mangler", label: "Mangler", c: all.filter((p) => !assigned.has(p.id)).length },
        { id: "fullfort", label: "Fullført", c: completed.size },
      ];
      return <ListShell title="Tildel opplæring" searchPh="Søk protokoll, kurs, quiz…" filters={filters} items={items} confirmLabel={`Tildel ${selIds.length || ""} opplæring`.trim()} onConfirm={() => { toast(`${selIds.length} opplæring tildelt ${e.display}`, { undo: () => {} }); close(); }} />;
    }

    // ---- send dokument ----
    if (mode === "dokument") {
      const all = SD.DOC_TEMPLATES || [];
      const items = all.filter((t) => {
        if (q && !t.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (f !== "alle" && t.type !== f) return false;
        return true;
      }).map((t) => ({ id: t.id, title: t.name, tag: { label: t.type === "kontrakt" ? "Kontrakt" : t.type === "skjema" ? "Skjema" : "Vedlegg", tone: t.type === "kontrakt" ? "orange" : t.type === "skjema" ? "info" : "purple" }, sub: `v${t.version} · ${t.category}` }));
      const filters = [
        { id: "alle", label: "Alle", c: all.length },
        { id: "kontrakt", label: "Kontrakter" },
        { id: "skjema", label: "Skjema" },
        { id: "vedlegg", label: "Vedlegg" },
      ];
      return <ListShell title="Send dokument" searchPh="Søk mal/dokument…" filters={filters} items={items} confirmLabel={`Send ${selIds.length || ""}`.trim()} onConfirm={() => { toast(`${selIds.length} dokument sendt til ${e.display}`, { undo: () => {} }); close(); }} />;
    }

    // ---- oppgave (med legg-til-dagsliste) / dagsliste ----
    if (mode === "oppgave" || mode === "dagsliste") {
      const isDag = mode === "dagsliste";
      const SUGGEST = [
        { id: "o1", title: "Temperaturkontroll – kjøl & frys", sub: "IK-mat · daglig" },
        { id: "o2", title: "Åpningsrutine – sal", sub: "Drift · ved åpning" },
        { id: "o3", title: "Mottakskontroll vare", sub: "IK-mat · ved levering" },
        { id: "o4", title: "Bordoppdekking", sub: "Sal · før service" },
        { id: "o5", title: "Stengerutine", sub: "Drift · ved stenging" },
      ];
      const items = SUGGEST.filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase()));
      return (
        <Modal wide ic={isDag ? "clipcheck" : "list"} tone="ok" title={isDag ? "Legg i dagsliste" : "Tildel oppgave"} sub={e.display} onClose={close}
          footer={<><button className="an-btn sm" onClick={goHub}>Tilbake</button><span className="an-pick-foot-n" style={{ marginLeft: 8 }}><strong>{selIds.length}</strong> valgt</span><span className="spacer" /><button className="an-btn sm primary" disabled={!selIds.length} onClick={() => { toast(isDag ? `${selIds.length} lagt i dagsliste for ${e.display}` : `${selIds.length} oppgave tildelt ${e.display}`, { undo: () => {} }); close(); }}>{isDag ? "Legg til" : "Tildel"}</button></>}>
          <button className="an-pick-back" onClick={goHub}><Ic n="chevLeft" s={15} /> Alle tildelinger</button>
          <div className="an-pick-tools"><div className="an-srch" style={{ maxWidth: "none" }}><Ic n="search" s={15} c="var(--muted)" /><input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Søk rutine/oppgave…" /></div></div>
          <div className="an-pick">
            {items.map((it) => (
              <div key={it.id} className={`an-pick-row ${sel[it.id] ? "on" : ""}`} onClick={() => toggle(it.id)}>
                <span className={`an-pick-check ${sel[it.id] ? "on" : ""}`}>{sel[it.id] && <Ic n="check" s={12} sw={2.6} />}</span>
                <div className="an-pick-b"><div className="an-pick-t">{it.title}</div><div className="an-pick-s">{it.sub}</div></div>
              </div>
            ))}
          </div>
          {!isDag && <div className="an-togrow" style={{ marginTop: 10 }}><div className="l"><div className="t">Legg også i dagslisten</div><div className="s">Vises på vakten i dag</div></div><Toggle on={false} onToast={toast} /></div>}
        </Modal>
      );
    }

    return null;
  }

  // ---------- 7. Recert planning ----------
  function RecertPlan({ payload, e, toast, close }) {
    const [when, setWhen] = useState("2 uker");
    return (
      <Modal wide ic="history" tone="warn" title="Planlegg re-sertifisering" sub={payload && payload.name} onClose={close}
        footer={<Foot onClose={close} tone="primary" label="Planlegg re-sertifisering" onSave={() => { toast(`Re-sertifisering planlagt (${when})`, { undo: () => {} }); close(); }}
          extra={<button className="an-btn sm" onClick={() => { toast("Frist forlenget 30 dager", { undo: () => {} }); close(); }}><Ic n="clock" s={13} /> Forleng frist</button>} />}>
        <div className="an-form">
          <div className="an-modal-note" style={{ margin: 0 }}><span className="ic"><Ic n="alert" s={15} /></span><span>{payload && payload.name} forfalt <strong>{payload && payload.due}</strong>. Blokkerer ikke vakt i dag, men må fornyes.</span></div>
          <Sec>Når</Sec>
          <div className="an-preset-row">{["Innen 1 uke", "2 uker", "1 mnd", "Egendefinert"].map((p) => <button key={p} className={`an-preset ${when === p ? "on" : ""}`} onClick={() => setWhen(p)}>{p}</button>)}</div>
          {when === "Egendefinert" && <FG label="Velg dato"><input placeholder="dd.mm.åååå" /></FG>}
          <Sec>Hvem utfører</Sec>
          <FG label="Ansvarlig"><select defaultValue={e.id}>{EMP.map((x) => <option key={x.id} value={x.id}>{x.display}</option>)}</select></FG>
          <Sec>Påminnelse</Sec>
          <div className="an-togrow"><div className="l"><div className="t">Send påminnelse til ansatt</div><div className="s">3 dager før frist</div></div><Toggle on onToast={toast} /></div>
          <div className="an-togrow"><div className="l"><div className="t">Varsle nærmeste leder</div></div><Toggle on={false} onToast={toast} /></div>
        </div>
      </Modal>
    );
  }

  // ---------- 8. Video call ----------
  function VideoCall({ e, toast, close }) {
    const [st, setSt] = useState("Ringer …");
    useEffect(() => {
      const t = setTimeout(() => setSt("Tilkoblet · 00:01"), 1600); return () => clearTimeout(t);
    }, []);
    return (
      <Modal bare onClose={close}>
        <div className="an-call">
          <span className="an-call-av" style={{ background: e.color }}>{e.initials}</span>
          <div className="an-call-nm">{e.display}</div>
          <div className="an-call-st">{st}</div>
          <div className="an-call-btns">
            <button className="an-call-btn" title="Demp"><Ic n="phone" s={20} /></button>
            <button className="an-call-btn end" title="Avslutt" onClick={() => { toast("Samtale avsluttet"); close(); }}><Ic n="x" s={22} /></button>
            <button className="an-call-btn" title="Video"><Ic n="video" s={20} /></button>
          </div>
          <div className="an-call-lbls"><span>Demp</span><span>Avslutt</span><span>Video</span></div>
        </div>
      </Modal>
    );
  }

  // ---------- 9. Direct chat thread (Melding) ----------
  function MessageThread({ e, toast, close }) {
    const [msgs, setMsgs] = useState([
      { from: "them", text: "Hei! Si fra om du har spørsmål om vakten i morgen.", t: "09:12" },
      { from: "me", text: "Takk — ser bra ut. Jeg gir beskjed.", t: "09:14" },
    ]);
    const [v, setV] = useState("");
    const logRef = React.useRef(null);
    useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [msgs]);
    const send = () => { const t = v.trim(); if (!t) return; setMsgs((m) => [...m, { from: "me", text: t, t: "nå" }]); setV(""); };
    return (
      <Modal bare onClose={close}>
        <div className="an-chat">
          <div className="an-chat-top">
            <Av e={e} size={36} />
            <div className="an-chat-id"><div className="nm">{e.display}</div><div className="st"><span className="on">● På vakt</span> · {e.stilling}</div></div>
            <button className="icon-btn" title="Ring" onClick={() => window.AnCtl.open("call")}><Ic n="phone" s={17} /></button>
            <button className="icon-btn" title="Lukk" onClick={close}><Ic n="x" s={18} /></button>
          </div>
          <div className="an-chat-log" ref={logRef}>
            {msgs.map((m, i) => <div key={i} className={`an-chat-b ${m.from}`}>{m.text}<span className="t">{m.t}</span></div>)}
          </div>
          <div className="an-chat-input">
            <input value={v} onChange={(ev) => setV(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") send(); }} placeholder={`Skriv til ${e.display} …`} autoFocus />
            <button className="an-chat-send" disabled={!v.trim()} onClick={send}><Ic n="send" s={16} /></button>
          </div>
        </div>
      </Modal>
    );
  }

  // ---------- host ----------
  function ControlHost({ e, toast }) {
    const [active, setActive] = useState(null);
    useEffect(() => window.AnCtl._sub(setActive), []);
    if (!active) return null;
    const close = () => setActive(null);
    const props = { e, toast, close, payload: active.payload };
    const map = { profile: ProfileCC, access: AccessEdit, placement: PlacementEdit, competence: AddCompetence, absence: NewAbsence, assign: AssignCenter, recert: RecertPlan, call: VideoCall, message: MessageThread };
    const C = map[active.kind];
    return C ? <C {...props} /> : null;
  }

  window.AnCtlHost = ControlHost;
})();
