// shared.jsx — common pieces: icons, top bar, sidebar shell, right panel tabs

// ─── Inline SVG icon set (Lucide-style) ─────────────────────────
const Icon = ({ name, size = 16, stroke = 1.6, style }) => {
  const c = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "inline-block", flexShrink: 0, ...style },
    "aria-hidden": "true",
  };
  switch (name) {
    case "chev-right":  return <svg {...c}><path d="m9 18 6-6-6-6"/></svg>;
    case "chev-left":   return <svg {...c}><path d="m15 18-6-6 6-6"/></svg>;
    case "chev-down":   return <svg {...c}><path d="m6 9 6 6 6-6"/></svg>;
    case "check":       return <svg {...c}><path d="M20 6 9 17l-5-5"/></svg>;
    case "bell":        return <svg {...c}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
    case "book":        return <svg {...c}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>;
    case "moon":        return <svg {...c}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
    case "alert":       return <svg {...c}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
    case "shield":      return <svg {...c}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
    case "thermometer": return <svg {...c}><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/></svg>;
    case "fire":        return <svg {...c}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a4 4 0 1 0 8-4c0-1.5-.5-2-1.5-3.5C16 7.5 16 7 16 6.5a3.5 3.5 0 0 0-3.5-3.5c.5 2-1 3.5-2.5 5C8.5 9.5 5 12 5 16a6 6 0 1 0 12 0"/></svg>;
    case "users":       return <svg {...c}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "list":        return <svg {...c}><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>;
    case "checksquare": return <svg {...c}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
    case "table":       return <svg {...c}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>;
    case "calendar":    return <svg {...c}><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>;
    case "clock":       return <svg {...c}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "settings":    return <svg {...c}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "help":        return <svg {...c}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
    case "paperclip":   return <svg {...c}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.8L9.41 17.32a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>;
    case "sparkles":    return <svg {...c}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>;
    case "file":        return <svg {...c}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>;
    case "filepdf":     return <svg {...c}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="7" y="18" fontSize="6" stroke="none" fill="currentColor" fontWeight="700" fontFamily="monospace">PDF</text></svg>;
    case "upload":      return <svg {...c}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>;
    case "download":    return <svg {...c}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
    case "send":        return <svg {...c}><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>;
    case "eye":         return <svg {...c}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "history":     return <svg {...c}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>;
    case "play":        return <svg {...c}><polygon points="5 3 19 12 5 21 5 3"/></svg>;
    case "save":        return <svg {...c}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
    case "lock":        return <svg {...c}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case "more":        return <svg {...c}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;
    case "grip":        return <svg {...c}><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>;
    case "plus":        return <svg {...c}><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
    case "x":           return <svg {...c}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
    case "wand":        return <svg {...c}><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>;
    case "h1":          return <svg {...c} fontSize="9"><path d="M4 4v16"/><path d="M12 4v16"/><path d="M4 12h8"/><text x="14" y="20" fill="currentColor" stroke="none" fontFamily="monospace" fontWeight="700">1</text></svg>;
    case "h2":          return <svg {...c} fontSize="9"><path d="M4 4v16"/><path d="M12 4v16"/><path d="M4 12h8"/><text x="14" y="20" fill="currentColor" stroke="none" fontFamily="monospace" fontWeight="700">2</text></svg>;
    case "bold":        return <svg {...c}><path d="M14 12a4 4 0 0 0 0-8H6v8"/><path d="M15 20a4 4 0 0 0 0-8H6v8z"/></svg>;
    case "italic":      return <svg {...c}><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>;
    case "underline":   return <svg {...c}><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>;
    case "quote":       return <svg {...c}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>;
    case "list-ul":     return <svg {...c}><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>;
    case "list-ol":     return <svg {...c}><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>;
    case "undo":        return <svg {...c}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 2.95L3 13"/></svg>;
    case "redo":        return <svg {...c}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.7 2.95L21 13"/></svg>;
    case "search":      return <svg {...c}><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>;
    case "filter":      return <svg {...c}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
    case "print":       return <svg {...c}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>;
    case "folder":      return <svg {...c}><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>;
    case "globe":       return <svg {...c}><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
    case "warning-tri": return <svg {...c}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
    case "branch":      return <svg {...c}><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>;
    case "dot":         return <svg {...c}><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
    case "home":        return <svg {...c}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "bot":         return <svg {...c}><rect width="18" height="10" x="3" y="11" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" x2="8" y1="16" y2="16"/><line x1="16" x2="16" y1="16" y2="16"/></svg>;
    case "wallet":      return <svg {...c}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>;
    case "bar":         return <svg {...c}><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>;
    case "chat":        return <svg {...c}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case "hash":        return <svg {...c}><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>;
    case "grid":        return <svg {...c}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>;
    case "clipboard":   return <svg {...c}><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>;
    case "gradcap":     return <svg {...c}><path d="M22 10v6"/><path d="M2 10 12 5l10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>;
    case "doc":         return <svg {...c}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" x2="14" y1="13" y2="13"/><line x1="8" x2="14" y1="17" y2="17"/></svg>;
    case "edit":        return <svg {...c}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>;
    case "trash":       return <svg {...c}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
    default: return null;
  }
};

