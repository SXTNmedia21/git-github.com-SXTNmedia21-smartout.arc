// Mobile payroll screens — iOS, 375×812
// 1) Payslip list (Lønn tab in profile)
// 2) Payslip detail (one period)
// 3) Timebank detail (history)
// 4) Approve OT (manager-on-the-go)
// 5) Wireframe / sitemap card

const PhoneFrame = ({ children }) => (
  <div style={{
    width: 375, height: 812, background: 'var(--background)',
    position: 'relative', overflow: 'hidden',
    fontFamily: 'var(--font-body)', color: 'var(--foreground)',
  }}>
    <div style={{ height: 44, position: 'relative', padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, zIndex: 10 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>09:41</span>
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
        width: 110, height: 28, borderRadius: 20, background: '#000' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="6" rx="1"/><rect x="10" y="2" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="11" rx="1" opacity=".4"/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="21" height="11" rx="2.5"/><rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor"/><rect x="22.5" y="4" width="1.5" height="4" rx="0.5" fill="currentColor"/></svg>
      </div>
    </div>
    {children}
  </div>
);

const MobileTabBar = ({ active }) => (
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 82,
    background: 'oklch(0.99 0.004 60 / 0.92)', backdropFilter: 'blur(20px)',
    borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-around', paddingTop: 10,
  }}>
    {[
      ['home', 'Hjem'],
      ['calendar', 'Vakter'],
      ['lifebuoy', 'Min kø'],
      ['wallet', 'Lønn'],
      ['user', 'Meg'],
    ].map(([ic, lbl]) => {
      const on = lbl.toLowerCase() === active;
      return (
        <div key={lbl} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          color: on ? 'var(--brand-orange)' : 'var(--muted-fg)', fontWeight: on ? 600 : 400, minWidth: 52 }}>
          <Icon name={ic} size={22} stroke={on ? 2 : 1.75} />
          <div style={{ fontSize: 10 }}>{lbl}</div>
        </div>
      );
    })}
  </div>
);

const HomeI = () => (
  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 34,
    display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 8 }}>
    <div style={{ width: 135, height: 5, borderRadius: 3, background: 'var(--foreground)' }} />
  </div>
);

// ─── Mobile 1: Lønn — payslip list ────────────────────────
const MobileLonn = () => (
  <PhoneFrame>
    <div style={{ padding: '8px 20px 18px' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 34, letterSpacing: '-0.02em' }}>Lønn</div>
      <div style={{ fontSize: 13, color: 'var(--muted-fg)', marginTop: 2 }}>Slipper, timebank og ferie</div>
    </div>

    {/* Hero — current period preview */}
    <div style={{ padding: '0 20px 14px' }}>
      <div style={{
        background: 'linear-gradient(135deg, oklch(0.18 0.03 50), oklch(0.22 0.04 45))',
        color: 'oklch(0.95 0.005 55)', borderRadius: 18, padding: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180,
          background: 'radial-gradient(circle, oklch(0.65 0.22 40 / 0.30), transparent 70%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Foreløpig · april 2026</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700,
            letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>kr 27 890</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Netto · oppdateres til lønnsslipp 28.04</div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <MiniDark label="Timer" value="168" />
            <MiniDark label="Tillegg" value="kr 2 461" />
            <MiniDark label="Timebank" value="+6t 30m" tone="brand" />
          </div>
        </div>
      </div>
    </div>

    <div style={{ padding: '0 20px 110px', overflowY: 'auto', height: 'calc(812px - 264px - 82px)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, padding: '8px 4px 10px' }}>
        Lønnsslipper
      </div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {[
          { period: 'Mars 2026',    net: 28430, paid: '15.04', open: true },
          { period: 'Februar 2026', net: 26150, paid: '15.03' },
          { period: 'Januar 2026',  net: 27890, paid: '15.02' },
          { period: 'Desember 2025',net: 31420, paid: '15.01', tag: 'Hellig' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)' }}>
              <Icon name="wallet" size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{s.period}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', marginTop: 2,
                display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Utbetalt {s.paid}</span>
                {s.tag && (<><span style={{ opacity: 0.4 }}>·</span><span style={{ color: 'var(--brand-orange-dark)' }}>{s.tag}</span></>)}
              </div>
            </div>
            <Kr mono size={14} weight={500}>kr {fmt0(s.net)}</Kr>
            <Icon name="chevron-right" size={14} style={{ color: 'var(--muted-fg)', opacity: 0.5 }} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 22, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, padding: '0 4px 10px' }}>Banker</div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <BankRow icon="clock" label="Timebank" value="+6t 30m" mono />
        <BankRow icon="calendar" label="Avspasering" value="4t igjen" />
        <BankRow icon="map-pin" label="Ferie" value="18 / 25 dager" />
      </div>
    </div>
    <MobileTabBar active="lønn" />
    <HomeI />
  </PhoneFrame>
);

const MiniDark = ({ label, value, tone }) => (
  <div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
      textTransform: 'uppercase', opacity: 0.55, marginBottom: 3 }}>{label}</div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
      color: tone === 'brand' ? 'oklch(0.85 0.18 40)' : '#fff',
      fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

const BankRow = ({ icon, label, value, mono }) => (
  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
    borderBottom: '1px solid var(--border)' }}>
    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)' }}>
      <Icon name={icon} size={15} />
    </div>
    <div style={{ flex: 1, fontSize: 14 }}>{label}</div>
    <Kr mono={mono} size={13} weight={500} color="var(--muted-fg)">{value}</Kr>
    <Icon name="chevron-right" size={14} style={{ color: 'var(--muted-fg)', opacity: 0.5 }} />
  </div>
);

