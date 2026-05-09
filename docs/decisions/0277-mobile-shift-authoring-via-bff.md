---
title: "Mobile Shift Authoring via Web BFF"
id: ADR-0277
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
module: mobile
related: [ADR_0078, ADR_0095, ADR_0114, ADR_0132, ADR_0133, ADR_0134, ADR_0151, ADR_0173, ADR_0204, ADR_0261, ADR_0265]
tags: [mobile, shift, bff, cascade, authoring, lovsen]
---

# ADR-0270: Mobile Shift Authoring via Web BFF

**Status:** Proposed
**Date:** 2026-05-04
**Council:** sortie `feat/mobile-shift-system-polish` (Phase 2 verification)

## Context and Problem Statement

The mobile shift-create surface (`apps/mobile/app/(app)/(shifts)/create.tsx` + `useCreateShift` + `actionMap.create_shift`) bypasses every server-side concern that the canonical web shift-create path enforces. Phase 0 surface map + Phase 1 lovsen rapport (2026-05-04) code-traced six load-bearing gaps:

1. **No authority gate.** `actionMap.create_shift` (`apps/mobile/src/lib/sync/action-map.ts:143`) is a direct `supabase.from("schedule_shift").insert()` with no `gate_action(roster.add_shift_manual)` call. The web equivalent (`apps/web/src/app/dashboard/_actions/add-shift-action.ts:201-211`) gates via `gateAction()` per ADR-0099.

2. **No audit reason.** Schema (`apps/mobile/src/lib/sync/schemas.ts:119-128 createShiftSchema`) has no `reason` field. Web requires `min(8)` chars in `notes` for audit reconstruction.

3. **No source attribution.** Mobile insert has no `source='manual_admin'` flag — indistinguishable from auto-fill in `activity_trail`.

4. **Wrong publication state.** Mobile defaults `is_published: false`; web defaults `true`. Mobile-created shifts are invisible to readers until manually published — silent failure mode.

5. **Wrong `day_category`.** Client-side `deriveDayCategory()` (`create.tsx:81-91`) uses device timezone via `date.getDay()` and `parseInt(startTime.slice(0,2))`. Web derives in workspace timezone via `toWorkspaceDateTimeParts()` (`add-shift-action.ts:99-107`). Cross-tz drift produces wrong tariff bucket.

6. **Forgeable employee_id pattern.** Web cross-checks employee workspace via `addShiftAction:149-156`; mobile direct insert relies solely on RLS, which today permits insert into any `workspace_id` the actor has access to (cross-employee, same-workspace) without further checks.

Lovsen rapport classifies all six as HIGH severity per Aml. §10-7 (arbeidstidsregistrering), §10-9 (pauser), §14-6 (audit-trail), and bokføringsloven §13 (5-year retention). Two adjacent HIGH findings (S2 hardcoded `break_minutes: 0` in punch-out emit; S6 mobile pause-button dødskoblet) and one HIGH boundary finding (S5 hardcoded `channel: "chat"` in `addShiftAction:204`) are not strictly shift-creation concerns but ride on the same cutover.

ADR-0132 established that mobile is a thin client and AI/capability traffic routes through the web BFF (`/api/emma/chat` → stage-engine). ADR-0261 generalised this pattern to non-AI mutations for the `tips.*` capability family ("BFF as Mutation Host for Non-Agent Capabilities"). ADR-0133 codified the verb-table boundary: web composes (D1–D5 authoring), mobile executes (D6 production + C4 acceptance). Shift-create reads as a "compose/plan" verb under ADR-0133 R2, which lists schedule authoring as web-only.

The question this ADR answers: **does mobile manager-emergency-create violate ADR-0133, or is there a coherent refinement of the verb-table that permits it?**

## Decision Drivers

