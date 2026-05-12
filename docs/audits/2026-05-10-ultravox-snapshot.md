---
title: Ultravox Pre-Deletion Snapshot — Phase E Task 8 (P4)
status: complete
created: 2026-05-10
updated: 2026-05-10
module: MODULE_BOTSSON
phase: E
adr: [ADR-0282, ADR-0276, ADR-0107]
tags: [ultravox, livekit, phase-e, p4, snapshot, audit]
---

# Ultravox Pre-Deletion Snapshot — P4

> READ-ONLY capture. Generated 2026-05-10 before Task 8 deletion sweep.
> Cross-references existing `docs/architecture/ULTRAVOX-DEPRECATION-INVENTORY.md` (2026-05-09)
> which carries the bucket classification (A/B/C/D/PRESERVE) rationale — do not duplicate that here.
> HIGH CARDINALITY WARNING: 1309 total grep hits across 269 files.
> Scoped follow-up audit per sub-directory recommended for code-ref line-by-line tracking.

## Summary

| Metric | Count |
|---|---|
| Total grep hits | 1309 |
| Unique files touched | 269 |
| Code-ref hits (Task 8 delete/refactor targets) | ~87 lines across 19 files |
| ADR-historical hits (PRESERVE verbatim) | ~85 lines across 9 ADR files |
| Prose-replace hits (P5 rewrite) | ~840 lines across ~190 doc/blueprint files |
| Skeleton/skill/agent hits (P6 rewrite) | 6 lines across 3 .claude/ project files |
| Root-level file hits | 4 lines across 2 files (CLAUDE.md, .env.template) |
| supabase/ hits | 4 lines across 3 files |
| Out-of-band ~/.claude/ hits needing operator patch | 6 lines across 1 file |

---

## Hits by Classification

### Code-ref (Task 8 deletion targets)

These are live code references — imports, API calls, type exports, package.json deps — that must be deleted or refactored in Task 8 (E6). Ordered by file.

---

**`packages/agent-sdk/src/providers/ultravox.ts`** — WHOLE FILE DELETE
- Line 1: `import { UltravoxSession, UltravoxSessionStatus, Role } from "ultravox-client";`
- Line 16: `function toAgentStatusFromEnum(s: UltravoxSessionStatus): AgentStatus`
- Line 37: `function toAgentStatus(ultravoxStatus: string): AgentStatus`
- Line 45: `class UltravoxVoiceSession implements VoiceSession`
- Line 147: `export function createUltravoxProvider(): VoiceProvider`
- Action: **delete file**

**`packages/agent-sdk/src/providers/index.ts`**
- Line 1: `export { createUltravoxProvider } from "./ultravox";`
- Context: `// providers/index.ts` | `export { createUltravoxProvider } from "./ultravox";`
- Action: strip line

**`packages/agent-sdk/src/index.ts`**
- Line 27: `export { createUltravoxProvider } from "./providers/ultravox";`
- Context: re-export barrel for Ultravox provider
- Action: strip line

**`packages/agent-sdk/src/hooks/useAgent.ts`**
- Line 13: `import { createUltravoxProvider } from "../providers/ultravox";`
- Line 29: `function getProvider(name: "ultravox" | "livekit"): VoiceProvider`
- Line 32: `provider = name === "livekit" ? createLiveKitProvider() : createUltravoxProvider();`
- Line 64: `provider: providerName = "ultravox",`
- Line 120: comment: `// Ultravox SDK's later getUserMedia() call (inside a WebSocket handler) succeeds.`
- Action: refactor — remove Ultravox branch, default provider becomes `"livekit"`

**`packages/agent-sdk/src/types.ts`**
- Line 47: `// Client tool — the Ultravox "temporaryTool" format`
- Line 72: `* Combines the Ultravox definition with its runtime implementation.`
- Line 79: `/** Parameter definitions sent to Ultravox */`
- Line 129: `/** Voice provider to use. Default: "ultravox" */`
- Line 130: `provider?: "ultravox" | "livekit";`
- Action: strip `"ultravox"` from provider union type; update default; strip doc comments citing Ultravox

**`packages/agent-sdk/src/tools/registry.ts`**
- Line 11: `* This converts the SDK's ClientTool format into the Ultravox-compatible`
- Action: update comment to reference LiveKit Agents format

**`packages/agent-sdk/package.json`**
- Line 25: `"ultravox-client": "*"` (dependencies)
- Line 28: `"ultravox-client": {` (peerDependencies)
- Line 38: `"ultravox-client": "*"` (devDependencies)
- Action: remove all three `ultravox-client` entries

**`packages/agent-sdk/src/providers/livekit.ts`**
- Line 61: `// apiParams translation contract — Ultravox-shape → LiveKit Agents config`
- Line 63: `// Wizard + Botsson legacy pass Ultravox-shaped params. This pure function maps`
- Line 70: `export type UltravoxApiParams = {`
- Line 89: `export function translateUltravoxApiParams(params: UltravoxApiParams): LiveKitAgentsConfig`
- Context: translation shim that converts Ultravox-shaped params to LiveKit config — may become dead code post-E6 if all callers updated
- Action: assess callers; if zero callers remain after Task 8, delete; otherwise rename type/function to remove Ultravox name

**`packages/agent-sdk/src/providers/__tests__/livekit-translation.test.ts`**
- Line 2: `import { translateUltravoxApiParams } from "../livekit";`
- Action: update import if function renamed; delete if test becomes obsolete

