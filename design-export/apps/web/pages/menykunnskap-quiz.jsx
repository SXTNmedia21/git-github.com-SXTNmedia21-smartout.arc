// ===== Menykunnskap — staff quiz experience (in-phone, playable) =====
// Overlay launched from the Opplæring book / capture-flow preview. Playful, fast,
// instant teaching feedback, streaks, progress + celebratory completion.
// window.MkQuizPlay.
(function () {
  const { useState, useEffect, useRef } = React;
  const M = () => window.Mk;
  const D = () => window.SmartoutData;
  const Ic = window.Ic;

  const dishName = (id) => {
    const all = [...(D().MK_DISHES || []), ...(D().MK_DRINKS || [])];
    const d = all.find((x) => x.id === id);
    return d ? d.name : null;
  };

  function MkQuizPlay({ onClose, toast, staff }) {
    const qs = D().MK_QUIZ_QUESTIONS;
    const { Phone, Ring, Confetti } = M();
    const [phase, setPhase] = useState("intro"); // intro | play | done
    const [qi, setQi] = useState(0);
    const [picked, setPicked] = useState(null);
    const [streak, setStreak] = useState(0);
    const [bump, setBump] = useState(false);
    const [correct, setCorrect] = useState(0);
    const bodyRef = useRef(null);

    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [qi, phase]);

    const q = qs[qi];
    const total = qs.length;
    const QT = D().MK_QTYPES;
    const isCorrect = picked != null && picked === q.answer;

    const pick = (k) => {
      if (picked != null) return;
      setPicked(k);
      const right = k === q.answer;
      if (right) { setCorrect((c) => c + 1); setStreak((s) => s + 1); setBump(true); setTimeout(() => setBump(false), 420); }
      else setStreak(0);
    };
    const next = () => {
      if (qi + 1 >= total) { setPhase("done"); return; }
      setQi((i) => i + 1); setPicked(null);
    };
    const restart = () => { setPhase("intro"); setQi(0); setPicked(null); setStreak(0); setCorrect(0); };

    const score = Math.round((correct / total) * 100);
    const passed = score >= 80;

    return (
      <div className="mk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="mk-phone-stage" onMouseDown={(e) => e.stopPropagation()}>
          <Phone>
            {phase === "intro" && (
              <div className="mk-cap" style={{ justifyContent: "center", gap: 20 }}>
                <div className="mk-cap-hero">
                  <div className="eyebrow">Bistro Nord · Opplæring</div>
                  <h2>Vintermeny-quiz</h2>
                  <p>{total} raske spørsmål · ~4 min. Du må ha 80 % for å bli skiftklar. Feil svar lærer deg noe — ingen som dømmer.</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {[["utensils", "Retter, råvarer & tilberedning"], ["alert", "Allergener du må kunne"], ["wallet", "Vin & drikkeparinger"], ["star", "Gjest & mersalg"]].map(([ic, t]) => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 13 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--orange-soft)", color: "var(--orange-dark)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic n={ic} s={16} /></span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{t}</span>
                    </div>
                  ))}
                </div>
                <div className="mk-cap-foot">
                  <button className="mk-cap-start" onClick={() => setPhase("play")}><Ic n="play" s={17} c="#fff" /> Start quiz</button>
                </div>
              </div>
            )}

            {phase === "play" && q && (
              <div className="mk-quiz">
                <div className="mk-quiz-top">
                  <span className="mk-quiz-x" onClick={onClose}><Ic n="x" s={16} /></span>
                  <div className="mk-quiz-pbar"><span style={{ width: ((qi + (picked != null ? 1 : 0)) / total) * 100 + "%" }} /></div>
                  <span className={`mk-quiz-streak ${bump ? "bump" : ""}`}><Ic n="zap" s={14} c="var(--orange)" /> {streak}</span>
                </div>

                <div className="mk-quiz-card" ref={bodyRef}>
                  <span className="mk-q-type"><Ic n={(QT[q.type] || {}).icon || "list"} s={12} /> {(QT[q.type] || {}).label} · {q.round}</span>
                  {q.dish && dishName(q.dish) && (
                    <div className="mk-q-dishimg">
                      <window.Mk.ImageDrop k={"plate_" + q.dish} kind="plate" radius={16} placeholder="" />
                      <span className="nm">{dishName(q.dish)}</span>
                    </div>
                  )}
                  <div className="mk-q-prompt">{q.prompt}</div>

                  {q.type === "sveip" ? (
                    <div className="mk-swipe">
                      {q.options.map((o) => {
                        const st = picked != null ? (o.k === q.answer ? "correct" : o.k === picked ? "wrong" : "dim") : "";
                        return (
                          <button key={String(o.k)} className={`${o.k ? "t" : "f"} ${st}`} style={st === "correct" ? { borderColor: "var(--success)", color: "var(--success)" } : st === "wrong" ? { borderColor: "var(--error)", color: "var(--error)" } : null} onClick={() => pick(o.k)}>
                            <Ic n={o.k ? "check" : "x"} s={22} sw={2.4} /> {o.t}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mk-q-opts">
                      {q.options.map((o, i) => {
                        const st = picked != null ? (o.k === q.answer ? "correct" : o.k === picked ? "wrong" : "dim") : "";
                        return (
                          <button key={String(o.k)} className={`mk-q-opt ${st}`} onClick={() => pick(o.k)}>
                            <span className="key">{picked != null && o.k === q.answer ? <Ic n="check" s={14} sw={2.6} /> : picked === o.k ? <Ic n="x" s={14} sw={2.6} /> : String.fromCharCode(65 + i)}</span>
                            <span>{o.t}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {picked != null && (
                  <div className={`mk-feedback ${isCorrect ? "ok" : "no"}`}>
                    <div className="mk-fb-head">
                      <span className={`mk-fb-ic ${isCorrect ? "ok" : "no"}`}><Ic n={isCorrect ? "check" : "x"} s={20} sw={2.6} /></span>
                      <div>
                        <div className={`mk-fb-title ${isCorrect ? "ok" : "no"}`}>{isCorrect ? (streak >= 3 ? `Riktig! ${streak} på rad 🔥` : "Riktig!") : "Ikke helt"}</div>
                      </div>
                    </div>
                    <div className="mk-fb-teach">{q.teach}</div>
                    <button className="mk-fb-next" onClick={next}>{qi + 1 >= total ? "Se resultat" : "Neste"} <Ic n="arrowRight" s={16} c="#fff" /></button>
                  </div>
                )}
              </div>
            )}

            {phase === "done" && (
              <div className="mk-done" style={{ position: "relative" }}>
                {passed && <Confetti n={42} />}
                <div style={{ position: "relative", zIndex: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <Ring value={score} size={120} stroke={10} sub={passed ? "skiftklar" : "prøv igjen"} />
                  <h2>{passed ? "Du er skiftklar!" : "Nesten der"}</h2>
                  <span className={`pass ${passed ? "ok" : "no"}`}>
                    <Ic n={passed ? "check" : "repeat"} s={13} sw={2.4} />
                    {passed ? "Bestått — 80 % påkrevd" : "Trenger 80 % · helt greit, prøv igjen"}
                  </span>
                  <div className="mk-done-stats">
                    <div className="mk-done-stat"><b>{correct}/{total}</b><span>riktige</span></div>
                    <div className="mk-done-stat"><b style={{ color: "var(--orange)" }}>+{correct * 15}</b><span>XP</span></div>
                    <div className="mk-done-stat"><b>{score}%</b><span>score</span></div>
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 0", lineHeight: 1.45 }}>
                    {passed ? "Godt jobba. XP teller mot rangen din og loggføres på menykunnskap." : "Du var svakest på vin & vegetarretter. Ta en ny runde når du vil."}
                  </p>
                  <div className="mk-done-cta">
                    <button className="mk-cap-start" style={{ height: 48 }} onClick={() => { toast(passed ? "Resultat lagret · Maria varslet" : "Du kan prøve igjen når som helst"); onClose(); }}>
                      <Ic n="check" s={16} c="#fff" sw={2.2} /> {passed ? "Ferdig" : "Lukk"}
                    </button>
                    <button className="mk-btn ghost" style={{ justifyContent: "center", height: 44 }} onClick={restart}><Ic n="repeat" s={14} /> Ta på nytt</button>
                  </div>
                </div>
              </div>
            )}
          </Phone>

          {!staff && (
          <div style={{ maxWidth: 240, paddingTop: 30, color: "var(--bg)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.12)", color: "#fff", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
              <Ic n="eye" s={13} c="#fff" /> Forhåndsvisning · slik ser staben den
            </div>
            <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 13, lineHeight: 1.55 }}>
              Dette er den spillbare quizen ansatte får på telefonen. Feil svar forklarer i stedet for å straffe, riktige bygger streak og XP, og 80 % gjør dem skiftklare.
            </p>
            <button className="mk-btn" style={{ marginTop: 8, background: "rgba(255,255,255,0.1)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }} onClick={onClose}><Ic n="x" s={14} c="#fff" /> Lukk forhåndsvisning</button>
          </div>
          )}
        </div>
      </div>
    );
  }

  window.MkQuizPlay = MkQuizPlay;
})();
