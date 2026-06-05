// Web auth screens — Login, Signup, Reset, Update Password, Welcome, Select Workspace

function LoginScreen() {
  const [tab, setTab] = React.useState('password');
  return (
    <NordicSplit brand={<BrandPanelHero />}>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 40, letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 6 }}>Hei igjen.</div>
      <div style={{ color: SO.muted, fontSize: 15, marginBottom: 28 }}>Logg inn for å fortsette</div>

      <div style={{ marginBottom: 22 }}>
        <Tabs value={tab} onChange={setTab} tabs={[{value:'password',label:'Passord'},{value:'magic',label:'Magisk lenke'}]} />
      </div>

      {tab === 'password' ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <Button variant="secondary" block icon="google">Fortsett med Google</Button>
          <DividerText>eller</DividerText>
          <Input label="E-post" icon="mail" placeholder="navn@bedrift.no" value="anna@skuta.no" />
          <Input label="Passord" icon="lock" type="password" placeholder="••••••••" value="secret123" right={<Icon name="eye" size={16} color={SO.muted} />} />
          <div style={{ textAlign: 'right', marginTop: -4 }}>
            <a style={{ fontSize: 13, color: SO.orange, fontWeight: 500, textDecoration: 'none' }}>Glemt passord?</a>
          </div>
          <Button variant="primary" block right="arrow">Logg inn</Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <Input label="E-post" icon="mail" placeholder="navn@bedrift.no" />
          <Button variant="primary" block icon="send">Send kode</Button>
          <div style={{ fontSize: 13, color: SO.muted, lineHeight: 1.5 }}>Vi sender en 6-siffret kode til e-posten din. Koden gjelder i 10 minutter.</div>
        </div>
      )}

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${SO.border}`, fontSize: 14, color: SO.muted }}>
        Ikke registrert? <a style={{ color: SO.fg, fontWeight: 500, textDecoration: 'none' }}>Opprett konto →</a>
      </div>
    </NordicSplit>
  );
}

function SignupScreen() {
  return (
    <NordicSplit brand={<BrandPanelHero tagline="Start en ny arbeidsplass på minutter. Vi tar oss av regelverk og rutiner." />}>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 40, letterSpacing: '-0.02em', marginBottom: 6 }}>Opprett konto</div>
      <div style={{ color: SO.muted, fontSize: 15, marginBottom: 28 }}>Start ny arbeidsplass i Smartout</div>

      <div style={{ marginBottom: 22 }}>
        <Tabs value="magic" onChange={() => {}} tabs={[{value:'magic',label:'Magisk lenke'},{value:'password',label:'Passord'}]} />
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <Input label="E-post" icon="mail" placeholder="navn@bedrift.no" />
        <Button variant="primary" block icon="send">Send lenke</Button>
        <div style={{ fontSize: 13, color: SO.muted, lineHeight: 1.5 }}>Vi sender deg en magisk lenke. Ingen passord nødvendig.</div>
      </div>

      <div style={{ marginTop: 20, padding: 14, background: 'rgba(249,115,22,0.06)', border: `1px solid rgba(249,115,22,0.18)`, borderRadius: 12, display: 'flex', gap: 10 }}>
        <Icon name="sparkles" size={18} color={SO.orangeDark} />
        <div style={{ fontSize: 13, color: SO.fg, lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 600 }}>Er du invitert av en arbeidsgiver?</strong><br/>
          <span style={{ color: SO.muted }}>Bruk invitasjons-lenken du fikk på e-post eller SMS.</span>
        </div>
      </div>

      <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${SO.border}`, fontSize: 14, color: SO.muted }}>
        Har du konto? <a style={{ color: SO.fg, fontWeight: 500, textDecoration: 'none' }}>Logg inn →</a>
      </div>
    </NordicSplit>
  );
}

