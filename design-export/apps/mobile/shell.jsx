// =============================================================================
// Smartout Mobile — SHELL
// Phone canvas + topbar + bottom tab bar + router + mode switch + theme + toast
// + Mr. Botsson bottom sheet. Pages register into window.SO_M_PAGES[route].
// Reuses the shared design system (../web/shared/styles.css) and data (../web/shared/data.js).
// Exposes: window.MIc, window.useM, window.M (helpers), window.__SmartoutMobileBoot
// =============================================================================
const { useState, useEffect, useRef, createContext, useContext, useCallback } = React;
const D = window.SmartoutData;

// ---------- icon set (Lucide-style strokes, lifted from web shell) ----------
const ICONS = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  checklist:'<path d="M11 6h10M11 12h10M11 18h10"/><path d="M3 6l1.5 1.5L7 4"/><path d="M3 12l1.5 1.5L7 10"/><path d="M3 18l1.5 1.5L7 16"/>',
  message:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bell:'<path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  bot:'<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  clock:'<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
  mappin:'<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  chevRight:'<polyline points="9 18 15 12 9 6"/>',
  chevLeft:'<polyline points="15 18 9 12 15 6"/>',
  chevDown:'<polyline points="6 9 12 15 18 9"/>',
  sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  wallet:'<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12.5h3"/><path d="M2 9h14a2 2 0 0 1 2 2v0"/>',
  shield:'<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
  cap:'<path d="M22 9 12 5 2 9l10 4 10-4z"/><path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5"/>',
  thermometer:'<path d="M14 14V5a2 2 0 0 0-4 0v9a4 4 0 1 0 4 0z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.6 14H2.5a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4.5a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8z"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  swap:'<polyline points="17 2 21 6 17 10"/><path d="M3 6h18"/><polyline points="7 22 3 18 7 14"/><path d="M21 18H3"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  arrowRight:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  trendUp:'<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  flag:'<path d="M4 21V4h12l-2 4 2 4H4"/>',
  camera:'<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.2"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9"/>',
  route:'<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3.5V8h4.5"/><path d="M12 8v4.5l3 1.8"/>',
  building:'<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01"/><path d="M10 21v-3a2 2 0 0 1 4 0v3"/>',
  send:'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  bag:'<path d="M6 7V6a6 6 0 0 1 12 0v1"/><path d="M4 7h16l-1 13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/>',
  coffee:'<path d="M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h2a2 2 0 0 1 0 5h-2"/><path d="M7 4v2M11 4v2"/>',
  heart:'<path d="M12 20s-7-4.6-9.2-9A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9.2 5C19 15.4 12 20 12 20z"/>',
  fire:'<path d="M12 3c1 3-1 4-1 6a3 3 0 0 0 5 2c1 3-1 7-4 7a5 5 0 0 1-5-5c0-4 4-5 5-10z"/>',
  pin:'<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><line x1="12" y1="15" x2="12" y2="21"/>',
  search:'<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l2 5v3a1 1 0 0 1-1.1 1A17 17 0 0 1 4 5 1 1 0 0 1 5 4z"/>',
  video:'<rect x="2" y="5" width="14" height="14" rx="2.5"/><path d="M16 10l6-3v10l-6-3z"/>',
  paperclip:'<path d="M21 11l-8.5 8.5a4 4 0 0 1-6-6L14 5a2.5 2.5 0 0 1 4 4l-8 8a1 1 0 0 1-1.5-1.5l7.5-7.5"/>',
  bookOpen:'<path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5 1.5-1.5 4-2 8-1.5V5c-4-.5-6.5 0-8 1.5z"/><path d="M12 6.5V20"/>',
  download:'<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M5 21h14"/>',
  badge:'<path d="M12 2l2.3 1.7 2.9.2.9 2.8 2.2 1.8-1 2.8 1 2.8-2.2 1.8-.9 2.8-2.9.2L12 22l-2.3-1.7-2.9-.2-.9-2.8L3.7 15.7l1-2.8-1-2.8 2.2-1.8.9-2.8 2.9-.2z"/><polyline points="9 12 11 14 15 10"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M12 8v13"/><path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5zM12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5z"/>',
  zap:'<polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2"/>',
  utensils:'<path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><line x1="6" y1="12" x2="6" y2="21"/><path d="M17 3c-1.7 0-3 2-3 5s1 4 3 4v9"/>',
  repeat:'<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  bars:'<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="18" y1="20" x2="18" y2="9"/>',
  circle:'<circle cx="12" cy="12" r="9"/>',
  checkCircle:'<circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 16 9"/>',
  lifebuoy:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/><path d="M5.1 5.1l3.4 3.4M15.5 15.5l3.4 3.4M18.9 5.1l-3.4 3.4M8.5 15.5l-3.4 3.4"/>',
  reply:'<polyline points="9 17 4 12 9 7"/><path d="M4 12h11a4 4 0 0 1 4 4v2"/>',
  calClock:'<path d="M21 9.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="18" cy="17" r="4"/><path d="M18 15.5V17l1 1"/>',
  planeOff:'<path d="M10.6 5.6 7 4l-1 1 3 3-3 2H3l-1 1 3 2 2 3 1-1v-3l2-3 3 3 1-1-1.6-3.6"/>',
  pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play:'<polygon points="6 4 20 12 6 20 6 4"/>',
  fingerprint:'<path d="M12 11a2 2 0 0 0-2 2c0 2 .5 4 1 5"/><path d="M8 9a5 5 0 0 1 8 1c.4 2.5 0 5-1 7"/><path d="M5 11a7 7 0 0 1 13-2"/><path d="M12 13c0 3 .5 5 1.5 7"/>',
  bellOff:'<path d="M8.7 6.3A6 6 0 0 1 18 11v5M6 11v5l-2 2h13"/><path d="M10 21a2 2 0 0 0 4 0"/><line x1="3" y1="3" x2="21" y2="21"/>',
  chevUp:'<polyline points="6 15 12 9 18 15"/>',
  thumbsDown:'<path d="M17 2H5.7a2 2 0 0 0-2 1.7l-1.4 9A2 2 0 0 0 4.3 15H10v5a2 2 0 0 0 4 0l3-7z"/><path d="M17 2h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3"/>',
  ban:'<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>',
  trash:'<path d="M4 7h16"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/>',
  star:'<polygon points="12 3 14.6 9 21 9.6 16 14 17.5 20.5 12 17 6.5 20.5 8 14 3 9.6 9.4 9"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M19 19H6a2 2 0 0 0-2 2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.7-2.5 2-2.5 3.5"/><path d="M12 17h.01"/>',
  checkdoc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><polyline points="9 14 11 16 15 12"/>',
  list:'<line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  user:'<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0z"/>',
};

