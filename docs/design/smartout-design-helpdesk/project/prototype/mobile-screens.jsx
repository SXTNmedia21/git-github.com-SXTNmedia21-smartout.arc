// Mobile frames — iOS style phone, 375×812
// Three artboards: Settings (Min profil), Helpdesk Queue, Ticket detail

const PhoneChrome = ({ children, time = '09:41', statusDark = false }) => (
  <div style={{
    width: 375, height: 812,
    background: 'var(--background)',
    position: 'relative', overflow: 'hidden',
    fontFamily: 'var(--font-body)',
    color: 'var(--foreground)',
  }}>
    {/* Status bar */}
    <div style={{
      height: 44, position: 'relative',
      padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
      color: statusDark ? '#fff' : 'var(--foreground)',
      zIndex: 10,
    }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      {/* Notch */}
      <div style={{
        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
        width: 110, height: 28, borderRadius: 20,
        background: '#000',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {/* signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="6" rx="1"/><rect x="10" y="2" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="11" rx="1" opacity=".4"/></svg>
        {/* battery */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="21" height="11" rx="2.5"/><rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor"/><rect x="22.5" y="4" width="1.5" height="4" rx="0.5" fill="currentColor"/></svg>
      </div>
    </div>
    {children}
  </div>
);

const TabBar = ({ active = 'queue' }) => {
  const tabs = [
    { id: 'home', icon: 'home', label: 'Hjem' },
    { id: 'shift', icon: 'calendar', label: 'Vakt' },
    { id: 'queue', icon: 'lifebuoy', label: 'Min kø', badge: true },
    { id: 'komm', icon: 'message', label: 'Meldinger' },
    { id: 'me', icon: 'user', label: 'Meg' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 82,
      background: 'oklch(0.99 0.004 60 / 0.9)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-around',
      paddingTop: 10,
    }}>
      {tabs.map(t => (
        <div key={t.id} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          color: t.id === active ? 'var(--brand-orange)' : 'var(--muted-fg)',
          fontWeight: t.id === active ? 600 : 400,
          position: 'relative',
          minWidth: 52,
        }}>
          <div style={{ position: 'relative' }}>
            <Icon name={t.icon} size={22} stroke={t.id === active ? 2 : 1.75} />
            {t.badge && <div style={{ position: 'absolute', top: -3, right: -4 }}><Orb size={10} status="waiting" pulse /></div>}
          </div>
          <div style={{ fontSize: 10 }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Settings screen ────────────────────────────────────────
const MobileSettings = () => (
  <PhoneChrome>
    {/* Header */}
    <div style={{
      padding: '8px 20px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 34, letterSpacing: '-0.02em' }}>Min profil</div>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)' }}>
          <Icon name="bell" size={16} />
        </div>
      </div>

      {/* Profile card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 18,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <Avatar name="Sofia Berg" size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 2 }}>Sofia Berg</div>
          <div style={{ fontSize: 13, color: 'var(--muted-fg)' }}>Daglig leder · Kvartalet</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 5 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '2px 7px', borderRadius: 9999,
              background: 'oklch(0.65 0.20 145 / 0.10)',
              color: 'oklch(0.45 0.15 145)',
            }}>AKTIV</span>
          </div>
        </div>
        <Icon name="chevron-right" size={18} style={{ color: 'var(--muted-fg)' }} />
      </div>
    </div>

    {/* Settings list */}
    <div style={{ padding: '0 20px 110px', overflowY: 'auto', height: 'calc(812px - 194px - 82px)' }}>
      <Section title="Vakt og timer">
        <Row icon="calendar" label="Mine vakter" value="24. okt · 14:00" />
        <Row icon="wallet" label="Lønnsperiode" value="Oktober" />
        <Row icon="clock" label="Timebank" value="+6t 30m" mono />
      </Section>

      <Section title="Skranker">
        <Row icon="lifebuoy" label="Ansvarlig for" value="#lønn · #hms" valueTone="brand" />
        <Row icon="inbox" label="Min kø" value="3 åpne" />
      </Section>

      <Section title="Varsler">
        <ToggleRow icon="bell" label="Nye saker i kø" on={true} />
        <ToggleRow icon="message" label="Svar i kanaler" on={true} />
        <ToggleRow icon="sparkles" label="Botsson-forslag" on={false} />
      </Section>

      <Section title="Utseende">
        <Row icon="moon" label="Mørk modus" value="Følg systemet" />
        <Row icon="globe" label="Språk" value="Norsk (bokmål)" />
      </Section>

      <Section title="Konto">
        <Row icon="shield" label="Personvern" />
        <Row icon="logout" label="Logg ut" destructive />
      </Section>

      <div style={{
        padding: '18px 4px 24px', fontSize: 11, color: 'var(--muted-fg)',
        fontFamily: 'var(--font-mono)', textAlign: 'center',
        lineHeight: 1.6,
      }}>
        Smartout 4.12 · Kvartalet AS<br/>
        <span style={{ opacity: 0.6 }}>Logget inn som sofia@kvartalet.no</span>
      </div>
    </div>

    <TabBar active="me" />
  </PhoneChrome>
);

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 10,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      color: 'var(--muted-fg)', fontWeight: 500,
      padding: '0 4px 10px',
    }}>{title}</div>
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {children}
    </div>
  </div>
);

const Row = ({ icon, label, value, mono, valueTone, destructive }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
  }}>
    <div style={{
      width: 30, height: 30, borderRadius: 8,
      background: destructive ? 'oklch(0.60 0.20 25 / 0.10)' : 'var(--muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: destructive ? 'var(--destructive)' : 'var(--muted-fg)',
    }}>
      <Icon name={icon} size={15} />
    </div>
    <div style={{ flex: 1, fontSize: 14.5, color: destructive ? 'var(--destructive)' : 'var(--foreground)', fontWeight: destructive ? 500 : 400 }}>
      {label}
    </div>
    {value && (
      <div style={{
        fontSize: 13,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
        color: valueTone === 'brand' ? 'var(--brand-orange-dark)' : 'var(--muted-fg)',
      }}>{value}</div>
    )}
    {!destructive && <Icon name="chevron-right" size={14} style={{ color: 'var(--muted-fg)', opacity: 0.6 }} />}
  </div>
);

const ToggleRow = ({ icon, label, on }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
  }}>
    <div style={{
      width: 30, height: 30, borderRadius: 8,
      background: 'var(--muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--muted-fg)',
    }}>
      <Icon name={icon} size={15} />
    </div>
    <div style={{ flex: 1, fontSize: 14.5 }}>{label}</div>
    <Switch on={on} />
  </div>
);

