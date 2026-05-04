---
title: "Harness Hardening — Spec"
status: draft
updated: 2026-04-23
created: 2026-04-23
module: MODULE_BOTSSON
tags: [spec, harness, hardening, botsson, capabilities, invariants, circuit-breaker, eval]
campaign: campaign/botsson-arena
sub-sortie: feat/botsson-arena-harness-hardening
---

# Harness Hardening — Design Spec

> **Scope:** 4 items of the 6-item "harness hardening" bundle that are independent of the unmerged `feat/contract-hub-fix-forward` work. Items 3 (ADR-0189/0190/0192 implementation) and 5 (capability circuit breaker) are **deferred** until fix-forward merges to `development` and `campaign/botsson-arena` absorbs it. Rationale: those two items have ≈50% shipped on fix-forward already — speccing now guarantees reimplementation.
>
> **Council verdict:** APPROVE WITH MAJOR REVISIONS, Trust Gate CONDITIONAL PASS. 2026-04-23 System Council (system-agent-coordinator + botsson-harness-builder reviewed; fact-check caught 3 false briefing claims before dispatch).

## 1. Goal

Tighten the Botsson harness invariants so phantom-contract, forgeable-actor, and silent-drift regressions are compile-time or CI-time failures, not runtime surprises. No new runtime capabilities. No product-facing change. Four items, each small enough to merge independently.

## 2. Items in scope

| # | Title | Purpose | Primary artefact |
|---|------|---------|-----------------|
| 1 | Profile-ID Server Derivation (A2, ADR-0151) | Remove body-forgeable `profile_id` from stage-engine; derive server-side with `NonEmptyString` brand (ADR-0193) | `services/stage-engine/src/routes/agent/chat.ts` + deps |
| 2 | Capability Definition Typed Fields | Promote `allowedChannels` to required; add `toolAuthPattern`, `emitPrefix`, `defaultAuthority?` — kills phantom-contract class at compile-time | `packages/ai/src/capabilities/types.ts` + 17 `index.ts` files |
| 4 | Harness Invariants Doc + CI Mapping | Single authoritative list of harness invariants; each maps to a CI check or is marked prose-only | `docs/architecture/INVARIANTS.md` + CI scripts |
| 6 | Golden Transcript Eval Suite | Wire ADR-0073 AI Eval Harness into CI with 5 hand-authored fixtures scoring intent → gate → tool-selection (Option 2 mid-contract per council) | `packages/ai/src/__evals__/golden-transcripts.eval.ts` |

## 3. Items deferred (not in this spec)

| # | Title | Blocker |
|---|------|---------|
| 3 | ADR-0189 seed-parity CI + ADR-0190 orthogonal controls + ADR-0192 bootstrap-trigger | Majority shipped on `feat/contract-hub-fix-forward` — needs merge into `development` first, then gap-audit |
| 5 | Capability Circuit Breaker (reuse `engine_authority_config` + `tripped_at` column + check in `gate_action` RPC) | Depends on fix-forward merge; also depends on item 2 to land `defaultAuthority` so circuit-breaker state has a fallback |

A follow-up spec (`2026-04-??-harness-hardening-part-2-design.md`) will cover items 3+5 once fix-forward merges.

## 4. Prior art + binding ADRs

