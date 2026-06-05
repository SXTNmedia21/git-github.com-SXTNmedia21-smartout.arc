// Mobile screens — iOS-style frames for auth/invite

const PHONE_W = 390;
const PHONE_H = 844;

function PhoneFrame({ children, label, statusBarColor = '#1c1814', notchBg = '#fdfcfa' }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        width: PHONE_W + 20, height: PHONE_H + 20,
        borderRadius: 56, background: '#1c1814',
        padding: 10,
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          width: PHONE_W, height: PHONE_H,
          borderRadius: 46, overflow: 'hidden',
          background: notchBg,
          position: 'relative',
        }}>
          {/* Status bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 50, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 32px', fontSize: 15, fontWeight: 600, color: statusBarColor,
            fontFamily: '-apple-system, SF Pro Text, system-ui',
          }}>
            <span>9:41</span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {/* signal */}
              <svg width="18" height="10" viewBox="0 0 18 10"><g fill={statusBarColor}><rect x="0" y="7" width="3" height="3" rx="0.5"/><rect x="5" y="5" width="3" height="5" rx="0.5"/><rect x="10" y="2" width="3" height="8" rx="0.5"/><rect x="15" y="0" width="3" height="10" rx="0.5"/></g></svg>
              {/* battery */}
              <svg width="26" height="12" viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke={statusBarColor} strokeOpacity="0.4"/><rect x="2" y="2" width="19" height="8" rx="1.5" fill={statusBarColor}/><rect x="23.5" y="4" width="2" height="4" rx="1" fill={statusBarColor} opacity="0.4"/></svg>
            </div>
          </div>
          {/* Notch */}
          <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 120, height: 32, background: '#1c1814', borderRadius: 9999, zIndex: 11 }}/>
          {/* Content */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {children}
          </div>
          {/* Home indicator */}
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 140, height: 5, background: statusBarColor, opacity: 0.35, borderRadius: 9999, zIndex: 20 }}/>
        </div>
      </div>
    </div>
  );
}

