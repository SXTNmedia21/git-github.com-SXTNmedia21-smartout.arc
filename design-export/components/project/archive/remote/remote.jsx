/* Remote — the main component.
 * Timeline at top, transport row, clickable step list (expand → events).
 * State machine drives colors across the UI.
 */

function Remote({ scenario, steps, layout = "full", theme = "light" }) {
  // ─── state ──────────────────────────────────────────────────────────────
  const [machine, setMachine] = React.useState("ready");  // ready|running|paused|done
  const [currentIdx, setCurrentIdx] = React.useState(0);  // which step
  const [elapsedInStep, setElapsedInStep] = React.useState(0); // ms within current step (scaled)
  const [speed, setSpeed] = React.useState(1);
  const [recording, setRecording] = React.useState(false);
  const [snapFlash, setSnapFlash] = React.useState(false);
  const [openStepId, setOpenStepId] = React.useState(null);
  const [eventsSeen, setEventsSeen] = React.useState({}); // {stepId: Set<eventIdx>}

  const tickRef = React.useRef(null);
  const lastTickRef = React.useRef(null);

  // Aggregate scenario elapsed for header timer
  const totalElapsed = React.useMemo(() => {
    let t = 0;
    for (let i = 0; i < currentIdx; i++) t += steps[i].duration_ms;
    return t + elapsedInStep;
  }, [currentIdx, elapsedInStep, steps]);

  const totalDuration = React.useMemo(
    () => steps.reduce((a, s) => a + s.duration_ms, 0),
    [steps]
  );

  const currentStep = steps[currentIdx];

  // ─── tick loop ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (machine !== "running") {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      lastTickRef.current = null;
      return;
    }
    const loop = (now) => {
      if (lastTickRef.current == null) lastTickRef.current = now;
      const dt = (now - lastTickRef.current) * speed;
      lastTickRef.current = now;

      setElapsedInStep(prev => {
        let next = prev + dt;
        const step = steps[currentIdx];
        if (!step) return prev;

        // reveal events whose `t` has passed
        setEventsSeen(seen => {
          const key = step.id;
          const existing = seen[key] || new Set();
          let changed = false;
          const nextSet = new Set(existing);
          step.events.forEach((e, i) => {
            if (!nextSet.has(i) && e.t <= next) { nextSet.add(i); changed = true; }
          });
          if (!changed) return seen;
          return { ...seen, [key]: nextSet };
        });

        if (next >= step.duration_ms) {
          // advance
          const nextIdx = currentIdx + 1;
          if (nextIdx >= steps.length) {
            setMachine("done");
            return step.duration_ms;
          }
          setCurrentIdx(nextIdx);
          return 0;
        }
        return next;
      });
      tickRef.current = requestAnimationFrame(loop);
    };
    tickRef.current = requestAnimationFrame(loop);
    return () => { if (tickRef.current) cancelAnimationFrame(tickRef.current); };
  }, [machine, speed, currentIdx, steps]);

  // ─── controls ───────────────────────────────────────────────────────────
  const start = () => {
    if (machine === "done") {
      setCurrentIdx(0); setElapsedInStep(0); setEventsSeen({});
    }
    setMachine("running");
  };
  const pause    = () => setMachine("paused");
  const resume   = () => setMachine("running");
  const stop     = () => {
    setMachine("ready"); setCurrentIdx(0); setElapsedInStep(0); setEventsSeen({});
  };
  const stepFwd  = () => {
    if (currentIdx < steps.length - 1) {
      setCurrentIdx(currentIdx + 1); setElapsedInStep(0);
      // reveal all events in the step we skip
      setEventsSeen(seen => {
        const key = steps[currentIdx].id;
        const all = new Set(steps[currentIdx].events.map((_, i) => i));
        return { ...seen, [key]: all };
      });
    }
  };
  const stepBack = () => {
    if (currentIdx > 0) { setCurrentIdx(currentIdx - 1); setElapsedInStep(0); }
  };

  const toggleRec = () => setRecording(r => !r);
  const snap = () => {
    setSnapFlash(true);
    setTimeout(() => setSnapFlash(false), 520);
  };

  // Jump on clicking a step pip
  const jumpTo = (idx) => {
    setCurrentIdx(idx); setElapsedInStep(0);
    setEventsSeen(seen => {
      // mark all prior steps fully seen
      const ns = {};
      for (let i = 0; i < idx; i++) {
        ns[steps[i].id] = new Set(steps[i].events.map((_, j) => j));
      }
      return ns;
    });
  };

  // Primary button changes with state
  const primary = (() => {
    if (machine === "ready")   return { variant: "primary", icon: Icon.play(18, "#fff"),  label: "Start",    onClick: start };
    if (machine === "running") return { variant: "pause",   icon: Icon.pause(18, "#8f5f00"), label: "Pause",  onClick: pause };
    if (machine === "paused")  return { variant: "primary", icon: Icon.play(18, "#fff"),  label: "Fortsett", onClick: resume };
    if (machine === "done")    return { variant: "primary", icon: Icon.play(18, "#fff"),  label: "Kjør igjen", onClick: start };
    return { variant: "primary", icon: Icon.play(18, "#fff"), label: "Start", onClick: start };
  })();

  const dark = theme === "dark";
  const C = dark ? {
    bg: "#17130f", surface: "#1f1a15", surfaceDim: "#1a1611",
    fg: "#f0eeeb", muted: "#a09890", border: "rgba(255,255,255,0.08)",
    borderSoft: "rgba(255,255,255,0.05)",
  } : {
    bg: RT.bg, surface: RT.surface, surfaceDim: RT.surfaceDim,
    fg: RT.fg, muted: RT.muted, border: RT.border, borderSoft: RT.borderSoft,
  };

  // ─── render ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: "100%", fontFamily: "Geist, sans-serif",
      color: C.fg, background: C.bg,
      borderRadius: 18, border: `1px solid ${C.border}`,
      overflow: "hidden",
      boxShadow: dark ? "0 20px 48px rgba(0,0,0,0.5)" : "0 18px 40px rgba(30,22,15,0.08)",
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "18px 22px 14px",
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <StateBadge state={machine} large />
              {recording && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "4px 10px 4px 9px", borderRadius: 999,
                  background: "rgba(231,0,11,0.10)",
                  border: "1px solid rgba(231,0,11,0.35)",
                  color: RT.rec,
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  fontFamily: "Geist, sans-serif",
                }}>
                  <span style={{
                    display: "inline-block", width: 8, height: 8, borderRadius: 999,
                    background: RT.rec,
                    animation: "remoteRecBlink 1s ease-in-out infinite",
                  }}/>
                  REC · opptak
                </div>
              )}
              {snapFlash && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 999,
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.35)",
                  color: RT.purple,
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  animation: "remoteFlashIn 180ms ease-out",
                }}>
                  {Icon.cam(12, RT.purple)} Skjermbilde tatt
                </div>
              )}
            </div>
            <div style={{
              fontFamily: "Instrument Serif, serif",
              fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.01em",
              color: C.fg,
            }}>
              {scenario.title}
            </div>
            <div style={{
              fontSize: 12, color: C.muted, marginTop: 4,
              fontFamily: "Geist Mono, monospace",
            }}>
              {scenario.target}
            </div>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>Kjøretid</div>
            <div style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em",
              color: C.fg, fontVariantNumeric: "tabular-nums",
              marginTop: 2,
            }}>
              {fmtTime(totalElapsed)}
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "Geist Mono, monospace" }}>
              / {fmtTime(totalDuration)} @ {speed}x
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress timeline (clickable pips) ─────────────────────────── */}
      <StepTimeline
        steps={steps}
        currentIdx={currentIdx}
        elapsedInStep={elapsedInStep}
        machine={machine}
        onJump={jumpTo}
        C={C}
      />

      {/* ── Transport row ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "16px 22px", background: C.surfaceDim,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        flexWrap: "wrap",
      }}>
        {/* Step back */}
        <TransportButton
          variant="default" size={44}
          icon={Icon.back(16, C.fg)}
          label="Forrige steg" onClick={stepBack}
          disabled={currentIdx === 0}
        />
        {/* Primary */}
        <TransportButton
          variant={primary.variant} size={56}
          icon={primary.icon} label={primary.label} onClick={primary.onClick}
        />
        {/* Step forward */}
        <TransportButton
          variant="default" size={44}
          icon={Icon.step(16, C.fg)}
          label="Neste steg" onClick={stepFwd}
          disabled={currentIdx >= steps.length - 1}
        />
        {/* Stop */}
        <TransportButton
          variant="default" size={44}
          icon={Icon.stop(14, C.fg)}
          label="Stopp og nullstill" onClick={stop}
          disabled={machine === "ready"}
        />

        <div style={{ width: 1, height: 40, background: C.border, margin: "0 4px" }}/>

        {/* Speed */}
        <SpeedControl value={speed} onChange={setSpeed} C={C} />

        <div style={{ flex: 1, minWidth: 12 }}/>

        {/* REC */}
        <button
          onClick={toggleRec}
          style={{
            display: "inline-flex", alignItems: "center", gap: 9,
            height: 44, padding: "0 16px 0 14px",
            borderRadius: 999,
            border: `1px solid ${recording ? RT.rec : C.border}`,
            background: recording ? "rgba(231,0,11,0.10)" : C.surface,
            color: recording ? RT.rec : C.fg,
            fontFamily: "Geist, sans-serif",
            fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
            cursor: "pointer",
            transition: "background 180ms, border-color 180ms, box-shadow 180ms",
            boxShadow: recording ? "0 0 0 3px rgba(231,0,11,0.18)" : "none",
          }}
        >
          <span style={{
            width: 10, height: 10, borderRadius: 999,
            background: RT.rec,
            animation: recording ? "remoteRecBlink 1s ease-in-out infinite" : "none",
          }}/>
          REC
        </button>

        {/* Snapshot */}
        <button
          onClick={snap}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            height: 44, padding: "0 16px",
            borderRadius: 999,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.fg,
            fontFamily: "Geist, sans-serif",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            transition: "background 180ms",
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.surfaceDim}
          onMouseLeave={e => e.currentTarget.style.background = C.surface}
        >
          {Icon.cam(16, C.fg)} Skjermbilde
        </button>
      </div>

      {/* ── Step list ──────────────────────────────────────────────────── */}
      <div style={{ background: C.bg, padding: "6px 0" }}>
        {steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            index={i}
            total={steps.length}
            isCurrent={i === currentIdx}
            isDone={i < currentIdx || (i === currentIdx && machine === "done")}
            isFuture={i > currentIdx}
            machine={machine}
            elapsedInStep={i === currentIdx ? elapsedInStep : (i < currentIdx ? step.duration_ms : 0)}
            eventsSeen={eventsSeen[step.id] || new Set()}
            open={openStepId === step.id}
            onToggle={() => setOpenStepId(openStepId === step.id ? null : step.id)}
            onJump={() => jumpTo(i)}
            C={C}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Step timeline ────────────────────────────────────────────────────────
function StepTimeline({ steps, currentIdx, elapsedInStep, machine, onJump, C }) {
  const total = steps.reduce((a, s) => a + s.duration_ms, 0);
  let acc = 0;
  const segs = steps.map(s => {
    const start = acc / total; acc += s.duration_ms;
    return { id: s.id, label: s.label, startPct: start, widthPct: s.duration_ms / total };
  });

  // Live fill
  const curStep = steps[currentIdx];
  const stepProgress = curStep ? Math.min(1, elapsedInStep / curStep.duration_ms) : 0;
  const liveAcc = (() => {
    let t = 0;
    for (let i = 0; i < currentIdx; i++) t += steps[i].duration_ms;
    return (t + (curStep ? stepProgress * curStep.duration_ms : 0)) / total;
  })();

  const fillColor = {
    ready: C.border, running: RT.running, paused: RT.paused, done: RT.done, error: RT.error,
  }[machine] || RT.running;

  return (
    <div style={{ padding: "18px 22px 16px", background: C.surface }}>
      {/* Track */}
      <div style={{ position: "relative", height: 14 }}>
        {/* bg */}
        <div style={{
          position: "absolute", top: 5, left: 0, right: 0, height: 4,
          background: C.surfaceDim, borderRadius: 999,
        }}/>
        {/* fill */}
        <div style={{
          position: "absolute", top: 5, left: 0, width: `${liveAcc * 100}%`, height: 4,
          background: fillColor, borderRadius: 999,
          boxShadow: machine === "running" ? `0 0 8px ${fillColor}` : "none",
          transition: "background 200ms",
        }}/>
        {/* segment tick marks */}
        {segs.map((s, i) => i > 0 && (
          <div key={s.id} style={{
            position: "absolute", left: `${s.startPct * 100}%`, top: 2, width: 1, height: 10,
            background: C.border,
          }}/>
        ))}
        {/* step pips */}
        {segs.map((s, i) => {
          const done = i < currentIdx;
          const cur = i === currentIdx;
          const cx = s.startPct + s.widthPct / 2;
          const bg = done ? RT.done : cur ? fillColor : C.surface;
          const border = done ? RT.done : cur ? fillColor : C.border;
          return (
            <button
              key={s.id}
              onClick={() => onJump(i)}
              title={`${i + 1}. ${s.label}`}
              style={{
                position: "absolute", left: `calc(${cx * 100}% - 7px)`, top: -1,
                width: 14, height: 14, borderRadius: 999,
                background: bg, border: `2px solid ${border}`,
                cursor: "pointer", padding: 0,
                boxShadow: cur ? `0 0 0 4px color-mix(in oklab, ${fillColor} 18%, transparent)` : "none",
                transition: "transform 140ms",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}
            />
          );
        })}
      </div>
      {/* labels */}
      <div style={{
        display: "flex", marginTop: 10, fontSize: 10.5,
        color: C.muted, fontFamily: "Geist Mono, monospace",
        letterSpacing: "0.02em",
      }}>
        {segs.map((s, i) => (
          <div key={s.id} style={{
            flex: `0 0 ${s.widthPct * 100}%`, minWidth: 0,
            paddingRight: 6, textAlign: "left",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: i === currentIdx ? C.fg : C.muted,
            fontWeight: i === currentIdx ? 600 : 400,
          }}>
            <span style={{ opacity: 0.55 }}>{String(i + 1).padStart(2, "0")} </span>{s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Speed control (slider-ish) ──────────────────────────────────────────
function SpeedControl({ value, onChange, C }) {
  const stops = [0.25, 0.5, 1, 2, 4];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      height: 44, padding: "0 12px 0 14px",
      borderRadius: 999,
      border: `1px solid ${C.border}`,
      background: C.surface,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>Fart</div>
      <div style={{ display: "inline-flex", gap: 2, padding: 2, background: C.surfaceDim, borderRadius: 999 }}>
        {stops.map(s => {
          const active = s === value;
          return (
            <button key={s}
              onClick={() => onChange(s)}
              style={{
                padding: "4px 10px",
                fontFamily: "Geist Mono, monospace",
                fontSize: 12, fontWeight: 600,
                borderRadius: 999, border: "none",
                background: active ? RT.orange : "transparent",
                color: active ? "#fff" : C.fg,
                cursor: "pointer",
                minWidth: 34,
                fontVariantNumeric: "tabular-nums",
                transition: "background 160ms",
              }}
            >{s}x</button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step row + events ──────────────────────────────────────────────────
function StepRow({ step, index, isCurrent, isDone, isFuture, machine, elapsedInStep, eventsSeen, open, onToggle, onJump, C }) {
  const progress = isDone ? 1 : (isCurrent ? Math.min(1, elapsedInStep / step.duration_ms) : 0);
  const statusColor = isDone ? RT.done
    : isCurrent ? (machine === "paused" ? RT.paused : machine === "error" ? RT.error : RT.running)
    : C.muted;

  const rowBg = isCurrent ? "rgba(249,115,22,0.03)" : "transparent";
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        padding: "0 22px",
        background: hover ? (isCurrent ? "rgba(249,115,22,0.06)" : C.surfaceDim) : rowBg,
        borderBottom: `1px solid ${C.borderSoft}`,
        transition: "background 120ms",
      }}
    >
      {/* Current-step accent bar on the left */}
      {isCurrent && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: statusColor,
        }}/>
      )}

      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "12px 0", cursor: "pointer",
        }}
      >
        {/* Step index + state dot */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          width: 56, flexShrink: 0,
        }}>
          <div style={{
            fontFamily: "Geist Mono, monospace",
            fontSize: 11, color: C.muted,
            fontVariantNumeric: "tabular-nums",
          }}>
            {String(index + 1).padStart(2, "0")}
          </div>
          <StepDot isCurrent={isCurrent} isDone={isDone} isFuture={isFuture} machine={machine} color={statusColor}/>
        </div>

        {/* Label + desc */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: isFuture ? C.muted : C.fg,
            letterSpacing: "-0.005em",
            textDecoration: isFuture ? "none" : "none",
          }}>
            {step.label}
          </div>
          <div style={{
            fontSize: 12, color: C.muted,
            marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {step.desc}
          </div>
        </div>

        {/* mini progress + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <div style={{ width: 110 }}>
            <div style={{
              position: "relative", height: 4, background: C.surfaceDim,
              borderRadius: 999, overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${progress * 100}%`,
                background: statusColor,
                transition: "width 100ms linear",
              }}/>
            </div>
          </div>
          <div style={{
            fontFamily: "Geist Mono, monospace",
            fontSize: 11, color: C.muted,
            fontVariantNumeric: "tabular-nums",
            minWidth: 56, textAlign: "right",
          }}>
            {isCurrent ? fmtTime(elapsedInStep) : isDone ? fmtTime(step.duration_ms) : fmtTime(step.duration_ms)}
          </div>
          {/* event count pill */}
          <div style={{
            fontSize: 11, fontWeight: 600,
            fontFamily: "Geist Mono, monospace",
            color: C.muted, minWidth: 40, textAlign: "right",
          }}>
            {(eventsSeen.size || 0)}<span style={{ opacity: 0.5 }}>/{step.events.length}</span>
          </div>
          <div style={{ width: 20, display: "flex", justifyContent: "center" }}>
            {Icon.chev(12, C.muted, open ? 90 : 0)}
          </div>
        </div>
      </div>

      {/* Event log (expanded) */}
      {open && (
        <div style={{
          paddingLeft: 80, paddingRight: 8, paddingBottom: 14, paddingTop: 2,
          animation: "remoteExpand 200ms ease-out",
        }}>
          <div style={{
            borderLeft: `1px dashed ${C.border}`,
            paddingLeft: 14,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
              color: C.muted, marginBottom: 8,
            }}>
              Event-logg ({step.events.length})
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {step.events.map((e, i) => {
                const meta = EVENT_META[e.kind] || EVENT_META.ok;
                const seen = isDone || eventsSeen.has(i);
                return (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "62px 20px 56px 1fr",
                    alignItems: "center", gap: 10,
                    fontFamily: "Geist Mono, monospace",
                    fontSize: 12,
                    opacity: seen ? 1 : 0.35,
                    transition: "opacity 300ms",
                  }}>
                    <div style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>
                      +{(e.t / 1000).toFixed(2)}s
                    </div>
                    <div style={{
                      color: meta.color, fontSize: 13, textAlign: "center",
                      fontFamily: "Geist, sans-serif", fontWeight: 700,
                    }}>
                      {meta.symbol}
                    </div>
                    <div style={{
                      color: meta.color,
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      fontFamily: "Geist, sans-serif",
                    }}>
                      {e.kind}
                    </div>
                    <div style={{ color: C.fg }}>
                      {e.text}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <button
                onClick={(ev) => { ev.stopPropagation(); onJump(); }}
                style={{
                  height: 28, padding: "0 12px",
                  fontSize: 11, fontWeight: 600,
                  fontFamily: "Geist, sans-serif",
                  background: C.surfaceDim, color: C.fg,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Spol til dette steget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step dot (status icon in list) ───────────────────────────────────────
function StepDot({ isCurrent, isDone, isFuture, machine, color }) {
  if (isDone) {
    return (
      <div style={{
        width: 20, height: 20, borderRadius: 999,
        background: RT.done, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {Icon.check(11, "#fff")}
      </div>
    );
  }
  if (isCurrent) {
    const pulse = machine === "running";
    return (
      <div style={{
        position: "relative", width: 20, height: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 999,
          border: `2px solid ${color}`,
          background: machine === "paused" ? "rgba(193,130,0,0.18)" : "rgba(17,173,50,0.14)",
        }}/>
        <div style={{
          position: "absolute", width: 8, height: 8, borderRadius: 999,
          background: color,
        }}/>
        {pulse && (
          <div style={{
            position: "absolute", inset: -3, borderRadius: 999,
            border: `2px solid ${color}`, opacity: 0.5,
            animation: "remotePulseRing 1.3s ease-out infinite",
          }}/>
        )}
      </div>
    );
  }
  return (
    <div style={{
      width: 20, height: 20, borderRadius: 999,
      border: `1.5px dashed rgba(120,115,110,0.5)`,
    }}/>
  );
}

Object.assign(window, { Remote, StepTimeline, StepRow, StepDot, SpeedControl });
