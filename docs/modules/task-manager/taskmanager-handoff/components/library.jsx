// Library / folders view
function Library({ onOpenManual }) {
  const { FOLDERS, TAGS, MANUALS } = window.SmartoutData;
  const manuals = Object.values(MANUALS);

  return (
    <>
      <div className="topbar">
        <div className="head">
          <div className="eyebrow">Bibliotek</div>
          <h2>Foldere &amp; manualer</h2>
          <div className="sub">Organiser oppgaver, maler og instruksjonshåndbøker</div>
        </div>
        <div className="right">
          <button className="btn btn-secondary"><Icon name="plus" size={14} /> Ny folder</button>
          <button className="btn btn-primary btn-lg"><Icon name="plus" size={14} strokeWidth={2.5} /> Ny manual</button>
        </div>
      </div>

      <div className="section-header">
        <h3>Foldere</h3>
        <span className="count">{FOLDERS.length}</span>
      </div>
      <div className="folder-grid">
        {FOLDERS.map(f => (
          <div key={f.id} className="folder-card">
            <div className="ico" style={{ background: `${f.color}1A`, color: f.color }}>{f.icon}</div>
            <div className="name">{f.name}</div>
            <div className="meta">{f.count} oppgaver</div>
          </div>
        ))}
      </div>

      <div className="section-header">
        <h3>Tags</h3>
        <span className="count">{TAGS.length}</span>
      </div>
      <div className="tag-cloud">
        {TAGS.map(t => <span key={t} className="tag-chip">#{t}</span>)}
      </div>

      <div className="section-header">
        <h3>Manualer</h3>
        <span className="count">{manuals.length}</span>
      </div>
      <div className="task-list">
        {manuals.map(m => (
          <div key={m.id} className="manual-link" onClick={() => onOpenManual(m.id)}>
            <div className="ico"><Icon name="book" size={20} /></div>
            <div className="info">
              <div className="ttl">{m.title}</div>
              <div className="meta">
                <span className="mono">v{m.version}</span> · {m.sections.length} seksjoner · oppdatert {m.updated}
              </div>
            </div>
            <Icon name="chevron-right" size={18} color="var(--muted)" />
          </div>
        ))}
      </div>
    </>
  );
}

window.Library = Library;
