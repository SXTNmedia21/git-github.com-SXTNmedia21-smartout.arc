// Web payroll surfaces — Phase 1 MVP mockups
// Frame: 1320 × 880

const PAGE_W = 1320;
const PAGE_H = 880;

// ─── Shared chrome ─────────────────────────────────────────
const SidebarNav = ({ active }) => {
  const items = [
    ['home', 'Hjem'],
    ['calendar', 'Vakter'],
    ['users', 'Ansatte'],
    ['message', 'Kanaler'],
    ['wallet', 'Lønn', true],
    ['book', 'Opplæring'],
    ['shield', 'HMS'],
    ['settings', 'Innstillinger'],
  ];
  return (
    <div style={{
      width: 220, background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)',
      padding: '16px 14px', display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 18px' }}>
        <img src="smartout-icon.png" style={{ width: 24, height: 24, borderRadius: 6 }} />
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, letterSpacing: '-0.01em' }}>Smartout</div>
      </div>
      {items.map(([icn, lbl]) => {
        const act = lbl.toLowerCase() === active;
        return (
          <div key={lbl} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', fontSize: 13.5,
            background: act ? 'var(--sidebar-accent)' : 'transparent',
            borderRadius: 8, color: act ? 'var(--foreground)' : 'var(--muted-fg)',
            fontWeight: act ? 600 : 400, marginBottom: 2,
          }}>
            <Icon name={icn} size={16} />
            {lbl}
          </div>
        );
      })}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px',
        borderTop: '1px solid var(--sidebar-border)', marginTop: 8, paddingTop: 14 }}>
        <Avatar name="Sofia Berg" size={28} />
        <div style={{ fontSize: 13 }}>
          <div style={{ fontWeight: 500 }}>Sofia Berg</div>
          <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>Daglig leder</div>
        </div>
      </div>
    </div>
  );
};

const PageHeader = ({ crumbs, title, subtitle, actions }) => (
  <div style={{ padding: '24px 32px 18px', borderBottom: '1px solid var(--border)',
    background: 'oklch(0.99 0.004 60 / 0.7)', backdropFilter: 'blur(12px)' }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
      color: 'var(--muted-fg)', letterSpacing: '0.08em',
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icon name="chevron-right" size={11} style={{ opacity: 0.5 }} />}
          <span style={{ color: i === crumbs.length - 1 ? 'var(--foreground)' : 'var(--muted-fg)' }}>{c}</span>
        </React.Fragment>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ marginTop: 6, color: 'var(--muted-fg)', fontSize: 13.5 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  </div>
);

// Status badge variants used across screens
const StatusBadge = ({ kind }) => {
  const map = {
    open:     { label: 'Åpen',     bg: 'oklch(0.65 0.18 85 / 0.12)',  fg: 'oklch(0.45 0.15 85)' },
    locked:   { label: 'Låst',     bg: 'oklch(0.75 0.15 75 / 0.14)',  fg: 'oklch(0.45 0.13 75)' },
    approved: { label: 'Godkjent', bg: 'oklch(0.68 0.15 145 / 0.12)', fg: 'oklch(0.42 0.13 145)' },
    exported: { label: 'Eksportert', bg: 'var(--muted)', fg: 'var(--muted-fg)' },
    error:    { label: 'Feil',     bg: 'oklch(0.60 0.20 25 / 0.12)',  fg: 'oklch(0.50 0.20 25)' },
    warning:  { label: 'Advarsel', bg: 'oklch(0.75 0.15 75 / 0.14)',  fg: 'oklch(0.45 0.13 75)' },
    info:     { label: 'Info',     bg: 'oklch(0.65 0.13 225 / 0.12)', fg: 'oklch(0.40 0.12 225)' },
    ack:      { label: 'Bekreftet',bg: 'oklch(0.55 0 0 / 0.10)',      fg: 'var(--muted-fg)' },
  };
  const t = map[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 9999,
      fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      background: t.bg, color: t.fg, whiteSpace: 'nowrap',
    }}>{t.label}</span>
  );
};

const Kr = ({ children, mono = true, size = 14, weight = 400, color }) => (
  <span style={{
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
    fontSize: size, fontWeight: weight, color: color || 'inherit',
    fontVariantNumeric: 'tabular-nums',
  }}>{children}</span>
);

