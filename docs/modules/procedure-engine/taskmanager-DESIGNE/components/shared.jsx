// Shared UI components and helpers for SmartOut Task Manager

const { useState, useEffect, useMemo, useRef } = React;

// === Avatar ===
function Avatar({ user, size = 28, border = false }) {
  if (!user) return null;
  const u = typeof user === 'string' ? window.SmartoutData.USERS[user] : user;
  if (!u) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: u.color, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600,
      letterSpacing: '0.02em',
      flexShrink: 0,
      border: border ? '2px solid var(--bg)' : 'none',
      boxSizing: 'border-box',
    }}>{u.initials}</div>
  );
}

// === Origin badge ===
function OriginBadge({ origin }) {
  const o = window.SmartoutData.ORIGIN[origin];
  if (!o) return null;
  return (
    <span className="origin-badge" style={{ color: o.color, background: o.bg }}>{o.label}</span>
  );
}

// === Priority dot ===
function PriorityDot({ priority }) {
  const p = window.SmartoutData.PRIORITY[priority];
  return (
    <span className="prio-dot" style={{ background: p.color }} title={p.label} />
  );
}

// === Icons (inline SVG) ===
const Icon = ({ name, size = 18, color = 'currentColor', strokeWidth = 1.6 }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'check': return <svg {...props}><polyline points="20 6 9 17 4 12" /></svg>;
    case 'plus': return <svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>;
    case 'play': return <svg {...props} fill={color}><polygon points="6 4 20 12 6 20 6 4" stroke="none" /></svg>;
    case 'arrow-right': return <svg {...props}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
    case 'arrow-left': return <svg {...props}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
    case 'chevron-right': return <svg {...props}><polyline points="9 18 15 12 9 6" /></svg>;
    case 'chevron-down': return <svg {...props}><polyline points="6 9 12 15 18 9" /></svg>;
    case 'close': return <svg {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case 'flame': return <svg {...props}><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" /></svg>;
    case 'home': return <svg {...props}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
    case 'list': return <svg {...props}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>;
    case 'folder': return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
    case 'book': return <svg {...props}><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" /><path d="M4 17a3 3 0 0 1 3-3h12" /></svg>;
    case 'user': return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case 'pin': return <svg {...props}><path d="M12 2v8" /><path d="M8 10h8l-2 4 2 4H8l2-4z" /></svg>;
    case 'paperclip': return <svg {...props}><path d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" /></svg>;
    case 'image': return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>;
    case 'video': return <svg {...props}><rect x="2" y="6" width="14" height="12" rx="2" /><polygon points="16 10 22 7 22 17 16 14" /></svg>;
    case 'message': return <svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case 'bell': return <svg {...props}><path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16z" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>;
    case 'mappin': return <svg {...props}><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case 'tag': return <svg {...props}><path d="M3 12V3h9l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.2" fill={color} /></svg>;
    case 'shield': return <svg {...props}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" /></svg>;
    case 'sparkles': return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" /></svg>;
    case 'menu': return <svg {...props}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>;
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>;
    case 'filter': return <svg {...props}><polygon points="22 3 2 3 10 13 10 20 14 22 14 13" /></svg>;
    case 'camera': return <svg {...props}><path d="M3 9a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></svg>;
    case 'pen': return <svg {...props}><path d="M16 3l5 5-12 12H4v-5z" /></svg>;
    case 'more': return <svg {...props}><circle cx="6" cy="12" r="1.5" fill={color} /><circle cx="12" cy="12" r="1.5" fill={color} /><circle cx="18" cy="12" r="1.5" fill={color} /></svg>;
    case 'circle': return <svg {...props}><circle cx="12" cy="12" r="9" /></svg>;
    case 'circle-check': return <svg {...props}><circle cx="12" cy="12" r="9" /><polyline points="8 12 11 15 16 9" /></svg>;
    default: return null;
  }
};

// === Format helpers ===
function priorityRank(t) { return window.SmartoutData.PRIORITY[t.priority].order; }
function statusRank(s) { return ({ overdue: 0, inprogress: 1, awaiting: 2, todo: 3, done: 4 })[s] ?? 5; }
function timeToMinutes(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return 9999;
  const [h, m] = t.split(':').map(Number); return h * 60 + m;
}
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (statusRank(a.status) !== statusRank(b.status)) return statusRank(a.status) - statusRank(b.status);
    if (priorityRank(a) !== priorityRank(b)) return priorityRank(a) - priorityRank(b);
    return timeToMinutes(a.deadline) - timeToMinutes(b.deadline);
  });
}

Object.assign(window, { Avatar, OriginBadge, PriorityDot, Icon, sortTasks, priorityRank, statusRank });
