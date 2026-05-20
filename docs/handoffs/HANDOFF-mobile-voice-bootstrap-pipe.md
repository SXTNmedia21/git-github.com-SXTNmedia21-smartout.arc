---
title: "HANDOFF — mobile-voice-bootstrap-pipe"
status: done
updated: 2026-05-20
created: 2026-05-20
module: mobile
tags: [handoff, voice, botsson, ai-fab, livekit, audit-b, design-tokens, workforce-snapshot, mmkv]
---

# HANDOFF — mobile-voice-bootstrap-pipe

**Branch:** `feat/mobile-mobile-voice-bootstrap-pipe`
**Worktree:** `/home/sxtnl/dev/smartout.ai-mobile-wt-5`
**Based on:** `campaign/mobile` (tip `a929588f9` — "feat(voice-bff): return workforce snapshot inline on cold-start + drift")
**Unique commits on this branch (since baseline):** 7 (P2-a through P2-e + audit-B HIGH cleanups + tests)
**ADRs honoured:** ADR-0107, ADR-0132, ADR-0133, ADR-0134, ADR-0135, ADR-0238, ADR-0268, ADR-0297, ADR-0298
**Status:** all P2 deliverables shipped; branch closure blocked pending campaign/mobile drift resolution (Pontus decision).

---

## Summary

This sortie closed the **P2 mobile UX layer** of the voice bootstrap pipe: the full surface that lets a mobile user reach, configure, and interact with Mr. Botsson via voice. The P1 backbone (workforce snapshot in BFF, `a929588f9`) was already merged into the baseline; P2 added the gesture entry point, settings persistence, transcript surfacing, intent-dispatch API, and first-run onboarding hint.

Five feature commits shipped in one autonomous session:

- **P2-a** — AI FAB gets a long-press handler that opens `BotssonSheet` directly, bypassing the calendar nav. Tap behaviour (calendar) is preserved per ADR-0268.
- **P2-b** — Chat Settings screen gains an AI section: voice language, interaction mode (voice / chat / auto), and a voice-enable toggle, all MMKV-persisted via `useBotssonSettingsStore`.
- **P2-c** — `BotssonSheet` wires voice transcript from `BotssonProvider` into its transcript view, replacing the previous placeholder.
- **P2-d** — `BotssonProvider` exposes `openWithIntent(intent)` API; `BotssonSheet` uses it as deviation-badge consumer entry point.
- **P2-e** — `FabHint` tooltip renders on first-run (MMKV flag `botsson-fab-hint-shown`), educating users about the long-press gesture.

Two **audit-B HIGH** cleanups also shipped: hardcoded hex literals in `PunchAnimation.tsx` and the three Swap components replaced with Nordic Split design tokens. Three decorative confetti literals remain (see Known Issues).

Alongside P2, the branch carries cherry-picked **gpt-realtime upgrade** plan + journeys (`dffb87213`, `8656738ba`) for co-location during worktree recycling — code work for that sortie stays separate.

Total diff since baseline: **+1 303 / −102** across 18 files.

---

## Commits shipped (P2 layer, since baseline `a929588f9`)

| SHA | Type | Description |
|-----|------|-------------|
| `f9f40377b` | feat | AIFab long-press opens BotssonSheet (P2-a) |
| `1dad3b366` | feat | Chat settings AI section — MMKV-persisted voice/language/mode (P2-b) |
| `a37282e90` | fix | Swap* hex literals → Nordic Split tokens (audit-B HIGH); voice transcript wire also lands here (P2-c; see Known Issues §commit collision) |
| `efdae1a4e` | feat | First-run FabHint tooltip on AI FAB (P2-e) |
| `e4c26b995` | feat | openWithIntent API on BotssonProvider (P2-d) |
| `8be06363a` | fix | PunchAnimation hex literals → design tokens (audit-B HIGH) |
| `3a82ee31e` | test | Tests for FabHint + useBotssonSettingsStore P2 deltas |

---

## Files changed (since baseline)