function OtpScreen() {
  return (
    <NordicSplit brand={<BrandPanelHero />}>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 40, letterSpacing: '-0.02em', marginBottom: 6 }}>Sjekk innboksen</div>
      <div style={{ color: SO.muted, fontSize: 15, marginBottom: 28, lineHeight: 1.5 }}>
        Vi sendte en 6-siffret kode til<br/><strong style={{ color: SO.fg, fontWeight: 500 }}>anna@skuta.no</strong>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['4','7','2','9','','',].map((d,i)=>(
          <div key={i} style={{
            flex: 1, height: 56, border: `1px solid ${d ? SO.orange : SO.border}`, borderRadius: 12,
            display: 'grid', placeItems: 'center',
            fontFamily: 'Geist Mono, monospace', fontSize: 24, fontWeight: 500,
            background: d ? 'rgba(249,115,22,0.04)' : SO.bg,
            boxShadow: i === 4 ? '0 0 0 3px rgba(249,115,22,0.15)' : 'none',
          }}>
            {d || (i === 4 ? <span style={{ width: 2, height: 20, background: SO.orange, animation: 'blink 1s infinite' }}/> : '')}
          </div>
        ))}
      </div>

      <Button variant="primary" block right="arrow">Bekreft</Button>
      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: SO.muted }}>
        <span>Ikke fått kode? <a style={{ color: SO.orange, fontWeight: 500 }}>Send på nytt</a></span>
        <span>0:47</span>
      </div>
    </NordicSplit>
  );
}

function ResetPasswordScreen() {
  return (
    <NordicSplit brand={<BrandPanelHero />}>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 40, letterSpacing: '-0.02em', marginBottom: 6 }}>Glemt passord?</div>
      <div style={{ color: SO.muted, fontSize: 15, marginBottom: 28 }}>Vi sender deg en lenke for å sette et nytt.</div>

      <div style={{ display: 'grid', gap: 14 }}>
        <Input label="E-post" icon="mail" placeholder="navn@bedrift.no" />
        <Button variant="primary" block icon="send">Send lenke</Button>
        <Button variant="ghost" block icon="arrowleft">Tilbake til login</Button>
      </div>
    </NordicSplit>
  );
}

function UpdatePasswordScreen() {
  return (
    <NordicSplit brand={<BrandPanelHero />}>
      <div style={{ padding: 12, background: 'rgba(39,132,213,0.08)', borderRadius: 10, marginBottom: 20, display: 'flex', gap: 10, fontSize: 13, color: SO.fg, lineHeight: 1.5 }}>
        <Icon name="alert" size={16} color={SO.info} />
        Du må sette nytt passord første gang du logger inn i den nye Smartout.
      </div>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 40, letterSpacing: '-0.02em', marginBottom: 24 }}>Sett nytt passord</div>

      <div style={{ display: 'grid', gap: 14 }}>
        <Input label="Nytt passord" icon="lock" type="password" value="supersecret" right={<Icon name="eye" size={16} color={SO.muted} />} />
        <Input label="Bekreft" icon="lock" type="password" value="supersecret" right={<Icon name="eye" size={16} color={SO.muted} />} />
        <div>
          <div style={{ fontSize: 12, color: SO.muted, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>Styrke</span><span style={{ color: SO.success }}>Sterk</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= 4 ? SO.success : SO.border }} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: SO.muted, marginTop: 8 }}>Min. 8 tegn · inkl. stor bokstav · inkl. tall</div>
        </div>
        <Button variant="primary" block right="arrow">Lagre og logg inn</Button>
      </div>
    </NordicSplit>
  );
}

function WelcomeScreen() {
  return (
    <NordicSplit brand={
      <>
        <Wordmark size={22} color="#f0eeeb" />
        <div>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 72, lineHeight: 1, letterSpacing: '-0.02em', color: '#f0eeeb' }}>
            Du er<br/>inne.
          </div>
          <div style={{ marginTop: 20, fontSize: 15, color: 'rgba(240,238,235,0.68)', maxWidth: 340 }}>
            Velkommen, Anna. La oss vise deg rundt på Café Skuta.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: 'rgba(240,238,235,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <div style={{ width: 24, height: 1, background: 'rgba(240,238,235,0.3)' }}/>
          Steg 1 av 3
        </div>
      </>
    }>
      <div style={{ fontSize: 13, color: SO.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Slik kommer du i gang</div>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, letterSpacing: '-0.02em', marginBottom: 24, lineHeight: 1.15 }}>Tre ting å gjøre før første vakt</div>

      <div style={{ display: 'grid', gap: 10 }}>
        {[
          {icon:'calendar', title:'Se vaktene dine', sub:'Neste vakt: torsdag 16:00'},
          {icon:'sparkles', title:'Fullfør opplæring', sub:'3 moduler · ca. 20 min'},
          {icon:'clock', title:'Stemple inn i morgen', sub:'Last ned mobilappen'},
        ].map((c,i) => (
          <div key={i} style={{
            padding: 16, background: SO.card, border: `1px solid ${SO.border}`, borderRadius: 14,
            borderLeft: `3px solid ${SO.orange}`,
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,0.1)', display: 'grid', placeItems: 'center', color: SO.orangeDark, flex: '0 0 36px' }}>
              <Icon name={c.icon} size={18}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: SO.muted, marginTop: 2 }}>{c.sub}</div>
            </div>
            <Icon name="chevron" size={16} color={SO.muted} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
        <Button variant="ghost">Hopp over</Button>
        <Button variant="primary" right="arrow" block>Til dashbord</Button>
      </div>
    </NordicSplit>
  );
}

