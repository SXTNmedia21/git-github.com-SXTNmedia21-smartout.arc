---
title: "HANDOFF — M3.2 Page Takeover Harness"
feature: m3-page-takeover
status: complete
verified_at: 2026-04-29
created: 2026-04-29
updated: 2026-04-29
module: Core
tags: [handoff, page-takeover, harness, m3, adr-0228, default-deny]
---

# HANDOFF — M3.2 Page Takeover Harness

## Summary

M3.2 ships a **default-deny page-takeover harness** for `/dashboard/help`, letting Botsson propose UI actions on the user's behalf without ever firing them silently. v1 scope is intentionally minimal: one allow-listed target (panic-bar "Jeg trenger et menneske" button), three client tools (`ui.simulate_click`, `ui.submit_form` stub, `ui.wait_for_state`), a mandatory preview overlay with 3-second confirm-delay, and a Server Action gate that re-validates capability authority on every invocation. Default authority `level='disabled'` per ADR-0228 — admin must explicitly opt in.

Voice channel is rejected at three layers (Server Action, tool kit entry, hook propose). Allow-list and `data-takeover` attributes anchor each target so unknown ids are denied before any UI surfaces.

## Audit Verdicts

### G-AUDIT — `action_executed` has matching `proposed` + `confirmed` predecessors

**PASS.** Same call-site sequencing in `usePageTakeover.ts`:

- `proposeAction` emits `page_takeover.action_proposed` AFTER gate allow returns ok — line 73 (after gate check on line 65).
- `confirmAction` requires `state === 'previewing'` (line 102), emits `action_confirmed` (line 111) BEFORE `document.querySelector` + `el.click()` (line 126/131), then emits `action_executed` (line 141) AFTER. `action_executed` cannot fire without `action_confirmed` having fired in the same closure.

### G-GATE — `gateAction` called BEFORE every execution

**PASS.**

- `pageTakeoverGateAction` calls `gateAction(...)` at `apps/web/src/app/dashboard/help/_actions/page-takeover-gate-action.ts:75` BEFORE returning `ok=true` with selector (line 92).
- `usePageTakeover.proposeAction` calls `pageTakeoverGateAction` at `apps/web/src/app/dashboard/help/_hooks/usePageTakeover.ts:65` BEFORE `setState("previewing")` at line 91.

### G-DEFAULT-DENY — authority seed defaults `level='disabled'`

**PASS.** `supabase/migrations/20260519140000_page_takeover_authority_seed.sql:35` — literal `'disabled'` in the INSERT SELECT. ON CONFLICT DO NOTHING prevents reseed override. Per ADR-0228.

### G-CHANNEL — voice forbidden

**PASS** (defense in depth, three layers):

- Server Action: `page-takeover-gate-action.ts:52-58` rejects with `voice_forbidden_for_takeover` when `channel !== 'chat'`.
- Tool kit `ui.simulate_click`: `help-takeover-kit.ts:141-147`.
- Tool kit `ui.wait_for_state`: `help-takeover-kit.ts:174-178`.
- Hook propose: `usePageTakeover.ts:65` hard-codes `channel: "chat"` to gate (defensive — the kit already rejects voice before reaching the hook).

### Invariants

- **I-1 preview before fire:** `usePageTakeover.ts:102` — `confirmAction` returns `no_active_preview` unless `stateRef.current === 'previewing'`. `el.click()` on line 131 only inside this guard. **PASS.**
- **I-2 ESC + off-target cancel:** `TakeoverPreview.tsx:91-100` (keydown ESC) + `:103-114` (click capture, contains-checks against overlay + target). **PASS.**
- **I-3 minPreviewMs ≥3000:** `TakeoverPreview.tsx:50` — `minPreviewMs = 3000` default. Confirm button `disabled={!canConfirm}` on line 153, `canConfirm = remaining === 0` on line 119. **PASS.**
- **I-4 allow-list rejection:** `takeover-targets.ts:35-37` (`isValidTakeoverTarget`) + `page-takeover-gate-action.ts:60-66` returns `unknown_target` for non-allow-listed ids. **PASS.**
- **I-5 server re-validate:** `page-takeover-gate-action.ts:43` (Zod parse) + `:75-81` (`gateAction` RPC re-checks capability authority via `engine_authority_config`). **PASS.**

### Phantom contract traces (ADR-0197)

- **4 telemetry events:** Producer `usePageTakeover.ts:73,111,141,170`. Consumer `packages/telemetry/src/registry.ts:5874-5908` (typed events) + `:8669-8684` (EVENT_ROUTING → `posthog`, `activity_trail`). **PASS.**
- **`ui.simulate_click` tool:** Producer `help-takeover-kit.ts:36-60` + `:140-163` (impl). Consumer `help-takeover-tools-bridge.tsx:33-62` (`onPropose` → `usePageTakeover.proposeAction` → state machine → `<TakeoverPreview />` render). **PASS.**
- **`data-takeover="panic_bar_human"`:** Producer `PanicBar.tsx:108,117`. Consumer `takeover-targets.ts:28` (`TAKEOVER_TARGETS.panic_bar_human_button.selector`) + Server Action capability lookup `page-takeover-gate-action.ts:68-77`. **PASS.**

