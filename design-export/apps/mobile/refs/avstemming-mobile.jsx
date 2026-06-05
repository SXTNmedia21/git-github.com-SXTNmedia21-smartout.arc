// Mobile avstemming app — for employee / shift leader finishing their shift
// Flow: ClockOut prompt → Shift summary → Sales entry (Z-report) → Cash count → Deviations → Review → Sent

// ─── Design tokens (aligned with web app) ───
// Values map to CSS variables on the host so dark mode tweaks live at one place.
const M = {
  bg: 'var(--m-bg)',
  card: 'var(--m-card)',
  fg: 'var(--m-fg)',
  muted: 'var(--m-muted)',
  border: 'var(--m-border)',
  secondary: 'var(--m-secondary)',
  orange: 'var(--m-orange)',
  orangeLight: 'var(--m-orange-light)',
  success: 'var(--m-success)',
  warning: 'var(--m-warning)',
  error: 'var(--m-error)',
  info: 'var(--m-info)',
  deptKjokken: 'var(--m-dept-kjokken)',
  fontSerif: '"Instrument Serif", "Iowan Old Style", Georgia, serif',
  fontMono: '"Geist Mono", ui-monospace, Menlo, monospace',
};

// ─── Tiny helpers ───
const fmtKr = (n) => new Intl.NumberFormat('nb-NO').format(Math.round(n));
const cls = (...xs) => xs.filter(Boolean).join(' ');

// ─── Shared bits ───
function ProgressDots({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 3, borderRadius: 2,
          width: i === step ? 20 : 8,
          background: i <= step ? M.orange : M.border,
          transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)',
        }} />
      ))}
    </div>
  );
}

function MobileHeader({ title, sub, onBack, right, progress }) {
  return (
    <div style={{ padding: '62px 16px 12px', borderBottom: `1px solid ${M.border}`, background: M.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sub ? 8 : 4, height: 28 }}>
        {onBack ? (
          <button onClick={onBack} style={{ width: 32, height: 32, marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: M.fg }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        ) : <div style={{ width: 24 }} />}
        {progress && <ProgressDots {...progress} />}
        <div>{right || <div style={{ width: 24 }} />}</div>
      </div>
      <div style={{ fontFamily: M.fontSerif, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.05, fontWeight: 400 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: M.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MobileFooter({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: `color-mix(in oklab, ${M.bg} 85%, transparent)`,
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      borderTop: `1px solid ${M.border}`,
      padding: '14px 16px 30px',
      display: 'flex', gap: 8, alignItems: 'stretch',
    }}>{children}</div>
  );
}

function Btn({ variant = 'primary', children, onClick, disabled, icon, full, size = 'md', style }) {
  const styles = {
    primary: { background: M.orange, color: '#fff', boxShadow: '0 2px 10px rgba(249,115,22,0.3)' },
    secondary: { background: M.secondary, color: M.fg, border: `1px solid ${M.border}` },
    ghost: { background: 'transparent', color: M.fg },
    destructive: { background: 'transparent', color: M.error, border: `1px solid color-mix(in oklab, ${M.error} 30%, ${M.border})` },
    dark: { background: M.fg, color: '#fff' },
  }[variant];
  const h = size === 'lg' ? 52 : size === 'sm' ? 36 : 46;
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      height: h, padding: '0 20px',
      borderRadius: 14, fontWeight: 600, fontSize: size === 'sm' ? 13 : 15,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      flex: full ? 1 : 'none',
      opacity: disabled ? 0.4 : 1,
      transition: 'transform 150ms, box-shadow 200ms',
      ...styles, ...style,
    }}>
      {icon}{children}
    </button>
  );
}

function Card({ children, style, accent }) {
  return (
    <div style={{
      background: M.card, border: `1px solid ${M.border}`,
      borderRadius: 16, padding: 16,
      borderLeft: accent ? `4px solid ${accent}` : undefined,
      ...style,
    }}>{children}</div>
  );
}

