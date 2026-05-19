// Shared Smartout Nordic Split primitives (web + mobile)

const SO = {
  orange: '#f97316',
  orangeLight: '#fb923c',
  orangeDark: '#c2410c',
  purple: '#8b5cf6',
  success: '#11ad32',
  warning: '#c18200',
  error: '#e7000b',
  info: '#2784d5',
  bg: '#fdfcfa',
  fg: '#1c1814',
  card: '#fdfcfa',
  secondary: '#f5f3f0',
  muted: '#7a756e',
  border: '#e8e5e1',
  brandDark: '#1a1510',
  brandDark2: '#25201a',
};

/* Icons — minimal Lucide-style inline SVG */
function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.75, style = {} }) {
  const paths = {
    mail: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></>,
    lock: <><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeoff: <><path d="m3 3 18 18"/><path d="M10.5 10.7a2 2 0 0 0 2.8 2.8"/><path d="M9.4 5.4A10 10 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-2.7 3.5"/><path d="M6.7 6.7A15 15 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.3-.9"/></>,
    check: <path d="m5 12 5 5L20 7"/>,
    checkcircle: <><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></>,
    alert: <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    send: <><path d="m22 2-11 11"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7M14 21h3"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    arrowleft: <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    users: <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a7 7 0 0 0-5-6.7"/></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.5 2.5a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.4 2.5.5a2 2 0 0 1 1.7 2Z"/>,
    build: <><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>,
    sparkles: <><path d="m12 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/><path d="M19 13.5 20 16l2.5 1L20 18l-1 2.5L18 18l-2.5-1L18 16Z"/></>,
    home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    chevrondown: <path d="m6 9 6 6 6-6"/>,
    x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    google: <path d="M21.35 11.1h-9.17v2.82h5.27c-.23 1.54-1.7 4.52-5.27 4.52-3.17 0-5.76-2.63-5.76-5.86 0-3.23 2.59-5.86 5.76-5.86 1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.84 3.91 14.8 3 12.18 3 7.18 3 3.12 7.03 3.12 12s4.06 9 9.06 9c5.23 0 8.7-3.67 8.7-8.84 0-.6-.07-1.05-.18-1.06Z" fill="currentColor"/>,
    upload: <><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></>,
    download: <><path d="M12 15V3"/><path d="m17 10-5 5-5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></>,
    dept: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
  };
  const p = paths[name];
  if (!p) return null;
  const filled = name === 'google';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {p}
    </svg>
  );
}

/* Smartout wordmark */
function Wordmark({ size = 22, color = 'currentColor' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color }}>
      <div style={{ width: size * 1.1, height: size * 1.1, borderRadius: size * 0.28, background: SO.orange, display: 'grid', placeItems: 'center', boxShadow: '0 2px 10px rgba(249,115,22,0.35)' }}>
        <div style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.12, background: '#fff' }} />
      </div>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: size * 1.1, letterSpacing: '-0.02em', lineHeight: 1 }}>
        Smartout
      </div>
    </div>
  );
}

/* Badge */
function Badge({ tone = 'neutral', children, size = 'md' }) {
  const tones = {
    neutral: { bg: '#ece9e3', fg: '#595550' },
    pending: { bg: '#ece9e3', fg: '#595550' },
    opened:  { bg: 'rgba(39,132,213,0.12)', fg: '#1f5f96' },
    accepted:{ bg: 'rgba(17,173,50,0.12)', fg: '#0a7a22' },
    expired: { bg: 'rgba(193,130,0,0.14)', fg: '#8a5d00' },
    cancel:  { bg: 'rgba(231,0,11,0.1)', fg: '#9a000a' },
    brand:   { bg: 'rgba(249,115,22,0.12)', fg: '#c2410c' },
    trainee: { bg: 'rgba(39,132,213,0.12)', fg: '#1f5f96' },
    active:  { bg: 'rgba(17,173,50,0.12)', fg: '#0a7a22' },
  };
  const t = tones[tone] || tones.neutral;
  const pad = size === 'sm' ? '2px 7px' : '3px 10px';
  const fs = size === 'sm' ? 10 : 11;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: 9999,
      fontSize: fs, fontWeight: 600, letterSpacing: '0.05em',
      textTransform: 'uppercase',
      background: t.bg, color: t.fg,
      fontFamily: SO.fontSans,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 9999, background: t.fg, opacity: 0.8 }} />
      {children}
    </span>
  );
}

