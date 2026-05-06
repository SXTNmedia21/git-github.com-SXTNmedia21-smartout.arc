// Deviations tab + Lock modal + Manual supplement form

// ═══════════════════════════════════════════════════════════
// SCREEN 4: Deviations tab — list of unresolved derivation issues
// ═══════════════════════════════════════════════════════════
const DEVIATIONS = [
  { id: 'D-103', kind: 'error', code: 'OVERTID_OVER_GRENSE', emp: 'Mikkel Dahl', dept: 'bar',
    title: 'Overtid over avtalt grense', detail: 'Mikkel har 9.5t overtid i april — avtalt grense er 8t/mnd.',
    date: '20.04', requires: 'Bekreftelse fra ansvarlig + ansatt', status: 'open' },
  { id: 'D-104', kind: 'error', code: 'HELLIGDAG_KOLLISJON', emp: 'Mikkel Dahl', dept: 'bar',
    title: 'Vakt 17.04 (Skjærtorsdag) krever bekreftelse', detail: 'Hovedavtalen krever signert tillegg for arbeid på rød dag.',
    date: '17.04', requires: 'Lederbekreftelse', status: 'open' },
  { id: 'D-105', kind: 'error', code: 'HELLIGDAG_KOLLISJON', emp: 'Ola Hansen', dept: 'kitchen',
    title: 'Vakt 17.04 (Skjærtorsdag) krever bekreftelse', detail: 'Hovedavtalen krever signert tillegg for arbeid på rød dag.',
    date: '17.04', requires: 'Lederbekreftelse', status: 'open' },
  { id: 'D-106', kind: 'error', code: 'OVERTID_OVER_GRENSE', emp: 'Ola Hansen', dept: 'kitchen',
    title: 'Overtid over avtalt grense', detail: 'Ola har 12t overtid — grunnstilling 75% tillater 4t/mnd.',
    date: '15.04', requires: 'Bekreftelse', status: 'open' },
  { id: 'D-107', kind: 'warning', code: 'STEMPLING_GLEMT', emp: 'Anna Kvist', dept: 'kitchen',
    title: 'Stempling mangler · brukt planlagt tid', detail: 'Vakt 20.04 mangler ut-stempling. Calc-engine brukte planlagt 19:00.',
    date: '20.04', requires: 'Bekreftelse', status: 'open' },
  { id: 'D-108', kind: 'warning', code: 'PAUSE_KORT', emp: 'Thea Ruud', dept: 'bar',
    title: 'Pause < 20 min på 8t-vakt', detail: 'Pausen 12.04 var 12 min. Smartout har lagt til 8 min lønnet pause.',
    date: '12.04', requires: 'Info', status: 'open' },
  { id: 'D-109', kind: 'warning', code: 'TILLEGG_MANGLER', emp: 'Elise Fjell', dept: 'floor',
    title: 'Manuelt nattillegg ikke beregnet automatisk', detail: 'Calc-engine har ingen regel for vaktene 02:00–06:00.',
    date: '06.04', requires: 'Manuelt grep eller regel', status: 'open' },
  { id: 'D-110', kind: 'info', code: 'RECALC_DIFF', emp: 'Linn Andersen', dept: 'floor',
    title: 'Recalc endret brutto med +120 kr', detail: 'Tillegg-regel «Helgkveld» publisert 18.04 påvirket vakt 19.04.',
    date: '19.04', requires: 'Til orientering', status: 'ack' },
  { id: 'D-111', kind: 'info', code: 'RECALC_DIFF', emp: 'Kari Holm', dept: 'floor',
    title: 'Recalc endret brutto med +60 kr', detail: 'Samme regelpublisering som over.',
    date: '19.04', requires: 'Til orientering', status: 'ack' },
];