function MIc({ n, s = 22, c = 'currentColor', sw = 2, style }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" style={style}
      dangerouslySetInnerHTML={{ __html: ICONS[n] || '' }} />
  );
}
window.MIc = MIc;

// ---------- helpers ----------
const fmtKr = (n) => new Intl.NumberFormat('nb-NO').format(Math.round(n));
const cls = (...xs) => xs.filter(Boolean).join(' ');
window.M = { fmtKr, cls, ICONS };

// ---------- persisted state ----------
const STORE = 'so_mobile_v1';
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function saveState(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch {} }

// ---------- app context ----------
const MCtx = createContext(null);
window.useM = () => useContext(MCtx);

// ---------- bottom-nav definition ----------
const TABS = [
  { id: 'kalender', label: 'Kalender', icon: 'calendar' },
  { id: 'vakter', label: 'Vakter', icon: 'users' },
  { id: 'hjem', label: 'Hjem', icon: 'home', center: true },
  { id: 'chat', label: 'Chat', icon: 'message', badgeKey: 'chat' },
  { id: 'mer', label: 'Mer', icon: 'grid' },
];
const TAB_TITLE = { hjem: 'Smartout', kalender: 'Kalender', vakter: 'Vakter', oppgaver: 'Oppgaver', chat: 'Meldinger', mer: 'Mer' };
// Sub-pages (not bottom tabs) — reached from the Hjem ActionBar / Mer. Topbar shows a back arrow.
const SUBPAGES = { oppgaver: 'Oppgaver', trening: 'Opplæring', kompetanse: 'Opplæring & kompetanse', sikkerhet: 'HMS', kartotek: 'HMS & Avvik', bookinger: 'Bookings & Event', lonn: 'Lønn & arbeid', handbok: 'Håndbøker' };
const isSub = (t) => Object.prototype.hasOwnProperty.call(SUBPAGES, t);

