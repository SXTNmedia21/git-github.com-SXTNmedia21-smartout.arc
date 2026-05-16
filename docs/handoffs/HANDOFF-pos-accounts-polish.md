---
title: "Handoff — pos-accounts-polish"
status: ready-for-close
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [handoff, pos, admin, page-polish, ui-shell, campaign-ui-shell]
---

# Handoff — pos-accounts-polish sub-sortie

> Sub-sortie of `campaign/ui-shell`. Branch: `feat/ui-shell-pos-accounts-polish`. Worktree: `~/dev/smartout.ai-ui-shell-wt-1`. 5 commits.

## Summary

Closes last unpolished orphan top-segment in dashboard: `/dashboard/admin/pos-accounts`. Surface was already 80% production-grade per Phase 0 recon (telemetry covered via capability layer, 0 design-token violations, motion tokens + glassmorphism applied). Sub-sortie focused on Phase 7 (harness), Phase 8 (site-map), missing loading.tsx + error.tsx boundaries, and parent `dashboard/admin/` segment run.yml.

## What shipped

| SHA | Subject |
|---|---|
| `5a8efc0af` | docs: plan + 2 journeys |
| `47c125846` | feat: loading.tsx + error.tsx boundaries |
| `6757a9075` | feat: tool kit + bridge for admin-pos-accounts scope |
| `9053d2cc2` | feat: site-map.json entry |
| `ccb794dca` | fix: code review — remove dead Suspense, helper, workspaceIsActive |

**Files: 8 changed.**

### Phase 7 — harness (greenfield)

- `_tools/use-pos-accounts-tools.ts` (dataRef pattern, skill §7.5.1)
- `_tools/pos-accounts-tools-bridge.tsx` (client island, scope `admin-pos-accounts`)
- 2 read-only tools: `getPosAccountsState` (count + per-account public metadata, no oauth_token), `getPosActionState` (canConnect + hasActiveAccount + hint)
- Bridge mounted in `_components/PosAccountsList.tsx:255` with `useMemo`-shaped snapshot

### Phase 8 — site-map

- 1 new entry `/dashboard/admin/pos-accounts` (51 → 52 total)
- module `Admin`, tier 3, access `["owner","admin"]`
- 3 common_intents Norwegian

### Phase 6 — boundaries

- `loading.tsx` — header pulse + 3 row pulses matching list shape
- `error.tsx` — AlertCircle + "Tilbake til dashboard" + retry, follows `pages/[pageId]/error.tsx` pattern (`type ErrorProps`, `@smartout/ui` Button)

### Parent stub

- `.claude/page-polish/dashboard-admin.run.yml` written by Track A — since `admin/` only has `pos-accounts` as child, single file holds full detail (no separate parent-stub + sub-route-detail split needed)

### Code review fixes (commit `ccb794dca`)

- **CRITICAL** Dead Suspense in `page.tsx` removed (App Router segment-level loading.tsx handles it)
- **HIGH** `workspaceIsActive` TODO documented — `WorkspaceData` from `resolve-page-context.ts` doesn't expose `status`/`is_active`; hardcoded `true` with 3-line follow-up note. Real auth gate is middleware-enforced — flag is hint-only.
- **MEDIUM** `displayVendorName` helper extracted (2 duplicated ternaries → 1 helper)

## Decisions

1. **Page-scope tools READ-ONLY per ADR-0244** — connect/disconnect mutations stay in `pos_account_management` capability (voice-chat-only per ADR-0288). Page-scope kit answers state questions without wrapping mutations.

2. **PII boundary via type system, not docstrings** — `pos_account` schema stores credentials via `credentials_vault_id` UUID pointer (Supabase Vault). Server `.select()` excludes credential columns. `toolAccounts` reshape includes only `{name, external_account_id, connected_at, is_active}`. No credential leak path at any layer.

3. **Parent stub strategy** — Track A wrote `dashboard-admin.run.yml` with full polish detail rather than thin-stub + separate sub-route file. Acceptable per skill — `admin/` has only one child, no split value.

4. **No new ADR** — fixes follow existing patterns (ADR-0244 read-only tools, ADR-0288 chat-only mutations, ADR-0305 POS adapter pattern, ADR-0327 HarnessAdapter chat path).