function SelectWorkspaceScreen() {
  const workspaces = [
    { name: 'Café Skuta', role: 'Servitør', last: '2 min siden', stat: '2 aktive vakter', tone: 'active', color: SO.dept || '#00ab93' },
    { name: 'Bistro Nord', role: 'Admin', last: '3 dager siden', stat: '12 ansatte', tone: 'brand', color: '#ee560c' },
    { name: 'Brygga Fjordhotell', role: 'Manager', last: '2 uker siden', stat: '24 vakter neste uke', tone: 'neutral', color: '#864ad2' },
  ];
  return (
    <div style={{ width: 1280, height: 820, background: SO.bg, fontFamily: 'Geist, system-ui', color: SO.fg, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% -10%, rgba(249,115,22,0.08), transparent 55%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', top: 32, left: 48 }}><Wordmark /></div>
      <div style={{ position: 'absolute', top: 32, right: 48, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: SO.muted }}>
        <div style={{ width: 30, height: 30, borderRadius: 9999, background: SO.orange, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>AO</div>
        Anna Olsen
      </div>

      <div style={{ position: 'relative', maxWidth: 980, margin: '130px auto 0', padding: '0 48px' }}>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 56, letterSpacing: '-0.02em', marginBottom: 10 }}>Hvor vil du inn?</div>
        <div style={{ color: SO.muted, fontSize: 16, marginBottom: 36 }}>Du har tilgang til tre arbeidsplasser.</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {workspaces.map((w,i) => (
            <div key={i} style={{
              padding: 22, background: SO.card, border: `1px solid ${SO.border}`, borderRadius: 18,
              cursor: 'pointer', position: 'relative',
              boxShadow: i === 0 ? '0 10px 30px -12px rgba(0,0,0,0.12)' : 'var(--sh-sm)',
              transform: i === 0 ? 'translateY(-4px)' : 'none',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: w.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'Instrument Serif, serif', fontSize: 22, marginBottom: 14 }}>
                {w.name[0]}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{w.name}</div>
              <div style={{ fontSize: 13, color: SO.muted, marginTop: 2, marginBottom: 14 }}>{w.role}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: SO.muted }}>Sist: {w.last}</span>
                <Badge tone={w.tone}>{w.stat}</Badge>
              </div>
              {i === 0 && <div style={{ position: 'absolute', top: 16, right: 16, color: SO.orange }}><Icon name="arrow" size={18} /></div>}
            </div>
          ))}

          <div style={{
            padding: 22, border: `1.5px dashed ${SO.border}`, borderRadius: 18,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, color: SO.muted, cursor: 'pointer', minHeight: 190,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 9999, background: SO.secondary, display: 'grid', placeItems: 'center' }}>
              <Icon name="plus" size={18} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: SO.fg }}>Ny arbeidsplass</div>
            <div style={{ fontSize: 12 }}>Start et nytt kompani</div>
          </div>
        </div>

        <div style={{ marginTop: 30, fontSize: 13, color: SO.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ accentColor: SO.orange }}/>
          Husk valget mitt neste gang
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, SignupScreen, OtpScreen, ResetPasswordScreen, UpdatePasswordScreen, WelcomeScreen, SelectWorkspaceScreen });
