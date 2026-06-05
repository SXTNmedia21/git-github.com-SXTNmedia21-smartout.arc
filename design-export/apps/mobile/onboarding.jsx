// =============================================================================
// Smartout Mobile — LOGIN & ONBOARDING flow (clickable prototype)
// Continues the mobile design language (mobile.css + auth.css + shared tokens).
// Copy + flow grounded in the real repo: SXTNmedia21/smartout.ai
//   apps/mobile/app/(auth)/{welcome,verify,invite/*,workspace-select,pending}.tsx
//   + src/components/auth/{InviteEntry,WorkspaceSearch}.tsx
// Polished + extended per brief: distinct magic-link-sent screen, richer
// request-access form, invitation context header (inviter+role), admin PIN flow,
// and explicit loading / error / empty / pending / success states.
// =============================================================================
const { useState, useEffect, useRef, useCallback } = React;

/* ---------------- icons ---------------- */
const I = {
  back:'<polyline points="15 18 9 12 15 6"/>',
  chevR:'<polyline points="9 18 15 12 9 6"/>',
  mail:'<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 7l9 6 9-6"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="M3 3l18 18"/><path d="M10.6 10.6a3 3 0 0 0 4 4"/><path d="M9.4 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.3 4M6.6 6.6A16 16 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 2.7-.4"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  checkBig:'<circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 16 9.5"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
  send:'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  search:'<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
  building:'<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01"/><path d="M10 21v-3a2 2 0 0 1 4 0v3"/>',
  mappin:'<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  at:'<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  shield:'<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
  shieldCheck:'<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><polyline points="9 12 11 14 15 10"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2"/>',
  ticket:'<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h.01M21 17v4h-4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  arrowR:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  list:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  backspace:'<path d="M21 5H8.5L2 12l6.5 7H21a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M16 9l-5 6M11 9l5 6"/>',
  calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};
function Ic({ n, s = 22, c = 'currentColor', sw = 2, style }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={style} dangerouslySetInnerHTML={{ __html: I[n] || '' }} />;
}
function GoogleG({ s = 20 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.06-1.4-.18-2.04H12v3.86h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.74 2.96-4.3 2.96-7.34z"/>
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.06v2.58A10 10 0 0 0 12 22z"/>
      <path fill="#FBBC05" d="M6.42 13.92a6 6 0 0 1 0-3.84V7.5H3.06a10 10 0 0 0 0 9z"/>
      <path fill="#EA4335" d="M12 6.04c1.46 0 2.78.5 3.82 1.48l2.84-2.84A10 10 0 0 0 3.06 7.5l3.36 2.58C7.2 7.8 9.4 6.04 12 6.04z"/>
    </svg>
  );
}

const cls = (...x) => x.filter(Boolean).join(' ');

/* ---------------- sample data (grounded in the cast/world) ---------------- */
const INVITE = { inviter: 'Maria A.', role: 'Servitør', workspace: 'Bistro Nord', start: '1. juli 2026', dept: 'Sal', accent: 'oklch(0.62 0.16 40)' };
const WORKSPACES = [
  { id: 'bn', name: 'Bistro Nord', meta: 'Oslo · Nord Gruppen', accent: 'oklch(0.62 0.16 40)', letter: 'B' },
  { id: 'cs', name: 'Café Skuta', meta: 'Bergen · Restaurant', accent: 'oklch(0.6 0.15 180)', letter: 'C' },
  { id: 'km', name: 'Kafé Mølla', meta: 'Trondheim · Bakeri', accent: 'oklch(0.55 0.2 300)', letter: 'K' },
  { id: 'ng', name: 'Nord Gruppen AS', meta: 'Konsern · 4 steder', accent: 'oklch(0.62 0.16 85)', letter: 'N' },
];
const MY_WORKSPACES = [
  { id: 'bn', name: 'Bistro Nord', role: 'Servitør', accent: 'oklch(0.62 0.16 40)', letter: 'B', meta: 'Sist åpnet · 2 min siden' },
  { id: 'cs', name: 'Café Skuta', role: 'Leder', accent: 'oklch(0.6 0.15 180)', letter: 'C', meta: 'Sist åpnet · 3 dager siden' },
];
const ADMIN_PIN = '4821';

/* ---------------- shared bits ---------------- */
function Mark({ s = 26, color = '#fff' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M16.5 7.2C15 5.6 12.6 5 10.6 6.1 8.2 7.4 7.6 10.6 9.4 12.6c1.6 1.8 4.6 2 6 .2" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M7.5 16.8C9 18.4 11.4 19 13.4 17.9c2.4-1.3 3-4.5 1.2-6.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity="0.75"/>
    </svg>
  );
}
function Top({ onBack, steps, step, onSkip, skipLabel = 'Hopp over' }) {
  return (
    <div className="a-top">
      {onBack ? <button className="a-back" onClick={onBack} aria-label="Tilbake"><Ic n="back" s={22} /></button> : <span style={{ width: 40 }} />}
      {steps ? <div className="a-steps">{Array.from({ length: steps }).map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div> : null}
      {onSkip ? <button className="a-skip" onClick={onSkip}>{skipLabel}</button> : <span style={{ width: 40, marginLeft: steps ? 0 : 'auto' }} />}
    </div>
  );
}
function Field({ label, icon, value, onChange, placeholder, type = 'text', err, hint, locked, autoFocus, right }) {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  return (
    <div className="a-field">
      {label && <label>{label}</label>}
      <div className={cls('a-input', err && 'err', locked && 'locked')}>
        {icon && <Ic n={icon} s={18} />}
        <input
          type={isPw && !show ? 'password' : type === 'password' ? 'text' : type}
          value={value} placeholder={placeholder} disabled={locked} autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)} inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : 'text'}
          autoCapitalize="none" autoCorrect="off" />
        {right}
        {isPw && <button className="a-eye" onClick={() => setShow(s => !s)} tabIndex={-1}><Ic n={show ? 'eyeOff' : 'eye'} s={18} /></button>}
      </div>
      {err && <div className="a-fieldnote err"><Ic n="alert" s={13} /> {err}</div>}
      {hint && !err && <div className="a-fieldnote hint">{hint}</div>}
    </div>
  );
}
function Btn({ children, onClick, variant = 'primary', loading, disabled, icon, block = true }) {
  return (
    <button className={cls('m-btn', 'm-btn-' + (variant === 'primary' ? 'primary' : variant === 'ghost' ? 'ghost' : 'clear'), block && 'm-btn-block')}
      style={variant === 'primary' ? { boxShadow: 'var(--shadow-cta-md, 0 4px 14px -4px color-mix(in oklab, var(--orange) 80%, transparent))', height: 52 } : { height: variant === 'clear' ? 46 : 52 }}
      onClick={loading || disabled ? undefined : onClick} disabled={disabled}>
      {loading ? <span className={cls('a-spin', variant !== 'primary' && 'dark')} /> : <>{icon}{children}</>}
    </button>
  );
}
function OtpBoxes({ value, len = 6 }) {
  return (
    <div className="a-otp">
      {Array.from({ length: len }).map((_, i) => (
        <div key={i} className={cls('d', i < value.length && 'on', i === value.length && 'cur')}>
          {value[i] || (i === value.length ? <span className="caret" /> : '')}
        </div>
      ))}
    </div>
  );
}