- **Real product use-case:** managers need to create shifts from mobile in emergencies (sick-call replacement at 14:00 Saturday). Lovsen rapport §6 confirms the use-case is legitimate per Aml. and Riksavtalen.
- **Cascade integrity (ADR-0056):** every datum has one role. Currently, mobile shift-create writes to `schedule_shift` (D6 Execution) without producing the audit-trail provenance the layer requires. Either fix the path or remove the surface.
- **Aml. §14-6 + bokføringsloven §13:** every shift must be reproducible from `actor_id`, `reason`, `source`, timestamp, `workspace_id` for 5 years. Mobile direct-insert breaks this chain.
- **ADR-0078 channel guards:** server-side capability authority must reflect the true call origin. Hardcoding `channel: "chat"` for a server-action callable from web cookie + mobile Bearer + (future) voice is wrong.
- **ADR-0204 SS-5 backlog:** `addShiftAction` and 10 sibling Server Actions in `apps/web/src/app/dashboard/_actions/` use the legacy `gateAction()` (Pathway A only) pattern, NOT the canonical `gatedMutation()` orchestrator. Migration is tracked under ADR-0204 SS-5; this ADR does not introduce a new violation.
- **Trust gate equivalence:** mobile shift-create today emits `"shift created"` with valid `nonEmpty()` ids per ADR-0134, but the underlying mutation has no gate, no source, no audit-reason. Telemetry compliance does not equal authority compliance.
- **Operational consistency:** `apps/web/src/app/api/emma/chat/route.ts` and `apps/web/src/app/api/tips/adjust-share/route.ts` already implement the BFF-with-Bearer-auth pattern. The same pattern applies here.

## Considered Options

### Option 1 — Delete mobile create surface entirely

Remove `apps/mobile/app/(app)/(shifts)/create.tsx`, `apps/mobile/src/hooks/mutations/use-create-shift.ts`, the `create_shift` entry in `action-map.ts`, and the `createShiftSchema` in `schemas.ts`. Strict ADR-0133 R2 reading: schedule authoring is web-only.

**Pros:**
- Cleanest verb-table compliance.
- Smallest sortie scope.
- Mobile users can still author via web on phone (PWA already supports mobile viewport).

**Cons:**
- Real product gap during emergencies (one-handed phone use during peak service is what mobile-native is FOR).
- Existing UI exists and is used; removal is a regression to product roadmap.
- Lovsen §6 explicitly recommends keeping the mobile surface with proper authority + audit.

### Option 2 — BFF wraps `addShiftAction`; mobile UI retained as thin form

New web BFF route `POST /api/mobile/shifts/route.ts`. Bearer-authed (ADR-0132). Validates body via Zod (no `workspace_id` from body — server-derived per ADR-0151). Delegates to `addShiftAction()` with `channel: "system"` and an explicit `actor: { profileId, workspaceId, role }` parameter (refactored).

`addShiftAction` modified:
- `InputSchema` accepts `channel: z.enum(["chat", "system"]).default("chat")`.
- `gateAction()` line 204 reads from `parsed.data.channel` instead of hardcoded `"chat"`.
- Optional second positional argument `actor?: { profileId, workspaceId, role }` skips `resolveCurrentProfile()` cookie path when present (BFF passes Bearer-resolved actor).

Mobile flow:
- `create.tsx` adds employee picker (target `profileId`), reason textarea (min 8 chars), removes client-side `deriveDayCategory()`, removes `breakMinutes` field (not stored anyway per Lovsen S3).
- `useCreateShift` calls `fetch("/api/mobile/shifts", { method: "POST", headers: { Authorization: "Bearer ${jwt}" }, body: JSON.stringify(...) })` instead of `enqueue("create_shift", ...)`.
- `actionMap.create_shift` is removed (or stubbed with deprecation log if any production queues hold pending entries).
- Mobile-side `emit("shift created")` is removed (server-side `emit("shift added_manual")` takes over).

**Pros:**
- Single source of truth for shift-creation logic (`addShiftAction`).
- Mobile inherits all server-side concerns: tz, audit, gate, source, publication state.
- Architecturally identical to ADR-0132 mobile-chat pattern and ADR-0261 tips pattern.
- Closes Lovsen S1, S3, S5 (S5 being the channel-param fix).
- Preserves the legitimate emergency use-case.

