// prototype/prototype-canvas.jsx — wires everything together
// Lays out the three surfaces on a design canvas:
//   · Web — Channel Settings (modal) + Helpdesk ticket
//   · Mobile — Profile settings, Helpdesk queue, Ticket detail

const Stamp = ({ children, color = 'var(--brand-orange)', rotate = -4, style = {} }) => (
  <div style={{
    display: 'inline-block',
    fontFamily: '"Instrument Serif", Georgia, serif',
    fontStyle: 'italic', fontSize: 14,
    color, opacity: 0.8,
    transform: `rotate(${rotate}deg)`,
    ...style,
  }}>{children}</div>
);

function Root() {
  return (
    <DesignCanvas>
      <DCSection id="web" title="Web · desktop" subtitle="1280 × 860 — modal settings surface + helpdesk conversation">
        <DCArtboard id="settings" label="Channel Settings · Skranke tab" width={1280} height={860}>
          <WebSettings />
        </DCArtboard>
        <DCArtboard id="helpdesk" label="Helpdesk · ticket conversation" width={1280} height={860}>
          <WebHelpdesk />
        </DCArtboard>
        <DCPostIt top={-30} left={60} rotate={-3} width={220}>
          The Skranke tab lives inside channel settings — that's the primary way a channel becomes a helpdesk.
        </DCPostIt>
      </DCSection>

      <DCSection id="chat" title="Chat · iOS" subtitle="375 × 812 — liste-skjermer + ConversationScreen (by-the-book etter spec)">
        <DCArtboard id="chat-channels" label="Chat-liste · Chatkanaler" width={375} height={812}>
          <ChatListChannels />
        </DCArtboard>
        <DCArtboard id="chat-skranke" label="Chat-liste · Skranke" width={375} height={812}>
          <ChatListSkranke />
        </DCArtboard>
        <DCArtboard id="convo-default" label="ConversationScreen · default" width={375} height={812}>
          <ConversationDefault />
        </DCArtboard>
        <DCArtboard id="convo-shortcuts" label="ConversationScreen · shortcuts" width={375} height={812}>
          <ConversationShortcuts />
        </DCArtboard>
        <DCArtboard id="convo-reply" label="ConversationScreen · reply + attachments" width={375} height={812}>
          <ConversationReply />
        </DCArtboard>
        <DCPostIt top={-30} left={60} rotate={-2} width={240}>
          Skranke-segment er listen over åpne saker du er ansvarlig for — pulserende orb = venter på deg.
        </DCPostIt>
      </DCSection>

      <DCSection id="mobile" title="Mobile · iOS" subtitle="375 × 812 — settings, queue, ticket detail">
        <DCArtboard id="settings-mobile" label="Profile · Settings" width={375} height={812}>
          <MobileSettings />
        </DCArtboard>
        <DCArtboard id="queue-mobile" label="Helpdesk · Min kø" width={375} height={812}>
          <MobileQueue />
        </DCArtboard>
        <DCArtboard id="ticket-mobile" label="Ticket detail · private case" width={375} height={812}>
          <MobileTicket />
        </DCArtboard>
        <DCPostIt top={-30} left={60} rotate={-2} width={240}>
          Min kø is a first-class tab — ansvarlige open it dozens of times a day. Pulsing orb = someone's waiting.
        </DCPostIt>
        <DCPostIt top={400} right={-60} rotate={3} width={200}>
          FAB on ticket = Løs sak. Single, clear primary action per screen.
        </DCPostIt>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
