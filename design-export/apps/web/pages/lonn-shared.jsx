// ===== Lønn — shared primitives (window.Lo) =====
// Used by lonn-views, lonn-config, lonn-overlays, min-lonn. Calc-engine derives;
// the human confirms + locks. All money is mono/tabular.
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  // ---- formatters ----
  const fmt = (n) => Number(n).toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) => Number(n).toLocaleString("no-NO", { maximumFractionDigits: 0 });
  const kr = (n) => "kr " + fmt0(n);

  // ---- avatar ----
  function Av({ uid, size = 28, name, color, initials }) {
    const e = (D().LO_EMP_BY_ID && D().LO_EMP_BY_ID[uid]) || (D().USERS && D().USERS[uid]) || {};
    const nm = name || e.name || uid;
    const col = color || e.color || "#888";
    const ini = initials || e.initials || (nm ? nm.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "?");
    return <span className="so-av" style={{ width: size, height: size, background: col, fontSize: size * 0.4 }}>{ini}</span>;
  }

  // ---- dept dot ----
  function DeptDot({ dept, size = 6 }) {
    const c = (D().LO_DEPT[dept] || {}).c || "#888";
    return <span className="lo-dot" style={{ width: size, height: size, background: c }} />;
  }

  // ---- status badge ----
  function Badge({ kind }) {
    const map = { open: "Åpen", locked: "Låst", approved: "Godkjent", exported: "Eksportert", error: "Feil", warning: "Advarsel", info: "Info", ack: "Bekreftet" };
    return <span className={`lo-badge ${kind}`}>{map[kind] || kind}</span>;
  }

  // ---- toggle switch ----
  function Switch({ on, onClick }) {
    return <button className={`lo-switch ${on ? "on" : ""}`} onClick={onClick} aria-pressed={on} />;
  }

  // ---- field wrapper ----
  function Field({ label, required, hint, children }) {
    return (
      <div className="lo-field">
        <div className="lab">
          <span className="t">{label}{required && <span className="req"> *</span>}</span>
          {hint && <span className="hint">{hint}</span>}
        </div>
        {children}
      </div>
    );
  }

  // ---- panel (so-panel wrapper with head) ----
  function Panel({ icon, iconTone, title, cnt, cntCrit, action, children, pad }) {
    return (
      <div className="so-panel">
        {title && (
          <div className="so-panel-head">
            <span className="t">{icon && <span className="ico" style={iconTone ? { color: `var(--${iconTone})` } : null}><Ic n={icon} s={15} /></span>}{title}</span>
            {cnt != null && <span className={`cnt ${cntCrit ? "crit" : ""}`}>{cnt}</span>}
            <span className="spacer" />
            {action}
          </div>
        )}
        <div className={`so-panel-body ${pad ? "pad" : ""}`}>{children}</div>
      </div>
    );
  }

  // ---- section sub-head + card ----
  function Section({ title, sub, action, children }) {
    return (
      <div className="lo-sec">
        <div className="lo-sec-h">
          <div>
            <div className="t">{title}</div>
            {sub && <div className="s">{sub}</div>}
          </div>
          {action}
        </div>
        <div className="lo-card">{children}</div>
      </div>
    );
  }

  // ---- empty ----
  function Empty({ icon, title, sub }) {
    return (
      <div className="so-empty">
        <span className="ic"><Ic n={icon || "inbox"} s={22} /></span>
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
    );
  }

  // ---- outside-click hook ----
  function useOutside(ref, on) {
    useEffect(() => {
      if (!on) return;
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) on(); };
      document.addEventListener("mousedown", h);
      const k = (e) => { if (e.key === "Escape") on(); };
      document.addEventListener("keydown", k);
      return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
    }, [on]);
  }

  // ---- scrim wrapper (drawer / modal) ----
  function Scrim({ mode = "center", onClose, children }) {
    const ref = useRef(null);
    return (
      <div className={`lo-scrim ${mode}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
        <div ref={ref}>{children}</div>
      </div>
    );
  }

  // ---- supplement chip ----
  function SuppChip({ kind, amount }) {
    const map = { base: "Grunn", kveld: "Kveld 25%", helg: "Helg 50%", hellig: "Hellig 100%", warn: "Bekreft" };
    return (
      <span className={`lo-suppchip ${kind}`}>
        {kind === "warn" && <Ic n="alert" s={10} />}
        <span>{map[kind] || kind}</span>
        {amount != null && <span style={{ opacity: 0.7 }}>· {fmt0(amount)}</span>}
      </span>
    );
  }

  window.Lo = { fmt, fmt0, kr, Av, DeptDot, Badge, Switch, Field, Panel, Section, Empty, Scrim, SuppChip, useOutside };
})();
