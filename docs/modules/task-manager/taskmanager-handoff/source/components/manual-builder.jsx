// Manualskaper — admin redaktør-view
// Botsson har strukturert et skjelett. Du som leder retter med små grep.

function ManualBuilder({ onClose, onPreviewGuide }) {
  const draft = window.SmartoutData.MANUAL_DRAFT;
  const folder = window.SmartoutData.FOLDERS.find(f => f.id === draft.meta.folder);
  const [draftState, setDraftState] = React.useState(draft);
  const [activeBlockId, setActiveBlockId] = React.useState(null);
  const [activeMenuBlockId, setActiveMenuBlockId] = React.useState(null);

  const setBlockText = (sectionId, blockId, value) => {
    setDraftState(d => ({
      ...d,
      sections: d.sections.map(s =>
        s.id !== sectionId ? s :
        { ...s, blocks: s.blocks.map(b => b.id !== blockId ? b : { ...b, content: value, confidence: b.confidence === 'low' ? 'med' : b.confidence }) }
      )
    }));
  };

  const setSectionTitle = (sectionId, value) => {
    setDraftState(d => ({
      ...d,
      sections: d.sections.map(s => s.id !== sectionId ? s : { ...s, title: value })
    }));
  };

  const setTitle = (value) => setDraftState(d => ({ ...d, title: value }));

  // Confidence rollup
  const allBlocks = draftState.sections.flatMap(s => s.blocks);
  const lowCount = allBlocks.filter(b => b.confidence === 'low').length;
  const medCount = allBlocks.filter(b => b.confidence === 'med').length;
  const highCount = allBlocks.filter(b => b.confidence === 'high').length;
  const total = allBlocks.length;
  const readyPct = Math.round(((highCount + medCount * 0.5) / Math.max(total, 1)) * 100);

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
        </div>
        <div className="builder-topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => onPreviewGuide('d-pakning')}>
            <Icon name="play" size={13} /> Forhåndsvis som ansatt
          </button>
          <button className="btn btn-secondary btn-sm">Lagre utkast</button>
          <button className="btn btn-primary btn-sm" disabled={lowCount > 0} title={lowCount > 0 ? 'Avklar konfidens-flagg først' : ''}>
            Publiser
          </button>
        </div>
      </div>

      <div className="builder-layout">
        {/* Left rail — kontekst */}
        <aside className="builder-rail">
          <div className="builder-source-card">
            <div className="src-label">Kilde</div>
            <div className="src-row">
              <div className="src-ico"><Icon name="video" size={16} /></div>
              <div className="src-body">
                <div className="src-title">{draft.source.label}</div>
                <div className="src-meta mono">{draft.source.duration} · {draft.source.capturedAt}</div>
              </div>
            </div>
            <p className="src-note">{draft.source.note}</p>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
              <Icon name="play" size={13} /> Spill av kilde
            </button>
          </div>

          <div className="builder-side-section">
            <h4>Botsson har</h4>
            <ul className="bot-actions-list">
              <li><span className="conf-dot conf-high" /> Strukturert i 5 seksjoner</li>
              <li><span className="conf-dot conf-high" /> Klippet 4 bilder fra video</li>
              <li><span className="conf-dot conf-med" /> Foreslått 1 advarsel</li>
              <li><span className="conf-dot conf-low" /> Flagget 1 punkt for menneske</li>
            </ul>
          </div>

          <div className="builder-side-section">
            <h4>Innstillinger</h4>
            <div className="builder-setting">
              <span className="muted-label">Folder</span>
              <span className="setting-value"><span className="folder-dot" style={{ background: folder?.color }} /> {folder?.name}</span>
            </div>
            <div className="builder-setting">
              <span className="muted-label">Tags</span>
              <span className="setting-value">{draft.meta.tags.map(t => <span key={t} className="tag-chip">#{t}</span>)}</span>
            </div>
            <div className="builder-setting">
              <span className="muted-label">Lestid</span>
              <span className="setting-value mono">~{draft.meta.estimatedReadTime} min</span>
            </div>
          </div>
        </aside>

        {/* Center — editor */}
        <main className="builder-canvas">
          <div className="builder-cover">
            <div className="builder-eyebrow">
              <Icon name="sparkles" size={12} /> Botsson genererte denne — du redigerer
            </div>
            <input
              className="builder-title-input"
              value={draftState.title}
              onChange={e => setTitle(e.target.value)}
            />
            <div className="builder-cover-meta">
              <span>Generert {draft.generatedAt}</span>
              <span className="sep">·</span>
              <span>{draft.meta.author}</span>
            </div>
          </div>

          {draftState.sections.map((section, sIdx) => (
            <section className="builder-section" key={section.id}>
              <div className="builder-section-head">
                <div className="builder-section-num mono">SEKSJON {String(sIdx + 1).padStart(2, '0')}</div>
                <input
                  className="builder-section-title"
                  value={section.title}
                  onChange={e => setSectionTitle(section.id, e.target.value)}
                />
                <button className="builder-section-act" title="Splitt seksjon">
                  <Icon name="more" size={16} />
                </button>
              </div>

              <div className="builder-blocks">
                {section.blocks.map(block => (
                  <BuilderBlock
                    key={block.id}
                    block={block}
                    active={activeBlockId === block.id}
                    menuOpen={activeMenuBlockId === block.id}
                    onActivate={() => setActiveBlockId(block.id)}
                    onToggleMenu={() => setActiveMenuBlockId(activeMenuBlockId === block.id ? null : block.id)}
                    onChangeText={(value) => setBlockText(section.id, block.id, value)}
                  />
                ))}
                <button className="builder-add-block">
                  <Icon name="plus" size={14} /> Legg til blokk
                </button>
              </div>
            </section>
          ))}

          <button className="builder-add-section">
            <Icon name="plus" size={14} /> Ny seksjon
          </button>
        </main>
      </div>
    </div>
  );
}

function BuilderBlock({ block, active, menuOpen, onActivate, onToggleMenu, onChangeText }) {
  const confLabel = { high: 'Botsson sikker', med: 'Sjekk', low: 'Trenger menneske' }[block.confidence];

  const renderBody = () => {
    switch (block.type) {
      case 'text':
        return (
          <textarea
            className="builder-block-text"
            value={block.content}
            onChange={e => onChangeText(e.target.value)}
            rows={Math.max(2, Math.ceil(block.content.length / 70))}
          />
        );
      case 'callout':
        return (
          <div className={`builder-callout tone-${block.tone}`}>
            <div className="callout-tone">
              <Icon name={block.tone === 'warning' ? 'shield' : 'sparkles'} size={14} />
              <span>{block.tone === 'warning' ? 'Advarsel' : 'Tips'}</span>
            </div>
            <textarea
              className="builder-block-text"
              value={block.content}
              onChange={e => onChangeText(e.target.value)}
              rows={2}
            />
          </div>
        );
      case 'image':
        return (
          <div className="builder-media">
            <div className="builder-media-frame img">
              <Icon name="image" size={28} />
            </div>
            <div className="builder-media-meta">
              <strong>{block.label}</strong>
              <span className="muted-label">{block.source}</span>
            </div>
            <button className="btn btn-ghost btn-sm">Bytt</button>
          </div>
        );
      case 'video':
        return (
          <div className="builder-media">
            <div className="builder-media-frame vid">
              <Icon name="play" size={26} />
              <span className="vid-duration mono">{block.duration}</span>
            </div>
            <div className="builder-media-meta">
              <strong>{block.label}</strong>
              <span className="muted-label">{block.source}</span>
            </div>
            <button className="btn btn-ghost btn-sm">Trim</button>
          </div>
        );
      case 'checklist':
        return (
          <div className="builder-checklist">
            {block.items.map((item, i) => (
              <div key={i} className="builder-checklist-row">
                <span className="builder-cl-num mono">{String(i + 1).padStart(2, '0')}</span>
                <input className="builder-cl-input" defaultValue={item} />
              </div>
            ))}
            <button className="builder-cl-add">
              <Icon name="plus" size={12} /> Legg til punkt
            </button>
          </div>
        );
      case 'evidence':
        return (
          <div className="builder-evidence">
            <div className="evidence-ico">
              <Icon name={block.kind === 'photo' ? 'camera' : 'check'} size={16} />
            </div>
            <div className="evidence-body">
              <strong>Krever {block.kind === 'photo' ? 'foto' : 'bekreftelse'}</strong>
              <span className="muted-label">{block.content}</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const typeLabel = { text: 'Tekst', callout: 'Callout', image: 'Bilde', video: 'Video', checklist: 'Sjekkliste', evidence: 'Bevis-krav' }[block.type];

  return (
    <div
      className={`builder-block ${active ? 'active' : ''} conf-${block.confidence}`}
      onClick={onActivate}
    >
      <div className="builder-block-rail">
        <span className={`conf-dot conf-${block.confidence}`} title={confLabel} />
      </div>
      <div className="builder-block-body">
        <div className="builder-block-head">
          <span className="builder-block-type">{typeLabel}</span>
          {block.confidence === 'low' && (
            <span className="builder-block-flag">
              <Icon name="bell" size={11} /> {confLabel}
            </span>
          )}
        </div>
        {renderBody()}
      </div>
      <div className="builder-block-actions">
        <button className="builder-block-act" onClick={(e) => { e.stopPropagation(); onToggleMenu(); }} title="Botsson-handlinger">
          <Icon name="sparkles" size={14} />
        </button>
        <button className="builder-block-act" title="Mer">
          <Icon name="more" size={14} />
        </button>
        {menuOpen && (
          <div className="builder-block-menu" onClick={e => e.stopPropagation()}>
            <div className="menu-header">
              <Icon name="sparkles" size={12} /> Botsson kan
            </div>
            <button><Icon name="more" size={13} /> Splitt i to blokker</button>
            <button><Icon name="pen" size={13} /> Forenkle språket</button>
            <button><Icon name="image" size={13} /> Legg til bilde</button>
            <button><Icon name="video" size={13} /> Legg til video</button>
            <button><Icon name="camera" size={13} /> Krev bevis (foto)</button>
            <button><Icon name="check" size={13} /> Krev bevis (sjekk)</button>
            <div className="menu-divider" />
            <button><Icon name="sparkles" size={13} /> Re-generer fra kilde</button>
          </div>
        )}
      </div>
    </div>
  );
}

window.ManualBuilder = ManualBuilder;