| File | Delta | Description |
|------|-------|-------------|
| `apps/mobile/app/(app)/(chat)/settings.tsx` | +237 | AI settings section (P2-b) |
| `apps/mobile/app/(app)/_layout.tsx` | +56 / −4 | FabHint injection + AIFab long-press wiring (P2-a, P2-e) |
| `apps/mobile/src/components/ai/BotssonSheet.tsx` | +98 / −2 | Transcript wire + openWithIntent consumer (P2-c, P2-d) |
| `apps/mobile/src/components/navigation/AIFab.tsx` | +48 / −4 | Long-press handler (P2-a) |
| `apps/mobile/src/components/navigation/FabHint.tsx` | +105 new | First-run hint tooltip (P2-e) |
| `apps/mobile/src/components/navigation/__tests__/AIFab.test.tsx` | +17 | Long-press coverage |
| `apps/mobile/src/components/navigation/__tests__/FabHint.test.tsx` | +98 new | FabHint rendering + MMKV flag |
| `apps/mobile/src/components/shift-clock/PunchAnimation.tsx` | −/+ 98 | Hex literals → design tokens (audit-B) |
| `apps/mobile/src/components/shift/SwapInboxCard.tsx` | +6 / −4 | Token replacement (audit-B) |
| `apps/mobile/src/components/shift/SwapRequestSheet.tsx` | +18 / −14 | Token replacement (audit-B) |
| `apps/mobile/src/components/shift/SwapStatusBadge.tsx` | +59 / −27 | Token replacement (audit-B) |
| `apps/mobile/src/constants/strings.ts` | +1 | FabHint hint string constant |
| `apps/mobile/src/hooks/__tests__/use-botsson-voice-session.test.ts` | +73 | State-machine coverage |
| `apps/mobile/src/hooks/stores/__tests__/use-botsson-settings-store.test.ts` | +118 new | Settings store coverage |
| `apps/mobile/src/hooks/stores/use-botsson-settings-store.ts` | +113 new | MMKV settings store (P2-b) |
| `apps/mobile/src/hooks/use-botsson-voice-session.ts` | +16 / −3 | Intent-aware session open (P2-d) |
| `apps/mobile/src/providers/__tests__/botsson-intent.test.ts` | +151 new | openWithIntent coverage (P2-d) |
| `apps/mobile/src/providers/botsson-provider.tsx` | +93 / −7 | Transcript pipe + openWithIntent API (P2-c, P2-d) |

---

## Decisions made

### D1 — AIFab long-press over tap rebinding

Long-press was chosen as the AIFab gesture for BotssonSheet rather than rebinding the tap from calendar. Tap = Kalender is locked by ADR-0268 (gesture-surface contract). Long-press adds Botsson access without disrupting the primary navigation affordance. The FabHint tooltip (P2-e) bridges the discoverability gap.

### D2 — MMKV for Botsson settings store (not AsyncStorage)

`useBotssonSettingsStore` uses MMKV via `zustand-mmkv` following the established pattern from `use-theme-store`. MMKV is synchronous and survives app restart — correct for persisted preference state. AsyncStorage would require async hydration guards and is already being phased out in the mobile codebase.

### D3 — voiceTranscript is voice-mode only in P2-c

`BotssonProvider` pipes `voiceTranscript` (string | null) into `BotssonSheet`'s transcript view, but only for voice-mode sessions. Chat-mode transcript wire is deferred: a chat-history scroll surface requires a different UI treatment (paginated, persistent) vs the ephemeral voice transcript bar. Flagged in P2-c as `// TODO(P3): chat transcript pagination`.

### D4 — No new ADR drafted for P2 layer

All P2 changes fit within existing ADR boundaries:

- AIFab long-press: ADR-0298 (gesture surface contract)
- BotssonSheet voice entry: ADR-0238 (domain chat ownership — Orb passive when domain chat active, not inversely affected)
- MMKV settings: ADR-0133 (mobile boundary — local preference state, no web authoring)
- openWithIntent API: ADR-0107 (BotssonProvider API contract) + ADR-0132 (mobile thin client, intent signal only)
- FabHint: ADR-0134 (telemetry contract — hint-shown event emitted via `emit()`)

A new ADR slot was not claimed. If the gesture surface contract is extended further, a dedicated ADR under ADR-0298 amendment or a new slot is appropriate.

---

## Learnings

