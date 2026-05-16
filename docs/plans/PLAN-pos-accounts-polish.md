---
title: "Plan — pos-accounts-polish"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [plan, page-polish, ui-shell, admin, pos]
---

# Plan — pos-accounts-polish

> Branch: `feat/ui-shell-pos-accounts-polish` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-16

## Goal

Close last unpolished orphan top-segment in dashboard: `/dashboard/admin/pos-accounts`. Surface mostly green per Phase 0 recon — focus on Phase 7 (harness) + Phase 8 (site-map) + missing loading/error boundaries + parent stub run.yml for husky pre-commit gate.

## Phase 0 — Recon (DONE 2026-05-16)

- [x] 441 LoC total (page.tsx 82 + PosAccountsList.tsx 359). Lightweight.
- [x] Telemetry: events `pos.account.connected`, `pos.account.disconnected` registered + emitted via `pos_account_management` capability layer
- [x] Design tokens: 0 violations. motion tokens + glassmorphism applied
- [x] Capability exists: `packages/ai/src/capabilities/pos_account_management/` with 3 tools (list, connect, disconnect)
- [x] ADR-0244 + ADR-0288: connect/disconnect are voice-only mutations; UI tools must be READ-ONLY
- [x] ADR-0305: POS adapter pattern codified
- [x] No `useRegisterTools` in tree → Phase 7 greenfield
- [x] No site-map entry → Phase 8 greenfield
- [x] No `loading.tsx` + no `error.tsx`
- [x] Parent `admin/` has no page.tsx — degenerate container (parent stub run.yml needed)

## Scope

In scope:
- `/dashboard/admin/pos-accounts` route polish
- Parent `admin/` segment stub run.yml (husky pre-commit gate)
- Page-scoped read-only tools via `useRegisterTools("admin-pos-accounts", kit)`
- Site-map entry
- `loading.tsx` matching list shape
- `error.tsx` for network/auth failures

Out of scope:
- Disconnect button in UI (existing capability is chat-only per ADR-0288 — preserve boundary; document in handoff)
- New POS providers (Lightspeed-only per ADR-0305)
- Mobile parity (ADR-0133: admin authoring = web-only)

## Tracks

### Track A — Harness page-scope tools + site-map

- [ ] `_tools/use-pos-accounts-tools.ts` (dataRef pattern, skill §7.5.1)
- [ ] 2 read-only tools:
  - `getPosAccountsState` — count + per-account name/external_id/connected_at (no tokens)
  - `getPosActionState` — `canConnect: true`, `hasActiveAccount: boolean`, hint
- [ ] `_tools/pos-accounts-tools-bridge.tsx` — client island, scope `admin-pos-accounts` (skill §7 nested-route naming)
- [ ] Mount bridge in PosAccountsList.tsx or page.tsx
- [ ] Add entry to `apps/web/.botsson/site-map.json` (path, purpose ≤140 chars, module `Admin`, tier 3, access `["owner","admin"]`, tools verbatim, common_intents Norwegian)

### Track B — loading.tsx + error.tsx

- [ ] `loading.tsx` — skeleton matches list shape (header pulse + 3 row pulses)
- [ ] `error.tsx` — AlertCircle + back-link to `/dashboard` + retry, Norwegian copy

### Track C — run.yml

- [ ] `.claude/page-polish/dashboard-admin.run.yml` — parent stub per skill §Pre-commit polish hook scope, ref `dashboard-my-profile.run.yml`, `verified: true`
- [ ] `.claude/page-polish/dashboard-admin-pos-accounts.run.yml` — doc-only sub-route detail, `verified: true`, `mobile_parity: web_only`, tools verbatim

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exits 0 (52 → 53 entries; tools match useRegisterTools verbatim)
- [ ] 2 journeys with `feature: pos-accounts-polish` + `status: verified`
- [ ] HANDOFF written
- [ ] Husky pre-commit Phase 8 gate passes
- [ ] Code review APPROVE or APPROVE WITH CHANGES (CRITICAL/HIGH applied)

## Risks

- **Parent stub gate** — pre-commit hook applies Phase 8 check to staged files in `dashboard/admin/`. Parent stub mitigates.
- **PII** — pos_account row has `oauth_token`. NEVER include in tool response. Booleans + names only.
- **Tool-name collision** — capability tools use kebab+snake (`connect_lightspeed`). Page-scope uses camelCase `get*`. Safe.

## Next

Execute Tracks A + B in parallel (different file trees). Track C after both land. Then HANDOFF + close.