/* timer hook for resend */
function useCountdown(start) {
  const [n, setN] = useState(start);
  useEffect(() => { if (n <= 0) return; const t = setTimeout(() => setN(n - 1), 1000); return () => clearTimeout(t); }, [n]);
  return [n, () => setN(start)];
}

/* =========================================================================
   SCREENS
   ========================================================================= */

function Welcome({ nav }) {
  return (
    <div className="a-screen">
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <div className="a-brand">
          <span className="a-mark"><Mark s={32} /></span>
          <div className="a-wordmark">Smartout</div>
        </div>
        <h1 className="a-h1">Velkommen.</h1>
        <p className="a-lead" style={{ maxWidth: 280, margin: '9px auto 0' }}>Kom i gang med arbeidsplassen din — på ett sted.</p>

        <div className="a-choices" style={{ marginTop: 26, textAlign: 'left' }}>
          <button className="a-choice primary" onClick={() => nav('login')}>
            <span className="a-choice-ic"><Ic n="arrowR" s={22} /></span>
            <span className="a-choice-body">
              <span className="a-choice-t">Logg inn eller opprett konto</span>
              <span className="a-choice-s">E-post, Google eller engangskode</span>
            </span>
            <span className="a-choice-go"><Ic n="chevR" s={20} /></span>
          </button>
          <button className="a-choice" onClick={() => nav('inviteEntry')}>
            <span className="a-choice-ic"><Ic n="ticket" s={22} /></span>
            <span className="a-choice-body">
              <span className="a-choice-t">Jeg har en invitasjon</span>
              <span className="a-choice-s">Åpne lenken du fikk fra din leder</span>
            </span>
            <span className="a-choice-go"><Ic n="chevR" s={20} /></span>
          </button>
          <button className="a-choice" onClick={() => nav('search')}>
            <span className="a-choice-ic"><Ic n="search" s={20} /></span>
            <span className="a-choice-body">
              <span className="a-choice-t">Finn min arbeidsplass</span>
              <span className="a-choice-s">Søk etter arbeidsplassen din</span>
            </span>
            <span className="a-choice-go"><Ic n="chevR" s={20} /></span>
          </button>
        </div>

        <div className="a-admin-row">
          <button onClick={() => nav('adminChoice')}><Ic n="shield" s={15} /> Admin-tilgang</button>
        </div>
      </div>
      <div className="a-foot">
        <div className="a-foot-note">Ved å fortsette godtar du våre <a>vilkår</a> og <a>personvern</a>.<br />© 2026 Smartout AS</div>
      </div>
    </div>
  );
}