// ---------- Topbar ----------
function Topbar() {
  const { ME, mode, navigate, back, openBotsson, tab } = useM();
  if (isSub(tab)) {
    return (
      <header className="m-top">
        <button className="m-iconbtn" onClick={back} aria-label="Tilbake"><MIc n="chevLeft" s={24} /></button>
        <div className="m-top-title">{SUBPAGES[tab]}</div>
        <button className="m-iconbtn" onClick={openBotsson} aria-label="Mr. Botsson">
          <MIc n="bot" s={22} />
          <span className="m-dot" />
        </button>
      </header>
    );
  }
  return (
    <header className="m-top">
      <button className="m-iconbtn" onClick={() => navigate('mer')} aria-label="Profil og mer">
        <span className="m-avatar" style={{ background: ME.color }}>{ME.initials}</span>
      </button>
      <div className="m-top-title">
        {TAB_TITLE[tab] || 'Smartout'}
        {tab === 'hjem' && <small>{mode === 'admin' ? 'Bistro Nord · Drift' : 'Bistro Nord'}</small>}
      </div>
      <button className="m-iconbtn" onClick={openBotsson} aria-label="Mr. Botsson">
        <MIc n="bot" s={22} />
        <span className="m-dot" />
      </button>
    </header>
  );
}

// ---------- Bottom nav ----------
function BottomNav() {
  const { tab, navigate, badges, openAdd } = useM();
  const holdRef = useRef(null);
  const heldRef = useRef(false);
  const startHold = () => {
    heldRef.current = false;
    holdRef.current = setTimeout(() => { heldRef.current = true; openAdd(); }, 420);
  };
  const endHold = (doTap) => {
    if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null; }
    if (doTap && !heldRef.current) navigate('hjem');
  };
  return (
    <nav className="m-nav">
      {TABS.map(t => {
        const active = tab === t.id;
        const badge = t.badgeKey && badges[t.badgeKey];
        if (t.center) {
          return (
            <button key={t.id} className={cls('m-tab', 'm-tab-center', active && 'is-active')}
              onPointerDown={startHold}
              onPointerUp={() => endHold(true)}
              onPointerLeave={() => endHold(false)}
              onContextMenu={(e) => { e.preventDefault(); openAdd(); }}
              title="Trykk: Hjem · Hold inne: Hurtigvalg">
              <span className="m-brandbtn">
                <img className="m-brandbtn-img" src="assets/smartout-icon.png" alt="Smartout" draggable="false" />
              </span>
            </button>
          );
        }
        return (
          <button key={t.id} className={cls('m-tab', active && 'is-active')} onClick={() => navigate(t.id)}>
            <span className="m-tab-ic"><MIc n={t.icon} s={24} sw={active ? 2 : 1.5} /></span>
            {badge ? <span className="m-tab-badge">{badge}</span> : null}
            <span>{t.label}</span>
            <span className="m-tab-dot" />
          </button>
        );
      })}
    </nav>
  );
}