**`packages/ai/src/missions/ultravox.ts`** — WHOLE FILE DELETE
- Line 4: `const ULTRAVOX_BASE = "https://api.ultravox.ai/api";`
- Line 29: JSDoc: `Start an Ultravox call using a mission configuration.`
- Line 35: `export async function startMissionCall(...)`  — calls `https://api.ultravox.ai/api/agents/{agentId}/calls`
- Line 141: `throw new Error(\`Ultravox API error (${response.status}): ${errText}\`);`
- Action: **delete file** (replaced by LiveKit token creation path)

**`packages/ai/src/missions/types.ts`**
- Line 14: `/** Built-in Ultravox voices or custom voice IDs (UUIDs from cloned/custom voices) */`
- Line 15: `export type UltravoxVoice = "terrence" | "mark" | "jessica" | "sarah" | "tina" | (string & {});`
- Line 19: `voice?: UltravoxVoice;`
- Line 35: `voice?: UltravoxVoice;`
- Line 46: `/** Client-side tool definitions shipped with this mission (Ultravox format). */`
- Line 67: `voice?: UltravoxVoice;`
- Action: rename `UltravoxVoice` → `AgentVoice` or similar; update voice values to match OpenAI Realtime / LiveKit voice names

**`packages/ai/src/missions/registry.ts`**
- Line 8: `* All available Ultravox agent missions.`
- Action: update comment

**`packages/ai/src/index.ts`**
- Line 34: `// Schedule tools (Ultravox client tool definitions)`
- Line 72: `// Missions (Ultravox agent configurations)`
- Action: update comments

**`services/stage-engine/src/lib/ultravox.ts`** — WHOLE FILE DELETE
- Line 2–6: file header (Ultravox API client)
- Line 35: `export async function createUltravoxCall(payload: UltravoxCreateCallPayload): Promise<CreateUltravoxCallResult>`
- Line 82: `export function buildUltravoxTools(engineUrl, apiKey): UltravoxHttpTool[]`
- Line 89: `// See: docs/learnings/0013-ultravox-http-tool-parameters.md`
- Lines 119, 143, 163, 190: `baseUrlPattern: \`${engineUrl}/adapters/ultravox/{store|fetch|advance|fetch}\``
- Action: **delete file**

**`services/stage-engine/src/routes/adapters/ultravox.ts`** — WHOLE FILE DELETE
- Line 2–8: file header (Ultravox adapter endpoints)
- Line 19: `import { createUltravoxCall, buildUltravoxTools } from "../../lib/ultravox.js";`
- Line 25: `import type { UltravoxNewStageResponse, UltravoxTool } from "../../types/ultravox.js";`
- Line 27: `const ultravox = new Hono<{ Variables: AppVariables & { auth: AuthContext } }>();`
- Line 54: `ultravox.post("/adapters/ultravox/create-call", ...)`
- Line 154: `ultravox.post("/adapters/ultravox/store", ...)`
- Line 231: `ultravox.post("/adapters/ultravox/fetch", ...)`
- Line 305: `ultravox.post("/adapters/ultravox/advance", ...)`
- Line 357: `c.header("X-Ultravox-Response-Type", "new-stage");`
- Line 361: `export { ultravox };`
- Action: **delete file**

**`services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts`** — WHOLE FILE DELETE
- 15 hits — all test coverage for the deleted adapter
- Action: **delete file** (orphaned tests)

**`services/stage-engine/src/types/ultravox.ts`** — WHOLE FILE DELETE
- Lines 2–103: full type definitions for `CreateUltravoxCallRequest`, `CreateUltravoxCallResponse`, `UltravoxParameterLocation`, `UltravoxStaticParameter`, `UltravoxHttpTool`, `UltravoxClientTool`, `UltravoxTool`, `UltravoxNewStageResponse`, `UltravoxCreateCallPayload`, `UltravoxCreateCallApiResponse`
- Action: **delete file**

**`services/stage-engine/src/index.ts`**
- Line 26: `import { ultravox } from "./routes/adapters/ultravox.js";`
- Line 113: `app.route("/", ultravox);`
- Action: remove import + route registration

**`services/stage-engine/src/secrets.ts`**
- Line 11: `ultravoxApiKey: string | null;`
- Line 43: JSDoc: `ULTRAVOX_API_KEY, OPENROUTER_API_KEY env vars.`
- Line 47: `vaultUltravox,`
- Line 53: `getServiceKey("ultravox"),`
- Line 61: `const ultravoxApiKey = vaultUltravox ?? process.env.ULTRAVOX_API_KEY ?? null;`
- Line 68: `ultravoxApiKey,`
- Line 76–77: `if (vaultUltravox) sources.push("ultravox (vault)"); else if (ultravoxApiKey) sources.push("ultravox (env)");`
- Line 88: `!ultravoxApiKey && "ultravox",`
- Action: remove all `ultravoxApiKey` fields from secrets struct; remove vault lookup; remove missing-secret warning

**`services/stage-engine/src/config.ts`**
- Line 15: `/** Public URL of the engine — used in webhook payloads and Ultravox tool URLs */`
- Line 27: `// ULTRAVOX_API_KEY and OPENROUTER_API_KEY are loaded from Vault at runtime.`
- Action: update comments