function Login({ nav }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = () => {
    setErr(''); setBanner('');
    if (!email.includes('@')) { setErr('Skriv inn en gyldig e-postadresse'); return; }
    if (!pw) { setBanner('Skriv inn passord'); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); setBanner('Feil e-post eller passord.'); }, 1100);
  };
  return (
    <div className="a-screen">
      <Top onBack={() => nav('welcome')} />
      <div className="a-body">
        <h1 className="a-h1" style={{ textAlign: 'center' }}>Velkommen tilbake</h1>
        <p className="a-lead" style={{ textAlign: 'center' }}>Logg inn for å fortsette til Smartout.</p>

        <div style={{ marginTop: 22 }} />
        {banner && <div style={{ background: 'color-mix(in oklab, var(--error) 9%, transparent)', border: '1px solid color-mix(in oklab, var(--error) 28%, transparent)', color: 'var(--error)', borderRadius: 13, padding: '11px 14px', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>{banner}</div>}

        <button className="a-social" onClick={() => nav('loadingGoogle')}><GoogleG s={20} /> Fortsett med Google</button>
        <div className="a-or">eller</div>

        <Field label="E-post" icon="mail" type="email" value={email} onChange={v => { setEmail(v); setErr(''); }} placeholder="din@epost.no" err={err} autoFocus />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: -6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Passord</span>
          <button className="a-link" style={{ fontSize: 12.5 }} onClick={() => nav('reset')}>Glemt passord?</button>
        </div>
        <Field icon="lock" type="password" value={pw} onChange={v => { setPw(v); setBanner(''); }} placeholder="Passord" />

        <div style={{ marginTop: 18 }}><Btn loading={loading} onClick={submit}>Logg inn</Btn></div>
        <button className="a-link" style={{ display: 'block', textAlign: 'center', width: '100%', margin: '16px 0 4px', fontSize: 14 }} onClick={() => nav('sendCode')}>Logg inn med kode</button>
      </div>
      <div className="a-foot">
        <div className="a-foot-note">Har du ikke konto? <a onClick={() => nav('inviteEntry')}>Bruk invitasjon</a></div>
      </div>
    </div>
  );
}

function SendCode({ nav }) {
  const [tab, setTab] = useState('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  // SMS path stays on THIS screen: send → punch the code in right here → resend if needed.
  const [stage, setStage] = useState('enter'); // enter | code
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cd, resetCd] = useCountdown(30);
  const dest = '+47 ' + phone;

  const send = () => {
    setErr('');
    if (tab === 'phone') {
      if (phone.replace(/\D/g, '').length < 8) { setErr('Skriv inn et gyldig norsk mobilnummer (8 siffer)'); return; }
      setLoading(true); setTimeout(() => { setLoading(false); setStage('code'); setCode(''); resetCd(); }, 900);
    } else {
      if (!email.includes('@')) { setErr('Skriv inn en gyldig e-postadresse'); return; }
      setLoading(true); setTimeout(() => { setLoading(false); nav('magicSent', { email }); }, 900);
    }
  };

  const submitCode = (val) => {
    const v = val != null ? val : code;
    if (v.length < 6 || verifying) return;
    setVerifying(true);
    setTimeout(() => {
      if (v === '000000') { setVerifying(false); setCodeErr(true); setCode(''); }      // demo: 000000 = wrong
      else { setVerifying(false); nav('loadingFinish', { to: 'workspaceSelect' }); }
    }, 900);
  };
  const resend = () => { setCode(''); setCodeErr(false); resetCd(); };

  // capture digits straight into the inline boxes while the code stage is open
  const onKey = useCallback((e) => {
    if (stage !== 'code' || verifying) return;
    if (e.key === 'Backspace') { setCode(c => c.slice(0, -1)); setCodeErr(false); }
    else if (/^\d$/.test(e.key)) {
      setCode(c => {
        if (c.length >= 6) return c;
        const next = c + e.key; setCodeErr(false);
        if (next.length === 6) submitCode(next);
        return next;
      });
    }
  }, [stage, verifying, code]);
  useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onKey]);

  return (
    <div className="a-screen">
      <Top onBack={() => stage === 'code' ? setStage('enter') : nav('login')} />
      {stage === 'enter' ? (
        <>
          <div className="a-body">
            <h1 className="a-h1" style={{ textAlign: 'center' }}>Logg inn med kode</h1>
            <p className="a-lead" style={{ textAlign: 'center' }}>Skriv inn telefon eller e-post, så sender vi en innloggingskode — ingen passord.</p>

            <div className="m-seg" style={{ alignSelf: 'center', marginTop: 20 }}>
              <button className={tab === 'phone' ? 'is-active' : ''} onClick={() => { setTab('phone'); setErr(''); }}>SMS</button>
              <button className={tab === 'email' ? 'is-active' : ''} onClick={() => { setTab('email'); setErr(''); }}>E-post</button>
            </div>

            <div style={{ marginTop: 14 }}>
              {tab === 'phone' ? (
                <div className="a-field">
                  <label>Mobilnummer</label>
                  <div className={cls('a-input', err && 'err')}>
                    <span style={{ fontWeight: 600, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>+47</span>
                    <input value={phone} onChange={e => { setPhone(e.target.value); setErr(''); }} placeholder="12 34 56 78" inputMode="tel" autoFocus />
                  </div>
                  {err && <div className="a-fieldnote err"><Ic n="alert" s={13} /> {err}</div>}
                  <div className="a-fieldnote hint">Vi sender en 6-sifret kode hit. Du taster den inn på neste linje.</div>
                </div>
              ) : (
                <Field label="E-postadresse" icon="mail" type="email" value={email} onChange={v => { setEmail(v); setErr(''); }} placeholder="din@epost.no" err={err} hint="Vi sender deg en innloggingslenke." autoFocus />
              )}
            </div>
          </div>
          <div className="a-foot"><Btn loading={loading} onClick={send}>Send kode</Btn></div>
        </>
      ) : (
        <>
          <div className="a-body" style={{ textAlign: 'center' }}>
            <span className="a-sentchip"><Ic n="check" s={13} sw={3} /> Kode sendt</span>
            <h1 className="a-h1" style={{ marginTop: 14 }}>Skriv inn koden</h1>
            <p className="a-lead">Vi sendte en 6-sifret kode til <b style={{ color: 'var(--fg)' }}>{dest}</b>. Tast den inn her.</p>
            <div style={{ marginTop: 24 }} onClick={() => document.getElementById('sc-otp')?.focus()}>
              <OtpBoxes value={code} />
            </div>
            <input id="sc-otp" inputMode="numeric" value={code} onChange={() => { }} style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }} autoFocus />
            {codeErr && <div className="a-fieldnote err" style={{ justifyContent: 'center', marginTop: 16 }}><Ic n="alert" s={14} /> Feil kode. Sjekk SMS-en og prøv igjen.</div>}
            {verifying && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}><span className="a-spin dark" /></div>}
            <div style={{ marginTop: 22, fontSize: 13, color: 'var(--muted)' }}>
              {cd > 0 ? <>Fikk du ikke kode? Send på nytt om {cd}s</> : <a className="a-link" onClick={resend}>Send koden på nytt</a>}
            </div>
            <button className="a-link" style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }} onClick={() => setStage('enter')}>Endre nummer</button>
          </div>
          <div className="a-foot"><Btn loading={verifying} disabled={code.length < 6} onClick={() => submitCode()}>Logg inn</Btn></div>
        </>
      )}
    </div>
  );
}

function MagicSent({ nav, params }) {
  const [cd, reset] = useCountdown(30);
  return (
    <div className="a-screen">
      <Top onBack={() => nav('sendCode')} />
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <span className="a-state-ic brand"><span className="ring" /><Ic n="mail" s={42} /></span>
        <h2 className="a-state-h">Sjekk e-posten din</h2>
        <p className="a-state-p">Vi sendte en innloggingslenke til <b>{params.email || 'din@epost.no'}</b>. Åpne den <b>på denne enheten</b> for å logge inn.</p>
        <span className="a-mailchip"><Ic n="mail" s={15} /> {params.email || 'din@epost.no'}</span>
      </div>
      <div className="a-foot">
        <Btn icon={<Ic n="mail" s={18} />} onClick={() => nav('loadingFinish', { to: 'home' })}>Åpne e-postapp</Btn>
        <button className="a-link" style={{ textAlign: 'center', fontSize: 13.5, padding: 6 }} onClick={() => nav('otp', { via: 'email', dest: params.email })}>Har du en kode i stedet? Skriv den inn</button>
        <div className="a-foot-note">
          {cd > 0 ? <>Send på nytt om {cd}s</> : <a onClick={reset}>Send lenken på nytt</a>} · <a onClick={() => nav('sendCode')}>Endre e-post</a>
        </div>
      </div>
    </div>
  );
}

