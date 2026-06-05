// ===== Mitt CV — living professional profile (private route "mitt-cv") =====
// The employee's own CV, built from the work itself: roles & experience at
// Bistro Nord, competence, certifications, completed courses/quizzes, rank/XP/
// ansiennitet, and references. Shareable + exportable. Persona: Jonas H. (Kokk).
(function () {
  const { useEffect } = React;
  const Ic = window.Ic;

  // Jonas Haugen — grounded in shared/ansatte-data.js (id "jh")
  const ME = {
    name: "Jonas Haugen", display: "Jonas H.", initials: "JH", color: "#3B82F6",
    stilling: "Sous-chef", dept: "Kjøkken", employeeNo: "BN-0118",
    started: "3. mar 2022", ansiennitet: "3 år 3 mnd",
    rank: { name: "Erfaren — Sous-chef", level: 4, levelLabel: "Nivå 4 av 6", xp: 2840, next: 3200, nextName: "Kjøkkensjef-kandidat" },
    stats: [
      { v: "3 år", l: "Ansiennitet" },
      { v: "612", l: "Vakter fullført" },
      { v: "94 %", l: "Snitt kunnskapsscore" },
      { v: "9d", l: "Streak nå" },
    ],
    experience: [
      { when: "apr 2024 — nå", what: "Lagleder · Kjøkken kveld", desc: "Ansvar for kveldslaget: bemanning, kvalitet og overlevering. Stedfortreder for kjøkkensjef.", now: true },
      { when: "nov 2023", what: "Stedfortreder for kjøkkensjef", desc: "Tok over driftsansvar på kjøkkenet ved fravær — bestilling, HACCP og avvik." },
      { when: "mar 2022", what: "Ansatt som Kokk · Kjøkken", desc: "Startet på à la carte og varmkjøkken. Opplært i IK-mat og allergenrutiner." },
    ],
    skills: [
      { t: "Varmkjøkken / à la carte", star: true }, { t: "Meny- & råvarekunnskap", star: true },
      { t: "HACCP / IK-mat" }, { t: "Allergenhåndtering", lv: "9/10" }, { t: "Mottakskontroll" },
      { t: "Lagledelse · kveld" }, { t: "Opplæring av nyansatte" }, { t: "Mersalg & paring" },
    ],
    certs: [
      { name: "Hygienesertifikat", status: "valid", s: "Gyldig 2022 – 2027" },
      { name: "Førstehjelp", status: "valid", s: "Gyldig 2025 – 2028" },
      { name: "Brannvern", status: "valid", s: "Gyldig 2024 – 2026" },
      { name: "HMS-kort", status: "expiring", s: "Utløper 2026" },
    ],
    courses: [
      { t: "Allergener i praksis", m: "Opplæring · bestått 6. mar 2025", score: "9/10" },
      { t: "IK-mat — internkontroll mattrygghet", m: "HMS · fullført", score: "20/20" },
      { t: "Vintermeny — retter & råvarer", m: "Menykunnskap · quiz", score: "92 %" },
      { t: "HMS for kjøkken", m: "HMS · fullført 10. mar 2022", score: "Bestått" },
    ],
    refs: [
      { q: "Jonas er ryggraden i kveldslaget — rolig under press, og den nyansatte lærer mer av en vakt med ham enn av en uke med manual.", by: "Maria A.", role: "Driftsleder" },
      { q: "Tar eierskap til mattryggheten uten at noen ber om det. Allergenrutinen vår er strammere fordi han bryr seg.", by: "Sara K.", role: "Kvalitetsleder" },
    ],
  };

  function Panel({ icon, title, action, children }) {
    return (
      <div className="so-panel">
        <div className="so-panel-head">
          <span className="t"><span className="ico"><Ic n={icon} s={15} /></span>{title}</span>
          {action ? <><span className="spacer" />{action}</> : null}
        </div>
        {children}
      </div>
    );
  }

  function MittCVPage() {
    const toast = window.useToast();
    useEffect(() => {
      if (window.SmartoutContext && window.SmartoutContext.set)
        window.SmartoutContext.set({ route: "mitt-cv", view: "oversikt", role: "ansatt", subject: "Mitt CV" });
      return () => { if (window.SmartoutContext && window.SmartoutContext.set) window.SmartoutContext.set({ route: null }); };
    }, []);

    const xpPct = Math.min(1, ME.rank.xp / ME.rank.next);
    const exportPdf = () => { toast("Lager CV som PDF…"); setTimeout(() => window.print(), 350); };

    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ maxWidth: 1080 }}>
          <div className="ms-head">
            <div>
              <div className="sk-eyebrow">Min side · CV</div>
              <h1 className="ms-h1">Mitt CV</h1>
              <div className="ms-sub">Profilen din bygger seg selv av arbeidet du gjør — roller, kompetanse, sertifikater og kursene du fullfører. Del den når du vil.</div>
            </div>
            <div className="ms-headacts">
              <button className="ms-btn" onClick={() => toast("Delingslenke kopiert — gyldig i 30 dager")}><Ic n="send" s={15} /> Del</button>
              <button className="ms-btn primary" onClick={exportPdf}><Ic n="download" s={15} /> Last ned PDF</button>
            </div>
          </div>

          {/* hero */}
          <div className="mscv-hero">
            <div className="mscv-hero-top">
              <span className="so-av" style={{ background: ME.color }}>{ME.initials}</span>
              <div className="mscv-hero-id">
                <div className="nm">{ME.name}</div>
                <div className="rl">{ME.stilling} · {ME.dept} · Bistro Nord <span style={{ opacity: .6 }}>· ansatt siden {ME.started}</span></div>
              </div>
            </div>
            <div className="mscv-hero-stats">
              {ME.stats.map((s, i) => <div key={i} className="mscv-hs"><div className="v">{s.v}</div><div className="l">{s.l}</div></div>)}
            </div>
          </div>

          <div className="so-grid-2" style={{ marginTop: 18 }}>
            {/* LEFT */}
            <div className="so-stack">
              {/* rank / xp */}
              <Panel icon="zap" title="Rang & utvikling" action={<span className="so-eyebrow-lbl">{ME.rank.levelLabel}</span>}>
                <div className="mscv-rank">
                  <span className="mscv-rank-badge"><Ic n="zap" s={26} /></span>
                  <div className="mscv-rank-b">
                    <div className="mscv-rank-t">{ME.rank.name}</div>
                    <div className="mscv-rank-s">{ME.rank.xp.toLocaleString("nb-NO")} XP · {ME.rank.next - ME.rank.xp} XP til «{ME.rank.nextName}»</div>
                    <div className="mscv-xpbar"><span style={{ width: `${xpPct * 100}%` }} /></div>
                  </div>
                </div>
                <div className="lo-infonote" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
                  <Ic n="bot" s={15} c="var(--orange-dark)" />
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>XP og rang bygges av verifisert arbeid — fullførte vakter, beståtte kunnskapssjekker og ansvar du tar. Ansiennitet teller separat og kan ikke samles på snarveier.</div>
                </div>
              </Panel>

              {/* experience timeline */}
              <Panel icon="trendUp" title="Roller & erfaring">
                <div className="mscv-tl">
                  {ME.experience.map((e, i) => (
                    <div key={i} className={`mscv-tl-item ${e.now ? "now" : ""}`}>
                      <span className="mscv-tl-dot" />
                      <div className="mscv-tl-when">{e.when}</div>
                      <div className="mscv-tl-what">{e.what}</div>
                      <div className="mscv-tl-desc">{e.desc}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* courses */}
              <Panel icon="cap" title="Fullførte kurs & kunnskapssjekker" action={<span className="so-eyebrow-lbl">{ME.courses.length} fullført</span>}>
                <div>
                  {ME.courses.map((c, i) => (
                    <div key={i} className="mscv-course">
                      <span className="mscv-course-ic"><Ic n="checkdoc" s={15} /></span>
                      <div className="mscv-course-b"><div className="mscv-course-t">{c.t}</div><div className="mscv-course-m">{c.m}</div></div>
                      <span className="mscv-course-score">{c.score}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* RIGHT */}
            <div className="so-stack">
              {/* skills */}
              <Panel icon="sparkle" title="Kompetanse & ferdigheter">
                <div className="mscv-chips">
                  {ME.skills.map((s, i) => (
                    <span key={i} className={`mscv-chip ${s.star ? "star" : ""}`}>
                      {s.star && <Ic n="star" s={12} />}{s.t}{s.lv && <span className="lv">{s.lv}</span>}
                    </span>
                  ))}
                </div>
              </Panel>

              {/* certs */}
              <Panel icon="shield" title="Sertifikater" action={<span className="so-eyebrow-lbl">3 gyldige</span>}>
                <div className="mscv-certs">
                  {ME.certs.map((c, i) => (
                    <div key={i} className="mscv-cert">
                      <span className={`mscv-cert-ic ${c.status}`}><Ic n={c.status === "valid" ? "check" : c.status === "expiring" ? "clock" : "alert"} s={16} /></span>
                      <div className="mscv-cert-b"><div className="mscv-cert-t">{c.name}</div><div className="mscv-cert-s">{c.s}</div></div>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* references */}
              <Panel icon="message" title="Attester & referanser">
                <div>
                  {ME.refs.map((r, i) => (
                    <div key={i} className="mscv-ref">
                      <div className="mscv-ref-q">«{r.q}»</div>
                      <div className="mscv-ref-by">
                        <span className="so-av" style={{ width: 26, height: 26, fontSize: 10, background: i === 0 ? "#FF7849" : "#0E9F6E" }}>{r.by.split(" ").map(x => x[0]).join("")}</span>
                        <span className="nm">{r.by}</span><span className="rl">· {r.role}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: "12px 18px" }}>
                    <button className="ms-btn sm" onClick={() => toast("Forespørsel om attest sendt til Maria A.")}><Ic n="plus" s={13} /> Be om ny attest</button>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </main>
    );
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { "mitt-cv": MittCVPage });
})();