**`services/stage-engine/src/__tests__/` (6 files)**
Each contains `ultravoxApiKey: null` in mock secrets fixture:
- `telegram-webhook.test.ts:30`
- `agent-router-classifier-context.test.ts:20`
- `agent-router-recording.test.ts:22`
- `agent-router-classifier-context-propagation.test.ts:26`
- `telegram-client.test.ts:14`
- `admin-router.test.ts:24`
- Action: remove `ultravoxApiKey: null` from all 6 mock objects after `secrets.ts` drops the field

**`services/voice-agent/src/agent.ts`**
- Line 48: comment: `// Voices supported by OpenAI Realtime API. The mission registry uses Ultravox`
- Line 51: `const ULTRAVOX_TO_OPENAI_VOICE: Record<string, string> = { ... }`
- Line 61: `function resolveOpenAIVoice(ultravoxVoice: string | undefined): string`
- Line 62: `if (!ultravoxVoice) return "verse";`
- Line 63: `return ULTRAVOX_TO_OPENAI_VOICE[ultravoxVoice.toLowerCase()] ?? "verse";`
- Context: mapping table from Ultravox voice names to OpenAI Realtime equivalents (terrence→verse, mark→ballad, jessica→shimmer, sarah→coral, tina→alloy). Post-E6 voice names come from `AgentVoice` enum aligned to OpenAI directly.
- Action: rename function to `resolveOpenAIVoiceFromName`; rename `ULTRAVOX_TO_OPENAI_VOICE` → `VOICE_NAME_MAP`; update comment; source voice names from `packages/ai/src/missions/types.ts` updated type

**`apps/web/src/env.ts`**
- Line 26: `ULTRAVOX_API_KEY: z.string().optional(),`
- Action: remove env var declaration

**`apps/web/package.json`**
- Line 103: `"ultravox-client": "^0.5.0"`
- Action: remove dependency

**`apps/web/src/app/api/emma/session/route.ts`**
- Line 6: `* Ultravox temporaryTool (ADR-0282 Phase E T2.1).`
- Action: update comment to reference LiveKit context

**`apps/web/src/app/api/wizard/start/route.ts`**
- Line 7: `* ADR-0282 Phase E T2.5: replaces the previous Ultravox /adapters/ultravox/`
- Action: update comment (historical reference, but active-doc — update to note migration complete)

**`apps/web/src/app/onboarding/hooks/useBotsson.ts`**
- Line 117: `// Mint LiveKit token via wizard/start — no Ultravox create-call`
- Action: comment already accurate; may be stripped as ambient reminder

**`apps/web/src/app/Botsson/_components/BotssonProvider.tsx`**
- Line 634: `// so Ultravox knows about them at session start — implementations register dynamically)`
- Line 643: `// (ensures Ultravox always has the schemas, even before navigating to schedule)`
- Action: update comments to reference LiveKit

**`apps/web/src/app/Botsson/_components/BotssonArena.tsx`**
- Line 195: `// ADR-0282 R1.1 — status derived from LiveKit voice state, not Ultravox agent.`
- Action: comment is already LiveKit-corrected; retain as migration note or strip

**`apps/web/src/app/Botsson/_components/types.ts`**
- Line 101: `/* ━━━ Voices — Ultravox voice registry ━━━━━ */`
- Line 109: `/** Available voices — all Ultravox INCLUDED billing (no external API key needed) */`
- Action: update section header and billing note — post-E6 voices are OpenAI Realtime via LiveKit

**`apps/web/src/app/Botsson/_components/BotssonTools.ts`**
- Line 67: `/* ━━━ Tool definitions (Ultravox temporaryTool format) ━━━ */`
- Action: update comment — format is now LiveKit Agents tool definition

**`apps/web/src/app/Botsson/_components/help-voice-tools-bridge.tsx`**
- Line 6: `// Why: when the user asks a KB/handbook question via voice (Runtime B / Ultravox),`
- Action: update comment — Runtime B is now LiveKit

**`apps/web/src/app/dashboard/help/_hooks/useHelpVoiceFallback.ts`**
- Line 6: `// Why: Ultravox (Runtime B) has no capability registry binding for \`kb_query\`,`
- Action: update comment

**`apps/web/src/app/dashboard/help/page.tsx`**
- Line 144: `Runtime B (Ultravox) intercepts KB-query intent and returns "bytt til chat".`
- Action: update prose — Runtime B is now LiveKit

**`apps/web/src/app/dashboard/schedule/_components/day-control/OversiktTab.tsx`**
- Line 446: `toast.success(\`Starter Ultravox-samtale for ${name}\`)`
- Action: update toast text — remove "Ultravox" brand name

**`apps/web/src/app/dashboard/schedule/_hooks/schedule-tool-definitions.ts`**
- Line 1: `// Schedule tool definitions — Ultravox client tool shapes.`
- Action: update comment

**`apps/web/src/app/platform-admin/keys/_components/service-registry.ts`**
- Line 94: `key: "ultravox",`
- Line 95: `provider: "ultravox",`
- Line 96: `envVar: "ULTRAVOX_API_KEY",`
- Line 97: `label: "Ultravox API Key",`
- Action: remove the `ultravox` registry entry — key will no longer exist

**`apps/web/src/app/platform-admin/services/_components/service-contracts.ts`**
- Lines 169–194: 4 route entries for `/adapters/ultravox/{create-call,store,fetch,advance}`
- Action: remove all 4 Ultravox route definitions from service-contracts

**`apps/web/src/app/Botsson/_hooks/useWizardBotssonContext.ts`**
- Line 38: `// Deliver context to Emma's live Ultravox session`
- Action: update comment

