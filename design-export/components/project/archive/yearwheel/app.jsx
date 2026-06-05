// Year Wheel — Main App

const YW_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "canvasStyle": "linear",
  "showNormal": true,
  "showDrafts": true,
  "showArchived": true,
  "density": "comfortable"
}/*EDITMODE-END*/;

function YwTopbar({ year, onYearChange, onNew, tweaks }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 28px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--card)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
        Smartout <span style={{ opacity: 0.5, margin: '0 6px' }}>/</span> Planlegging
      </div>
      <h1 style={{
        fontFamily: 'var(--font-heading)', fontSize: 28, letterSpacing: '-0.02em',
        margin: 0, fontWeight: 400,
      }}>Årshjul</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
        <button onClick={() => onYearChange(year - 1)} style={iconBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
          padding: '4px 10px', minWidth: 60, textAlign: 'center',
        }}>{year}</div>
        <button onClick={() => onYearChange(year + 1)} style={iconBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          background: 'color-mix(in oklab, var(--success) 10%, transparent)',
          color: 'var(--success)', fontSize: 11, fontWeight: 600,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--success)' }} />
          Seeded fra Riksavtalen
        </div>
        <button onClick={onNew} style={{
          padding: '7px 14px', fontSize: 13, fontWeight: 600,
          background: 'var(--orange)', color: '#fff', border: 'none', borderRadius: 10,
          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          boxShadow: 'var(--shadow-brand)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ny sesong
        </button>
      </div>
    </div>
  );
}

const iconBtn = {
  width: 28, height: 28, borderRadius: 7,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--fg)',
  border: '1px solid transparent', cursor: 'pointer',
};

function YwLegend({ style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap',
      padding: '10px 16px', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: 12,
      fontSize: 11, color: 'var(--muted)',
      ...(style || {}),
    }}>
      <LegendItem><span style={{ width: 24, height: 10, borderRadius: 3, background: 'var(--orange)', boxShadow: '0 2px 8px color-mix(in oklab, var(--orange) 25%, transparent)' }} /> Aktiv sesong</LegendItem>
      <LegendItem><span style={{ width: 24, height: 10, borderRadius: 3, background: 'color-mix(in oklab, var(--orange) 12%, var(--card))', border: '1.5px dashed var(--orange)' }} /> Utkast</LegendItem>
      <LegendItem><span style={{ width: 24, height: 10, borderRadius: 3, background: 'color-mix(in oklab, var(--muted) 25%, var(--secondary))' }} /> Arkivert</LegendItem>
      <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
      <LegendItem><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--orange)' }} /> Kulturell / kommersiell</LegendItem>
      <LegendItem><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--error)' }} /> Business-kritisk</LegendItem>
      <LegendItem><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--muted)' }} /> Intern</LegendItem>
      <LegendItem><span style={{ width: 10, height: 10, borderRadius: 99, background: `color-mix(in oklab, var(--orange) 40%, var(--card))`, border: '2px dashed var(--orange)' }} /> AI-foreslått</LegendItem>
      <LegendItem><span style={{ fontSize: 12 }}>◷</span> Endrer åpningstid</LegendItem>
    </div>
  );
}