function Otp({ nav, params }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cd, reset] = useCountdown(30);
  const onKey = useCallback((e) => {
    if (loading) return;
    if (e.key === 'Backspace') { setCode(c => c.slice(0, -1)); setErr(false); }
    else if (/^\d$/.test(e.key)) {
      setCode(c => {
        if (c.length >= 6) return c;
        const next = c + e.key; setErr(false);
        if (next.length === 6) {
          setLoading(true);
          setTimeout(() => {
            // demo: 123456 = wrong, anything else ok
            if (next === '000000') { setLoading(false); setErr(true); setCode(''); }
            else { setLoading(false); nav('loadingFinish', { to: params.to || 'workspaceSelect' }); }
          }, 900);
        }
        return next;
      });
    }
  }, [loading, nav, params]);
  useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onKey]);
  const dest = params.dest || 'din@epost.no';
  return (
    <div className="a-screen" onClick={() => { }}>
      <Top onBack={() => nav(params.via === 'sms' ? 'sendCode' : 'magicSent', params)} />
      <div className="a-body" style={{ textAlign: 'center' }}>
        <h1 className="a-h1">Skriv inn koden</h1>
        <p className="a-lead">Vi sendte en 6-sifret kode til <b style={{ color: 'var(--fg)' }}>{dest}</b>.</p>
        <div style={{ marginTop: 26 }} onClick={() => document.getElementById('otp-hidden')?.focus()}>
          <OtpBoxes value={code} />
        </div>
        <input id="otp-hidden" inputMode="numeric" value={code} onChange={() => { }} style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }} autoFocus />
        {err && <div className="a-fieldnote err" style={{ justifyContent: 'center', marginTop: 16 }}><Ic n="alert" s={14} /> Feil kode. Sjekk {params.via === 'sms' ? 'SMS-en' : 'e-posten'} og prøv igjen.</div>}
        {loading && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}><span className="a-spin dark" /></div>}
        <div style={{ marginTop: 22, fontSize: 13, color: 'var(--muted)' }}>
          {cd > 0 ? <>Fikk du ikke kode? Send på nytt om {cd}s</> : <a className="a-link" onClick={reset}>Fikk du ikke kode? Send på nytt</a>}
        </div>
        <div style={{ marginTop: 8 }}><span style={{ fontSize: 11.5, color: 'var(--muted-soft)' }}>Tips: tast hva som helst — prøv «000000» for feil-tilstand</span></div>
      </div>
    </div>
  );
}

function Reset({ nav }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  if (sent) return (
    <div className="a-screen">
      <Top onBack={() => nav('login')} />
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <span className="a-state-ic brand"><Ic n="mail" s={42} /></span>
        <h2 className="a-state-h">Sjekk e-posten din</h2>
        <p className="a-state-p">Vi sendte en lenke til <b>{email}</b> for å tilbakestille passordet ditt.</p>
      </div>
      <div className="a-foot"><Btn variant="ghost" onClick={() => nav('login')}>Tilbake til innlogging</Btn></div>
    </div>
  );
  return (
    <div className="a-screen">
      <Top onBack={() => nav('login')} />
      <div className="a-body">
        <h1 className="a-h1" style={{ textAlign: 'center' }}>Glemt passord?</h1>
        <p className="a-lead" style={{ textAlign: 'center' }}>Skriv inn e-posten din, så sender vi en lenke for å sette et nytt.</p>
        <div style={{ marginTop: 18 }}><Field label="E-post" icon="mail" type="email" value={email} onChange={setEmail} placeholder="din@epost.no" autoFocus /></div>
      </div>
      <div className="a-foot"><Btn loading={loading} onClick={() => { if (!email.includes('@')) return; setLoading(true); setTimeout(() => { setLoading(false); setSent(true); }, 900); }}>Send lenke</Btn></div>
    </div>
  );
}

/* ---- Invitation flow ---- */
function InviteEntry({ nav }) {
  const [tok, setTok] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const check = () => {
    setErr('');
    if (!tok.trim()) { setErr('Skriv inn invitasjonskoden din'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (tok.trim().toLowerCase() === 'utløpt' || tok.trim().toLowerCase() === 'utlopt') nav('inviteError');
      else nav('inviteConfirm');
    }, 1000);
  };
  return (
    <div className="a-screen">
      <Top onBack={() => nav('welcome')} />
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <span className="a-mark sm" style={{ background: 'var(--orange-soft)' }}><Ic n="ticket" s={22} c="var(--orange)" /></span>
        <h1 className="a-h1" style={{ marginTop: 16 }}>Har du en invitasjon?</h1>
        <p className="a-lead">Skriv inn invitasjonskoden du fikk fra din leder — eller åpne lenken på denne enheten.</p>
        <div style={{ marginTop: 18, textAlign: 'left' }}>
          <Field icon="ticket" value={tok} onChange={v => { setTok(v); setErr(''); }} placeholder="f.eks. BISTRO-7K2P" err={err} autoFocus />
        </div>
        <button className="a-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, fontSize: 13.5 }} onClick={() => nav('inviteConfirm')}>
          <Ic n="qr" s={16} /> Skann QR-kode i stedet
        </button>
        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--muted-soft)' }}>Tips: skriv «utløpt» for å se feil-tilstanden</div>
      </div>
      <div className="a-foot"><Btn loading={loading} onClick={check}>Sjekk invitasjon</Btn></div>
    </div>
  );
}

function InviteConfirm({ nav }) {
  return (
    <div className="a-screen">
      <Top onBack={() => nav('inviteEntry')} />
      <div className="a-body a-center">
        <div className="a-invite-ctx">
          <span className="lg" style={{ background: INVITE.accent }}>{INVITE.workspace.charAt(0)}</span>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Du er invitert til</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1.05, color: 'var(--orange)' }}>{INVITE.workspace}</div>
          <div className="who" style={{ marginTop: 12 }}><b>{INVITE.inviter}</b> har invitert deg som <b>{INVITE.role}</b></div>
          <div className="role-pill"><span className="m-pill m-pill-info" style={{ height: 24 }}><Ic n="calendar" s={12} /> Oppstart {INVITE.start}</span></div>
        </div>
        <div className="a-summary" style={{ marginTop: 14 }}>
          <div className="a-summary-row"><span style={{ color: 'var(--muted)' }}><Ic n="briefcase" s={16} /></span><span className="k">Avdeling</span><span className="v">{INVITE.dept}</span></div>
          <div className="a-summary-row"><span style={{ color: 'var(--muted)' }}><Ic n="user" s={16} /></span><span className="k">Rolle</span><span className="v">{INVITE.role}</span></div>
          <div className="a-summary-row"><span style={{ color: 'var(--muted)' }}><Ic n="calendar" s={16} /></span><span className="k">Oppstart</span><span className="v">{INVITE.start}</span></div>
        </div>
      </div>
      <div className="a-foot">
        <Btn onClick={() => nav('inviteDetails')}>Bekreft og fortsett</Btn>
        <button className="a-link" style={{ textAlign: 'center', fontSize: 13.5, padding: 6, color: 'var(--muted)' }} onClick={() => nav('welcome')}>Dette er ikke meg</button>
      </div>
    </div>
  );
}