**`apps/web/src/app/onboarding/lib/tool-schemas.ts`**
- Line 4: `* Each schema validates the params object that Ultravox sends when`
- Action: update comment — sender is now LiveKit Agents

**`apps/web/src/components/voice-assistant.tsx`**
- Line 15: `*     until Task 8 (Ultravox deletion sweep) cleans up the import chain.`
- Context: already annotated as pending deletion — this IS the deletion target
- Action: assess full file for Ultravox imports; likely delete or replace with LiveKit equivalent

**`apps/web/src/app/api/wizard/start/__tests__/route.livekit.test.ts`**
- Line 83: `it("does NOT call /adapters/ultravox/create-call", async () => {`
- Lines 105–108: assertions verifying no Ultravox call is made
- Action: retain test — it is a LiveKit-positive / Ultravox-negative spec (keep as regression guard)

**`apps/web/src/components/__tests__/InterviewSurface.test.tsx`**
- Line 8: `it("does not import UltravoxSession", () => {`
- Line 9: `expect(source).not.toMatch(/UltravoxSession|ultravox-client/);`
- Action: retain — negative assertion guards against regression

**`apps/web/src/app/onboarding/hooks/__tests__/useBotsson.test.ts`**
- Lines 8–16: three assertions verifying no `UltravoxSession`, no `ultravox-client`, no `registerToolImplementation` calls
- Action: retain — all are LiveKit-positive / Ultravox-negative regression guards

**`apps/landing/package.json`**
- Line 44: `"ultravox-client": "^0.5.0"`
- Action: remove dependency

**`apps/landing/src/env.ts`**
- Line 15: `ULTRAVOX_API_KEY: z.string().optional(),`
- Action: remove env var

**`apps/landing/src/components/voice-assistant.tsx`**
- Line 6: `import { UltravoxSession, UltravoxSessionStatus, Role } from "ultravox-client";`
- Lines 31, 34, 42, 44, 166, 167: direct `UltravoxSession` / `UltravoxSessionStatus` usage
- Action: replace with LiveKit-based voice session OR delete file if feature is removed from landing

**`apps/landing/src/app/api/wizard/start/route.ts`**
- Line 3: `// Initiates an Ultravox voice session for the landing page demo.`
- Lines 19, 22, 25, 39, 62: `ULTRAVOX_API_KEY`, `getServiceKey("ultravox")`, `agentId: process.env.ULTRAVOX_AGENT_ID`
- Action: replace with LiveKit token endpoint call; update comment

**`apps/landing/src/app/api/wizard/engine-start/route.ts`**
- Lines 4–6: comments citing Ultravox
- Line 48: `const res = await fetch(\`${engineUrl}/adapters/ultravox/create-call\`, ...)`
- Action: replace with LiveKit room-token endpoint; update comments

**`apps/landing/src/app/features/communications/page.tsx`**
- Line 69: `const { UltravoxSession } = await import("ultravox-client");`
- Line 70: `const currentSession = new UltravoxSession();`
- Action: replace with LiveKit room join flow

**`apps/landing/src/app/docs/api/page.tsx`**
- Line 1919: `{ method: "POST", path: "/api/wizard/start", desc: "Start Ultravox voice session" }`
- Action: update route description to "Start LiveKit voice session"

**`apps/landing/src/lib/variant-voice-config.ts`**
- Line 35: `/** Prompt context sent to Ultravox so Lise adapts her tone to the persona. */`
- Action: update comment — context is now sent to LiveKit Agents

**`apps/landing/src/components/demo/useDemoJourney.ts`**
- Line 186: `/** Toggle voice mode on/off (Ultravox integration stubbed) */`
- Action: update comment

**`apps/mobile/src/components/ai/BotssonSheet.tsx`**
- Line 8: `* Voice session powered by Ultravox WebRTC (browser context via Expo Web).`
- Line 54: `// Transcript is local state for now — Ultravox WebRTC integration will populate it`
- Line 128: `// Toggle mute — calls muteMic()/unmuteMic() on the real Ultravox session`
- Action: update all three comments to reference LiveKit

**`apps/mobile/src/providers/botsson-provider.tsx`**
- Line 7: `* Voice mode uses Ultravox WebRTC (browser context via Expo Web).`
- Line 42: `/** Minimal voice session interface — matches UltravoxVoiceSession from @smartout/agent-sdk */`
- Line 112: `* Mute or unmute the microphone in the active Ultravox session.`
- Line 147: `// Holds the legacy Ultravox session handle (web/SDK path). Kept for`
- Line 242: `// Legacy Ultravox path — keep for the web bundle.`
- Action: update all comments; remove legacy Ultravox path (line 242 branch)

**`apps/admin/src/env.ts`**
- (hit confirmed in file list — not extracted in detail above)
- Action: grep file directly; likely `ULTRAVOX_API_KEY` optional env var — remove

**`packages/supabase/src/vault.ts`**
- Line 22: `* @param secretName - The vault secret name (e.g. "openrouter", "ultravox", "docuseal")`
- Action: update JSDoc example to remove "ultravox"

**`packages/ai/src/capabilities/availability/tools.ts`**
- Line 253: `// (e.g. Ultravox adapter misconfigured).`
- Action: update comment

**`packages/ai/src/tools/intelligence/types.ts`**
- Line 165: `// Ultravox client tool return types`
- Action: update comment

**`packages/ai/src/tools/schedule/definitions.ts`**
- Line 3: `// Ultravox client tool definitions for the schedule module.`
- Action: update comment

