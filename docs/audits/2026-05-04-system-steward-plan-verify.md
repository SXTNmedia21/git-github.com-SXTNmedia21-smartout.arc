---
title: "Phase 2 — System Steward Plan-Verify Report"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [audit, system-steward, plan-verify, adr-compliance, mobile, shift, bff]
---

# System Steward — Plan-Verify Report: shift-system-polish

**Sortie:** `feat/mobile-shift-system-polish`
**Worktree:** `/home/sxtnl/dev/smartout.ai-mobile-wt-2`
**Branch base:** `campaign/mobile`
**Date:** 2026-05-04
**Plan under review:** `docs/plans/PLAN-shift-system-polish.md`
**Phase 0 input:** `docs/audits/2026-05-04-mobile-shift-surface-map.md`
**Phase 1 input:** `docs/audits/2026-05-04-lovsen-shift-system-rapport.md`
**Companion ADR:** `docs/decisions/0277-mobile-shift-authoring-via-bff.md` (this Phase 2)

---

## Executive Verdict

**Verdict: APPROVE WITH CONDITIONS — proceed to Phase 3 with 2 BLOCKING items resolved as part of Phase 3a, 4 HIGH items addressed during Phase 3, and 6 MEDIUM/LOW items noted in HANDOFF.**

The plan is sound in shape: a BFF wrapper around `addShiftAction` is the correct ADR-0132 + ADR-0133 reading for the case "manager creates a shift from mobile in an emergency." The Phase 0 surface map and Phase 1 lovsen rapport are high-quality and code-traced — every Lovsen finding (S1, S2, S3, S5, S6, M1) was verified at the cited line numbers. ADR-0244 is correctly excluded (contract-domain, not shift-domain).

**Two BLOCKING items must be resolved before Phase 3a dispatches:**

1. **B1 — `addShiftAction` does not use `gatedMutation()` (ADR-0204 violation already in production).** The plan does not address this. Wrapping a non-compliant Server Action in a BFF inherits the violation. Decision required: either (a) accept the existing `gateAction()`-only pattern as Server Action convention (11 sibling actions also use it — pattern is established) and document explicitly in the new ADR, or (b) migrate `addShiftAction` to `gatedMutation()` as part of this sortie. Recommendation: **(a) document and defer**, because ADR-0204 SS-5 (close 33 ESLint warnings via call-site migration) is the canonical sortie for this work, not a mobile sortie.

2. **B2 — Plan describes BFF as wrapping `addShiftAction` but `addShiftAction` does not currently accept `channel?` parameter.** Lovsen S5 fix is the precondition for the BFF, not a parallel fix. If `addShiftAction` is unchanged, the BFF will pass `channel: "system"` into a function that hardcodes `"chat"` on line 204 — silent override, fix appears to ship but doesn't. Phase 3a MUST modify `addShiftAction` first, then write the BFF.

The plan otherwise correctly identifies the right files, the right ADRs, and the right scope reductions (S4 deferred, M2 deferred). One ADR-0133 question is surfaced below as a HIGH item: **should mobile shift-create exist at all?** I recommend keeping it for the documented use-case (manager emergency-create), but this is the right council to ask — the plan should not treat the question as settled.

---

## BLOCKING items (resolve before Phase 3 dispatch)

### B1 — ADR-0204 compliance scope

**Severity:** BLOCKING (decision required, not necessarily code change)
**ADRs:** ADR-0204, ADR-0099, ADR-0091
**Evidence:** `apps/web/src/app/dashboard/_actions/add-shift-action.ts:201-211` calls `gateAction({...})` from `_shared.ts`, then `admin.from("schedule_shift").insert(...)` directly at lines 218-238. No `cascade_gate_write` call. No `gatedMutation()` import or composition.

ADR-0204 §Rules & Consequences mandates:

> Every new capability tool `execute()` that writes to the DB MUST compose via `gatedMutation`. Inline `supabase.rpc('gate_action', ...)` or `supabase.rpc('cascade_gate_write', ...)` are merge blockers.

But the same ADR §Rollout reserves SS-5 for "Close the 33 ESLint warnings via call-site migration to `gatedMutation`" — i.e. the existing Server Actions that use `gateAction()` from `_shared.ts` are an acknowledged migration backlog, not a fresh violation.

Verified: 11 sibling Server Actions in `apps/web/src/app/dashboard/_actions/` all use `gateAction()` from `_shared.ts` — `add-shift-action.ts`, `add-task-action.ts`, `manual-time-entry-action.ts`, `archive-season-action.ts`, `activate-season-action.ts`, `duplicate-season-action.ts`, `signoff-session-action.ts` (×2 sites), `open-session-action.ts`, `transition-session-action.ts`, `send-broadcast-action.ts`. This is the established Server Action convention as of 2026-05-04.

**Decision required for the new ADR:**

The new ADR (`0277-mobile-shift-authoring-via-bff.md`) MUST state explicitly that the BFF inherits the `gateAction()`-only pattern of `addShiftAction`, that this is a known ADR-0204 SS-5 backlog item shared with 10 other Server Actions, and that migrating to `gatedMutation()` is out of scope for this sortie. Without this explicit acknowledgement, a future steward will read the new ADR as silently endorsing an ADR-0204 violation — that's the L-0098 staleness pattern (prior-council-claim falsified by code-trace).

**How to resolve:** the new ADR §Consequences §3 MUST contain the words "Pathway B (`cascade_gate_write`) is NOT invoked by `addShiftAction`. This matches 10 sibling Server Actions and is tracked under ADR-0204 SS-5. The BFF inherits this gap; closure is out of scope for this sortie." This is what I have drafted in `0277-mobile-shift-authoring-via-bff.md`.

### B2 — `addShiftAction` channel parameter is the precondition for BFF, not a parallel fix

**Severity:** BLOCKING
**ADRs:** ADR-0078 (channel guards)
**Evidence:** `apps/web/src/app/dashboard/_actions/add-shift-action.ts:204` hardcodes `channel: "chat"`. `_shared.ts:79-97` `gateAction` already accepts `channel: "chat" | "voice" | "system" | string` as a typed parameter — no signature change needed in `_shared.ts`, only in `addShiftAction` input schema and call site.

The plan has both items in §Phases — Lovsen S5 is in §Phase 3a as "Aksepter `channel?` parameter, fjern hardkodet `'chat'`". Good. But the §Phase 3a output section reads "delegerer `addShiftAction({ profileId, startAtISO, endAtISO, role, reason, departmentId? })`" — the channel param is missing from the delegation example.

