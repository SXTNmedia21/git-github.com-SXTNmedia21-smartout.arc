// ===== Ansatte — shared primitives, badges, helpers (window.An) =====
// Loaded first. Exposes window.An consumed by the panels/profile/directory files.
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.Ic;
  const SD = window.SmartoutData;

  // ---------- catalog lookups ----------
  const dept = (id) => SD.DEPARTMENTS[id] || { name: id, color: "#7a756e" };
  const loc = (id) => SD.LOCATIONS[id] || { name: id };
  const team = (id) => SD.TEAMS[id];
  const pos = (id) => SD.POSITIONS[id];
  const protocol = (id) => SD.PROTOCOLS[id];
  const profession = (id) => SD.PROFESSIONS[id];
  const legalFn = (id) => SD.LEGAL_FUNCTIONS[id];
  const emp = (id) => SD.EMP_BY_ID[id];
  const empName = (id) => (emp(id) ? emp(id).display : id);

  // ---------- protocol_assignment status meta ----------
  // schema statuses: pending · not_started · in_progress · completed · expired · waived
  function protoMeta(a) {
    const done = a.proc[0] + a.test[0] + a.conf[0];
    const total = a.proc[1] + a.test[1] + a.conf[1];
    const pct = total ? Math.round((done / total) * 100) : 0;
    let cls = "notstarted", label = "Ikke startet", tone = "muted", icon = "clock";
    if (a.status === "completed") { cls = "done"; label = "Fullført"; tone = "success"; icon = "check"; }
    else if (a.status === "in_progress") { cls = "inprogress"; label = "Pågår"; tone = "info"; icon = "clock"; }
    else if (a.status === "expired") { cls = "expired"; label = "Utløpt"; tone = "warning"; icon = "history"; }
    else if (a.status === "waived") { cls = "waived"; label = "Fritatt"; tone = "muted"; icon = "ban"; }
    else if (a.status === "pending") { cls = "notstarted"; label = "Venter"; tone = "muted"; icon = "clock"; }
    return { done, total, pct, cls, label, tone, icon };
  }

  // ---------- readiness computation (driven by protocol_assignment counters) ----------
  // Ready only when every assignment is completed and none expired (and lifecycle=active).
  function readiness(e) {
    const as = e.protocols || [];
    let done = 0, total = 0;
    as.forEach((a) => { done += a.proc[0] + a.test[0] + a.conf[0]; total += a.proc[1] + a.test[1] + a.conf[1]; });
    const score = total ? Math.round((done / total) * 100) : (e.lifecycle === "active" ? 100 : 0);
    const hasExpired = as.some((a) => a.status === "expired");
    const allDone = as.length > 0 && as.every((a) => a.status === "completed");
    const blockers = (e.readiness && e.readiness.blockers) || [];
    const critBlock = blockers.some((b) => b.sev === "crit");
    const ready = e.lifecycle === "active" && allDone && !hasExpired && !critBlock;
    return { score, ready, hasExpired, allDone, blockers, color: ready ? "var(--success)" : hasExpired || critBlock ? "var(--error)" : "var(--warning)" };
  }

  // ---------- generic tone badge ----------
  function Badge({ tone = "muted", children, dot, ic, outline, ax, className = "" }) {
    return (
      <span className={`an-badge ${outline ? "outline" : ""} ${className}`} data-tone={tone}>
        {dot && <span className="dot" style={{ background: "currentColor" }} />}
        {ic && <Ic n={ic} s={12} />}
        {ax && <span className="ax">{ax}</span>}
        {children}
      </span>
    );
  }
  const LifecycleBadge = ({ id, sm }) => { const l = SD.LIFECYCLE[id]; return <Badge tone={l.tone} dot>{l.label}</Badge>; };
  const AccessBadge = ({ id }) => { const a = SD.ACCESS_LEVELS[id]; return <Badge tone={a.tone} ic="shield">{a.label}</Badge>; };
  const AuthorityBadge = ({ id }) => { const a = SD.AUTHORITY_LEVELS[id]; return <Badge tone={a.tone} ic="star">{a.label}</Badge>; };

  // ---------- avatar ----------
  function Av({ e, size = 34, style }) {
    return <span className="so-av" style={{ width: size, height: size, fontSize: size * 0.36, background: e.color, ...style }}>{e.initials}</span>;
  }

  // ---------- confirm / reveal modal ----------
  function ConfirmModal({ open, onClose, tone = "warn", ic = "alert", title, body, note, confirmLabel = "Bekreft", confirmTone = "primary", onConfirm }) {
    useEffect(() => {
      if (!open) return;
      const h = (ev) => { if (ev.key === "Escape") onClose(); };
      window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    }, [open]);
    if (!open) return null;
    return (
      <div className="an-scrim" onMouseDown={onClose}>
        <div className="an-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog">
          <div className="an-modal-head">
            <span className={`an-modal-ic ${tone}`}><Ic n={ic} s={20} /></span>
            <div className="h"><div className="t">{title}</div><div className="s">{body}</div></div>
          </div>
          {note && <div className="an-modal-note"><span className="ic"><Ic n="info" s={15} /></span><span>{note}</span></div>}
          <div className="an-modal-foot">
            <button className="an-btn sm" onClick={onClose}>Avbryt</button>
            <span className="spacer" />
            <button className={`an-btn sm ${confirmTone}`} onClick={() => { onConfirm && onConfirm(); onClose(); }}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- small dropdown popover (click-outside) ----------
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
  function Panel({ icon, iconTone, title, sub, src, action, children, accent, id }) {
    return (
      <section className={`an-panel ${accent ? "accent-" + accent : ""}`} id={id}>
        <div className="an-phead">
          {icon && <span className={`ico ${iconTone || ""}`}><Ic n={icon} s={16} /></span>}
          <span className="hgrp"><span className="ttl">{title}</span>{sub && <span className="sub">{sub}</span>}</span>
          <span className="spacer" />
          {src && <span className="src-tag">{src}</span>}
          {action}
        </div>
        {children}
      </section>
    );
  }

  window.An = {
    Ic, SD, dept, loc, team, pos, protocol, profession, legalFn, emp, empName,
    protoMeta, readiness, Badge, LifecycleBadge, AccessBadge, AuthorityBadge, Av,
    ConfirmModal, Pop, Panel,
  };
})();
