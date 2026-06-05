// Calendar screens — Week, Month, Day, Add sheet, Detail sheets.

// ─── Week view (the evolved screenshot) ──────────────────────────────────────
function WeekView({ filter, setFilter, selected, setSelected, onOpenItem, onSwitch }) {
  const month = CAL.MONTH;
  // Build the visible week (Mon May 4 → Sun May 10, matching screenshot)
  const week = [4,5,6,7,8,9,10].map(n => CAL.days[n - 1]);
  const day = CAL.dayStats(selected);

  // Filter
  const visible = (() => {
    if (filter === 'alt')       return day.all;
    if (filter === 'oppgaver')  return day.tasks;
    if (filter === 'vakter')    return day.shifts;
    if (filter === 'bookinger') return day.bookings;
    if (filter === 'avvik')     return day.tasks.filter(t => t.status === 'overdue');
    return day.all;
  })();

  // Counts on chips
  const counts = {
    alt: day.all.length,
    oppgaver: day.tasks.length,
    vakter: day.shifts.length,
    bookinger: day.bookings.length,
    avvik: day.tasks.filter(t => t.status === 'overdue').length,
  };

  // Tasks summary numbers
  const total = day.tasks.length;
  const done  = day.tasks.filter(t => t.status === 'done').length;
  const overdue = day.tasks.filter(t => t.status === 'overdue').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const overdueColor = overdue > 0 ? C.t.error : C.t.orange;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.t.bg, color: C.t.fg }}>
      <CalHeader title="Kalender" />

      {/* Month + view toggle */}
      <div style={{ padding: '6px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: C.t.serif, fontSize: 22, letterSpacing: '-0.01em' }}>{month}</div>
        <ViewToggle value="Uke" onChange={(v) => v === 'Måned' && onSwitch?.('month')} />
      </div>

      {/* Week strip */}
      <WeekStrip days={week} selected={selected} onSelect={setSelected} today={CAL.TODAY} />

      {/* Filter chips */}
      <FilterChips value={filter} onChange={setFilter} counts={counts} />

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 110px' }}>
        {/* Tasks summary card */}
        {(filter === 'alt' || filter === 'oppgaver') && total > 0 && (
          <div style={{
            background: C.t.surface, border: `1px solid ${C.t.border}`, borderRadius: 18,
            padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div>
              <div style={{ fontFamily: C.t.serif, fontSize: 26, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                {total} {total === 1 ? 'oppgave' : 'oppgaver'}
              </div>
              <div style={{ fontSize: 12.5, color: C.t.muted, marginTop: 4 }}>
                {done} fullført · {total - done} gjenstår {overdue > 0 && <span style={{ color: C.t.error, fontWeight: 600 }}> · {overdue} avvik</span>}
              </div>
            </div>
            <ProgressRing pct={pct} color={overdueColor} />
          </div>
        )}

        {/* Shift block (if exists today and filter shows shifts) */}
        {(filter === 'alt' || filter === 'vakter') && day.shifts.length > 0 && (
          <ShiftCard shift={day.shifts[0]} onTap={() => onOpenItem?.(day.shifts[0])} />
        )}

        {/* List of items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.filter(i => i.type !== 'shift' || filter === 'vakter').map(it => (
            <ItemCard key={it.id} it={it} onTap={() => onOpenItem?.(it)} />
          ))}
          {visible.length === 0 && <EmptyDay />}
        </div>
      </div>

      <TabBar active="kalender" />
    </div>
  );
}

// ─── Month view ──────────────────────────────────────────────────────────────
function MonthView({ selected, setSelected, onSwitch, onOpenDay }) {
  // Mai 2026 — Mon-first grid. May 1 is Friday.
  // Leading blanks: 4 (Mon..Thu)
  // 31 days, then trailing to fill 6×7 = 42.
  const leading = 4;
  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= 31; d++) cells.push(CAL.days[d - 1]);
  while (cells.length % 7) cells.push(null);

  const dayShort = CAL.DAY_SHORT;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.t.bg, color: C.t.fg }}>
      <CalHeader title="Kalender" />

      <div style={{ padding: '6px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: C.t.serif, fontSize: 22, letterSpacing: '-0.01em' }}>{CAL.MONTH}</div>
        <ViewToggle value="Måned" onChange={(v) => v === 'Uke' && onSwitch?.('week')} />
      </div>

      {/* Day-of-week header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '4px 12px 8px',
      }}>
        {dayShort.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: 1.3,
            color: i >= 5 ? C.t.muted : C.t.muted,
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, padding: '0 12px 110px', overflow: 'auto',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(80px, auto)',
          gap: 4,
        }}>
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const stats = CAL.dayStats(c.date);
            const isSel = c.date === selected;
            const isToday = c.date === CAL.TODAY;
            const overdue = stats.tasks.some(t => t.status === 'overdue');
            const dotsByDept = Array.from(new Set(stats.all.map(x => x.dept))).slice(0, 4);
            return (
              <button key={i} onClick={() => { setSelected(c.date); onOpenDay?.(c.date); }} style={{
                display: 'flex', flexDirection: 'column', padding: 6,
                background: isSel ? C.t.orange : C.t.surface,
                border: `1px solid ${isSel ? C.t.orange : C.t.border}`,
                borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                color: isSel ? '#fff' : C.t.fg,
                overflow: 'hidden', minHeight: 78,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                  marginBottom: 4,
                }}>
                  <span style={{
                    fontFamily: C.t.serif, fontSize: 18, letterSpacing: '-0.01em',
                    opacity: c.isWeekend && !isSel ? .6 : 1,
                  }}>{c.date}</span>
                  {isToday && !isSel && (
                    <div style={{ width: 5, height: 5, borderRadius: 99, background: C.t.orange }} />
                  )}
                  {overdue && <div style={{ width: 5, height: 5, borderRadius: 99, background: isSel ? '#fff' : C.t.error }} />}
                </div>

                {/* Mini event blocks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                  {stats.shifts.slice(0, 1).map(s => {
                    const col = ({ kjokken: C.t.kjokken, sal: C.t.sal, bar: C.t.bar, event: C.t.event })[s.dept];
                    return (
                      <div key={s.id} style={{
                        background: isSel ? 'rgba(255,255,255,.18)' : `color-mix(in oklab, ${col} 24%, transparent)`,
                        color: isSel ? '#fff' : col,
                        fontSize: 9, fontWeight: 600, padding: '2px 4px', borderRadius: 4,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {(s.time || '').slice(0, 5)} {s.role || s.title}
                      </div>
                    );
                  })}
                  {stats.bookings.slice(0, 1).map(b => (
                    <div key={b.id} style={{
                      background: isSel ? 'rgba(255,255,255,.18)' : `color-mix(in oklab, ${C.t.info} 22%, transparent)`,
                      color: isSel ? '#fff' : C.t.info,
                      fontSize: 9, fontWeight: 600, padding: '2px 4px', borderRadius: 4,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      ◎ {b.guests || ''} {b.title.split(' ')[0]}
                    </div>
                  ))}
                  {stats.tasks.length > 0 && (
                    <div style={{
                      fontSize: 9, color: isSel ? 'rgba(255,255,255,.85)' : C.t.muted,
                      fontFamily: C.t.mono,
                    }}>
                      {stats.tasks.length} oppg.
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected day quick-view */}
        <SelectedDaySheet date={selected} />
      </div>

      <TabBar active="kalender" />
    </div>
  );
}

// ─── Day timeline view ───────────────────────────────────────────────────────
function DayView({ date = CAL.TODAY, onBack, onOpenItem }) {
  const stats = CAL.dayStats(date);
  const meta = CAL.days[date - 1];

  // Build timeline 8 → 24
  const hours = Array.from({ length: 17 }, (_, i) => 8 + i); // 8..24
  // Map items with explicit times to a row position
  const timed = stats.all
    .filter(i => i.time && /^\d/.test(i.time))
    .map(i => {
      const m = i.time.match(/^(\d{1,2}):(\d{2})/);
      const m2 = i.time.match(/(\d{1,2}):(\d{2})\s*$/);
      const startH = m ? parseInt(m[1]) + parseInt(m[2]) / 60 : 12;
      const endH = m2 && i.time.includes('–') ? parseInt(m2[1]) + parseInt(m2[2]) / 60 : startH + 0.5;
      return { it: i, startH, endH };
    });

  const ROW_H = 56; // px per hour
  const startBase = 8;

  const colorFor = (it) => {
    if (it.status === 'overdue') return C.t.error;
    if (it.type === 'shift') return ({ kjokken: C.t.kjokken, sal: C.t.sal, bar: C.t.bar, event: C.t.event })[it.dept] || C.t.orange;
    if (it.type === 'booking') return C.t.info;
    if (it.type === 'task') return C.t.warning;
    return C.t.muted;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.t.bg, color: C.t.fg }}>
      {/* Header with back */}
      <div style={{
        paddingTop: 56, padding: '56px 16px 12px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'relative',
      }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', color: C.t.fg, cursor: 'pointer',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.t.muted, fontWeight: 700 }}>{meta.dayLong.toUpperCase()}</div>
          <div style={{ fontFamily: C.t.serif, fontSize: 22, letterSpacing: '-0.01em' }}>{date}. mai</div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Day stats strip */}
      <div style={{
        padding: '10px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      }}>
        <DayStat label="Vakter" value={stats.shifts.length} unit={stats.shifts.reduce((s,x)=>s+(x.planned||0),0) + 't'} />
        <DayStat label="Oppgaver" value={stats.tasks.length} unit={`${stats.tasks.filter(t=>t.status==='done').length}/${stats.tasks.length}`} accent={stats.tasks.some(t=>t.status==='overdue') ? C.t.error : null} />
        <DayStat label="Bookinger" value={stats.bookings.reduce((s,b)=>s+(b.guests||0),0)} unit="gjester" />
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 0 110px' }}>
        <div style={{ position: 'relative', paddingLeft: 56, paddingRight: 16 }}>
          {hours.map(h => (
            <div key={h} style={{
              position: 'relative', height: ROW_H,
              borderTop: `1px solid ${C.t.border}`,
            }}>
              <div style={{
                position: 'absolute', left: -50, top: -8, fontSize: 11, color: C.t.muted,
                fontFamily: C.t.mono, width: 40, textAlign: 'right',
              }}>{String(h).padStart(2, '0')}:00</div>
            </div>
          ))}

          {/* "Now" line if today (May 4 18:16 from screenshot) */}
          {date === CAL.TODAY && (
            <div style={{
              position: 'absolute', left: 56, right: 16,
              top: (18.27 - startBase) * ROW_H,
              borderTop: `2px solid ${C.t.orange}`, zIndex: 4,
            }}>
              <div style={{
                position: 'absolute', left: -8, top: -5, width: 10, height: 10,
                borderRadius: 99, background: C.t.orange,
              }} />
              <div style={{
                position: 'absolute', right: -2, top: -22,
                fontSize: 9.5, fontFamily: C.t.mono, color: C.t.orange, fontWeight: 700,
                background: C.t.bg, padding: '0 4px',
              }}>NÅ · 18:16</div>
            </div>
          )}

          {/* Items */}
          {timed.map(({ it, startH, endH }, i) => {
            const top = (startH - startBase) * ROW_H + 2;
            const height = Math.max(34, (endH - startH) * ROW_H - 4);
            const col = colorFor(it);
            return (
              <button key={it.id} onClick={() => onOpenItem?.(it)} style={{
                position: 'absolute', left: 56 + (i % 2) * 6, right: 16,
                top, height,
                background: `color-mix(in oklab, ${col} 22%, ${C.t.bg})`,
                borderLeft: `3px solid ${col}`,
                borderRadius: 10, padding: '8px 12px',
                color: C.t.fg, textAlign: 'left', fontFamily: 'inherit',
                cursor: 'pointer', overflow: 'hidden', border: 'none',
                borderTopRightRadius: 10, borderBottomRightRadius: 10,
                zIndex: 3,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  color: it.status === 'overdue' ? C.t.error : C.t.fg,
                }}>
                  {it.title}
                </div>
                <div style={{
                  fontSize: 10.5, color: C.t.muted, fontFamily: C.t.mono,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {it.time}
                </div>
              </button>
            );
          })}
        </div>

        {/* All-day chip area */}
        {stats.notes.length > 0 && (
          <div style={{ padding: '14px 16px' }}>
            <SectionLabel>Notater</SectionLabel>
            {stats.notes.map(n => (
              <div key={n.id} style={{
                background: C.t.surface, border: `1px solid ${C.t.border}`, borderRadius: 12,
                padding: '12px 14px', fontSize: 13, color: C.t.fgSoft,
              }}>{n.title} — {n.sub}</div>
            ))}
          </div>
        )}
      </div>

      <TabBar active="kalender" />
    </div>
  );
}

// ─── Add (+) action sheet ────────────────────────────────────────────────────
function AddSheet({ onClose }) {
  const opts = [
    { k: 'shift', label: 'Vaktforespørsel', sub: 'Be om bytte eller registrer ekstra', color: C.t.orange,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> },
    { k: 'task', label: 'Ny oppgave', sub: 'Til deg eller skiftet', color: C.t.warning,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { k: 'booking', label: 'Booking', sub: 'Reserver bord eller selskap', color: C.t.info,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { k: 'deviation', label: 'Rapporter avvik', sub: 'Hygiene · sikkerhet · skade', color: C.t.error,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
    { k: 'note', label: 'Notat / påminnelse', sub: 'Privat · til deg selv', color: C.t.muted,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> },
  ];

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80,
      background: 'rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.t.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
        padding: '14px 16px 36px',
        boxShadow: '0 -10px 40px rgba(0,0,0,.4)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: C.t.border, margin: '0 auto 16px' }} />
        <div style={{ fontFamily: C.t.serif, fontSize: 22, letterSpacing: '-0.01em', padding: '0 4px 8px' }}>Ny oppføring</div>
        <div style={{ fontSize: 13, color: C.t.muted, padding: '0 4px 16px' }}>Hva vil du legge til på Mandag 4. mai?</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map(o => (
            <button key={o.k} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: C.t.surface, border: `1px solid ${C.t.border}`, borderRadius: 14,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `color-mix(in oklab, ${o.color} 16%, transparent)`,
                color: o.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{o.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{o.label}</div>
                <div style={{ fontSize: 12, color: C.t.muted, marginTop: 2 }}>{o.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t.muted} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Detail sheet (task / booking / shift) ───────────────────────────────────
function DetailSheet({ item, onClose, onComplete }) {
  if (!item) return null;
  const it = item;
  const isTask = it.type === 'task';
  const isBooking = it.type === 'booking';
  const isShift = it.type === 'shift';

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, background: C.t.bg, color: C.t.fg, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        paddingTop: 56, padding: '56px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.t.border}`,
      }}>
        <button onClick={onClose} style={{
          width: 32, height: 32, background: 'transparent', border: 'none', color: C.t.fg, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div style={{ fontSize: 12, letterSpacing: 1.4, fontWeight: 700, color: C.t.muted, textTransform: 'uppercase' }}>
          {isTask ? 'Oppgave' : isBooking ? 'Booking' : isShift ? 'Vakt' : 'Detalj'}
        </div>
        <button style={{
          width: 32, height: 32, background: 'transparent', border: 'none', color: C.t.muted, cursor: 'pointer',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px 130px' }}>
        {/* Severity badge for overdue */}
        {it.status === 'overdue' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 99,
            background: `color-mix(in oklab, ${C.t.error} 14%, transparent)`,
            color: C.t.error, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Avvik · krever handling
          </div>
        )}

        <div style={{ fontFamily: C.t.serif, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {it.title}
        </div>
        <div style={{ fontSize: 13.5, color: C.t.muted, marginTop: 6, lineHeight: 1.5 }}>
          {it.sub || it.desc}
        </div>

        {/* Meta strip */}
        <div style={{
          display: 'flex', gap: 14, padding: '18px 0 14px', marginTop: 14,
          borderTop: `1px solid ${C.t.border}`, borderBottom: `1px solid ${C.t.border}`,
        }}>
          <Meta label="Tid" value={it.time || 'Hele dagen'} mono />
          <Meta label="Avdeling" value={({ kjokken: 'Kjøkken', sal: 'Sal', bar: 'Bar', event: 'Event' })[it.dept]} />
          {it.role && <Meta label="Rolle" value={it.role} />}
          {it.guests && <Meta label="Gjester" value={it.guests} mono />}
        </div>

        {/* Type-specific details */}
        {isTask && it.evidence && (
          <div style={{ padding: '14px 0' }}>
            <SectionLabel>Bildebevis kreves</SectionLabel>
            <div style={{ padding: '0 0 0', display: 'flex', gap: 8 }}>
              {Array.from({ length: it.evidence.required }).map((_, i) => (
                <div key={i} style={{
                  flex: 1, aspectRatio: '1', borderRadius: 12,
                  background: i < it.evidence.taken ? C.t.surface2 : 'transparent',
                  border: `1.5px dashed ${i < it.evidence.taken ? C.t.success : C.t.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: i < it.evidence.taken ? C.t.success : C.t.muted,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: C.t.muted, marginTop: 10, fontFamily: C.t.mono }}>
              {it.evidence.taken}/{it.evidence.required} tatt
            </div>
          </div>
        )}

        {isBooking && (
          <>
            <div style={{ padding: '14px 0' }}>
              <SectionLabel>Kontakt</SectionLabel>
              <div style={{ background: C.t.surface, border: `1px solid ${C.t.border}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 99, background: C.t.surface2, color: C.t.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                  {(it.contact || '??').split(' ').map(s => s[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1, fontSize: 13.5 }}>{it.contact || '—'}</div>
                <button style={{ padding: '8px 12px', borderRadius: 10, background: C.t.surface2, border: `1px solid ${C.t.border}`, color: C.t.fg, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Ring</button>
              </div>
            </div>
            {it.tables && (
              <div style={{ padding: '8px 0' }}>
                <SectionLabel>Bord</SectionLabel>
                <div style={{ fontFamily: C.t.mono, fontSize: 14, color: C.t.fg }}>{it.tables}</div>
              </div>
            )}
            {it.notes && (
              <div style={{ padding: '14px 0' }}>
                <SectionLabel>Spesielt</SectionLabel>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: C.t.fgSoft }}>{it.notes}</div>
              </div>
            )}
          </>
        )}

        {isShift && it.coworkers && (
          <div style={{ padding: '14px 0' }}>
            <SectionLabel>Kolleger på vakt</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {it.coworkers.map((c, i) => (
                <div key={i} style={{ fontSize: 13.5, color: C.t.fgSoft, padding: '6px 0' }}>· {c}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action footer */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 16px 30px', display: 'flex', gap: 10,
        borderTop: `1px solid ${C.t.border}`,
        background: `color-mix(in oklab, ${C.t.bg} 90%, transparent)`,
        backdropFilter: 'blur(20px)',
      }}>
        <button style={{
          flex: 1, padding: '14px 0', borderRadius: 14,
          background: C.t.surface2, color: C.t.fg, fontWeight: 600,
          border: `1px solid ${C.t.border}`, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
        }}>Detaljer</button>
        <button onClick={onComplete} style={{
          flex: 2, padding: '14px 0', borderRadius: 14,
          background: it.status === 'overdue' ? C.t.error : C.t.orange, color: '#fff',
          fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
          boxShadow: `0 4px 14px color-mix(in oklab, ${it.status === 'overdue' ? C.t.error : C.t.orange} 40%, transparent)`,
        }}>
          {isTask ? 'Marker fullført' : isBooking ? 'Bekreft mottak' : 'Stempel inn'}
        </button>
      </div>
    </div>
  );
}

// ─── Atoms ───────────────────────────────────────────────────────────────────
function ProgressRing({ pct = 0, color = '#f97316', size = 56 }) {
  const r = (size - 6) / 2;
  const C2 = 2 * Math.PI * r;
  const off = C2 - (pct / 100) * C2;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={C.t.border} strokeWidth="4" fill="none"/>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={C2} strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color, fontFamily: C.t.mono,
      }}>{pct}%</div>
    </div>
  );
}

function ShiftCard({ shift, onTap }) {
  const dept = ({ kjokken: C.t.kjokken, sal: C.t.sal, bar: C.t.bar, event: C.t.event })[shift.dept] || C.t.orange;
  return (
    <button onClick={onTap} style={{
      width: '100%', padding: 0, marginBottom: 12,
      background: C.t.surface, border: `1px solid ${C.t.border}`,
      borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
      color: 'inherit', textAlign: 'left', overflow: 'hidden', display: 'block',
    }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 5, background: dept }} />
        <div style={{ flex: 1, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{shift.title}</div>
            {shift.isShiftLead && (
              <span style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: 1.3, padding: '3px 7px', borderRadius: 6,
                background: `color-mix(in oklab, ${C.t.orange} 16%, transparent)`, color: C.t.orange,
              }}>SKIFTLEDER</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.t.muted, fontFamily: C.t.mono, display: 'flex', gap: 8 }}>
            <span style={{ color: C.t.fgSoft }}>{shift.time}</span>
            <span style={{ opacity: .5 }}>·</span>
            <span>{shift.role || '—'}</span>
            {shift.zone && <><span style={{ opacity: .5 }}>·</span><span>{shift.zone}</span></>}
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyDay() {
  return (
    <div style={{
      padding: '48px 24px', textAlign: 'center', color: C.t.muted,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 99, margin: '0 auto 12px',
        background: C.t.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.t.muted,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      </div>
      <div style={{ fontSize: 14, color: C.t.fgSoft, fontWeight: 500 }}>Ingen oppføringer</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Trykk på <span style={{ color: C.t.orange, fontWeight: 600 }}>+</span> for å legge til.</div>
    </div>
  );
}

function DayStat({ label, value, unit, accent }) {
  return (
    <div style={{
      background: C.t.surface, border: `1px solid ${C.t.border}`, borderRadius: 14,
      padding: '12px 12px',
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.3, color: C.t.muted, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: C.t.mono, fontSize: 20, fontWeight: 700, marginTop: 4, color: accent || C.t.fg, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: C.t.muted, marginTop: 2 }}>{unit}</div>
    </div>
  );
}

function Meta({ label, value, mono }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.3, color: C.t.muted, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, marginTop: 4, fontFamily: mono ? C.t.mono : 'inherit', fontWeight: mono ? 600 : 500 }}>{value}</div>
    </div>
  );
}

// Used inside MonthView
function SelectedDaySheet({ date }) {
  const stats = CAL.dayStats(date);
  const meta = CAL.days[date - 1];
  return (
    <div style={{
      marginTop: 14, padding: '14px 14px 16px',
      background: C.t.surface, border: `1px solid ${C.t.border}`, borderRadius: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: C.t.muted, textTransform: 'uppercase' }}>{meta.dayLong}</div>
          <div style={{ fontFamily: C.t.serif, fontSize: 22, letterSpacing: '-0.01em' }}>{date}. mai</div>
        </div>
        <div style={{ fontSize: 11.5, color: C.t.muted, fontFamily: C.t.mono }}>
          {stats.shifts.length}V · {stats.tasks.length}O · {stats.bookings.length}B
        </div>
      </div>
      {stats.all.length === 0 ? (
        <div style={{ fontSize: 13, color: C.t.muted }}>Ingen oppføringer.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stats.all.slice(0, 3).map(it => (
            <div key={it.id} style={{ fontSize: 13, color: C.t.fgSoft, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: C.t.mono, fontSize: 11, color: C.t.muted, width: 60, flexShrink: 0 }}>{(it.time || '').slice(0,11) || '—'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
            </div>
          ))}
          {stats.all.length > 3 && (
            <div style={{ fontSize: 12, color: C.t.orange, fontWeight: 600, marginTop: 4 }}>+{stats.all.length - 3} flere</div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { WeekView, MonthView, DayView, AddSheet, DetailSheet, ProgressRing, ShiftCard, EmptyDay, DayStat });
