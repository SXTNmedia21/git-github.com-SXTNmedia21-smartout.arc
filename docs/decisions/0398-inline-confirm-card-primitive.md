---
title: "Inline Confirm Card — HITL UI primitive for Botsson chat"
id: ADR_0398
status: proposed
layer: decision
created: 2026-05-23
updated: 2026-05-23
---

# ADR-0398: Inline Confirm Card Primitive (HITL UI for Botsson Mutations)

## Context and Problem Statement

Today the Botsson chat surface presents draft-confirm flows as plain-text JSON returned from capability tools (e.g. `publish_announcement(confirm=false)` returns a JSON string with `phase: "draft"`, the LLM verbalizes the draft, the user types "yes publish", the LLM calls `publish_announcement(confirm=true)`). The pattern works but is fragile, low-affordance, and gives users no structured Accept/Edit/Reject affordance. We need a **generic Human-In-The-Loop (HITL) UI primitive** rendered inline in the chat stream that shows a draft + 3 action buttons (Bekreft / Endre / Avbryt) for every mutation that benefits from human confirmation. The primitive must be sibling to the existing `BotssonInputRequest` (BIR) and reuse the existing `ClientToolCall` roundtrip protocol (ADR-0327).

## Decision Drivers

- Pattern reuse: existing two-call confirm (`publish_announcement` lines 223-254) + roundtrip wire (`BotssonChat.tsx:140-194`, MAX_ROUNDTRIPS=3) + idempotency UUID (`publish_announcement_atomic.p_client_message_id`) all already exist.
- Naming-collision risk: `ProposalCard` is already used as a React component name in `ChangeProposalsPanel.tsx:50` and `ProposedPlanClient.tsx:238`; the `change_proposal` table (C4 governance) and `engine_state_step` runtime use "proposal" semantics. Reusing the symbol would create import-flow chaos and conceptual conflation.
- Dispatch reality: stage-engine client-tool dispatch is **name-keyed** (`services/stage-engine/src/core/agent-router.ts:889-906` matches `call.toolName ∈ clientToolNames`), NOT marker-keyed on tool result. The Vercel AI adapter (`packages/ai/src/adapters/vercel-ai.ts:54-80`) returns tool results verbatim — no interceptor exists.
- Idempotency requirement: `publish_announcement_atomic` RPC already accepts `p_client_message_id` (migration `20260620140400` lines 20, 70-80) and the capability generates it server-side at `publish-announcement.ts:238`. New ID surfaces would create dual-source-of-truth.
- Mobile parity (ADR-0133): "web composes, mobile executes." `approve_shift` is an execute verb; the primitive schema must live in `packages/ai/` from day one so mobile can render natively (Phase 2).
- Voice surface (ADR-0238, L-0233): voice LLM is a separate context with its own thin tools. Voice must never receive a card descriptor — falls back to verbal confirm.
- Cascade placement: **C2** (render → user-decides loop) + **C4** (commit gated by `mutateWithGate`/`callGateAction`). "Confident ≠ authorized" preserved — agent proposes, user authorizes, gate enforces at commit.

## Considered Options

1. **Architecture A — Tool returns descriptor object, stage-engine intercepts and wraps as `client_tool_call`.** Requires NEW dispatch logic in `agent-router.ts` parallel to name-detection. Synthetic `tool_call_id` breaks the roundtrip seeding contract at `chat.ts:603-649`.
2. **Architecture B — Tool returns JSON string with `phase: "draft"`, LLM explicitly calls `show_proposal_card` as a registered client-tool.** Composes with existing dispatch. Zero changes to `agent-router.ts`. Requires 10-line system-prompt instruction in `mr-botsson.ts`.
3. **Extend BIR with new field-type `confirm-card`.** Bloats `InputFieldTypeSchema` with a mutation-only special case; breaks BIR's "1-10 fields" semantic; confuses channel-guard logic at `input-request/types.ts:137-142`.
4. **Persist `proposal_id` in `engine_memory`.** Conflates short-lived UI correlation with medium-term conversational memory; breaks `engine_memory_memory_type_check` constraint; opens race window between draft show and commit; violates ADR-0151 (commit MUST re-derive workspace/audience server-side).

## Decision Outcome

Chosen option: **Architecture B + sibling primitive (Option 2 composed with Option-3 rejection).** This is the only architecturally viable path given the existing dispatch implementation, and the only ID strategy that preserves ADR-0151 server-derived trust.

### Primitive Definition