// ─── Mobile 2: Payslip detail ─────────────────────────────
const MobilePayslip = () => (
  <PhoneFrame>
    <div style={{ padding: '4px 16px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <button style={{ border: 'none', background: 'transparent', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}>
          <Icon name="chevron-left" size={22} />
        </button>
        <div style={{ flex: 1 }} />
        <button style={{ border: 'none', background: 'transparent', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)' }}>
          <Icon name="external" size={18} />
        </button>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500 }}>Lønnsslipp</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, letterSpacing: '-0.02em', marginTop: 2 }}>Mars 2026</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <StatusBadge kind="approved" />
        <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>Utbetalt 15.04</span>
      </div>
    </div>

    <div style={{ overflowY: 'auto', height: 'calc(812px - 168px - 82px)', padding: '14px 16px 110px' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500 }}>Netto</span>
          <Kr mono size={28} weight={700}>kr 28 430</Kr>
        </div>
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />
        {[
          { label: 'Grunnlønn · 156t × 230', amt: 35880 },
          { label: 'Kveldstillegg · 12t × 25%', amt: 690 },
          { label: 'Helgtillegg · 16.5t × 50%', amt: 1898 },
          { label: 'Brutto', amt: 38468, total: true },
          { label: 'Forskuddsskatt', amt: -8420, neg: true },
          { label: 'Pensjon · 2%', amt: -769, neg: true },
          { label: 'Fagforening', amt: -150, neg: true },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
            padding: '7px 0', fontSize: 13.5,
            fontWeight: r.total ? 600 : 400,
            borderTop: r.total ? '1px solid var(--border)' : 'none',
            paddingTop: r.total ? 10 : 7, marginTop: r.total ? 4 : 0 }}>
            <span style={{ color: r.total ? 'var(--foreground)' : 'var(--muted-fg)' }}>{r.label}</span>
            <Kr mono size={13.5} weight={r.total ? 600 : 400}
              color={r.neg ? 'var(--destructive)' : 'inherit'}>{r.neg ? '−' : ''}{fmt0(Math.abs(r.amt))}</Kr>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, padding: '0 4px 8px' }}>Timer</div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 16, fontSize: 13.5, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ color: 'var(--muted-fg)' }}>Faktiske timer</span><Kr mono size={13.5}>156.0</Kr>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ color: 'var(--muted-fg)' }}>Hvorav helg</span><Kr mono size={13.5}>16.5</Kr>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ color: 'var(--muted-fg)' }}>Hvorav kveld</span><Kr mono size={13.5}>12.0</Kr>
        </div>
      </div>

      <div style={{ background: 'oklch(0.65 0.13 225 / 0.06)',
        border: '1px solid oklch(0.65 0.13 225 / 0.18)', borderRadius: 12, padding: 14,
        display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="alert-circle" size={14} style={{ color: 'oklch(0.40 0.12 225)', marginTop: 2 }} />
        <div style={{ fontSize: 12.5, color: 'var(--muted-fg)', lineHeight: 1.55 }}>
          Spørsmål om denne slippen? <span style={{ color: 'var(--brand-orange-dark)', fontWeight: 500 }}>Åpne sak i #lønn</span>
        </div>
      </div>
    </div>
    <MobileTabBar active="lønn" />
    <HomeI />
  </PhoneFrame>
);

// ─── Mobile 3: Timebank detail ────────────────────────────
const MobileTimebank = () => (
  <PhoneFrame>
    <div style={{ padding: '4px 16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <button style={{ border: 'none', background: 'transparent', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}>
          <Icon name="chevron-left" size={22} />
        </button>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, letterSpacing: '-0.02em' }}>Timebank</div>
      <div style={{ fontSize: 13, color: 'var(--muted-fg)', marginTop: 2 }}>Pluss-timer du kan ta ut som avspasering</div>
    </div>

    {/* Big number */}
    <div style={{ padding: '14px 20px 0' }}>
      <div style={{ background: 'linear-gradient(135deg, oklch(0.18 0.03 50), oklch(0.24 0.04 45))',
        color: 'oklch(0.95 0.005 55)', borderRadius: 20, padding: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          background: 'radial-gradient(circle, oklch(0.65 0.22 40 / 0.35), transparent 70%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', opacity: 0.6, marginBottom: 6, fontWeight: 500 }}>Saldo</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 56, fontWeight: 700, letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>+6t 30m</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Av maks ±20t · oppdatert 30.04</div>
          <div style={{ marginTop: 16, height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '32%', background: 'oklch(0.75 0.18 40)', borderRadius: 3 }} />
          </div>
        </div>
      </div>
    </div>

    <div style={{ padding: '20px 20px 110px', overflowY: 'auto', height: 'calc(812px - 360px - 82px)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Btn variant="default" size="md" icon="plus" style={{ flex: 1 }}>Be om avspasering</Btn>
        <Btn variant="outline" size="md" icon="external">Logg</Btn>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, padding: '0 4px 10px' }}>April · justeringer</div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {[
          { date: '30.04', text: 'OT godkjent · vakt 28.04', delta: '+1t 30m', tone: 'pos', source: 'auto' },
          { date: '24.04', text: 'Avspasering brukt · halv dag', delta: '−4t 00m', tone: 'neg', source: 'manuelt' },
          { date: '17.04', text: 'Skjærtorsdag x2', delta: '+8t 30m', tone: 'pos', source: 'auto' },
          { date: '12.04', text: 'Forskjøvet pause', delta: '+0t 30m', tone: 'pos', source: 'auto' },
          { date: '03.04', text: 'Ekstra vakt', delta: '+0t 00m', tone: 'pos', source: 'auto' },
        ].map((r, i) => (
          <div key={i} style={{ padding: '14px 16px', display: 'grid',
            gridTemplateColumns: '50px 1fr auto', gap: 10, alignItems: 'flex-start',
            borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-fg)' }}>{r.date}</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.text}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{r.source}</div>
            </div>
            <Kr mono size={13.5} weight={600}
              color={r.tone === 'pos' ? 'oklch(0.45 0.13 145)' : 'var(--destructive)'}>{r.delta}</Kr>
          </div>
        ))}
      </div>
    </div>
    <MobileTabBar active="lønn" />
    <HomeI />
  </PhoneFrame>
);

// ─── Mobile 4: Manager OT-approval (push tap) ─────────────
const MobileApprove = () => (
  <PhoneFrame>
    <div style={{ padding: '4px 16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button style={{ border: 'none', background: 'transparent', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}>
          <Icon name="x" size={22} />
        </button>
        <div style={{ flex: 1 }} />
        <button style={{ border: 'none', background: 'transparent', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)' }}>
          <Icon name="more" size={18} />
        </button>
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500 }}>Avvik · krever bekreftelse</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, letterSpacing: '-0.01em',
        lineHeight: 1.15, marginTop: 2 }}>OT over avtalt grense</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted-fg)', marginTop: 6,
        fontFamily: 'var(--font-mono)' }}>D-103 · #lønn · 14 min siden</div>
    </div>

    <div style={{ padding: '14px 16px 110px', overflowY: 'auto', height: 'calc(812px - 192px - 82px)' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Avatar name="Mikkel Dahl" size={44} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Mikkel Dahl</div>
            <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>Bar · timebasert</div>
          </div>
          <DeptDot dept="bar" size={10} />
        </div>
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
          <span style={{ color: 'var(--muted-fg)' }}>Grense april</span><Kr mono size={13} weight={500}>8t</Kr>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
          <span style={{ color: 'var(--muted-fg)' }}>Faktisk OT</span><Kr mono size={13} weight={500} color="var(--brand-orange-dark)">9.5t</Kr>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
          <span style={{ color: 'var(--muted-fg)' }}>Tilleggslønn</span><Kr mono size={13} weight={500}>kr 1 092</Kr>
        </div>
      </div>

      <div style={{ background: 'oklch(0.65 0.18 85 / 0.08)',
        border: '1px solid oklch(0.65 0.18 85 / 0.22)', borderRadius: 12, padding: 14, marginBottom: 14,
        display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="alert-circle" size={14} style={{ color: 'oklch(0.45 0.15 85)', marginTop: 2 }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Hvorfor må du bekrefte?</div>
          <div style={{ color: 'var(--muted-fg)' }}>
            Hovedavtale §10.1 setter 8t/mnd som standardgrense. Mikkel signerte i appen 14.04 — du må godkjenne for at lønn skal kunne låses.
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 16, fontSize: 12.5, color: 'var(--muted-fg)', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>Mikkels notat:</div>
        Dekket lørdag 28. for Linn — gikk over fordi det var travelt. Ok for meg.
      </div>
    </div>

    {/* Sticky bottom action */}
    <div style={{ position: 'absolute', bottom: 82, left: 0, right: 0,
      padding: '14px 16px', background: 'oklch(0.99 0.004 60 / 0.95)', backdropFilter: 'blur(16px)',
      borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
      <Btn variant="outline" size="lg" style={{ flex: 1 }}>Avvis</Btn>
      <Btn variant="default" size="lg" icon="check" style={{ flex: 2 }}>Bekreft OT</Btn>
    </div>
    <MobileTabBar active="min kø" />
    <HomeI />
  </PhoneFrame>
);

// ═══════════════════════════════════════════════════════════
// SCREEN 14: Wireframe / sitemap overview
// ═══════════════════════════════════════════════════════════
const Wireframe = () => (
  <div style={{ width: 1320, height: 880, background: 'var(--card)',
    fontFamily: 'var(--font-body)', color: 'var(--foreground)', padding: 40, position: 'relative', overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 36, letterSpacing: '-0.02em' }}>Payroll · Phase 1 sitemap</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)',
        letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sortie payroll-mvp · 5 sprints</div>
    </div>
    <div style={{ fontSize: 14, color: 'var(--muted-fg)', maxWidth: 740, marginBottom: 28 }}>
      Calc-engine deriverer alt, mennesket bekrefter avvik og låser. Hovedflyten lever i én side
      med fane-skift; alle støtte-views henger på som drawers eller modals.
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 28, marginBottom: 24 }}>
      {/* Web manager */}
      <Lane title="Web · daglig leder" tone="brand">
        <Node n="01" label="Lønnsperioder" sub="/dashboard/payroll" />
        <Arrow />
        <Node n="02" label="Periode-detalj · Linjer" sub="/payroll/april-2026" primary />
        <Branch>
          <Node n="03" label="Drilldown drawer" sub="per ansatt" small />
          <Node n="04" label="Avvik · ack" sub="tab inni samme side" small />
          <Node n="06" label="Manuelt tillegg" sub="modal" small />
        </Branch>
        <Arrow />
        <Node n="05" label="Lås periode" sub="bekreftelses-modal → eksport" />
      </Lane>

      <Lane title="Web · personal & policy" tone="purple">
        <Node n="07" label="Lønnsprofil + Timebank" sub="/employees/anna" />
        <Arrow />
        <Node n="08" label="Innstillinger" sub="periode · pause · A-melding" />
        <Arrow />
        <Node n="09" label="Tillegg-regler + tester" sub="kveld / helg / hellig / OT" primary />
        <Arrow />
        <Node n="10" label="Bot-Sson chat" sub="lås-tip · tipspott · OT" />
      </Lane>

      <Lane title="Mobile · ansatt + leder">
        <Node n="11" label="Lønn · slipper-liste" sub="iOS tab" mobile />
        <Arrow />
        <Node n="12" label="Lønnsslipp · detalj" sub="brutto → netto" mobile />
        <Branch>
          <Node n="13" label="Timebank · historikk" sub="±20t" small mobile />
          <Node n="14" label="Bekreft OT" sub="push → handling" small mobile />
        </Branch>
      </Lane>
    </div>

    {/* Legend */}
    <div style={{ position: 'absolute', bottom: 32, left: 40, right: 40,
      display: 'flex', alignItems: 'center', gap: 24, fontSize: 12, color: 'var(--muted-fg)',
      borderTop: '1px solid var(--border)', paddingTop: 18 }}>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--brand-orange)' }} />
        Primær flow · lukke en periode
      </span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, border: '1.5px dashed var(--muted-fg)' }} />
        Drawer / modal — ikke egen URL
      </span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: 'oklch(0.55 0.25 300)' }} />
        Konfigurasjon · sjeldnere
      </span>
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em' }}>14 surfaces · 1 calc-engine</span>
    </div>
  </div>
);

