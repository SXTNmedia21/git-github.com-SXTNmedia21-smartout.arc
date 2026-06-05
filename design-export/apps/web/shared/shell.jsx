// ===== Smartout unified app — shell (topbar · sidebar · router · toasts) =====
const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;

// ---------- icon set (Lucide-style strokes) ----------
const ICONS = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  list:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9"/>',
  shield:'<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
  wallet:'<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12.5h3"/><path d="M2 9h14a2 2 0 0 1 2 2v0"/>',
  checkdoc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 14l2 2 4-4"/>',
  chart:'<path d="M4 4v16h16"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
  message:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  hash:'<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>',
  inbox:'<path d="M3 12h5l2 3h4l2-3h5"/><path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
  remote:'<circle cx="12" cy="12" r="9"/><polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none"/>',
  search:'<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
  bell:'<path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  book:'<path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h12"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  chevDown:'<polyline points="6 9 12 15 18 9"/>',
  chevLeft:'<polyline points="15 18 9 12 15 6"/>',
  chevRight:'<polyline points="9 18 15 12 9 6"/>',
  chevUp:'<polyline points="18 15 12 9 6 15"/>',
  bot:'<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none"/>',
  video:'<rect x="2" y="5" width="14" height="14" rx="2.5"/><path d="M16 10l6-3v10l-6-3z"/>',
  play:'<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.6 14H2.5a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4.5a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  clock:'<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
  alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  mappin:'<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  camera:'<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.2"/>',
  arrowRight:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l2 5v3a1 1 0 0 1-1.1 1A17 17 0 0 1 4 5 1 1 0 0 1 5 4z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  trendUp:'<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.2 2.9M6.1 6.1A13.2 13.2 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4-.9"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><line x1="3" y1="3" x2="21" y2="21"/>',
  swap:'<polyline points="17 2 21 6 17 10"/><path d="M3 6h18"/><polyline points="7 22 3 18 7 14"/><path d="M21 18H3"/>',
  flag:'<path d="M4 21V4h12l-2 4 2 4H4"/>',
  thermometer:'<path d="M14 14V5a2 2 0 0 0-4 0v9a4 4 0 1 0 4 0z"/>',
  star:'<polygon points="12 2.5 15 9 22 9.7 16.5 14.3 18.3 21 12 17.2 5.7 21 7.5 14.3 2 9.7 9 9"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  heart:'<path d="M12 20s-7-4.6-9.2-9A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9.2 5C19 15.4 12 20 12 20z"/>',
  ban:'<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>',
  trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  pin:'<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><line x1="12" y1="15" x2="12" y2="21"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
  bellOff:'<path d="M8.7 4.2A6 6 0 0 1 18 9v5M6 9v5l-2 2h13"/><path d="M10 21a2 2 0 0 0 4 0"/><line x1="3" y1="3" x2="21" y2="21"/>',
  thumbsDown:'<path d="M10 15v4a2 2 0 0 0 4 0l-1-5h5a2 2 0 0 0 2-2.3l-1-6A2 2 0 0 0 20 2H8v13z"/><path d="M4 3h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4z"/>',
  link:'<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="M21 16l-5-5L5 21"/>',
  building:'<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01"/><path d="M10 21v-3a2 2 0 0 1 4 0v3"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  folderOpen:'<path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2H4z"/><path d="M3.5 9h17l-1.8 9.2a1 1 0 0 1-1 .8H6.3a1 1 0 0 1-1-.8z"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3.5V8h4.5"/><path d="M12 8v4.5l3 1.8"/>',
  download:'<path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 20h14"/>',
  filter:'<polygon points="3 4 21 4 14 12 14 19 10 21 10 12"/>',
  archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><line x1="10" y1="12" x2="14" y2="12"/>',
  pen:'<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  scale:'<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-2.5 6a3 3 0 0 0 5 0z"/><path d="M19 7l-2.5 6a3 3 0 0 0 5 0z"/><path d="M8 21h8"/>',
  cap:'<path d="M22 9 12 5 2 9l10 4 10-4z"/><path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5"/>',
  clipcheck:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/><path d="M9 14l2 2 4-4"/>',
  sliders:'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1.5" y1="14" x2="6.5" y2="14"/><line x1="9.5" y1="8" x2="14.5" y2="8"/><line x1="17.5" y1="16" x2="22.5" y2="16"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a6 6 0 0 1 0 12H8"/>',
  layers:'<polygon points="12 2 22 8.5 12 15 2 8.5"/><polyline points="2 14 12 20.5 22 14"/>',
  route:'<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
  spark2:'<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19"/>',
  diff:'<path d="M12 3v18"/><rect x="3" y="6" width="6" height="5" rx="1"/><rect x="15" y="6" width="6" height="5" rx="1"/><path d="M6 13v5M4 16h4"/><path d="M16 16h4"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2"/>',
  repeat:'<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/>',
  gauge:'<path d="M12 14l4-4"/><path d="M3.5 16a9 9 0 1 1 17 0z"/><circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none"/>',
  megaphone:'<path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1z"/><path d="M18 8a4 4 0 0 1 0 8"/>',
  send:'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  coffee:'<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9h2.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 3v2M11 3v2"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none"/>',
  utensils:'<path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><line x1="6" y1="12" x2="6" y2="21"/><path d="M17 3c-1.7 0-3 2-3 5s1 4 3 4v9"/>',
  umbrella:'<path d="M12 2a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 11v7a2 2 0 0 0 4 0"/>',
  bookmark:'<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  ticket:'<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v2M13 11v2M13 16v2"/>',
  door:'<path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/><circle cx="13" cy="12" r="1" fill="currentColor" stroke="none"/>',
  wheel:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  maximize:'<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  sunrise:'<path d="M12 2v6M5.6 9.6 4.2 8.2M2 16h2M20 16h2M19.8 8.2l-1.4 1.4M22 20H2M16 16a4 4 0 0 0-8 0"/>',
  lifebuoy:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><line x1="5.6" y1="5.6" x2="9.6" y2="9.6"/><line x1="14.4" y1="14.4" x2="18.4" y2="18.4"/><line x1="14.4" y1="9.6" x2="18.4" y2="5.6"/><line x1="5.6" y1="18.4" x2="9.6" y2="14.4"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/>',
  reply:'<polyline points="9 14 4 9 9 4"/><path d="M4 9h11a6 6 0 0 1 0 12h-3"/>',
  userCheck:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><polyline points="16 11 18 13 22 9"/>',
  notepen:'<path d="M4 4h10l6 6v10a0 0 0 0 1 0 0H4z" /><path d="M14 4v6h6"/><path d="M9 14l5-5 2 2-5 5H9z"/>',
};
function Ic({ n, s = 18, c = "currentColor", sw = 1.7, style }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} dangerouslySetInnerHTML={{ __html: ICONS[n] || "" }} />;
}
window.Ic = Ic;

// ---------- nav model ----------
// ---------- current user (role gate) ----------
// canAdmin = explicitly granted admin/manager access. Drives whether Admin mode
// is even offered, and is re-validated on every route change (not just hidden in UI).
const CURRENT_USER = { name: "Maria A.", init: "MA", color: "#FF7849", role: "Driftsleder", canAdmin: true };

// ---------- nav models ----------
// Private (employee-facing) — every user has this. "Min side" = self-service.
const PRIVATE_NAV = [
  { id: "min-dag", label: "Min dag", icon: "home" },
  { sec: "Min side" },
  { id: "mine-vakter", label: "Mine vakter", icon: "calendar", badge: "2" },
  { id: "min-lonn", label: "Min lønn", icon: "wallet" },
  { id: "min-laering", label: "Min opplæring", icon: "cap" },
  { id: "mine-kontrakter", label: "Mine kontrakter", icon: "checkdoc" },
  { id: "mitt-cv", label: "Mitt CV", icon: "sparkle" },
];
// Admin (Workforce Management) — only users with canAdmin.
const ADMIN_NAV = [
  { sec: "Drift" },
  { id: "oversikt", label: "I dag", icon: "home" },
  { id: "oppgaver", label: "Oppgaver", icon: "list", badge: "5" },
  { id: "vaktplan", label: "Vaktplan", icon: "grid" },
  { id: "planlegging", label: "Kalender", icon: "calendar" },
  { sec: "Team" },
  { id: "ansatte", label: "Ansatte", icon: "users" },
  { id: "hms", label: "HMS", icon: "shield", dot: true },
  { id: "kommunikasjon", label: "Kommunikasjon", icon: "hash", badge: "2" },
  { sec: "Økonomi" },
  { id: "lonn", label: "Lønn", icon: "wallet" },
  { id: "avstemming", label: "Avstemming", icon: "checkdoc", badge: "3" },
  { id: "rapporter", label: "Rapporter", icon: "chart" },
];
const navFor = (mode) => (mode === "admin" ? ADMIN_NAV : PRIVATE_NAV);
const routesFor = (mode) => navFor(mode).filter(x => x.id).map(x => x.id);
const homeFor = (mode) => (mode === "admin" ? "oversikt" : "min-dag");
const ALL_NAV = [...PRIVATE_NAV, ...ADMIN_NAV];

const WORKSPACES = [
  { id: "bn", name: "Bistro Nord", role: "Driftsleder", init: "BN", c: "#FF7849", notif: 4, active: true },
  { id: "cs", name: "Café Skuta", role: "Vaktleder", init: "CS", c: "#00ab93", notif: 0 },
  { id: "hv", name: "Hotell Vest", role: "Ekstravakt", init: "HV", c: "#864ad2", notif: 2 },
  { id: "hq", name: "HQ Workspace", role: "Eier", init: "HQ", c: "#2784d5", notif: 1 },
];