function StatPill({ label, value, sub, tone, unit, flex = 1 }) {
  const color = tone === 'warn' ? M.warning : tone === 'err' ? M.error : tone === 'ok' ? M.success : M.fg;
  return (
    <div style={{ flex, minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.6, fontWeight: 600, color: M.muted, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <span style={{ fontFamily: M.fontMono, fontSize: 20, fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: M.muted, fontWeight: 500 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: M.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

// ─── Step definitions ───
const STEPS = ['summary', 'sales', 'cash', 'deviations', 'review', 'done'];

// ─── Screen 0: Clock-out interstitial ───
function ScreenClockOut({ onStart, onLater }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: M.bg }}>
      <div style={{ padding: '62px 16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onLater} style={{ fontSize: 14, color: M.muted, fontWeight: 500 }}>Avbryt</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
        <div style={{
          width: 96, height: 96, borderRadius: 999,
          background: `color-mix(in oklab, ${M.orange} 12%, transparent)`,
          border: `1px solid color-mix(in oklab, ${M.orange} 30%, transparent)`,
          margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={M.orange} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div style={{ fontFamily: M.fontSerif, fontSize: 40, letterSpacing: '-0.02em', lineHeight: 1.05, fontWeight: 400 }}>Du er stemplet ut</div>
        <div style={{ fontSize: 15, color: M.muted, marginTop: 12, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          Marcus, du var skiftleder i kveld. Før du går må dagen avstemmes.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 32, padding: '0 8px' }}>
          <StatPill label="Skift" value="9.5t" sub="Planlagt 9.0t" tone="warn" />
          <div style={{ width: 1, background: M.border }} />
          <StatPill label="Åpent" value="23:47" sub="Siden 14:02" />
        </div>

        <div style={{
          marginTop: 28, padding: 16, borderRadius: 16,
          background: `color-mix(in oklab, ${M.warning} 7%, transparent)`,
          border: `1px solid color-mix(in oklab, ${M.warning} 25%, transparent)`,
          textAlign: 'left', display: 'flex', gap: 12,
        }}>
          <div style={{ color: M.warning, marginTop: 2 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>2 punkter må løses</div>
            <div style={{ fontSize: 13, color: M.muted, lineHeight: 1.45 }}>Z-rapport ikke lastet opp · Kontantkasse ikke telt</div>
          </div>
        </div>
      </div>

      <MobileFooter>
        <Btn variant="secondary" onClick={onLater} size="lg">Senere</Btn>
        <Btn variant="primary" onClick={onStart} full size="lg" icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        }>Start avstemming</Btn>
      </MobileFooter>
    </div>
  );
}

// ─── Screen 1: Summary (fresh list of what needs to happen) ───
function ScreenSummary({ go, back }) {
  const items = [
    { key: 'sales', title: 'Registrer omsetning', sub: 'Z-rapport fra kassa', status: 'todo', icon: '📊' },
    { key: 'cash', title: 'Tell opp kontantkasse', sub: '5 valører', status: 'todo' },
    { key: 'deviations', title: 'Bekreft avvik', sub: '2 flagget av system', status: 'flag' },
    { key: 'tasks', title: 'Close-out oppgaver', sub: '5 av 6 fullført', status: 'done' },
  ];
  const step = { step: 0, total: 5 };
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MobileHeader title="Avstemming" sub="Fredag 17. april · Kjøkken" onBack={back} progress={step} />
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 100px' }}>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 600, color: M.muted, textTransform: 'uppercase' }}>Dagen så langt</div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: `color-mix(in oklab, ${M.warning} 12%, transparent)`, color: M.warning }}>Åpen</span>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <StatPill label="Skift" value="8" sub="82,5 t totalt" flex={0.9} />
            <div style={{ width: 1, alignSelf: 'stretch', background: M.border }} />
            <StatPill label="Omsetning" value="88 200" unit="kr" sub="planlagt" flex={1.3} />
            <div style={{ width: 1, alignSelf: 'stretch', background: M.border }} />
            <StatPill label="Labor" value="28" unit="%" sub="mål" flex={0.8} />
          </div>
        </Card>

        <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 600, color: M.muted, textTransform: 'uppercase', margin: '8px 4px 10px' }}>Dette må du gjøre</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => {
            const tone = it.status === 'done' ? M.success : it.status === 'flag' ? M.warning : M.muted;
            const icon = it.status === 'done'
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M.success} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              : it.status === 'flag'
              ? <div style={{ width: 8, height: 8, borderRadius: 999, background: M.warning }} />
              : <div style={{ width: 8, height: 8, borderRadius: 999, border: `1.5px solid ${M.muted}` }} />;
            return (
              <div key={it.key} onClick={() => it.status !== 'done' && go('sales')} style={{
                background: M.card, border: `1px solid ${M.border}`, borderRadius: 14,
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                opacity: it.status === 'done' ? 0.55 : 1,
              }}>
                <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{it.title}</div>
                  <div style={{ fontSize: 12, color: M.muted, marginTop: 2 }}>{it.sub}</div>
                </div>
                <div style={{ fontFamily: M.fontMono, fontSize: 11, color: tone, fontWeight: 600, textTransform: 'uppercase' }}>
                  {it.status === 'done' ? 'Ferdig' : it.status === 'flag' ? '2' : ''}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M.muted} strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, fontSize: 12, color: M.muted, lineHeight: 1.5, padding: '0 4px' }}>
          Du ble tildelt avstemming fordi du var siste skiftleder. Anslått tid: <b style={{ color: M.fg }}>4–6 min</b>.
        </div>
      </div>

      <MobileFooter>
        <Btn variant="ghost" onClick={back}>Senere</Btn>
        <Btn variant="primary" onClick={() => go('sales')} full size="lg">Start</Btn>
      </MobileFooter>
    </div>
  );
}

// ─── Screen 2: Sales entry (Z-report) ───
function ScreenSales({ go, back, state, set }) {
  const totals = state.sales;
  const step = { step: 1, total: 5 };
  const card = totals.card ? parseInt(totals.card) || 0 : 0;
  const cash = totals.cash ? parseInt(totals.cash) || 0 : 0;
  const total = card + cash;
  const budget = 88200;
  const diff = total - budget;
  const pct = budget ? Math.round((diff / budget) * 100) : 0;
  const valid = total > 10000;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MobileHeader title="Omsetning" sub="Last opp Z-rapport eller tast inn totaler" onBack={back} progress={step} />
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 140px' }}>

        {/* OCR upload */}
        <Card style={{ marginBottom: 16, textAlign: 'center', padding: 20 }}>
          {totals.uploaded ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 60, borderRadius: 8, background: 'repeating-linear-gradient(135deg, #f5f3f0 0 6px, #ebe8e3 6px 12px)', flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>z-report-23-47.jpg</div>
                <div style={{ fontSize: 12, color: M.success, fontWeight: 500, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  OCR bekreftet · 94 200 kr
                </div>
              </div>
              <button onClick={() => set({ sales: { ...totals, uploaded: false, card: '', cash: '' } })} style={{ fontSize: 12, color: M.muted }}>Fjern</button>
            </div>
          ) : (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: M.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={M.fg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/>
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Ta bilde av Z-rapport</div>
              <div style={{ fontSize: 13, color: M.muted, marginTop: 4, marginBottom: 14 }}>Vi leser tall automatisk</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="dark" onClick={() => set({ sales: { uploaded: true, card: 71800, cash: 22400 } })} full>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>
                  Kamera
                </Btn>
                <Btn variant="secondary" full>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Last opp
                </Btn>
              </div>
            </>
          )}
        </Card>

        {/* Manual totals */}
        <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 600, color: M.muted, textTransform: 'uppercase', margin: '8px 4px 10px' }}>Totaler</div>

        <Card style={{ padding: 0, marginBottom: 12 }}>
          {[
            { k: 'card', label: 'Kort', icon: '💳' },
            { k: 'cash', label: 'Kontant', icon: '💵' },
          ].map((f, i) => (
            <div key={f.k} style={{
              display: 'flex', alignItems: 'center', padding: '14px 16px',
              borderBottom: i === 0 ? `1px solid ${M.border}` : 'none',
            }}>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{f.label}</div>
              <input
                type="text" inputMode="numeric"
                value={totals[f.k] || ''}
                onChange={(e) => set({ sales: { ...totals, [f.k]: e.target.value.replace(/\D/g, '') } })}
                placeholder="0"
                style={{
                  width: 120, textAlign: 'right',
                  fontFamily: M.fontMono, fontSize: 20, fontWeight: 600,
                  border: 'none', background: 'transparent', outline: 'none',
                  color: totals[f.k] ? M.fg : M.muted,
                }}
              />
              <div style={{ fontFamily: M.fontMono, fontSize: 13, color: M.muted, marginLeft: 6, minWidth: 18 }}>kr</div>
            </div>
          ))}
        </Card>

        <Card style={{ background: M.secondary, border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: M.muted, letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase' }}>Totalt</div>
            <div style={{ fontFamily: M.fontMono, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtKr(total)} <span style={{ fontSize: 14, color: M.muted, fontWeight: 400 }}>kr</span></div>
          </div>
          {total > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: M.fontMono, color: M.muted }}>
              <span>Budsjett {fmtKr(budget)} kr</span>
              <span style={{ color: diff >= 0 ? M.success : M.error, fontWeight: 600 }}>
                {diff >= 0 ? '+' : ''}{fmtKr(diff)} kr · {pct >= 0 ? '+' : ''}{pct}%
              </span>
            </div>
          )}
        </Card>
      </div>

      <MobileFooter>
        <Btn variant="primary" onClick={() => go('cash')} disabled={!valid} full size="lg">Videre</Btn>
      </MobileFooter>
    </div>
  );
}

// ─── Screen 3: Cash count ───
function ScreenCash({ go, back, state, set }) {
  const denoms = [
    { v: 1000, count: state.cash[1000] || 0 },
    { v: 500, count: state.cash[500] || 0 },
    { v: 200, count: state.cash[200] || 0 },
    { v: 100, count: state.cash[100] || 0 },
    { v: 'mynt', count: state.cash.mynt || 0 },
  ];
  const step = { step: 2, total: 5 };
  const counted = denoms.reduce((s, d) => s + (d.v === 'mynt' ? d.count : d.v * d.count), 0);
  const expected = 22400; // from sales
  const diff = counted - expected;
  const withinTol = Math.abs(diff) <= 300;
  const bump = (v, delta) => set({ cash: { ...state.cash, [v]: Math.max(0, (state.cash[v] || 0) + delta) } });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MobileHeader title="Kontantkasse" sub="Tell hver valør · Forventet 22 400 kr" onBack={back} progress={step} />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 200px' }}>
        <Card style={{ padding: 0 }}>
          {denoms.map((d, i) => (
            <div key={d.v} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr auto', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: i < denoms.length - 1 ? `1px solid ${M.border}` : 'none',
            }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, fontFamily: M.fontMono }}>{d.v === 'mynt' ? 'Mynt' : d.v}</div>
                <div style={{ fontSize: 11, color: M.muted, marginTop: 1 }}>{d.v === 'mynt' ? 'total kr' : 'sedler'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => bump(d.v, -1)} style={{
                  width: 36, height: 36, borderRadius: 999, border: `1px solid ${M.border}`,
                  background: M.card, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: d.count === 0 ? 0.3 : 1,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M.fg} strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <div style={{ fontFamily: M.fontMono, fontSize: 22, fontWeight: 700, minWidth: 36, textAlign: 'center' }}>{d.count}</div>
                <button onClick={() => bump(d.v, 1)} style={{
                  width: 36, height: 36, borderRadius: 999, background: M.fg, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
              <div style={{ fontFamily: M.fontMono, fontSize: 13, color: M.muted, minWidth: 70, textAlign: 'right' }}>
                {d.v === 'mynt' ? fmtKr(d.count) : fmtKr(d.v * d.count)} kr
              </div>
            </div>
          ))}
        </Card>

        <Card style={{
          marginTop: 16, background: withinTol ? `color-mix(in oklab, ${M.success} 6%, transparent)` : `color-mix(in oklab, ${M.warning} 8%, transparent)`,
          border: `1px solid color-mix(in oklab, ${withinTol ? M.success : M.warning} 25%, transparent)`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 600, color: M.muted, textTransform: 'uppercase' }}>Telt</div>
              <div style={{ fontFamily: M.fontMono, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtKr(counted)} <span style={{ fontSize: 13, color: M.muted, fontWeight: 400 }}>kr</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 600, color: M.muted, textTransform: 'uppercase' }}>Diff</div>
              <div style={{ fontFamily: M.fontMono, fontSize: 22, fontWeight: 700, color: withinTol ? M.success : M.warning }}>
                {diff >= 0 ? '+' : ''}{fmtKr(diff)} kr
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: M.muted, marginTop: 8, fontFamily: M.fontMono }}>
            Forventet {fmtKr(expected)} kr · Toleranse ±300 kr
          </div>
        </Card>

        {!withinTol && counted > 0 && (
          <Card style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Forklar avviket</div>
            <textarea
              value={state.cash.note || ''}
              onChange={e => set({ cash: { ...state.cash, note: e.target.value } })}
              placeholder="F.eks. veksel lånt ut, feilslag på kassa…"
              style={{
                width: '100%', minHeight: 70, padding: 12, fontFamily: 'inherit',
                border: `1px solid ${M.border}`, borderRadius: 10, outline: 'none',
                fontSize: 14, resize: 'none',
              }}
            />
          </Card>
        )}
      </div>

      <MobileFooter>
        <Btn variant="primary" onClick={() => go('deviations')} disabled={counted < expected - 2000} full size="lg">Videre</Btn>
      </MobileFooter>
    </div>
  );
}

