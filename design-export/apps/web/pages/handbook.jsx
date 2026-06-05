// ===== Smartout — Håndbok app (router + sidebar) =====
// Renders the Dokumentmodus sidebar + active view. Exports window.HandbookApp.
(function () {
  const { useState, useEffect } = React;
  const Ic = window.Ic;
  const SD = window.SmartoutData;
  const { HbRing, HbChip } = window;

  const bookById = (id) => SD.HANDBOOKS.find(b => b.id === id);

  // ---------- sidebar ----------
  function HbSide({ view, bookId, openExit, collapsed, openBookId, setOpenBookId, nav, openBot }) {
    const [q, setQ] = useState("");
    const H = SD.HB_HEALTH;
    const ql = q.trim().toLowerCase();
    const results = ql ? SD.HANDBOOKS.flatMap(b => b.chapters.flatMap(c => c.docs.filter(d => d.title.toLowerCase().includes(ql)).map(d => ({ d, c, b })))).slice(0, 8) : [];

    return (
      <aside className={`sk-side hb-side ${collapsed ? "col" : ""}`}>
        <button className="doc-exit" onClick={openExit} title="Tilbake til Smartout">
          <Ic n="chevLeft" s={16} /> {!collapsed && <span>Tilbake til Smartout</span>}
        </button>

        <button className="hb-health" onClick={() => nav.dashboard()} style={{ textAlign: "left", cursor: "pointer", font: "inherit" }}>
          <HbRing pct={H.score} size={collapsed ? 34 : 46} stroke={collapsed ? 4 : 5} numSize={collapsed ? 12 : 15} />
          {!collapsed && <span className="hb-health-meta"><span className="lbl">Bibliotek</span><span className="t">Dokumentasjonshelse</span><span className="s">{H.approved} av {H.total} godkjent</span></span>}
        </button>

        {!collapsed && (
          <div className="hb-search" onClick={(e) => e.currentTarget.querySelector("input").focus()}>
            <span className="ic"><Ic n="search" s={14} /></span>
            <input placeholder="Søk i håndbøker …" value={q} onChange={e => setQ(e.target.value)} />
            {q && <button onClick={() => setQ("")} style={{ display: "flex", color: "var(--muted-soft)" }}><Ic n="x" s={13} /></button>}
          </div>
        )}

        {ql ? (
          <nav className="hb-nav">
            <div className="hb-sec-lbl">{results.length} treff</div>
            {results.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", padding: "6px 10px" }}>Ingen dokumenter matcher.</div>}
            {results.map(({ d, c, b }) => (
              <button key={d.id} className="hb-nav-item" onClick={() => { nav.doc(b.id, c.id, d.id); setQ(""); }}>
                <span className="ic"><Ic n="file" s={15} /></span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}<span style={{ display: "block", fontSize: 10.5, color: "var(--muted)" }}>{b.short} · {c.title}</span></span>
              </button>
            ))}
          </nav>
        ) : (
          <nav className="hb-nav">
            <button className="hb-newdoc" onClick={() => nav.create()}><span className="ic"><Ic n="plus" s={15} /></span>{!collapsed && <span>Nytt dokument</span>}</button>
            <button className={`hb-nav-item ${view === "dashboard" ? "on" : ""}`} onClick={() => nav.dashboard()}><span className="ic"><Ic n="home" s={16} /></span>{!collapsed && <span>Oversikt</span>}</button>

            {!collapsed && <div className="hb-sec-lbl">Håndbøker</div>}
            {SD.HANDBOOKS.map(b => {
              const open = openBookId === b.id;
              const active = (view === "handbook" || view === "editor" || view === "wizard") && bookId === b.id;
              return (
                <div key={b.id} className={`hb-book ${open ? "open" : ""} ${active ? "on" : ""}`}>
                  <button className="hb-book-head" onClick={() => { setOpenBookId(open && active ? null : b.id); nav.book(b.id); }} title={b.name}>
                    <span className="hb-book-ic" style={{ background: b.accent }}><Ic n={b.icon} s={15} /></span>
                    {!collapsed && <span className="hb-book-name">{b.short}<span className="sub">{b.health}% fullstendig</span></span>}
                    {!collapsed && <span className="hb-book-chev"><Ic n="chevRight" s={14} /></span>}
                  </button>
                  {open && !collapsed && (
                    <div className="hb-tree">
                      {b.chapters.map(c => (
                        <button key={c.id} className="hb-ch" onClick={() => nav.book(b.id, c.id)}>
                          <span className={`hb-ch-dot ${c.state}`} />
                          <span className="hb-ch-title">{c.n}. {c.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {!collapsed && <div className="hb-sec-lbl">Drift</div>}
            <button className={`hb-nav-item ${view === "gaps" ? "on" : ""}`} onClick={() => nav.gaps()}><span className="ic"><Ic n="sparkle" s={16} /></span>{!collapsed && <span>Mangler &amp; forbedringer</span>}{!collapsed && <span className="badge warn">{SD.HB_GAPS.filter(g => g.sev !== "info").length}</span>}</button>
            <button className={`hb-nav-item ${view === "settings" ? "on" : ""}`} onClick={() => nav.settings()}><span className="ic"><Ic n="sliders" s={16} /></span>{!collapsed && <span>Innstillinger</span>}</button>
          </nav>
        )}

        <div className="sk-side-foot">
          <button className="sk-bot" onClick={openBot} title="Mr. Botsson"><span className="sk-bot-ic"><Ic n="bot" s={16} c="var(--orange)" /></span>{!collapsed && <span className="sk-navlbl">Botsson hjelper deg</span>}</button>
        </div>
      </aside>
    );
  }

  // ---------- app (router) ----------
  function HandbookApp({ onExit, collapsed, openBot }) {
    const toast = window.useToast();
    const [st, setSt] = useState({ view: "dashboard", bookId: null, chapterId: null, docId: null });
    const [openBookId, setOpenBookId] = useState(null);
    const [create, setCreate] = useState(null); // null | { bookId, chapterId }
    const [menuFlow, setMenuFlow] = useState(null); // null | { bookId, chapterId }
    const [quizPlay, setQuizPlay] = useState(null); // null | {}

    const nav = {
      dashboard: () => setSt({ view: "dashboard", bookId: null, chapterId: null, docId: null }),
      book: (bookId, chapterId = null) => { setOpenBookId(bookId); setSt({ view: "handbook", bookId, chapterId, docId: null }); },
      doc: (bookId, chapterId, docId, draft = null) => { setOpenBookId(bookId); setSt({ view: "editor", bookId, chapterId, docId, draft }); },
      gaps: () => setSt({ view: "gaps", bookId: null, chapterId: null, docId: null }),
      settings: () => setSt({ view: "settings", bookId: null, chapterId: null, docId: null }),
      booksettings: (bookId) => { setOpenBookId(bookId); setSt({ view: "booksettings", bookId, chapterId: null, docId: null }); },
      wizard: (bookId, opts = {}) => { setOpenBookId(bookId); setSt({ view: "wizard", bookId, chapterId: opts.chapterId || null, docId: null, mode: opts.mode || "draft", title: opts.title || "" }); },
      // the universal "new document" entry point — opens the method chooser
      create: (bookId = null, chapterId = null) => setCreate({ bookId, chapterId }),
      // training: capture a menu → AI reads → verify → build quiz (Opplæring book)
      menuflow: (bookId = "opplaering", chapterId = null) => setMenuFlow({ bookId, chapterId }),
      // training: play the staff quiz in a phone frame
      playquiz: (opts = {}) => setQuizPlay(opts),
    };

    // scroll to a chapter when navigating to one within a handbook detail
    useEffect(() => {
      // deep-link target set by another module (e.g. Kontrakter → Maler)
      try { const t = window.__hbTarget; if (t && t.bookId) { window.__hbTarget = null; nav.book(t.bookId, t.chapterId || null); return; } } catch (e) {}
    }, []);
    useEffect(() => {
      if (st.view === "handbook" && st.chapterId) {
        const id = "ch-" + st.chapterId;
        setTimeout(() => {
          const el = document.getElementById(id), main = document.querySelector(".sk-main");
          if (el && main) main.scrollTo({ top: Math.max(el.offsetTop - 18, 0), behavior: "smooth" });
        }, 70);
      } else {
        const main = document.querySelector(".sk-main"); if (main) main.scrollTo(0, 0);
      }
    }, [st.view, st.bookId, st.chapterId, st.docId]);

    let content;
    if (st.view === "dashboard") content = <window.HbDashboard nav={nav} toast={toast} />;
    else if (st.view === "handbook") content = <window.HbHandbookDetail bookId={st.bookId} focusChapter={st.chapterId} nav={nav} toast={toast} />;
    else if (st.view === "editor") content = <window.HbEditor bookId={st.bookId} chapterId={st.chapterId} docId={st.docId} draft={st.draft} nav={nav} toast={toast} openBot={openBot} />;
    else if (st.view === "gaps") content = <window.HbGaps nav={nav} toast={toast} />;
    else if (st.view === "wizard") content = <window.HbWizard bookId={st.bookId} mode={st.mode} title={st.title} chapterId={st.chapterId} nav={nav} toast={toast} />;
    else if (st.view === "settings") content = <window.HbSettings nav={nav} toast={toast} />;
    else if (st.view === "booksettings") content = <window.HbBookSettings bookId={st.bookId} nav={nav} toast={toast} />;

    return (
      <>
        <HbSide view={st.view} bookId={st.bookId} openExit={onExit} collapsed={collapsed} openBookId={openBookId} setOpenBookId={setOpenBookId} nav={nav} openBot={openBot} />
        {content}
        <window.HbCreate open={!!create} bookId={create && create.bookId} chapterId={create && create.chapterId} nav={nav} toast={toast} onClose={() => setCreate(null)} />
        {menuFlow && window.MkAddFlow && (
          <window.MkAddFlow
            toast={toast}
            onClose={() => setMenuFlow(null)}
            onPreview={() => setQuizPlay({})}
            onPublish={() => { const dest = menuFlow; setMenuFlow(null); toast("Opplæringsmodul publisert til staben", { undo: () => {} }); nav.book((dest && dest.bookId) || "opplaering", dest && dest.chapterId); }}
          />
        )}
        {quizPlay && window.MkQuizPlay && (
          <window.MkQuizPlay toast={toast} onClose={() => setQuizPlay(null)} />
        )}
      </>
    );
  }

  window.HandbookApp = HandbookApp;
})();
