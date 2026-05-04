// Mobile — Chat screens. iOS frame 375×812.
// Uses the PhoneChrome + TabBar from mobile-screens.jsx.
// Screens: ChatListChannels, ChatListSkranke, ConversationDefault,
// ConversationShortcuts, ConversationReply.

// ─── Segment control ────────────────────────────────────────
const Segment = ({ value, tabs }) => (
  <div style={{ display: 'flex', paddingTop: 2 }}>
    {tabs.map(t => {
      const active = t.id === value;
      return (
        <div key={t.id} style={{
          flex: 1, textAlign: 'center', paddingBottom: 10, paddingTop: 10,
          fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14,
          color: active ? 'var(--foreground)' : 'oklch(0.52 0.01 52 / 0.7)',
          borderBottom: `2px solid ${active ? 'var(--brand-orange)' : 'transparent'}`,
          letterSpacing: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          {t.label}
          {t.count != null && t.count > 0 && (
            <span style={{ color: active ? 'var(--brand-orange)' : 'var(--muted-fg)' }}>({t.count})</span>
          )}
        </div>
      );
    })}
  </div>
);

// ─── Chat header ────────────────────────────────────────────
const ChatHeader = ({ rightPlus, rightSettings }) => (
  <div style={{
    height: 50,
    paddingTop: 8, paddingHorizontal: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px 12px 0',
  }}>
    <button style={btnRound44}><Icon name="menu" size={22} style={{ color: 'oklch(0.52 0.01 52 / 0.45)' }} /></button>
    <div style={{
      fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontWeight: 300,
      fontSize: 22, letterSpacing: '-0.5px',
    }}>Chat</div>
    <div style={{ display: 'flex' }}>
      {rightPlus && <button style={btnRound44}><Icon name="plus" size={22} style={{ color: 'oklch(0.52 0.01 52 / 0.45)' }} /></button>}
      {rightSettings && <button style={btnRound44}><Icon name="settings" size={22} style={{ color: 'oklch(0.52 0.01 52 / 0.45)' }} /></button>}
    </div>
  </div>
);
const btnRound44 = {
  width: 44, height: 44, border: 'none', background: 'transparent',
  borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0,
};

// ─── ChatList · Chatkanaler ─────────────────────────────────
const ChatListChannels = () => (
  <PhoneChrome>
    <ChatHeader rightPlus rightSettings />
    <Segment value="channels" tabs={[
      { id: 'channels', label: 'Chatkanaler' },
      { id: 'skranke', label: 'Skranke', count: 3 },
    ]} />

    <div style={{ overflowY: 'auto', height: 'calc(812px - 44px - 50px - 40px - 82px)', paddingBottom: 20 }}>
      {/* ActionBar */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px 6px',
      }}>
        <ActionChip icon="search" label="Søk" />
        <ActionChip icon="plus" label="Ny kanal" />
        <ActionChip icon="filter" label="Filter" />
      </div>

      {/* ActiveNow row */}
      <div style={{ padding: '10px 0 16px' }}>
        <div style={{ padding: '0 16px 10px' }}>
          <SectionLabel>AKTIVE NÅ</SectionLabel>
        </div>
        <div style={{ display: 'flex', gap: 14, padding: '0 16px', overflowX: 'auto' }}>
          {[
            'Linn', 'Kari', 'Ola', 'Thea', 'Mikkel', 'Nora',
          ].map(n => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 56 }}>
              <div style={{ position: 'relative' }}>
                <Avatar name={n} size={48} />
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 10, height: 10, borderRadius: '50%',
                  background: 'var(--success)',
                  border: '2px solid var(--background)',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 500 }}>{n}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Aktive vakter section */}
      <div style={{ padding: '0 16px 4px' }}>
        <SectionLabel>AKTIVE VAKTER</SectionLabel>
      </div>
      <ActiveSessionCard
        dept="kjokken" icon="utensils-crossed" channel="#kveldsvakt-kjøkken"
        time="NÅ" sender="Nora" preview="Dessertstasjonen er litt bakpå — noen som…"
        unread={3}
      />
      <ActiveSessionCard
        dept="bar" icon="wine" channel="#bar"
        time="14:02" sender="Mikkel" preview="Mange gjester kl 21 — tar noen ekstra…"
        unread={1}
      />

      {/* Kanaler section */}
      <div style={{ padding: '14px 16px 4px' }}>
        <SectionLabel>KANALER</SectionLabel>
      </div>
      <ChannelItem icon="hash" name="allmenn" time="12:45" sender="Sofia" preview="Husk at vi har personalmøte i morgen kl 10" unread={0} />
      <ChannelItem icon="hash" name="service" time="11:20" sender="Thea" preview="Har noen sett bestillingsblokkene?" unread={2} />
      <ChannelItem icon="hash" name="hms" time="I går" sender="Ola" preview="Ny sjekkliste for kjøkken er lagt ut" unread={0} read />
      <ChannelItem icon="hash" name="event" time="Man" sender="Kari" preview="Lister for julebord-uka 15.–19." unread={0} read />

      {/* Direkte */}
      <div style={{ padding: '14px 16px 4px' }}>
        <SectionLabel>DIREKTE</SectionLabel>
      </div>
      <DMItem name="Linn Andersen" time="14 min" preview="Perfekt, takk. Jeg tar 27.–29." unread />
      <DMItem name="Kari Holm" time="1 t" preview="Høres bra ut — skriver under" />
      <DMItem name="Mikkel Dahl" time="I går" preview="Sendte vaktbyttet til godkjenning" read />
    </div>

    <TabBar active="komm" />
  </PhoneChrome>
);

