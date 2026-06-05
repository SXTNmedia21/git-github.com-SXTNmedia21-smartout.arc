// =============================================================================
// Smartout Mobile — FLOWS & OVERLAYS (drawers + full-screen takeovers)
// Everything web does as a center popup, mobile does as a bottom drawer or a
// full-screen takeover. Exposes:
//   window.MFlowPlayer     — manual/veiledning player (full screen)        [cc-3]
//   window.MTaskFull       — full task screen w/ hierarchy + manual (drawer)[cc-1]
//   window.MNewTaskDrawer  — "Ny oppgave" create form (bottom drawer)      [cc-2]
//   window.MPunchScreen    — bold punch-in / on-shift takeover             [cc-4]
//   window.MShiftClaimDrawer — Vaktbørs "Ta vakt" w/ comment + betingelser [cc-5]
// Loaded after screens.jsx, before pages.jsx.
// =============================================================================
(function () {
  const { useState, useEffect, useRef } = React;
  const Ic = window.MIc;
  const { cls, fmtKr } = window.M;
  const D = window.SmartoutData;
  const MANUALS = D.MANUALS || {};
  const ORIGIN = D.ORIGIN || {};
  const BOOK_LABEL = { hms: 'HMS-håndbok', bedrift: 'Bedriftshåndbok', personal: 'Personalhåndbok', drift: 'Driftshåndbok', onboarding: 'Onboarding' };
  const SEC_KIND = { text: ['Tekst', 'file'], video: ['Video', 'play'], image: ['Bilde', 'camera'], checklist: ['Sjekkliste', 'checklist'], quote: ['Sitat', 'file'] };
  const PRI = { critical: ['m-pill-crit', 'Kritisk'], high: ['m-pill-warn', 'Høy'], normal: ['m-pill-muted', 'Normal'], low: ['m-pill-muted', 'Lav'] };

  const pad = (n) => String(n).padStart(2, '0');

  // =========================================================================
  // FLOW PLAYER — plays a manual's sections as a guided, immersive flow  [cc-3]
  // =========================================================================
  function FlowPlayer({ manualId, manual: manualProp, onClose }) {
    const { toast } = window.useM();
    const man = manualProp || MANUALS[manualId];
    const sections = (man && man.sections) || [];
    const [phase, setPhase] = useState('hero'); // hero | step | done
    const [i, setI] = useState(0);
    const [checks, setChecks] = useState({});
    const bodyRef = useRef(null);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [i, phase]);

    if (!man) {
      return (
        <div className="m-flow m-flow-imm">
          <div className="m-flow-top"><button className="m-flow-x" onClick={onClose} aria-label="Lukk"><Ic n="x" s={18} /></button><div className="m-flow-prog" /><span style={{ width: 28 }} /></div>
          <div className="m-flow-body"><div className="m-empty" style={{ marginTop: 60 }}><Ic n="bookOpen" s={30} /><b>Ingen veiledning</b><p>Denne oppgaven har ingen tilknyttet veiledning ennå.</p></div></div>
        </div>
      );
    }

    const total = sections.length;
    const totalScreens = total + 2;                 // cover + steps + done
    const stepIdx = phase === 'hero' ? 0 : phase === 'done' ? totalScreens - 1 : 1 + i;
    const pct = totalScreens > 1 ? stepIdx / (totalScreens - 1) : 1;
    const sec = sections[i];
    const next = () => { if (i < total - 1) setI(i + 1); else setPhase('done'); };
    const prev = () => { if (i > 0) setI(i - 1); };

    return (
      <div className="m-flow m-flow-imm">
        <div className="m-flow-top">
          <button className="m-flow-x" onClick={onClose} aria-label="Lukk"><Ic n="x" s={18} /></button>
          <div className="m-flow-prog"><span className="m-flow-prog-bar" style={{ width: (pct * 100) + '%' }} /></div>
          <span className="m-flow-count mono">{stepIdx + 1}/{totalScreens}</span>
        </div>

        <div className="m-flow-body" ref={bodyRef}>
          {phase === 'hero' && (
            <div className="m-flow-cover">
              <span className="m-flow-eyebrow">Veiledning</span>
              <h1>{man.title}</h1>
              <div className="m-flow-sub">~{man.estimatedReadTime} min · {total} {total === 1 ? 'seksjon' : 'seksjoner'}{man.version ? ' · v' + man.version : ''}</div>
              {man.description && <p className="m-flow-desc">{man.description}</p>}
              {man.author && <span className="m-flow-author"><Ic n="users" s={13} /> {man.author}</span>}
            </div>
          )}

          {phase === 'step' && sec && (
            <div className="m-flow-step" key={i}>
              <span className="m-flow-kicker mono">{(man.title || 'Veiledning').toUpperCase()}</span>
              <h2>{sec.title}</h2>
              {sec.type === 'video' && (
                <div className="m-flow-video">
                  <span className="m-flow-play"><Ic n="play" s={25} c="#1c1814" /></span>
                  {(sec.videoTitle || sec.videoDuration) && <span className="m-flow-vmeta"><b>{sec.videoTitle}</b><span className="mono">{sec.videoDuration}</span></span>}
                </div>
              )}
              {sec.type === 'image' && (
                <div className="m-flow-image"><Ic n="camera" s={28} /><span>Illustrasjon</span></div>
              )}
              {sec.type === 'quote' ? (
                <blockquote className="m-flow-quote">
                  <span>«{(sec.content || [])[0] || ''}»</span>
                  {sec.by && <small>— {sec.by}</small>}
                </blockquote>
              ) : sec.type === 'checklist' ? (
                <div className="m-flow-checklist">
                  {sec.content.map((c, k) => {
                    const key = i + '-' + k, on = !!checks[key];
                    return (
                      <button key={k} className={cls('m-flow-cl', on && 'done')} onClick={() => setChecks(m => ({ ...m, [key]: !m[key] }))}>
                        <span className={cls('m-flow-cl-check', on && 'done')}>{on && <Ic n="check" s={14} sw={3} />}</span>
                        <span>{c}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="m-flow-text">{(sec.content || []).map((c, k) => <p key={k}>{c}</p>)}</div>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div className="m-flow-done">
              <span className="m-flow-done-ic"><Ic n="check" s={38} sw={2.4} c="#fff" /></span>
              <h1>Veiledning fullført</h1>
              <p>Du har gått gjennom «{man.title}». Bekreft at du har lest og forstått.</p>
            </div>
          )}
        </div>

        <div className="m-flow-foot">
          {phase === 'hero' && <button className="m-btn m-btn-primary m-btn-block" onClick={() => setPhase(total ? 'step' : 'done')}><Ic n="play" s={16} /> Start veiledningen</button>}
          {phase === 'step' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="m-btn m-btn-ghost" disabled={i === 0} style={{ flex: '0 0 auto', opacity: i === 0 ? .4 : 1 }} onClick={prev}><Ic n="chevLeft" s={16} /> Forrige</button>
              <button className="m-btn m-btn-primary m-full" onClick={next}>{i < total - 1 ? 'Neste steg' : 'Fullfør'} <Ic n="arrowRight" s={16} /></button>
            </div>
          )}
          {phase === 'done' && <button className="m-btn m-btn-primary m-btn-block" onClick={() => { toast('Lesekvittering registrert'); onClose(); }}><Ic n="check" s={17} /> Lest og forstått</button>}
        </div>
      </div>
    );
  }
  window.MFlowPlayer = FlowPlayer;

  // =========================================================================
  // FLOW CONTROLLER — scroll-through control/compliance form (full screen).
  // Mirror of web OppFormViewer; one shared schema (SmartoutData.resolveControlForm).
  // Reusable across Vern · HMS · IK · Mat · innhenting.
  // =========================================================================
  const CTRL_TYPE = {
    tall: ['thermometer', 'Måling'], sjekk: ['check', 'Spørsmål'], vurdering: ['sparkle', 'Vurdering'],
    foto: ['camera', 'Foto'], qr: ['grid', 'QR-skann'], signatur: ['fingerprint', 'Signatur'],
  };
  function CtrlQuestion({ q, val, onChange }) {
    const answered = val != null && val !== '' && !(typeof val === 'object' && val.v == null);
    const [ic, label] = CTRL_TYPE[q.type] || CTRL_TYPE.sjekk;
    return (
      <div className={cls('m-ctrl-q', answered && 'done')}>
        <div className="m-ctrl-q-top">
          <span className="m-ctrl-q-ic"><Ic n={ic} s={16} /></span>
          <div className="m-ctrl-q-p">{q.prompt}{q.req && <span className="req">*</span>}<div className="m-ctrl-q-tt">{label}</div></div>
          {answered && <span className="m-ctrl-q-ok"><Ic n="check" s={17} sw={2.6} /></span>}
        </div>
        {q.type === 'tall' && (() => {
          const num = val === '' || val == null ? null : parseFloat(String(val).replace(',', '.'));
          const ok = num == null ? null : num <= q.max;
          return (
            <div className="m-ctrl-num">
              <input inputMode="decimal" value={val ?? ''} onChange={e => onChange(e.target.value)} placeholder="–" />
              <span className="unit">{q.unit}</span>
              <span className="target">krav ≤ {q.max}{q.unit}</span>
              {num != null && <span className={cls('m-ctrl-verdict', ok ? 'ok' : 'avvik')}>{ok ? 'Innenfor' : 'Avvik'}</span>}
            </div>
          );
        })()}
        {q.type === 'sjekk' && (
          <div className="m-ctrl-segs">
            <button className={cls('m-ctrl-seg', val === 'ok' && 'on ok')} onClick={() => onChange('ok')}><Ic n="check" s={15} /> OK</button>
            <button className={cls('m-ctrl-seg', val === 'avvik' && 'on avvik')} onClick={() => onChange('avvik')}><Ic n="alert" s={15} /> Avvik</button>
          </div>
        )}
        {q.type === 'vurdering' && (
          <>
            <div className="m-ctrl-segs">
              {[['bra', 'Bra', 'ok'], ['middels', 'Middels', 'neutral'], ['darlig', 'Dårlig', 'avvik']].map(([k, l, t]) => (
                <button key={k} className={cls('m-ctrl-seg', val && val.v === k && 'on ' + t)} onClick={() => onChange({ v: k, note: (val && val.note) || '' })}>{l}</button>
              ))}
            </div>
            {val && val.v && <textarea className="m-ctrl-note" rows={2} placeholder="Kort begrunnelse (valgfri)…" value={val.note || ''} onChange={e => onChange({ v: val.v, note: e.target.value })} />}
          </>
        )}
        {q.type === 'foto' && (
          <button className="m-dropzone" onClick={() => !val && onChange('1 bilde lagt til · ' + new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }))}>
            <Ic n={val ? 'check' : 'camera'} s={20} c={val ? 'var(--success)' : 'var(--orange)'} />
            <span>{val || 'Legg til foto som bevis'}</span>
          </button>
        )}
        {q.type === 'qr' && (
          val ? <div className="m-ctrl-res"><Ic n="check" s={15} sw={2.4} /> Skannet: {val}</div>
            : <button className="m-ctrl-act" onClick={() => onChange(q.code)}><Ic n="grid" s={17} /> Skann QR-kode</button>
        )}
        {q.type === 'signatur' && (
          val ? <div className="m-ctrl-res"><Ic n="check" s={15} sw={2.4} /> Signert: {val}</div>
            : <button className="m-ctrl-act" onClick={() => onChange((D.ME.name) + ' · ' + new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }))}><Ic n="fingerprint" s={17} /> Signér her</button>
        )}
      </div>
    );
  }
  function FormViewer({ task, onClose }) {
    const { toast } = window.useM();
    const form = D.resolveControlForm ? D.resolveControlForm(task) : null;
    const [ans, setAns] = useState({});
    const [done, setDone] = useState(false);
    const bodyRef = useRef(null);
    useEffect(() => { if (done && bodyRef.current) bodyRef.current.scrollTop = 0; }, [done]);
    if (!form) {
      return (
        <div className="m-flow m-flow-imm">
          <div className="m-flow-top"><button className="m-flow-x" onClick={onClose}><Ic n="x" s={18} /></button><div className="m-flow-prog" /><span style={{ width: 28 }} /></div>
          <div className="m-flow-body"><div className="m-empty" style={{ marginTop: 60 }}><Ic n="checklist" s={30} /><b>Ingen kontroll</b><p>Denne oppgaven har ikke et kontrollskjema.</p></div></div>
        </div>
      );
    }
    const allQs = form.sections.flatMap(s => s.qs);
    const isAns = (q) => { const v = ans[q.id]; return v != null && v !== '' && !(typeof v === 'object' && !v.v); };
    const answered = allQs.filter(isAns).length;
    const reqMissing = allQs.some(q => q.req && !isAns(q));
    const complete = allQs.every(isAns);
    const pct = allQs.length ? answered / allQs.length : 0;
    return (
      <div className="m-flow m-flow-imm">
        <div className="m-flow-top">
          <button className="m-flow-x" onClick={onClose} aria-label="Lukk"><Ic n="x" s={18} /></button>
          <div className="m-flow-prog"><span className="m-flow-prog-bar" style={{ width: (done ? 100 : pct * 100) + '%', background: form.color }} /></div>
          <span className="m-flow-count mono">{done ? '✓' : answered + '/' + allQs.length}</span>
        </div>
        <div className="m-flow-body" ref={bodyRef}>
          {done ? (
            <div className="m-ctrl-done">
              <span className="m-ctrl-done-ic"><Ic n="check" s={38} sw={2.4} c="#fff" /></span>
              <h1>Kontroll signert</h1>
              <p>Svarene er låst og bevis er generert til loggen. Avvik er sendt til oppfølging.</p>
              <span className="m-ctrl-evi"><Ic n="file" s={14} c="var(--success)" /> {task.title} · {new Date().toLocaleDateString('nb-NO')}</span>
            </div>
          ) : (
            <div style={{ padding: '4px 2px 8px' }}>
              <span className="m-flow-kicker mono" style={{ color: form.color }}>{form.kind.toUpperCase()}</span>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, lineHeight: 1.12, margin: '6px 0 4px' }}>{task.title}</h2>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 18 }}>{form.chapter} · må signeres ved fullføring</div>
              {form.sections.map((s, si) => (
                <div key={si} className="m-ctrl-sec">
                  <div className="m-ctrl-sec-h"><span className="m-ctrl-sec-n">{si + 1}</span><span className="m-ctrl-sec-t">{s.title}</span><span className="m-ctrl-sec-c">{s.qs.filter(isAns).length}/{s.qs.length}</span></div>
                  {s.intro && <div className="m-ctrl-husk"><Ic n="alert" s={15} c="var(--orange-dark)" style={{ flex: '0 0 auto', marginTop: 1 }} /><span><b>Husk:</b> {s.intro}</span></div>}
                  {s.qs.map(q => <CtrlQuestion key={q.id} q={q} val={ans[q.id]} onChange={v => setAns(a => ({ ...a, [q.id]: v }))} />)}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="m-flow-foot">
          {done ? (
            <button className="m-btn m-btn-primary m-btn-block" onClick={onClose}><Ic n="check" s={17} /> Ferdig</button>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--muted)', lineHeight: 1.35 }}>
                {reqMissing ? <span style={{ color: 'var(--error)', fontWeight: 600 }}>Påkrevd foto/signatur mangler</span>
                  : complete ? 'Alt besvart — klar til signering' : `${allQs.length - answered} kontroller gjenstår`}
              </div>
              <button className="m-btn m-btn-primary" style={{ flex: '0 0 auto', opacity: complete && !reqMissing ? 1 : .5 }} disabled={!complete || reqMissing} onClick={() => { setDone(true); toast('Kontroll signert · bevis generert'); }}><Ic n="fingerprint" s={16} /> Signér</button>
            </div>
          )}
        </div>
      </div>
    );
  }
  window.MFormViewer = FormViewer;

  function RingBig({ pct, label }) {
    const size = 150, sw = 11, r = (size - sw) / 2, c = 2 * Math.PI * r;
    return (
      <span className="m-ring-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted-soft)" strokeWidth={sw - 4} opacity=".4" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--orange)" strokeWidth={sw} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        <span className="m-ring-label" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <b style={{ fontSize: 34 }}>{Math.round(pct * 100)}%</b>
          <small style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--muted)' }}>{label}</small>
        </span>
      </span>
    );
  }

  // =========================================================================
  // FULL TASK SCREEN — the "store oppgave-screen": hierarchy + manual    [cc-1]
  // =========================================================================
  function TaskFull({ task, onClose }) {
    const { toast } = window.useM();
    const man = task.manual ? MANUALS[task.manual] : null;
    const isAdhoc = task.origin === 'adhoc' || (!task.book && !task.chapter);
    const bookLabel = BOOK_LABEL[task.book] || null;
    const origin = ORIGIN[task.origin];
    const [pcls, plabel] = PRI[task.priority] || PRI.normal;
    const overdue = task.status === 'overdue';
    const [subs, setSubs] = useState(() => (task.subtasks || []).reduce((m, s) => (m[s.id] = !!s.done, m), {}));
    const [flow, setFlow] = useState(false);
    const ctrlForm = D.resolveControlForm ? D.resolveControlForm(task) : null;
    const [ctrl, setCtrl] = useState(false);
    const [draft, setDraft] = useState('');
    const [comments, setComments] = useState([]);
    const doneN = Object.values(subs).filter(Boolean).length;
    const total = (task.subtasks || []).length;
    const send = () => { if (!draft.trim()) return; setComments(c => [...c, { who: 'Maria', text: draft, t: 'nå' }]); setDraft(''); };

    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 46 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ height: '96%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h">
            <h3>Oppgave</h3>
            <button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button>
          </div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* hierarchy / tilhører */}
            {isAdhoc ? (
              <div className="m-tilhorer is-adhoc"><Ic n="sparkle" s={15} c="var(--muted)" /> <span>Ad-hoc oppgave · ikke knyttet til håndbok</span></div>
            ) : (
              <button className="m-tilhorer" onClick={() => toast('Åpner ' + (task.chapter || 'kapittel') + ' i Bibliotek')}>
                <span className="m-tilhorer-ic"><Ic n="bookOpen" s={16} /></span>
                <span className="m-tilhorer-t">
                  <small>TILHØRER</small>
                  <b>{bookLabel || 'Håndbok'} <span style={{ opacity: .5 }}>›</span> {task.chapter}</b>
                </span>
                <Ic n="chevRight" s={17} c="var(--muted-soft)" />
              </button>
            )}

            {/* chips + title */}
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 9 }}>
                {origin && <span className="m-pill" style={{ background: origin.bg, color: origin.color }}>{origin.label}</span>}
                {task.cat === 'ikmat' && <span className="m-pill m-pill-info">IK-mat</span>}
                <span className={cls('m-pill', overdue ? 'm-pill-crit' : pcls)}><span className="m-pill-dot" /> {overdue ? 'Forsinket' : plabel}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 27, lineHeight: 1.1, letterSpacing: '-.01em' }}>{task.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
                <span><Ic n="clock" s={13} style={{ verticalAlign: -2 }} /> Frist {task.deadline}{overdue ? ` · ${task.deadlineRel}` : ''}</span>
                {task.location && <span><Ic n="mappin" s={13} style={{ verticalAlign: -2 }} /> {task.location}</span>}
                {task.estimate && <span><Ic n="history" s={13} style={{ verticalAlign: -2 }} /> ~{task.estimate} min</span>}
              </div>
            </div>

            {task.description && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{task.description}</p>}

            {/* manual → FlowPlayer */}
            {man && (
              <div>
                <div className="m-sec-h" style={{ marginBottom: 8 }}><h2>Veiledning</h2></div>
                <button className="m-veil" onClick={() => setFlow(true)}>
                  <span className="m-veil-ic"><Ic n="bookOpen" s={20} /></span>
                  <span className="m-veil-t">
                    <b>{man.title}</b>
                    <small>{(man.sections || []).length} steg · ~{man.estimatedReadTime} min · v{man.version}</small>
                  </span>
                  <span className="m-veil-go"><Ic n="play" s={15} c="#fff" /></span>
                </button>
              </div>
            )}

            {/* control form → Flow Controller */}
            {ctrlForm && (
              <div>
                <div className="m-sec-h" style={{ marginBottom: 8 }}><h2>Kontroll</h2><span className="m-pill" style={{ background: ctrlForm.color + '1c', color: ctrlForm.color }}>{ctrlForm.kind}</span></div>
                <button className="m-veil" onClick={() => setCtrl(true)} style={{ borderColor: 'color-mix(in srgb, ' + ctrlForm.color + ' 35%, var(--border))' }}>
                  <span className="m-veil-ic" style={{ background: ctrlForm.color }}><Ic n="checklist" s={20} c="#fff" /></span>
                  <span className="m-veil-t">
                    <b>Start kontroll</b>
                    <small>{ctrlForm.sections.reduce((n, s) => n + s.qs.length, 0)} kontroller · {ctrlForm.sections.length} seksjoner · signeres</small>
                  </span>
                  <span className="m-veil-go" style={{ background: ctrlForm.color }}><Ic n="chevRight" s={15} c="#fff" /></span>
                </button>
              </div>
            )}

            {/* subtasks — superseded by the Flow Controller for control tasks */}
            {!ctrlForm && total > 0 && (
              <div>
                <div className="m-sec-h" style={{ marginBottom: 8 }}><h2>Sjekkpunkter</h2><span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{doneN}/{total}</span></div>
                <div className="m-card m-flush"><div className="m-tasklist">
                  {task.subtasks.map(s => (
                    <button key={s.id} className="m-task" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSubs(m => ({ ...m, [s.id]: !m[s.id] }))}>
                      <span className={cls('m-task-check', subs[s.id] && 'is-done')}><Ic n="check" s={15} sw={3} /></span>
                      <div className="m-task-body"><div className={cls('m-task-title', subs[s.id] && 'is-done')}>{s.title}</div>{s.value && <div className="m-task-meta"><span className="mono">{s.value}</span></div>}</div>
                    </button>
                  ))}
                </div></div>
              </div>
            )}

            {/* evidence */}
            {task.requiresEvidence && (
              <div>
                <div className="m-sec-h" style={{ marginBottom: 8 }}><h2>Dokumentasjon</h2>{task.requiresApproval && <span className="m-pill m-pill-warn">Krever godkjenning</span>}</div>
                <button className="m-dropzone" onClick={() => toast('Åpner kamera')}>
                  <Ic n="camera" s={22} c="var(--orange)" />
                  <span>Legg til foto som bevis</span>
                </button>
              </div>
            )}

            {/* activity + comments */}
            {(task.activity || comments.length > 0) && (
              <div>
                <div className="m-sec-h" style={{ marginBottom: 8 }}><h2>Aktivitet</h2></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(task.activity || []).map((a, k) => {
                    const u = D.USERS[a.user];
                    return (
                      <div key={'a' + k} style={{ display: 'flex', gap: 10 }}>
                        <span className="m-avatar" style={{ background: u?.color || 'var(--muted)', width: 28, height: 28, fontSize: 10, flex: '0 0 auto' }}>{u?.initials || '?'}</span>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 13, lineHeight: 1.4 }}><b style={{ fontWeight: 650 }}>{u?.name.split(' ')[0]}</b> {a.text}</div><div style={{ fontSize: 11, color: 'var(--muted-soft)', marginTop: 1 }}>{a.time}</div></div>
                      </div>
                    );
                  })}
                  {comments.map((c, k) => (
                    <div key={'c' + k} style={{ display: 'flex', gap: 10 }}>
                      <span className="m-avatar" style={{ background: D.ME.color, width: 28, height: 28, fontSize: 10, flex: '0 0 auto' }}>{D.ME.initials}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13, lineHeight: 1.4 }}><b style={{ fontWeight: 650 }}>{c.who}</b> {c.text}</div><div style={{ fontSize: 11, color: 'var(--muted-soft)', marginTop: 1 }}>{c.t}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* composer + complete */}
          <div className="m-taskfull-foot">
            <div className="m-taskfull-comment">
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Skriv en kommentar…" />
              <button className="m-iconbtn" onClick={send} style={{ color: draft.trim() ? 'var(--orange)' : 'var(--muted)' }}><Ic n="send" s={18} /></button>
            </div>
            <button className="m-btn m-btn-primary m-btn-block" onClick={() => { if (ctrlForm) { setCtrl(true); } else { toast(`«${task.title}» markert ferdig`); onClose(); } }}><Ic n={ctrlForm ? 'checklist' : 'check'} s={17} /> {ctrlForm ? 'Start kontroll' : 'Marker ferdig'}</button>
          </div>

          {flow && <FlowPlayer manualId={task.manual} onClose={() => setFlow(false)} />}
          {ctrl && <FormViewer task={task} onClose={() => setCtrl(false)} />}
        </div>
      </div>
    );
  }
  window.MTaskFull = TaskFull;

  // =========================================================================
  // NEW TASK — create form as a bottom drawer (not a web popup)          [cc-2]
  // =========================================================================
  const TEAM = ['ma', 'jh', 'sl', 'pk', 'ib'];
  function NewTaskDrawer({ onClose }) {
    const { toast } = window.useM();
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [pri, setPri] = useState('normal');
    const [time, setTime] = useState('14:00');
    const [who, setWho] = useState('ma');
    const [toList, setToList] = useState(true);
    const create = () => { if (!title.trim()) { toast('Skriv en tittel'); return; } toast(`«${title}» opprettet`); onClose(); };
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '92%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Ny oppgave</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label className="m-field"><span>Tittel</span><input className="m-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Hva skal gjøres?" autoFocus /></label>
            <label className="m-field"><span>Beskrivelse</span><textarea className="m-input" rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Detaljer (valgfritt)" /></label>
            <div className="m-field"><span>Prioritet</span>
              <div className="m-seg m-seg-full">
                {[['low', 'Lav'], ['normal', 'Normal'], ['high', 'Høy'], ['critical', 'Kritisk']].map(([id, l]) => (
                  <button key={id} className={pri === id ? 'is-active' : ''} onClick={() => setPri(id)}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <label className="m-field" style={{ flex: 1 }}><span>Frist</span><input className="m-input" type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
              <label className="m-field" style={{ flex: 1 }}><span>Tildel</span>
                <select className="m-input" value={who} onChange={e => setWho(e.target.value)}>
                  {TEAM.map(id => <option key={id} value={id}>{D.USERS[id].name}</option>)}
                </select>
              </label>
            </div>
            <button className="m-toggle-row" onClick={() => setToList(v => !v)}>
              <span><Ic n="checklist" s={16} c="var(--muted)" /> Legg i dagslisten</span>
              <span className={cls('m-switch', toList && 'on')}><span /></span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={onClose}>Avbryt</button>
            <button className="m-btn m-btn-primary m-full" onClick={create}><Ic n="plus" s={17} /> Opprett oppgave</button>
          </div>
        </div>
      </div>
    );
  }
  window.MNewTaskDrawer = NewTaskDrawer;

  // =========================================================================
  // VAKTBØRS — "Ta vakt" drawer w/ comment + betingelser                [cc-5]
  // =========================================================================
  const CLAIM_COND = [
    { id: 'whole', label: 'Kan ta hele vakten' },
    { id: 'until19', label: 'Kan bare jobbe til 19:00' },
    { id: 'short', label: 'Kan ta på kort varsel' },
    { id: 'onlyme', label: 'Ingen andre kan denne' },
  ];
  function ShiftClaimDrawer({ offer, onClose }) {
    const { toast } = window.useM();
    const u = D.USERS[offer.who] || {};
    const [cond, setCond] = useState({});
    const [note, setNote] = useState('');
    const send = () => { toast('Forespørsel sendt — venter godkjenning'); onClose(); };
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Ta vakt</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* shift summary */}
            <div className="m-card" style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
              <span className="m-avatar" style={{ background: u.color || 'var(--muted)', width: 46, height: 46, fontSize: 15 }}>{u.initials || '?'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 650 }}>{offer.title || `${u.name} tilbyr vakt`}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{offer.role} · {offer.time}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}><Ic n="mappin" s={12} style={{ verticalAlign: -2 }} /> Bistro Nord</div>
              </div>
            </div>

            {/* conditions */}
            <div className="m-field"><span>Betingelser <small style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--muted-soft)' }}>(valgfritt)</small></span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CLAIM_COND.map(c => (
                  <button key={c.id} className={cls('m-chip', cond[c.id] && 'on')} onClick={() => setCond(m => ({ ...m, [c.id]: !m[c.id] }))}>
                    {cond[c.id] && <Ic n="check" s={13} sw={3} />} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* note */}
            <label className="m-field"><span>Melding til leder <small style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--muted-soft)' }}>(valgfritt)</small></span>
              <textarea className="m-input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="F.eks. «Jeg kan ta denne, men må gå 19:00 pga buss»" />
            </label>

            <div className="m-bot" style={{ padding: '12px 14px' }}>
              <div className="m-bot-body" style={{ fontSize: 12.5 }}><b>Slik fungerer det:</b> Leder ser forespørselen og betingelsene dine, og godkjenner eller foreslår en justering. Du får svar i Meldinger.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={onClose}>Avbryt</button>
            <button className="m-btn m-btn-primary m-full" onClick={send}><Ic n="send" s={16} /> Send forespørsel</button>
          </div>
        </div>
      </div>
    );
  }
  window.MShiftClaimDrawer = ShiftClaimDrawer;

  // ---------- shared little field helpers used by the drawers ----------
  function Seg({ value, set, options, full }) {
    return (
      <div className={cls('m-seg', full && 'm-seg-full')}>
        {options.map(([id, l]) => <button key={id} className={value === id ? 'is-active' : ''} onClick={() => set(id)}>{l}</button>)}
      </div>
    );
  }

  // =========================================================================
  // MELD AVVIK — deviation report drawer                                 [cc-8]
  // =========================================================================
  function DeviationDrawer({ onClose }) {
    const { toast } = window.useM();
    const [title, setTitle] = useState('');
    const [sev, setSev] = useState('lav');
    const [area, setArea] = useState('kjokken');
    const [desc, setDesc] = useState('');
    const send = () => { if (!title.trim()) { toast('Beskriv avviket kort'); return; } toast('Avvik meldt — leder varslet'); onClose(); };
    return (
      <DrawerShell title="Meld avvik" onClose={onClose}
        foot={<><button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={onClose}>Avbryt</button><button className="m-btn m-btn-primary m-full" onClick={send}><Ic n="alert" s={16} /> Meld avvik</button></>}>
        <label className="m-field"><span>Hva skjedde?</span><input className="m-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Kort tittel" autoFocus /></label>
        <div className="m-field"><span>Alvorlighet</span><Seg full value={sev} set={setSev} options={[['lav', 'Lav'], ['middels', 'Middels'], ['hoy', 'Høy'], ['kritisk', 'Kritisk']]} /></div>
        <label className="m-field"><span>Område</span>
          <select className="m-input" value={area} onChange={e => setArea(e.target.value)}>
            {[['kjokken', 'Kjøkken'], ['sal', 'Sal'], ['bar', 'Bar'], ['lager', 'Lager'], ['ute', 'Uteområde']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="m-field"><span>Beskrivelse</span><textarea className="m-input" rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Hva, hvor og når?" /></label>
        <button className="m-dropzone" onClick={() => toast('Åpner kamera')}><Ic n="camera" s={22} c="var(--orange)" /><span>Legg til foto</span></button>
      </DrawerShell>
    );
  }
  window.MDeviationDrawer = DeviationDrawer;

  // =========================================================================
  // SØK FRAVÆR — absence request drawer                                  [cc-8]
  // =========================================================================
  function AbsenceDrawer({ onClose }) {
    const { toast } = window.useM();
    const [type, setType] = useState('syk');
    const [from, setFrom] = useState('2026-05-30');
    const [to, setTo] = useState('2026-05-30');
    const [note, setNote] = useState('');
    const send = () => { toast('Fraværssøknad sendt'); onClose(); };
    return (
      <DrawerShell title="Søk fravær" onClose={onClose}
        foot={<><button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={onClose}>Avbryt</button><button className="m-btn m-btn-primary m-full" onClick={send}><Ic n="send" s={16} /> Send søknad</button></>}>
        <div className="m-field"><span>Type</span><Seg full value={type} set={setType} options={[['syk', 'Sykdom'], ['ferie', 'Ferie'], ['perm', 'Permisjon'], ['annet', 'Annet']]} /></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label className="m-field" style={{ flex: 1 }}><span>Fra</span><input className="m-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="m-field" style={{ flex: 1 }}><span>Til</span><input className="m-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>
        <label className="m-field"><span>Kommentar <small style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--muted-soft)' }}>(valgfritt)</small></span><textarea className="m-input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Tilleggsinfo til leder" /></label>
        <div className="m-bot" style={{ padding: '12px 14px' }}><div className="m-bot-body" style={{ fontSize: 12.5 }}>Du har <b>19 feriedager</b> igjen i år. Leder får søknaden i innboksen og svarer i Meldinger.</div></div>
      </DrawerShell>
    );
  }
  window.MAbsenceDrawer = AbsenceDrawer;

  // =========================================================================
  // NY MELDING — pick recipient, then open the chat                      [cc-8]
  // =========================================================================
  const MSG_RECIPIENTS = [
    { id: 'c1', name: 'Sal-teamet', group: true, color: 'var(--dept-sal)', sub: '5 medlemmer' },
    { id: 'c2', name: 'Kjøkken', group: true, color: 'var(--dept-kjokken)', sub: '4 medlemmer' },
    { id: 'ma2', name: 'Hele Bistro Nord', group: true, color: 'var(--info)', sub: '14 medlemmer' },
    { id: 'jh', name: 'Jonas H.', sub: 'Kokk' },
    { id: 'sl', name: 'Selma L.', sub: 'Servitør' },
    { id: 'pk', name: 'Petter K.', sub: 'Servitør' },
  ];
  function NewMessageDrawer({ onClose, onOpenChat }) {
    const [q, setQ] = useState('');
    const list = MSG_RECIPIENTS.filter(r => r.name.toLowerCase().includes(q.toLowerCase()));
    return (
      <DrawerShell title="Ny melding" onClose={onClose}>
        <div className="m-searchbar"><Ic n="search" s={17} c="var(--muted)" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Søk etter person eller gruppe" /></div>
        <div className="m-field" style={{ gap: 6 }}><span>Velg mottaker</span></div>
        <div className="m-card m-flush">
          {list.map(r => (
            <button key={r.id} className="m-row" style={{ width: '100%' }} onClick={() => onOpenChat(r.id)}>
              <span className="m-avatar" style={{ background: r.group ? r.color : (D.USERS[r.id]?.color || 'var(--muted)'), width: 40, height: 40, fontSize: 13 }}>{r.group ? <Ic n="users" s={17} c="#fff" /> : (D.USERS[r.id]?.initials || r.name.slice(0, 2))}</span>
              <div className="m-row-body"><div className="m-row-title">{r.name}</div><div className="m-row-sub">{r.sub}</div></div>
              <span className="m-row-go"><Ic n="chevRight" s={18} /></span>
            </button>
          ))}
          {list.length === 0 && <div className="m-empty" style={{ padding: 24 }}><b>Ingen treff</b></div>}
        </div>
      </DrawerShell>
    );
  }
  window.MNewMessageDrawer = NewMessageDrawer;

  // =========================================================================
  // LEGG UT / ØNSK VAKT — offer one of your shifts, or request to work   [cc-6]
  // =========================================================================
  const MY_SHIFTS = [
    { id: 'ms1', day: 'Tirsdag 27. mai', time: '08:00–16:00', role: 'Servitør · Sal' },
    { id: 'ms2', day: 'Torsdag 29. mai', time: '14:00–22:00', role: 'Servitør · Sal' },
    { id: 'ms3', day: 'Lørdag 31. mai', time: '12:00–20:00', role: 'Servitør · Sal' },
  ];
  function ShiftOfferDrawer({ onClose, mode: initMode }) {
    const { toast } = window.useM();
    const [mode, setMode] = useState(initMode === 'wish' ? 'wish' : 'offer');
    const [pick, setPick] = useState(null);
    const [note, setNote] = useState('');
    const [day, setDay] = useState('2026-06-02');
    const submit = () => {
      if (mode === 'offer') { if (!pick) { toast('Velg en vakt'); return; } toast('Vakt lagt ut i vaktbørsen'); }
      else { toast('Vaktønske sendt til leder'); }
      onClose();
    };
    return (
      <DrawerShell title={mode === 'offer' ? 'Legg ut vakt' : 'Ønsk vakt'} onClose={onClose}
        foot={<><button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={onClose}>Avbryt</button><button className="m-btn m-btn-primary m-full" onClick={submit}><Ic n={mode === 'offer' ? 'swap' : 'plus'} s={16} /> {mode === 'offer' ? 'Legg ut i vaktbørs' : 'Send ønske'}</button></>}>
        <Seg full value={mode} set={setMode} options={[['offer', 'Legg ut vakt'], ['wish', 'Ønsk vakt']]} />
        {mode === 'offer' ? (
          <div className="m-field"><span>Hvilken vakt vil du tilby?</span>
            <div className="m-card m-flush">
              {MY_SHIFTS.map(s => (
                <button key={s.id} className="m-row" style={{ width: '100%' }} onClick={() => setPick(s.id)}>
                  <span className={cls('m-radio', pick === s.id && 'on')} />
                  <div className="m-row-body"><div className="m-row-title">{s.day}</div><div className="m-row-sub">{s.time} · {s.role}</div></div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <label className="m-field"><span>Når vil du jobbe?</span><input className="m-input" type="date" value={day} onChange={e => setDay(e.target.value)} /></label>
            <div className="m-field"><span>Tilgjengelighet</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Hele dagen', 'Dagtid', 'Kveld', 'Helg', 'På kort varsel'].map(c => <span key={c} className="m-chip">{c}</span>)}
              </div>
            </div>
          </>
        )}
        <label className="m-field"><span>Melding <small style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--muted-soft)' }}>(valgfritt)</small></span><textarea className="m-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={mode === 'offer' ? 'F.eks. «Bytter gjerne mot en kveldsvakt»' : 'F.eks. «Ønsker flere vakter i juni»'} /></label>
      </DrawerShell>
    );
  }
  window.MShiftOfferDrawer = ShiftOfferDrawer;

  // ---------- generic bottom-drawer shell ----------
  function DrawerShell({ title, onClose, children, foot }) {
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '92%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>{title}</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
          {foot && <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>{foot}</div>}
        </div>
      </div>
    );
  }

  // ---------- punch-in action surfaces (note / tillegg / call) ----------
  function PunchNote({ onClose }) {
    const { toast } = window.useM();
    const [v, setV] = useState('');
    return (
      <div className="m-sheet-scrim" style={{ zIndex: 53 }} onClick={onClose}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '78%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Vaktnotat</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="m-field"><span>Notat for vakten</span><textarea className="m-input" rows={4} value={v} onChange={e => setV(e.target.value)} placeholder="F.eks. «Kjøl 3 bråker — meldt til vedlikehold»" autoFocus /></label>
            <div className="m-bot" style={{ padding: '12px 14px' }}><div className="m-bot-body" style={{ fontSize: 12.5 }}>Notatet legges på vakten og er synlig for neste skift og leder.</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={onClose}>Avbryt</button>
            <button className="m-btn m-btn-primary m-full" onClick={() => { if (!v.trim()) { toast('Skriv et notat'); return; } toast('Notat lagret på vakten'); onClose(); }}><Ic n="check" s={16} /> Lagre notat</button>
          </div>
        </div>
      </div>
    );
  }
  function PunchTillegg({ onClose }) {
    const { toast } = window.useM();
    const [type, setType] = useState('overtid');
    const [mins, setMins] = useState('30');
    const [note, setNote] = useState('');
    return (
      <div className="m-sheet-scrim" style={{ zIndex: 53 }} onClick={onClose}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '82%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Registrer tillegg</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="m-field"><span>Type tillegg</span>
              <div className="m-seg m-seg-full">
                {[['overtid', 'Overtid'], ['kveld', 'Kveld'], ['helg', 'Helg'], ['annet', 'Annet']].map(([id, l]) => <button key={id} className={type === id ? 'is-active' : ''} onClick={() => setType(id)}>{l}</button>)}
              </div>
            </div>
            <label className="m-field"><span>Antall minutter</span><input className="m-input" type="number" value={mins} onChange={e => setMins(e.target.value)} /></label>
            <label className="m-field"><span>Begrunnelse</span><textarea className="m-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Hvorfor påløp tillegget?" /></label>
            <div className="m-bot" style={{ padding: '12px 14px' }}><div className="m-bot-body" style={{ fontSize: 12.5 }}>Tillegget sendes til leder for godkjenning og dukker opp på lønnsgrunnlaget ditt.</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-ghost" style={{ flex: '0 0 auto' }} onClick={onClose}>Avbryt</button>
            <button className="m-btn m-btn-primary m-full" onClick={() => { toast('Tillegg sendt til godkjenning'); onClose(); }}><Ic n="send" s={16} /> Send til godkjenning</button>
          </div>
        </div>
      </div>
    );
  }
  function PunchCall({ onClose }) {
    const { toast } = window.useM();
    const [state, setState] = useState('ringing'); // ringing | connected
    const [secs, setSecs] = useState(0);
    useEffect(() => {
      const r = setTimeout(() => setState('connected'), 2200);
      return () => clearTimeout(r);
    }, []);
    useEffect(() => {
      if (state !== 'connected') return;
      const t = setInterval(() => setSecs(s => s + 1), 1000);
      return () => clearInterval(t);
    }, [state]);
    return (
      <div className="m-call">
        <div className="m-call-main">
          <span className="m-call-ava"><Ic n="shield" s={40} c="#fff" /></span>
          <div className="m-call-name">Vaktleder</div>
          <div className="m-call-status">{state === 'ringing' ? 'Ringer…' : `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`}</div>
        </div>
        <div className="m-call-actions">
          <button className="m-call-btn" onClick={() => toast(state === 'connected' ? 'Mikrofon av' : '')}><Ic n="bell" s={22} c="#fff" /><span>Demp</span></button>
          <button className="m-call-end" onClick={() => { onClose(); }}><Ic n="phone" s={26} c="#fff" /></button>
          <button className="m-call-btn" onClick={() => toast('Høyttaler på')}><Ic n="video" s={22} c="#fff" /><span>Video</span></button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // CLOCK-OUT FLOW — confirm utstempling → handoff → (oppgjør if ansvarlig)  [cc-1]
  // =========================================================================
  const STATIONS = [['sal', 'Sal'], ['kjokken', 'Kjøkken'], ['bar', 'Bar'], ['vert', 'Vertskap'], ['renhold', 'Renhold']];
  function ClockOutFlow({ session, onClose, onDone }) {
    const { toast } = window.useM();
    const responsible = true; // Maria er vaktansvarlig → kjører oppgjør
    const elapsedMs = Math.max(0, session.inAt ? Date.now() - session.inAt : 0);
    const eh = Math.floor(elapsedMs / 3600000), em = Math.floor((elapsedMs % 3600000) / 60000);
    const hoursLabel = `${eh}t ${pad(em)}m`;
    const steps = ['bekreft', 'hvor', 'handoff'].concat(responsible ? ['oppgjor'] : []).concat(['ferdig']);
    const [si, setSi] = useState(0);
    const step = steps[si];
    const stepNo = si + 1;
    // form state
    const [station, setStation] = useState('sal');
    const [planOk, setPlanOk] = useState('ja');
    const [handoff, setHandoff] = useState('');
    const [avvik, setAvvik] = useState('nei');
    const [avvikOpen, setAvvikOpen] = useState(false);
    const [cash, setCash] = useState('4200');
    const expectedCash = 4150;
    const diff = (parseInt(cash || '0', 10) || 0) - expectedCash;
    const next = () => { if (si < steps.length - 1) setSi(si + 1); else onDone(); };
    const back = () => { if (si > 0) setSi(si - 1); else onClose(); };
    const TITLES = { bekreft: 'Stemple ut', hvor: 'Hvor jobbet du?', handoff: 'Overlevering', oppgjor: 'Kassaoppgjør', ferdig: 'Vakt fullført' };

    return (
      <div className="m-flow" style={{ zIndex: 55 }}>
        <div className="m-flow-head">
          <button className="m-iconbtn" onClick={back} aria-label="Tilbake"><Ic n={si === 0 ? 'x' : 'chevLeft'} s={22} /></button>
          <div className="m-flow-htitle">{TITLES[step]}</div>
          <span className="m-flow-badge">{step === 'ferdig' ? 'FERDIG' : `${stepNo}/${steps.length}`}</span>
        </div>
        <div className="m-flow-body">
          {step !== 'ferdig' && <div className="m-flow-dots" style={{ marginBottom: 18 }}>{steps.map((_, j) => <span key={j} className={cls('m-flow-dot', j <= si && 'on', j === si && 'cur')} />)}</div>}

          {step === 'bekreft' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="m-cout-hours">
                <span className="m-cout-hours-l">DU HAR JOBBET</span>
                <span className="m-cout-hours-v mono">{hoursLabel}</span>
                <span className="m-cout-hours-s">{session.info?.role || 'Servitør · Sal'} · stemplet inn {session.inAt ? `${pad(new Date(session.inAt).getHours())}:${pad(new Date(session.inAt).getMinutes())}` : '–'}</span>
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--muted)' }}>Du er i ferd med å stemple ut. Vi tar deg gjennom en kort overlevering{responsible ? ' og kassaoppgjør' : ''} før vakten avsluttes.</p>
            </div>
          )}

          {step === 'hvor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14.5, color: 'var(--muted)' }}>Bekreft hvor du har vært i dag — det knytter timene til riktig avdeling.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                {STATIONS.map(([id, l]) => <button key={id} className={cls('m-chip', station === id && 'on')} onClick={() => setStation(id)} style={{ height: 40, padding: '0 16px', fontSize: 14 }}>{station === id && <Ic n="check" s={14} sw={3} />} {l}</button>)}
              </div>
            </div>
          )}

          {step === 'handoff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="m-field"><span>Gikk alt etter planen?</span><div className="m-seg m-seg-full"><button className={planOk === 'ja' ? 'is-active' : ''} onClick={() => setPlanOk('ja')}>Ja</button><button className={planOk === 'nei' ? 'is-active' : ''} onClick={() => setPlanOk('nei')}>Nei</button></div></div>
              <label className="m-field"><span>Noe neste skift bør vite?</span><textarea className="m-input" rows={3} value={handoff} onChange={e => setHandoff(e.target.value)} placeholder="F.eks. «Kjøl 3 bråker», «Tom for husets hvitvin»" /></label>
              <div className="m-field"><span>Avvik å melde?</span><div className="m-seg m-seg-full"><button className={avvik === 'nei' ? 'is-active' : ''} onClick={() => setAvvik('nei')}>Nei</button><button className={avvik === 'ja' ? 'is-active' : ''} onClick={() => setAvvik('ja')}>Ja</button></div>
                {avvik === 'ja' && <button className="m-btn m-btn-ghost m-btn-block" style={{ marginTop: 8 }} onClick={() => setAvvikOpen(true)}><Ic n="alert" s={16} /> Meld avvik nå</button>}
              </div>
            </div>
          )}

          {step === 'oppgjor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="m-bot" style={{ padding: '12px 14px' }}><div className="m-bot-body" style={{ fontSize: 12.5 }}>Du er <b>vaktansvarlig</b> i dag, så du gjør kassaoppgjøret. Tell kontantbeholdningen og bekreft.</div></div>
              <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="m-cout-row"><span>Forventet kontant</span><b className="mono">{fmtKr(expectedCash)} kr</b></div>
                <div className="m-cout-row"><span>Kortbetalinger</span><b className="mono">18 940 kr</b></div>
                <label className="m-field"><span>Talt kontant</span><input className="m-input" type="number" value={cash} onChange={e => setCash(e.target.value)} /></label>
                <div className="m-cout-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <span>Differanse</span>
                  <b className="mono" style={{ color: diff === 0 ? 'var(--success)' : Math.abs(diff) > 100 ? 'var(--error)' : 'var(--warning)' }}>{diff > 0 ? '+' : ''}{fmtKr(diff)} kr</b>
                </div>
              </div>
            </div>
          )}

          {step === 'ferdig' && (
            <div className="m-flow-done">
              <RingBig pct={1} label="UTSTEMPLET" />
              <h1>Takk for vakten!</h1>
              <p>Du jobbet <b>{hoursLabel}</b>. Overleveringen er sendt til neste skift{responsible ? ', og kassaoppgjøret er levert' : ''}.</p>
              <div className="m-card m-flush" style={{ width: '100%', marginTop: 6 }}>
                <div className="m-row"><span className="m-row-ic" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Ic n="clock" s={16} /></span><div className="m-row-body"><div className="m-row-title">Timer registrert</div></div><b className="mono">{hoursLabel}</b></div>
                <div className="m-row"><span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--success) 13%, transparent)', color: 'var(--success)' }}><Ic n="send" s={16} /></span><div className="m-row-body"><div className="m-row-title">Overlevering sendt</div></div><Ic n="check" s={16} c="var(--success)" /></div>
                {responsible && <div className="m-row"><span className="m-row-ic" style={{ background: 'color-mix(in oklab, var(--info) 13%, transparent)', color: 'var(--info)' }}><Ic n="wallet" s={16} /></span><div className="m-row-body"><div className="m-row-title">Kassaoppgjør levert</div></div><Ic n="check" s={16} c="var(--success)" /></div>}
              </div>
            </div>
          )}
        </div>
        <div className="m-flow-foot">
          {step === 'bekreft' && <button className="m-btn m-btn-primary m-btn-block" onClick={next}><Ic n="logout" s={16} /> Stemple ut</button>}
          {(step === 'hvor' || step === 'handoff') && <button className="m-btn m-btn-primary m-btn-block" onClick={next}>Neste <Ic n="arrowRight" s={16} /></button>}
          {step === 'oppgjor' && <button className="m-btn m-btn-primary m-btn-block" onClick={() => { toast('Kassaoppgjør levert'); next(); }}><Ic n="check" s={16} /> Bekreft oppgjør</button>}
          {step === 'ferdig' && <button className="m-btn m-btn-primary m-btn-block" onClick={onDone}><Ic n="check" s={17} /> Ferdig</button>}
        </div>
        {/* deviation report opens above the clock-out flow (own stacking context > z55) */}
        {avvikOpen && window.MDeviationDrawer && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
            <window.MDeviationDrawer onClose={() => setAvvikOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // PUNCH-IN — bold full-screen takeover. Make it feel great.            [cc-4]
  // =========================================================================
  function PunchScreen({ shift, onClose }) {
    const { toast, session, clockIn, clockOut } = window.useM();
    const active = session.clockedIn;
    const sh = (active && session.info && session.info.role) ? session.info : (shift || { role: 'Servitør · Sal', start: '14:00', end: '22:00', loc: 'Bistro Nord' });
    const [phase, setPhase] = useState('ready'); // ready | punching  (the on-shift state lives in session)
    const [now, setNow] = useState(Date.now());
    const [sheet, setSheet] = useState(null); // 'note' | 'tillegg' | 'call'
    const [onBreak, setOnBreak] = useState(false);
    const [flowOut, setFlowOut] = useState(false);
    const breakRef = useRef(null);
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

    const clock = new Date(now);
    const hhmm = `${pad(clock.getHours())}:${pad(clock.getMinutes())}`;
    const ss = pad(clock.getSeconds());

    const punch = () => {
      if (active || phase !== 'ready') return;
      setPhase('punching');
      setTimeout(() => { clockIn(sh); setPhase('ready'); }, 820);
    };
    const inAt = session.inAt ? new Date(session.inAt) : null;
    const elapsedMs = Math.max(0, session.inAt ? now - session.inAt : 0);
    const eh = Math.floor(elapsedMs / 3600000), em = Math.floor((elapsedMs % 3600000) / 60000), es = Math.floor((elapsedMs % 60000) / 1000);
    const breakMs = Math.max(0, breakRef.current ? now - breakRef.current : 0);
    const bm = Math.floor(breakMs / 60000), bs = Math.floor((breakMs % 60000) / 1000);

    const startBreak = () => { breakRef.current = Date.now(); setNow(Date.now()); setOnBreak(true); };
    const endBreak = () => { setOnBreak(false); breakRef.current = null; toast('Tilbake på vakt'); };
    const doAction = (id) => {
      if (id === 'pause') startBreak();
      else setSheet(id);
    };

    const R = 96, C = 2 * Math.PI * R;
    const filling = phase !== 'ready';

    const actions = [
      { id: 'pause', icon: 'pause', label: 'Pause' },
      { id: 'note', icon: 'file', label: 'Notat' },
      { id: 'tillegg', icon: 'plus', label: 'Tillegg' },
      { id: 'call', icon: 'phone', label: 'Ring leder' },
    ];

    return (
      <div className={cls('m-punch', active && 'is-active')}>
        {/* top bar */}
        <div className="m-punch-top">
          <button className="m-iconbtn" onClick={onClose} style={{ color: '#fff' }} aria-label="Lukk"><Ic n="chevDown" s={24} /></button>
          <span className="m-punch-ws">BISTRO NORD</span>
          <span className="m-punch-gps"><span className="m-punch-gps-dot" /> På plass</span>
        </div>

        {!active ? (
          <div className="m-punch-main">
            <div className="m-punch-clock"><span className="m-punch-hhmm">{hhmm}</span><span className="m-punch-ss">{ss}</span></div>
            <div className="m-punch-date">Fredag 30. mai</div>

            <div className="m-punch-shift">
              <span className="m-punch-role">{sh.role}</span>
              <span className="m-punch-time">{sh.start}<span style={{ opacity: .55 }}> – {sh.end}</span></span>
            </div>

            <button className="m-punch-btn" onClick={punch} disabled={filling} aria-label="Stemple inn">
              <svg className="m-punch-ring" width="232" height="232" viewBox="0 0 232 232">
                <circle cx="116" cy="116" r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="6" />
                <circle cx="116" cy="116" r={R} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={filling ? 0 : C} transform="rotate(-90 116 116)"
                  style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(.2,.7,.2,1)' }} />
              </svg>
              <span className="m-punch-btn-in">
                <Ic n="fingerprint" s={40} c="#fff" sw={1.6} />
                <b>{phase === 'punching' ? 'STEMPLER INN…' : 'STEMPLE INN'}</b>
              </span>
            </button>
            <div className="m-punch-hint">{phase === 'punching' ? 'Registrerer oppmøte' : 'Trykk for å starte vakten'}</div>
          </div>
        ) : onBreak ? (
          <div className="m-punch-main">
            <div className="m-punch-live" style={{ color: 'rgba(255,255,255,.92)' }}><Ic n="pause" s={16} c="#fff" /> PÅ PAUSE</div>
            <div className="m-punch-elapsed">{pad(bm)}:{pad(bs)}<span className="m-punch-elapsed-s"> min</span></div>
            <div className="m-punch-date">Vakta fortsetter når du er tilbake</div>
            <button className="m-btn m-btn-light m-solid m-btn-block m-punch-out" onClick={endBreak}><Ic n="play" s={16} /> Avslutt pause</button>
          </div>
        ) : (
          <div className="m-punch-main">
            <div className="m-punch-live"><span className="m-shift-live" /> PÅ VAKT</div>
            <div className="m-punch-elapsed">{pad(eh)}:{pad(em)}<span className="m-punch-elapsed-s">:{pad(es)}</span></div>
            <div className="m-punch-date">Stemplet inn kl. {inAt ? `${pad(inAt.getHours())}:${pad(inAt.getMinutes())}` : '–'} · {sh.role}</div>

            <div className="m-punch-actions">
              {actions.map(a => (
                <button key={a.id} className="m-punch-act" onClick={() => doAction(a.id)}>
                  <span className="m-punch-act-ic"><Ic n={a.icon} s={22} c="#fff" /></span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>

            <button className="m-btn m-btn-light m-solid m-btn-block m-punch-out" onClick={() => setFlowOut(true)}>
              <Ic n="logout" s={17} /> Stemple ut
            </button>
          </div>
        )}

        {sheet === 'note' && <PunchNote onClose={() => setSheet(null)} />}
        {sheet === 'tillegg' && <PunchTillegg onClose={() => setSheet(null)} />}
        {sheet === 'call' && <PunchCall onClose={() => setSheet(null)} />}
        {flowOut && <ClockOutFlow session={session} onClose={() => setFlowOut(false)} onDone={() => { clockOut(); onClose(); }} />}
      </div>
    );
  }
  window.MPunchScreen = PunchScreen;

  // =========================================================================
  // PROFILE — team-member profile card (full-cover screen). Ported from the
  // product repo's mobile team/[id] screen + web ansatte profile, in .m-* form.
  // New starters get a «Send en gratulasjon» CTA → a card-picker drawer.
  // =========================================================================
  const U = D.USERS;
  // mobile-side profile enrichment (cast is shared; detail is mobile-only,
  // mirroring the web ansatte-data record so the identity card matches web).
  const PROFILE = {
    ma: { role: 'Driftsleder', dept: 'Drift · Ledelse', depts: ['Admin', 'Sal', 'Bar'], email: 'maria.a@bistronord.no', phone: '+47 901 22 776', address: 'Storgata 14, 0184 Oslo', started: '1. aug 2023', no: 'BN-0142', code: 'PRF-7K2A', status: 'active', access: 'admin', authority: 'leder', language: 'Norsk (bokmål)', sync: true, readiness: [14, 14], teams: ['Ledelse', 'HMS-utvalg', 'Sal helg'], bio: 'Driftsleder på Bistro Nord. Brenner for gode vakter og et team som trives. Tar gjerne en prat — kom innom kontoret.', shifts: true },
    jh: { role: 'Sous-chef', dept: 'Kjøkken', depts: ['Kjøkken'], email: 'jonas.h@bistronord.no', phone: '+47 905 33 118', address: 'Maridalsveien 8, 0178 Oslo', started: '3. sep 2022', no: 'BN-0118', code: 'PRF-3M9C', status: 'active', access: 'employee', authority: 'stedfortreder', language: 'Norsk (bokmål)', sync: true, readiness: [12, 12], teams: ['Kjøkken', 'HACCP-ansvarlig'], bio: 'Sous-chef og HACCP-ansvarlig. Liker rene rutiner og rolige stengeskift.', shifts: true },
    sl: { role: 'Servitør', dept: 'Sal', depts: ['Sal'], email: 'selma.lie@bistronord.no', phone: '+47 412 88 201', address: 'Thorvald Meyers gate 2, 0555 Oslo', started: '15. jan 2024', no: 'BN-0131', code: 'PRF-5T1B', status: 'active', access: 'employee', authority: 'vakt', language: 'Norsk (bokmål)', sync: true, readiness: [9, 9], teams: ['Servering', 'Vinteråpent'], bio: 'Servitør på sal. Tilgjengelig for ekstravakter i helgene.', shifts: true },
    pk: { role: 'Servitør', dept: 'Sal', depts: ['Sal'], email: 'petter.k@bistronord.no', phone: '+47 468 70 559', address: 'Sofienberggata 9, 0558 Oslo', started: '28. mai 2026', no: 'BN-0150', code: 'PRF-9P4D', status: 'trainee', isNew: true, access: 'employee', authority: 'vakt', language: 'Norsk (bokmål)', sync: false, readiness: [2, 6], teams: ['Servering'], bio: '', shifts: false },
    ib: { role: 'Renholder', dept: 'Renhold', depts: ['Renhold'], email: 'ida.berg@bistronord.no', phone: '+47 922 14 087', address: 'Markveien 35, 0554 Oslo', started: '1. sep 2023', no: 'BN-0127', code: 'PRF-6R3F', status: 'active', access: 'employee', authority: 'vakt', language: 'Norsk (bokmål)', sync: true, readiness: [7, 8], teams: ['Renhold'], bio: '', shifts: true },
  };
  const STATUS = {
    active: { label: 'Aktiv', color: 'var(--success)' },
    trainee: { label: 'Under opplæring', color: 'var(--warning)' },
    inactive: { label: 'Inaktiv', color: 'var(--muted)' },
  };
  // access level (platform) + authority (operational rank) → pill style, from web vocab
  const ACCESS = {
    admin: { label: 'Admin', color: '#864ad2' }, owner: { label: 'Eier', color: 'var(--orange)' },
    manager: { label: 'Leder', color: 'var(--info)' }, employee: { label: 'Ansatt', color: 'var(--muted)' },
  };
  const AUTH = {
    leder: { label: 'Leder', color: 'var(--orange)', icon: 'star' },
    stedfortreder: { label: 'Stedfortreder', color: 'var(--info)', icon: 'shield' },
    vakt: { label: 'Vakt', color: 'var(--muted)', icon: 'user' },
  };
  const LANGS = ['Norsk (bokmål)', 'Norsk (nynorsk)', 'English', 'Polski', 'Svenska', 'Lietuvių'];
  // the «vegg» — a small per-person activity wall
  const WALL = {
    ma: [
      { ic: 'check', tone: 'var(--success)', t: 'Fullførte stengerutine · Sal', m: 'I går · 23:10' },
      { ic: 'cap', tone: 'var(--info)', t: 'Bestod Brannvern-oppfriskning', m: '3 dager siden' },
      { ic: 'star', tone: 'var(--orange)', t: 'Selma sendte deg en takk for godt skift', m: '5 dager siden' },
      { ic: 'shield', tone: '#864ad2', t: 'Tilgangsnivå satt til Admin', m: '20. jan 2025' },
    ],
    jh: [
      { ic: 'thermometer', tone: 'var(--info)', t: 'Loggførte kjøletemperaturer (4 punkter)', m: 'I dag · 08:20' },
      { ic: 'check', tone: 'var(--success)', t: 'Fullførte mottakskontroll · Bama', m: 'I går' },
    ],
    sl: [
      { ic: 'check', tone: 'var(--success)', t: 'Fullførte kveldsvakt · Sal', m: 'I går · 22:40' },
      { ic: 'swap', tone: 'var(--orange)', t: 'Tok ekstravakt for Petter', m: '4 dager siden' },
    ],
    pk: [
      { ic: 'sparkle', tone: 'var(--orange)', t: 'Startet som lærling · velkommen!', m: '28. mai' },
    ],
    ib: [
      { ic: 'check', tone: 'var(--success)', t: 'Fullførte renholdsrunde', m: 'I dag · 06:30' },
    ],
  };

  // gratulasjonskort — 3-4 picks
  const GRAT_CARDS = [
    { id: 'velkommen', emoji: '🎉', accent: 'var(--orange)', title: 'Velkommen i teamet!', msg: 'Så glad for å ha deg med på laget.' },
    { id: 'start', emoji: '👏', accent: 'var(--success)', title: 'Gratulerer med starten!', msg: 'Stå på — dette kommer til å gå kjempebra.' },
    { id: 'stjerne', emoji: '⭐', accent: 'var(--warning)', title: 'Du gjør det allerede bra', msg: 'Heia, ny kollega — vi heier på deg!' },
    { id: 'kaffe', emoji: '☕', accent: 'var(--info)', title: 'Kaffe på meg?', msg: 'Ta en prat når du har lyst.' },
  ];

  function GratulasjonDrawer({ user, onClose }) {
    const { toast } = window.useM();
    const [pick, setPick] = useState('velkommen');
    const first = user.name.split(' ')[0];
    const send = () => {
      const card = GRAT_CARDS.find(c => c.id === pick);
      onClose();
      toast(`Gratulasjon sendt til ${first} ${card.emoji}`, { undo: () => toast('Angret') });
    };
    return (
      <div className="m-sheet-scrim" style={{ zIndex: 53 }} onClick={onClose}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Send en gratulasjon</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="m-grat-lead">Velg et kort til <b>{first}</b>:</p>
            <div className="m-grat-list">
              {GRAT_CARDS.map(c => (
                <button key={c.id} className={cls('m-grat-card', pick === c.id && 'is-sel')} style={{ '--ga': c.accent }} onClick={() => setPick(c.id)}>
                  <span className="m-grat-emoji" style={{ background: `color-mix(in oklab, ${c.accent} 16%, transparent)` }}>{c.emoji}</span>
                  <span className="m-grat-text"><b>{c.title}</b><span>{c.msg}</span></span>
                  <span className="m-grat-radio"><Ic n="check" s={13} sw={3} /></span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-primary m-full" onClick={send}><Ic n="send" s={16} /> Send til {first}</button>
          </div>
        </div>
      </div>
    );
  }

  function ProfileScreen({ shift, onClose }) {
    const { toast, ME, navigate, openOverlay } = window.useM();
    const id = shift && shift.id;
    const u = U[id];
    const isSelf = id === ME.id;
    const [grat, setGrat] = useState(false);
    const [editing, setEditing] = useState(false);
    if (!u) return (
      <div className="m-vakt"><div className="m-vakt-head"><button className="m-iconbtn" onClick={onClose}><Ic n="chevDown" s={24} /></button><div className="m-vakt-htitle">Profil</div><span /></div><div className="m-vakt-body"><div className="m-card"><div className="m-empty" style={{ padding: 28 }}><Ic n="users" s={28} /><b>Fant ikke profil</b></div></div></div></div>
    );
    const base = PROFILE[id] || { role: u.role, dept: u.role, depts: [], email: '', phone: '', address: '', started: '', no: '', code: '', status: 'active', access: 'employee', authority: 'vakt', language: 'Norsk (bokmål)', sync: true, readiness: [0, 0], teams: [], bio: '', shifts: true };
    // editable working copy (session-local)
    const [pf, setPf] = useState(base);
    const [posts, setPosts] = useState([]);
    const [draft, setDraft] = useState('');
    const st = STATUS[pf.status] || STATUS.active;
    const acc = ACCESS[pf.access] || ACCESS.employee;
    const auth = AUTH[pf.authority] || AUTH.vakt;
    const [done, total] = pf.readiness;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const ready = total > 0 && done >= total;
    const ringColor = ready ? 'var(--success)' : pct > 0 ? 'var(--warning)' : 'var(--muted-soft)';
    const first = u.name.split(' ')[0];
    const wall = [...posts, ...(WALL[id] || [])];

    const post = () => { if (!draft.trim()) return; setPosts(p => [{ ic: 'message', tone: 'var(--orange)', t: draft.trim(), m: 'Akkurat nå' }, ...p]); setDraft(''); toast('Delt på veggen'); };

    // ---- EDIT MODE ----
    if (editing) {
      const set = (k) => (e) => setPf(s => ({ ...s, [k]: e.target.value }));
      const save = () => { setEditing(false); toast('Profil oppdatert', { undo: () => setPf(base) }); };
      return (
        <div className="m-vakt" role="dialog" aria-label="Rediger profil">
          <div className="m-vakt-head">
            <button className="m-iconbtn" onClick={() => { setPf(base); setEditing(false); }} aria-label="Avbryt"><Ic n="x" s={22} /></button>
            <div className="m-vakt-htitle">Rediger profil</div>
            <span />
          </div>
          <div className="m-vakt-body">
            <div className="m-edit-ava">
              <span className="m-avatar m-prof-ava" style={{ background: u.color }}>{u.initials}</span>
              <button className="m-edit-avabtn" onClick={() => toast('Bildevelger åpnet')}><Ic n="camera" s={15} /> Endre bilde</button>
            </div>
            <label className="m-field"><span>Visningsnavn</span><input className="m-input" value={pf.displayName != null ? pf.displayName : u.name} onChange={set('displayName')} /></label>
            <label className="m-field"><span>Stilling</span><input className="m-input" value={pf.role} onChange={set('role')} /></label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label className="m-field" style={{ flex: 1 }}><span>Telefon</span><input className="m-input" type="tel" value={pf.phone} onChange={set('phone')} /></label>
            </div>
            <label className="m-field"><span>E-post</span><input className="m-input" type="email" value={pf.email} onChange={set('email')} /></label>
            <label className="m-field"><span>Adresse</span><input className="m-input" value={pf.address} onChange={set('address')} placeholder="Gate, postnr. sted" /></label>
            <label className="m-field"><span>Språk</span>
              <select className="m-input" value={pf.language} onChange={set('language')}>{LANGS.map(l => <option key={l} value={l}>{l}</option>)}</select>
            </label>
            <label className="m-field"><span>Om meg</span><textarea className="m-input" rows={3} value={pf.bio} onChange={set('bio')} placeholder="Skriv en kort intro til teamet…" /></label>
            <div className="m-field"><span>Tilgjengelig for ekstravakter</span>
              <div className="m-seg m-seg-full">
                <button className={pf.shifts ? 'is-active' : ''} onClick={() => setPf(s => ({ ...s, shifts: true }))}>Ja</button>
                <button className={!pf.shifts ? 'is-active' : ''} onClick={() => setPf(s => ({ ...s, shifts: false }))}>Nei</button>
              </div>
            </div>
            <div className="m-bot" style={{ padding: '12px 14px' }}><div className="m-bot-body" style={{ fontSize: 12.5 }}>Tilgang, ansvar og avdeling styres av leder og kan ikke endres her.</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-ghost" style={{ flexShrink: 0 }} onClick={() => { setPf(base); setEditing(false); }}>Avbryt</button>
            <button className="m-btn m-btn-primary m-btn-block" style={{ flexShrink: 0 }} onClick={save}><Ic n="check" s={16} /> Lagre endringer</button>
          </div>
          {grat && <GratulasjonDrawer user={u} onClose={() => setGrat(false)} />}
        </div>
      );
    }

    // ---- VIEW MODE ----
    const name = pf.displayName || u.name;
    const InfoRow = ({ k, children }) => (
      <div className="m-inforow"><span className="k">{k}</span><span className="v">{children}</span></div>
    );
    const Tag = ({ color, icon, children }) => (
      <span className="m-tagpill" style={{ color, background: `color-mix(in oklab, ${color} 13%, transparent)` }}>{icon && <Ic n={icon} s={12.5} sw={2.2} />}{children}</span>
    );
    return (
      <div className="m-vakt" role="dialog" aria-label="Profil">
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="chevDown" s={24} /></button>
          <div className="m-vakt-htitle">{isSelf ? 'Min profil' : 'Profil'}</div>
          <button className="m-iconbtn" onClick={() => setEditing(true)} aria-label="Rediger"><Ic n="pen" s={19} /></button>
        </div>
        <div className="m-vakt-body">
          {/* identity card */}
          <div className="m-idcard" style={{ background: ready ? 'linear-gradient(180deg, color-mix(in oklab, var(--success) 8%, var(--card)), var(--card) 120px)' : 'var(--card)' }}>
            <div className="m-idcard-top">
              <span className="m-avatar m-prof-ava" style={{ background: u.color }}>{u.initials}</span>
              <h1 className="m-prof-name" style={{ textAlign: 'center' }}>{name}</h1>
              <div className="m-prof-meta">{pf.role} · {acc.label}</div>
              <div className="m-idcode mono">{pf.no}{pf.code ? '  ·  ' + pf.code : ''}</div>
              <div className="m-prof-badges">
                <span className="m-prof-status" style={{ color: st.color, background: `color-mix(in oklab, ${st.color} 13%, transparent)` }}><span className="m-prof-dot" style={{ background: st.color }} /> {st.label}</span>
                {pf.isNew && <span className="m-prof-status" style={{ color: 'var(--orange)', background: 'var(--orange-soft)' }}><Ic n="sparkle" s={12} /> Nyansatt</span>}
              </div>
            </div>
            {/* info grid */}
            <div className="m-infogrid">
              <InfoRow k="Tilgang"><Tag color={acc.color} icon="shield">{acc.label}</Tag></InfoRow>
              <InfoRow k="Ansvar"><Tag color={auth.color} icon={auth.icon}>{auth.label}</Tag></InfoRow>
              <InfoRow k="Avdeling"><span className="m-dept-v"><span className="m-prof-dot" style={{ background: 'var(--fg)' }} /> {pf.depts[0] || pf.dept}{pf.depts.length > 1 && <span className="m-dept-more">+{pf.depts.length - 1}</span>}</span></InfoRow>
              <InfoRow k="Språk"><span style={{ color: 'var(--orange)', fontWeight: 600 }}>{pf.language}</span></InfoRow>
              <InfoRow k="Ansatt">{pf.started}</InfoRow>
              <InfoRow k="Synk"><span style={{ color: pf.sync ? 'var(--success)' : 'var(--warning)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="m-prof-dot" style={{ background: pf.sync ? 'var(--success)' : 'var(--warning)' }} /> {pf.sync ? 'Synkronisert' : 'Venter på synk'}</span></InfoRow>
            </div>
            {/* readiness */}
            {total > 0 && (
              <div className="m-ready">
                <span className="m-ring" style={{ background: `conic-gradient(${ringColor} ${pct * 3.6}deg, color-mix(in oklab, ${ringColor} 16%, transparent) 0)` }}><span className="m-ring-hole" /></span>
                <div className="m-ready-txt">
                  <b style={{ color: ringColor }}>{ready ? 'Klar for vakt' : 'Ikke klar ennå'}</b>
                  <span>{ready ? 'Alle krav oppfylt' : `${total - done} av ${total} krav gjenstår`}</span>
                </div>
                {!ready && <button className="m-ready-link" onClick={() => { onClose(); navigate('trening'); }}>Se krav <Ic n="chevRight" s={13} /></button>}
              </div>
            )}
            {/* primary edit */}
            <button className="m-btn m-btn-primary m-btn-block" style={{ flexShrink: 0, marginTop: 2 }} onClick={() => setEditing(true)}><Ic n="pen" s={16} /> Rediger profil</button>
            {/* contextual actions */}
            <div className="m-actions3">
              {isSelf ? (
                <>
                  <button className="m-act" onClick={() => { openOverlay('payslip', { month: 'April 2026', amount: 35045, sub: 'Utbetalt 12. mai' }); }}><span className="m-act-ic" style={{ color: 'var(--orange)', background: 'var(--orange-soft)' }}><Ic n="wallet" s={19} /></span>Min lønn</button>
                  <button className="m-act" onClick={() => { onClose(); navigate('trening'); }}><span className="m-act-ic" style={{ color: 'var(--info)', background: 'color-mix(in oklab, var(--info) 13%, transparent)' }}><Ic n="cap" s={19} /></span>Opplæring</button>
                  <button className="m-act" onClick={() => openOverlay('settings')}><span className="m-act-ic" style={{ color: 'var(--muted)', background: 'var(--secondary)' }}><Ic n="settings" s={19} /></span>Innstillinger</button>
                </>
              ) : (
                <>
                  <a className="m-act" href={`tel:${(pf.phone || '').replace(/\s/g, '')}`}><span className="m-act-ic" style={{ color: 'var(--success)', background: 'color-mix(in oklab, var(--success) 14%, transparent)' }}><Ic n="phone" s={19} /></span>Ring</a>
                  <button className="m-act" onClick={() => { onClose(); navigate('chat'); }}><span className="m-act-ic" style={{ color: 'var(--info)', background: 'color-mix(in oklab, var(--info) 13%, transparent)' }}><Ic n="message" s={19} /></span>Melding</button>
                  <button className="m-act" onClick={() => toast(`Tildeling åpnet for ${first}`)}><span className="m-act-ic" style={{ color: 'var(--orange)', background: 'var(--orange-soft)' }}><Ic n="cap" s={19} /></span>Tildel</button>
                </>
              )}
            </div>
          </div>

          {/* new-starter celebration → congratulate CTA */}
          {pf.isNew && (
            <div className="m-prof-welcome">
              <div className="m-prof-welcome-top"><span className="m-prof-welcome-emoji">👋</span><div><b>{first} startet nettopp</b><span>Begynte {pf.started} · {first.endsWith('a') ? 'hennes' : 'hans'} første uker hos oss</span></div></div>
              <button className="m-btn m-btn-primary m-full" onClick={() => setGrat(true)}><Ic n="sparkle" s={16} /> Send en gratulasjon</button>
            </div>
          )}

          {/* bio */}
          {pf.bio && (
            <div>
              <div className="m-prof-sec">Om {isSelf ? 'meg' : first}</div>
              <div className="m-card" style={{ padding: 15, fontSize: 13.5, lineHeight: 1.5, color: 'var(--fg)' }}>{pf.bio}</div>
            </div>
          )}

          {/* kontakt */}
          {(pf.email || pf.phone || pf.address) && (
            <div>
              <div className="m-prof-sec">Kontakt</div>
              <div className="m-card m-flush">
                {pf.phone && <a className="m-prof-row" href={`tel:${pf.phone.replace(/\s/g, '')}`}><span className="m-prof-row-ic"><Ic n="phone" s={17} /></span><span className="m-prof-row-t">{pf.phone}</span><Ic n="chevRight" s={16} c="var(--muted)" /></a>}
                {pf.email && <a className="m-prof-row" href={`mailto:${pf.email}`}><span className="m-prof-row-ic"><Ic n="mail" s={17} /></span><span className="m-prof-row-t">{pf.email}</span><Ic n="chevRight" s={16} c="var(--muted)" /></a>}
                {pf.address && <div className="m-prof-row"><span className="m-prof-row-ic"><Ic n="mappin" s={17} /></span><span className="m-prof-row-t">{pf.address}</span></div>}
              </div>
            </div>
          )}

          {/* team */}
          {pf.teams.length > 0 && (
            <div>
              <div className="m-prof-sec">Team & lag</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pf.teams.map(t => <span key={t} className="m-prof-pill">{t}</span>)}
              </div>
            </div>
          )}

          {/* the wall */}
          <div>
            <div className="m-prof-sec">Vegg</div>
            <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
              {isSelf && (
                <div className="m-wall-compose">
                  <span className="m-avatar" style={{ background: u.color, width: 34, height: 34, fontSize: 12.5, flex: '0 0 auto' }}>{u.initials}</span>
                  <input className="m-wall-input" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && post()} placeholder="Del en oppdatering med teamet…" />
                  <button className="m-iconbtn m-wall-send" style={{ background: draft.trim() ? 'var(--orange)' : 'var(--secondary)', color: draft.trim() ? '#fff' : 'var(--muted)' }} onClick={post} aria-label="Del"><Ic n="send" s={17} /></button>
                </div>
              )}
              <div className="m-wall">
                {wall.length === 0 ? (
                  <div className="m-empty" style={{ padding: 20 }}><Ic n="bars" s={24} /><b>Ingen aktivitet ennå</b></div>
                ) : wall.map((w, i) => (
                  <div key={i} className="m-wall-item">
                    <span className="m-wall-ic" style={{ color: w.tone, background: `color-mix(in oklab, ${w.tone} 14%, transparent)` }}><Ic n={w.ic} s={15} /></span>
                    <div className="m-wall-b"><div className="t">{w.t}</div><div className="m">{w.m}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {grat && <GratulasjonDrawer user={u} onClose={() => setGrat(false)} />}
      </div>
    );
  }
  window.MProfileScreen = ProfileScreen;

  // =========================================================================
  // KUNNSKAPSTEST / MENYKUNNSKAP — rich quiz player (full-cover).
  // Upgraded: dish plate cards, per-question teaching feedback, streak,
  // swipe (sant/usant), celebratory pass→skiftklar w/ XP + confetti.
  // Backward-compatible with the course-quiz shape ({q,options[str],correct}).
  // =========================================================================
  function MQRing({ pct, size = 132, sw = 11, color = 'var(--success)' }) {
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    return (
      <span className="m-ring-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={sw} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 700ms' }} />
        </svg>
        <span className="m-ring-label" style={{ fontSize: size * 0.26, color }}>{Math.round(pct * 100)}<span style={{ fontSize: '0.6em' }}>%</span></span>
      </span>
    );
  }
  function MQConfetti() {
    const cols = ['#f97316', '#11ad32', '#2784d5', '#c18200', '#EC4899', '#8b5cf6'];
    const bits = Array.from({ length: 34 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.5, dur: 1.5 + Math.random() * 1.3, col: cols[i % cols.length] }));
    return <div className="m-mq-confetti">{bits.map((b, i) => <i key={i} style={{ left: b.left + '%', background: b.col, animationDuration: b.dur + 's', animationDelay: b.delay + 's' }} />)}</div>;
  }
  function DishArt({ art }) {
    if (!art) return null;
    if (art.type === 'glass') {
      const [l0, l1] = art.liquid || ['#a02f3c', '#c2543f'];
      return (
        <span className="m-art m-art-glass" aria-hidden="true">
          <span className="m-art-bg" style={{ background: `radial-gradient(circle at 50% 32%, #fff7ec, #efe4d2 70%, #e6d9c4)` }} />
          <span className="m-art-glassbody">
            <span className="m-art-liquid" style={{ background: `linear-gradient(180deg, ${l1}, ${l0})` }} />
            <span className="m-art-rim" style={{ background: art.rim || '#e7c08a' }} />
            <span className="m-art-stem" />
          </span>
          {art.garnish && <span className="m-art-gdot" style={{ background: art.garnish }} />}
        </span>
      );
    }
    const [m0, m1] = art.main || ['#7a4524', '#9a5a2a'];
    return (
      <span className="m-art m-art-plate" aria-hidden="true">
        <span className="m-art-bg" style={{ background: `radial-gradient(circle at 50% 40%, #fff 0%, #f3efe8 60%, #e9e3d8 100%)` }} />
        <span className="m-art-disc">
          <span className="m-art-food" style={{ background: `radial-gradient(circle at 42% 38%, ${m1}, ${m0} 78%)` }} />
          {art.side && <span className="m-art-blob s1" style={{ background: art.side }} />}
          {art.side && <span className="m-art-blob s2" style={{ background: art.side }} />}
          {art.garnish && <span className="m-art-blob g1" style={{ background: art.garnish }} />}
          {art.garnish && <span className="m-art-blob g2" style={{ background: art.garnish }} />}
          <span className="m-art-sheen" />
        </span>
      </span>
    );
  }
  function MPlate({ id }) {
    const KEY = 'mk_img_plate_' + id;
    const [src, setSrc] = useState(() => { try { return localStorage.getItem(KEY) || null; } catch (e) { return null; } });
    const inp = useRef(null);
    const D = window.SmartoutData;
    const all = [...(D.MK_DISHES || []), ...(D.MK_DRINKS || [])];
    const dish = all.find(x => x.id === id);
    const art = D.mkDishArt ? D.mkDishArt(id) : null;
    const onF = (f) => { if (!f || !/^image\//.test(f.type)) return; const r = new FileReader(); r.onload = () => { setSrc(r.result); try { localStorage.setItem(KEY, r.result); } catch (e) {} }; r.readAsDataURL(f); };
    return (
      <div className="m-mq-plate" onClick={() => inp.current && inp.current.click()}>
        {src ? <img src={src} alt="" /> : <DishArt art={art} />}
        {dish && <span className="m-mq-plate-nm">{dish.name}</span>}
        <span className="m-mq-plate-add"><Ic n="camera" s={12} /> {src ? 'Bytt' : 'Eget foto'}</span>
        <input ref={inp} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onF(e.target.files && e.target.files[0])} />
      </div>
    );
  }

  function Quiz({ quiz, onClose }) {
    const { toast } = window.useM();
    const pass = quiz.pass || 0.8;
    const meny = quiz.kind === 'meny';
    const QT = (window.SmartoutData || {}).MK_QTYPES || {};
    // normalize both question shapes
    const qs = (quiz.questions || []).map((q) => {
      if (q.prompt !== undefined) return { prompt: q.prompt, opts: (q.options || []).map(o => ({ k: o.k, label: o.t })), answer: q.answer, teach: q.teach, dish: q.dish, type: q.type };
      const tf = q.options && q.options.length === 2 && /^sant$/i.test(q.options[0]);
      return { prompt: q.q, opts: (q.options || []).map((t, idx) => ({ k: idx, label: t })), answer: q.correct, teach: q.teach || ('Riktig svar: ' + q.options[q.correct]), dish: null, type: tf ? 'sveip' : 'choice' };
    });
    const total = qs.length;
    const [phase, setPhase] = useState('intro'); // intro | play | done
    const [qi, setQi] = useState(0);
    const [picked, setPicked] = useState(null);
    const [streak, setStreak] = useState(0);
    const [bump, setBump] = useState(false);
    const [correct, setCorrect] = useState(0);
    const bodyRef = useRef(null);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [qi, phase]);

    const q = qs[qi] || {};
    const isCorrect = picked != null && picked === q.answer;
    const pick = (k) => { if (picked != null) return; setPicked(k); if (k === q.answer) { setCorrect(c => c + 1); setStreak(s => s + 1); setBump(true); setTimeout(() => setBump(false), 420); } else setStreak(0); };
    const next = () => { if (qi + 1 >= total) { setPhase('done'); return; } setQi(n => n + 1); setPicked(null); };
    const restart = () => { setPhase('intro'); setQi(0); setPicked(null); setStreak(0); setCorrect(0); };
    const score = Math.round((correct / total) * 100);
    const passed = score >= Math.round(pass * 100);

    return (
      <div className="m-vakt" role="dialog" aria-label="Quiz">
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n={phase === 'play' ? 'x' : 'chevDown'} s={22} /></button>
          <div className="m-vakt-htitle">{meny ? 'Menykunnskap' : 'Kunnskapstest'}</div>
          {phase === 'play' ? <span className={cls('m-mq-streak', bump && 'bump')}><Ic n="zap" s={14} c="var(--orange)" /> {streak}</span> : <span />}
        </div>
        <div className="m-vakt-body" ref={bodyRef}>
          {phase === 'intro' && (
            <div className="m-quiz-intro">
              <span className="m-quiz-badge"><Ic n={meny ? 'utensils' : 'checkCircle'} s={30} /></span>
              <h1>{quiz.title}</h1>
              <p>{total} spørsmål · {meny ? 'du blir skiftklar på ' : 'bestå med '}{Math.round(pass * 100)}%.{meny ? ' Feil svar lærer deg noe — ingen som dømmer.' : ''}</p>
              <button className="m-btn m-btn-primary m-btn-block" onClick={() => setPhase('play')}><Ic n="play" s={16} /> Start quiz</button>
            </div>
          )}
          {phase === 'play' && (
            <div className="m-mq">
              <div className="m-quiz-prog"><span style={{ width: ((qi + (picked != null ? 1 : 0)) / total) * 100 + '%' }} /></div>
              <div className="m-mq-type"><Ic n="sparkle" s={12} /> {(QT[q.type] || {}).label || 'Spørsmål'} · {qi + 1}/{total}</div>
              {q.dish && <MPlate id={q.dish} />}
              <h2 className="m-mq-prompt">{q.prompt}</h2>
              {q.type === 'sveip' ? (
                <div className="m-mq-swipe">
                  {q.opts.map(o => {
                    const st = picked != null ? (o.k === q.answer ? 'ok' : o.k === picked ? 'no' : 'dim') : '';
                    return <button key={String(o.k)} className={cls('m-mq-sw', st)} disabled={picked != null} onClick={() => pick(o.k)}><Ic n={/sant/i.test(o.label || '') ? 'check' : 'x'} s={22} sw={2.3} /> {o.label}</button>;
                  })}
                </div>
              ) : (
                <div className="m-mq-opts">
                  {q.opts.map((o, oi) => {
                    const st = picked != null ? (o.k === q.answer ? 'ok' : o.k === picked ? 'no' : 'dim') : '';
                    return (
                      <button key={String(o.k)} className={cls('m-mq-opt', st)} disabled={picked != null} onClick={() => pick(o.k)}>
                        <span className="m-mq-bullet">{picked != null && o.k === q.answer ? <Ic n="check" s={14} sw={2.6} /> : (picked === o.k ? <Ic n="x" s={14} sw={2.6} /> : String.fromCharCode(65 + oi))}</span>
                        <span>{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {picked != null && (
                <div className={cls('m-mq-fb', isCorrect ? 'ok' : 'no')}>
                  <div className="m-mq-fb-h"><span className={cls('m-mq-fb-ic', isCorrect ? 'ok' : 'no')}><Ic n={isCorrect ? 'check' : 'x'} s={17} sw={2.6} /></span><b>{isCorrect ? (streak >= 3 ? `Riktig! ${streak} på rad 🔥` : 'Riktig!') : 'Ikke helt'}</b></div>
                  {q.teach && <div className="m-mq-fb-teach">{q.teach}</div>}
                </div>
              )}
            </div>
          )}
          {phase === 'done' && (
            <div className="m-quiz-result" style={{ position: 'relative' }}>
              {passed && <MQConfetti />}
              <MQRing pct={score / 100} color={passed ? 'var(--success)' : 'var(--warning)'} />
              <h1>{passed ? (meny ? 'Du er skiftklar!' : 'Bestått!') : 'Nesten der'}</h1>
              <span className={cls('m-mq-pass', passed ? 'ok' : 'no')}><Ic n={passed ? 'check' : 'repeat'} s={13} sw={2.4} /> {passed ? `Bestått — ${Math.round(pass * 100)}% påkrevd` : `Trenger ${Math.round(pass * 100)}% · helt greit`}</span>
              <div className="m-mq-stats">
                <div className="m-mq-stat"><b>{correct}/{total}</b><span>riktige</span></div>
                <div className="m-mq-stat"><b style={{ color: 'var(--orange)' }}>+{correct * 15}</b><span>XP</span></div>
                <div className="m-mq-stat"><b>{score}%</b><span>score</span></div>
              </div>
              <p>{passed ? (meny ? 'Godt jobba — XP teller mot rangen din og loggføres på menykunnskap.' : 'Flott jobba — testen er fullført og logget på profilen din.') : 'Se gjennom veiledningen og prøv igjen når du vil.'}</p>
            </div>
          )}
        </div>
        {(phase === 'play' || phase === 'done') && (
          <div className="m-vakt-foot">
            {phase === 'play' && <button className="m-btn m-btn-primary m-btn-block" disabled={picked == null} style={picked == null ? { opacity: .45 } : {}} onClick={next}>{qi + 1 >= total ? 'Se resultat' : 'Neste'} <Ic n="arrowRight" s={16} /></button>}
            {phase === 'done' && (passed
              ? <button className="m-btn m-btn-primary m-btn-block" onClick={() => { toast(meny ? 'Resultat lagret · du er skiftklar ✓' : 'Kunnskapstest bestått ✓'); onClose(); }}><Ic n="check" s={16} /> Fullfør</button>
              : <button className="m-btn m-btn-primary m-btn-block" onClick={restart}><Ic n="repeat" s={16} /> Prøv igjen</button>)}
          </div>
        )}
      </div>
    );
  }
  window.MQuiz = Quiz;

  // =========================================================================
  // MENYKUNNSKAP — LEDERTAVLE (full-cover). Readiness hero + podium + ranked
  // list from MK_STAFF. Reachable from the Menykunnskap section header.
  // =========================================================================
  function MenyLeaderboard({ onClose }) {
    const D = window.SmartoutData || {};
    const staff = (D.MK_STAFF || []).slice().sort((a, b) => b.score - a.score);
    const ME = 'sl'; // Selma L. — the signed-in employee (matches cast)
    const ST = {
      topp: ['m-pill-ok', 'Topp'], klar: ['m-pill-ok', 'Skiftklar'],
      retake: ['m-pill-warn', 'Ny test'], 'ikke-klar': ['m-pill-crit', 'Ikke klar'],
    };
    const myRank = staff.findIndex(s => s.id === ME) + 1;
    const ready = staff.filter(s => s.status === 'topp' || s.status === 'klar').length;
    const podium = staff.slice(0, 3);
    const pOrder = [podium[1], podium[0], podium[2]].filter(Boolean); // 2 · 1 · 3
    return (
      <div className="m-vakt" role="dialog" aria-label="Ledertavle">
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="chevDown" s={22} /></button>
          <div className="m-vakt-htitle">Ledertavle · Menykunnskap</div>
          <span />
        </div>
        <div className="m-vakt-body">
          <div className="m-lb-hero">
            <div className="m-lb-hero-rank">#{myRank || '—'}</div>
            <div className="m-lb-hero-txt">
              <b>Din plassering</b>
              <span>{ready} av {staff.length} i teamet er skiftklare på menyen</span>
            </div>
          </div>

          <div className="m-lb-podium">
            {pOrder.map((s) => {
              const place = staff.indexOf(s) + 1;
              return (
                <div key={s.id} className={cls('m-lb-pod', 'p' + place, s.id === ME && 'me')}>
                  <span className="m-lb-pod-av" style={{ background: s.color }}>{s.initials}{place === 1 && <span className="m-lb-crown"><Ic n="zap" s={12} c="#fff" /></span>}</span>
                  <span className="m-lb-pod-nm">{s.name.split(' ')[0]}</span>
                  <span className="m-lb-pod-sc mono">{s.score}%</span>
                  <span className="m-lb-pod-bar"><b>{place}</b></span>
                </div>
              );
            })}
          </div>

          <div className="m-lb-list m-card m-flush">
            {staff.map((s, i) => {
              const [pc, pl] = ST[s.status] || ST['ikke-klar'];
              return (
                <div key={s.id} className={cls('m-lb-row', s.id === ME && 'me')}>
                  <span className="m-lb-rank mono">{i + 1}</span>
                  <span className="m-avatar" style={{ background: s.color, width: 34, height: 34, fontSize: 13 }}>{s.initials}</span>
                  <div className="m-lb-id">
                    <div className="m-lb-nm">{s.name}{s.id === ME && <span className="m-lb-you">Deg</span>}</div>
                    <div className="m-lb-sub">{s.role} · {s.streak > 0 ? <><Ic n="zap" s={11} c="var(--orange)" /> {s.streak} på rad</> : `sist ${s.last}`}</div>
                  </div>
                  <span className={cls('m-pill', pc)} style={{ height: 21, fontSize: 10.5 }}>{pl}</span>
                  <span className="m-lb-score mono">{s.score}<small>%</small></span>
                </div>
              );
            })}
          </div>
          <p className="m-lb-foot">Oppdateres når noen fullfører en menyquiz. Svake områder vises for leder i analyse.</p>
        </div>
      </div>
    );
  }
  window.MMenyLeaderboard = MenyLeaderboard;

  // =========================================================================
  // HÅNDBOK — chapter reader (full-cover). Reuses the .m-vakt chrome.
  // =========================================================================
  function HandbookReader({ doc, onClose }) {
    return (
      <div className="m-vakt" role="dialog" aria-label="Håndbok">
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="chevDown" s={24} /></button>
          <div className="m-vakt-htitle">Håndbok</div>
          <span />
        </div>
        <div className="m-vakt-body">
          <div className="m-hb-crumb"><Ic n="bookOpen" s={13} /> {doc.book} <Ic n="chevRight" s={12} /> {doc.chapter}</div>
          <h1 className="m-hb-title">{doc.title}</h1>
          {doc.updated && <div className="m-hb-meta">Oppdatert {doc.updated} · {doc.book}</div>}
          {doc.blocks.map((b, bi) => (
            <div key={bi} className="m-hb-block">
              {b.h && <h2>{b.h}</h2>}
              {(b.p || []).map((p, pi) => <p key={pi}>{p}</p>)}
              {b.list && <ul>{b.list.map((l, li) => <li key={li}>{l}</li>)}</ul>}
            </div>
          ))}
          <div className="m-bot" style={{ padding: '14px 15px' }}>
            <div className="m-bot-h"><span className="m-bot-ava"><Ic n="bot" s={16} /></span><b>Botsson</b><span className="m-bot-tag">Tips</span></div>
            <div className="m-bot-body">Dette kapittelet hører til kurset. Lurer du på noe, spør meg — jeg viser deg riktig avsnitt.</div>
          </div>
        </div>
      </div>
    );
  }
  window.MHandbookReader = HandbookReader;

  // =========================================================================
  // SETTINGS — Innstillinger (full-cover, .m-vakt chrome).
  // Real notification toggles + visning (tema/språk) + konto links.
  // =========================================================================
  function MToggle({ on, onChange }) {
    return (
      <button className="m-switch" data-on={on ? '1' : '0'} onClick={() => onChange(!on)} aria-pressed={on}
        style={{ width: 46, height: 28, borderRadius: 99, border: 'none', padding: 3, flex: '0 0 auto', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start', background: on ? 'var(--orange)' : 'var(--muted-soft)', transition: 'background 180ms, justify-content 120ms' }}>
        <span style={{ width: 22, height: 22, borderRadius: 99, background: '#fff', boxShadow: 'var(--sh-sm)', display: 'block' }} />
      </button>
    );
  }
  function SettingsScreen({ onClose }) {
    const { theme, toggleTheme, toast, openOverlay } = window.useM();
    const [n, setN] = useState({ push: true, vakt: true, oppgaver: true, meldinger: true, kunngjoring: false });
    const set = (k) => (v) => { setN(s => ({ ...s, [k]: v })); toast(v ? 'Varsel på' : 'Varsel av'); };
    const NoteRow = ({ k, ic, t, sub }) => (
      <div className="m-set-row">
        <span className="m-list-ic"><Ic n={ic} s={17} /></span>
        <div className="m-set-rb"><div className="m-set-t">{t}</div>{sub && <div className="m-set-sub">{sub}</div>}</div>
        <MToggle on={n[k]} onChange={set(k)} />
      </div>
    );
    return (
      <div className="m-vakt" role="dialog" aria-label="Innstillinger">
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="chevDown" s={24} /></button>
          <div className="m-vakt-htitle">Innstillinger</div>
          <span />
        </div>
        <div className="m-vakt-body">
          <div>
            <div className="m-prof-sec">Varsler</div>
            <div className="m-card m-flush">
              <NoteRow k="push" ic="bell" t="Push-varsler" sub="Varsler på denne enheten" />
              <NoteRow k="vakt" ic="calendar" t="Vaktendringer" sub="Nye vakter, bytter og påminnelser" />
              <NoteRow k="oppgaver" ic="checklist" t="Oppgaver" sub="Tildelte oppgaver og frister" />
              <NoteRow k="meldinger" ic="message" t="Meldinger" />
              <NoteRow k="kunngjoring" ic="pin" t="Kunngjøringer" />
            </div>
          </div>
          <div>
            <div className="m-prof-sec">Visning</div>
            <div className="m-card m-flush">
              <div className="m-set-row">
                <span className="m-list-ic"><Ic n={theme === 'dark' ? 'moon' : 'sun'} s={17} /></span>
                <div className="m-set-rb"><div className="m-set-t">Mørk modus</div><div className="m-set-sub">{theme === 'dark' ? 'På' : 'Av'}</div></div>
                <MToggle on={theme === 'dark'} onChange={toggleTheme} />
              </div>
              <button className="m-list-item" onClick={() => toast('Språk: Norsk (bokmål)')}>
                <span className="m-list-ic"><Ic n="route" s={17} /></span><span className="m-list-t">Språk</span>
                <span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)', marginRight: 6 }}>Norsk</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
              </button>
            </div>
          </div>
          <div>
            <div className="m-prof-sec">Konto</div>
            <div className="m-list">
              <button className="m-list-item" onClick={() => openOverlay('doc', { id: 'personvern' })}>
                <span className="m-list-ic"><Ic n="lock" s={17} /></span><span className="m-list-t">Personvern og sikkerhet</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
              </button>
              <button className="m-list-item" onClick={() => openOverlay('doc', { id: 'om' })}>
                <span className="m-list-ic"><Ic n="building" s={17} /></span><span className="m-list-t">Om Smartout</span>
                <span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)', marginRight: 6 }}>v1.0</span><Ic n="chevRight" s={17} c="var(--muted-soft)" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  window.MSettingsScreen = SettingsScreen;

  // =========================================================================
  // LOGOUT — confirm sheet.
  // =========================================================================
  function LogoutConfirm({ onClose }) {
    const { ME, toast } = window.useM();
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '60%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center', paddingTop: 8 }}>
            <span className="m-avatar" style={{ background: ME.color, width: 56, height: 56, fontSize: 18 }}>{ME.initials}</span>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22 }}>Logg ut?</h3>
              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>Du logges ut av <b>{ME.name}</b> på denne enheten. Du må logge inn på nytt neste gang.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-ghost m-full" onClick={onClose}>Avbryt</button>
            <button className="m-btn m-full" style={{ background: 'var(--error)', color: '#fff' }} onClick={() => { onClose(); toast('Logget ut'); }}><Ic n="logout" s={16} /> Logg ut</button>
          </div>
        </div>
      </div>
    );
  }
  window.MLogoutConfirm = LogoutConfirm;

  // =========================================================================
  // PAYSLIP — lønnsslipp / lønnsgrunnlag detail (full-cover, .m-vakt chrome).
  // Payload: { month, amount, sub }. Lines synthesized from the net amount.
  // =========================================================================
  // Build a real, downloadable PDF lønnsslipp (no library) faithful to the
  // EXPORTS.md §3.2 layout. Helvetica for labels, Courier for right-aligned
  // numbers, WinAnsiEncoding so æ/ø/å/× render. Returns a Blob.
  function payslipPdfBlob(d) {
    const W = 595, H = 842, M = 56;
    const ink = [0.102, 0.086, 0.078], muted = [0.52, 0.48, 0.45], orange = [0.761, 0.341, 0.118];
    let ops = '';
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const text = (x, y, str, font, size, color) => {
      const c = color || ink;
      ops += c[0] + ' ' + c[1] + ' ' + c[2] + ' rg BT /' + font + ' ' + size + ' Tf 1 0 0 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Tm (' + esc(str) + ') Tj ET\n';
    };
    // right-align (Courier monospace only — char advance = size * 0.6)
    const rtext = (xr, y, str, font, size, color) => text(xr - String(str).length * size * 0.6, y, str, font, size, color);
    const rule = (y, g) => { const v = g == null ? 0.87 : g; ops += v + ' ' + v + ' ' + v + ' RG 0.8 w ' + M + ' ' + y.toFixed(2) + ' m ' + (W - M) + ' ' + y.toFixed(2) + ' l S\n'; };
    let y = H - M;
    // header
    text(M, y, d.workspace, 'F2', 18, ink);
    text(380, y, 'LØNNSSLIPP', 'F2', 12, muted);
    text(380, y - 17, 'Periode: ' + d.period, 'F1', 10.5, ink);
    text(M, y - 17, d.orgnr, 'F1', 9.5, muted);
    y -= 42; rule(y); y -= 24;
    // employee block
    [['Ansatt', d.employee], ['Personnummer', d.pnr], ['Ansatt-ID', d.empId], ['Stilling', d.role], ['Bankkonto', d.bank]].forEach(([l, v]) => {
      text(M, y, l, 'F1', 10, muted); text(176, y, v, 'F1', 10, ink); y -= 18;
    });
    y -= 6; rule(y); y -= 26;
    // LØNN
    text(M, y, 'LØNN', 'F2', 11, orange); y -= 18;
    text(M, y, 'Beskrivelse', 'F1', 8.5, muted); text(300, y, 'Grunnlag', 'F1', 8.5, muted); text(470, y, 'Sum (kr)', 'F1', 8.5, muted);
    y -= 6; rule(y, 0.9); y -= 17;
    d.lines.forEach((l) => {
      text(M, y, l.desc, 'F1', 10, ink); text(300, y, l.basis, 'F3', 9, muted); rtext(W - M, y, l.sum, 'F3', 10, ink); y -= 18;
    });
    y -= 2; rule(y, 0.9); y -= 17;
    text(M, y, 'Bruttolønn', 'F2', 10.5, ink); rtext(W - M, y, 'kr ' + d.brutto, 'F4', 10.5, ink); y -= 28;
    // TREKK
    text(M, y, 'TREKK', 'F2', 11, orange); y -= 18; rule(y, 0.9); y -= 17;
    text(M, y, 'Forskuddstrekk', 'F1', 10, ink); text(300, y, d.skattLabel, 'F3', 9, muted); rtext(W - M, y, '-' + d.skatt, 'F3', 10, ink); y -= 18;
    y -= 2; rule(y, 0.9); y -= 17;
    text(M, y, 'Netto utbetalt', 'F2', 11, ink); rtext(W - M, y, 'kr ' + d.netto, 'F4', 12.5, orange); y -= 28;
    // FERIEPENGER
    text(M, y, 'FERIEPENGER', 'F2', 11, orange); y -= 18; rule(y, 0.9); y -= 17;
    text(M, y, 'Opptjent denne perioden', 'F1', 10, ink); text(300, y, '12 % av brutto', 'F3', 9, muted); rtext(W - M, y, d.feriOpptjent, 'F3', 10, ink); y -= 18;
    text(M, y, 'Saldo hittil i år', 'F1', 10, ink); rtext(W - M, y, d.feriSaldo, 'F3', 10, muted);
    // footer
    rule(M + 34, 0.92);
    text(M, M + 16, d.generated, 'F1', 8.5, muted);
    text(M, M + 2, 'Verifisering SHA-256: ' + d.hash, 'F3', 8, muted);
    // assemble objects
    const objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R /F4 8 0 R >> >> /Contents 4 0 R >>';
    objs[4] = '<< /Length ' + ops.length + ' >>\nstream\n' + ops + 'endstream';
    objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objs[7] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
    objs[8] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>';
    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const off = [];
    for (let i = 1; i < objs.length; i++) { off[i] = pdf.length; pdf += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
    const xref = pdf.length;
    pdf += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (let i = 1; i < objs.length; i++) pdf += String(off[i]).padStart(10, '0') + ' 00000 n \n';
    pdf += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  function PayslipScreen({ shift, onClose }) {
    const { toast, ME } = window.useM();
    const p = shift || { month: 'April 2026', amount: 35045, sub: 'Utbetalt 12. mai' };
    const net = p.amount;
    // realistic gross→net breakdown for a Bistro Nord servitør
    const grunn = Math.round(net * 0.82);
    const kveld = Math.round(net * 0.11);
    const helg = Math.round(net * 0.07);
    const overtid = Math.round(net * 0.05);
    const brutto = grunn + kveld + helg + overtid;
    const skatt = brutto - net + Math.round(net * 0.107);
    const feriepenger = Math.round(brutto * 0.12);
    const lines = [
      { t: 'Grunnlønn', s: '152 t × 215 kr', v: grunn },
      { t: 'Kveldstillegg', s: '38 t × 28 kr', v: kveld },
      { t: 'Helgetillegg', s: '22 t × 45 kr', v: helg },
      { t: 'Overtid', s: '6 t × 322 kr', v: overtid },
    ];
    const downloadPdf = () => {
      const hash = Array.from({ length: 8 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
      const blob = payslipPdfBlob({
        workspace: 'Bistro Nord', orgnr: 'Org.nr 912 345 678',
        period: p.month,
        employee: (ME && ME.name) || 'Maria Aamodt', empId: (ME && ME.empId) || 'A-0042', role: (ME && ME.role) || 'Servitør',
        pnr: '010594 *****', bank: '1503 23 ***45',
        lines: lines.map(l => ({ desc: l.t, basis: l.s, sum: fmtKr(l.v) })),
        brutto: fmtKr(brutto), skattLabel: 'Tabell 7100', skatt: fmtKr(skatt), netto: fmtKr(net),
        feriOpptjent: fmtKr(feriepenger), feriSaldo: fmtKr(Math.round(feriepenger * 5.2)),
        generated: 'Generert ' + new Date().toLocaleDateString('nb-NO') + ' av Smartout', hash,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'Lonnsslipp ' + p.month.replace(/\s+/g, ' ') + '.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Lønnsslipp lastet ned · PDF');
    };
    return (
      <div className="m-vakt" role="dialog" aria-label="Lønnsslipp">
        <div className="m-vakt-head">
          <button className="m-iconbtn" onClick={onClose} aria-label="Lukk"><Ic n="chevDown" s={24} /></button>
          <div className="m-vakt-htitle">Lønnsslipp</div>
          <button className="m-iconbtn" onClick={downloadPdf} aria-label="Last ned"><Ic n="download" s={20} /></button>
        </div>
        <div className="m-vakt-body">
          <div className="m-shift is-onshift" style={{ background: 'radial-gradient(130% 120% at 100% 0%, rgba(255,255,255,.16), transparent 52%), linear-gradient(150deg, var(--orange-dark), #7c2d09 75%)' }}>
            <div className="m-shift-top"><span className="m-shift-status">{p.month}</span><span className="m-pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', height: 22 }}>Utbetalt</span></div>
            <div className="m-shift-time">{fmtKr(net)}<span style={{ fontSize: 18, opacity: .7 }}> kr</span></div>
            <div className="m-shift-meta"><span>{p.sub}</span><span className="m-dotsep" style={{ background: 'rgba(255,255,255,.4)' }} /><span>Netto utbetalt</span></div>
          </div>

          <div>
            <div className="m-prof-sec">Inntekt</div>
            <div className="m-card m-flush">
              {lines.map((l, i) => (
                <div key={i} className="m-pay-line">
                  <div className="m-pay-lb"><div className="m-pay-lt">{l.t}</div><div className="m-pay-ls mono">{l.s}</div></div>
                  <span className="mono m-pay-lv">{fmtKr(l.v)}</span>
                </div>
              ))}
              <div className="m-pay-line m-pay-sum"><div className="m-pay-lt">Bruttolønn</div><span className="mono m-pay-lv">{fmtKr(brutto)}</span></div>
            </div>
          </div>

          <div>
            <div className="m-prof-sec">Trekk og avsetning</div>
            <div className="m-card m-flush">
              <div className="m-pay-line"><div className="m-pay-lb"><div className="m-pay-lt">Forskuddstrekk</div><div className="m-pay-ls mono">Tabell 7100</div></div><span className="mono m-pay-lv" style={{ color: 'var(--error)' }}>−{fmtKr(skatt)}</span></div>
              <div className="m-pay-line"><div className="m-pay-lb"><div className="m-pay-lt">Feriepenger avsatt</div><div className="m-pay-ls mono">12 % · utbetales juni</div></div><span className="mono m-pay-lv" style={{ color: 'var(--muted)' }}>{fmtKr(feriepenger)}</span></div>
            </div>
          </div>

          <div className="m-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Netto utbetalt</div><div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>{fmtKr(net)} kr</div></div>
            <span className="m-row-ic" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><Ic n="wallet" s={20} /></span>
          </div>

          <button className="m-btn m-btn-ghost m-btn-block" style={{ flexShrink: 0 }} onClick={downloadPdf}><Ic n="download" s={16} /> Last ned som PDF</button>
        </div>
      </div>
    );
  }
  window.MPayslipScreen = PayslipScreen;

  // =========================================================================
  // ANNOUNCEMENT — kunngjøring reader (bottom drawer).
  // Payload: { id } resolved against ANNOUNCEMENTS, or a full {title,...} object.
  // =========================================================================
  const ANNOUNCEMENTS = {
    selskap: {
      title: 'Stort selskap i kveld', dept: 'Drift', time: 'for 2 timer siden', author: 'Maria A.', tag: 'info',
      body: ['Vi har et selskap på 24 personer kl. 19:00 i Vinterhagen. Alle på kveldsvakt — vær obs på at sal og kjøkken får en travel periode mellom 19 og 21.',
        'Selma og Petter tar selskapet, resten holder à la carte i gang. Kjøkkenet har egen meny klar.'],
      list: ['Dekk bord 20–24 før 18:30', 'Allergier: 2 gjester glutenfri (meldt kjøkken)', 'Velkomstdrink ved ankomst'],
    },
    allergen: {
      title: 'Ny allergen-rutine publisert', dept: 'HMS', time: 'i går', author: 'Sara K.', tag: 'ok',
      body: ['Den oppdaterte allergen-rutinen er nå publisert i HMS-håndboken. Alle servitører må lese gjennom før neste vakt.',
        'Hovedendringen: vi merker nå alle allergi-bord med en fysisk lapp slik at hele teamet ser det.'],
      list: ['Spør alltid gjesten ved usikkerhet', 'Marker bordet med allergi-lapp', 'Bekreft med kjøkkenet før servering'],
    },
    lars: {
      title: 'Gratuler Lars med 5 år! 🎉', dept: 'Team', time: 'i dag', author: 'Maria A.', tag: 'info',
      body: ['I dag er det fem år siden Lars begynte hos oss på Bistro Nord. Takk for fem fantastiske år i sal — du er en bærebjelke i teamet.',
        'Det blir kake på personalrommet etter lunsj. Stikk innom og gratulér!'],
    },
  };
  function AnnouncementSheet({ shift, onClose }) {
    const { toast } = window.useM();
    const a = (shift && shift.title) ? shift : (ANNOUNCEMENTS[shift && shift.id] || ANNOUNCEMENTS.selskap);
    const tagColor = a.tag === 'ok' ? 'var(--success)' : a.tag === 'crit' ? 'var(--error)' : 'var(--info)';
    return (
      <div className="m-sheet-scrim" onClick={onClose} style={{ zIndex: 47 }}>
        <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '88%' }}>
          <div className="m-sheet-grip" />
          <div className="m-sheet-h"><h3>Kunngjøring</h3><button className="m-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose}><Ic n="x" s={20} /></button></div>
          <div className="m-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="m-pill" style={{ color: tagColor, background: `color-mix(in oklab, ${tagColor} 13%, transparent)` }}>{a.dept}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{a.time}</span>
            </div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 25, lineHeight: 1.15 }}>{a.title}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {a.body.map((p, i) => <p key={i} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--fg)' }}>{p}</p>)}
            </div>
            {a.list && (
              <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {a.list.map((l, i) => <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13.5 }}><span style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--orange)' }}><Ic n="check" s={15} sw={2.4} /></span><span>{l}</span></div>)}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--muted)' }}>
              <Ic n="users" s={14} /> Lagt ut av {a.author}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)' }}>
            <button className="m-btn m-btn-primary m-full" onClick={() => { onClose(); toast('Markert som lest'); }}><Ic n="check" s={16} /> Markér som lest</button>
          </div>
        </div>
      </div>
    );
  }
  window.MAnnouncementSheet = AnnouncementSheet;

  // =========================================================================
  // DOCS — håndbok-style reader content for konto/arbeid documents.
  // Reuses the existing MHandbookReader (full-cover) via the `doc` overlay.
  // =========================================================================
  const DOCS = {
    haandbok: { book: 'Bistro Nord', chapter: 'Håndbøker', title: 'Personalhåndbok', updated: '12. mai 2026', blocks: [
      { h: 'Velkommen til Bistro Nord', p: ['Personalhåndboken samler alt du trenger å vite om å jobbe hos oss — fra vakter og lønn til verdier og rutiner.'] },
      { h: 'Verdiene våre', list: ['Gjesten først — alltid', 'Vi rydder for hverandre', 'Trygg mat, trygg drift', 'Snakk opp — meld avvik'] },
      { h: 'Finn fram', p: ['HMS-håndboken dekker mattrygghet og sikkerhet. Lønnshåndboken dekker tariff og tillegg. Spør Mr. Botsson om du leter etter noe spesifikt.'] },
    ] },
    personvern: { book: 'Smartout', chapter: 'Konto', title: 'Personvern og sikkerhet', updated: '1. mai 2026', blocks: [
      { h: 'Dine data', p: ['Smartout behandler personopplysningene dine for å drifte vaktplan, lønn og kommunikasjon. Vi deler aldri data med tredjepart uten grunnlag.'] },
      { h: 'Hva vi lagrer', list: ['Vakter, timer og fravær', 'Lønnsgrunnlag og utbetalinger', 'Meldinger og kunngjøringer', 'Gjennomførte kurs og sertifikater'] },
      { h: 'Dine rettigheter', p: ['Du kan be om innsyn, retting eller sletting av opplysningene dine. Kontakt driftsleder eller personvern@smartout.no.'] },
    ] },
    om: { book: 'Smartout', chapter: 'Konto', title: 'Om Smartout', updated: 'mai 2026', blocks: [
      { h: 'Smartout for Bistro Nord', p: ['Smartout gjør den usynlige daglige driften til delt, rolig oversikt — vakter, oppgaver, HMS, lønn og kommunikasjon på ett sted.'] },
      { h: 'Versjon', p: ['Mobil v1.0 · Bistro Nord · Vinter/Vår 2026.'] },
    ] },
    kontrakt: { book: 'Lønn & arbeid', chapter: 'Dokumenter', title: 'Arbeidskontrakt', updated: '1. sep 2025', blocks: [
      { h: 'Ansettelsesforhold', p: ['Fast ansettelse som servitør ved Bistro Nord fra 1. september 2025. Stillingsprosent 80 %.'] },
      { h: 'Arbeidstid', list: ['Gjennomsnittsberegnet turnus', 'Kveld og helg etter oppsatt vaktplan', 'Pauser i henhold til arbeidsmiljøloven'] },
      { h: 'Lønn', p: ['Timelønn etter gjeldende tariff med tillegg for kveld, helg og helligdager. Se «Tariff og tillegg» for satser.'] },
    ] },
    tariff: { book: 'Lønn & arbeid', chapter: 'Dokumenter', title: 'Tariff og tillegg', updated: '1. apr 2026', blocks: [
      { h: 'Satser 2026', list: ['Grunnlønn servitør: 215 kr/t', 'Kveldstillegg (etter 18): +28 kr/t', 'Helgetillegg (lør/søn): +45 kr/t', 'Overtid: +50 %'] },
      { h: 'Helligdager', p: ['Arbeid på helligdager gir 100 % tillegg. Skjær- og høytidsdager følger egen oversikt.'] },
    ] },
  };
  window.MDOCS = DOCS;
})();