- **Component name:** `InlineConfirmCard` (lives in `packages/ui/src/components/inline-confirm-card.tsx`). **Symbol `ProposalCard` is banned** — already used in two locations.
- **Client-tool name:** `show_proposal_card` (lives in agent-contract space; mirrors `show_*` convention already used by `show_visualizer`). The component avoids "proposal" in UI/cascade space; the tool retains it in agent-contract space.
- **Descriptor type:** `InlineConfirmCardDescriptor` in `packages/ai/src/primitives/inline-confirm-card/types.ts`. Discriminator field is `type: z.literal("inline_confirm_card")` — mirrors BIR's `type: z.literal("input_request")` field-name convention. Discriminator field name is `type`, NOT `kind`.
- **`proposal_id` (stateless):** Same UUID as the existing `client_message_id` from `publish-announcement.ts:238`. The capability lifts the existing `clientMessageId = crypto.randomUUID()` generation BEFORE the `if (!params.confirm)` branch and returns it as `proposal_id` in the draft response. Commit phase passes the same UUID to `p_client_message_id` for RPC-level idempotency. No engine_memory, no new table, no session state.

### Descriptor Schema (Phase 1)

```ts
type InlineConfirmCardDescriptor = {
  type: "inline_confirm_card";
  proposal_id: string;                              // = future p_client_message_id
  surface: "announcement" | "message" | "shift_approve";
  draft: Record<string, unknown>;                   // tool-specific
  preview: {
    title: string;                                  // text-sm font-semibold (NOT font-heading)
    body_excerpt?: string;                          // line-clamp-3
    recipient_count?: number;
    affected_entity?: string;
    metadata: Array<{ label: string; value: string }>; // chips
  };
  actions: Array<
    | { id: "confirm"; label: string; variant: "primary" }
    | { id: "edit"; label: string; variant: "ghost"; editable_fields: string[] }
    | { id: "cancel"; label: string; variant: "destructive" }
  >;
  voice_prompt?: string;                            // server-controlled voice copy (no client-side interpolation)
  recipient_preview_available?: boolean;            // drives interactive vs static chip
  // channel_constraint + platforms come from ADR-0399
};

type InlineConfirmCardResult = {
  proposal_id: string;
  action: "confirm" | "edit" | "cancel";
  patch?: Partial<Record<string, unknown>>;         // only whitelisted editable_fields on edit
};
```

### Registration Sub-Pattern (BotssonChat-fixed)

`show_proposal_card` is registered as a **BotssonChat-fixed client-tool**, NOT page-contributed via `useRegisteredTools()`. Two registries coexist at dispatch time inside `BotssonChat.tsx`:

1. **Fixed primitives** — shipped with the chat shell, available on every chat surface regardless of page (`show_proposal_card`, future fixed primitives).
2. **Page tools** — contributed via `useRegisteredTools()` from page bridges (`help-takeover-kit`, page-specific kits).

Precedence on name collision: fixed wins. The fixed-impl record lives in `apps/web/src/app/Botsson/_components/BotssonChat.tsx` and merges with `useRegisteredTools()` before passing to `executeClientToolRoundtrip`.

### Server-Side Flow (publish_announcement, Phase 1 reference implementation)

1. LLM calls `publish_announcement({title, body, audience_kind, confirm: false})`.
2. Tool body:
   - **Precheck `gate_action`** (avoid dead-end UX per Code-Tracer mandate) — refuse with explanatory text if denied.
   - Resolve audience server-side (`resolveAudience`).
   - Generate `clientMessageId = crypto.randomUUID()`.
   - Return JSON string: `{phase: "draft", proposal_id: clientMessageId, target_profile_count, audience_label, draft: {title, body}, next_step: "Call show_proposal_card with these fields."}`.
3. System prompt instructs LLM: when a tool returns `{phase: "draft", proposal_id, ...}`, your NEXT tool call MUST be `show_proposal_card({type:"inline_confirm_card", proposal_id, surface, draft, preview, actions, ...})`. Do NOT verbalize the draft.
4. LLM calls `show_proposal_card(descriptor)` → stage-engine detects client-tool by name → emits `ClientToolCall` to BFF → browser renders `InlineConfirmCard`.
5. User clicks Bekreft → browser POSTs `ClientToolCallResult{result: JSON.stringify({proposal_id, action:"confirm"})}` → stage-engine resumes LLM.
6. LLM calls `publish_announcement({title, body, audience_kind, confirm: true, proposal_id})` → tool runs atomic RPC with `p_client_message_id = proposal_id` (RPC-level idempotency).
7. Emit telemetry events (in tool body, server-side per L-0233):
   - `inline_confirm_card.shown` — emitted in tool body during draft return.
   - `inline_confirm_card.confirmed` / `.cancelled` / `.edited` — emitted in tool body on commit/cancel resolution.

