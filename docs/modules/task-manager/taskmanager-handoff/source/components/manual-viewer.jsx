// Manual viewer (instruksjonshåndbok)
function ManualViewer({ manualId, onClose }) {
  const { MANUALS, FOLDERS } = window.SmartoutData;
  const m = MANUALS[manualId];
  if (!m) return null;
  const folder = FOLDERS.find(f => f.id === m.folder);

  const renderSection = (s, i) => {
    return (
      <section className="manual-section" key={s.id}>
        <div className="num">SEKSJON {String(i + 1).padStart(2, '0')}</div>
        <h2>{s.title}</h2>
        {s.content?.map((line, j) => <p key={j}>{line}</p>)}

        {s.type === 'video' && (
          <div className="manual-video">
            <div className="play-btn"><Icon name="play" size={26} /></div>
            <div className="video-meta">
              <Icon name="video" size={14} />
              <span>{s.videoTitle}</span>
              <span className="duration">{s.videoDuration}</span>
            </div>
          </div>
        )}

        {s.type === 'image' && (
          <div className="manual-image">
            <div className="placeholder-ico"><Icon name="image" size={28} /></div>
            <div className="placeholder-label">Illustrasjon: {s.title}</div>
          </div>
        )}

        {s.type === 'checklist' && (
          <div className="manual-checklist">
            {s.content.map((item, j) => (
              <div key={j}>
                <div className="num">{String(j + 1).padStart(2, '0')}</div>
                <div>{item}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const sectionTypeIcon = (t) => {
    if (t === 'video') return <Icon name="video" size={14} />;
    if (t === 'image') return <Icon name="image" size={14} />;
    if (t === 'checklist') return <Icon name="list" size={14} />;
    return <Icon name="circle" size={14} />;
  };

  return (
    <div className="manual-viewer">
      <div className="manual-inner">
        <button className="manual-back" onClick={onClose}>
          <Icon name="arrow-left" size={16} /> Tilbake til oppgave
        </button>

        <div className="manual-cover">
          <div className="label">Manual · {folder?.name || 'Generelt'}</div>
          <h1>{m.title}</h1>
          <p className="desc">{m.description}</p>
          <div className="meta">
            <span><Icon name="clock" size={13} /> ~<span className="mono">{m.estimatedReadTime}</span> min</span>
            <span><Icon name="user" size={13} /> {m.author}</span>
            <span>Oppdatert <strong>{m.updated}</strong></span>
            <span>Versjon <strong className="mono">{m.version}</strong></span>
          </div>
        </div>

        {m.sections.length > 0 && (
          <div className="manual-toc">
            <h4>Innhold</h4>
            <ol>
              {m.sections.map(s => (
                <li key={s.id}>
                  {s.title}
                  <span className="type-ico">{sectionTypeIcon(s.type)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {m.sections.length > 0
          ? m.sections.map(renderSection)
          : <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Manualen er under utarbeidelse.</p>
        }
      </div>
    </div>
  );
}

window.ManualViewer = ManualViewer;
