// Ansatt-quiz — ett spørsmål per skjerm, autolagring, resultat med kilde-pek
function QuizGuide({ quizId, onClose }) {
  const draft = window.SmartoutData.QUIZ_DRAFT;
  const [answers, setAnswers] = React.useState({});
  const [submitted, setSubmitted] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);
  const [idx, setIdx] = React.useState(-1); // -1 = cover

  // Autolagring
  React.useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    const t = setTimeout(() => setSavedAt(new Date()), 400);
    return () => clearTimeout(t);
  }, [answers]);

  const setA = (id, value) => setAnswers(a => ({ ...a, [id]: value }));

  const isCorrect = (q) => {
    const a = answers[q.id];
    if (a === undefined) return false;
    switch (q.type) {
      case 'single': case 'image-choice': return a === q.correct;
      case 'multi': return Array.isArray(a) && a.length === q.correct.length && q.correct.every(x => a.includes(x));
      case 'truefalse': return a === q.correct;
      case 'short-text': return (a || '').trim().toLowerCase() === q.correctText.toLowerCase();
      case 'long-text': return null; // manuell
      case 'sort': return JSON.stringify(a) === JSON.stringify(q.correctOrder);
      case 'match': return a && q.pairs.every((p, i) => a[i] === i);
      case 'scale': return a !== undefined; // alltid godkjent
      case 'hotspot': {
        if (!a) return false;
        const dx = a.x - q.hotspot.x, dy = a.y - q.hotspot.y;
        return Math.sqrt(dx*dx + dy*dy) <= q.hotspot.radius;
      }
      case 'number': return Math.abs((a ?? -999) - q.correctNumber) <= q.tolerance;
      default: return false;
    }
  };

  const totalWeight = draft.questions.reduce((s, q) => s + q.weight, 0);
  const earnedWeight = draft.questions.reduce((s, q) => s + (isCorrect(q) ? q.weight : 0), 0);
  const scorePct = Math.round((earnedWeight / totalWeight) * 100);
  const passed = scorePct >= draft.meta.passingScore;
  const wrongQ = draft.questions.filter(q => submitted && !isCorrect(q) && q.type !== 'long-text');

  const answeredCount = draft.questions.filter(q => answers[q.id] !== undefined).length;

  if (submitted) {
    return (
      <div className="quiz-result-viewer">
        <div className="quiz-result-shell">
          <button className="guide-close" style={{ position: 'absolute', top: 18, right: 18 }} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
          <div className={`quiz-result-hero ${passed ? 'pass' : 'fail'}`}>
            <div className="quiz-result-ico">
              <Icon name={passed ? 'check' : 'bell'} size={36} />
            </div>
            <div className="quiz-result-eyebrow">{passed ? 'Bestått' : 'Ikke bestått ennå'}</div>
            <h1>{scorePct}%</h1>
            <p>Du fikk {earnedWeight} av {totalWeight} poeng. Beståttgrense {draft.meta.passingScore}%.</p>
          </div>

          {wrongQ.length > 0 && (
            <div className="quiz-result-wrong">
              <h3>Les dette på nytt</h3>
              <p className="muted-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: 13, color: 'var(--muted)', fontWeight: 'normal', marginBottom: 14 }}>
                Du svarte feil på {wrongQ.length} {wrongQ.length === 1 ? 'spørsmål' : 'spørsmål'}. Hvert peker tilbake til kilden.
              </p>
              {wrongQ.map((q, i) => {
                const idx = draft.questions.indexOf(q);
                return (
                  <div key={q.id} className="quiz-result-card">
                    <div className="quiz-q-num mono">SPM {String(idx + 1).padStart(2, '0')}</div>
                    <div className="quiz-result-card-prompt">{q.prompt}</div>
                    <div className="quiz-result-explain">{q.explanation}</div>
                    <button className="quiz-result-source-btn">
                      <Icon name="book" size={13} /> Les: {q.source} <Icon name="arrow-right" size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="quiz-result-footer">
            <button className="btn btn-secondary" onClick={() => setSubmitted(false)}>Tilbake til quiz</button>
            <button className="btn btn-primary btn-lg" onClick={onClose}>Ferdig</button>
          </div>
        </div>
      </div>
    );
  }

  const total = draft.questions.length;
  const isCover = idx === -1;
  const isReview = idx === total;
  const currentQ = !isCover && !isReview ? draft.questions[idx] : null;
  const currentAnswered = currentQ ? answers[currentQ.id] !== undefined : false;
  const next = () => setIdx(i => Math.min(i + 1, total));
  const prev = () => setIdx(i => Math.max(i - 1, -1));
  const progressPct = isCover ? 0 : isReview ? 100 : ((idx + (currentAnswered ? 1 : 0)) / total) * 100;

  return (
    <div className="guide-viewer">
      <div className="guide-shell">
        <div className="guide-topbar">
          <button className="guide-close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
          <div className="guide-progress">
            <div className="guide-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="guide-progress-label mono">
            {isCover ? '0' : isReview ? total : idx + 1}/{total}
          </span>
        </div>

        <div className="guide-content">
          {isCover && (
            <div className="guide-cover">
              <div className="guide-eyebrow">Quiz</div>
              <h1>{draft.title}</h1>
              <p className="guide-sub">{total} spørsmål · ~{draft.meta.estimatedTime} min · {draft.meta.passingScore}% for å bestå</p>
              <button className="btn btn-primary btn-lg guide-cta" onClick={next}>
                Start <Icon name="arrow-right" size={16} />
              </button>
              <p className="guide-hint">Ett spørsmål om gangen. Du kan gå tilbake og endre svar.</p>
            </div>
          )}

          {currentQ && (
            <div className="guide-step">
              <div className="guide-step-head">
                <div className="guide-eyebrow mono">SPM {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
                <h2>{currentQ.prompt}</h2>
                {savedAt && idx > -1 && (
                  <div className="quiz-autosave" style={{ marginTop: 8 }}>
                    <Icon name="check" size={11} /> Autolagret
                  </div>
                )}
              </div>
              <div className="guide-step-body">
                <QuizInput q={currentQ} answer={answers[currentQ.id]} onAnswer={(v) => setA(currentQ.id, v)} />
              </div>
            </div>
          )}

          {isReview && (
            <div className="guide-cover">
              <div className="guide-eyebrow">Klar til å levere</div>
              <h1>Sjekk gjennom</h1>
              <p className="guide-sub">Du har svart på {answeredCount} av {total} spørsmål.</p>
              {answeredCount < total ? (
                <button className="btn btn-secondary btn-lg guide-cta" onClick={() => {
                  const firstUnanswered = draft.questions.findIndex(q => answers[q.id] === undefined);
                  if (firstUnanswered >= 0) setIdx(firstUnanswered);
                }}>
                  Fullfør resten <Icon name="arrow-right" size={16} />
                </button>
              ) : (
                <button className="btn btn-primary btn-lg guide-cta" onClick={() => setSubmitted(true)}>
                  Lever inn <Icon name="arrow-right" size={16} />
                </button>
              )}
              <p className="guide-hint">Trykk Tilbake hvis du vil endre et svar.</p>
            </div>
          )}
        </div>

        {(currentQ || isReview) && (
          <div className="guide-footer">
            <button className="btn btn-ghost" onClick={prev}>
              <Icon name="arrow-left" size={14} /> Tilbake
            </button>
            <div style={{ flex: 1 }} />
            {currentQ && (
              <button
                className="btn btn-primary btn-lg"
                onClick={next}
                disabled={!currentAnswered && currentQ.type !== 'long-text'}
              >
                {idx === total - 1 ? 'Sjekk svar' : 'Neste'} <Icon name="arrow-right" size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Bare input-delen — uten kort-wrapper, siden steget gir headeren
function QuizInput({ q, answer, onAnswer }) {
  return <QuizQuestionInner q={q} answer={answer} onAnswer={onAnswer} />;
}

function QuizQuestionInner({ q, answer, onAnswer }) {
  const renderInput = () => {
    switch (q.type) {
      case 'single':
        return (
          <div className="qa-options">
            {q.options.map((o, idx) => (
              <button key={idx} className={`qa-radio ${answer === idx ? 'selected' : ''}`} onClick={() => onAnswer(idx)}>
                <span className="qa-bullet">{answer === idx && <span className="qa-bullet-dot" />}</span>
                <span>{o}</span>
              </button>
            ))}
          </div>
        );
      case 'multi': {
        const a = answer || [];
        const toggle = (idx) => onAnswer(a.includes(idx) ? a.filter(x => x !== idx) : [...a, idx]);
        return (
          <div className="qa-options">
            {q.options.map((o, idx) => (
              <button key={idx} className={`qa-checkbox ${a.includes(idx) ? 'selected' : ''}`} onClick={() => toggle(idx)}>
                <span className="qa-square">{a.includes(idx) && <Icon name="check" size={13} />}</span>
                <span>{o}</span>
              </button>
            ))}
          </div>
        );
      }
      case 'image-choice':
        return (
          <div className="qa-img-grid">
            {q.options.map((o, idx) => (
              <button key={idx} className={`qa-img-card ${answer === idx ? 'selected' : ''}`} onClick={() => onAnswer(idx)}>
                <div className="qa-img-frame"><Icon name="image" size={26} /></div>
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        );
      case 'truefalse':
        return (
          <div className="qa-tf">
            <button className={`qa-tf-btn ${answer === true ? 'selected' : ''}`} onClick={() => onAnswer(true)}>Sant</button>
            <button className={`qa-tf-btn ${answer === false ? 'selected' : ''}`} onClick={() => onAnswer(false)}>Usant</button>
          </div>
        );
      case 'short-text':
        return <input className="qa-input" type="text" value={answer || ''} onChange={e => onAnswer(e.target.value)} placeholder="Skriv svaret…" />;
      case 'long-text':
        return <textarea className="qa-input qa-textarea" rows={4} value={answer || ''} onChange={e => onAnswer(e.target.value)} placeholder="Skriv svaret…" />;
      case 'sort': {
        const order = answer || q.items.map((_, k) => k);
        const move = (from, to) => {
          if (to < 0 || to >= order.length) return;
          const next = [...order];
          [next[from], next[to]] = [next[to], next[from]];
          onAnswer(next);
        };
        return (
          <div className="qa-sort">
            {order.map((origIdx, pos) => (
              <div key={origIdx} className="qa-sort-row">
                <span className="qa-sort-num mono">{pos + 1}</span>
                <span className="qa-sort-text">{q.items[origIdx]}</span>
                <button className="qa-sort-btn" onClick={() => move(pos, pos - 1)} disabled={pos === 0}>↑</button>
                <button className="qa-sort-btn" onClick={() => move(pos, pos + 1)} disabled={pos === order.length - 1}>↓</button>
              </div>
            ))}
          </div>
        );
      }
      case 'match': {
        const a = answer || {};
        const setPair = (leftIdx, rightIdx) => onAnswer({ ...a, [leftIdx]: rightIdx });
        return (
          <div className="qa-match">
            {q.pairs.map((p, idx) => (
              <div key={idx} className="qa-match-row">
                <span className="qa-match-left">{p.left}</span>
                <Icon name="arrow-right" size={13} />
                <select className="qa-match-select" value={a[idx] ?? ''} onChange={e => setPair(idx, parseInt(e.target.value))}>
                  <option value="">Velg…</option>
                  {q.pairs.map((pp, j) => <option key={j} value={j}>{pp.right}</option>)}
                </select>
              </div>
            ))}
          </div>
        );
      }
      case 'scale':
        return (
          <div className="qa-scale">
            <div className="qa-scale-row">
              {Array.from({ length: q.max - q.min + 1 }, (_, idx) => {
                const v = q.min + idx;
                return (
                  <button key={v} className={`qa-scale-btn mono ${answer === v ? 'selected' : ''}`} onClick={() => onAnswer(v)}>
                    {v}
                  </button>
                );
              })}
            </div>
            <div className="qa-scale-labels">
              <span>{q.labels[0]}</span>
              <span>{q.labels[q.labels.length - 1]}</span>
            </div>
          </div>
        );
      case 'hotspot':
        return (
          <button
            className="qa-hotspot"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              onAnswer({ x, y });
            }}
          >
            <div className="qa-hotspot-bg">
              <Icon name="image" size={32} />
              <span>{q.placeholder}</span>
            </div>
            {answer && (
              <span className="qa-hotspot-mark" style={{ left: `${answer.x}%`, top: `${answer.y}%` }} />
            )}
          </button>
        );
      case 'number':
        return (
          <div className="qa-number">
            <input type="number" className="qa-input mono" value={answer ?? ''} onChange={e => onAnswer(e.target.value === '' ? undefined : parseFloat(e.target.value))} />
            <span className="qa-number-unit">{q.unit}</span>
          </div>
        );
      default: return null;
    }
  };

  return renderInput();
}

window.QuizGuide = QuizGuide;
