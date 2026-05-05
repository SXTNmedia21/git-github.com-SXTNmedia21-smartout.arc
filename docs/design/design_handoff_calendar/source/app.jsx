// Single navigable phone — kalender + vaktliste tabs.

function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "dark"
  }/*EDITMODE-END*/;

  const [tweaks, setTweaks] = React.useState(() => {
    try { return { ...TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem('cal-tweaks') || '{}') }; }
    catch { return TWEAK_DEFAULTS; }
  });
  const [tweaksOpen, setTweaksOpen] = React.useState(false);

  const setTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    try { localStorage.setItem('cal-tweaks', JSON.stringify(next)); } catch {}
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
  }, [tweaks.theme]);

  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Tab + per-screen state
  const [tab, setTab] = React.useState('kalender'); // 'kalender' | 'vakter'

  // Kalender state
  const [view, setView]         = React.useState('week');
  const [filter, setFilter]     = React.useState('alt');
  const [selected, setSelected] = React.useState(CAL.TODAY);

  // Vaktliste state
  const [scope, setScope] = React.useState({ kind: 'me' });
  const [range, setRange] = React.useState('week');

  // Shared
  const [openItem, setOpenItem] = React.useState(null);
  const [showAdd, setShowAdd]   = React.useState(false);

  let content;
  if (tab === 'vakter') {
    content = <ShiftList
      scope={scope} setScope={setScope}
      range={range} setRange={setRange}
      selected={selected} setSelected={setSelected}
      onOpenItem={setOpenItem}
    />;
  } else if (view === 'week') {
    content = <WeekView
      filter={filter} setFilter={(v) => {
        setFilter(v);
        // "Vakter"-chip → hopp til Vaktliste-tab (smart-filter)
        if (v === 'vakter') setTab('vakter');
      }}
      selected={selected} setSelected={setSelected}
      onOpenItem={setOpenItem}
      onSwitch={(v) => setView(v)}
    />;
  } else if (view === 'month') {
    content = <MonthView
      selected={selected} setSelected={setSelected}
      onSwitch={(v) => setView(v)}
      onOpenDay={(d) => { setSelected(d); setView('day'); }}
    />;
  } else {
    content = <DayView
      date={selected}
      onBack={() => setView('week')}
      onOpenItem={setOpenItem}
    />;
  }

  React.useEffect(() => {
    window.__openAdd = () => setShowAdd(true);
    window.__goTab = (t) => setTab(t);
    return () => { delete window.__openAdd; delete window.__goTab; };
  }, []);

  return (
    <div className="page">
      <div className="head">
        <div>
          <div className="eyebrow"><span className="dot"></span>Smartout · Mobil</div>
          <h1>Kalender + Vaktliste</h1>
          <div className="sub">
            Naviger via tab-baren nederst: <strong>Kalender</strong> for personlig oversikt, <strong>Vakter</strong> for hele teamet.
            Trykker du «Vakter»-chip i Kalender, hopper du direkte inn i Vaktliste med dine vakter for samme uke.
          </div>
        </div>
      </div>

      <div className="stage">
        <Phone label="Pontus · Café Skuta" num="iPhone">
          {content}
          {openItem && <DetailSheet item={openItem} onClose={() => setOpenItem(null)} />}
          {showAdd && <AddSheet onClose={() => setShowAdd(false)} />}
        </Phone>
      </div>

      <div className={`tweaks ${tweaksOpen ? 'open' : ''}`}>
        <div className="tweaks-title">
          Tweaks
          <button onClick={() => setTweaksOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div>
          <div className="tweak-group-label">Tab</div>
          <div className="tweak-row">
            <button className={`tweak-pill ${tab === 'kalender' ? 'active' : ''}`} onClick={() => setTab('kalender')}>Kalender</button>
            <button className={`tweak-pill ${tab === 'vakter' ? 'active' : ''}`} onClick={() => setTab('vakter')}>Vakter</button>
          </div>
          <div className="tweak-group-label" style={{ marginTop: 14 }}>Tema</div>
          <div className="tweak-row">
            <button className={`tweak-pill ${tweaks.theme === 'dark' ? 'active' : ''}`} onClick={() => setTweak('theme', 'dark')}>Mørk</button>
            <button className={`tweak-pill ${tweaks.theme === 'light' ? 'active' : ''}`} onClick={() => setTweak('theme', 'light')}>Lys</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
