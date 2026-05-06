// Period detail — /dashboard/payroll/[periodId]
// Tabs: Lines | Deviations | Manual supplements | Tip pool | Export

const PERIOD_EMPLOYEES = [
  { id: 1, name: 'Anna Kvist',   role: 'Kjøkken · fastlønn',  sched: 162.5, actual: 168.0, ot: 5.5, kveld: 12.0, helg: 16.5, holiday: 0,  manual: 200,  gross: 38450.00, net: 27890.00, devs: 1, devKind: 'warning', dept: 'kitchen' },
  { id: 2, name: 'Mikkel Dahl',  role: 'Bar · timebasert',    sched: 152.0, actual: 161.5, ot: 9.5, kveld: 18.5, helg: 24.0, holiday: 8.5, manual: 0,    gross: 32150.50, net: 22340.10, devs: 2, devKind: 'error',   dept: 'bar' },
  { id: 3, name: 'Kari Holm',    role: 'Sal · timebasert',    sched: 156.0, actual: 156.0, ot: 0,   kveld: 8.0,  helg: 12.0, holiday: 0,  manual: 0,    gross: 28900.00, net: 20100.50, devs: 0, dept: 'floor' },
  { id: 4, name: 'Linn Andersen',role: 'Sal · fastlønn',      sched: 162.5, actual: 164.0, ot: 1.5, kveld: 4.0,  helg: 8.0,  holiday: 0,  manual: 350,  gross: 35200.00, net: 25600.40, devs: 0, dept: 'floor' },
  { id: 5, name: 'Ola Hansen',   role: 'Kjøkken · timebasert',sched: 130.0, actual: 142.0, ot: 12.0,kveld: 16.5, helg: 20.0, holiday: 8.5, manual: 0,   gross: 31450.75, net: 22120.30, devs: 2, devKind: 'error',   dept: 'kitchen' },
  { id: 6, name: 'Thea Ruud',    role: 'Bar · deltid',        sched: 80.0,  actual: 84.5,  ot: 4.5, kveld: 22.0, helg: 16.0, holiday: 0,  manual: 0,    gross: 18900.00, net: 13800.20, devs: 1, devKind: 'warning', dept: 'bar' },
  { id: 7, name: 'Jonas Berg',   role: 'Lager · timebasert',  sched: 144.0, actual: 144.0, ot: 0,   kveld: 0,    helg: 0,    holiday: 0,  manual: 0,    gross: 24800.00, net: 18200.10, devs: 0, dept: 'storage' },
  { id: 8, name: 'Elise Fjell',  role: 'Sal · timebasert',    sched: 120.0, actual: 122.5, ot: 2.5, kveld: 6.0,  helg: 10.0, holiday: 0,  manual: 100,  gross: 21340.00, net: 15750.00, devs: 1, devKind: 'warning', dept: 'floor' },
];

const TabBar = ({ tabs, active }) => (
  <div style={{ display: 'flex', borderBottom: '1px solid var(--border)',
    padding: '0 32px', background: 'var(--background)', gap: 4 }}>
    {tabs.map(([key, label, count]) => {
      const on = key === active;
      return (
        <div key={key} style={{
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13.5, fontWeight: on ? 600 : 500,
          color: on ? 'var(--foreground)' : 'var(--muted-fg)',
          borderBottom: on ? '2px solid var(--brand-orange)' : '2px solid transparent',
          marginBottom: -1, cursor: 'pointer',
        }}>
          {label}
          {count != null && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              padding: '1px 7px', borderRadius: 9999,
              background: on ? 'oklch(0.65 0.22 40 / 0.12)' : 'var(--muted)',
              color: on ? 'var(--brand-orange-dark)' : 'var(--muted-fg)',
            }}>{count}</span>
          )}
        </div>
      );
    })}
  </div>
);

const DeptDot = ({ dept, size = 8 }) => (
  <span style={{ width: size, height: size, borderRadius: '50%',
    background: `var(--dept-${dept})`, display: 'inline-block', flexShrink: 0 }} />
);

