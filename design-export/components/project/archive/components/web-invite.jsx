// Web invitation flows — invite accept, onboarding wizard, invite dialog, status list

function InviteAcceptScreen({ variant = 'new' }) {
  return (
    <div style={{ width: 1280, height: 820, background: SO.bg, fontFamily: 'Geist, system-ui', color: SO.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 10%, rgba(249,115,22,0.08), transparent 45%), radial-gradient(circle at 80% 90%, rgba(139,92,246,0.06), transparent 50%)' }}/>
      <div style={{ position: 'absolute', top: 32, left: 48 }}><Wordmark /></div>

      <div style={{ position: 'relative', width: 520, background: SO.card, border: `1px solid ${SO.border}`, borderRadius: 24, padding: 40, boxShadow: '0 20px 60px -20px rgba(0,0,0,0.15), 0 0 0 1px rgba(249,115,22,0.03)' }}>
        {/* Context header */}
        <div style={{ textAlign: 'center', paddingBottom: 28, borderBottom: `1px solid ${SO.border}`, marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#ee560c', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'Instrument Serif, serif', fontSize: 30, margin: '0 auto 14px', boxShadow: '0 8px 20px -8px rgba(238,86,12,0.4)' }}>
            S
          </div>
          <div style={{ fontSize: 13, color: SO.muted, letterSpacing: '0.05em', marginBottom: 8 }}>
            <span style={{ color: SO.fg, fontWeight: 500 }}>Anna Olsen</span> har invitert deg til
          </div>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Café Skuta
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
            <Badge tone="brand">Servitør</Badge>
            <span style={{ fontSize: 13, color: SO.muted }}>· Starter 1. juli 2026</span>
          </div>
        </div>

        {variant === 'new' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 13, color: SO.muted, marginBottom: 4 }}>Opprett konto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="Fornavn" value="Per" />
              <Input label="Etternavn" value="Hansen" />
            </div>
            <Input label="E-post" icon="mail" value="per.hansen@gmail.com" locked />
            <Input label="Telefon" icon="phone" placeholder="+47" />
            <Input label="Velg passord" icon="lock" type="password" value="secret123" right={<Icon name="eye" size={16} color={SO.muted}/>} />

            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: SO.muted, margin: '8px 0', lineHeight: 1.5, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: SO.orange, marginTop: 3 }}/>
              <span>Jeg godtar <a style={{ color: SO.fg, fontWeight: 500 }}>vilkår</a> og <a style={{ color: SO.fg, fontWeight: 500 }}>personvernerklæring</a>.</span>
            </label>

            <Button variant="primary" block right="arrow">Opprett konto og aksepter</Button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 13, color: SO.muted, marginBottom: 4 }}>Bekreft identiteten din</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="Fornavn" value="Per" />
              <Input label="Etternavn" value="Hansen" />
            </div>
            <Input label="E-post" icon="mail" value="per.hansen@gmail.com" locked />
            <Input label="Passord" icon="lock" type="password" placeholder="••••••••" right={<Icon name="eye" size={16} color={SO.muted}/>} />
            <Button variant="primary" block right="arrow">Aksepter invitasjon</Button>
            <div style={{ textAlign: 'center', fontSize: 13, color: SO.muted, marginTop: 4 }}>
              Glemt passord? <a style={{ color: SO.orange, fontWeight: 500 }}>Logg inn via kode</a>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, padding: 12, background: SO.secondary, borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: SO.muted }}>
          <Icon name="shield" size={14} />
          <span>Lenken utløper om 6 dager og kan kun brukes én gang.</span>
        </div>
      </div>
    </div>
  );
}

function InviteErrorScreen() {
  return (
    <div style={{ width: 1280, height: 820, background: SO.bg, fontFamily: 'Geist, system-ui', color: SO.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 32, left: 48 }}><Wordmark /></div>
      <div style={{ width: 440, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 9999, background: 'rgba(193,130,0,0.1)', color: SO.warning, display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
          <Icon name="clock" size={28} />
        </div>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 40, letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.1 }}>Lenken har utløpt</div>
        <div style={{ color: SO.muted, fontSize: 15, lineHeight: 1.55, marginBottom: 28 }}>
          Denne invitasjonen ble sendt 1. april og har utløpt. Be arbeidsgiver sende ny lenke.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button variant="secondary">Kontakt arbeidsgiver</Button>
          <Button variant="primary">Gå til innlogging</Button>
        </div>
      </div>
    </div>
  );
}

