// Web — Channel Settings Modal "Skranke" tab
// This is the primary web settings screen for configuring helpdesk on a channel.
// 1280px design frame; modal floats over a dimmed dashboard underlay.

const WebSettings = () => {
  const [preset, setPreset] = React.useState('private');
  const [activeTab, setActiveTab] = React.useState('skranke');

  const tabs = [
    { id: 'general', label: 'Generelt' },
    { id: 'members', label: 'Medlemmer', count: 12 },
    { id: 'ai', label: 'AI-policy' },
    { id: 'skranke', label: 'Skranke' },
    { id: 'retention', label: 'Oppbevaring' },
  ];

  const presets = [
    {
      id: 'none',
      icon: null,
      title: 'Ingen skranke',
      lede: 'Vanlig kanal — alle kan skrive og lese som før.',
      consequence: null,
      aiText: 'AI-deltakelse: av',
    },
    {
      id: 'public',
      icon: 'lifebuoy',
      title: 'Fag-skranke (offentlig)',
      lede: 'Åpen skranke hvor alle i kanalen ser spørsmålene.',
      consequence: 'Ansvarlig svarer. Alle medlemmer ser tråden.',
      aiText: 'AI-deltakelse: nevnt-kun',
    },
    {
      id: 'private',
      icon: 'lock',
      title: 'HR-skranke (privat)',
      lede: 'Hver sak får sin egen private undertråd mellom ansatt og ansvarlig.',
      consequence: 'Meldinger er private — kun ansvarlig og den som spør ser dem.',
      aiText: 'AI-deltakelse: av',
    },
    {
      id: 'custom',
      icon: 'settings',
      title: 'Tilpasset',
      lede: 'Velg hver innstilling manuelt. Anbefaler forhåndsvalg.',
      consequence: null,
      aiText: null,
      warn: true,
    },
  ];

  return (
    <div style={{
      width: 1280, height: 860, position: 'relative',
      fontFamily: 'var(--font-body)',
      color: 'var(--foreground)',
      background: '#e8e3d8',
      overflow: 'hidden',
    }}>
      {/* Dashboard underlay (dimmed) */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, filter: 'blur(1px)' }}>
        <DashboardUnderlay />
      </div>
      {/* Dim scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,10,0.28)' }} />

      {/* Modal */}
      <div style={{
        position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
        width: 920, maxHeight: 760,
        background: 'oklch(0.99 0.004 60 / 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 1px 0 rgba(255,255,255,0.4) inset, 0 40px 80px -30px rgba(0,0,0,0.45)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }} className="noise-overlay">
        {/* Top edge gradient */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--border), transparent)' }} />

        {/* Header */}
        <div style={{ padding: '24px 32px 0 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
              }}>#</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em' }}>lønn</div>
            </div>
            <div style={{ color: 'var(--muted-fg)', fontSize: 14 }}>Kanalinnstillinger · 12 medlemmer · opprettet 3. februar</div>
          </div>
          <button style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            width: 32, height: 32, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--muted-fg)',
          }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '20px 32px 0 32px', display: 'flex', gap: 6, borderBottom: '1px solid var(--border)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '10px 14px',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
              color: activeTab === t.id ? 'var(--foreground)' : 'var(--muted-fg)',
              borderBottom: `2px solid ${activeTab === t.id ? 'var(--brand-orange)' : 'transparent'}`,
              marginBottom: -1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              {t.count != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px 32px 32px', overflowY: 'auto', flex: 1 }}>
          {/* Section intro */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, letterSpacing: '-0.01em', marginBottom: 4 }}>Gjør kanalen til en skranke</div>
              <div style={{ color: 'var(--muted-fg)', fontSize: 14, maxWidth: 560 }}>
                En skranke binder kanalen til en ansvarlig kollega. Ansatte kan spørre — ansvarlig svarer og lukker saken.
              </div>
            </div>
            <a style={{ color: 'var(--muted-fg)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              Les mer <Icon name="external" size={12} />
            </a>
          </div>

          {/* Preset grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {presets.map(p => {
              const active = preset === p.id;
              return (
                <div key={p.id} onClick={() => setPreset(p.id)}
                  style={{
                    background: 'var(--card)',
                    border: `1px solid ${active ? 'var(--brand-orange)' : 'var(--border)'}`,
                    boxShadow: active ? '0 0 0 3px rgba(249,115,22,0.12)' : 'none',
                    borderRadius: 14, padding: 18,
                    cursor: 'pointer',
                    transition: 'border-color 180ms var(--ease-primary), box-shadow 180ms var(--ease-primary)',
                    position: 'relative',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ paddingTop: 2 }}><Radio on={active} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {p.icon && <Icon name={p.icon} size={16} style={{ color: 'var(--muted-fg)' }} />}
                        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.005em' }}>{p.title}</div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted-fg)', lineHeight: 1.5 }}>{p.lede}</div>
                      {p.consequence && active && (
                        <div style={{
                          marginTop: 10, paddingTop: 10,
                          borderTop: '1px dashed var(--border)',
                          fontSize: 12, color: 'var(--muted-fg)',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.01em',
                        }}>
                          <div style={{ marginBottom: 2 }}>→ {p.consequence}</div>
                          <div>→ {p.aiText}</div>
                        </div>
                      )}
                      {p.warn && active && (
                        <div style={{
                          marginTop: 10, padding: '8px 10px',
                          background: 'oklch(0.75 0.15 75 / 0.08)',
                          borderLeft: '2px solid oklch(0.75 0.15 75)',
                          fontSize: 12, color: 'oklch(0.45 0.12 75)',
                          borderRadius: 4,
                        }}>
                          Avanserte innstillinger. Anbefaler forhåndsvalg.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Responsible rep field — only if helpdesk preset */}
          {(preset === 'public' || preset === 'private' || preset === 'custom') && (
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 14, padding: 20,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Ansvarlig</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>Den som svarer på saker i denne skranken.</div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'var(--muted-fg)',
                }}>PÅKREVD</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                cursor: 'pointer',
              }}>
                <LighthouseAvatar name="Linn Andersen" size={36} halo="idle" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Linn Andersen</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>HR-leder · Aktiv nå</div>
                </div>
                <span style={{ fontSize: 13, color: 'var(--muted-fg)' }}>Bytt</span>
                <Icon name="chevron-down" size={14} style={{ color: 'var(--muted-fg)' }} />
              </div>
            </div>
          )}

          {/* Consequence strip (live preview) */}
          {preset === 'private' && (
            <div style={{
              background: 'oklch(0.99 0.004 60)',
              border: '1px solid var(--border)',
              borderRadius: 14, padding: 16,
              marginBottom: 20,
              display: 'flex', gap: 14,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--muted-fg)',
                flexShrink: 0,
              }}>
                <Icon name="eye" size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Slik ser ansatte kanalen</div>
                <div style={{ fontSize: 12, color: 'var(--muted-fg)', lineHeight: 1.6 }}>
                  Hovedkanalen viser bare en <em>Start privat sak med HR</em>-knapp. Hver sak åpner en privat undertråd mellom ansatt og Linn. Andre medlemmer ser hverken spørsmål eller svar.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'oklch(0.99 0.004 60 / 0.6)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--muted-fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="clock" size={12} />
            Endringer lagres når du trykker Lagre.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost">Avbryt</Btn>
            <Btn variant="default">Lagre endringer</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard underlay ──────────────────────────────────────
const DashboardUnderlay = () => (
  <div style={{ display: 'flex', height: '100%', background: 'var(--background)' }}>
    {/* Sidebar */}
    <div style={{
      width: 240, background: 'var(--sidebar)',
      borderRight: '1px solid var(--border)',
      padding: 18,
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 22px 8px' }}>
        <img src="smartout-icon.png" style={{ width: 28, height: 28, borderRadius: 7 }} />
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, letterSpacing: '-0.01em' }}>Smartout</div>
      </div>
      {['Hjem','Vakter','Ansatte','Kanaler','Min kø','Opplæring','HMS','Innstillinger'].map((s, i) => (
        <div key={s} style={{
          padding: '8px 10px', fontSize: 14,
          background: s === 'Kanaler' ? 'var(--sidebar-accent)' : 'transparent',
          borderRadius: 8,
          color: s === 'Kanaler' ? 'var(--foreground)' : 'var(--muted-fg)',
          fontWeight: s === 'Kanaler' ? 500 : 400,
        }}>{s}</div>
      ))}
    </div>
    {/* Komm 2-col */}
    <div style={{ width: 280, background: 'var(--card)', borderRight: '1px solid var(--border)', padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Kanaler</div>
      {['#allmenn','#kjokken','#hms','#lonn','#bar','#event'].map((c, i) => (
        <div key={c} style={{
          padding: '8px 10px', fontSize: 14,
          background: c === '#lonn' ? 'var(--muted)' : 'transparent',
          borderRadius: 6,
          color: 'var(--muted-fg)',
        }}>{c}</div>
      ))}
    </div>
    <div style={{ flex: 1, padding: 24 }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24 }}># lønn</div>
    </div>
  </div>
);

window.WebSettings = WebSettings;