// ═══════════════════════════════════════════════════════════
// SCREEN 2: Period detail — Lines tab
// ═══════════════════════════════════════════════════════════
const PayrollPeriodDetail = () => {
  return (
    <div style={{ width: PAGE_W, height: PAGE_H, display: 'flex', background: 'var(--background)',
      fontFamily: 'var(--font-body)', color: 'var(--foreground)', overflow: 'hidden' }}>
      <SidebarNav active="lønn" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)',
            letterSpacing: '0.08em', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <span>Smartout</span>
            <Icon name="chevron-right" size={11} style={{ opacity: 0.5 }} />
            <span>Lønn</span>
            <Icon name="chevron-right" size={11} style={{ opacity: 0.5 }} />
            <span style={{ color: 'var(--foreground)' }}>April 2026</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  April 2026
                </div>
                <StatusBadge kind="open" />
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)',
                display: 'flex', gap: 16, alignItems: 'center' }}>
                <span>01.04 – 30.04</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>12 ansatte</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>89 linjer</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>derivation v3</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 28, marginRight: 24 }}>
              <CompactStat label="Brutto"   value={'kr ' + fmt0(234567)} />
              <CompactStat label="Netto"    value={'kr ' + fmt0(178432)} />
              <CompactStat label="Tillegg"  value={'kr ' + fmt0(18420)} />
              <CompactStat label="Manuelle" value={'kr ' + fmt0(650)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="outline" size="md" icon="external">Eksport</Btn>
              <Btn variant="default" size="md" icon="lock">Lås periode</Btn>
            </div>
          </div>
        </div>

        <TabBar
          active="lines"
          tabs={[
            ['lines', 'Linjer', 12],
            ['deviations', 'Avvik', 9],
            ['manual', 'Manuelle tillegg', 4],
            ['tip', 'Tipspott', null],
            ['export', 'Eksport', null],
          ]}
        />

        {/* Filter strip */}
        <div style={{ padding: '14px 32px 0', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
            background: 'var(--muted)', borderRadius: 8, fontSize: 13, color: 'var(--muted-fg)', minWidth: 240 }}>
            <Icon name="search" size={13} />
            <span>Søk navn …</span>
          </div>
          <FilterChip label="Avdeling" value="Alle" />
          <FilterChip label="Avvik" value="Alle" />
          <FilterChip label="Lønnstype" value="Alle" />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
            8 av 12 ansatte
          </div>
        </div>

        {/* Lines table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 32px 24px' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 14,
            overflow: 'hidden', background: 'var(--card)' }}>
            <LineTableHeader />

            {/* Totals row */}
            <div style={{ display: 'grid', gridTemplateColumns: COLS,
              padding: '12px 16px', alignItems: 'center',
              background: 'oklch(0.65 0.22 40 / 0.04)',
              borderBottom: '1px solid var(--border)',
              fontWeight: 600, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontStyle: 'italic',
                  color: 'var(--brand-orange-dark)' }}>Σ Total</span>
              </div>
              <div></div>
              <Kr size={12} weight={600} mono>1 107.0</Kr>
              <Kr size={12} weight={600} mono>1 142.5</Kr>
              <Kr size={12} weight={600} mono color="var(--brand-orange-dark)">35.5</Kr>
              <Kr size={12} weight={600} mono>87.0</Kr>
              <Kr size={12} weight={600} mono>106.5</Kr>
              <Kr size={12} weight={600} mono>17.0</Kr>
              <Kr size={12} weight={600} mono>650</Kr>
              <Kr size={13} weight={700} mono>{fmt0(234567)}</Kr>
              <div></div>
            </div>

            {PERIOD_EMPLOYEES.map((e, i) => (
              <LineRow key={e.id} e={e} highlighted={i === 0} odd={i % 2 === 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const COLS = '220px 64px 64px 64px 64px 64px 64px 64px 70px 100px 36px';

const LineTableHeader = () => (
  <div style={{ display: 'grid', gridTemplateColumns: COLS,
    padding: '11px 16px', borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500,
    background: 'oklch(0.965 0.005 58 / 0.4)' }}>
    <div>Ansatt</div>
    <div style={{ textAlign: 'right' }}>Plan</div>
    <div style={{ textAlign: 'right' }}>Faktisk</div>
    <div style={{ textAlign: 'right' }}>OT</div>
    <div style={{ textAlign: 'right' }}>Kveld</div>
    <div style={{ textAlign: 'right' }}>Helg</div>
    <div style={{ textAlign: 'right' }}>Hellig</div>
    <div style={{ textAlign: 'right' }}>Manuelt</div>
    <div style={{ textAlign: 'right' }}>Avvik</div>
    <div style={{ textAlign: 'right' }}>Brutto</div>
    <div></div>
  </div>
);

const LineRow = ({ e, highlighted, odd }) => (
  <div style={{ display: 'grid', gridTemplateColumns: COLS,
    padding: '12px 16px', alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    background: highlighted ? 'oklch(0.65 0.22 40 / 0.025)' : (odd ? 'oklch(0.965 0.005 58 / 0.3)' : 'transparent'),
    fontSize: 13 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Avatar name={e.name} size={28} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted-fg)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <DeptDot dept={e.dept} size={6} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.role}</span>
        </div>
      </div>
    </div>
    <Cell mono>{e.sched.toFixed(1)}</Cell>
    <Cell mono color={e.actual > e.sched ? 'var(--foreground)' : 'var(--muted-fg)'}>{e.actual.toFixed(1)}</Cell>
    <Cell mono color={e.ot > 0 ? 'var(--brand-orange-dark)' : 'var(--muted-fg)'} weight={e.ot > 0 ? 600 : 400}>
      {e.ot > 0 ? e.ot.toFixed(1) : '—'}
    </Cell>
    <Cell mono color={e.kveld > 0 ? 'var(--foreground)' : 'var(--muted-fg)'}>{e.kveld > 0 ? e.kveld.toFixed(1) : '—'}</Cell>
    <Cell mono color={e.helg > 0 ? 'var(--foreground)' : 'var(--muted-fg)'}>{e.helg > 0 ? e.helg.toFixed(1) : '—'}</Cell>
    <Cell mono color={e.holiday > 0 ? 'var(--brand-orange-dark)' : 'var(--muted-fg)'} weight={e.holiday > 0 ? 600 : 400}>
      {e.holiday > 0 ? e.holiday.toFixed(1) : '—'}
    </Cell>
    <Cell mono color={e.manual > 0 ? 'var(--foreground)' : 'var(--muted-fg)'}>{e.manual > 0 ? e.manual : '—'}</Cell>
    <Cell mono>
      {e.devs > 0 ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--font-mono)', fontSize: 11.5,
          color: e.devKind === 'error' ? 'var(--destructive)' : 'oklch(0.55 0.15 75)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%',
            background: e.devKind === 'error' ? 'var(--destructive)' : 'oklch(0.65 0.18 85)' }} />
          {e.devs}
        </span>
      ) : <span style={{ color: 'var(--muted-fg)' }}>—</span>}
    </Cell>
    <Cell mono weight={500}>{fmt0(e.gross)}</Cell>
    <div style={{ textAlign: 'right' }}>
      <Icon name="chevron-right" size={14} style={{ color: 'var(--muted-fg)', opacity: 0.6 }} />
    </div>
  </div>
);

const Cell = ({ children, mono, color, weight, align = 'right' }) => (
  <div style={{ textAlign: align,
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
    color: color || 'inherit', fontWeight: weight || 400,
    fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{children}</div>
);

const CompactStat = ({ label, value }) => (
  <div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, marginBottom: 3 }}>{label}</div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 600,
      letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

const FilterChip = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8,
    fontSize: 12.5, background: 'var(--card)', cursor: 'pointer' }}>
    <span style={{ color: 'var(--muted-fg)' }}>{label}:</span>
    <span style={{ fontWeight: 500 }}>{value}</span>
    <Icon name="chevron-down" size={12} style={{ color: 'var(--muted-fg)' }} />
  </div>
);

window.PayrollPeriodDetail = PayrollPeriodDetail;
window.TabBar = TabBar;
window.DeptDot = DeptDot;
window.Cell = Cell;
window.LineRow = LineRow;
window.LineTableHeader = LineTableHeader;
window.COLS = COLS;
window.CompactStat = CompactStat;
window.FilterChip = FilterChip;
window.PERIOD_EMPLOYEES = PERIOD_EMPLOYEES;
