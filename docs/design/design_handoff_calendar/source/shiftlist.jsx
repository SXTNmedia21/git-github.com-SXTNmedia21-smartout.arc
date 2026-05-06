// Vaktliste — staff-scoped shift list.
// Uke-modus viser alle 7 dager stablet (klumpet crew per dag).
// Måned-modus viser hele måneden gruppert per dag.
// Avdelinger ligger i en dropdown for å redusere chip-støy.

function ShiftList({ scope, setScope, range, setRange, onOpenItem }) {
  // scope: { kind: 'me' | 'all' | 'dept' | 'person', value? }
  // range: 'week' | 'month'

  const matchScope = (it) => {
    if (it.type !== 'shift') return false;
    if (scope.kind === 'me') return it.owner === CAL.ME.id;
    if (scope.kind === 'all') return true;
    if (scope.kind === 'dept') return it.dept === scope.value;
    if (scope.kind === 'person') return it.owner === scope.value;
    return false;
  };

  const week = [4,5,6,7,8,9,10];
  const dateMatches = (date) => range === 'week' ? week.includes(date) : true;

  const items = CAL.items.filter(it => matchScope(it) && dateMatches(it.date))
    .sort((a, b) => (a.date - b.date) || (a.time || '').localeCompare(b.time || ''));

  // Group by date
  const byDate = {};
  for (const it of items) {
    (byDate[it.date] ||= []).push(it);
  }

  // I uke-modus: vis ALLE 7 dager (selv om de er tomme), ikke bare de med skift.
  const dates = range === 'week'
    ? week
    : Object.keys(byDate).map(Number).sort((a,b)=>a-b);

  const totalsBy = (kind, value) => CAL.items.filter(it => {
    if (it.type !== 'shift') return false;
    if (!dateMatches(it.date)) return false;
    if (kind === 'me') return it.owner === CAL.ME.id;
    if (kind === 'all') return true;
    if (kind === 'dept') return it.dept === value;
    if (kind === 'person') return it.owner === value;
  }).length;

  const totalHours = items.reduce((s, x) => s + (x.planned || 0), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.t.bg, color: C.t.fg }}>
      <CalHeader title="Vaktliste" />

      <div style={{ padding: '6px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: C.t.serif, fontSize: 22, letterSpacing: '-0.01em' }}>{CAL.MONTH}</div>
        <ViewToggle value={range === 'week' ? 'Uke' : 'Måned'} onChange={(v) => setRange(v === 'Måned' ? 'month' : 'week')} />
      </div>

      <ScopeChips scope={scope} setScope={setScope} totalsBy={totalsBy} />

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 110px' }}>
        <ScopeSummary scope={scope} count={items.length} hours={totalHours} range={range} />

        {dates.length === 0 ? (
          <EmptyDay />
        ) : (
          dates.map(d => (
            <DayCrewCluster
              key={d}
              date={d}
              shifts={byDate[d] || []}
              compact={scope.kind === 'me'}
              showCrew={scope.kind !== 'me'}
              onTap={onOpenItem}
            />
          ))
        )}
      </div>

      <TabBar active="vakter" />
    </div>
  );
}

