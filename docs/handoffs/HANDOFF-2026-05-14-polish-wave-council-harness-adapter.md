---
title: Page-Polish Wave Council + Harness Adapter Vision — Handoff
status: in_progress
updated: 2026-05-14
created: 2026-05-14
module: smartout-page-polish + botsson-harness
tags: [polish, harness-adapter, council, skill-update, dead-pipe, livekit, stage-engine]
---

# Handoff — Polish Wave Council Findings + Harness Adapter Vision

**Date:** 2026-05-14
**Author:** Claude (Opus 4.7) under Pontus orchestration
**Context window status at handoff:** 433k/600k (72%) — Charan Compact next, then continue
**Branch:** `development` (all commits pushed)

---

## TL;DR (read this first)

This session ran a 6-batch page-polish wave across the dashboard, then ran a 5-reviewer System Council to verify harness integration. The council surfaced **the polish wave shipped 75 page-scope tools that no LLM can actually see**. The client tool-registry works correctly up to `BotssonProvider.botssonTools`, but the pipe from there to any LLM is broken:

- **Voice path:** `BotssonProvider` → `useAgent` serializes `selected_tools` → POSTs to `/api/wizard/start` → **endpoint never reads the field, silently dropped**. `LiveKitVoiceSession.registerTool()` at `packages/agent-sdk/src/providers/livekit.ts:38-40` is a stub.
- **Chat path:** Chat BFF `/api/botsson/chat` forwards no tool fields to stage-engine. Stage-engine schema has no `client_tools` receiver.

**Skill (`smartout-page-polish`) claim about "BFF → context_init → voice-agent reads site-map.json and injects `## Sidekart`" is FALSE-AS-SHIPPED — aspirational claim shipped as factual.**

Pontus's response: build a **unified `HarnessAdapter`** that any LLM consumer (voice agent, chat agent, future Slack/email/API agents) plugs into. ADR-draft scheduled next.

Three immediate P0 actions before compact:
1. Demote skill claims (Phase 7 + Phase 8 marked "client registry: wired; LLM delivery: missing")
2. Add `// DEAD-PIPE-2026-05-14` marker to 17 `_tools/use-*-tools.ts` hooks shipped this session
3. Write council log + learning + ADR-draft frontmatter

**This handoff is the input to the post-compact resume.** Read it cold; everything you need to continue is below.

---

## What this session shipped (in order)

| Commit | Subject | Effect |
|---|---|---|
| `ce79966e6` | `feat(polish): /dashboard/settings/operations` | 4 tools, scope `settings-operations` |
| `4eee7573f` | `feat(polish): /dashboard/my-profile/complete` | 3 tools, scope `my-profile-complete`, PII-safe pattern established |
| `f8e758bc7` | `feat(polish): hms sub-routes` | 4 sub-routes, 13 tools across `hms-{deviations,documents,drift,governance}` |
| `0f901a637` | `feat(polish): contracts sub-routes` | 4 sub-routes, 10 tools across `contract-{detail,revise}` + `contracts-awaiting-signature` + `/new` (redirect-shell, 0 tools) |
| `8b7976a37` | `feat(polish): billing sub-routes + contracts page wiring restore` | 2 sub-routes, 9 tools across `invoice-detail` + `billing-settings`. Also restored 3 contracts page.tsx wirings dropped by lint-staged stash-restore in `0f901a637`. |
| `e3011d566` | `docs(skill): page-polish — Phase 7.5 tool patterns + 7 new Common-Mistake entries` | Skill grew 370 → 537 lines. Phase 7.5 codifies dataRef, ClientToolParameter shape, Server-Component bridge, PII-safe types, no-mutation financial, distinct-scopes. |
| `fe1b26dcc` | `feat(husky): pre-commit §10 — Nordic Split + motion-token drift gate (strand 1)` | Mechanical grep-gate on added lines in staged dashboard files. Blocks new zinc/gray/slate, inline stiffness/damping, inline duration/ease. Bypass `SKIP_DESIGN_AUDIT=1`. |
| `332da9c13` | `chore(husky): restore exec bit on pre-commit + commit-msg hooks` | WSL stripped exec bits; restored via `git update-index --chmod=+x`. |

**Site-map state:** 47 routes / 70 useRegisterTools scope strings / ~75 new tools this session (~269 total tools in site-map.json after).