const SectionLabel = ({ children }) => (
  <div style={{
    fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
    letterSpacing: '1.5px', textTransform: 'uppercase',
    color: 'oklch(0.52 0.01 52 / 0.5)',
  }}>{children}</div>
);

const ActionChip = ({ icon, label }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 11px', borderRadius: 9999,
    background: 'var(--muted)', border: '1px solid var(--border)',
    fontSize: 12.5, fontWeight: 500, color: 'var(--muted-fg)',
  }}>
    <Icon name={icon} size={13} />
    {label}
  </div>
);

const ActiveSessionCard = ({ dept, icon, channel, time, sender, preview, unread }) => (
  <div style={{
    margin: '0 12px 8px',
    padding: '12px 14px',
    background: 'oklch(0.99 0.004 60 / 0.80)',
    border: '1px solid oklch(0.91 0.006 55 / 0.5)',
    borderRadius: 10,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <div style={{
      width: 38, height: 38, borderRadius: 19,
      background: 'oklch(0.65 0.22 40 / 0.10)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={icon} size={18} style={{ color: 'var(--brand-orange)' }} stroke={1.6} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{channel}</div>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.5px', color: 'var(--muted-fg)' }}>{time}</div>
      </div>
      <div style={{
        fontSize: 13, color: 'var(--muted-fg)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {sender}: {preview}
      </div>
    </div>
    {unread > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--brand-orange)',
          boxShadow: '0 0 6px rgba(249,115,22,0.5)',
        }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-orange)' }}>{unread}</div>
      </div>
    )}
  </div>
);