- **ADR-0073** — AI Eval Harness (accepted). Wires item 6 as 4th eval suite per Phase 4.5 pattern.
- **ADR-0078** — Channel Restriction (accepted). Why `allowedChannels` exists.
- **ADR-0099** — Unified Authority Gate (accepted). Why `gate_action` RPC is the single gate; why item 2's `authority` field would have been a 4th source.
- **ADR-0112** — Intent Classifier Coverage Invariant (accepted). Referenced by item 4 invariant list.
- **ADR-0116** — Auto-Emit Telemetry from Tool Adapter (accepted). Why `emitEvents: string[]` would duplicate registry; `emitPrefix` is the right abstraction.
- **ADR-0134** — Mobile Telemetry Contract (accepted). Parent of ADR-0193.
- **ADR-0151** — Stage-Engine Profile ID Server Derivation (proposed → **accepted** in this spec, item 1).
- **ADR-0175** — Journey Telemetry Contract (accepted). Pattern for emit registry.
- **ADR-0184/0185** — Session Recorder + Platform Admin (accepted). Item 6 reads from `agent_session_recording` table.
- **ADR-0191** — Agent Capability Tool Auth-Passing Pattern (accepted, on `aa56f8c6`). Why `toolAuthPattern: "bff" | "direct_admin"` is the right field name.
- **ADR-0193** — Non-Empty-String Brand for Telemetry IDs (accepted, on `aa56f8c6`). Provides the `NonEmptyString` brand item 1 uses. Item 1 may amend 0193 to widen scope to `AgentToolContext.profileId`.
- **L-0094** — Phantom emit contracts recurring. Item 2 + item 4 close this class.
- **L-0098** — Global scripts cutover ownership. Item 6 CI wiring follows this pattern.

## 5. Architecture — four items, four seams

### 5.1 Item 1 — Profile-ID Server Derivation

**Seam:** HTTP boundary of stage-engine. Today `profile_id` is a trusted body field; tomorrow it is a derived-from-auth server value.

**Current state** (verified in this review):
- `services/stage-engine/src/routes/agent/chat.ts:34` — `profile_id: z.string().uuid()` in body schema.
- Consumed at lines 93, 131, 137, 160, 191, 197 as `actor_id` and `profileId` — **forgeable by any API-key caller.**
- BFF path (`apps/web/src/app/api/emma/chat/route.ts:108-114`) already derives server-side — pattern exists.
- Ultravox adapter (`services/stage-engine/src/routes/adapters/ultravox.ts:35`) accepts `profile_id: z.string().uuid().optional()` — different auth model; scope TBD in §8.

**Target state:**
- Body schemas for `/agent/chat` and sibling POSTs do **not** include `profile_id`.
- Server derives `profile_id` from bearer token → `auth.userId` → active workspace → profile row.
- `AgentToolContext.profileId` is typed `NonEmptyString` (from ADR-0193 brand).
- Direct API-key callers that legitimately impersonate another profile route through a dedicated `actor_profile_id` field with explicit server-side impersonation-permission check. Phase 1 of this spec: no impersonation — API-key callers use their own profile. Impersonation is future work if needed.

**Data flow (new):**
```
Client → POST /agent/chat { body without profile_id }
                    │
                    ▼
stage-engine/routes/agent/chat.ts
  ├─ bearer token → auth.userId                    (existing)
  ├─ workspace scope check                          (existing)
  ├─ NEW: profileId = deriveProfileId(userId, workspaceId)  ← new helper
  ├─ brand: profileId = nonEmpty(profileId, "profile_id")   ← ADR-0193
  └─ pass to agent-router / emit / context
```

### 5.2 Item 2 — Capability Definition Typed Fields

**Seam:** TypeScript type surface of `CapabilityDefinition`. Today drift is socially enforced; tomorrow it's compile-time enforced.

**Current shape** (`packages/ai/src/capabilities/types.ts:65-73`):
```ts
export type CapabilityDefinition = {
  name: CapabilityName;
  description: string;
  tools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  suggestTools?: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  allowedChannels?: SessionChannel[];
};
```

**Target shape:**
```ts
export type CapabilityDefinition = {
  name: CapabilityName;
  description: string;
  tools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>>;
  suggestTools?: ReadonlyArray<SmartoutTool<AgentToolContext>>;

  // PROMOTED: was optional; all 17 capabilities already set it. Required + non-empty.
  allowedChannels: ReadonlyArray<SessionChannel>;

  // NEW: per-capability binary choice — ADR-0191. Drives review-gate grep.
  toolAuthPattern: "bff" | "direct_admin";

  // NEW: namespace declaration — NOT schema. Registry stays source of truth for event names.
  //      `null` = this capability emits no domain events (only auto-emit from toVercelTools).
  emitPrefix: string | null;

  // NEW: OPTIONAL advisory fallback when engine_authority_config row is missing.
  //      Post-ADR-0192 bootstrap-trigger this becomes dead code — plan to remove at that point.
  defaultAuthority?: AuthorityLevel;
};
```

