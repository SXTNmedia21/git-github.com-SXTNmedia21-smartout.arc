// ===== Kommunikasjon — shared primitives, badges, helpers (window.Ko) =====
// Loaded first (after kommunikasjon-data.js). Exposes window.Ko consumed by the
// compose / detail / page files. Mirrors window.An conventions exactly.
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.Ic;
  const SD = window.SmartoutData;

  // ---------- catalog lookups ----------
  const person = (id) => SD.KO_PEOPLE_BY_ID[id] || { id, name: id, initials: "?", color: "#7a756e", role: "" };
  const channel = (id) => SD.CHANNEL_BY_ID[id] || { id, name: id, color: "#7a756e", kind: "tema" };
  const dept = (id) => SD.KO_DEPARTMENTS[id] || { name: id, color: "#7a756e" };
  const team = (id) => SD.KO_TEAMS[id] || { name: id };
  const loc = (id) => SD.KO_LOCATIONS[id] || { name: id };
  const access = (id) => SD.KO_ACCESS[id] || { label: id, tone: "muted" };

  // ---------- status / priority meta ----------
  const statusMeta = (id) => SD.ANN_STATUS[id] || SD.ANN_STATUS.draft;
  const prioMeta = (id) => SD.ANN_PRIORITY[id] || SD.ANN_PRIORITY.normal;
  const kindMeta = (id) => SD.CHANNEL_KINDS[id] || SD.CHANNEL_KINDS.tema;

  // ---------- generic tone badge (matches an-badge semantics) ----------
  function Badge({ tone = "muted", children, dot, ic, outline, className = "" }) {
    return (
      <span className={`ko-badge ${outline ? "outline" : ""} ${className}`} data-tone={tone}>
        {dot && <span className="dot" style={{ background: "currentColor" }} />}
        {ic && <Ic n={ic} s={12} />}
        {children}
      </span>
    );
  }
  const StatusBadge = ({ id }) => { const m = statusMeta(id); return <Badge tone={m.tone} ic={m.icon}>{m.label}</Badge>; };
  const PrioBadge = ({ id }) => { const m = prioMeta(id); return id === "operational" ? <Badge tone={m.tone} ic={m.icon}>{m.label}</Badge> : null; };

  // ---------- avatar ----------
  function Av({ id, p, size = 32, style }) {
    const e = p || person(id);
    return <span className="so-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: e.color, ...style }}>{e.initials}</span>;
  }
  function AvStack({ ids = [], max = 4, size = 24 }) {
    const shown = ids.slice(0, max);
    const extra = ids.length - shown.length;
    return (
      <span className="so-av-stack">
        {shown.map((id) => <Av key={id} id={id} size={size} />)}
        {extra > 0 && <span className="so-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.34), background: "var(--secondary)", color: "var(--muted)" }}>+{extra}</span>}
      </span>
    );
  }

  // ---------- channel chip ----------
  function ChannelChip({ id, sm }) {
    const c = channel(id);
    return (
      <span className={`ko-chchip ${sm ? "sm" : ""}`} style={{ "--ch": c.color }}>
        <Ic n="hash" s={sm ? 11 : 12} />
        <span>{c.name}</span>
      </span>
    );
  }

  // ---------- audience pill ----------
  function AudiencePill({ aud, count }) {
    const k = SD.AUDIENCE_KINDS[aud && aud.kind] || SD.AUDIENCE_KINDS.all;
    return (
      <span className="ko-aud">
        <Ic n={k.icon} s={12} />
        <span>{SD.audienceLabel(aud)}</span>
        {typeof count === "number" && <span className="n">{count}</span>}
      </span>
    );
  }

  // ---------- confirm / action modal (matches an-modal) ----------
  function ConfirmModal({ open, onClose, tone = "warn", ic = "alert", title, body, note, confirmLabel = "Bekreft", confirmTone = "primary", onConfirm }) {
    useEffect(() => {
      if (!open) return;
      const h = (ev) => { if (ev.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [open]);
    if (!open) return null;
    return (
      <div className="ko-scrim" onMouseDown={onClose}>
        <div className="ko-cmodal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="ko-cmodal-head">
            <span className={`ko-cmodal-ic ${tone}`}><Ic n={ic} s={20} /></span>
            <div className="h"><div className="t">{title}</div>{body && <div className="s">{body}</div>}</div>
          </div>
          {note && <div className="ko-cmodal-note"><span className="ic"><Ic n="info" s={15} /></span><span>{note}</span></div>}
          <div className="ko-cmodal-foot">
            <button className="ko-btn sm" onClick={onClose}>Avbryt</button>
            <span className="spacer" />
            <button className={`ko-btn sm ${confirmTone}`} onClick={() => { onConfirm && onConfirm(); onClose(); }}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- click-outside popover (matches sk-pop) ----------
  function Pop({ children, onClose, style, className = "" }) {
    const ref = useRef(null);
    useEffect(() => {
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
      setTimeout(() => document.addEventListener("mousedown", h), 0);
      return () => document.removeEventListener("mousedown", h);
    }, []);
    return <div ref={ref} className={`sk-pop ${className}`} style={style}>{children}</div>;
  }

  // ---------- panel scaffold (matches an-panel) ----------
  function Panel({ icon, iconTone, title, sub, cnt, action, children, id, className = "" }) {
    return (
      <section className={`ko-panel ${className}`} id={id}>
        <div className="ko-phead">
          {icon && <span className={`ico ${iconTone || ""}`}><Ic n={icon} s={16} /></span>}
          <span className="hgrp"><span className="ttl">{title}</span>{sub && <span className="sub">{sub}</span>}</span>
          {typeof cnt === "number" && <span className="cnt">{cnt}</span>}
          <span className="spacer" />
          {action}
        </div>
        {children}
      </section>
    );
  }

  // ---------- empty state ----------
  function Empty({ icon = "inbox", title, sub, action }) {
    return (
      <div className="ko-empty">
        <span className="ic"><Ic n={icon} s={24} /></span>
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
        {action}
      </div>
    );
  }

  // ---------- segmented control ----------
  function Seg({ value, onChange, options, sm }) {
    return (
      <div className={`ko-seg ${sm ? "sm" : ""}`}>
        {options.map(([k, l, icon]) => (
          <button key={k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
            {icon && <Ic n={icon} s={13} />}{l}
          </button>
        ))}
      </div>
    );
  }

  // ---------- skeleton block ----------
  const Skel = ({ h = 64, style }) => <div className="ko-skel" style={{ height: h, ...style }} />;

  // ---------- relative read ratio ----------
  function readPct(a) { return a.targetCount ? Math.round((a.readCount / a.targetCount) * 100) : 0; }

  window.Ko = {
    Ic, SD,
    person, channel, dept, team, loc, access,
    statusMeta, prioMeta, kindMeta, readPct,
    Badge, StatusBadge, PrioBadge, Av, AvStack, ChannelChip, AudiencePill,
    ConfirmModal, Pop, Panel, Empty, Seg, Skel,
  };
})();