**How to resolve:** Phase 3a output checklist must list both:

1. Modify `add-shift-action.ts` to accept `channel?: "chat" | "system"` in `InputSchema` (default "chat" for back-compat with web caller); pass through to `gateAction()` line 204.
2. BFF route passes `channel: "system"` (server-initiated) when delegating.
3. Web `AddShiftDialog.tsx` call site does NOT pass `channel` (defaults to "chat" — preserves current behaviour).

If Phase 3a ships the BFF without step 1, it appears to fix S5 but the channel hardcode remains active.

---

## ADR Compliance Audit

### ADR-0132 — Mobile Thin Client via Web BFF

**File:** `docs/decisions/0132-mobile-thin-client-via-web-bff.md`
**Status:** accepted (2026-04-18)
**Verdict:** PASS for the BFF design; flag on R5 (legacy `chat_message`-direct deprecated by week 6).

**Verified rules:**

- **R1** — Mobile POSTs to `${EXPO_PUBLIC_WEB_API_URL}/api/emma/chat` with Bearer JWT. Plan extends this pattern to `/api/mobile/shifts`. Same BFF surface, different route. Compliant.
- **R3** — Channel pinning is server-side. Plan §Phase 3a explicitly states "JWT-derived workspace per ADR-0151" + "`channel: 'system'`". Compliant if B2 resolves.
- **R4** — Direct mobile data CALLS remain allowed (RLS-gated reads). Plan does not propose changing read paths. Compliant.

**Subtle compliance question:** ADR-0132 §Context describes the BFF detour for "AI/capability traffic." Shift-create is not an AI/capability call — it's a domain mutation. Is the same pattern appropriate?

**Resolution:** ADR-0132 §Decision Drivers list "Stage-engine is HTTP-callable; the architecture allows mobile to participate, only the wiring is missing" — this is a thin-client architectural posture, not strictly limited to AI traffic. The same posture applies to any mutation that needs server-side gates. ADR-0261 (BFF as Mutation Host for Non-Agent Capabilities, accepted 2026-04-29) explicitly extends this pattern to `tips.*` and "future PII-adjacent payroll/billing capabilities." The new ADR for shift-authoring is a sibling to ADR-0261 — generalises the same pattern to D6+C4 mobile-execute verbs that need authoritative server-side derivation (tz, day_category, source attribution, audit trail).

**Mobile thin-client check, line by line:**

| BFF concern | Mobile responsibility | Server (BFF + addShiftAction) responsibility | Status |
|---|---|---|---|
| `workspace_id` source | Sent in body? **NO** — derived from JWT | JWT → admin.auth.getUser → profile.workspace_id | OK if Phase 3a follows pattern |
| `actor_profile_id` source | Sent in body? **NO** — derived from JWT | JWT → resolveCurrentProfile (matches ADR-0151) | OK |
| `day_category` derivation | Client-side (current): WRONG | Server-side from workspace.timezone | Plan removes client derivation |
| `source` attribution | Not sent | Hardcoded `'manual_admin'` | Inherited from addShiftAction |
| Authority gate | Not invoked | `gateAction(roster.add_shift_manual)` server-side | Inherited |
| Audit trail | None today (S1) | `emit('shift added_manual')` server-side | Inherited |
| Telemetry actor_id | Resolved via `getProfileContext()` BEFORE call (current optimistic emit on enqueue) | Resolved via `resolveCurrentProfile()` server-side after success | Plan REMOVES mobile-side emit |

**Risk:** Phase 0 surface map §1.1 notes mobile currently emits `actor_id: profileId` from `getProfileContext()` BEFORE enqueue. Per ADR-0134 R1 this is correct. After BFF cutover, the mobile-side emit goes away (Phase 3b: "useCreateShift ringer BFF, ikke `enqueue()`"). Phase 0 §6.4 §10.2 talks about "Telemetri duplication — Mobile emits on local punch, then again on Postgres trigger → two events" as a punch-flow issue. For shift-create, the equivalent risk is: does the BFF emit the same `shift added_manual` event the mobile-side emit currently fires (`shift created`)?

Verified: `add-shift-action.ts:248-272` emits `event: "shift added_manual"`. Mobile emit fires `event: "shift created"` at `use-create-shift.ts:71`. **They are DIFFERENT event names.** After cutover, the `"shift created"` event (which today is the only one mobile fires) disappears entirely from `activity_trail`. Downstream consumers of `"shift created"` (if any) will silently stop receiving data.

**Action item — HIGH severity (HX in §HIGH below):** Phase 3a/3b must verify the telemetry registry to determine if `"shift created"` has consumers. If yes, either keep emitting it from the BFF or document the deprecation in HANDOFF. If no, document the removal in HANDOFF.

### ADR-0133 — Web Composes, Mobile Executes

**File:** `docs/decisions/0133-web-composes-mobile-executes.md`
**Status:** accepted (2026-04-18)
**Verdict:** PASS WITH CONDITIONS — verb-table alignment requires explicit decision; surfaced as HIGH H1.

**Verb-table reading for shift-create:**

ADR-0133 §Decision Outcome verb-table:

| Verb | Web | Mobile |
|---|---|---|
| Author | YES | NO |
| Compose | YES | NO |
| Plan | YES | NO |
| Approve | YES | YES (primary) |
| Execute | limited | YES (primary) |

ADR-0133 §R2 (Web-only verbs):
> Schedule drag-drop editor (web-only — D6 authoring + grid editing)

`addShiftAction` IS the back-end of the web schedule drag-drop editor (specifically: AddShiftDialog and RosterTab empty-state CTA). Phase 0 §3.1 notes "Drag-drop schedule editor — [not found in snapshot] Out of scope per ADR-0133 (web-only compose)." Mobile create-shift is not drag-drop, but it's still **D1 planning authoring**, not D6 execution.

**The ADR-0133 reading is ambiguous.** Three legitimate interpretations:

