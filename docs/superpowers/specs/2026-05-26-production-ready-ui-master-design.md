---
title: "Production-Ready UI Master Plan — Web + Mobile"
status: draft
updated: 2026-05-26
created: 2026-05-26
module: meta
tags: [production-ready, ui, polish, audit, web, mobile, orchestration]
---

# Production-Ready UI — Master Execution Spec

> **Goal (Pontus 2026-05-26):** "Smartout ai have production ready UI in both mobile and web."
>
> **Scope locked:** Funksjonell ferdigstilling × alle dashboard-sider. ~8–10 sortier estimate.

---

## 1. Mandate

Close every UI gap on web + mobile so Smartout can present to a real customer without apologies. "Production-ready" means:

1. **Functionally complete** — no placeholders, stubs, hardcoded mock state, or "Implementeres i Task N" comments visible to users.
2. **Security-clean** — no RLS bypass, no ADR-0151 forgeable IDs, no missing role gates.
3. **Visually consistent** — Nordic Split design tokens everywhere, zero hardcoded color literals, OKLCH ban respected (ADR-0366).
4. **Internationalized** — every user-facing string via `t()`, no hardcoded Norwegian.
5. **Telemetric** — every mutation calls `emit()`; every page-level surface emits view event.
6. **ADR-compliant** — ADR-0133 mobile surface boundary, ADR-0134 mobile telemetry contract, ADR-0136 camera evidence, ADR-0151 server-derived workspace_id, ADR-0204 mutateWithGate pattern.

Out of scope:
- New features (event entity ADR-0426, helpdesk Phase 2, etc.)
- Cascade Phase F adapters (Tripletex)
- Build-perf Wave 2/3

---

## 2. Backlog (from 4-agent audit 2026-05-26)

### 2.1 Surface inventory

| Surface | Total | Polished | Half-stub | Broken-visual | ADR-leaking | Redirect |
|---|---|---|---|---|---|---|
| Web (`apps/web/src/app/dashboard/`) | 89 | 30 | 42 | 8 | — | 9 |
| Mobile (`apps/mobile/app/`) | 68 | 18 | 34 | 1 | 2 | — |
| **Total** | **157** | **48** | **76** | **9** | **2** | **9** |

### 2.2 P0 — Production-blocking

| ID | Item | File | Severity |
|---|---|---|---|
| A | Service-role RLS bypass on customer website editor | `apps/web/src/app/dashboard/website/pages/[pageId]/page.tsx` | SECURITY |
| B | Shift-create authoring on mobile, no role gate (ADR-0133 violation) | `apps/mobile/app/(app)/(shifts)/create.tsx` | SECURITY |
| C | LeaderOverviewPlaceholder visible in shift-clock production | `apps/web/src/app/dashboard/shift-clock/page.tsx` | FUNCTIONAL |
| D | `COMPLIANCE = 94` hardcoded, no real DB queries | `apps/mobile/app/(app)/(home)/hms.tsx` | FUNCTIONAL |
| E | Explicit placeholder data per header comment | `apps/mobile/app/(app)/(home)/training.tsx` | FUNCTIONAL |
| F | 5 tier components return `null` until Tasks 9–14 land | `apps/web/src/app/dashboard/help/**` | FUNCTIONAL |
| G | "Holding placeholder with no active chat textbox" | `apps/web/src/app/dashboard/onboarding-assistant/**` | FUNCTIONAL |
| H | Camera buttons fire `Haptics.selectionAsync()` only — no capture | `apps/mobile/app/(app)/(home)/deviation.tsx` + `safety-round.tsx` | ADR-0136 |
| I | Biometric C4 confirm: zero `expo-local-authentication` references | `apps/mobile/` repo-wide | ADR-0133 |
| J | Hex literal `#7a756e` shipped in dev-only screen | `apps/mobile/app/(app)/(me)/design-preview.tsx` | ADR-0366 |

### 2.3 P1 — Cross-cutting sweeps

| ID | Item | Count |
|---|---|---|
| K | Hardcoded Tailwind color literals (zinc-/slate-/gray-/amber-/blue-/red-/indigo-) | ~30 files |
| L | Hardcoded Norwegian strings — needs `t()` keys | 154 hits |
| M | Governance `use-governance-mutations.ts` missing `emit()` wires | 7 sites |
| N | Mobile screen-level view emits missing | 34 screens |
| O | Pages without sibling `loading.tsx` (leaf routes; parents cascade ok) | 33 routes |
| P | Payroll telemetry event `payroll.tariff_view_loaded` not in registry | 1 missing entry |

### 2.4 P1 — Sim closures (UI-touching subset of 28 bugs + 47 gaps from 2026-05-25)