function InviteDetails({ nav }) {
  const [f, setF] = useState({ first: 'Kari', last: '', email: '', phone: '' });
  const [terms, setTerms] = useState(false);
  const [errs, setErrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => { setF(s => ({ ...s, [k]: v })); setErrs([]); };
  const submit = () => {
    const e = [];
    if (!f.first.trim()) e.push('Fornavn er påkrevd');
    if (!f.last.trim()) e.push('Etternavn er påkrevd');
    if (!f.email.trim() && !f.phone.trim()) e.push('E-post eller telefonnummer er påkrevd');
    if (!terms) e.push('Du må godta vilkårene');
    if (e.length) { setErrs(e); return; }
    setLoading(true); setTimeout(() => { setLoading(false); nav('loadingFinish', { to: 'home' }); }, 1100);
  };
  return (
    <div className="a-screen">
      <Top onBack={() => nav('inviteConfirm')} />
      <div className="a-body">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)' }}>{INVITE.workspace}</div>
          <h1 className="a-h1" style={{ marginTop: 6 }}>Bekreft opplysningene</h1>
          <p className="a-lead">Sjekk at informasjonen stemmer før du fortsetter.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1 }}><Field label="Fornavn" value={f.first} onChange={v => set('first', v)} placeholder="Kari" /></div>
          <div style={{ flex: 1 }}><Field label="Etternavn" value={f.last} onChange={v => set('last', v)} placeholder="Nordmann" /></div>
        </div>
        <Field label="E-post" icon="mail" type="email" value={f.email} onChange={v => set('email', v)} placeholder="kari@example.com" />
        <Field label="Telefon" icon="user" type="tel" value={f.phone} onChange={v => set('phone', v)} placeholder="+47 900 00 000" />
        <label style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginTop: 16, cursor: 'pointer' }} onClick={() => { setTerms(t => !t); setErrs([]); }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, flex: '0 0 auto', border: '2px solid ' + (terms ? 'var(--orange)' : 'var(--border-strong)'), background: terms ? 'var(--orange)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'all 150ms' }}>{terms && <Ic n="check" s={13} sw={3} />}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4 }}>Jeg godtar Smartouts <a className="a-link">vilkår</a> og <a className="a-link">personvern</a>.</span>
        </label>
        {errs.length > 0 && <div style={{ background: 'color-mix(in oklab, var(--error) 8%, transparent)', borderRadius: 12, padding: 12, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 3 }}>{errs.map((e, i) => <span key={i} style={{ color: 'var(--error)', fontSize: 13 }}>{e}</span>)}</div>}
      </div>
      <div className="a-foot"><Btn loading={loading} onClick={submit}>Opprett konto og bli med</Btn></div>
    </div>
  );
}

function InviteError({ nav }) {
  return (
    <div className="a-screen">
      <Top onBack={() => nav('inviteEntry')} />
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <span className="a-state-ic warn"><Ic n="clock" s={42} /></span>
        <h2 className="a-state-h">Lenken har utløpt</h2>
        <p className="a-state-p">Denne invitasjonen er ugyldig eller har utløpt. Be lederen din om en ny lenke.</p>
      </div>
      <div className="a-foot">
        <Btn onClick={() => nav('search')}>Finn arbeidsplassen i stedet</Btn>
        <Btn variant="clear" onClick={() => nav('welcome')}>Tilbake</Btn>
      </div>
    </div>
  );
}

