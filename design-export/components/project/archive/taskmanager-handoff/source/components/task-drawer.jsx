// Task drawer (detail overlay)
function TaskDrawer({ task, onClose, onOpenManual, onToggleSubtask, onToggleStatus }) {
  const { USERS, FOLDERS, MANUALS, ME, ORIGIN, STATUS, PRIORITY } = window.SmartoutData;
  if (!task) return null;
  const folder = FOLDERS.find(f => f.id === task.folder);
  const manual = task.manual ? MANUALS[task.manual] : null;
  const assignee = USERS[task.assignee];
  const subDone = task.subtasks.filter(s => s.done).length;
  const subTotal = task.subtasks.length;

  const headerClass =
    task.priority === 'critical' || task.status === 'overdue' ? 'crit'
    : task.priority === 'high' ? 'warn' : '';

  const deadlineClass =
    task.status === 'overdue' ? 'crit'
    : task.priority === 'critical' ? 'crit'
    : task.priority === 'high' ? 'warn' : '';

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className={`drawer-header ${headerClass}`}>
          <div className="drawer-header-row1">
            <OriginBadge origin={task.origin} />
            <span className={`status-pill status-${task.status}`}>{STATUS[task.status].label}</span>
            {task.requiresApproval && <span className="status-pill status-awaiting">Krever godkjenning</span>}
            <div className="right">
              <button className="icon-btn" title="Mer"><Icon name="more" size={18} /></button>
              <button className="icon-btn" onClick={onClose} title="Lukk"><Icon name="close" size={18} /></button>
            </div>
          </div>

          <h1 className="drawer-title">{task.title}</h1>
          {task.description && <p className="drawer-desc">{task.description}</p>}

          <div className="header-chips">
            {task.deadline && (
              <span className={`h-chip deadline ${deadlineClass}`}>
                <Icon name="clock" size={12} />
                <strong className="mono">{task.deadline}</strong>
                {task.deadlineRel ? <span style={{ opacity: 0.85 }}>· {task.deadlineRel}</span> : null}
              </span>
            )}
            {assignee && (
              <span className="h-chip">
                <Avatar user={assignee} size={18} />
                <strong>{assignee.name.split(' ')[0]}</strong>
                <span style={{ color: 'var(--muted)' }}>· {assignee.role}</span>
              </span>
            )}
            {(folder || task.location || task.estimate) && <span className="chip-divider" />}
            {folder && (
              <span className="h-chip">
                <span className="folder-dot" style={{ background: folder.color, width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
                <strong>{folder.name}</strong>
              </span>
            )}
            {task.location && (
              <span className="h-chip">
                <Icon name="mappin" size={12} />
                {task.location}
              </span>
            )}
            {task.estimate && (
              <span className="h-chip">
                <span className="mono">~{task.estimate} min</span>
              </span>
            )}
            {task.tags.length > 0 && <span className="chip-divider" />}
            {task.tags.map(t => <span key={t} className="tag-chip">#{t}</span>)}
          </div>
        </div>

        <div className="drawer-body">
          {manual && (
            <div className="drawer-section">
              <h4><Icon name="book" size={11} /> Tilknyttet manual</h4>
              <div className="manual-link" onClick={() => onOpenManual(manual.id)}>
                <div className="ico"><Icon name="book" size={18} /></div>
                <div className="info">
                  <div className="ttl">{manual.title}</div>
                  <div className="meta">
                    <span className="mono">v{manual.version}</span>
                    <span className="sep">·</span>
                    <span>{manual.sections.length} seksjoner</span>
                    <span className="sep">·</span>
                    <span>~{manual.estimatedReadTime} min lesing</span>
                  </div>
                </div>
                <Icon name="chevron-right" size={16} color="var(--muted)" />
              </div>
            </div>
          )}

          {subTotal > 0 && (
            <div className="drawer-section">
              <h4>
                Subtasks
                <span className="count mono">{subDone}/{subTotal}</span>
              </h4>
              <div className="subtask-list">
                {task.subtasks.map(s => (
                  <div
                    key={s.id}
                    className={`subtask-item ${s.done ? 'done' : ''}`}
                    onClick={() => onToggleSubtask(task.id, s.id)}
                  >
                    <div className={`subtask-check ${s.done ? 'done' : ''}`}>
                      {s.done && <Icon name="check" size={12} strokeWidth={3} />}
                    </div>
                    <div className="subtask-title">{s.title}</div>
                    {s.value && <div className="subtask-value">{s.value}</div>}
                    {s.user && <div className="subtask-user"><Avatar user={s.user} size={20} /></div>}
                  </div>
                ))}
                <div className="subtask-add">
                  <Icon name="plus" size={14} /> Legg til subtask
                </div>
              </div>
            </div>
          )}

          {task.requiresEvidence && (
            <div className="drawer-section">
              <h4><Icon name="camera" size={11} /> Bevis kreves</h4>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary"><Icon name="camera" size={14} /> Ta bilde</button>
                <button className="btn btn-secondary"><Icon name="paperclip" size={14} /> Vedlegg</button>
                <button className="btn btn-secondary"><Icon name="pen" size={14} /> Signer</button>
              </div>
            </div>
          )}

          <div className="drawer-section">
            <h4>
              <Icon name="message" size={11} />
              Aktivitet & kommentarer
              <span className="count mono">{task.activity.length}</span>
            </h4>
            <div className="activity-list">
              {task.activity.map((a, i) => (
                <div key={i} className={`activity-item ${a.type === 'comment' ? 'comment' : ''}`}>
                  <Avatar user={a.user} size={26} />
                  {a.type === 'comment' ? (
                    <div className="body">
                      <div className="who">
                        {USERS[a.user]?.name}
                        <span className="time">{a.time}</span>
                      </div>
                      <div className="text">{a.text}</div>
                    </div>
                  ) : (
                    <div className="body">
                      <strong>{USERS[a.user]?.name}</strong> {a.text}
                      <span className="time">{a.time}</span>
                    </div>
                  )}
                </div>
              ))}
              <div className="comment-input">
                <Avatar user={ME} size={26} />
                <div className="field">Skriv en kommentar…</div>
              </div>
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          <button className="btn btn-ghost btn-sm"><Icon name="user" size={14} /> Tildel</button>
          <button className="btn btn-ghost btn-sm"><Icon name="bell" size={14} /> Følg</button>
          <div className="spacer" />
          {task.status === 'done' ? (
            <button className="btn btn-secondary btn-lg" onClick={() => onToggleStatus(task.id)}>Gjenåpne</button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm">Pause</button>
              <button className="btn btn-primary btn-lg" onClick={() => onToggleStatus(task.id)}>
                <Icon name="check" size={14} strokeWidth={2.5} />
                Marker ferdig
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

window.TaskDrawer = TaskDrawer;
