// Calendar primitives + tokens + small atoms used across screens.
// All design tokens reference the project's design system (warm/orange Nordic Split).
// Dark-mode is the default for this prototype, matching the screenshot.

window.C = (() => {
  // CSS variables (declared in the host HTML <style>) so dark/light flips at one place.
  const t = {
    bg:       'var(--c-bg)',
    surface:  'var(--c-surface)',
    surface2: 'var(--c-surface-2)',
    fg:       'var(--c-fg)',
    fgSoft:   'var(--c-fg-soft)',
    muted:    'var(--c-muted)',
    border:   'var(--c-border)',
    orange:   'var(--c-orange)',
    success:  'var(--c-success)',
    warning:  'var(--c-warning)',
    error:    'var(--c-error)',
    info:     'var(--c-info)',
    kjokken:  '#ee560c',
    sal:      '#00ab93',
    bar:      '#864ad2',
    event:    '#c18200',
    serif:    '"Instrument Serif", Georgia, serif',
    mono:     '"Geist Mono", ui-monospace, Menlo, monospace',
  };

  // Helpers
  const cls = (...xs) => xs.filter(Boolean).join(' ');
  const fmtKr = (n) => new Intl.NumberFormat('nb-NO').format(Math.round(n));

  return { t, cls, fmtKr };
})();