/* ---- Find workplace + request access ---- */
function Search({ nav }) {
  const [q, setQ] = useState('');
  const [facet, setFacet] = useState('navn');
  const results = q.length >= 2 ? WORKSPACES.filter(w => w.name.toLowerCase().includes(q.toLowerCase()) || w.meta.toLowerCase().includes(q.toLowerCase())) : [];
  const empty = q.length >= 2 && results.length === 0;
  return (
    <div className="a-screen">
      <Top onBack={() => nav('welcome')} />
      <div className="a-body">
        <h1 className="a-h1" style={{ textAlign: 'center' }}>Finn arbeidsplassen din</h1>
        <p className="a-lead" style={{ textAlign: 'center' }}>Søk etter navn, e-postdomene eller sted.</p>
        <div style={{ marginTop: 18 }} />
        <div className="a-search">
          <Ic n="search" s={18} c="var(--muted)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Søk (min. 2 tegn)…" autoFocus />
          {q && <button onClick={() => setQ('')}><Ic n="x" s={16} c="var(--muted)" /></button>}
        </div>
        <div className="a-search-facets">
          {[['navn', 'Navn', 'building'], ['domene', 'E-postdomene', 'at'], ['sted', 'Sted', 'mappin']].map(([id, l, ic]) => (
            <button key={id} className={cls('m-pill', facet === id ? 'm-pill-warn' : 'm-pill-muted')} style={{ height: 30, padding: '0 11px', fontSize: 12, background: facet === id ? 'var(--orange-soft)' : undefined, color: facet === id ? 'var(--orange)' : undefined }} onClick={() => setFacet(id)}>
              <Ic n={ic} s={13} /> {l}
            </button>
          ))}
        </div>

        {!q && (
          <div className="a-empty-search">
            <Ic n="search" s={34} />
            <p style={{ fontSize: 13 }}>Begynn å skrive for å finne arbeidsplassen din.</p>
          </div>
        )}
        {empty && (
          <div className="a-empty-search">
            <Ic n="building" s={34} />
            <b style={{ display: 'block', color: 'var(--fg)', fontSize: 14, marginBottom: 3 }}>Ingen treff på «{q}»</b>
            <p style={{ fontSize: 13 }}>Prøv et annet søkeord, eller be lederen din om en invitasjon.</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 8 }}>
          {results.map(w => (
            <button key={w.id} className="a-ws" onClick={() => nav('request', { ws: w })}>
              <span className="a-ws-logo" style={{ background: w.accent }}>{w.letter}</span>
              <span className="a-ws-body"><span className="a-ws-t">{w.name}</span><span className="a-ws-s">{w.meta}</span></span>
              <Ic n="chevR" s={18} c="var(--muted-soft)" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Request({ nav, params }) {
  const ws = params.ws || WORKSPACES[0];
  const [f, setF] = useState({ name: '', email: '', msg: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = () => {
    if (!f.name.trim()) { setErr('Skriv inn navnet ditt'); return; }
    if (!f.email.includes('@')) { setErr('Skriv inn en gyldig e-postadresse'); return; }
    setLoading(true); setTimeout(() => { setLoading(false); nav('pending', { ws }); }, 1100);
  };
  return (
    <div className="a-screen">
      <Top onBack={() => nav('search')} />
      <div className="a-body">
        <button className="a-ws sel" style={{ marginBottom: 6 }} onClick={() => nav('search')}>
          <span className="a-ws-logo" style={{ background: ws.accent }}>{ws.letter}</span>
          <span className="a-ws-body"><span className="a-ws-t">{ws.name}</span><span className="a-ws-s">{ws.meta}</span></span>
          <span className="m-pill m-pill-ok"><Ic n="check" s={12} /> Valgt</span>
        </button>
        <h1 className="a-h1" style={{ marginTop: 14 }}>Be om tilgang</h1>
        <p className="a-lead">Lederen for <b style={{ color: 'var(--fg)' }}>{ws.name}</b> får forespørselen din og godkjenner den.</p>
        <Field label="Navn" icon="user" value={f.name} onChange={v => { setF(s => ({ ...s, name: v })); setErr(''); }} placeholder="Kari Nordmann" err={err && !f.name.trim() ? err : ''} autoFocus />
        <Field label="E-post" icon="mail" type="email" value={f.email} onChange={v => { setF(s => ({ ...s, email: v })); setErr(''); }} placeholder="kari@epost.no" err={err && f.name.trim() ? err : ''} />
        <div className="a-field">
          <label>Melding til leder <span style={{ color: 'var(--muted-soft)', fontWeight: 400 }}>(valgfritt)</span></label>
          <textarea className="a-textarea" value={f.msg} onChange={e => setF(s => ({ ...s, msg: e.target.value }))} placeholder="F.eks. «Hei, jeg starter som servitør 1. juli»" />
        </div>
        <div className="a-secure-note"><Ic n="shield" s={16} /> Vi deler bare navn og e-post med arbeidsplassen. Du blir ikke medlem før en leder godkjenner.</div>
      </div>
      <div className="a-foot"><Btn loading={loading} icon={<Ic n="send" s={17} />} onClick={submit}>Send forespørsel</Btn></div>
    </div>
  );
}

function Pending({ nav, params }) {
  const ws = params.ws || WORKSPACES[0];
  return (
    <div className="a-screen">
      <div className="a-top"><span style={{ width: 40 }} /><div className="m-modebar is-privat" style={{ margin: '0 auto' }}><Ic n="clock" s={13} /> VENTER PÅ GODKJENNING</div><span style={{ width: 40 }} /></div>
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <span className="a-state-ic warn"><span className="ring" /><Ic n="clock" s={40} /></span>
        <h2 className="a-state-h">Forespørsel sendt</h2>
        <p className="a-state-p">Din forespørsel til <b>{ws.name}</b> er sendt til administrator. Du får en melding når den er godkjent.</p>
        <p className="a-state-p" style={{ fontSize: 13, marginTop: 12 }}>Dette kan ta litt tid. Du kan lukke appen — vi varsler deg når du har fått tilgang.</p>
      </div>
      <div className="a-foot">
        <Btn variant="ghost" onClick={() => nav('loadingFinish', { to: 'home' })}>Sjekk status</Btn>
        <Btn variant="clear" onClick={() => nav('welcome')}>Logg ut</Btn>
      </div>
    </div>
  );
}

/* ---- Admin flows ---- */
function AdminChoice({ nav }) {
  return (
    <div className="a-screen a-admin-shell">
      <Top onBack={() => nav('welcome')} />
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <span className="a-mark"><Ic n="shieldCheck" s={32} c="#fff" /></span>
        <div className="a-secure-badge" style={{ marginTop: 16 }}><Ic n="lock" s={13} /> SIKKER ADMIN-TILGANG</div>
        <h1 className="a-h1" style={{ marginTop: 14 }}>Admin-tilgang</h1>
        <p className="a-lead">Du er i ferd med å gå inn i adminmodus for arbeidsplassen. Velg hvordan du vil bekrefte deg.</p>
        <div className="a-choices" style={{ marginTop: 24, textAlign: 'left' }}>
          <button className="a-choice" onClick={() => nav('adminPin')}>
            <span className="a-choice-ic"><Ic n="key" s={22} /></span>
            <span className="a-choice-body"><span className="a-choice-t">Bruk PIN-kode</span><span className="a-choice-s">Raskt — for enheten din</span></span>
            <span className="a-choice-go"><Ic n="chevR" s={20} /></span>
          </button>
          <button className="a-choice" onClick={() => nav('adminLogin')}>
            <span className="a-choice-ic"><Ic n="lock" s={20} /></span>
            <span className="a-choice-body"><span className="a-choice-t">Logg inn med passord</span><span className="a-choice-s">E-post + passord + 2-trinns</span></span>
            <span className="a-choice-go"><Ic n="chevR" s={20} /></span>
          </button>
        </div>
        <div className="a-secure-note" style={{ textAlign: 'left' }}><Ic n="shield" s={16} /> Adminmodus gir tilgang til ansatte, lønn og innstillinger. All aktivitet logges.</div>
      </div>
    </div>
  );
}

function AdminPin({ nav }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [ok, setOk] = useState(false);
  const press = (d) => {
    if (ok) return;
    if (d === 'del') { setPin(p => p.slice(0, -1)); setErr(false); return; }
    if (pin.length >= 4) return;
    const next = pin + d; setErr(false);
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === ADMIN_PIN) { setOk(true); setTimeout(() => nav('loadingFinish', { to: 'adminSuccess' }), 500); }
        else { setErr(true); setTimeout(() => { setPin(''); }, 600); }
      }, 180);
    }
  };
  return (
    <div className="a-screen a-admin-shell">
      <Top onBack={() => nav('adminChoice')} />
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <span className="a-mark sm" style={{ background: ok ? 'var(--success)' : undefined }}><Ic n={ok ? 'check' : 'key'} s={22} c="#fff" sw={ok ? 3 : 2} /></span>
        <h1 className="a-h1" style={{ marginTop: 14 }}>{ok ? 'Bekreftet' : 'Skriv inn PIN'}</h1>
        <p className="a-lead">{ok ? 'Åpner adminmodus…' : 'Tast den 4-sifrede admin-koden din.'}</p>
        <div className={cls('a-pin-dots', err && 'err')} style={{ marginTop: 24 }}>
          {[0, 1, 2, 3].map(i => <span key={i} className={cls('pd', i < pin.length && 'on')} style={ok ? { background: 'var(--success)', borderColor: 'var(--success)' } : undefined} />)}
        </div>
        {err && <div className="a-fieldnote err" style={{ justifyContent: 'center', marginTop: -8, marginBottom: 8 }}><Ic n="alert" s={13} /> Feil kode. Prøv igjen.</div>}
        <div className="a-keys" style={{ marginTop: 8 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} className="a-key" onClick={() => press(String(n))}>{n}</button>)}
          <button className="a-key fn" onClick={() => nav('adminLogin')}>Glemt?</button>
          <button className="a-key" onClick={() => press('0')}>0</button>
          <button className="a-key fn" onClick={() => press('del')}><Ic n="backspace" s={22} /></button>
        </div>
        <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--muted-soft)' }}>Demo-PIN: {ADMIN_PIN}</div>
      </div>
    </div>
  );
}

function AdminLogin({ nav }) {
  const [email, setEmail] = useState('maria@bistronord.no');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  return (
    <div className="a-screen a-admin-shell">
      <Top onBack={() => nav('adminChoice')} />
      <div className="a-body">
        <div style={{ textAlign: 'center' }}>
          <span className="a-secure-badge"><Ic n="lock" s={13} /> ADMIN</span>
          <h1 className="a-h1" style={{ marginTop: 14 }}>Logg inn som admin</h1>
          <p className="a-lead">Bekreft med e-post og passord. Vi sender en 2-trinns kode etterpå.</p>
        </div>
        <div style={{ marginTop: 18 }}>
          <Field label="E-post" icon="mail" type="email" value={email} onChange={setEmail} placeholder="din@epost.no" />
          <Field label="Passord" icon="lock" type="password" value={pw} onChange={setPw} placeholder="Passord" />
        </div>
        <div className="a-secure-note"><Ic n="shieldCheck" s={16} /> Adminpålogging krever 2-trinns bekreftelse. Du blir bedt om en engangskode i neste steg.</div>
      </div>
      <div className="a-foot"><Btn loading={loading} icon={<Ic n="lock" s={16} />} onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); nav('otp', { via: 'sms', dest: '+47 ••• ••821', to: 'adminSuccess' }); }, 1000); }}>Fortsett</Btn></div>
    </div>
  );
}

