// ===== Smartout WEB — navigable app skeleton (structure & navigation first) =====
const { useState, useEffect, useRef } = React;

// ---------- icons ----------
const I = {
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
  bot:'<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.6 14H2.5a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4.5a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
};
function Ic({ n, s = 18, c = "currentColor", sw = 1.7 }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: I[n] || "" }} />;
}

// ---------- nav model ----------
const NAV = [
  { id: "oversikt", label: "Oversikt", icon: "home" },
  { id: "oppgaver", label: "Oppgaver", icon: "list", subtabs: ["Min dag", "Alle", "Tildelt meg"] },
  { id: "planlegging", label: "Planlegging", icon: "calendar", subtabs: ["Årshjul", "Sesonger", "Maler"] },
  { id: "vaktplan", label: "Vaktplan", icon: "grid", subtabs: ["Uke", "Måned", "Bemanning"] },
  { id: "ansatte", label: "Ansatte", icon: "users", subtabs: ["Alle", "Roller", "Onboarding"] },
  { id: "hms", label: "HMS", icon: "shield", dot: true, subtabs: ["Oversikt", "Drift", "Opplæring", "Dokumenter", "Avvik", "Governance"] },
  { id: "lonn", label: "Lønn", icon: "wallet", subtabs: ["Perioder", "Avvik", "Tillegg", "Innstillinger"] },
  { id: "avstemming", label: "Avstemming", icon: "checkdoc", subtabs: ["Denne uka", "Historikk"] },
  { id: "rapporter", label: "Rapporter", icon: "chart", subtabs: ["Drift", "Lønn", "HMS"] },
  { id: "chat", label: "Chat", icon: "message" },
  { id: "kommunikasjon", label: "Kommunikasjon", icon: "hash", badge: "6", subtabs: ["Nyheter", "Kanaler"] },
];
const ADMIN_NAV = [
  { id: "fjernkontroll", label: "Fjernkontroll", icon: "remote" },
  { id: "plattform", label: "Plattform", icon: "settings" },
];

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

