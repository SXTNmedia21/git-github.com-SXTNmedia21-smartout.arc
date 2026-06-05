// Shared primitives for Smartout Helpdesk + Settings designs.
// Nordic Split tokens are loaded globally via tokens.css.

// ─── Lucide icons (inline SVG) ─────────────────────────────
const Icon = ({ name, size = 20, stroke = 1.75, style = {}, color }) => {
  const paths = {
    'chevron-left': 'M15 18l-6-6 6-6',
    'chevron-right': 'M9 18l6-6-6-6',
    'chevron-down': 'M6 9l6 6 6-6',
    'chevron-up': 'M18 15l-6-6-6 6',
    'x': 'M18 6L6 18M6 6l12 12',
    'check': 'M20 6L9 17l-5-5',
    'plus': 'M12 5v14M5 12h14',
    'more': 'M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z',
    'search': 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
    'send': 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    'settings': 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
    'lifebuoy': 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16a4 4 0 100-8 4 4 0 000 8zM4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M14.83 9.17l3.53-3.53M4.93 19.07l4.24-4.24',
    'alert-circle': 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 8v4M12 16h.01',
    'lock': 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
    'sparkles': 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
    'bell': 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
    'user': 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
    'users': 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    'home': 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
    'calendar': 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18',
    'message': 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
    'wallet': 'M20 12V8H6a2 2 0 010-4h12v4M4 6v12a2 2 0 002 2h14v-4M18 12a2 2 0 100 4h4v-4z',
    'book': 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z',
    'shield': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
    'logout': 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    'globe': 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z',
    'moon': 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
    'arrow-right': 'M5 12h14M12 5l7 7-7 7',
    'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
    'filter': 'M22 3H2l8 9.46V19l4 2v-8.54z',
    'inbox': 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z',
    'eye': 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
    'mic': 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
    'paperclip': 'M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48',
    'clock': 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
    'check-circle': 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
    'trash': 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2',
    'edit': 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
    'radio': 'M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0',
    'external': 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3',
    'menu': 'M3 12h18M3 6h18M3 18h18',
    'hash': 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
    'phone': 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z',
    'video': 'M23 7l-7 5 7 5zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z',
    'smile': 'M12 22a10 10 0 100-20 10 10 0 000 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
    'arrow-up': 'M12 19V5M5 12l7-7 7 7',
    'camera': 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
    'image': 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
    'list-checks': 'M11 5h10M11 12h10M11 19h10M3 5l2 2 3-3M3 12l2 2 3-3M3 19l2 2 3-3',
    'map-pin': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
    'book-open': 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z',
    'clipboard-list': 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1zM12 11h4M12 16h4M8 11h.01M8 16h.01',
    'calendar-clock': 'M21 7.5V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h4M16 2v4M8 2v4M3 10h18M17.5 22a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM17.5 17.5V19l1 1',
    'message-circle': 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
    'pin': 'M12 17v5M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V7a1 1 0 011-1 2 2 0 00-2-2h-4a2 2 0 00-2 2 1 1 0 011 1z',
    'bell-off': 'M13.73 21a2 2 0 01-3.46 0M18.63 13A17.89 17.89 0 0118 8M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14M18 8a6 6 0 00-9.33-5M1 1l22 22',
    'play': 'M5 3l14 9-14 9z',
    'utensils-crossed': 'M16 2l6 6M2 16l6 6M11 11l6-6c1.5-1.5 4-1.5 5.5 0 1.5 1.5 1.5 4 0 5.5L16.5 16M7 13l4 4M3 3l5 5M5 11c-2 2-2 5 0 7l1 1 7-7',
    'wine': 'M8 22h8M12 11v11M6 2h12l-1 9a5 5 0 01-10 0z',
    'bell-ring': 'M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M13.73 21a2 2 0 01-3.46 0M2 8c0-2.2.7-4.3 2-6M22 8a10 10 0 00-2-6',
    'reply': 'M9 17l-5-5 5-5M4 12h9a6 6 0 016 6v2',
    'mic-off': 'M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8',
    'user-plus': 'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6',
  };
  const d = paths[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || 'currentColor'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}>
      <path d={d} />
    </svg>
  );
};

// ─── Responsibility Orb (warm radial) ───────────────────────
const Orb = ({ size = 48, status = 'waiting', pulse = false, withCheck = false }) => {
  const chroma = status === 'active' ? 0.12 : status === 'complete' ? 0.04 : 0.08;
  const bg = `radial-gradient(circle at 45% 35%,
    oklch(0.82 ${chroma} 50) 0%,
    oklch(0.72 ${chroma * 0.7} 50 / 0.75) 35%,
    oklch(0.62 ${chroma * 0.4} 50 / 0.35) 60%,
    transparent 75%)`;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: bg,
        filter: 'blur(1px)',
        animation: pulse ? 'orb-pulse 2.8s ease-in-out infinite' : undefined,
      }} />
      {withCheck && (
        <div style={{ position: 'relative', zIndex: 1, color: 'var(--foreground)', opacity: 0.85 }}>
          <Icon name="check" size={size * 0.42} stroke={2.25} />
        </div>
      )}
    </div>
  );
};