const ChannelItem = ({ icon, name, time, sender, preview, unread, read }) => (
  <div style={{
    padding: '10px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    opacity: read ? 0.7 : 1,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 6,
      background: 'var(--muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={icon} size={16} style={{ color: 'oklch(0.52 0.01 52 / 0.6)' }} stroke={1.6} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: unread ? 700 : 600 }}>{name}</div>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.5px', color: 'var(--muted-fg)', textTransform: 'uppercase' }}>{time}</div>
      </div>
      <div style={{
        fontSize: 13, color: 'var(--muted-fg)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{sender}: {preview}</div>
    </div>
    {unread > 0 && (
      <div style={{
        minWidth: 18, height: 18, paddingLeft: 6, paddingRight: 6, borderRadius: 9999,
        background: 'var(--brand-orange)', color: '#fff',
        fontSize: 9, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{unread}</div>
    )}
  </div>
);

const DMItem = ({ name, time, preview, unread, read }) => (
  <div style={{
    margin: '0 12px 6px',
    padding: '10px 12px',
    background: unread ? 'oklch(0.99 0.004 60)' : 'var(--muted)',
    border: `1px solid ${unread ? 'oklch(0.91 0.006 55 / 0.5)' : 'oklch(0.91 0.006 55 / 0.3)'}`,
    borderRadius: 10,
    boxShadow: unread ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
    opacity: read ? 0.7 : 1,
    display: 'flex', alignItems: 'center', gap: 12,
    position: 'relative',
  }}>
    <div style={{ position: 'relative' }}>
      <Avatar name={name} size={36} />
      {unread && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 10, height: 10, borderRadius: '50%',
          background: 'var(--success)',
          border: '2px solid var(--background)',
        }} />
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: read ? 'var(--muted-fg)' : 'var(--foreground)' }}>{name}</div>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.5px', color: 'var(--muted-fg)' }}>{time}</div>
      </div>
      <div style={{
        fontSize: 13,
        color: unread ? 'var(--brand-orange)' : 'oklch(0.52 0.01 52 / 0.6)',
        fontWeight: unread ? 500 : 400,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{preview}</div>
    </div>
  </div>
);

// ─── ChatList · Skranke ─────────────────────────────────────
const ChatListSkranke = () => (
  <PhoneChrome>
    <ChatHeader rightSettings />
    <Segment value="skranke" tabs={[
      { id: 'channels', label: 'Chatkanaler' },
      { id: 'skranke', label: 'Skranke', count: 3 },
    ]} />

    <div style={{ overflowY: 'auto', height: 'calc(812px - 44px - 50px - 40px - 82px)' }}>
      {/* Sub-header context */}
      <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 13.5, color: 'var(--muted-fg)' }}>
          Ansvarlig for <span style={{ color: 'var(--brand-orange-dark)', fontWeight: 500 }}>#lønn</span> og <span style={{ color: 'var(--brand-orange-dark)', fontWeight: 500 }}>#hms</span>
        </div>
      </div>

      {/* Skranke rows */}
      <SkrankeRow
        name="Linn Andersen" desk="#lønn"
        summary="Kan jeg jobbe i romjula? Har fått spørsmål om ekstra vakter mellom jul og nyttår."
        time="14 min" waiting
      />
      <SkrankeRow
        name="Kari Holm" desk="#lønn"
        summary="Har ikke fått lønn for fredagsvakten — kan du sjekke?"
        time="1 t"
      />
      <SkrankeRow
        name="Ola Hansen" desk="#hms"
        summary="Hvor finner jeg sjekkliste for åpning av kjøkken?"
        time="3 t"
      />
      <SkrankeRow
        name="Thea Ruud" desk="#lønn"
        summary="Trenger fri 15. november — bursdag. Håper det går greit."
        time="I går" dim
      />
      <SkrankeRow
        name="Mikkel Dahl" desk="#hms"
        summary="Takk! Da er det ordnet."
        time="Man" dim
      />
    </div>

    <TabBar active="komm" />
  </PhoneChrome>
);

const SkrankeRow = ({ name, desk, summary, time, waiting, dim }) => (
  <div style={{
    padding: '14px 20px',
    borderBottom: '1px solid oklch(0.91 0.006 55 / 0.4)',
    display: 'flex', gap: 12, alignItems: 'flex-start',
    opacity: dim ? 0.55 : 1,
  }}>
    <LighthouseAvatar name={name} size={40} halo="idle" />
    <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          color: 'var(--muted-fg)', flexShrink: 0, marginLeft: 8,
        }}>{time}</div>
      </div>
      <div style={{
        fontSize: 13.5, color: 'var(--muted-fg)', lineHeight: 1.45,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>{summary}</div>
      <div style={{
        marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 10.5,
        color: 'var(--brand-orange-dark)', opacity: 0.8,
      }}>{desk}</div>
    </div>
    {waiting && <div style={{ paddingTop: 4 }}><Orb size={12} status="waiting" pulse /></div>}
  </div>
);

// ─── Conversation ───────────────────────────────────────────
const ConvoHeader = ({ channel, members }) => (
  <div style={{
    paddingTop: 8, paddingBottom: 12, paddingLeft: 8, paddingRight: 8,
    background: 'oklch(0.99 0.004 60 / 0.88)',
    backdropFilter: 'blur(12px)',
    borderBottom: '0.5px solid oklch(0.65 0.22 40 / 0.10)',
    display: 'flex', alignItems: 'center', gap: 4,
  }}>
    <button style={btnRound40}><Icon name="arrow-left" size={22} stroke={1.8} /></button>
    <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
      <div style={{
        fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px',
        color: 'var(--brand-orange)',
      }}>#{channel}</div>
      <div style={{
        fontSize: 10, fontWeight: 500, letterSpacing: '2px',
        textTransform: 'uppercase', color: 'oklch(0.52 0.01 52 / 0.6)',
      }}>{members} medlemmer</div>
    </div>
    <button style={btnRound40}><Icon name="phone" size={20} stroke={1.6} style={{ color: 'var(--brand-orange)' }} /></button>
    <button style={btnRound40}><Icon name="video" size={20} stroke={1.6} style={{ color: 'var(--brand-orange)' }} /></button>
    <button style={btnRound40}><Icon name="search" size={20} stroke={1.6} /></button>
  </div>
);
const btnRound40 = {
  width: 40, height: 40, borderRadius: 20,
  border: 'none', background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
};

const Msg = ({ from, self, name, text, time, pending, reactions, system }) => {
  if (system) {
    return (
      <div style={{ alignSelf: 'center', margin: '8px 0' }}>
        <div style={{
          padding: '5px 12px', borderRadius: 9999,
          background: 'var(--muted)', border: '1px solid var(--border)',
          fontFamily: 'var(--font-body)', fontSize: 11.5, fontStyle: 'italic',
          color: 'var(--muted-fg)',
        }}>{text}</div>
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-end',
      flexDirection: self ? 'row-reverse' : 'row',
      alignSelf: self ? 'flex-end' : 'flex-start',
      maxWidth: '80%',
    }}>
      {!self && <Avatar name={from} size={28} ring={false} />}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: self ? 'flex-end' : 'flex-start', minWidth: 0 }}>
        {!self && name && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', marginBottom: 2, paddingLeft: 2 }}>{name}</div>
        )}
        <div style={{
          padding: '8px 13px',
          background: self
            ? 'linear-gradient(135deg, oklch(0.68 0.22 40), oklch(0.62 0.22 38))'
            : 'oklch(0.965 0.005 58)',
          color: self ? '#fff' : 'var(--foreground)',
          borderRadius: self ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          fontSize: 14.5, lineHeight: 1.45,
          boxShadow: self ? '0 1px 2px rgba(249,115,22,0.15)' : 'none',
          wordBreak: 'break-word',
        }}>{text}</div>
        {reactions && (
          <div style={{ display: 'flex', gap: 3, marginTop: 3, paddingLeft: self ? 0 : 2, paddingRight: self ? 2 : 0 }}>
            {reactions.map((r, i) => (
              <div key={i} style={{
                padding: '2px 7px', borderRadius: 9999,
                background: 'var(--card)', border: '1px solid var(--border)',
                fontSize: 11.5,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <span>{r.emoji}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted-fg)', fontSize: 10 }}>{r.count}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9.5,
          textTransform: 'uppercase', letterSpacing: '0.5px',
          color: 'var(--muted-fg)',
          marginTop: 3, paddingLeft: 2, paddingRight: 2,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {pending && <Icon name="clock" size={10} />}
          {time}
        </div>
      </div>
    </div>
  );
};

const Composer = ({ panel = null, withReply = false, withAttachments = false, text = '' }) => {
  const canSend = text.length > 0 || withAttachments;
  return (
    <div style={{
      background: 'oklch(0.99 0.004 60 / 0.92)',
      backdropFilter: 'blur(12px)',
      borderTop: '0.5px solid oklch(0.65 0.22 40 / 0.08)',
      padding: '10px 16px 10px',
    }}>
      {/* Reply bar */}
      {withReply && (
        <div style={{
          background: 'oklch(0.965 0.005 58 / 0.6)',
          border: '1px solid oklch(0.91 0.006 55 / 0.4)',
          borderRadius: 8,
          padding: '8px 10px',
          marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 10,
          borderLeft: '3px solid var(--brand-orange)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-orange)', marginBottom: 1 }}>Svar til Linn</div>
            <div style={{ fontSize: 12, color: 'var(--muted-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Kan jeg jobbe i romjula?</div>
          </div>
          <button style={{
            width: 28, height: 28, borderRadius: 14,
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--muted-fg)',
          }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Attachments strip */}
      {withAttachments && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 10 }}>
          <AttachThumb kind="image" bg="linear-gradient(135deg, #d4814d, #a85a2c)" />
          <AttachThumb kind="video" bg="linear-gradient(135deg, #7b8b9a, #4e5c6a)" />
          <AttachThumb kind="image" bg="linear-gradient(135deg, #86a386, #5d7d5d)" />
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{
          flex: 1, minHeight: 38,
          background: 'oklch(0.965 0.005 58 / 0.5)',
          border: '0.5px solid oklch(0.91 0.006 55 / 0.5)',
          borderRadius: 12,
          padding: 2,
          display: 'flex', alignItems: 'center', gap: 0,
        }}>
          <button style={inlineBtn}>
            <Icon name="camera" size={16} stroke={1.8} style={{ color: 'oklch(0.52 0.01 52 / 0.5)' }} />
          </button>
          <button style={{ ...inlineBtn, color: panel === 'shortcuts' ? 'var(--brand-orange)' : 'oklch(0.52 0.01 52 / 0.5)' }}>
            <Icon name="plus" size={16} stroke={1.8} />
          </button>
          <div style={{
            flex: 1, paddingLeft: 6, paddingRight: 6,
            fontSize: 14, color: text ? 'var(--foreground)' : 'oklch(0.52 0.01 52 / 0.5)',
            lineHeight: 1.4, paddingTop: 10, paddingBottom: 10,
          }}>
            {text || (withReply ? 'Skriv svaret ditt…' : 'Melding')}
          </div>
          <button style={{ ...inlineBtn, color: panel === 'emoji' ? 'var(--brand-orange)' : 'oklch(0.52 0.01 52 / 0.4)' }}>
            <Icon name="smile" size={16} stroke={1.6} />
          </button>
        </div>
        <button style={{
          width: 38, height: 38, borderRadius: 12,
          border: 'none',
          background: 'var(--brand-orange)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(249,115,22,0.28)',
          flexShrink: 0,
        }}>
          <Icon name={canSend ? 'arrow-up' : 'mic'} size={16} stroke={canSend ? 2.5 : 2} />
        </button>
      </div>

      {/* Panels */}
      {panel === 'shortcuts' && <ShortcutPanel />}
      {panel === 'emoji' && <EmojiPanel />}
    </div>
  );
};
const inlineBtn = {
  width: 32, height: 32, borderRadius: 10,
  border: 'none', background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, flexShrink: 0,
};

const AttachThumb = ({ kind, bg }) => (
  <div style={{
    width: 56, height: 56, borderRadius: 10,
    background: bg, position: 'relative', flexShrink: 0,
  }}>
    {kind === 'video' && (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        <Icon name="play" size={18} />
      </div>
    )}
    {kind === 'video' && (
      <div style={{
        position: 'absolute', bottom: 4, left: 4,
        padding: '2px 5px', borderRadius: 4,
        background: 'rgba(0,0,0,0.6)', color: '#fff',
        fontFamily: 'var(--font-body)', fontSize: 7, fontWeight: 700, letterSpacing: '0.5px',
      }}>VIDEO</div>
    )}
    <div style={{
      position: 'absolute', top: -4, right: -4,
      width: 18, height: 18, borderRadius: 9,
      background: 'rgba(0,0,0,0.6)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
    }}>
      <Icon name="x" size={10} stroke={3} />
    </div>
  </div>
);

const ShortcutPanel = () => {
  const items = [
    { icon: 'image', label: 'Bilde', color: '#3b82f6' },
    { icon: 'video', label: 'Video', color: '#f43f5e' },
    { icon: 'calendar-clock', label: 'Skift', color: '#f97316' },
    { icon: 'list-checks', label: 'Oppgave', color: '#22c55e' },
    { icon: 'map-pin', label: 'Lokasjon', color: '#a855f7' },
    { icon: 'book-open', label: 'Manual', color: '#06b6d4' },
    { icon: 'clipboard-list', label: 'Prosedyre', color: '#eab308' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 14 }}>
      {items.map(it => (
        <div key={it.label} style={{
          width: 64, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 5,
          padding: '4px 0',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: `${it.color}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={it.icon} size={18} style={{ color: it.color }} stroke={1.6} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted-fg)', textAlign: 'center' }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
};

const EmojiPanel = () => {
  const emojis = ['👍', '❤️', '😂', '🔥', '👏', '😊', '🙏', '💪', '🎉', '👀', '✅', '💯'];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 12 }}>
      {emojis.map(e => (
        <div key={e} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'oklch(0.965 0.005 58 / 0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{e}</div>
      ))}
    </div>
  );
};

const CallBar = () => (
  <div style={{
    padding: '8px 14px',
    background: 'oklch(0.28 0.06 145)',
    color: '#fff',
    display: 'flex', alignItems: 'center', gap: 10,
  }}>
    <div style={{
      width: 8, height: 8, borderRadius: 4,
      background: 'oklch(0.75 0.18 145)',
      boxShadow: '0 0 8px oklch(0.75 0.18 145)',
    }} />
    <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
      <span>#kveldsvakt-kjøkken</span>
      <span style={{ opacity: 0.6, marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>4 · 08:42</span>
    </div>
    <button style={{
      width: 32, height: 32, borderRadius: 16,
      background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name="mic" size={14} />
    </button>
    <button style={{
      width: 32, height: 32, borderRadius: 16,
      background: 'oklch(0.55 0.22 25)', border: 'none', cursor: 'pointer',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name="phone" size={14} stroke={2.2} />
    </button>
  </div>
);

// ── ConversationScreen variants ────────────────────────────
const messages = [
  { system: true, text: 'Linn opprettet kanalen · 3. feb' },
  { from: 'Linn Andersen', name: 'Linn', text: 'Hei! Er det noen som kan dekke bar lørdag 28. fra 18?', time: '13:42' },
  { from: 'Mikkel Dahl', name: 'Mikkel', text: 'Jeg kan ta den. Skal vi bare flagge det til Sofia?', time: '13:45', reactions: [{emoji:'🙏', count:2}] },
  { from: 'Linn Andersen', name: 'Linn', text: 'Supert, takk! Sofia — ok for deg?', time: '13:46' },
  { self: true, text: 'Helt greit 👍 Mikkel tar lørdag 28.', time: '13:51', reactions: [{emoji:'✅', count:3}] },
  { from: 'Mikkel Dahl', name: 'Mikkel', text: 'Perfekt. Ses da!', time: '13:52' },
];

const ConversationDefault = () => (
  <PhoneChrome>
    <ConvoHeader channel="bar" members={6} />
    <div style={{
      flex: 1, overflowY: 'auto',
      padding: '16px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      height: 'calc(812px - 44px - 68px - 60px - 34px)',
    }}>
      {messages.map((m, i) => <Msg key={i} {...m} />)}
    </div>
    <Composer text="" />
    <HomeIndicator />
  </PhoneChrome>
);

const ConversationShortcuts = () => (
  <PhoneChrome>
    <ConvoHeader channel="bar" members={6} />
    <div style={{
      flex: 1, overflowY: 'auto',
      padding: '16px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      height: 'calc(812px - 44px - 68px - 190px - 34px)',
    }}>
      {messages.slice(-3).map((m, i) => <Msg key={i} {...m} />)}
    </div>
    <Composer panel="shortcuts" text="" />
    <HomeIndicator />
  </PhoneChrome>
);

const ConversationReply = () => (
  <PhoneChrome>
    <ConvoHeader channel="lønn" members={3} />
    <div style={{
      flex: 1, overflowY: 'auto',
      padding: '16px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      height: 'calc(812px - 44px - 68px - 176px - 34px)',
    }}>
      <Msg system text="Linn startet privat sak · 14:09" />
      <Msg from="Linn Andersen" name="Linn" text="Hei Sofia, har fått spørsmål om jeg kan ta ekstra vakter mellom jul og nyttår. Har vi egne regler for romjula?" time="14:09" />
      <Msg self text="24., 25. og 26. er helligdager — 133% tillegg. Resten av romjula er vanlig." time="14:18" />
      <Msg from="Linn Andersen" name="Linn" text="Perfekt, takk." time="14:21" />
    </div>
    <Composer withReply withAttachments text="Da noterer jeg 27.–29. på deg —" />
    <HomeIndicator />
  </PhoneChrome>
);

const HomeIndicator = () => (
  <div style={{
    height: 34, display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
    paddingBottom: 8, background: 'var(--background)',
  }}>
    <div style={{ width: 135, height: 5, borderRadius: 3, background: 'var(--foreground)' }} />
  </div>
);

Object.assign(window, { ChatListChannels, ChatListSkranke, ConversationDefault, ConversationShortcuts, ConversationReply });
