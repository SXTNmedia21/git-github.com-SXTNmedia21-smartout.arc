---
title: "Handoff — payroll-tariff-capability-tools"
status: done
updated: 2026-05-17
created: 2026-05-17
module: MODULE_AGENT_SDK
tags: [handoff, payroll, tariff, delegation, adr-0356, phase-7f]
---

# Handoff — payroll-tariff-capability-tools

> Phase 7f sortie close. Ships 3 payroll capability tools wrapping cascade delegation surface.

## Summary

Phase 7f adds 3 payroll-namespace tools that consume the cascade delegation surface shipped in Sortie 3:

| Tool | Cascade delegate | Purpose |
|---|---|---|
| `payroll.setup_workspace_tariff` | `cascade.bind_workspace_union` (BOOTSTRAP) | First-time tariff binding (onboarding wizard, admin bootstrap) |
| `payroll.change_workspace_tariff` | `cascade.bind_workspace_union` (UP / MATERIAL) | Switch law_version or union affiliation |
| `payroll.add_supplement_override` | `cascade.add_supplement_rule` | Workspace-specific tillegg above tariff floor |

All 3 implement ADR-0356 audit-symmetry: both layers emit, each names its own capability as `actor_capability` and the other as `delegated_via`.

## Decisions

1. **Extend existing payroll capability, not new capability.** Per ADR-0173, payroll is one of frozen-4 delegators. Adding tools to existing `payrollCapability` definition; no new capability registration.
2. **Use `BOOTSTRAP` not `INITIAL_BINDING` amendment_classifier.** Cascade schema accepts `BOOTSTRAP | UP | MATERIAL | ENDRINGSOPPSIGELSE | BOOTSTRAP-BACKFILL`. Plan's `INITIAL_BINDING` was not in the cascade enum; `BOOTSTRAP` is semantically equivalent for first-time binding. Payroll-layer emit captures original intent in `official_effective_date` field.
3. **`add_supplement_override` delegates entirely, no second gate.** Cascade tool + DB tariff-floor TRIGGER enforce business rule. Single gate per namespace per ADR-0356 §"Gate convention". Payroll-side gate only authorizes the delegation itself (manager OR admin), not the floor check.
4. **`change_workspace_tariff` never sends `ENDRINGSOPPSIGELSE`.** Payroll tool classifies as `UP` (same union, new version) or `MATERIAL` (different union). `ENDRINGSOPPSIGELSE` is cascade-layer-only (full amendment classifier logic deferred to separate sortie per ADR-0356).
5. **No ADR-0112 enum change.** Payroll already enumerated. Verified: lint passes with 0 errors.

## Learnings

1. **L-worktree-pnpm-symlinks recurring trap.** Stop-hooks fired multiple times during agent edit operations with "This is not the tsc command you are looking for" + `node_modules missing` warnings. Worktree per-package `npx tsc` fails when pnpm symlinks not yet hydrated; turbo full-monorepo runs hydrate via dependency graph and succeed. Independent verification via `pnpm turbo typecheck --force` confirmed clean. Sibling pattern to `learning_worktree_missing_pnpm_symlinks.md` (2026-05-13). Already-documented; no new memory needed.

2. **Audit-symmetry interface field discipline.** Both `actor_capability` AND `delegated_via` are LOAD-BEARING in emit payloads AND interface definitions. Code-reviewer verification grep on both fields caught Sortie 3 C-1 (missing `actor_capability`) and would catch any future drift. Pattern: when adding delegated emit interfaces, write `actor_capability: string` and `delegated_via: string` as REQUIRED (not optional) on the interface to force compile-time enforcement.

## Verification

| Gate | Result |
|---|---|
| Typecheck (`@smartout/ai` + `@smartout/telemetry` force) | 8/8 PASS |
| Tests (`@smartout/ai` force) | 7/7 task runs, 594 tests PASS, 0 fail, 6 skipped |
| Lint (`@smartout/ai`, ADR-0112 enum check) | 0 errors, 172 warnings (pre-existing) |
| Code-review (sonnet, feature-dev:code-reviewer) | APPROVE NO BLOCKERS — 11/11 checks PASS |
| Migration self-test | PASS — 3 gate_action rows seeded |

## Commit chain

```
4f1a36cf2 feat(payroll): authority seed migration 20260619100000
ec5201394 feat(payroll): tariff capability tools per ADR-0356 delegation
a19b8e94c docs(plan): Phase 7f payroll tariff capability tools
bfcdfc6b5 feat(merge): feat/payroll-cascade-delegation-tools into campaign/payroll  ← Sortie 3 base
```

## Files

**Created:**
- `packages/ai/src/capabilities/payroll/tariff-tools.ts` — 3 tools (~900 LOC)
- `packages/ai/src/capabilities/payroll/__tests__/tariff-tools.test.ts` — 10 unit tests (T1–T10)
- `supabase/migrations/20260619100000_payroll_tariff_tools_authority_seed.sql` — 3 gate_action rows + DO-block self-test

**Modified:**
- `packages/ai/src/capabilities/payroll/tools.ts` — re-export tariff tools
- `packages/ai/src/capabilities/payroll/index.ts` — register in suggestTools
- `packages/telemetry/src/registry.ts` — 3 interfaces, 3 EventCategory entries, 3 EntityType entries, SmartoutEvent union, EVENT_ROUTING

## Known issues / debt

- None blocking. Lint warnings (172) all pre-existing — sweep belongs to its own sortie per L-0202 sibling-cleanup pattern.

## Next steps (out of scope this sortie)

1. **Phase 7e bridge code** — `lovsen-client.ts` + `apps/web/src/app/api/payroll/tariff/**` BFF routes consuming these capability tools from web UI
2. **Onboarding wizard "Tariff" step UI** — `apps/web/src/app/onboarding/_components/TariffStep.tsx` calls `setup_workspace_tariff` via BFF
3. **Admin tariff management UI** — `apps/web/src/app/dashboard/payroll/tariff/page.tsx` for change + override workflows
4. **Mobile read-only "Min tariff" surface** — `apps/mobile/app/(me)/tariff.tsx` per ADR-0133 (employees see what's bound but cannot author)
5. **Amendment-classifier sortie** — full ENDRINGSOPPSIGELSE detection logic (Aml. §14-6 material-change rules) currently stubbed in cascade layer
6. **Lovsen agent integration** — when user asks "krever det ny signering?" lovsen consults amendment-classifier before invoking change_workspace_tariff

## ADR references

- ADR-0356 — Cascade-namespace delegation pattern (Sortie 1)
- ADR-0355 — workspace_union_binding lifecycle + cache trigger (Sortie 1)
- ADR-0351 — Tariff-floor TRIGGER on public.supplement_rule (amended Sortie 1)
- ADR-0173 — Frozen-4 capability boundaries (payroll = delegator)
- ADR-0204 — gatedMutation per-tool authority
- ADR-0152 — Structured error envelope
- ADR-0151 — Server-side workspace_id derivation (forgery defense)
- ADR-0078 — Channel guards (chat-only for PII-adjacent payroll)
- ADR-0112 — Intent classifier coverage (no drift this sortie)
- ADR-0250 — Dynamic supplement framework
- L-0176 — Docstring discipline (body-first then JSDoc)
- L-0177 — Fail-fast on missing workspace_id/profile_id
