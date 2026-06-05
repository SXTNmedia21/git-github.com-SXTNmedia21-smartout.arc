// ===== Avstemming — shared primitives (window.Rec) =====
// Reuses window.Lo (Av, kr, fmt0, useOutside) + DS tokens. Status grammar is
// icon + label + tone (never colour alone — WCAG). Money is mono/tabular.
(function () {
  const { useRef } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  const fmt0 = (n) => Number(n).toLocaleString("no-NO", { maximumFractionDigits: 0 });
  const kr = (n) => (n == null ? "—" : "kr " + fmt0(n));
  const krShort = (n) => (n == null ? "—" : n >= 1000 ? fmt0(Math.round(n / 100) / 10) + "k" : fmt0(n));
  const h1 = (n) => (n == null ? "—" : Number(n).toFixed(1));

  // reuse Lo avatar (resolves jh/sl/… via LO_EMP_BY_ID or USERS)
  const Av = (p) => (window.Lo ? window.Lo.Av(p) : null);

  // status pill (icon + label + tone)
  function StatusPill({ status, short }) {
    const s = D().REC_STATUS[status] || { label: status, icon: "circle", tone: "muted" };
    return (
      <span className={`rec-pill ${s.tone}`}>
        <span className="ic"><Ic n={s.icon} s={12} /></span>
        {short && s.short ? s.short : s.label}
      </span>
    );
  }

  // dept dot
  function DeptDot({ dept, size = 6 }) {
    const c = (D().REC_DEPT[dept] || {}).c || "#888";
    return <span className="ddot" style={{ width: size, height: size, background: c }} />;
  }

  // empty state
  function Empty({ icon, title, sub }) {
    return (
      <div className="rec-empty">
        <span className="ic"><Ic n={icon || "inbox"} s={21} /></span>
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
    );
  }

  // scrim wrapper
  function Scrim({ mode = "center", onClose, children }) {
    return (
      <div className={`rec-scrim ${mode}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
        {children}
      </div>
    );
  }

  // field
  function Field({ label, required, hint, children }) {
    return (
      <div className="rec-field">
        <div className="lab"><span className="t">{label}{required && <span className="req"> *</span>}</span>{hint && <span className="hint">{hint}</span>}</div>
        {children}
      </div>
    );
  }

  // toggle switch
  function Switch({ on, onClick }) {
    return <button className={`rec-switch ${on ? "on" : ""}`} onClick={onClick} aria-pressed={on} />;
  }

  // segmented
  function Seg({ value, opts, onChange }) {
    return (
      <div className="rec-seg">
        {opts.map(([v, l]) => <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}
      </div>
    );
  }

  // severity meta
  const sevMeta = (sev) => D().REC_SEV[sev] || { label: sev, tone: "muted" };

  window.Rec = { fmt0, kr, krShort, h1, Av, StatusPill, DeptDot, Empty, Scrim, Field, Switch, Seg, sevMeta, useOutside: (window.Lo && window.Lo.useOutside) };
})();
