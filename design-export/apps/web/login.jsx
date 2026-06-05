// =============================================================================
// Smartout — Login (Nordic Split). Choreographed two-panel auth.
// Modes: login · signup · navigating (signup→/join hype) · logging-in (success).
// Faithful to the framer-motion page.tsx: one thing at a time, sequential.
// "Logg inn" transports into the web app (Smartout Web Version 1.html).
// =============================================================================
(function () {
  const { useState, useEffect, useRef, useCallback } = React;
  const APP_URL = "Smartout Web Version 1.html";

  // ───────── brand assets (recreated as SVG — no logo file in project) ─────────
  function Mark({ light }) {
    // rounded-square tile + a bold swirl glyph (Smartout spiral)
    const tile = light ? "#fff" : "var(--brand-orange)";
    const glyph = light ? "#241108" : "#fff";
    return (
      <svg className="lg-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="19" fill={tile} />
        <path d="M41.5 24.5c-2.2-3.2-6-5-10-4.6-5.6.5-9.8 5.2-9.5 10.6.2 4.4 3.8 7.9 8.2 7.9 3.3 0 6-2.5 6.2-5.7.1-2.4-1.6-4.5-3.9-4.8-1.7-.2-3.3.9-3.7 2.5"
          stroke={glyph} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="42.2" cy="22.6" r="3.1" fill={glyph} />
      </svg>
    );
  }
  function Wordmark({ light }) {
    return (
      <svg className="lg-wordmark" viewBox="0 0 132 15" fill="none" aria-label="Smartout">
        <text x="0" y="12" fill={light ? "#fff" : "var(--foreground)"} fontFamily="Geist, sans-serif"
          fontSize="15" fontWeight="700" letterSpacing="3.2">SMARTOUT</text>
      </svg>
    );
  }
  function GoogleIcon() {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    );
  }
  const I = {
    mail: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
    lock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
    eye: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>,
    eyeOff: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18" /><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" /><path d="M9.4 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.3 4.1M6.2 6.2A18 18 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 3.3-.5" /></svg>,
    arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>,
  };

  // ───────── OTP 6-digit input ─────────
  function OtpInput({ onComplete }) {
    const [vals, setVals] = useState(["", "", "", "", "", ""]);
    const refs = useRef([]);
    const set = (i, v) => {
      v = v.replace(/\D/g, "").slice(-1);
      const next = vals.slice(); next[i] = v; setVals(next);
      if (v && i < 5) refs.current[i + 1] && refs.current[i + 1].focus();
      if (next.every((x) => x !== "")) onComplete(next.join(""));
    };
    const key = (i, e) => {
      if (e.key === "Backspace" && !vals[i] && i > 0) refs.current[i - 1] && refs.current[i - 1].focus();
    };
    const paste = (e) => {
      const d = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6).split("");
      if (!d.length) return;
      e.preventDefault();
      const next = ["", "", "", "", "", ""].map((_, i) => d[i] || "");
      setVals(next);
      const last = Math.min(d.length, 6) - 1;
      refs.current[last] && refs.current[last].focus();
      if (d.length >= 6) onComplete(next.join(""));
    };
    return (
      <div className="lg-otp-boxes" onPaste={paste}>
        {vals.map((v, i) => (
          <input key={i} ref={(el) => (refs.current[i] = el)} className={"lg-otp-box" + (v ? " filled" : "")}
            inputMode="numeric" maxLength={1} value={v} aria-label={"Siffer " + (i + 1)}
            onChange={(e) => set(i, e.target.value)} onKeyDown={(e) => key(i, e)} />
        ))}
      </div>
    );
  }

  // ───────── main ─────────
  function Login() {
    const [mode, setMode] = useState("login");          // login | signup | navigating | logging-in
    const [phase, setPhase] = useState("idle");          // idle | out  (content transition)
    const pendingRef = useRef(null);
    const [firstLoad, setFirstLoad] = useState(true);

    const [authMethod, setAuthMethod] = useState("password"); // password | otp
    const [otpEmail, setOtpEmail] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [navStep, setNavStep] = useState(0);

    // first-load entrance only once
    useEffect(() => { const t = setTimeout(() => setFirstLoad(false), 1600); return () => clearTimeout(t); }, []);

    // choreographed content swap (login↔signup): fade current out, then swap
    const switchMode = useCallback((next) => {
      pendingRef.current = next;
      setPhase("out");
      setTimeout(() => {
        setMode(pendingRef.current);
        setError(null);
        setPhase("idle");
      }, 300);
    }, []);

    // navigating hype sequence → enter app
    useEffect(() => {
      if (mode !== "navigating") return;
      const delays = [1500, 1500, 1500, 1300];
      if (navStep < delays.length) {
        const t = setTimeout(() => setNavStep((s) => s + 1), delays[navStep]);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => { window.location.href = APP_URL; }, 200);
      return () => clearTimeout(t);
    }, [mode, navStep]);

    // logging-in → transport into the app
    useEffect(() => {
      if (mode !== "logging-in") return;
      const t = setTimeout(() => { window.location.href = APP_URL; }, 1900);
      return () => clearTimeout(t);
    }, [mode]);

    const enterApp = () => { setError(null); setMode("logging-in"); };

    const submitPassword = (e) => {
      e.preventDefault();
      if (!email.includes("@")) { setError("Skriv inn en gyldig e-postadresse."); return; }
      setLoading(true);
      setTimeout(enterApp, 650); // simulate auth
    };
    const startSignup = () => { setNavStep(0); setMode("navigating"); };

    const isSignup = mode === "signup";
    const isNavigating = mode === "navigating";
    const isLoggingIn = mode === "logging-in";
    const rootCls = [
      "lg-root",
      isSignup ? "is-signup" : "",
      isNavigating ? "is-navigating" : "",
      isLoggingIn ? "is-logging-in" : "",
      phase === "out" ? "swap-out" : "",
    ].filter(Boolean).join(" ");

    const enterCls = firstLoad ? "lg-enter" : "";

    return (
      <div className={rootCls}>
        <div className="lg-noise" />

        {/* ───────── BRAND PANEL ───────── */}
        <div className={"lg-brand" + (isLoggingIn ? " lg-brand-pulse" : "")}>
          <div className="lg-brand-bg" />
          <div className="lg-brand-orbs" />
          <div className="lg-brand-deep" />
          <div className="lg-brand-grain" />
          <div className="lg-brand-inner">
            <div className={"lg-logo" + (firstLoad ? " lg-enter-logo" : "")}>
              <Mark light />
              <Wordmark light />
            </div>

            <div className={"lg-brand-mid" + (firstLoad && mode === "login" ? " lg-enter-brand" : "")}>
              {mode === "login" && (
                <React.Fragment>
                  <h2 className="lg-tagline">Teamet ditt,<br /><span className="accent">klar fra dag en.</span></h2>
                  <p className="lg-sub">Alt du trenger for opplæring, drift og utvikling — samlet i ett system.</p>
                </React.Fragment>
              )}
              {isSignup && (
                <React.Fragment>
                  <h2 className="lg-tagline">La oss bygge<br /><span className="accent">teamet ditt</span><br />sammen.</h2>
                  <p className="lg-sub">Sett opp arbeidsflaten din på minutter. Inviter laget når du er klar.</p>
                </React.Fragment>
              )}
              {isNavigating && (
                <h2 className="lg-tagline">Da setter vi<br /><span className="accent">i gang.</span></h2>
              )}
              {isLoggingIn && (
                <React.Fragment>
                  <h2 className="lg-tagline">Velkommen tilbake.</h2>
                  <p className="lg-sub" style={{ color: "rgba(255,255,255,.4)" }}>Dashbordet ditt er klart.</p>
                </React.Fragment>
              )}
            </div>

            <p className="lg-copy">© 2026 Smartout AS</p>
          </div>
        </div>

        {/* ───────── FORM PANEL ───────── */}
        <div className="lg-form">
          <div className="lg-edge" />
          <div className="lg-form-mobilelogo"><Mark /><span style={{ width: 11 }} /><Wordmark /></div>

          <div className={"lg-content " + enterCls}>
            {/* ── LOGIN ── */}
            {mode === "login" && (
              <React.Fragment>
                <div className="lg-head lg-stag">
                  <h1 className="lg-h1">Velkommen tilbake</h1>
                  <p className="lg-subtitle">Logg inn for å fortsette til Smartout.</p>
                </div>

                <div className="lg-tabs lg-stag">
                  <button type="button" className={"lg-tab" + (authMethod === "password" ? " on" : "")}
                    onClick={() => { setAuthMethod("password"); setOtpEmail(false); setError(null); }}>E-post og passord</button>
                  <button type="button" className={"lg-tab" + (authMethod === "otp" ? " on" : "")}
                    onClick={() => { setAuthMethod("otp"); setError(null); }}>Engangskode</button>
                </div>

                {error && <div className="lg-error lg-stag">{error}</div>}

                {authMethod === "password" && (
                  <React.Fragment>
                    <button type="button" className="lg-google lg-stag" onClick={enterApp}>
                      <GoogleIcon /> Fortsett med Google
                    </button>
                    <div className="lg-divider lg-stag"><span>eller</span></div>
                    <form className="lg-stag" onSubmit={submitPassword}>
                      <div className="lg-field">
                        <div className="lg-labelrow"><label className="lg-label" htmlFor="email">E-post</label></div>
                        <div className="lg-inputwrap">
                          <span className="lg-ic">{I.mail}</span>
                          <input id="email" className="lg-input" type="email" autoComplete="email" placeholder="din@epost.no"
                            value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                      </div>
                      <div className="lg-field">
                        <div className="lg-labelrow">
                          <label className="lg-label" htmlFor="password">Passord</label>
                          <a className="lg-forgot" href="#" onClick={(e) => e.preventDefault()}>Glemt passord?</a>
                        </div>
                        <div className="lg-inputwrap">
                          <span className="lg-ic">{I.lock}</span>
                          <input id="password" className="lg-input" type={showPw ? "text" : "password"} autoComplete="current-password"
                            placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                          <button type="button" className="lg-eye" aria-label="Vis passord" onClick={() => setShowPw((s) => !s)}>{showPw ? I.eyeOff : I.eye}</button>
                        </div>
                      </div>
                      <button type="submit" className="lg-cta" disabled={loading}>{loading ? "Logger inn…" : "Logg inn"}</button>
                    </form>
                  </React.Fragment>
                )}

                {authMethod === "otp" && (
                  <div className="lg-stag">
                    <p className="lg-otp-hint">Skriv inn den 6-sifrede koden vi sendte deg.</p>
                    <OtpInput onComplete={() => setTimeout(enterApp, 250)} />
                    {otpEmail ? (
                      <div className="lg-otp-emailblock">
                        <div className="lg-inputwrap">
                          <span className="lg-ic">{I.mail}</span>
                          <input className="lg-input" type="email" placeholder="din@epost.no" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <button type="button" className="lg-cta" disabled={!email.includes("@")} onClick={() => setOtpEmail(false)}>Send kode</button>
                      </div>
                    ) : (
                      <button type="button" className="lg-otp-resend" onClick={() => setOtpEmail(true)}>Send ny kode</button>
                    )}
                  </div>
                )}

                <p className="lg-foot lg-stag">Har du ikke konto?{" "}
                  <button type="button" className="lg-link" onClick={() => switchMode("signup")}>Opprett konto</button>
                </p>
              </React.Fragment>
            )}

            {/* ── SIGNUP CTA ── */}
            {isSignup && (
              <React.Fragment>
                <div className="lg-head lg-stag">
                  <h1 className="lg-h1">Start gratis i dag</h1>
                  <p className="lg-subtitle">Sett opp arbeidsflaten din på minutter.<br />Ingen kort nødvendig.</p>
                </div>
                <button type="button" className="lg-cta lg-stag" onClick={startSignup} style={{ marginTop: 0 }}>Start registrering {I.arrow}</button>
                <div className="lg-divider lg-stag"><span>eller</span></div>
                <button type="button" className="lg-google lg-stag" onClick={startSignup}><GoogleIcon /> Registrer med Google</button>
                <p className="lg-foot lg-stag">Har du allerede konto?{" "}
                  <button type="button" className="lg-link" onClick={() => switchMode("login")}>Logg inn</button>
                </p>
              </React.Fragment>
            )}

            {/* ── NAVIGATING (signup hype) ── */}
            {isNavigating && (
              <div className="lg-stage">
                {navStep < 3 ? (
                  <React.Fragment>
                    <div className="lg-spinner"><span className="ring" /><span className="arc" /></div>
                    <h2>Vi gjør alt klart</h2>
                    <div className="step" key={navStep}>
                      {navStep === 0 && "Setter opp arbeidsflaten din…"}
                      {navStep === 1 && "Henter malene dine…"}
                      {navStep === 2 && "Nesten klar…"}
                    </div>
                  </React.Fragment>
                ) : (
                  <div className="lg-check">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
              </div>
            )}

            {/* ── LOGGING IN ── */}
            {isLoggingIn && (
              <div className="lg-stage">
                <div className="lg-spinner sm"><span className="ring" /><span className="arc" /></div>
                <p className="spin-cap">Logger deg inn…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<Login />);
})();
