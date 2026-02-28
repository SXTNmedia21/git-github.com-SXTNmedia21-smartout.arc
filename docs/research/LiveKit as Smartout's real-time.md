---
title: "LiveKit as Smartout's Real-Time Communication Layer"
id: RESEARCH_LIVEKIT
version: "1.0"
status: canonical
layer: research
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - research
  - livekit
  - webrtc
  - voice
  - video
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# LiveKit as Smartout's real-time communication layer

**LiveKit is the strongest candidate for adding human-to-human voice and video calling to Smartout**, offering an open-source WebRTC SFU with first-class React Native support, built-in SIP telephony, Krisp noise cancellation, and an AI agents framework that could eventually unify your Ultravox and Twilio infrastructure into a single platform. The combination of Apache 2.0 licensing, Deno-compatible server SDK (critical for Supabase Edge Functions), and a mature Expo plugin makes it uniquely well-suited for Smartout's existing stack. The primary trade-off: LiveKit provides media transport primitives, not a turnkey calling product — you must build call signaling (ringing, accept/reject), push notifications, and call state management yourself. Estimated effort for a voice calling MVP is **4–6 weeks with two developers** or 8–12 weeks solo, with video adding 3–4 weeks incrementally.

---

## How LiveKit's SFU architecture works under the hood

LiveKit is a **Selective Forwarding Unit** written in Go on top of the Pion WebRTC stack. Unlike peer-to-peer WebRTC (which degrades beyond 3–4 participants) or MCU servers (which decode and re-encode every stream), the SFU receives each publisher's encoded media once and forwards copies to every subscriber without touching the packets. This eliminates transcoding latency while scaling to hundreds of participants per room.

The core abstractions are straightforward. **Rooms** are identified by string names and auto-create when the first participant connects, auto-close when the last leaves. **Participants** each hold a unique identity string and can be humans, AI agents, or SIP phone callers. **Tracks** represent individual media streams (microphone, camera, screen share) that can be published, subscribed to, muted, and unmuted independently. **Simulcast** is enabled by default — publishers encode three spatial quality layers, and the SFU's StreamAllocator selects the appropriate layer per subscriber based on available bandwidth and rendered video dimensions. **Dynacast** further optimizes by pausing encoding of layers nobody is subscribing to.

For horizontal scaling, nodes coordinate through **Redis** as both a data store and message bus. All participants in a room connect to the same node; LiveKit Cloud extends this with a globally distributed mesh using a custom FlatBuffers-based protocol for server-to-server media relay. The open-source server (17.1k GitHub stars) is identical to the Cloud version — only the endpoint URL changes, making migration between self-hosted and cloud seamless.

### Cloud vs self-hosted deployment

| Dimension         | Self-hosted (Apache 2.0)      | LiveKit Cloud                                       |
| ----------------- | ----------------------------- | --------------------------------------------------- |
| **Cost**          | Infrastructure only           | Free → Ship ($50/mo) → Scale ($500/mo) → Enterprise |
| **Scaling**       | Manual via Redis + Kubernetes | Automatic elastic scaling                           |
| **Agent hosting** | Self-managed                  | Managed deployment, scaling, isolation              |
| **Telephony**     | SIP self-managed              | Native phone numbers + SIP integration              |
| **Observability** | Build your own                | Built-in analytics, quality metrics dashboard       |
| **SLA**           | Self-managed                  | 99.99% uptime guarantee                             |
| **Edge network**  | Deploy your own multi-region  | Global edge, auto-routing to closest node           |

### EU and Nordic region availability

LiveKit Cloud's `eu` region includes **France, Germany, and Zurich** — no dedicated Nordic node exists. Norwegian users connect to the closest EU data center with typical latencies of **10–30ms** to Frankfurt or Zurich. Region pinning (restricting all traffic to EU for GDPR compliance) is available on the **Scale plan or higher** and must be enabled by LiveKit support. For self-hosted deployments, you can place servers in AWS `eu-north-1` (Stockholm) for optimal Nordic latency.

### What's free vs what's paid