// ─── Logo mark ────────────────────────────────────────────────
const LogoMark = ({ size = 22 }) => (
  <span style={{
    width: size, height: size,
    background: "var(--brand-orange)",
    color: "white",
    borderRadius: 6,
    display: "inline-grid",
    placeItems: "center",
    fontSize: size * 0.55,
    fontFamily: "var(--font-heading)",
    lineHeight: 1,
    fontWeight: 700,
    boxShadow: "var(--shadow-brand-glow)",
  }}>S</span>
);

// ─── Topbar (standardized) ──────────────────────────────────────
const HmsTopbar = ({ extraLeft, search = "Søk i drift..." }) => (
  <div className="hms-topbar">
    <div className="hms-topbar-left">
      <div className="hms-workspace-pill">
        <span className="ws-mark" style={{ background: "var(--brand-orange)", color: "white" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h.01"/><path d="M14 9h.01"/><path d="M9 13h.01"/><path d="M14 13h.01"/><path d="M9 17h.01"/><path d="M14 17h.01"/>
          </svg>
        </span>
        <span>HQ Workspace</span>
        <span className="chev"><Icon name="chev-right" size={13}/></span>
      </div>
      <div className="hms-season">
        <span>Aktiv sesong:</span>
        <strong>Vinter 2026</strong>
        <span className="hms-active-badge"><span className="dot"/> Aktiv</span>
      </div>
      {extraLeft}
    </div>

    <div className="hms-search">
      <Icon name="search" size={14} style={{ color: "var(--muted-fg)" }}/>
      <input placeholder={search} readOnly/>
      <span className="kbd">Ctrl+K</span>
    </div>

    <div className="hms-topbar-right">
      <button className="hms-iconbtn" title="Håndbok"><Icon name="book" size={18}/></button>
      <button className="hms-iconbtn" title="Tema"><Icon name="moon" size={18}/></button>
      <button className="hms-iconbtn" title="Varsler">
        <Icon name="bell" size={18}/>
        <span className="badge-count">4</span>
      </button>
      <button className="btn-new">
        <Icon name="plus" size={14} stroke={2.4}/> Ny
        <Icon name="chev-down" size={13}/>
      </button>
    </div>
  </div>
);

// ─── Standardized dashboard side-nav (used on /dashboard/*) ─────
const DASHBOARD_NAV = [
  { ic: "home",     lbl: "Oversikt" },
  { ic: "list-ol",  lbl: "Oppgaver" },
  { ic: "calendar", lbl: "Planlegging" },
  { ic: "calendar", lbl: "Vaktplan" },
  { ic: "users",    lbl: "Ansatte" },
  { ic: "shield",   lbl: "HMS", brand: true },
  { ic: "wallet",   lbl: "Lønn" },
  { ic: "checksquare", lbl: "Avstemming" },
  { ic: "bar",      lbl: "Rapporter" },
  { ic: "chat",     lbl: "Chat" },
  { ic: "hash",     lbl: "Kommunikasjon", badge: 5 },
];

const HmsDashboardSide = ({ active = "HMS", hmsDot = true }) => (
  <aside className="hms-side hms-side-dash">
    <div className="hms-side-head">
      <div style={{ flex: 1 }}/>
      <button className="hms-side-collapse"><Icon name="chev-left" size={13}/></button>
    </div>

    <div className="hms-dash-nav">
      {DASHBOARD_NAV.map(it => {
        const isActive = it.lbl === active;
        return (
          <div key={it.lbl} className={`dash-row ${isActive ? "is-active" : ""} ${it.brand && isActive ? "is-brand" : ""}`}>
            <span className="dash-ic"><Icon name={it.ic} size={16}/></span>
            <span className="dash-lbl">{it.lbl}</span>
            {it.badge && (
              <span className="dash-badge">{it.badge}</span>
            )}
            {it.lbl === "HMS" && hmsDot && isActive && (
              <span className="dash-status-dot" title="Setup pågår"/>
            )}
          </div>
        );
      })}
    </div>

    <div className="hms-dash-foot">
      <div className="dash-row" style={{ marginBottom: 0 }}>
        <span className="dash-ic" style={{ color: "var(--brand-orange)" }}><Icon name="bot" size={16}/></span>
        <span className="dash-lbl">Mr. Botsson</span>
      </div>
    </div>

    <div className="hms-side-foot">
      <div className="row"><Icon name="settings" size={16}/><span>Innstillinger</span></div>
      <div className="row"><Icon name="help" size={16}/><span>Hjelp</span></div>
      <div className="hms-admin-toggle">
        <span className="lbl">Adminmodus</span>
        <span className="sw"/>
      </div>
      <div className="hms-user">
        <div className="av" style={{ background: "var(--foreground)" }}>N</div>
        <div>
          <div className="name">Local Admin</div>
          <div className="role">Super Admin</div>
        </div>
        <span className="chev"><Icon name="chev-down" size={14}/></span>
      </div>
    </div>
  </aside>
);

// ─── Sub-navigation pill row (sits inside content area) ─────────
const HMS_SUBNAV = [
  { ic: "grid",       lbl: "Oversikt" },
  { ic: "clipboard",  lbl: "Drift" },
  { ic: "gradcap",    lbl: "Opplæring" },
  { ic: "doc",        lbl: "Dokumenter" },
  { ic: "warning-tri", lbl: "Avvik" },
  { ic: "shield",     lbl: "Governance" },
];

const HmsSubNav = ({ active = "Oversikt", items = HMS_SUBNAV, extra }) => (
  <div className="hms-subnav-wrap">
    <div className="hms-subnav">
      {items.map(it => (
        <button key={it.lbl} className={`subnav-tab ${it.lbl === active ? "is-active" : ""}`}>
          <Icon name={it.ic} size={14}/>
          {it.lbl}
        </button>
      ))}
    </div>
    {extra && <div className="hms-subnav-extra">{extra}</div>}
  </div>
);

// ─── Sidebar shell with chapters ────────────────────────────────
const LEVEL_A = [
  { k: "business-legal-hms-goals",     n: "Virksomhet og lovgrunnlag",       sub: "HMS-mål · §3-1, §5-1" },
  { k: "organization-roles",           n: "Organisering og roller",          sub: "Ansvarsfordeling" },
  { k: "hazard-mapping",               n: "Arbeidsmiljø og kartlegging",     sub: "Fysisk · psykososialt" },
  { k: "risk-assessment-action-plan",  n: "Risikovurdering",                  sub: "Handlingsplan" },
  { k: "daily-routines",               n: "Rutiner og daglig drift",         sub: "Internkontroll" },
  { k: "ik-mat",                       n: "IK-mat og mattrygghet",           sub: "HACCP · Mattilsynet" },
  { k: "training-competence",          n: "Opplæring og kompetanse",         sub: "Readiness" },
  { k: "deviations-incidents",         n: "Avvik og hendelser",              sub: "Korrigerende tiltak" },
  { k: "emergency-fire",               n: "Beredskap og brann",              sub: "Evakuering · varsling" },
  { k: "evaluation-review",            n: "Evaluering og forbedring",        sub: "Årlig revisjon" },
];
const LEVEL_B = [
  { k: "identity-mission",   n: "Identitet og misjon",     sub: "Merkevare · verdier" },
  { k: "communication",      n: "Kommunikasjon",            sub: "Kanaler · eskalering" },
  { k: "onboarding-program", n: "Onboarding-program",       sub: "Pre-board · mentor" },
  { k: "staffing-schedule",  n: "Vaktplan og bemanning",    sub: "Bytter · overtid" },
  { k: "alcohol-service",    n: "Alkoholservering",         sub: "Skjenkebevilling" },
];

const ChapterRow = ({ idx, ch, active, state, required = true }) => (
  <div className={`hms-chapter ${active ? "is-active" : ""}`} data-state={state} data-required={required}>
    <div className="step">{state === "completed" ? <Icon name="check" size={14} stroke={2.4}/> : idx}</div>
    <div className="title-col">
      <div className="title">{ch.n}</div>
      <div className="sub">{ch.sub}</div>
    </div>
    <div className="right-mark">
      {state === "completed" && <Icon name="check" size={14} stroke={2.2}/>}
      {state === "needs_review" && <Icon name="alert" size={13}/>}
      {state === "in_progress" && <Icon name="dot" size={14}/>}
    </div>
  </div>
);

const HmsSidebar = ({ progress = 8, activeKey = "emergency-fire", chapters = LEVEL_A, showLevelB = false, levelBKeys = LEVEL_B, statesOverride }) => {
  // Default state derivation: first `progress` are completed, the next active, rest not_started
  const stateAt = (i) => {
    if (statesOverride && statesOverride[i] !== undefined) return statesOverride[i];
    const idx0 = i;
    if (idx0 < progress) return "completed";
    if (idx0 === progress) return "in_progress";
    return "not_started";
  };

  return (
    <aside className="hms-side">
      <div className="hms-side-head">
        <div className="hms-side-eyebrow">HMS Håndbok</div>
        <button className="hms-side-collapse"><Icon name="chev-left" size={13}/></button>
      </div>

      <div className="hms-side-progress">
        <div className="label-row">
          <div className="lab">Oppsett</div>
          <div className="count">{progress}<span className="of"> / 10</span></div>
        </div>
        <div className="hms-progressbar"><span style={{ width: `${(progress/10)*100}%` }}/></div>
        <div className="meta">{progress < 10 ? `${10 - progress} obligatoriske kapitler igjen` : "Nivå A komplett · klar for revisjon"}</div>
      </div>

      <div className="hms-side-section-label">Nivå A · Obligatorisk</div>
      <div className="hms-side-list">
        {chapters.map((ch, i) => (
          <ChapterRow
            key={ch.k}
            idx={i + 1}
            ch={ch}
            active={ch.k === activeKey}
            state={stateAt(i)}
            required={true}
          />
        ))}

        {showLevelB && (
          <>
            <div className="hms-side-section-label" style={{ paddingLeft: 10, marginTop: 8 }}>Nivå B · Utvidet</div>
            {levelBKeys.map((ch, i) => (
              <ChapterRow key={ch.k} idx={i + 11} ch={ch} state="not_started" required={false}/>
            ))}
          </>
        )}
      </div>

      <div className="hms-side-foot">
        <div className="row"><Icon name="sparkles" size={16}/><span>Mr. Botsson</span></div>
        <div className="row"><Icon name="settings" size={16}/><span>Innstillinger</span></div>
        <div className="row"><Icon name="help" size={16}/><span>Hjelp</span></div>
        <div className="hms-admin-toggle">
          <span className="lbl">Adminmodus</span>
          <span className="sw"/>
        </div>
        <div className="hms-user">
          <div className="av">SD</div>
          <div>
            <div className="name">Sofia Dahl</div>
            <div className="role">Super Admin</div>
          </div>
          <span className="chev"><Icon name="chev-down" size={14}/></span>
        </div>
      </div>
    </aside>
  );
};

// ─── Editor toolbar ────────────────────────────────────────────
const HmsToolbar = ({ status = "Lagret · 2 min siden" }) => (
  <div className="hms-toolbar">
    <div className="hms-tb-group">
      <button className="hms-tb-btn" title="Heading 1"><Icon name="h1" size={16}/></button>
      <button className="hms-tb-btn" title="Heading 2"><Icon name="h2" size={16}/></button>
    </div>
    <div className="hms-tb-sep"/>
    <div className="hms-tb-group">
      <button className="hms-tb-btn"><Icon name="bold" size={14}/></button>
      <button className="hms-tb-btn"><Icon name="italic" size={14}/></button>
      <button className="hms-tb-btn"><Icon name="underline" size={14}/></button>
    </div>
    <div className="hms-tb-sep"/>
    <div className="hms-tb-group">
      <button className="hms-tb-btn"><Icon name="list-ul" size={15}/></button>
      <button className="hms-tb-btn"><Icon name="list-ol" size={15}/></button>
      <button className="hms-tb-btn"><Icon name="quote" size={14}/></button>
    </div>
    <div className="hms-tb-sep"/>
    <div className="hms-tb-group">
      <button className="hms-tb-btn"><Icon name="undo" size={15}/></button>
      <button className="hms-tb-btn"><Icon name="redo" size={15}/></button>
    </div>

    <div className="hms-tb-spacer"/>

    <div className="hms-tb-status"><span className="dot"/> {status}</div>
  </div>
);

// ─── Right panel tabs ─────────────────────────────────────────
const HmsRightTabs = ({ active = "verktoy" }) => (
  <div className="hms-right-tabs">
    <button className={`hms-right-tab ${active === "verktoy" ? "is-active" : ""}`}>Verktøy</button>
    <button className={`hms-right-tab ${active === "handling" ? "is-active" : ""}`}>Handling</button>
    <button className={`hms-right-tab ${active === "innst" ? "is-active" : ""}`}>Innst.</button>
    <button className={`hms-right-tab ${active === "vedlegg" ? "is-active" : ""}`}>Vedlegg</button>
  </div>
);

// Pretty named-tag wrappers
const Eyebrow = ({ children, color }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: color || "var(--muted-fg)",
  }}>{children}</div>
);

// Expose to window so other babel files can read these
Object.assign(window, {
  Icon, LogoMark, HmsTopbar, HmsSidebar, HmsToolbar, HmsRightTabs,
  ChapterRow, LEVEL_A, LEVEL_B, Eyebrow,
  HmsDashboardSide, HmsSubNav, DASHBOARD_NAV, HMS_SUBNAV,
});