**`packages/ai/scripts/check-server-derived-actor.ts`**
- Line 9: `* Adapter exceptions (Ultravox/Telegram) may be whitelisted via one or more`
- Action: update comment — "Ultravox" adapter is removed, only Telegram remains

**`infra/docker-compose.yml`**
- Line 59: `- ULTRAVOX_API_KEY=${ULTRAVOX_API_KEY}`
- Line 156: `# ADR-0135: mobile + worker on LiveKit; web Botsson stays on Ultravox.`
- Action: remove env passthrough; update comment to reflect unified LiveKit post-E6

**`supabase/seed.sql`**
- Line 1264: `NULL, 'BotssonVoice', ARRAY[]::text[], ARRAY[]::text[], 'Uses Ultravox for voice'`
- Action: update description string in seed

**`supabase/seed/service-config-seed.sql`**
- Line 8: `'AI orchestration engine — manages missions, stages, tools, and voice calls via Ultravox'`
- Line 18: `ARRAY['ultravox', 'openrouter']`
- Line 64: `{"key": "ULTRAVOX_API_KEY", "required": false, ...}`
- Action: update description; remove 'ultravox' from deps array; remove `ULTRAVOX_API_KEY` config entry

**`supabase/migrations/20260318130100_emma_conversation.sql`**
- Line 2: `-- Each row = one Ultravox session with its transcript entries`
- Action: PRESERVE — migration file is immutable. The comment is historical. Never edit migrations.

**`.env.template`** (root)
- Line 138: `ULTRAVOX_AGENT_ID="op://smartout_ai/Ultravox/agent_id"`
- Line 145: `ULTRAVOX_API_KEY="op://smartout_ai/Ultravox/api_key"`
- Action: remove both lines post-E6

**`CLAUDE.md`** (root, project-level)
- Line 37: `Ultravox (voice),` in integrations list
- Line 105: `Mobile voice uses LiveKit (ADR-0135), not Ultravox.`
- Action: Line 37 — remove Ultravox from integrations list; Line 105 — already accurate, may update to note full-stack LiveKit

---

### ADR-historical (preserve verbatim)

All ADR files are PRESERVE-unconditional per council Hard Rule 1. Every cite below is a load-bearing historical record.

**`docs/decisions/0282-voice-plane-consolidation-livekit-only.md`** (~35 hits)
- Title, context, problem statement, decision body, R6 migration sequence, AC #1 grep scope, architectural guidance
- PRESERVE — this is the authoritative cutover ADR and must remain unchanged as decision record

**`docs/decisions/0276-adr-0107-amendment-provider-independence.md`** (~10 hits)
- Context section citing Ultravox as pre-E6 provider; amendment clarifying transport-level vs derivation-level
- PRESERVE — amendment record

**`docs/decisions/0135-mobile-voice-via-livekit-not-ultravox.md`** (~10 hits)
- Title, context, decision (keep Ultravox on web at time of writing), guidance
- PRESERVE — original dual-plane decision, now superseded by ADR-0282 but still load-bearing ancestry

**`docs/decisions/0220-botsson-conversational-front-door-not-orchestrator.md`** (~3 hits)
- Code-trace finding: "three Botsson runtimes (Stage Engine, Ultravox client tools, dead runBotssonAgent)"
- PRESERVE — council finding, audit context

**`docs/decisions/0289-voice-agent-tool-registry-tactical-duplication.md`** (~1 hit)
- "browser Ultravox path (still initialized in BotssonProvider.tsx:useAgent)"
- PRESERVE

**`docs/decisions/0208-mcp-gateway-alongside-hono.md`** (~2 hits)
- References Ultravox as a long-lived process requiring stage-engine; historical design constraint
- PRESERVE

**`docs/decisions/0089-walkai-bridge-architecture.md`** (~1 hit)
- "Client-side tools (Ultravox temporaryTool format in BotssonTools.ts)"
- PRESERVE

**`docs/decisions/0086-entity-drawer-surface-pattern.md`** (~1 hit)
- "open_entity_drawer Ultravox client tool"
- PRESERVE

**`docs/decisions/0074-protocol-verification-engine.md`** (~1 hit)
- "AgentMission type in registry.ts is Ultravox-specific"
- PRESERVE

**`docs/decisions/0070-emma-wizard-bridge.md`** (~2 hits)
- "hardcoded Ultravox integration for onboarding (1076 lines)"
- PRESERVE

**`docs/decisions/0049-agent-sdk-package.md`** (~8 hits)
- Context for why agent-sdk was created; Ultravox coupling as the problem being solved
- PRESERVE

**`docs/decisions/0046-block-based-landing-page-builder.md`** (~1 hit)
- "Must integrate with existing PostHog tracking and Ultravox voice"
- PRESERVE

**`docs/decisions/0151-stage-engine-profile-id-server-derivation.md`** (~1 hit)
- "Ultravox / Telegram adapter surfaces retain the optional profile_id body field"
- PRESERVE

**`docs/decisions/0250-skatteetaten-integration.md`** (~2 hits)
- "A2/A3 are correct for API keys (Ultravox, OpenRouter)"
- PRESERVE

**`docs/decisions/0000-decision-log.md`** (~3 hits)
- Decision log entries for ADR-0135, ADR-0276, ADR-0282 reference Ultravox in summaries
- PRESERVE — append-only log

---

### Prose-replace (P5 rewrite)

