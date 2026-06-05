// Year Wheel — Drawer (season details) + Machine Room sheet

function YwStatusPill({ status }) {
  const map = {
    draft:    { label: 'Utkast',   color: 'var(--muted)' },
    active:   { label: 'Aktiv',    color: 'var(--success)' },
    archived: { label: 'Arkivert', color: 'var(--muted)' },
  };
  const m = map[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 999,
      background: `color-mix(in oklab, ${m.color} 12%, transparent)`,
      color: m.color, fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: m.color }} />
      {m.label}
    </span>
  );
}

function YwDrawerHeader({ season, onClose, onOpenMachine }) {
  return (
    <div style={{ padding: '22px 22px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: 99, background: season.color }} />
        <YwStatusPill status={season.status} />
        <button onClick={onClose} style={{
          marginLeft: 'auto', width: 30, height: 30, borderRadius: 8,
          color: 'var(--muted)', background: 'transparent',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 4px', fontWeight: 400, lineHeight: 1.1 }}>
        {season.name}
      </h2>
      <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
        {yw_fmtDate(season.start)} → {yw_fmtDate(season.end)} · 2026 Planning Year
      </div>
    </div>
  );
}

function YwTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', padding: '0 22px', overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: '10px 0', marginRight: 18,
          fontSize: 13, fontWeight: 500,
          color: active === t.key ? 'var(--fg)' : 'var(--muted)',
          borderBottom: active === t.key ? '2px solid var(--orange)' : '2px solid transparent',
          marginBottom: -1, whiteSpace: 'nowrap',
        }}>{t.label}{t.count != null && <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.7 }}>{t.count}</span>}</button>
      ))}
    </div>
  );
}