// Smartout brand mark (simplified swirl)
function SmartoutMark({ s = 24, color = 'var(--orange)' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M16.5 7.2C15 5.6 12.6 5 10.6 6.1 8.2 7.4 7.6 10.6 9.4 12.6c1.6 1.8 4.6 2 6 .2"
        stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7.5 16.8C9 18.4 11.4 19 13.4 17.9c2.4-1.3 3-4.5 1.2-6.5"
        stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}
window.SmartoutMark = SmartoutMark;

// ---------- Mr. Botsson bottom sheet ----------
const BOT_QUICK = [
  'Hva må jeg gjøre nå?',
  'Når er neste vakt?',
  'Bytt bort lørdagsvakten',
  'Oppsummer dagen',
];
function botReply(q) {
  const s = q.toLowerCase();
  if (s.includes('nå') || s.includes('gjøre'))
    return { text: 'Du har **2 oppgaver som haster**: Temperaturkontroll (32 min forsinket) og oppfølging av avvik #214 (frist 12:00). Vil du åpne temperaturkontrollen?', cta: 'Åpne temperaturkontroll', src: ['Oppgaver · IK-mat', 'Avvik #214'] };
  if (s.includes('vakt'))
    return { text: 'Neste vakt er **i morgen 14:00–22:00** (Servitør · Sal). Du har også en ledig bytte-forespørsel fra Selma på lørdag.', cta: 'Se vaktplan', src: ['Vaktplan uke 22'] };
  if (s.includes('bytt'))
    return { text: 'Jeg kan legge **lørdag 12:00–20:00** ut i vaktbørsen. 3 kolleger er ledige da. Jeg sender ikke før du bekrefter.', cta: 'Legg ut i vaktbørs', src: ['Vaktbørs', 'Tilgjengelighet'] };
  if (s.includes('oppsummer') || s.includes('dag'))
    return { text: 'I dag: **4 oppgaver** (2 haster), vakt 14:00–22:00, og 1 ulest kunngjøring om stort selskap i kveld. Omsetning ligger 8% over normalen.', cta: 'Se detaljer', src: ['Min dag', 'Kunngjøringer'] };
  return { text: 'Jeg er her for å hjelpe deg gjennom vakta. Spør meg om oppgaver, vakter, bytter eller lønn.', cta: null, src: [] };
}

function BotssonSheet({ onClose }) {
  const { toast } = useM();
  const [msgs, setMsgs] = useState([
    { who: 'bot', text: 'Hei Maria! Du er på vakt om litt. **2 oppgaver haster** — vil du at jeg viser dem?' },
  ]);
  const [val, setVal] = useState('');
  const bodyRef = useRef(null);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs]);
  const ask = (q) => {
    if (!q.trim()) return;
    const r = botReply(q);
    setMsgs(m => [...m, { who: 'me', text: q }, { who: 'bot', ...r }]);
    setVal('');
  };
  const md = (t) => t.split('**').map((p, i) => i % 2 ? <b key={i}>{p}</b> : p);
  return (
    <div className="m-sheet-scrim" onClick={onClose}>
      <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ height: '80%' }}>
        <div className="m-sheet-grip" />
        <div className="m-sheet-h">
          <span className="m-bot-ava"><MIc n="bot" s={18} /></span>
          <h3>Mr. Botsson</h3>
          <button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><MIc n="x" s={20} /></button>
        </div>
        <div className="m-sheet-body" ref={bodyRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} className={cls('m-msg', m.who === 'bot' ? 'm-msg-bot' : 'm-msg-me')}>
              <div>{md(m.text)}</div>
              {m.who === 'bot' && m.src && m.src.length > 0 && (
                <div className="m-bot-src" style={{ marginTop: 8, paddingTop: 8 }}>
                  {m.src.map((s, j) => (
                    <div key={j} className="m-src-row"><MIc n="sparkle" s={12} c="var(--orange)" /> {s}</div>
                  ))}
                </div>
              )}
              {m.who === 'bot' && m.cta && (
                <button className="m-btn m-btn-primary m-sm" style={{ marginTop: 10 }}
                  onClick={() => { toast(m.cta + ' åpnet'); onClose(); }}>{m.cta}</button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 4 }}>
            {BOT_QUICK.map(q => (
              <button key={q} className="m-pill m-pill-muted" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => ask(q)}>{q}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
          <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask(val)}
            placeholder="Spør Botsson…" style={{
              flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--secondary)',
              padding: '0 14px', fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--fg)', outline: 'none',
            }} />
          <button className="m-iconbtn" style={{ background: 'var(--orange)', color: '#fff', width: 44, height: 44, borderRadius: 12 }} onClick={() => ask(val)}>
            <MIc n="send" s={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Add / Hurtigvalg sheet (FAB long-press) ----------
const ADD_ACTIONS = [
  { id: 'task', icon: 'checklist', label: 'Ny oppgave', tone: 'orange' },
  { id: 'deviation', icon: 'alert', label: 'Meld avvik', tone: 'error' },
  { id: 'swap', icon: 'swap', label: 'Be om bytte', tone: 'info' },
  { id: 'message', icon: 'message', label: 'Ny melding', tone: 'success' },
  { id: 'availability', icon: 'calClock', label: 'Tilgjengelighet', tone: 'info' },
  { id: 'absence', icon: 'planeOff', label: 'Søk fravær', tone: 'muted' },
  { id: 'punch', icon: 'clock', label: 'Stemple inn', tone: 'orange' },
];
const ADD_TONE = {
  orange: ['var(--orange-soft)', 'var(--orange)'],
  error: ['color-mix(in oklab, var(--error) 12%, transparent)', 'var(--error)'],
  info: ['color-mix(in oklab, var(--info) 13%, transparent)', 'var(--info)'],
  success: ['color-mix(in oklab, var(--success) 13%, transparent)', 'var(--success)'],
  muted: ['var(--secondary)', 'var(--muted)'],
};
function AddSheet({ onClose }) {
  const { openBotsson, openOverlay, navigate } = useM();
  const KIND = { task: 'newtask', deviation: 'deviation', swap: 'shiftoffer', message: 'message', absence: 'absence', punch: 'punch' };
  const fire = (a) => {
    onClose();
    if (a.id === 'availability') navigate('kalender', { avail: true });
    else openOverlay(KIND[a.id] || null);
  };
  return (
    <div className="m-sheet-scrim" onClick={onClose}>
      <div className="m-sheet" onClick={e => e.stopPropagation()}>
        <div className="m-sheet-grip" />
        <div className="m-sheet-h">
          <h3>Hurtigvalg</h3>
          <button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><MIc n="x" s={20} /></button>
        </div>
        <div className="m-sheet-body">
          <div className="m-add-grid">
            {ADD_ACTIONS.map(a => {
              const [bg, fg] = ADD_TONE[a.tone];
              return (
                <button key={a.id} className="m-add-item" onClick={() => fire(a)}>
                  <span className="m-add-ic" style={{ background: bg, color: fg }}><MIc n={a.icon} s={22} /></span>
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
          <button className="m-add-bot" onClick={() => { onClose(); openBotsson(); }}>
            <span className="m-bot-ava"><MIc n="bot" s={17} /></span>
            <span className="m-add-bot-t">
              <b>Spør Mr. Botsson</b>
              <small>Beskriv hva du vil — så ordner jeg resten</small>
            </span>
            <MIc n="arrowRight" s={18} c="var(--orange)" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- App-level overlay router (drawers + takeovers) ----------
function AppOverlay({ overlay, close, navigate }) {
  const { kind, payload } = overlay;
  switch (kind) {
    case 'punch': return window.MPunchScreen ? <window.MPunchScreen shift={payload} onClose={close} /> : null;
    case 'vakt': return window.MVaktScreen ? <window.MVaktScreen shift={payload} onClose={close} /> : null;
    case 'kontroll': return window.MFormViewer ? <window.MFormViewer task={payload} onClose={close} /> : null;
    case 'profile': return window.MProfileScreen ? <window.MProfileScreen shift={payload} onClose={close} /> : null;
    case 'newtask': return window.MNewTaskDrawer ? <window.MNewTaskDrawer onClose={close} /> : null;
    case 'deviation': return window.MDeviationDrawer ? <window.MDeviationDrawer onClose={close} /> : null;
    case 'absence': return window.MAbsenceDrawer ? <window.MAbsenceDrawer onClose={close} /> : null;
    case 'shiftoffer': return window.MShiftOfferDrawer ? <window.MShiftOfferDrawer onClose={close} mode={payload && payload.mode} /> : null;
    case 'claim': return window.MShiftClaimDrawer ? <window.MShiftClaimDrawer offer={payload} onClose={close} /> : null;
    case 'message': return window.MNewMessageDrawer ? <window.MNewMessageDrawer onClose={close} onOpenChat={(id) => { close(); navigate('chat', { open: id }); }} /> : null;
    case 'settings': return window.MSettingsScreen ? <window.MSettingsScreen onClose={close} /> : null;
    case 'logout': return window.MLogoutConfirm ? <window.MLogoutConfirm onClose={close} /> : null;
    case 'payslip': return window.MPayslipScreen ? <window.MPayslipScreen shift={payload} onClose={close} /> : null;
    case 'announcement': return window.MAnnouncementSheet ? <window.MAnnouncementSheet shift={payload} onClose={close} /> : null;
    case 'doc': return window.MHandbookReader ? <window.MHandbookReader doc={(window.MDOCS && window.MDOCS[payload && payload.id]) || payload} onClose={close} /> : null;
    default: return null;
  }
}

// ---------- App ----------
// ---------- error boundary (keeps a render failure from blanking the app) ----------
class MErrBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { try { console.error('[Smartout] render error:', err); } catch (e) {} }
  render() {
    if (this.state.err) {
      return (
        <div className="m-vakt" role="alert">
          <div className="m-vakt-head">
            <button className="m-iconbtn" onClick={() => { this.setState({ err: null }); this.props.onClose && this.props.onClose(); }} aria-label="Lukk"><MIc n="chevDown" s={24} /></button>
            <div className="m-vakt-htitle">Beklager</div>
            <span />
          </div>
          <div className="m-vakt-body">
            <div className="m-card"><div className="m-empty" style={{ padding: 28 }}><MIc n="alert" s={28} /><b>Noe gikk galt her</b><p>Vi klarte ikke å vise denne siden akkurat nå. Gå tilbake og prøv igjen.</p></div></div>
            <button className="m-btn m-btn-primary m-btn-block" style={{ flexShrink: 0 }} onClick={() => { this.setState({ err: null }); this.props.onClose && this.props.onClose(); }}><MIc n="chevLeft" s={16} /> Tilbake</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MApp() {
  const init = loadState();
  const [tab, setTab] = useState('hjem'); // always launch on Hjem (don't restore last tab)
  const [mode, setMode] = useState(init.mode === 'admin' ? 'admin' : 'privat');
  const [theme, setTheme] = useState(init.theme === 'dark' ? 'dark' : 'light');
  const [toasts, setToasts] = useState([]);
  const [botOpen, setBotOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [overlay, setOverlay] = useState(null); // { kind, payload }
  const [session, setSession] = useState(() => { try { const s = JSON.parse(localStorage.getItem('so_m_shift')); return s && s.clockedIn ? s : { clockedIn: false }; } catch { return { clockedIn: false }; } });
  const histRef = useRef([]);
  const intentRef = useRef({});
  const scrollRef = useRef(null);

  useEffect(() => { saveState({ mode, theme }); }, [mode, theme]);
  useEffect(() => { try { localStorage.setItem('so_m_shift', JSON.stringify(session)); } catch {} }, [session]);
  // reflect theme on host doc too (so backdrop matches)
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const navigate = useCallback((t, intent) => {
    if (intent) intentRef.current[t] = intent;
    setTab(prev => {
      if (t !== prev) histRef.current.push(prev);
      return t;
    });
    setBotOpen(false);
    setAddOpen(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  // one-shot deep-link hint a page can read on mount (e.g. open Kunngjøringer in Chat)
  const takeIntent = useCallback((t) => {
    const v = intentRef.current[t];
    delete intentRef.current[t];
    return v;
  }, []);

  const back = useCallback(() => {
    const prev = histRef.current.pop();
    setTab(prev || 'hjem');
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const toast = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, ...opts }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts.duration || 3200);
  }, []);

  const ME = D.ME;
  const badges = { tasks: 2, chat: 3 };

  const ctx = {
    ME, mode, setMode, theme,
    toggleTheme: () => setTheme(th => th === 'dark' ? 'light' : 'dark'),
    tab, navigate, back, takeIntent,
    toast, badges,
    openBotsson: () => { setAddOpen(false); setBotOpen(true); },
    openAdd: () => { setBotOpen(false); setAddOpen(true); },
    openOverlay: (kind, payload) => { setBotOpen(false); setAddOpen(false); if (kind) setOverlay({ kind, payload }); },
    closeOverlay: () => setOverlay(null),
    session,
    clockIn: (info) => setSession({ clockedIn: true, inAt: Date.now(), info: info || {} }),
    clockOut: () => setSession({ clockedIn: false }),
  };

  const Page = (window.SO_M_PAGES && window.SO_M_PAGES[tab]) || (() => (
    <div className="m-page"><div className="m-empty"><b>Kommer snart</b><p>Denne fanen er ikke bygget ennå.</p></div></div>
  ));

  return (
    <MCtx.Provider value={ctx}>
      <div className="m-app" data-theme={theme}>
        <Topbar />
        {session.clockedIn && (!overlay || overlay.kind !== 'punch') && (
          <button className="m-onshift-bar" onClick={() => setOverlay({ kind: 'punch' })}>
            <span className="m-shift-live" /> <b>PÅ VAKT</b>
            <span className="m-onshift-since">Stemplet inn {new Date(session.inAt).getHours().toString().padStart(2, '0')}:{new Date(session.inAt).getMinutes().toString().padStart(2, '0')}</span>
            <span className="m-onshift-open">Åpne <MIc n="chevRight" s={14} /></span>
          </button>
        )}
        <div className="m-scroll" ref={scrollRef}>
          <MErrBoundary key={'page-' + tab} onClose={() => navigate('hjem')}><Page /></MErrBoundary>
        </div>
        <BottomNav />
        {toasts.length > 0 && (
          <div className="m-toast-wrap">
            {toasts.map(t => (
              <div key={t.id} className="m-toast">
                <MIc n="check" s={17} c="var(--orange-light)" />
                <span>{t.msg}</span>
                {t.undo && <button className="m-toast-undo" onClick={() => { t.undo(); setToasts(x => x.filter(y => y.id !== t.id)); }}>Angre</button>}
              </div>
            ))}
          </div>
        )}
        {botOpen && <BotssonSheet onClose={() => setBotOpen(false)} />}
        {addOpen && <AddSheet onClose={() => setAddOpen(false)} />}
        {overlay && <MErrBoundary key={'ov-' + overlay.kind} onClose={() => setOverlay(null)}><AppOverlay overlay={overlay} close={() => setOverlay(null)} navigate={navigate} /></MErrBoundary>}
        {window.MNotifLayer && <window.MNotifLayer />}
        {window.MNotifBoard && <window.MNotifBoard />}
      </div>
    </MCtx.Provider>
  );
}

window.__SmartoutMobileBoot = function () {
  ReactDOM.createRoot(document.getElementById('root')).render(<MApp />);
};