**Cons:**
- Adds one HTTP hop. Mobile depends on web availability.
- Drops offline create-shift capability (mobile shows "online required" for create; punch-flow remains offline-first).
- Inherits ADR-0204 SS-5 backlog gap from `addShiftAction` (no `gatedMutation()` composition; `cascade_gate_write` not invoked).

### Option 3 — Native mobile direct insert with full audit kit

Reproduce the entire `addShiftAction` logic in mobile TypeScript: workspace tz fetch, day_category derivation, gate_action RPC call, source attribution, audit emit. Keep offline queue path.

**Pros:**
- Preserves offline create.
- No HTTP hop.

**Cons:**
- Dual implementation = drift over time. Lovsen S4 (UTC tariff bug) is exactly this kind of drift between two implementations.
- Server-side identity guard duplicated; ADR-0151 forgery surface widens.
- Capability registry, gate seeds, telemetry registry all need mobile-aware doubles.
- Violates Cascade Invariant 1 (single canonical pipeline).

## Decision Outcome

**Chosen: Option 2 — BFF wraps `addShiftAction`; mobile UI retained as thin form.**

This refines ADR-0133 R2 by distinguishing between two readings of "schedule authoring":

1. **Authoring runs on mobile** — domain logic (tz derivation, gate, source attribution, audit emit) executes in mobile code. **Forbidden** per ADR-0133 R2 — produces the feature graveyard pattern (each web feature half-ported with diverging logic).

2. **Authoring is initiated from mobile but executes on web BFF** — mobile UI is a thin form whose only responsibility is collecting input, attaching the user's JWT, and POSTing to the canonical web compose path. **Permitted** per this ADR — architecturally identical to ADR-0132 mobile-chat → BFF → stage-engine and ADR-0261 mobile-tips → BFF → tips Server Action.

The boundary is not "where the UI runs" but "where the authoring verb executes." The compose verb runs on the web BFF on top of `addShiftAction()`. Mobile contributes the form, the JWT, and the user gesture; server contributes identity, tz, gate, audit, and persistence.

## Rules & Consequences

### R1. Mobile shift-create routes through web BFF

Mobile POSTs to `${EXPO_PUBLIC_WEB_API_URL}/api/mobile/shifts` with `Authorization: Bearer <supabase_access_token>`. The BFF validates the Bearer token via `admin.auth.getUser(token)` (mirror `apps/web/src/app/api/emma/chat/route.ts:resolveAuth()`), resolves the actor's profile + workspace, and delegates to `addShiftAction()`.

`workspace_id` is NEVER sent in body (per ADR-0151). The body schema is:

```ts
const RequestSchema = z.object({
  profileId:      z.string().uuid(),       // target employee
  startAtISO:     z.string().datetime(),
  endAtISO:       z.string().datetime(),
  role:           z.string().min(1),
  reason:         z.string().min(8),       // audit per Aml §14-6
  departmentId:   z.string().uuid().optional(),
  overrideReason: z.string().min(1).optional(),
});
```

### R2. `addShiftAction` accepts `channel?` parameter and optional `actor`

Two refactors in `apps/web/src/app/dashboard/_actions/add-shift-action.ts`:

a. `InputSchema` adds `channel: z.enum(["chat", "system"]).default("chat")`. The hardcoded `"chat"` at line 204 is replaced with `parsed.data.channel`. Web call sites pass nothing → default "chat" preserves current behaviour. BFF passes `"system"` (server-initiated, server-to-server semantic).

b. The exported function signature becomes `addShiftAction(input, actor?)` where `actor?: { profileId, workspaceId, role }`. When present, `resolveCurrentProfile()` (cookie-only) is skipped and the BFF-resolved actor is used. This closes Lovsen S5 and fixes the Bearer-auth path simultaneously.

