// ===== Smartout — Håndbok shared primitives =====
// Exports to window: HbRing, HbChip, HbOwner, HbModal, HbSwitch, HB_STATE, hbAcc
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const SD = window.SmartoutData;

  // status -> chip tone/label
  const HB_STATE = {
    approved: { label: "Godkjent", tone: "ok" },
    review: { label: "Til gjennomgang", tone: "info" },
    draft: { label: "Utkast", tone: "muted" },
    outdated: { label: "Utdatert", tone: "warn" },
    archived: { label: "Arkivert", tone: "muted" },
  };

  // completeness ring (SVG)
  function HbRing({ pct = 0, size = 52, stroke = 5, color = "var(--orange)", showNum = true, numSize }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - pct / 100);
    return (
      <span className="hb-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset .5s ease" }} />
        </svg>
        {showNum && <span className="hb-ring-num" style={{ fontSize: numSize || size * 0.30, color }}>{pct}</span>}
      </span>
    );
  }

  function HbChip({ state, label, tone, className = "" }) {
    const s = state ? HB_STATE[state] : null;
    const t = tone || (s && s.tone) || "muted";
    const l = label || (s && s.label) || state;
    return <span className={`hb-chip ${t} ${className}`}><span className="d" />{l}</span>;
  }

  function HbOwner({ owner, size = 22, label = true, onClick }) {
    if (!owner) return (
      <span className="hb-owner none" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
        <span className="so-av" style={{ width: size, height: size, background: "var(--secondary)", color: "var(--warning)", border: "1.5px dashed var(--warning)" }}><Ic n="user" s={size * 0.5} /></span>
        {label && <span>Ingen eier</span>}
      </span>
    );
    return (
      <span className="hb-owner" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
        <span className="so-av" style={{ width: size, height: size, background: owner.color }}>{owner.init}</span>
        {label && <span className="nm">{owner.name}</span>}
      </span>
    );
  }

  function HbModal({ open, onClose, icon = "alert", tone = "warn", title, children, confirmLabel = "Bekreft", onConfirm, danger }) {
    if (!open) return null;
    return (
      <div className="hb-modal-scrim" onMouseDown={onClose}>
        <div className="hb-modal" onMouseDown={e => e.stopPropagation()}>
          <span className={`hb-modal-ic ${tone}`}><Ic n={icon} s={22} /></span>
          <h3>{title}</h3>
          <p>{children}</p>
          <div className="hb-modal-actions">
            <button className="sk-ghost" onClick={onClose}>Avbryt</button>
            <button className={danger ? "hb-btn-danger" : "sk-primary"} style={danger ? { height: 36, padding: "0 16px" } : null} onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  function HbSwitch({ on, onClick }) {
    return <span className={`hb-switch ${on ? "on" : ""}`} role="switch" aria-checked={on} onClick={onClick} />;
  }

  // owner picker popover (people from data)
  function HbOwnerPicker({ open, onPick, onClose }) {
    if (!open) return null;
    const people = Object.values(SD.HB_PEOPLE);
    return (
      <div className="sk-pop" style={{ top: 30, right: 0, width: 220, zIndex: 20 }} onMouseDown={e => e.stopPropagation()}>
        <div className="sk-pop-sec">Velg ansvarlig</div>
        {people.map(p => (
          <button key={p.init} className="sk-pop-item" onClick={() => { onPick(p); onClose(); }}>
            <span className="so-av" style={{ width: 22, height: 22, background: p.color }}>{p.init}</span>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}><span style={{ fontWeight: 500 }}>{p.name}</span><span style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.role}</span></span>
          </button>
        ))}
      </div>
    );
  }

  Object.assign(window, { HbRing, HbChip, HbOwner, HbModal, HbSwitch, HbOwnerPicker, HB_STATE });
})();