**Dashboard polish-wave totals across this session + prior session(s):** 47 polished routes. Remaining deferred (per `what's left to polish?` reply): ai/config, hms/{procedure/[id], training}, komm/* (5 sub-routes), my-salary/[lonnsgrunnlagId], organization/teams/[id], payroll + payroll/[periodId], proposals/[proposalId], settings/operations/tips. Plus excluded: website/* (user skip), people/* (wt-13 owns).

---

## The big finding — Phase 7 and Phase 8 ship to /dev/null

### Pipe trace for one example tool (`getDeviationsOverview` on scope `hms-deviations`)

| Layer | Status | Evidence (file:line) |
|---|---|---|
| L1 Page mounts bridge | 🟢 wired | `apps/web/src/app/dashboard/hms/deviations/page.tsx:24-46` mounts `HmsDeviationsToolsBridge` in both admin + employee branches |
| L1 Bridge registers | 🟢 wired | `apps/web/src/app/dashboard/hms/deviations/_tools/hms-deviations-tools-bridge.tsx:32` calls `useRegisterTools("hms-deviations", tools)` |
| L1 Registry stores kit | 🟢 wired | `apps/web/src/app/Botsson/_components/tool-registry.ts:53-65` `registerTools()` sets in `Map<string, RegisteredToolSet>` + notifies subscribers |
| L1 Provider reads aggregate | 🟢 wired | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:715` `const registeredTools = useRegisteredTools()`; lines 719-742 merge with `baseTools` into `botssonTools` |
| L1 Provider hands to useAgent | 🟢 wired | `BotssonProvider.tsx:776-779` passes `tools: botssonTools` to `useAgent({ missionId: "botsson-session", ... })` |
| L1 useAgent serializes | 🟢 wired | `packages/agent-sdk/src/context/session-context.ts:28-29` writes `body.selected_tools = definitions` |
| L2 POST to `/api/wizard/start` | 🟡 partial | `useAgent` POSTs with `body.selected_tools` populated |
| **L2 Endpoint reads body** | **🔴 BREAK** | `apps/web/src/app/api/wizard/start/route.ts:38-130` reads `mission_id`, `voice`, `language`, `first_speaker`, `context` — **does NOT read `selected_tools`**. Field silently discarded. |
| L2 voice-agent token issued | 🟢 wired (but with empty tools) | `/api/wizard/start` calls `livekit-token` Edge Function — voice-agent worker boots with its own server-side tool registry, not the client-shipped one |
| L3 Voice-agent boot | 🟢 wired (with stub) | `services/voice-agent/src/agent.ts:200` calls `buildAllBotssonTools()` server-side from `buildPersonalTools` + `buildCapabilityQueryTools` (`adapter.ts:178-179`) + mission/orb/schedule. Page-scope tools from L1 registry are NOT here. |
| **L3 LiveKitVoiceSession.registerTool** | **🔴 STUB** | `packages/agent-sdk/src/providers/livekit.ts:38-40` — `registerTool() is a stub — not yet implemented`. Even if tools traveled from L1 to here, they would be dropped. |
| L2 chat path BFF | 🔴 missing | `apps/web/src/app/api/botsson/chat/route.ts:38-59` `RequestSchema` has no tool fields. Lines 222-247 proxy to stage-engine with no `client_tools` / `selected_tools` field. |
| L3 stage-engine chat schema | 🔴 missing | `services/stage-engine/src/routes/agent/chat.ts:1-167` accepts no `client_tools` field. `toVercelTools()` (`packages/ai/src/adapters/vercel-ai.ts:46`) operates only over server-side `SmartoutTool` registry. |
| L4 capability layer | N/A by design | Page-scope tools are a different category (React-side `ClientToolDefinition`) from `SmartoutTool<AgentToolContext>`. Boundary not formally documented in `BOTSSON-SYSTEM-MAP.md`. |
| L5 Persistence (read-only tools) | 🟢 N/A | This session's tools are read + view-state mutators. No DB writes. ADR-0134 emit-on-mutation applies to persistence mutations, not in-memory view state. Correct. |
| L5 Persistence (notifications mutators from prior wave) | 🟢 wired | `packages/notifications/src/hooks/use-notifications.ts:126-148, 194-205` — `markAsRead` / `markAllAsRead` call `emit()` in `onSuccess` with `nonEmpty()` guards. |

### Consequence

**Pontus's 75 client-side tools mounted this session cannot be invoked by Botsson on either chat or voice today.** They register correctly in the browser, merge correctly in `botssonTools`, ship correctly to `useAgent`, and then disappear at two distinct break points (wizard/start drops the body field; LiveKit registerTool is a stub).

This was **invisible** to:
- TypeScript (all types compile)
- Pre-commit hook (all gates pass)
- Site-map validator (`pnpm site-map:validate` exit 0)
- Concept-level reviewers (Steward, Supervisor, Frontend-Designer all initially accepted "Phase 7 is wired")

It was caught ONLY by code-tracers (Agent-Coord + Harness-Builder reviewers) walking the pipe step-by-step.

**L-0147 Chair Self-Reversal — 4th documented occurrence.** Phase 3 chair claim "Phase 7 is wired e2e" was REVERSED in Phase 5 with code-trace evidence.

---

## Council verdict — REJECT WITH CONSTRUCTIVE PLAN

Polish-wave commits stand (correct in isolation: types compile, bridges mount, registry receives, conventions hold, strand 1 gate works). What's wrong is the **skill text's claim** that this work makes Botsson useful at runtime.

### Other critical findings from the council

**1. PII leak surface (Supervisor + Harness + Frontend converge):**
- `use-contract-detail-tools.ts:45-46` exposes `hourly_rate: number | null, monthly_salary: number | null` in bridge input type and tool result (line 172-173).
- `use-invoice-detail-tools.ts:130` exposes `amountInclVat`, `payment_reference` directly.
- PII-safe pattern documented in Phase 7.5 §4 only covers `my-profile-complete` (personnummer + address).
- ADR-0078 risk dormant today (tools never reach LLM), live when pipe ships.

**2. No-mutation rule on financial surfaces is convention-only:**
- Future agent could add `markInvoicePaid` to `invoice-detail` scope. Passes typecheck, lint, validator, pre-commit clean.
- No detector exists.

**3. Scope-naming inconsistency (3 axes):**
- Singular vs plural: `contract-detail` vs `contracts-awaiting-signature`
- Module-prefix presence: `hms-deviations` (prefixed) vs `invoice-detail` (NOT prefixed — billing/[invoice_id])
- Sub-route convention varies same-depth: `settings-operations` (prefixed parent) vs `invoice-detail` (no parent prefix)

**4. Tool-name collisions site-wide:**
- 11 duplicate `modelToolName` values across scopes (`listOpenDeviations` 3x, `getInvoiceDetail` 2x, `getDriftStatus` 2x, `getProtocolDetail` 2x, `getCurrentStep`, `getSeasonProgress`, `getReconciliationDetail`, `openStep`, `listTeams`, `getUnreadCount`, `proposeArchiveSeason`, `proposeActivateSeason`, `switchStatusFilter`, `switchDate`, `addSessionTask` — 2 each).
- Validator allows (different scopes). Once pipe ships, Vercel AI SDK may reject duplicates, or LLM nondeterministic on tool selection.

**5. dataRef pattern silent-regression surface:**
- Phase 7.5 §1 documents it. Not gated.
- TS won't catch `const x = input.field` inside implementation closure (stale closure → tool returns stale data).

**6. Validator check 6 is no-op for the bridge pattern:**
- `apps/web/scripts/validate-site-map.ts` strict tool-name drift check only covers inline kit registrations.
- Every `_tools/use-*-tools.ts` hook this session ships kit via variable → flagged "indirect" → skipped.
- Site-map drift checking effectively unenforced for the new pattern this session institutionalized.

**7. Strand 1 (just shipped) misses (Frontend findings):**
- Typography hierarchy: `<h1>` without `font-heading` passes
- Data display: numeric/monetary text without `font-mono` passes
- Hardcoded inline styles: `style={{ backgroundColor: '#18181b' }}` bypasses palette grep
- `transition-all` (one-line add to grep)
- `shadow-xl|shadow-2xl|drop-shadow` on glass surfaces (warn-only add)
- Empty-state copy quality (LLM-judgment territory)
- Skeleton dimension mismatch (visual regression territory, not grep)
- Motion direction inconsistency (spatial protocol, not text pattern)

---

## The vision Pontus accepted — Unified HarnessAdapter

After the council surfaced fragmentation (chat pipe vs voice pipe vs site-map injection — three different paths in my initial framing), Pontus rejected the split and articulated the correct architecture:

> One adapter. Any agent (voice, chat, Slack, email, API) plugs into SmartOut Harness. Tools, descriptions, context, site-map all flow through one path.

### Contract (proposed)

```
SmartoutHarness (single source of truth)
   ├── client tool registry (75 page-scope tools, browser-side Map)
   ├── server capability registry (~30 backend capabilities in packages/ai/src/capabilities/)
   ├── site-map (route → tools → access → purpose, currently apps/web/.botsson/site-map.json)
   ├── context snapshot (user, workspace, workforce — already exists in botsson-context-snapshot.ts)
   └── authority config (gate_action, channel restrictions per ADR-0078, ADR-0151 workspace_id derivation, ADR-0244 financial-mutation block)

   ↓ exposes via ONE contract: HarnessAdapter

HarnessAdapter.getToolsForChannel(channel, pageRoute, userContext)
   → returns: { definitions, implementations, systemPromptSlices, authority }

HarnessAdapter.getSiteMap()
   → returns: { routes[], tools[], common_intents[] }  (subset filtered by user access)

HarnessAdapter.subscribeToRouteChange(callback)
   → emits when user navigates; consumers re-fetch tools for the new route

Consumers (all use same adapter):
  - Chat: stage-engine BFF reads adapter, merges before generateText
  - Voice: voice-agent worker reads adapter on session start + on route change
  - Future Slack bot: reads adapter when channel mention
  - Future email assistant: reads adapter when email arrives
  - Future API agent: reads adapter on session token issue
```

### Why unified (vs my original chat-vs-voice split)

| My fragmented framing | Unified adapter |
|---|---|
| Wire chat schema OR LiveKit stub OR on-demand site-map tool — pick one | Build adapter once, every consumer plugs in |
| Site-map injected by chat-side prompt slice | Adapter publishes site-map; any consumer reads it |
| Voice gets different tools than chat | Same adapter → same tools (filtered by channel rules) |
| 75 tools live in client React registry | Tools live in harness, mirrored to client registry, served to ANY consumer |
| L-0233 two-LLM-context trap recurs | Adapter normalizes; one source of truth |

### Build sequence (post-compact, after ADR-draft)

1. **Phase 1 — Define `HarnessAdapter` interface** in `packages/ai/src/harness/` (new dir). Types: `getTools()`, `getSystemPromptSlices()`, `getAuthority()`, `getSiteMap()`, `subscribeToRouteChange()`.
2. **Phase 2 — Implement registry source.** Adapter reads from existing tool-registry singleton (client-side), existing capabilities registry (server-side), site-map.json, context-snapshot helper.
3. **Phase 3 — Chat consumer.** Stage-engine BFF + `/agent/chat` schema accepts adapter output. Replace existing `toVercelTools` chain.
4. **Phase 4 — Voice consumer.** Fill LiveKit stub. Voice-agent worker boots reading from adapter. Hot-swap on route change via LiveKit data channel.
5. **Phase 5 — Authority layer.** `ADR-0151` server-derived workspace_id, `ADR-0078` channel restrictions, `ADR-0244` financial-mutation block — all enforced in adapter `getAuthority()`.
6. **Phase 6 — Future consumers** (Slack/email/API): plug in via same interface.

### Decision needed in ADR-draft

- Where does adapter live? `packages/ai/src/harness/` vs `services/harness-adapter/` (new service)?
- Tool-delivery transport for voice: LiveKit data channel vs LiveKit RPC vs custom WebSocket?
- Per-route hot-swap or session-fixed? (Voice agent is long-lived; route change must update tools without reconnect.)
- Authority enforcement: client-side filter (insecure) vs server-side filter (correct, requires server adapter copy)?
- Token-budget management: site-map is large (47 routes, 269 tools). Inject full or on-demand-via-tool? (Agent-Coord recommended on-demand `requestSiteMap()`.)

---

## Skill update plan (smartout-page-polish)

The skill is **partially outdated**. What's correct vs incorrect:

### What's correct in the skill today

- Phase 1-3 speed test workflow ✅
- Phase 4 UI/UX rules (Nordic Split, motion tokens) ✅
- Phase 4 strand 1 grep-gate reference (just added) ✅
- Phase 5 telemetry registry rules ✅
- Phase 6 page instructions (header + empty + error copy) ✅
- Phase 7 useRegisterTools mechanics ✅ (the React-side registry IS wired correctly)
- Phase 7.5 tool implementation patterns (added this session — 6 subsections) ✅
- Phase 7.6 Botsson Surface Disambiguation ✅
- Phase 8 site-map.json drift validation (mechanical drift check works) ✅
- Common Mistakes (10 new entries added this session) ✅

### What's WRONG in the skill today (must be demoted)

**Phase 7 claim:** the skill implies the registered tools reach Botsson at runtime.
- **Reality:** they reach the client `botssonTools` aggregate but stop at `/api/wizard/start` (body field dropped) and at `LiveKitVoiceSession.registerTool` stub. Chat path has no transport at all.

**Phase 8 claim (lines ~244 + Cross-References):**
> "the bootstrap pipe BFF → context_init → voice-agent (same one that delivers the workforce snapshot 2026-05-13) reads this JSON and injects `## Sidekart` as a developer message in the Realtime LLM's chat context."

- **Reality:** NO consumer of site-map.json exists in `apps/web/src/` or `services/`. Only `apps/web/scripts/validate-site-map.ts` reads it (drift detector). The "BFF → context_init" pipe described is not implemented.

**Phase 8 claim (failure modes table):**
> "| Botsson says 'siden finnes ikke' for a polished page | Entry missing from site-map.json |"
> "| Botsson calls `query_smartout` to look up a tool that exists on the page | Tool registered in `useRegisterTools` but not listed in entry's `tools` array |"

- **Reality:** these failure modes describe a world where Botsson reads site-map.json. Botsson today does NOT read site-map.json. The actual failure mode is: Botsson cannot answer "hvor finner jeg HMS-loggen?" at all because no route knowledge reaches the LLM.

### Skill update — concrete edits required

**Edit 1 — Add a "Runtime Status (2026-05-14)" block to Phase 7:**

```markdown
### Runtime Status (2026-05-14 — council finding)

**Phase 7 client registry:** wired ✅ (registry singleton stores kits, BotssonProvider merges into botssonTools).

**Phase 7 client → LLM delivery:** MISSING 🔴
  - Voice path: `/api/wizard/start` route silently drops `body.selected_tools`. `LiveKitVoiceSession.registerTool()` at `packages/agent-sdk/src/providers/livekit.ts:38-40` is a stub.
  - Chat path: `/api/botsson/chat` forwards no tool fields. `services/stage-engine/src/routes/agent/chat.ts` schema has no `client_tools` receiver.

**Consequence:** tools registered via `useRegisterTools` cannot be invoked by Botsson today on either channel. They exist in browser memory for future hot-swap when the HarnessAdapter (ADR-draft pending) ships.

**Do NOT remove `useRegisterTools` calls.** The registry is the upstream source the HarnessAdapter will read from. Polish-wave Phase 7 work is correct preparation; the consumer pipe is what's missing.
```

**Edit 2 — Demote Phase 8 site-map.json claims:**

Replace the current "Why this matters" paragraph (lines ~244) with:

```markdown
**Status (2026-05-14):** site-map.json is currently a **documentation + drift-detection artifact only**. The BFF → context_init injection pipe described in prior versions of this skill does NOT exist in code. ADR-draft pending (HarnessAdapter — unified LLM-consumer adapter, sortie next).

Once the HarnessAdapter ships, site-map.json will be the canonical route catalog read by every LLM consumer (chat, voice, future Slack/email/API). Until then, Phase 8 entries serve:
- Drift validator (`pnpm site-map:validate`) — enforces `useRegisterTools` ↔ JSON entry consistency
- Human reference — what surfaces have been polished, what tools they expose
- Future-target — HarnessAdapter will read this JSON when injection ships
```

Update the failure modes table to mark the runtime failure modes as `(pending HarnessAdapter ship)`.

**Edit 3 — Add Phase 0 (pre-polish capability check) — Harness Builder recommendation:**

```markdown
## Phase 0 — Pre-Polish Capability Check

Before starting Phase 1, verify the page's data is actually available to the runtime LLM:

1. Does a relevant backend capability exist in `packages/ai/src/capabilities/`? If yes, this page's tools may overlap — name them distinctly.
2. Is `gate_action` seeded for the relevant workspace? (Check `engine_authority_config`.)
3. Is the telemetry registry entry written? (For any planned mutation in Phase 5.)
4. Is the data hook used by this page in `packages/` (mobile parity) or `apps/web/` (web-only)? Per ADR-0133/0134, shared logic in packages.

If any answer is "no, but planned for this polish session," ship the prerequisite first (separate commit).
```

**Edit 4 — Add Phase 9 (mobile parity check) — Harness Builder recommendation:**

```markdown
## Phase 9 — Mobile Parity Verification

Before flipping `verified: true`, verify ADR-0133 alignment:

1. Are the data hooks this page uses living in `packages/` (not `apps/web/src/hooks/`)?
2. If this page handles a "verb" that mobile owns per ADR-0133 (Approve/Execute/Witness/D6 production), does a mobile counterpart exist in `apps/mobile/src/`?
3. If not, document in `run.yml` under `mobile_parity:` field as `pending` with linked issue.

Mobile-polish is a separate skill (planned: `smartout-mobile-polish`). Phase 9 here is only the data-layer parity check.
```

**Edit 5 — Strand 1 gate extensions (P2 from council — pending Pontus call):**

If approved post-compact:

```bash
# Add to .husky/pre-commit §10
- transition-all on added lines in dashboard files
- shadow-xl|shadow-2xl|drop-shadow on added lines (WARN, not BLOCK)
- modelToolName: "(mark|set|pay|sign|approve|complete|update|delete)\w+" inside _tools/use-*-tools.ts under billing/**, my-salary/**, payroll/**, invoice*, contracts/[id]/_tools/
- const \w+ = input\. inside _tools/use-*-tools.ts implementation closures (dataRef bypass)
```

**Edit 6 — Scope-naming convention (Supervisor R1):**

Add to Phase 7.5 §6:

```markdown
### Scope-Naming Convention

Rule: `<parent-route-segment>-<leaf>` for nested routes, hyphenated, lowercase.

Examples:
- `/dashboard/hms/deviations` → scope `hms-deviations` ✅
- `/dashboard/settings/operations` → scope `settings-operations` ✅
- `/dashboard/billing/[invoice_id]` → scope `billing-invoice-detail` (NOT `invoice-detail`) ✅
- `/dashboard/contracts/[id]` → scope `contracts-detail` (NOT `contract-detail` — match parent route segment) ✅
- `/dashboard/contracts/awaiting-my-signature` → scope `contracts-awaiting-signature` ✅

Validator will warn (P2): scope without parent-route-segment prefix.

Existing scopes shipped before 2026-05-14 are grandfathered; rename via sortie if collision is observed.
```

**Edit 7 — Common Mistakes — add 2 entries:**

```markdown
| Trusting skill text claims about runtime pipes without code-trace verification | Pre-flight fact-check must include grep for the alleged consumer of any artifact the skill text references. Phase 7 + Phase 8 false-claim 2026-05-14 occurred because skill text wasn't trace-verified. L-0147 4th occurrence. |
| Writing skill text describing pipe behavior in present tense without verifying in last 30 days | Skill text drifts from reality faster than code does. Mark aspirational claims as "future-target" or annotate with verified-date footer. |
```

---

## Strand 1 grep-gate — already shipped, status notes for resume

Committed `fe1b26dcc` + `332da9c13` (exec-bit fix). Live now.

**Patterns blocked on added lines in `apps/web/src/app/dashboard/**.{tsx,ts,css}`:**
1. `\b(zinc|gray|slate)-[0-9]+\b` (Tailwind palette)
2. `(stiffness|damping):\s*[0-9]` outside `motionTokens.`
3. `(duration:\s*0\.|ease:\s*\[)` outside `motionTokens.`

**Bypass:** `SKIP_DESIGN_AUDIT=1 git commit "..."` (document why in message body).

**Pre-existing debt not gated:** 52 hits (4 palette + 32 spring + 16 timing) across 14 files. Listed in `smartout-nordic-split` skill "Current debt (snapshot 2026-04-28)" section. Plan a `motion-token-sweep` sortie to close, Tier 0 shared primitives first.

**Tested scenarios (verified locally before push):**
- ✅ Palette hit (`bg-zinc-700`) BLOCKED with clear error
- ✅ Inline spring (`stiffness: 35, damping: 22`) BLOCKED
- ✅ Inline duration + ease array BLOCKED
- ✅ `motionTokens.*` usage + CSS variables PASSES
- ✅ `SKIP_DESIGN_AUDIT=1` override PASSES

**Possible extensions (council recommendations, pending Pontus call post-compact):**
- `transition-all` (one-line add, zero false-positive risk)
- `shadow-xl|shadow-2xl|drop-shadow` (warn-only)
- Financial-mutation tool names in `_tools/` under billing/payroll/my-salary
- Direct prop read in implementation (dataRef bypass detector)

---

## Knowledge to capture in next session (Phase 8 of council)

### ADR (proposed) — `XXXX-harness-adapter-unified-llm-consumer.md`

**ID reservation:** run `git log --all --name-only | grep -E 'docs/decisions/[0-9]{4}-' | sort -u | tail -10` before picking. Latest known ADR `0297` (workforce bootstrap). Likely next: `0298+` but verify against ALL branches including campaigns.

**Title:** SmartOut Harness — Unified LLM-Consumer Adapter

**Status:** proposed

**Context:** Council 2026-05-14 surfaced that page-scope tools registered via `useRegisterTools` and route catalog in `site-map.json` are runtime-unconsumed. Chat path and voice path each have a different gap. Future consumers (Slack, email, API) would multiply the fragmentation.

**Decision:** Build a unified `HarnessAdapter` in `packages/ai/src/harness/` exposing tools, system-prompt slices, authority, and site-map to any LLM consumer through one contract. Implement chat consumer first (cheaper), voice consumer second (requires LiveKit API spike), document future-consumer plug-in pattern.

**Supersedes:** implicit Phase 7/Phase 8 runtime claims in `smartout-page-polish` skill (mark demoted simultaneously).

**Related:** ADR-0078 (channel pinning), ADR-0133 (mobile boundary), ADR-0151 (workspace_id auth-derived), ADR-0244 (financial-mutation risk tier), ADR-0297 (workforce bootstrap precedent), L-0233 (two LLM contexts trap), L-0147 (chair self-reversal pattern, 4th occurrence).

### Learnings (mandatory per Phase 8)

**L-XXXX:** Skill text shipped aspirational pipe claim as factual current behavior. Code-tracer caught dead-code that 3 concept-level reviewers missed. 4th occurrence of L-0147 Chair Self-Reversal pattern. **Promotion:** add new Common Mistake to `run-council` skill — "Pre-flight fact-check MUST grep for the alleged consumer of any artifact the skill text references."

**L-XXXX:** Lint-staged stash-restore can drop staged page.tsx edits when commit bundle includes both staged files AND pre-existing unstaged file deltas (occurred 2026-05-14 contracts commit `0f901a637`, restored in `8b7976a37`). **Mitigation:** Post-commit `git status` + diff-check on expected page edits. Promoted to `smartout-page-polish` Common Mistakes this session.

**L-XXXX:** WSL filesystem strips executable bit on `.husky/*` hooks when files are edited via WSL editors. Symptom: git advisory "hook was ignored because it's not set as executable" — hook silently no-ops despite content changes. **Mitigation:** After any edit to `.husky/*`, run `chmod +x .husky/<file> && git update-index --chmod=+x .husky/<file>` to commit the mode change.

### Council Session Log (write to `docs/council/COUNCIL-LOG.md`)

```markdown
## 2026-05-14 — Page-Polish Skill Audit + Harness Integration E2E
**Type:** post-implementation
**Verdict:** REJECT WITH CONSTRUCTIVE PLAN
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer
**Prior verdict held?** n/a — first council on polish-skill enforcement
**Key decision:** 75 page-scope tools shipped this session are dead-pipe. Demote skill claims, draft ADR for unified HarnessAdapter, mark dead-pipe in _tools hooks.
**ADR created:** XXXX (proposed, draft frontmatter only this session)
**Learning created:** 3 (skill-claim-trace, lint-staged stash trap, WSL exec bit)
**Chair self-reversed:** YES — Phase 3 "Phase 7 wired" → Phase 5 REVERSED with code-trace evidence
```

---

## Resume checklist (post Charan Compact)

When you wake up after compact, do this in order:

1. **Read this handoff in full.** Path: `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md`.
2. **Verify git state:** `git log --oneline -10` should show `332da9c13` (exec bit) as latest, on `development` branch, pushed to origin.
3. **Confirm strand 1 still live:** `ls -la .husky/pre-commit` shows `-rwxr-xr-x`. Run `grep -n "Nordic Split" .husky/pre-commit` returns line ~287.
4. **Confirm Pontus's P0 directive.** Last message before compact: Pontus accepted unified HarnessAdapter vision, asked for ELI10 explanations. Sequence expected post-compact:
   - P0 immediate cleanup (demote skill text + dead-pipe markers + council log)
   - ADR-draft for HarnessAdapter
   - Strand 1 P2 extensions (if Pontus says yes)
5. **Don't re-run the council.** Verdict captured in this handoff. Phase 6 user-confirm equivalent answered: Pontus approved direction (unified adapter), questions answered (Q1+Q2 ELI10), Q3 simplified pending.

---

## Open questions for Pontus to confirm post-compact

| Q | Question | Default if no answer |
|---|---|---|
| Q1 | Ship P0 (demote skill + dead-pipe markers + council log) in one commit? | Yes — small, mechanical, no risk |
| Q2 | ADR-draft for HarnessAdapter — write frontmatter only this session or full body? | Frontmatter + context + decision section; defer full body to dedicated sortie |
| Q3 | Strand 1 P2 extensions — add `transition-all` + financial-mutation-grep now? | Add #1 only (transition-all, lowest risk). Queue #3 separate sortie since needs path-aware grep. |
| Q4 | Quarantine marker on 17 dead-pipe `_tools/use-*-tools.ts` files — exact wording? | `// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-XXXX (HarnessAdapter pending)` at top of file. |
| Q5 | Scope-naming convention — rename `invoice-detail` → `billing-invoice-detail` retroactively? | NO — grandfather existing. Apply rule to new scopes only. Document rule. |
| Q6 | HarnessAdapter — `packages/ai/src/harness/` or `services/harness-adapter/`? | `packages/ai/src/harness/` — shares types with capabilities + adapters. Becomes the "L4-bridge" the system-map has been missing. |

---

## Files modified this session (full list, for grep)

```
docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md  (this file, NEW)
.husky/pre-commit                                                         (§10 added, exec bit restored)
.claude/skills/smartout-page-polish/SKILL.md                              (Phase 7.5 + 7.6 rename + Phase 8 hook rules + 10 Common Mistakes)
apps/web/.botsson/site-map.json                                            (47 routes, 70 scopes)
apps/web/src/app/dashboard/organization/departments/[id]/_tools/           (use-departments-tools + bridge)
apps/web/src/app/dashboard/organization/locations/_tools/                  (use-locations-tools + bridge)
apps/web/src/app/dashboard/organization/teams/_tools/                      (use-teams-tools + bridge)
apps/web/src/app/dashboard/organization/teams/page.tsx                     (NEW)
apps/web/src/app/dashboard/settings/operations/_tools/                     (use-settings-operations-tools + bridge)
apps/web/src/app/dashboard/settings/operations/page.tsx                    (rewritten as client component)
apps/web/src/app/dashboard/settings/operations/loading.tsx                 (NEW, returns null)
apps/web/src/app/dashboard/my-profile/complete/_tools/                     (PII-safe pattern, booleans only)
apps/web/src/app/dashboard/my-profile/complete/page.tsx                    (bridge mounted in both branches)
apps/web/src/app/dashboard/hms/deviations/_tools/                           (5 tools, admin-split)
apps/web/src/app/dashboard/hms/deviations/page.tsx                          (bridge in all 3 branches)
apps/web/src/app/dashboard/hms/documents/_tools/                            (2 tools)
apps/web/src/app/dashboard/hms/documents/page.tsx                           (bridge mounted)
apps/web/src/app/dashboard/hms/drift/_tools/                                (3 tools, useDriftInsights hoisted)
apps/web/src/app/dashboard/hms/drift/page.tsx                               (rewritten with hoisted hook)
apps/web/src/app/dashboard/hms/governance/_tools/                           (3 tools, distinct scope from /dashboard/governance)
apps/web/src/app/dashboard/hms/governance/page.tsx                          (bridge mounted)
apps/web/src/app/dashboard/contracts/[id]/_tools/                           (5 tools, read + nav)
apps/web/src/app/dashboard/contracts/[id]/page.tsx                          (bridge mounted in all 3 branches — restored in 8b7976a37)
apps/web/src/app/dashboard/contracts/[id]/revise/_tools/                    (2 tools)
apps/web/src/app/dashboard/contracts/[id]/revise/page.tsx                   (bridge mounted — restored in 8b7976a37)
apps/web/src/app/dashboard/contracts/awaiting-my-signature/_tools/          (Server-Component + Client-Island pattern)
apps/web/src/app/dashboard/contracts/awaiting-my-signature/page.tsx         (bridge mounted — restored in 8b7976a37)
apps/web/src/app/dashboard/contracts/new/                                   (no _tools — redirect shell)
apps/web/src/app/dashboard/billing/[invoice_id]/_tools/                     (5 tools, no mutation per ADR-0244)
apps/web/src/app/dashboard/billing/[invoice_id]/page.tsx                    (Server-Component + Client-Island)
apps/web/src/app/dashboard/billing/settings/_tools/                         (4 tools, top-level eager fetch)
apps/web/src/app/dashboard/billing/settings/page.tsx                        (top-level dispatch rules + EHF resolution)
.claude/page-polish/dashboard-organization-{departments,locations,teams}.run.yml  (NEW)
.claude/page-polish/dashboard-settings-operations.run.yml                          (NEW)
.claude/page-polish/dashboard-my-profile.run.yml                                   (parent stub, NEW)
.claude/page-polish/dashboard-my-profile-complete.run.yml                          (NEW)
.claude/page-polish/dashboard-hms-{deviations,documents,drift,governance}.run.yml  (NEW)
.claude/page-polish/dashboard-contracts-{id,id-revise,awaiting-my-signature,new}.run.yml (NEW)
.claude/page-polish/dashboard-billing-{invoice-id,settings}.run.yml                (NEW)
```

---

## Mantra for next session

**Code-trace before you trust skill text. Aspirational claims aged into the docs faster than the code shipped. Pontus's vision is unified — build the adapter once, every consumer plugs in.**

`/end`
