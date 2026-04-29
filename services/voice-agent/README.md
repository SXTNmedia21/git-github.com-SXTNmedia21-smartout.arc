# voice-agent (spike)

LiveKit agent. OpenAI Realtime. Joins rooms, voice dialog.

## Run

```bash
cd services/voice-agent
pnpm install
op run --env-file=.env.template -- pnpm dev
```

## Test

1. Agent autojoiner enhver room som mobile/web kobler til via `livekit-token` Edge Function.
2. Snakk i mikrofon → agent svarer.

## Status

Spike. Ikke gated mot `channel_ai_policy.voice_participation` ennå (ADR-0078). Ikke wired til Smartout-capabilities. Bare bare-bones dialog for å bevise transport+agent-loop.

## Neste

- Capability-tools via `session.functions` (schedule, contract, etc.)
- Channel-gate (purpose=ai_voice fra livekit-token)
- Bytte Anthropic Claude inn (krever STT/TTS-hops)
- Telemetri via `emit()` på conversation events
