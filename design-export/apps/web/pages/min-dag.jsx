// ===== Min dag — employee home (private route "min-dag") =====
// The employee's first screen: today's shift, the morning brief, my tasks
// (expandable + completable), quick actions into the rest of the private app,
// my week at a glance, today's routines, and latest news. Action-first; every
// control routes, opens an overlay, or animates — nothing is a dead end.
(function () {
  const { useState, useEffect } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  // Bistro Nord — Jonas H. (Sous-chef · Kjøkken), day shift 09–17, pinned now 08:14
  const SHIFT = { role: "Sous-chef · Kjøkken", start: "09:00", end: "17:00", startsIn: "46 min", loc: "Bistro Nord · Kjøkken", now: "08:14" };
  const PRI = { critical: "crit", high: "high", normal: "normal", low: "low" };
  const PRI_LBL = { critical: "Kritisk", high: "Høy", normal: "Normal", low: "Lav" };

  function greeting() {
    const h = 8; // pinned to the app's "now" (08:14) for a coherent demo
    if (h < 5) return "God natt";
    if (h < 11) return "God morgen";
    if (h < 17) return "Hei";
    return "God kveld";
  }

  function Ring({ pct, size = 48, sw = 5, color = "var(--orange)" }) {
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    return (
      <span className="md-ring-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 600ms ease" }} />
        </svg>
        <span className="md-ring-lbl" style={{ fontSize: size * 0.27, color }}>{Math.round(pct * 100)}<span style={{ fontSize: "0.62em" }}>%</span></span>
      </span>
    );
  }

  function Brief({ toast }) {
    const [showWhy, setShowWhy] = useState(false);
    return (
      <div className="brief">
        <div className="brief-top">
          <span className="brief-av"><Ic n="bot" s={19} /></span>
          <div className="brief-id">
            <div className="n">Morgenbrief <span className="tag">BOTSSON</span></div>
            <div className="m">Generert 08:14 · for din vakt i dag</div>
          </div>
          <span className="spacer" />
          <button className="brief-why" onClick={() => setShowWhy(s => !s)}>
            <Ic n={showWhy ? "chevUp" : "eye"} s={13} /> {showWhy ? "Skjul kilder" : "Hvorfor?"}
          </button>
        </div>
        <p className="brief-body">
          Du har <strong>2 oppgaver som haster</strong> før vakta — <span className="hl-crit">temperaturkontroll er 32 min forsinket</span>. Bama leverer <strong>09:30</strong>, så ta mottakskontrollen rett etterpå. I kveld kommer et stort selskap (30 pers fra 19), så det blir travelt utover ettermiddagen.
        </p>
        {showWhy && (
          <div className="brief-sources">
            {[["thermometer", "IK-mat · temperaturlogg 08:00"], ["inbox", "Booking · 30 pers kl. 19:00"], ["calendar", "Levering · Bama 09:30"], ["list", "3 oppgaver tildelt deg"]].map(([ic, s]) => (
              <span key={s} className="brief-src"><span className="ic"><Ic n={ic} s={12} /></span>{s}</span>
            ))}
          </div>
        )}
        <div className="brief-actions">
          <button className="brief-act" onClick={() => { (window.SmartoutBot && window.SmartoutBot.open()); }}>
            <span className="num"><Ic n="bot" s={12} /></span> Spør Botsson om dagen
          </button>
          <button className="brief-act" onClick={() => toast("Hopper til forsinket oppgave")}>
            <span className="num">1</span> Vis forsinket oppgave
          </button>
        </div>
      </div>
    );
  }

  function TaskItem({ t, done, onToggle, toast }) {
    const [open, setOpen] = useState(false);
    const overdue = t.status === "overdue";
    return (
      <div className="md-task">
        <div className="md-task-row" onClick={() => setOpen(o => !o)}>
          <button className={`md-check ${done ? "done" : ""}`} onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="Marker ferdig">
            <Ic n="check" s={14} sw={3} />
          </button>
          <div className="md-task-body">
            <div className={`md-task-title ${done ? "done" : ""}`}>{t.title}</div>
            <div className="md-task-meta">
              <span className={`md-pill ${overdue ? "crit" : PRI[t.priority]}`}>
                <Ic n="clock" s={11} /> {overdue ? t.deadlineRel : t.deadline}
              </span>
              {t.location && <span>{t.location}</span>}
            </div>
          </div>
          <span className={`md-task-chev ${open ? "open" : ""}`}><Ic n="chevRight" s={18} /></span>
        </div>
        <div className={`md-task-detail ${open ? "open" : ""}`}>
          <div className="md-task-inner-wrap">
            <div className="md-task-inner">
              <div className="md-task-desc">{t.description}</div>
              {t.subtasks && t.subtasks.length > 0 && (
                <div className="md-subs">
                  {t.subtasks.map(s => (
                    <div key={s.id} className="md-sub">
                      <span className={`md-sub-box ${s.done ? "done" : ""}`}><Ic n="check" s={11} sw={3} /></span>
                      <span className={`md-sub-lbl ${s.done ? "done" : ""}`}>{s.title}</span>
                      {s.value && <span className="md-sub-val">{s.value}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="md-task-acts">
                <button className="md-tbtn primary" onClick={() => { if (!done) onToggle(); }}>
                  <Ic n="check" s={14} /> {done ? "Fullført" : "Marker ferdig"}
                </button>
                {t.manual && <button className="md-tbtn" onClick={() => toast("Åpner manual")}><Ic n="book" s={14} /> Åpne manual</button>}
                <button className="md-tbtn" onClick={() => toast("Kommentar lagt til")}><Ic n="message" s={14} /> Kommentér</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Quick({ icon, label, badge, onClick }) {
    return (
      <button className="md-q" onClick={onClick}>
        {badge ? <span className="md-q-badge">{badge}</span> : null}
        <span className="md-q-ic"><Ic n={icon} s={19} /></span>
        <span className="md-q-lbl">{label}</span>
      </button>
    );
  }

  function MinDagPage({ setRoute }) {
    const toast = window.useToast();
    const SD = D();
    // Jonas' kitchen tasks today: his own + kitchen-floor tasks he owns on shift
    const myTasks = SD.TASKS.filter(t => t.status !== "done" && (t.assignee === "jh" || /Kjøkken/.test(t.location || "")));
    const ordered = [...myTasks].sort((a, b) => (a.status === "overdue" ? -1 : 0) - (b.status === "overdue" ? -1 : 0));
    const [doneIds, setDoneIds] = useState({});
    const myRoutines = (SD.ROUTINES || []).filter(r => r.active && (r.owner === "jh" || /ikmat|hms|kjok/i.test(r.category || r.book || ""))).slice(0, 3);

    useEffect(() => {
      if (window.SmartoutContext && window.SmartoutContext.set) {
        window.SmartoutContext.set({ route: "min-dag", view: "oversikt", role: "ansatt", subject: "Din dag" });
      }
      return () => { if (window.SmartoutContext && window.SmartoutContext.set) window.SmartoutContext.set({ route: null }); };
    }, []);

    const toggle = (t) => {
      const wasDone = !!doneIds[t.id];
      setDoneIds(s => ({ ...s, [t.id]: !wasDone }));
      if (!wasDone) toast(`«${t.title}» markert ferdig`, { undo: () => setDoneIds(s => ({ ...s, [t.id]: false })) });
    };
    const remaining = ordered.filter(t => !doneIds[t.id]).length;
    const total = ordered.length;
    const pct = total ? (total - remaining) / total : 1;
    const haster = ordered.filter(t => t.status === "overdue" && !doneIds[t.id]).length;

    const openChat = () => { if (window.SmartoutChat) window.SmartoutChat.open(); else toast("Åpner meldinger"); };

    return (
      <main className="sk-main">
        <div className="sk-wrap">
          {/* header */}
          <div className="md-head">
            <div className="sk-eyebrow">Min side · Fredag 30. mai 2026</div>
            <h1 className="md-greet">{greeting()}, Jonas</h1>
            <div className="dash-statusline">
              <span className="seg"><span className="dot" style={{ background: "var(--success)" }} />Vakt <strong>{SHIFT.start}–{SHIFT.end}</strong></span>
              <span className="sep" />
              <span className="seg"><span className="dot" style={{ background: haster ? "var(--error)" : "var(--warning)" }} /><strong>{remaining}</strong> oppgaver igjen</span>
              <span className="sep" />
              <span className="seg"><span className="dot" style={{ background: "var(--info)" }} />Stort selskap <strong>kl. 19</strong></span>
            </div>
          </div>

          <div className="so-grid-2">
            {/* LEFT */}
            <div className="so-stack">
              {/* on-shift hero */}
              <div className="md-shift">
                <div className="md-shift-top">
                  <span className="md-shift-status"><span className="md-live" /> Vakt starter snart</span>
                  <span className="md-shift-role">{SHIFT.role}</span>
                </div>
                <div className="md-shift-time">{SHIFT.start}<span className="sep"> – {SHIFT.end}</span></div>
                <div className="md-shift-meta">
                  <span className="sub"><Ic n="clock" s={13} c="rgba(255,255,255,0.8)" /> Starter om {SHIFT.startsIn}</span>
                  <span className="md-shift-dot" />
                  <span className="sub"><Ic n="mappin" s={13} c="rgba(255,255,255,0.8)" /> {SHIFT.loc}</span>
                </div>
                <div className="md-shift-actions">
                  <button className="md-sbtn solid" onClick={() => toast("Stemplet inn 08:14", { undo: () => {} })}><Ic n="clock" s={16} /> Stemple inn</button>
                  <button className="md-sbtn" onClick={() => setRoute("mine-vakter")}><Ic n="calendar" s={16} /> Se vakt</button>
                </div>
              </div>

              {/* morning brief */}
              <Brief toast={toast} />

              {/* my tasks */}
              <div className="so-panel">
                <div className="so-panel-head">
                  <span className="t"><span className="ico"><Ic n="list" s={15} /></span>Mine oppgaver i dag</span>
                  <span className={`cnt ${haster ? "crit" : ""}`}>{remaining}</span>
                </div>
                <div className="md-prog">
                  <Ring pct={pct} />
                  <div className="md-prog-txt">
                    <div className="t">{remaining > 0 ? `${remaining} igjen i dag` : "Alt fullført 🎉"}</div>
                    <div className="s">{total - remaining} av {total} fullført</div>
                  </div>
                  {haster > 0 && <span className="md-haste"><span className="dot" /> {haster} haster</span>}
                </div>
                <div className="md-tasks">
                  {ordered.map(t => (
                    <TaskItem key={t.id} t={t} done={!!doneIds[t.id]} onToggle={() => toggle(t)} toast={toast} />
                  ))}
                  {ordered.length === 0 && (
                    <div className="so-empty"><span className="ic"><Ic n="check" s={22} /></span><div className="t">Ingen oppgaver i dag</div><div className="s">Du er à jour. Nyt vakta!</div></div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="so-stack">
              {/* quick actions */}
              <div className="md-quick">
                <Quick icon="calendar" label="Mine vakter" badge="2" onClick={() => setRoute("mine-vakter")} />
                <Quick icon="wallet" label="Min lønn" onClick={() => setRoute("min-lonn")} />
                <Quick icon="message" label="Meldinger" badge="3" onClick={openChat} />
                <Quick icon="cap" label="Opplæring" badge="1" onClick={() => { if (window.SmartoutBot) window.SmartoutBot.open(); else toast("Åpner opplæring"); }} />
              </div>

              {/* my week */}
              <div className="so-panel">
                <div className="so-panel-head">
                  <span className="t"><span className="ico"><Ic n="trendUp" s={15} /></span>Min uke</span>
                  <span className="spacer" />
                  <button className="link" onClick={() => setRoute("mine-vakter")}>Vakter <Ic n="arrowRight" s={13} /></button>
                </div>
                <div className="md-weekstats">
                  <div className="md-ws"><div className="md-ws-l">Timer</div><div className="md-ws-v">32,5<span className="u">/37,5</span></div><div className="md-ws-s">5 t igjen</div></div>
                  <div className="md-ws"><div className="md-ws-l">Fullført</div><div className="md-ws-v">39</div><div className="md-ws-s">100 % i tide</div></div>
                  <div className="md-ws"><div className="md-ws-l">Streak</div><div className="md-ws-v">9<span className="u">d</span></div><div className="md-ws-s">på rad</div></div>
                </div>
              </div>

              {/* today's routines */}
              {myRoutines.length > 0 && (
                <div className="so-panel">
                  <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="repeat" s={15} /></span>Mine rutiner i dag</span></div>
                  <div>
                    {myRoutines.map(r => (
                      <div key={r.id} className="md-rut">
                        <span className="md-rut-ic"><Ic n={(SD.ROUTINE_CATEGORIES[r.category] || {}).icon || "repeat"} s={15} /></span>
                        <div className="md-rut-body">
                          <div className="md-rut-title">{r.title}</div>
                          <div className="md-rut-meta">{r.cadence} · {r.responsible}</div>
                        </div>
                        <span className="md-rut-win">{r.window}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* latest news */}
              <div className="so-panel">
                <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="megaphone" s={15} /></span>Siste nytt</span><span className="spacer" /><button className="link" onClick={openChat}>Alle <Ic n="arrowRight" s={13} /></button></div>
                <div className="md-news">
                  <button className="md-news-row" onClick={() => toast("Åpner kunngjøring")}>
                    <span className="md-news-ic" style={{ background: "rgba(39,132,213,0.12)", color: "var(--info)" }}><Ic n="pin" s={16} /></span>
                    <div className="md-news-body"><div className="md-news-title">Stort selskap i kveld</div><div className="md-news-sub">Bord 8–12 reservert · 30 pers fra kl. 19</div></div>
                    <span className="md-tag-unread">Ulest</span>
                  </button>
                  <button className="md-news-row" onClick={() => toast("Gratulerer Petter!")}>
                    <span className="md-news-ic" style={{ background: "var(--orange-soft)", color: "var(--orange-dark)" }}><Ic n="heart" s={16} /></span>
                    <div className="md-news-body"><div className="md-news-title">Petter fyller år i dag 🎂</div><div className="md-news-sub">Si gratulerer når du ser ham</div></div>
                    <span className="md-news-row-go"><Ic n="chevRight" s={18} c="var(--muted-soft)" /></span>
                  </button>
                  <button className="md-news-row" onClick={openChat}>
                    <span className="md-news-ic" style={{ background: "rgba(17,173,50,0.12)", color: "var(--success)" }}><Ic n="message" s={16} /></span>
                    <div className="md-news-body"><div className="md-news-title">Maria la igjen en melding</div><div className="md-news-sub">«Husk å sjekke pakningen på Kjøl 3»</div></div>
                    <span className="md-tag-unread">3</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { "min-dag": MinDagPage });
})();