**Rejected alternatives** (per council synthesis):
- `authority: AuthorityLevel` required → creates 4th authority source conflicting with C4 workspace-scoped runtime authority (ADR-0099). Demoted to `defaultAuthority?`.
- `emitEvents: string[]` required → duplicates `packages/telemetry/src/registry.ts`. Replaced by `emitPrefix`.
- `ALL_CHANNELS` sentinel → explicit enumeration is safer; no capability today wants all channels.

**Blast radius:** 17 `index.ts` files × ≈4 lines each = ~68 edits. Single PR, commit-per-field internally for clean revert.

### 5.3 Item 4 — Harness Invariants Doc + CI Mapping

**Seam:** Documentation + CI. Today invariants are scattered across ADRs; tomorrow they're indexed and each has a signal.

**New file:** `docs/architecture/INVARIANTS.md` — a **compiled index** that references ADRs, not re-states them. Each invariant has:
- A one-line statement.
- A source ADR (the binding decision).
- A CI check name or "prose-only" marker.
- Colour per `BOTSSON-SYSTEM-MAP.md` convention: 🟢 enforced by CI, 🟡 partially enforced, 🔴 prose-only.

**Nine invariants (6 contract-layer + 3 harness-layer):**

| # | Invariant | Source | CI check | Status |
|---|-----------|--------|----------|--------|
| I1 | Every capability registered in `capabilities/registry.ts` declares all required fields | ADR-0099 + this spec item 2 | `tsc --noEmit` on workspace | 🟢 (after item 2) |
| I2 | Every `emit()` event name in repo has matching entry in `packages/telemetry/src/registry.ts` | ADR-0116 + ADR-0175 + L-0094 | `packages/ai/scripts/check-emit-registry-coverage.ts` | 🟢 (new script in this spec) |
| I3 | Every `CapabilityDefinition.emitPrefix` is non-overlapping + registered to exactly one capability | ADR-0116 + this spec item 2 | `tsc` + runtime assertion in `getAllCapabilities()` | 🟢 |
| I4 | Every stage-engine route POST body schema omits `profile_id`/`actor_id` (server-derived) | ADR-0151 | `packages/ai/scripts/check-server-derived-actor.ts` — greps `zValidator.*profile_id` and fails on match | 🟢 (new script) |
| I5 | Every capability tool's `execute` signature accepts exactly `AgentToolContext` | ADR-0099 | `tsc` via `SmartoutTool<AgentToolContext>` + grep for other context types | 🟢 |
| I6 | `gate_action` is the single authorization gate (no direct `engine_authority_config` reads outside RPC) | ADR-0099 | `packages/ai/scripts/check-gate-action-singleton.ts` — greps for `engine_authority_config` reads outside `supabase/migrations/` | 🟢 (new script) |
| I7 | Every migration touches RLS explicitly (owned by `smartout-database-guide`) | ADR-0018 | TBD — pgTAP pattern exists for some tables | 🟡 (partial coverage; tracked as follow-up) |
| I8 | Every Edge Function has dual-auth or explicit `verify_jwt=false` + signature verification | ADR-0039 | TBD — no CI check today | 🔴 (prose-only; tracked as follow-up) |
| I9 | Every mutation emits to `activity_trail` | ADR-0116 | TBD — partial via auto-emit | 🟡 (partial) |

**Only 🟢 invariants are enforced** by this spec. 🟡/🔴 are tracked as honest gaps — no silent claims.

### 5.4 Item 6 — Golden Transcript Eval Suite

**Seam:** CI. Today `ADR-0073` eval infrastructure exists (`packages/ai/vitest.eval.config.ts`, 3 scoring styles) but is not wired to run on PR. Tomorrow it runs on every PR with 5 golden transcripts.

**Scope: Option 2 — mid-contract.** Score covers:
- Intent classification (capability + minConfidence)
- Gate outcome (stubbed `gate_action` from seeded authority fixture)
- Tool selection (tools offered + tool called, if any)