function LegendItem({ children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{children}</span>;
}

// Season sidebar list
function YwSeasonList({ seasons, selectedId, onSelect, filter, onFilterChange }) {
  const filters = [
    { k: 'all', label: 'Alle' },
    { k: 'active', label: 'Aktiv' },
    { k: 'draft', label: 'Utkast' },
    { k: 'archived', label: 'Arkivert' },
  ];
  const filtered = filter === 'all' ? seasons : seasons.filter(s => s.status === filter);
  const counts = {
    all: seasons.length,
    active: seasons.filter(s => s.status === 'active').length,
    draft: seasons.filter(s => s.status === 'draft').length,
    archived: seasons.filter(s => s.status === 'archived').length,
  };

  return (
    <aside className="yw-sidebar" style={{
      width: 260, flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--sidebar-bg)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <div style={{ padding: '16px 18px 10px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Sesonger 2026
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button key={f.k} onClick={() => onFilterChange(f.k)} style={{
              padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              background: filter === f.k ? 'var(--fg)' : 'transparent',
              color: filter === f.k ? 'var(--bg)' : 'var(--muted)',
              border: filter === f.k ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
            }}>
              {f.label} <span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)', marginLeft: 3 }}>{counts[f.k]}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 10px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(s => {
          const isSel = selectedId === s.id;
          return (
            <button key={s.id} onClick={() => onSelect(s.id)} style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: 10,
              background: isSel ? 'var(--sidebar-active)' : 'transparent',
              border: `1px solid ${isSel ? 'var(--border)' : 'transparent'}`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 3, alignSelf: 'stretch', borderRadius: 2,
                background: s.color,
                opacity: s.status === 'draft' ? 0.5 : 1,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, marginBottom: 2,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  {s.status === 'active' && (
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--success)', flexShrink: 0 }} />
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {yw_fmtDate(s.start)} – {yw_fmtDate(s.end)}
                </div>
              </div>
              {s.missing && s.missing.length > 0 && (
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  padding: '2px 6px', borderRadius: 5,
                  background: 'color-mix(in oklab, var(--warning) 15%, transparent)',
                  color: 'var(--warning)',
                }}>{s.missing.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 14, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <span style={{ fontWeight: 600, color: 'var(--fg)' }}>Tegn nye sesonger</span>
        </div>
        Klikk og dra i lerretet for å skissere en sesong. Alle felter arves fra Riksavtalen.
      </div>
    </aside>
  );
}

function YwCompanionRail({ seasons, events, year }) {
  const today = new Date();
  const active = seasons.find(s => s.status === 'active');
  const upcoming = events
    .filter(e => yw_parseDate(e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const drafts = seasons.filter(s => s.status === 'draft' && s.missing && s.missing.length > 0);

  return (
    <aside className="yw-rail" style={{
      width: 280, flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--sidebar-bg)',
      padding: '16px 16px 24px',
      overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Active snapshot */}
      {active && (
        <div style={{ padding: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            <span style={{ color: 'var(--success)' }}>●</span> Aktiv nå
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, letterSpacing: '-0.02em', marginBottom: 4, fontWeight: 400 }}>{active.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
            {yw_fmtDate(active.start)} – {yw_fmtDate(active.end)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <MiniStat label="Omsetning" value={`${yw_fmtKr(active.revenueActual || 0)} / ${yw_fmtKr(active.revenue)}`} suffix="kr" pct={(active.revenueActual || 0) / active.revenue} />
            <MiniStat label="Labor" value={`${active.laborPct}%`} suffix="mål" />
          </div>
        </div>
      )}

      {/* Upcoming events */}
      <div style={{ padding: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>Neste hendelser</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {upcoming.map(e => {
            const catColor = { internal: 'var(--muted)', cultural_commercial: 'var(--orange)', business_critical: 'var(--error)' }[e.cat];
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 99, background: catColor, flexShrink: 0, ...(e.ai ? { borderStyle: 'dashed', border: `2px dashed ${catColor}`, background: 'transparent' } : {}) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{e.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{yw_fmtDate(e.date)} · ×{e.mult}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gaps */}
      {drafts.length > 0 && (
        <div style={{
          padding: 16,
          background: 'color-mix(in oklab, var(--warning) 5%, var(--card))',
          border: '1px solid color-mix(in oklab, var(--warning) 20%, var(--border))',
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--warning)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>
            Gaps før aktivering
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {drafts.map(s => (
              <div key={s.id} style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.missing.join(' · ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function MiniStat({ label, value, suffix, pct }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value} {suffix && <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 10 }}>{suffix}</span>}</span>
      </div>
      {pct != null && (
        <div style={{ height: 4, background: 'var(--secondary)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, pct * 100)}%`, background: 'var(--orange)', borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}

// Tweaks panel
function YwTweaks({ tweaks, setTweak, visible, setVisible }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 280, zIndex: 500,
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
      boxShadow: 'var(--shadow-lg)',
      padding: 16,
      animation: 'paneIn 220ms var(--ease-expo)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 400 }}>Tweaks</div>
        <button onClick={() => setVisible(false)} style={{ marginLeft: 'auto', width: 24, height: 24, background: 'transparent' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <TweakGroup label="Tema">
        <TweakPills value={tweaks.theme} onChange={v => setTweak('theme', v)} options={[['light', 'Lys'], ['dark', 'Mørk']]} />
      </TweakGroup>
      <TweakGroup label="Lerret-stil">
        <TweakPills value={tweaks.canvasStyle} onChange={v => setTweak('canvasStyle', v)} options={[['linear', 'Lineær'], ['layered', 'Lag-basert']]} />
      </TweakGroup>
      <TweakGroup label="Normal drift-bakgrunn">
        <TweakPills value={tweaks.showNormal} onChange={v => setTweak('showNormal', v)} options={[[true, 'Vis'], [false, 'Skjul']]} />
      </TweakGroup>
      <TweakGroup label="Utkast">
        <TweakPills value={tweaks.showDrafts} onChange={v => setTweak('showDrafts', v)} options={[[true, 'Vis'], [false, 'Skjul']]} />
      </TweakGroup>
      <TweakGroup label="Arkiverte">
        <TweakPills value={tweaks.showArchived} onChange={v => setTweak('showArchived', v)} options={[[true, 'Vis'], [false, 'Skjul']]} />
      </TweakGroup>
    </div>
  );
}

function TweakGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function TweakPills({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(([v, label]) => (
        <button key={String(v)} onClick={() => onChange(v)} style={{
          flex: 1, padding: '6px 10px', fontSize: 12, fontWeight: 500,
          borderRadius: 8,
          background: value === v ? 'var(--fg)' : 'var(--secondary)',
          color: value === v ? 'var(--bg)' : 'var(--fg)',
          border: 'none', cursor: 'pointer',
        }}>{label}</button>
      ))}
    </div>
  );
}

// Main App
function YwApp() {
  const [year, setYear] = React.useState(2026);
  const [selectedId, setSelectedId] = React.useState('s-sommer');
  const [filter, setFilter] = React.useState('all');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [seasons, setSeasons] = React.useState(window.YW_SEASONS);
  const [toast, setToast] = React.useState(null);

  const [tweaks, setTweaks] = React.useState(() => {
    try { return { ...YW_TWEAK_DEFAULTS, ...JSON.parse(localStorage.getItem('yw_tweaks') || '{}') }; }
    catch { return YW_TWEAK_DEFAULTS; }
  });
  const [tweaksVisible, setTweaksVisible] = React.useState(false);
  const setTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    try { localStorage.setItem('yw_tweaks', JSON.stringify(next)); } catch {}
  };
  React.useEffect(() => { document.documentElement.dataset.theme = tweaks.theme; }, [tweaks.theme]);

  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksVisible(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksVisible(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const visibleSeasons = seasons.filter(s => {
    if (!tweaks.showDrafts && s.status === 'draft') return false;
    if (!tweaks.showArchived && s.status === 'archived') return false;
    return true;
  });

  const selectedSeason = seasons.find(s => s.id === selectedId);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleDrawCreate = ({ start, end }) => {
    const id = `s-new-${Date.now()}`;
    const newSeason = {
      id, name: 'Ny sesong',
      start, end,
      color: '#f97316',
      status: 'draft',
      goals: [],
      revenue: 0,
      laborPct: 30,
      teams: 1,
      openHours: { Man: '11-22', Tir: '11-22', Ons: '11-22', Tor: '11-22', Fre: '11-23', Lør: '11-23', Søn: '12-22' },
      overrides: 0,
      missing: ['navn', 'inntektsmål', 'bemanningsplan'],
      seededFrom: 'Riksavtalen · hospitality-baseline',
    };
    setSeasons([...seasons, newSeason]);
    setSelectedId(id);
    setDrawerOpen(true);
    showToast(`Skisse opprettet · ${yw_fmtDate(start)} → ${yw_fmtDate(end)}`);
  };

  const handleActivate = () => {
    setSeasons(seasons.map(s => s.id === selectedId ? { ...s, status: s.status === 'active' ? 'archived' : 'active' } : s));
    showToast('Status oppdatert');
  };

  return (
    <div data-screen-label="Årshjul · 2026" style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'var(--font-sans)',
    }}>
      <YwTopbar year={year} onYearChange={setYear} tweaks={tweaks} onNew={() => showToast('Dra i lerretet for å tegne en sesong')} />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <YwSeasonList
          seasons={seasons}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setDrawerOpen(true); }}
          filter={filter}
          onFilterChange={setFilter}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, gap: 16, overflow: 'auto', minWidth: 0 }}>
          {/* Headline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 40, letterSpacing: '-0.025em', margin: 0, fontWeight: 400, fontStyle: 'italic' }}>
                Hele året i ett blikk
              </h2>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>/ {visibleSeasons.length} sesonger · {window.YW_EVENTS.length} hendelser</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', maxWidth: 680, lineHeight: 1.5 }}>
              Ikke-sesong er <b style={{ color: 'var(--fg)', fontWeight: 500 }}>Normal drift</b> — arvet fra workspace. Fargede blokker overstyrer lokalt. Klikk og dra for å tegne nye sesonger.
            </p>
          </div>

          <YearCanvas
            year={year}
            seasons={visibleSeasons}
            events={window.YW_EVENTS}
            selectedId={selectedId}
            onSelectSeason={(id) => { setSelectedId(id); setDrawerOpen(true); }}
            onSelectEvent={(id) => showToast(`Event: ${window.YW_EVENTS.find(e => e.id === id)?.name}`)}
            style={tweaks.canvasStyle}
            showNormal={tweaks.showNormal}
            onDrawCreate={handleDrawCreate}
          />

          <YwLegend />

          {/* AI hint */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '14px 18px', borderRadius: 14,
            background: 'color-mix(in oklab, var(--orange) 5%, var(--card))',
            border: '1px dashed color-mix(in oklab, var(--orange) 40%, var(--border))',
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--orange)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                AI foreslår: legg til <span style={{ color: 'var(--orange)' }}>«Systembytte POS»</span> 18. juni
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Basert på kalender-event fra IT-avdeling. Forventet omsetningsfall −70%. 72% sikkerhet.
              </div>
            </div>
            <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: 'var(--fg)', color: 'var(--bg)', borderRadius: 8, border: 'none' }}>Godta</button>
            <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8 }}>Avvis</button>
          </div>
        </main>

        <YwCompanionRail seasons={seasons} events={window.YW_EVENTS} year={year} />
      </div>

      {drawerOpen && selectedSeason && (
        <SeasonDrawer season={selectedSeason} onClose={() => setDrawerOpen(false)} onActivate={handleActivate} />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--fg)', color: 'var(--bg)',
          padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: 'var(--shadow-lg)', zIndex: 300,
          animation: 'paneIn 300ms var(--ease-expo)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>{toast}</div>
      )}

      <YwTweaks tweaks={tweaks} setTweak={setTweak} visible={tweaksVisible} setVisible={setTweaksVisible} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<YwApp />);