### Resume-Payload Trust Boundary

Only fields listed in `actions[id="edit"].editable_fields` are user-mutable on resume. All gate-relevant params (audience_kind, channel_id, capability action, workspace_id, profile_id) are re-resolved server-side per ADR-0151 + L-0177 (silent-fallback ban). The resume payload is user-controlled and untrusted for security-relevant fields.

### Visual & Motion Contract (Nordic Split)

**Token mandates (forbidden alternatives in parentheses):**

| Surface | Token | NEVER use |
|---|---|---|
| Card background | `bg-card` | `bg-zinc-*`, hardcoded color |
| Card border | `border-border` | `border-zinc-*`, hex |
| Primary text | `text-foreground` | `text-white`, `text-zinc-100` |
| Excerpt | `text-muted-foreground line-clamp-3` | hardcoded |
| Chips bg/text | `bg-muted` / `text-muted-foreground font-mono text-[10px] tracking-widest uppercase` | hardcoded |
| Destructive | `text-destructive` + `border-destructive/40` | `text-red-*` |
| Focus ring | `ring-ring ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2` | `outline-none` without ring |

Title: `text-sm font-semibold text-foreground`. **NOT `font-heading`** (Instrument Serif reserved for page H1/H2 + wizard brand panel; never inline chat content).

"FORSLAG" badge: `bg-muted text-muted-foreground font-mono text-[9px] tracking-[0.15em] uppercase rounded-sm px-1.5 py-0.5` — top-right of card header.

Card outer: `bg-card border border-border rounded-[var(--r-card)] p-4` (`--r-card` = 16px Task Manager signature radius). At `<sm` breakpoint: `p-3`.

**Motion (mandatory, NOT Framer default 300/24):**
- Entrance: `motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={spring{stiffness:35, damping:22, mass:2.2}}` (≥500ms).
- Reduced motion: `useReducedMotion()` → `{duration:0.15}` opacity-fade.
- State transitions on result: `transition-opacity transition-transform` (NEVER `transition-all`). Resolved-success = ring-2 ring-green-500/40 one-shot 300ms; cancelled = ring-2 ring-destructive/40.
- Exit: `{opacity:0, y:8}`, ≤250ms.

