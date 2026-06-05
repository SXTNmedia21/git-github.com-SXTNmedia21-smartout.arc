// ===== Smartout — Håndbok views (dashboard · detail · gaps · settings · wizard) =====
// Exports to window: HbDashboard, HbHandbookDetail, HbGaps, HbSettings, HbWizard
(function () {
  const { useState } = React;
  const Ic = window.Ic;
  const SD = window.SmartoutData;
  const { HbRing, HbChip, HbOwner, HbModal, HbSwitch } = window;

  const bookById = (id) => SD.HANDBOOKS.find(b => b.id === id);
  const accStyle = (b) => ({ "--acc": b.accent });

  // ---------- compact document ROW (chapter list) ----------
  function DocRow({ d, onOpen }) {
    const overdue = d.due && /forfalt/i.test(d.due);
    return (
      <button className={`hb-docrow ${d.state === "outdated" ? "outdated" : ""}`} onClick={onOpen}>
        <span className="hb-docrow-ic" style={d.isWizard ? { background: "var(--orange-soft)", color: "var(--orange-dark)" } : null}><Ic n={d.isWizard ? "spark2" : "file"} s={15} /></span>
        <span className="hb-docrow-main">
          <span className="t">{d.title}{d.isWizard && <span className="hb-docrow-wiz"><Ic n="bot" s={10} /> Veiviser</span>}</span>
          <span className="m">
            <span>v{d.version}</span><span className="dot">·</span><span>{d.updated || "—"}</span>
            {d.read != null && <><span className="dot">·</span><span>{d.read} lest</span></>}
            {d.comments > 0 && <><span className="dot">·</span><span className="cmt"><Ic n="message" s={10} style={{ verticalAlign: -1 }} /> {d.comments}</span></>}
            {d.due && <span className={`hb-docrow-due ${overdue ? "crit" : ""}`}><Ic n="clock" s={10} style={{ verticalAlign: -1 }} /> {d.due}</span>}
          </span>
        </span>
        <span className="hb-docrow-right">
          <HbChip state={d.state} />
          <HbOwner owner={d.owner} size={22} />
          <span className="hb-docrow-go"><Ic n="chevRight" s={16} /></span>
        </span>
      </button>
    );
  }

  // ---------- document card (legacy grid — kept for reference) ----------
  function DocCard({ d, book, onOpen }) {
    const overdue = d.due && /forfalt/i.test(d.due);
    return (
      <button className={`hb-doccard ${d.state === "outdated" ? "outdated" : ""}`} onClick={onOpen}>
        <div className="hb-doccard-top">
          <span className="hb-doc-ic" style={d.isWizard ? { background: "var(--orange-soft)", color: "var(--orange-dark)" } : null}><Ic n={d.isWizard ? "spark2" : "file"} s={16} /></span>
          {d.isWizard && <span className="hb-wiz-badge"><Ic n="bot" s={11} /> Veiviser</span>}
          <span className="spacer" />
          <HbChip state={d.state} />
        </div>
        <h4>{d.title}</h4>
        {d.summary && <div className="sum">{d.summary}</div>}
        <div className="hb-doccard-meta">
          <span>v{d.version}</span><span>·</span><span>{d.updated}</span>
          {d.read != null && <><span>·</span><span>{d.read} lest</span></>}
          {d.comments > 0 && <><span>·</span><span style={{ color: "var(--info)" }}><Ic n="message" s={10} style={{ verticalAlign: -1 }} /> {d.comments}</span></>}
        </div>
        <div className="hb-doccard-foot">
          <HbOwner owner={d.owner} size={22} />
          {d.due && <span className={`hb-doccard-meta due ${overdue ? "crit" : ""}`} style={{ margin: 0 }}><Ic n="clock" s={11} style={{ verticalAlign: -1 }} /> {d.due}</span>}
        </div>
      </button>
    );
  }

  // ---------- book card (dashboard) ----------
  function BookCard({ book, nav }) {
    const docs = book.chapters.flatMap(c => c.docs);
    const approved = docs.filter(d => d.state === "approved").length;
    const attn = docs.filter(d => d.state === "review" || d.state === "outdated" || d.state === "draft").length;
    return (
      <button className="hb-bookcard" style={accStyle(book)} onClick={() => nav.book(book.id)}>
        <div className="hb-bookcard-top">
          <span className="hb-bookcard-ic"><Ic n={book.icon} s={20} /></span>
          <h3>{book.name}</h3>
          <div className="tag">{book.tagline}</div>
          <div className="desc">{book.desc}</div>
        </div>
        <div className="hb-bookcard-foot">
          <div className="hb-statline">
            <HbChip tone="ok" label={`${approved} godkjent`} />
            {attn > 0 && <HbChip tone="warn" label={`${attn} å følge opp`} />}
            <HbChip tone="muted" label={`${book.chapters.length} kapitler`} />
          </div>
          <div className="hb-bookbar"><span style={{ width: book.health + "%" }} /></div>
          <div className="hb-bookcard-meta">
            <span>Fullstendighet</span>
            <span className="pct">{book.health}%</span>
          </div>
        </div>
      </button>
    );
  }

  // ---------- DASHBOARD (Bibliotek hub) ----------
  function HbDashboard({ nav, toast }) {
    const H = SD.HB_HEALTH;
    const gaps = SD.HB_GAPS;
    const recent = [
      { who: "Sara K.", c: "#0E9F6E", t: "sendte Risikovurdering kjøkken 2026 til godkjenning", tm: "26. mai · 14:20", book: "hms" },
      { who: "Botsson", c: "var(--orange)", t: "foreslo struktur for Beredskapsplan", tm: "26. mai · 09:05", book: "hms" },
      { who: "Maria A.", c: "#FF7849", t: "godkjente Daglig driftsrytme v2.0", tm: "25. mai · 16:48", book: "bedrift" },
      { who: "Selma L.", c: "#10B981", t: "kommenterte Varslingsrutine", tm: "24. mai · 11:30", book: "personal" },
    ];
    return (
      <main className="sk-main">
        <div className="sk-wrap">
          <div className="hb-hero">
            <div>
              <div className="hb-hero-eyebrow">Bibliotek · Bistro Nord</div>
              <h1 className="hb-hero-title">Håndbøker</h1>
              <p className="hb-hero-sub">Selskapets levende dokumentasjon — alltid oppdatert, godkjent og lett å finne. Bedrift, HMS og personal samlet ett sted.</p>
              <div className="hb-hero-stats">
                <div className="hb-hero-stat"><div className="v">{H.total}</div><div className="k">dokumenter</div></div>
                <div className="hb-hero-stat"><div className="v ok">{H.approved}</div><div className="k">godkjent</div></div>
                <div className="hb-hero-stat"><div className="v" style={{ color: "var(--info)" }}>{H.review}</div><div className="k">til gjennomgang</div></div>
                <div className="hb-hero-stat"><div className="v crit">{H.overdue}</div><div className="k">forfalt</div></div>
              </div>
            </div>
            <div className="hb-hero-score">
              <HbRing pct={H.score} size={96} stroke={8} numSize={30} />
              <span className="cap">Dokumentasjonshelse</span>
            </div>
          </div>

          <div className="hb-books">
            {SD.HANDBOOKS.map(b => <BookCard key={b.id} book={b} nav={nav} />)}
          </div>

          <div className="so-grid-2">
            <div className="so-stack">
              <div className="so-panel">
                <div className="so-panel-head">
                  <span className="t"><span className="ico"><Ic n="alert" s={15} /></span>Krever oppmerksomhet</span>
                  <span className="cnt crit">{gaps.filter(g => g.sev !== "info").length}</span>
                  <span className="spacer" />
                  <button className="link" onClick={() => nav.gaps()}>Se alle <Ic n="arrowRight" s={13} /></button>
                </div>
                <div>
                  {gaps.slice(0, 4).map(g => (
                    <div key={g.id} className={`hb-gap ${g.sev}`} style={{ cursor: "pointer" }} onClick={() => nav.gaps()}>
                      <span className="hb-gap-ic"><Ic n={g.icon} s={18} /></span>
                      <div className="hb-gap-main">
                        <div className="hb-gap-tline">
                          <span className="hb-gap-kind">{g.kind === "missing" ? "Mangler" : g.kind === "outdated" ? "Utdatert" : g.kind === "owner" ? "Eier" : "Forbedring"}</span>
                          <HbChip tone="muted" label={bookById(g.book).short} />
                        </div>
                        <div className="hb-gap-title">{g.title}</div>
                      </div>
                      <div className="hb-gap-side"><Ic n="chevRight" s={16} c="var(--muted-soft)" /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="so-stack">
              <div className="so-panel">
                <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="history" s={15} /></span>Nylig endret</span></div>
                <div className="feed">
                  {recent.map((f, i) => (
                    <div key={i} className="feed-item">
                      <span className="feed-rail"><span className="feed-dot" style={{ background: f.c }} /></span>
                      <div className="feed-body"><span className="who">{f.who}</span> {f.t}<div className="feed-time">{f.tm}</div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="so-panel">
                <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="plus" s={15} /></span>Hurtighandlinger</span></div>
                <div className="so-panel-body pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="hb-btn-soft" style={{ width: "100%", justifyContent: "flex-start", height: 38 }} onClick={() => nav.wizard("hms", { mode: "guided" })}><Ic n="bot" s={15} /> Fortsett HMS-veiviser med Botsson</button>
                  <button className="sk-ghost" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => nav.create()}><Ic n="file" s={15} /> Nytt dokument</button>
                  <button className="sk-ghost" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => nav.settings()}><Ic n="download" s={15} /> Eksporter håndbok (PDF)</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ---------- HANDBOOK DETAIL ----------
  function HbHandbookDetail({ bookId, focusChapter, nav, toast }) {
    const book = bookById(bookId);
    const [builder, setBuilder] = useState(undefined); // undefined=closed · null=new · obj=edit (contract template generator)
    const openTpl = (d) => { const t = (window.SmartoutData.CT_TEMPLATES || []).find(x => x.id === d.tplId); setBuilder(t || null); };
    const docs = book.chapters.flatMap(c => c.docs);
    React.useEffect(() => { try { window.SmartoutContext && window.SmartoutContext.set && window.SmartoutContext.set({ route: "bibliotek", view: "Håndbok: " + book.name, handbook: book.name, handbookId: book.id, chapter: null, doc: null }); } catch (e) {} }, [bookId]);
    const counts = {
      approved: docs.filter(d => d.state === "approved").length,
      review: docs.filter(d => d.state === "review").length,
      attn: docs.filter(d => d.state === "outdated" || d.state === "draft").length,
    };
    return (
      <main className="sk-main">
        <div className="sk-wrap" style={accStyle(book)}>
          <div className="hb-crumb" style={{ marginBottom: 14 }}>
            <button onClick={() => nav.dashboard()}>Bibliotek</button>
            <span className="sep"><Ic n="chevRight" s={13} /></span>
            <span style={{ color: "var(--fg)", fontWeight: 600 }}>{book.name}</span>
          </div>

          <div className="hb-detail-hero">
            <div className="row">
              <span className="hb-detail-ic"><Ic n={book.icon} s={24} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1>{book.name}</h1>
                <div className="tag">{book.tagline}</div>
                <p className="desc">{book.desc}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <HbRing pct={book.health} size={68} stroke={6} color="var(--acc)" numSize={20} />
                <span style={{ fontSize: 10.5, color: "var(--muted)" }}>fullstendig</span>
              </div>
            </div>
            <div className="hb-detail-stats">
              <div className="hb-mini"><span className="v ok">{counts.approved}</span><span className="k">godkjent</span></div>
              <div className="hb-mini"><span className="v" style={{ color: "var(--info)" }}>{counts.review}</span><span className="k">til gjennomgang</span></div>
              <div className="hb-mini"><span className="v warn">{counts.attn}</span><span className="k">utkast / utdatert</span></div>
              <div className="hb-mini"><HbOwner owner={book.owner} size={20} /><span className="k" style={{ marginLeft: -2 }}>eier</span></div>
              {book.statutory && <div className="hb-mini"><span className="v"><Ic n="scale" s={15} c="var(--muted)" /></span><span className="k">lovpålagt</span></div>}
              <button className="sk-ghost hb-btn-sm" style={{ marginLeft: "auto" }} onClick={() => nav.booksettings(book.id)}><Ic n="sliders" s={14} /> Innstillinger</button>
              <button className="sk-ghost hb-btn-sm" onClick={() => toast("Eksport startet — PDF genereres")}><Ic n="download" s={14} /> Eksporter</button>
              {book.id === "hms" && <button className="hb-btn-soft hb-btn-sm" onClick={() => nav.wizard("hms", { mode: "guided" })}><Ic n="bot" s={14} /> Veiviser</button>}
              {book.training && <button className="hb-btn-soft hb-btn-sm" onClick={() => nav.menuflow(book.id)}><Ic n="camera" s={14} /> Lag fra meny</button>}
              {book.training && <button className="sk-ghost hb-btn-sm" onClick={() => nav.playquiz({})}><Ic n="play" s={14} /> Spill som ansatt</button>}
            </div>
          </div>

          {book.training && window.MkTrainingPanel && <window.MkTrainingPanel book={book} nav={nav} toast={toast} />}

          {book.chapters.map(ch => {
            const total = ch.docs.length;
            const okCount = ch.docs.filter(d => d.state === "approved").length;
            const attn = ch.docs.filter(d => d.state === "outdated" || d.state === "draft").length;
            const stateLbl = ch.state === "completed" ? "Fullført" : ch.state === "in_progress" ? "Pågår" : ch.state === "review" ? "Til gjennomgang" : "Ikke startet";
            return (
            <section key={ch.id} className="hb-chapter" data-state={ch.state} id={"ch-" + ch.id}>
              <header className="hb-chapter-head">
                <span className="hb-chapter-num">{ch.state === "completed" ? <Ic n="check" s={17} sw={2.6} /> : ch.n}</span>
                <div className="hb-chapter-id">
                  <div className="ttl">{ch.title}{ch.optional && <span className="hb-chapter-opt">valgfritt</span>}</div>
                  <div className="sub"><span className="st">{stateLbl}</span><span className="dot">·</span>{total > 0 ? `${total} ${total === 1 ? "dokument" : "dokumenter"}` : "Tomt"}{attn > 0 && <><span className="dot">·</span><span className="warn">{attn} trenger tilsyn</span></>}</div>
                </div>
                {total > 0 && (
                  <div className="hb-chapter-prog" title={`${okCount} av ${total} godkjent`}>
                    <div className="bar"><div className="fill" style={{ width: `${Math.round((okCount / total) * 100)}%` }} /></div>
                    <span className="lbl"><b>{okCount}</b>/{total} godkjent</span>
                  </div>
                )}
                <button className="hb-chapter-add" onClick={() => ch.tool === "contracts" ? setBuilder(null) : nav.create(book.id, ch.id)}><Ic n="plus" s={14} /> <span>{ch.tool === "contracts" ? "Ny mal" : "Dokument"}</span></button>
              </header>
              {ch.tool === "contracts" && (
                <div className="ct-advise" style={{ margin: "0 0 4px" }}>
                  <span className="ct-advise-av"><Ic n="checkdoc" s={18} /></span>
                  <div className="ct-advise-b">
                    <div className="ct-advise-id">Kontraktsmal-generator</div>
                    <p className="ct-advise-txt" style={{ margin: "6px 0 11px" }}>{ch.intro}</p>
                    <div className="ct-advise-acts">
                      <button className="ct-btn primary sm" onClick={() => setBuilder(null)}><Ic n="plus" s={14} c="#fff" sw={2.2} /> Ny kontraktsmal</button>
                      <button className="ct-btn sm" onClick={() => toast("Maler brukes av Kontrakter for auto-generering")}><Ic n="bot" s={14} /> Botsson jus-rådgiver</button>
                    </div>
                  </div>
                </div>
              )}
              {total > 0 ? (
                <div className="hb-chapter-body">
                  {ch.docs.map(d => <DocRow key={d.id} d={d} onOpen={() => ch.tool === "contracts" ? openTpl(d) : nav.doc(book.id, ch.id, d.id)} />)}
                </div>
              ) : (
                <div className="hb-chapter-empty">
                  <span className="ic"><Ic n="folderOpen" s={20} /></span>
                  <div className="tx">
                    <div className="t">Ingen dokumenter her ennå</div>
                    <div className="s">Lag ett med veiviser, la Botsson skrive utkast, eller skriv selv.</div>
                  </div>
                  <button className="hb-btn-soft hb-btn-sm" onClick={() => nav.create(book.id, ch.id)}><Ic n="plus" s={14} /> Lag dokument</button>
                </div>
              )}
            </section>
          );})}
        </div>

        {false && ( /* per-book settings moved to its own page: HbBookSettings */
          <>
            <div className="hb-drawer-scrim" onMouseDown={() => setSettings(false)} />
            <aside className="hb-drawer">
              <div className="hb-drawer-head"><span className="t">Innstillinger · {book.short}</span><span className="spacer" /><button className="sk-iconbtn" onClick={() => setSettings(false)}><Ic n="x" s={18} /></button></div>
              <div className="hb-drawer-body">
                <button className="hb-btn-soft" style={{ width: "100%", justifyContent: "center", marginBottom: 14 }} onClick={() => { setSettings(false); toast("Ny håndbok — velg navn og mal"); }}><Ic n="plus" s={15} /> Ny håndbok</button>
                <div className="hb-set-grp">
                  <div className="hb-set-lbl">Eier</div>
                  <div className="hb-set-owner"><HbOwner owner={book.owner} size={30} /><div><div className="nm">{book.owner.name}</div><div className="rl">{book.owner.role} · ansvarlig for innhold</div></div></div>
                </div>
                <div className="hb-set-grp">
                  <div className="hb-set-lbl">Hvem kan endre</div>
                  <div className="hb-access">
                    {[["admin", "Admin"], ["superadmin", "SuperAdmin"]].map(([id, l]) => <button key={id} className={`hb-access-chip ${editAccess === id ? "on" : ""}`} onClick={() => { setEditAccess(id); toast(`Redigering satt til ${l}`); }}><span className="d" />{l}</button>)}
                  </div>
                  <div className="hb-set-note"><Ic n="lock" s={12} /> {book.id === "system" ? "Systemmanualen bør være låst til SuperAdmin — den definerer hvordan systemet virker." : "Bedrift, HMS og Personal kan endres av Admin."}</div>
                </div>
                <div className="hb-set-grp">
                  <div className="hb-set-lbl">Tilgang og roller</div>
                  <div className="hb-set-subnote">Hva hver rolle kan gjøre i denne håndboken. Trykk for å slå av/på.</div>
                  {[["eier", "Eier"], ["admin", "Admin"], ["leder", "Leder"], ["ansatt", "Ansatt"]].map(([rid, rl]) => (
                    <div key={rid} className="hb-set-rolerow">
                      <div className="rn">{rl}</div>
                      <div className="hb-access">
                        {CAPS.map(([cid, cl]) => { const on = roleCaps[rid][cid]; return <button key={cid} className={`hb-access-chip ${on ? "on" : ""}`} onClick={() => toggleCap(rid, cid)}><span className="d" />{cl}</button>; })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hb-set-grp">
                  <div className="hb-set-lbl">Synlig for roller · per kapittel</div>
                  <div className="hb-set-subnote">Styr hvem som ser hvert kapittel. Ansatte ser bare godkjent innhold.</div>
                  {book.chapters.map(ch => (
                    <div key={ch.id} className="hb-set-chrow">
                      <div className="nm">{ch.n}. {ch.title}</div>
                      <div className="hb-access">
                        {[["ansatte", "Ansatte"], ["ledere", "Ledere"], ["admin", "Admin"]].map(([id, l]) => { const on = (chVis[ch.id] || []).includes(id); return <button key={id} className={`hb-access-chip ${on ? "on" : ""}`} onClick={() => toggleChVis(ch.id, id)}><span className="d" />{l}</button>; })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hb-set-grp">
                  <div className="hb-set-lbl">Eksport og arkiv</div>
                  <div className="hb-set-actions">
                    <button className="sk-ghost" onClick={() => toast("Eksporterer håndbok som PDF …")}><Ic n="download" s={15} /> Eksporter håndbok (PDF)</button>
                    <button className="sk-ghost" onClick={() => toast("Revisjonslogg eksportert")}><Ic n="history" s={15} /> Eksporter revisjonslogg</button>
                    <button className="hb-btn-danger" onClick={() => { setSettings(false); toast("Håndbok arkivert", { undo: () => {} }); }}><Ic n="archive" s={15} /> Arkiver håndbok</button>
                  </div>
                </div>
              </div>
              <div className="hb-drawer-foot"><span className="spacer" /><button className="sk-ghost" onClick={() => setSettings(false)}>Avbryt</button><button className="sk-primary" onClick={() => { setSettings(false); toast("Innstillinger lagret · logget i revisjonslogg"); }}>Lagre</button></div>
            </aside>
          </>
        )}
        {builder !== undefined && window.CtBuilder && <window.CtBuilder tpl={builder} onClose={() => setBuilder(undefined)} toast={toast} />}
      </main>
    );
  }

  // ---------- GAPS / IMPROVEMENTS ----------
  function HbGaps({ nav, toast }) {
    const [resolved, setResolved] = useState({});
    const gaps = SD.HB_GAPS.filter(g => !resolved[g.id]);
    const kindLabel = (k) => k === "missing" ? "Mangler" : k === "outdated" ? "Utdatert" : k === "owner" ? "Mangler eier" : "Forbedring";
    return (
      <main className="sk-main">
        <div className="sk-wrap">
          <div className="hb-crumb" style={{ marginBottom: 14 }}>
            <button onClick={() => nav.dashboard()}>Bibliotek</button>
            <span className="sep"><Ic n="chevRight" s={13} /></span>
            <span style={{ color: "var(--fg)", fontWeight: 600 }}>Mangler &amp; forbedringer</span>
          </div>
          <div className="sk-page-head">
            <div>
              <h1 className="sk-page-title">Mangler &amp; forbedringer</h1>
              <p className="sk-page-sub">Botsson sammenligner dokumentasjonen mot beste praksis og fanger opp hull, utdatert innhold og forbedringer. Du bestemmer alltid hva som skal gjøres.</p>
            </div>
          </div>
          <div className="so-panel">
            <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="sparkle" s={15} /></span>{gaps.length} funn fra Botsson</span></div>
            {gaps.length === 0 ? (
              <div className="so-empty"><span className="ic"><Ic n="check" s={22} /></span><div className="t">Alt i orden</div><div className="s">Ingen åpne mangler eller forbedringer akkurat nå.</div></div>
            ) : gaps.map(g => (
              <div key={g.id} className={`hb-gap ${g.sev}`}>
                <span className="hb-gap-ic"><Ic n={g.icon} s={18} /></span>
                <div className="hb-gap-main">
                  <div className="hb-gap-tline">
                    <span className="hb-gap-kind">{kindLabel(g.kind)}</span>
                    <HbChip tone="muted" label={bookById(g.book).name} />
                    {g.owner ? <HbOwner owner={g.owner} size={18} label={false} /> : <HbChip tone="warn" label="Ingen eier" />}
                  </div>
                  <div className="hb-gap-title">{g.title}</div>
                  <div className="hb-gap-why"><strong style={{ fontWeight: 600 }}>Hvorfor:</strong> {g.why}</div>
                </div>
                <div className="hb-gap-side">
                  <button className="hb-btn-soft hb-btn-sm" onClick={() => { setResolved(r => ({ ...r, [g.id]: true })); toast(`«${g.title}» åpnet — ${g.action}`, { undo: () => setResolved(r => ({ ...r, [g.id]: false })) }); }}>{g.action}</button>
                  <button className="sk-ghost hb-btn-sm" onClick={() => { setResolved(r => ({ ...r, [g.id]: true })); toast("Forslag avvist", { undo: () => setResolved(r => ({ ...r, [g.id]: false })) }); }}>Avvis</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ---------- WIZARD CONTINUATION (HMS) ----------
  const WIZ_BLOCKS = [
    { id: "w1", title: "Formål med beredskapsplanen", conf: "high", text: "Beredskapsplanen skal sikre rask og riktig håndtering av alvorlige hendelser ved Bistro Nord — brann, personskade, akutt sykdom og strømbrudd — slik at gjester og ansatte er trygge, og driften kan gjenopptas kontrollert." },
    { id: "w2", title: "Varslingsrekkefølge", conf: "high", text: "1) Sikre liv og helse. 2) Ring 110/112/113 ved behov. 3) Varsle vaktansvarlig (Maria A.). 4) Varsle daglig leder (Erik T.). 5) Logg hendelsen i Smartout som avvik." },
    { id: "w3", title: "Samlingsplass og rømning", conf: "med", text: "Foreslått samlingsplass: fortauet ved inngang nord, minst 15 meter fra bygget. Botsson fant ikke en bekreftet samlingsplass i eksisterende dokumenter — verifiser med huseier." },
    { id: "w4", title: "Kontaktliste ved hendelse", conf: "low", text: "Botsson trenger en oppdatert kontaktliste (vakttelefon, huseier, elektriker, rørlegger). Dette må fylles inn av et menneske — ingen pålitelig kilde funnet." },
  ];
  function HbWizard({ bookId, mode = "draft", title, chapterId, nav, toast }) {
    const book = bookById(bookId || "hms");
    const guided = mode === "guided";
    const [accepted, setAccepted] = useState({});
    const [rewriteFor, setRewriteFor] = useState(null);
    const REWRITES = [
      { id: "longer", icon: "list", t: "Lengre utlegg", s: "Mer detaljer og eksempler" },
      { id: "shorter", icon: "route", t: "Kortere og mer konsist", s: "Kun det viktigste" },
      { id: "simpler", icon: "spark2", t: "Forklar enklere", s: "Klarspråk, mindre fagord" },
      { id: "formal", icon: "scale", t: "Mer formelt språk", s: "Tilpasset lovpålagt dokument" },
      { id: "manual", icon: "pen", t: "Skriv selv", s: "Rediger teksten manuelt", divide: true },
    ];
    const doRewrite = (b, opt) => {
      setRewriteFor(null);
      if (opt.id === "manual") { setAccepted(a => ({ ...a, [b.id]: true })); toast(`«${b.title}» åpnet for manuell redigering`, { undo: () => setAccepted(a => { const n = { ...a }; delete n[b.id]; return n; }) }); }
      else toast(`Botsson skriver «${b.title}» på nytt — ${opt.t.toLowerCase()} …`);
    };
    const done = Object.keys(accepted).length;
    const docTitle = (title && title.trim()) || "Beredskapsplan — alvorlig hendelse";
    const ch = (book.chapters.find(c => c.id === chapterId)) || book.chapters.find(c => c.id === "h-emerg") || book.chapters[book.chapters.length - 1];
    const chLabel = `${book.short} kap. ${ch ? ch.n : "8"}`;
    // guided: reveal one step beyond what's handled. draft: show all at once.
    const visible = guided ? WIZ_BLOCKS.slice(0, Math.min(WIZ_BLOCKS.length, done + 1)) : WIZ_BLOCKS;
    return (
      <main className="sk-main">
        <div className="sk-wrap" style={accStyle(book)}>
          <div className="hb-crumb" style={{ marginBottom: 14 }}>
            <button onClick={() => nav.dashboard()}>Bibliotek</button>
            <span className="sep"><Ic n="chevRight" s={13} /></span>
            <button onClick={() => nav.book(book.id)}>{book.name}</button>
            <span className="sep"><Ic n="chevRight" s={13} /></span>
            <span style={{ color: "var(--fg)", fontWeight: 600 }}>{guided ? "Veiviser" : "Botsson-utkast"}</span>
          </div>
          <div className="hb-wiz">
            <div>
              <div className="hb-ai-card" style={{ marginTop: 0 }}>
                <div className="hb-ai-head">
                  <span className="hb-ai-av"><Ic n="bot" s={17} /></span>
                  <div style={{ flex: 1 }}>
                    <div className="t">{guided ? "Botsson guider deg" : "Botsson har skrevet et utkast"} <span className="tag">{guided ? "VEIVISER" : "UTKAST"}</span></div>
                    <div className="m">«{docTitle}» · {chLabel}</div>
                  </div>
                </div>
                <p className="hb-ai-why">{guided
                  ? <>Vi tar én del om gangen. Jeg foreslår innhold basert på det jeg finner i håndbøkene — du fyller inn og bekrefter hver del før vi går videre. <strong>Ingenting publiseres før du godkjenner.</strong></>
                  : <>Jeg har lest branninstruksen, risikovurderingene og avvikshistorikken, og skrevet et utkast i fire deler. Gå gjennom hver del — godkjenn det som stemmer, og fyll inn det jeg ikke kunne bekrefte. <strong>Ingenting publiseres før du godkjenner.</strong></>}</p>
                <div className="hb-ai-trust">
                  <span className="hb-trust"><span className="ic"><Ic n="folder" s={11} /></span>Kilde: Branninstruks v1.4</span>
                  <span className="hb-trust"><span className="ic"><Ic n="alert" s={11} /></span>Kilde: 2 risikovurderinger</span>
                  <span className="hb-trust warn"><span className="ic"><Ic n="user" s={11} /></span>Krever menneskelig godkjenning</span>
                  <span className="hb-trust warn"><span className="ic"><Ic n="scale" s={11} /></span>Ikke juridisk godkjent</span>
                </div>
              </div>

              {visible.map((b, i) => (
                <div key={b.id} className="hb-wiz-step">
                  <div className="hb-wiz-blockhdr">
                    <span className="hb-chapter-num" style={{ width: 26, height: 26, fontSize: 12 }}>{i + 1}</span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{b.title}</span>
                    <span style={{ flex: 1 }} />
                    <span className={`hb-wiz-conf ${b.conf}`}>{b.conf === "high" ? "Høy sikkerhet" : b.conf === "med" ? "Bør sjekkes" : "Trenger menneske"}</span>
                  </div>
                  <p className={`hb-wiz-gen ${b.conf === "low" ? "low" : ""}`}>{b.text}</p>
                  <div className="hb-ai-actions" style={{ marginTop: 12 }}>
                    {accepted[b.id] ? (
                      <span className="hb-chip ok"><span className="d" />{b.conf === "low" ? "Fylt inn" : "Godkjent"}</span>
                    ) : (
                      <>
                        <button className="sk-primary" style={{ height: 32 }} onClick={() => { setAccepted(a => ({ ...a, [b.id]: true })); toast(b.conf === "low" ? "Markert for utfylling" : `«${b.title}» godkjent`, { undo: () => setAccepted(a => { const n = { ...a }; delete n[b.id]; return n; }) }); }}>
                          <Ic n="check" s={14} sw={2.4} /> {guided ? (b.conf === "low" ? "Fyll inn og fortsett" : "Bekreft og fortsett") : (b.conf === "low" ? "Fyll inn selv" : "Godkjenn del")}
                        </button>
                        <div className="hb-rewrite-wrap">
                          <button className="sk-ghost" style={{ height: 32 }} onClick={() => setRewriteFor(rewriteFor === b.id ? null : b.id)}><Ic n="undo" s={14} /> Skriv om <Ic n="chevDown" s={13} /></button>
                          {rewriteFor === b.id && (
                            <>
                              <div className="hb-rewrite-scrim" onClick={() => setRewriteFor(null)} />
                              <div className="hb-rewrite-menu">
                                <div className="hb-rewrite-head"><Ic n="bot" s={12} /> Hvordan skal Botsson skrive om?</div>
                                {REWRITES.map(o => (
                                  <button key={o.id} className={`hb-rewrite-opt ${o.divide ? "divide" : ""}`} onClick={() => doRewrite(b, o)}>
                                    <span className="ic"><Ic n={o.icon} s={15} /></span>
                                    <span className="tx"><span className="t">{o.t}</span><span className="s">{o.s}</span></span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {guided && done < WIZ_BLOCKS.length && (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "2px 4px", display: "flex", alignItems: "center", gap: 7 }}>
                  <Ic n="route" s={13} c="var(--orange)" /> Del {done + 1} av {WIZ_BLOCKS.length} — bekreft for å gå videre.
                </div>
              )}
            </div>

            <div className="hb-ed-side">
              <div className="hb-panel">
                <div className="hb-panel-head"><span className="ic"><Ic n="route" s={14} /></span>Framdrift</div>
                <div className="hb-panel-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <HbRing pct={Math.round((done / WIZ_BLOCKS.length) * 100)} size={52} stroke={5} color="var(--orange)" />
                    <div><div style={{ fontSize: 13, fontWeight: 600 }}>{done} av {WIZ_BLOCKS.length} deler</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>behandlet</div></div>
                  </div>
                  <button className="sk-primary" style={{ width: "100%", justifyContent: "center" }} disabled={done < WIZ_BLOCKS.length}
                    onClick={() => { toast(`«${docTitle}» lagret som utkast — klar til godkjenning`); nav.book(book.id, ch && ch.id); }}>
                    <Ic n="checkdoc" s={15} /> Lagre som utkast
                  </button>
                  <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 10 }}>Dokumentet legges i {chLabel} med status <strong>Utkast</strong> og sendes ikke til godkjenning automatisk.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ---------- SETTINGS ----------
  function HbSettings({ nav, toast }) {
    const [notif, setNotif] = useState({ review: true, overdue: true, ai: true, weekly: false });
    const t = (k) => setNotif(n => { const v = { ...n, [k]: !n[k] }; toast(v[k] ? "Varsel på" : "Varsel av"); return v; });
    const roles = [
      { role: "Eier", who: "Erik T.", can: "Full tilgang · arkiv · maler · roller" },
      { role: "Admin", who: "Maria A.", can: "Opprette, redigere, godkjenne, eksportere" },
      { role: "Leder", who: "Sara K.", can: "Redigere egne kapitler, sende til godkjenning" },
      { role: "Ansatt", who: "Alle øvrige", can: "Lese godkjent innhold, kommentere" },
    ];
    return (
      <main className="sk-main">
        <div className="sk-wrap">
          <div className="hb-crumb" style={{ marginBottom: 14 }}>
            <button onClick={() => nav.dashboard()}>Bibliotek</button>
            <span className="sep"><Ic n="chevRight" s={13} /></span>
            <span style={{ color: "var(--fg)", fontWeight: 600 }}>Innstillinger</span>
          </div>
          <div className="sk-page-head"><div><h1 className="sk-page-title">Innstillinger</h1><p className="sk-page-sub">Maler, tilganger, varsler, eksport og arkivregler for håndbøkene.</p></div></div>

          <div className="hb-set-grid">
            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="layers" s={15} /></span>Maler</span><span className="spacer" /><button className="link" onClick={() => toast("Ny mal opprettet")}>Ny mal</button></div>
              <div className="so-panel-body pad">
                {SD.HB_TEMPLATES.map(tp => (
                  <div key={tp.id} className="hb-tpl">
                    <span className="ic"><Ic n={tp.icon} s={16} /></span>
                    <div className="b"><div className="nm">{tp.title}</div><div className="mt">{bookById(tp.book).short} · brukt {tp.used} ganger</div></div>
                    <button className="sk-ghost hb-btn-sm" onClick={() => toast(`Dokument opprettet fra «${tp.title}»`)}>Bruk</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="lock" s={15} /></span>Tilganger og roller</span></div>
              <div className="so-panel-body pad">
                {roles.map(r => (
                  <div key={r.role} className="hb-tpl">
                    <span className="ic"><Ic n="user" s={15} /></span>
                    <div className="b"><div className="nm">{r.role} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {r.who}</span></div><div className="mt" style={{ fontFamily: "var(--font-sans)", fontSize: 11.5 }}>{r.can}</div></div>
                  </div>
                ))}
                <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 4 }}>Tilgang er rollebasert — ansatte ser kun godkjent innhold. Endringer logges.</p>
              </div>
            </div>

            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="bell" s={15} /></span>Varsler</span></div>
              <div className="so-panel-body pad">
                {[["review", "Når noe sendes til godkjenning", "Du får varsel når et dokument venter på deg"], ["overdue", "Forfalt gjennomgang", "Påminnelse når et dokument må revideres"], ["ai", "Botsson-forslag", "Når Botsson finner mangler eller forbedringer"], ["weekly", "Ukentlig helsesammendrag", "E-post hver mandag med dokumentasjonshelse"]].map(([k, l, s]) => (
                  <div key={k} className="hb-toggle-row"><div><div className="lbl">{l}</div><div className="sub">{s}</div></div><HbSwitch on={notif[k]} onClick={() => t(k)} /></div>
                ))}
              </div>
            </div>

            <div className="so-panel">
              <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="archive" s={15} /></span>Eksport og arkiv</span></div>
              <div className="so-panel-body pad" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <button className="sk-ghost" style={{ justifyContent: "flex-start" }} onClick={() => toast("Samlet PDF genereres …")}><Ic n="download" s={15} /> Eksporter alle håndbøker (PDF)</button>
                <button className="sk-ghost" style={{ justifyContent: "flex-start" }} onClick={() => toast("Revisjonslogg eksportert")}><Ic n="history" s={15} /> Eksporter revisjonslogg</button>
                <div className="hb-toggle-row" style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 14 }}><div><div className="lbl">Arkiver utdaterte automatisk</div><div className="sub">Flytt til arkiv 90 dager etter utløp</div></div><HbSwitch on={true} onClick={() => toast("Arkivregel oppdatert")} /></div>
                <button className="hb-btn-danger" style={{ justifyContent: "flex-start", marginTop: 2 }} onClick={() => toast("Åpner arkiv")}><Ic n="archive" s={15} /> Vis arkiverte dokumenter (12)</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  function HbBookSettings({ bookId, nav, toast }) {
    const book = bookById(bookId);
    const [editAccess, setEditAccess] = useState(bookId === "system" ? "superadmin" : "admin");
    const CAPS = [["read", "Lese"], ["comment", "Kommentere"], ["edit", "Redigere"], ["approve", "Godkjenne"], ["manage", "Administrere"]];
    const [roleCaps, setRoleCaps] = useState({
      superadmin: { read: 1, comment: 1, edit: 1, approve: 1, manage: 1 },
      administrativ: { read: 1, comment: 1, edit: 1, approve: 1, manage: 0 },
      admin: { read: 1, comment: 1, edit: 1, approve: 1, manage: bookId === "system" ? 0 : 1 },
      leder: { read: 1, comment: 1, edit: 1, approve: 0, manage: 0 },
      ansatt: { read: 1, comment: 1, edit: 0, approve: 0, manage: 0 },
    });
    const toggleCap = (rid, cid) => setRoleCaps(s => ({ ...s, [rid]: { ...s[rid], [cid]: s[rid][cid] ? 0 : 1 } }));
    const [chVis, setChVis] = useState(() => Object.fromEntries(book.chapters.map(c => [c.id, c.visibleTo || ["ansatt", "leder", "admin"]])));
    const toggleChVis = (cid, r) => setChVis(s => ({ ...s, [cid]: (s[cid] || []).includes(r) ? s[cid].filter(x => x !== r) : [...(s[cid] || []), r] }));
    React.useEffect(() => { try { window.SmartoutContext && window.SmartoutContext.set && window.SmartoutContext.set({ route: "bibliotek", view: "Innstillinger: " + book.name, handbook: book.name, handbookId: book.id }); } catch (e) {} }, [bookId]);
    return (
      <main className="sk-main"><div className="sk-wrap hb-bset" style={{ "--acc": book.accent }}>
        <div className="hb-crumb" style={{ marginBottom: 14 }}>
          <button onClick={() => nav.dashboard()}>Bibliotek</button><span className="sep"><Ic n="chevRight" s={13} /></span>
          <button onClick={() => nav.book(book.id)}>{book.short}</button><span className="sep"><Ic n="chevRight" s={13} /></span>
          <span style={{ color: "var(--fg)", fontWeight: 600 }}>Innstillinger</span>
        </div>
        <div className="hb-bset-head">
          <span className="ic" style={{ background: book.accent }}><Ic n={book.icon} s={19} /></span>
          <div style={{ flex: 1, minWidth: 0 }}><h1 className="sk-page-title">Innstillinger · {book.name}</h1><p className="sk-page-sub">Eierskap, tilgang og synlighet for denne håndboken. Endringer logges i revisjonsloggen.</p></div>
        </div>
        <div className="hb-bset-grid">
          <section className="hb-bset-card">
            <div className="hb-set-lbl">Eier</div>
            <div className="hb-set-owner"><HbOwner owner={book.owner} size={32} /><div><div className="nm">{book.owner.name}</div><div className="rl">{book.owner.role} · ansvarlig for innhold</div></div></div>
          </section>
          <section className="hb-bset-card">
            <div className="hb-set-lbl">Hvem kan endre håndboken</div>
            <div className="hb-access">{[["admin", "Admin"], ["leder", "Leder"], ["administrativ", "Administrativ"], ["superadmin", "SuperAdmin"]].map(([id, l]) => <button key={id} className={`hb-access-chip ${editAccess === id ? "on" : ""}`} onClick={() => { setEditAccess(id); toast(`Redigering satt til ${l}`); }}><span className="d" />{l}</button>)}</div>
            <div className="hb-set-note"><Ic n="lock" s={12} /> {book.id === "system" ? "Systemmanualen bør være låst til SuperAdmin — den definerer hvordan systemet virker." : "Bedrift, HMS og Personal kan endres av Admin og oppover."}</div>
          </section>
          <section className="hb-bset-card wide">
            <div className="hb-set-lbl">Tilgang og roller</div>
            <div className="hb-set-subnote">Hva hver rolle kan gjøre i denne håndboken. Trykk for å slå av/på.</div>
            {[["superadmin", "SuperAdmin"], ["administrativ", "Administrativ"], ["admin", "Admin"], ["leder", "Leder"], ["ansatt", "Ansatt"]].map(([rid, rl]) => (
              <div key={rid} className="hb-set-rolerow"><div className="rn">{rl}</div><div className="hb-access">{CAPS.map(([cid, cl]) => { const on = roleCaps[rid][cid]; return <button key={cid} className={`hb-access-chip ${on ? "on" : ""}`} onClick={() => toggleCap(rid, cid)}><span className="d" />{cl}</button>; })}</div></div>
            ))}
          </section>
          <section className="hb-bset-card wide">
            <div className="hb-set-lbl">Synlig for roller · per kapittel</div>
            <div className="hb-set-subnote">Styr hvem som ser hvert kapittel. Ansatte ser bare godkjent innhold.</div>
            {book.chapters.map(ch => (<div key={ch.id} className="hb-set-chrow"><div className="nm">{ch.n}. {ch.title}</div><div className="hb-access">{[["ansatt", "Ansatt"], ["leder", "Leder"], ["admin", "Admin"]].map(([id, l]) => { const on = (chVis[ch.id] || []).includes(id); return <button key={id} className={`hb-access-chip ${on ? "on" : ""}`} onClick={() => toggleChVis(ch.id, id)}><span className="d" />{l}</button>; })}</div></div>))}
          </section>
          <section className="hb-bset-card wide">
            <div className="hb-set-lbl">Eksport og arkiv</div>
            <div className="hb-set-actions">
              <button className="sk-ghost" onClick={() => toast("Eksporterer håndbok som PDF …")}><Ic n="download" s={15} /> Eksporter håndbok (PDF)</button>
              <button className="sk-ghost" onClick={() => toast("Revisjonslogg eksportert")}><Ic n="history" s={15} /> Eksporter revisjonslogg</button>
              <button className="hb-btn-danger" onClick={() => { toast("Håndbok arkivert", { undo: () => {} }); nav.dashboard(); }}><Ic n="archive" s={15} /> Arkiver håndbok</button>
            </div>
          </section>
        </div>
        <div className="hb-bset-foot"><span className="note"><Ic n="lock" s={12} /> Endringer logges i revisjonsloggen.</span><span style={{ flex: 1 }} /><button className="sk-ghost" onClick={() => nav.book(book.id)}>Avbryt</button><button className="sk-primary" onClick={() => { toast("Innstillinger lagret · logget i revisjonslogg"); nav.book(book.id); }}>Lagre endringer</button></div>
      </div></main>
    );
  }

  Object.assign(window, { HbDashboard, HbHandbookDetail, HbBookSettings, HbGaps, HbWizard, HbSettings });
})();
