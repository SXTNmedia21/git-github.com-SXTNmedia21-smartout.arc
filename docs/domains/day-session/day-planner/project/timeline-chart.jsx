// ──────────────────────────────────────────────────────────────
// Manager Timeline — chart (lane grid)
// ──────────────────────────────────────────────────────────────
(function() {
const { useState, useMemo, useRef, useEffect, useCallback } = React;
const { OUTLET, AREAS, ROUTINE, EMPLOYEES, TASKS, DEVIATIONS, NOTES, ROLES, ROLE_TASKS } = window.TimelineData;

const DAY_MINUTES = 20 * 60; // 06:00 → 02:00

// Area color resolution
function areaColorVar(areaId) {
  const a = AREAS.find(x => x.id === areaId);
  return a ? `var(--${a.color})` : 'var(--brand-orange)';
}
function areaOklch(areaId) {
  // these match tokens.css --dept-* exactly. We split into L / C / H for CSS var math.
  const map = {
    'frokost':  { l: 0.65, c: 0.18, h: 85 },   // event color
    'kitchen':  { l: 0.65, c: 0.20, h: 40 },
    'bistro':   { l: 0.65, c: 0.15, h: 180 },  // floor
    'spisesal': { l: 0.55, c: 0.18, h: 200 },  // slightly cooler floor
    'bar':      { l: 0.55, c: 0.20, h: 300 },
    'event':    { l: 0.65, c: 0.18, h: 85 },
  };
  return map[areaId] || { l: 0.65, c: 0.22, h: 40 };
}

// ─── Time gutter ──────────────────────────────────────────────
function TimeGutter({ pxPerHour, showHalf }) {
  const hours = [];
  for (let h = 0; h <= 20; h++) hours.push(h);
  return (
    <div className="time-gutter" style={{ height: 110 + pxPerHour * 20 }}>
      <div className="gutter-header">
        <span className="lbl">Tid</span>
      </div>
      <div className="gutter-rows" style={{ height: pxPerHour * 20 }}>
        {/* Hour numbers */}
        {hours.map(h => {
          const isNextDay = h >= 18;
          const hh = ((h + 6) % 24).toString().padStart(2, '0');
          return (
            <React.Fragment key={h}>
              <div className={"gutter-hour" + (isNextDay ? ' is-next-day' : '')} style={{ top: h * pxPerHour }}>
                <span className="hh">{hh}</span>
                <span className="mm">00</span>
              </div>
              {showHalf && h < 20 && (
                <div className="gutter-tick" style={{ top: h * pxPerHour + pxPerHour / 2 }} />
              )}
            </React.Fragment>
          );
        })}
        {/* Phase labels — positioned at actual phase start times */}
        {ROUTINE.map(r => {
          const start = window.hmToMin(r.start);
          const end = window.hmToMin(r.end);
          const top = start * pxPerHour / 60;
          const h = (end - start) * pxPerHour / 60;
          if (h < 18) return null; // skip tiny bands
          return (
            <div key={r.id} className={`gutter-phase tone-${r.tone.replace('phase-','')}`} style={{ top, height: h }}>
              <span className="lbl">{r.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Routine strips (service phase bands behind the lanes) ───
function RoutineStrips({ pxPerHour }) {
  return (
    <div className="routine-strip" style={{ height: pxPerHour * 20 }}>
      {ROUTINE.map(r => {
        const start = window.hmToMin(r.start);
        const end = window.hmToMin(r.end);
        const top = start * pxPerHour / 60;
        const h = (end - start) * pxPerHour / 60;
        return (
          <div key={r.id} className={`routine-row tone-${r.tone.replace('phase-','')}`} style={{ top, height: h }} />
        );
      })}
    </div>
  );
}

// ─── Now line ────────────────────────────────────────────────
function NowLine({ pxPerHour, nowMinutes }) {
  const top = nowMinutes * pxPerHour / 60;
  return (
    <div className="now-line" style={{ top }} data-time={window.minToHM(nowMinutes)}>
      <div className="upcoming-glow" />
    </div>
  );
}

// ─── Past dim overlay ─────────────────────────────────────────
function PastDim({ pxPerHour, nowMinutes }) {
  return <div className="past-dim" style={{ height: nowMinutes * pxPerHour / 60 }} />;
}

// ─── Overlap layout — assigns each task to a virtual column ─────
function layoutOverlap(tasks) {
  const sorted = [...tasks].sort((a, b) => {
    const d = window.hmToMin(a.start) - window.hmToMin(b.start);
    if (d !== 0) return d;
    return window.hmToMin(b.end) - window.hmToMin(a.end);
  });
  const cols = []; // each col tracks last endMin
  const result = [];
  for (const t of sorted) {
    const ts = window.hmToMin(t.start);
    const te = window.hmToMin(t.end);
    let placed = false;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].endMin <= ts) {
        cols[i] = { endMin: te };
        result.push({ task: t, col: i });
        placed = true;
        break;
      }
    }
    if (!placed) {
      cols.push({ endMin: te });
      result.push({ task: t, col: cols.length - 1 });
    }
  }
  return { items: result, totalCols: Math.max(1, cols.length) };
}

// ─── Single task block ────────────────────────────────────────
function TaskBlock({ task, pxPerHour, areaId, onClick, onDragStart, col = 0, totalCols = 1, showAssignee = false }) {
  const start = window.hmToMin(task.start);
  const end = window.hmToMin(task.end);
  const top = start * pxPerHour / 60;
  const height = Math.max(20, (end - start) * pxPerHour / 60 - 2);
  const tiny = height < 36;
  const accent = areaOklch(areaId);
  const widthPct = 100 / totalCols;
  const leftPct = col * widthPct;
  const emp = showAssignee && task.emp ? EMPLOYEES.find(e => e.id === task.emp) : null;

  return (
    <div
      className={`task s-${task.status || 'upcoming'} ${task.priority ? 'p-' + task.priority : ''} ${task.flagged ? 'flagged' : ''} ${tiny ? 'tiny' : ''}`}
      style={{
        top, height,
        left: `calc(${leftPct}% + 4px)`,
        width: `calc(${widthPct}% - 8px)`,
        right: 'auto',
        '--accent-c': `oklch(${accent.l} ${accent.c} ${accent.h})`,
        '--area-color': `oklch(${accent.l} ${accent.c} ${accent.h})`,
      }}
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, task)}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(task); }}
      title={task.title}
    >
      <div className="ttl">{task.title}</div>
      {!tiny && (
        <div className="meta">
          <span>{task.start}</span>
          <span className="sep">–</span>
          <span>{task.end}</span>
          {task.recurring && (
            <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--muted-fg)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <Icon name="radio" size={9} style={{ verticalAlign: -1, marginRight: 2 }} />
              {task.recurring}
            </span>
          )}
        </div>
      )}
      {emp && height > 24 && (
        <div className="assignee" title={emp.name + ' · ' + emp.role}>
          <Avatar name={emp.name} size={18} />
        </div>
      )}
      {showAssignee && !task.emp && !tiny && !task.recurring && (
        <div className="assignee unassigned" title="Ikke tildelt">
          <Icon name="user-plus" size={11} />
        </div>
      )}
      {task.flagged && <div className="avvik-flag">!</div>}
    </div>
  );
}

// ─── Single employee lane body (shift fill + tasks) ───────────
function EmployeeLane({ emp, areaId, pxPerHour, dimmed, onLaneClick, onTaskClick, onTaskDrop, onTaskDragStart, draggingTaskId }) {
  const tasksHere = TASKS.filter(t => t.emp === emp.id);
  const shift = emp.shift;
  const shiftStart = shift ? window.hmToMin(shift[0]) : null;
  const shiftEnd = shift ? window.hmToMin(shift[1]) : null;
  const accent = areaOklch(emp.area || areaId);

  const [dragOver, setDragOver] = useState(false);

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.round((y / pxPerHour) * 60);
    const snapped = Math.round(minutes / 15) * 15;
    onLaneClick && onLaneClick({
      empId: emp.id,
      areaId: emp.area || areaId,
      minutes: snapped,
      pageX: e.clientX,
      pageY: e.clientY,
    });
  };

  return (
    <div
      className={`lane-body ${dimmed ? 'dimmed' : ''} ${dragOver ? 'drop-target' : ''}`}
      style={{
        height: pxPerHour * 20,
        '--area-l': accent.l,
        '--area-c': accent.c,
        '--area-h': accent.h,
        '--hour-h': pxPerHour + 'px',
      }}
      onClick={handleClick}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const minutes = Math.round((y / pxPerHour) * 60);
        onTaskDrop && onTaskDrop({ empId: emp.id, areaId: emp.area || areaId, minutes });
      }}
    >
      {shift && (
        <div className="shift-fill" style={{
          top: shiftStart * pxPerHour / 60,
          height: (shiftEnd - shiftStart) * pxPerHour / 60,
        }}>
          <div className="lbl">På vakt</div>
          <div className="lbl-end">{shift[0]} – {shift[1]}</div>
        </div>
      )}
      {tasksHere.map(t => (
        <TaskBlock key={t.id} task={t} pxPerHour={pxPerHour} areaId={emp.area || areaId} onClick={onTaskClick} onDragStart={onTaskDragStart} />
      ))}
    </div>
  );
}