Documentation files describing Ultravox as live/active technology. P5 rewrites with LiveKit Agents 1.3.0 equivalents. All files below are candidates for selective prose update after E6 code deletion.

**Architecture docs** (`docs/architecture/`):
- `BOTSSON-SYSTEM-MAP.md` — ~10 hits; active architecture reference
- `HARNESS-ARCHITECTURE.md` — ~30 hits; capability/tool bridge architecture
- `STAGE-ENGINE.md` — ~5 hits; stage engine overview
- `SMARTOUT_SECRET_API_INFRASTRUCTURE.md` — ~3 hits; secrets section referencing Ultravox key
- `SMARTOUT_WORKSPACE_ONBOARDING_ARCHITECTURE.md` — ~5 hits; onboarding voice flow
- `SMARTOUT_CONTRACT_SYSTEM.md` — ~3 hits; interview voice flow
- `contract-service/CONTRACT-PIPELINE-MAP.md` — ~3 hits
- `cross-cutting/SMARTOUT_CROSSCUT_SECURITY_INFRA.md` — ~2 hits
- `cross-cutting/SMARTOUT_CROSSCUT_LEGAL_GDPR_COMPLIANCE.md` — ~1 hit
- `progressive-intelligence-protocol.md` — ~5 hits
- `infra-layer-edge-functions-architecture.md` — ~3 hits
- `ULTRAVOX-DEPRECATION-INVENTORY.md` — 11 hits; meta-document about the deprecation itself — update status after E6

**Module docs** (`docs/architecture/modules/`):
- `MODULE_BOTSSON.md` — ~15 hits; primary Botsson module doc
- `MODULE_AGENT_SDK.md` — ~5 hits
- `MODULE_0_ROADMAP.md` — ~5 hits
- `SMARTOUT_MODULE_12_AI.md` — ~5 hits
- `SMARTOUT_MODULE_18_WEBRTC.md` — ~20 hits; WebRTC/voice module — highest prose density
- `SMARTOUT_MODULE_1_ONBOARDING.md` — ~5 hits
- `SMARTOUT_MODULE_4_OPERATIONS.md` — ~3 hits
- `SMARTOUT_MODULE_9_COMMUNICATION.md` — ~5 hits

**Agent framework docs** (`docs/agents/`):
- `framework/AGENT_DRIVEN_UI_ARCHITECTURE.md` — ~5 hits (also in `docs/engines/industri-inteligence/Lov-og-rett/agents/framework/` — duplicate path)
- `frontend-design/ONBOARDING_SYSTEM_DESIGN.md` — ~5 hits (also duplicate)