**NOT in scope:** full transcript replay (Option 3). Requires ADR-0184 playback infrastructure; deferred until harness-builder confirms playback code exists.

**Fixture source:** 5 **hand-authored** golden transcripts for initial wiring. Live-sampling from `agent_session_recording` (rich turn-level capture; **not** `agent_session_envelope` which is PII break-glass only) deferred 2 weeks until recording data stabilizes.

**Coverage plan for 5 fixtures (one per structural dimension):**
1. `schedule-when-work` — classifier must pick `schedule` capability; tool `lookupShifts` called with date arg.
2. `contract-send-to-new-employee` — classifier picks `contract`; authority stubbed `suggest`; tool `sendContract` NOT auto-called (needs approval).
3. `memory-remember-preference` — classifier picks `memory`; tool `save_memory` called; channel=chat only (ADR-0078).
4. `guardian-block-pii-voice` — classifier picks any PII-touching capability via voice channel; gate denies with `voice_forbidden_for_pii` reason (ADR-0077).
5. `fallback-no-capability` — classifier picks `null`/unknown; no tool offered; graceful response.

**Fixture schema:**
```ts
export type GoldenTranscript = {
  id: string;
  description: string;
  input: {
    message: string;
    profile_id: NonEmptyString;
    channel: SessionChannel;
    page_context?: string;
  };
  seeded_authority: Partial<Record<CapabilityName, AuthorityLevel>>;
  expected: {
    intent: { capability: CapabilityName | null; minConfidence: number };
    gate: { allow: boolean; reason?: string };
    tools_offered: ReadonlyArray<string>;
    tool_called?: { name: string; args: Record<string, unknown> };
  };
};
```

**Wiring:**
- New file `packages/ai/src/__evals__/golden-transcripts/fixtures/*.json` (5 files).
- New eval spec `packages/ai/src/__evals__/golden-transcripts.eval.ts`.
- `.github/workflows/ai-eval.yml` runs on PR touching `packages/ai/**` or `services/stage-engine/**`.
- Failure = PR blocked.

## 6. Components (per item)

### Item 1 — Profile-ID
- New helper: `services/stage-engine/src/core/derive-profile-id.ts` — takes `(userId, workspaceId, supabase)` → `NonEmptyString` profile-id. Throws typed `ActorDerivationError` on zero rows or branding failure.
- Modified: `services/stage-engine/src/routes/agent/chat.ts` — remove `profile_id` from schema; call helper; pass branded value downstream.
- Modified: `services/stage-engine/src/routes/sessions.ts` — same pattern (line 27 has `profile_id: z.string().uuid().optional()`).
- Modified: `packages/ai/src/capabilities/types.ts` — `AgentToolContext.profileId: NonEmptyString` (was `string`).
- Modified: ADR-0151 status → accepted; add implementation-notes section citing this spec.
- Possibly: ADR-0193 amendment — widen `NonEmptyString` brand scope to `AgentToolContext.profileId`. Decision deferred to implementation PR; tiny amendment vs new ADR is an exec-time call.

### Item 2 — Capability Typed Fields
- Modified: `packages/ai/src/capabilities/types.ts` — `CapabilityDefinition` shape per §5.2 target.
- Modified: all 17 `packages/ai/src/capabilities/*/index.ts` — add `toolAuthPattern`, `emitPrefix`, required `allowedChannels`; add `defaultAuthority?` where known.
- Modified: `packages/ai/src/capabilities/registry.ts` — no code change; tsc forces alignment.
- New: `packages/ai/scripts/check-emit-prefix-uniqueness.ts` — runtime assertion inside `getAllCapabilities()` or CI grep.
- New: ADR-0194 "Capability Definition Typed Fields" (writes the decision).

### Item 4 — INVARIANTS.md
- New: `docs/architecture/INVARIANTS.md` — the 9-invariant table per §5.3.
- New: `packages/ai/scripts/check-emit-registry-coverage.ts` — enforces I2.
- New: `packages/ai/scripts/check-server-derived-actor.ts` — enforces I4.
- New: `packages/ai/scripts/check-gate-action-singleton.ts` — enforces I6.
- Modified: `.github/workflows/ci.yml` — add job running the 3 new scripts on every PR.
- Modified: `docs/architecture/BOTSSON-SYSTEM-MAP.md` — cross-link to INVARIANTS.md.