// ---------- top bar ----------
function TopBar({ theme, setTheme, openMenu, setOpenMenu, searchRef }) {
  return (
    <header className="sk-top">
      <div className="sk-top-left">
        <button className="sk-ws" onClick={() => setOpenMenu(openMenu === "ws" ? null : "ws")}>
          <span className="sk-ws-mark" />
          HQ Workspace
          <Ic n="chevDown" s={14} c="var(--muted)" />
          {openMenu === "ws" && (
            <Pop onClose={() => setOpenMenu(null)} style={{ top: 44, left: 0, width: 240 }}>
              <div className="sk-pop-sec">Arbeidsplasser</div>
              {["HQ Workspace", "Café Skuta", "Bistro Nord", "Hotell Vest"].map((w, i) => (
                <button key={w} className={`sk-pop-item ${i === 0 ? "on" : ""}`}><span className="sk-ws-mark sm" />{w}{i === 0 && <span className="sk-dot-ok" />}</button>
              ))}
            </Pop>
          )}
        </button>
        <div className="sk-season">
          <span className="sk-season-lbl">Aktiv sesong</span>
          <strong>Vinter 2026</strong>
          <span className="sk-pill-ok">● Aktiv</span>
        </div>
      </div>

      <button className="sk-search" onClick={() => searchRef.current && searchRef.current.focus()}>
        <Ic n="search" s={15} c="var(--muted)" />
        <input ref={searchRef} placeholder="Søk i drift…" />
        <kbd>Ctrl K</kbd>
      </button>

      <div className="sk-top-right">
        <button className="sk-iconbtn" title="Bibliotek"><Ic n="book" s={18} /></button>
        <button className="sk-iconbtn" title="Tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Ic n={theme === "dark" ? "sun" : "moon"} s={18} /></button>
        <button className="sk-iconbtn badge" title="Varsler" onClick={() => setOpenMenu(openMenu === "bell" ? null : "bell")}>
          <Ic n="bell" s={18} /><span className="sk-badge-dot">4</span>
          {openMenu === "bell" && (
            <Pop onClose={() => setOpenMenu(null)} style={{ top: 44, right: 0, width: 300 }}>
              <div className="sk-pop-sec">Varsler</div>
              {[0, 1, 2].map(i => <div key={i} className="sk-notif"><span className="sk-sk-dot" /><span className="sk-sk-bar w70" /></div>)}
            </Pop>
          )}
        </button>
        <div style={{ position: "relative" }}>
          <button className="sk-new" onClick={() => setOpenMenu(openMenu === "new" ? null : "new")}>
            <Ic n="plus" s={15} c="#fff" sw={2.4} /> Ny <Ic n="chevDown" s={13} c="rgba(255,255,255,0.8)" />
          </button>
          {openMenu === "new" && (
            <Pop onClose={() => setOpenMenu(null)} style={{ top: 42, right: 0, width: 200 }}>
              {["Oppgave", "Vakt", "Kunngjøring", "Avvik", "Dokument"].map(x => <button key={x} className="sk-pop-item">{x}</button>)}
            </Pop>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------- sidebar ----------
function Side({ route, setRoute, collapsed, setCollapsed, admin, setAdmin, openMenu, setOpenMenu }) {
  const items = admin ? [...NAV, ...ADMIN_NAV] : NAV;
  return (
    <aside className={`sk-side ${collapsed ? "col" : ""}`}>
      <button className="sk-collapse" onClick={() => setCollapsed(c => !c)} title={collapsed ? "Utvid" : "Skjul"}>
        <Ic n={collapsed ? "chevRight" : "chevLeft"} s={15} c="var(--muted)" />
      </button>
      <nav className="sk-nav">
        {items.map(it => (
          <button key={it.id} className={`sk-navitem ${route === it.id ? "on" : ""}`} onClick={() => setRoute(it.id)} title={it.label}>
            <span className="sk-navico"><Ic n={it.icon} s={18} /></span>
            <span className="sk-navlbl">{it.label}</span>
            {it.dot && <span className="sk-navdot" />}
            {it.badge && <span className="sk-navbadge">{it.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="sk-side-foot">
        <button className="sk-bot"><span className="sk-bot-ic"><Ic n="bot" s={16} c="var(--orange)" /></span><span className="sk-navlbl">Mr. Botsson</span></button>
        <button className="sk-foot-item"><Ic n="settings" s={16} c="var(--muted)" /><span className="sk-navlbl">Innstillinger</span></button>
        <button className="sk-foot-item"><Ic n="help" s={16} c="var(--muted)" /><span className="sk-navlbl">Hjelp</span></button>
        <button className={`sk-admintoggle ${admin ? "on" : ""}`} onClick={() => setAdmin(a => !a)}>
          <span className="sk-navlbl" style={{ color: admin ? "var(--orange)" : "var(--muted)", fontWeight: 600 }}>Adminmodus</span>
          <span className={`sk-switch ${admin ? "on" : ""}`}><span /></span>
        </button>
        <div style={{ position: "relative" }}>
          <button className="sk-profile" onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}>
            <span className="sk-avatar">N</span>
            <span className="sk-navlbl"><span className="sk-prof-name">Local Admin</span><span className="sk-prof-role">{admin ? "SUPER ADMIN" : "DAGLIG LEDER"}</span></span>
            <Ic n="chevDown" s={14} c="var(--muted)" />
          </button>
          {openMenu === "profile" && (
            <Pop onClose={() => setOpenMenu(null)} style={{ bottom: 50, left: 8, width: 200 }}>
              <button className="sk-pop-item"><Ic n="users" s={15} c="var(--muted)" /> Min profil</button>
              <button className="sk-pop-item"><Ic n="settings" s={15} c="var(--muted)" /> Kontoinnstillinger</button>
              <div className="sk-pop-div" />
              <button className="sk-pop-item" onClick={() => { localStorage.removeItem("so_web"); location.reload(); }}><Ic n="logout" s={15} c="var(--muted)" /> Logg ut</button>
            </Pop>
          )}
        </div>
      </div>
    </aside>
  );
}

// ---------- page skeleton ----------
function SkelBar({ w = "60%", h = 12 }) { return <span className="sk-sk-bar" style={{ width: w, height: h }} />; }

function Page({ item }) {
  const Custom = window.SO_PAGES && window.SO_PAGES[item.id];
  if (Custom) return <main className="sk-main full"><Custom item={item} /></main>;
  const subtabs = item.subtabs || [];
  const [tab, setTab] = useState(0);
  useEffect(() => { setTab(0); }, [item.id]);
  return (
    <main className="sk-main">
      <div className="sk-page-head">
        <h1 className="sk-page-title">{item.label}</h1>
        <div className="sk-page-actions">
          <button className="sk-ghost">Filter</button>
          <button className="sk-ghost">Eksport</button>
        </div>
      </div>
      {subtabs.length > 0 && (
        <div className="sk-subtabs">
          {subtabs.map((t, i) => (
            <button key={t} className={`sk-subtab ${tab === i ? "on" : ""}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
      )}
      <div className="sk-kpis">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="sk-kpi"><SkelBar w="40%" h={9} /><SkelBar w="55%" h={22} /></div>
        ))}
      </div>
      <div className="sk-card-region">
        <div className="sk-region-head"><SkelBar w="120px" h={11} /><SkelBar w="64px" h={11} /></div>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="sk-row">
            <span className="sk-sk-dot" />
            <SkelBar w={`${30 + (i % 3) * 18}%`} h={11} />
            <span style={{ flex: 1 }} />
            <SkelBar w="60px" h={11} />
            <SkelBar w="40px" h={11} />
          </div>
        ))}
      </div>
      <div className="sk-page-tag">{item.label}{subtabs.length ? ` · ${subtabs[tab]}` : ""} — interaktiv flate kommer</div>
    </main>
  );
}

// ---------- app ----------
function App() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem("so_web") || "{}"); } catch { return {}; } })();
  const [authed, setAuthed] = useState(!!saved.authed);
  const [route, setRoute] = useState(saved.route || "oversikt");
  const [collapsed, setCollapsed] = useState(false);
  const [admin, setAdmin] = useState(!!saved.admin);
  const [theme, setTheme] = useState(saved.theme || "light");
  const [openMenu, setOpenMenu] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => { if (authed) localStorage.setItem("so_web", JSON.stringify({ authed, route, admin, theme })); }, [authed, route, admin, theme]);
  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current && searchRef.current.focus(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  if (!authed) {
    return <window.AuthFlow platform="web" onComplete={() => { setAuthed(true); localStorage.setItem("so_web", JSON.stringify({ authed: true, route: "oversikt", admin, theme })); }} />;
  }

  const allItems = admin ? [...NAV, ...ADMIN_NAV] : NAV;
  const item = allItems.find(x => x.id === route) || NAV[0];

  return (
    <div className="sk-app">
      <TopBar theme={theme} setTheme={setTheme} openMenu={openMenu} setOpenMenu={setOpenMenu} searchRef={searchRef} />
      <div className="sk-body">
        <Side route={route} setRoute={(r) => { setRoute(r); setOpenMenu(null); }} collapsed={collapsed} setCollapsed={setCollapsed} admin={admin} setAdmin={setAdmin} openMenu={openMenu} setOpenMenu={setOpenMenu} />
        <Page item={item} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