**Packages Botsson blueprints** (`packages/Botsson/blueprints/`):
- `api-surface.md` — hits on Ultravox API surface documentation
- `data-contracts.md` — ~15 hits; type definitions referenced by name
- `environment-ui-control.md` — hits
- `existing-components.md` — ~10 hits
- `journey-content-map.md` — ~20 hits; voice provider table, ADR summaries
- `mission-orchestration.md` — ~20 hits; /adapters/ultravox/* endpoint docs, curl examples
- `ui-components-inventory.md` — ~15 hits; UltravoxSession references in component specs
- `voice-sdk-architecture.md` — all hits; voice SDK architecture doc
- `packages/Botsson/concepts/VISION.md` — hits

**Reference docs** (`docs/reference/`):
- `API_ENDPOINT_REFERENCE.md` — /adapters/ultravox/* route table
- `API_INVENTORY_AND_COVERAGE.md` — Ultravox adapter coverage entries
- `API_ROUTES_REFERENCE.md` — route listing
- `ENV_VARS.md` — `ULTRAVOX_API_KEY`, `ULTRAVOX_AGENT_ID` env var entries
- `PACKAGES.md` — `ultravox-client` in packages table
- `SERVICES_ARCHITECTURE.md` — stage-engine Ultravox channel description
- `SECRET_MANAGEMENT_LIVE.md` — Ultravox key management section
- `STAGE_ENGINE_TRAINER_GUIDE.md` — hits on voice adapter section
- `infra-runtime.md` — hits
- `openapi.smartout.internal.yaml` — API spec entries for Ultravox routes
- `openapi.smartout.v1.yaml` — same

**Protocol docs** (`docs/protocols/`):
- `ENV_PROTOCOL.md` — Ultravox key handling
- `ENV_VERIFICATION.md` — verification steps for Ultravox key

**State and summary docs**:
- `docs/STATE-SUMMARY.md` — ~10 hits; active state with Ultravox references
- `docs/INDEX.md` — ~5 hits; index entries for Ultravox files
- `docs/BUILD_ORDER.md` — ~3 hits
- `docs/SITEMAP.md` — ~2 hits
- `docs/HANDOFF-c1-mobile-voice-wiring.md` — PRESERVE (handoff)
- `docs/HANDOFF-c1b-botsson-voice-session.md` — PRESERVE (handoff)

**Plan docs** (`docs/plans/`, `docs/superpowers/`):
- `CAMPAIGN-botsson-arena.md` — ~20 hits; campaign overview
- `CAMPAIGN-core-module.md` — hits
- `PLAN-voice-plane-consolidation.md` — ~30 hits; design doc
- `PLAN-mobile-voice-wiring.md` — ~20 hits
- `PLAN-botsson-observability-foundation.md` — hits
- `PLAN-audit-sortie-4-mobile-remediation.md` — hits
- `PLAN-contract-mobile-employee.md` — hits
- `PLAN-order-system-blueprint.md` — hits
- `PLAN-stage-engine-profile-id-derivation.md` — hits
- `docs/superpowers/specs/2026-05-04-voice-plane-consolidation.md` — ~50 hits; primary spec
- `docs/superpowers/specs/2026-04-09-agent-harness-foundation-design.md` — hits
- `docs/superpowers/specs/2026-04-14-ai-operations-intelligence-design.md` — hits
- `docs/superpowers/specs/2026-04-23-harness-hardening-design.md` — hits
- `docs/superpowers/specs/2026-04-28-dashboard-help-design.md` — hits
- `docs/superpowers/plans/2026-05-08-ORCHESTRATION.md` — hits
- `docs/superpowers/plans/2026-05-08-doc-and-agent-instruction-consolidation.md` — hits

**Journey docs** (`docs/journeys/`):
- `JOURNEY-agent-architecture.md` — hits
- `JOURNEY-botsson-chat-input-request.md` — hits
- `JOURNEY-komm-gate-action-wiring.md` — hits
- `JOURNEY-mr-botsson-dashboard-orb-voice.md` — hits (active voice journey)
- `JOURNEY-onboarding-mission.md` — hits
- `JOURNEY-stage-engine-local.md` — hits
- `JOURNEY-voice-agent-fix.md` — PRESERVE
- `JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit.md` — PRESERVE
- `JOURNEY-voice-plane-consolidation-lise-interview-livekit.md` — PRESERVE
- `JOURNEY-voice-plane-consolidation-wizard-onboarding-via-livekit.md` — PRESERVE
- `JOURNEY-welcome-mission-rework.md` — hits

**Services docs** (`services/`):
- `services/stage-engine/README.md` — /adapters/ultravox/* route table
- `services/stage-engine/PRD.md` — product requirements doc
- `services/stage-engine/BREAKDOWN.md` — Epic 6 Ultravox section
- `services/stage-engine/DECISIONS.md` — design decisions
- `services/interview-mcp/README.md` — full Ultravox SDK reference section (~20 hits)

**Engines docs** (`docs/engines/`):
- `docs/engines/artificial-intelligence/HARNESS-ARCHITECTURE.md` — hits
- `docs/engines/artificial-intelligence/mission-engine/WELCOME_MISSION_V0.md` — hits
- `docs/engines/artificial-intelligence/stage-engien/WELCOME_MISSION_V0.md` — hits
- `docs/engines/system-intelligence/README.md` — hits
- `docs/engines/system-intelligence/packages/admin-onboarding-package/Journey.md` — hits
- `docs/engines/system-intelligence/packages/admin-onboarding-package/Roadmap.md` — hits
- `docs/engines/system-intelligence/packages/project-roadmap.md` — hits

**Legacy / Protokol / Business docs** (lower priority):
- `docs/Protokol/admin-onboarding-package/Journey.md` — hits
- `docs/Protokol/admin-onboarding-package/Roadmap.md` — hits
- `docs/Protokol/project-roadmap.md` — hits
- `docs/business/legal/databehandlingsavtale.md` — hit
- `docs/business/legal/tiltaksdokument-personvern.md` — hit
- `docs/legal/databehandlingsavtale.md` — hit (duplicate tree)
- `docs/legal/tiltaksdokument-personvern.md` — hit
- `docs/needs-rewrite/SMARTOUT_UI_ARCHITECTURE.md` — already marked needs-rewrite
- `docs/needs-rewrite/admin-onboarding.md` — already marked needs-rewrite
- `docs/User Manual/en/08-ai-assistant.md` — end-user facing; update voice provider mention
- `docs/User Manual/nb/08-ai-assistent.md` — Norwegian version; same

**Research docs** (`docs/research/`) — unbounded (PRESERVE per inventory rules):
- `INVESTOR-RESEARCH.md` — hits
- `LiveKit as Smartout's real-time.md` — hits; explicitly about the LiveKit migration
- `ag-ui/` — hits
- `ag-ui-six-technical-questions-and-answers.md` — hits

**Reports / Worklogs** (`docs/reports/`, `docs/worklogs/`) — all PRESERVE:
- `docs/reports/2026-03-18-teknisk-revisjonsrapport.md`
- `docs/reports/DEEP-SYSTEM-DOCUMENTATION-2026-03-24.md`
- `docs/reports/FULL-REPO-AUDIT-2026-03-24.md`
- `docs/reports/Smartout features.md`
- `docs/reports/worklogs/WORKLOG-dev-prod-fix.md`
- `docs/reports/worklogs/WORKLOG-guardian.md`
- `docs/reports/worklogs/WORKLOG-stage-engine-local.md`
- `docs/reports/worklogs/WORKLOG-stage-engine-routing.md`
- `docs/worklogs/WORKLOG-dev-prod-fix.md` (duplicate path)
- `docs/worklogs/WORKLOG-guardian.md`
- `docs/worklogs/WORKLOG-stage-engine-local.md`
- `docs/worklogs/WORKLOG-stage-engine-routing.md`

**Archive** (PRESERVE):
- `docs/archive/2026-05-08-doc-consolidation/BOTSSON-SYSTEM-MAP-engines-ai-stale-duplicate.md`
- `docs/archive/2026-05-08-doc-consolidation/STAGE-ENGINE-stage-engien-typo-duplicate.md`

**Council log** (PRESERVE):
- `docs/council/COUNCIL-LOG.md` — hits documenting voice-plane council sessions

---

### Skeleton/skill/agent (P6 rewrite — project-level .claude/ only)

**`.claude/skills/protocol-writer.md/mission-training.md`** (2 hits)
- Line 102: `Built by \`buildUltravoxTools()\` in \`services/stage-engine/src/lib/ultravox.ts\`. Available to ALL missions automatically.`
- Line 113: `Registered in \`useBotsson.ts\` as Ultravox \`temporaryTool\` with \`client: {}\`. Execute in React.`
- Action (P6): update both lines — `buildUltravoxTools` → LiveKit equivalent function; `temporaryTool` → LiveKit Agents tool registration

**`.claude/agents/botsson-harness-builder.md`** (1 hit)
- Line 82: `### Client tool (browser, Ultravox voice session)`
- Action (P6): update section header to `### Client tool (browser, LiveKit voice session)`

**`.claude/agents/system-agent-coordinator.md`** (3 hits)
- Line 44: `adapters/ultravox.ts    — Ultravox voice adapter`
- Line 51: `session.ts, guardian.ts, ultravox.ts, api.ts, agent.ts, auth.ts`
- Line 53: `secrets.ts                — Vault-loaded secrets (Ultravox, OpenRouter keys)`
- Action (P6): update file map — remove `ultravox.ts` from adapter list; update secrets description

---

## Out-of-band patch needed

The following paths in `~/.claude/` (global, operator-managed) were grep'd and contain Ultravox references. These are OUT OF SCOPE for automated agent edit. Operator must apply manual patches.

**`~/.claude/skills/smartout-agent-dev/SKILL.md`** — 6 hits (operator patch required)
- Line 19: `+-- Adapters: Ultravox (voice), Chat (SSE), Webhook (SMS/Email)`
  → Update: remove Ultravox from adapter list; replace with LiveKit Agents
- Line 51: `| **Ultravox Voice** | voice | WebRTC via Ultravox | \`POST /adapters/ultravox/agent-call\` | Planned |`
  → Update: remove row or replace with LiveKit Agents route
- Line 52: `| **Ultravox Mission** | voice | WebRTC via Ultravox | \`POST /adapters/ultravox/create-call\` | Active (missions) |`
  → Update: change to LiveKit room-token endpoint
- Line 70: `| POST | \`/adapters/ultravox/create-call\` | mission | dual | Create voice call |`
  → Update: remove row (route is deleted in Task 8)
- Line 71: `| POST | \`/adapters/ultravox/agent-call\` | agent | dual | Create voice agent call |`
  → Update: remove row
- Line 134: `Stage Engine --> OpenRouter (LLM), Ultravox (voice)`
  → Update: `Stage Engine --> OpenRouter (LLM), LiveKit Agents (voice)`

**`~/.claude/CLAUDE.md`** — 0 hits (no global CLAUDE.md changes needed)

---

## Verification

```
grep -rni "ultravox" apps/ packages/ services/ supabase/ docs/ infra/ \
  --include="*.ts" --include="*.tsx" --include="*.md" \
  --include="*.json" --include="*.yml" --include="*.yaml" \
  --include="*.env.template" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=".next" \
  --exclude-dir=".turbo" --exclude-dir=".git" --exclude-dir=coverage \
  --exclude="pnpm-lock.yaml" --exclude="*.lock" | wc -l
```

**Result at P4 capture time: 1309 hits across 269 files.**

Root-level files (CLAUDE.md, .env.template): 4 additional hits not in the 1309 count above.
Project `.claude/` files: 6 additional hits.
Global `~/.claude/` files: 6 hits (out-of-band, not in grep scope).

### Anomalies / flags

1. **High cardinality (1309 hits)** — majority (~840 of 1309) are prose-replace targets in `docs/` and `packages/Botsson/blueprints/`. Code-ref hits are ~87 lines concentrated in 19 files. This is expected given extensive documentation coverage.

2. **`supabase/migrations/20260318130100_emma_conversation.sql`** — migration file contains Ultravox comment on line 2. PRESERVE unconditionally — migration files are immutable. The comment does not affect runtime behavior.

3. **`docs/archive/` hits** — 2 files in `docs/archive/2026-05-08-doc-consolidation/`. Flagged as archive; these are PRESERVE (superseded duplicates archived, not to be edited).

4. **Duplicate doc trees** — Several files appear in both `docs/engines/` and `docs/agents/` paths AND in `docs/Protokol/` and `docs/engines/system-intelligence/`. Both paths are in-scope but the content is identical. P5 should update both copies or verify which path is canonical.

5. **`docs/needs-rewrite/` files** — already classified as needing rewrite. Ultravox references in these files are expected; do not track separately.

6. **`packages/agent-sdk/src/providers/livekit.ts` — `UltravoxApiParams` type** — this translation shim was written to bridge legacy callers. Post-E6, verify whether any callers remain after `useBotsson.ts`, `BotssonProvider.tsx`, and wizard routes are updated. If zero callers: delete the type and function. If callers remain: rename `UltravoxApiParams` → `LegacyVoiceApiParams` or `LiveKitAgentsInput`.

7. **`apps/web/src/components/voice-assistant.tsx`** — line 15 self-annotates as pending deletion in Task 8. Verify full file scope before delete — it may be imported by other components.

8. **`docs/superpowers/plans/2026-05-08-phase-e-cutover-tracks-2-3-4-6.md`** appears in hits — it is a live plan doc, not completed. PRESERVE per inventory rules (active-plan classification in ULTRAVOX-DEPRECATION-INVENTORY.md).
