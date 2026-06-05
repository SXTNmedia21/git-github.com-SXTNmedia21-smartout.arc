// ===== HMS — shared primitives, helpers, AI panel, comment drawer (window.Hms) =====
// Loaded first among the hms-*.jsx files. Exposes window.Hms consumed by the
// dashboard / protocol / tracking pages and the hms host.
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.Ic;
  const SD = window.SmartoutData;

  // ---------- lookups ----------
  const cat = (id) => SD.HMS_CATEGORIES[id] || SD.HMS_CATEGORIES.helse;
  const emp = (id) => (SD.EMP_BY_ID && SD.EMP_BY_ID[id]) || { id, display: id, initials: "?", color: "#888", stilling: "" };
  const empName = (id) => (id === "bot" ? "Mr. Botsson" : emp(id).display);
  const loc = (id) => (SD.LOCATIONS && SD.LOCATIONS[id]) || { name: id };
  const pos = (id) => (SD.POSITIONS && SD.POSITIONS[id]) || { name: id };
  const imp = (id) => SD.HMS_IMPORTANCE[id] || SD.HMS_IMPORTANCE.normal;
  const procedure = (id) => (SD.HMS_PROCEDURES || {})[id];
  const training = (id) => (SD.HMS_TRAININGS || {})[id];
  const quiz = (id) => (SD.HMS_QUIZZES || {})[id];
  const manual = (id) => (SD.HMS_MANUALS || {})[id];
  const legal = (id) => (SD.HMS_LEGAL || {})[id];
  const process = (id) => (SD.HMS_PROCESSES || {})[id];
  const proto = (id) => SD.HMS_PROTO_BY_ID[id];

  // ---------- entity type system (explicit, never ambiguous) ----------
  const TYPE_META = {
    bibliotek:  { label: "Bibliotek", ic: "book", tone: "orange" },
    handbok:    { label: "Håndbok", ic: "book", tone: "orange" },
    kapittel:   { label: "Kapittel", ic: "folder", tone: "muted" },
    protokoll:  { label: "Protokoll", ic: "shield", tone: "cat" },
    prosedyre:  { label: "Prosedyre", ic: "clipcheck", tone: "info" },
    rutine:     { label: "Rutine", ic: "repeat", tone: "cat" },
    oppgave:    { label: "Oppgave", ic: "check", tone: "muted" },
    opplaring:  { label: "Opplæring", ic: "cap", tone: "info" },
    quiz:       { label: "Quiz", ic: "help", tone: "purple" },
    manual:     { label: "Manual", ic: "file", tone: "muted" },
    bevis:      { label: "Bevis", ic: "camera", tone: "success" },
    lovverk:    { label: "Lovverk", ic: "scale", tone: "muted" },
    prosess:    { label: "Prosess", ic: "route", tone: "muted" },
  };
  function TypeBadge({ type, cat: catId }) {
    const m = TYPE_META[type] || TYPE_META.protokoll;
    const isCat = m.tone === "cat";
    return (
      <span className={`hms-typebadge t-${m.tone} ${isCat && catId ? "hms-cat-" + catId : ""}`}>
        <Ic n={m.ic} s={11} /> {m.label}
      </span>
    );
  }

  // ---------- breadcrumb (parent relation always visible) ----------
  function Breadcrumb({ items }) {
    return (
      <nav className="hms-crumbs" aria-label="Sti">
        {items.map((it, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep"><Ic n="chevRight" s={12} /></span>}
            {it.onClick ? (
              <button className="crumb" onClick={it.onClick}>{it.ic && <Ic n={it.ic} s={12} />}{it.label}</button>
            ) : (
              <span className="crumb current">{it.ic && <Ic n={it.ic} s={12} />}{it.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>
    );
  }

  // status → tone for compliance scores
  const scoreTone = (n) => (n >= 85 ? "ok" : n >= 70 ? "warn" : "crit");
  const scoreColor = (n) => (n >= 85 ? "var(--success)" : n >= 70 ? "var(--warning)" : "var(--error)");

  // ---------- avatar ----------
  function Av({ id, size = 34, style }) {
    const e = emp(id);
    return <span className="so-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: e.color, ...style }}>{e.initials}</span>;
  }

  // ---------- compliance ring ----------
  function Ring({ pct, size = "", color }) {
    return (
      <span className={`hms-ring ${size}`} style={{ "--p": pct, "--rc": color || scoreColor(pct) }}>
        <span className="pct">{pct}</span>
      </span>
    );
  }

  // ---------- tiny sparkline (trend) ----------
  function Trend({ data, color }) {
    const max = Math.max(...data), min = Math.min(...data);
    const span = Math.max(1, max - min);
    return (
      <span className="hms-trend">
        {data.map((v, i) => <i key={i} style={{ height: `${6 + ((v - min) / span) * 16}px`, background: color }} />)}
      </span>
    );
  }

  // ---------- importance + status badges ----------
  const ImpBadge = ({ id }) => { const m = imp(id); return <span className="hms-imp" data-tone={m.tone}><span className="d" />{m.label}</span>; };
  const StatusBadge = ({ status, label }) => <span className={`hms-status ${status}`}><span className="d" />{label || (status === "ok" ? "På stell" : status === "warn" ? "Følg opp" : "Avvik")}</span>;
  const CatChip = ({ id }) => { const c = cat(id); return <span className={`hms-catchip hms-cat-${id}`}><span className="d" />{c.name}</span>; };

  // ---------- handbook link card (every protocol → chapter) ----------
  function HandbookLink({ hb, onOpen }) {
    const [open, setOpen] = React.useState(false);
    const toast = window.useToast ? window.useToast() : (() => {});
    const chapter = hb.chapterTitle || (hb.path || "").split("›").pop().trim() || "Håndbokkapittel";
    return (
      <>
        <button className="hms-hb" onClick={() => { if (window.OppChapterViewer) setOpen(true); else if (onOpen) onOpen(hb); }}>
          <span className="ic"><Ic n="book" s={18} /></span>
          <span className="b">
            <span className="t">{hb.chapterTitle || "Håndbokkapittel"}</span>
            <span className="s">{hb.path}</span>
          </span>
          <span className="go"><Ic n="arrowRight" s={16} /></span>
        </button>
        {open && window.OppChapterViewer && <window.OppChapterViewer book={hb.book} chapter={chapter} onClose={() => setOpen(false)} toast={toast} />}
      </>
    );
  }

  // ---------- mention renderer ----------
  function withMentions(text) {
    const parts = text.split(/(@\w+)/g);
    return parts.map((p, i) => {
      if (p.startsWith("@")) {
        const id = p.slice(1);
        return <span key={i} className="men">@{empName(id)}</span>;
      }
      return <span key={i}>{p}</span>;
    });
  }

  // ---------- popover (click-outside) ----------
  function Pop({ children, onClose, style, className = "" }) {
    const ref = useRef(null);
    useEffect(() => {
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
      setTimeout(() => document.addEventListener("mousedown", h), 0);
      return () => document.removeEventListener("mousedown", h);
    }, []);
    return <div ref={ref} className={`sk-pop ${className}`} style={style}>{children}</div>;
  }

  // ---------- panel scaffold ----------
  function Panel({ icon, title, link, onLink, children, flush, id }) {
    return (
      <section className="hms-panel" id={id}>
        <div className="hms-phead">
          {icon && <span className="ico"><Ic n={icon} s={16} /></span>}
          <span className="ttl">{title}</span>
          <span className="spc" />
          {link && <button className="lnk" onClick={onLink}>{link} <Ic n="arrowRight" s={13} /></button>}
        </div>
        <div className={`hms-pbody ${flush ? "flush" : ""}`}>{children}</div>
      </section>
    );
  }

  // ============================================================
  // AI HMS ASSISTANT — confirmation-gated co-pilot w/ source refs
  // ============================================================
  function AIPanel({ items, toast, onOpenProto, compact }) {
    const [done, setDone] = useState({});
    const [dismissed, setDismissed] = useState({});
    const act = (a) => {
      if (done[a.id]) return;
      setDone((d) => ({ ...d, [a.id]: true }));
      toast(a.toast || "Forslag utført", { undo: () => setDone((d) => ({ ...d, [a.id]: false })) });
    };
    const list = items.filter((a) => !dismissed[a.id]);
    return (
      <section className="hms-ai">
        <div className="hms-ai-head">
          <span className="hms-ai-av"><Ic n="bot" s={18} /></span>
          <div className="hms-ai-id">
            <div className="n">Mr. Botsson <span className="tag">HMS CO-PILOT</span></div>
            <div className="m">{list.length} forslag · kildehenvist</div>
          </div>
          <span className="spc" />
        </div>
        <div className="hms-ai-list">
          {list.length === 0 && <div className="hms-pbody" style={{ fontSize: 13, color: "var(--muted)" }}>Ingen åpne forslag. Botsson følger med på protokoller, frister og opplæring.</div>}
          {list.map((a) => (
            <div key={a.id} className="hms-ai-card">
              <div className="toprow">
                <CatChip id={a.cat} />
                <span className="t">{a.title}</span>
              </div>
              <p className="body">{a.body}</p>
              <div className="hms-ai-srcs">
                {a.sources.map((s, i) => (
                  <button key={i} className="hms-ai-src" onClick={() => s.ref && onOpenProto && onOpenProto(s.ref)}>
                    <span className="ic"><Ic n="link" s={11} /></span>{s.label}
                  </button>
                ))}
              </div>
              <div className="hms-ai-acts">
                {done[a.id] ? (
                  <span className="hms-ai-act done"><Ic n="check" s={14} sw={2.4} /> Klargjort — venter din bekreftelse</span>
                ) : (
                  <>
                    <button className="hms-ai-act primary" onClick={() => act(a)}><Ic n="sparkle" s={13} /> {a.action}</button>
                    <button className="hms-ai-act ghost" onClick={() => setDismissed((d) => ({ ...d, [a.id]: true }))}><Ic n="x" s={13} /> Avvis</button>
                  </>
                )}
              </div>
              {!done[a.id] && <div className="hms-ai-confirm"><span className="ic"><Ic n="lock" s={12} /></span>{a.confirm}</div>}
            </div>
          ))}
        </div>
      </section>
    );
  }

  // compact one-line assist strip (botsson-card style) for page tops
  function AssistStrip({ text, cta, onCta, toast }) {
    const [d, setD] = useState(false);
    return (
      <div className="botsson-card" style={{ marginBottom: 18 }}>
        <div className="bot-icon"><span>B</span></div>
        <div className="bot-text">
          <span className="bot-label">Botsson · HMS</span>
          <p>{text}</p>
        </div>
        <button className="bot-cta" onClick={() => { if (d) return; onCta && onCta(); setD(true); }}>{d ? "Klargjort" : cta} <Ic n="arrowRight" s={13} /></button>
      </div>
    );
  }

  // ============================================================
  // COMMENT / FOLLOW-UP DRAWER — mentions · priority · owner · due · resolve
  // ============================================================
  const PRIO = [["normal", "Normal"], ["hoy", "Høy"], ["kritisk", "Kritisk"]];
  function CommentDrawer({ open, onClose, title, anchorLabel, comments, toast }) {
    const [list, setList] = useState(comments || []);
    const [draft, setDraft] = useState("");
    const [prio, setPrio] = useState("normal");
    const [internal, setInternal] = useState(false);
    const [ownerOn, setOwnerOn] = useState(false);

    useEffect(() => { setList(comments || []); }, [comments, open]);
    useEffect(() => {
      if (!open) return;
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [open]);

    const toggleResolve = (id) => {
      setList((l) => l.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c)));
      toast && toast("Oppfølging oppdatert", { undo: () => setList((l) => l.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c))) });
    };
    const send = () => {
      const t = draft.trim(); if (!t) return;
      const mentions = (t.match(/@(\w+)/g) || []).map((m) => m.slice(1));
      const c = { id: "c" + Date.now(), author: "ma", priority: prio, internal, text: t, mentions, owner: ownerOn ? "ma" : null, due: null, resolved: false, at: "Nå", attachments: 0 };
      setList((l) => [...l, c]);
      setDraft(""); setPrio("normal"); setInternal(false); setOwnerOn(false);
      toast && toast("Kommentar lagt til");
    };

    if (!open) return null;
    const openCount = list.filter((c) => !c.resolved).length;
    return (
      <>
        <div className="drawer-backdrop" onClick={onClose} />
        <aside className="drawer" role="dialog" aria-label="Kommentarer og oppfølging" style={{ width: "min(560px, 100vw)" }}>
          <div className="drawer-header">
            <div className="drawer-header-row1">
              <span className="so-eyebrow-lbl">Kommentarer &amp; oppfølging</span>
              <span className="right"><button className="icon-btn icon-btn-sm" onClick={onClose}><Ic n="x" s={18} /></button></span>
            </div>
            <div className="drawer-title" style={{ fontSize: 26 }}>{title}</div>
            <div className="header-chips">
              {anchorLabel && <span className="h-chip"><Ic n="link" s={13} /> {anchorLabel}</span>}
              <span className="h-chip"><strong>{openCount}</strong> åpne</span>
              <span className="h-chip">{list.length} totalt</span>
            </div>
          </div>
          <div className="drawer-body" style={{ padding: 0 }}>
            <div className="hms-cmt-list">
              {list.length === 0 && <div className="so-empty"><span className="ic"><Ic n="message" s={22} /></span><div className="t">Ingen kommentarer</div><div className="s">Start en tråd — nevn noen med @ og sett en oppfølgingsansvarlig.</div></div>}
              {list.map((c) => (
                <div key={c.id} className={`hms-cmt ${c.resolved ? "resolved" : ""}`}>
                  <Av id={c.author} size={34} />
                  <div className="hms-cmt-b">
                    <div className="hms-cmt-top">
                      <span className="hms-cmt-who">{empName(c.author)}</span>
                      {c.priority !== "normal" && <span className={`hms-cmt-prio ${c.priority}`}>{c.priority === "kritisk" ? "Kritisk" : "Høy"}</span>}
                      {c.internal && <span className="hms-cmt-internal">Internt</span>}
                      <span className="hms-cmt-time">{c.at}</span>
                    </div>
                    {c.anchorLabel && c.anchorLabel !== anchorLabel && <span className="hms-cmt-anchor"><span className="ic"><Ic n="link" s={11} /></span>{c.anchorLabel}</span>}
                    <div className="hms-cmt-text">{withMentions(c.text)}</div>
                    <div className="hms-cmt-foot">
                      {c.owner && <span><Ic n="user" s={12} /> Ansvarlig: <strong style={{ color: "var(--fg)" }}>{empName(c.owner)}</strong></span>}
                      {c.due && <span><Ic n="clock" s={12} /> Frist {c.due}</span>}
                      {c.attachments > 0 && <span><Ic n="file" s={12} /> {c.attachments} vedlegg</span>}
                      <button className={`hms-cmt-resolve ${c.resolved ? "done" : ""}`} onClick={() => toggleResolve(c.id)}>
                        <Ic n="check" s={12} sw={2.4} /> {c.resolved ? "Løst" : "Marker løst"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hms-cmt-compose">
            <textarea className="hms-cmt-field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Skriv en kommentar… bruk @ for å nevne noen" />
            <div className="hms-cmt-opts">
              {PRIO.map(([id, l]) => <button key={id} className={`hms-chipbtn ${prio === id ? "on" : ""}`} onClick={() => setPrio(id)}>{l}</button>)}
              <button className={`hms-chipbtn ${internal ? "on" : ""}`} onClick={() => setInternal((v) => !v)}><Ic n="lock" s={12} /> Internt</button>
              <button className={`hms-chipbtn ${ownerOn ? "on" : ""}`} onClick={() => setOwnerOn((v) => !v)}><Ic n="user" s={12} /> Sett ansvarlig</button>
              <button className="hms-chipbtn"><Ic n="file" s={12} /> Vedlegg</button>
              <span style={{ flex: 1 }} />
              <button className="sk-primary" style={{ height: 32 }} disabled={!draft.trim()} onClick={send}><Ic n="send" s={14} c="#fff" /> Send</button>
            </div>
          </div>
        </aside>
      </>
    );
  }

  window.Hms = {
    Ic, SD, cat, emp, empName, loc, pos, imp, scoreTone, scoreColor,
    procedure, training, quiz, manual, legal, process, proto,
    TYPE_META, TypeBadge, Breadcrumb,
    Av, Ring, Trend, ImpBadge, StatusBadge, CatChip, HandbookLink, withMentions,
    Pop, Panel, AIPanel, AssistStrip, CommentDrawer,
  };
})();