/* Input */
function Input({ label, hint, error, icon, right, type = 'text', placeholder, value, readOnly, locked, mono }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div>
      {label && <div style={{ fontSize: 13, fontWeight: 500, color: SO.fg, marginBottom: 6 }}>{label}</div>}
      <div style={{
        display: 'flex', alignItems: 'center',
        height: 44, padding: '0 12px',
        background: locked ? SO.secondary : SO.bg,
        border: `1px solid ${error ? SO.error : (focus ? SO.orange : SO.border)}`,
        borderRadius: 12,
        boxShadow: focus && !error ? '0 0 0 3px rgba(249,115,22,0.18)' : 'none',
        transition: 'all 180ms',
        gap: 10,
      }}>
        {icon && <Icon name={icon} size={16} color={SO.muted} />}
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          placeholder={placeholder}
          style={{
            flex: 1, height: '100%', border: 'none', outline: 'none',
            background: 'transparent', color: SO.fg,
            fontFamily: mono ? 'Geist Mono, ui-monospace, monospace' : 'inherit',
            fontSize: 15,
          }}
        />
        {right}
      </div>
      {hint && !error && <div style={{ fontSize: 12, color: SO.muted, marginTop: 6 }}>{hint}</div>}
      {error && <div style={{ fontSize: 12, color: SO.error, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="alert" size={12} />{error}</div>}
    </div>
  );
}

/* Button */
function Button({ variant = 'primary', children, icon, right, block, size = 'md', onClick, disabled }) {
  const styles = {
    primary: { bg: SO.orange, fg: '#fff', border: 'transparent', shadow: '0 2px 12px rgba(249,115,22,0.28)' },
    secondary: { bg: SO.secondary, fg: SO.fg, border: SO.border, shadow: 'none' },
    ghost: { bg: 'transparent', fg: SO.fg, border: 'transparent', shadow: 'none' },
    dark: { bg: '#1c1814', fg: '#fdfcfa', border: 'transparent', shadow: '0 2px 10px rgba(0,0,0,0.2)' },
    outline: { bg: 'transparent', fg: SO.fg, border: SO.border, shadow: 'none' },
  }[variant];
  const h = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: h, padding: size === 'sm' ? '0 14px' : '0 20px',
      borderRadius: 10,
      background: styles.bg, color: styles.fg,
      border: `1px solid ${styles.border}`,
      fontFamily: 'inherit', fontSize: size === 'sm' ? 13 : 14, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      boxShadow: styles.shadow,
      width: block ? '100%' : 'auto',
      transition: 'transform 150ms, box-shadow 200ms, background 200ms',
    }}>
      {icon && <Icon name={icon} size={16} />}
      {children}
      {right && <Icon name={right} size={16} />}
    </button>
  );
}

/* Tabs */
function Tabs({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: SO.secondary, borderRadius: 10, padding: 4, gap: 2 }}>
      {tabs.map(t => {
        const active = value === t.value;
        return (
          <button key={t.value} onClick={() => onChange && onChange(t.value)} style={{
            padding: '8px 14px',
            fontSize: 13, fontWeight: 500,
            borderRadius: 7,
            color: active ? SO.fg : SO.muted,
            background: active ? SO.bg : 'transparent',
            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            border: 'none', cursor: 'pointer',
            fontFamily: 'inherit',
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

/* Divider with text */
function DividerText({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: SO.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      <div style={{ flex: 1, height: 1, background: SO.border }} />
      <span>{children}</span>
      <div style={{ flex: 1, height: 1, background: SO.border }} />
    </div>
  );
}

/* Nordic Split layout (two panels) */
function NordicSplit({ brand, children, width = 1280, height = 820 }) {
  return (
    <div style={{ width, height, display: 'flex', background: SO.bg, fontFamily: 'Geist, system-ui, sans-serif', color: SO.fg }}>
      <div style={{
        flex: '0 0 44%',
        background: SO.brandDark,
        color: '#f0eeeb',
        position: 'relative',
        padding: 48,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(circle at 30% 35%, rgba(251,146,60,0.35), transparent 55%),' +
            'radial-gradient(circle at 72% 72%, rgba(249,115,22,0.22), transparent 60%),' +
            'radial-gradient(circle at 20% 90%, rgba(139,92,246,0.12), transparent 55%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {brand}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, overflow: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* Brand panel content */
function BrandPanelHero({ tagline = 'Employee readiness, built for skiftene som faktisk skjer.' }) {
  return (
    <>
      <Wordmark size={22} color="#f0eeeb" />
      <div>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 56, lineHeight: 1.02, letterSpacing: '-0.02em', color: '#f0eeeb', fontWeight: 400 }}>
          Et varmere<br/>skiftsystem.
        </div>
        <div style={{ marginTop: 20, fontSize: 15, lineHeight: 1.55, color: 'rgba(240,238,235,0.68)', maxWidth: 360 }}>
          {tagline}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(240,238,235,0.45)', letterSpacing: '0.04em' }}>
        NORDIC SPLIT · v2026.04
      </div>
    </>
  );
}

Object.assign(window, { SO, Icon, Wordmark, Badge, Input, Button, Tabs, DividerText, NordicSplit, BrandPanelHero });
