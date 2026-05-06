// Manual supplement form + Lønnsprofil panel + Settings + Tip pool

// ═══════════════════════════════════════════════════════════
// SCREEN 6: Manual supplement form (modal over period detail)
// ═══════════════════════════════════════════════════════════
const ManualSupplementForm = () => (
  <div style={{ width: PAGE_W, height: PAGE_H, position: 'relative', background: 'var(--background)',
    fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
    <div style={{ filter: 'blur(2px) saturate(0.7)', opacity: 0.4, pointerEvents: 'none' }}>
      <PayrollPeriodDetail />
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,10,0.32)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 640, background: 'var(--card)', borderRadius: 18,
        boxShadow: '0 24px 80px rgba(0,0,0,0.30)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', maxHeight: PAGE_H - 80 }}>
        <div style={{ padding: '22px 28px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, marginBottom: 4 }}>
              April 2026 · manuelt tillegg
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, letterSpacing: '-0.01em' }}>Legg til lønnslinje</div>
          </div>
          <div style={{ flex: 1 }} />
          <button style={{ border: 'none', background: 'transparent', cursor: 'pointer',
            width: 32, height: 32, borderRadius: 8, color: 'var(--muted-fg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ padding: '22px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Ansatt" required>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', border: '1.5px solid var(--brand-orange)', borderRadius: 10,
              background: 'oklch(0.65 0.22 40 / 0.04)' }}>
              <Avatar name="Anna Kvist" size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Anna Kvist</div>
                <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>Kjøkken · fastlønn</div>
              </div>
              <Icon name="chevron-down" size={14} style={{ color: 'var(--muted-fg)' }} />
            </div>
          </Field>

          <Field label="Type" required>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { icon: 'sparkles', label: 'Bonus', sel: true },
                { icon: 'wallet', label: 'Forskudd' },
                { icon: 'utensils-crossed', label: 'Trekk' },
                { icon: 'plus', label: 'Annet' },
              ].map(t => (
                <div key={t.label} style={{
                  padding: '12px 10px', borderRadius: 10, textAlign: 'center',
                  border: '1.5px solid ' + (t.sel ? 'var(--brand-orange)' : 'var(--border)'),
                  background: t.sel ? 'oklch(0.65 0.22 40 / 0.06)' : 'var(--card)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  color: t.sel ? 'var(--brand-orange-dark)' : 'var(--foreground)',
                  fontWeight: t.sel ? 600 : 400, fontSize: 13 }}>
                  <Icon name={t.icon} size={18} />
                  {t.label}
                </div>
              ))}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Beløp" required hint="Skattepliktig (alminnelig)">
              <div style={{ display: 'flex', alignItems: 'center',
                border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)',
                padding: '0 14px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-fg)', fontSize: 13 }}>kr</span>
                <input style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 8px',
                  fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600,
                  background: 'transparent', color: 'var(--foreground)' }} defaultValue="200,00" />
              </div>
            </Field>
            <Field label="Lønnskode" hint="Brukes ved A-melding">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                background: 'var(--card)', fontSize: 13.5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>5210</span>
                <span style={{ color: 'var(--muted-fg)' }}>· Bonus skattepliktig</span>
                <div style={{ flex: 1 }} />
                <Icon name="chevron-down" size={14} style={{ color: 'var(--muted-fg)' }} />
              </div>
            </Field>
          </div>

          <Field label="Beskrivelse · vises på lønnsslipp" required>
            <input style={{ width: '100%', padding: '12px 14px', boxSizing: 'border-box',
              border: '1px solid var(--border)', borderRadius: 10, fontSize: 14,
              fontFamily: 'var(--font-body)', background: 'var(--card)', color: 'var(--foreground)' }}
              defaultValue="Ekstra hjelp Skjærtorsdag" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Knytt til vakt" hint="Valgfritt">
              <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                background: 'var(--card)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="calendar" size={14} style={{ color: 'var(--muted-fg)' }} />
                <span>17.04 · 14:00–22:00</span>
                <div style={{ flex: 1 }} />
                <Icon name="chevron-down" size={14} style={{ color: 'var(--muted-fg)' }} />
              </div>
            </Field>
            <Field label="Synlighet">
              <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--muted)', borderRadius: 10 }}>
                {['Lønnsslipp', 'Bare admin'].map((t, i) => (
                  <div key={t} style={{
                    flex: 1, textAlign: 'center', padding: '8px', fontSize: 13, borderRadius: 7,
                    background: i === 0 ? 'var(--card)' : 'transparent',
                    fontWeight: i === 0 ? 600 : 400,
                    boxShadow: i === 0 ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>{t}</div>
                ))}
              </div>
            </Field>
          </div>

          <div style={{ background: 'var(--muted)', borderRadius: 10, padding: '12px 14px',
            display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--muted-fg)' }}>
            <Icon name="sparkles" size={14} style={{ color: 'var(--brand-orange)', marginTop: 2 }} />
            <div style={{ lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--foreground)' }}>Bot-Sson tipset:</strong> Mikkel og Ola jobbet også 17.04.
              Vil du legge til samme bonus for dem? <span style={{ color: 'var(--brand-orange-dark)', textDecoration: 'underline' }}>Legg til 2 til</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)',
          background: 'oklch(0.965 0.005 58 / 0.5)',
          display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>
            Linjen blir signert med din konto · 06.05.2026
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="md">Avbryt</Btn>
            <Btn variant="default" size="md" icon="check">Legg til linje</Btn>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Field = ({ label, required, hint, children }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 500 }}>
        {label}{required && <span style={{ color: 'var(--brand-orange)', marginLeft: 3 }}>*</span>}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--muted-fg)' }}>{hint}</div>}
    </div>
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════
// SCREEN 7: Employee Lønnsprofil + Timebank
// ═══════════════════════════════════════════════════════════
const EmployeeLonnsprofil = () => (
  <div style={{ width: PAGE_W, height: PAGE_H, display: 'flex', background: 'var(--background)',
    fontFamily: 'var(--font-body)', color: 'var(--foreground)', overflow: 'hidden' }}>
    <SidebarNav active="ansatte" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)',
          letterSpacing: '0.08em', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <span>Ansatte</span>
          <Icon name="chevron-right" size={11} style={{ opacity: 0.5 }} />
          <span style={{ color: 'var(--foreground)' }}>Anna Kvist</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name="Anna Kvist" size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, letterSpacing: '-0.02em' }}>Anna Kvist</div>
            <div style={{ fontSize: 13, color: 'var(--muted-fg)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <DeptDot dept="kitchen" />
              <span>Kjøkken · Fastlønn 38 200 kr/mnd · 62.5% stilling</span>
            </div>
          </div>
          <Btn variant="outline" size="md" icon="external">Profil</Btn>
          <Btn variant="default" size="md" icon="edit">Rediger lønnsprofil</Btn>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 32px', gap: 4 }}>
        {['Profil', 'Vakter', 'Lønn', 'Avtaler', 'Dokumenter'].map((t, i) => (
          <div key={t} style={{
            padding: '14px 16px', fontSize: 13.5, fontWeight: i === 2 ? 600 : 500,
            color: i === 2 ? 'var(--foreground)' : 'var(--muted-fg)',
            borderBottom: i === 2 ? '2px solid var(--brand-orange)' : '2px solid transparent',
            marginBottom: -1 }}>{t}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, marginBottom: 24 }}>
          {/* Left — Lønnsprofil + supplements */}
          <div>
            <SectionCard title="Lønnsprofil" subtitle="Brukes som default ved derivation" actions={<Btn variant="ghost" size="sm" icon="edit">Endre</Btn>}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Detail label="Lønnstype" value="Fastlønn" />
                <Detail label="Månedslønn" value="kr 38 200" mono />
                <Detail label="Timesats (derivert)" value="kr 235,00" mono hint="38 200 ÷ 162.5t" />
                <Detail label="Stillingsprosent" value="62.5%" mono />
                <Detail label="Skattekort" value="7000 kr · klasse 1" mono hint="Hentet 03.04 fra Skatteetaten" />
                <Detail label="Trekkperiode" value="6-ukers" />
                <Detail label="Pensjon" value="OTP 2% · Storebrand" />
                <Detail label="Feriepenger" value="12% · neste utbet. juni" />
              </div>
            </SectionCard>

            <SectionCard title="Tillegg-regler · personlige" subtitle="Override over avdelingens default"
              actions={<Btn variant="ghost" size="sm" icon="plus">Legg til</Btn>} mt={20}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <SuppRule rule="SUPP_KVELD" amount="+25%" window="18:00–22:00" source="Avdeling: Kjøkken" />
                <SuppRule rule="SUPP_HELG" amount="+50%" window="lø 13:00 – sø 23:59" source="Avdeling: Kjøkken" />
                <SuppRule rule="SUPP_HELLIG" amount="+100%" window="rød dag" source="Hovedavtale" />
                <SuppRule rule="OT_MND" amount="+50%" window="> 162.5t/mnd" source="Personlig" highlight />
              </div>
            </SectionCard>
          </div>

          {/* Right — Timebank */}
          <div>
            <SectionCard title="Timebank" subtitle="Saldo · alle banker">
              <div style={{ marginBottom: 16, padding: 16,
                background: 'linear-gradient(135deg, oklch(0.18 0.03 50), oklch(0.24 0.04 45))',
                color: 'oklch(0.95 0.005 55)', borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140,
                  background: 'radial-gradient(circle, oklch(0.65 0.22 40 / 0.30), transparent 70%)' }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
                  textTransform: 'uppercase', opacity: 0.6, marginBottom: 4, fontWeight: 500 }}>Pluss-timer</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums' }}>+6t 30m</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>oppdatert sist 30.04 · grense ±20t</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <BankBar label="Pluss/minus-bank" pos={6.5} max={20} />
                <BankBar label="Avspasering" pos={4.0} max={40} />
                <BankBar label="Ferie igjen" pos={18} max={25} unit="dager" />
                <BankBar label="Egenmelding" pos={8} max={24} unit="dager" tone="warning" />
              </div>
            </SectionCard>

            <SectionCard title="Siste justeringer" mt={16}>
              <div style={{ fontSize: 12.5 }}>
                {[
                  { date: '30.04', text: '+1.5t · OT godkjent', delta: '+1.5t', tone: 'pos' },
                  { date: '24.04', text: '−4t · avspasering brukt', delta: '−4.0t', tone: 'neg' },
                  { date: '17.04', text: '+8.5t · Skjærtorsdag x2', delta: '+8.5t', tone: 'pos' },
                  { date: '12.04', text: '+0.5t · forskjøvet pause', delta: '+0.5t', tone: 'pos' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)', width: 44 }}>{row.date}</span>
                    <span style={{ flex: 1 }}>{row.text}</span>
                    <Kr mono size={12.5} weight={500}
                      color={row.tone === 'pos' ? 'oklch(0.45 0.15 145)' : 'var(--destructive)'}>{row.delta}</Kr>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SectionCard = ({ title, subtitle, actions, children, mt = 0 }) => (
  <div style={{ marginTop: mt }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: 14, marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: 'var(--muted-fg)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {actions}
    </div>
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 18 }}>{children}</div>
  </div>
);

const Detail = ({ label, value, mono, hint }) => (
  <div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
    <div style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
      fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {hint && <div style={{ fontSize: 11, color: 'var(--muted-fg)', marginTop: 2 }}>{hint}</div>}
  </div>
);

const SuppRule = ({ rule, amount, window: w, source, highlight }) => (
  <div style={{ padding: '10px 12px', display: 'grid',
    gridTemplateColumns: '140px 70px 1fr', gap: 14, alignItems: 'center', fontSize: 12.5,
    borderBottom: '1px solid var(--border)',
    background: highlight ? 'oklch(0.65 0.22 40 / 0.04)' : 'transparent' }}>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--foreground)', fontWeight: 600 }}>{rule}</span>
    <Kr mono size={12.5} weight={600} color="var(--brand-orange-dark)">{amount}</Kr>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-fg)' }}>
      <span>{w}</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>{source}</span>
      {highlight && <Pill tone="brand">override</Pill>}
    </div>
  </div>
);

const BankBar = ({ label, pos, max, unit = 't', tone }) => {
  const pct = Math.min(1, Math.abs(pos) / max);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span>{label}</span>
        <Kr mono size={12} weight={500}>{pos > 0 ? '+' : ''}{pos}{unit} <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>/ {max}{unit}</span></Kr>
      </div>
      <div style={{ height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`,
          background: tone === 'warning' ? 'oklch(0.65 0.18 85)' : 'var(--brand-orange)',
          borderRadius: 3 }} />
      </div>
    </div>
  );
};

window.ManualSupplementForm = ManualSupplementForm;
window.EmployeeLonnsprofil = EmployeeLonnsprofil;
window.SectionCard = SectionCard;
window.Detail = Detail;
window.Field = Field;
window.SuppRule = SuppRule;
window.BankBar = BankBar;