const fmt = (n) => n.toLocaleString('no-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => n.toLocaleString('no-NO', { maximumFractionDigits: 0 });

// ═══════════════════════════════════════════════════════════
// SCREEN 1: Period list — /dashboard/payroll
// ═══════════════════════════════════════════════════════════
const PayrollPeriodList = () => {
  const periods = [
    { period: 'April 2026',   start: '01.04', end: '30.04', emp: 12, gross: 234567.00, dev: 9, devErr: 0, status: 'open' },
    { period: 'Mars 2026',    start: '01.03', end: '31.03', emp: 12, gross: 218900.50, dev: 0, status: 'approved' },
    { period: 'Februar 2026', start: '01.02', end: '28.02', emp: 11, gross: 198450.00, dev: 0, status: 'exported' },
    { period: 'Januar 2026',  start: '01.01', end: '31.01', emp: 11, gross: 207320.75, dev: 0, status: 'exported' },
    { period: 'Desember 2025', start: '01.12', end: '31.12', emp: 10, gross: 251890.25, dev: 0, status: 'exported' },
  ];

  return (
    <div style={{ width: PAGE_W, height: PAGE_H, display: 'flex', background: 'var(--background)',
      fontFamily: 'var(--font-body)', color: 'var(--foreground)', overflow: 'hidden' }}>
      <SidebarNav active="lønn" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <PageHeader
          crumbs={['Smartout', 'Lønn']}
          title="Lønnsperioder"
          subtitle="Lukk én måned i gangen — calc-engine deriverer, du bekrefter."
          actions={[
            <Btn key="s" variant="outline" size="md" icon="settings">Innstillinger</Btn>,
            <Btn key="r" variant="outline" size="md" icon="clock">Recalc</Btn>,
          ]}
        />

        {/* Strip: filter + summary */}
        <div style={{ padding: '16px 32px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--muted)', borderRadius: 10 }}>
            {['Alle', 'Åpne', 'Låst', 'Godkjent', 'Eksportert'].map((t, i) => (
              <div key={t} style={{
                padding: '6px 12px', fontSize: 13, borderRadius: 7,
                background: i === 0 ? 'var(--card)' : 'transparent',
                color: i === 0 ? 'var(--foreground)' : 'var(--muted-fg)',
                fontWeight: i === 0 ? 600 : 400,
                boxShadow: i === 0 ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}>{t}</div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 12px', background: 'var(--muted)', borderRadius: 8,
            fontSize: 13, color: 'var(--muted-fg)', minWidth: 200 }}>
            <Icon name="search" size={13} /> Søk periode
          </div>
        </div>

        {/* Open period — featured card */}
        <div style={{ padding: '20px 32px 0' }}>
          <div style={{
            border: '1px solid var(--border)', borderRadius: 16, padding: 24,
            background: 'linear-gradient(135deg, oklch(0.99 0.004 60), oklch(0.97 0.012 65))',
            display: 'flex', alignItems: 'center', gap: 24, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200,
              background: 'radial-gradient(circle, oklch(0.65 0.22 40 / 0.08), transparent 70%)' }} />
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <StatusBadge kind="open" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>
                  01.04 – 30.04 · 12 ansatte · 89 beregnede linjer
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                April 2026
              </div>
              <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--muted-fg)' }}>
                9 avvik krever oppmerksomhet · 3 må bekreftes før lås
              </div>
            </div>
            <div style={{ position: 'relative', display: 'flex', gap: 32, paddingRight: 8 }}>
              <Stat label="Brutto" value={'kr ' + fmt0(234567)} />
              <Stat label="Netto" value={'kr ' + fmt0(178432)} />
              <Stat label="Avvik" value="9" tone="warning" />
            </div>
            <Btn variant="default" size="lg" icon="arrow-right" style={{ position: 'relative' }}>Åpne periode</Btn>
          </div>
        </div>

        {/* Closed periods table */}
        <div style={{ padding: '24px 32px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, padding: '0 0 10px' }}>
            Tidligere perioder
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--card)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 140px 110px 1fr 140px 130px',
              padding: '12px 18px', borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500 }}>
              <div>Periode</div>
              <div>Datoer</div>
              <div>Ansatte</div>
              <div style={{ textAlign: 'right' }}>Brutto</div>
              <div>Avvik</div>
              <div>Status</div>
            </div>
            {periods.slice(1).map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 140px 110px 1fr 140px 130px',
                padding: '14px 18px', alignItems: 'center', borderBottom: i < periods.length - 2 ? '1px solid var(--border)' : 'none',
                background: i % 2 ? 'oklch(0.965 0.005 58 / 0.3)' : 'transparent' }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{p.period}</div>
                <Kr size={12.5} color="var(--muted-fg)">{p.start} – {p.end}</Kr>
                <Kr size={13}>{p.emp}</Kr>
                <Kr size={14} weight={500}><span style={{ textAlign: 'right', display: 'block' }}>kr {fmt(p.gross)}</span></Kr>
                <Kr size={12.5} color="var(--muted-fg)">— ingen åpne</Kr>
                <div><StatusBadge kind={p.status} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, tone }) => (
  <div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, marginBottom: 6 }}>{label}</div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700,
      letterSpacing: '-0.02em', color: tone === 'warning' ? 'oklch(0.55 0.15 75)' : 'var(--foreground)',
      fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

window.PayrollPeriodList = PayrollPeriodList;
window.SidebarNav = SidebarNav;
window.PageHeader = PageHeader;
window.StatusBadge = StatusBadge;
window.Kr = Kr;
window.fmt = fmt;
window.fmt0 = fmt0;
window.Stat = Stat;
window.PAGE_W = PAGE_W;
window.PAGE_H = PAGE_H;
