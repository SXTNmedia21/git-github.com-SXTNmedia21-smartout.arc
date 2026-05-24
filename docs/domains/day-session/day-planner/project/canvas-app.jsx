// Canvas of layout concepts for the manager timeline.
// Each artboard mocks a different lane organization, all sharing the same time-vertical Gantt-down language.

const { useState: useStateC } = React;

const dataC = window.TimelineData;
// helpers reused
const hmToMin = window.hmToMin;
const minToHM = window.minToHM;
const areaOklch = window.areaOklch || ((id) => ({l:0.65,c:0.18,h:40}));

const PX_PER_HOUR = 38; // tighter for thumbnails
const DAY_H = 20 * PX_PER_HOUR; // 760

// ── Layout A: "Områder × Personer" — picked direction (static mock) ─
function ArtboardA() {
  const areas = dataC.AREAS;
  const empsByArea = (aid) => dataC.EMPLOYEES.filter(e => e.area === aid);
  const tasksByEmp = (eId) => dataC.TASKS.filter(t => t.emp === eId);
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <BoardHeader title="Områder × Personer" subtitle="Lanes er gruppert i bånd per område (kjøkken, sal, bar, event, frokost) — hvert bånd har sin egen kolonne per person. Klikk på «Åpne prototype» nede for fullversjon med tweaks." badge="VALGT" />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TimeGutterStatic />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          <RoutineStripsStatic />
          {areas.map(a => {
            const emps = empsByArea(a.id);
            if (emps.length === 0) return null;
            const accent = areaOklch(a.id);
            const colorVar = `oklch(${accent.l} ${accent.c} ${accent.h})`;
            return (
              <div key={a.id} style={{
                flex: emps.length, minWidth: Math.max(120, emps.length * 64),
                borderRight: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{
                  position: 'sticky', top: 0, zIndex: 3,
                  background: 'oklch(0.99 0.004 60 / 0.96)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: 6, bottom: 4, width: 3, background: colorVar, borderRadius: 9999 }} />
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--muted-fg)', padding: '1px 6px', borderRadius: 9999, background: 'oklch(0.96 0.005 50)', border: '1px solid var(--border)' }}>{a.open}–{a.close}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${emps.length}, 1fr)`, borderTop: '1px solid var(--border)' }}>
                    {emps.map(e => (
                      <div key={e.id} style={{ padding: '4px 6px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <Avatar name={e.name} size={18} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name.split(' ')[0]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ position: 'relative', height: DAY_H, display: 'grid', gridTemplateColumns: `repeat(${emps.length}, 1fr)` }}>
                  {emps.map(e => (
                    <div key={e.id} style={{ position: 'relative', borderRight: '1px solid var(--border)' }}>
                      <ShiftFillStatic shift={e.shift} accent={accent} />
                      {tasksByEmp(e.id).map(t => <TaskStatic key={t.id} t={t} accent={accent} />)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <NowLineStatic />
        </div>
      </div>
      <div style={{
        position: 'absolute', bottom: 16, right: 16, zIndex: 10,
      }}>
        <a href="Manager Timeline.html" target="_blank" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 36, padding: '0 14px',
          background: 'var(--brand-orange)', color: 'white',
          borderRadius: 9999, textDecoration: 'none',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(249,115,22,0.4)',
        }}>
          Åpne prototype <Icon name="arrow-right" size={14} />
        </a>
      </div>
    </div>
  );
}

// ── Layout B: "Crew-first" — one flat column per person, area shown as color stripe ─
function ArtboardB() {
  const emps = dataC.EMPLOYEES;
  const tasksByEmp = (eId) => dataC.TASKS.filter(t => t.emp === eId);
  const visibleEmps = emps; // all
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <BoardHeader title="Crew-first" subtitle="Én flat kolonne per person. Områdefarge som tynn stripe over avataren. Tett oversikt når det er mange mennesker." />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TimeGutterStatic />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          <RoutineStripsStatic />
          {visibleEmps.map(e => {
            const accent = areaOklch(e.area);
            return (
              <div key={e.id} style={{
                flex: 1, minWidth: 78, position: 'relative',
                borderRight: '1px solid var(--border)',
                background: `linear-gradient(to bottom, oklch(${accent.l} ${accent.c} ${accent.h} / 0.04), transparent 220px)`,
              }}>
                {/* Header */}
                <div style={{
                  position: 'sticky', top: 0,
                  background: 'oklch(0.99 0.004 60 / 0.94)',
                  backdropFilter: 'blur(10px)',
                  borderBottom: '1px solid var(--border)',
                  padding: '6px 6px 8px',
                  zIndex: 2,
                }}>
                  <div style={{ height: 3, borderRadius: 9999, background: `oklch(${accent.l} ${accent.c} ${accent.h})`, marginBottom: 5 }} />
                  <Avatar name={e.name} size={22} />
                  <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, letterSpacing: '-0.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name.split(' ')[0]}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.role}</div>
                </div>
                <div style={{ position: 'relative', height: DAY_H }}>
                  <ShiftFillStatic shift={e.shift} accent={accent} />
                  {tasksByEmp(e.id).map(t => <TaskStatic key={t.id} t={t} accent={accent} />)}
                </div>
              </div>
            );
          })}
          <NowLineStatic />
        </div>
      </div>
    </div>
  );
}

// ── Layout C: "Serviceperiode-spor" — phases as lanes ────────
function ArtboardC() {
  const phases = [
    { id: 'frokost', label: 'Frokost', start: '06:00', end: '11:00', accent: { l: 0.70, c: 0.14, h: 85 } },
    { id: 'lunsj',   label: 'Lunsj',   start: '11:00', end: '14:30', accent: { l: 0.65, c: 0.15, h: 180 } },
    { id: 'middag',  label: 'Middag',  start: '17:00', end: '22:30', accent: { l: 0.65, c: 0.22, h: 40 } },
    { id: 'event',   label: 'Event Fjorden', start: '18:00', end: '01:00', accent: { l: 0.65, c: 0.18, h: 85 } },
    { id: 'bar',     label: 'Bar & kveld', start: '15:00', end: '02:00', accent: { l: 0.55, c: 0.20, h: 300 } },
  ];
  // group tasks by phase by simple area-mapping
  const phaseTasks = (pid) => {
    if (pid === 'frokost') return dataC.TASKS.filter(t => t.area === 'frokost');
    if (pid === 'lunsj')   return dataC.TASKS.filter(t => t.area === 'bistro' && hmToMin(t.start) < 9 * 60);
    if (pid === 'middag')  return dataC.TASKS.filter(t => ['kitchen','spisesal','bistro'].includes(t.area) && hmToMin(t.start) >= 8 * 60);
    if (pid === 'event')   return dataC.TASKS.filter(t => t.area === 'event');
    if (pid === 'bar')     return dataC.TASKS.filter(t => t.area === 'bar');
    return [];
  };
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <BoardHeader title="Serviceperiode-spor" subtitle="Lanes er serviceperioder, ikke områder. Tydeligere når dagen har distinkte service-bolker." />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TimeGutterStatic />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {phases.map(p => {
            const start = hmToMin(p.start), end = hmToMin(p.end);
            return (
              <div key={p.id} style={{
                flex: 1, minWidth: 130, borderRight: '1px solid var(--border)', position: 'relative',
              }}>
                {/* Header */}
                <div style={{
                  position: 'sticky', top: 0, zIndex: 2,
                  background: 'oklch(0.99 0.004 60 / 0.94)',
                  borderBottom: '1px solid var(--border)',
                  padding: '8px 12px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 9999, background: `oklch(${p.accent.l} ${p.accent.c} ${p.accent.h})` }} />
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, letterSpacing: '-0.01em' }}>{p.label}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-fg)', marginTop: 2 }}>{p.start} – {p.end} · {phaseTasks(p.id).length} tasks</div>
                </div>
                <div style={{ position: 'relative', height: DAY_H }}>
                  {/* Phase window: filled background */}
                  <div style={{
                    position: 'absolute', left: 4, right: 4,
                    top: start * PX_PER_HOUR / 60, height: (end - start) * PX_PER_HOUR / 60,
                    background: `linear-gradient(to bottom, oklch(${p.accent.l} ${p.accent.c} ${p.accent.h} / 0.08), oklch(${p.accent.l} ${p.accent.c} ${p.accent.h} / 0.02))`,
                    border: `1px dashed oklch(${p.accent.l} ${p.accent.c} ${p.accent.h} / 0.4)`,
                    borderRadius: 10,
                  }} />
                  {phaseTasks(p.id).map(t => <TaskStatic key={t.id} t={t} accent={p.accent} />)}
                </div>
              </div>
            );
          })}
          <NowLineStatic />
        </div>
      </div>
    </div>
  );
}

function BoardHeader({ title, subtitle, badge }) {
  return (
    <div style={{
      padding: '14px 20px 12px',
      borderBottom: '1px solid var(--border)',
      background: 'oklch(0.99 0.004 60 / 0.96)',
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, letterSpacing: '-0.015em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{title}</div>
          {badge && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em',
              padding: '3px 8px', borderRadius: 9999,
              background: 'var(--brand-orange)', color: 'white',
              whiteSpace: 'nowrap',
            }}>{badge}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-fg)', marginTop: 4, maxWidth: 720, textWrap: 'pretty' }}>{subtitle}</div>
      </div>
    </div>
  );
}

function TimeGutterStatic() {
  const hours = [];
  for (let h = 0; h <= 20; h += 2) hours.push(h);
  return (
    <div style={{ width: 56, flex: '0 0 56px', borderRight: '1px solid var(--border)', background: 'var(--background)', position: 'relative' }}>
      <div style={{
        height: 60, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 6,
        fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-fg)',
      }}>Tid</div>
      <div style={{ position: 'relative', height: DAY_H }}>
        {hours.map(h => {
          const label = ((h + 6) % 24).toString().padStart(2,'0') + ':00';
          return (
            <div key={h} style={{
              position: 'absolute', top: h * PX_PER_HOUR, left: 0, right: 0,
              borderTop: '1px solid var(--border)',
              padding: '4px 6px',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: h >= 18 ? 'var(--brand-orange-dark)' : 'var(--foreground)',
            }}>{label}</div>
          );
        })}
      </div>
    </div>
  );
}

function ShiftFillStatic({ shift, accent }) {
  if (!shift) return null;
  const s = hmToMin(shift[0]), e = hmToMin(shift[1]);
  return (
    <div style={{
      position: 'absolute', left: 4, right: 4,
      top: s * PX_PER_HOUR / 60, height: (e - s) * PX_PER_HOUR / 60,
      background: `linear-gradient(to bottom, oklch(${accent.l} ${accent.c} ${accent.h} / 0.10), oklch(${accent.l} ${accent.c} ${accent.h} / 0.03))`,
      border: `1px dashed oklch(${accent.l} ${accent.c} ${accent.h} / 0.35)`,
      borderRadius: 8,
    }} />
  );
}

function TaskStatic({ t, accent }) {
  const s = hmToMin(t.start), e = hmToMin(t.end);
  const top = s * PX_PER_HOUR / 60;
  const h = Math.max(14, (e - s) * PX_PER_HOUR / 60 - 2);
  const isDone = t.status === 'done';
  const isActive = t.status === 'active';
  return (
    <div style={{
      position: 'absolute', left: 6, right: 6, top, height: h,
      background: isDone ? 'oklch(0.97 0.005 50)' : isActive ? 'linear-gradient(to bottom, oklch(0.97 0.03 40), oklch(0.985 0.015 50))' : 'var(--card)',
      border: '1px solid ' + (isActive ? 'oklch(0.7 0.18 40 / 0.4)' : 'var(--border)'),
      borderRadius: 8,
      padding: '3px 6px 3px 9px',
      fontSize: 9.5,
      color: isDone ? 'var(--muted-fg)' : 'var(--foreground)',
      textDecoration: isDone ? 'line-through' : 'none',
      lineHeight: 1.15,
      overflow: 'hidden',
      boxShadow: isActive ? '0 2px 12px rgba(249,115,22,0.18)' : 'none',
      position: 'absolute',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 3, bottom: 3, width: 3,
        background: isActive ? 'var(--brand-orange)' : `oklch(${accent.l} ${accent.c} ${accent.h})`,
        borderRadius: 9999,
      }} />
      <div style={{ fontWeight: 600, fontSize: 9.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
      {h > 24 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--muted-fg)' }}>{t.start}</div>}
    </div>
  );
}

function RoutineStripsStatic() {
  return (
    <>
      {dataC.ROUTINE.map(r => {
        const s = hmToMin(r.start), e = hmToMin(r.end);
        const palette = {
          'phase-prep': 'oklch(0.98 0.012 55 / 0.55)',
          'phase-service': 'oklch(0.97 0.018 60 / 0.55)',
          'phase-service-warm': 'oklch(0.95 0.025 40 / 0.55)',
          'phase-bridge': 'oklch(0.96 0.01 80 / 0.5)',
          'phase-late': 'oklch(0.93 0.025 295 / 0.30)',
          'phase-close': 'oklch(0.91 0.012 50 / 0.55)',
        };
        return (
          <div key={r.id} style={{
            position: 'absolute', left: 0, right: 0,
            top: 60 + s * PX_PER_HOUR / 60, height: (e - s) * PX_PER_HOUR / 60,
            background: palette[r.tone] || 'transparent',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        );
      })}
    </>
  );
}

function NowLineStatic() {
  const top = 60 + dataC.OUTLET.nowMinutes * PX_PER_HOUR / 60;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, borderTop: '2px solid var(--brand-orange)', pointerEvents: 'none', zIndex: 5 }}>
      <span style={{
        position: 'absolute', left: 6, top: -8,
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        padding: '2px 8px', borderRadius: 9999,
        background: 'var(--brand-orange)', color: 'white',
        boxShadow: '0 4px 12px rgba(249,115,22,0.35)',
      }}>NÅ · {minToHM(dataC.OUTLET.nowMinutes)}</span>
    </div>
  );
}

// ── Mount the canvas ─────────────────────────────────────────
function CanvasApp() {
  return (
    <DesignCanvas>
      <DCSection id="layouts" title="Layout-utforskninger" description="Tre måter å organisere vertikal-tidslinjen. A er valgt for prototypen (med tweaks).">
        <DCArtboard id="a" label="A · Områder × Personer  ←  valgt" width={1280} height={820}>
          <ArtboardA />
        </DCArtboard>
        <DCArtboard id="b" label="B · Crew-first" width={1100} height={820}>
          <ArtboardB />
        </DCArtboard>
        <DCArtboard id="c" label="C · Serviceperiode-spor" width={1000} height={820}>
          <ArtboardC />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CanvasApp />);
