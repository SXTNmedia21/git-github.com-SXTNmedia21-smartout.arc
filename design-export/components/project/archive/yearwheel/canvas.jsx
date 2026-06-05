// Year Wheel — Canvas component (linear timeline)
// Renders months, "NORMAL DRIFT" watermark, blocks (seasons), pins (events)
// Supports draw-to-create via mouse drag on empty canvas

const YW_MONTHS = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];

// Date helpers — use UTC to avoid timezone off-by-ones
const yw_parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const yw_dayOfYear = (d) => {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86400000);
};
const yw_daysInYear = (y) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
const yw_xForDate = (dateStr, year, width) => {
  const d = yw_parseDate(dateStr);
  return (yw_dayOfYear(d) / yw_daysInYear(year)) * width;
};
const yw_fmtKr = (n) => new Intl.NumberFormat('nb-NO').format(Math.round(n));
const yw_fmtDate = (s) => {
  const d = yw_parseDate(s);
  const months = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
  return `${d.getUTCDate()}. ${months[d.getUTCMonth()]}`;
};

// Simple overlap-lane assignment for seasons
function yw_assignLanes(seasons) {
  const sorted = [...seasons].sort((a, b) => a.start.localeCompare(b.start));
  const lanes = []; // array of end-date per lane
  return sorted.map(s => {
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] < s.start) { lanes[i] = s.end; return { ...s, lane: i }; }
    }
    lanes.push(s.end);
    return { ...s, lane: lanes.length - 1 };
  });
}