const PayrollDeviations = () => {
  return (
    <div style={{ width: PAGE_W, height: PAGE_H, display: 'flex', background: 'var(--background)',
      fontFamily: 'var(--font-body)', color: 'var(--foreground)', overflow: 'hidden' }}>
      <SidebarNav active="lønn" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header (compact) */}
        <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)',
            letterSpacing: '0.08em', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <span>Smartout</span>
            <Icon name="chevron-right" size={11} style={{ opacity: 0.5 }} />
            <span>Lønn</span>
            <Icon name="chevron-right" size={11} style={{ opacity: 0.5 }} />
            <span style={{ color: 'var(--foreground)' }}>April 2026</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.1 }}>April 2026</div>
            <StatusBadge kind="open" />
            <div style={{ flex: 1 }} />
            <Btn variant="outline" size="md" icon="external">Eksport</Btn>
            <Btn variant="default" size="md" icon="lock">Lås periode</Btn>
          </div>
        </div>

        <TabBar
          active="deviations"
          tabs={[
            ['lines', 'Linjer', 12],
            ['deviations', 'Avvik', 9],
            ['manual', 'Manuelle tillegg', 4],
            ['tip', 'Tipspott', null],
            ['export', 'Eksport', null],
          ]}
        />

        {/* Banner */}
        <div style={{ margin: '14px 32px 0', padding: '14px 18px',
          background: 'oklch(0.65 0.18 85 / 0.08)',
          border: '1px solid oklch(0.65 0.18 85 / 0.25)',
          borderRadius: 12, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10,
            background: 'oklch(0.65 0.18 85 / 0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'oklch(0.45 0.15 85)' }}>
            <Icon name="alert-circle" size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>4 avvik må bekreftes før perioden kan låses</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-fg)' }}>
              Resterende 5 er informative — du kan låse uten å håndtere dem, men de vises på lønnsslippen.
            </div>
          </div>
          <Btn variant="outline" size="sm" icon="check">Bekreft alle av samme type</Btn>
        </div>

        {/* Filter chips */}
        <div style={{ padding: '14px 32px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
          {[
            ['Krever handling', 4, 'error'],
            ['Advarsler',       3, 'warning'],
            ['Til orientering', 2, 'info'],
            ['Bekreftet',       0, 'ack'],
          ].map(([label, count, kind], i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', borderRadius: 8, fontSize: 12.5,
              background: i === 0 ? 'var(--card)' : 'transparent',
              border: '1px solid ' + (i === 0 ? 'var(--brand-orange)' : 'var(--border)'),
              cursor: 'pointer', fontWeight: i === 0 ? 600 : 400 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%',
                background: kind === 'error' ? 'var(--destructive)' :
                            kind === 'warning' ? 'oklch(0.65 0.18 85)' :
                            kind === 'info' ? 'oklch(0.65 0.13 225)' : 'var(--muted-fg)' }} />
              <span>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-fg)', fontSize: 11 }}>{count}</span>
            </div>
          ))}
        </div>

        {/* Deviations grouped */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px 24px' }}>
          <DevGroup title="Krever handling" tone="error" count={4} items={DEVIATIONS.filter(d => d.kind === 'error')} expanded />
          <DevGroup title="Advarsler" tone="warning" count={3} items={DEVIATIONS.filter(d => d.kind === 'warning')} />
          <DevGroup title="Til orientering · bekreftet" tone="info" count={2} items={DEVIATIONS.filter(d => d.status === 'ack')} collapsed />
        </div>
      </div>
    </div>
  );
};

const DevGroup = ({ title, tone, count, items, expanded, collapsed }) => {
  const dot = tone === 'error' ? 'var(--destructive)' : tone === 'warning' ? 'oklch(0.65 0.18 85)' : 'oklch(0.65 0.13 225)';
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 500,
        padding: '0 4px 10px' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
        <span>{title}</span>
        <span style={{ opacity: 0.7 }}>· {count}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 8 }} />
        <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={12} />
      </div>
      {!collapsed && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)' }}>
          {items.map((d, i) => <DevRow key={d.id} d={d} expanded={expanded && i === 0} last={i === items.length - 1} />)}
        </div>
      )}
    </div>
  );
};