| ID | Item | Source |
|---|---|---|
| Q | B12 — replace `PlaceholderForm` with `ChecklistView` / `ConfirmationForm` / `ProcedureForm` / `GenericTaskForm` | sim GAPS.md:112 |
| R | B14 — mount `AnnouncementKindPicker` + `kind` field | sim GAPS.md |
| S | B05 — wire `supplement_rule` into shift modal as read-only cost panel | sim GAPS.md:56 |
| T | B01 — replacement suggestion UI on absence (readiness + OT-risk + availability + distance) | sim GAPS.md:24,572 |
| U | B15 — home widget + mobile bulletin layout | sim GAPS.md |
| V | B16 — convert 15-s polling to WebSocket for realtime SLA badge | sim GAPS.md |

### 2.5 Blocked — defer until upstream ADR resolved

- H01/H04/H07/H08 — event entity (waits on ADR-0426 collision with ADR-0367 tri-layer D6 model)
- ADR-0204 Pathway B remaining 2 contract tools — external fetch(), Pathway B doesn't strictly apply

---

## 3. Execution Plan — Batched-Parallel Waves

> **Trade-off:** User chose "P0 in parallel, dump all at once." Honest pushback per CLAUDE.md feedback: WSL2 OOM endemic (L-0316, ADR-0412, 5 OOMs last week) + sub-agent commit-collision (memory L-0316) + cross-file conflict risk make a literal 15-way parallel dispatch high-risk. Counter-proposal: **batched parallel** — N concurrent agents per wave, gated on completion, security wave first.
>
> Pontus can override at spec review.

### Wave A — Security (parallel × 2)
Concurrent dispatch:
- **Sortie A1** (new wt, sonnet) — Fix P0-A service-role bypass via Server Action or workspace-api gateway route. Load skills: `secrets-protocol`, `smartout-edge-function-guide`, `smartout-database-guide`.
- **Sortie A2** (new wt, sonnet) — Add role gate to P0-B `shifts/create.tsx`. Either gate to `manager|admin|owner` with ADR carve-out, or remove screen entirely and redirect to web. Load skills: ADR-0133 in CLAUDE.md, mobile telemetry contract ADR-0134.

Gate: both merged to development before Wave B.

### Wave B — Functional stubs (parallel × 3)
Concurrent dispatch:
- **Sortie B1** (new wt, sonnet) — P0-C shift-clock LeaderOverview real implementation (query active session count + manager-visible task aggregates).
- **Sortie B2** (in `~/dev/smartout.ai-mobile`, sonnet) — P0-D `hms.tsx` real KPI queries + P0-E `training.tsx` wire to `protocol_assignment` + `knowledge_test`. Together since same campaign.
- **Sortie B3** (new wt, sonnet) — P0-F help page 5 tier components + P0-G onboarding-assistant chat surface wiring.

Gate: 3 merged before Wave C.

### Wave C — Mobile-native superpowers (parallel × 2)
Concurrent dispatch in `~/dev/smartout.ai-mobile`:
- **Sub-sortie C1** (sonnet) — P0-H camera evidence via `expo-camera` + `launchCameraAsync` on `deviation.tsx` + `safety-round.tsx`. Per ADR-0136.
- **Sub-sortie C2** (sonnet) — P0-I biometric C4 via `expo-local-authentication`, gate at `proposed-plan.tsx` accept/reject. Per ADR-0133.

Also direct commit in mobile campaign: P0-J `design-preview.tsx` hex → OKLCH token (trivial, ~5 min, no sortie needed).

Gate: 2 merged + `design-preview` fixed before Wave D.

### Wave D — Cross-cutting sweeps (parallel × 3)
Concurrent dispatch:
- **Sortie D1** (new wt, haiku — pure pattern-replacement at volume) — P1-K hardcoded color sweep. Find + replace tailwind literals with CSS vars. Per `smartout-nordic-split` rules.
- **Sortie D2** (new wt, sonnet — needs `t()` key invention + i18n bundle updates) — P1-L hardcoded Norwegian sweep. Add keys to nb + en bundles.
- **Sortie D3** (new wt, sonnet) — P1-M governance emit wires (7) + P1-N mobile screen-level view emits (~34 mechanical) + P1-P registry missing entry. Batch since all telemetry-class.

Gate: all 3 merged before Wave E.

### Wave E — Sim UI closures (parallel × 3)
Concurrent dispatch:
- **Sortie E1** (new wt, sonnet) — Q (hook forms) + R (announcement picker). Both governance-adjacent.
- **Sortie E2** (new wt, sonnet) — S (tariff floor in shift modal) + T (replacement suggestion UI).
- **Sortie E3** (new wt, sonnet) — U (home widget) + V (realtime SLA WebSocket).

