// ===== Avstemming — admin host (route "avstemming") =====
// Avstemming er en SESSION: ansatt settler (Fase 1) → admin godkjenner (Fase 2)
// → lås. Tre nivåer: daglig · yrke · sesong + handoff-motor + policy.
// Gate-driven, progressive disclosure, AI assistiv. Everything toasts + undoes.
(function () {
  const { useState, useEffect, useMemo } = React;
  const Ic = window.Ic;
  const D = () => window.SmartoutData;

  function AvstemmingPage() {
    const toast = window.useToast();
    const R = window.Rec;
    const { DayList, DayDetail, ContextRail } = window.RecDaglig;
    const F = window.RecForms;
    const M = window.RecMore;

    const [tab, setTab] = useState("daglig");
    const [days, setDays] = useState(() => D().REC_DAYS.map((d) => ({ ...d, shifts: d.shifts.map((s) => ({ ...s })), deviations: d.deviations.map((x) => ({ ...x })), tasks: d.tasks.map((t) => ({ ...t })), audit: [...d.audit] })));
    const focus = days.find((d) => d.focus) || days[0];
    const [selId, setSelId] = useState(focus.id);
    const [sel, setSel] = useState(new Set());
    const [resolvedHandoffs, setResolvedHandoffs] = useState(new Set());
    const [handoffInit, setHandoffInit] = useState(null);

    // overlays
    const [ov, setOv] = useState(null); // {kind, ...}

    const day = days.find((d) => d.id === selId) || days[0];

    // counts for tab badges
    const attentionCount = days.filter((d) => ["awaiting_approval", "submitted", "unreconciled"].includes(d.status)).length;
    const handoffOpen = D().REC_HANDOFFS.filter((h) => h.status !== "resolved" && !resolvedHandoffs.has(h.id)).length;

    // ---- Botsson context ----
    useEffect(() => {
      const C = window.SmartoutContext;
      if (C && C.set) C.set({ route: "avstemming", view: tab, subject: tab === "daglig" ? `${day.weekday} ${day.dateLabel}` : tab, role: "admin", drafts: attentionCount });
      return () => { if (C && C.set) C.set({ route: null }); };
    }, [tab, selId, attentionCount]);

    // ---- day mutators ----
    const patchDay = (id, fn) => setDays((ds) => ds.map((d) => d.id === id ? fn(d) : d));
    const addAudit = (d, action, actor) => ({ ...d, audit: [...d.audit, { ts: "nå", actor: actor || "Maria A.", action }] });

    const approveDay = (d) => {
      if (D().REC_PREFLIGHT(d).length) { toast("Kan ikke godkjenne — blokkere gjenstår"); return; }
      patchDay(d.id, (x) => addAudit({ ...x, status: "approved", approvedBy: "ma", approvedAt: "nå" }, "Godkjente dagen (Fase 2)"));
      toast(`${d.weekday} ${d.dateLabel} godkjent`, { undo: () => patchDay(d.id, (x) => ({ ...x, status: "awaiting_approval", approvedBy: null })) });
    };
    const lockDay = (d) => setOv({ kind: "lock", day: d });
    const doLock = () => {
      const d = ov.day; setOv(null);
      patchDay(d.id, (x) => addAudit({ ...x, status: "locked", lockedBy: "ma", lockedAt: "nå" }, "Låste dagen"));
      toast(`${d.weekday} ${d.dateLabel} låst`, { undo: () => patchDay(d.id, (x) => ({ ...x, status: "approved", lockedBy: null })) });
    };
    const rejectDay = (d) => setOv({ kind: "reject", day: d });
    const doReject = (reason) => {
      const d = ov.day; setOv(null);
      patchDay(d.id, (x) => addAudit({ ...x, status: "open" }, `Avviste dagen: «${reason}»`));
      toast(`Dagen sendt tilbake til ${d.settledBy ? D().REC_IDENT(d.settledBy).name : "ansatt"}`, { undo: () => patchDay(d.id, (x) => ({ ...x, status: "awaiting_approval" })) });
    };

    const approveShift = (d, sh) => {
      patchDay(d.id, (x) => ({ ...x, shifts: x.shifts.map((s) => s.uid === sh.uid && s.role === sh.role ? { ...s, status: "approved", approved: s.calculated } : s), deviations: x.deviations.map((dev) => dev.uid === sh.uid && (dev.code === "SHIFT_OVER" || dev.code === "SHIFT_PENDING") ? { ...dev, status: "resolved" } : dev) }));
      toast(`Vakt godkjent for ${D().REC_IDENT(sh.uid).name}`);
    };
    const editShift = (d, sh) => setOv({ kind: "shift", day: d, shift: sh });
    const doEditShift = (uid, { hours, just, disputed }) => {
      const d = ov.day; setOv(null);
      patchDay(d.id, (x) => ({ ...x, shifts: x.shifts.map((s) => s.uid === uid && s.role === ov.shift.role ? { ...s, approved: hours, status: disputed ? "disputed" : "edited", note: just || s.note } : s) }));
      toast(`Timer ${disputed ? "merket omtvistet" : "lagret"} for ${D().REC_IDENT(uid).name}`);
    };

    // rich shift approval (godkjenn / foreslå ny tid / manuelle tillegg)
    const shiftApprove = (d, sh, dev) => setOv({ kind: "shiftapprove", day: d, shift: sh, dev });
    const doShiftApprove = (res) => {
      const d = ov.day; setOv(null);
      const nm = D().REC_IDENT(res.uid).name;
      patchDay(d.id, (x) => {
        const shifts = x.shifts.map((s) => (s.uid === res.uid && s.role === res.role) ? {
          ...s,
          status: res.mode === "approve" ? "approved" : "proposed",
          approved: res.mode === "approve" ? res.hours : s.approved,
          note: res.note || s.note,
          supplements: [...(s.supplements || []), ...res.supplements],
        } : s);
        let deviations = x.deviations;
        if (res.mode === "approve") deviations = deviations.map((dv) => (dv.uid === res.uid && (dv.code === "SHIFT_OVER" || dv.code === "SHIFT_PENDING")) || dv.id === res.devId ? { ...dv, status: "resolved" } : dv);
        const suppTxt = res.supplements.length ? ` + ${res.supplements.length} tillegg` : "";
        const action = res.mode === "approve" ? `Godkjente vakt for ${nm}${suppTxt}` : `Foreslo ny tid (${res.hours}t) til ${nm} — venter på godkjenning`;
        return addAudit({ ...x, shifts, deviations }, action);
      });
      toast(res.mode === "approve" ? `Vakt godkjent for ${nm}` : `Forslag sendt til ${nm} for godkjenning`, { undo: () => {} });
    };

    const adjustRevenue = (d) => setOv({ kind: "revenue", day: d });
    const doAdjustRevenue = ({ total, cash, reason }) => {
      const d = ov.day; setOv(null);
      patchDay(d.id, (x) => addAudit({ ...x, revenue: { ...x.revenue, total, cashCounted: cash, cashDiff: cash - x.revenue.cash, source: "manual" } }, `Justerte omsetning manuelt: «${reason}»`));
      toast("Omsetning justert");
    };

    const resolveDev = (d, dev) => setOv({ kind: "dev", day: d, dev });
    const doResolveDev = (devId, { notes }) => {
      const d = ov.day; setOv(null);
      patchDay(d.id, (x) => addAudit({ ...x, deviations: x.deviations.map((dv) => dv.id === devId ? { ...dv, status: "resolved", resolution: notes } : dv) }, `Løste avvik ${devId}`));
      toast("Avvik løst", { undo: () => patchDay(d.id, (x) => ({ ...x, deviations: x.deviations.map((dv) => dv.id === devId ? { ...dv, status: "open" } : dv) })) });
    };

    const requestHandoff = (d, seed) => setOv({ kind: "handoff", day: d, seed });
    const doRequestHandoff = ({ scope, channel }) => {
      setOv(null);
      toast(`Handoff startet (${channel === "voice" ? "telefon" : "chat"})`, { undo: () => {} });
    };

    // bulk
    const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const openBulk = () => setOv({ kind: "bulk", days: days.filter((d) => sel.has(d.id)) });
    const doBulk = (ids) => {
      setOv(null); setSel(new Set());
      setDays((ds) => ds.map((d) => ids.includes(d.id) ? { ...d, status: "approved", approvedBy: "ma", audit: [...d.audit, { ts: "nå", actor: "Maria A.", action: "Godkjent (bulk)" }] } : d));
      toast(`${ids.length} dager godkjent`, { undo: () => {} });
    };

    const openHandoff = (id) => { setHandoffInit(id); setTab("handoffs"); };
    const resolveHandoff = (id) => setResolvedHandoffs((s) => new Set(s).add(id));

    const api = {
      toast, goTab: () => {}, // goTab set per-detail below
      approveDay, lockDay, rejectDay, approveShift, editShift, adjustRevenue, resolveDev, requestHandoff, openHandoff,
      shiftApprove,
    };

    const TABS = [
      ["daglig", "Daglig", "checkdoc", attentionCount || null],
      ["yrke", "Yrke", "layers", null],
      ["sesong", "Sesong", "sun", null],
      ["handoffs", "Handoffs", "message", handoffOpen || null],
      ["innstillinger", "Innstillinger", "settings", null],
    ];

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: tab === "daglig" ? 1320 : 1100 }}>
          {/* head */}
          <div className="rec-head">
            <div>
              <div className="sk-eyebrow">Økonomi · Avstemming</div>
              <h1 className="rec-h1">Avstemming</h1>
              <div className="rec-sub">Ansatt settler dagen, du godkjenner og låser. Tre nivåer — daglig, yrke og sesong — med AI-handoff når noe må avklares.</div>
            </div>
            <div className="rec-head-actions">
              <button className="rec-btn" onClick={() => setOv({ kind: "export" })}><Ic n="download" s={15} /> Eksport</button>
            </div>
          </div>

          {/* tabs */}
          <div className="rec-tabs">
            {TABS.map(([k, l, ic, n]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); if (k !== "handoffs") setHandoffInit(null); }}>
                <Ic n={ic} s={15} /> {l}{n != null && <span className={`cnt ${k === "daglig" && attentionCount ? "crit" : ""}`}>{n}</span>}
              </button>
            ))}
          </div>

          {tab === "daglig" && (
            <div className="rec-grid">
              <DayList days={days} selId={selId} onSelect={setSelId} sel={sel} onToggleSel={toggleSel} onBulk={openBulk} />
              <DayDetail key={day.id} day={day} api={api} />
              <ContextRail day={day} api={api} />
            </div>
          )}
          {tab === "yrke" && <M.Yrke toast={toast} />}
          {tab === "sesong" && <M.Sesong toast={toast} />}
          {tab === "handoffs" && <M.Handoffs toast={toast} initialId={handoffInit} onResolve={resolveHandoff} />}
          {tab === "innstillinger" && <M.Settings toast={toast} />}
        </div>

        {/* overlays */}
        {ov && ov.kind === "shift" && <F.ShiftEdit day={ov.day} shift={ov.shift} onClose={() => setOv(null)} onSubmit={doEditShift} />}
        {ov && ov.kind === "shiftapprove" && <F.ShiftApprove day={ov.day} shift={ov.shift} dev={ov.dev} onClose={() => setOv(null)} onSubmit={doShiftApprove} />}
        {ov && ov.kind === "revenue" && <F.RevenueAdjust day={ov.day} onClose={() => setOv(null)} onSubmit={doAdjustRevenue} />}
        {ov && ov.kind === "dev" && <F.DeviationResolve day={ov.day} dev={ov.dev} onClose={() => setOv(null)} onSubmit={doResolveDev} />}
        {ov && ov.kind === "handoff" && <F.HandoffRequest day={ov.day} seed={ov.seed} onClose={() => setOv(null)} onSubmit={doRequestHandoff} />}
        {ov && ov.kind === "reject" && <F.DayReject day={ov.day} onClose={() => setOv(null)} onSubmit={doReject} />}
        {ov && ov.kind === "lock" && <F.DayLock day={ov.day} onClose={() => setOv(null)} onConfirm={doLock} />}
        {ov && ov.kind === "bulk" && <F.BulkApprove days={ov.days} onClose={() => setOv(null)} onConfirm={doBulk} />}
        {ov && ov.kind === "export" && <F.ExportModal scope="avstemte dager" onClose={() => setOv(null)} onSubmit={(dest, items) => { setOv(null); const D2 = { tripletex: "Sendt til Tripletex", csv: "Eksportert som CSV", excel: "Eksportert som Excel", pdf: "Avstemmingsrapport (PDF) generert" }; toast(`${D2[dest] || "Eksport startet"}${items && items.length ? ` · ${items.join(" + ")}` : ""}`, { undo: () => {} }); }} />}
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { avstemming: AvstemmingPage });
})();
