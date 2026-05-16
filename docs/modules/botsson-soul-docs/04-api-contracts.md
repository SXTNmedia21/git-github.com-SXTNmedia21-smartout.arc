---
title: API Contracts — Botsson Soul
status: draft
version: 0.2
created: 2026-05-15
updated: 2026-05-15
module: agent-system
tags: [botsson, api, contract, agent]
---

> **Changelog 0.2 (2026-05-15)**: la til validering-seksjon med Zod-schema for chat-input. `custom_instruction` maks 2000 tegn. `identity.blend` clampes 0-10. Avvis-regler eksplisitt knyttet til ADR-0329.

# API Contracts — Botsson Soul

## Principle

Frontend sender preferanser og metadata. Stage-engine løser endelig Soul Contract.

Frontend skal ikke sende ferdig system-prompt som canonical input.

---

## UI → Chat

Endpoint:

```txt
POST /api/emma/chat
```

Request:

```json
{
  "message": "Hva bør jeg gjøre?",
  "channel": "chat",
  "identity": {
    "persona": "puls",
    "rank": "manager",
    "blend": 8,
    "preset_key": "brannslukker"
  },
  "custom_instruction": "Svar kort og direkte.",
  "page_route": "/dashboard/shifts",
  "focused_entity": {
    "type": "shift",
    "id": "uuid"
  }
}
```

Rules:

- `identity` er input, ikke final prompt.
- `custom_instruction` må valideres og begrenses av policy.
- `page_route` brukes til page-scope tools.
- Chat må få samme identity-input som voice.

---

## UI → Voice Session

Endpoint:

```txt
POST /api/voice/session-create
```

Request:

```json
{
  "channel": "voice",
  "identity": {
    "persona": "puls",
    "rank": "manager",
    "blend": 8,
    "preset_key": "brannslukker"
  },
  "custom_instruction": "Svar kort og direkte.",
  "voice": {
    "voice_id": "emma",
    "speed": 1.15,
    "temperature": 0.3,
    "first_speaker": "user",
    "greeting": "",
    "inactivity_timeout": "15s",
    "max_duration": "1800s"
  },
  "page_route": "/dashboard/shifts"
}
```

Rules:

- Voice config påvirker voice-kanal, ikke authority.
- Voice skal bruke samme resolved identity som chat.
- Voice kan ha lavere verbosity via channel policy.

---

## Stage-engine → Soul Resolver

Input:

```ts
export type ResolveBotssonSoulInput = {
  workspaceId: string
  userId: string
  sessionId?: string
  channel: "chat" | "voice" | "background" | "mission"
  identityInput?: {
    persona?: "saga" | "puls" | "gnist" | "vakt"
    rank?: "admin" | "manager" | "employee" | "trainee"
    blend?: number
    preset_key?: string
  }
  customInstruction?: string
  voiceInput?: {
    voice_id?: string
    speed?: number
    temperature?: number
    first_speaker?: "user" | "agent"
    greeting?: string
    inactivity_timeout?: string
    max_duration?: string
  }
  pageRoute?: string
  focusedEntity?: {
    type: string
    id: string
  }
}
```

Output:

```ts
export type BotssonSoulSnapshot = {
  contract_version: string
  soul_snapshot_id: string
  channel: "chat" | "voice" | "background" | "mission"
  identity: {
    persona: string
    rank: string
    blend: number
    preset_key?: string
    resolved_prompt: string
  }
  instruction_overlay: {
    resolved_instruction: string
  }
  posture: {
    formality: number
    assertiveness: number
    warmth: number
    humor: number
    verbosity: number
    resolved_text: string
  }
  voice?: Record<string, unknown>
  model_policy: {
    provider: string
    model: string
    reason: string
  }
  context_refs: Record<string, unknown>
  memory_refs: string[]
  authority_summary: Record<string, unknown>
  tools: {
    offered: string[]
    filtered: Array<{
      tool_name: string
      reason: "min_role" | "authority_disabled" | "channel_blocked" | "intent_not_matched" | "safety_blocked"
    }>
  }
  audit: {
    input_hash: string
    prompt_hash: string
    tool_bundle_hash: string
    created_at: string
  }
}
```

---

## Stage-engine → Model Runtime

Prompt skal kompileres fra Soul Snapshot.

```ts
const soul = await resolveBotssonSoul(input)
const prompt = compileBotssonPrompt(soul)
const tools = resolveToolBundle(soul)
```

---

## Required response metadata

Agent response bør inkludere eller referere til:

```json
{
  "soul_snapshot_id": "uuid",
  "model": "anthropic/claude-sonnet-4.6",
  "channel": "chat"
}
```

---

## Validation (Zod)

Input validerers ved BFF før proxy til stage-engine.

```ts
import { z } from "zod";

export const IdentityInputSchema = z.object({
  persona: z.enum(["saga", "puls", "gnist", "vakt"]).optional(),
  rank: z.enum(["admin", "manager", "employee", "trainee"]).optional(),
  blend: z.number().int().min(0).max(10).optional(),
  preset_key: z
    .enum([
      "dagsjef",
      "mentor",
      "nysgjerrig-kollega",
      "trygg-start",
      "strategisk-radgiver",
      "brannslukker",
    ])
    .optional(),
});

export const VoiceInputSchema = z.object({
  voice_id: z.string().uuid().optional(),
  speed: z.number().min(0.5).max(1.5).optional(),
  temperature: z.number().min(0).max(1).optional(),
  first_speaker: z.enum(["user", "agent"]).optional(),
  greeting: z.string().max(500).optional(),
  inactivity_timeout: z.string().regex(/^\d+s$/).optional(),
  max_duration: z.string().regex(/^\d+s$/).optional(),
});

export const ChatInputSchema = z.object({
  message: z.string().min(1).max(10_000),
  channel: z.literal("chat"),
  identity: IdentityInputSchema.optional(),
  custom_instruction: z.string().max(2000).optional(),
  page_route: z.string().max(500).optional(),
  focused_entity: z
    .object({
      type: z.string().max(100),
      id: z.string().uuid(),
    })
    .optional(),
});
```

**Limits-rationale**:
- `custom_instruction` 2000 tegn: hinder prompt-injection-DoS uten å begrense legitim bruk.
- `message` 10 000 tegn: chat-melding rom for lim-inn av f.eks. epost-utkast.
- `greeting` 500: voice-introtekst.
- `blend` 0-10 integer: matcher UI-slider.

---

## Rejection rules

Custom instruction må avvises eller nøytraliseres hvis den forsøker å:

- overstyre authority
- bypass audit
- gi tilgang til disabled tools
- endre role permissions
- deaktivere safety policy

**Forbudte mønstre** (detekteres via regex/heuristikk i stage-engine FØR prompt-compile):

```txt
^(ignore|forget|disregard|override)\b.*(previous|prior|all|system|instructions)
^you are now (admin|owner|platform.admin|root|sudo)
\b(execute|run|exec|eval) (system|admin|sudo)
\bdisable (safety|gate|auth|rls)\b
\bgrant.*authority\b
```

Detektert match → `custom_instruction` strippes, snapshot loggs med `pii_present=false` + `rejection_reason="prompt_injection_pattern"`, user får ingen feilmelding (stille drop slik at angriper ikke får signal).

Legitim bruker som faktisk skrev "ignore the previous error message and try again" får sin instruks ufiltrert fordi den ikke matcher `previous (instructions|system)`. Pattern-listen tunes via L-logging.
