// Manual-guide — ansatt-view, ett steg om gangen, mobile-first
function ManualGuide({ draftId, onClose }) {
  const draft = window.SmartoutData.MANUAL_DRAFT;
  // Flatt ut til en sekvens av "skjermer": hver seksjon = intro-skjerm; hver blokk = steg-skjerm
  const screens = React.useMemo(() => {
    const out = [];
    out.push({ kind: 'cover', title: draft.title });
    draft.sections.forEach((sec, sIdx) => {
      out.push({ kind: 'section-intro', section: sec, idx: sIdx });
      sec.blocks.forEach((b, bIdx) => out.push({ kind: 'block', block: b, section: sec, sIdx, bIdx }));
    });
    out.push({ kind: 'done' });
    return out;
  }, [draft]);

  const [idx, setIdx] = React.useState(0);
  const [evidence, setEvidence] = React.useState({});
  const [checked, setChecked] = React.useState({});

  const screen = screens[idx];
  const total = screens.length;
  const next = () => setIdx(i => Math.min(i + 1, total - 1));
  const prev = () => setIdx(i => Math.max(i - 1, 0));

  const renderScreen = () => {
    if (screen.kind === 'cover') {
      return (
        <div className="guide-cover">
          <div className="guide-eyebrow">Manual</div>
          <h1>{draft.title}</h1>
          <p className="guide-sub">~{draft.meta.estimatedReadTime} min · {draft.sections.length} seksjoner</p>
          <button className="btn btn-primary btn-lg guide-cta" onClick={next}>
            Start <Icon name="arrow-right" size={16} />
          </button>
          <p className="guide-hint">Følg ett steg om gangen. Du trenger ikke lese alt på én gang.</p>
        </div>
      );
    }
    if (screen.kind === 'section-intro') {
      return (
        <div className="guide-section-intro">
          <div className="guide-eyebrow mono">SEKSJON {String(screen.idx + 1).padStart(2, '0')} / {String(draft.sections.length).padStart(2, '0')}</div>
          <h1>{screen.section.title}</h1>
          <p className="guide-sub">{screen.section.blocks.length} steg</p>
          <button className="btn btn-primary btn-lg guide-cta" onClick={next}>
            Fortsett <Icon name="arrow-right" size={16} />
          </button>
        </div>
      );
    }
    if (screen.kind === 'done') {
      return (
        <div className="guide-cover">
          <div className="guide-done-ico">
            <Icon name="check" size={36} />
          </div>
          <h1>Ferdig</h1>
          <p className="guide-sub">Bra jobba. Bevisene er logget.</p>
          <button className="btn btn-primary btn-lg guide-cta" onClick={onClose}>
            Tilbake til oppgaven
          </button>
        </div>
      );
    }
    // block-screen
    const b = screen.block;
    return (
      <div className="guide-step">
        <div className="guide-step-head">
          <div className="guide-eyebrow mono">{screen.section.title.toUpperCase()}</div>
          <h2>Steg {screen.bIdx + 1} av {screen.section.blocks.length}</h2>
        </div>
        <div className="guide-step-body">
          {b.type === 'text' && <p className="guide-text">{b.content}</p>}
          {b.type === 'callout' && (
            <div className={`guide-callout tone-${b.tone}`}>
              <Icon name={b.tone === 'warning' ? 'shield' : 'sparkles'} size={20} />
              <p>{b.content}</p>
            </div>
          )}
          {b.type === 'image' && (
            <div className="guide-image">
              <Icon name="image" size={42} />
              <span>{b.label}</span>
            </div>
          )}
          {b.type === 'video' && (
            <div className="guide-video">
              <div className="play-btn"><Icon name="play" size={32} /></div>
              <span className="duration mono">{b.duration}</span>
              <span className="label">{b.label}</span>
            </div>
          )}
          {b.type === 'checklist' && (
            <div className="guide-checklist">
              {b.items.map((item, i) => {
                const key = `${b.id}-${i}`;
                const on = !!checked[key];
                return (
                  <button key={i} className={`guide-cl-row ${on ? 'done' : ''}`} onClick={() => setChecked(c => ({ ...c, [key]: !c[key] }))}>
                    <span className={`guide-cl-check ${on ? 'done' : ''}`}>{on && <Icon name="check" size={14} />}</span>
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>
          )}
          {b.type === 'evidence' && (
            <div className="guide-evidence">
              <div className="ev-ico"><Icon name={b.kind === 'photo' ? 'camera' : 'check'} size={28} /></div>
              <h3>{b.kind === 'photo' ? 'Ta et bilde' : 'Bekreft'}</h3>
              <p>{b.content}</p>
              <button className={`btn btn-primary btn-lg ${evidence[b.id] ? 'done' : ''}`} onClick={() => setEvidence(e => ({ ...e, [b.id]: true }))}>
                {evidence[b.id]
                  ? <><Icon name="check" size={16} /> Logget</>
                  : (b.kind === 'photo' ? <><Icon name="camera" size={16} /> Åpne kamera</> : <><Icon name="check" size={16} /> Bekreft</>)
                }
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="guide-viewer">
      <div className="guide-shell">
        <div className="guide-topbar">
          <button className="guide-close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
          <div className="guide-progress">
            <div className="guide-progress-bar" style={{ width: `${(idx / (total - 1)) * 100}%` }} />
          </div>
          <span className="guide-progress-label mono">{idx + 1}/{total}</span>
        </div>

        <div className="guide-content">
          {renderScreen()}
        </div>

        {screen.kind === 'block' && (
          <div className="guide-footer">
            <button className="btn btn-ghost" onClick={prev} disabled={idx === 0}>
              <Icon name="arrow-left" size={14} /> Tilbake
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-primary btn-lg" onClick={next}>
              Neste <Icon name="arrow-right" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

window.ManualGuide = ManualGuide;
