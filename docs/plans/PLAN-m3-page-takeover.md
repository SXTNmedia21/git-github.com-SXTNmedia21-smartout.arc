---
title: "Plan — m3-page-takeover"
feature: m3-page-takeover
spec: docs/superpowers/specs/2026-04-29-page-takeover-harness.md
status: draft
updated: 2026-04-29
created: 2026-04-29
module: Core
campaign: core-module
milestone: M3.2
risk_level: high
tags: [plan, help, botsson, takeover, page-tools, gate-action]
---

# Plan — m3-page-takeover

> Branch: `feat/core-module-m3-page-takeover` | Worktree: `/home/sxtnl/dev/smartout.ai-core-module-wt-1` | Base: `campaign/core-module` | Module: Core
>
> **HIGH RISK** sub-sortie. Voluntary mutation by AI on user's behalf. Spec front-loads safety: preview overlay + ESC cancel + gateAction at invocation + authority default-deny + allow-list only.

**Spec:** [Page-Takeover Harness (M3.2)](../superpowers/specs/2026-04-29-page-takeover-harness.md)

## Journeys (the contract)

- [JOURNEY-m3-page-takeover-confirm-and-execute](../journeys/JOURNEY-m3-page-takeover-confirm-and-execute.md) — User asks Botsson to open helpdesk ticket → Botsson previews → user confirms → click executes
- [JOURNEY-m3-page-takeover-cancel](../journeys/JOURNEY-m3-page-takeover-cancel.md) — User asks for action → Botsson previews → user presses ESC → action cancelled, no execution
- [JOURNEY-m3-page-takeover-allow-list-rejection](../journeys/JOURNEY-m3-page-takeover-allow-list-rejection.md) — Botsson tries to invoke unknown target_id → tool rejects, no preview shown
- [JOURNEY-m3-page-takeover-default-deny](../journeys/JOURNEY-m3-page-takeover-default-deny.md) — Workspace without authority opt-in → gateAction denies → tool returns ok:false, no preview shown

## Goal

Three new page-scoped client tools let Botsson perform DOM actions in a controlled way. v1 allow-list: ONE target — panic-bar "human" button on /dashboard/help. Mandatory preview + confirm. Server-side gateAction at invocation. Authority default-deny.

## Phase 1 — Capability + authority foundation (T1-T4, ~1 day)

- [ ] **T1** — ADR for new capability `page_takeover`. Discusses default-deny, granular per-target_id authority, channel restriction (chat-only). Status: proposed → accepted in HANDOFF after audit.
- [ ] **T2** — Migration: insert `engine_authority_config` seed row per workspace with capability='page_takeover.help.panic_bar_human_button', level='disabled', min_role='admin'. ON CONFLICT DO NOTHING. Idempotent CROSS JOIN over workspace.
- [ ] **T3** — Add `page_takeover` to ALLOWED_CAPABILITIES list in gateAction call sites if such a list exists. Otherwise document that capability is gateable.
- [ ] **T4** — Add new telemetry events to `packages/telemetry/src/registry.ts`:
  - `page_takeover.action_proposed` → posthog + activity_trail
  - `page_takeover.action_confirmed` → posthog + activity_trail
  - `page_takeover.action_cancelled` → posthog + activity_trail
  - `page_takeover.action_executed` → posthog + activity_trail
  - All payloads: workspaceId NonEmptyString + actorId NonEmptyString + target_id + action_type ('click' | 'submit_form' | 'wait_for_state')

## Phase 2 — Allow-list + preview UI (T5-T9, ~2 days)

- [ ] **T5** — Create `apps/web/src/app/dashboard/help/_lib/takeover-targets.ts`. Const map: `{ panic_bar_human_button: { selector: '[data-takeover="panic_bar_human"]', label: 'Klikk på "Jeg trenger et menneske"', capability: 'page_takeover.help.panic_bar_human_button' } }`. Export `TakeoverTarget` type + `isValidTakeoverTarget` guard + `resolveTakeoverTarget`.
- [ ] **T6** — Add `data-takeover="panic_bar_human"` attribute to PanicBar's "Jeg trenger et menneske" button in `apps/web/src/app/dashboard/help/_components/PanicBar.tsx`. Verify selector resolves uniquely.
- [ ] **T7** — Build `apps/web/src/app/dashboard/help/_components/TakeoverPreview.tsx` (Client Component). Modal overlay (z-50, blocks body except confirm chip). Renders: target outline + label + "Klikk for å bekrefte" button + "ESC for å avbryte" hint. Props: `{ targetSelector, label, onConfirm, onCancel, minPreviewMs }`. Confirm button DISABLED until minPreviewMs elapsed (default 3000). Lucide AlertTriangle icon. Nordic Split styling (bg-card, border-warning, focus-ring).
- [ ] **T8** — Build `apps/web/src/app/dashboard/help/_hooks/usePageTakeover.ts`. State machine: idle → previewing → executing → done | cancelled. Exposes `proposeAction(target_id)` and `confirmAction()` and `cancelAction()`. Effects: ESC keydown + off-target click both call cancelAction. Telemetry emits at each transition.
- [ ] **T9** — Server Action `apps/web/src/app/dashboard/help/_actions/page-takeover-gate-action.ts`. Inputs: `{ target_id }`. Calls gateAction(capability=resolved_capability, action='execute'). Returns `{ ok: bool, reason?: string }`. Client tool calls THIS before showing preview, so default-deny short-circuits before user sees anything.