P1-O loading.tsx sweep folded into whichever sortie touches each page; not a dedicated wave.

Gate: all 3 merged before Wave F.

### Wave F — Verify + ship
- E2E Playwright across critical paths + mobile Maestro per ADR-0133 verbs.
- `/audit` smoke run — should be green.
- `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh` — HOP A.
- Pontus opens HOP B preview→main PR with `preview-to-main.md` template.

---

## 4. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| WSL2 OOM during pre-push typecheck | HIGH (5+ this week) | `TURBO_CONCURRENCY=1`; pre-flight `free -h` gate already in close-feature.sh (`c33c1437c`); free RAM between waves |
| Sub-agent commit-collision (same files staged) | MEDIUM | Worktree isolation per sortie; verify physical worktree exists before dispatch (L-0316) |
| Build-agent reports "done" but leaves uncommitted work | MEDIUM | Master verifies `git log --oneline <base>..<branch>` has commits before merge (L from 2026-05-18) |
| Hardcoded color sweep regresses i18n sweep (concurrent edits) | MEDIUM | Wave D sortier serialized via different file scopes; or use Python regex pair-per-line union (proven pattern 2026-05-18) |
| `intent-classifier` enum lag on new capabilities | LOW (no new caps in this plan) | N/A — this plan is UI polish, not capability additions |
| Campaign worktrees 188+ behind dev | HIGH | `/sync-campaign` campaign/mobile + campaign/ui-shell-followup before Wave C |

---

## 5. AI Council Escalation Rules

Per user mandate: escalate to council when (any of):

1. Wave-A security fix requires schema change → council before applying migration.
2. ADR-0133 carve-out needed for `shifts/create.tsx` on mobile → council; alternative is full removal.
3. Biometric C4 implementation creates new authority class → council on `engine_authority_config` shape.
4. Sub-agent disagreement on color-token mapping (e.g. `amber-500` vs `--warning-foreground`).
5. Confidence < 70% on any P0 root cause.

Council composition default (per `/run-council` skill): steward + supervisor + code-reviewer + frontend-designer (4-axis per L-0147 + HMS R1 PM 2026-05-17 precedent).

---

## 6. Success Criteria

Spec is satisfied when ALL of:

- [ ] 10 P0 items closed; spot-check by `grep` (no `placeholder`, `Implementeres i Task`, `COMPLIANCE = 94` markers remain in user-facing surfaces).
- [ ] P1-K count `grep -rE "(zinc|slate|gray|amber-[0-9]|blue-[0-9]|red-[0-9]|indigo-[0-9])" apps/web/src/app/dashboard apps/mobile/app | wc -l` ≤ 5 (print-template carve-outs).
- [ ] P1-L count of hardcoded NO strings (per scanner heuristic) ≤ 20 (reasonable residual for technical content).
- [ ] Governance `use-governance-mutations.ts` has 7 `emit()` call-sites (1 per TODO).
- [ ] Mobile screen audit re-run shows ≤ 5 screens missing view-emit (down from 34).
- [ ] `/audit` smoke green; no new HIGH findings.
- [ ] Playwright E2E green for critical paths: login, dashboard, schedule, oppgaver, profile, onboarding, shift-clock.
- [ ] Production smoke probe green post-promote.

---

## 7. Open Questions for Spec Review

1. **Sortie pool capacity** — Wave A+B+D+E together create ~11 worktrees. Sortie pool is wt-1..wt-15 + wt-20. OK, but does Pontus want a hard cap on concurrent worktrees per wave?
2. **Wave gating** — Strict gates between waves (current draft) or rolling start (next wave begins when prior wave has N/M complete)?
3. **B0 `proposed-plan` migration v2** — already known recon-wizard-v2 work; do we fold it in here or leave deferred?
4. **`/dashboard/help` 5 components** — does Pontus want these implemented for real, or stripped (page removed from nav until ready)?
5. **Mobile `shifts/create.tsx`** — role-gate carve-out OR remove entirely? My recommendation: remove + redirect, since ADR-0133 says "web composes, mobile executes."

---

## 8. Next Actions (sequenced post-approval)

1. **User reviews this spec.** Resolve open questions §7.
2. Switch main repo `preview → development` (requires user consent per CLAUDE.md).
3. Commit this spec on `development`.
4. `/sync-campaign` for `campaign/mobile` and `campaign/ui-shell-followup`.
5. Dispatch Wave A — 2 concurrent sortier.
6. Iterate through B → F.

Spec drives execution. Each wave gets a short delta-doc (`docs/work/<date>-wave-<X>-results.md`) summarizing what each sortie shipped, what blocked, and any council outputs. Final Wave F closure produces standard `docs/HANDOFF-production-ready-ui.md`.