// ─── Single unassigned lane (one per area, for area-anchored tasks) ───
function UnassignedLane({ areaId, pxPerHour, dimmed, onLaneClick, onTaskClick, onTaskDrop, onTaskDragStart }) {
  const tasksHere = TASKS.filter(t => t.area === areaId && t.emp == null);
  const [dragOver, setDragOver] = useState(false);
  const accent = areaOklch(areaId);
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.round((y / pxPerHour) * 60);
    const snapped = Math.round(minutes / 15) * 15;
    onLaneClick && onLaneClick({ empId: null, areaId, minutes: snapped, pageX: e.clientX, pageY: e.clientY });
  };
  return (
    <div
      className={`lane-body unassigned-well ${dimmed ? 'dimmed' : ''} ${dragOver ? 'drop-target' : ''}`}
      style={{
        height: pxPerHour * 20,
        '--area-l': accent.l, '--area-c': accent.c, '--area-h': accent.h,
        '--hour-h': pxPerHour + 'px',
      }}
      onClick={handleClick}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const minutes = Math.round((y / pxPerHour) * 60);
        onTaskDrop && onTaskDrop({ empId: null, areaId, minutes });
      }}
    >
      {tasksHere.map(t => (
        <TaskBlock key={t.id} task={t} pxPerHour={pxPerHour} areaId={areaId} onClick={onTaskClick} onDragStart={onTaskDragStart} />
      ))}
    </div>
  );
}

