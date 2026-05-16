// Task list view (forsiden — Min dag)
const { useState: useStateL, useMemo: useMemoL } = React;

function TaskCard({ task, onOpen, onToggleStatus }) {
  const { USERS, ORIGIN, FOLDERS } = window.SmartoutData;
  const folder = FOLDERS.find(f => f.id === task.folder);
  const assignee = USERS[task.assignee];
  const subDone = task.subtasks.filter(s => s.done).length;
  const subTotal = task.subtasks.length;

  const handleToggle = (e) => {
    e.stopPropagation();
    onToggleStatus(task.id);
  };

  const deadlineClass =
    task.status === 'overdue' ? 'crit'
    : task.priority === 'critical' ? 'crit'
    : task.priority === 'high' ? 'warn'
    : '';

  return (
    <div
      className="task-card"
      data-priority={task.priority}
      data-status={task.status}
      onClick={() => onOpen(task.id)}
    >
      <button
        className={`state-toggle ${task.status === 'done' ? 'done' : task.status === 'inprogress' ? 'inprogress' : task.status === 'overdue' ? 'overdue' : ''}`}
        onClick={handleToggle}
        title={task.status === 'done' ? 'Gjenåpne' : 'Marker ferdig'}
      >
        {task.status === 'done' && <Icon name="check" size={13} strokeWidth={3} />}
      </button>

      <OriginBadge origin={task.origin} />

      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.deadline && (
            <span className={`deadline mono ${deadlineClass}`}>
              {task.deadline}
              {task.deadlineRel ? <span className="rel">· {task.deadlineRel}</span> : null}
            </span>
          )}
          {folder && (
            <span className="folder-chip" style={{ color: folder.color }}>
              <span className="folder-dot" style={{ background: folder.color }} />
              {folder.name}
            </span>
          )}
          {task.location && (
            <span className="meta-loc"><Icon name="mappin" size={11} /> {task.location}</span>
          )}
        </div>
      </div>

      <div className="task-side">
        {subTotal > 0 && (
          <span className="task-progress-mini">{subDone}/{subTotal}</span>
        )}
        {task.manual && <Icon name="book" size={14} color="var(--muted)" />}
        {task.requiresEvidence && <Icon name="camera" size={14} color="var(--muted)" />}
        {assignee && <Avatar user={assignee} size={26} />}
      </div>
    </div>
  );
}

function MinDag({ tasks, filter, setFilter, onOpen, onToggleStatus }) {
  const filtered = useMemoL(() => {
    if (filter === 'me') return tasks.filter(t => t.assignee === window.SmartoutData.ME.id);
    if (filter === 'critical') return tasks.filter(t => t.priority === 'critical' || t.status === 'overdue');
    if (filter === 'inprogress') return tasks.filter(t => t.status === 'inprogress');
    if (filter === 'done') return tasks.filter(t => t.status === 'done');
    return tasks;
  }, [tasks, filter]);

  const sorted = sortTasks(filtered);

  // Group: Critical/overdue → I dag → Ferdig
  const critical = sorted.filter(t => t.status !== 'done' && (t.priority === 'critical' || t.status === 'overdue'));
  const today = sorted.filter(t => t.status !== 'done' && !(t.priority === 'critical' || t.status === 'overdue'));
  const done = sorted.filter(t => t.status === 'done');

  const counts = {
    all: tasks.length,
    me: tasks.filter(t => t.assignee === window.SmartoutData.ME.id).length,
    critical: tasks.filter(t => t.priority === 'critical' || t.status === 'overdue').length,
    inprogress: tasks.filter(t => t.status === 'inprogress').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return (
    <>
      <div className="topbar">
        <div className="head">
          <div className="eyebrow">Mandag · 4. mai</div>
          <h2>Min dag</h2>
          <div className="day-meter">
            <span className="day-meter-bar"><span style={{ width: '25%' }} /></span>
            <span className="day-meter-text"><strong className="mono">3 av 12</strong> fullført · <span className="crit">3 må løses før 12:00</span></span>
          </div>
        </div>
        <div className="right">
          <button className="icon-btn" title="Søk (⌘K)"><Icon name="search" size={17} /></button>
          <button className="btn btn-primary btn-lg"><Icon name="plus" size={14} strokeWidth={2.5} /> Ny oppgave</button>
        </div>
      </div>

      <BotssonNudge />

      <div className="filter-row">
        <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Alle <span className="chip-count">{counts.all}</span></button>
        <button className={`chip ${filter === 'me' ? 'active' : ''}`} onClick={() => setFilter('me')}>Tildelt meg <span className="chip-count">{counts.me}</span></button>
        <button className={`chip ${filter === 'critical' ? 'active' : ''}`} onClick={() => setFilter('critical')}>Kritisk <span className="chip-count">{counts.critical}</span></button>
        <button className={`chip ${filter === 'inprogress' ? 'active' : ''}`} onClick={() => setFilter('inprogress')}>Pågår <span className="chip-count">{counts.inprogress}</span></button>
        <button className={`chip ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')}>Ferdig <span className="chip-count">{counts.done}</span></button>
        <div className="filter-row-spacer" />
        <button className="icon-btn icon-btn-sm" title="Sortér"><Icon name="filter" size={15} /></button>
      </div>

      {critical.length > 0 && (
        <section className="task-section">
          <div className="section-header crit">
            <span className="section-bar" />
            <h3>Må løses nå</h3>
            <span className="count mono">{critical.length}</span>
          </div>
          <div className="task-list">
            {critical.map(t => <TaskCard key={t.id} task={t} onOpen={onOpen} onToggleStatus={onToggleStatus} />)}
          </div>
        </section>
      )}

      {today.length > 0 && (
        <section className="task-section">
          <div className="section-header">
            <h3>I dag</h3>
            <span className="count mono">{today.length}</span>
          </div>
          <div className="task-list">
            {today.map(t => <TaskCard key={t.id} task={t} onOpen={onOpen} onToggleStatus={onToggleStatus} />)}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="task-section task-section-done">
          <div className="section-header">
            <h3>Fullført i dag</h3>
            <span className="count mono">{done.length}</span>
          </div>
          <div className="task-list">
            {done.map(t => <TaskCard key={t.id} task={t} onOpen={onOpen} onToggleStatus={onToggleStatus} />)}
          </div>
        </section>
      )}
    </>
  );
}

function BotssonNudge() {
  return (
    <div className="botsson-card" role="note">
      <div className="bot-icon" aria-hidden="true"><span>b</span></div>
      <div className="bot-text">
        <span className="bot-label">Botsson</span>
        <p>Start med <strong>Avvik #214 — kjøl-pakning</strong>, så er du klar når Bama leverer <span className="mono">09:30</span>.</p>
      </div>
      <button className="bot-cta" aria-label="Følg Botssons forslag">
        Følg <Icon name="arrow-right" size={13} />
      </button>
    </div>
  );
}

window.MinDag = MinDag;
window.TaskCard = TaskCard;
