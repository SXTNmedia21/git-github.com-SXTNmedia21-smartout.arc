// ===== Menykunnskap — shared primitives (window.Mk) =====
// Progress ring, confidence bar, allergen chips, source pill, phone frame.
// Warm Nordic palette only — no chart libs. Reused by every menykunnskap-*.jsx.
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  // ---------- avatar ----------
  function MkAv({ p, size = 30 }) {
    return <span className="so-av" style={{ width: size, height: size, background: p.color, fontSize: size * 0.38 }}>{p.initials}</span>;
  }

  // ---------- progress ring ----------
  function Ring({ value, size = 64, stroke = 7, color, label, sub }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - value / 100);
    const col = color || (value >= 85 ? "var(--success)" : value >= 65 ? "var(--orange)" : value >= 45 ? "var(--warning)" : "var(--error)");
    return (
      <span className="mk-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)" }} />
        </svg>
        <span className="ring-num">
          <b style={{ fontSize: size * 0.28, color: col }}>{label != null ? label : Math.round(value)}<span style={{ fontSize: size * 0.16 }}>{label == null ? "%" : ""}</span></b>
          {sub && <span>{sub}</span>}
        </span>
      </span>
    );
  }

  // ---------- coverage / generic bar ----------
  function Bar({ value, tone }) {
    const cls = tone || (value >= 85 ? "ok" : value >= 60 ? "" : value >= 45 ? "warn" : "low");
    return <div className="mk-bar"><span className={cls} style={{ width: value + "%" }} /></div>;
  }

  // ---------- confidence ----------
  function Conf({ v, verified = true }) {
    const cls = v >= 75 ? "" : v >= 55 ? "med" : "low";
    return (
      <span className={`mk-conf ${verified ? "" : "unv"}`} title={`Sikkerhet ${v}%${verified ? "" : " · ikke bekreftet"}`}>
        <span className="bar"><span className={cls} style={{ width: v + "%" }} /></span>
        <span className="pct">{v}%</span>
      </span>
    );
  }

  // ---------- source pill ----------
  function Src({ source }) {
    const lbl = (D().MK_SOURCE_LABEL || {})[source] || source;
    const ic = (D().MK_SOURCE_ICON || {})[source] || "info";
    return <span className="mk-src"><span className="ic"><Ic n={ic} s={11} /></span>{lbl}</span>;
  }

  // ---------- allergen chips (refined, modern) ----------
  function Allergens({ list, size = "md" }) {
    const A = D().MK_ALLERGENS || {};
    if (!list || !list.length) return null;
    // a couple count as "must mention" criticals for hospitality (fisk/skalldyr/bløtdyr/nøtter)
    const crit = new Set(["fisk", "skalldyr", "blotdyr", "notter"]);
    return (
      <div className={`mk-allergens ${size}`}>
        {list.map((k) => {
          const a = A[k] || { code: "?", label: k };
          return <span key={k} className={`mk-aller ${crit.has(k) ? "crit" : ""}`}><span className="dot" />{a.label}<span className="code">{a.code}</span></span>;
        })}
      </div>
    );
  }

  // ---------- generated dish "photo" art (plate/glass motif) ----------
  function DishArt({ id }) {
    const art = (D().mkDishArt ? D().mkDishArt(id) : null);
    if (!art) return null;
    if (art.type === "glass") {
      const [l0, l1] = art.liquid || ["#a02f3c", "#c2543f"];
      return (
        <span className="mk-art mk-art-glass" aria-hidden="true">
          <span className="mk-art-glassbody">
            <span className="mk-art-liquid" style={{ background: `linear-gradient(180deg, ${l1}, ${l0})` }} />
            <span className="mk-art-rim" style={{ background: art.rim || "#e7c08a" }} />
          </span>
          {art.garnish && <span className="mk-art-gdot" style={{ background: art.garnish }} />}
        </span>
      );
    }
    const [m0, m1] = art.main || ["#7a4524", "#9a5a2a"];
    return (
      <span className="mk-art mk-art-plate" aria-hidden="true">
        <span className="mk-art-disc">
          <span className="mk-art-food" style={{ background: `radial-gradient(circle at 42% 38%, ${m1}, ${m0} 78%)` }} />
          {art.side && <span className="mk-art-blob s1" style={{ background: art.side }} />}
          {art.side && <span className="mk-art-blob s2" style={{ background: art.side }} />}
          {art.garnish && <span className="mk-art-blob g1" style={{ background: art.garnish }} />}
          {art.garnish && <span className="mk-art-blob g2" style={{ background: art.garnish }} />}
          <span className="mk-art-sheen" />
        </span>
      </span>
    );
  }

  // ---------- user-fillable image (localStorage-backed, styling-controlled) ----------
  function ImageDrop({ k, placeholder, kind, ratio, radius = 14, onChange, className, style }) {
    const KEY = "mk_img_" + k;
    const dishId = (k || "").replace(/^plate_/, "");
    const [src, setSrc] = useState(() => { try { return localStorage.getItem(KEY) || null; } catch (e) { return null; } });
    const [over, setOver] = useState(false);
    const inputRef = useRef(null);
    const set = (url) => { setSrc(url); try { if (url) localStorage.setItem(KEY, url); else localStorage.removeItem(KEY); } catch (e) {} onChange && onChange(url); };
    const file = (f) => { if (!f || !/^image\//.test(f.type)) return; const r = new FileReader(); r.onload = () => set(r.result); r.readAsDataURL(f); };
    useEffect(() => { if (src && onChange) onChange(src); }, []);
    return (
      <div className={`mk-imgdrop ${kind || ""} ${src ? "filled" : ""} ${over ? "over" : ""} ${className || ""}`}
        style={{ aspectRatio: ratio || undefined, borderRadius: radius, ...style }}
        onClick={() => inputRef.current && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); file(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
        {src ? <img src={src} alt="" /> : (
          <span className="mk-imgdrop-ph">
            {kind === "plate" ? <DishArt id={dishId} /> : <Ic n={kind === "menu" ? "camera" : "image"} s={22} c="var(--muted-soft)" />}
            {kind !== "plate" && <span className="t">{placeholder || "Slipp et bilde"}</span>}
            {kind !== "plate" && <span className="s">eller klikk for å velge fil</span>}
          </span>
        )}
        {src && <button className="mk-imgdrop-x" title="Fjern bilde" onClick={(e) => { e.stopPropagation(); set(null); }}><Ic n="x" s={13} /></button>}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => file(e.target.files && e.target.files[0])} />
      </div>
    );
  }

  // ---------- delicious dish card (sells the dish) ----------
  function DishCard({ dish, onPlay }) {
    return (
      <div className="mk-dish">
        <div className="mk-dish-photo">
          <ImageDrop k={"plate_" + dish.id} kind="plate" radius={0} placeholder="Slipp et foto av tallerkenen" />
          {dish.price && <span className="mk-dish-price">{dish.price}<span>kr</span></span>}
          {dish.kind && <span className="mk-dish-kind">{(D().MK_KIND_LABEL || {})[dish.kind] || dish.kind}</span>}
        </div>
        <div className="mk-dish-body">
          <div className="mk-dish-name">{dish.name}</div>
          <div className="mk-dish-cat">{dish.category}{dish.station ? ` · ${dish.station}` : ""}</div>
          {dish.desc && <div className="mk-dish-desc">{dish.desc}</div>}
          {dish.allergens && dish.allergens.length > 0 && <Allergens list={dish.allergens} size="sm" />}
          {dish.story && <div className="mk-dish-story"><span className="q">”</span>{dish.story}</div>}
          {dish.pairing && <div className="mk-dish-pair"><Ic n="wallet" s={13} /> Anbefal: <b>{dish.pairing}</b></div>}
          {onPlay && <button className="mk-dish-play" onClick={onPlay}><Ic n="play" s={13} /> Øv på denne</button>}
        </div>
      </div>
    );
  }

  // ---------- status pill (menu state) ----------
  function StatePill({ status }) {
    const LBL = { publisert: "Publisert", utkast: "Utkast", ekstraherer: "Leser…", review: "Til gjennomgang" };
    return <span className={`mk-statepill ${status}`}>{status === "ekstraherer" && <Ic n="sparkle" s={10} />}{LBL[status] || status}</span>;
  }

  // ---------- phone frame ----------
  function Phone({ children, time = "21:42" }) {
    return (
      <div className="mk-phone">
        <div className="mk-phone-notch" />
        <div className="mk-phone-screen">
          <div className="mk-statusbar">
            <span>{time}</span>
            <span className="dots">
              <Ic n="message" s={12} />
              <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="4.5" width="3" height="6.5" rx="1"/><rect x="9" y="2" width="3" height="9" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1" opacity="0.4"/></svg>
              <svg width="22" height="11" viewBox="0 0 22 11" fill="none"><rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" opacity="0.5"/><rect x="2" y="2" width="13" height="7" rx="1" fill="currentColor"/><rect x="19.5" y="3.5" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.5"/></svg>
            </span>
          </div>
          <div className="mk-phone-body">{children}</div>
        </div>
      </div>
    );
  }

  // ---------- confetti ----------
  function Confetti({ n = 40 }) {
    const cols = ["#f97316", "#11ad32", "#2784d5", "#c18200", "#EC4899", "#8b5cf6"];
    const bits = Array.from({ length: n }, (_, i) => ({
      left: Math.random() * 100, delay: Math.random() * 0.5, dur: 1.6 + Math.random() * 1.4,
      col: cols[i % cols.length], rot: Math.random() * 360,
    }));
    return (
      <div className="mk-confetti">
        {bits.map((b, i) => (
          <i key={i} style={{ left: b.left + "%", background: b.col, animationDuration: b.dur + "s", animationDelay: b.delay + "s", transform: `rotate(${b.rot}deg)` }} />
        ))}
      </div>
    );
  }

  // ---------- panel (reuse so-panel head) ----------
  function Panel({ icon, title, count, countCrit, right, link, onLink, children, flush, style }) {
    return (
      <div className={`so-panel ${flush ? "flush" : ""}`} style={style}>
        {title && (
          <div className="so-panel-head">
            <span className="t">{icon && <span className="ico"><Ic n={icon} s={15} /></span>}{title}</span>
            {count != null && <span className={`cnt ${countCrit ? "crit" : ""}`}>{count}</span>}
            <span className="spacer" />
            {right}
            {link && <button className="link" onClick={onLink}>{link} <Ic n="arrowRight" s={13} /></button>}
          </div>
        )}
        {children}
      </div>
    );
  }

  // ---------- outside-click ----------
  function useOutside(ref, cb) {
    useEffect(() => {
      if (!cb) return;
      const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
      document.addEventListener("mousedown", fn);
      return () => document.removeEventListener("mousedown", fn);
    }, [cb]);
  }

  window.Mk = { Ic, MkAv, Ring, Bar, Conf, Src, Allergens, StatePill, Phone, Confetti, Panel, useOutside, ImageDrop, DishCard };
})();