### Item 6 — Golden Transcript Eval
- New: `packages/ai/src/__evals__/golden-transcripts/` directory.
- New: 5 fixture JSON files per §5.4.
- New: `packages/ai/src/__evals__/golden-transcripts.eval.ts` — scorer + loader.
- New: `.github/workflows/ai-eval.yml` — PR job.
- Modified: ADR-0073 — append "Phase 6: Golden Transcript Fixture Suite" section.

## 7. Data flow / error handling

### Item 1 error paths
- Bearer token missing → 401 (existing).
- Bearer token valid but no workspace scope → 403 (existing).
- `deriveProfileId` returns zero rows → 500 with typed `ActorDerivationError` — this is a server bug, not a user error. Log + emit `stage_engine.actor_derivation_failed` + return generic 500.
- Branding fails (empty string) → same as above.

### Item 2 error paths
- TypeScript compile errors at PR time if capability skips required field. No runtime path.
- `emitPrefix` uniqueness violation at `getAllCapabilities()` call → throw at stage-engine startup. Fail-fast; no silent drift.

### Item 4 error paths
- CI script grep match = PR fails with explicit invariant name. No runtime impact.

### Item 6 error paths
- Eval test failure → PR fails with fixture ID + expected vs actual diff. No runtime impact.

## 8. Testing strategy

TDD strict for items 1 (code change) and 2 (type change, tests verify field presence + uniqueness runtime assertion).

| Item | Test type | What |
|------|-----------|------|
| 1 | Vitest unit | `deriveProfileId` — happy path, zero rows, branding fail |
| 1 | Vitest integration | `/agent/chat` POST with forged `profile_id` in body is ignored; actual profileId comes from bearer |
| 1 | Update existing tests | Every test posting `profile_id` to stage-engine: remove from body, mock bearer instead |
| 2 | Vitest unit | `getAllCapabilities()` throws if two capabilities share `emitPrefix` |
| 2 | Vitest unit | Every registered capability has non-empty `allowedChannels` (type-level but also assert) |
| 4 | CI scripts are self-testing | Each new script has its own negative-case fixture (a fake violation) and positive-case expectation |
| 6 | Eval run | All 5 fixtures PASS on current main |

## 9. Sequencing + merge strategy

**Recommended order (agent-coord said single PR per item is fine, harness-builder said sequencing matters for item 1):**

1. **Item 1 first** — smallest blast, security-critical. Accept ADR-0193 amendment (or same PR). Derive + brand. ~½ day.
2. **Item 2 second** — 17-file PR. Each commit touches one field across all capabilities. ~½ day.
3. **Item 4 third** — writes doc + 3 CI scripts. Depends on item 1 (I4 script greps for server-derive violation) and item 2 (I1 is compile-time-enforced). ~1 day.
4. **Item 6 last** — eval fixtures + CI workflow. Depends on item 2 (fixtures reference `CapabilityName` union). ~½ day.

**Total: ~2.5 days.** All in `feat/botsson-arena-harness-hardening` worktree.

**Merge target:** back to `campaign/botsson-arena` via `/close-feature` (sub-sortie standard flow). Campaign merges to `development` when fix-forward has also landed and items 3+5 are complete.

## 10. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Item 1 breaks Ultravox/Telegram adapters (different auth models) | Medium | Scope this spec to `/agent/chat` + `sessions.ts` only. Ultravox `profile_id: optional` stays for now; follow-up spec |
| Item 2 lands with hidden `authority` pattern slipping in | Low | Council explicitly rejected `authority` field; code review catches |
| Item 4 invariants map to scripts that produce false positives | Medium | Each script ships with a negative-case fixture before enabling |
| Item 6 fixtures lock to LLM behaviour that drifts across model versions | Medium | Score allows `minConfidence` threshold + `tool_called?` (optional); not strict string equality. Update fixtures on LLM version pin change |
| ADR-0193 amendment vs new ADR is unclear | Low | Defer to implementation PR; tiny amendment preferred unless blast grows |
| Fix-forward merge happens mid-sortie and conflicts | Low | This sortie touches different files than fix-forward except INVARIANTS.md — rebase pain is minimal. If conflict, item 4 re-written against new base |