## Phase 3 — Tool kit + bridge mount (T10-T13, ~1.5 days)

- [ ] **T10** — Create `apps/web/src/app/Botsson/_components/help-takeover-kit.ts`. Three tools registered via ClientToolKit:
  - `ui.simulate_click({ target_id })` — calls usePageTakeover.proposeAction. Returns ok+executed when user confirms, ok+cancelled when ESC.
  - `ui.submit_form({ form_id, field_values })` — v1 stub, returns `{ ok: false, reason: 'no_forms_in_v1_allowlist' }`. Wired but no actual forms allow-listed yet.
  - `ui.wait_for_state({ predicate, timeout_ms })` — v1 supports predicates: `panic_bar_drawer_open`. Returns ok+met+elapsed_ms.
- [ ] **T11** — Build `apps/web/src/app/Botsson/_components/help-takeover-tools-bridge.tsx`. Composes usePageTakeover hook + helpTakeoverKit. Calls useRegisterTools("help-takeover", kit). Renders TakeoverPreview when state==='previewing'.
- [ ] **T12** — Mount in `apps/web/src/app/dashboard/help/page.tsx`. `<HelpTakeoverToolsBridge workspaceId={...} actorId={...} />` alongside HelpVoiceToolsBridge + HelpTourToolsBridge.
- [ ] **T13** — Channel restriction: tool kit checks `ctx.channel === "chat"` at invocation. Voice channel returns `{ ok: false, reason: 'voice_forbidden_for_takeover', message: 'Bytt til chat for å gjøre dette.' }`. ADR-0078 extension.

## Phase 4 — Tests + audit (T14-T19, ~2 days)

- [ ] **T14** — E2E `apps/e2e/tests/journey-page-takeover-confirm.spec.ts`: seed admin auth + workspace authority opt-in (UPDATE engine_authority_config to level='read_write'). Inject programmatic kit invocation OR test the structural outcome (preview renders, confirm fires click).
- [ ] **T15** — E2E `apps/e2e/tests/journey-page-takeover-cancel.spec.ts`: trigger preview, press ESC, assert no execution + telemetry shows cancelled.
- [ ] **T16** — E2E `apps/e2e/tests/journey-page-takeover-allow-list.spec.ts`: invoke kit with target_id='nonexistent' → returns `{ok: false, reason: 'unknown_target'}`. No preview shown. (Test against tool kit shape since allow-list is static const.)
- [ ] **T17** — E2E `apps/e2e/tests/journey-page-takeover-default-deny.spec.ts`: workspace without authority opt-in (default level='disabled') → gateAction denies → kit returns `{ok: false, reason: 'authority_denied'}`. No preview shown.
- [ ] **T18** — Audit:
  - **G-AUDIT**: every action_executed event has matching action_proposed + action_confirmed predecessors. Trace activity_trail event order.
  - **G-GATE**: gateAction called BEFORE every executed action. Code-trace usePageTakeover.confirmAction.
  - **G-DEFAULT-DENY**: authority seed migration uses level='disabled' (not 'read_only' or 'read_write'). Grep migration.
  - **I-1..I-5**: invariants verified (preview before fire, ESC cancels, ≥3000ms preview, allow-list, server re-validate field values via gateAction).
  - **G-RO-stub**: ui.submit_form returns stub-rejection in v1 (no forms allow-listed). Verify it does NOT execute any DOM mutation when invoked.
- [ ] **T19** — `pnpm turbo typecheck` PASS. Update each journey frontmatter `status: verified` + `e2e_test:` path.

## Phase 5 — HANDOFF (T20, ~0.5 day)

- [ ] **T20** — HANDOFF in `docs/handoffs/HANDOFF-m3-page-takeover.md` with audit verdicts + ADR-page_takeover decisions captured + known debt (ui.submit_form is stub, single target only, no multi-step macros, etc.). ADR `page_takeover` flipped proposed → accepted on merge.

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for ADR-page_takeover capability
- [ ] At least one E2E test exists per journey
- [ ] G-AUDIT merge-blocker: action_executed has matching proposed + confirmed predecessors
- [ ] G-GATE merge-blocker: gateAction before every execution
- [ ] G-DEFAULT-DENY merge-blocker: authority seed defaults level='disabled'
- [ ] I-1..I-5 invariants verified (preview, ESC cancel, ≥3000ms, allow-list, server re-validate)