- **`a37282e90` commit collision (P2-c + audit-B Swap)** — Sub-orchestrators C (transcript wire) and D (Swap token sweep) ran in parallel and both staged before the pre-commit hook ran. The resulting commit contains both slices; the message reflects D's scope only (Swap audit-B). Content is correct. Next time: serial staging when two sub-orchestrators touch overlapping files, or explicit commit-per-slice after each sub-agent returns.
- **MMKV zustand-mmkv pattern is established** — `use-theme-store` is the canonical reference. Any new mobile preference store should follow the same shape: `createJSONStorage(() => zustandStorage)` with an explicit `partialize` if only a subset of state is persisted.
- **FabHint MMKV flag naming** — Key `botsson-fab-hint-shown` (hyphen-separated, prefixed with feature name). Consistent with existing MMKV key conventions in the codebase (`theme-preference`, `onboarding-complete`).

---

## Known issues / debt

| # | Issue | Severity | Blocker? |
|---|-------|----------|----------|
| 1 | 3 decorative confetti hex literals remain in `PunchAnimation.tsx`: warm-yellow `#ffd93d`, periwinkle `#5b9bd5`, coral-red `#ff6b6b`. Marked `// TODO(nordic-split): no token equivalent yet`. No design token maps to festive confetti palette. Needs design decision before token mapping. | LOW | No |
| 2 | 4 `supabase as any` casts in ApprovalCard, `use-active-time-entry`, `useShiftNotes` (2×). Pre-existing audit-B HIGH; not in this sortie's scope. Blocked on schema-gen (column additions not yet in `database.types.ts`). | MEDIUM | No |
| 3 | Mobile error boundary coverage: only payroll route has an error boundary. All other mobile routes expose unhandled render crashes to the root. ADR-grade architectural decision deferred to dedicated sortie. | MEDIUM | No |
| 4 | P2-c transcript flow has state-machine tests only, no integration render test. `BotssonSheet` render with a live `voiceTranscript` prop is not covered. | LOW | No |
| 5 | Branch is 619+ commits behind `origin/development` (campaign/mobile drift). `close-feature.sh` will hit merge conflicts. Requires campaign recovery sortie (Pontus decision) before closure can proceed. | HIGH | **Yes — blocks `close-feature`** |
| 6 | `a37282e90` commit message only references audit-B Swap sweep; P2-c transcript wire is also in this commit (see Learnings §commit collision). Git blame on `BotssonSheet.tsx` / `botsson-provider.tsx` transcript lines will point to `a37282e90` with misleading subject. | INFO | No |

---

## Closure readiness

| Gate | Status |
|------|--------|
| Plan (`PLAN-mobile-voice-bootstrap-pipe.md`) | DONE |
| Journeys (3 × `JOURNEY-mobile-voice-bootstrap-pipe-*.md`) | DONE |
| Handoff (this file) | DONE |
| Tests (`pnpm turbo typecheck` + new test files) | DONE (typecheck green at time of last commit) |
| Decision log entries | N/A — no new ADRs (D4 above) |
| campaign/mobile drift | **PENDING — Pontus decision** |

Once campaign drift is resolved: run `close-feature.sh` from the worktree root. All gates will pass. The merge will be to `campaign/mobile`, not directly to `development`.

---

## Next steps

1. **Campaign/mobile recovery** — Pontus to decide timeline + method (rebase vs merge-commit from tip). After recovery, this branch can close cleanly.
2. **close-feature** — After campaign recovery: `./infra/scripts/close-feature.sh` from `smartout.ai-mobile-wt-5`.
3. **P3 voice work** — chat-mode transcript wire, image-input flag scaffold, async function-call smoke (per `JOURNEY-voice-gpt-realtime-upgrade-*` set on `feat/voice-gpt-realtime-upgrade`).
4. **Confetti token design decision** — Three warm/periwinkle/coral confetti colours in PunchAnimation need a design token or explicit "no-token, inline-ok" carve-out in the Nordic Split ADR.
5. **Mobile error boundary ADR** — Draft ADR for per-route error boundary requirement on mobile; schedule dedicated sortie.

---

## Co-located planning artifacts (not this sortie's code)

The branch also carries planning-only commits for the gpt-realtime upgrade:

| SHA | What |
|-----|------|
| `dffb87213` | `docs(voice): spec stub for gpt-realtime upgrade sortie` |
| `8656738ba` | `docs(voice-gpt-realtime-upgrade): declare plan + 5 journeys` |

These were cherry-picked from `feat/voice-gpt-realtime-upgrade` (worktree wt-4) for co-location during recycling. The code work for gpt-realtime is a separate sortie.
