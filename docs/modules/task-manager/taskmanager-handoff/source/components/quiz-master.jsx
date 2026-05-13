// Quizmaster — admin redaktør-view
function QuizMaster({ onClose, onPreviewQuiz }) {
  const draft = window.SmartoutData.QUIZ_DRAFT;
  const folder = window.SmartoutData.FOLDERS.find(f => f.id === draft.meta.folder);
  const [activeId, setActiveId] = React.useState(null);
  const [menuId, setMenuId] = React.useState(null);

  const allQ = draft.questions;
  const lowCount = allQ.filter(q => q.confidence === 'low').length;
  const medCount = allQ.filter(q => q.confidence === 'med').length;
  const highCount = allQ.filter(q => q.confidence === 'high').length;
  const readyPct = Math.round(((highCount + medCount * 0.5) / Math.max(allQ.length, 1)) * 100);

  const typeLabel = (t) => ({
    'single': 'Enkeltvalg', 'multi': 'Flervalg', 'image-choice': 'Bildesvar',
    'truefalse': 'Sant/usant', 'short-text': 'Fritekst kort', 'long-text': 'Fritekst lang',
    'sort': 'Sortering', 'match': 'Par-kobling', 'scale': 'Skala',
    'hotspot': 'Hotspot', 'number': 'Tall-input',
  }[t]);

  return (
    <div className="builder-viewer">
      <div className="builder-topbar">
        <button className="manual-back" onClick={onClose} style={{ marginLeft: 0, marginBottom: 0 }}>
          <Icon name="arrow-left" size={16} /> Tilbake
        </button>
        <div className="builder-topbar-meta">
          <span className="status-pill status-inprogress">Utkast</span>
          <span className="builder-confidence-pill">
            <span className="conf-dot conf-high" /> {highCount}
            <span className="conf-dot conf-med" /> {medCount}
            <span className="conf-dot conf-low" /> {lowCount}
            <span className="conf-pct mono">{readyPct}%</span>
          </span>
          <span className="quiz-meta-pill mono">{allQ.length} spm · ~{draft.meta.estimatedTime} min</span>
        </div>
        <div className="builder-topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => onPreviewQuiz(draft.id)}>
            <Icon name="play" size={13} /> Forhåndsvis som ansatt
          </button>
          <button className="btn btn-secondary btn-sm">Lagre utkast</button>
          <button className="btn btn-primary btn-sm" disabled={lowCount > 0}>Publiser</button>
        </div>
      </div>

      <div className="builder-layout">
        <aside className="builder-rail">
          <div className="builder-source-card">
            <div className="src-label">Kilde</div>
            <div className="src-row">
              <div className="src-ico"><Icon name="book" size={16} /></div>
              <div className="src-body">
                <div className="src-title">{draft.source.label}</div>
                <div className="src-meta mono">{draft.source.capturedAt}</div>
              </div>
            </div>
            <p className="src-note">{draft.source.note}</p>
          </div>

          <div className="builder-side-section">
            <h4>Botsson har</h4>
            <ul className="bot-actions-list">
              <li><span className="conf-dot conf-high" /> Generert {allQ.length} spørsmål</li>
              <li><span className="conf-dot conf-high" /> Brukt 11 svartyper</li>
              <li><span className="conf-dot conf-med" /> Kilde-pekt på {allQ.length - 1} av dem</li>
              <li><span className="conf-dot conf-low" /> Flagget {lowCount} for menneske</li>
            </ul>
          </div>

          <div className="builder-side-section">
            <h4>Innstillinger</h4>
            <div className="builder-setting">
              <span className="muted-label">Folder</span>
              <span className="setting-value"><span className="folder-dot" style={{ background: folder?.color }} /> {folder?.name}</span>
            </div>
            <div className="builder-setting">
              <span className="muted-label">Beståttgrense</span>
              <span className="setting-value mono">{draft.meta.passingScore}%</span>
            </div>
            <div className="builder-setting">
              <span className="muted-label">Tags</span>
              <span className="setting-value">{draft.meta.tags.map(t => <span key={t} className="tag-chip">#{t}</span>)}</span>
            </div>
          </div>

          <div className="builder-side-section">
            <h4>Bunke-handlinger</h4>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}>
              <Icon name="check" size={13} /> Godta alle med 🟢
            </button>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}>
              <Icon name="sparkles" size={13} /> Gjør 3 vanskeligere
            </button>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}>
              <Icon name="more" size={13} /> Re-generer alle
            </button>
          </div>
        </aside>

        <main className="builder-canvas">
          <div className="builder-cover">
            <div className="builder-eyebrow">
              <Icon name="sparkles" size={12} /> Botsson genererte denne — du retter
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: 44, letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 10px' }}>{draft.title}</h1>
            <div className="builder-cover-meta">
              <span>Generert {draft.generatedAt}</span>
              <span className="sep">·</span>
              <span>{draft.meta.author}</span>
              <span className="sep">·</span>
              <span>{allQ.length} spørsmål</span>
            </div>
          </div>

          <div className="quiz-q-list">
            {allQ.map((q, i) => (
              <QuizQCard
                key={q.id}
                q={q} i={i}
                active={activeId === q.id}
                menuOpen={menuId === q.id}
                onActivate={() => setActiveId(q.id)}
                onToggleMenu={() => setMenuId(menuId === q.id ? null : q.id)}
                typeLabel={typeLabel}
              />
            ))}
            <button className="builder-add-block" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              <Icon name="plus" size={14} /> Legg til spørsmål
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

function QuizQCard({ q, i, active, menuOpen, onActivate, onToggleMenu, typeLabel }) {
  const confLabel = { high: 'Botsson sikker', med: 'Sjekk', low: 'Trenger menneske' }[q.confidence];

  const renderPreview = () => {
    switch (q.type) {
      case 'single':
        return (
          <div className="qpv-options">
            {q.options.map((o, idx) => (
              <div key={idx} className={`qpv-radio ${idx === q.correct ? 'correct' : ''}`}>
                <span className="qpv-bullet" />
                <span>{o}</span>
                {idx === q.correct && <Icon name="check" size={13} />}
              </div>
            ))}
          </div>
        );
      case 'multi':
        return (
          <div className="qpv-options">
            {q.options.map((o, idx) => (
              <div key={idx} className={`qpv-checkbox ${q.correct.includes(idx) ? 'correct' : ''}`}>
                <span className="qpv-square">{q.correct.includes(idx) && <Icon name="check" size={11} />}</span>
                <span>{o}</span>
              </div>
            ))}
          </div>
        );
      case 'image-choice':
        return (
          <div className="qpv-img-grid">
            {q.options.map((o, idx) => (
              <div key={idx} className={`qpv-img-card ${idx === q.correct ? 'correct' : ''}`}>
                <div className="qpv-img-frame"><Icon name="image" size={20} /></div>
                <span>{o.label}</span>
                {idx === q.correct && <span className="qpv-img-tick"><Icon name="check" size={11} /></span>}
              </div>
            ))}
          </div>
        );
      case 'truefalse':
        return (
          <div className="qpv-tf">
            <div className={`qpv-tf-btn ${q.correct === true ? 'correct' : ''}`}>Sant</div>
            <div className={`qpv-tf-btn ${q.correct === false ? 'correct' : ''}`}>Usant</div>
          </div>
        );
      case 'short-text':
        return <div className="qpv-input">Fasit: <strong>{q.correctText}</strong></div>;
      case 'long-text':
        return <div className="qpv-input qpv-textarea">Manuell vurdering · ingen automatisk fasit</div>;
      case 'sort':
        return (
          <div className="qpv-sort">
            {q.items.map((it, idx) => (
              <div key={idx} className="qpv-sort-row">
                <span className="qpv-sort-num mono">{idx + 1}</span>
                <Icon name="more" size={12} />
                <span>{it}</span>
              </div>
            ))}
          </div>
        );
      case 'match':
        return (
          <div className="qpv-match">
            {q.pairs.map((p, idx) => (
              <div key={idx} className="qpv-match-row">
                <span>{p.left}</span>
                <Icon name="arrow-right" size={12} />
                <span className="qpv-match-right">{p.right}</span>
              </div>
            ))}
          </div>
        );
      case 'scale':
        return (
          <div className="qpv-scale">
            {Array.from({ length: q.max - q.min + 1 }, (_, idx) => (
              <span key={idx} className="qpv-scale-dot mono">{q.min + idx}</span>
            ))}
            <span className="qpv-scale-labels">
              <span>{q.labels[0]}</span>
              <span>{q.labels[q.labels.length - 1]}</span>
            </span>
          </div>
        );
      case 'hotspot':
        return (
          <div className="qpv-hotspot">
            <Icon name="image" size={22} />
            <span>{q.placeholder}</span>
            <span className="qpv-hotspot-mark" style={{ left: `${q.hotspot.x}%`, top: `${q.hotspot.y}%` }} />
          </div>
        );
      case 'number':
        return <div className="qpv-input">Fasit: <strong className="mono">{q.correctNumber} {q.unit}</strong> <span className="muted-label">±{q.tolerance}</span></div>;
      default: return null;
    }
  };

  return (
    <div className={`builder-block quiz-q ${active ? 'active' : ''} conf-${q.confidence}`} onClick={onActivate}>
      <div className="builder-block-rail">
        <span className={`conf-dot conf-${q.confidence}`} title={confLabel} />
      </div>
      <div className="builder-block-body">
        <div className="builder-block-head">
          <span className="quiz-q-num mono">SPM {String(i + 1).padStart(2, '0')}</span>
          <span className="builder-block-type">{typeLabel(q.type)}</span>
          <span className="quiz-q-weight mono">×{q.weight}</span>
          {q.confidence === 'low' && (
            <span className="builder-block-flag">
              <Icon name="bell" size={11} /> {confLabel}
            </span>
          )}
        </div>
        <div className="quiz-q-prompt">{q.prompt}</div>
        <div className="quiz-q-source">
          <Icon name="book" size={11} /> {q.source}
        </div>
        {renderPreview()}
        {q.explanation && (
          <div className="quiz-q-explain">
            <Icon name="sparkles" size={11} /> {q.explanation}
          </div>
        )}
      </div>
      <div className="builder-block-actions">
        <button className="builder-block-act" onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}>
          <Icon name="sparkles" size={14} />
        </button>
        <button className="builder-block-act"><Icon name="more" size={14} /></button>
        {menuOpen && (
          <div className="builder-block-menu" onClick={e => e.stopPropagation()}>
            <div className="menu-header"><Icon name="sparkles" size={12} /> Botsson kan</div>
            <button><Icon name="sparkles" size={13} /> Gjør vanskeligere</button>
            <button><Icon name="pen" size={13} /> Forenkle språket</button>
            <button><Icon name="image" size={13} /> Bytt til bildesvar</button>
            <button><Icon name="list" size={13} /> Bytt svartype…</button>
            <button><Icon name="more" size={13} /> Splitt i to</button>
            <div className="menu-divider" />
            <button><Icon name="sparkles" size={13} /> Re-generer fra kilde</button>
            <button style={{ color: 'var(--error)' }}><Icon name="close" size={13} /> Fjern spørsmål</button>
          </div>
        )}
      </div>
    </div>
  );
}

window.QuizMaster = QuizMaster;
