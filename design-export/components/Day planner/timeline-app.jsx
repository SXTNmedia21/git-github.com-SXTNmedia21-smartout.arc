// ──────────────────────────────────────────────────────────────
// Manager Timeline — top shell + interactions + tweaks
// ──────────────────────────────────────────────────────────────
(function() {
const { useState, useMemo, useRef, useEffect, useCallback } = React;
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "hourHeight": 90,
  "showRoutine": true,
  "showPastDim": true,
  "showNow": true,
  "showNotes": true,
  "compactDensity": false,
  "dark": false,
  "accentTreatment": "warm",
  "showHalfHour": true
}/*EDITMODE-END*/;

const { OUTLET: O, AREAS: AAS, EMPLOYEES: EMPS, TASKS: TTS, DEVIATIONS: DEVS, NOTES: NTS, TEMPLATES } = window.TimelineData;

// ────────────────────────── TOP BAR ─────────────────────────
function TopBar({ onApplyTemplate, onCloseDay, onBroadcast, savedCount }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="assets/smartout-icon.png" alt="" />
        <div className="brand-text">
          Dagslinjen
          <small>Sentralen</small>
        </div>
      </div>
      <div className="center-cluster">
        <div className="outlet-pill" title="Bytt eiendom">
          <span className="dot" />
          <span style={{ whiteSpace: 'nowrap' }}>Alle utesteder</span>
          <span style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', fontSize: 11, marginLeft: 2 }}>· 6</span>
          <Icon name="chevron-down" size={14} style={{ color: 'var(--muted-fg)', marginLeft: 2 }} />
        </div>
        <div className="date-stepper">
          <button title="Forrige dag"><Icon name="chevron-left" size={16} /></button>
          <span className="date-current">
            {O.date}
            <em>Uke {O.weekno}</em>
          </span>
          <button title="Neste dag"><Icon name="chevron-right" size={16} /></button>
        </div>
        <div style={{ flex: 1 }} />
      </div>
      <div className="right-cluster">
        <button className="icon-btn" title="Søk"><Icon name="search" size={18} /></button>
        <button className="icon-btn has-badge" title="Varsler">
          <Icon name="bell" size={18} />
          <span className="badge-dot" />
        </button>
        <button className="icon-btn" title="Send melding til team" onClick={onBroadcast}>
          <Icon name="mic" size={18} />
        </button>
        <div style={{ width: 10 }} />
        <button className="cta-close" onClick={onCloseDay}>
          <span>Lukk dagen</span>
          <span className="lbl-mono">→ AVV</span>
        </button>
        <div style={{ width: 4 }} />
        <div className="manager-pill" title="Sofia Lindqvist · Daglig leder">
          <Avatar name="Sofia Lindqvist" size={32} />
          <span>Sofia</span>
        </div>
      </div>
    </header>
  );
}

// ────────────────────────── TOOLBAR ─────────────────────────
function Toolbar({ filters, setFilters, pxPerHour, setPxPerHour, scrollToNow, onApplyTemplate, onDeviationsFilter }) {
  const areaChip = (area) => {
    const on = filters.areas.has(area.id);
    const accent = window.areaOklch(area.id);
    return (
      <button key={area.id} className={`chip ${on ? 'on' : ''}`}
        onClick={() => {
          const next = new Set(filters.areas);
          if (on) next.delete(area.id); else next.add(area.id);
          setFilters({ ...filters, areas: next });
        }}>
        <span className="dot" style={{ background: `oklch(${accent.l} ${accent.c} ${accent.h})` }} />
        {area.short}
      </button>
    );
  };
  return (
    <div className="toolbar">
      <div className="seg">
        <button className={filters.view === 'area' ? 'on' : ''} onClick={() => setFilters({ ...filters, view: 'area' })}>
          <Icon name="map-pin" size={14} /> Område
        </button>
        <button className={filters.view === 'role' ? 'on' : ''} onClick={() => setFilters({ ...filters, view: 'role' })}>
          <Icon name="shield" size={14} /> Rolle
        </button>
        <button className={filters.view === 'person' ? 'on' : ''} onClick={() => setFilters({ ...filters, view: 'person' })}>
          <Icon name="users" size={14} /> Person
        </button>
      </div>

      <div className="divider-v" />

      <div className="filter-chips">
        {AAS.map(areaChip)}
      </div>

      <div className="divider-v" />

      <button className={`chip ${filters.onlyOpen ? 'on' : ''}`} onClick={() => setFilters({ ...filters, onlyOpen: !filters.onlyOpen })}>
        <Icon name="eye" size={12} /> Kun åpne tasks
      </button>
      <button className={`chip ${filters.avvik ? 'on' : ''}`} onClick={() => onDeviationsFilter()}>
        <Icon name="alert-circle" size={12} /> Avvik
        <span style={{
          marginLeft: 2, padding: '0 5px', borderRadius: 9999,
          background: 'var(--destructive)', color: 'white',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        }}>{DEVS.filter(d => d.status === 'open').length}</span>
      </button>

      <div className="spacer" />

      <button className="chip" onClick={onApplyTemplate}>
        <Icon name="book-open" size={12} /> Bruk mal
      </button>

      <div className="zoom-cluster">
        <button onClick={() => setPxPerHour(Math.max(50, pxPerHour - 20))}><Icon name="chevron-down" size={12} /></button>
        <span className="val">{pxPerHour}px/t</span>
        <button onClick={() => setPxPerHour(Math.min(180, pxPerHour + 20))}><Icon name="chevron-up" size={12} /></button>
      </div>

      <button className="now-btn" onClick={scrollToNow}>
        <span className="pulse" />
        Akkurat nå · {window.minToHM(O.nowMinutes)}
      </button>
    </div>
  );
}