**Accessibility:**
- `role="region" aria-label="Forslag: ${preview.title}"` on card root.
- Container-level (BotssonChat root) single `role="status" aria-live="polite" aria-atomic="true" className="sr-only"` live-region; updated on every card mount with `Nytt forslag: ${title}. Trykk Tab.`.
- ALL buttons: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` (ghost-buttons highest regression risk).
- Tab order: Bekreft → Endre → Avbryt (happy-path-first, NOT Stripe anti-pattern). All `type="button"` (card is not inside a form).
- ESC anywhere in card → trigger Cancel (parity with `help-takeover-kit` 3-sec confirm-delay pattern).
- Touch target: 44×44 min on mobile only when chip is interactive (`recipient_preview_available: true`).

**Icons (Lucide only, no emojis):**
- `publish_announcement` → `Megaphone` (16px, `text-muted-foreground`).
- `send_message` → `MessageSquare`.
- `approve_shift` → `CalendarCheck`.
- Confirm button: no icon (label is sufficient).
- Edit button: `Pencil` 14px.
- Cancel button: NO icon (destructive should not tap-magnetize).

**Local state machine (card-internal):** `mode: "idle" | "editing" | "resolved" | "error"`. Edit mode collapses card to ~48px max-h header-only state; spawns BIR underneath via `AnimatePresence`; on BIR resolve, card re-expands with patched draft values.

### Mobile

Same React component (`InlineConfirmCard.tsx`) ported to React Native for Phase 2. NOT a native sheet/modal — fragments the conversational metaphor. Touch padding adjusts via responsive utility. Phase 1 ships web only; Phase 2 ports `approve_shift` to mobile via shared `packages/ai/` schema.

## Rules & Consequences

- **Good, because** existing roundtrip infrastructure (ADR-0327) is reused — zero new dispatch code. RPC-level idempotency via existing `p_client_message_id` — zero new persistence. BIR-sibling structural pattern — agents and developers recognize the contract immediately.
- **Good, because** symbol `ProposalCard` is banned and the cascade-domain meaning of "proposal" (C4 governance, runtime step) is preserved.
- **Bad, because** the LLM must reliably follow the 10-line system-prompt instruction to call `show_proposal_card` after every draft return. Mitigation: explicit prompt + Phase 1 test coverage with 3-turn dialog.
- **Bad, because** the BotssonChat-fixed registration sub-pattern is net-new — no prior fixed-primitive registration exists. Mitigation: documented in this ADR; pattern stabilization tracked in L-0331; cascade-integrity-mandate updated when Phase 2 ships.
- **Bad, because** Architecture A is forbidden, which closes off any future "auto-render any descriptor returned from a tool" affordance. Mitigation: if that becomes desirable, a separate ADR may amend dispatch logic — but Phase 1 does not need it.

### Agent Impact

- **Capability authors:** when adding a HITL mutation, follow `publish_announcement` Phase 1 template — `confirm: false` branch precheck-gates, generates UUID, returns `{phase: "draft", proposal_id, ...}`; LLM calls `show_proposal_card`; `confirm: true` branch passes same UUID to RPC `p_client_message_id`. Do NOT invent new ID fields.
- **System prompt maintainers:** ensure `mr-botsson.ts` contains the 10-line proposal-card instruction. After tool returns `phase: "draft"`, LLM MUST call `show_proposal_card`. Re-validate after every prompt edit.
- **UI authors:** never name a new React component `ProposalCard` — symbol is banned. Use `InlineConfirmCard` for HITL primitive; use `ChangeProposalCard` (existing) for C4 governance UI.
- **Telemetry maintainers:** registry entries `inline_confirm_card.{shown,confirmed,cancelled,edited}` MUST have emit call-sites in tool bodies (server-side, per L-0233 voice context). Listing in registry without emit = phantom contract (L-NEW-1 family). Pre-merge grep verification mandatory.
- **Stage-engine maintainers:** do NOT add result-marker interception. Client-tool dispatch stays name-keyed. If `show_proposal_card` is on the registered client-tool list, the LLM call routes correctly.
- **Mobile authors:** Phase 1 = web only. Phase 2 (`approve_shift`) ports `InlineConfirmCard` to RN with same descriptor schema from `packages/ai/`. Do NOT fork the contract.

## Phase Sequencing

- **Phase 1 (this campaign):** `publish_announcement` rework + `InlineConfirmCard` component + `show_proposal_card` client-tool + BotssonChat-fixed registration + 4 telemetry events.
- **Phase 2 (separate sortie, separate ADR):** `send_message` confirm pattern (ADR-0400, reserved).
- **Phase 2 (separate sortie, separate ADR):** `approve_shift` × `four_eyes_pending` interaction — extends `mode` enum with `awaiting_approver` (ADR-0401, reserved).

## Blocking Conditions Before Phase 1 Merge

1. `gate_action` precheck added to `publish-announcement.ts` draft branch (avoid dead-end UX).
2. Telemetry registry entries paired with emit call-sites (file:line cited in PR description).
3. `show_proposal_card` BotssonChat-fixed registration verified — NOT registered via `useRegisteredTools()`.
4. System-prompt 10-line block landed in `mr-botsson.ts` and verified via a 3-turn dialog test.

## References

- ADR-0078 (channel pinning), ADR-0099 (gate levels), ADR-0133 (mobile = execute), ADR-0151 (server-derived workspace_id), ADR-0204 (gated mutation), ADR-0238 (Botsson surface disambiguation), ADR-0327 (client-tool roundtrip), ADR-0372 (announcement RPC service-role guards), ADR-0399 (channel + platform descriptors — companion).
- Code: `packages/ai/src/capabilities/communication/publish-announcement.ts:223-254`, `packages/ai/src/primitives/input-request/types.ts:91-108`, `apps/web/src/app/Botsson/_components/BotssonChat.tsx:140-194`, `services/stage-engine/src/core/agent-router.ts:889-906`, `packages/ai/src/adapters/vercel-ai.ts:54-80`, `supabase/migrations/20260620140400_publish_announcement_atomic_rpc.sql:20,70-80`.
- Collision evidence: `apps/web/src/app/dashboard/settings/_components/ChangeProposalsPanel.tsx:50`, `apps/web/src/app/dashboard/schedule/proposed-plan/_components/ProposedPlanClient.tsx:238`.
- Learnings: L-0329 (collision-grep-globally), L-0330 (stateless-default-from-existing-uuid), L-0331 (BotssonChat-fixed sub-pattern), L-0332 (harness-builder mandatory in Phase 3 for Botsson surfaces).

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