const DevRow = ({ d, expanded, last }) => (
  <div style={{ borderBottom: last ? 'none' : '1px solid var(--border)',
    background: expanded ? 'oklch(0.65 0.22 40 / 0.025)' : 'transparent' }}>
    <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '36px 1fr 200px 120px 120px',
      gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8,
        background: d.kind === 'error' ? 'oklch(0.60 0.20 25 / 0.10)' :
                    d.kind === 'warning' ? 'oklch(0.65 0.18 85 / 0.12)' :
                    'oklch(0.65 0.13 225 / 0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: d.kind === 'error' ? 'var(--destructive)' :
               d.kind === 'warning' ? 'oklch(0.45 0.15 85)' : 'oklch(0.40 0.12 225)' }}>
        <Icon name={d.kind === 'error' ? 'alert-circle' : d.kind === 'warning' ? 'alert-circle' : 'check'} size={14} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title}</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted-fg)',
            background: 'var(--muted)', padding: '1px 7px', borderRadius: 4 }}>{d.code}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted-fg)', lineHeight: 1.55 }}>{d.detail}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <Avatar name={d.emp} size={22} />
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{d.emp}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>{d.date}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted-fg)', alignSelf: 'center' }}>{d.requires}</div>
      <div style={{ display: 'flex', gap: 6, alignSelf: 'center', justifySelf: 'end' }}>
        {d.status === 'ack' ? <StatusBadge kind="ack" /> : (
          <>
            <Btn variant="outline" size="sm">Vis vakt</Btn>
            <Btn variant="default" size="sm" icon="check">Bekreft</Btn>
          </>
        )}
      </div>
    </div>
    {expanded && (
      <div style={{ padding: '0 18px 18px 68px' }}>
        <div style={{ background: 'var(--muted)', borderRadius: 10, padding: 14, fontSize: 12.5 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--muted-fg)', marginBottom: 8, fontWeight: 500 }}>
            Foreslått handling
          </div>
          <div style={{ marginBottom: 12, lineHeight: 1.6 }}>
            Hovedavtale §10.3 krever signert tillegg ved arbeid på bevegelig helligdag.
            Mikkel signerte i Smartout 14.04 kl 09:12 — bekreft for å låse perioden.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="default" size="sm" icon="check">Bekreft tillegg</Btn>
            <Btn variant="outline" size="sm" icon="external">Vis avtale</Btn>
            <Btn variant="ghost" size="sm">Avvis vakten</Btn>
          </div>
        </div>
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════
// SCREEN 5: Lock period — confirmation modal
// ═══════════════════════════════════════════════════════════
const LockPeriodModal = () => (
  <div style={{ width: PAGE_W, height: PAGE_H, position: 'relative', background: 'var(--background)',
    fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
    <div style={{ filter: 'blur(2px) saturate(0.7)', opacity: 0.4, pointerEvents: 'none' }}>
      <PayrollPeriodDetail />
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,10,0.32)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 560, background: 'var(--card)', borderRadius: 18,
        boxShadow: '0 24px 80px rgba(0,0,0,0.30)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10,
              background: 'oklch(0.65 0.22 40 / 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brand-orange-dark)' }}>
              <Icon name="lock" size={18} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, letterSpacing: '-0.01em' }}>Lås april 2026?</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted-fg)', marginTop: 2 }}>Linjer fryses og kan ikke endres uten å åpne perioden på nytt.</div>
            </div>
          </div>

          <div style={{ background: 'var(--muted)', borderRadius: 12, padding: 14, marginBottom: 16,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <MiniStat label="Linjer" value="12" />
            <MiniStat label="Brutto" value={'kr ' + fmt0(234567)} />
            <MiniStat label="Avvik" value="9" />
            <MiniStat label="Manuelle" value="4" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <Check label="4 avvik er bekreftet" on />
            <Check label="3 manuelle tillegg er signert" on />
            <Check label="2 advarsler vises på lønnsslipp som info" on />
            <Check label="Notify ansatte: lønnsslipp tilgjengelig 28.04" on />
          </div>

          <div style={{ background: 'oklch(0.65 0.13 225 / 0.06)', border: '1px solid oklch(0.65 0.13 225 / 0.18)',
            borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
            fontSize: 12.5 }}>
            <Icon name="alert-circle" size={14} style={{ color: 'oklch(0.40 0.12 225)', marginTop: 2 }} />
            <div style={{ color: 'var(--muted-fg)', lineHeight: 1.55 }}>
              Hvis ansatt registrerer endring etter lås, blir det en ny linje neste periode.
              Bot-Sson sender deg en notis hvis det skjer.
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)',
          background: 'oklch(0.965 0.005 58 / 0.5)',
          display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" size="md">Avbryt</Btn>
          <Btn variant="outline" size="md">Lagre uten å låse</Btn>
          <Btn variant="default" size="md" icon="lock">Lås april</Btn>
        </div>
      </div>
    </div>
  </div>
);

const Check = ({ label, on }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13 }}>
    <div style={{ width: 18, height: 18, borderRadius: 5,
      background: on ? 'oklch(0.68 0.15 145)' : 'var(--muted)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on && <Icon name="check" size={12} stroke={3} />}
    </div>
    <span>{label}</span>
  </div>
);

window.PayrollDeviations = PayrollDeviations;
window.LockPeriodModal = LockPeriodModal;
window.Check = Check;
window.DEVIATIONS = DEVIATIONS;
