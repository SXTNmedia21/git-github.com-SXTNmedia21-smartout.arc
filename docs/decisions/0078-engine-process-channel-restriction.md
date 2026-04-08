---
title: Engine Process Channel Restriction
id: ADR_0078
status: accepted
layer: decision
created: 2026-04-08
updated: 2026-04-08
---

# ADR-0078: Engine Process Channel Restriction

## Context and Problem Statement

Dagens `engine_process` kan kjøres i enhver `SessionChannel`
(`voice | sms | chat | email | autonomous | telegram`) uten restriksjon.
Dette er greit for de fleste prosesser, men noen prosesser håndterer kritisk
data (personnummer, bankkonto) som aldri skal passere gjennom voice-kanalen.
Uten håndhevelse på engine-nivå må hver capability self-enforce — det er
skjørt og bypassbart.

Council session 2026-04-07 identifiserte at det ikke finnes noen mekanisme på
process-nivå for å låse hvilke kanaler som kan kjøre hvilke prosesser. Samtidig
ble et forslag om `human_only: true` flag avvist fordi det overlappet med tre
eksisterende mekanismer (C4 authority, `collect_signature`, capability-level
guards).

Spørsmålet: hvordan uttrykker vi "denne prosessen kan kun kjøre i chat-kanal"
uten å oppfinne et fjerde parallelt permission-system?

## Decision Drivers

- Voice-forbud for kritisk datainnsamling er en produkt-rule (council 2026-04-07)
- LLM-prompt-instruksjoner er ikke pålitelig håndheving (hallusinering,
  jailbreak)
- Eksisterende permission-mekanismer (C4 authority, `allowed_channels`,
  `collect_signature`) må ikke dupliceres
- ADR-0076 (Contract Composition as Cascade Derivation) avhenger av at
  data-intake prosessen garantert ikke kan kjøre i voice
- Cascade invariant #2: hver datum har én rolle

## Considered Options

1. **Capability-level flag alene** — `CapabilityDefinition.allowedChannels`.
   Fungerer, men håndhever kun når capability sin tool blir kalt. Hvis en
   capability er aktiv i en process sammen med andre, kan feil kanal slippe
   gjennom ved andre tools.
2. **Process-level `allowed_channels` alene** — sjekkes ved process-start i
   dispatcher. Hard stopp før noen tools kalles. Men capability-level
   defence in depth mangler.
3. **Tool-level flag alene** — hver tool self-checks
   `AgentToolContext.channel`. Maksimal granularitet men lett å glemme;
   enforcement er spredt over mange filer.
4. **`human_only: true` flag på engine_step** — avvist i council: overlapper
   C4 authority (permission er allerede C4 sitt ansvar), duplikerer
   `collect_signature`-handlerens eksisterende wait-for-webhook-semantikk.
5. **Multi-layer: process + capability + tool** — process hard-stop,
   capability som backup, tool som final guard. Defence in depth.

## Decision Outcome

Chosen option: **"Multi-layer: process + capability + tool"**, because
enforcement av PII-regler kan ikke avhenge av ett enkelt lag. LLM-context
kompromiss, capability-glemsel, eller process-config-feil skal aldri alene
føre til at personnummer snakkes over voice.

### Implementasjon

**Layer 1 — Process-level (canonical):**

```sql
ALTER TABLE engine_process
  ADD COLUMN allowed_channels TEXT[] NOT NULL
  DEFAULT ARRAY['chat', 'voice', 'sms', 'email', 'autonomous', 'telegram'];
```

Dispatcher (`services/stage-engine/src/core/dispatcher.ts` eller tilsvarende):
ved process-start, sjekk om `session.channel` er i `process.allowed_channels`.
Hvis ikke, refuser med `ProcessChannelNotAllowedError` og logg til telemetry.

**Layer 2 — Capability-level (defence in depth):**

```ts
// packages/ai/src/capabilities/types.ts
export type CapabilityDefinition = {
  // ... existing fields
  allowedChannels?: SessionChannel[]; // undefined = all allowed
};
```

Tool-selector (`packages/ai/src/router/tool-selector.ts`): filtrer ut
capabilities hvis `capability.allowedChannels` ikke inkluderer
`session.channel`. Capability er usynlig for agenten i feil kanal — ingen
mulighet for tool-call.

**Layer 3 — Tool-level (final guard):**

```ts
// packages/ai/src/capabilities/types.ts
export type AgentToolContext = {
  // ... existing fields
  channel: SessionChannel;       // NEW
  processId?: string;            // NEW
  engineStateId?: string;        // NEW
};
```

Sensitive tools (intake-tools spesielt) self-check:
```ts
if (ctx.channel !== 'chat') {
  throw new ToolInvocationError('This tool is chat-only');
}
```

### Process-level seeding

`contract_data_intake` seed-row får `allowed_channels = ['chat']`.
`contract_signing` seed-row får `allowed_channels = ['chat']` (signering
krever visuell tilgang til kontrakten).

### Error handling

Når dispatcher refuser process-start pga channel-mismatch:

- Returner strukturert feil til calleren
- Emit telemetry: `engine.process.channel_rejected`
- I agent-kontekst: Botsson må svare "Dette kan jeg ikke hjelpe deg med her.
  Jeg åpner chat så vi kan fortsette der." (UX-handoff — implementation TBD
  for voice→chat session switch)

## Rules & Consequences

- **Good, because** voice-forbud er håndhevet på dispatch-nivå — LLM kan ikke
  bypassa det ved kreativ prompt-engineering
- **Good, because** defence in depth: tre uavhengige lag må feile samtidig
  for at feil kanal skal slippe gjennom
- **Good, because** capability-level filter gjør sensitive tools usynlige
  for agenten i feil kanal — ingen prompt-leakage av tool-definisjoner
- **Good, because** ingen nye parallelle permission-mekanismer;
  `allowed_channels` og C4 authority er komplementære (hva vs hvem)
- **Bad, because** `AgentToolContext` får 3 nye felt som må propageres
  gjennom alle capability call-sites
- **Bad, because** enforcement er spredt over 3 lag — developer må forstå
  alle tre for å implementere en ny sensitiv capability
- **Agent Impact:**
  - Alle nye capabilities med sensitive tools må deklarere
    `allowedChannels` eksplisitt
  - Dispatcher må utvides med channel-check ved process-start
  - `AgentToolContext` må utvides med `channel`, `processId`, `engineStateId`
  - Tool-selector må filtrere basert på channel
- Kobler til ADR-0077 (PII Handling) — voice-forbudet for intake er delvis
  implementert her
- Bekrefter at `human_only: true` som schema-flag er REJECTED — bruk C4
  authority for "who can do this" og `collect_signature` handler for
  "human must sign via external webhook"

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