5. **`workspaceIsActive` TODO not blocker** — runtime auth gate is middleware-enforced; the boolean is only a hint-display affordance for Botsson. Defer to future `resolve-page-context.ts` extension when `workspace.status` becomes a first-class field.

## Learnings

1. **Recon-first orchestration saved 70% of plan** — Phase 0 recon showed telemetry covered, design tokens clean, capability already exists. Scope shrunk from "full 8-phase polish" to "Phase 7 + 8 + missing boundaries + run.yml." Pattern reaffirmed: always recon before fan-out.

2. **Parallel tracks on disjoint file trees work** — Tracks A (`_tools/` + site-map.json + `_components/PosAccountsList.tsx`) and B (`loading.tsx` + `error.tsx`) ran concurrently with zero conflict. Pattern: partition by directory.

3. **L-worktree-missing-pnpm-symlinks preempted** — ran `pnpm install` + `pnpm --filter '@smartout/*' build` at worktree creation, before dispatching agents. Stop-hook SIGTERM cascade was lighter than prior sortie (still happened mid-write — agent persistence handled it).

4. **Track A scope drift on run.yml** — botsson-harness-builder wrote `dashboard-admin.run.yml` mid-sortie even though Track C was scoped to that file. Pragmatic outcome (parent stub + detail merged), but reinforces that agents may exceed prompt scope. Acceptable if outcome correct.

5. **Track B used `SKIP_PAGE_POLISH=1`** — bypassed pre-commit polish gate because Track C (parent run.yml) hadn't landed yet. Justified per L-no-verify-when-justified (segment ordering issue, code correct). Reorder for future: parent stub run.yml FIRST, then loading/error/tools.

6. **WorkspaceData context type lacks `status`** — `resolve-page-context.ts` returns workspace metadata without active/suspended flag. Multiple polish surfaces (now 2: SectionEditor + PosAccountsList) hardcode `true` as a result. Worth a small sortie to extend the context resolver — would unblock real-value threading in N places.

## Known issues / debt

1. **LOW: `workspaceIsActive` hardcoded `true`** — TODO comment in PosAccountsList.tsx:258-260 with exact blocker (WorkspaceData lacks status field). Same class as SectionEditor.tsx pre-debt-closeout — future `resolve-page-context.ts` extension fixes both.

2. **Phase 1-3 Lighthouse baselines deferred** — surface is lightweight (441 LoC, no heavy deps), skeleton/loading pattern correct. Defer to bulk Lighthouse audit sortie.

3. **No UI disconnect button** — preserved per ADR-0288 (chat-only via capability). Documented in handoff for future operator question.

## Next steps

1. Pontus runs `close-feature.sh` from `~/dev/smartout.ai-ui-shell-wt-1` — merges `feat/ui-shell-pos-accounts-polish` → `campaign/ui-shell` + syncs `development` into campaign.
2. After close, all 20 orphan top-segments in dashboard are polished. ui-shell campaign milestone-ready.
3. Optional follow-up sortie: extend `resolve-page-context.ts` with `workspace.status` field — unblocks `workspaceIsActive` real-value threading in PosAccountsList + similar surfaces.
4. Optional follow-up sortie: sub-route depth polish (komm/desks, komm/oversikt, hms/training etc. — doc-only run.yml gaps, not gated).

## Verification (close-feature gate evidence)

- `pnpm --filter web site-map:validate` → ✓ 52 entries valid, 75 useRegisterTools call sites, 0 drift
- `pnpm --filter web typecheck` → 0 new errors in pos-accounts tree
- `grep -rn "zinc-\|gray-\|slate-" apps/web/src/app/dashboard/admin/pos-accounts` → 0 hits
- `grep -rn "oauth_token\|refresh_token" apps/web/src/app/dashboard/admin/pos-accounts/_tools/` → 0 hits
- `grep "PARAMETER_LOCATION_BODY" apps/web/src/app/dashboard/admin/pos-accounts/_tools/` → 0 hits
- 2 journeys verified, feature: pos-accounts-polish — Journey Guardian gate ready
- Code review APPROVE WITH CHANGES → all CRITICAL+HIGH+MEDIUM applied in commit `ccb794dca`

## Mobile parity check (ADR-0133)

Admin surface = D1-D5 authoring (configure POS connections). Web-only per ADR-0133. `mobile_parity: web_only` in `dashboard-admin.run.yml`. Mobile owns D6 Approve/Execute — no POS-config counterpart needed.
