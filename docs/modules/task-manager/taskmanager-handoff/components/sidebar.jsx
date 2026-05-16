// Sidebar navigation
function Sidebar({ view, setView }) {
  const { FOLDERS, ME } = window.SmartoutData;
  const navItem = (id, ico, label, count, badge) => (
    <button
      key={id}
      className={`nav-item ${view === id ? 'active' : ''}`}
      onClick={() => setView(id)}
    >
      <span className="nav-ico"><Icon name={ico} size={15} /></span>
      <span className="nav-label">{label}</span>
      {count != null && <span className="count mono">{count}</span>}
      {badge && <span className="nav-badge">{badge}</span>}
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>Smartout</h1>
        <div className="org">Bistro Nord · {ME.name.split(' ')[0]} {ME.name.split(' ')[1]?.[0]}.</div>
      </div>

      <nav className="sidebar-nav">
        {navItem('mindag', 'home', 'Min dag', 12)}
        {navItem('all', 'list', 'Alle oppgaver', 38)}
        <button className="nav-item">
          <span className="nav-ico"><Icon name="user" size={15} /></span>
          <span className="nav-label">Tildelt meg</span>
          <span className="count mono">7</span>
        </button>
        <button className="nav-item">
          <span className="nav-ico"><Icon name="bell" size={15} /></span>
          <span className="nav-label">Følger</span>
          <span className="count mono">3</span>
        </button>
      </nav>

      <div className="sidebar-section">Foldere</div>
      <nav className="sidebar-nav">
        {FOLDERS.map(f => (
          <button key={f.id} className="nav-item">
            <span className="folder-dot" style={{ background: f.color }} />
            <span className="nav-label">{f.name}</span>
            <span className="count mono">{f.count}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-section">Bibliotek</div>
      <nav className="sidebar-nav">
        {navItem('library', 'book', 'Manualer', 6)}
        {navItem('builder', 'sparkles', 'Manualskaper', null, 'Botsson')}
        {navItem('quizmaster', 'circle-check', 'Quizmaster', null, 'Botsson')}
        <button className="nav-item">
          <span className="nav-ico"><Icon name="folder" size={15} /></span>
          <span className="nav-label">Maler</span>
          <span className="count mono">14</span>
        </button>
      </nav>

      <div className="sidebar-foot">
        <button className="sidebar-me">
          <Avatar user={ME} size={28} />
          <div className="sidebar-me-info">
            <div className="name">{ME.name}</div>
            <div className="role">{ME.role}</div>
          </div>
          <Icon name="more" size={14} color="var(--muted)" />
        </button>
      </div>
    </aside>
  );
}

function MobileTabbar({ view, setView }) {
  return (
    <nav className="mobile-tabbar">
      <button className={`mobile-tab ${view === 'mindag' ? 'active' : ''}`} onClick={() => setView('mindag')}>
        <Icon name="home" size={20} /><span>Min dag</span>
      </button>
      <button className={`mobile-tab ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>
        <Icon name="list" size={20} /><span>Alle</span>
      </button>
      <button className="mobile-fab" aria-label="Ny oppgave">
        <Icon name="plus" size={22} strokeWidth={2.5} />
      </button>
      <button className={`mobile-tab ${view === 'library' ? 'active' : ''}`} onClick={() => setView('library')}>
        <Icon name="book" size={20} /><span>Bibliotek</span>
      </button>
      <button className="mobile-tab">
        <Icon name="user" size={20} /><span>Meg</span>
      </button>
    </nav>
  );
}

window.Sidebar = Sidebar;
window.MobileTabbar = MobileTabbar;
