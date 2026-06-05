// ===== HMS — Dashboard + Category detail (Helse / Miljø / Sikkerhet) =====
// Exposes window.HmsDashboard and window.HmsCategoryDetail.
(function () {
  const { useState, useMemo } = React;
  const H = window.Hms;
  const { Ic, SD, cat, emp, empName, loc, Av, Ring, Trend, ImpBadge, CatChip, AIPanel } = H;
  const isOverdue = (s) => s && /forfalt/i.test(s);

  // ---------- KPI pulse ----------
  function Pulse({ lbl, ic, val, unit, sub, tone, edge, onClick }) {
    return (
      <div className="pulse" onClick={onClick}>
        {edge && <span className="pulse-edge" style={{ background: edge }} />}
        <div className="pulse-lbl"><span className="ico"><Ic n={ic} s={13} /></span>{lbl}</div>
        <div className={`pulse-val ${tone || ""}`}>{val}{unit && <span className="u">{unit}</span>}</div>
        <div className="pulse-sub">{sub}</div>
      </div>
    );
  }

  // ---------- category overview card ----------
  function CatCard({ id, onOpen }) {
    const c = cat(id);
    const r = SD.HMS_catRollup(id);
    const delta = c.compliance - c.prevCompliance;
    return (
      <div className={`hms-catcard hms-cat-${id}`} onClick={() => onOpen(id)}>
        <div className="hms-catcard-top">
          <span className="hms-catcard-ic"><Ic n={c.icon} s={22} /></span>
          <div className="hms-catcard-id">
            <div className="hms-catcard-nm">{c.name}</div>
            <div className="hms-catcard-tag">{c.tagline}</div>
          </div>
          <Ring pct={c.compliance} color="var(--cat)" />
        </div>
        <div className="hms-catcard-stats">
          <div className="hms-catstat"><span className="v">{r.protocols}</span><span className="l">Protokoller</span></div>
          <div className="hms-catstat"><span className={`v ${r.open ? "" : "ok"}`}>{r.open}</span><span className="l">Åpne oppgaver</span></div>
          <div className="hms-catstat"><span className={`v ${r.overdue ? "crit" : "ok"}`}>{r.overdue}</span><span className="l">Forsinket</span></div>
          <div className="hms-catstat"><span className={`v ${r.missingTraining ? "warn" : "ok"}`}>{r.missingTraining}</span><span className="l">Mangler opplæring</span></div>
        </div>
        <div className="hms-catcard-foot">
          <Trend data={c.trend} color="var(--cat)" />
          <span style={{ fontSize: 11.5, color: delta >= 0 ? "var(--success)" : "var(--error)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
            {delta >= 0 ? "+" : ""}{delta} pp
          </span>
          <span className="spc" />
          <span className="lnk">Åpne <Ic n="arrowRight" s={13} /></span>
        </div>
      </div>
    );
  }

  // ---------- attention queue row ----------
  function AQRow({ tone, kind, ic, title, meta, action, onAction, onOpen }) {
    return (
      <div className={`aq-row ${tone}`} onClick={onOpen}>
        <span className={`aq-ic ${tone}`}><Ic n={ic} s={17} /></span>
        <div className="aq-main">
          <div className="aq-tline"><span className={`aq-kind ${tone}`}>{kind}</span><span className="aq-title">{title}</span></div>
          <div className="aq-meta">{meta}</div>
        </div>
        <div className="aq-side">
          <button className="aq-btn primary" onClick={(e) => { e.stopPropagation(); onAction && onAction(); }}>{action}</button>
        </div>
      </div>
    );
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  function HmsDashboard({ openCat, openProto, openTab, openAvvik, toast }) {
    const totals = useMemo(() => {
      const ps = SD.HMS_PROTOCOLS;
      return {
        protocols: ps.length,
        overdue: ps.reduce((s, p) => s + p.overdue, 0),
        open: ps.reduce((s, p) => s + p.openTasks, 0),
        missing: ps.reduce((s, p) => s + p.missingTraining, 0),
        incidents: ps.reduce((s, p) => s + p.incidents, 0),
        compliance: Math.round(SD.HMS_CAT_ORDER.reduce((s, id) => s + cat(id).compliance, 0) / SD.HMS_CAT_ORDER.length),
        blocked: SD.HMS_READINESS.filter((r) => r.status === "blocked").length,
      };
    }, []);

    // attention queue — real open avvik first (worst-first), then other duties
    const SEV_RANK = { kritisk: 0, hoy: 1, lav: 2 };
    const avvikItems = useMemo(() => SD.HMS_DEVIATIONS
      .filter((d) => d.status !== "lukket" && (d.sev === "kritisk" || isOverdue(d.due)))
      .sort((a, b) => (SEV_RANK[a.sev] - SEV_RANK[b.sev]) || (isOverdue(b.due) - isOverdue(a.due)))
      .slice(0, 3)
      .map((d) => ({
        tone: d.sev === "kritisk" ? "crit" : "warn", kind: "Avvik", ic: "ban", title: d.title,
        meta: <><span>{cat(d.cat).name} · {loc(d.location).name}</span>{d.due && <span className={`deadline ${isOverdue(d.due) ? "crit" : ""}`}><Ic n="clock" s={12} /> {d.due}</span>}<span className="mono">{d.id}</span></>,
        action: "Åpne avvik", avvikId: d.id,
      })), []);

    const attention = [
      ...avvikItems,
      { tone: "crit", kind: "Forsinket", ic: "alert", title: "Brannøvelse / evakueringstest er 9 mnd forsinket", meta: <><span className="deadline crit"><Ic n="clock" s={12} /> Forfalt 12. aug</span><span>Sikkerhet · kritisk</span></>, action: "Sett dato", proto: "sp-brann" },
      { tone: "warn", kind: "Opplæring", ic: "cap", title: "4 ansatte mangler førstehjelpskurs", meta: <><span>Sikkerhet · Førstehjelp</span><span>blokkerer beredskapsrolle</span></>, action: "Se ansatte", proto: "sp-forstehjelp" },
    ];

    return (
      <>
          {/* KPI pulses */}
          <div className="dash-pulse">
            <Pulse lbl="Samsvar" ic="gauge" val={totals.compliance} unit="%" sub="snitt H·M·S" tone={H.scoreTone(totals.compliance)} edge={H.scoreColor(totals.compliance)} onClick={() => openTab("protokoller")} />
            <Pulse lbl="Forsinket" ic="alert" val={totals.overdue} sub="kritiske kontroller" tone={totals.overdue ? "crit" : "ok"} edge="var(--error)" onClick={() => openTab("avvik")} />
            <Pulse lbl="Åpne avvik" ic="list" val={SD.HMS_DEVIATIONS.filter((d) => d.status !== "lukket").length} sub="under behandling" edge="var(--warning)" onClick={() => openTab("avvik")} />
            <Pulse lbl="Mangler opplæring" ic="cap" val={totals.missing} sub="på tvers av roller" tone={totals.missing ? "warn" : "ok"} edge="var(--info)" onClick={() => openTab("opplaring")} />
            <Pulse lbl="Blokkerte ansatte" ic="ban" val={totals.blocked} sub="ikke klarert for ansvar" tone={totals.blocked ? "crit" : "ok"} edge="var(--error)" onClick={() => openTab("opplaring")} />
          </div>

          {/* category overview */}
          <div className="hms-catgrid swipe">
            {SD.HMS_CAT_ORDER.map((id) => <CatCard key={id} id={id} onOpen={openCat} />)}
          </div>

          <div className="so-grid-2">
            <div className="so-stack">
              {/* attention queue */}
              <section className="so-panel">
                <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="alert" s={15} /></span>Krever handling nå</span><span className="cnt crit">{attention.length}</span><span className="spacer" /><button className="link" onClick={() => openTab("avvik")}>Alle avvik <Ic n="arrowRight" s={13} /></button></div>
                <div className="aq">
                  {attention.map((a, i) => (
                    <AQRow key={i} {...a} onOpen={() => a.avvikId ? openAvvik(a.avvikId) : openProto(a.proto)} onAction={() => a.avvikId ? openAvvik(a.avvikId) : openProto(a.proto)} />
                  ))}
                </div>
              </section>

              {/* recent activity preview */}
              <section className="so-panel">
                <div className="so-panel-head"><span className="t"><span className="ico"><Ic n="history" s={15} /></span>Siste HMS-aktivitet</span><span className="spacer" /><button className="link" onClick={() => openTab("logg")}>Hele loggen <Ic n="arrowRight" s={13} /></button></div>
                <div className="hms-tl">
                  {SD.HMS_ACTIVITY.slice(0, 5).map((a) => (
                    <div key={a.id} className="hms-tl-item">
                      <span className={`hms-tl-ic ${a.kind}`}><Ic n={a.kind === "ai" ? "bot" : a.kind === "evidence" ? "camera" : a.kind === "quiz" ? "help" : a.kind === "comment" ? "message" : a.kind === "handbook" ? "book" : a.kind === "protocol" ? "shield" : "check"} s={15} /></span>
                      <div className="hms-tl-b"><span className="who">{empName(a.who)}</span> {a.what}<div className="kind">{a.kind}</div></div>
                      <span className="hms-tl-when">{a.when}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* AI co-pilot */}
            <div className="so-stack">
              <AIPanel items={SD.HMS_AI} toast={toast} onOpenProto={openProto} />
            </div>
          </div>
      </>
    );
  }

  // ============================================================
  // CATEGORY DETAIL (Helse / Miljø / Sikkerhet)
  // ============================================================
  function HmsCategoryDetail({ catId, onBack, openProto, openComments, toast }) {
    const c = cat(catId);
    const ps = SD.HMS_PROTOCOLS.filter((p) => p.cat === catId);
    const r = SD.HMS_catRollup(catId);
    const tracking = SD.HMS_TRACKING.filter((t) => t.cat === catId);
    const comments = SD.HMS_COMMENTS.filter((cm) => { const p = SD.HMS_PROTO_BY_ID[cm.anchor]; return p && p.cat === catId; });
    const evidence = ps.flatMap((p) => (p.evidence || []).map((e) => ({ ...e, proto: p.title })));
    const ai = SD.HMS_AI.filter((a) => a.cat === catId);
    const delta = c.compliance - c.prevCompliance;

    return (
      <main className={`sk-main hms-cat-${catId}`}>
        <div className="sk-wrap" style={{ maxWidth: 1100 }}>
          <button className="hms-detail-back" onClick={onBack} style={{ marginLeft: 0 }}><Ic n="chevLeft" s={16} /> Tilbake til HMS-oversikt</button>

          {/* hero */}
          <div className="hms-detail-hero" style={{ marginTop: 6 }}>
            <span className="hms-detail-ic"><Ic n={c.icon} s={24} /></span>
            <div className="hms-detail-hid">
              <div className="hms-detail-nm">{c.name}</div>
              <div className="hms-detail-metarow">
                <span><Ic n="book" s={13} /> {c.handbookPath}</span>
                <span className="mono">{ps.length} protokoller</span>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "10px 0 0", maxWidth: "62ch", lineHeight: 1.5 }}>{c.desc}</p>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <Ring pct={c.compliance} size="lg" color="var(--cat)" />
              <div style={{ fontSize: 11, color: delta >= 0 ? "var(--success)" : "var(--error)", fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 6 }}>{delta >= 0 ? "+" : ""}{delta} pp</div>
            </div>
          </div>

          {/* stat strip */}
          <div className="dash-pulse" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <Pulse lbl="Åpne oppgaver" ic="list" val={r.open} sub="aktive nå" edge="var(--cat)" />
            <Pulse lbl="Forsinket" ic="alert" val={r.overdue} sub="over frist" tone={r.overdue ? "crit" : "ok"} edge="var(--error)" />
            <Pulse lbl="Mangler opplæring" ic="cap" val={r.missingTraining} sub="ansatte" tone={r.missingTraining ? "warn" : "ok"} edge="var(--warning)" />
            <Pulse lbl="Hendelser" ic="flag" val={r.incidents} sub="registrert i år" edge="var(--info)" />
          </div>

          {ai.length > 0 && <div style={{ marginBottom: 16 }}><AIPanel items={ai} toast={toast} onOpenProto={openProto} /></div>}

          <div className="hms-grid2">
            <div className="hms-stack">
              {/* protocols */}
              <H.Panel icon="shield" title="Protokoller">
                <div className="hms-protolist">
                  {ps.map((p) => (
                    <div key={p.id} className={`hms-proto hms-cat-${catId} ${p.importance === "kritisk" ? "crit-imp" : ""}`}>
                      <div className="hms-proto-head" onClick={() => openProto(p.id)}>
                        <div className="hms-proto-id">
                          <div className="hms-proto-toprow">
                            <span className="hms-proto-code">{p.code}</span>
                            <ImpBadge id={p.importance} />
                          </div>
                          <div className="hms-proto-nm">{p.title}</div>
                          <div className="hms-proto-meta">
                            <span><Ic n="user" s={12} /> {empName(p.owner)} · {p.ownerRole}</span>
                            <span><Ic n="check" s={12} /> {p.checklist.done}/{p.checklist.total} sjekkpunkt</span>
                            {p.overdue > 0 && <span style={{ color: "var(--error)", fontWeight: 600 }}><Ic n="alert" s={12} /> {p.overdue} forsinket</span>}
                          </div>
                        </div>
                        <div className="hms-proto-side">
                          <Ring pct={p.compliance} size="sm" color="var(--cat)" />
                          <Ic n="arrowRight" s={16} c="var(--muted-soft)" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </H.Panel>

              {/* training/quizzes */}
              <H.Panel icon="cap" title="Opplæring &amp; quiz">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {tracking.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>Ingen registreringer i denne kategorien.</div>}
                  {tracking.slice(0, 6).map((t) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                      <Av id={t.emp} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.item}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{empName(t.emp)} · {emp(t.emp).stilling}</div>
                      </div>
                      <span className={`hms-cstat ${t.status}`}><Ic n={t.status === "completed" ? "check" : t.status === "overdue" || t.status === "missing" ? "alert" : "clock"} s={12} />{t.status === "completed" ? (t.score || "Fullført") : t.status === "overdue" ? "Forfalt" : t.status === "missing" ? "Mangler" : t.status === "due" ? "Frist" : "Pågår"}</span>
                    </div>
                  ))}
                </div>
              </H.Panel>
            </div>

            <div className="hms-stack">
              {/* trend */}
              <H.Panel icon="trendUp" title="Samsvarstrend">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Ring pct={c.compliance} size="lg" color="var(--cat)" />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{delta >= 0 ? "Stigende" : "Synkende"} samsvar</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>7-ukers utvikling: {c.prevCompliance}% → {c.compliance}%</div>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}><Trend data={c.trend} color="var(--cat)" /></div>
              </H.Panel>

              {/* evidence */}
              <H.Panel icon="camera" title="Bevis" link="Alle" onLink={() => toast("Åpner bevisarkiv")}>
                {evidence.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Ingen bevis lastet opp ennå.</div>
                ) : (
                  <div className="hms-evi-grid">
                    {evidence.slice(0, 4).map((e, i) => (
                      <div key={i} className="hms-evi-thumb">
                        <div className={`hms-evi-img ${e.kind}`}><Ic n={e.kind === "photo" ? "camera" : e.kind === "signoff" ? "check" : "file"} s={20} /></div>
                        <div className="hms-evi-cap"><div className="t">{e.label}</div><div className="m">{e.by} · {e.at}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </H.Panel>

              {/* comments */}
              <H.Panel icon="message" title="Kommentarer" link="Åpne tråd" onLink={() => openComments({ title: c.name, anchorLabel: c.handbookPath, comments })}>
                {comments.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Ingen kommentarer.</div>
                ) : comments.slice(0, 3).map((cm) => (
                  <div key={cm.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <Av id={cm.author} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5 }}><strong>{empName(cm.author)}</strong> <span style={{ color: "var(--muted)", fontSize: 11 }}>· {cm.at}</span></div>
                      <div style={{ fontSize: 12.5, color: "var(--fg)", marginTop: 2, lineHeight: 1.4 }}>{H.withMentions(cm.text)}</div>
                    </div>
                  </div>
                ))}
              </H.Panel>
            </div>
          </div>
        </div>
      </main>
    );
  }

  window.HmsDashboard = HmsDashboard;
  window.HmsCategoryDetail = HmsCategoryDetail;
})();
