// ===== Smartout — Håndbok: "Lag nytt dokument"-velger =====
// The single entry point for creating a document anywhere in Bibliotek.
// Three paths: Veiviser (guided) · Botsson skriver utkast (draft) · Manuelt (blank).
// AI is assistive in every path — nothing publishes without human approval.
// Exports window.HbCreate.
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const SD = window.SmartoutData;

  const METHODS = [
    {
      id: "meny", icon: "camera", title: "Lag fra meny",
      desc: "Ta bilde, last opp PDF, lim inn lenke eller tekst. Botsson leser menyen, du bekrefter, og en spillbar quiz bygges.",
      tag: "Anbefalt for opplæring", tagTone: "brand", best: (b) => b.training, onlyTraining: true,
    },
    {
      id: "veiviser", icon: "route", title: "Bruk veiviser",
      desc: "Steg for steg. Botsson guider deg gjennom alt som må med — du fyller inn og bekrefter underveis.",
      tag: "Anbefalt for lovpålagt", tagTone: "ok", best: (b) => b.statutory,
    },
    {
      id: "utkast", icon: "spark2", title: "La Botsson skrive utkast",
      desc: "Botsson leser eksisterende dokumenter og skriver et komplett førsteutkast du går gjennom og godkjenner.",
      tag: "Raskest", tagTone: "brand",
    },
    {
      id: "manuelt", icon: "pen", title: "Skriv selv",
      desc: "Start med et tomt dokument og skriv alt fra bunnen. Botsson kan fortsatt hjelpe når du vil.",
      tag: "Full kontroll", tagTone: "muted",
    },
  ];

  function HbCreate({ open, bookId, chapterId, nav, toast, onClose }) {
    const books = SD.HANDBOOKS;
    const [bk, setBk] = useState(bookId || (books[0] && books[0].id));
    const [chId, setChId] = useState(chapterId || null);
    const [title, setTitle] = useState("");
    const [method, setMethod] = useState(null);

    // keep selection in sync when opened from a specific place
    React.useEffect(() => {
      if (!open) return;
      setBk(bookId || (books[0] && books[0].id));
      setChId(chapterId || null);
      setTitle(""); setMethod(null);
    }, [open, bookId, chapterId]);

    if (!open) return null;
    const book = books.find((b) => b.id === bk) || books[0];
    const methods = METHODS.filter((m) => !m.onlyTraining || book.training);
    const chapters = book.chapters;
    const chapter = chapters.find((c) => c.id === chId) || chapters[0];
    const effChId = chapter ? chapter.id : null;
    const defTitle = title.trim() || (method === "manuelt" ? "Nytt dokument" : `Nytt dokument i ${chapter ? chapter.title : book.short}`);

    // Botsson's suggested documents for the selected chapter (filter out ones already present)
    const SUGG = SD.HB_SUGGEST || {};
    const have = new Set((chapter ? chapter.docs : []).map((d) => d.title.toLowerCase().replace(/[^a-zæøå0-9]/gi, "")));
    const suggestions = ((effChId && SUGG[effChId]) || []).filter((s) => !have.has(s.title.toLowerCase().replace(/[^a-zæøå0-9]/gi, "")));

    const startSuggestion = (s) => {
      onClose();
      nav.wizard(book.id, { mode: "guided", title: s.title, chapterId: effChId });
    };

    const start = (m) => {
      const t = title.trim();
      onClose();
      if (m === "meny") nav.menuflow(book.id, effChId);
      else if (m === "veiviser") nav.wizard(book.id, { mode: "guided", title: t, chapterId: effChId });
      else if (m === "utkast") nav.wizard(book.id, { mode: "draft", title: t, chapterId: effChId });
      else nav.doc(book.id, effChId, "hb-new-" + Date.now(), { title: t || "Nytt dokument", isNew: true });
    };

    return (
      <div className="hb-create-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="hb-create" role="dialog" aria-modal="true">
          <div className="hb-create-head">
            <div>
              <div className="hb-create-eyebrow"><Ic n="bot" s={12} /> Bibliotek · Bistro Nord</div>
              <h3>Lag nytt dokument</h3>
              <p>Velg hvor det skal ligge, og hvordan du vil lage det.</p>
            </div>
            <button className="hb-create-x" onClick={onClose} aria-label="Lukk"><Ic n="x" s={18} /></button>
          </div>

          {/* context: book + chapter + title */}
          <div className="hb-create-ctx">
            <div className="fld">
              <label>Håndbok</label>
              <div className="hb-create-books">
                {books.map((b) => (
                  <button key={b.id} className={`hb-create-book ${b.id === bk ? "on" : ""}`} style={b.id === bk ? { "--acc": b.accent } : null}
                    onClick={() => { setBk(b.id); setChId(null); }}>
                    <span className="ic" style={{ background: b.accent }}><Ic n={b.icon} s={13} c="#fff" /></span>
                    {b.short}
                  </button>
                ))}
              </div>
            </div>
            <div className="hb-create-row">
              <div className="fld">
                <label>Kapittel</label>
                <div className="hb-create-select">
                  <select value={effChId || ""} onChange={(e) => setChId(e.target.value)}>
                    {chapters.map((c) => <option key={c.id} value={c.id}>{c.n}. {c.title}</option>)}
                  </select>
                  <span className="chev"><Ic n="chevDown" s={14} /></span>
                </div>
              </div>
              <div className="fld">
                <label>Tittel <span className="opt">valgfritt nå</span></label>
                <input className="hb-create-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="F.eks. Beredskapsplan – alvorlig hendelse" />
              </div>
            </div>
          </div>

          {/* method cards */}
          <div className="hb-create-methods">
            {methods.map((m) => {
              const best = m.best && m.best(book);
              return (
                <button key={m.id} className={`hb-create-method ${method === m.id ? "on" : ""}`}
                  onMouseEnter={() => setMethod(m.id)} onFocus={() => setMethod(m.id)}
                  onClick={() => start(m.id)}>
                  <span className="hb-create-mic"><Ic n={m.icon} s={20} /></span>
                  <span className="hb-create-mtitle">{m.title}</span>
                  <span className="hb-create-mdesc">{m.desc}</span>
                  <span className={`hb-create-mtag ${m.tagTone}`}>{best ? "Anbefalt her" : m.tag}</span>
                  <span className="hb-create-mgo">Start <Ic n="arrowRight" s={13} /></span>
                </button>
              );
            })}
          </div>

          {/* Botsson suggestions for the selected chapter */}
          {suggestions.length > 0 && (
            <div className="hb-create-sugg">
              <div className="hb-create-sugg-head">
                <span className="av"><Ic n="bot" s={13} /></span>
                <div>
                  <div className="t">Forslag til {chapter ? `«${chapter.title}»` : "dette kapitlet"}</div>
                  <div className="s">Botsson ser hva som typisk mangler her. Velg ett for å starte med veiviser.</div>
                </div>
              </div>
              <div className="hb-create-sugg-list">
                {suggestions.map((s, i) => (
                  <button key={i} className="hb-create-sugg-item" onClick={() => startSuggestion(s)}>
                    {s.conf && <span className={`hb-create-sugg-flag ${s.conf}`}>{s.conf === "high" ? "Lovpålagt" : "Anbefalt"}</span>}
                    <span className="tx">
                      <span className="t">{s.title}</span>
                      <span className="s">{s.why}</span>
                    </span>
                    <span className="go"><Ic n="route" s={14} /> Start veiviser</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="hb-create-foot">
            <span className="note"><Ic n="bot" s={13} c="var(--orange)" /> Uansett metode: Botsson foreslår, du bekrefter. Ingenting publiseres uten din godkjenning.</span>
            <button className="sk-ghost hb-btn-sm" onClick={onClose}>Avbryt</button>
          </div>
        </div>
      </div>
    );
  }

  window.HbCreate = HbCreate;
})();
