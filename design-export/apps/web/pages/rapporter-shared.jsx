// ===== Rapporter — shared primitives (window.Rap) =====
// Formatters, hand-built SVG charts (no chart libs), KPI card, small UI atoms.
// Warm Nordic palette only. Reused by every rapporter-*.jsx file.
(function () {
  const { useState, useRef, useEffect } = React;
  const Ic = window.Ic;

  // ---------- formatters ----------
  const nf = (n) => new Intl.NumberFormat("nb-NO").format(Math.round(n));
  const kr = (n) => "kr " + nf(n);
  const krsign = (n) => (n >= 0 ? "+" : "−") + "kr " + nf(Math.abs(n));
  const fmtVal = (v, fmt) => {
    switch (fmt) {
      case "pct": return String(v).replace(".", ",");
      case "kr": return nf(v);
      case "kr0": return v >= 1000 ? (v / 1000).toFixed(0).replace(".", ",") : nf(v);
      case "krsign": return (v >= 0 ? "+" : "−") + nf(Math.abs(v));
      case "hour": return String(v).replace(".", ",");
      case "num": return nf(v);
      default: return String(v);
    }
  };
  const unitFor = (k) => (k.fmt === "kr0" && k.value >= 1000 ? "k kr" : k.unit);

  // ---------- avatar ----------
  function Av({ id, size = 26, u }) {
    const U = (window.SmartoutData && window.SmartoutData.USERS) || {};
    const p = u || U[id] || { initials: "?", color: "#7a756e" };
    return <span className="so-av" style={{ width: size, height: size, background: p.color, fontSize: size * 0.4 }}>{p.initials}</span>;
  }

  // ---------- venue dot ----------
  const venue = (id) => (window.SmartoutData.RAP_VENUES || []).find((v) => v.id === id) || {};
  function VDot({ id, size = 8 }) {
    return <span className="vdot" style={{ width: size, height: size, borderRadius: "50%", display: "inline-block", background: venue(id).color || "var(--muted)" }} />;
  }

  // ---------- delta pill ----------
  function Delta({ dir, children }) {
    const ic = dir === "up" ? "trendUp" : dir === "down" ? "trendUp" : null;
    return (
      <span className={`rap-delta ${dir}`}>
        {dir === "up" && <Ic n="chevUp" s={11} sw={2.6} />}
        {dir === "down" && <Ic n="chevDown" s={11} sw={2.6} />}
        {children}
      </span>
    );
  }

  // ---------- confidence ----------
  function Conf({ v, label = true }) {
    const cls = v >= 85 ? "" : v >= 70 ? "med" : "low";
    return (
      <span className="rap-conf" title={`Sikkerhet ${v}%`}>
        <span className="bar"><span className={cls} style={{ width: v + "%" }} /></span>
        {label && <span>{v}%</span>}
      </span>
    );
  }

  // ---------- sparkline ----------
  function Spark({ data, color = "var(--muted)", w = 96, h = 28, fill = false }) {
    if (!data || !data.length) return null;
    const min = Math.min(...data), max = Math.max(...data);
    const span = max - min || 1;
    const pad = 2;
    const pts = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return [x, y];
    });
    const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = d + ` L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
    const gid = "sg" + Math.random().toString(36).slice(2, 7);
    return (
      <svg className="rap-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
        {fill && (
          <>
            <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient></defs>
            <path d={area} fill={`url(#${gid})`} />
          </>
        )}
        <path d={d} stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={color} />
      </svg>
    );
  }

  // ---------- dual trend chart (revenue line + labor bars) ----------
  function DualTrend({ days, h = 200 }) {
    const w = 640, padL = 8, padR = 8, padT = 14, padB = 26;
    const iw = w - padL - padR, ih = h - padT - padB;
    const maxRev = Math.max(...days.map((d) => d.rev)) * 1.08;
    const maxLabor = Math.max(...days.map((d) => d.labor)) * 1.6;
    const n = days.length;
    const bw = (iw / n) * 0.42;
    const x = (i) => padL + (i + 0.5) * (iw / n);
    const yRev = (v) => padT + (1 - v / maxRev) * ih;
    const line = days.map((d, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + yRev(d.rev).toFixed(1)).join(" ");
    return (
      <div className="rap-chart">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height: h }}>
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line key={i} className="gl" x1={padL} x2={w - padR} y1={padT + t * ih} y2={padT + t * ih} />
          ))}
          {days.map((d, i) => {
            const bh = (d.labor / maxLabor) * ih;
            return (
              <g key={i} className="rap-bar-grp">
                <rect className="rap-bar" x={x(i) - bw / 2} y={padT + ih - bh} width={bw} height={bh} rx="3"
                  fill={d.gap ? "rgba(231,0,11,0.30)" : "var(--border-strong)"} />
                <text className="axlbl" x={x(i)} y={h - 8} textAnchor="middle">{d.d}</text>
              </g>
            );
          })}
          <path d={line} fill="none" stroke="var(--orange)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {days.map((d, i) => <circle key={i} cx={x(i)} cy={yRev(d.rev)} r="3.4" fill="var(--card)" stroke="var(--orange)" strokeWidth="2" />)}
        </svg>
      </div>
    );
  }

  // ---------- target bar ----------
  function Target({ value, target, dir, fmt, unit }) {
    // good when value on the right side of target per dir
    const max = Math.max(value, target) * 1.25;
    const vp = Math.min(100, (value / max) * 100);
    const tp = Math.min(100, (target / max) * 100);
    const over = dir === "down" ? value > target : value < target;
    return (
      <div className="rap-target">
        <div className="rap-target-track">
          <span className="rap-target-fill" style={{ width: vp + "%", background: over ? "var(--warning)" : "var(--success)" }} />
          <span className="rap-target-mark" style={{ left: tp + "%" }} />
        </div>
        <div className="rap-target-row">
          <span>Faktisk {fmtVal(value, fmt)}{unit}</span>
          <span>Mål {fmtVal(target, fmt)}{unit}</span>
        </div>
      </div>
    );
  }

  // ---------- executive KPI card ----------
  function KpiCard({ k, onClick }) {
    const sparkColor = k.tone === "crit" ? "var(--error)" : k.tone === "warn" ? "var(--warning)" : k.tone === "ok" ? "var(--success)" : "var(--muted)";
    const edge = k.tone === "crit" ? "var(--error)" : k.tone === "warn" ? "var(--warning)" : k.tone === "ok" ? "var(--success)" : "var(--border-strong)";
    const deltaDir = (() => {
      // delta direction based on prev + which way is good
      if (k.prev == null) return "flat";
      const rising = k.value > k.prev;
      const good = k.dir === "up" ? rising : !rising;
      return rising ? (good ? "up" : "down") : (good ? "up" : "down"); // color by good/bad
    })();
    const goodBad = (() => {
      if (k.prev == null) return "flat";
      const rising = k.value > k.prev;
      const good = k.dir === "up" ? rising : !rising;
      return good ? "up" : "down";
    })();
    return (
      <div className="rap-kpi" onClick={onClick}>
        <span className="edge" style={{ background: edge }} />
        <div className="rap-kpi-top">
          <span className="rap-kpi-lbl"><span className="ico"><Ic n={k.icon} s={13} /></span><span className="tx">{k.label}</span></span>
        </div>
        <div className={`rap-kpi-val ${k.tone || ""}`}>{fmtVal(k.value, k.fmt)}<span className="u">{unitFor(k)}</span></div>
        <div className="rap-kpi-meta">
          <span className="rap-kpi-sub">{k.sub}</span>
          <Spark data={k.spark} color={sparkColor} w={84} h={26} fill />
        </div>
        <div className="rap-kpi-meta">
          <span className={`rap-delta ${goodBad}`}>
            {goodBad === "up" ? <Ic n="chevUp" s={11} sw={2.6} /> : goodBad === "down" ? <Ic n="chevDown" s={11} sw={2.6} /> : null}
            {k.deltaLabel}
          </span>
        </div>
      </div>
    );
  }

  // ---------- panel ----------
  function Panel({ icon, title, count, countCrit, link, onLink, right, children, flush }) {
    return (
      <div className={`so-panel ${flush ? "flush" : ""}`}>
        <div className="so-panel-head">
          <span className="t">{icon && <span className="ico"><Ic n={icon} s={15} /></span>}{title}</span>
          {count != null && <span className={`cnt ${countCrit ? "crit" : ""}`}>{count}</span>}
          <span className="spacer" />
          {right}
          {link && <button className="link" onClick={onLink}>{link} <Ic n="arrowRight" s={13} /></button>}
        </div>
        {children}
      </div>
    );
  }

  // ---------- empty ----------
  function Empty({ icon = "search", title, sub }) {
    return (
      <div className="so-empty">
        <span className="ic"><Ic n={icon} s={22} /></span>
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
    );
  }

  // ---------- outside-click hook ----------
  function useOutside(ref, cb) {
    useEffect(() => {
      if (!cb) return;
      const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
      document.addEventListener("mousedown", fn);
      return () => document.removeEventListener("mousedown", fn);
    }, [cb]);
  }

  window.Rap = {
    nf, kr, krsign, fmtVal, unitFor, venue,
    Av, VDot, Delta, Conf, Spark, DualTrend, Target, KpiCard, Panel, Empty, useOutside, Ic,
  };
})();