// ---------- toast / undo bus ----------
const ToastCtx = createContext(null);
window.useToast = () => useContext(ToastCtx);
function ToastHost({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, undo: opts.undo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts.duration || 4200);
  };
  const dismiss = (id) => setToasts(t => t.filter(x => x.id !== id));
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="sk-toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className="sk-toast">
            <Ic n="check" s={16} c="var(--orange-light)" sw={2.4} />
            <span>{t.msg}</span>
            {t.undo && <button className="undo" onClick={() => { t.undo(); dismiss(t.id); }}>Angre</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- dropdown ----------
function Pop({ children, onClose, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return <div ref={ref} className="sk-pop" style={style}>{children}</div>;
}

// ---------- create («Skap») button with dropdown ----------
function CreateButton({ label = "Skap", wrapStyle, onAction }) {
  const [open, setOpen] = useState(false);
  const toast = useContext(ToastCtx);
  return (
    <div style={{ position: "relative", ...(wrapStyle || {}) }}>
      <button className="sk-primary" onClick={() => setOpen(o => !o)}>
        <Ic n="plus" s={15} c="#fff" sw={2.3} /> {label} <Ic n="chevDown" s={13} c="rgba(255,255,255,0.85)" />
      </button>
      {open && (
        <Pop onClose={() => setOpen(false)} style={{ top: 44, right: 0, width: 216 }}>
          <div className="sk-pop-sec">Skap ny</div>
          {[["list", "Oppgave"], ["grid", "Vakt"], ["hash", "Kunngjøring"], ["alert", "Avvik"], ["book", "Dokument"], ["users", "Booking"], ["calendar", "Event"]].map(([ic, x]) => (
            <button key={x} className="sk-pop-item" onClick={() => { setOpen(false); if (onAction && onAction(x)) return; if (window.SmartoutCreate) { window.SmartoutCreate(x); return; } toast && toast(`${x} opprettet`, { undo: () => {} }); }}><Ic n={ic} s={15} c="var(--muted)" /> {x}</button>
          ))}
        </Pop>
      )}
    </div>
  );
}
window.CreateButton = CreateButton;

// ---------- seasons (Aktiv sesong) ----------
const SEASONS = [
  { id: "vinter", name: "Vinter 2026", range: "1. des – 28. feb", status: "active" },
  { id: "var", name: "Vår 2026", range: "1. mar – 31. mai", status: "planned" },
  { id: "sommer", name: "Sommer 2026", range: "1. jun – 31. aug", status: "draft" },
  { id: "host", name: "Høst 2025", range: "1. sep – 30. nov", status: "archived" },
];

// ---------- command palette (Søk) ----------
const CMD_RECENT = [
  { id: "r1", icon: "alert", t: "Avvik #214 — kjøl-pakning", s: "Avvik · Kjøkken", route: "hms" },
  { id: "r2", icon: "grid", t: "Vaktplan — fredag 31/5", s: "Vaktplan", route: "vaktplan" },
  { id: "r3", icon: "wallet", t: "Petter K. — timeavvik", s: "Lønn · Avstemming", route: "avstemming" },
];
function CommandPalette({ open, onClose, mode, canAdmin, go, openBot, openProfile, openSettings, openDoc }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const toast = useContext(ToastCtx);
  const SD = window.SmartoutData || { USERS: {} };
  const people = Object.values(SD.USERS || {}).filter(u => u.name).slice(0, 6);

  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open]);

  const navItems = (canAdmin ? ADMIN_NAV : PRIVATE_NAV).filter(x => x.id).map(n => ({ kind: "nav", id: "nav-" + n.id, icon: n.icon, t: n.label, s: "Gå til side", run: () => go(n.id) }));
  const actions = [
    { kind: "act", id: "a-task", icon: "list", t: "Ny oppgave", s: "Handling", run: () => toast("Oppgave opprettet") },
    { kind: "act", id: "a-shift", icon: "grid", t: "Ny vakt", s: "Handling", run: () => toast("Vakt opprettet") },
    { kind: "act", id: "a-dev", icon: "alert", t: "Meld avvik", s: "Handling", run: () => toast("Avvik opprettet") },
    { kind: "act", id: "a-doc", icon: "file", t: "Åpne Dokumentmodus", s: "Handling", run: openDoc },
    { kind: "act", id: "a-report", icon: "checkdoc", t: "Generer dagsrapport", s: "Handling", run: () => { window.openDagsrapport && window.openDagsrapport(); } },
    { kind: "act", id: "a-prof", icon: "user", t: "Min profil", s: "Konto", run: openProfile },
    { kind: "act", id: "a-set", icon: "settings", t: "Kontoinnstillinger", s: "Konto", run: openSettings },
  ];
  const peopleItems = people.map(p => ({ kind: "person", id: "p-" + (p.id || p.name), av: p, t: p.name, s: p.role || "Ansatt", run: () => { go("ansatte"); toast(`Åpner ${p.name}`); } }));

  const ql = q.toLowerCase().trim();
  const match = (x) => !ql || (x.t + " " + (x.s || "")).toLowerCase().includes(ql);
  const groups = ql
    ? [
        { lbl: "Sider", items: navItems.filter(match) },
        { lbl: "Handlinger", items: actions.filter(match) },
        { lbl: "Personer", items: peopleItems.filter(match) },
      ].filter(g => g.items.length)
    : [
        { lbl: "Nylig", items: CMD_RECENT.map(r => ({ kind: "recent", id: r.id, icon: r.icon, t: r.t, s: r.s, run: () => go(r.route) })) },
        { lbl: "Handlinger", items: actions.slice(0, 5) },
        { lbl: "Sider", items: navItems.slice(0, 5) },
      ];
  const flat = groups.flatMap(g => g.items);
  const botItem = { kind: "bot", id: "bot", t: ql ? `Spør Mr. Botsson: «${q}»` : "Spør Mr. Botsson", s: "AI-assistent", run: () => openBot(q) };
  const all = [...flat, botItem];

  const runIdx = (i) => { const it = all[i]; if (!it) return; onClose(); setTimeout(() => it.run && it.run(), 0); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, all.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); runIdx(sel); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  if (!open) return null;
  let idx = -1;
  return (
    <div className="cmd-scrim" onMouseDown={onClose}>
      <div className="cmd" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Søk">
        <div className="cmd-input">
          <Ic n="search" s={18} c="var(--muted)" />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey} placeholder="Søk sider, personer, handlinger — eller spør Botsson…" />
          <kbd>Esc</kbd>
        </div>
        <div className="cmd-body">
          {groups.map(g => (
            <div key={g.lbl} className="cmd-group">
              <div className="cmd-glbl">{g.lbl}</div>
              {g.items.map(it => { idx++; const i = idx; return (
                <button key={it.id} className={`cmd-item ${sel === i ? "on" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => runIdx(i)}>
                  {it.kind === "person"
                    ? <span className="cmd-ic"><span className="so-av" style={{ width: 26, height: 26, fontSize: 10, background: it.av.color || "#888" }}>{it.av.initials || (it.av.name || "?")[0]}</span></span>
                    : <span className="cmd-ic ring"><Ic n={it.icon} s={16} /></span>}
                  <span className="cmd-txt"><span className="t">{it.t}</span><span className="s">{it.s}</span></span>
                  {sel === i && <span className="cmd-enter"><Ic n="arrowRight" s={13} /></span>}
                </button>
              ); })}
            </div>
          ))}
          {/* Botsson handoff — always available */}
          {(() => { idx++; const i = idx; return (
            <div className="cmd-group cmd-botgroup">
              <button className={`cmd-item bot ${sel === i ? "on" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => runIdx(i)}>
                <span className="cmd-ic bot"><Ic n="bot" s={16} c="#fff" /></span>
                <span className="cmd-txt"><span className="t">{botItem.t}</span><span className="s">{botItem.s}</span></span>
                {sel === i && <span className="cmd-enter"><Ic n="arrowRight" s={13} /></span>}
              </button>
            </div>
          ); })()}
        </div>
        <div className="cmd-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> naviger</span>
          <span><kbd>↵</kbd> velg</span>
          <span className="grow" />
          <span>Smartout-søk</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Min profil ----------
function ProfilePage({ onClose }) {
  const toast = useContext(ToastCtx);
  return (
    <main className="sk-main">
      <div className="sk-wrap" style={{ maxWidth: 880 }}>
        <button className="acct-back" onClick={onClose}><Ic n="chevLeft" s={16} /> Tilbake</button>
        <div className="prof-hero">
          <span className="so-av" style={{ width: 76, height: 76, fontSize: 26, background: CURRENT_USER.color }}>{CURRENT_USER.init}</span>
          <div className="prof-hero-id">
            <div className="prof-name">{CURRENT_USER.name}</div>
            <div className="prof-role"><span className="prof-rolepill">{CURRENT_USER.role}</span> Bistro Nord · ansatt siden 2023</div>
          </div>
          <button className="sk-ghost" onClick={() => toast("Rediger profil")}><Ic n="user" s={15} /> Rediger</button>
        </div>
        <div className="prof-grid">
          <div className="so-panel">
            <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="user" s={15} /></span>Personlig</span></div>
            <div className="prof-fields">
              {[["Fullt navn", "Maria Andersen"], ["E-post", "maria@bistronord.no"], ["Telefon", "+47 901 23 456"], ["Fødselsdato", "14. mars 1991"], ["Adresse", "Storgata 14, 0184 Oslo"]].map(([k, v]) => (
                <div key={k} className="prof-field"><span className="k">{k}</span><span className="v">{v}</span></div>
              ))}
            </div>
          </div>
          <div className="so-panel">
            <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="shield" s={15} /></span>Arbeid</span></div>
            <div className="prof-fields">
              {[["Stilling", "Driftsleder"], ["Avdeling", "Admin · Sal"], ["Ansattnr.", "BN-0142"], ["Tilgangsnivå", "Leder"], ["Nærmeste leder", "Erik S. (Eier)"]].map(([k, v]) => (
                <div key={k} className="prof-field"><span className="k">{k}</span><span className="v">{v}</span></div>
              ))}
            </div>
          </div>
          <div className="so-panel">
            <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="checkdoc" s={15} /></span>Kompetanse</span></div>
            <div className="prof-chips">
              {[["Hygienesertifikat", "ok"], ["HMS-kurs", "ok"], ["Brannvern", "ok"], ["Førstehjelp", "warn"], ["Alkohollov", "ok"]].map(([k, st]) => (
                <span key={k} className={`prof-skill ${st}`}><Ic n={st === "ok" ? "check" : "clock"} s={12} sw={2.4} /> {k}</span>
              ))}
            </div>
          </div>
          <div className="so-panel">
            <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="chart" s={15} /></span>Denne måneden</span></div>
            <div className="prof-stats">
              {[["Vakter", "18"], ["Timer", "142"], ["Oppgaver løst", "63"], ["Oppmøte", "100%"]].map(([k, v]) => (
                <div key={k} className="prof-stat"><span className="v">{v}</span><span className="k">{k}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------- Kontoinnstillinger ----------
function SettingsPage({ onClose, theme, setTheme, onLogout }) {
  const toast = useContext(ToastCtx);
  const [vals, setVals] = useState({ push: true, email: false, sms: true, summary: true, twofa: true, sounds: false });
  const t = (k) => setVals(v => ({ ...v, [k]: !v[k] }));
  const Row = ({ k, title, sub }) => (
    <button className="set-row" onClick={() => { t(k); toast(title + (vals[k] ? " av" : " på")); }}>
      <span className="set-row-t">{title}<span className="set-row-s">{sub}</span></span>
      <span className={`sk-switch ${vals[k] ? "on" : ""}`}><span /></span>
    </button>
  );
  return (
    <main className="sk-main">
      <div className="sk-wrap" style={{ maxWidth: 760 }}>
        <button className="acct-back" onClick={onClose}><Ic n="chevLeft" s={16} /> Tilbake</button>
        <div className="sk-page-head"><div><div className="sk-eyebrow">Konto</div><h1 className="sk-page-title">Kontoinnstillinger</h1></div></div>

        <div className="so-panel" style={{ marginBottom: 16 }}>
          <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="sun" s={15} /></span>Utseende</span></div>
          <div className="set-seg-wrap">
            <span className="set-seg-lbl">Tema</span>
            <div className="set-seg">
              <button className={theme === "light" ? "on" : ""} onClick={() => setTheme("light")}><Ic n="sun" s={14} /> Lyst</button>
              <button className={theme === "dark" ? "on" : ""} onClick={() => setTheme("dark")}><Ic n="moon" s={14} /> Mørkt</button>
            </div>
          </div>
        </div>

        <div className="so-panel" style={{ marginBottom: 16 }}>
          <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="bell" s={15} /></span>Varsler</span></div>
          <div className="set-rows">
            <Row k="push" title="Push-varsler" sub="Vaktendringer, avvik og påminnelser" />
            <Row k="email" title="E-postvarsler" sub="Daglig sammendrag og kunngjøringer" />
            <Row k="sms" title="SMS ved kritisk" sub="Kun for forsinkede/eskalerte hendelser" />
            <Row k="summary" title="Morgenbrief fra Botsson" sub="Oppsummering kl. 08:00 hver dag" />
            <Row k="sounds" title="Lyder" sub="Spill av lyd ved nye meldinger" />
          </div>
        </div>

        <div className="so-panel" style={{ marginBottom: 16 }}>
          <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="lock" s={15} /></span>Sikkerhet</span></div>
          <div className="set-rows">
            <Row k="twofa" title="To-faktor-autentisering" sub="Krever kode ved innlogging" />
            <button className="set-row" onClick={() => toast("Passordbytte sendt på e-post")}><span className="set-row-t">Endre passord<span className="set-row-s">Sist endret for 3 måneder siden</span></span><Ic n="chevRight" s={16} c="var(--muted)" /></button>
            <button className="set-row" onClick={() => toast("Aktive økter: 2")}><span className="set-row-t">Aktive økter<span className="set-row-s">Logg ut av andre enheter</span></span><Ic n="chevRight" s={16} c="var(--muted)" /></button>
          </div>
        </div>

        <div className="so-panel">
          <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="settings" s={15} /></span>Generelt</span></div>
          <div className="set-rows">
            <button className="set-row" onClick={() => toast("Språk: Norsk (bokmål)")}><span className="set-row-t">Språk<span className="set-row-s">Norsk (bokmål)</span></span><Ic n="chevRight" s={16} c="var(--muted)" /></button>
            <button className="set-row" onClick={() => toast("Eksporterer dine data…")}><span className="set-row-t">Last ned mine data</span><Ic n="chevRight" s={16} c="var(--muted)" /></button>
            <button className="set-row danger" onClick={() => { onClose && onClose(); onLogout && onLogout(); }}><span className="set-row-t">Logg ut</span><Ic n="logout" s={16} /></button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------- Dokumentmodus — sidebar swap + content ----------
const DOC_CHAPTERS = [
  { n: 1, title: "Innledning og formål", state: "completed" },
  { n: 2, title: "Roller og ansvar", state: "completed" },
  { n: 3, title: "Risikovurdering", state: "completed" },
  { n: 4, title: "Rutiner — kjøkken", state: "completed" },
  { n: 5, title: "Temperaturkontroll", state: "completed" },
  { n: 6, title: "Renhold og hygiene", state: "completed" },
  { n: 7, title: "Avvikshåndtering", state: "completed" },
  { n: 8, title: "Brannvern", state: "completed" },
  { n: 9, title: "Førstehjelp", state: "in_progress" },
  { n: 10, title: "Vedlegg og maler", state: "todo", optional: true },
];
function DocSide({ active, setActive, onExit, collapsed }) {
  const done = DOC_CHAPTERS.filter(c => c.state === "completed").length;
  const pct = Math.round((done / DOC_CHAPTERS.length) * 100);
  return (
    <aside className={`sk-side doc ${collapsed ? "col" : ""}`}>
      <button className="doc-exit" onClick={onExit} title="Tilbake til Smartout">
        <Ic n="chevLeft" s={16} /> {!collapsed && <span>Tilbake til Smartout</span>}
      </button>
      {!collapsed && (
        <div className="doc-progress">
          <div className="doc-progress-top"><span className="lbl">IK-mat internkontroll</span><span className="pct">{pct}%</span></div>
          <div className="doc-bar"><span style={{ width: pct + "%" }} /></div>
          <div className="doc-progress-sub">{done} av {DOC_CHAPTERS.length} kapitler fullført</div>
        </div>
      )}
      <nav className="sk-nav doc-nav">
        {DOC_CHAPTERS.map(c => (
          <button key={c.n} className={`doc-chapter ${active === c.n ? "on" : ""}`} data-state={c.state} onClick={() => setActive(c.n)} title={c.title}>
            <span className="doc-step">{c.state === "completed" ? <Ic n="check" s={13} sw={2.6} /> : c.n}</span>
            {!collapsed && <span className="doc-ch-title">{c.title}{c.optional && <span className="doc-opt">valgfri</span>}</span>}
            {!collapsed && c.state === "needs_review" && <span className="doc-ch-mark"><Ic n="alert" s={13} /></span>}
          </button>
        ))}
      </nav>
      <div className="sk-side-foot">
        <button className="sk-bot" title="Mr. Botsson"><span className="sk-bot-ic"><Ic n="bot" s={16} c="var(--orange)" /></span>{!collapsed && <span className="sk-navlbl">Botsson hjelper deg</span>}</button>
      </div>
    </aside>
  );
}
function DocContent({ active }) {
  const ch = DOC_CHAPTERS.find(c => c.n === active) || DOC_CHAPTERS[0];
  const toast = useContext(ToastCtx);
  return (
    <main className="sk-main">
      <div className="sk-wrap" style={{ maxWidth: 760 }}>
        <div className="doc-head">
          <span className="doc-eyebrow">Dokumentmodus · IK-mat internkontroll · Kapittel {ch.n} av {DOC_CHAPTERS.length}</span>
          <h1 className="doc-title">{ch.title}</h1>
          <div className="doc-meta"><span className={`doc-statepill ${ch.state}`}>{ch.state === "completed" ? "Fullført" : ch.state === "in_progress" ? "Pågår" : "Ikke startet"}</span><span>Sist endret 28/5 · Maria A.</span></div>
        </div>
        <div className="doc-sheet">
          <p>Dette kapittelet beskriver virksomhetens rutiner for <strong>{ch.title.toLowerCase()}</strong> ved Bistro Nord. Innholdet er en del av det lovpålagte internkontrollsystemet for mattrygghet (IK-mat) og HMS.</p>
          <h3>Formål</h3>
          <p>Sikre at alle ansatte kjenner og følger gjeldende prosedyrer, og at avvik fanges opp og lukkes systematisk.</p>
          <ul>
            <li>Ansvarlig leder gjennomgår rutinen kvartalsvis.</li>
            <li>Alle nyansatte signerer ved opplæring.</li>
            <li>Avvik registreres i Smartout og følges opp innen frist.</li>
          </ul>
          <h3>Tilknyttede dokumenter</h3>
          <div className="doc-attach"><span className="ic"><Ic n="file" s={17} /></span><span className="b"><span className="t">Sjekkliste — {ch.title}.pdf</span><span className="s">PDF · 240 kB</span></span><Ic n="arrowRight" s={15} c="var(--muted)" style={{ transform: "rotate(90deg)" }} /></div>
        </div>
        <div className="doc-actions">
          <button className="sk-ghost" onClick={() => toast("Lagret som utkast")}><Ic n="checkdoc" s={15} /> Lagre utkast</button>
          <button className="sk-primary" onClick={() => toast("Kapittel markert som fullført")}><Ic n="check" s={15} sw={2.3} /> Marker fullført</button>
        </div>
      </div>
    </main>
  );
}

// ---------- top bar ----------
function TopBar({ theme, setTheme, openMenu, setOpenMenu, onOpenCmd, botOpen, onToggleBot, chatOpen, onToggleChat, onOpenDoc, season, setSeason }) {
  const toast = useContext(ToastCtx);
  const activeSeason = SEASONS.find(s => s.id === season) || SEASONS[0];
  return (
    <header className="sk-top">
      <div className="sk-top-left">
        <div className="sk-ws" role="button" tabIndex={0} onClick={() => setOpenMenu(openMenu === "ws" ? null : "ws")}>
          <span className="sk-ws-mark" />
          Bistro Nord
          <Ic n="chevDown" s={14} c="var(--muted)" />
          {openMenu === "ws" && (
            <Pop onClose={() => setOpenMenu(null)} style={{ top: 46, left: 0 }}>
              <div className="sk-wspop" onClick={e => e.stopPropagation()}>
                <div className="sk-wspop-head">
                  <span className="lbl">Mine arbeidsplasser</span>
                  <span className="sk-ws-allnotif">7 nye</span>
                </div>
                {WORKSPACES.map(w => (
                  <button key={w.id} className={`sk-ws-row ${w.active ? "on" : ""}`} onClick={() => setOpenMenu(null)}>
                    <span className="sk-ws-rowmark" style={{ background: w.c }}>{w.init}</span>
                    <span className="sk-ws-info">
                      <span className="sk-ws-name">{w.name}{w.active && <span className="check"><Ic n="check" s={13} sw={2.8} /></span>}</span>
                      <span className="sk-ws-role">{w.role}</span>
                    </span>
                    {w.notif > 0 && <span className="sk-ws-notif" title={`${w.notif} nye varsler`}>{w.notif}</span>}
                  </button>
                ))}
                <div className="sk-pop-div" />
                <button className="sk-ws-create" onClick={() => { setOpenMenu(null); toast && toast("Ny arbeidsplass — veiviser åpnet"); }}>
                  <span className="ic"><Ic n="plus" s={16} sw={2.2} /></span>
                  Skap ny arbeidsplass
                </button>
              </div>
            </Pop>
          )}
        </div>
        <div className="sk-season" role="button" tabIndex={0} onClick={() => setOpenMenu(openMenu === "season" ? null : "season")} style={{ position: "relative", cursor: "pointer" }} title="Bytt aktiv sesong">
          <span className="sk-season-lbl">Aktiv sesong</span>
          <strong>{activeSeason.name}</strong>
          <span className="sk-pill-ok">● Aktiv</span>
          <Ic n="chevDown" s={13} c="var(--muted)" />
          {openMenu === "season" && (
            <Pop onClose={() => setOpenMenu(null)} style={{ top: 40, left: 0, width: 268 }}>
              <div className="sk-pop-sec">Sesong</div>
              {SEASONS.map(s => (
                <button key={s.id} className={`sk-pop-item sk-seasonrow ${s.id === season ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); setSeason(s.id); setOpenMenu(null); toast(`Byttet til ${s.name}`); }}>
                  <span className={`sk-season-dot ${s.status}`} />
                  <span className="sk-season-info"><span className="nm">{s.name}</span><span className="rg">{s.range}</span></span>
                  {s.id === season ? <span className="sk-dot-ok" /> : <span className={`sk-season-tag ${s.status}`}>{s.status === "planned" ? "Planlagt" : s.status === "draft" ? "Utkast" : s.status === "archived" ? "Arkivert" : ""}</span>}
                </button>
              ))}
              <div className="sk-pop-div" />
              <button className="sk-pop-item" onClick={(e) => { e.stopPropagation(); setOpenMenu(null); toast("Åpner Årshjul"); }}><Ic n="calendar" s={15} c="var(--muted)" /> Åpne Årshjul</button>
            </Pop>
          )}
        </div>
      </div>

      <button className="sk-search" onClick={onOpenCmd}>
        <Ic n="search" s={15} c="var(--muted)" />
        <span className="sk-search-ph">Søk i drift…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="sk-top-right">
        <button className="sk-iconbtn" title="Bibliotek / Dokumentmodus" onClick={onOpenDoc}><Ic n="book" s={18} /></button>
        <button className="sk-iconbtn" title="Tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Ic n={theme === "dark" ? "sun" : "moon"} s={18} /></button>
        <button className={`sk-iconbtn bot-trigger ${botOpen ? "on" : ""}`} title="Spør Mr. Botsson" onClick={onToggleBot}>
          <Ic n="bot" s={19} />{!botOpen && <span className="live-dot" />}
        </button>
        <button className={`sk-iconbtn ${chatOpen ? "on" : ""}`} title="Meldinger" onClick={onToggleChat}>
          <Ic n="message" s={18} /><span className="sk-badge-dot">5</span>
        </button>
        <button className="sk-iconbtn" title="Varsler" onClick={() => setOpenMenu(openMenu === "bell" ? null : "bell")}>
          <Ic n="bell" s={18} /><span className="sk-badge-dot">4</span>
          {openMenu === "bell" && (
            <Pop onClose={() => setOpenMenu(null)} style={{ top: 44, right: 0, width: 320 }}>
              <div className="sk-pop-sec">Varsler</div>
              {[
                { c: "var(--error)", t: "Temperaturavvik Kjøl 3 — over +4°C", m: "for 4 min siden" },
                { c: "var(--warning)", t: "Petter har ikke lest vaktendring", m: "12 min" },
                { c: "var(--orange)", t: "Bama-levering ankommer 09:30", m: "26 min" },
                { c: "var(--success)", t: "Erik godkjente fettutskiller-logg", m: "1 t" },
              ].map((n, i) => (
                <div key={i} className="sk-notif">
                  <span className="sk-notif-dot" style={{ background: n.c }} />
                  <span className="sk-notif-body"><span className="t">{n.t}</span><span className="m">{n.m}</span></span>
                </div>
              ))}
            </Pop>
          )}
        </button>
      </div>
    </header>
  );
}

// ---------- sidebar ----------
function Side({ route, setRoute, collapsed, setCollapsed, mode, setMode, canAdmin, setCanAdmin, openMenu, setOpenMenu, openProfile, openSettings, onLogout }) {
  const items = navFor(mode);
  return (
    <aside className={`sk-side ${collapsed ? "col" : ""}`}>
      <button className="sk-collapse" onClick={() => setCollapsed(c => !c)} title={collapsed ? "Utvid" : "Skjul"}>
        <Ic n={collapsed ? "chevRight" : "chevLeft"} s={15} c="var(--muted)" />
      </button>
      <nav className="sk-nav">
        {items.map((it, i) => it.sec
          ? (!collapsed ? <div key={"s" + i} className="sk-navsec">{it.sec}</div> : <div key={"s" + i} style={{ height: 10 }} />)
          : (
            <button key={it.id} className={`sk-navitem ${route === it.id ? "on" : ""}`} onClick={() => setRoute(it.id)} title={it.label}>
              <span className="sk-navico"><Ic n={it.icon} s={18} /></span>
              <span className="sk-navlbl">{it.label}</span>
              {it.dot && <span className="sk-navdot" />}
              {it.badge && <span className="sk-navbadge">{it.badge}</span>}
            </button>
          ))}
      </nav>
      <div className="sk-side-foot">
        <button className="sk-bot" onClick={() => setRoute(homeFor(mode))} title="Mr. Botsson"><span className="sk-bot-ic"><Ic n="bot" s={16} c="var(--orange)" /></span><span className="sk-navlbl">Mr. Botsson</span></button>

        {/* Adminmodus toggle — only rendered for users granted admin/manager access */}
        {canAdmin && (
          <button className={`sk-admintoggle ${mode === "admin" ? "on" : ""}`} onClick={() => setMode(mode === "admin" ? "private" : "admin")} title="Adminmodus">
            <span className="sk-navlbl" style={{ color: mode === "admin" ? "var(--orange)" : "var(--muted)", fontWeight: 600 }}>Adminmodus</span>
            <span className={`sk-switch ${mode === "admin" ? "on" : ""}`}><span /></span>
          </button>
        )}

        <div style={{ position: "relative" }}>
          <button className="sk-profile" onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}>
            <span className="sk-avatar" style={{ background: CURRENT_USER.color }}>{CURRENT_USER.init}</span>
            <span className="sk-navlbl"><span className="sk-prof-name">{CURRENT_USER.name}</span><span className="sk-prof-role">{canAdmin ? (mode === "admin" ? "ADMIN · " + CURRENT_USER.role.toUpperCase() : CURRENT_USER.role.toUpperCase()) : "ANSATT"}</span></span>
            <Ic n="chevDown" s={14} c="var(--muted)" />
          </button>
          {openMenu === "profile" && (
            <Pop onClose={() => setOpenMenu(null)} style={{ bottom: 50, left: 8, width: 226 }}>
              <button className="sk-pop-item" onClick={() => { setOpenMenu(null); openProfile(); }}><Ic n="user" s={15} c="var(--muted)" /> Min profil</button>
              <button className="sk-pop-item" onClick={() => { setOpenMenu(null); openSettings(); }}><Ic n="settings" s={15} c="var(--muted)" /> Kontoinnstillinger</button>
              <div className="sk-pop-div" />
              <div className="sk-pop-sec">Demo · rolle</div>
              <button className="sk-pop-item" onClick={() => { setCanAdmin(true); setOpenMenu(null); }}>
                <Ic n="shield" s={15} c="var(--muted)" /> Vis som leder {canAdmin && <span className="sk-dot-ok" />}
              </button>
              <button className="sk-pop-item" onClick={() => { setCanAdmin(false); setOpenMenu(null); }}>
                <Ic n="user" s={15} c="var(--muted)" /> Vis som ansatt {!canAdmin && <span className="sk-dot-ok" />}
              </button>
              <div className="sk-pop-div" />
              <button className="sk-pop-item" onClick={() => { setOpenMenu(null); onLogout && onLogout(); }}><Ic n="logout" s={15} c="var(--muted)" /> Logg ut</button>
            </Pop>
          )}
        </div>
      </div>
    </aside>
  );
}

// ---------- Mr. Botsson — AI assistant chat ----------
const BOT_REPLIES = [
  {
    match: ["hast", "kritisk", "nå", "viktig"],
    text: <span>Tre ting haster før lunsj: <span className="hl">Temperaturavvik på Kjøl 3</span> (over +4°C, 32 min forsinket), oppfølging av <strong>Avvik #214</strong>, og mottakskontroll når Bama leverer 09:30. Jeg foreslår å ta dem i den rekkefølgen.</span>,
    sugg: { title: "Åpne Avvik #214 — kjøl-pakning", why: "Løs pakning ga temperaturavvik. Fikses denne først, holder Kjøl 3 seg stabil resten av dagen.", src: ["Avvik #214", "Temp-logg Kjøl 3", "Vedlikehold"], cta: "Åpne oppgave", toast: "Avvik #214 åpnet" },
  },
  {
    match: ["mangl", "i morgen", "bemann", "dekning", "hvem"],
    text: <span>I morgen (fredag) mangler du <span className="hl">én kokk på kveldsvakten</span> 17–23. Jonas H. er tilgjengelig og under 37,5t. Selma kan ta sal alene til 18.</span>,
    sugg: { title: "Tilby kveldsvakt til Jonas H.", why: "Jonas er kvalifisert (Kokk), har 14t denne uka og ingen kollisjon. Sender forespørsel han kan godta i appen.", src: ["Vaktplan fre", "Kompetanse", "Timebank"], cta: "Send forespørsel", toast: "Forespørsel sendt til Jonas H." },
  },
  {
    match: ["oppsummer", "dagen", "status", "hvordan"],
    text: <span>Status nå: <strong>4 av 5</strong> på vakt, <strong>3 oppgaver</strong> gjenstår før 12:00, <strong>3 ting</strong> venter godkjenning, og <strong>2 ansatte</strong> har ikke lest dagens vaktendring. Dekning i dag er 92 %.</span>,
  },
  {
    match: ["godkjenn", "avstem", "lønn"],
    text: <span>Du har <strong>3 ting til godkjenning</strong>: Petters timeavvik (+1,5t), et manuelt tillegg på helgevakt, og fettutskiller-loggen. Alle ser rutinemessige ut — jeg kan klargjøre dem for samlet godkjenning.</span>,
    sugg: { title: "Klargjør 3 godkjenninger", why: "Alle tre matcher historikk og regelverk uten avvik. Du bekrefter med étt trykk — ingenting sendes før du godkjenner.", src: ["Timebank", "Lønnsregler", "HMS-logg"], cta: "Se godkjenninger", toast: "3 godkjenninger klargjort" },
  },
];
const BOT_DEFAULT = { text: <span>Jeg følger med på oppgaver, vaktplan, HMS og lønn for Bistro Nord. Spør meg om hva som haster, hvem som mangler i morgen, eller be meg oppsummere dagen.</span> };

function BotssonChat({ open, onClose, seed }) {
  const toast = useToast();
  const [msgs, setMsgs] = useState([
    { id: "m0", from: "bot", text: <span>God morgen, Maria. Jeg har gått gjennom natten og morgenen — én ting krever deg <span className="hl">nå</span>.</span> },
    { id: "m1", from: "bot", text: <span>Start med <strong>Avvik #214 — kjøl-pakning</strong>, så er Kjøl 3 stabil før Bama leverer 09:30.</span>,
      sugg: { title: "Åpne Avvik #214", why: "Løs pakning ga temperaturavvik i natt. Fikses den nå, unngår du varekast.", src: ["Avvik #214", "Temp-logg", "Bama 09:30"], cta: "Åpne oppgave", toast: "Avvik #214 åpnet" } },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const logRef = useRef(null);
  const [resolved, setResolved] = useState({});

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [msgs, typing]);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  const reply = (q) => {
    const lc = q.toLowerCase();
    // context-aware help: read structured route/view context (not fragile UI text)
    const ctxKeys = ["hvor er jeg", "denne siden", "hjelp her", "hva ser du", "kontekst", "hva kan jeg", "eksport", "skriv ut", "pdf", "publiser her", "hva er dette"];
    const ctx = window.SmartoutContext && window.SmartoutContext.get && window.SmartoutContext.get();
    let found;
    if (ctx && ctx.route && ctxKeys.some(k => lc.includes(k))) {
      found = { text: window.SmartoutContext.describe(lc) };
    } else {
      found = BOT_REPLIES.find(r => r.match.some(m => lc.includes(m))) || BOT_DEFAULT;
    }
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs(m => [...m, { id: "b" + Date.now(), from: "bot", text: found.text, sugg: found.sugg }]);
    }, 850);
  };
  const send = (text) => {
    const t = (text || input).trim();
    if (!t) return;
    setMsgs(m => [...m, { id: "u" + Date.now(), from: "me", text: t }]);
    setInput("");
    reply(t);
  };
  const onSugg = (mid, sugg) => {
    setResolved(r => ({ ...r, [mid]: true }));
    toast(sugg.toast || "Utført", { undo: () => setResolved(r => ({ ...r, [mid]: false })) });
  };

  // seeded question from a page (e.g. "Oppsummer dagen" on Planlegging) — asks as the user
  const lastSeed = useRef(0);
  useEffect(() => {
    if (open && seed && seed.t && seed.t !== lastSeed.current) {
      lastSeed.current = seed.t;
      send(seed.q);
    }
  }, [open, seed]);

  if (!open) return null;
  return (
    <>
      <div className="bot-scrim" onClick={onClose} />
      <aside className="bot-panel" role="dialog" aria-label="Mr. Botsson">
        <div className="bot-head">
          <span className="bot-head-av"><Ic n="bot" s={20} /></span>
          <div className="bot-head-id">
            <div className="n">Mr. Botsson <span className="live">PÅ</span></div>
            <div className="s">AI-driftsassistent · Bistro Nord</div>
          </div>
          <button className="bot-head-btn" title="Innstillinger"><Ic n="settings" s={17} /></button>
          <button className="bot-head-btn" onClick={onClose} title="Lukk"><Ic n="x" s={18} /></button>
        </div>

        <div className="bot-log" ref={logRef}>
          <div className="bot-daydiv">I dag · 08:14</div>
          {msgs.map(m => (
            <div key={m.id} className={`bot-msg ${m.from}`}>
              {m.from === "bot" && <span className="bot-msg-av bot"><Ic n="bot" s={15} /></span>}
              <div style={{ minWidth: 0 }}>
                <div className="bot-bubble">{m.text}</div>
                {m.sugg && (
                  <div className={`bot-sugg ${resolved[m.id] ? "resolved" : ""}`}>
                    {resolved[m.id] ? (
                      <div className="bot-sugg-resolved"><Ic n="check" s={15} sw={2.4} /> {m.sugg.cta} — utført</div>
                    ) : (
                      <>
                        <div className="bot-sugg-h"><span className="ic"><Ic n="sparkle" s={13} /></span> Forslag</div>
                        <div className="bot-sugg-body">
                          <div className="bot-sugg-title">{m.sugg.title}</div>
                          <div className="bot-sugg-why">{m.sugg.why}</div>
                          <div className="bot-sugg-src">{m.sugg.src.map(s => <span key={s} className="c">{s}</span>)}</div>
                          <div className="bot-sugg-actions">
                            <button className="confirm" onClick={() => onSugg(m.id, m.sugg)}>{m.sugg.cta}</button>
                            <button className="dismiss" onClick={() => setResolved(r => ({ ...r, [m.id]: "dismissed" }))}>Ikke nå</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {typing && <div className="bot-msg bot"><span className="bot-msg-av bot"><Ic n="bot" s={15} /></span><div className="bot-bubble" style={{ padding: 0 }}><div className="bot-typing"><span /><span /><span /></div></div></div>}
        </div>

        <div className="bot-foot">
          <div className="bot-quick">
            {["Hva haster nå?", "Hvem mangler i morgen?", "Oppsummer dagen", "Hva kan jeg godkjenne?"].map(q => (
              <button key={q} onClick={() => send(q)}>{q}</button>
            ))}
          </div>
          <div className="bot-input">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }} placeholder="Spør Botsson…" />
            <button className="bot-send" disabled={!input.trim()} onClick={() => send()}><Ic n="arrowRight" s={17} c="#fff" sw={2.2} /></button>
          </div>
          <div className="bot-disclaimer">Botsson foreslår — du bekrefter. Ingenting sendes uten din godkjenning.</div>
        </div>
      </aside>
    </>
  );
}

// ---------- Meldinger — WhatsApp-style chat ----------
// Chat model is now CENTRALIZED in shared/data.js (window.SmartoutData) so web + mobile
// share one source and can't drift. These aliases keep the existing names working.
const _SD_CHAT = window.SmartoutData || {};
const CHAT_CONVS_INIT = _SD_CHAT.CHAT_CONVS;
const CHAT_THREADS_INIT = _SD_CHAT.CHAT_THREADS;
const CHAT_UNREAD_INIT = _SD_CHAT.CHAT_UNREAD;
// CHAT_STAFF, CHAT_FACETS, ROLE_LABEL, CHAT_DATES are now provided as globals by shared/data.js
// (centralized chat model) — do not re-declare here or they collide at global scope.
const AUD_MODES = _SD_CHAT.CHAT_AUD_MODES;
const CARD_SAMPLES = _SD_CHAT.CHAT_CARD_SAMPLES;

function ChatCard({ d }) {
  if (!d) return null;
  if (d.type === "image") return (
    <div className="attc" style={{ width: 252 }}>
      <div className="attc-media img"><Ic n="camera" s={30} /><span className="badge lt">{d.dim}</span></div>
      <div className="attc-pad" style={{ padding: "9px 12px" }}><div className="attc-row" style={{ margin: 0 }}><Ic n="camera" s={13} /> <b>{d.title}</b></div></div>
    </div>
  );
  if (d.type === "video") return (
    <div className="attc" style={{ width: 252 }}>
      <div className="attc-media vid"><span className="play"><Ic n="play" s={20} /></span><span className="badge">{d.dur}</span></div>
      <div className="attc-pad" style={{ padding: "9px 12px" }}><div className="attc-row" style={{ margin: 0 }}><Ic n="video" s={13} /> <b>{d.title}</b></div></div>
    </div>
  );
  if (d.type === "event") return (
    <div className="attc">
      <div className="attc-accent" style={{ background: d.c }} />
      <div className="attc-pad">
        <div className="attc-eyebrow"><span className="ic"><Ic n="calendar" s={11} /></span> Event</div>
        <div className="attc-title">{d.title}</div>
        <div className="attc-row"><Ic n="clock" s={13} /> <b>{d.when}</b></div>
        <div className="attc-row"><Ic n="mappin" s={13} /> {d.loc}</div>
        <div className="attc-avs">{d.going.map((i, k) => <span key={k} className="chat-av" style={{ background: ["#3B82F6", "#10B981", "#A855F7"][k] }}>{i}</span>)}<span className="chat-av" style={{ background: "var(--secondary)", color: "var(--muted)" }}>+{d.goingN - d.going.length}</span></div>
      </div>
      <div className="attc-foot"><span className="lbl">{d.goingN} påmeldt</span><span className="cta">Meld på</span></div>
    </div>
  );
  if (d.type === "booking") return (
    <div className="attc">
      <div className="attc-accent" style={{ background: d.c }} />
      <div className="attc-pad">
        <div className="attc-eyebrow"><span className="ic"><Ic n="users" s={11} /></span> Booking</div>
        <div className="attc-title">{d.guest}</div>
        <div className="attc-row"><Ic n="users" s={13} /> <b>{d.pax} gjester</b> · {d.table}</div>
        <div className="attc-row"><Ic n="clock" s={13} /> {d.when}</div>
      </div>
      <div className="attc-foot"><span className="lbl">Bekreftet</span><span className="cta">Åpne booking</span></div>
    </div>
  );
  if (d.type === "task") return (
    <div className="attc">
      <div className="attc-pad">
        <div className="attc-eyebrow"><span className="ic"><Ic n="list" s={11} /></span> Oppgave</div>
        <div className="attc-title">{d.title}</div>
        <div className="attc-row" style={{ justifyContent: "space-between" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: d.fc }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: d.fc }} />{d.folder}</span><span className={`attc-pill ${d.tone}`}>{d.status}</span></div>
        <div className="attc-row"><Ic n="clock" s={13} /> <b className="mono" style={{ color: "var(--error)" }}>{d.due}</b></div>
      </div>
      <div className="attc-foot"><span className="lbl">Tildelt deg</span><span className="cta">Åpne oppgave</span></div>
    </div>
  );
  if (d.type === "shift") return (
    <div className="attc">
      <div className="attc-accent" style={{ background: d.c }} />
      <div className="attc-pad">
        <div className="attc-eyebrow"><span className="ic"><Ic n="grid" s={11} /></span> Vakt</div>
        <div className="attc-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>{d.role}<span className={`attc-pill ${d.tone}`}>{d.status}</span></div>
        <div className="attc-row"><Ic n="clock" s={13} /> <b>{d.when}</b></div>
        <div className="attc-row"><span style={{ width: 8, height: 8, borderRadius: 3, background: d.c }} /> {d.dept}</div>
      </div>
      <div className="attc-foot"><span className="lbl">Udekket vakt</span><span className="cta">Ta vakten</span></div>
    </div>
  );
  if (d.type === "manual") return (
    <div className="attc"><div className="attc-doc"><span className="ic"><Ic n="book" s={19} /></span><span className="body"><span className="attc-eyebrow" style={{ marginBottom: 3 }}>Manual</span><span className="t">{d.title}</span><span className="m">{d.meta}</span></span></div></div>
  );
  if (d.type === "doc") return (
    <div className="attc"><div className="attc-doc file"><span className="ic"><Ic n="file" s={19} /></span><span className="body"><span className="t">{d.title}</span><span className="m">{d.ext} · {d.size} · {d.pages}</span></span><span className="dl"><Ic n="arrowRight" s={15} style={{ transform: "rotate(90deg)" }} /></span></div></div>
  );
  if (d.type === "quiz") return (
    <div className="attc"><div className="attc-doc quiz"><span className="ic"><Ic n="help" s={19} /></span><span className="body"><span className="attc-eyebrow" style={{ marginBottom: 3 }}>Quiz</span><span className="t">{d.title}</span><span className="m">{d.meta}</span></span></div></div>
  );
  if (d.type === "poll") {
    const tot = d.opts.reduce((a, o) => a + o[1], 0) || 1;
    return (
      <div className="attc"><div className="attc-pad">
        <div className="attc-eyebrow"><span className="ic"><Ic n="checkdoc" s={11} /></span> Spørring</div>
        <div className="attc-title" style={{ marginBottom: 4 }}>{d.q}</div>
        <div className="attc-poll-opt">
          {d.opts.map(([l, v], i) => <span key={i} className="attc-poll-row"><span className="attc-poll-bar" style={{ width: `${(v / tot) * 100}%` }} /><span>{l}</span><span className="v">{v}</span></span>)}
        </div>
      </div><div className="attc-foot"><span className="lbl">{tot} svar</span><span className="cta">Stem</span></div></div>
    );
  }
  return null;
}

// ---------- chat contact / settings page ----------
const PIN_OPTS = (window.SmartoutData || {}).CHAT_PIN_OPTS;
function ChatInfo({ conv, meta, onBack, onClose, pinned, setPinned, muted, setMuted, toast }) {
  const [pinExpand, setPinExpand] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const setPin = (val, label) => { setPinned(val); setPinExpand(false); toast && toast(val ? `Festet · ${label}` : "Løsnet", { undo: () => setPinned(pinned) }); };
  return (
    <div className="chat-info">
      <div className="chat-convhead">
        <button className="chat-back" onClick={onBack} title="Tilbake"><Ic n="chevLeft" s={20} /></button>
        <span className="chat-convid"><span className="chat-convname">{meta.group ? "Gruppeinfo" : "Kontaktinfo"}</span></span>
        <button className="chat-head-btn" onClick={onClose} title="Lukk"><Ic n="x" s={18} /></button>
      </div>
      <div className="chat-info-body">
        <div className="ci-hero">
          <span className={`chat-av ${meta.group ? "group" : ""}`} style={{ width: 92, height: 92, fontSize: 30, background: meta.color }}>{meta.group ? <Ic n="users" s={40} c="#fff" /> : meta.init}</span>
          <div className="ci-name">{meta.name}</div>
          <div className="ci-sub">{meta.group ? conv.sub : (meta.sub || "Ansatt") + " · +47 901 23 456"}</div>
          <div className="ci-actions">
            <button className="ci-act" onClick={() => toast && toast("Ringer " + meta.name.split(" ")[0] + "…")}><span className="ic"><Ic n="phone" s={19} /></span>Tale</button>
            <button className="ci-act" onClick={() => toast && toast("Videosamtale startet")}><span className="ic"><Ic n="video" s={19} /></span>Video</button>
            <button className="ci-act"><span className="ic"><Ic n="search" s={19} /></span>Søk</button>
          </div>
        </div>

        <button className="ci-media">
          <span className="ci-row-ic"><Ic n="image" s={18} /></span>
          <span className="ci-media-t">Medier, lenker og dokumenter</span>
          <span className="ci-media-cnt">8</span>
          <Ic n="chevRight" s={16} c="var(--muted)" />
        </button>
        <div className="ci-thumbs">
          {["#864ad2", "#00ab93", "#3B82F6", "#c18200"].map((c, i) => (
            <span key={i} className="ci-thumb" style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)` }}><Ic n={i === 3 ? "file" : "camera"} s={18} c="rgba(255,255,255,0.9)" /></span>
          ))}
        </div>

        <div className="ci-group">
          <button className="ci-row"><span className="ci-row-ic"><Ic n="star" s={18} /></span><span className="ci-row-t">Meldinger med stjerne</span><Ic n="chevRight" s={15} c="var(--muted)" /></button>
          <button className="ci-row" onClick={() => setMuted(m => !m)}>
            <span className="ci-row-ic"><Ic n={muted ? "bellOff" : "bell"} s={18} /></span>
            <span className="ci-row-t">Varslingsinnstillinger<span className="ci-row-s">{muted ? "Dempet" : "På"}</span></span>
            <span className={`sk-switch ${muted ? "" : "on"}`}><span /></span>
          </button>
          <button className="ci-row"><span className="ci-row-ic"><Ic n="clock" s={18} /></span><span className="ci-row-t">Meldinger som forsvinner<span className="ci-row-s">Av</span></span><Ic n="chevRight" s={15} c="var(--muted)" /></button>

          {/* PIN at a specific time */}
          <button className={`ci-row ${pinned ? "active" : ""}`} onClick={() => setPinExpand(e => !e)}>
            <span className="ci-row-ic"><Ic n="pin" s={18} /></span>
            <span className="ci-row-t">Fest samtale<span className="ci-row-s">{pinned ? "Festet · " + (PIN_OPTS.find(o => o[0] === pinned) || [, "aktiv"])[1] : "Av"}</span></span>
            <Ic n={pinExpand ? "chevUp" : "chevDown"} s={15} c="var(--muted)" />
          </button>
          {pinExpand && (
            <div className="ci-pin">
              <div className="ci-pin-lbl">Fest øverst i</div>
              <div className="ci-pin-opts">
                {PIN_OPTS.map(([k, l]) => k !== "egen"
                  ? <button key={k} className={`ci-pinchip ${pinned === k ? "on" : ""}`} onClick={() => setPin(k, l)}>{l}</button>
                  : null)}
              </div>
              <div className="ci-pin-custom">
                <span className="ci-pin-lbl" style={{ margin: 0 }}>Egendefinert</span>
                <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} />
                <button className="ci-pin-set" disabled={!customTime} onClick={() => setPin("egen", "til " + customTime)}>Fest</button>
              </div>
              {pinned && <button className="ci-pin-unset" onClick={() => setPin(null, "")}>Løsne samtale</button>}
            </div>
          )}

          <button className="ci-row"><span className="ci-row-ic"><Ic n="lock" s={18} /></span><span className="ci-row-t">Kryptering<span className="ci-row-s">Ende-til-ende-kryptert. Trykk for å bekrefte.</span></span></button>
        </div>

        <div className="ci-group">
          <button className="ci-row"><span className="ci-row-ic"><Ic n="heart" s={18} /></span><span className="ci-row-t">Legg til i favoritter</span></button>
          <button className="ci-row danger" onClick={() => toast && toast("Chat tømt")}><span className="ci-row-ic"><Ic n="ban" s={18} /></span><span className="ci-row-t">Tøm chat</span></button>
          {!meta.group && <button className="ci-row danger" onClick={() => toast && toast(meta.name + " blokkert")}><span className="ci-row-ic"><Ic n="ban" s={18} /></span><span className="ci-row-t">Blokker {meta.name}</span></button>}
          <button className="ci-row danger"><span className="ci-row-ic"><Ic n="thumbsDown" s={18} /></span><span className="ci-row-t">Rapporter {meta.group ? "gruppe" : meta.name.split(" ")[0]}</span></button>
          <button className="ci-row danger"><span className="ci-row-ic"><Ic n="trash" s={18} /></span><span className="ci-row-t">{meta.group ? "Forlat gruppe" : "Slett chat"}</span></button>
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ open, onClose }) {
  const SD = window.SmartoutData || { USERS: {} };
  const USERS = SD.USERS;
  const [convs, setConvs] = useState(CHAT_CONVS_INIT);
  const [active, setActive] = useState(null);
  const [composing, setComposing] = useState(false);
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState(CHAT_THREADS_INIT);
  const [unread, setUnread] = useState(CHAT_UNREAD_INIT);
  const [draft, setDraft] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pinnedMap, setPinnedMap] = useState({});
  const [mutedMap, setMutedMap] = useState({});
  const toast = useContext(ToastCtx);
  const logRef = useRef(null);

  // compose state
  const [mode, setMode] = useState("group");
  const [pickDate, setPickDate] = useState("fre");
  const [facets, setFacets] = useState({ dept: [], loc: [], team: [], role: [] });
  const [excluded, setExcluded] = useState({});

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [active, threads]);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") { infoOpen ? setInfoOpen(false) : (active || composing) ? (setActive(null), setComposing(false)) : onClose(); } };
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, active, composing, infoOpen]);

  const convMeta = (c) => c.type === "group"
    ? { name: c.name, sub: c.sub, init: (c.name || "?").slice(0, 2).toUpperCase(), color: c.c, group: true }
    : { name: (USERS[c.uid] || {}).name || c.uid, sub: (USERS[c.uid] || {}).role || "", init: (USERS[c.uid] || {}).initials || "?", color: (USERS[c.uid] || {}).color || "#888", group: false };
  const lastOf = (id) => { const t = threads[id]; return t && t.length ? t[t.length - 1] : null; };
  const senderName = (from) => from === "me" ? "Du" : ((USERS[from] || {}).name || (CHAT_STAFF.find(s => s.uid === from) || {}).name || "").split(" ")[0];

  const open1 = (id) => { setActive(id); setComposing(false); setInfoOpen(false); setUnread(u => { const n = { ...u }; delete n[id]; return n; }); };
  const send = () => {
    const t = draft.trim(); if (!t || !active) return;
    setThreads(p => ({ ...p, [active]: [...(p[active] || []), { from: "me", text: t, time: "nå" }] }));
    setDraft("");
  };
  const attach = (label, isMedia) => {
    setAttachOpen(false);
    if (!active) return;
    const card = CARD_SAMPLES[label] || { type: "generic", title: label };
    setThreads(p => ({ ...p, [active]: [...(p[active] || []), { from: "me", card, time: "nå" }] }));
    toast && toast(isMedia ? `${label} sendt` : `${label} delt i samtalen`);
  };

  // ---- compose helpers ----
  const toggleFacet = (key, val) => setFacets(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] }));
  const matchShift = (s) => mode === "now" ? s.now : mode === "today" ? s.today : mode === "date" ? s.dates.includes(pickDate) : true;
  const matchFacet = (s) => CHAT_FACETS.every(f => facets[f.key].length === 0 || facets[f.key].includes(s[f.key]));
  const filtered = CHAT_STAFF.filter(s => matchShift(s) && matchFacet(s));
  const recipients = mode === "group" ? filtered.filter(s => !excluded[s.uid]) : filtered;

  const startCompose = () => { setComposing(true); setStep(1); setActive(null); setMode("group"); setFacets({ dept: [], loc: [], team: [], role: [] }); setExcluded({}); };
  const facetSummary = () => CHAT_FACETS.flatMap(f => facets[f.key].map(v => f.key === "role" ? ROLE_LABEL[v] : v)).join(" · ");
  const confirmCompose = () => {
    if (recipients.length === 0) return;
    const sum = facetSummary();
    const base = mode === "group" ? "Ny gruppe"
      : mode === "now" ? "På vakt nå"
      : mode === "today" ? "På vakt i dag"
      : "På vakt " + (CHAT_DATES.find(d => d[0] === pickDate) || [])[1];
    const name = sum ? `${base} · ${sum}` : base;
    const id = "c" + Date.now();
    const color = mode === "group" ? "#864ad2" : mode === "now" ? "#11ad32" : "#f97316";
    setConvs(cs => [{ id, type: "group", name, sub: `${recipients.length} ${mode === "group" ? "medlemmer" : "mottakere"}`, c: color, online: mode === "now" }, ...cs]);
    setThreads(t => ({ ...t, [id]: [] }));
    setComposing(false);
    setActive(id);
  };

  if (!open) return null;
  const conv = active && convs.find(c => c.id === active);
  const list = convs.filter(c => convMeta(c).name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div className="bot-scrim" onClick={onClose} />
      <aside className="chat-panel" role="dialog" aria-label="Meldinger">
        {composing ? (
          <div className="chat-compose">
            <div className="chat-convhead">
              <button className="chat-back" onClick={() => step === 2 ? setStep(1) : setComposing(false)} title="Tilbake"><Ic n="chevLeft" s={20} /></button>
              <span className="chat-convid"><span className="chat-convname">Ny melding</span><span className="chat-convsub">{step === 1 ? "Steg 1 av 2 · hvem skal motta?" : "Steg 2 av 2 · mottakere"}</span></span>
              <button className="chat-head-btn" onClick={onClose} title="Lukk"><Ic n="x" s={18} /></button>
            </div>
            <div className="chat-stepbar">
              <div className={`chat-stepdot ${step === 1 ? "on" : "done"}`}><span className="n">{step === 1 ? "1" : <Ic n="check" s={12} sw={3} />}</span> Hvem</div>
              <span className={`chat-stepline ${step === 2 ? "done" : ""}`} />
              <div className={`chat-stepdot ${step === 2 ? "on" : ""}`}><span className="n">2</span> Filtrer</div>
            </div>

            {step === 1 ? (
              <>
                <div className="chat-cbody">
                  <div className="chat-audgrid">
                    {AUD_MODES.map(a => (
                      <button key={a.id} className={`chat-audcard ${mode === a.id ? "on" : ""}`} onClick={() => setMode(a.id)}>
                        <span className="ic"><Ic n={a.ic} s={19} /></span>
                        <span className="ttl">{a.ttl}{a.live && <span className="live">LIVE</span>}</span>
                        <span className="desc">{a.desc}</span>
                        <span className="chk"><Ic n="check" s={12} sw={3} /></span>
                      </button>
                    ))}
                  </div>
                  {mode === "date" && (
                    <>
                      <div className="chat-cs-lbl">Velg dag</div>
                      <div className="chat-fchips">
                        {CHAT_DATES.map(([k, l]) => <button key={k} className={`chat-datechip ${pickDate === k ? "on" : ""}`} onClick={() => setPickDate(k)}>{l}</button>)}
                      </div>
                    </>
                  )}
                </div>
                <div className="chat-foot">
                  <button className="chat-send" style={{ width: "100%", borderRadius: 11, height: 44, gap: 8, fontWeight: 600, fontSize: 13.5 }} onClick={() => setStep(2)}>
                    Neste · velg mottakere <Ic n="arrowRight" s={16} c="#fff" sw={2.2} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="chat-cbody">
                  {(() => { const a = AUD_MODES.find(x => x.id === mode) || {}; return (
                    <div className="chat-audsum">
                      <span className="ic"><Ic n={a.ic} s={17} /></span>
                      <span className="body"><span className="t">{a.ttl}{mode === "date" ? " · " + (CHAT_DATES.find(d => d[0] === pickDate) || [])[1] : ""}</span><span className="s">{a.desc}</span></span>
                      <span className="edit" onClick={() => setStep(1)}>Endre</span>
                    </div>
                  ); })()}

                  <div className="chat-cs-lbl">Filtrer mottakere</div>
                  {CHAT_FACETS.map(f => (
                    <div key={f.key} className="chat-facet">
                      <div className="chat-facet-lbl">{f.label}{facets[f.key].length > 0 && <span style={{ color: "var(--orange-dark)", fontWeight: 700 }}> · {facets[f.key].length}</span>}</div>
                      <div className="chat-fchips">
                        {f.opts.map(o => (
                          <button key={o} className={`chat-fchip ${facets[f.key].includes(o) ? "on" : ""}`} onClick={() => toggleFacet(f.key, o)}>
                            {f.key === "role" ? ROLE_LABEL[o] : o}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="chat-cs-lbl">Mottakere</div>
                  <div className="chat-countbar">
                    <span className="big">{recipients.length}</span>
                    <span className="lbl">{mode === "group" ? "valgt" : "mottakere"}</span>
                    <span className="stack">
                      {recipients.slice(0, 4).map(s => <span key={s.uid} className="chat-av" style={{ background: s.c }}>{s.init}</span>)}
                      {recipients.length > 4 && <span className="more">+{recipients.length - 4}</span>}
                    </span>
                  </div>
                  <div className="chat-recip">
                    <div className="chat-recip-top">
                      <span className="chat-recip-cnt">{mode === "group" ? "Velg medlemmer" : "Treffer disse"}</span>
                      {mode === "group" && Object.keys(excluded).length > 0 && <span className="chat-recip-clear" onClick={() => setExcluded({})}>Velg alle</span>}
                    </div>
                    {filtered.length === 0 ? (
                      <div className="chat-recip-empty">Ingen matcher dette utvalget.</div>
                    ) : filtered.map(s => (
                      <div key={s.uid} className="chat-memrow" onClick={() => mode === "group" && setExcluded(e => ({ ...e, [s.uid]: !e[s.uid] }))} style={{ cursor: mode === "group" ? "pointer" : "default" }}>
                        <span className="chat-av" style={{ width: 32, height: 32, fontSize: 12, background: s.c }}>{s.init}</span>
                        <span className="chat-mem-info"><span className="chat-mem-name">{s.name}</span><span className="chat-mem-meta">{s.dept} · {s.loc} · {ROLE_LABEL[s.role]}</span></span>
                        {mode === "group"
                          ? <span className={`chat-check ${!excluded[s.uid] ? "on" : ""}`}>{!excluded[s.uid] && <Ic n="check" s={13} sw={2.6} />}</span>
                          : (s.now && <span className="attc-pill ok">På vakt</span>)}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="chat-foot">
                  <button className="chat-send" style={{ width: "100%", borderRadius: 11, height: 44, gap: 8, fontWeight: 600, fontSize: 13.5 }} disabled={recipients.length === 0} onClick={confirmCompose}>
                    <Ic n={mode === "group" ? "users" : "message"} s={16} c="#fff" /> {mode === "group" ? `Opprett gruppechat (${recipients.length})` : `Opprett samtale (${recipients.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : !conv ? (
          <>
            <div className="chat-head">
              <span className="chat-head-t">Meldinger</span>
              <button className="chat-head-btn" title="Ny melding" onClick={startCompose}><Ic n="plus" s={19} /></button>
              <button className="chat-head-btn" onClick={onClose} title="Lukk"><Ic n="x" s={18} /></button>
            </div>
            <div className="chat-searchwrap">
              <div className="chat-search"><Ic n="search" s={15} c="var(--muted)" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søk i samtaler…" /></div>
            </div>
            <div className="chat-list">
              {list.map(c => {
                const m = convMeta(c); const last = lastOf(c.id); const u = unread[c.id];
                return (
                  <button key={c.id} className="chat-row" onClick={() => open1(c.id)}>
                    <span className="chat-avatar">
                      <span className={`chat-av ${m.group ? "group" : ""}`} style={{ background: m.color }}>{m.group ? <Ic n="users" s={18} c="#fff" /> : m.init}</span>
                      {c.online && <span className="chat-online" />}
                    </span>
                    <span className="chat-rowbody">
                      <span className="chat-rowtop"><span className="chat-rowname">{m.name}</span><span className={`chat-rowtime ${u ? "unread" : ""}`}>{last ? last.time : ""}</span></span>
                      <span className="chat-rowbot">
                        <span className="chat-rowlast">{last ? (<>{(m.group || last.from === "me") && <span className="me">{senderName(last.from)}: </span>}{last.text}</>) : "Ingen meldinger ennå"}</span>
                        {u ? <span className="chat-unread">{u}</span> : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : conv && infoOpen ? (
          <ChatInfo conv={conv} meta={convMeta(conv)} onBack={() => setInfoOpen(false)} onClose={onClose}
            pinned={pinnedMap[conv.id] || null} setPinned={(v) => setPinnedMap(p => ({ ...p, [conv.id]: typeof v === "function" ? v(p[conv.id]) : v }))}
            muted={!!mutedMap[conv.id]} setMuted={(v) => setMutedMap(p => ({ ...p, [conv.id]: typeof v === "function" ? v(p[conv.id]) : v }))}
            toast={toast} />
        ) : (
          <div className="chat-conv">
            {(() => { const m = convMeta(conv); return (
              <div className="chat-convhead">
                <button className="chat-back" onClick={() => setActive(null)} title="Tilbake"><Ic n="chevLeft" s={20} /></button>
                <span className="chat-avatar">
                  <span className={`chat-av ${m.group ? "group" : ""}`} style={{ width: 36, height: 36, fontSize: 12, background: m.color }}>{m.group ? <Ic n="users" s={16} c="#fff" /> : m.init}</span>
                  {conv.online && <span className="chat-online" />}
                </span>
                <span className="chat-convid chat-convid-btn" onClick={() => setInfoOpen(true)} role="button" tabIndex={0}>
                  <span className="chat-convname">{m.name}{pinnedMap[conv.id] && <span className="chat-pindot" title="Festet"><Ic n="pin" s={12} /></span>}</span>
                  <span className="chat-convsub">{m.group ? m.sub : (conv.online ? <span className="on">aktiv nå</span> : "sist sett nylig")}</span>
                </span>
                <button className="chat-head-btn" title="Kontaktinfo" onClick={() => setInfoOpen(true)}><Ic n="settings" s={17} /></button>
                <button className="chat-head-btn" onClick={onClose} title="Lukk"><Ic n="x" s={18} /></button>
              </div>
            ); })()}
            <div className="chat-log" ref={logRef}>
              <div className="chat-daydiv">I dag</div>
              {(threads[active] || []).length === 0 && <div className="chat-recip-empty" style={{ alignSelf: "center", marginTop: 12 }}>Ny samtale — skriv den første meldingen.</div>}
              {(threads[active] || []).map((msg, i) => {
                const me = msg.from === "me"; const m = convMeta(conv);
                const showSender = !me && m.group;
                return (
                  <div key={i} className={`chat-m ${me ? "me" : "them"}`}>
                    {showSender && <span className="chat-sender" style={{ color: (USERS[msg.from] || {}).color }}>{senderName(msg.from)}</span>}
                    {msg.card
                      ? <ChatCard d={msg.card} />
                      : <span className="chat-bubble">{msg.text}</span>}
                    <span className="chat-time">{msg.time}{me && <Ic n="check" s={11} c="var(--info)" sw={2.6} />}</span>
                  </div>
                );
              })}
            </div>
            <div className="chat-foot">
              {attachOpen && <div className="chat-am-scrim" onClick={() => setAttachOpen(false)} />}
              {attachOpen && (
                <div className="chat-attachmenu">
                  <button className="chat-am-item" onClick={() => attach("Bilde", true)}><span className="ic"><Ic n="camera" s={16} /></span> Bilde</button>
                  <button className="chat-am-item" onClick={() => attach("Video", true)}><span className="ic"><Ic n="video" s={16} /></span> Video</button>
                  <div className="chat-am-sec">Snarvei</div>
                  {[["calendar", "Event"], ["users", "Booking"], ["list", "Oppgave"], ["grid", "Vakt"], ["book", "Manual"], ["file", "Dokument"], ["help", "Quiz"], ["checkdoc", "Spørring"]].map(([ic, l]) => (
                    <button key={l} className="chat-am-item" onClick={() => attach(l, false)}><span className="ic"><Ic n={ic} s={16} /></span> {l}</button>
                  ))}
                </div>
              )}
              <div className="chat-inputbar">
                <button className={`chat-attach ${attachOpen ? "on" : ""}`} title="Legg ved" onClick={() => setAttachOpen(o => !o)}><Ic n="plus" s={18} /></button>
                <div className="chat-field"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }} placeholder="Skriv en melding…" /></div>
                <button className="chat-send" disabled={!draft.trim()} onClick={send}><Ic n="arrowRight" s={18} c="#fff" sw={2.2} /></button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

// ---------- page host ----------
function StubPage({ route }) {
  const item = ALL_NAV.find(x => x.id === route);
  const label = item ? item.label : route;
  return (
    <main className="sk-main">
      <div className="sk-wrap">
        <div className="sk-page-head">
          <div><div className="sk-eyebrow">Smartout</div><h1 className="sk-page-title">{label}</h1></div>
          <div className="sk-page-actions">
            <button className="sk-ghost"><Ic n="settings" s={15} /> Filter</button>
            <CreateButton />
          </div>
        </div>
        <div className="sk-stub-kpis">
          {[0, 1, 2, 3].map(i => <div key={i} className="sk-stub-kpi"><span className="sk-stub-bar" style={{ width: "42%", height: 9 }} /><span className="sk-stub-bar" style={{ width: "58%", height: 22 }} /></div>)}
        </div>
        <div className="sk-stub-panel">
          <div className="sk-stub-head"><span className="sk-stub-bar" style={{ width: 130, height: 11 }} /><span className="sk-stub-bar" style={{ width: 60, height: 11 }} /></div>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="sk-stub-row">
              <span className="sk-stub-dot" />
              <span className="sk-stub-bar" style={{ width: `${32 + (i % 3) * 16}%`, height: 11 }} />
              <span style={{ flex: 1 }} />
              <span className="sk-stub-bar" style={{ width: 60, height: 11 }} />
              <span className="sk-stub-bar" style={{ width: 28, height: 28, borderRadius: "50%" }} />
            </div>
          ))}
        </div>
        <div className="sk-stub-tag"><Ic n="sparkle" s={13} c="var(--muted-soft)" /> {label} — interaktiv flate kobles på i neste runde</div>
      </div>
    </main>
  );
}

function Page({ route, setRoute }) {
  const Custom = window.SO_PAGES && window.SO_PAGES[route];
  if (Custom) return <Custom setRoute={setRoute} />;
  return <StubPage route={route} />;
}

// Page-level error boundary — a single page throwing must never blank the whole
// app. Logs the real error (visible in console), shows a recoverable fallback,
// and auto-resets when the route changes (via key={route} at the call site).
class PageBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error("[Smartout] page render error on '" + this.props.route + "':", err, info); } catch (e) {} }
  render() {
    if (this.state.err) {
      const msg = String((this.state.err && this.state.err.message) || this.state.err);
      return (
        <main className="sk-main">
          <div className="sk-errpage" role="alert">
            <span className="sk-errpage-ic"><Ic n="alert" s={26} /></span>
            <h2>Noe gikk galt på denne siden</h2>
            <p>Vi klarte ikke å vise denne siden akkurat nå. Prøv igjen, eller gå tilbake til oversikten.</p>
            <pre className="sk-errpage-msg">{msg}</pre>
            <div className="sk-errpage-actions">
              <button className="sk-errpage-btn primary" onClick={() => this.props.onHome && this.props.onHome()}>Til oversikten</button>
              <button className="sk-errpage-btn" onClick={() => location.reload()}>Last inn på nytt</button>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

// ---------- access denied (route protection boundary) ----------
function AccessDenied({ onHome }) {
  return (
    <main className="sk-main">
      <div className="sk-wrap">
        <div className="sk-denied">
          <span className="ic"><Ic n="shield" s={26} /></span>
          <div className="t">Ingen tilgang</div>
          <div className="s">Denne flaten krever lederrettigheter. Du er logget inn som ansatt og har ikke tilgang til administrasjon.</div>
          <button className="sk-primary" onClick={onHome}><Ic n="arrowRight" s={15} sw={2.2} /> Til Min side</button>
        </div>
      </div>
    </main>
  );
}

// ---------- login / auth screen ----------
function Login({ onLogin }) {
  const [email, setEmail] = useState("maria@bistronord.no");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 2000);
    return () => clearTimeout(t);
  }, []);
  const submit = (e) => {
    if (e) e.preventDefault();
    if (!email.trim() || !pw.trim()) { setErr("Fyll inn e-post og passord for å logge inn."); return; }
    setErr(""); setBusy(true);
    setTimeout(() => onLogin({ canAdmin: true }), 600);
  };
  const quick = (canAdmin) => { setErr(""); setBusy(true); setTimeout(() => onLogin({ canAdmin }), 420); };
  return (
    <div className={"auth" + (intro ? " auth-precover" : "")}>
      <div className={"auth-intro" + (intro ? "" : " gone")} aria-hidden="true">
        <span className="auth-intro-glow" />
        <img className="auth-intro-mark" src="assets/smartout-icon.png" alt="Smartout" />
      </div>
      <aside className="auth-brand">
        <div className="auth-stage" aria-hidden="true">
          <span className="auth-aurora a1" />
          <span className="auth-aurora a2" />
          <span className="auth-vign" />
          <span className="auth-grain" />
        </div>

        <div className="auth-brand-top">
          <span className="auth-wm"><img className="auth-wm-mark" src="assets/smartout-icon.png" alt="" /> Smartout</span>
        </div>

        <div className="auth-hero">
          <div className="auth-mark-wrap">
            <span className="auth-mark-ring r1" />
            <span className="auth-mark-ring r2" />
            <span className="auth-mark-glow" />
            <img className="auth-mark" src="assets/smartout-icon.png" alt="Smartout" />
          </div>
          <h1 className="auth-head">
            <span className="ln"><span>Rolig oversikt.</span></span>
            <span className="ln"><span>Selv på en travel dag.</span></span>
          </h1>
          <p className="auth-tag">Vakter, oppgaver, HMS og kommunikasjon — samlet ett sted for hele teamet på Bistro Nord.</p>
        </div>

        <div className="auth-brand-foot">
          <span className="auth-chip"><Ic n="shield" s={14} /> Sikker pålogging</span>
          <span className="auth-chip"><Ic n="bot" s={14} /> Mr. Botsson hjelper deg i gang</span>
        </div>
      </aside>

      <main className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <span className="auth-logo auth-logo-sm"><img className="auth-logo-mark" src="assets/smartout-icon.png" alt="" /> Smartout</span>
          <h2>Logg inn</h2>
          <p className="auth-sub">Velkommen tilbake. Logg inn for å fortsette.</p>

          <label className="auth-field">
            <span>E-post</span>
            <input type="email" value={email} autoComplete="username" onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="navn@bistronord.no" />
          </label>
          <label className="auth-field">
            <span>Passord</span>
            <div className="auth-pw">
              <input type={show ? "text" : "password"} value={pw} autoComplete="current-password" onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="Skriv passordet ditt" />
              <button type="button" className="auth-eye" onClick={() => setShow(s => !s)} aria-label={show ? "Skjul passord" : "Vis passord"}><Ic n={show ? "eyeOff" : "eye"} s={16} /></button>
            </div>
          </label>

          {err && <div className="auth-err"><Ic n="alert" s={14} /> {err}</div>}

          <div className="auth-row">
            <label className="auth-remember"><input type="checkbox" defaultChecked /> Husk meg</label>
            <button type="button" className="auth-link" onClick={() => setErr("")}>Glemt passord?</button>
          </div>

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? <><span className="auth-spin" /> Logger inn…</> : <>Logg inn <Ic n="arrowRight" s={16} /></>}
          </button>

          <div className="auth-or"><span>eller logg rett inn som</span></div>
          <div className="auth-quick">
            <button type="button" className="auth-quick-btn" disabled={busy} onClick={() => quick(true)}>
              <span className="auth-quick-av" style={{ background: "#FF7849" }}>MA</span>
              <span className="auth-quick-id"><b>Maria A.</b><small>Driftsleder · leder</small></span>
              <Ic n="arrowRight" s={15} c="var(--muted)" />
            </button>
            <button type="button" className="auth-quick-btn" disabled={busy} onClick={() => quick(false)}>
              <span className="auth-quick-av" style={{ background: "#10B981" }}>SL</span>
              <span className="auth-quick-id"><b>Selma L.</b><small>Servitør · ansatt</small></span>
              <Ic n="arrowRight" s={15} c="var(--muted)" />
            </button>
          </div>
        </form>
        <p className="auth-legal">Ved å logge inn godtar du Smartouts vilkår og personvern.</p>
      </main>
    </div>
  );
}

// ---------- app ----------
function App() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem("so_app") || "{}"); } catch { return {}; } })();
  // auth gate — logged in unless explicitly logged out (persisted)
  const [authed, setAuthed] = useState(() => { try { return localStorage.getItem("so_auth") !== "0"; } catch { return true; } });
  // role grant: defaults to the user's real grant; persisted demo override allowed
  const [canAdmin, setCanAdmin] = useState(typeof saved.canAdmin === "boolean" ? saved.canAdmin : CURRENT_USER.canAdmin);
  // mode: a non-admin can never start in admin mode, even via tampered storage
  const initialMode = (saved.mode === "admin" && (typeof saved.canAdmin === "boolean" ? saved.canAdmin : CURRENT_USER.canAdmin)) ? "admin"
    : saved.mode === "private" ? "private"
    : ((typeof saved.canAdmin === "boolean" ? saved.canAdmin : CURRENT_USER.canAdmin) ? "admin" : "private");
  const [mode, setMode] = useState(initialMode);
  const [route, setRoute] = useState(routesFor(initialMode).includes(saved.route) ? saved.route : homeFor(initialMode));
  const [collapsed, setCollapsed] = useState(!!saved.collapsed);
  const [theme, setTheme] = useState(saved.theme || "light");
  const [season, setSeason] = useState(saved.season || "vinter");
  const [openMenu, setOpenMenu] = useState(null);
  const [botOpen, setBotOpen] = useState(false);
  const [botSeed, setBotSeed] = useState(null);   // { q, t } — a seeded question for Botsson
  const [chatOpen, setChatOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [overlay, setOverlay] = useState(null);      // null | 'profile' | 'settings'
  const [docMode, setDocMode] = useState(false);     // Dokumentmodus swaps the sidebar
  const [docChapter, setDocChapter] = useState(9);
  const searchRef = useRef(null);
  const toggleBot = () => setBotOpen(o => { if (!o) setChatOpen(false); return !o; });
  const toggleChat = () => setChatOpen(o => { if (!o) setBotOpen(false); return !o; });
  const enterDoc = () => { setDocMode(true); setOverlay(null); setOpenMenu(null); setCmdOpen(false); };

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  // expose a small, safe hook so pages can open the Meldinger panel (Ring/Melding from Ansatte)
  useEffect(() => {
    window.SmartoutChat = { open: () => { setChatOpen(true); setBotOpen(false); }, close: () => setChatOpen(false) };
    window.SmartoutBot = {
      open: (q) => { setBotOpen(true); setChatOpen(false); if (q) setBotSeed({ q, t: Date.now() }); },
      ask: (q) => { setBotOpen(true); setChatOpen(false); setBotSeed({ q, t: Date.now() }); },
      close: () => setBotOpen(false),
    };
    return () => { try { delete window.SmartoutChat; delete window.SmartoutBot; } catch (e) {} };
  }, []);

  // central «Skap ny» router — routes each create action to the page that owns its
  // real shared component, and leaves a one-shot hint the destination reads on mount.
  useEffect(() => {
    window.SmartoutCreate = (kind) => {
      const k = String(kind || "").toLowerCase();
      if (k === "dokument") { enterDoc(); return; }
      const ROUTE = { "oppgave": "oppgaver", "vakt": "vaktplan", "kunngjøring": "kommunikasjon", "avvik": "hms", "booking": "planlegging", "event": "planlegging" };
      const r = ROUTE[k];
      if (!r) return;
      window.__pendingCreate = (k === "kunngjøring") ? "kunngjoring" : k;
      goRoute(r);
    };
    return () => { try { delete window.SmartoutCreate; } catch (e) {} };
  }, [mode, canAdmin]);

  // ===== access control / route protection (enforced, not just hidden) =====
  useEffect(() => {
    // 1. a user without the admin grant can never be in admin mode
    if (mode === "admin" && !canAdmin) { setMode("private"); return; }
    // 2. the active route must belong to the active mode's allowed set
    if (!routesFor(mode).includes(route)) setRoute(homeFor(mode));
  }, [mode, canAdmin, route]);

  const changeMode = (m) => {
    if (m === "admin" && !canAdmin) return;               // guard at the switch
    setMode(m);
    setRoute(homeFor(m));                                  // land on the mode's home
    setOpenMenu(null);
  };

  useEffect(() => { localStorage.setItem("so_app", JSON.stringify({ route, mode, canAdmin, theme, collapsed, season })); }, [route, mode, canAdmin, theme, collapsed, season]);
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  // guard the rendered page too: block disallowed routes at the render boundary
  const routeAllowed = routesFor(mode).includes(route);
  const goRoute = (r) => { if (routesFor(mode).includes(r)) { setRoute(r); } else if (canAdmin && ADMIN_NAV.some(n => n.id === r)) { setMode("admin"); setRoute(r); } setOverlay(null); setDocMode(false); };

  // ----- auth: login lands in the right mode; logout returns to the Login screen -----
  const login = (opts = {}) => {
    if (typeof opts.canAdmin === "boolean") {
      setCanAdmin(opts.canAdmin);
      const m = opts.canAdmin ? "admin" : "private";
      setMode(m); setRoute(homeFor(m));
    }
    setAuthed(true);
    try { localStorage.setItem("so_auth", "1"); } catch (e) {}
  };
  const logout = () => {
    setOverlay(null); setOpenMenu(null); setDocMode(false); setBotOpen(false); setChatOpen(false); setCmdOpen(false);
    setAuthed(false);
    try { localStorage.setItem("so_auth", "0"); } catch (e) {}
  };
  if (!authed) return <ToastHost><Login onLogin={login} /></ToastHost>;

  // ----- Dokumentmodus: swap sidebar + content, keep top bar -----
  if (docMode) {
    return (
      <ToastHost>
        <div className="sk-app">
          <TopBar theme={theme} setTheme={setTheme} openMenu={openMenu} setOpenMenu={setOpenMenu} onOpenCmd={() => setCmdOpen(true)} botOpen={botOpen} onToggleBot={toggleBot} chatOpen={chatOpen} onToggleChat={toggleChat} onOpenDoc={enterDoc} season={season} setSeason={setSeason} />
          <div className="sk-body">
            {window.HandbookApp
              ? <window.HandbookApp onExit={() => setDocMode(false)} collapsed={collapsed} openBot={() => { setBotOpen(true); setChatOpen(false); }} />
              : <><DocSide active={docChapter} setActive={setDocChapter} onExit={() => setDocMode(false)} collapsed={collapsed} /><DocContent active={docChapter} /></>}
          </div>
          <BotssonChat open={botOpen} onClose={() => setBotOpen(false)} seed={botSeed} />
          <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
          <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} mode={mode} canAdmin={canAdmin} go={goRoute} openBot={() => { setCmdOpen(false); setBotOpen(true); setChatOpen(false); }} openProfile={() => { setDocMode(false); setOverlay("profile"); }} openSettings={() => { setDocMode(false); setOverlay("settings"); }} openDoc={enterDoc} />
        </div>
      </ToastHost>
    );
  }

  return (
    <ToastHost>
      <div className="sk-app">
        <TopBar theme={theme} setTheme={setTheme} openMenu={openMenu} setOpenMenu={setOpenMenu} onOpenCmd={() => setCmdOpen(true)} botOpen={botOpen} onToggleBot={toggleBot} chatOpen={chatOpen} onToggleChat={toggleChat} onOpenDoc={enterDoc} season={season} setSeason={setSeason} />
        <div className="sk-body">
          <Side route={route} setRoute={(r) => { setRoute(r); setOverlay(null); setOpenMenu(null); }} collapsed={collapsed} setCollapsed={setCollapsed} mode={mode} setMode={changeMode} canAdmin={canAdmin} setCanAdmin={setCanAdmin} openMenu={openMenu} setOpenMenu={setOpenMenu} openProfile={() => setOverlay("profile")} openSettings={() => setOverlay("settings")} onLogout={logout} />
          {overlay === "profile" ? <ProfilePage onClose={() => setOverlay(null)} />
            : overlay === "settings" ? <SettingsPage onClose={() => setOverlay(null)} theme={theme} setTheme={setTheme} onLogout={logout} />
            : routeAllowed ? <PageBoundary key={route} route={route} onHome={() => setRoute(homeFor(mode))}><Page route={route} setRoute={setRoute} /></PageBoundary> : <AccessDenied onHome={() => setRoute(homeFor(mode))} />}
        </div>
        <BotssonChat open={botOpen} onClose={() => setBotOpen(false)} seed={botSeed} />
        <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} mode={mode} canAdmin={canAdmin} go={goRoute} openBot={() => { setCmdOpen(false); setBotOpen(true); setChatOpen(false); }} openProfile={() => setOverlay("profile")} openSettings={() => setOverlay("settings")} openDoc={enterDoc} />
      </div>
    </ToastHost>
  );
}

window.SO_PAGES = window.SO_PAGES || {};
window.__SmartoutBoot = function () {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
};