// ─── Mobile helpdesk queue ──────────────────────────────────
const MobileQueue = () => (
  <PhoneChrome>
    {/* Header */}
    <div style={{ padding: '10px 20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 34, letterSpacing: '-0.02em' }}>Min kø</div>
        <div style={{
          width: 36, height: 36, borderRadius: 18, background: 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)',
        }}>
          <Icon name="filter" size={16} />
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
        3 åpne · 1 venter
      </div>
    </div>

    {/* Grouped by desk */}
    <div style={{ padding: '0 0 110px', overflowY: 'auto', height: 'calc(812px - 130px - 82px)' }}>
      {/* Group: #lonn */}
      <div style={{ padding: '10px 20px 6px' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: 'var(--muted-fg)', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="lifebuoy" size={11} style={{ color: 'var(--brand-orange)' }} />
          #lønn · privat skranke
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>2</span>
        </div>
      </div>

      <QueueRow
        name="Linn Andersen"
        summary="Kan jeg jobbe i romjula?"
        time="14 min"
        status="waiting"
        highlighted
      />
      <QueueRow
        name="Kari Holm"
        summary="Har ikke fått lønn for fredag vakt — kan du sjekke?"
        time="1 t 12 min"
        status="active"
      />

      {/* Group: #hms */}
      <div style={{ padding: '24px 20px 6px' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: 'var(--muted-fg)', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="lifebuoy" size={11} style={{ color: 'var(--brand-orange)' }} />
          #hms · offentlig skranke
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>1</span>
        </div>
      </div>

      <QueueRow
        name="Ola Hansen"
        summary="Hvor finner jeg sjekkliste for åpning av kjøkken?"
        time="3 t"
        status="active"
      />

      {/* Resolved — dimmer */}
      <div style={{ padding: '24px 20px 6px' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: 'var(--muted-fg)', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
          opacity: 0.7,
        }}>
          Løst i dag
          <span style={{ marginLeft: 'auto' }}>2</span>
        </div>
      </div>

      <QueueRow
        name="Thea Ruud"
        summary="Trenger fri 15. november — bursdag"
        time="08:42"
        status="complete"
        dim
      />
    </div>

    <TabBar active="queue" />
  </PhoneChrome>
);

const QueueRow = ({ name, summary, time, status, highlighted, dim }) => (
  <div style={{
    display: 'flex', gap: 12, alignItems: 'flex-start',
    padding: '14px 20px',
    borderTop: '1px solid var(--border)',
    background: highlighted ? 'oklch(0.65 0.22 40 / 0.03)' : 'transparent',
    opacity: dim ? 0.55 : 1,
    position: 'relative',
  }}>
    <Avatar name={name} size={40} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{name}</div>
      <div style={{
        fontSize: 13.5, color: 'var(--muted-fg)', lineHeight: 1.4,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{summary}</div>
      <div style={{ fontSize: 11, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
        {time}
      </div>
    </div>
    {status === 'waiting' && (
      <div style={{ paddingTop: 4 }}>
        <Orb size={14} status="waiting" pulse />
      </div>
    )}
    {status === 'complete' && (
      <div style={{ paddingTop: 4 }}>
        <Orb size={14} status="complete" withCheck />
      </div>
    )}
  </div>
);

// ─── Mobile ticket detail ───────────────────────────────────
const MobileTicket = () => (
  <PhoneChrome>
    {/* Custom header */}
    <div style={{
      padding: '4px 16px 16px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
        <button style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          width: 40, height: 40, borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--foreground)', marginLeft: -8,
        }}>
          <Icon name="chevron-left" size={22} />
        </button>
        <div style={{ flex: 1 }} />
        <button style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          width: 40, height: 40, borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted-fg)',
        }}>
          <Icon name="more" size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <Orb size={44} status="waiting" pulse />
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusLabel status="waiting" />
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: 22,
            letterSpacing: '-0.01em', lineHeight: 1.2,
            marginTop: 2,
          }}>
            Kan jeg jobbe i romjula?
          </div>
          <div style={{
            marginTop: 6, fontSize: 13, color: 'var(--muted-fg)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Avatar name="Linn Andersen" size={18} />
            <span>Linn · #lønn · 14 min siden</span>
          </div>
        </div>
      </div>
    </div>

    {/* Messages */}
    <div style={{
      padding: '18px 16px 100px',
      overflowY: 'auto',
      height: 'calc(812px - 44px - 142px - 70px)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        alignSelf: 'center',
        padding: '5px 12px',
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        borderRadius: 9999,
        fontSize: 10.5, fontFamily: 'var(--font-mono)',
        color: 'var(--muted-fg)',
        letterSpacing: '0.04em',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="sparkles" size={10} />
        Botsson åpnet sak · 14:09
      </div>

      {/* Linn's */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Avatar name="Linn Andersen" size={32} />
        <div style={{ flex: 1 }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '14px 14px 14px 4px',
            padding: '10px 14px',
            fontSize: 14, lineHeight: 1.5,
          }}>
            Hei Sofia, har fått spørsmål om jeg kan ta ekstra vakter mellom jul og nyttår. Har vi egne regler for romjula, eller er det bare vanlig overtid?
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-fg)', marginTop: 4, marginLeft: 2 }}>14:09</div>
        </div>
      </div>
    </div>

    {/* Composer */}
    <div style={{
      position: 'absolute', bottom: 82, left: 0, right: 0,
      padding: '10px 14px',
      background: 'oklch(0.99 0.004 60 / 0.95)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <button style={{
        border: 'none', background: 'var(--muted)', cursor: 'pointer',
        width: 36, height: 36, borderRadius: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted-fg)', flexShrink: 0,
      }}>
        <Icon name="plus" size={18} />
      </button>
      <div style={{
        flex: 1, height: 38,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 19,
        display: 'flex', alignItems: 'center',
        padding: '0 14px',
        fontSize: 13.5, color: 'var(--muted-fg)',
      }}>
        Svar til Linn…
      </div>
      <button style={{
        border: 'none', background: 'transparent', cursor: 'pointer',
        width: 36, height: 36, borderRadius: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted-fg)', flexShrink: 0,
      }}>
        <Icon name="mic" size={18} />
      </button>
    </div>

    {/* FAB — Resolve */}
    <div style={{
      position: 'absolute', bottom: 148, right: 16,
      width: 56, height: 56, borderRadius: 28,
      background: `radial-gradient(circle at 35% 25%,
        oklch(0.78 0.16 50) 0%,
        oklch(0.65 0.20 40) 55%,
        oklch(0.55 0.22 40) 100%)`,
      boxShadow: '0 8px 20px rgba(249,115,22,0.42), inset 0 1px 0 rgba(255,255,255,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff',
    }}>
      <Icon name="check" size={22} stroke={2.5} />
    </div>

    {/* No tab bar for ticket detail - it's a pushed screen */}
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 34,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      paddingBottom: 8,
    }}>
      <div style={{ width: 135, height: 5, borderRadius: 3, background: 'var(--foreground)' }} />
    </div>
  </PhoneChrome>
);

Object.assign(window, { MobileSettings, MobileQueue, MobileTicket });