### Typecheck

`pnpm turbo typecheck` — **36/36 successful, 0 errors. FULL TURBO.**

## Decisions made

- **Q1 — Modal-blocking preview.** Chose modal scrim (`bg-background/60` at z-49 + outline + chip at z-50) over non-blocking toast. Reason: the preview IS the most important UI on screen; nothing else should be reachable until the user accepts or rejects.
- **Q2 — No chaining.** Each takeover step is one user-confirmation. Botsson cannot queue "click X, then click Y" as a single confirm. v1 keeps decisions atomic.
- **Q3 — Granular per-target capability.** Capability slug is `page_takeover.<route>.<target_id>` (e.g. `page_takeover.help.panic_bar_human_button`), NOT a global `page_takeover` capability. Each new target requires its own ADR + seed migration. Cannot be sneaked in via code alone.
- **Q4 — Failure mode.** Tool returns `success: boolean` + optional `failure_reason` separately from downstream effects. `el.click()` succeeding ≠ the page having reacted. The tool reports the click attempt; agents/users observe the page reaction via `ui.wait_for_state`.
- **Q5 — ADR-0078 extended.** Voice channel forbidden for ALL mutation tools (not just PII). Page-takeover is mutation-class. Three-layer defence preserved.
- **ADR-0228 promoted to `accepted` on merge.** Default-deny per-target capability authority is the canonical pattern.

## Files changed

| Layer | Files | Commits |
|---|---|---|
| Plan + journeys | `docs/plans/PLAN-m3-page-takeover.md`, 4 × `docs/journeys/JOURNEY-m3-*.md` | `e32bc1aa` |
| ADR + seed + telemetry | `docs/decisions/0228-page-takeover-capability-default-deny.md`, `supabase/migrations/20260519140000_page_takeover_authority_seed.sql`, `packages/telemetry/src/registry.ts` | `b08d2d47` |
| Allow-list + UI + hook + Server Action | `apps/web/src/app/dashboard/help/_lib/takeover-targets.ts`, `_components/TakeoverPreview.tsx`, `_components/PanicBar.tsx` (data-takeover attr), `_hooks/usePageTakeover.ts`, `_actions/page-takeover-gate-action.ts` | `ee3ac37f` |
| Tool kit + bridge + mount + channel | `apps/web/src/app/Botsson/_components/help-takeover-kit.ts`, `_components/help-takeover-tools-bridge.tsx` | `4535e93b` |
| E2E confirm-and-execute | `apps/e2e/tests/journey-page-takeover-confirm.spec.ts` | `31e7399e` |
| E2E cancel | `apps/e2e/tests/journey-page-takeover-cancel.spec.ts` | `d8d84288` |
| E2E allow-list | `apps/e2e/tests/journey-page-takeover-allow-list.spec.ts` | `3bc08430` |
| E2E default-deny | `apps/e2e/tests/journey-page-takeover-default-deny.spec.ts` | `aab7350e` |

## Known debt

- **`ui.submit_form` is a stub.** v1 has zero allow-listed forms. Tool always returns `ok: false, reason: 'no_forms_in_v1_allowlist'`. Future PII-form takeover requires per-form ADR + four-eyes flag in seed.
- **Single target.** Only `panic_bar_human_button` is allow-listed. Each new target needs: (a) ADR justifying scope, (b) `TAKEOVER_TARGETS` entry, (c) `data-takeover` attribute on the DOM, (d) seed migration row, (e) audit pass.
- **No `window.__pageTakeover` test handle.** Full agent-driven E2E (Botsson voice → tool call → preview → confirm → click) is deferred to M3.3. Current E2E specs are structural — they verify the harness exists and the UI flows work, not the agent loop.
- **Authority opt-in UI not built.** Admin must `UPDATE engine_authority_config SET level = 'read_write' WHERE capability = 'page_takeover.help.panic_bar_human_button' AND workspace_id = ...` manually. Settings UI lives in M3.3+.
- **T15 cancel test recovered.** Initial T15 commit landed on `development` instead of the worktree branch. Recovered by reverting on dev (`b6be1c0b`) and redoing on `feat/core-module-m3-page-takeover` as `d8d84288`. No data loss; test content identical.

## Next steps

1. Close the M3.2 sub-sortie via `close-feature.sh` once this HANDOFF is on the branch. The script merges `feat/core-module-m3-page-takeover` into `campaign/core-module` and syncs `origin/development` back into the campaign.
2. Promote ADR-0228 from `proposed` to `accepted` immediately after merge (one-line frontmatter edit + register entry update).
3. Follow-up M3.3 (separate sub-sortie): admin opt-in UI for authority, full agent-driven E2E with `window.__pageTakeover` handle, second allow-listed target as a worked example for the per-target ADR pattern.

---

Audit verdicts: **G-AUDIT PASS · G-GATE PASS · G-DEFAULT-DENY PASS · G-CHANNEL PASS · I-1..I-5 PASS · Phantom contracts PASS · typecheck 36/36.**