// ─── Phone shell — matches the screenshot's iPhone bezel ─────────────────────
function Phone({ children, label, num, dark = true, scale = 1 }) {
  const W = 390, H = 844;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <div style={{
        fontSize: 10, letterSpacing: 2, fontWeight: 600, color: 'var(--page-muted)', textTransform: 'uppercase',
      }}>
        <span style={{ color: C.t.orange, marginRight: 8, fontFamily: C.t.mono }}>{num}</span>
        <span>{label}</span>
      </div>
      <div style={{
        width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top center',
        borderRadius: 56, background: dark ? '#000' : '#F2F2F7',
        boxShadow: '0 0 0 12px #1c63d8, 0 0 0 14px #0e3a87, 0 40px 70px rgba(0,0,0,.45)',
        position: 'relative', overflow: 'hidden',
        fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}>
        {/* Dynamic island */}
        <div style={{
          position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
          width: 122, height: 35, borderRadius: 22, background: '#000', zIndex: 50,
        }} />
        {/* Status bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          padding: '17px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: dark ? '#fff' : '#000', fontFamily: '-apple-system, "SF Pro", system-ui',
          fontWeight: 600, fontSize: 16,
        }}>
          <span>6:16 PM</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill="currentColor"/><rect x="5" y="5" width="3" height="6" rx="0.6" fill="currentColor"/><rect x="10" y="2" width="3" height="9" rx="0.6" fill="currentColor"/><rect x="15" y="0" width="3" height="11" rx="0.6" fill="currentColor"/></svg>
            <svg width="16" height="11" viewBox="0 0 17 12"><path d="M8.5 3C10.8 3 12.9 3.9 14.4 5.4L15.5 4.3C13.7 2.5 11.2 1.3 8.5 1.3C5.8 1.3 3.3 2.5 1.5 4.3L2.6 5.4C4.1 3.9 6.2 3 8.5 3Z" fill="currentColor"/><path d="M8.5 6.6C9.9 6.6 11.1 7.1 12 8L13.1 6.9C11.8 5.7 10.2 4.9 8.5 4.9C6.8 4.9 5.2 5.7 3.9 6.9L5 8C5.9 7.1 7.1 6.6 8.5 6.6Z" fill="currentColor"/><circle cx="8.5" cy="10.3" r="1.4" fill="currentColor"/></svg>
            <svg width="26" height="12" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" strokeOpacity=".4" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/></svg>
          </div>
        </div>
        <div style={{ height: '100%', width: '100%', paddingTop: 0, position: 'relative' }}>
          {children}
        </div>
        {/* Home indicator */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          width: 134, height: 5, borderRadius: 99,
          background: dark ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.25)',
          zIndex: 60, pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

// ─── Bottom tab bar (Kalender · Vakter · ⊕ · Chat · Min Tid) ─────────────────
function TabBar({ active = 'kalender' }) {
  const go = (k) => {
    if (k === 'kalender' || k === 'vakter') window.__goTab && window.__goTab(k);
  };
  const tabs = [
    { k: 'kalender', label: 'KALENDER',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 10h18M8 2v4M16 2v4"/></svg> },
    { k: 'vakter', label: 'VAKTER',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></svg> },
    { k: 'plus', label: '', isPlus: true },
    { k: 'chat', label: 'CHAT',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { k: 'min', label: 'MIN TID',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></svg> },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      paddingBottom: 26, paddingTop: 10, paddingLeft: 12, paddingRight: 12,
      borderTop: `1px solid ${C.t.border}`,
      background: `color-mix(in oklab, ${C.t.bg} 92%, transparent)`,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
    }}>
      {tabs.map(t => {
        if (t.isPlus) {
          return (
            <button key={t.k} onClick={() => window.__openAdd && window.__openAdd()} style={{
              width: 56, height: 56, borderRadius: 999,
              background: C.t.orange, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(249,115,22,.45)', marginBottom: -4,
              fontFamily: 'inherit', border: 'none', cursor: 'pointer',
            }}>
              {/* logo flame mark from the screenshot */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 3c2.5 3 6 5 6 9a6 6 0 1 1-12 0c0-1.7.7-2.7 2-4-.3 1.5.5 2.5 1.5 2.5 1.5 0 2-1.5 2-3 0-2-.5-3-1-4 1.5.5 2.5 1.5 1.5-.5z" fill="#fff"/>
              </svg>
            </button>
          );
        }
        const isActive = t.k === active;
        return (
          <button key={t.k} onClick={() => go(t.k)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
            color: isActive ? C.t.orange : C.t.muted,
            fontFamily: 'inherit', minWidth: 60,
          }}>
            {t.icon}
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>{t.label}</span>
            {isActive && <div style={{ width: 4, height: 4, borderRadius: 99, background: C.t.orange }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Top header ──────────────────────────────────────────────────────────────
function CalHeader({ title = 'Kalender', onPlus = true, onSearch = false }) {
  return (
    <div style={{
      paddingTop: 56, padding: '56px 18px 4px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', height: 88, boxSizing: 'border-box',
    }}>
      <div style={{ fontFamily: C.t.serif, fontSize: 22, letterSpacing: '-0.01em' }}>{title}</div>
      <button onClick={() => window.__openAdd && window.__openAdd()} style={{
        position: 'absolute', right: 14, top: 60,
        width: 30, height: 30, borderRadius: 99, color: C.t.orange,
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  );
}

// ─── View toggle (Uke / Måned) ───────────────────────────────────────────────
function ViewToggle({ value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', padding: 3, borderRadius: 999,
      background: C.t.surface2, border: `1px solid ${C.t.border}`,
    }}>
      {['Uke', 'Måned'].map(v => (
        <button key={v} onClick={() => onChange?.(v)} style={{
          padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
          background: value === v ? C.t.orange : 'transparent',
          color: value === v ? '#fff' : C.t.muted,
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          minWidth: 56,
        }}>{v}</button>
      ))}
    </div>
  );
}

// ─── Filter chip row ─────────────────────────────────────────────────────────
function FilterChips({ value, onChange, counts = {} }) {
  const opts = [
    { k: 'alt', label: 'Alt' },
    { k: 'oppgaver', label: 'Oppgaver' },
    { k: 'vakter', label: 'Vakter' },
    { k: 'bookinger', label: 'Bookinger' },
    { k: 'avvik', label: 'Avvik' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '0 16px 4px', overflowX: 'auto',
      scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
    }}>
      {opts.map(o => {
        const active = value === o.k;
        return (
          <button key={o.k} onClick={() => onChange?.(o.k)} style={{
            padding: '8px 14px', borderRadius: 999,
            background: active ? C.t.orange : C.t.surface2,
            color: active ? '#fff' : C.t.fgSoft,
            border: `1px solid ${active ? C.t.orange : C.t.border}`,
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {o.label}
            {counts[o.k] != null && (
              <span style={{
                fontFamily: C.t.mono, fontSize: 10.5, opacity: .7,
              }}>{counts[o.k]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Week strip (Mon … Sun selector) ─────────────────────────────────────────
function WeekStrip({ days, selected, onSelect, today }) {
  return (
    <div style={{ padding: '0 12px 14px', display: 'flex', justifyContent: 'space-between', gap: 4 }}>
      {days.map(d => {
        const isSel = d.date === selected;
        const isToday = d.date === today;
        return (
          <button key={d.date} onClick={() => onSelect?.(d.date)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: '10px 0 10px',
            background: isSel ? C.t.orange : 'transparent',
            border: isSel ? 'none' : `1px solid transparent`,
            borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
            color: isSel ? '#fff' : C.t.fgSoft,
            position: 'relative',
          }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: 1.3,
              color: isSel ? 'rgba(255,255,255,.9)' : C.t.muted,
            }}>{d.dayShort}</span>
            <span style={{
              fontFamily: C.t.serif, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1,
            }}>{d.date}</span>
            {isToday && !isSel && (
              <div style={{ width: 4, height: 4, borderRadius: 99, background: C.t.orange, position: 'absolute', bottom: 4 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Item row (used across week view + day list) ─────────────────────────────
function ItemCard({ it, onTap }) {
  const colorOf = {
    shift:   C.t.orange,
    task:    C.t.warning,
    booking: C.t.info,
    deviation: C.t.error,
    note:    C.t.muted,
  };
  const isOverdue = it.status === 'overdue';
  const isDone = it.status === 'done' || it.status === 'completed';
  const accent = isOverdue ? C.t.error : (C.DEPTS_COLOR?.[it.dept] || colorOf[it.type]);
  const deptColor = ({ kjokken: C.t.kjokken, sal: C.t.sal, bar: C.t.bar, event: C.t.event })[it.dept] || C.t.muted;

  let icon;
  if (it.type === 'shift') icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
  );
  else if (it.type === 'booking') icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  );
  else if (isOverdue) icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  );
  else if (it.type === 'task') icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  );
  else icon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>;

  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '14px 14px', background: C.t.surface, border: `1px solid ${C.t.border}`,
      borderLeft: isOverdue ? `3px solid ${C.t.error}` : `1px solid ${C.t.border}`,
      borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
      color: 'inherit', textAlign: 'left',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `color-mix(in oklab, ${accent} 14%, transparent)`,
        color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14.5, fontWeight: 600,
          color: isOverdue ? C.t.error : C.t.fg,
          marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{it.title}</div>
        <div style={{
          fontSize: 12, color: C.t.muted, display: 'flex', gap: 6, alignItems: 'center',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {it.time && <span style={{ fontFamily: C.t.mono, color: C.t.fgSoft }}>{it.time}</span>}
          {it.time && it.sub && <span style={{ opacity: .5 }}>·</span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</span>
        </div>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.t.muted} strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  );
}

// ─── Section label ───────────────────────────────────────────────────────────
function SectionLabel({ children, right }) {
  return (
    <div style={{
      padding: '6px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: C.t.muted, textTransform: 'uppercase' }}>{children}</div>
      {right}
    </div>
  );
}

Object.assign(window, { Phone, TabBar, CalHeader, ViewToggle, FilterChips, WeekStrip, ItemCard, SectionLabel });