// ─── Screen 4: Deviations ───
function ScreenDeviations({ go, back, state, set }) {
  const devs = [
    { id: 'd1', sev: 'HIGH', title: 'Overtid uten forhåndsgodkjenning', desc: 'Thomas Jensen stemplet 0.75t over planlagt.', cost: '+286 kr', who: 'Thomas Jensen · 23:15' },
    { id: 'd2', sev: 'MED', title: 'Manglende close-out kommentar', desc: 'Henrik Strøm avsluttet uten kommentar.', cost: null, who: 'Henrik Strøm · 23:02' },
  ];
  const step = { step: 3, total: 5 };
  const resolved = state.deviations.resolved || {};
  const allResolved = devs.every(d => resolved[d.id]);
  const sevColor = (s) => s === 'HIGH' ? M.error : s === 'MED' ? M.warning : M.muted;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MobileHeader title="Avvik" sub="2 flagget automatisk · bekreft eller avvis" onBack={back} progress={step} />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 120px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {devs.map(d => {
            const r = resolved[d.id];
            return (
              <Card key={d.id} accent={sevColor(d.sev)} style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, padding: '3px 8px', borderRadius: 6, background: `color-mix(in oklab, ${sevColor(d.sev)} 12%, transparent)`, color: sevColor(d.sev) }}>{d.sev}</span>
                    {d.cost && <span style={{ fontFamily: M.fontMono, fontSize: 12, color: M.muted }}>{d.cost}</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{d.title}</div>
                  <div style={{ fontSize: 13, color: M.muted, lineHeight: 1.45 }}>{d.desc}</div>
                  <div style={{ fontSize: 11, color: M.muted, marginTop: 8, fontFamily: M.fontMono }}>{d.who}</div>
                </div>
                {r ? (
                  <div style={{
                    padding: '12px 16px',
                    background: r === 'accept' ? `color-mix(in oklab, ${M.success} 8%, transparent)` : `color-mix(in oklab, ${M.error} 8%, transparent)`,
                    borderTop: `1px solid ${M.border}`,
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                  }}>
                    {r === 'accept' ? (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M.success} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg><span style={{ fontWeight: 600, color: M.success }}>Bekreftet</span></>
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M.error} strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span style={{ fontWeight: 600, color: M.error }}>Avvist — sendt til admin</span></>
                    )}
                    <button onClick={() => set({ deviations: { resolved: { ...resolved, [d.id]: null } } })} style={{ marginLeft: 'auto', fontSize: 12, color: M.muted }}>Angre</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', borderTop: `1px solid ${M.border}` }}>
                    <button onClick={() => set({ deviations: { resolved: { ...resolved, [d.id]: 'reject' } } })} style={{
                      flex: 1, padding: '14px 0', fontSize: 14, fontWeight: 600, color: M.error,
                      borderRight: `1px solid ${M.border}`,
                    }}>Avvis</button>
                    <button onClick={() => set({ deviations: { resolved: { ...resolved, [d.id]: 'accept' } } })} style={{
                      flex: 1, padding: '14px 0', fontSize: 14, fontWeight: 600, color: M.success,
                    }}>Bekreft</button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div style={{
          marginTop: 20, padding: 14, background: M.secondary, borderRadius: 14,
          fontSize: 12, color: M.muted, lineHeight: 1.5,
        }}>
          <b style={{ color: M.fg }}>Bekreft</b> når avviket stemmer — det blir en del av dagsrapporten.<br />
          <b style={{ color: M.fg }}>Avvis</b> sender det til admin for avklaring.
        </div>
      </div>

      <MobileFooter>
        <Btn variant="primary" onClick={() => go('review')} disabled={!allResolved} full size="lg">
          {allResolved ? 'Videre' : `${devs.filter(d => !resolved[d.id]).length} igjen`}
        </Btn>
      </MobileFooter>
    </div>
  );
}

// ─── Screen 5: Review ───
function ScreenReview({ go, back, state }) {
  const step = { step: 4, total: 5 };
  const card = parseInt(state.sales.card) || 0;
  const cash = parseInt(state.sales.cash) || 0;
  const total = card + cash;
  const counted = Object.entries(state.cash).reduce((s, [v, c]) => {
    if (v === 'note') return s;
    return s + (v === 'mynt' ? (c || 0) : (parseInt(v) || 0) * (c || 0));
  }, 0);

  const rows = [
    { label: 'Omsetning totalt', value: `${fmtKr(total)} kr`, sub: `Kort ${fmtKr(card)} · Kontant ${fmtKr(cash)}` },
    { label: 'Kontanttelling', value: `${fmtKr(counted)} kr`, sub: `Diff ${counted - 22400 >= 0 ? '+' : ''}${fmtKr(counted - 22400)} kr` },
    { label: 'Avvik bekreftet', value: '1', sub: 'Overtid · +286 kr' },
    { label: 'Avvik sendt til admin', value: '1', sub: 'Manglende close-out' },
    { label: 'Close-out oppgaver', value: '5 av 6', sub: 'HMS-runde flyttet til lørdag' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MobileHeader title="Se gjennom" sub="Sjekk før du sender inn" onBack={back} progress={step} />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 140px' }}>

        <Card style={{ padding: 0, marginBottom: 16 }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', padding: '14px 16px',
              borderBottom: i < rows.length - 1 ? `1px solid ${M.border}` : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: M.muted, marginTop: 2 }}>{r.sub}</div>
              </div>
              <div style={{ fontFamily: M.fontMono, fontSize: 15, fontWeight: 600, textAlign: 'right' }}>{r.value}</div>
            </div>
          ))}
        </Card>

        <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 600, color: M.muted, textTransform: 'uppercase', margin: '8px 4px 10px' }}>Kommentar (valgfri)</div>
        <Card>
          <textarea
            placeholder="Noe admin bør vite? (f.eks. hvorfor HMS-rundet ble utsatt…)"
            style={{
              width: '100%', minHeight: 80, padding: 0, fontFamily: 'inherit',
              border: 'none', outline: 'none', fontSize: 14, resize: 'none', background: 'transparent',
            }}
          />
        </Card>

        <div style={{
          marginTop: 20, padding: 14,
          background: `color-mix(in oklab, ${M.info} 8%, transparent)`,
          border: `1px solid color-mix(in oklab, ${M.info} 25%, transparent)`,
          borderRadius: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <div style={{ color: M.info, marginTop: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </div>
          <div style={{ fontSize: 13, color: M.fg, lineHeight: 1.5, flex: 1 }}>
            Dagen sendes til <b>Iselin Hagen</b> (admin Kjøkken) for godkjenning. Du kan ikke endre etter innsending.
          </div>
        </div>
      </div>

      <MobileFooter>
        <Btn variant="secondary" onClick={back}>Tilbake</Btn>
        <Btn variant="primary" onClick={() => go('done')} full size="lg" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>
        }>Send inn</Btn>
      </MobileFooter>
    </div>
  );
}

// ─── Screen 6: Done ───
function ScreenDone({ onClose }) {
  const [pop, setPop] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setPop(true), 120);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: M.bg }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
        <div style={{
          width: 96, height: 96, borderRadius: 999,
          background: M.success, margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: pop ? 'scale(1)' : 'scale(0.3)',
          opacity: pop ? 1 : 0,
          transition: 'transform 600ms cubic-bezier(0.22,1.4,0.36,1), opacity 300ms',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ fontFamily: M.fontSerif, fontSize: 40, letterSpacing: '-0.02em', lineHeight: 1.05, fontWeight: 400 }}>Sendt inn</div>
        <div style={{ fontSize: 15, color: M.muted, marginTop: 10, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          Dagen er hos Iselin for godkjenning. Du får beskjed hvis noe trenger avklaring.
        </div>

        <Card style={{ marginTop: 32, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 600, color: M.muted, textTransform: 'uppercase' }}>Dagsrapport</div>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: `color-mix(in oklab, ${M.warning} 12%, transparent)`, color: M.warning, marginLeft: 'auto' }}>VENTER</span>
          </div>
          <div style={{ fontFamily: M.fontSerif, fontSize: 24, letterSpacing: '-0.02em' }}>Fredag 17. april</div>
          <div style={{ fontSize: 13, color: M.muted, marginTop: 2 }}>Kjøkken · 94 200 kr · 8 vakter</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: M.muted, fontFamily: M.fontMono }}>
            <span>Innsendt 23:52</span>
            <span>·</span>
            <span>Spores #AV-2611</span>
          </div>
        </Card>
      </div>

      <MobileFooter>
        <Btn variant="primary" onClick={onClose} full size="lg">Ferdig</Btn>
      </MobileFooter>
    </div>
  );
}