/* ---- workspace select (2+ workspaces) ---- */
function WorkspaceSelect({ nav }) {
  return (
    <div className="a-screen">
      <Top skipLabel="Logg ut" onSkip={() => nav('welcome')} />
      <div className="a-body">
        <h1 className="a-h1" style={{ textAlign: 'center' }}>Velg arbeidsplass</h1>
        <p className="a-lead" style={{ textAlign: 'center' }}>Du har tilgang til flere arbeidsplasser. Hvilken vil du åpne?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {MY_WORKSPACES.map(w => (
            <button key={w.id} className="a-ws" onClick={() => w.role === 'Leder' ? nav('adminSuccess', { ws: w }) : nav('loadingFinish', { to: 'home' })}>
              <span className="a-ws-logo" style={{ background: w.accent }}>{w.letter}</span>
              <span className="a-ws-body">
                <span className="a-ws-t">{w.name}</span>
                <span className="a-ws-s">{w.role} · {w.meta}</span>
              </span>
              <Ic n="chevR" s={18} c="var(--muted-soft)" />
            </button>
          ))}
        </div>
      </div>
      <div className="a-foot"><div className="a-foot-note">Logget inn som <b>kari@epost.no</b></div></div>
    </div>
  );
}

/* ---- loading + success ---- */
function Loading({ label }) {
  return (
    <div className="a-screen">
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><span className="a-spin dark" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>
        <p style={{ fontSize: 15, color: 'var(--muted)' }}>{label || 'Et øyeblikk…'}</p>
      </div>
    </div>
  );
}