Every LiveKit SDK, the server binary, and the Agents framework are **Apache 2.0 licensed** — genuinely free to use, modify, and self-host. What costs money: LiveKit Cloud's managed infrastructure, managed agent hosting, built-in inference (running STT/TTS on LiveKit's GPUs), native phone numbers, and the analytics dashboard. Krisp noise cancellation is available on both Cloud and self-hosted but subject to LiveKit's commercial license terms.

---

## Voice calling: what's built-in and what you build yourself

LiveKit provides the media transport layer but deliberately does not include a call signaling system. There is no built-in ringing screen, accept/reject flow, or "on hold" state. The core philosophy is room-based: participants connect to named rooms via JWT tokens, and media flows automatically. For Smartout's WhatsApp-style tap-to-call, you build a thin signaling layer on top.

**The call flow for 1:1 voice calls** would work like this: User A taps "call" → your backend creates a LiveKit room (or generates a token for an auto-created room) → backend broadcasts a call invite via Supabase Realtime to User B → User B's device shows an incoming call UI → on accept, User B fetches a token from your backend and joins the room → audio flows. For missed calls, you send push notifications via FCM (Android) or VoIP push + CallKit (iOS). The `room_finished` webhook tells your backend when to log call duration and detect unanswered calls.

**Group voice calls** work identically — a room simply has more participants. LiveKit's **Opus DTX** (Discontinuous Transmission) drops audio streams to ~1kbps during silence, making large group channels bandwidth-efficient. For a Discord-style always-on voice channel, keep the room persistent with a generous `emptyTimeout`.

### Audio quality and noise cancellation