// ─── YearCanvas ─────────────────────────────────────────
function YearCanvas({ year = 2026, seasons, events, selectedId, onSelectSeason, onSelectEvent, today, style = 'linear', showNormal = true, onDrawCreate }) {
  const wrapRef = React.useRef(null);
  const [width, setWidth] = React.useState(1200);
  const [hover, setHover] = React.useState(null); // {x, date}
  const [draw, setDraw] = React.useState(null); // {startX, currentX, laneY}
  const [hoverEvent, setHoverEvent] = React.useState(null);

  React.useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const laned = yw_assignLanes(seasons);
  const laneCount = Math.max(1, Math.max(...laned.map(s => s.lane + 1)));
  const laneH = 44;
  const pinsY = 28;
  const monthY = 0;
  const blocksStartY = pinsY + 32;
  const canvasH = blocksStartY + laneCount * laneH + 24;
  const totalDays = yw_daysInYear(year);
  const todayDate = today || `${year}-04-19`;
  const todayX = yw_xForDate(todayDate, year, width);

  const xToDate = (x) => {
    const dayIdx = Math.max(0, Math.min(totalDays - 1, Math.round((x / width) * totalDays)));
    const d = new Date(Date.UTC(year, 0, 1 + dayIdx));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  };

  // Mouse handlers for draw-to-create
  const onMouseDown = (e) => {
    if (e.target.closest('.yw-block') || e.target.closest('.yw-pin')) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // only start drawing if below the pins row
    if (y < blocksStartY - 8) return;
    const lane = Math.max(0, Math.min(laneCount, Math.floor((y - blocksStartY) / laneH)));
    setDraw({ startX: x, currentX: x, lane });
  };
  const onMouseMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHover({ x, y, date: xToDate(x) });
    if (draw) setDraw({ ...draw, currentX: x });
  };
  const onMouseUp = () => {
    if (draw && Math.abs(draw.currentX - draw.startX) > 12) {
      const a = Math.min(draw.startX, draw.currentX);
      const b = Math.max(draw.startX, draw.currentX);
      onDrawCreate && onDrawCreate({ start: xToDate(a), end: xToDate(b) });
    }
    setDraw(null);
  };
  const onMouseLeave = () => { setHover(null); setDraw(null); setHoverEvent(null); };

  // Month boundaries (for vertical guides)
  const monthXs = React.useMemo(() => {
    const xs = [];
    for (let m = 0; m < 12; m++) {
      const dayIdx = yw_dayOfYear(new Date(Date.UTC(year, m, 1)));
      xs.push({ x: (dayIdx / totalDays) * width, label: YW_MONTHS[m] });
    }
    return xs;
  }, [year, width, totalDays]);

  // Group pins by proximity to avoid overlap
  const pinsWithX = events.map(e => ({ ...e, x: yw_xForDate(e.date, year, width), xEnd: e.end ? yw_xForDate(e.end, year, width) : null }));

  return (
    <div
      ref={wrapRef}
      className={`yw-canvas yw-canvas-${style}`}
      style={{
        position: 'relative',
        width: '100%',
        height: canvasH,
        minHeight: canvasH,
        flexShrink: 0,
        background: 'var(--card)',
        borderRadius: 'var(--r-card)',
        border: '1px solid var(--border)',
        cursor: draw ? 'ew-resize' : 'crosshair',
        userSelect: 'none',
        overflow: 'hidden',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* NORMAL DRIFT watermark */}
      {showNormal && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 14px, color-mix(in oklab, var(--muted) 6%, transparent) 14px 15px)',
          pointerEvents: 'none',
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 80px, #000 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 80px, #000 100%)',
        }} />
      )}
      {showNormal && (
        <div style={{
          position: 'absolute',
          top: blocksStartY + laneCount * laneH / 2 - 12,
          left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-heading)',
          fontStyle: 'italic', letterSpacing: '0.12em',
          color: 'color-mix(in oklab, var(--muted) 40%, transparent)',
          fontSize: 22, pointerEvents: 'none',
          textTransform: 'uppercase',
        }}>Normal drift</div>
      )}

      {/* Month labels + guides */}
      {monthXs.map((m, i) => (
        <React.Fragment key={i}>
          <div style={{
            position: 'absolute', left: m.x, top: 0,
            width: 1, height: canvasH,
            background: i === 0 ? 'transparent' : 'color-mix(in oklab, var(--border) 70%, transparent)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', left: m.x + 8, top: 6,
            fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--muted)', pointerEvents: 'none',
          }}>{m.label}</div>
        </React.Fragment>
      ))}

      {/* Today marker */}
      <div style={{
        position: 'absolute', left: todayX, top: pinsY - 4, bottom: 6,
        width: 0, borderLeft: '1.5px solid color-mix(in oklab, var(--fg) 70%, transparent)',
        pointerEvents: 'none',
        zIndex: 3,
      }} />
      <div style={{
        position: 'absolute', left: todayX - 10, top: pinsY - 14,
        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'var(--fg)',
        background: 'var(--card)', padding: '1px 6px', borderRadius: 4,
        border: '1px solid var(--border)',
        pointerEvents: 'none',
        textTransform: 'uppercase',
      }}>I dag</div>

      {/* Pins (events) row */}
      {pinsWithX.map(e => {
        const isRange = e.xEnd != null;
        const catColor = { internal: 'var(--muted)', cultural_commercial: 'var(--orange)', business_critical: 'var(--error)' }[e.cat];
        if (isRange) {
          const w = Math.max(12, e.xEnd - e.x);
          return (
            <div
              key={e.id}
              className="yw-pin"
              onClick={(ev) => { ev.stopPropagation(); onSelectEvent && onSelectEvent(e.id); }}
              onMouseEnter={() => setHoverEvent(e)}
              onMouseLeave={() => setHoverEvent(null)}
              style={{
                position: 'absolute', left: e.x, top: pinsY - 5,
                width: w, height: 10, borderRadius: 5,
                background: `color-mix(in oklab, ${catColor} 80%, var(--card))`,
                border: `1px solid ${catColor}`,
                cursor: 'pointer', zIndex: 4,
              }}
            />
          );
        }
        return (
          <div
            key={e.id}
            className="yw-pin"
            onClick={(ev) => { ev.stopPropagation(); onSelectEvent && onSelectEvent(e.id); }}
            onMouseEnter={() => setHoverEvent(e)}
            onMouseLeave={() => setHoverEvent(null)}
            style={{
              position: 'absolute', left: e.x - 6, top: pinsY - 6,
              width: 12, height: 12, borderRadius: '50%',
              background: catColor,
              border: e.ring ? `3px solid color-mix(in oklab, ${catColor} 30%, transparent)` : '1.5px solid var(--card)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              cursor: 'pointer', zIndex: 4,
              transition: 'transform 150ms',
              ...(e.ai ? { borderStyle: 'dashed', borderWidth: 2, background: `color-mix(in oklab, ${catColor} 40%, var(--card))` } : {}),
            }}
          >
            {e.hoursOverride && (
              <div style={{
                position: 'absolute', left: 12, top: -1,
                fontSize: 9, color: catColor,
              }}>◷</div>
            )}
          </div>
        );
      })}

      {/* Pin hover popover */}
      {hoverEvent && (
        <div style={{
          position: 'absolute',
          left: Math.min(width - 220, Math.max(8, hoverEvent.x - 100)),
          top: pinsY + 14,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '8px 12px',
          boxShadow: 'var(--shadow-md)',
          zIndex: 10, pointerEvents: 'none',
          minWidth: 180,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{hoverEvent.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {yw_fmtDate(hoverEvent.date)}{hoverEvent.end ? ` – ${yw_fmtDate(hoverEvent.end)}` : ''} · ×{hoverEvent.mult}
            {hoverEvent.ai && <span style={{ color: 'var(--warning)', marginLeft: 6 }}>AI {Math.round(hoverEvent.confidence * 100)}%</span>}
          </div>
        </div>
      )}

      {/* Blocks (seasons) */}
      {laned.map(s => {
        const x = yw_xForDate(s.start, year, width);
        const xEnd = yw_xForDate(s.end, year, width);
        const w = Math.max(20, xEnd - x);
        const y = blocksStartY + s.lane * laneH + 4;
        const h = laneH - 8;
        const isActive = s.status === 'active';
        const isDraft = s.status === 'draft';
        const isArchived = s.status === 'archived';
        const baseColor = s.color;
        const bg = isActive ? baseColor
          : isArchived ? `color-mix(in oklab, ${baseColor} 25%, var(--secondary))`
          : `color-mix(in oklab, ${baseColor} 12%, var(--card))`;
        const fg = isActive ? '#fff'
          : isArchived ? 'color-mix(in oklab, var(--muted) 85%, var(--fg))'
          : 'color-mix(in oklab, ' + baseColor + ' 100%, var(--fg))';
        const borderColor = isDraft ? baseColor : 'transparent';
        const isSelected = selectedId === s.id;
        return (
          <div
            key={s.id}
            className="yw-block"
            onClick={(e) => { e.stopPropagation(); onSelectSeason(s.id); }}
            style={{
              position: 'absolute', left: x, top: y, width: w, height: h,
              background: bg, color: fg,
              borderRadius: 10,
              border: isDraft ? `1.5px dashed ${borderColor}` : isSelected ? `2px solid var(--fg)` : '1px solid transparent',
              boxShadow: isActive ? '0 2px 8px color-mix(in oklab, ' + baseColor + ' 25%, transparent)' : 'none',
              display: 'flex', alignItems: 'center',
              padding: '0 12px', gap: 8,
              cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              zIndex: isSelected ? 3 : 2,
              transition: 'transform 150ms, box-shadow 200ms',
            }}
          >
            {isActive && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: '#fff', flexShrink: 0,
                boxShadow: '0 0 0 3px rgba(255,255,255,0.25)',
              }} />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
            {s.missing && s.missing.length > 0 && (
              <span style={{
                marginLeft: 'auto', flexShrink: 0,
                fontSize: 10, fontFamily: 'var(--font-mono)',
                padding: '1px 5px', borderRadius: 4,
                background: 'color-mix(in oklab, var(--warning) 20%, transparent)',
                color: 'var(--warning)',
              }}>{s.missing.length} gap</span>
            )}
            {/* edge handles */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
          </div>
        );
      })}

      {/* Draw phantom */}
      {draw && (
        <div style={{
          position: 'absolute',
          left: Math.min(draw.startX, draw.currentX),
          top: blocksStartY + draw.lane * laneH + 4,
          width: Math.abs(draw.currentX - draw.startX),
          height: laneH - 8,
          background: 'color-mix(in oklab, var(--orange) 18%, transparent)',
          border: '1.5px dashed var(--orange)',
          borderRadius: 10, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--orange)', fontWeight: 600,
        }}>
          {xToDate(Math.min(draw.startX, draw.currentX))} → {xToDate(Math.max(draw.startX, draw.currentX))}
        </div>
      )}

      {/* Hover date tooltip */}
      {hover && !draw && (
        <div style={{
          position: 'absolute', left: hover.x + 10, top: blocksStartY - 22,
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: 'var(--muted)', pointerEvents: 'none',
        }}>{hover.date}</div>
      )}
    </div>
  );
}

window.YearCanvas = YearCanvas;
window.yw_fmtKr = yw_fmtKr;
window.yw_fmtDate = yw_fmtDate;
window.yw_parseDate = yw_parseDate;