function Success({ nav, admin }) {
  return (
    <div className="a-screen">
      <div className="a-body a-center" style={{ textAlign: 'center' }}>
        <span className={cls('a-state-ic', admin ? 'brand' : 'ok')}><span className="ring" /><Ic n={admin ? 'shieldCheck' : 'checkBig'} s={46} /></span>
        <h2 className="a-state-h">{admin ? 'Adminmodus aktivert' : 'Du er inne!'}</h2>
        <p className="a-state-p">{admin
          ? <>Du er logget inn som <b>driftsleder</b> for Bistro Nord. Husk at all aktivitet logges.</>
          : <>Velkommen til <b>Bistro Nord</b>, Kari. Vakta di starter snart — la oss komme i gang.</>}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 22, width: '100%', textAlign: 'left' }}>
          {(admin
            ? [['users', 'Se dagens bemanning'], ['list', 'Følg opp avvik og oppgaver'], ['briefcase', 'Godkjenn forespørsler']]
            : [['calendar', 'Se vaktene dine'], ['list', 'Fullfør dagens oppgaver'], ['clock', 'Stemple inn på vakt']]
          ).map(([ic, t]) => (
            <div key={t} className="a-ws" style={{ cursor: 'default' }}>
              <span className="a-ws-logo" style={{ background: 'var(--orange-soft)', color: 'var(--orange)', fontSize: 0 }}><Ic n={ic} s={20} /></span>
              <span className="a-ws-body"><span className="a-ws-t" style={{ fontSize: 14 }}>{t}</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="a-foot">
        <Btn onClick={() => window.location.assign('Smartout Mobile Version 1.html')}>Til Smartout</Btn>
        <button className="a-link" style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', padding: 6 }} onClick={() => nav('welcome')}>Start flyten på nytt</button>
      </div>
    </div>
  );
}

/* =========================================================================
   ROUTER + APP
   ========================================================================= */
const SCREENS = {
  welcome: Welcome, login: Login, sendCode: SendCode, magicSent: MagicSent, otp: Otp, reset: Reset,
  inviteEntry: InviteEntry, inviteConfirm: InviteConfirm, inviteDetails: InviteDetails, inviteError: InviteError,
  search: Search, request: Request, pending: Pending,
  adminChoice: AdminChoice, adminPin: AdminPin, adminLogin: AdminLogin,
  workspaceSelect: WorkspaceSelect, success: Success, adminSuccess: Success,
};
// grouped screen index for the preview-only screen-jump drawer
// [key, name, icon?] — first group renders numbered step chips, the rest use icons
const JUMP_GROUPS = [
  { title: 'Hovedflyt', items: [
    ['welcome', 'Velkommen'], ['login', 'Logg inn'], ['sendCode', 'Logg inn med kode'],
    ['magicSent', 'Magisk lenke sendt'], ['otp', 'Kode-verifisering'], ['workspaceSelect', 'Velg arbeidsplass'],
  ] },
  { title: 'Invitasjon', icon: 'ticket', items: [
    ['inviteEntry', 'Skriv inn kode'], ['inviteConfirm', 'Bekreft invitasjon'],
    ['inviteDetails', 'Fyll inn opplysninger'], ['inviteError', 'Invitasjon utløpt', 'alert'],
  ] },
  { title: 'Finn arbeidsplass', icon: 'search', items: [
    ['search', 'Søk'], ['request', 'Be om tilgang'], ['pending', 'Venter på godkjenning', 'clock'],
  ] },
  { title: 'Admin', icon: 'shield', items: [
    ['adminChoice', 'Admin-valg'], ['adminPin', 'PIN-kode'], ['adminLogin', 'Passord + 2-trinns'], ['adminSuccess', 'Adminmodus aktivert', 'shieldCheck'],
  ] },
  { title: 'Øvrige tilstander', icon: 'list', items: [
    ['reset', 'Glemt passord', 'mail'], ['success', 'Suksess (ansatt)', 'checkBig'],
  ] },
];

function App() {
  const [stack, setStack] = useState([{ screen: 'welcome', params: {} }]);
  const [params, setParams] = useState({});
  const [theme, setTheme] = useState('light');
  const [menu, setMenu] = useState(false);
  const cur = stack[stack.length - 1];

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const nav = useCallback((screen, p = {}) => {
    // loading interstitials
    if (screen === 'loadingGoogle') { setStack(s => [...s, { screen: '__loading', params: { label: 'Kobler til Google…', to: 'workspaceSelect', tp: {} } }]); return; }
    if (screen === 'loadingFinish') { setStack(s => [...s, { screen: '__loading', params: { label: 'Logger deg inn…', to: p.to, tp: p } }]); return; }
    setParams(p);
    setStack(s => [...s, { screen, params: p }]);
  }, []);
  const back = useCallback(() => setStack(s => s.length > 1 ? s.slice(0, -1) : s), []);
  const jump = (screen) => { setStack([{ screen, params: {} }]); setMenu(false); };

  // run loading interstitial → advance (or hand off to the real home screen)
  useEffect(() => {
    if (cur.screen === '__loading') {
      const to = cur.params.to, tp = cur.params.tp || {};
      const t = setTimeout(() => {
        if (to === 'home') { window.location.assign('Smartout Mobile Version 1.html'); return; }
        setStack(s => [...s.slice(0, -1), { screen: to, params: tp }]);
      }, 1100);
      return () => clearTimeout(t);
    }
  }, [cur]);

  let body;
  if (cur.screen === '__loading') body = <Loading label={cur.params.label} />;
  else {
    const C = SCREENS[cur.screen] || Welcome;
    const isAdminSuccess = cur.screen === 'adminSuccess';
    body = <C nav={nav} params={cur.params} admin={isAdminSuccess} />;
  }

  return (
    <div className="m-app" data-theme={theme}>
      {/* dev chrome — not part of the product */}
      <div className="a-dev">
        <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Tema"><Ic n={theme === 'dark' ? 'sun' : 'moon'} s={16} /></button>
        <button onClick={() => setMenu(m => !m)} title="Gå til skjerm"><Ic n="list" s={16} /></button>
      </div>
      {menu && (
        <div className="m-sheet-scrim" onClick={() => setMenu(false)} style={{ zIndex: 70 }}>
          <div className="m-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '84%' }}>
            <div className="m-sheet-grip" />
            <div className="a-jump-h">
              <h3>Skjermer</h3>
              <span className="a-jump-badge">FORHÅNDSVISNING</span>
              <button className="a-jump-x" style={{ marginLeft: 'auto' }} onClick={() => setMenu(false)}><Ic n="x" s={19} /></button>
            </div>
            <p className="a-jump-sub">Hopp til en hvilken som helst skjerm i innloggingsflyten. Kun for forhåndsvisning — ikke en del av produktet.</p>
            <div className="m-sheet-body">
              {JUMP_GROUPS.map((g, gi) => (
                <div key={g.title} className="a-jump-group">
                  <div className="a-jump-eyebrow">{g.title}</div>
                  <div className="a-jump-list">
                    {g.items.map(([key, name, icon], i) => {
                      const active = cur.screen === key;
                      return (
                        <button key={key} className={cls('a-jump-item', active && 'on')} onClick={() => jump(key)}>
                          <span className="a-jump-ic">{gi === 0 ? <span className="a-jump-num">{i + 1}</span> : <Ic n={icon || g.icon} s={18} />}</span>
                          <span className="a-jump-body"><span className="a-jump-t">{name}</span></span>
                          <span className="a-jump-go">{active ? <Ic n="check" s={18} sw={2.4} /> : <Ic n="chevR" s={17} />}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div key={cur.screen} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {body}
      </div>
    </div>
  );
}

window.__SmartoutOnboardingBoot = function () {
  ReactDOM.render(<App />, document.getElementById('root'));
};
