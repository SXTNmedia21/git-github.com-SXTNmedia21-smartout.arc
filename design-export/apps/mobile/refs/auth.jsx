// ===== Smartout unified auth flow (Nordic Split, native, validated) =====
// Exposes window.AuthFlow({ onComplete(role), platform })
// platform: 'web' | 'mobile' — adjusts panel layout (mobile = single column)

(function () {
  const { useState, useRef, useEffect } = React;

  // --- tiny inline icon set (self-contained, no bundle dependency) ---
  const AI = {
    mail: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>,
    lock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
    building: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 21v-4h6v4"/></svg>,
    arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
    check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    alert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ---------- Wordmark ----------
  function Wordmark({ color = "#fdfcfa", size = 26 }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9, color }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: "#f97316", transform: "rotate(45deg)", boxShadow: "0 0 16px rgba(249,115,22,0.6)" }} />
        <span style={{ fontFamily: "Instrument Serif, serif", fontSize: size, letterSpacing: "-0.02em" }}>Smartout</span>
      </div>
    );
  }

  // ---------- Brand panel ----------
  function BrandPanel({ tagline, platform }) {
    if (platform === "mobile") return null;
    return (
      <div style={{
        flex: "0 0 42%", position: "relative", overflow: "hidden",
        background: "radial-gradient(120% 90% at 20% 10%, #2a2017 0%, #1a1510 55%, #120e0a 100%)",
        color: "#f0eeeb", padding: "44px 44px 40px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div style={{ position: "absolute", top: -120, right: -100, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.28) 0%, transparent 70%)", filter: "blur(8px)" }} />
        <Wordmark />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(240,238,235,0.5)", marginBottom: 18 }}>Employee Readiness System</div>
          <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 42, lineHeight: 1.08, letterSpacing: "-0.02em", maxWidth: 380 }}>{tagline}</div>
        </div>
        <div style={{ position: "relative", display: "flex", gap: 22, fontSize: 12.5, color: "rgba(240,238,235,0.55)" }}>
          <span>Café Skuta</span><span>·</span><span>Bistro Nord</span><span>·</span><span>+38 arbeidsplasser</span>
        </div>
      </div>
    );
  }

  // ---------- Form field ----------
  function Field({ label, icon, error, children }) {
    return (
      <label style={{ display: "block", marginBottom: 16 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--fg)", marginBottom: 7 }}>{label}</span>
        <div style={{ position: "relative" }}>
          {icon && <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "inline-flex" }}>{icon}</span>}
          {children}
        </div>
        {error && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--error)", marginTop: 6 }}>{AI.alert} {error}</span>}
      </label>
    );
  }
  const inputStyle = (hasIcon, invalid) => ({
    width: "100%", height: 46, borderRadius: 12, boxSizing: "border-box",
    padding: hasIcon ? "0 14px 0 40px" : "0 14px",
    border: `1px solid ${invalid ? "var(--error)" : "var(--border)"}`,
    background: "var(--card)", color: "var(--fg)", fontSize: 14.5, fontFamily: "inherit",
    outline: "none", transition: "border-color .15s, box-shadow .15s",
  });

  function PrimaryBtn({ children, onClick, disabled, loading }) {
    return (
      <button onClick={onClick} disabled={disabled || loading} style={{
        width: "100%", height: 48, borderRadius: 12, border: "none",
        background: disabled ? "color-mix(in oklab, #f97316 50%, var(--bg))" : "#f97316",
        color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit",
        cursor: disabled || loading ? "default" : "pointer",
        boxShadow: disabled ? "none" : "0 2px 14px rgba(249,115,22,0.32)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "transform .12s, box-shadow .15s",
      }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={e => (e.currentTarget.style.transform = "none")}
      onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
        {loading ? <Spinner /> : <>{children}</>}
      </button>
    );
  }
  function Spinner() {
    return <span style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "authspin .7s linear infinite" }} />;
  }

  function FormShell({ platform, children, footer }) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: platform === "mobile" ? "32px 24px" : "40px", background: "var(--bg)", position: "relative", overflowY: "auto" }}>
        {platform === "mobile" && <div style={{ position: "absolute", top: 28, left: 24 }}><Wordmark color="var(--fg)" size={22} /></div>}
        <div style={{ width: "100%", maxWidth: 372 }}>
          {children}
        </div>
        {footer && <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>{footer}</div>}
      </div>
    );
  }

  // =================== STEPS ===================
  function WelcomeStep({ go, platform }) {
    return (
      <FormShell platform={platform}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Velkommen tilbake</div>
          <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: 40, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>La oss gjøre laget klart for dagen.</h1>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <PrimaryBtn onClick={() => go("login")}>Logg inn {AI.arrow}</PrimaryBtn>
          <button onClick={() => go("signup")} style={ghostBtn}>Sett opp ny arbeidsplass</button>
        </div>
        <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
          Har du fått en invitasjon på e-post eller SMS? Trykk lenken i meldingen, så lander du rett inn.
        </div>
      </FormShell>
    );
  }

  function LoginStep({ go, finish, platform }) {
    const [tab, setTab] = useState("password");
    const [email, setEmail] = useState("maria@bistronord.no");
    const [pw, setPw] = useState("");
    const [touched, setTouched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formErr, setFormErr] = useState("");

    const emailErr = touched && !EMAIL_RE.test(email) ? "Skriv inn en gyldig e-post" : "";
    const pwErr = touched && tab === "password" && pw.length < 6 ? "Minst 6 tegn" : "";

    const submit = () => {
      setTouched(true); setFormErr("");
      if (!EMAIL_RE.test(email)) return;
      if (tab === "password" && pw.length < 6) return;
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        if (tab === "password" && pw.toLowerCase() === "feil") { setFormErr("Feil e-post eller passord. Prøv igjen."); return; }
        if (tab === "magic") go("otp");
        else go("workspace");
      }, 850);
    };

    return (
      <FormShell platform={platform} footer={<span>Demo · skriv hva som helst. Passord «feil» = feilmelding.</span>}>
        <button onClick={() => go("welcome")} style={linkBack}>{AI.back} Tilbake</button>
        <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: 34, fontWeight: 400, letterSpacing: "-0.02em", margin: "10px 0 6px" }}>Logg inn</h1>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 22px" }}>Fortsett til arbeidsplassen din.</p>

        <div style={{ display: "inline-flex", background: "var(--secondary)", borderRadius: 10, padding: 4, gap: 2, marginBottom: 20 }}>
          {[["password", "Passord"], ["magic", "Magisk lenke"]].map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setTouched(false); setFormErr(""); }} style={{
              padding: "7px 16px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: tab === k ? "var(--card)" : "transparent", color: tab === k ? "var(--fg)" : "var(--muted)",
              boxShadow: tab === k ? "var(--sh-sm)" : "none",
            }}>{l}</button>
          ))}
        </div>

        <Field label="E-post" icon={AI.mail} error={emailErr}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="navn@arbeidsplass.no" style={inputStyle(true, !!emailErr)} />
        </Field>
        {tab === "password" && (
          <Field label="Passord" icon={AI.lock} error={pwErr}>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" style={inputStyle(true, !!pwErr)} onKeyDown={e => e.key === "Enter" && submit()} />
          </Field>
        )}
        {formErr && <div style={errBox}>{AI.alert} {formErr}</div>}

        <div style={{ marginTop: 6 }}>
          <PrimaryBtn onClick={submit} loading={loading}>{tab === "magic" ? "Send magisk lenke" : "Logg inn"} {!loading && AI.arrow}</PrimaryBtn>
        </div>
        {tab === "password" && <button onClick={() => {}} style={{ ...linkText, marginTop: 14 }}>Glemt passord?</button>}
      </FormShell>
    );
  }

  function SignupStep({ go, platform, store }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [company, setCompany] = useState("");
    const [touched, setTouched] = useState(false);
    const [loading, setLoading] = useState(false);

    const nameErr = touched && name.trim().length < 2 ? "Skriv inn navnet ditt" : "";
    const emailErr = touched && !EMAIL_RE.test(email) ? "Gyldig e-post kreves" : "";
    const compErr = touched && company.trim().length < 2 ? "Hva heter arbeidsplassen?" : "";

    const submit = () => {
      setTouched(true);
      if (name.trim().length < 2 || !EMAIL_RE.test(email) || company.trim().length < 2) return;
      setLoading(true);
      store.current = { name: name.trim(), company: company.trim() };
      setTimeout(() => { setLoading(false); go("otp"); }, 850);
    };

    return (
      <FormShell platform={platform}>
        <button onClick={() => go("welcome")} style={linkBack}>{AI.back} Tilbake</button>
        <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: 34, fontWeight: 400, letterSpacing: "-0.02em", margin: "10px 0 6px" }}>Ny arbeidsplass</h1>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 22px" }}>Vi tar oss av regelverk og rutiner. Du tar laget.</p>
        <Field label="Ditt navn" icon={AI.user} error={nameErr}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Fornavn Etternavn" style={inputStyle(true, !!nameErr)} />
        </Field>
        <Field label="Jobb-e-post" icon={AI.mail} error={emailErr}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="deg@arbeidsplass.no" style={inputStyle(true, !!emailErr)} />
        </Field>
        <Field label="Arbeidsplassens navn" icon={AI.building} error={compErr}>
          <input value={company} onChange={e => setCompany(e.target.value)} placeholder="f.eks. Café Skuta" style={inputStyle(true, !!compErr)} onKeyDown={e => e.key === "Enter" && submit()} />
        </Field>
        <div style={{ marginTop: 6 }}>
          <PrimaryBtn onClick={submit} loading={loading}>Fortsett {!loading && AI.arrow}</PrimaryBtn>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 16, lineHeight: 1.5 }}>Ved å fortsette godtar du vilkårene og personvernerklæringen.</p>
      </FormShell>
    );
  }

  function OtpStep({ go, next, platform }) {
    const [digits, setDigits] = useState(["", "", "", "", "", ""]);
    const [err, setErr] = useState("");
    const [secs, setSecs] = useState(30);
    const refs = useRef([]);
    useEffect(() => { const t = secs > 0 && setInterval(() => setSecs(s => s - 1), 1000); return () => clearInterval(t); }, [secs]);

    const setD = (i, v) => {
      if (!/^\d?$/.test(v)) return;
      const nd = [...digits]; nd[i] = v; setDigits(nd); setErr("");
      if (v && i < 5) refs.current[i + 1]?.focus();
    };
    const onKey = (i, e) => { if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus(); };
    const code = digits.join("");
    const verify = () => {
      if (code.length < 6) { setErr("Fyll inn alle seks sifrene"); return; }
      if (code === "000000") { setErr("Feil kode. Sjekk meldingen og prøv igjen."); return; }
      next();
    };
    return (
      <FormShell platform={platform} footer={<span>Demo · alle koder unntatt 000000 godtas.</span>}>
        <button onClick={() => go("login")} style={linkBack}>{AI.back} Tilbake</button>
        <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: 34, fontWeight: 400, letterSpacing: "-0.02em", margin: "10px 0 6px" }}>Sjekk e-posten</h1>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 24px", lineHeight: 1.5 }}>Vi sendte en 6-sifret kode. Skriv den inn for å bekrefte.</p>
        <div style={{ display: "flex", gap: 9, marginBottom: err ? 8 : 18 }}>
          {digits.map((d, i) => (
            <input key={i} ref={el => refs.current[i] = el} value={d} inputMode="numeric" maxLength={1}
              onChange={e => setD(i, e.target.value)} onKeyDown={e => onKey(i, e)}
              style={{ width: 48, height: 56, textAlign: "center", fontSize: 22, fontWeight: 600, fontFamily: "Geist Mono, monospace",
                borderRadius: 12, border: `1px solid ${err ? "var(--error)" : d ? "var(--orange)" : "var(--border)"}`,
                background: "var(--card)", color: "var(--fg)", outline: "none" }} />
          ))}
        </div>
        {err && <div style={{ ...errBox, marginBottom: 16 }}>{AI.alert} {err}</div>}
        <PrimaryBtn onClick={verify}>Bekreft {AI.arrow}</PrimaryBtn>
        <button onClick={() => setSecs(30)} disabled={secs > 0} style={{ ...linkText, marginTop: 16, opacity: secs > 0 ? 0.5 : 1, cursor: secs > 0 ? "default" : "pointer" }}>
          {secs > 0 ? `Send ny kode om ${secs}s` : "Send ny kode"}
        </button>
      </FormShell>
    );
  }

  const WORKSPACES = [
    { name: "Bistro Nord", role: "Driftsleder", roleKey: "leader", color: "#ee560c", meta: "12 på vakt i dag", initials: "BN" },
    { name: "Café Skuta", role: "Servitør", roleKey: "employee", color: "#00ab93", meta: "2 aktive vakter", initials: "CS" },
    { name: "Hotell Vest — Event", role: "Eventansvarlig", roleKey: "leader", color: "#864ad2", meta: "Stengt nå", initials: "HV" },
  ];
  function WorkspaceStep({ finish, platform }) {
    const [sel, setSel] = useState(null);
    return (
      <FormShell platform={platform}>
        <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: 34, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Velg arbeidsplass</h1>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 22px" }}>Du har tilgang til flere. Velg hvor du vil jobbe nå.</p>
        <div style={{ display: "grid", gap: 10, marginBottom: 22 }}>
          {WORKSPACES.map((w, i) => (
            <button key={i} onClick={() => setSel(i)} style={{
              display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              border: `1.5px solid ${sel === i ? "var(--orange)" : "var(--border)"}`, background: sel === i ? "var(--orange-soft)" : "var(--card)",
              boxShadow: sel === i ? "0 0 0 3px rgba(249,115,22,0.12)" : "none", transition: "all .15s",
            }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: w.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{w.initials}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>{w.name}</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 1 }}>{w.role} · {w.meta}</span>
              </span>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${sel === i ? "var(--orange)" : "var(--border-strong)"}`, background: sel === i ? "var(--orange)" : "transparent", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel === i && AI.check}</span>
            </button>
          ))}
        </div>
        <PrimaryBtn onClick={() => sel != null && finish(WORKSPACES[sel].roleKey)} disabled={sel == null}>Fortsett {sel != null && AI.arrow}</PrimaryBtn>
      </FormShell>
    );
  }

  // ---------- Onboarding wizard (new workspace) ----------
  const WIZ_STEPS = [
    { key: "welcome", title: "Velkommen til Smartout", body: "La oss sette opp arbeidsplassen din på under to minutter. Du kan endre alt senere." },
    { key: "company", title: "Litt om virksomheten", body: "Dette former standardrutiner og regelverk." },
    { key: "industry", title: "Hvilken bransje?", body: "Vi forhåndsfyller maler, sjekklister og HMS-krav." },
    { key: "depts", title: "Avdelinger", body: "Velg avdelingene dere driver. Du kan legge til flere senere." },
    { key: "invite", title: "Inviter laget", body: "Send invitasjoner nå, eller hopp over og gjør det senere." },
    { key: "done", title: "Alt klart!", body: "Arbeidsplassen er satt opp. Botsson har laget et forslag til dagens rutiner." },
  ];
  const INDUSTRIES = ["Restaurant", "Hotell", "Café & bar", "Catering & event", "Detaljhandel", "Annet"];
  const DEPTS = [["Kjøkken", "#ee560c"], ["Sal", "#00ab93"], ["Bar", "#864ad2"], ["Event", "#c18200"], ["Lager", "#008388"]];

  function OnboardingStep({ finish, platform, store }) {
    const [i, setI] = useState(0);
    const [industry, setIndustry] = useState(null);
    const [depts, setDepts] = useState(["Kjøkken", "Sal"]);
    const [invites, setInvites] = useState("");
    const s = WIZ_STEPS[i];
    const canNext = s.key === "industry" ? industry != null : s.key === "depts" ? depts.length > 0 : true;
    const next = () => i < WIZ_STEPS.length - 1 ? setI(i + 1) : finish("leader");
    const company = store.current?.company || "Café Skuta";

    return (
      <div style={{ flex: 1, display: "flex", background: "var(--bg)" }}>
        {/* steps rail */}
        {platform !== "mobile" && (
          <div style={{ flex: "0 0 280px", background: "var(--sidebar)", borderRight: "1px solid var(--border)", padding: "40px 28px" }}>
            <Wordmark color="var(--fg)" size={24} />
            <div style={{ marginTop: 40, display: "grid", gap: 4 }}>
              {WIZ_STEPS.map((w, idx) => (
                <div key={w.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", opacity: idx <= i ? 1 : 0.45 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                    background: idx < i ? "var(--success)" : idx === i ? "var(--orange)" : "transparent",
                    border: idx >= i ? `1.5px solid ${idx === i ? "var(--orange)" : "var(--border-strong)"}` : "none",
                    color: idx <= i ? "#fff" : "var(--muted)" }}>{idx < i ? AI.check : idx + 1}</span>
                  <span style={{ fontSize: 13.5, fontWeight: idx === i ? 600 : 500, color: idx === i ? "var(--fg)" : "var(--muted)" }}>{w.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* step content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: platform === "mobile" ? "28px 22px" : "56px 60px", overflowY: "auto" }}>
          <div style={{ flex: 1, maxWidth: 480 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Steg {i + 1} av {WIZ_STEPS.length}</div>
            <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: platform === "mobile" ? 32 : 40, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.05, margin: "0 0 10px" }}>{s.title}</h1>
            <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.55, margin: "0 0 28px", maxWidth: 440 }}>{s.body}</p>

            {s.key === "company" && (
              <div>
                <Field label="Virksomhetens navn" icon={AI.building}><input defaultValue={company} style={inputStyle(true)} /></Field>
                <Field label="Org.nummer (valgfritt)"><input placeholder="999 999 999" style={inputStyle(false)} /></Field>
              </div>
            )}
            {s.key === "industry" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {INDUSTRIES.map(ind => (
                  <button key={ind} onClick={() => setIndustry(ind)} style={{
                    padding: "16px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                    border: `1.5px solid ${industry === ind ? "var(--orange)" : "var(--border)"}`, background: industry === ind ? "var(--orange-soft)" : "var(--card)", color: "var(--fg)",
                  }}>{ind}</button>
                ))}
              </div>
            )}
            {s.key === "depts" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {DEPTS.map(([d, c]) => {
                  const on = depts.includes(d);
                  return (
                    <button key={d} onClick={() => setDepts(on ? depts.filter(x => x !== d) : [...depts, d])} style={{
                      display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 16px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                      border: `1.5px solid ${on ? c : "var(--border)"}`, background: on ? `color-mix(in oklab, ${c} 12%, var(--bg))` : "var(--card)", color: on ? c : "var(--fg)",
                    }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />{d}</button>
                  );
                })}
              </div>
            )}
            {s.key === "invite" && (
              <Field label="E-postadresser, kommaseparert">
                <textarea value={invites} onChange={e => setInvites(e.target.value)} placeholder="kokk@skuta.no, servitor@skuta.no" rows={3} style={{ ...inputStyle(false), height: "auto", padding: 14, resize: "vertical", lineHeight: 1.5 }} />
              </Field>
            )}
            {s.key === "done" && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, borderRadius: 14, background: "var(--orange-soft)", border: "1px solid rgba(249,115,22,0.2)" }}>
                <span style={{ width: 38, height: 38, borderRadius: "50%", background: "#f97316", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Instrument Serif, serif", fontSize: 22, flexShrink: 0 }}>b</span>
                <span style={{ fontSize: 14, color: "var(--fg)", lineHeight: 1.5 }}><strong>Botsson</strong> har satt opp 6 standardrutiner og 3 sjekklister for {company}. Klar når du er.</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 28, maxWidth: 480 }}>
            {i > 0 && <button onClick={() => setI(i - 1)} style={ghostBtn}>Tilbake</button>}
            <div style={{ flex: 1 }} />
            {s.key === "invite" && <button onClick={next} style={linkText}>Hopp over</button>}
            <div style={{ width: 200 }}><PrimaryBtn onClick={() => canNext && next()} disabled={!canNext}>{i === WIZ_STEPS.length - 1 ? "Gå til arbeidsplassen" : "Neste"} {canNext && AI.arrow}</PrimaryBtn></div>
          </div>
        </div>
      </div>
    );
  }

  // =================== ROOT FLOW ===================
  function AuthFlow({ onComplete, platform = "web" }) {
    const [step, setStep] = useState("welcome");
    const store = useRef({});
    const go = setStep;
    // brand tagline per step
    const tagline = step === "signup" ? "Start en ny arbeidsplass på minutter." :
      step === "otp" ? "Vi bekrefter at det er deg." :
      step === "workspace" ? "Én konto. Flere arbeidsplasser." :
      "Employee readiness, bygget for skiftene som faktisk skjer.";

    const showSplit = platform === "web" && step !== "onboarding";

    let content;
    if (step === "welcome") content = <WelcomeStep go={go} platform={platform} />;
    else if (step === "login") content = <LoginStep go={go} platform={platform} />;
    else if (step === "signup") content = <SignupStep go={go} platform={platform} store={store} />;
    else if (step === "otp") content = <OtpStep go={go} platform={platform} next={() => go(store.current.company ? "onboarding" : "workspace")} />;
    else if (step === "workspace") content = <WorkspaceStep platform={platform} finish={onComplete} />;
    else if (step === "onboarding") content = <OnboardingStep platform={platform} store={store} finish={onComplete} />;

    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {showSplit && <BrandPanel tagline={tagline} platform={platform} />}
          {content}
        </div>
      </div>
    );
  }

  // shared styles
  const ghostBtn = { width: "100%", height: 48, borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--fg)", fontSize: 14.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" };
  const linkBack = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 4, fontFamily: "inherit" };
  const linkText = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--orange-dark, #c2410c)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 };
  const errBox = { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(231,0,11,0.08)", border: "1px solid rgba(231,0,11,0.2)", color: "var(--error)", fontSize: 13, marginTop: 4 };

  window.AuthFlow = AuthFlow;
})();