// ─── Chips: Mine / Alle / Avdeling ▾ / Per ansatt ▾ ──────────────────────────
function ScopeChips({ scope, setScope, totalsBy }) {
  const [open, setOpen] = React.useState(null); // 'dept' | 'person' | null
  const personScope = scope.kind === 'person' ? CAL.staffById(scope.value) : null;
  const deptColor = (k) => ({ kjokken: '#ee560c', sal: '#00ab93', bar: '#864ad2', event: '#c18200' })[k];
  const deptLabel = (k) => ({ kjokken: 'Kjøkken', sal: 'Sal', bar: 'Bar', event: 'Event' })[k];

  const pill = (active, label, count, onClick, accent) => (
    <button onClick={onClick} style={{
      padding: '8px 12px', borderRadius: 999,
      background: active ? (accent || C.t.orange) : C.t.surface2,
      color: active ? '#fff' : C.t.fgSoft,
      border: `1px solid ${active ? (accent || C.t.orange) : C.t.border}`,
      fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
      cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {label}
      {count != null && <span style={{ fontFamily: C.t.mono, fontSize: 10.5, opacity: .75 }}>{count}</span>}
    </button>
  );

  const dropdown = (active, label, onToggle, isOpen, accent) => (
    <button onClick={onToggle} style={{
      padding: '8px 12px', borderRadius: 999,
      background: active ? (accent || C.t.orange) : C.t.surface2,
      color: active ? '#fff' : C.t.fgSoft,
      border: `1px solid ${active ? (accent || C.t.orange) : C.t.border}`,
      fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
      cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
        style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
  );

  const deptActive = scope.kind === 'dept';
  const personActive = scope.kind === 'person';

  return (
    <div style={{ padding: '0 0 6px' }}>
      <div style={{
        display: 'flex', gap: 8, padding: '0 16px 8px', overflowX: 'auto',
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {pill(scope.kind === 'me', '✦ Mine vakter', totalsBy('me'), () => { setScope({ kind: 'me' }); setOpen(null); })}
        {pill(scope.kind === 'all', 'Hele teamet', totalsBy('all'), () => { setScope({ kind: 'all' }); setOpen(null); })}
        {dropdown(
          deptActive,
          deptActive ? deptLabel(scope.value) : 'Avdeling',
          () => setOpen(open === 'dept' ? null : 'dept'),
          open === 'dept',
          deptActive ? deptColor(scope.value) : null,
        )}
        {dropdown(
          personActive,
          personActive ? personScope.name.split(' ')[0] : 'Ansatt',
          () => setOpen(open === 'person' ? null : 'person'),
          open === 'person',
        )}
      </div>

      {/* Avdeling-meny */}
      {open === 'dept' && (
        <div style={{
          margin: '0 16px 8px', padding: 6,
          background: C.t.surface, border: `1px solid ${C.t.border}`, borderRadius: 12,
          display: 'flex', flexDirection: 'column',
        }}>
          {['kjokken','sal','bar','event'].map(k => {
            const active = scope.kind === 'dept' && scope.value === k;
            return (
              <button key={k} onClick={() => { setScope({ kind: 'dept', value: k }); setOpen(null); }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 10px', borderRadius: 8,
                background: active ? `color-mix(in oklab, ${deptColor(k)} 18%, transparent)` : 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', fontSize: 13.5,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: deptColor(k) }} />
                  <span style={{ fontWeight: active ? 700 : 500 }}>{deptLabel(k)}</span>
                </span>
                <span style={{ fontFamily: C.t.mono, fontSize: 11, color: C.t.muted }}>{totalsBy('dept', k)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Ansatt-meny */}
      {open === 'person' && (
        <div style={{
          margin: '0 16px 8px', padding: '10px 8px',
          background: C.t.surface, border: `1px solid ${C.t.border}`, borderRadius: 12,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        }}>
          {CAL.STAFF.map(s => {
            const active = scope.kind === 'person' && scope.value === s.id;
            const isMe = s.id === CAL.ME.id;
            return (
              <button key={s.id} onClick={() => { setScope({ kind: 'person', value: s.id }); setOpen(null); }} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 4px',
                background: active ? `color-mix(in oklab, ${s.color} 18%, transparent)` : 'transparent',
                border: `1px solid ${active ? s.color : 'transparent'}`,
                borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
              }}>
                <Avatar staff={s} size={32} ring={isMe} />
                <div style={{ fontSize: 10.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.15,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%',
                }}>{s.name.split(' ')[0]}{isMe && ' (deg)'}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScopeSummary({ scope, count, hours, range }) {
  const label = (() => {
    if (scope.kind === 'me') return 'Dine vakter';
    if (scope.kind === 'all') return 'Hele teamet';
    if (scope.kind === 'dept') return ({ kjokken: 'Kjøkken', sal: 'Sal', bar: 'Bar', event: 'Event' })[scope.value];
    if (scope.kind === 'person') {
      const s = CAL.staffById(scope.value);
      return s ? s.name : '—';
    }
  })();
  const sub = range === 'week' ? 'Uke 19 · 4–10. mai' : 'Hele mai';
  return (
    <div style={{
      padding: '14px 16px 16px', marginBottom: 14,
      background: C.t.surface, border: `1px solid ${C.t.border}`, borderRadius: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: 700, color: C.t.muted, textTransform: 'uppercase' }}>{sub}</div>
        <div style={{ fontFamily: C.t.serif, fontSize: 22, letterSpacing: '-0.01em', marginTop: 2 }}>{label}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: C.t.mono, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: C.t.fg }}>
          {count}<span style={{ fontSize: 13, color: C.t.muted, marginLeft: 4 }}>vakter</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.t.muted, fontFamily: C.t.mono, marginTop: 2 }}>{hours}t totalt</div>
      </div>
    </div>
  );
}

// ─── Day "crew cluster" — alle som jobber den dagen, klumpet sammen ──────────
function DayCrewCluster({ date, shifts, showCrew, compact, onTap }) {
  const meta = CAL.days[date - 1];
  const isToday = date === CAL.TODAY;
  const meIn = shifts.some(s => s.owner === CAL.ME.id);

  // Sorter shifts: mine først, så på starttid
  const sorted = [...shifts].sort((a, b) => {
    const am = a.owner === CAL.ME.id ? 0 : 1;
    const bm = b.owner === CAL.ME.id ? 0 : 1;
    if (am !== bm) return am - bm;
    return (a.time || '').localeCompare(b.time || '');
  });

  // Ledig dag?
  const empty = sorted.length === 0;

  // Group shifts by department (for the cluster summary)
  const byDept = {};
  for (const s of sorted) (byDept[s.dept] ||= []).push(s);

  return (
    <div style={{
      marginBottom: 12,
      background: isToday ? `color-mix(in oklab, ${C.t.orange} 5%, ${C.t.surface})` : C.t.surface,
      border: `1px solid ${isToday ? `color-mix(in oklab, ${C.t.orange} 35%, ${C.t.border})` : C.t.border}`,
      borderRadius: 16, overflow: 'hidden',
    }}>
      {/* Day header */}
      <div style={{
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: empty ? 'none' : `1px solid ${C.t.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: C.t.muted, textTransform: 'uppercase' }}>
            {meta.dayShort}
          </span>
          <span style={{ fontFamily: C.t.serif, fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1, color: isToday ? C.t.orange : C.t.fg }}>
            {date}.
          </span>
          <span style={{ fontSize: 12, color: C.t.fgSoft }}>
            {meta.dayLong}
          </span>
          {isToday && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.3, padding: '2px 6px', borderRadius: 5,
              background: C.t.orange, color: '#fff',
            }}>I DAG</span>
          )}
          {meIn && !compact && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.3, padding: '2px 6px', borderRadius: 5,
              background: `color-mix(in oklab, ${C.t.orange} 16%, transparent)`, color: C.t.orange,
            }}>DU JOBBER</span>
          )}
        </div>
        {!empty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Avdelings-mini-tetthet */}
            {!compact && (
              <div style={{ display: 'flex', gap: 3 }}>
                {Object.entries(byDept).map(([k, arr]) => {
                  const col = ({ kjokken: '#ee560c', sal: '#00ab93', bar: '#864ad2', event: '#c18200' })[k];
                  return (
                    <div key={k} title={`${k}: ${arr.length}`} style={{
                      padding: '2px 6px', borderRadius: 5,
                      background: `color-mix(in oklab, ${col} 22%, transparent)`,
                      color: col, fontFamily: C.t.mono, fontSize: 10, fontWeight: 700,
                    }}>{arr.length}</div>
                  );
                })}
              </div>
            )}
            <span style={{ fontSize: 11, color: C.t.muted, fontFamily: C.t.mono }}>{shifts.length}</span>
          </div>
        )}
      </div>

      {/* Body */}
      {empty ? (
        <div style={{ padding: '14px 14px', fontSize: 12.5, color: C.t.muted }}>
          Ingen vakter.
        </div>
      ) : (
        <div style={{ padding: '8px 8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.map(s => <CompactShiftRow key={s.id} shift={s} showCrew={showCrew} onTap={() => onTap?.(s)} />)}
        </div>
      )}
    </div>
  );
}

// Compact rad — én linje per ansatt med avatar, tid, rolle
function CompactShiftRow({ shift, showCrew, onTap }) {
  const owner = shift.owner ? CAL.staffById(shift.owner) : null;
  const dept = ({ kjokken: '#ee560c', sal: '#00ab93', bar: '#864ad2', event: '#c18200' })[shift.dept] || C.t.orange;
  const isMe = owner && owner.id === CAL.ME.id;

  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '6px 8px',
      background: isMe ? `color-mix(in oklab, ${C.t.orange} 10%, transparent)` : 'transparent',
      border: 'none', borderRadius: 8,
      cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', textAlign: 'left',
    }}>
      {showCrew && owner ? (
        <Avatar staff={owner} size={28} ring={isMe} />
      ) : (
        <div style={{ width: 3, alignSelf: 'stretch', background: dept, borderRadius: 99, minHeight: 28 }} />
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 12.5, fontWeight: isMe ? 700 : 500,
          color: isMe ? C.t.orange : C.t.fg,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0,
        }}>
          {showCrew && owner ? owner.name.split(' ')[0] + ' ' + owner.name.split(' ')[1].charAt(0) + '.' : shift.title}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: dept,
          padding: '1px 5px', borderRadius: 4,
          background: `color-mix(in oklab, ${dept} 14%, transparent)`,
          flexShrink: 0,
        }}>{shift.role || ({ kjokken: 'Kjøkken', sal: 'Sal', bar: 'Bar', event: 'Event' })[shift.dept]}</span>
        {shift.isShiftLead && (
          <span style={{
            fontSize: 8.5, fontWeight: 700, letterSpacing: 1.1, padding: '1px 4px', borderRadius: 3,
            background: C.t.orange, color: '#fff', flexShrink: 0,
          }}>LEDER</span>
        )}
      </div>
      <span style={{ fontSize: 10.5, fontFamily: C.t.mono, color: C.t.muted, flexShrink: 0 }}>
        {(shift.time || '').replace('–', '–').replace(/:00/g, '')}
      </span>
    </button>
  );
}

function Avatar({ staff, size = 36, ring = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 99, flexShrink: 0,
      background: `color-mix(in oklab, ${staff.color} 22%, transparent)`,
      color: staff.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.36, letterSpacing: 0.3,
      border: ring ? `2px solid ${staff.color}` : `1px solid color-mix(in oklab, ${staff.color} 30%, transparent)`,
      boxShadow: ring ? `0 0 0 2px ${C.t.bg}` : 'none',
    }}>
      {staff.initials}
    </div>
  );
}

Object.assign(window, { ShiftList, Avatar });