// ─── Lighthouse avatar (avatar ringed by soft orb) ──────────
const LighthouseAvatar = ({ name, size = 56, src, halo = 'idle' }) => {
  const initials = name ? name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase() : '?';
  const haloSize = size * 1.5;
  const chroma = halo === 'waiting' ? 0.10 : halo === 'active' ? 0.12 : 0.06;
  return (
    <div style={{ position: 'relative', width: haloSize, height: haloSize, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `radial-gradient(circle at 45% 40%,
          oklch(0.80 ${chroma} 50 / 0.55) 0%,
          oklch(0.70 ${chroma * 0.6} 50 / 0.25) 45%,
          transparent 70%)`,
        filter: 'blur(2px)',
      }} />
      <div style={{
        position: 'relative', width: size, height: size, borderRadius: '50%',
        background: src ? `#d6cfc2 url(${src}) center/cover` : 'linear-gradient(135deg, oklch(0.72 0.08 50), oklch(0.55 0.12 35))',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: size * 0.36,
        boxShadow: '0 1px 2px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.2)',
      }}>
        {!src && initials}
      </div>
    </div>
  );
};

// Plain avatar (no halo)
const Avatar = ({ name, size = 32, src, ring = true }) => {
  const initials = name ? name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase() : '?';
  const palette = [
    ['#d4814d', '#a85a2c'],
    ['#7b8b9a', '#4e5c6a'],
    ['#c9a87c', '#947446'],
    ['#8a6f8e', '#604a64'],
    ['#86a386', '#5d7d5d'],
  ];
  const hash = (name || '').split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  const [a, b] = palette[hash % palette.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: src ? `#d6cfc2 url(${src}) center/cover` : `linear-gradient(135deg, ${a}, ${b})`,
      color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: Math.max(10, size * 0.38),
      boxShadow: ring ? 'inset 0 0 0 1px rgba(255,255,255,0.2)' : 'none',
      border: ring ? '1px solid var(--border)' : 'none',
      flexShrink: 0,
      letterSpacing: 0,
    }}>
      {!src && initials}
    </div>
  );
};

// ─── Status pill (uppercase mono label) ─────────────────────
const StatusLabel = ({ status }) => {
  const map = { waiting: 'VENTER', active: 'AKTIV', complete: 'LØST' };
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11, fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: 'var(--muted-fg)',
    }}>{map[status]}</span>
  );
};

// ─── Switch ─────────────────────────────────────────────────
const Switch = ({ on, size = 'md' }) => {
  const w = size === 'sm' ? 30 : 36, h = size === 'sm' ? 18 : 20, k = h - 4;
  return (
    <span style={{
      width: w, height: h, borderRadius: 9999,
      background: on ? 'var(--brand-orange)' : 'var(--border)',
      position: 'relative', display: 'inline-block',
      transition: 'background 180ms var(--ease-primary)',
      flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? w - k - 2 : 2,
        width: k, height: k, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 180ms var(--ease-primary)',
      }} />
    </span>
  );
};

// ─── Radio dot ──────────────────────────────────────────────
const Radio = ({ on }) => (
  <span style={{
    width: 18, height: 18, borderRadius: '50%',
    border: `1.5px solid ${on ? 'var(--brand-orange)' : 'var(--border)'}`,
    background: on ? 'var(--brand-orange)' : 'transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 180ms var(--ease-primary)',
  }}>
    {on && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
  </span>
);

// ─── Buttons ────────────────────────────────────────────────
const Btn = ({ children, variant = 'default', size = 'md', icon, style = {}, ...rest }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontFamily: 'var(--font-body)', fontWeight: 600,
    border: '1px solid transparent', cursor: 'pointer', userSelect: 'none',
    borderRadius: 10, transition: 'all 180ms var(--ease-primary)',
  };
  const sizes = {
    sm: { height: 30, padding: '0 10px', fontSize: 13 },
    md: { height: 38, padding: '0 14px', fontSize: 14 },
    lg: { height: 48, padding: '0 20px', fontSize: 15 },
  };
  const variants = {
    default: { background: 'var(--brand-orange)', color: '#fff', boxShadow: '0 2px 12px rgba(249,115,22,0.25)' },
    outline: { background: 'transparent', color: 'var(--foreground)', borderColor: 'var(--border)' },
    ghost: { background: 'transparent', color: 'var(--foreground)' },
    subtle: { background: 'var(--muted)', color: 'var(--foreground)' },
  };
  return (
    <button style={{ ...base, ...sizes[size], ...variants[variant], ...style }} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
};

// ─── Norsk copy helpers ─────────────────────────────────────
const Pill = ({ children, tone = 'muted' }) => {
  const tones = {
    muted: { bg: 'var(--muted)', fg: 'var(--foreground)' },
    brand: { bg: 'oklch(0.65 0.22 40 / 0.10)', fg: 'var(--brand-orange-dark)' },
    success: { bg: 'oklch(0.68 0.15 145 / 0.10)', fg: 'oklch(0.45 0.15 145)' },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 9999,
      fontFamily: 'var(--font-mono)', fontSize: 11,
      background: t.bg, color: t.fg,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
};

// Add orb-pulse keyframes
if (typeof document !== 'undefined' && !document.getElementById('orb-keyframes')) {
  const s = document.createElement('style');
  s.id = 'orb-keyframes';
  s.textContent = `
    @keyframes orb-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.06); opacity: 0.82; }
    }
    .noise-overlay {
      position: relative;
    }
    .noise-overlay::after {
      content: ""; position: absolute; inset: 0; pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='2' seed='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E");
      opacity: 0.025; mix-blend-mode: overlay;
    }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { Icon, Orb, LighthouseAvatar, Avatar, StatusLabel, Switch, Radio, Btn, Pill });