1. **Pure ADR-0133 R2 reading:** "Author/Compose/Plan = web only." Shift-create is plan-authoring (creating a future commitment of an employee's time). Mobile create-shift violates ADR-0133. **Recommendation: delete `apps/mobile/app/(app)/(shifts)/create.tsx` entirely.**

2. **Plan §Goal reading:** "Mobile is thin client; shift-create stays but routes through BFF; server enforces all authoring concerns (tz, audit, gate)." This treats the BFF as a mobile-as-thin-client surface for an authoring verb. The verb-table says NO; the plan asks "but what if the verb doesn't actually run on mobile, only the UI does?"

3. **Lovsen Phase 1 §6 reading:** "Mobile-manager bør og kan ha `roster.add_shift_manual`-capability ... legitimate use-case at en manager oppretter en vakt fra mobil i en nødsituasjon." Acknowledges friction with ADR-0133 but argues use-case warrants the exception.

**Recommendation:** **Option 2** with explicit ADR-language. The new ADR `0277-mobile-shift-authoring-via-bff.md` MUST state which interpretation it adopts. I have drafted it as: "Mobile UI is retained for emergency manager-create. The compose verb runs server-side via `addShiftAction`; mobile is a thin form that shuttles input to the canonical web compose path. This refines ADR-0133 R2 to distinguish between 'authoring runs on mobile' (forbidden) and 'authoring is initiated from mobile but executes on web BFF' (this ADR's permitted pattern)."

**Why not Option 1 (delete `create.tsx`):**

- Real product requirement (Phase 1 lovsen confirmed)
- Manager emergency-create is plausible (sick-call replacement at 14:00 Saturday)
- Mobile UI shuttling form data through BFF is structurally identical to mobile chat → BFF → stage-engine for AI traffic — the same architectural posture

**Why not Option 1.5 (web-only with PWA shortcut):**

- Mobile users already have install instructions; web works on mobile devices, but the dashboard navigation is not optimized for one-handed phone use during emergencies
- The plan explicitly cites this in §Risks: "managers som forventer offline-create vil få 'online required'-feilmelding"

**Surfaced as HIGH H1.** This is the right council to make this call. Phase 2's job is to flag it; Pontus or Council R1 makes the final decision.

### ADR-0134 — Mobile Telemetry Contract Enforcement

**File:** `docs/decisions/0134-mobile-telemetry-contract-enforcement.md`
**Status:** accepted (2026-04-18; amended §3.7 by ADR-0187)
**Verdict:** PASS — telemetry contract preserved end-to-end; runtime assertion already in place.

**Verified rules:**

- **R1** — Every mobile mutation must resolve `workspace_id` (non-null, non-empty) and `actor_id` (non-empty) BEFORE calling `emit()`. Mobile create cutover REMOVES the mobile emit entirely; the BFF's server-side `emit()` resolves both via `resolveCurrentProfile()` → returns `NonEmptyString`-branded values. Verified at `add-shift-action.ts:248-272` already uses `nonEmpty()` brand. Compliant.

- **R2** — Runtime assertion in `emit()` for empty `workspace_id`/`actor_id`. Already implemented per ADR-0193 brand. Compliant.

- **R3** — Backfill of `use-punch.ts:141-142`, `use-swap.ts` (4 sites), `use-create-shift.ts:69`. Verified `use-create-shift.ts:73-74` uses `nonEmpty(payload.workspace_id, ...)` and `nonEmpty(profileId, ...)`. Compliant.

- **R4** — Lint rule for empty-string emit. Status uncertain (see B1 — CI script enforcement is also pending). Not a blocker for this sortie since the BFF cutover removes the mobile-side emit.

**End-to-end emit chain verification:**

| Step | Owner | workspace_id source | actor_id source | Compliant? |
|---|---|---|---|---|
| 1. Mobile form submit | `create.tsx` | from `useMyProfile()` cache | from JWT (Bearer header) | YES |
| 2. BFF route handler | `/api/mobile/shifts/route.ts` | resolved from JWT via `admin.auth.getUser(bearerToken)` then profile lookup | same | YES (if Phase 3a follows emma/chat pattern) |
| 3. addShiftAction | `add-shift-action.ts` | `resolveCurrentProfile()` from cookie OR Bearer? | same | **POTENTIAL GAP** — see below |
| 4. emit('shift added_manual') | `add-shift-action.ts:248-272` | `nonEmpty(profile.workspaceId, ...)` | `nonEmpty(profile.profileId, ...)` | YES (ADR-0193) |

**Gap at step 3:** `_shared.ts:resolveCurrentProfile` calls `await createClient()` from `@smartout/supabase/server` which uses **cookie-based SSR**. Mobile sends Bearer, not cookie. If the BFF route uses Bearer auth (per ADR-0132 R1) but then delegates to `addShiftAction()` which expects cookie auth, `resolveCurrentProfile()` returns `null` → "Ikke autentisert."

**Resolution path:** the BFF route MUST resolve auth via the Bearer pattern (mirror `emma/chat/route.ts:66-89`'s `resolveAuth()` helper) AND THEN explicitly pass the resolved `{ profileId, workspaceId }` into a NEW signature for `addShiftAction()` — OR the BFF must NOT use `addShiftAction()` directly and instead inline the same logic with explicit identity parameters.

**Recommended pattern:** mirror `apps/web/src/app/api/availability/_shared.ts` which abstracts the auth resolution and passes resolved profile to a shared core. Phase 3a MUST add the same abstraction layer here, OR refactor `addShiftAction` to accept an optional `actor: { profileId, workspaceId }` parameter that, when present, skips `resolveCurrentProfile()`.

**Surfaced as BLOCKING B3** — see §BLOCKING below (added).

### ADR-0151 — Server-Derived Profile/Workspace IDs

**File:** `docs/decisions/0151-stage-engine-profile-id-server-derivation.md`
**Status:** accepted (2026-04-19, bumped 2026-04-23)
**Verdict:** PASS provided BFF derives both `workspace_id` and `actor_profile_id` from JWT, never from body.

**Verified pattern in `emma/chat/route.ts:66-89`:**

```ts
async function resolveAuth(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    return { user: data.user, accessToken: bearerToken, authMethod: "bearer" };
  }
  // cookie path...
}
```

This is the canonical mobile-BFF auth resolver. The new BFF route MUST use the same pattern. The plan's Phase 3a brief states "JWT-derived workspace per ADR-0151" — correct intent. Phase 3a output checklist MUST extract `workspace_id` from the authenticated user's profile lookup, not from request body.

**Body schema must NOT contain `workspaceId`:**

Plan §Phase 3a request schema example reads:

```
{
  profileId:    uuid (target employee — REQUIRED)
  startAtISO:   datetime-utc
  endAtISO:     datetime-utc
  role:         string min(1)
  reason:       string min(8)
  departmentId: uuid optional
  overrideReason: string optional
}
```

Notably absent: `workspaceId`. Compliant. But note: the plan §Phases §Phase 3a brief states "Zod request schema (ingen `workspace_id` fra body)" — this MUST be tested explicitly. Phase 3a must include a test asserting the request schema rejects `workspaceId` in body, mirroring `services/stage-engine/src/__tests__/agent-chat-forged-profile.test.ts`.

**`profileId` is permitted in body — but it's the TARGET employee, not the actor.**

This is a subtle ADR-0151 reading. ADR-0151 forbids the actor's `profile_id` in body. The body-supplied `profileId` is a different entity (the employee being assigned). Server-side cross-workspace check (`add-shift-action.ts:149-156`) verifies `employee.workspace_id === profile.workspaceId` — so a forged `profileId` for an out-of-workspace employee fails fast. Compliant. But note: an actor in workspace A could submit a request with `profileId` of any employee in workspace A; this is by design, not a forgery vector.

**One ADR-0151 subtlety not addressed by plan:**

L-0177 (silent workspace-mismatch pattern) mandates fail-fast when `?.workspace_id` chains produce undefined and silently fall back. `add-shift-action.ts:149-156` correctly returns `{ ok: false, error: "Ansatt ikke funnet eller annet workspace." }` on `!employee || employee.workspace_id !== profile.workspaceId`. The BFF inherits this guard via delegation. Compliant.

### ADR-0078 — Engine Process Channel Restriction

**File:** `docs/decisions/0078-engine-process-channel-restriction.md`
**Status:** accepted (2026-04-08)
**Verdict:** PASS WITH CONDITIONS — Lovsen S5 fix is mandatory; plan correctly identifies it as Phase 3a work.

**Three-layer enforcement check:**

1. **Layer 1 (process-level):** `roster.add_shift_manual` is not bound to an `engine_process` row — it's a direct Server Action capability. Layer 1 does not apply (no process to dispatch). Skipped.

2. **Layer 2 (capability-level `allowedChannels`):** `engine_authority_config` row for `roster.add_shift_manual` does not include a `channel` column (verified at migration `20260517100000_seed_roster_add_shift_authority.sql`). Layer 2 enforcement is via the `gateAction({ channel })` parameter passed at runtime — currently hardcoded `"chat"`. ADR-0078 Layer 2 implementation is partial for non-stage-engine capabilities.

3. **Layer 3 (tool-level):** `addShiftAction` does not check `ctx.channel` — it's a Server Action, not a capability tool. Layer 3 does not apply. The BFF acts as Layer 3 equivalent by passing the right channel.

**Lovsen S5 fix (HIGH per Lovsen):**

`addShiftAction:204` hardcodes `channel: "chat"`. When BFF calls on behalf of mobile-bearer, the canonical channel is `"system"` (server-to-server initiated, not user-chat-initiated). Plan §Phase 3a §Server action (S5) addresses this: "Aksepter `channel?` parameter, fjern hardkodet `'chat'`."

**Compliance check on the proposed fix:**

`_shared.ts:79-97 gateAction({ channel: "chat" | "voice" | "system" | string, ... })` already accepts the broader union. No `_shared.ts` change required. Only `addShiftAction` needs to:

1. Add `channel?: "chat" | "system"` to `InputSchema` (default "chat" for back-compat)
2. Pass through to `gateAction` line 204

**Side-effect risk:** the existing web caller (`AddShiftDialog.tsx`, `RosterTab.tsx` empty-state) currently passes no channel param. Default value MUST preserve `"chat"` to avoid changing web behaviour. Verified the plan supports default "chat" via "aksepter `channel?` param" wording.

**Action item — verify call sites unchanged on web:**

Phase 3a/3c must grep all web call sites of `addShiftAction({...})` and confirm none of them pass `channel` (so the default "chat" applies). I have not done this grep — Phase 3a builders should run it as part of acceptance criteria.

### ADR-0204 — gatedMutation Composition Orchestrator

**File:** `docs/decisions/0204-gated-mutation-composition-orchestrator.md`
**Status:** accepted (2026-04-24)
**Verdict:** ACCEPTED VIOLATION — see B1 above.

**Code-trace verification:**

- `addShiftAction:201-211` calls `gateAction()` (Pathway A only).
- `addShiftAction:218-238` calls `admin.from("schedule_shift").insert(...)` directly (no Pathway B).
- ADR-0204 §3 mandates orchestrator usage; per-cap `gate.ts` files must migrate under SS-4; the 33 ESLint warnings close under SS-5.

**Sibling action audit:**

11 sibling Server Actions in `apps/web/src/app/dashboard/_actions/` use the same `gateAction()`-only pattern:

```
add-shift-action.ts:201
add-task-action.ts:100
manual-time-entry-action.ts:65
archive-season-action.ts:45
activate-season-action.ts:81
duplicate-season-action.ts:49
signoff-session-action.ts:89, 131
open-session-action.ts:58
transition-session-action.ts:75
send-broadcast-action.ts:57
```

This is the established Server Action convention. Migrating all 11 to `gatedMutation()` is the SS-5 sortie scope.

**Decision for new ADR:** the new ADR explicitly notes this gap, references ADR-0204 SS-5, and treats the BFF as inheriting the existing pattern of its delegate. NOT a new violation introduced by this sortie.

### ADR-0265 — Enforced Deployment Pipeline

**File:** `docs/decisions/0265-enforced-deployment-pipeline.md`
**Status:** accepted (2026-05-03)
**Verdict:** PASS — sortie targets `campaign/mobile`; close-feature merges to campaign branch.

**Verified branch state:**

```
$ git branch --show-current
feat/mobile-shift-system-polish
```

`campaign/mobile` is the parent. Per ADR-0265 + ADR-0213, campaign merges use merge-commit (not squash) at PR time. Sub-sortie close to campaign uses `/close-feature` which does merge-commit per ADR-0213 + ADR-0075.

**Close-feature gates that apply to this sortie:**

1. Decision log complete — new ADR registered.
2. User Journeys (4 declared in plan §Journeys).
3. Typecheck passes (web + mobile).
4. Handoff written.

**ADR-0265 §Required status checks** apply at the eventual `campaign/mobile → development → preview → main` PR steps, not at sub-sortie close. No additional CI burden on this sortie.

### ADR-0095 — Shift Lifecycle Five-Layer Architecture

**File:** `docs/decisions/0095-shift-lifecycle-five-layer-architecture.md`
**Status:** accepted (2026-04-15)
**Verdict:** PASS — BFF wrap respects layer boundaries.

**Five-layer reading for this sortie:**

| Layer | Tables | Mobile in scope? | BFF role |
|---|---|---|---|
| Reality (D6 source) | `time_entry`, punch events | YES — punch in/out, breaks | unchanged (offline-queue path) |
| Interpretation (D6 derived) | `shift_hour_interpretation` | NO | unchanged (server-side trigger) |
| Derivation (C3) | `shift_cost_snapshot` | NO | unchanged (cost engine) |
| Decision (C1) | `shift_approval`, `daily_reconciliation` | NO | unchanged |
| Execution (D6 commitment) | `schedule_shift`, `department_session` | YES — shift create | new BFF wraps `addShiftAction` |

ADR-0095 §Rules: "A layer never mutates a lower layer." Mobile create writes to Layer 5 (Execution: `schedule_shift`). Mobile punch writes to Layer 1 (Reality: `time_entry`). Mobile NEVER writes to Layers 2-4.

Phase 0 surface map §8.3 §1, §5: "Mobile writes to layer 1 (time_entry) and layer 5 (schedule_shift) but never to layers 2–4. Interpretation happens server-side via trigger." Confirmed compliant.

**Subtle layer-2 question — Lovsen S2:**

`punch_out` emits `break_minutes: 0` hardcoded. The TRUE break_minutes lives in `time_entry.breaks` JSONB (Layer 1). The hardcoded 0 in telemetry is Layer 1 → Layer 1 emit; not a layer crossing. Compliant but misleading per Lovsen §10.4. Not a layer-architecture issue, an emit-data-quality issue.

---

## Cross-Cutting Concern Audit

### Telemetry contract end-to-end

| Concern | Status |
|---|---|
| `emit()` after every mutation | YES — server-side (BFF removes mobile-side emit; addShiftAction emits) |
| `nonEmpty()` brand for actor/workspace ids | YES — addShiftAction:250-251 |
| Event registered in `packages/telemetry/src/registry.ts` | NEEDS VERIFICATION — Phase 3a checklist must confirm `"shift added_manual"` is in registry; if `"shift created"` (current mobile event) is dropped, registry entry must be marked deprecated |
| 4 destinations honoured | YES per addShiftAction comment §40-43 |

**Action item — Phase 3a:** verify `"shift added_manual"` registry entry exists in `packages/telemetry/src/registry.ts`. If `"shift created"` is dropped, document in HANDOFF (downstream consumer audit required).

### RLS + workspace isolation

| Concern | Status |
|---|---|
| Cross-workspace guard at BFF | YES if BFF mirrors `addShiftAction:149-156` |
| `workspace_id` filter on all reads | YES (existing patterns) |
| `actor_id` from JWT, not body | YES (per ADR-0151) |
| `target profileId` in body cross-checked | YES — `addShiftAction:149-156` |

### Security three laws

1. **No plaintext secrets** — N/A (no new secrets)
2. **No bypass RLS** — N/A (admin client only after JWT verification + cross-workspace guard)
3. **No commit secrets** — N/A

### i18n

`use-create-shift.ts` and `create.tsx` — mobile UI strings are Norwegian-only currently. Plan does not propose i18n. Acceptable for current sortie scope (matches existing web). If mobile i18n becomes a campaign-level concern, file separately.

### Performance

- BFF adds one HTTP hop. Per ADR-0132 §Consequences: "adds one network hop; mobile depends on web-app availability for AI features." Acknowledged trade-off.
- No new N+1 patterns introduced.
- BFF should reuse `admin.auth.getUser(bearerToken)` once and pass downstream — not call multiple times per request.

---

## Cascade Integrity Verification

Per System Steward agent specification, cascade-touching plans require full integrity verification. Shift-create touches Cascade D6 (Execution) + C4 (governance via `gate_action`).

### Core Placement Check

**Verdict:** INSIDE CASCADE.

The plan extends existing cascade entities (`schedule_shift`, `engine_authority_config`, `gate_action`, `activity_trail`) rather than creating parallel mechanisms. The BFF is a transport layer that wraps a canonical Server Action; no new domain logic introduced.

### Cascade Invariants Audit

| Invariant | Status | Evidence |
|---|---|---|
| 1. Single canonical pipeline | YES | `addShiftAction` is the single shift-create path; BFF delegates to it |
| 2. Every datum has one role | YES | `schedule_shift` is Execution layer (D6); `time_entry` Reality (D6); `shift_approval` Decision (C1) |
| 3. Derivation reproducible | YES | `day_category`, `start_time`, `end_time`, `work_hours` all derived from input ISO + workspace.timezone |
| 4. Event Engine consumes outcomes | YES | `engine_authority_config` is the authority gate; no new engine_event/engine_state writes |
| 5. Permissions don't alter truth | YES | Authority denial returns error; does not modify schedule_shift contents |
| 6. Rates/rules declarative | PARTIAL | Day-category bucket is hardcoded in `deriveDayCategory()` — Lovsen S4 raises this for tariff buckets, deferred to parallel sortie |
| 7. No sidecars | YES | BFF is a transport, not a sidecar |
| 8. Provenance on outputs | YES | `source='manual_admin'`, `notes=reason`, `activity_trail.data.override_reason`, `actor_id`, `workspace_id`, timestamp |

### Five Layers of System Meaning

| Layer | What this plan changes |
|---|---|
| Reality | None |
| Interpretation | None |
| Derivation | None (existing `addShiftAction` derivation logic unchanged) |
| Decision | None |
| Execution | Adds new transport (BFF) for an existing execution-layer write |

Pure transport addition. No layer mutation. Compliant.

### State Ownership Table

| State/Entity | Owned by | Mutated by | Mutation path | Constraints |
|---|---|---|---|---|
| `schedule_shift` row | `addShiftAction` (web) + new BFF (mobile) | admin client INSERT | through `gateAction(roster.add_shift_manual)` | min_role=manager (ADR-0099 seed) |
| `engine_authority_config` row | seed migration | admin UI (out of scope) | direct DB | append-only audit elsewhere |
| `activity_trail` row | `emit()` engine | telemetry providers | post-write only | non-empty workspace/actor (ADR-0193) |

No ambiguous mutation ownership. Compliant.

### Forbidden Pattern Check

- No duplicate source-of-truth tables: PASS (`schedule_shift` only)
- No UI-only business logic affecting persisted outcomes: PASS (server-side derivation)
- No service-local scheduling logic outside cascade: PASS
- No permission flags mixed into domain truth: PASS (authority gate is separate; ADR-0203 invariant 5)
- No hardcoded rates: PARTIAL — `day_category` thresholds (16, 14, 11, 22, 5) are hardcoded; ADR-0095 + Lovsen S4 separate concern
- No parallel workflow/status system: PASS
- No materialized state without regeneration strategy: PASS
- No provenance bypass: PASS

---

## HIGH severity items

### H1 — ADR-0133 verb-table boundary decision

**Severity:** HIGH (decision required, not necessarily code change)
**ADRs:** ADR-0133, ADR-0132
**Description:** Should mobile shift-create exist at all, given ADR-0133 R2 explicitly lists schedule authoring as web-only?

Three options enumerated in §ADR-0133 audit above. **My recommendation: Option 2 (keep mobile UI as thin form, document in new ADR as a refinement of ADR-0133 R2).** Rationale:

- Real product use-case (manager emergency-create at 14:00 Saturday)
- Architecturally identical to mobile chat → BFF → stage-engine for AI traffic (ADR-0132 pattern)
- Refining ADR-0133 R2 to "authoring runs server-side, mobile is thin form" is a coherent extension, not a violation

**How to resolve:** the new ADR `0270` MUST state which interpretation is adopted with explicit cross-reference language: "This ADR refines ADR-0133 R2 by distinguishing between 'authoring runs on mobile' (forbidden) and 'authoring is initiated from mobile but executes on web BFF' (this ADR's permitted pattern). Mobile UI is a form; the compose verb runs on the web BFF."

If the council disagrees and Option 1 (delete `create.tsx`) is chosen, Phase 3 scope shrinks dramatically — no BFF, no schema changes — only `actionMap.create_shift` removal + `create.tsx` deletion + `useCreateShift` removal.

### H2 — `"shift created"` vs `"shift added_manual"` event-name divergence

**Severity:** HIGH (telemetry continuity)
**ADRs:** ADR-0134, ADR-0175 (telemetry contract)
**Description:** Plan §Phase 3b removes `enqueue("create_shift")` which today fires `emit("shift created")` from `use-create-shift.ts:71-86`. Server-side `addShiftAction` emits `"shift added_manual"` instead (line 249). After cutover, `"shift created"` events disappear from `activity_trail`.

**Action items:**

1. Phase 3a/3b must grep `packages/telemetry/src/registry.ts` and any `activity_trail` consumers (analytics, dashboards) for `"shift created"`. If present, decide: (a) emit both event names from BFF for compatibility, (b) deprecate `"shift created"` in registry with a `deprecated_at` field.
2. HANDOFF must note the event-name change and confirm no consumers are broken.

### H3 — `addShiftAction` Bearer-auth path missing

**Severity:** HIGH
**ADRs:** ADR-0132, ADR-0151
**Description:** `_shared.ts:resolveCurrentProfile` uses cookie-based SSR auth. Mobile sends Bearer token, not cookie. The BFF route MUST resolve auth via Bearer (mirror `emma/chat/route.ts:resolveAuth()`) AND THEN pass the resolved profile context to `addShiftAction()`.

**Two implementation paths:**

A. **Refactor `addShiftAction` to accept optional `actor` parameter.**
   ```ts
   export async function addShiftAction(
     input: AddShiftInput,
     actor?: { profileId: string; workspaceId: string; role: string | null },
   ): Promise<AddShiftResult> {
     const profile = actor ?? await resolveCurrentProfile();
     // ...
   }
   ```
   Web caller passes nothing (cookie path); BFF passes resolved actor.

B. **Skip `addShiftAction` and inline its logic in BFF.**
   Duplicates ~140 lines of derivation logic. NOT RECOMMENDED — drift risk.

**Recommendation:** Option A. Mirrors the `apps/web/src/app/api/availability/_shared.ts` pattern where the auth resolver is centralised and the canonical action accepts the resolved identity.

**Promote to BLOCKING B3:** without this, the BFF doesn't work — `resolveCurrentProfile()` returns `null` for Bearer-authed requests. Phase 3a MUST resolve before any code is written.

### H4 — Lovsen S5 channel parameter wiring

**Severity:** HIGH (already in plan, but specific implementation steps must be enumerated)
**ADRs:** ADR-0078
**Description:** Plan §Phase 3a calls out S5 fix. The implementation MUST be:

1. `add-shift-action.ts InputSchema`: add `channel: z.enum(["chat", "system"]).default("chat")`.
2. `add-shift-action.ts:204`: replace hardcoded `"chat"` with `parsed.data.channel`.
3. BFF passes `channel: "system"` in delegate call.
4. Web `AddShiftDialog.tsx` and `RosterTab.tsx` empty-state CTA call sites: do NOT pass channel (default "chat" applies).
5. Test: web call site without channel → "chat" passed to gate. BFF call → "system" passed.

Phase 3a output checklist must enumerate steps 1-5.

---

## MEDIUM severity items

### M1 — Lovsen pause-validation warning at BFF

**Severity:** MEDIUM (already in plan)
**ADRs:** Aml. §10-9
**Description:** Plan §"Endringer i `addShiftAction`" line "Legg til pause-validering: `workHours > 5.5 && !breaks` → `warnings[]`." Implementation:

```ts
const warnings: string[] = [];
if (workHours > 5.5 && (parsed.data.breaks ?? 0) === 0) {
  warnings.push("shift_over_5h_no_break_planned");
}
return { ok: true, shiftId: ..., warnings };
```

Note: `addShiftAction` currently hardcodes `breaks: 0` at line 229. This is a planning hint, not a runtime break-tracking column. Lovsen rapport §3 confirms break tracking happens via `time_entry.breaks` JSONB at punch-time. So the warning is about "no break planned in this shift's planned `breaks` field," not about actual breaks taken.

The web caller currently cannot set `breaks` either (form lacks the field). So the warning fires for ALL > 5.5h shifts, not just emergency mobile ones. This may be too noisy.

**Recommendation:** Phase 3a/3c implement the warning but treat it as informational in BFF response; UI presents but does NOT block submit.

### M2 — `breakMinutes` form field on mobile create.tsx

**Severity:** MEDIUM (Lovsen S3)
**Description:** Plan §"Endringer i `create.tsx`": "Fjern eller marker `breakMinutes` som informasjons-kun." `create.tsx:149, 176-189` collects break minutes and includes it in `useCreateShift` payload at line 187, but Phase 0 §1.1 confirms it's never sent to backend (the schemas.ts `createShiftSchema` doesn't include it). UI promises break tracking; reality stores nothing.

**Recommendation:** Phase 3b/3c remove the field entirely. Document in HANDOFF that break tracking is punch-time only (mobile punch flow, not create flow).

### M3 — `breaks: number` vs `breaks: jsonb` schema confusion

**Severity:** MEDIUM
**ADRs:** ADR-0095 (Reality vs Execution layer separation)
**Description:** `schedule_shift.breaks` is a planning hint (number of break minutes); `time_entry.breaks` is JSONB array of `{start, end}` periods. Same column name, different semantics, different layers. Code-trace risk: future agent confuses the two. Document in HANDOFF the distinction.

### M4 — Telemetry event registry entry verification

**Severity:** MEDIUM
**ADRs:** ADR-0175, ADR-0134
**Description:** Phase 3a must verify `"shift added_manual"` and any new BFF-emitted events are registered in `packages/telemetry/src/registry.ts` BEFORE shipping. Per L-0094, phantom emit contracts (events emitted without registry entry) are CVE-class.

### M5 — Sync action-map deprecation strategy

**Severity:** MEDIUM
**Description:** Plan §Phase 3b: "Drop `create_shift` action; behold punch-handlere" — but if any production deployments have queued `create_shift` actions in SQLite that haven't synced yet, dropping the handler causes them to fail forever. Phase 3b should:

1. Either: keep `actionMap.create_shift` as a deprecated handler that returns immediately with a logged warning (queue dead-letter)
2. Or: confirm via `apps/mobile/src/lib/sync/queue.ts` introspection that no production queues are populated with `create_shift` (Phase 0 §5.2 says "queue never populated due to offline requirement")

Phase 3b output checklist must explicitly confirm one of these paths.

### M6 — BFF rate-limiting (plan §Risks)

**Severity:** MEDIUM
**Description:** Plan §Risks notes "manuell-create kan misbrukes. Gate-action gir C4-cap; BFF legger Upstash-rate-limit på toppen hvis tilgjengelig." Acceptance criterion should be: if Upstash configured (`env.UPSTASH_REDIS_*`), apply 5 req/min/user; else log warning and proceed. Phase 3a output should include this conditional logic.

---

## LOW severity items (HANDOFF only)

### L1 — `create.tsx:153` calls `deriveDayCategory(shiftDate)` with one arg, signature requires two

`create.tsx:81 function deriveDayCategory(date: Date, startTime: string)` — line 153 passes only `shiftDate`. The function reads `startTime.slice(0, 2)` → on undefined this throws at runtime. Either Phase 3b removes client-side derivation entirely (recommended per S4 deferral note), or this is fixed first. Phase 3b removal is cleaner.

### L2 — `useMyShifts` hardcoded 7-day window

`use-my-shifts.ts:73-75` hardcodes `[today, today+7d]`. Plan §Phase 3c proposes filter chips (today/week/month). LOW — UI polish, not architectural.

### L3 — Mobile `is_published` defaults to false

`schemas.ts:127` defaults `is_published: false`. Web defaults `true` (line 232 in addShiftAction). Phase 0 surface map §11 §4 marks this HIGH. After cutover via BFF, the BFF inherits server-side `is_published: true`, so this LOW becomes resolved. Document the resolution in HANDOFF.

### L4 — Mobile `status: "draft"` vs web `status: "created"`

Same convergence — after cutover, BFF inherits `"created"` from addShiftAction. LOW.

### L5 — `work_minutes` client-calculated on punch_out (Phase 0 §10.1 §6.2)

LOW for this sortie — not in scope. Note in HANDOFF as separate work for shift-clock sortie.

### L6 — Punch flow telemetry duplication risk

LOW for this sortie — out of scope (punch is unchanged).

---

## Test Quality Gate

### Performance gates

Mobile shift-create is a route (`apps/mobile/app/(app)/(shifts)/create.tsx`). Per System Steward Test Quality Gate:

> Every new page/route MUST have a performance gate in `apps/e2e/tests/performance-gates.spec.ts`

Existing route, not new — not blocking. But Phase 3 should add one if absent. NOT BLOCKING; add as a follow-up.

### Telemetry assertions

Plan acceptance criteria do not explicitly require `expectTelemetryEvent()` test. Phase 4 review must add at least one journey test that verifies `"shift added_manual"` lands in `activity_trail` after BFF call.

### DB consistency checks

Plan acceptance criteria include "PWA-test: create-shift med valid profileId + reason → toast success + vaktliste re-fetch." This is a UX check, not a DB consistency check. Phase 4 should add: "DB consistency check — after BFF call, `schedule_shift` row exists with `source='manual_admin'`, `notes=reason`, `is_published=true`, correct `day_category`."

### Seed helpers

`apps/e2e/helpers/seed.ts` likely has `seedShift()` already (Phase 0 not audited). Phase 4 should confirm.

---

## Plan Verification Conclusions

**Verdict: APPROVE WITH CONDITIONS — proceed to Phase 3 after BLOCKING items resolved.**

### Conditions for Phase 3 dispatch

1. **B1 resolved:** New ADR `0277-mobile-shift-authoring-via-bff.md` explicitly documents the ADR-0204 SS-5 backlog gap inherited from `addShiftAction`. (Drafted — see companion ADR.)
2. **B2 resolved:** Phase 3a output checklist enumerates the channel parameter wiring as a 5-step list with pre-flight verification of web call sites.
3. **B3 resolved:** Phase 3a refactors `addShiftAction` to accept optional `actor` parameter (Option A in H3) before writing the BFF route.

### Conditions for Phase 3 completion (HIGH items)

4. **H1 resolved:** New ADR adopts Option 2 (mobile UI as thin form, BFF as canonical authoring transport) with explicit refinement of ADR-0133 R2.
5. **H2 resolved:** Phase 3a/3b grep registry + consumers for `"shift created"`, decide event-name strategy, document in HANDOFF.
6. **H4 resolved:** Phase 3a output checklist enumerates 5-step channel-parameter implementation.

### Conditions for HANDOFF (MEDIUM/LOW items)

7-12. M1-M6 handled per individual item descriptions.
13-18. L1-L6 noted in HANDOFF.

### Out of scope (correctly deferred)

- S4 (UTC-tariff-bug) → parallel sortie `feat/schedule-harness-tariff-utc-fix` (correct, NHO Reiseliv juridisk verification needed)
- M2 from Lovsen (constructive-dismissal pattern detection) → backlog
- ADR-0204 SS-5 migration of all 11 `_actions/` Server Actions → out of scope, separate sortie
- ADR-0244 (contract amendment / acknowledgement) → not a shift concern

---

## Files Touched (verified)

### Mobile
- `apps/mobile/app/(app)/(shifts)/create.tsx` — form rewrite (Phase 3b)
- `apps/mobile/src/hooks/mutations/use-create-shift.ts` — calls BFF, removes enqueue (Phase 3b)
- `apps/mobile/src/lib/sync/action-map.ts:143` — drop `create_shift` handler (Phase 3b)
- `apps/mobile/src/lib/sync/schemas.ts:119-128` — drop or deprecate `createShiftSchema` (Phase 3b)
- `apps/mobile/app/(app)/(home)/punch-clock.tsx:205` — wire pause button (Phase 3b/3c per Lovsen S6)
- `apps/mobile/src/hooks/mutations/use-punch.ts:138` — fix `break_minutes` from JSONB (Phase 3b per Lovsen S2)
- `apps/mobile/app/(app)/(shifts)/index.tsx` — vaktliste polish (Phase 3c)

### Web
- `apps/web/src/app/dashboard/_actions/add-shift-action.ts:204` — accept `channel?` parameter (Phase 3a per Lovsen S5)
- `apps/web/src/app/dashboard/_actions/add-shift-action.ts:133-275` — accept optional `actor` parameter (H3)
- `apps/web/src/app/api/mobile/shifts/route.ts` — NEW BFF route (Phase 3a)

### Migrations
None expected. No schema changes.

### Telemetry registry
- `packages/telemetry/src/registry.ts` — verify `"shift added_manual"` registered; consider deprecating `"shift created"` if unused (Phase 3a/3b)

### Documentation
- `docs/decisions/0277-mobile-shift-authoring-via-bff.md` — NEW (this Phase 2)
- `docs/decisions/0000-decision-log.md` — register ADR-0277 (this Phase 2)
- `docs/HANDOFF-mobile-shift-system-polish.md` — at close (Phase 4)
- `docs/journeys/JOURNEY-mobile-shift-system-polish.md` — at close (Phase 4)

---

## Cascade System Proof Tests

Per cascade-touching plan requirements:

- [ ] Re-derivation test — same input ISO + workspace.timezone → same `day_category` (Phase 4 unit test on `deriveDayCategory`)
- [ ] Provenance completeness — `activity_trail.data` contains `source`, `assigned_to`, `reason`, `actor_id`, `workspace_id` (Phase 4 telemetry assertion)
- [ ] C1/C4 separation — `gateAction` denial returns error WITHOUT inserting `schedule_shift` (Phase 4 unit test)
- [ ] Rule-source — no hardcoded rates introduced (verified — `day_category` thresholds are existing code, not new)
- [ ] Cross-workspace isolation — BFF rejects request when `profileId` is in different workspace (Phase 4 integration test)
- [ ] Proposal-to-execution — N/A (no change_proposal in this flow; ADR-0204 SS-5 backlog)
- [ ] Override precedence — `overrideReason` when present is captured in `activity_trail.data.override_reason` (Phase 4 emit assertion)
- [ ] Idempotency — submitting same shift twice creates two distinct rows (no UPSERT key) — acceptable for manual-admin workflow
- [ ] Telemetry-domain consistency — emit fires AFTER successful insert; if insert fails, no emit (verified at addShiftAction:240-272)

---

## Severity Index

| ID | Severity | Description | Phase |
|---|---|---|---|
| B1 | BLOCKING | ADR-0204 inheritance — document in new ADR | Phase 2 (this) |
| B2 | BLOCKING | `addShiftAction` channel param fix is precondition, not parallel | Phase 3a |
| B3 | BLOCKING | `addShiftAction` Bearer-auth path requires actor parameter | Phase 3a |
| H1 | HIGH | ADR-0133 verb-table boundary decision | Phase 2 (this) — recommend Option 2 |
| H2 | HIGH | `"shift created"` vs `"shift added_manual"` event-name divergence | Phase 3a/3b |
| H3 | HIGH | (Promoted to B3) | Phase 3a |
| H4 | HIGH | Lovsen S5 channel parameter wiring (5 steps) | Phase 3a |
| M1 | MEDIUM | Pause-validation warning at BFF | Phase 3a |
| M2 | MEDIUM | Lovsen S3 — `breakMinutes` field UX-misleading | Phase 3b/3c |
| M3 | MEDIUM | `breaks` semantic confusion (number vs jsonb) | HANDOFF doc |
| M4 | MEDIUM | Telemetry registry verification | Phase 3a |
| M5 | MEDIUM | Sync action-map deprecation strategy | Phase 3b |
| M6 | MEDIUM | BFF rate-limiting (Upstash-conditional) | Phase 3a |
| L1 | LOW | `create.tsx:153` runtime bug (resolved by Phase 3b removal) | Phase 3b |
| L2 | LOW | `useMyShifts` hardcoded 7-day window | Phase 3c |
| L3 | LOW | Mobile `is_published=false` (resolved by BFF cutover) | HANDOFF |
| L4 | LOW | Mobile `status: "draft"` divergence (resolved by BFF) | HANDOFF |
| L5 | LOW | `work_minutes` client-calculated on punch_out | HANDOFF — future sortie |
| L6 | LOW | Punch flow telemetry duplication | HANDOFF — future sortie |

---

## Steward's Closing Note

This plan does the hard work of code-tracing every Lovsen finding to the right line numbers and naming the BFF cutover as the canonical fix for S1, S5, and the audit-chain breakage. The Phase 0 + Phase 1 outputs are above the bar — code-traceable, file-and-line-pinned, severity-tagged.

The two architectural questions worth surfacing to the council are:

1. **Should `apps/mobile/app/(app)/(shifts)/create.tsx` exist at all** (ADR-0133 verb-table reading)?
2. **Does `addShiftAction` need its own ADR-0204 migration sortie** before mobile wraps it (preserving the 11-action established pattern means inheriting the gap)?

I recommend keeping the mobile UI (Option 2) and inheriting the gap (treat as ADR-0204 SS-5 backlog). Both decisions are codified in the companion ADR draft.

The remaining BLOCKING items (B2 channel-param fix is precondition; B3 Bearer-auth `actor` parameter) are concrete code requirements that Phase 3a builders must address before writing the BFF route.

Phase 3 may dispatch once the new ADR is committed and the Phase 3a output checklist is amended to include the 5-step channel wiring + the actor-parameter refactor.

— System Steward, 2026-05-04