// ────────────────────────── RIGHT RAIL ──────────────────────
function RightRail({ tab, setTab, selectedTask, selectedSlot, onCloseSelection, onSaveTask, onDeleteTask, broadcastDraft, setBroadcastDraft, onSendBroadcast }) {
  return (
    <aside className="rail">
      <div className="rail-tabs">
        <button className={`rail-tab ${tab === 'now' ? 'on' : ''}`} onClick={() => setTab('now')}>
          <Icon name="clock" size={14} /> Akkurat nå
        </button>
        <button className={`rail-tab ${tab === 'detail' ? 'on' : ''}`} onClick={() => setTab('detail')} disabled={!selectedTask}>
          <Icon name="check-circle" size={14} /> Detalj
        </button>
        <button className={`rail-tab ${tab === 'broadcast' ? 'on' : ''}`} onClick={() => setTab('broadcast')}>
          <Icon name="mic" size={14} /> Melding
        </button>
        <button className={`rail-tab ${tab === 'avvik' ? 'on' : ''}`} onClick={() => setTab('avvik')}>
          <Icon name="alert-circle" size={14} /> Avvik
        </button>
      </div>
      <div className="rail-body">
        {tab === 'now' && <NowSnapshot />}
        {tab === 'detail' && selectedTask && <TaskDetail task={selectedTask} onSave={onSaveTask} onDelete={onDeleteTask} />}
        {tab === 'detail' && !selectedTask && <EmptyState icon="check-circle" title="Ingen oppgave valgt" sub="Klikk en oppgave i tidslinjen for å se detaljer."/>}
        {tab === 'broadcast' && <BroadcastComposer draft={broadcastDraft} setDraft={setBroadcastDraft} onSend={onSendBroadcast} />}
        {tab === 'avvik' && <DeviationsList />}
      </div>
    </aside>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted-fg)' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Icon name={icon} size={20} />
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function NowSnapshot() {
  const activeNow = TTS.filter(t => t.status === 'active');
  const upNext = TTS.filter(t => t.status === 'upcoming')
    .sort((a, b) => window.hmToMin(a.start) - window.hmToMin(b.start)).slice(0, 4);
  const openDevs = DEVS.filter(d => d.status === 'open');
  const onShift = EMPS.filter(e => {
    const s = window.hmToMin(e.shift[0]); const en = window.hmToMin(e.shift[1]);
    return s <= O.nowMinutes && O.nowMinutes <= en;
  });
  return (
    <>
      {/* KPI strip */}
      <div className="rail-section">
        <h4>Status</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <KpiBox label="På vakt" value={onShift.length} unit="pers" />
          <KpiBox label="Aktive oppgaver" value={activeNow.length} unit="nå" />
          <KpiBox label="Avvik åpne" value={openDevs.length} unit="" tone={openDevs.length > 0 ? 'warn' : 'ok'} />
          <KpiBox label="Tasks gjenstår" value={TTS.filter(t => t.status === 'upcoming').length} unit="" />
        </div>
      </div>

      {openDevs.length > 0 && (
        <div className="rail-section">
          <h4>Krever oppmerksomhet</h4>
          {openDevs.map(d => (
            <div key={d.id} className="rail-card" style={{ '--accent-c': 'var(--destructive)' }}>
              <div className="title">{d.title}</div>
              <div className="meta">{d.time} · {AAS.find(a => a.id === d.area)?.name}</div>
              <div className="row">
                <button className="chip"><Icon name="check" size={11} /> Bekreft</button>
                <button className="chip">Eskaler</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rail-section">
        <h4>Pågående</h4>
        {activeNow.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>Ingenting i aktiv status.</div>}
        {activeNow.map(t => {
          const emp = EMPS.find(e => e.id === t.emp);
          const area = AAS.find(a => a.id === t.area);
          return (
            <div key={t.id} className="rail-card" style={{ '--accent-c': 'var(--brand-orange)' }}>
              <div className="title">{t.title}</div>
              <div className="meta">{t.start}–{t.end} · {area?.name}</div>
              <div className="row">
                {emp && <><Avatar name={emp.name} size={20} /> <span>{emp.name}</span></>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rail-section">
        <h4>Neste</h4>
        {upNext.map(t => {
          const emp = EMPS.find(e => e.id === t.emp);
          const area = AAS.find(a => a.id === t.area);
          const accent = window.areaOklch(t.area);
          return (
            <div key={t.id} className="rail-card" style={{ '--accent-c': `oklch(${accent.l} ${accent.c} ${accent.h})` }}>
              <div className="title">{t.title}</div>
              <div className="meta">{t.start} · {area?.name}</div>
              <div className="row">
                {emp ? <><Avatar name={emp.name} size={20} /> <span>{emp.name}</span></> : <span>Ledig</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function KpiBox({ label, value, unit, tone }) {
  const color = tone === 'warn' ? 'var(--destructive)' : tone === 'ok' ? 'var(--success)' : 'var(--foreground)';
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--muted-fg)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
        <span className="t-kpi" style={{ color, fontSize: 26 }}>{value}</span>
        {unit && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>{unit}</span>}
      </div>
    </div>
  );
}

function TaskDetail({ task, onSave, onDelete }) {
  const area = AAS.find(a => a.id === task.area);
  const emp = EMPS.find(e => e.id === task.emp);
  const accent = window.areaOklch(task.area);
  const [editing, setEditing] = useState({ ...task });
  useEffect(() => setEditing({ ...task }), [task.id]);

  return (
    <>
      <div className="rail-section">
        <h4>Oppgave</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ background: `oklch(${accent.l} ${accent.c} ${accent.h} / 0.15)`, color: `oklch(${accent.l * 0.7} ${accent.c} ${accent.h})`, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 9999 }}>
            {area?.short}
          </span>
          <span style={{
            background: task.status === 'active' ? 'oklch(0.65 0.22 40 / 0.15)' : task.status === 'done' ? 'oklch(0.68 0.15 145 / 0.12)' : 'var(--muted)',
            color: task.status === 'active' ? 'var(--brand-orange-dark)' : task.status === 'done' ? 'oklch(0.45 0.15 145)' : 'var(--muted-fg)',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 9999,
          }}>{task.status === 'active' ? 'Aktiv' : task.status === 'done' ? 'Fullført' : task.status === 'upcoming' ? 'Planlagt' : task.status}</span>
        </div>
        <input style={{ width: '100%', fontSize: 18, fontFamily: 'var(--font-heading)', letterSpacing: '-0.01em', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--background)' }}
          value={editing.title}
          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
        />
      </div>
      <div className="rail-section">
        <h4>Tildeling</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {emp ? (
            <>
              <Avatar name={emp.name} size={32} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{emp.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{emp.role} · {area?.name}</div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>Ikke tildelt — dra inn en person eller velg under.</div>
          )}
        </div>
      </div>
      <div className="rail-section">
        <h4>Tid</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 600 }}>Start</label>
            <input style={{ width: '100%', fontFamily: 'var(--font-mono)', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--background)' }} value={editing.start} onChange={(e) => setEditing({ ...editing, start: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 600 }}>Slutt</label>
            <input style={{ width: '100%', fontFamily: 'var(--font-mono)', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--background)' }} value={editing.end} onChange={(e) => setEditing({ ...editing, end: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="rail-section">
        <h4>Prioritet</h4>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['low', 'normal', 'high', 'urgent'].map(p => (
            <button key={p} className={`chip ${editing.priority === p ? 'on' : ''}`} onClick={() => setEditing({ ...editing, priority: p })}>
              <span className="dot" style={{ background: `var(--priority-${p})` }} /> {p}
            </button>
          ))}
        </div>
      </div>
      {task.flagged && (
        <div className="rail-section">
          <h4>Knyttet avvik</h4>
          <div className="rail-card" style={{ '--accent-c': 'var(--destructive)' }}>
            <div className="title">Kjøletemp brudd · skap 3</div>
            <div className="meta">14:12 · åpen · varslet Mathias</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="default" size="md" onClick={() => onSave(editing)}>Lagre</Btn>
        <Btn variant="outline" size="md" onClick={() => onDelete(task.id)}>Slett</Btn>
      </div>
    </>
  );
}

function BroadcastComposer({ draft, setDraft, onSend }) {
  const targets = [
    { id: 'all', label: 'Alle på vakt', count: EMPS.length },
    { id: 'kitchen', label: 'Kjøkken', count: EMPS.filter(e => e.area === 'kitchen').length },
    { id: 'floor', label: 'Sal (Bistro + Spisesal)', count: EMPS.filter(e => ['bistro', 'spisesal'].includes(e.area)).length },
    { id: 'bar', label: 'Bar', count: EMPS.filter(e => e.area === 'bar').length },
    { id: 'event', label: 'Event Fjorden', count: EMPS.filter(e => e.area === 'event').length },
  ];
  return (
    <>
      <div className="rail-section">
        <h4>Send melding</h4>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 600, marginBottom: 6 }}>Mottakere</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {targets.map(t => (
              <button key={t.id} className={`chip ${draft.target === t.id ? 'on' : ''}`} onClick={() => setDraft({ ...draft, target: t.id })}>
                {t.label} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.7, marginLeft: 2 }}>·{t.count}</span>
              </button>
            ))}
          </div>
        </div>
        <textarea
          rows={5}
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          placeholder="Skriv meldingen din..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', resize: 'vertical', fontSize: 13, fontFamily: 'var(--font-body)', minHeight: 90 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="icon-btn" title="Tale-til-tekst"><Icon name="mic" size={16} /></button>
            <button className="icon-btn" title="Vedlegg"><Icon name="paperclip" size={16} /></button>
            <button className="icon-btn" title="Plan"><Icon name="calendar" size={16} /></button>
          </div>
          <Btn variant="default" size="md" icon="send" onClick={onSend}>Send</Btn>
        </div>
      </div>
      <div className="rail-section">
        <h4>I dag</h4>
        {NTS.map(n => (
          <div key={n.id} className="rail-card" style={{ '--accent-c': 'var(--brand-orange)' }}>
            <div className="title">{n.text}</div>
            <div className="meta">{n.time} · til {n.scope} · {n.from}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function DeviationsList() {
  return (
    <>
      <div className="rail-section">
        <h4>Avvik i dag</h4>
        {DEVS.map(d => {
          const area = AAS.find(a => a.id === d.area);
          return (
            <div key={d.id} className="rail-card" style={{ '--accent-c': d.status === 'resolved' ? 'var(--muted-fg)' : 'var(--destructive)' }}>
              <div className="title">{d.title}</div>
              <div className="meta">{d.time} · {area?.name} · {d.status === 'open' ? 'ÅPEN' : 'LØST'}</div>
              <div className="row">
                <Avatar name={EMPS.find(e => e.id === d.reporter)?.name || '?'} size={20} />
                <span>Rapportert av {EMPS.find(e => e.id === d.reporter)?.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ────────────────────────── POPOVER & MODALS ────────────────
function QuickAddPopover({ slot, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [priority, setPriority] = useState('normal');
  const accent = window.areaOklch(slot.areaId);
  const start = window.minToHM(slot.minutes);
  const end = window.minToHM(slot.minutes + duration);
  const area = AAS.find(a => a.id === slot.areaId);
  const emp = slot.empId ? EMPS.find(e => e.id === slot.empId) : null;

  // Anchor at click coordinate (clamp to viewport)
  const popX = Math.min(slot.pageX, window.innerWidth - 340);
  const popY = Math.min(slot.pageY, window.innerHeight - 340);

  return (
    <div className="popover" style={{ left: popX, top: popY }} onClick={(e) => e.stopPropagation()}>
      <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-fg)', borderRadius: 6 }}>
        <Icon name="x" size={14} />
      </button>
      <h5>Ny oppgave <em>{start}</em></h5>
      <div style={{ fontSize: 11, color: 'var(--muted-fg)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ background: `oklch(${accent.l} ${accent.c} ${accent.h} / 0.16)`, color: `oklch(${accent.l * 0.7} ${accent.c} ${accent.h})`, fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 9999 }}>{area?.short}</span>
        {emp ? <><Avatar name={emp.name} size={18} /> {emp.name}</> : <span>Ikke tildelt</span>}
      </div>
      <div className="field">
        <label>Hva skal gjøres?</label>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="F.eks. Prep middag — pasta" />
      </div>
      <div className="field">
        <label>Varighet</label>
        <div className="swatches">
          {[15, 30, 45, 60, 90].map(d => (
            <button key={d} className={`swatch ${duration === d ? 'on' : ''}`} onClick={() => setDuration(d)}>{d} min</button>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)', marginTop: 6 }}>
          {start} → {end}
        </div>
      </div>
      <div className="field">
        <label>Prioritet</label>
        <div className="swatches">
          {['low', 'normal', 'high', 'urgent'].map(p => (
            <button key={p} className={`swatch ${priority === p ? 'on' : ''}`} onClick={() => setPriority(p)}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--priority-${p})` }} />
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="pop-actions">
        <Btn variant="outline" size="sm" onClick={onClose}>Avbryt</Btn>
        <Btn variant="default" size="sm" icon="plus" onClick={() => { onCreate({ title: title || 'Ny oppgave', areaId: slot.areaId, empId: slot.empId, start, end, priority }); onClose(); }}>
          Opprett
        </Btn>
      </div>
    </div>
  );
}

function ApplyTemplateModal({ onClose, onApply }) {
  const [selectedId, setSelectedId] = useState(TEMPLATES[0].id);
  const [areaId, setAreaId] = useState('bistro');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3>Bruk dagsmal</h3>
            <div style={{ fontSize: 12, color: 'var(--muted-fg)', marginTop: 4 }}>Maler legger på tasks i ett område. Eksisterende oppgaver beholdes.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>
        <div className="body">
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 600, marginBottom: 8 }}>Område</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {AAS.map(a => (
                <button key={a.id} className={`chip ${areaId === a.id ? 'on' : ''}`} onClick={() => setAreaId(a.id)}>{a.name}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 600, marginBottom: 8 }}>Velg mal</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setSelectedId(t.id)} style={{
                  textAlign: 'left',
                  background: selectedId === t.id ? 'oklch(0.65 0.22 40 / 0.06)' : 'var(--card)',
                  border: `1.5px solid ${selectedId === t.id ? 'var(--brand-orange)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <Radio on={selectedId === t.id} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-fg)' }}>{t.tasks} oppgaver · brukt {t.used} ganger</div>
                  </div>
                  <Icon name="chevron-right" size={16} style={{ color: 'var(--muted-fg)' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <footer>
          <Btn variant="outline" size="md" onClick={onClose}>Avbryt</Btn>
          <Btn variant="default" size="md" onClick={() => { onApply(selectedId, areaId); onClose(); }}>Bruk mal</Btn>
        </footer>
      </div>
    </div>
  );
}

function CloseDayModal({ onClose, onConfirm }) {
  const remaining = TTS.filter(t => t.status === 'upcoming').length;
  const open = DEVS.filter(d => d.status === 'open').length;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Lukk dagen?</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>
        <div className="body">
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--muted-fg)', marginTop: 0 }}>
            Dagen overføres til <strong style={{ color: 'var(--foreground)' }}>venter på oppgjør</strong>. Vakt-app vil vise banner. Administrator må godkjenne for å fullføre.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 600 }}>Uferdige tasks</div>
              <div className="t-kpi" style={{ fontSize: 28, color: remaining > 0 ? 'var(--warning)' : 'var(--success)' }}>{remaining}</div>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 600 }}>Åpne avvik</div>
              <div className="t-kpi" style={{ fontSize: 28, color: open > 0 ? 'var(--destructive)' : 'var(--success)' }}>{open}</div>
            </div>
          </div>
          {(remaining > 0 || open > 0) && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'oklch(0.95 0.06 75 / 0.4)', border: '1px solid oklch(0.75 0.15 75 / 0.4)', borderRadius: 10, fontSize: 12, color: 'oklch(0.4 0.1 75)' }}>
              <Icon name="alert-circle" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
              Lukker du nå må gjenstående tasks og åpne avvik begrunnes for godkjenning.
            </div>
          )}
        </div>
        <footer>
          <Btn variant="outline" size="md" onClick={onClose}>Ikke ennå</Btn>
          <Btn variant="default" size="md" onClick={onConfirm}>Lukk og send til oppgjør</Btn>
        </footer>
      </div>
    </div>
  );
}

function EditHoursModal({ area, onClose, onSave }) {
  const [open, setOpen] = useState(area.open);
  const [close, setClose] = useState(area.close);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3>{area.name}</h3>
            <div style={{ fontSize: 12, color: 'var(--muted-fg)', marginTop: 4 }}>Endre åpningstider i dag</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>
        <div className="body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 600, marginBottom: 6 }}>Åpner</label>
              <input value={open} onChange={(e) => setOpen(e.target.value)} style={{ width: '100%', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 22, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', textAlign: 'center', letterSpacing: '0.04em' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-fg)', fontWeight: 600, marginBottom: 6 }}>Stenger</label>
              <input value={close} onChange={(e) => setClose(e.target.value)} style={{ width: '100%', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 22, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', textAlign: 'center', letterSpacing: '0.04em' }} />
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted-fg)' }}>
            <Icon name="calendar" size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            Endringen gjelder bare i dag · {O.shortDate}. Endre fast åpningstid i Innstillinger.
          </div>
        </div>
        <footer>
          <Btn variant="outline" size="md" onClick={onClose}>Avbryt</Btn>
          <Btn variant="default" size="md" onClick={() => { onSave({ open, close }); onClose(); }}>Lagre</Btn>
        </footer>
      </div>
    </div>
  );
}

// ────────────────────────── APP ─────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [pxPerHour, setPxPerHour] = useState(t.hourHeight);
  useEffect(() => setPxPerHour(t.hourHeight), [t.hourHeight]);

  const [filters, setFilters] = useState({
    view: 'area',
    areas: new Set(),
    onlyOpen: false,
    avvik: false,
  });

  const [tab, setTab] = useState('now');
  const [selectedTask, setSelectedTask] = useState(null);
  const [popoverSlot, setPopoverSlot] = useState(null);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [editingArea, setEditingArea] = useState(null);
  const [draggingTask, setDraggingTask] = useState(null);
  const [broadcastDraft, setBroadcastDraft] = useState({ target: 'kitchen', text: '' });

  const scrollToNowRef = useRef(null);

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const callbacks = useMemo(() => ({
    onTaskClick: (task) => { setSelectedTask(task); setTab('detail'); },
    onLaneClick: (slot) => { setPopoverSlot(slot); },
    onTaskDrop: ({ empId, areaId, minutes }) => {
      if (!draggingTask) return;
      // Update the task in TASKS (mutating mock data is fine for prototype)
      const t = TTS.find(x => x.id === draggingTask.id);
      if (!t) return;
      const dur = window.hmToMin(t.end) - window.hmToMin(t.start);
      const snapped = Math.round(minutes / 15) * 15;
      t.start = window.minToHM(snapped);
      t.end = window.minToHM(snapped + dur);
      t.emp = empId;
      t.area = areaId;
      setDraggingTask(null);
      showToast(`Flyttet «${t.title}» til ${t.start}`);
    },
    onTaskDragStart: (e, task) => {
      setDraggingTask(task);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
      // Create a tiny custom drag image
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = task.title;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 10, 10);
      setTimeout(() => document.body.removeChild(ghost), 0);
    },
    onEditHours: (area) => { setEditingArea(area); setModal('hours'); },
    onDeviationClick: (d) => { setTab('avvik'); },
    onNoteClick: (n) => { setTab('broadcast'); setBroadcastDraft({ target: 'kitchen', text: '' }); showToast(`Melding ${n.time}: ${n.scope}`); },
    _registerScrollToNow: (fn) => { scrollToNowRef.current = fn; },
  }), [draggingTask, showToast]);

  return (
    <div className={`app ${t.dark ? 'dark' : ''}`}>
      <TopBar
        onApplyTemplate={() => setModal('template')}
        onCloseDay={() => setModal('close')}
        onBroadcast={() => setTab('broadcast')}
      />
      <Toolbar
        filters={filters} setFilters={setFilters}
        pxPerHour={pxPerHour} setPxPerHour={(v) => { setPxPerHour(v); setTweak('hourHeight', v); }}
        scrollToNow={() => scrollToNowRef.current && scrollToNowRef.current()}
        onApplyTemplate={() => setModal('template')}
        onDeviationsFilter={() => { setFilters(f => ({ ...f, avvik: !f.avvik })); setTab('avvik'); }}
      />
      <div className="main">
        <TimelineChart
          pxPerHour={pxPerHour}
          filters={filters}
          callbacks={callbacks}
          showRoutine={t.showRoutine}
          showPastDim={t.showPastDim}
          showNow={t.showNow}
          showNotes={t.showNotes}
          draggingTaskId={draggingTask?.id}
        />
        <RightRail
          tab={tab} setTab={setTab}
          selectedTask={selectedTask}
          onCloseSelection={() => setSelectedTask(null)}
          onSaveTask={(edited) => {
            const t = TTS.find(x => x.id === edited.id);
            if (t) Object.assign(t, edited);
            showToast(`Lagret «${edited.title}»`);
          }}
          onDeleteTask={(id) => {
            const idx = TTS.findIndex(x => x.id === id);
            if (idx >= 0) TTS.splice(idx, 1);
            setSelectedTask(null); setTab('now');
            showToast(`Slettet oppgave`);
          }}
          broadcastDraft={broadcastDraft} setBroadcastDraft={setBroadcastDraft}
          onSendBroadcast={() => {
            const targetLabel = { all: 'alle', kitchen: 'kjøkken', floor: 'sal', bar: 'bar', event: 'event' }[broadcastDraft.target] || 'team';
            showToast(`Melding sendt til ${targetLabel}`);
            setBroadcastDraft({ target: broadcastDraft.target, text: '' });
          }}
        />
      </div>

      {popoverSlot && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setPopoverSlot(null)} />
          <QuickAddPopover
            slot={popoverSlot}
            onClose={() => setPopoverSlot(null)}
            onCreate={(t) => {
              const id = 'tnew' + Math.random().toString(36).slice(2,7);
              TTS.push({
                id, area: t.areaId, emp: t.empId, title: t.title,
                start: t.start, end: t.end, status: 'upcoming', priority: t.priority,
              });
              showToast(`La til «${t.title}» ${t.start}`);
            }}
          />
        </>
      )}

      {modal === 'template' && <ApplyTemplateModal onClose={() => setModal(null)} onApply={(tplId, areaId) => {
        const tpl = TEMPLATES.find(x => x.id === tplId);
        showToast(`Mal «${tpl.name}» lagt på ${AAS.find(a => a.id === areaId).name}`);
      }} />}

      {modal === 'close' && <CloseDayModal onClose={() => setModal(null)} onConfirm={() => { setModal(null); showToast('Dag sendt til oppgjør'); }} />}

      {modal === 'hours' && editingArea && <EditHoursModal area={editingArea} onClose={() => { setModal(null); setEditingArea(null); }} onSave={(h) => {
        const a = AAS.find(x => x.id === editingArea.id);
        if (a) Object.assign(a, h);
        showToast(`Oppdaterte ${a.name} · ${h.open}–${h.close}`);
      }} />}

      {toast && (
        <div className="toast"><span className="dot" />{toast}</div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Time scale">
          <TweakSlider label="Time høyde" k="hourHeight" min={50} max={180} step={10} unit="px" />
          <TweakToggle label="Vis halvtimer i ruten" k="showHalfHour" />
        </TweakSection>
        <TweakSection title="Lag og dekor">
          <TweakToggle label="Bånd for serviceperioder" k="showRoutine" />
          <TweakToggle label="Demp fortiden" k="showPastDim" />
          <TweakToggle label="Nå-linje" k="showNow" />
          <TweakToggle label="Meldings-spor" k="showNotes" />
        </TweakSection>
        <TweakSection title="Tetthet">
          <TweakToggle label="Kompakt" k="compactDensity" />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