function OnboardingWizard() {
  const steps = [
    { n:1, label:'Velkommen', status:'done' },
    { n:2, label:'Om deg', status:'done' },
    { n:3, label:'Om kompaniet', status:'done' },
    { n:4, label:'Bransje', status:'current' },
    { n:5, label:'Arbeidsplass', status:'pending' },
    { n:6, label:'Avdelinger', status:'pending' },
    { n:7, label:'Åpningstider', status:'pending' },
    { n:8, label:'Regelverk', status:'pending' },
    { n:9, label:'Bekreft', status:'pending' },
  ];
  const verticals = [
    { id:'hospitality', title:'Restaurant & bar', sub:'Kjøkken, sal, bar, event', icon:'sparkles', active:true },
    { id:'hotel', title:'Hotell', sub:'Resepsjon, housekeeping, F&B', icon:'build', active:false },
    { id:'retail', title:'Butikk', sub:'Salg, lager, kasse', icon:'briefcase', active:false },
    { id:'other', title:'Annet', sub:'Tilpass selv', icon:'dept', active:false },
  ];
  return (
    <div style={{ width: 1280, height: 820, background: SO.bg, fontFamily: 'Geist, system-ui', color: SO.fg, display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: 280, background: SO.sidebarBg || '#f7f5f2', borderRight: `1px solid ${SO.border}`, padding: 32, display: 'flex', flexDirection: 'column' }}>
        <Wordmark />
        <div style={{ fontSize: 11, color: SO.muted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '40px 0 18px' }}>Oppsett</div>
        <div style={{ display: 'grid', gap: 2 }}>
          {steps.map(s => (
            <div key={s.n} style={{
              display: 'flex', gap: 12, alignItems: 'center', padding: '9px 10px',
              borderRadius: 8,
              background: s.status === 'current' ? 'rgba(249,115,22,0.08)' : 'transparent',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 9999,
                background: s.status === 'done' ? SO.success : s.status === 'current' ? SO.orange : 'transparent',
                border: s.status === 'pending' ? `1.5px solid ${SO.border}` : 'none',
                color: '#fff', display: 'grid', placeItems: 'center',
                fontSize: 11, fontWeight: 600, flex: '0 0 22px',
              }}>
                {s.status === 'done' ? <Icon name="check" size={12} color="#fff" strokeWidth={2.5}/> : s.n}
              </div>
              <span style={{ fontSize: 14, color: s.status === 'current' ? SO.fg : SO.muted, fontWeight: s.status === 'current' ? 600 : 400 }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: 14, background: SO.card, border: `1px solid ${SO.border}`, borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 9999, background: 'linear-gradient(135deg, #f97316, #8b5cf6)', display: 'grid', placeItems: 'center', color: '#fff' }}>
              <Icon name="sparkles" size={12}/>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Botsson</div>
          </div>
          <div style={{ fontSize: 12, color: SO.muted, lineHeight: 1.5 }}>Jeg kan forklare valgene hvis du lurer på noe. Bare spør.</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '56px 72px' }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 12, color: SO.orange, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 14 }}>Steg 4 av 9</div>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 12 }}>Hvilken bransje<br/>er dere i?</div>
          <div style={{ fontSize: 16, color: SO.muted, lineHeight: 1.55, marginBottom: 36, maxWidth: 520 }}>
            Vi forhåndsutfyller avdelinger, åpningstider og roller basert på valget. Du kan endre alt etterpå.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {verticals.map(v => (
              <div key={v.id} style={{
                padding: 20,
                background: v.active ? 'rgba(249,115,22,0.04)' : SO.card,
                border: `1.5px solid ${v.active ? SO.orange : SO.border}`,
                borderRadius: 16, cursor: 'pointer',
                position: 'relative',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: v.active ? SO.orange : SO.secondary, color: v.active ? '#fff' : SO.fg, display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                  <Icon name={v.icon} size={18}/>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{v.title}</div>
                <div style={{ fontSize: 13, color: SO.muted }}>{v.sub}</div>
                {v.active && (
                  <div style={{ position: 'absolute', top: 16, right: 16, width: 20, height: 20, borderRadius: 9999, background: SO.orange, display: 'grid', placeItems: 'center' }}>
                    <Icon name="check" size={12} color="#fff" strokeWidth={2.5}/>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Autofill preview */}
          <div style={{ marginTop: 28, padding: 20, background: SO.card, border: `1px solid ${SO.border}`, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13, color: SO.muted }}>
              <Icon name="sparkles" size={14} color={SO.orange}/>
              Vi forhåndsutfyller dette for deg
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: SO.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Avdelinger</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>Kjøkken, Sal, Bar, Event</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: SO.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Roller</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>Kokk, Servitør, Bartender, Runner</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: SO.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Regelverk</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>Riksavtalen (default)</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 36, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button variant="ghost" icon="arrowleft">Forrige</Button>
            <Button variant="primary" right="arrow">Fortsett</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteDialog() {
  return (
    <div style={{ width: 1280, height: 820, background: 'rgba(28,24,20,0.4)', fontFamily: 'Geist, system-ui', color: SO.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ width: 640, background: SO.card, borderRadius: 20, boxShadow: '0 30px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '22px 28px', borderBottom: `1px solid ${SO.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 26, letterSpacing: '-0.01em' }}>Inviter</div>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: SO.muted, padding: 4 }}><Icon name="x" size={18}/></button>
        </div>

        <div style={{ padding: 28 }}>
          <div style={{ marginBottom: 22 }}>
            <Tabs value="single" onChange={()=>{}} tabs={[{value:'single',label:'Enkelt'},{value:'bulk',label:'Bulk (CSV)'}]}/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Fornavn" value="Bjørn"/>
            <Input label="Etternavn" value="Eriksen"/>
          </div>
          <div style={{ height: 12 }}/>
          <Input label="E-post" icon="mail" value="bjorn@skuta.no"/>
          <div style={{ height: 12 }}/>
          <Input label="Telefon" icon="phone" placeholder="+47"/>
          <div style={{ height: 12 }}/>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Avdeling</div>
              <div style={{ height: 44, border: `1px solid ${SO.border}`, borderRadius: 12, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15 }}>
                <span>Kjøkken</span>
                <Icon name="chevrondown" size={14} color={SO.muted}/>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Rolle</div>
              <div style={{ height: 44, border: `1px solid ${SO.border}`, borderRadius: 12, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15 }}>
                <span>Servitør</span>
                <Icon name="chevrondown" size={14} color={SO.muted}/>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Hvordan skal vi sende invitasjonen?</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                {id:'link',label:'Lenke',icon:'copy',on:true},
                {id:'email',label:'E-post',icon:'mail',on:true},
                {id:'sms',label:'SMS',icon:'phone',on:false},
                {id:'qr',label:'QR-kode',icon:'qr',on:false},
              ].map(c=>(
                <label key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px',
                  border: `1.5px solid ${c.on ? SO.orange : SO.border}`,
                  background: c.on ? 'rgba(249,115,22,0.05)' : 'transparent',
                  borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                }}>
                  <Icon name={c.icon} size={14} color={c.on ? SO.orangeDark : SO.muted}/>
                  {c.label}
                  {c.on && <Icon name="check" size={12} color={SO.orangeDark} strokeWidth={2.5}/>}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18, padding: 14, background: SO.secondary, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Ansettelsesprofil</div>
              <div style={{ fontSize: 12, color: SO.muted }}>Lønnsmal, timer/uke, startdato</div>
            </div>
            <Icon name="chevrondown" size={16} color={SO.muted}/>
          </div>
        </div>

        <div style={{ padding: '20px 28px', borderTop: `1px solid ${SO.border}`, background: '#f9f7f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: SO.muted }}>Lenken utløper om 7 dager</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost">Avbryt</Button>
            <Button variant="primary" icon="send">Send invitasjon</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteStatusList() {
  const rows = [
    { tone:'pending',  label:'Pending',   name:'Anna Kok',      email:'anna@skuta.no',    when:'3t siden', role:'Kokk',      dep:'Kjøkken' },
    { tone:'opened',   label:'Åpnet',     name:'Bjørn Servi',   email:'bjorn@skuta.no',   when:'1d siden', role:'Servitør',  dep:'Sal' },
    { tone:'accepted', label:'Godtatt',   name:'Carl Andersen', email:'carl@skuta.no',    when:'2d siden', role:'Manager',   dep:'Sal' },
    { tone:'expired',  label:'Utløpt',    name:'Dina Test',     email:'dina@skuta.no',    when:'8d siden', role:'Runner',    dep:'Sal' },
    { tone:'cancel',   label:'Kansellert',name:'Eirik Olsen',   email:'eirik@skuta.no',   when:'12d siden',role:'Bartender', dep:'Bar' },
  ];
  const deptColors = { 'Kjøkken': '#ee560c', 'Sal':'#00ab93', 'Bar':'#864ad2' };
  return (
    <div style={{ width: 1280, height: 820, background: SO.bg, fontFamily: 'Geist, system-ui', color: SO.fg, display: 'flex' }}>
      {/* Sidebar mock */}
      <div style={{ width: 240, background: '#f7f5f2', borderRight: `1px solid ${SO.border}`, padding: 24 }}>
        <Wordmark/>
        <div style={{ fontSize: 11, color: SO.muted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '28px 0 12px' }}>Hoved</div>
        {[
          {ic:'home',l:'Hjem',a:false},
          {ic:'calendar',l:'Vakter',a:false},
          {ic:'users',l:'Ansatte',a:true},
          {ic:'sparkles',l:'Opplæring',a:false},
          {ic:'shield',l:'HMS',a:false},
        ].map((r,i)=>(
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', marginBottom: 2,
            borderRadius: 8, cursor: 'pointer',
            background: r.a ? '#f2f0ec' : 'transparent',
            color: r.a ? SO.orange : SO.fg,
            fontSize: 14, fontWeight: r.a ? 600 : 400,
          }}>
            <Icon name={r.ic} size={16} color={r.a ? SO.orange : SO.muted}/>
            {r.l}
          </div>
        ))}
        <div style={{ position: 'absolute', bottom: 24, left: 24, right: 'auto', width: 192, display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, background: SO.card, border: `1px solid ${SO.border}` }}>
          <div style={{ width: 32, height: 32, borderRadius: 9999, background: SO.orange, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>AO</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Anna Olsen</div>
            <div style={{ fontSize: 11, color: SO.muted }}>Café Skuta</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 40 }}>
        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 12, color: SO.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Ansatte</div>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 36, letterSpacing: '-0.02em' }}>Invitasjoner</div>
          </div>
          <Button variant="primary" icon="plus">Inviter</Button>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            {n:'12', l:'Pending', tone:SO.muted},
            {n:'8',  l:'Åpnet',   tone:SO.info},
            {n:'47', l:'Godtatt denne uka', tone:SO.success},
            {n:'2',  l:'Utløpt',  tone:SO.warning},
          ].map((k,i)=>(
            <div key={i} style={{ padding: 18, background: SO.card, border: `1px solid ${SO.border}`, borderRadius: 14 }}>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 28, fontWeight: 900, color: k.tone, letterSpacing: '-0.02em' }}>{k.n}</div>
              <div style={{ fontSize: 12, color: SO.muted, marginTop: 4 }}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: SO.card, border: `1px solid ${SO.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${SO.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Alle','Pending','Åpnet','Godtatt','Utløpt'].map((t,i)=>(
                <button key={t} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: i === 0 ? SO.secondary : 'transparent',
                  color: i === 0 ? SO.fg : SO.muted,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
                }}>{t}</button>
              ))}
            </div>
            <div style={{ fontSize: 13, color: SO.muted }}>69 invitasjoner</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#faf8f5' }}>
                {['Status','Navn','Rolle','Avdeling','Sendt','Kanaler',''].map(h=>(
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: SO.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} style={{ borderTop: `1px solid ${SO.border}` }}>
                  <td style={{ padding: '14px 16px' }}><Badge tone={r.tone}>{r.label}</Badge></td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: SO.muted, fontFamily: 'Geist Mono, monospace' }}>{r.email}</div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 14 }}>{r.role}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 9999, background: deptColors[r.dep] }}/>
                      {r.dep}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: SO.muted, fontFamily: 'Geist Mono, monospace' }}>{r.when}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, color: SO.muted }}>
                      <Icon name="mail" size={14}/><Icon name="copy" size={14}/>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button style={{ background: 'transparent', border: `1px solid ${SO.border}`, padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, color: SO.fg, cursor: 'pointer', fontFamily: 'inherit' }}>Handlinger ▾</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { InviteAcceptScreen, InviteErrorScreen, OnboardingWizard, InviteDialog, InviteStatusList });