// ─── Single-lane band (Area or Role view — one column per band) ─
function SingleLaneBand({ band, pxPerHour, mode, callbacks, dimmed }) {
  // Tasks: from TASKS by area, or from ROLE_TASKS by role
  const tasksHere = mode === 'role'
    ? ROLE_TASKS.filter(t => t.role === band.id).map(t => ({ ...t, area: band.areaId || band.area }))
    : TASKS.filter(t => t.area === band.id);

  const [dragOver, setDragOver] = useState(false);
  const accent = areaOklch(band.areaId || band.id);
  const colorVar = `oklch(${accent.l} ${accent.c} ${accent.h})`;
  const colorRefId = band.areaId || band.id;

  const { items, totalCols } = useMemo(() => layoutOverlap(tasksHere), [tasksHere.length, mode]);

  // Employees on shift right now in this band
  const empsRelevant = mode === 'role'
    ? EMPLOYEES.filter(e => normalizeRole(e.role) === band.id)
    : EMPLOYEES.filter(e => e.area === band.id);
  const empsOnShift = empsRelevant.filter(e => {
    const s = window.hmToMin(e.shift[0]); const en = window.hmToMin(e.shift[1]);
    return s <= OUTLET.nowMinutes && OUTLET.nowMinutes <= en;
  });

  // Devs visible only in area mode
  const devs = mode === 'area' ? DEVIATIONS.filter(d => d.area === band.id) : [];

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.round((y / pxPerHour) * 60);
    const snapped = Math.round(minutes / 15) * 15;
    callbacks.onLaneClick && callbacks.onLaneClick({
      empId: null,
      areaId: colorRefId,
      minutes: snapped,
      pageX: e.clientX,
      pageY: e.clientY,
    });
  };

  // Open / close period background (only area mode, only if band has hours)
  const showOpenPeriod = mode === 'area' && band.open && band.close;
  const openStart = showOpenPeriod ? window.hmToMin(band.open) : 0;
  const openEnd = showOpenPeriod ? window.hmToMin(band.close) : 0;

  const minWidth = Math.max(220, totalCols * 110);

  return (
    <div className="area-band" style={{ '--area-color': colorVar, flex: '1 1 0', minWidth }}>
      {/* HEADER */}
      <div className="area-band-hdr" style={{ position: 'sticky', top: 0, zIndex: 4 }}>
        <div className="area-header">
          <span className="name">{band.name || band.label}</span>
          {band.open && band.close && (
            <span className="hours" title="Klikk for å redigere åpningstider" onClick={(e) => { e.stopPropagation(); callbacks.onEditHours && callbacks.onEditHours(band); }}>
              <Icon name="clock" size={11} />
              {band.open} – {band.close}
            </span>
          )}
          {band.booked && (
            <span className="meta" title={band.booked} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              <Icon name="users" size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {band.booked}
            </span>
          )}
          {!band.booked && band.capacity && (
            <span className="meta">{band.capacity} pl.</span>
          )}
          {mode === 'role' && (
            <span className="meta">
              <Icon name="users" size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
              {empsRelevant.length} ansatte
            </span>
          )}
        </div>
        {/* Emp-on-shift chip strip */}
        <div className="emp-strip">
          {empsRelevant.slice(0, 6).map(e => {
            const onShift = empsOnShift.includes(e);
            return (
              <div key={e.id} className={`emp-chip ${onShift ? 'on-shift' : ''}`}
                draggable
                onDragStart={(ev) => callbacks.onEmpDragStart && callbacks.onEmpDragStart(ev, e)}
                title={`${e.name} · ${e.role} · ${e.shift[0]}–${e.shift[1]}`}>
                <Avatar name={e.name} size={20} />
                <span className="lbl">{e.name.split(' ')[0]}</span>
              </div>
            );
          })}
          {empsRelevant.length > 6 && (
            <div className="emp-chip more">+{empsRelevant.length - 6}</div>
          )}
          {empsRelevant.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted-fg)', padding: '4px 0' }}>Ingen tildelt</div>
          )}
        </div>
      </div>

      {/* BODY */}
      <div
        className={`lane-body single ${dimmed ? 'dimmed' : ''} ${dragOver ? 'drop-target' : ''}`}
        style={{
          height: pxPerHour * 20,
          position: 'relative',
          '--area-l': accent.l, '--area-c': accent.c, '--area-h': accent.h,
          '--hour-h': pxPerHour + 'px',
        }}
        onClick={handleClick}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const minutes = Math.round((y / pxPerHour) * 60);
          callbacks.onTaskDrop && callbacks.onTaskDrop({ empId: null, areaId: colorRefId, minutes });
        }}
      >
        {/* Open-period wash */}
        {showOpenPeriod && (
          <div className="open-period" style={{
            position: 'absolute', left: 4, right: 4,
            top: openStart * pxPerHour / 60,
            height: (openEnd - openStart) * pxPerHour / 60,
            background: `linear-gradient(to bottom, oklch(${accent.l} ${accent.c} ${accent.h} / 0.10), oklch(${accent.l} ${accent.c} ${accent.h} / 0.03))`,
            border: `1px dashed oklch(${accent.l} ${accent.c} ${accent.h} / 0.35)`,
            borderRadius: 12,
            pointerEvents: 'none',
          }}>
            <div className="open-lbl">Åpent · {band.open}–{band.close}</div>
          </div>
        )}
        {items.map(({ task, col }) => (
          <TaskBlock key={task.id || (task.role + task.start)}
            task={task}
            pxPerHour={pxPerHour}
            areaId={colorRefId}
            col={col}
            totalCols={totalCols}
            showAssignee={mode === 'area'}
            onClick={callbacks.onTaskClick}
            onDragStart={callbacks.onTaskDragStart}
          />
        ))}
        {devs.map(d => (
          <div key={d.id} className={`avvik-pin ${d.status === 'resolved' ? 'resolved' : ''}`}
            style={{ top: window.hmToMin(d.time) * pxPerHour / 60 - 12, left: -8 }}
            title={d.title}
            onClick={(e) => { e.stopPropagation(); callbacks.onDeviationClick && callbacks.onDeviationClick(d); }}
          >
            <Icon name="alert-circle" size={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeRole(roleString) {
  const r = roleString.toLowerCase();
  if (r.includes('kjøkkensjef')) return 'kjokkensjef';
  if (r.includes('sous')) return 'souschef';
  if (r.includes('frokost')) return 'frokostkokk';
  if (r.includes('oppvask')) return 'oppvask';
  if (r.includes('kokk')) return 'kokk';
  if (r.includes('serv')) return 'servitor';
  if (r.includes('hostess')) return 'hostess';
  if (r.includes('bartender')) return 'bartender';
  if (r.includes('event')) return 'eventsjef';
  return 'kokk';
}
function AreaBand({ area, pxPerHour, employees, filters, callbacks, draggingTaskId, hourTotals }) {
  const dimmed = filters.areas.size > 0 && filters.view === 'person' && !filters.areas.has(area.id);
  // employees come pre-filtered for the band (areas, people-flat, role groups)
  const emps = employees;
  // Add area-anchored deviations only in 'person' view (when band corresponds to an actual area)
  const isAreaBand = filters.view === 'person';
  const devs = isAreaBand ? DEVIATIONS.filter(d => d.area === area.id) : [];

  // Resolve accent — try area color first, then dept-* lookup
  let accent;
  if (isAreaBand) {
    accent = areaOklch(area.id);
  } else {
    // people/role view — use first emp's area color, or brand
    accent = emps.length ? areaOklch(emps[0].area) : { l: 0.65, c: 0.22, h: 40 };
  }
  const colorVar = `oklch(${accent.l} ${accent.c} ${accent.h})`;

  // Lane columns: one per employee + (optional) unassigned lane
  const showUnassigned = isAreaBand && TASKS.some(t => t.area === area.id && t.emp == null);
  const laneCount = emps.length + (showUnassigned ? 1 : 0);

  if (laneCount === 0) return null;

  return (
    <div className="area-band" style={{ '--area-color': colorVar, flex: '0 0 auto' }}>
      {/* HEADER */}
      <div className="area-band-hdr" style={{ position: 'sticky', top: 0, zIndex: 4 }}>
        <div className="area-header">
          <span className="name">{area.name}</span>
          {area.open && area.close && (
            <span className="hours" title="Klikk for å redigere åpningstider" onClick={(e) => { e.stopPropagation(); callbacks.onEditHours && callbacks.onEditHours(area); }}>
              <Icon name="clock" size={11} />
              {area.open} – {area.close}
            </span>
          )}
          {area.booked && (
            <span className="meta" title={area.booked}>
              <Icon name="users" size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {area.booked}
            </span>
          )}
          {!area.booked && area.capacity && (
            <span className="meta">{area.capacity} pl.</span>
          )}
          {!area.open && (
            <span className="meta">{emps.length} på vakt</span>
          )}
        </div>
        <div className="area-emp-row" style={{ gridTemplateColumns: `repeat(${laneCount}, 1fr)` }}>
          {emps.map(e => (
            <div key={e.id} className="emp-col-header">
              <Avatar name={e.name} size={26} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="name">{e.name.split(' ')[0]}</div>
                <div className="role">{e.role}</div>
              </div>
            </div>
          ))}
          {showUnassigned && (
            <div className="emp-col-header unassigned">
              <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px dashed var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)' }}>
                <Icon name="user-plus" size={12} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="name" style={{ color: 'var(--muted-fg)' }}>Ledig</div>
                <div className="role">Ikke tildelt</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* BODY */}
      <div className="area-band-body" style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${laneCount}, minmax(96px, 1fr))`, minWidth: laneCount * 96 }}>
        {emps.map(e => (
          <EmployeeLane key={e.id} emp={e} areaId={area.id} pxPerHour={pxPerHour} dimmed={dimmed}
            onLaneClick={callbacks.onLaneClick}
            onTaskClick={callbacks.onTaskClick}
            onTaskDrop={callbacks.onTaskDrop}
            onTaskDragStart={callbacks.onTaskDragStart}
            draggingTaskId={draggingTaskId}
          />
        ))}
        {showUnassigned && (
          <UnassignedLane areaId={area.id} pxPerHour={pxPerHour} dimmed={dimmed}
            onLaneClick={callbacks.onLaneClick}
            onTaskClick={callbacks.onTaskClick}
            onTaskDrop={callbacks.onTaskDrop}
            onTaskDragStart={callbacks.onTaskDragStart}
          />
        )}
        {/* Deviation pins on the first lane edge */}
        {devs.map(d => (
          <div key={d.id} className={`avvik-pin ${d.status === 'resolved' ? 'resolved' : ''}`}
            style={{ top: window.hmToMin(d.time) * pxPerHour / 60 - 12 }}
            title={d.title}
            onClick={(e) => { e.stopPropagation(); callbacks.onDeviationClick && callbacks.onDeviationClick(d); }}
          >
            <Icon name="alert-circle" size={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Whole chart ─────────────────────────────────────────────
function TimelineChart({ pxPerHour, filters, callbacks, showRoutine, showPastDim, showNow, showNotes, draggingTaskId }) {
  const scrollRef = useRef(null);

  // Compute lane bands from filters.view ----
  const { bands, mode } = useMemo(() => {
    if (filters.view === 'person') {
      // Per-employee columns. Group inside area bands for organization.
      const filteredAreas = filters.areas.size === 0
        ? AREAS
        : AREAS.filter(a => filters.areas.has(a.id));
      const bands = filteredAreas.map(a => ({
        ...a,
        emps: EMPLOYEES.filter(e => e.area === a.id),
      }));
      return { bands, mode: 'person' };
    }
    if (filters.view === 'role') {
      // One band per role
      return {
        bands: ROLES.map(r => ({ id: r.id, name: r.label, label: r.label, areaId: r.area, color: r.color })),
        mode: 'role',
      };
    }
    // default: 'area' — one band per area
    const filteredAreas = filters.areas.size === 0
      ? AREAS
      : AREAS.filter(a => filters.areas.has(a.id));
    return { bands: filteredAreas, mode: 'area' };
  }, [filters.view, filters.areas]);

  // routineByHour no longer needed — phase labels live inside the routine bands now
  const _unused = null;

  // Auto-scroll to "now" on mount (delayed so layout settles)
  useEffect(() => {
    const id = setTimeout(() => {
      if (!scrollRef.current) return;
      const top = OUTLET.nowMinutes * pxPerHour / 60 - 240;
      scrollRef.current.scrollTop = Math.max(0, top);
    }, 80);
    return () => clearTimeout(id);
  }, []);

  const scrollToNow = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: Math.max(0, OUTLET.nowMinutes * pxPerHour / 60 - 240), behavior: 'smooth' });
  }, [pxPerHour]);
  callbacks._registerScrollToNow && callbacks._registerScrollToNow(scrollToNow);

  return (
    <div className="chart-wrap" ref={scrollRef}>
      <div className="chart" style={{ display: 'flex', minWidth: '100%' }}>
        <TimeGutter pxPerHour={pxPerHour} showHalf={pxPerHour >= 60} />
        <div className="lanes" style={{ flex: 1, display: 'flex', position: 'relative', minWidth: 'fit-content' }}>
          {/* Background routine strips (full width across all areas) */}
          {showRoutine && (
            <div style={{ position: 'absolute', top: 110, left: 0, right: 0, height: pxPerHour * 20, zIndex: 0 }}>
              <RoutineStrips pxPerHour={pxPerHour} />
            </div>
          )}
          {bands.map(band => (
            mode === 'person'
              ? <AreaBand
                  key={band.id}
                  area={band}
                  pxPerHour={pxPerHour}
                  employees={band.emps}
                  filters={filters}
                  callbacks={callbacks}
                  draggingTaskId={draggingTaskId}
                />
              : <SingleLaneBand
                  key={band.id}
                  band={band}
                  pxPerHour={pxPerHour}
                  mode={mode}
                  callbacks={callbacks}
                />
          ))}
          {/* Past dim — spans across all areas below the header row */}
          {showPastDim && (
            <div style={{ position: 'absolute', top: 110, left: 0, right: 0, height: pxPerHour * 20, pointerEvents: 'none', zIndex: 1 }}>
              <PastDim pxPerHour={pxPerHour} nowMinutes={OUTLET.nowMinutes} />
            </div>
          )}
          {/* Now line — spans across all areas */}
          {showNow && (
            <div style={{ position: 'absolute', top: 110, left: 0, right: 0, height: pxPerHour * 20, pointerEvents: 'none', zIndex: 6 }}>
              <NowLine pxPerHour={pxPerHour} nowMinutes={OUTLET.nowMinutes} />
            </div>
          )}
          {/* Notes track (broadcast pins) in left edge of lanes */}
          {showNotes && (
            <div className="notes-track" style={{ top: 110, height: pxPerHour * 20, left: 6, right: 'auto' }}>
              {NOTES.map(n => (
                <div key={n.id} className="note-pin"
                  style={{ top: window.hmToMin(n.time) * pxPerHour / 60 - 11 }}
                  title={`${n.time} · ${n.scope} — ${n.text}`}
                  onClick={() => callbacks.onNoteClick && callbacks.onNoteClick(n)}
                >
                  <Icon name="message-circle" size={11} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TimelineChart, areaOklch, areaColorVar });
})();