This refactor is the **precondition** for the BFF route, not a parallel fix. Phase 3a MUST complete (a) and (b) before writing the BFF route. (Steward's Phase 2 verify report flags this as BLOCKING items B2 + B3.)

### R3. Mobile `createShift` UI mandates new fields

`apps/mobile/app/(app)/(shifts)/create.tsx` adds:

- Employee picker (`profileId` from `useWorkspaceProfiles` — mobile equivalent of web AddShiftDialog).
- Reason textarea (`reason`, min 8 chars, inline validation, submit-blocking).
- Optional override-reason textarea (only shown when picked employee has unavailable/absent flag for the shift date).

Removes:

- Client-side `deriveDayCategory()` (now server-derived via workspace tz).
- `breakMinutes` form field (per Lovsen S3 — never stored, UX-misleading; break tracking is punch-time only).

### R4. Mobile sync action-map drops `create_shift` handler

`apps/mobile/src/lib/sync/action-map.ts:143` and `apps/mobile/src/lib/sync/schemas.ts:119-128` are removed. Phase 3b MUST verify production queues do not hold pending `create_shift` entries (offline create was never functionally used per Phase 0 §5.2). If queue inspection is non-trivial, the handler is replaced with a deprecation stub that logs + returns successfully without DB write, allowing future cleanup.

Mobile-side `emit("shift created")` is removed. Server-side `emit("shift added_manual")` becomes the sole source of truth for shift-creation telemetry.

### R5. ADR-0204 inheritance — explicit acknowledgement

`addShiftAction` uses the legacy `gateAction()` (Pathway A only) pattern from `apps/web/src/app/dashboard/_actions/_shared.ts:79-121`. It does NOT compose via `gatedMutation()`. `cascade_gate_write` (Pathway B / ADR-0091) is NOT invoked.

This matches the pattern of 10 sibling Server Actions in `apps/web/src/app/dashboard/_actions/`:

```
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

Migration of all 11 Server Actions to `gatedMutation()` is tracked under ADR-0204 §Rollout SS-5 ("Close the 33 ESLint warnings via call-site migration to `gatedMutation`"). The BFF in this ADR inherits the gap; closure is **out of scope for this sortie**. A future ADR-0204 SS-5 sortie will migrate `addShiftAction` and its siblings; the BFF will not need code changes (orchestrator-aware Pathway A still gates).

This is documented explicitly to prevent the L-0098 prior-council-staleness pattern (a future steward reading this ADR as silently endorsing an ADR-0204 violation).

### R6. Channel guard layer compliance

ADR-0078 specifies three enforcement layers (process / capability / tool). For Server Action capabilities like `roster.add_shift_manual`:

- **Layer 1 (process-level):** N/A — `roster.add_shift_manual` is not bound to an `engine_process` row.
- **Layer 2 (capability-level `allowedChannels`):** enforced via the `channel` argument passed to `gateAction()` at runtime. The new `channel` parameter on `addShiftAction` flows from BFF → `gateAction()` → `gate_action` RPC → `engine_authority_config` lookup. `engine_authority_config` does not currently store per-channel rules for `roster.add_shift_manual`; default-allow applies for unknown channels. Should the schema later add channel constraints (similar to ADR-0163's PII-channel mandatory rule), the `channel` parameter ensures the gate sees the true call origin.
- **Layer 3 (tool-level):** N/A — Server Actions are not capability tools with `ctx.channel`.

The BFF passing `channel: "system"` is a defence-in-depth signal: should `engine_authority_config` later restrict `roster.add_shift_manual` to `["chat", "system"]` (forbidding voice), the BFF's `"system"` value passes; if it were "chat" hardcoded, voice-routed traffic in some hypothetical future would silently pass under the wrong label.

### R7. Telemetry contract end-to-end

The BFF does NOT emit. It delegates to `addShiftAction()`, which emits `"shift added_manual"` per `apps/web/src/app/dashboard/_actions/add-shift-action.ts:248-272`. `nonEmpty()` brand on `workspace_id` and `actor_id` is preserved (ADR-0193). The BFF MUST verify before delegating that the resolved `{ profileId, workspaceId }` are non-empty strings (defence-in-depth — `getProfileContext()`'s mobile-side equivalent on the BFF side).

`"shift added_manual"` is the canonical event for manual shift creation. The mobile-side `"shift created"` event is removed by this sortie. Phase 3a/3b MUST verify in `packages/telemetry/src/registry.ts` that:

- `"shift added_manual"` is registered with all four destinations (PostHog, Logger, activity_trail, engine_event).
- `"shift created"` is either marked deprecated or removed if no consumers exist.

Per L-0094 (phantom emit contracts), unregistered emit events are CVE-class. Phase 3a output checklist must include the registry verification.

### R8. Optional rate-limiting at BFF

Manual shift creation is a low-frequency operation (manager emergency-create). To prevent automation abuse:

- If `env.UPSTASH_REDIS_REST_URL` and `env.UPSTASH_REDIS_REST_TOKEN` are configured, apply a 5-requests-per-minute-per-actor limit using the standard pattern.
- Otherwise, log a warning at startup and proceed without rate-limiting (acceptable in dev/staging).

This is not a security primitive (gate_action is). It is operational hygiene.

### R9. `is_published`, `status`, `source` are server-controlled

Mobile MUST NOT send these fields in the request body. The BFF/Server Action sets:

- `is_published: true` (default for manual_admin shifts).
- `status: "created"` (Execution layer initial state per ADR-0095).
- `source: "manual_admin"` (audit attribution per addShiftAction:234).

Mobile body fields for these are silently ignored by the Zod schema (not in `RequestSchema`).

### R10. Out of scope (deferred to other sorties)

This ADR does NOT address:

- **Lovsen S2** — `break_minutes: 0` hardcoded in `use-punch.ts:138` punch-out emit. Punch flow is unchanged; fix is in scope for the same sortie's Phase 3b but is not a shift-create concern.
- **Lovsen S6** — mobile pause-button dødskoblet at `punch-clock.tsx:205`. Same scope.
- **Lovsen S4** — `resolve-tariff-rate.ts` UTC bug. Parallel sortie `feat/schedule-harness-tariff-utc-fix` per plan §Out of scope. Different code area (cascade D3); requires NHO Reiseliv juridisk verification before production.
- **Lovsen M1** — pause-validation warning at BFF (informational, Phase 3a optional implementation).
- **Lovsen M2** — pattern-detection for repeated override of same profile. Backlog.
- **ADR-0204 SS-5 migration** — see R5.
- **ADR-0244** — contract amendment / acknowledgement-as-legal-evidence is a contract-domain concern, not shift.
- **Mobile offline create-shift** — Phase 3 explicitly REMOVES offline shift-create. Offline punch-flow remains. Document UX mitigation in HANDOFF (online-required banner + queue-for-later draft saved locally without insert).

## Agent Impact

- **Build agents (Phase 3a):** Modify `addShiftAction` first (channel param + actor param), then write BFF route. Mirror `apps/web/src/app/api/emma/chat/route.ts:resolveAuth()` for Bearer-auth resolution. Mirror `apps/web/src/app/api/tips/adjust-share/route.ts` for the BFF-as-mutation-host structure. Pre-flight: run `git grep "addShiftAction(" apps/web/` and confirm no existing call site passes `channel` (so default "chat" preserves behaviour).
- **Build agents (Phase 3b):** Refactor `create.tsx` to use `useWorkspaceProfiles` for employee picker. Add reason textarea with `min(8)` validation. Remove client-side `deriveDayCategory`. Remove `breakMinutes` field (Lovsen S3). Remove `actionMap.create_shift` and `createShiftSchema`. Replace mobile-side emit with reliance on BFF-emitted event.
- **Build agents (Phase 3c):** Vaktliste polish, status pill derivation from `time_entry`, error states, filter chips.
- **Steward (Phase 4 review):** Verify (a) `addShiftAction` channel parameter wired to all call sites, (b) BFF Bearer-auth path mirrors emma/chat pattern, (c) registry has `"shift added_manual"` with 4 destinations, (d) cross-workspace guard preserved via delegation, (e) HANDOFF documents the `"shift created"` deprecation.
- **Future agents (ADR-0204 SS-5 sortie):** Migrate `addShiftAction` to `gatedMutation()` orchestrator. The BFF in this ADR will continue to function unchanged — orchestrator is server-side and Pathway A is preserved.

## Consequences

- **Good, because** mobile inherits server-side audit, gate, tz, source attribution, and authority — closes Lovsen S1, S3, S5 in one cutover.
- **Good, because** single source of truth for shift-creation logic (`addShiftAction`); no dual implementation drift risk.
- **Good, because** ADR-0133 verb-table refinement is explicit and codified (mobile = thin form, web BFF = compose verb), preserving cascade integrity invariant 1.
- **Good, because** architecturally identical to ADR-0132 mobile-chat and ADR-0261 mobile-tips patterns — reusable architecture.
- **Bad, because** offline create-shift capability is dropped. Mitigated by mobile-native draft-save locally (no DB insert) for retry-when-online UX.
- **Bad, because** adds one HTTP hop. Acceptable trade-off given the use-case (low frequency, requires server context anyway).
- **Bad, because** inherits ADR-0204 SS-5 backlog gap. Documented explicitly to prevent future-steward staleness.
- **Migration cost:** ~1 day for `addShiftAction` refactor + BFF route + auth resolver test (Phase 3a). ~1 day for mobile UI rewrite + actionMap cleanup (Phase 3b). ~1 day for vaktliste polish (Phase 3c). Total ~3 days end-to-end, matches plan estimate.

## Lovsen Findings Closure Map

| Lovsen ID | Severity | Closed by this ADR? | Implementation |
|---|---|---|---|
| S1 | HIGH | YES | R1 + R3 + R4 — BFF replaces direct insert; gate + reason + source server-side |
| S2 | HIGH | NO | Out of scope per R10 — punch-out emit fix is parallel work |
| S3 | HIGH | YES | R3 — `breakMinutes` field removed from `create.tsx` |
| S4 | HIGH | NO | Deferred to parallel sortie per plan §Out of scope |
| S5 | HIGH | YES | R2 — `addShiftAction` accepts `channel?` parameter |
| S6 | HIGH | NO | Out of scope per R10 — mobile pause-button is parallel work |
| M1 | MEDIUM | PARTIAL | R7 acknowledges; informational warning in BFF response, not blocking |
| M2 | MEDIUM | NO | Backlog — pattern-detection requires engine_event consumer work |

## Related ADRs

- **ADR-0078** — Engine Process Channel Restriction. R2 + R6 honour the three-layer enforcement model; this ADR fixes Lovsen S5 (hardcoded channel).
- **ADR-0095** — Shift Lifecycle Five-Layer Architecture. Mobile shift-create writes Layer 5 (Execution: `schedule_shift`); never crosses layers.
- **ADR-0114** — Server Actions as Canonical Mutation Primitive. The BFF delegates to a Server Action; pattern preserved.
- **ADR-0132** — Mobile is a Thin Client; AI/Capabilities Route Through Web BFF. This ADR generalises §Decision Driver "stage-engine HTTP-callable" to non-AI mutations, sibling to ADR-0261.
- **ADR-0133** — Web Composes, Mobile Executes. This ADR refines §R2 verb-table by distinguishing "authoring runs on mobile" (forbidden) from "authoring initiated from mobile, executes on web BFF" (permitted).
- **ADR-0134** — Mobile Telemetry Contract Enforcement. R7 honours `nonEmpty()` brand at every emit site; mobile-side emit removed by R4.
- **ADR-0151** — Server-Derived Profile/Workspace IDs. R1 enforces `workspace_id` server-derivation; body schema has no `workspace_id` field.
- **ADR-0173** — Journey Capability Model. Cross-reference for `allowedChannels` pattern (mobile uses `["chat"]` not voice for PII-adjacent flows; shift-create is similar).
- **ADR-0204** — gatedMutation Composition Orchestrator. R5 explicitly documents the inherited gap (SS-5 backlog).
- **ADR-0261** — BFF as Mutation Host for Non-Agent Capabilities. Sibling pattern; this ADR extends it to D6+C4 mobile-execute verbs.
- **ADR-0265** — Enforced Deployment Pipeline. Sortie merges to `campaign/mobile` via `/close-feature`.

---

> Registered in `docs/decisions/0000-decision-log.md` on 2026-05-04 (proposed). Flips to `accepted` on close-feature merge once Phase 3 acceptance criteria pass.