## 11. Out of scope — explicit

- Items 3 (ADR-0189 seed-parity CI, ADR-0190 orthogonal controls, ADR-0192 bootstrap-trigger) — deferred to post-fix-forward-merge spec.
- Item 5 (capability circuit breaker, now reusing `engine_authority_config`) — deferred, depends on item 2 landing `defaultAuthority` + fix-forward merge.
- A5 intent-classifier context — already shipped on this branch (fact-check found implementation at `services/stage-engine/src/core/agent-router.ts:195`).
- Ultravox/Telegram adapter `profile_id` handling — different auth model, follow-up spec.
- Full transcript replay (Option 3 for item 6) — blocked on ADR-0184 playback infrastructure.
- New capabilities, new missions, new runtime surfaces.
- Any UI work.
- Mobile surface — untouched.
- Eval harness architectural changes beyond adding the 4th scoring style.

## 12. Success criteria

1. **Item 1:** A curl against `/agent/chat` with `{ profile_id: "forged-uuid", ... }` in body has `profile_id` ignored; emit shows real bearer-derived profileId. Unit + integration tests pass.
2. **Item 2:** `pnpm turbo typecheck` compiles clean with new required fields across all 17 capabilities. Runtime assertion throws on synthetic emit-prefix collision.
3. **Item 4:** `INVARIANTS.md` lands with 9 invariants. 6 🟢 invariants have CI checks that run green on HEAD; each script has a negative-case fixture proving it can fail.
4. **Item 6:** 5 golden transcript fixtures run green on HEAD. CI workflow `.github/workflows/ai-eval.yml` gates PRs touching `packages/ai/**` or `services/stage-engine/**`.
5. **Overall:** `docs/plans/CAMPAIGN-botsson-arena.md` roadmap updated — A2 marked [x], Phase A progress reflected. No regression in existing tests.

## 13. ADRs to write (in this sortie)

- **ADR-0194** — Capability Definition Typed Fields (item 2 canonical spec).
- **ADR-0151** status change: proposed → accepted (item 1).
- **ADR-0193 amendment OR ADR-0195** — `NonEmptyString` scope widened to `AgentToolContext.profileId` (decision at implementation time).
- **ADR-0196** — Harness Invariants Doc + CI Mapping Convention (item 4).

Register each in `docs/decisions/0000-decision-log.md` as landed.

## 14. Learnings to capture (candidates)

- **L-0119 candidate** — "Bundle-planning against a stale branch-base causes reimplementation. Council prerequisite: verify target branch is in sync with all in-flight parallel branches before accepting a bundle." Evidence: this very spec — fact-check found ≈50% of item 3 already on fix-forward.
- **L-0120 candidate** — "Briefing claims 'ADR-X exists on branch Y' must be verified via `git show`, not `ls docs/decisions/`. Same-session ADRs committed on another worktree appear in `git log --all` but not the local tree." Evidence: council Phase 2.5 fact-check caught ADR-0189/0190 as non-existent on botsson-arena despite being on fix-forward.

## 15. Open questions (deferred to implementation)

1. `emitPrefix` for `profile` / `ui` capabilities (no domain emits today) — use `null` or capability-name string as reserved-but-unused?
2. ADR-0193 amendment vs new ADR for widening brand scope — decide at PR time.
3. Item 1 impersonation via API-key caller (if any legitimate caller today exists) — enumerate in implementation PR; if none, kill the feature silently.
4. `.github/workflows/ai-eval.yml` runtime budget — 5 fixtures × LLM call = how long? If >2min, gate on a pnpm filter or only run on `packages/ai/**` changes.

---

**Next step:** after user review of this spec, invoke `superpowers:writing-plans` to generate the implementation plan (4 items × TDD tasks × commit-per-step granularity).