// ─── App container ───
function MobileApp({ initial = 'clockout' }) {
  const [screen, setScreen] = React.useState(initial);
  const [state, setState] = React.useState({
    sales: { uploaded: false, card: '', cash: '' },
    cash: {},
    deviations: { resolved: {} },
  });
  const set = (patch) => setState(s => ({ ...s, ...patch }));

  const go = (next) => setScreen(next);
  const back = () => {
    const order = ['clockout', 'summary', 'sales', 'cash', 'deviations', 'review', 'done'];
    const idx = order.indexOf(screen);
    if (idx > 0) setScreen(order[idx - 1]);
  };

  // Allow external navigation (for the canvas switcher)
  React.useEffect(() => { setScreen(initial); }, [initial]);

  const common = { go, back, state, set };
  let content;
  if (screen === 'clockout') content = <ScreenClockOut onStart={() => go('summary')} onLater={() => go('summary')} />;
  else if (screen === 'summary') content = <ScreenSummary {...common} />;
  else if (screen === 'sales') content = <ScreenSales {...common} />;
  else if (screen === 'cash') content = <ScreenCash {...common} />;
  else if (screen === 'deviations') content = <ScreenDeviations {...common} />;
  else if (screen === 'review') content = <ScreenReview {...common} />;
  else content = <ScreenDone onClose={() => go('clockout')} />;

  return <div style={{ height: '100%', width: '100%', fontFamily: '"Geist", -apple-system, system-ui, sans-serif', color: M.fg, background: M.bg, position: 'relative', overflow: 'hidden' }}>{content}</div>;
}

Object.assign(window, {
  MobileApp, ScreenClockOut, ScreenSummary, ScreenSales, ScreenCash, ScreenDeviations, ScreenReview, ScreenDone,
  MOBILE_SCREENS: ['clockout', 'summary', 'sales', 'cash', 'deviations', 'review', 'done'],
});