LiveKit defaults to **Opus at 20kbps** with Audio RED (redundant encoding) for packet loss resilience. The Krisp integration runs noise cancellation models **locally on-device** — no audio is sent to Krisp servers, and latency impact is negligible. On web, install `@livekit/krisp-noise-filter`; on React Native, install `@livekit/react-native-krisp-noise-filter` which bundles the models directly. The standard NC model removes background noise; a Background Voice Cancellation model (removes other speakers' voices) is available only in agent code. Echo cancellation uses WebRTC's built-in `echoCancellation` plus optional server-side AudioProcessingModule.

One critical rule: **never enable Krisp on both the client and an AI agent simultaneously** — the models are trained on raw audio and double-processing creates artifacts.

### Background audio on React Native

This is one of the trickier integration points. On **iOS**, you must enable `audio` and `voip` UIBackgroundModes and integrate CallKit via `react-native-callkeep`. When CallKit activates the audio session, you must call `RTCAudioSession.audioSessionDidActivate`; when it deactivates, call the corresponding deactivate method. Without CallKit, iOS will suspend your app within seconds of backgrounding. iOS 18+ additionally supports background camera access with `enableMultitaskingCameraAccess = true`.

On **Android**, initialize with `AudioType.CommunicationAudioType()` in `MainApplication.java` and use a foreground service for persistent background audio. Android is generally more permissive than iOS here.

---

## Push-to-talk implementation pattern

LiveKit does not ship a dedicated PTT API, but the pattern is well-supported through existing primitives. The recommended approach uses **persistent room connections with mute/unmute toggling**:

```typescript
// React component for push-to-talk
import { useLocalParticipant } from '@livekit/components-react';

function PushToTalkButton() {
  const { localParticipant } = useLocalParticipant();

  const handlePressStart = async () => {
    await localParticipant.setMicrophoneEnabled(true);
  };

  const handlePressEnd = async () => {
    await localParticipant.setMicrophoneEnabled(false);
  };

  return (
    <button
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
    >
      🎤 Push to Talk
    </button>
  );
}
```

All participants stay connected to the room with microphones muted by default. On PTT button press, the mic unmutes; on release, it mutes. Since the WebRTC connection is already established, **mute/unmute is a signaling operation — near-instantaneous**, far faster than connecting/disconnecting per transmission. Active speaker detection fires via `RoomEvent.ActiveSpeakersChanged`, providing both speaker identity and audio level. LiveKit even has an official push-to-talk agent example in their GitHub repo demonstrating controlled multi-participant conversations with AI agents.

The alternative approach — connecting to the room only when speaking — is explicitly **not recommended**. Listeners need time to establish the WebRTC handshake (ICE gathering, DTLS) and will miss the beginning of each transmission.

---

## Video calling, screen sharing, and recording

Video calls build on the same room infrastructure. Enable camera alongside microphone, and LiveKit's simulcast automatically publishes three quality layers. The SFU's **Adaptive Stream** feature detects the rendered video element size on each subscriber and requests only the appropriate resolution — a participant displayed in a small thumbnail receives 180p, while a spotlighted speaker gets 720p. Combined with Dynacast (which stops encoding unused layers), this minimizes both bandwidth and CPU.

**Camera switching** on React Native uses `room.switchActiveDevice('videoinput', deviceId)` or `facingMode: 'environment'` when creating a track — important for Smartout's HACCP inspection use case where employees need to show food safety issues via the back camera.

**Screen sharing** is supported across platforms with varying complexity: trivial on web (`setScreenShareEnabled(true)`), moderate on Android (MediaProjection), and more involved on iOS (requires a Broadcast Upload Extension with a shared App Group for system-wide capture).

### Recording via the Egress service

LiveKit's Egress pipeline handles all recording server-side. Four egress types exist:

- **RoomComposite**: Renders all participants through headless Chrome into a single composited video (grid, speaker, or custom React layout) → outputs MP4, HLS, or RTMP
- **TrackComposite**: Records synchronized audio+video of a single participant
- **Track**: Exports individual raw tracks without transcoding
- **Web**: Records any arbitrary web page

Storage destinations include **S3, Google Cloud Storage, and Azure Blob** — and since Supabase Storage exposes an S3-compatible API, recordings can flow directly into Supabase with `force_path_style: true`. Recording lifecycle is tracked via `egress_started`, `egress_updated`, and `egress_ended` webhook events. One important constraint: **E2EE and server-side recording are mutually exclusive** since the server cannot decode encrypted streams.

---

## SIP telephony: calling employees on their actual phones

LiveKit's SIP bridge enables the platform to place and receive actual phone calls by bridging PSTN audio into LiveKit rooms. The architecture has three layers: the LiveKit server (manages SIP trunks and dispatch rules), the LiveKit SIP service (mediates SIP requests), and a third-party SIP provider for PSTN connectivity.

**Outbound calling flow**: Your backend calls `CreateSIPParticipant` with the employee's phone number → LiveKit creates a SIP participant in a room and places the call via your configured trunk → the employee's phone rings → when answered, bidirectional audio flows through the room. The SIP participant appears as a regular room participant, meaning AI agents and human callers can coexist in the same call.

**Twilio integration is fully supported** with dedicated documentation. Configure a Twilio Elastic SIP Trunk with domain ending in `.pstn.twilio.com`, set origination URIs pointing to your LiveKit SIP URI, and use credential-based authentication for outbound. LiveKit's SIP bridge also works with Telnyx, Plivo, Wavix, and SignalWire. For **Norway specifically**, you need a third-party provider with Norwegian number coverage — LiveKit's native phone numbers currently only offer US local and toll-free numbers.

SIP participants track call states via attributes: `sip.callStatus` transitions through `dialing` → `ringing` → `active` → `hangup`. SIP participants are billed at the **SIP minute rate** ($0.003–$0.004/min) and are NOT charged WebRTC connection minutes, simplifying cost calculations.

---

## Pricing breakdown and cost modeling

### LiveKit Cloud tiers

| Plan             | Base cost | WebRTC minutes | SIP minutes    | Bandwidth      | Agent minutes  |
| ---------------- | --------- | -------------- | -------------- | -------------- | -------------- |
| **Build** (free) | $0/mo     | 5,000          | 1,000          | 50 GB          | 1,000          |
| **Ship**         | $50/mo    | 150,000        | 5,000          | 250 GB         | 5,000          |
| **Scale**        | $500/mo   | 1,500,000      | 50,000         | 3 TB           | 50,000         |
| **Enterprise**   | Custom    | Volume pricing | Volume pricing | Volume pricing | Volume pricing |

Overage rates on Ship: **$0.0005/WebRTC-min**, **$0.004/SIP-min**, $0.12/GB bandwidth. On Scale: $0.0004, $0.003, $0.10 respectively.

### Monthly cost estimates for Smartout

Assumptions: 22 working days/month, 30 min average calls/day/employee, mix of SIP and WebRTC calls. Twilio SIP trunk costs added separately (~$0.01/min US, **~$0.03/min for Norwegian mobile numbers**).

| Scenario                       | LiveKit Cloud | Twilio SIP trunk (Norway) | **Total estimated** |
| ------------------------------ | ------------- | ------------------------- | ------------------- |
| **50 employees** (Ship plan)   | ~$187/mo      | ~$990/mo                  | **~$1,177/mo**      |
| **100 employees** (Ship plan)  | ~$375/mo      | ~$1,980/mo                | **~$2,355/mo**      |
| **500 employees** (Scale plan) | ~$1,502/mo    | ~$9,900/mo                | **~$11,402/mo**     |

The Twilio SIP termination cost for Norwegian mobile numbers dominates total spend. If most calls are **app-to-app** (WebRTC only, no PSTN), costs drop dramatically — the 50-employee scenario falls to roughly **$50–100/month** since WebRTC minutes are included in the base plan.

### Self-hosted cost comparison

Self-hosting eliminates LiveKit Cloud fees but introduces infrastructure and DevOps overhead:

| Scale     | AWS infrastructure | Twilio SIP | DevOps overhead  | **Total**             |
| --------- | ------------------ | ---------- | ---------------- | --------------------- |
| 50 users  | ~$278/mo           | ~$990/mo   | $5,000–15,000/mo | **$6,268–16,268/mo**  |
| 500 users | ~$2,654/mo         | ~$9,900/mo | $5,000–15,000/mo | **$17,554–27,554/mo** |

**Self-hosting only makes economic sense at very high scale** (thousands of concurrent users) or when data sovereignty requirements mandate it. For Smartout's 50–500 employee range, LiveKit Cloud is significantly more cost-effective.

### How competitors compare on per-minute rates

| Provider         | Audio rate                  | Video rate         | SIP/PSTN         | Open source | Self-host |
| ---------------- | --------------------------- | ------------------ | ---------------- | ----------- | --------- |
| **LiveKit**      | $0.0004–0.0005/min (WebRTC) | Same as audio      | $0.003–0.004/min | ✅          | ✅        |
| **Agora**        | $0.00099/min                | $0.00399/min (HD)  | Limited          | ❌          | ❌        |
| **Daily.co**     | $0.00099/min                | $0.004/min         | $0.025/min       | ❌          | ❌        |
| **Twilio Voice** | $0.014/min (outbound)       | $0.004/min (video) | Native           | ❌          | ❌        |
| **Vonage**       | $0.00395/min                | $0.00395/min       | Available        | ❌          | ❌        |
| **Stream**       | ~$0.001/min                 | $0.002–0.005/min   | ❌               | Partial     | ❌        |

Agora and Daily.co offer the cheapest pure WebRTC audio. LiveKit's competitive advantage is the combination of low WebRTC rates, integrated SIP, open-source self-hosting, and the AI agents framework — no competitor matches all four.

---

## LiveKit vs the alternatives: what matters for Smartout

### Why LiveKit wins over Twilio for media

Twilio's Programmable Video had a near-death experience — announced sunset in December 2023, extended EOL to December 2026, then reversed the decision entirely in October 2024. This whiplash eroded developer trust, and the Video SDK saw no commits for six months during the uncertainty period. Twilio's voice rates ($0.014/min outbound) are **28× more expensive** than LiveKit's WebRTC connection minutes. A real-world case study found Twilio Voice cost ~$200/month per teacher for group calls; self-hosted LiveKit on a $60/month EC2 instance handled 200 concurrent users. **Keep Twilio exclusively for SIP trunking and Norwegian phone numbers** — it remains best-in-class for telephony primitives — but use LiveKit for all in-app media.

### Stream deserves consideration for unified chat + calling

Stream (getstream.io) is the only platform offering **production-grade chat and video/audio SDKs in a single integration**. Since Smartout needs both chat and calling, Stream eliminates the dual-vendor complexity. Their React Native SDK is excellent with prebuilt UI components. However, Stream lacks SIP/PSTN support (still need Twilio for phone calls), has no self-hosting option, and its AI agent framework is less mature than LiveKit's. If chat UX is the primary bottleneck, Stream is worth evaluating; if AI voice agents and telephony integration matter more, LiveKit wins.

### Daily.co is the strongest managed alternative

Daily.co offers the fastest time-to-market with Daily Prebuilt (embed a working video call in minutes), built-in telephony ($0.025/min PSTN), and created the Pipecat open-source AI agent framework. For a team wanting minimal DevOps, Daily is compelling. The trade-offs: no self-hosting, less low-level control, and per-participant-minute pricing that compounds at scale.

### Ultravox and LiveKit are complementary, not competing

Ultravox is a **speech-native AI voice model** — it understands audio directly without an ASR pipeline, achieving ~150ms time-to-first-token. It cannot do human-to-human calls, video, chat, room management, or SIP/PSTN. LiveKit handles all of those. The recommended architecture uses Ultravox as the AI "brain" with LiveKit as the transport "plumbing." However, LiveKit Agents provides its own voice pipeline (STT → LLM → TTS) that could eventually replace Ultravox entirely if the team prefers single-vendor infrastructure.

---

## SDK integration and concrete code examples

### Key packages and versions

| Package                                    | Version | Purpose                                |
| ------------------------------------------ | ------- | -------------------------------------- |
| `livekit-client`                           | 2.17.2  | Browser/JS client SDK                  |
| `@livekit/components-react`                | 2.9.20  | React components and hooks for Next.js |
| `livekit-server-sdk`                       | 2.15.0  | Server SDK (Node.js, **Deno**, Bun)    |
| `@livekit/react-native`                    | 2.9.6   | React Native client SDK                |
| `@livekit/react-native-expo-plugin`        | 1.0.1   | Expo config plugin                     |
| `@livekit/react-native-webrtc`             | 137.0.2 | WebRTC native module for RN            |
| `@livekit/krisp-noise-filter`              | latest  | Krisp NC for web                       |
| `@livekit/react-native-krisp-noise-filter` | latest  | Krisp NC for mobile                    |

### Token generation from Supabase Edge Functions (Deno)

The `livekit-server-sdk` v2 explicitly supports **Deno**, making it directly usable in Supabase Edge Functions without any shims:

```typescript
// supabase/functions/livekit-token/index.ts
import { AccessToken } from "livekit-server-sdk";

Deno.serve(async (req) => {
  const { roomName, participantName } = await req.json();

  const at = new AccessToken(
    Deno.env.get("LIVEKIT_API_KEY")!,
    Deno.env.get("LIVEKIT_API_SECRET")!,
    { identity: participantName, ttl: "6h" },
  );

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt(); // async in v2
  return new Response(JSON.stringify({ token }));
});
```

### Token generation from Next.js API route (App Router)

```typescript
// app/api/livekit-token/route.ts
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: Request) {
  const { roomName, participantName } = await req.json();

  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity: participantName,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return Response.json({ token });
}
```

### Room management from server-side code

```typescript
import { RoomServiceClient } from "livekit-server-sdk";

const svc = new RoomServiceClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!,
);

// Create a room explicitly (also auto-creates on first join)
const room = await svc.createRoom({
  name: "ws_abc123:ch_voice_456", // workspace:channel naming
  emptyTimeout: 600, // close after 10 min empty
  maxParticipants: 20,
});

// List all active rooms
const rooms = await svc.listRooms();

// Remove a participant
await svc.removeParticipant("ws_abc123:ch_voice_456", "user_123");
```

### React component integration (Next.js web dashboard)

```tsx
"use client";
import { LiveKitRoom, useChat, useTracks, useParticipants } from "@livekit/components-react";
import "@livekit/components-styles";

export function VoiceCall({ token, roomName }: { token: string; roomName: string }) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      audio={true}
      video={false} // voice-only for Phase 1
    >
      <ActiveCall />
    </LiveKitRoom>
  );
}

function ActiveCall() {
  const participants = useParticipants();
  const { chatMessages, send } = useChat();

  return (
    <div>
      <p>{participants.length} participants in call</p>
      {/* Audio tracks auto-play via LiveKitRoom */}
    </div>
  );
}
```

### React Native + Expo setup

```bash
npx expo install livekit-client @livekit/react-native \
  @livekit/react-native-expo-plugin @livekit/react-native-webrtc \
  @config-plugins/react-native-webrtc
```

```json
// app.json
{
  "expo": {
    "plugins": ["@livekit/react-native-expo-plugin", "@config-plugins/react-native-webrtc"]
  }
}
```

```typescript
// index.ts — MUST call before anything else
import { registerGlobals } from "@livekit/react-native";
registerGlobals();
```

```tsx
// VoiceCallScreen.tsx
import { AudioSession, LiveKitRoom } from "@livekit/react-native";
import { useEffect } from "react";

export function VoiceCallScreen({ token }: { token: string }) {
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      audio={true}
      video={false}
      options={{ adaptiveStream: { pixelDensity: "screen" } }}
    >
      {/* Call UI components */}
    </LiveKitRoom>
  );
}
```

**Critical**: LiveKit requires **Expo development builds** — it is NOT compatible with Expo Go due to native code dependencies. Run `npx expo prebuild` and build with `npx expo run:ios` / `npx expo run:android`.

---

## GDPR compliance and data privacy for the Norwegian market

LiveKit is **GDPR compliant** with a comprehensive Data Processing Addendum supporting EU Standard Contractual Clauses and the EU-U.S. Data Privacy Framework. They hold **SOC 2 Type II** certification covering confidentiality, security, and availability, plus HIPAA compliance with BAA available.

**EU data residency** is achievable through region pinning on the Scale plan ($500/mo). The `eu` region includes Germany and France data centers. When enabled, all media traffic stays within EU boundaries — though this disables automatic regional failover. LiveKit never records or stores audio/video streams unless explicitly requested via the Egress API, and recordings upload directly to YOUR storage bucket. Analytics data is retained for a maximum of **14 days** and encrypted with AES-256.

**End-to-end encryption** uses AES-GCM across all platforms (web, iOS, Android, React Native) at no additional cost. The React Native SDK provides a `useRNE2EEManager` hook. Key rotation and custom key providers (compatible with MEGOLM and MLS protocols) are supported. The critical caveat: **E2EE and server-side recording are mutually exclusive** — encrypted streams cannot be decoded by the Egress service. For Smartout's compliance recording needs, you would need to choose between E2EE and call recording on a per-room basis.

For **Norwegian labor law compliance** around call recording: LiveKit provides `Room.isRecording` property and `RecordingStatusChanged` events to display recording indicators, and the `roomRecord` token permission controls who can initiate recording. Consent UI must be built at the application layer.

---

## LiveKit Agents: unifying AI and human voice

The Agents framework (8.4k+ GitHub stars) enables AI participants that join LiveKit rooms as regular participants. This is the key architectural insight: **an AI agent, a human on a phone, and a human on the mobile app are all just participants in the same room**.

Mr. Botsson could absolutely join a LiveKit room:

```python
from livekit.agents import AgentSession, Agent
from livekit.plugins import openai, deepgram, cartesia, silero

async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
    session = AgentSession(
        stt=deepgram.STT(),
        llm=openai.LLM(model="gpt-4o"),
        tts=cartesia.TTS(),
        vad=silero.VAD.load(),
    )
    await session.start(
        room=ctx.room,
        agent=Agent(
            instructions="You are Mr. Botsson, a helpful assistant for "
            "Smartout hospitality employees. You speak Norwegian and English."
        )
    )
```

The agent can be **explicitly dispatched** to specific rooms via API or token configuration, meaning Mr. Botsson could be invited into an ongoing human-to-human call for translation, note-taking, or HACCP guidance. Agents support STT providers (Deepgram, OpenAI Whisper, AssemblyAI), LLM providers (GPT-4o, Claude, Gemini), TTS providers (Cartesia, ElevenLabs, PlayHT), and even OpenAI's Realtime API for direct speech-to-speech.

**Can this replace Ultravox?** Potentially yes. LiveKit Agents provides the same STT → LLM → TTS pipeline with broader provider choice and native room integration. Ultravox's advantage is its speech-native model (audio-in, text-out without ASR) achieving ~150ms latency. The pragmatic migration path: start with LiveKit for human-to-human calls, keep Ultravox for AI voice quality, and evaluate whether LiveKit Agents can match Ultravox's latency once the infrastructure is stable.

---

## Migration architecture and Smartout-specific integration

### How LiveKit maps to Smartout's data model

Use a **room naming convention** like `{workspace_id}:{channel_id}` to bind LiveKit rooms to Smartout's `chat_channel` records. When a user initiates a call from a channel, generate a token scoped to that room name. Multi-tenant isolation is enforced at the token level — tokens encode the specific room name, and users can only join rooms they have tokens for. Server-side validation in your token endpoint verifies workspace membership before issuing tokens.

### Hybrid architecture with Supabase Realtime

- **Supabase Realtime**: Text chat messages, presence/typing indicators, channel metadata, call invite signaling
- **LiveKit**: Voice audio, video streams, screen sharing, AI agent audio
- **Bridge pattern**: Call invite broadcast via Supabase Realtime channel → recipient fetches LiveKit token → joins room

### Webhook integration for call tracking

Configure LiveKit webhooks to POST to a Next.js API route or Supabase Edge Function. Key events: `participant_joined`/`participant_left` (update call status in PostgreSQL), `room_finished` (log call duration, trigger n8n automation for analytics), `egress_ended` (save recording URL to Supabase). The `WebhookReceiver` class validates signatures using your API key/secret.

---

## Realistic development effort and known gotchas

### Phase 1: Voice calling MVP — 4–6 weeks (2 developers)

| Stream             | Components                                                                                                                             | Effort    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **Backend**        | Token endpoint, room management, webhook handler, call signaling via Supabase Realtime, push notification integration, database schema | 2–3 weeks |
| **Web client**     | Call UI (ringing/in-call/ended), audio controls, chat channel integration                                                              | 2–3 weeks |
| **Mobile client**  | LiveKit RN SDK setup, call UI, CallKit (iOS), foreground service (Android), push notifications                                         | 3–4 weeks |
| **Infrastructure** | LiveKit Cloud setup, webhook config, environment variables                                                                             | 1–2 days  |

### Phase 2: Video calls — 3–4 weeks incremental

Video track publishing, grid/spotlight layouts, camera switching, screen sharing, recording via Egress, bandwidth optimization.

### Known Expo gotchas to plan for

- **No Expo Go**: Must use development builds (`npx expo prebuild`). Physical device testing required
- **Expo 53 build failures**: `@livekit/react-native-expo-plugin` may need removal and reinstallation
- **`expo-doctor` warnings**: Reports "Unsupported on New Architecture" for LiveKit packages — these are false alarms; the SDK works correctly
- **`navigator.userAgent` undefined**: A bug in `getBrowser()` throws `TypeError` in React Native, silently preventing track publishing — check for SDK updates addressing this
- **iOS background audio complexity**: CallKit integration requires careful `AudioSession` lifecycle management
- **Version mismatches**: Ensure `livekit-client` and `@livekit/react-native` versions are compatible; mismatches can cause connections stuck at "connecting"

---

## Conclusion: the recommended path forward

LiveKit is the right choice for Smartout's communication layer. No alternative matches its combination of open-source flexibility, integrated SIP telephony, AI agent framework, and React Native/Expo support. The recommended architecture uses **LiveKit Cloud (Ship or Scale plan)** for media transport, **Twilio SIP trunking** for Norwegian PSTN connectivity, **Supabase Realtime** for chat messages and call signaling, and **LiveKit Agents** as the long-term replacement for the Ultravox pipeline.

The total cost for 50 employees with mostly app-to-app calls lands around **$50–200/month** on LiveKit Cloud — PSTN calls to Norwegian mobile numbers add $990+/month via Twilio SIP. The biggest development investment is the call signaling layer and iOS background audio, not the LiveKit integration itself. Start with voice-only on the Ship plan, add video incrementally, and evaluate migrating Mr. Botsson to LiveKit Agents once the infrastructure proves stable.