function YwRow({ label, value, sub, mono = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{label}</div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// Overview tab
function YwOverview({ season, onActivate, onOpenMachine }) {
  const missing = season.missing || [];
  const canActivate = season.status !== 'active' && missing.length === 0 && season.revenue > 0;
  return (
    <div style={{ padding: 22 }}>
      {/* Activation gate */}
      <div style={{
        padding: 16, borderRadius: 14,
        background: missing.length ? 'color-mix(in oklab, var(--warning) 7%, transparent)' : 'color-mix(in oklab, var(--success) 7%, transparent)',
        border: `1px solid color-mix(in oklab, ${missing.length ? 'var(--warning)' : 'var(--success)'} 25%, transparent)`,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: missing.length ? 8 : 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {season.status === 'active' ? 'Aktiv sesong' : missing.length ? `${missing.length} ting mangler før aktivering` : 'Klar til aktivering'}
          </div>
          <button
            disabled={!canActivate}
            onClick={onActivate}
            style={{
              height: 32, padding: '0 14px', borderRadius: 10,
              fontSize: 13, fontWeight: 600,
              background: canActivate ? 'var(--orange)' : 'var(--secondary)',
              color: canActivate ? '#fff' : 'var(--muted)',
              cursor: canActivate ? 'pointer' : 'not-allowed',
              border: '1px solid transparent',
            }}
          >{season.status === 'active' ? 'Arkiver' : 'Aktiver sesong'}</button>
        </div>
        {missing.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13, color: 'var(--muted)' }}>
            {missing.map(m => (
              <li key={m} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 4, height: 4, borderRadius: 99, background: 'var(--warning)' }} />
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Summary */}
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', margin: '0 0 10px' }}>Oppsummering</div>
      <YwRow label="Inntektsmål" value={season.revenue ? `${yw_fmtKr(season.revenue)} kr` : '—'} sub={season.revenueActual ? `så langt ${yw_fmtKr(season.revenueActual)} kr` : null} />
      <YwRow label="Antall dager" value={Math.round((yw_parseDate(season.end) - yw_parseDate(season.start)) / 86400000) + 1} />
      <YwRow label="Labor-mål" value={`${season.laborPct}%`} />
      <YwRow label="Teams aktive" value={season.teams} mono={false} />
      <YwRow label="Events i periode" value={season.eventCount || '—'} />
      {season.seededFrom && (
        <div style={{ marginTop: 14, padding: 10, background: 'var(--secondary)', borderRadius: 10, fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Seeded fra <b style={{ color: 'var(--fg)', fontWeight: 500 }}>{season.seededFrom}</b>
        </div>
      )}

      {/* Machine Room CTA */}
      <button onClick={onOpenMachine} style={{
        marginTop: 20, width: '100%',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderRadius: 14,
        background: 'var(--fg)', color: 'var(--bg)',
        fontSize: 14, fontWeight: 600,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
        </svg>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div>Machine Room</div>
          <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 400, marginTop: 1 }}>Budsjett · dag-faktorer · time-faktorer</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  );
}

// Hours tab (opening hours with provenance)
function YwHours({ season }) {
  const [dept, setDept] = React.useState('Kjøkken');
  const days = ['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
  return (
    <div style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <select value={dept} onChange={e => setDept(e.target.value)} className="select" style={{ width: 140, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}>
          <option>Kjøkken</option><option>Sal</option><option>Bar</option>
        </select>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>for {season.name}</div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {days.map((d, i) => {
          const val = season.openHours?.[d] || '—';
          const override = i === 2 || i === 4;
          return (
            <div key={d} style={{
              display: 'grid', gridTemplateColumns: '60px 1fr auto', alignItems: 'center',
              padding: '12px 14px', borderBottom: i < days.length - 1 ? '1px solid var(--border)' : 'none',
              background: 'var(--card)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{d}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: val === 'stengt' ? 'var(--muted)' : 'var(--fg)' }}>{val}</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, padding: '2px 7px', borderRadius: 5,
                background: override ? 'color-mix(in oklab, var(--orange) 12%, transparent)' : 'var(--secondary)',
                color: override ? 'var(--orange)' : 'var(--muted)', textTransform: 'uppercase',
              }}>{override ? 'Sesong' : 'Workspace'}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', margin: '22px 0 10px' }}>Dato-overrides ({season.overrides})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>17. mai</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Grunnet nasjonaldag</div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>13-23</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>24. juni</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Sommerferie start</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>stengt</div>
        </div>
      </div>
      <button style={{ marginTop: 10, padding: '8px 12px', border: '1px dashed var(--border)', borderRadius: 10, background: 'transparent', color: 'var(--muted)', fontSize: 12, width: '100%' }}>
        + Override for enkelt-dato
      </button>
    </div>
  );
}

// Goals tab
function YwGoals({ season }) {
  const [goals, setGoals] = React.useState((season.goals || []).map((g, i) => ({ id: i, text: g, done: i < 2 })));
  return (
    <div style={{ padding: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {goals.map(g => (
          <div key={g.id} onClick={() => setGoals(gs => gs.map(x => x.id === g.id ? { ...x, done: !x.done } : x))}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
              cursor: 'pointer',
            }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5,
              border: g.done ? 'none' : '1.5px solid var(--border)',
              background: g.done ? 'var(--success)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {g.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <div style={{ fontSize: 14, color: g.done ? 'var(--muted)' : 'var(--fg)', textDecoration: g.done ? 'line-through' : 'none' }}>{g.text}</div>
          </div>
        ))}
      </div>
      <button style={{ marginTop: 10, padding: '8px 12px', border: '1px dashed var(--border)', borderRadius: 10, background: 'transparent', color: 'var(--muted)', fontSize: 12, width: '100%' }}>
        + Nytt mål
      </button>
    </div>
  );
}

// Machine Room sheet
function MachineRoom({ season, onClose }) {
  const [factors, setFactors] = React.useState(season.dayFactors || { Man:1.0,Tir:0.9,Ons:1.0,Tor:1.2,Fre:1.8,Lør:2.4,Søn:0.6 });
  const [hourFactors, setHourFactors] = React.useState(season.hourFactors || [0,0,0,0,0,0,0.1,0.3,0.5,0.6,0.8,1.2,1.5,1.2,0.8,0.8,1.0,1.4,2.4,2.3,2.0,1.4,1.0,0.3]);
  const [budget, setBudget] = React.useState(season.revenue || 12000000);
  const [laborPct, setLaborPct] = React.useState(season.laborPct || 30);
  const [avgWage] = React.useState(season.avgWage || 280);
  const [seasonFactor, setSeasonFactor] = React.useState(season.seasonFactor || 1.2);

  const days = Math.round((yw_parseDate(season.end) - yw_parseDate(season.start)) / 86400000) + 1;
  // weekday counts (approx: days/7 each)
  const dayKeys = ['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
  const weeklyFactorSum = dayKeys.reduce((s, k) => s + factors[k], 0);
  const avgDailyTarget = budget / days;
  const fridayTarget = avgDailyTarget * 7 * (factors.Fre / weeklyFactorSum);
  const peakHourIdx = hourFactors.indexOf(Math.max(...hourFactors));
  const hourFactorSum = hourFactors.reduce((s, h) => s + h, 0);
  const peakHourTarget = fridayTarget * (hourFactors[peakHourIdx] / hourFactorSum);
  const peakStaff = Math.ceil((peakHourTarget * (laborPct / 100)) / avgWage);

  const maxHF = Math.max(...hourFactors, 1);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(28,24,20,0.45)',
      backdropFilter: 'blur(4px)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 200ms',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(920px, 95vw)', maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>Machine Room</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, letterSpacing: '-0.02em', margin: 0, fontWeight: 400 }}>
              {season.name} <span style={{ color: 'var(--muted)' }}>· 2026</span>
            </h2>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', padding: '6px 14px', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>Lukk</button>
        </div>

        <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          {/* Budget setup */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>Budget setup</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <BudgetField label="Inntektsmål" value={budget} suffix="kr" onChange={setBudget} />
              <BudgetField label="Sesongfaktor" value={seasonFactor} step="0.1" onChange={setSeasonFactor} />
              <BudgetField label="Labor-mål" value={laborPct} suffix="%" onChange={setLaborPct} />
              <BudgetField label="Snittlønn" value={avgWage} suffix="kr/t" readOnly />
            </div>
          </div>

          {/* Beregnet konsekvens */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>Beregnet konsekvens</div>
            <div style={{
              background: 'color-mix(in oklab, var(--orange) 5%, transparent)',
              border: '1px solid color-mix(in oklab, var(--orange) 20%, transparent)',
              borderRadius: 14, padding: 18,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <ConseqRow label="Dagsmål (fredag)" value={`${yw_fmtKr(fridayTarget)} kr`} />
              <ConseqRow label={`Topptime (kl. ${peakHourIdx}:00)`} value={`${yw_fmtKr(peakHourTarget)} kr`} />
              <ConseqRow label="Bemanning topp" value={`~${peakStaff} personer`} />
              <div style={{ borderTop: '1px solid color-mix(in oklab, var(--orange) 20%, transparent)', paddingTop: 10, marginTop: 4 }}>
                <ConseqRow label="Antall dager" value={days} small />
                <ConseqRow label="Gjennomsnitt/dag" value={`${yw_fmtKr(avgDailyTarget)} kr`} small />
              </div>
            </div>
          </div>
        </div>

        {/* Day factors */}
        <div style={{ padding: '0 32px 24px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>Dagfaktorer (relative vekter)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {dayKeys.map(d => (
              <FactorCell key={d} label={d} value={factors[d]} onChange={v => setFactors(f => ({ ...f, [d]: v }))} max={3} />
            ))}
          </div>
        </div>

        {/* Hour factors */}
        <div style={{ padding: '0 32px 32px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>Timefaktorer (24t)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, padding: '10px 14px', background: 'var(--secondary)', borderRadius: 14 }}>
            {hourFactors.map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  onClick={() => {
                    const v = parseFloat(prompt(`Faktor for kl ${i}:00`, h) || h);
                    if (!isNaN(v)) setHourFactors(hf => hf.map((x, j) => j === i ? Math.max(0, v) : x));
                  }}
                  style={{
                    width: '100%',
                    height: `${(h / maxHF) * 100}%`,
                    minHeight: 2,
                    background: i === peakHourIdx ? 'var(--orange)' : `color-mix(in oklab, var(--orange) ${Math.round(30 + (h/maxHF) * 60)}%, var(--border))`,
                    borderRadius: '3px 3px 0 0',
                    cursor: 'pointer',
                    transition: 'background 200ms',
                  }}
                />
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{i}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '18px 32px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--secondary)' }}>
          <button style={{ padding: '10px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 500 }}>Lagre utkast</button>
          <button style={{ padding: '10px 16px', background: 'var(--orange)', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none' }}>Propager til workspace_budget</button>
        </div>
      </div>
    </div>
  );
}

function BudgetField({ label, value, suffix, onChange, step, readOnly }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <input
          type="number"
          value={value}
          readOnly={readOnly}
          step={step}
          onChange={e => onChange && onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: 100, textAlign: 'right',
            fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600,
            border: 'none', background: 'transparent', outline: 'none',
          }}
        />
        {suffix && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{suffix}</span>}
      </div>
    </div>
  );
}

function ConseqRow({ label, value, small }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div style={{ fontSize: small ? 11 : 13, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: small ? 12 : 15, fontWeight: 600, color: small ? 'var(--muted)' : 'var(--fg)' }}>{value}</div>
    </div>
  );
}

function FactorCell({ label, value, onChange, max = 3 }) {
  const pct = Math.min(1, value / max);
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10, padding: '10px 8px',
      background: 'var(--card)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, top: `${(1 - pct) * 100}%`,
        background: `color-mix(in oklab, var(--orange) ${Math.round(8 + pct * 15)}%, transparent)`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--muted)', textAlign: 'center', textTransform: 'uppercase' }}>{label}</div>
        <input
          type="number" value={value} step="0.1" min="0" max={max}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: '100%', textAlign: 'center', marginTop: 4,
            fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
            border: 'none', background: 'transparent', outline: 'none',
          }}
        />
      </div>
    </div>
  );
}

// Drawer component
function SeasonDrawer({ season, onClose, onActivate }) {
  const [tab, setTab] = React.useState('overview');
  const [machineOpen, setMachineOpen] = React.useState(false);
  if (!season) return null;
  const tabs = [
    { key: 'overview', label: 'Oversikt' },
    { key: 'hours', label: 'Åpningstider' },
    { key: 'goals', label: 'Mål', count: season.goals?.length || 0 },
    { key: 'procedures', label: 'Prosedyrer' },
  ];
  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(28,24,20,0.25)',
        zIndex: 150, animation: 'fadeIn 200ms',
      }} onClick={onClose} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(520px, 100vw)',
        background: 'var(--card)', borderLeft: '1px solid var(--border)',
        zIndex: 200, overflowY: 'auto',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        animation: 'drawerIn 260ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        <YwDrawerHeader season={season} onClose={onClose} />
        <YwTabs tabs={tabs} active={tab} onChange={setTab} />
        {tab === 'overview' && <YwOverview season={season} onActivate={onActivate} onOpenMachine={() => setMachineOpen(true)} />}
        {tab === 'hours' && <YwHours season={season} />}
        {tab === 'goals' && <YwGoals season={season} />}
        {tab === 'procedures' && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Kommer i P2</div>
            <div style={{ fontSize: 12 }}>Koble protokoller til sesongen (f.eks. sommermeny-opplæring)</div>
          </div>
        )}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          Sist endret av Pontus · 2t siden · <span style={{ color: 'var(--orange)', cursor: 'pointer' }}>kopier deep-link</span>
        </div>
      </aside>
      {machineOpen && <MachineRoom season={season} onClose={() => setMachineOpen(false)} />}
    </>
  );
}

Object.assign(window, { SeasonDrawer, MachineRoom, YwStatusPill });
