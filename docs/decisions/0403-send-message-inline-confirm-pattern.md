---
title: "send_message Inline Confirm Pattern (Phase 2-a)"
id: ADR_0403
status: proposed
layer: decision
created: 2026-05-23
updated: 2026-05-23
---

# ADR-0403: send_message Inline Confirm Pattern (Phase 2-a of InlineConfirmCard Series)

## Context and Problem Statement

Today `send_message` is a single-call commit tool (`packages/ai/src/capabilities/communication/tools.ts:128-235`). It calls `callGateAction`, verifies channel membership, enforces `channel_ai_policy`, then immediately INSERTs a `channel_message` row. There is no HITL confirmation step.

Phase 1 (ADR-0398) shipped the `InlineConfirmCard` primitive for `publish_announcement` — Architecture B (LLM-emitted `show_proposal_card`), stateless `proposal_id` = existing `client_message_id` UUID (L-0330), BotssonChat-fixed registration (L-0331), and four telemetry events. ADR-0398 §Phase Sequencing reserved Phase 2 for `send_message`.

Phase 2-a migrates `send_message` to the two-call confirm pattern, reusing the Phase 1 primitive with zero new component code, zero new client-tool registration, and zero new telemetry events. The key structural difference from `publish_announcement`: `send_message` writes to a single channel; the tamper vector on resume is `channel_id` (not `audience_kind`); there is no audience resolution and no `four_eyes_pending` interaction.

## Decision Drivers

- ADR-0398 §Phase Sequencing explicitly reserved Phase 2 for `send_message`.
- `send_message` channel-write is a meaningful, irreversible mutation that benefits from HITL confirmation.
- Phase 1 primitive is designed for reuse — `surface` enum already includes `"message"` in the ADR-0398 descriptor schema; no schema change needed.
- Architecture B (LLM calls `show_proposal_card` after draft return) is the only viable path given name-keyed dispatch in `agent-router.ts:889-906` (Architecture A closed by ADR-0398).
- Symbol `ProposalCard` is banned (ADR-0398 — two existing collision sites).
- DEFENSE 3 narrowing (body-supplied `channel_id` ignored on resume, re-resolved via RLS) is mandatory to close cross-workspace injection as long as Phase 3 engine_memory persistence is not yet shipped.

## Considered Options

1. **Reuse Phase 1 primitive + split `send_message` to confirm pattern** — RECOMMENDED. ~6 files. Surface enum, component, client-tool registration, and telemetry events all reused from Phase 1. Minimal surface delta.
2. **Build a parallel `SendMessageCard` component** — wastes Phase 1 investment, splits the descriptor contract, introduces a second name in the banned-symbol family.
3. **Skip Phase 2-a and proceed directly to Phase 2-b (`approve_shift`)** — out of order. `send_message` is structurally simpler (no `four_eyes_pending`) and validates the Phase 1 pattern extends cleanly before the more complex Phase 2-b interaction.

## Decision Outcome

Chosen option: **Option 1 — reuse Phase 1 primitive**, with the following `send_message`-specific sub-decisions.

---

### Decision 1: Surface contract — `surface: "message"`

The `InlineConfirmCardDescriptor.surface` enum defined in ADR-0398 already includes `"message"`. The tool returns a descriptor with `surface: "message"`. The `InlineConfirmCard` component maps `surface: "message"` to `MessageSquare` Lucide icon (ADR-0398 §Visual & Motion Contract). No schema change. No new component code.

### Decision 2: Preview shape — channel-context-driven, no audience count

`publish_announcement` preview includes `recipient_count` + `audience_label` (driven by `resolveAudience`). `send_message` has no equivalent — recipients are channel members, implicit via RLS. Preview shape for `send_message`:

```ts
preview: {
  title: "Send melding til <channel_name>",
  body_excerpt: message_content.slice(0, 200),       // line-clamp-3
  metadata: [
    { label: "Kanal",  value: channel_name },
    { label: "Type",   value: "DM" | "Group" },      // derived from channel row
  ],
  // recipient_count omitted (optional field per ADR-0398; not applicable)
}
```

### Decision 3: `gate_action` precheck on draft branch