function MobileWelcome() {
  return (
    <PhoneFrame statusBarColor="#f0eeeb" notchBg="#1a1510">
      <div style={{ height: '100%', background: '#1a1510', color: '#f0eeeb', display: 'flex', flexDirection: 'column', position: 'relative', fontFamily: 'SF Pro, system-ui, sans-serif' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(251,146,60,0.35), transparent 55%), radial-gradient(circle at 70% 80%, rgba(139,92,246,0.2), transparent 60%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative', padding: '72px 32px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Wordmark size={22} color="#f0eeeb"/>
          <div style={{ marginTop: 'auto', marginBottom: 32 }}>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 56, lineHeight: 1.02, letterSpacing: '-0.02em' }}>Et varmere<br/>skift­system.</div>
            <div style={{ marginTop: 20, fontSize: 15, lineHeight: 1.5, color: 'rgba(240,238,235,0.7)' }}>
              Stempling, vakter og opplæring i én app.
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', padding: '0 24px 40px', display: 'grid', gap: 10 }}>
          <button style={{ height: 52, background: SO.orange, color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}>
            <Icon name="mail" size={16}/> Jeg har en invitasjon
          </button>
          <button style={{ height: 52, background: 'rgba(255,255,255,0.08)', color: '#f0eeeb', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, fontSize: 15, fontWeight: 500 }}>
            Finn min arbeidsplass
          </button>
          <button style={{ height: 44, background: 'transparent', color: 'rgba(240,238,235,0.65)', border: 'none', fontSize: 14, fontWeight: 500, marginTop: 4 }}>
            Logg inn direkte →
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MobileLogin() {
  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: SO.bg, display: 'flex', flexDirection: 'column', fontFamily: 'SF Pro, system-ui, sans-serif' }}>
        <div style={{ padding: '60px 20px 16px', display: 'flex', alignItems: 'center' }}>
          <button style={{ width: 40, height: 40, borderRadius: 9999, background: SO.secondary, border: 'none', display: 'grid', placeItems: 'center' }}>
            <Icon name="arrowleft" size={16} color={SO.fg}/>
          </button>
        </div>
        <div style={{ padding: '0 24px', flex: 1 }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 38, letterSpacing: '-0.02em', lineHeight: 1.08, marginBottom: 6 }}>Hei igjen.</div>
          <div style={{ color: SO.muted, fontSize: 15, marginBottom: 28 }}>Logg inn for å fortsette</div>

          <div style={{ display: 'grid', gap: 12 }}>
            <Input label="E-post" icon="mail" value="anna@skuta.no"/>
            <Input label="Passord" icon="lock" type="password" value="secret123" right={<Icon name="eye" size={16} color={SO.muted}/>}/>
            <div style={{ textAlign: 'right', marginTop: -4 }}>
              <span style={{ fontSize: 13, color: SO.orange, fontWeight: 500 }}>Glemt passord?</span>
            </div>
          </div>

          <div style={{ margin: '24px 0 16px' }}>
            <div style={{ height: 52, background: SO.orange, color: '#fff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
              Logg inn <Icon name="arrow" size={16}/>
            </div>
          </div>

          <div style={{ margin: '10px 0 16px' }}>
            <DividerText>eller</DividerText>
          </div>

          <div style={{ height: 52, background: SO.bg, border: `1px solid ${SO.border}`, color: SO.fg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 15, fontWeight: 500 }}>
            <Icon name="google" size={16}/> Fortsett med Google
          </div>
          <div style={{ height: 52, marginTop: 10, background: SO.bg, border: `1px solid ${SO.border}`, color: SO.fg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 15, fontWeight: 500 }}>
            <Icon name="sparkles" size={16}/> Magisk lenke
          </div>
        </div>
        <div style={{ padding: '20px 24px 36px', textAlign: 'center', fontSize: 14, color: SO.muted }}>
          Ingen konto? <span style={{ color: SO.fg, fontWeight: 600 }}>Kontakt arbeidsgiver</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MobileInviteAccept() {
  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: SO.bg, display: 'flex', flexDirection: 'column', fontFamily: 'SF Pro, system-ui' }}>
        <div style={{ padding: '60px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button style={{ width: 40, height: 40, borderRadius: 9999, background: SO.secondary, border: 'none', display: 'grid', placeItems: 'center' }}>
            <Icon name="x" size={16} color={SO.fg}/>
          </button>
          <div style={{ fontSize: 13, color: SO.muted }}>Invitasjon</div>
          <div style={{ width: 40 }}/>
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: '8px 24px 140px' }}>
          {/* Context card */}
          <div style={{ padding: '28px 20px', textAlign: 'center', borderRadius: 20, background: 'linear-gradient(180deg, rgba(249,115,22,0.06) 0%, rgba(249,115,22,0) 100%)', border: `1px solid ${SO.border}`, marginBottom: 22 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#ee560c', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'Instrument Serif, serif', fontSize: 30, margin: '0 auto 12px' }}>S</div>
            <div style={{ fontSize: 13, color: SO.muted, marginBottom: 4 }}>Anna Olsen har invitert deg til</div>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Café Skuta</div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
              <Badge tone="brand" size="sm">Servitør</Badge>
              <span style={{ fontSize: 12, color: SO.muted }}>· Fra 1. juli</span>
            </div>
          </div>

          <div style={{ fontSize: 13, color: SO.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>Opprett konto</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="Fornavn" value="Per"/>
              <Input label="Etternavn" value="Hansen"/>
            </div>
            <Input label="E-post" icon="mail" value="per.hansen@gmail.com" locked/>
            <Input label="Telefon" icon="phone" placeholder="+47"/>
            <Input label="Passord" icon="lock" type="password" value="secret123" right={<Icon name="eye" size={16} color={SO.muted}/>}/>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: SO.muted, margin: '16px 0', lineHeight: 1.5 }}>
            <input type="checkbox" defaultChecked style={{ accentColor: SO.orange, marginTop: 2 }}/>
            <span>Jeg godtar <u style={{ color: SO.fg }}>vilkår</u> og <u style={{ color: SO.fg }}>personvern</u>.</span>
          </label>
        </div>

        <div style={{ padding: '16px 24px 36px', background: SO.bg, borderTop: `1px solid ${SO.border}`, boxShadow: '0 -10px 30px rgba(0,0,0,0.04)' }}>
          <div style={{ height: 52, background: SO.orange, color: '#fff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
            Aksepter invitasjon <Icon name="arrow" size={16}/>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MobileInviteEntry() {
  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: SO.bg, display: 'flex', flexDirection: 'column', fontFamily: 'SF Pro, system-ui' }}>
        <div style={{ padding: '60px 20px 8px', display: 'flex', alignItems: 'center' }}>
          <button style={{ width: 40, height: 40, borderRadius: 9999, background: SO.secondary, border: 'none', display: 'grid', placeItems: 'center' }}>
            <Icon name="arrowleft" size={16} color={SO.fg}/>
          </button>
        </div>
        <div style={{ padding: '8px 24px', flex: 1 }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>Bli med på arbeidsplass</div>
          <div style={{ color: SO.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>Lim inn lenken du fikk, eller skann QR-koden.</div>

          <Input label="Invitasjonslenke" icon="copy" placeholder="smartout://invite/..." value="smartout://invite/a7f2...c9b" mono/>

          <div style={{ margin: '16px 0' }}>
            <DividerText>eller</DividerText>
          </div>

          <div style={{ padding: 24, border: `1px dashed ${SO.border}`, borderRadius: 16, textAlign: 'center', background: 'linear-gradient(180deg, rgba(249,115,22,0.04), transparent)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: SO.secondary, color: SO.fg, display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
              <Icon name="qr" size={28}/>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Skann QR-kode</div>
            <div style={{ fontSize: 12, color: SO.muted, marginBottom: 14 }}>Be arbeidsgiver vise QR-koden</div>
            <button style={{ height: 40, padding: '0 18px', background: SO.fg, color: SO.bg, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon name="qr" size={14}/> Åpne kamera
            </button>
          </div>

          <div style={{ marginTop: 22, padding: 14, background: SO.secondary, borderRadius: 12, display: 'flex', gap: 10 }}>
            <Icon name="alert" size={14} color={SO.muted} style={{ marginTop: 2 }}/>
            <div style={{ fontSize: 12, color: SO.muted, lineHeight: 1.5 }}>
              Lenker fra Smartout starter med <span style={{ color: SO.fg, fontFamily: 'Geist Mono, monospace' }}>smartout://</span> eller <span style={{ color: SO.fg, fontFamily: 'Geist Mono, monospace' }}>app.smartout.ai</span>.
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px 36px' }}>
          <div style={{ height: 52, background: SO.orange, color: '#fff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
            Fortsett <Icon name="arrow" size={16}/>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MobileOtp() {
  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: SO.bg, display: 'flex', flexDirection: 'column', fontFamily: 'SF Pro, system-ui' }}>
        <div style={{ padding: '60px 20px 8px', display: 'flex', alignItems: 'center' }}>
          <button style={{ width: 40, height: 40, borderRadius: 9999, background: SO.secondary, border: 'none', display: 'grid', placeItems: 'center' }}>
            <Icon name="arrowleft" size={16} color={SO.fg}/>
          </button>
        </div>
        <div style={{ padding: '8px 24px', flex: 1 }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>Sjekk innboksen</div>
          <div style={{ color: SO.muted, fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
            Vi sendte en 6-siffret kode til<br/><strong style={{ color: SO.fg, fontWeight: 500 }}>anna@skuta.no</strong>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            {['4','7','2','9','','',].map((d,i)=>(
              <div key={i} style={{
                flex: 1, height: 56, border: `1px solid ${d ? SO.orange : SO.border}`, borderRadius: 12,
                display: 'grid', placeItems: 'center',
                fontFamily: 'Geist Mono, monospace', fontSize: 22, fontWeight: 500,
                background: d ? 'rgba(249,115,22,0.04)' : SO.bg,
                boxShadow: i === 4 ? '0 0 0 3px rgba(249,115,22,0.18)' : 'none',
              }}>{d}</div>
            ))}
          </div>

          <div style={{ height: 52, background: SO.orange, color: '#fff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
            Bekreft
          </div>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: SO.muted }}>Ikke fått kode? <span style={{ color: SO.orange, fontWeight: 500 }}>Send på nytt (0:47)</span></div>
        </div>

        {/* Keyboard hint */}
        <div style={{ background: '#d1d3d9', padding: '6px 3px 24px', display: 'grid', gap: 6, fontFamily: 'SF Pro, system-ui' }}>
          {[['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']].map((row,i)=>(
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '0 3px' }}>
              {row.map((k,j)=>(
                <div key={j} style={{
                  height: 44, background: k ? '#fff' : 'transparent',
                  borderRadius: 6, display: 'grid', placeItems: 'center',
                  fontSize: 22, fontWeight: 400, color: '#1c1814',
                  boxShadow: k ? '0 1px 0 rgba(0,0,0,0.3)' : 'none',
                }}>{k}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

function MobileSelectWorkspace() {
  const ws = [
    { name: 'Café Skuta', role: 'Servitør', color: '#00ab93', active: true },
    { name: 'Bistro Nord', role: 'Admin', color: '#ee560c' },
    { name: 'Brygga Fjordhotell', role: 'Manager', color: '#864ad2' },
  ];
  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: SO.bg, display: 'flex', flexDirection: 'column', fontFamily: 'SF Pro, system-ui' }}>
        <div style={{ padding: '60px 24px 20px' }}>
          <Wordmark size={18}/>
        </div>
        <div style={{ padding: '0 24px', flex: 1 }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 6 }}>Hvor vil du inn?</div>
          <div style={{ color: SO.muted, fontSize: 14, marginBottom: 22 }}>Du har 3 arbeidsplasser.</div>

          <div style={{ display: 'grid', gap: 10 }}>
            {ws.map((w,i)=>(
              <div key={i} style={{
                padding: 16, background: SO.card, border: `1.5px solid ${w.active ? SO.orange : SO.border}`,
                borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: w.active ? '0 4px 16px -4px rgba(249,115,22,0.25)' : 'none',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: w.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'Instrument Serif, serif', fontSize: 22 }}>
                  {w.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{w.name}</div>
                  <div style={{ fontSize: 13, color: SO.muted }}>{w.role}</div>
                </div>
                <Icon name="chevron" size={16} color={SO.muted}/>
              </div>
            ))}

            <div style={{
              padding: 16, border: `1.5px dashed ${SO.border}`, borderRadius: 14,
              display: 'flex', alignItems: 'center', gap: 14, color: SO.muted,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: SO.secondary, display: 'grid', placeItems: 'center' }}>
                <Icon name="plus" size={18}/>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: SO.fg }}>Ny arbeidsplass</div>
                <div style={{ fontSize: 13 }}>Start nytt kompani</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px 36px', textAlign: 'center', fontSize: 13, color: SO.muted }}>
          Logget inn som <strong style={{ color: SO.fg, fontWeight: 500 }}>anna@skuta.no</strong> · <span style={{ color: SO.orange, fontWeight: 500 }}>Logg ut</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MobileWelcomePost() {
  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: '#1a1510', color: '#f0eeeb', display: 'flex', flexDirection: 'column', fontFamily: 'SF Pro, system-ui', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(251,146,60,0.35), transparent 55%), radial-gradient(circle at 70% 90%, rgba(139,92,246,0.18), transparent 60%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative', padding: '90px 28px 0', flex: 1 }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 68, lineHeight: 0.98, letterSpacing: '-0.02em' }}>Du er<br/>inne.</div>
          <div style={{ marginTop: 18, fontSize: 15, color: 'rgba(240,238,235,0.7)', lineHeight: 1.5 }}>
            Velkommen, Per. La oss vise deg rundt på Café Skuta.
          </div>

          <div style={{ marginTop: 40, display: 'grid', gap: 10 }}>
            {[
              {ic:'calendar', t:'Se vaktene dine', s:'Neste vakt: torsdag 16:00'},
              {ic:'sparkles', t:'Fullfør opplæring', s:'3 moduler · ca. 20 min'},
              {ic:'clock',    t:'Stemple inn i morgen', s:'Klar til første skift'},
            ].map((c,i)=>(
              <div key={i} style={{ padding: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, display: 'flex', gap: 12, alignItems: 'center', backdropFilter: 'blur(8px)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,0.2)', color: '#fb923c', display: 'grid', placeItems: 'center' }}>
                  <Icon name={c.ic} size={16}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.t}</div>
                  <div style={{ fontSize: 12, color: 'rgba(240,238,235,0.55)', marginTop: 2 }}>{c.s}</div>
                </div>
                <Icon name="chevron" size={14} color="rgba(240,238,235,0.4)"/>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', padding: '16px 24px 36px' }}>
          <div style={{ height: 52, background: SO.orange, color: '#fff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, boxShadow: '0 4px 20px rgba(249,115,22,0.4)' }}>
            Til dashbord <Icon name="arrow" size={16}/>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MobileInviteExpired() {
  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: SO.bg, display: 'flex', flexDirection: 'column', fontFamily: 'SF Pro, system-ui', padding: '80px 28px 36px', textAlign: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 9999, background: 'rgba(193,130,0,0.1)', color: SO.warning, display: 'grid', placeItems: 'center', marginBottom: 20 }}>
            <Icon name="clock" size={32}/>
          </div>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 12 }}>Lenken har utløpt</div>
          <div style={{ fontSize: 14, color: SO.muted, lineHeight: 1.55, maxWidth: 280 }}>
            Denne invitasjonen utløp 2 dager siden. Be arbeidsgiver sende en ny.
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ height: 52, background: SO.orange, color: '#fff', borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 600 }}>Be om ny lenke</div>
          <div style={{ height: 44, color: SO.muted, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 500 }}>Gå til innlogging</div>
        </div>
      </div>
    </PhoneFrame>
  );
}

Object.assign(window, { PhoneFrame, MobileWelcome, MobileLogin, MobileInviteAccept, MobileInviteEntry, MobileOtp, MobileSelectWorkspace, MobileWelcomePost, MobileInviteExpired });