const Lane = ({ title, tone, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, marginBottom: 4,
      display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%',
        background: tone === 'brand' ? 'var(--brand-orange)' :
                    tone === 'purple' ? 'oklch(0.55 0.25 300)' : 'var(--muted-fg)' }} />
      {title}
    </div>
    {children}
  </div>
);

const Node = ({ n, label, sub, primary, small, mobile }) => (
  <div style={{
    border: '1.5px solid ' + (primary ? 'var(--brand-orange)' : 'var(--border)'),
    background: primary ? 'oklch(0.65 0.22 40 / 0.04)' : 'var(--card)',
    borderRadius: 12, padding: small ? '10px 12px' : '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
    <div style={{ width: small ? 28 : 36, height: small ? 28 : 36,
      borderRadius: small ? 7 : 9, flexShrink: 0,
      background: primary ? 'var(--brand-orange)' : 'var(--muted)',
      color: primary ? '#fff' : 'var(--muted-fg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: small ? 11 : 13 }}>{n}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: small ? 13 : 14 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: small ? 10.5 : 11.5,
        color: 'var(--muted-fg)', marginTop: 2 }}>{sub}</div>
    </div>
    {mobile && <Icon name="phone" size={13} style={{ color: 'var(--muted-fg)', opacity: 0.6 }} />}
  </div>
);

const Arrow = () => (
  <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--muted-fg)', opacity: 0.5 }}>
    <Icon name="chevron-down" size={16} />
  </div>
);

const Branch = ({ children }) => (
  <div style={{ marginLeft: 24, paddingLeft: 16, borderLeft: '1.5px dashed var(--border)',
    display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
);

window.MobileLonn = MobileLonn;
window.MobilePayslip = MobilePayslip;
window.MobileTimebank = MobileTimebank;
window.MobileApprove = MobileApprove;
window.Wireframe = Wireframe;