Same pattern as `publish_announcement` (ADR-0398 §Blocking Condition #1). The existing `send_message` body already calls `callGateAction` at the top of the single-call path. On migration: the precheck moves to the draft branch (`confirm === false`). If denied, return a text refusal before generating any descriptor. This avoids dead-end UX where the LLM shows a card the user cannot commit.

The existing voice-channel guard (`tools.ts:165`) is part of the same `gate.channelAllowed` check — it remains unchanged and fires on the draft branch before any descriptor is returned. Voice path receives a text refusal, not a card (ADR-0078, L-0233).

### Decision 4: Resume-payload trust boundary — `channel_id` is the tamper vector

`publish_announcement`'s body-supplied tamper vector was `audience_kind`. For `send_message`, it is `channel_id` — an adversary could substitute a foreign-workspace `channel_id` in the `ClientToolCallResult` body.

Phase 1 DEFENSE pattern applies verbatim:

- **DEFENSE 1:** `ctx.workspaceId` resolved from JWT (ADR-0151). Never from body.
- **DEFENSE 2:** Channel lookup scoped to `ctx.workspaceId` via RLS — `.eq("workspace_id", ctx.workspaceId)` on `channel` table. Cross-workspace `channel_id` fails the lookup.
- **DEFENSE 3 (narrowing):** On resume branch (`proposal_id` present in body), body-supplied `channel_id` is IGNORED. Server re-derives `channel_id` from the stored draft state. Phase 2-a uses the stateless-default variant (L-0330): the draft state is the `proposal_id` itself, and the confirmed `channel_id` is re-resolved from the RLS-scoped lookup. This is fragile until Phase 3 ships `engine_memory` persistence, at which point DEFENSE 3 is replaced by server-side draft store lookup.
- **DEFENSE 4:** `client_message_id` idempotency via the same UUID pattern as ADR-0398 (stateless UUID lifted before the `if (!confirm)` branch). RPC-level deduplication on commit.

### Decision 5: `editable_fields` whitelist = `["content"]`

`publish_announcement` whitelist: `["title", "body"]`. For `send_message`, only message content is user-editable on resume. `channel_id` is NOT in the whitelist (tamper vector — Decision 4). No `linked_entity` field (not in scope for `send_message`).

The `edit` action in the descriptor:

```ts
{ id: "edit", label: "Endre", variant: "ghost", editable_fields: ["content"] }
```

Edit flow spawns a BIR for the `content` field only. `content` is the actual schema column on `channel_message` and the Zod param name on `send_message` — no UX-facing rename. The card preview labels it "Melding" / "Message" but the wire-level identifier is `content`.

### Decision 6: No `four_eyes_pending` interaction

`send_message` is a single-actor mutation. The descriptor `mode` enum (`idle | loading | resolved | cancelled | error`) from ADR-0398 is sufficient. No `awaiting_approver` extension is needed for Phase 2-a. `four_eyes_pending` is deferred to Phase 2-b (`approve_shift`, ADR-0405 reserved).

### Decision 7: Reuse Phase 1 telemetry events — zero new registry entries

The four events registered in Phase 1 (`inline_confirm_card.shown`, `.confirmed`, `.cancelled`, `.edited`) are surface-agnostic. The `surface` field in `entity_label` or `properties` discriminates `"message"` vs `"announcement"` for downstream analytics. No new `registry.ts` entries. No new emit call-sites in the registry file.

New `emit()` call-sites added to `send_message` tool body (server-side, per L-0233 — voice context is a separate LLM; emit must fire in tool body, not in client):

- `inline_confirm_card.shown` — emitted in draft branch, after descriptor is built, before return.
- `inline_confirm_card.confirmed` — emitted in commit branch, after `channel_message` INSERT, before return.
- `inline_confirm_card.cancelled` — emitted when `proposal_id` is present and `action === "cancel"` in the resume body (handled as a no-op commit branch).

Pre-merge mandatory check (per ADR-0398 §Agent Impact, telemetry maintainers): grep for `inline_confirm_card.shown` emit call-site in `send_message` tool body before merge — phantom registry entries without emit call-sites are L-NEW-1 class.

### Decision 8: System prompt unchanged

`mr-botsson.ts` Phase 1 block already teaches the LLM: "When a mutation tool returns `{phase: "draft", proposal_id, descriptor}`, your IMMEDIATE next tool call MUST be `show_proposal_card(descriptor)`." The instruction is surface-agnostic. `surface: "message"` routes through the same system-prompt block without modification. If message-specific copy is needed (e.g. voice_prompt override), it is returned in the `descriptor.voice_prompt` field from the tool body — no prompt edit required.

### Decision 9: Mobile parity deferred to Phase 2-b

`send_message` as agent-mediated capability is a compose-side verb (ADR-0133: "web composes, mobile executes"). Agent-composed channel messages originate from admin/manager chat surfaces on web. For Phase 2-a, the descriptor sets `platforms: ["web"]` (ADR-0399 field). Mobile RN port of `InlineConfirmCard` is deferred to Phase 2-b (`approve_shift`), where mobile parity is mandatory per ADR-0133 (D6 execute verb).

### Decision 10: `show_proposal_card` registration unchanged

Phase 1 registered `show_proposal_card` as a BotssonChat-fixed client-tool (L-0331). Phase 2-a makes zero changes to this registration. The fixed-impl record in `BotssonChat.tsx` already handles any `surface` value in the descriptor by passing the descriptor to `InlineConfirmCard`. No new `useRegisteredTools()` contribution. No new page-tool registration.

## Rules and Consequences

- **Good, because** reuses the full Phase 1 investment — component, client-tool, telemetry, system prompt. Expected diff ~6 files vs Phase 1's 22.
- **Good, because** RLS-scoped channel lookup is the primary defense for `send_message` — no new defense layer needed beyond existing ADR-0151 + channel-RLS pattern already in the single-call path.
- **Good, because** proves the InlineConfirmCard primitive extends cleanly to a second capability before the more complex Phase 2-b.
- **Bad, because** introduces a contract change to the `send_message` tool response shape — existing callers that expect an immediate `{sent: true, message: ...}` JSON now receive `{phase: "draft", proposal_id, ...}` on the first call. Migration: voice path already returns a text refusal (not a card) per Decision 3; chat path follows the system-prompt HITL block.
- **Bad, because** DEFENSE 3 narrowing is stateless — body-supplied `channel_id` is ignored on resume, but the commit branch must re-resolve `channel_id` from scratch via RLS. This is fragile until Phase 3 adds `engine_memory` persistence for draft state. Mitigation: DEFENSE 2 (workspace-scoped RLS lookup) catches cross-workspace injection even without DEFENSE 3; the only gap is within-workspace `channel_id` substitution (same workspace, wrong channel). Acceptable for Phase 2-a given the short-lived draft window.

### Agent Impact

- **`send_message` callers (LLM):** must follow Phase 1 system-prompt block — `phase: "draft"` return triggers `show_proposal_card` call. Same pattern as `publish_announcement`. No prompt update required.
- **Capability authors (future Phase 2-b `approve_shift`):** ADR-0403 establishes the reuse pattern for a second adopter. Future adopters: split tool to confirm=false draft branch returning descriptor + confirm=true commit branch; reuse primitive, telemetry, system prompt; declare tamper vector and `editable_fields`.
- **Stage-engine maintainers:** no change. `show_proposal_card` dispatch remains name-keyed (ADR-0398).
- **Telemetry maintainers:** verify `inline_confirm_card.shown` + `.confirmed` emit call-sites exist in `send_message` tool body before merge. No new registry entries. No new routing config.
- **UI authors:** `InlineConfirmCard` renders `surface: "message"` with `MessageSquare` icon (Phase 1 icon map). No component change.

## Phase Sequencing

- **Phase 1 (ADR-0398, complete):** `publish_announcement` rework + `InlineConfirmCard` component + `show_proposal_card` + BotssonChat-fixed registration + 4 telemetry events.
- **Phase 2-a (this ADR):** `send_message` confirm pattern — reuses Phase 1 primitive.
- **Phase 2-b (ADR-0405, reserved):** `approve_shift` × `four_eyes_pending` — extends `mode` enum with `awaiting_approver`; mobile parity mandatory (ADR-0133 D6 execute verb).
- **Phase 3 (future ADR):** stateful draft store via `engine_memory` (replaces DEFENSE 3 narrowing); BIR spawn-under-card edit flow for multi-field edit; audience-fingerprint for `publish_announcement`.

## Blocking Conditions Before Phase 2-a Merge

1. `gate_action` precheck added to `send_message` draft branch — precheck fires before descriptor build; voice-channel denial returns text, not card (Decision 3).
2. Phase 1 `show_proposal_card` BotssonChat-fixed registration verified unchanged — no new `useRegisteredTools()` entry (L-0331).
3. `emit()` for `inline_confirm_card.shown` + `.confirmed` (+ `.cancelled` on cancel branch) in `send_message` tool body — server-side, file:line cited in PR description (ADR-0398 telemetry maintainer rule; L-NEW-1 phantom-contract prevention).
4. DEFENSE 3 narrowing implemented in commit branch — body-supplied `channel_id` ignored when `proposal_id` present; `channel_id` re-resolved server-side via RLS-scoped `channel` table lookup with `ctx.workspaceId` (Decision 4).
5. `editable_fields: ["content"]` enforced on resume — `channel_id` not editable; any other field in `patch` is stripped before commit (Decision 5).

## References

- ADR-0398 — InlineConfirmCard primitive (Phase 1, authoritative for descriptor shape, flow, and BotssonChat-fixed sub-pattern)
- ADR-0399 — channel + platform descriptor axes (`channel_constraint`, `platforms`)
- ADR-0151 — server-derived `workspace_id` (JWT, not body)
- ADR-0078 — channel pinning; voice-channel guard at `tools.ts:165`
- ADR-0287 — `gate_action` mandatory before any mutation
- L-0177 — silent-fallback ban (row-not-found must be 4xx, not silent JWT default)
- L-0330 — stateless-default from existing UUID (`proposal_id` = lifted `client_message_id`)
- L-0331 — BotssonChat-fixed client-tool sub-pattern (fixed-impl wins over page-tool on name collision)
- L-0233 — voice context is a separate LLM; emit must fire in tool body (server-side)
- Spec: `docs/superpowers/specs/2026-05-23-inline-confirm-card-send-message.md`
- Code: `packages/ai/src/capabilities/communication/tools.ts:128-235` (current single-call `send_message`)
- Phase 1 reference: `packages/ai/src/capabilities/communication/publish-announcement.ts:223-254`

---

> After writing: register in `docs/decisions/0000-decision-log.md` and verify CLAUDE.md ADR count.
