// Per-shift drill-down + Deviations tab + Lock modal

// ═══════════════════════════════════════════════════════════
// SCREEN 3: Employee shift drill-down (drawer over period detail)
// ═══════════════════════════════════════════════════════════
const EmployeeDrilldown = () => {
  const shifts = [
    { date: '01.04 ti', kl: '14:00–22:00', dept: 'kitchen', planned: 8.0, actual: 8.0, base: 1840, kveld: 92, helg: 0, helli: 0, total: 1932 },
    { date: '03.04 to', kl: '11:00–19:30', dept: 'kitchen', planned: 8.5, actual: 8.5, base: 1955, kveld: 0,  helg: 0, helli: 0, total: 1955 },
    { date: '05.04 lø', kl: '14:00–23:00', dept: 'kitchen', planned: 9.0, actual: 9.5, base: 2070, kveld: 138,helg: 414,helli: 0, total: 2622, ot: 0.5 },
    { date: '07.04 ma', kl: '11:00–19:00', dept: 'kitchen', planned: 8.0, actual: 8.0, base: 1840, kveld: 0,  helg: 0, helli: 0, total: 1840 },
    { date: '09.04 on', kl: '17:00–22:00', dept: 'kitchen', planned: 5.0, actual: 5.0, base: 1150, kveld: 250,helg: 0, helli: 0, total: 1400 },
    { date: '13.04 sø', kl: '11:00–19:00', dept: 'kitchen', planned: 8.0, actual: 8.0, base: 1840, kveld: 0,  helg: 736, helli: 0, total: 2576, dayLabel: 'Palmesøndag' },
    { date: '17.04 to', kl: '14:00–22:00', dept: 'kitchen', planned: 8.0, actual: 8.0, base: 1840, kveld: 92, helg: 0, helli: 1840, total: 3772, dayLabel: 'Skjærtorsdag', helliday: true },
    { date: '20.04 sø', kl: '11:00–19:00', dept: 'kitchen', planned: 8.0, actual: 8.0, base: 1840, kveld: 0,  helg: 736, helli: 0, total: 2576, dayLabel: 'Påskedag', warn: true },
  ];

  return (
    <div style={{ width: PAGE_W, height: PAGE_H, position: 'relative', background: 'var(--background)',
      fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
      {/* Backdrop = greyed-out period detail */}
      <div style={{ filter: 'blur(2px) saturate(0.7)', opacity: 0.45, pointerEvents: 'none' }}>
        <PayrollPeriodDetail />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,10,0.18)' }} />

      {/* Drawer */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 720,
        background: 'var(--card)', borderLeft: '1px solid var(--border)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Drawer header */}
        <div style={{ padding: '20px 28px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <button style={{ border: 'none', background: 'transparent', cursor: 'pointer',
              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted-fg)', marginLeft: -8 }}>
              <Icon name="x" size={18} />
            </button>
            <div style={{ flex: 1 }} />
            <Btn variant="ghost" size="sm" icon="external">Åpne profil</Btn>
            <Btn variant="outline" size="sm" icon="plus">Manuelt tillegg</Btn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Avatar name="Anna Kvist" size={56} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, letterSpacing: '-0.01em' }}>Anna Kvist</div>
              <div style={{ fontSize: 13, color: 'var(--muted-fg)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <DeptDot dept="kitchen" />
                <span>Kjøkken · Fastlønn 38 200 kr/mnd</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>62.5% stilling</span>
              </div>
            </div>
            <CompactStat label="Brutto april" value={'kr ' + fmt0(38450)} />
          </div>
        </div>

        {/* Period summary */}
        <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)',
          background: 'oklch(0.965 0.005 58 / 0.4)',
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
          <MiniStat label="Planlagt" value="162.5t" />
          <MiniStat label="Faktisk" value="168.0t" />
          <MiniStat label="OT" value="5.5t" tone="brand" />
          <MiniStat label="Kveld" value="12.0t" />
          <MiniStat label="Helg" value="16.5t" />
          <MiniStat label="Manuelt" value="200 kr" />
        </div>

        <div style={{ padding: '14px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500 }}>
            Vakter · 8 vakter · derivation snapshot
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5,
            color: 'oklch(0.55 0.15 75)', fontFamily: 'var(--font-mono)' }}>
            <Icon name="alert-circle" size={12} />
            <span>1 avvik på 20.04</span>
          </div>
        </div>

        {/* Shift list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 28px 24px' }}>
          {shifts.map((s, i) => <ShiftRow key={i} s={s} />)}

          {/* Derivation totals */}
          <div style={{ marginTop: 14, padding: '14px 16px',
            background: 'oklch(0.18 0.03 50)', color: 'oklch(0.95 0.005 55)',
            borderRadius: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>Derivation breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, fontSize: 13 }}>
              {[
                ['BASE_HOURLY · 168t × 230 kr',  '38 640'],
                ['SUPP_KVELD · 12t × 25%',       '690'],
                ['SUPP_HELG · 16.5t × 50%',     '1 898'],
                ['SUPP_HELLIG · 8t × 100%',     '1 840'],
                ['SUPP_OT · 5.5t × 50%',         '633'],
                ['MANUAL · Ekstra hjelp 17.04', '200'],
              ].map(([k, v]) => (
                <React.Fragment key={k}>
                  <div style={{ opacity: 0.85 }}>{k}</div>
                  <div></div>
                  <Kr mono size={13} weight={500}>{v}</Kr>
                </React.Fragment>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 4, paddingTop: 8, fontWeight: 600,
                fontSize: 14 }}>= Brutto</div>
              <div></div>
              <Kr mono size={14} weight={700}>{fmt0(38450)}</Kr>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShiftRow = ({ s }) => (
  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)',
    display: 'grid', gridTemplateColumns: '90px 130px 1fr 90px', gap: 16, alignItems: 'center',
    background: s.warn ? 'oklch(0.65 0.18 85 / 0.05)' : (s.helliday ? 'oklch(0.65 0.22 40 / 0.03)' : 'transparent'),
    borderRadius: 8 }}>
    <div>
      <div style={{ fontWeight: 500, fontSize: 13.5 }}>{s.date}</div>
      {s.dayLabel && (
        <div style={{ fontSize: 10.5, color: s.helliday ? 'var(--brand-orange-dark)' : 'var(--muted-fg)',
          fontFamily: 'var(--font-mono)', marginTop: 2 }}>{s.dayLabel}</div>
      )}
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-fg)' }}>
      {s.kl}
      {s.ot && <div style={{ color: 'var(--brand-orange-dark)', fontWeight: 600, marginTop: 2 }}>+{s.ot}t OT</div>}
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <SuppChip kind="base" amount={s.base} />
      {s.kveld > 0 && <SuppChip kind="kveld" amount={s.kveld} />}
      {s.helg > 0 && <SuppChip kind="helg" amount={s.helg} />}
      {s.helli > 0 && <SuppChip kind="hellig" amount={s.helli} />}
      {s.warn && <SuppChip kind="warn" />}
    </div>
    <Kr size={13.5} weight={600}>kr {fmt0(s.total)}</Kr>
  </div>
);

const SuppChip = ({ kind, amount }) => {
  const map = {
    base:    { label: 'Grunn', bg: 'var(--muted)', fg: 'var(--foreground)' },
    kveld:   { label: 'Kveld 25%', bg: 'oklch(0.55 0.20 300 / 0.10)', fg: 'oklch(0.40 0.20 300)' },
    helg:    { label: 'Helg 50%', bg: 'oklch(0.65 0.18 85 / 0.12)', fg: 'oklch(0.45 0.15 85)' },
    hellig:  { label: 'Hellig 100%', bg: 'oklch(0.65 0.22 40 / 0.12)', fg: 'oklch(0.45 0.18 40)' },
    warn:    { label: 'Bekreft helligdag', bg: 'oklch(0.60 0.20 25 / 0.10)', fg: 'var(--destructive)' },
  };
  const t = map[kind];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 9999, fontSize: 11,
      fontFamily: 'var(--font-mono)', background: t.bg, color: t.fg, fontWeight: 500 }}>
      {kind === 'warn' && <Icon name="alert-circle" size={11} />}
      <span>{t.label}</span>
      {amount != null && <span style={{ opacity: 0.7 }}>· {fmt0(amount)}</span>}
    </span>
  );
};

const MiniStat = ({ label, value, tone }) => (
  <div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, marginBottom: 3 }}>{label}</div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600,
      color: tone === 'brand' ? 'var(--brand-orange-dark)' : 'var(--foreground)',
      fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</div>
  </div>
);

window.EmployeeDrilldown = EmployeeDrilldown;
window.ShiftRow = ShiftRow;
window.SuppChip = SuppChip;
window.MiniStat = MiniStat;
