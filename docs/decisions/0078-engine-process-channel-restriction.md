---
title: Engine Process Channel Restriction
id: ADR_0078
status: accepted
layer: decision
created: 2026-04-08
updated: 2026-05-06
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

## Amendment 2026-05-06 — Proposal-Domain Tools (SMA-299)

**Trigger:** Fase 4 (SMA-295) introduced `propose_*` tools in
`services/voice-agent/src/tools-schedule.ts` whose risk profile differs from
the two tool categories the canonical body covers. Without explicit guidance,
future authors face a choice between defensive theatre (full L1+L2+L3 on a
tool that cannot mutate domain data) and silent under-defence (no guard,
no documented reason). This amendment formalises the third category.

### Three categories of tool, three defence models

| Category | Writes to | Canonical defence | Section |
|---|---|---|---|
| **A. Domain-mutating tools** | DB rows (cascade dimensions, governance, identity) | L1 process `allowed_channels` + L2 capability `allowedChannels` + L3 tool-level `ctx.channel` self-check | Body of this ADR |
| **B. PII-handling capabilities** | Same as A, but tool body or response carries personnummer / bankkonto / contact | Category A guard + ADR-0163: `allowedChannels` is **mandatory** at capability registration; fail-closed | ADR-0163 amendment |
| **C. Proposal-domain tools** | Ephemeral in-memory state (data-channel events, React proposal queue) — **never** DB rows | **Structural isolation** (this amendment) | Below |

### Category C — proposal-domain tools (NEW)

A proposal-domain tool's only side-effect is to publish a data-channel event
that lands in a human-review queue (e.g. `botsson:shift-proposal` window event
→ `addProposal()` in `AgentProposalsContext`). Domain mutation happens later,
when a human accepts the proposal — and the acceptance path is gated by the
ordinary domain-tool guard (Category A). The proposal tool itself cannot
cause domain damage on its own.

**What replaces L1+L2+L3 for Category C:**

- **L1 (process `allowed_channels`)** — usually N/A: proposal tools today
  are dispatched outside the engine_process model (LiveKit voice runtime
  direct registration). When a proposal tool is wired to an
  `engine_process`, L1 still applies and MUST be set.
- **L2 (capability-level `allowedChannels`)** — replaced by **registration
  isolation**: the tool is registered only in the channel runtime where it
  is meant to live (V0 = voice-agent runtime only; no chat twin). The tool
  is not a member of any cross-channel capability; therefore there is no
  `allowedChannels` field to set. Absence of registration in a channel IS
  the defence.
- **L3 (tool-level `ctx.channel` self-check)** — replaced by
  **defence-in-depth input gates** appropriate to the tool's surface:
  - **Path-gating**: refuse with a dialogic redirect if the user is not on
    the surface that owns the proposal (e.g. `propose_create_shift` checks
    `/dashboard/schedule` prefix; redirect message instead of error).
  - **UUID-format validation**: validate FK references at the tool boundary.
  - **No `gate_action` call** because no domain mutation occurs at this
    layer; gate is the responsibility of the acceptance handler.
  - **No `emit()` call** because telemetry flows from the stage-engine
    recorder when activity_trail picks up the data-channel publish.

These input gates are NOT a channel guard — they are surface-context
validation. The channel guard for Category C is **structural isolation
plus the human-acceptance hop**.

### When a chat propose_* twin is built

The moment a proposal tool is added to a chat-channel runtime — even if it
still publishes the same data-channel event — the tool gains a second
registration site. At that point:

1. The tool MUST be promoted to a Category A capability (or Category B if
   the proposal payload carries PII) with full L1+L2+L3 guard, OR
2. An explicit Category-C-extension ADR must justify why structural
   isolation still holds in a multi-channel runtime.

The deferral of (1) is **not** permanent. Tracking the chat twin obligation
in the capability registry (or a follow-up ADR) is required at the moment
of multi-channel registration. This amendment exists precisely so that the
deferral is visible and bounded.

### Anti-pattern: defensive stubs on Category C

A Category C tool that adds a `ctx.channel !== 'voice'` self-check is
defensive theatre — it cannot fail in a single-channel runtime, and it
gives a false sense that the tool is multi-channel-safe. Do not write
defensive stubs; write the structural-isolation comment block instead
(see `services/voice-agent/src/tools-schedule.ts` top-of-file, lines
14-22, for the canonical implementation).

### References

- **SMA-295** (Fase 4 — proposal pipeline): originating sortie for
  `propose_create_shift` / `propose_update_shift` / `propose_delete_shift` /
  `propose_create_absence` / `propose_update_absence` / `propose_delete_absence`
- **SMA-299** (this amendment)
- **ADR-0289** (voice-agent tool registry tactical duplication): explains
  why proposal tools live as a parallel array in the voice-agent runtime
  rather than via the canonical capability registry — context for why
  Category C structural isolation is implementable today
- **`services/voice-agent/src/tools-schedule.ts`** lines 14-22 — canonical
  comment block for Category C tools

### Cross-cutting telemetry note

Per ADR-0134 + ADR-0078, proposal-payload data-channel events MUST NOT
carry PII fields (e.g. `contact`, personnummer, bankkonto). If a future
proposal tool needs to surface PII, it is automatically Category B and
must carry full L1+L2+L3 guard — structural isolation is not sufficient
for PII payloads even when no DB write occurs.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-04-08 | Original | Initial ADR — three-layer channel guard for engine_process |
| 2026-04-19 | ADR-0163 (separate file) | Amendment — `allowedChannels` mandatory at capability registration for PII-handling capabilities; fail-closed |
| 2026-05-06 | SMA-299 | Amendment — Category C proposal-domain tools: structural isolation replaces L2; path-gating + UUID validation replace L3; chat twin obligation explicit |

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
