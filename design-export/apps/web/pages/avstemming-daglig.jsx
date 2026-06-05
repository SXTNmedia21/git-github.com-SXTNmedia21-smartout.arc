// ===== Avstemming — daglig (W-01): DayList · DayDetail · ContextRail =====
// Tre-kolonne dag-godkjenning. Listevisning = trafikklys. Detaljvisning = alt.
// Action-bar er gate-driven: "Godkjenn" alltid synlig, disabled til preflight
// er clean. AI (Botsson) er assistiv. window.RecDaglig.
(function () {
  const { useState, useMemo } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  const TONE = { critical: "var(--error)", high: "var(--error)", medium: "var(--warning)", low: "var(--info)" };

  // =============================================================
  // DAYLIST (left)
  // =============================================================
  function DayList({ days, selId, onSelect, sel, onToggleSel, onBulk }) {
    const R = window.Rec;
    const [q, setQ] = useState("");
    const [statusF, setStatusF] = useState("alle");
    const STATUS_F = [["alle", "Alle"], ["attention", "Krever handling"], ["awaiting_approval", "Venter"], ["locked", "Låst"]];

    const filtered = days.filter((d) => {
      if (q && !(`${d.weekday} ${d.dateLabel}`.toLowerCase().includes(q.toLowerCase()))) return false;
      if (statusF === "attention") return ["awaiting_approval", "submitted", "unreconciled"].includes(d.status);
      if (statusF !== "alle") return d.status === statusF;
      return true;
    });
    const byWeek = useMemo(() => {
      const m = {};
      filtered.forEach((d) => { (m[d.week] = m[d.week] || []).push(d); });
      return Object.keys(m).sort((a, b) => b - a).map((w) => [w, m[w]]);
    }, [filtered]);
    const selectable = (d) => ["awaiting_approval", "submitted"].includes(d.status);

    return (
      <div className="rec-daylist">
        <div className="rec-listbar">
          <div className="rec-search"><Ic n="search" s={14} c="var(--muted)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk dag …" /></div>
          <div className="rec-filtrow">
            {STATUS_F.map(([k, l]) => <button key={k} className={`rec-chip ${statusF === k ? "on" : ""}`} onClick={() => setStatusF(k)}>{l}</button>)}
          </div>
        </div>

        {sel.size > 0 && (
          <div className="rec-bulkbar">
            <span className="n">{sel.size}</span> valgt
            <span style={{ flex: 1 }} />
            <button className="rec-btn sm primary" onClick={onBulk}><Ic n="check" s={13} /> Godkjenn valgte</button>
          </div>
        )}

        {byWeek.map(([w, ds]) => {
          const wk = D().REC_WEEKS[w] || { label: "Uke " + w };
          const wkRev = ds.reduce((a, d) => a + (d.revenue.total || 0), 0);
          return (
            <div key={w}>
              <div className="rec-weekhead"><span className="wk">{wk.label}</span><span style={{ fontSize: 11, color: "var(--muted)" }}>{wk.range}</span><span className="meta">{R.kr(wkRev)} · {wk.laborPct}% lønn</span></div>
              {ds.map((d) => {
                const s = D().REC_STATUS[d.status];
                const checked = sel.has(d.id);
                const pf = D().REC_PREFLIGHT(d).length;
                return (
                  <div key={d.id} className={`rec-dayrow ${selectable(d) ? "selectable" : ""} ${checked ? "checked" : ""} ${selId === d.id ? "on" : ""}`} onClick={() => onSelect(d.id)}>
                    {selectable(d) && (
                      <span className="chk" onClick={(e) => { e.stopPropagation(); onToggleSel(d.id); }}>
                        <span className={`rec-checkbox ${checked ? "on" : ""}`}>{checked && <Ic n="check" s={11} />}</span>
                      </span>
                    )}
                    <span className={`st-ic ${s.tone}`}><Ic n={s.icon} s={16} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="dt">{d.weekday.slice(0, 3)} <span className="wd">{d.dateLabel}</span>{d.today && <span style={{ color: "var(--orange)", fontWeight: 700, fontSize: 11 }}> · i dag</span>}</div>
                      <div className="rev">{d.revenue.total != null ? R.kr(d.revenue.total) : "ikke registrert"}{pf > 0 && ["awaiting_approval", "unreconciled"].includes(d.status) ? ` · ${pf} blokker` : ""}</div>
                    </div>
                    <div className="right"><R.StatusPill status={d.status} short /></div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // =============================================================
  // DAYDETAIL (center)
  // =============================================================
  function DayDetail({ day, api: rawApi }) {
    const R = window.Rec;
    const [tab, setTab] = useState("oversikt");
    const api = useMemo(() => ({ ...rawApi, goTab: setTab }), [rawApi]);
    const pf = D().REC_PREFLIGHT(day);
    const clean = pf.length === 0;
    const s = D().REC_STATUS[day.status];
    const openDevs = day.deviations.filter((d) => d.status === "open");
    const pendShifts = day.shifts.filter((sh) => sh.status === "pending" || sh.status === "disputed");
    const isLocked = day.status === "locked";
    const isApproved = day.status === "approved";

    const TABS = [
      ["oversikt", "Oversikt", "gauge", null],
      ["omsetning", "Omsetning", "wallet", null],
      ["vakter", "Vakter", "clock", pendShifts.length || null],
      ["avvik", "Avvik", "alert", openDevs.length || null],
      ["oppgaver", "Oppgaver", "clipcheck", null],
      ["logg", "Revisjonslogg", "history", null],
    ];

    return (
      <div className="rec-detail">
        {/* header */}
        <div className="rec-dhead">
          <h2>{day.weekday} {day.dateLabel}</h2>
          <div className="meta">
            <R.StatusPill status={day.status} />
            <span className="sep" /><span>Bistro Nord</span>
            {day.settledBy && <><span className="sep" /><span>Oppgjort av {D().REC_IDENT(day.settledBy).name} · {day.settledAt}</span></>}
            {day.lockedBy && <><span className="sep" /><span>Låst {day.lockedAt}</span></>}
          </div>
        </div>

        {/* KPI strip */}
        <div className="rec-kpis">
          <div className="rec-kpi"><div className="l">Omsetning</div><div className="v"><span className="u">kr </span>{day.revenue.total != null ? R.fmt0(day.revenue.total) : "—"}</div>{day.budget.target && <div className="d">Budsjett {R.kr(day.budget.target)}</div>}</div>
          <div className="rec-kpi"><div className="l">Timer</div><div className="v">{R.h1(day.hours.total)}<span className="u">t</span></div></div>
          <div className="rec-kpi"><div className="l">Lønn %</div><div className={`v ${day.hours.laborPct > 33 ? "warn" : ""}`}>{day.hours.laborPct != null ? day.hours.laborPct : "—"}<span className="u">%</span></div></div>
          <div className="rec-kpi"><div className="l">Avvik</div><div className={`v ${openDevs.some((d) => d.severity === "critical" || d.severity === "high") ? "warn" : ""}`}>{openDevs.length}</div></div>
        </div>

        {/* preflight banner */}
        {!isLocked && (
          <div className={`rec-preflight ${clean ? "clean" : ""}`} aria-live="polite">
            <div className="rec-preflight-h"><span className="ic"><Ic n={clean ? "check" : "alert"} s={16} /></span>{clean ? (isApproved ? "Godkjent — klar til lås" : "Klar til godkjenning — ingen blokkere") : `${pf.length} ting hindrer godkjenning`}</div>
            {!clean && (
              <div className="rec-preflight-list">
                {pf.map((b) => (
                  <div key={b.key} className="rec-block" onClick={() => setTab(b.tab)}><span className="num">{b.count}</span><span>{b.label}</span><span className="go"><Ic n="arrowRight" s={14} /></span></div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* detail tabs */}
        <div className="rec-dtabs">
          {TABS.map(([k, l, ic, n]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><Ic n={ic} s={14} /> {l}{n != null && <span className="cnt">{n}</span>}</button>
          ))}
        </div>

        {tab === "oversikt" && <TabOversikt day={day} api={api} />}
        {tab === "omsetning" && <TabOmsetning day={day} api={api} />}
        {tab === "vakter" && <TabVakter day={day} api={api} />}
        {tab === "avvik" && <TabAvvik day={day} api={api} />}
        {tab === "oppgaver" && <TabOppgaver day={day} api={api} />}
        {tab === "logg" && <TabLogg day={day} />}

        {/* action bar */}
        {!isLocked && (
          <div className="rec-actionbar">
            <span className={`gate ${clean ? "ready" : ""}`}><Ic n={clean ? "check" : "lock"} s={14} /> {clean ? (isApproved ? "Klar til å låses" : "Klar til godkjenning") : `${pf.length} blokker gjenstår`}</span>
            <span className="sp" />
            {!isApproved && <button className="rec-btn" onClick={() => api.requestHandoff(day, { scope: "day" })}><Ic n="message" s={14} /> Be om avklaring</button>}
            {!isApproved && <button className="rec-btn danger" onClick={() => api.rejectDay(day)}>Avvis</button>}
            {isApproved
              ? <button className="rec-btn primary" onClick={() => api.lockDay(day)}><Ic n="lock" s={14} /> Lås dag</button>
              : <button className="rec-btn primary" disabled={!clean} onClick={() => api.approveDay(day)}><Ic n="check" s={14} /> Godkjenn dagen</button>}
          </div>
        )}
        {isLocked && (
          <div className="rec-actionbar"><span className="gate ready"><Ic n="lock" s={14} /> Dagen er låst og fryst</span><span className="sp" /><button className="rec-btn" onClick={() => api.toast("Eksportert til lønnsgrunnlag")}><Ic n="download" s={14} /> Eksporter</button></div>
        )}
      </div>
    );
  }

  // ---------- Oversikt tab ----------
  function TabOversikt({ day, api }) {
    const R = window.Rec;
    const openDevs = day.deviations.filter((d) => d.status === "open");
    const blocking = openDevs.filter((d) => d.severity === "critical" || d.severity === "high");
    return (
      <div>
        {/* Botsson assist */}
        {day.status !== "locked" && day.status !== "open" && (
          <div className="rec-assist">
            <span className="rec-assist-av"><Ic n="bot" s={18} c="#fff" /></span>
            <div className="rec-assist-body">
              <div className="rec-assist-t">{blocking.length
                ? <><strong>{blocking.length} avvik blokkerer godkjenning.</strong> Den viktigste er kontantdiffen — Botsson har startet en handoff til {day.settledBy ? D().REC_IDENT(day.settledBy).name : "ansatt"} for å avklare.</>
                : <><strong>Dagen ser ren ut.</strong> Alle vakter er innenfor plan og kontanttellingen stemmer. Du kan godkjenne.</>}</div>
              <div className="rec-assist-src">
                <span className="s"><Ic n="wallet" s={11} /> iSettle Z-rapport</span>
                <span className="s"><Ic n="clock" s={11} /> Stemplingsdata</span>
                <span className="s"><Ic n="clipcheck" s={11} /> Close-out</span>
              </div>
            </div>
            <div className="rec-assist-actions">
              {blocking.length
                ? <button className="rec-btn sm" onClick={() => api.goTab("avvik")}>Vis avvik</button>
                : <button className="rec-btn sm primary" onClick={() => api.approveDay(day)}><Ic n="check" s={13} /> Godkjenn</button>}
            </div>
          </div>
        )}

        <div className="rec-card">
          <div className="rec-card-h"><span className="ic"><Ic n="gauge" s={15} /></span> Sammendrag</div>
          <div className="rec-card-b pad">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, fontSize: 13 }}>
              <Sum label="Kortomsetning" v={R.kr(day.revenue.card)} />
              <Sum label="Kontant" v={R.kr(day.revenue.cash)} />
              <Sum label="Transaksjoner" v={day.revenue.transactions != null ? day.revenue.transactions : "—"} />
              <Sum label="MVA" v={R.kr(day.revenue.vat)} />
              <Sum label="Antall vakter" v={day.shifts.length} />
              <Sum label="Budsjettavvik" v={day.budget.actual != null ? (day.budget.actual >= day.budget.target ? "+" : "") + R.kr(day.budget.actual - day.budget.target) : "—"} tone={day.budget.actual >= day.budget.target ? "ok" : null} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  function Sum({ label, v, tone }) {
    return <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 9 }}><span style={{ color: "var(--muted)" }}>{label}</span><span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: tone === "ok" ? "var(--success)" : "var(--fg)" }}>{v}</span></div>;
  }

  // ---------- Omsetning tab ----------
  function TabOmsetning({ day, api }) {
    const R = window.Rec; const r = day.revenue;
    const editable = ["submitted", "awaiting_approval"].includes(day.status);
    if (r.total == null) return <div className="rec-card"><window.Rec.Empty icon="wallet" title="Omsetning ikke registrert" sub="Dagsoppgjøret er ikke gjort ennå. Be ansatt registrere, eller legg inn manuelt." /></div>;
    return (
      <div>
        <div className="rec-card">
          <div className="rec-card-h"><span className="ic"><Ic n="wallet" s={15} /></span> Omsetning <span className="sp" /><span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>Kilde: {r.source === "isettle" ? "iSettle (auto)" : "manuell"}</span></div>
          <div className="rec-card-b">
            <div style={{ padding: "0 0 1px" }}>
              <div className="rec-revgrid">
                <Rev l="Total" v={R.kr(r.total)} />
                <Rev l="Kort" v={R.kr(r.card)} sub={r.total ? Math.round(r.card / r.total * 100) + "% av total" : ""} />
                <Rev l="Kontant (iSettle)" v={R.kr(r.cash)} />
                <Rev l="Talt kontant" v={R.kr(r.cashCounted)} cls={r.cashDiff && r.cashDiff !== 0 ? "neg" : r.cashCounted != null ? "ok" : ""} sub={r.cashDiff != null ? (r.cashDiff === 0 ? "stemmer" : `diff ${r.cashDiff > 0 ? "+" : ""}${r.cashDiff} kr`) : "ikke talt"} />
                <Rev l="MVA" v={R.kr(r.vat)} />
                <Rev l="Transaksjoner" v={r.transactions} />
              </div>
            </div>
          </div>
        </div>

        <div className="rec-card">
          <div className="rec-card-h"><span className="ic"><Ic n="image" s={15} /></span> OCR-bilag</div>
          {r.ocr && r.ocr.length ? (
            <div className="rec-ocr">
              {r.ocr.map((o) => (
                <div key={o.id} className="rec-ocrthumb" onClick={() => api.toast(`Åpner ${o.label}`)}><div className="img" /><div className="cap">{o.label}<br /><span className="tm">{o.time}</span></div></div>
              ))}
            </div>
          ) : <div style={{ padding: "0 0 6px" }}><window.Rec.Empty icon="image" title="Ingen bilag" sub="Z-rapport ikke lastet opp for denne dagen." /></div>}
        </div>

        {editable && <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="rec-btn sm" onClick={() => api.adjustRevenue(day)}><Ic n="pen" s={13} /> Juster manuelt</button></div>}
      </div>
    );
  }
  function Rev({ l, v, sub, cls }) {
    return <div className="rec-revcell"><div className="l">{l}</div><div className={`v ${cls || ""}`}>{v}</div>{sub && <div className="sub">{sub}</div>}</div>;
  }

  // ---------- Vakter tab ----------
  function TabVakter({ day, api }) {
    const R = window.Rec;
    const editable = !["locked"].includes(day.status);
    const stMeta = { approved: ["Godkjent", "success"], pending: ["Venter", "warning"], disputed: ["Omtvistet", "error"], edited: ["Justert", "info"], proposed: ["Forslag sendt", "info"] };
    return (
      <div className="rec-card">
        <div className="rec-card-h"><span className="ic"><Ic n="clock" s={15} /></span> Vakter <span className="sp" /><span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{day.shifts.length} vakter · {R.h1(day.hours.total)}t</span></div>
        <div className="rec-card-b">
          {day.shifts.map((sh, i) => {
            const e = D().REC_IDENT(sh.uid); const [lbl, tone] = stMeta[sh.status] || ["", "muted"];
            const over = sh.calculated > sh.planned;
            return (
              <div key={i} className="rec-shrow">
                <div className="rec-shemp"><R.Av uid={sh.uid} size={32} /><div><div className="nm">{e.name}</div><div className="rl"><R.DeptDot dept={sh.dept} /> {sh.role} · {sh.deptName}</div></div></div>
                <div className="rec-shhours">
                  <div className="hc"><span className="hl">Plan</span><span className="hv">{R.h1(sh.planned)}t</span></div>
                  <div className="hc"><span className="hl">Beregnet</span><span className={`hv ${over ? "up" : ""}`}>{R.h1(sh.calculated)}t</span></div>
                  <div className="hc"><span className="hl">Godkjent</span><span className="hv">{sh.status === "pending" || sh.status === "disputed" ? "—" : R.h1(sh.approved) + "t"}</span></div>
                </div>
                <span className={`rec-pill ${tone}`}>{lbl}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {editable && (sh.status === "pending" || sh.status === "disputed") && <button className="rec-btn sm primary" onClick={() => api.shiftApprove(day, sh)}><Ic n="check" s={12} /> Godkjenn</button>}
                  {editable && sh.status !== "pending" && sh.status !== "disputed" && <button className="rec-btn sm" onClick={() => api.shiftApprove(day, sh)}><Ic n="sliders" s={12} /></button>}
                  {editable && <button className="rec-btn sm" onClick={() => api.editShift(day, sh)}><Ic n="pen" s={12} /></button>}
                  {editable && sh.status === "disputed" && <button className="rec-btn sm" onClick={() => api.requestHandoff(day, { scope: "shift", context: `Avklar vakt for ${e.name}` })}><Ic n="message" s={12} /></button>}
                </div>
                {sh.note && <div className="rec-shnote">{sh.note}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- Avvik tab ----------
  function TabAvvik({ day, api }) {
    const R = window.Rec;
    const [exp, setExp] = useState(null);
    const open = day.deviations.filter((d) => d.status === "open");
    const resolved = day.deviations.filter((d) => d.status === "resolved");
    if (!day.deviations.length) return <div className="rec-card"><window.Rec.Empty icon="check" title="Ingen avvik" sub="Calc-engine fant ingen avvik på denne dagen." /></div>;
    const groups = [
      ["critical", "Kritisk", open.filter((d) => d.severity === "critical")],
      ["high", "Høy", open.filter((d) => d.severity === "high")],
      ["medium", "Middels", open.filter((d) => d.severity === "medium")],
      ["low", "Lav", open.filter((d) => d.severity === "low")],
    ].filter(([, , items]) => items.length);
    const sevCls = { critical: "crit", high: "high", medium: "med", low: "low" };
    const isShift = (d) => d.source === "shift" && d.uid;
    const onResolve = (d) => {
      if (isShift(d)) { const sh = day.shifts.find((s) => s.uid === d.uid); if (sh) { api.shiftApprove(day, sh, d); return; } }
      api.resolveDev(day, d);
    };
    const resolveLabel = (d) => isShift(d) ? "Vakt" : (d.severity === "critical" || d.severity === "high") ? "Løs" : "Bekreft";
    const Row = (d) => {
      const e = d.uid ? D().REC_IDENT(d.uid) : null;
      return (
        <div key={d.id} className={`rec-devrow ${sevCls[d.severity]}`}>
          <div className="rec-devrow-main">
            <div style={{ cursor: d.suggestion ? "pointer" : "default" }} onClick={() => d.suggestion && setExp((x) => x === d.id ? null : d.id)}>
              <div className="dt">{d.title}<span className="code">{d.code}</span></div>
              <div className="dd">{d.detail}</div>
            </div>
            <div className="acts">
              {e && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 4 }}><R.Av uid={d.uid} size={22} /></span>}
              {d.suggestion && <button className="rec-btn sm" onClick={() => api.requestHandoff(day, { scope: "deviation", context: d.title })}><Ic n="message" s={12} /></button>}
              <button className="rec-btn sm primary" onClick={() => onResolve(d)}><Ic n={isShift(d) ? "check" : "check"} s={12} /> {resolveLabel(d)}</button>
            </div>
          </div>
          {exp === d.id && d.suggestion && (
            <div className="rec-devexp">
              <div className="eyebrow"><Ic n="bot" s={11} /> Botsson foreslår</div>
              <div className="body">{d.suggestion}</div>
              <div className="acts"><button className="rec-btn sm primary" onClick={() => onResolve(d)}><Ic n="check" s={12} /> {isShift(d) ? "Godkjenn vakt" : resolveLabel(d) + " avvik"}</button><button className="rec-btn sm" onClick={() => api.requestHandoff(day, { scope: "deviation", context: d.title })}><Ic n="message" s={12} /> Handoff</button></div>
            </div>
          )}
        </div>
      );
    };
    return (
      <div>
        {groups.map(([sev, title, items]) => (
          <div key={sev} className="rec-devgroup">
            <div className="rec-devgroup-h"><span className="d" style={{ background: TONE[sev] }} /><span>{title}</span><span className="ct">· {items.length}</span><span className="line" /></div>
            {items.map(Row)}
          </div>
        ))}
        {resolved.length > 0 && (
          <div className="rec-devgroup">
            <div className="rec-devgroup-h"><span className="d" style={{ background: "var(--success)" }} /><span>Løst</span><span className="ct">· {resolved.length}</span><span className="line" /></div>
            {resolved.map((d) => (
              <div key={d.id} className="rec-devrow" style={{ opacity: .7 }}><div className="rec-devrow-main"><div><div className="dt">{d.title} <span className="rec-pill success" style={{ marginLeft: 4 }}><Ic n="check" s={10} /> Løst</span></div></div><div /></div></div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- Oppgaver tab ----------
  function TabOppgaver({ day, api }) {
    if (!day.tasks.length) return <div className="rec-card"><window.Rec.Empty icon="clipcheck" title="Ingen oppgaver" sub="Close-out-skjema ikke gjennomført, eller ingen oppgaver registrert." /></div>;
    return (
      <div className="rec-card">
        <div className="rec-card-h"><span className="ic"><Ic n="clipcheck" s={15} /></span> Stengeoppgaver <span className="sp" /><span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{day.tasks.filter((t) => t.done).length}/{day.tasks.length} fullført</span></div>
        <div className="rec-card-b">
          {day.tasks.map((t) => (
            <div key={t.id} className="rec-taskrow">
              <span className={`rec-taskcheck ${t.done ? "done" : "miss"}`}>{t.done ? <Ic n="check" s={12} /> : <Ic n="x" s={12} />}</span>
              <div style={{ flex: 1 }}>
                <div className={`tl ${t.done ? "done" : ""}`}>{t.label}</div>
                {t.comment && <div className="tc">«{t.comment}»</div>}
              </div>
              <span className="src">{t.source === "close_out" ? "Close-out" : "System"}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Revisjonslogg tab ----------
  function TabLogg({ day }) {
    return (
      <div className="rec-card">
        <div className="rec-card-h"><span className="ic"><Ic n="history" s={15} /></span> Revisjonslogg <span className="sp" /><span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>append-only</span></div>
        <div className="rec-timeline">
          {day.audit.map((a, i) => (
            <div key={i} className="rec-tl"><div className="tm">{a.ts.split(" ")[1] || a.ts}</div><div className="bd"><div className="ac">{a.action}</div><div className="who">{a.actor} · {a.ts.split(" ")[0]}</div></div></div>
          ))}
        </div>
      </div>
    );
  }

  // =============================================================
  // CONTEXT RAIL (right)
  // =============================================================
  function ContextRail({ day, api }) {
    const R = window.Rec;
    const handoffs = (day.handoffs || []).map((id) => D().REC_HANDOFF_BY_ID[id]).filter(Boolean);
    const recent = [...day.audit].slice(-4).reverse();
    const b = day.budget; const pct = b.target && b.actual != null ? Math.min(140, Math.round(b.actual / b.target * 100)) : null;
    return (
      <div className="rec-rail">
        <div className="rec-railcard">
          <div className="rec-railcard-h"><span className="ic"><Ic n="message" s={14} /></span> Handoffs <span className="cnt">{handoffs.length}</span></div>
          <div className="rec-railcard-b">
            {handoffs.length ? handoffs.map((h) => {
              const hs = D().REC_HANDOFF_STATUS[h.status];
              return (
                <div key={h.id} className="rec-railitem" onClick={() => api.openHandoff(h.id)}>
                  <span className="ri-ic"><Ic n={hs.icon} s={14} /></span>
                  <div style={{ minWidth: 0 }}><div className="rt">{D().REC_IDENT(h.uid).name}</div><div className="rs">{h.scopeLabel}</div></div>
                </div>
              );
            }) : <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)" }}>Ingen aktive handoffs.</div>}
          </div>
        </div>

        <div className="rec-railcard">
          <div className="rec-railcard-h"><span className="ic"><Ic n="history" s={14} /></span> Siste aktivitet</div>
          <div className="rec-railcard-b">
            {recent.map((a, i) => (
              <div key={i} className="rec-railitem" style={{ cursor: "default" }}><span className="ri-ic"><Ic n="check" s={13} /></span><div style={{ minWidth: 0 }}><div className="rt" style={{ fontWeight: 500 }}>{a.action}</div><div className="rs">{a.actor} · {a.ts.split(" ")[1] || a.ts}</div></div></div>
            ))}
          </div>
        </div>

        <div className="rec-railcard">
          <div className="rec-railcard-h"><span className="ic"><Ic n="gauge" s={14} /></span> Budsjett</div>
          <div className="rec-budget">
            {pct != null ? (
              <>
                <div className="bar"><i className={pct > 100 ? "over" : ""} style={{ width: Math.min(100, pct) + "%" }} /></div>
                <div className="row"><span style={{ color: "var(--muted)" }}>Faktisk</span><span className="v">{R.kr(b.actual)}</span></div>
                <div className="row"><span style={{ color: "var(--muted)" }}>Budsjett</span><span className="v">{R.kr(b.target)}</span></div>
                <div className="row" style={{ marginTop: 5, paddingTop: 6, borderTop: "1px solid var(--border)" }}><span style={{ color: "var(--muted)" }}>Avvik</span><span className="v" style={{ color: b.actual >= b.target ? "var(--success)" : "var(--warning)" }}>{b.actual >= b.target ? "+" : ""}{R.kr(b.actual - b.target)}</span></div>
              </>
            ) : <div style={{ fontSize: 12, color: "var(--muted)" }}>Omsetning ikke registrert ennå.</div>}
          </div>
        </div>
      </div>
    );
  }

  window.RecDaglig = { DayList, DayDetail, ContextRail };
})();
