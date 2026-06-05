// ===== Smartout MOBILE — navigable app skeleton =====
const { useState, useEffect, useRef } = React;

const MI = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9"/>',
  chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  bell:'<path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  menu:'<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  check:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6l1 1 1.5-2M4.5 12l1 1 1.5-2"/>',
  grad:'<path d="M22 9L12 4 2 9l10 5 10-5z"/><path d="M6 11v5c0 1 3 2.5 6 2.5s6-1.5 6-2.5v-5"/>',
  shield:'<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
  wallet:'<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12.5h3"/>',
};
function MIc({ n, s = 22, c = "currentColor", sw = 1.7 }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: MI[n] || "" }} />;
}

const TABS = [
  { id: "vakter", label: "Vakter", icon: "users" },
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "minside", label: "", icon: "logo", center: true },
  { id: "mintid", label: "Min tid", icon: "clock" },
  { id: "kalender", label: "Kalender", icon: "calendar" },
];
const TITLES = { minside: "Min side", vakter: "Vakter", chat: "Chat", mintid: "Min tid", kalender: "Kalender" };
const QUICK = [{ icon: "check", label: "Oppgaver" }, { icon: "grad", label: "Opplæring" }, { icon: "shield", label: "Sikkerhet" }, { icon: "wallet", label: "Lønn" }];

function SkBar({ w = "60%", h = 12, light }) { return <span className="mk-bar" style={{ width: w, height: h, background: light ? "rgba(255,255,255,0.25)" : "var(--secondary)" }} />; }

function Screen({ route }) {
  return (
    <div className="m-screen">
      {route === "minside" && (
        <>
          <div className="m-greet"><span className="mk-bar" style={{ width: 150, height: 26 }} /></div>
          <div className="m-hero">
            <SkBar w="40%" h={9} light />
            <SkBar w="60%" h={26} light />
            <SkBar w="30%" h={10} light />
          </div>
          <div className="m-quick">
            {QUICK.map(q => (
              <div key={q.label} className="m-quick-tile">
                <span className="m-quick-ic"><MIc n={q.icon} s={18} c="var(--orange)" /></span>
                <span className="m-quick-lbl">{q.label}</span>
              </div>
            ))}
          </div>
          <div className="m-sec-head"><SkBar w="120px" h={13} /><SkBar w="50px" h={11} /></div>
          {[0, 1, 2].map(i => <div key={i} className="m-list-row"><span className="mk-dot" /><div style={{ flex: 1, display: "grid", gap: 6 }}><SkBar w="65%" h={11} /><SkBar w="40%" h={9} /></div><SkBar w="44px" h={13} /></div>)}
        </>
      )}
      {route !== "minside" && (
        <>
          <div className="m-hero alt"><SkBar w="35%" h={9} /><SkBar w="55%" h={22} /></div>
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="m-list-row"><span className="mk-dot" /><div style={{ flex: 1, display: "grid", gap: 6 }}><SkBar w={`${50 + (i % 3) * 14}%`} h={11} /><SkBar w="38%" h={9} /></div></div>)}
        </>
      )}
      <div className="m-tag">{TITLES[route]} — interaktiv flate kommer</div>
    </div>
  );
}

function App() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem("so_mob") || "{}"); } catch { return {}; } })();
  const [authed, setAuthed] = useState(!!saved.authed);
  const [route, setRoute] = useState(saved.route || "minside");
  const [theme] = useState("light");

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => { if (authed) localStorage.setItem("so_mob", JSON.stringify({ authed, route })); }, [authed, route]);

  if (!authed) {
    return <div className="m-phone"><window.AuthFlow platform="mobile" onComplete={() => setAuthed(true)} /></div>;
  }

  return (
    <div className="m-phone">
      <header className="m-top">
        <button className="m-top-btn"><MIc n="menu" s={20} /></button>
        <span className="m-top-title">Smartout</span>
        <button className="m-top-btn badge"><MIc n="bell" s={20} /><span className="m-badge">4</span></button>
      </header>
      <Screen route={route} />
      <nav className="m-tabbar">
        {TABS.map(t => t.center ? (
          <button key={t.id} className="m-fab" onClick={() => setRoute("minside")}><span className="m-mark" /></button>
        ) : (
          <button key={t.id} className={`m-tab ${route === t.id ? "on" : ""}`} onClick={() => setRoute(t.id)}>
            <MIc n={t.icon} s={21} /><span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
