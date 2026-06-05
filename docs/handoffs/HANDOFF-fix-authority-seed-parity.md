---
title: "Handoff — Fix Authority Seed Parity"
feature: fix-authority-seed-parity
branch: feat/fix-authority-seed-parity
closed: 2026-05-16
module: governance
tags: [handoff, authority, seed, adr-0343]
---

# Handoff — Fix Authority Seed Parity

## Summary

Closes the auth-seed-parity gate failure flagged on `development` tip 2026-05-16. Pontus-authorized hybrid fix: 6 of 9 "missing" capabilities were parser false-positives (DOTTED_RE filter rejected single-word literals + Shape D INSERT...SELECT seed pattern unrecognized); 3 truly missing (handbook_chapter, policy, protocol). Shipped: SINGLE_WORD_ALLOWLIST extension 2→9, CapabilityName union extension, governance content seed migration, Shape D parser, test-fixture path exclusion, 7 thunk-wrapper `@authority-gate-ungated` annotations. `pnpm exec tsx scripts/authority-seed-parity.ts` returns PASS on this branch.

## Journeys Delivered

| Journey | Status | E2E test |
|---|---|---|
| J1 — Migration applies cleanly on fresh DB | verified (code-read) | none — script-test via `supabase db reset` smoke |
| J2 — Migration applies on populated DB | verified (code-read) | none |
| J3 — Auth-seed-parity gate FAIL → PASS | verified (automated) | `scripts/authority-seed-parity.ts` (existing CI gate) |
| J4 — Pre-existing UI flows unaffected by manager floor | verified-via-code-read; runtime smoke deferred | none |

## Decisions Made

| Decision | Reason | Impact |
|---|---|---|
| Hybrid over full dotted-form rename | 31+ call sites + 6 seed migrations + IntentClassifier; ADR-0195/0201/0298 grandfathered legacy single-word; high prod regression risk on contracts/payroll | SINGLE_WORD_ALLOWLIST grows 2→9; full rename deferred to follow-up sortie post-Phase-3 |
| `(confirm, manager)` for handbook_chapter/policy/protocol | `/dashboard/governance` already manager-gated at layout level; confirm prevents silent overwrite; non-legal/non-financial risk | Manager+ can author governance content with explicit confirmation; no UI regression vs current layout guard |
| Annotate 7 thunk-wrappers with `@authority-gate-ungated` | Forwarder pattern: static literal verified at caller, not at thunk; refactor breaks gate composition (komm dispatcher, marketplace registry) | Reviewers must verify caller-side literal stays static (dynamic capability via untrusted body param = security regression) |
| Shape D parser extension over seed-migration rewrite | 6 pre-existing seeds use INSERT...SELECT; rewriting them is high-risk low-value; parser should match real SQL patterns | Latent class of missed seeds closed; future INSERT...SELECT migrations now recognized |
| Skip council on (confirm, manager) floor decision | Operational risk class, not legal/financial; T0 confidence MEDIUM; Pontus accepted T0 rec directly | Decision is hotfixable via amendment ADR if floor too restrictive in field |

All decisions registered in ADR-0343.

## Learnings

| Learning | Context |
|---|---|
| Audit-script DOTTED_RE filter can mask seed migrations | Parser at `scripts/authority-seed-parity.ts:380` requires dotted form OR allowlist entry; legacy single-word caps silently dropped from seeded-set even when migration exists. Class: enforcement script bug masquerades as content gap. |
| Shape D INSERT...SELECT seed migrations were undetected | 6 pre-existing seed migrations (payroll_phase1, contract, memory_all_workspaces, etc) used `INSERT INTO ... SELECT ... 'cap', ...` pattern. Parser only handled Shape A/B/C (VALUES tuples + CROSS JOIN VALUES + gate_action() invocation). Adding new seed shape required extending parser, not migrations. |
| Code-read verification ≠ runtime verification | Journey J4 verified by reading layout-guard code + matching seed floor; full UI smoke deferred. Journey Guardian accepts honest "code-read verified" when runtime not feasible — caller is responsible for distinguishing in handoff. |
| Scope-verify agent caught 6 false positives that would have wasted ~1 day | T0 Explore-haiku agent cross-referenced 9 flagged caps against actual migrations BEFORE migration-writing. Original "fix 9 missing seeds" framing was wrong; correct work was 3 seeds + parser fix. Always send scope-verify before build-wave on parity gates. |

## Known Issues / Debt

- **SINGLE_WORD_ALLOWLIST size**: grew 2→9. Each entry is a permanent exemption until cap is renamed to dotted form. ADR-0343 notes follow-up CI gate to block further allowlist growth without new ADR.
- **`@authority-gate-ungated` markers on 7 sites**: rationale comments included; future refactors of komm-dispatcher / marketplace-registry must preserve static-literal invariant at caller.
- **Shape D parser lacks WITH-CTE coverage**: low-risk today (no CTE seeds exist) but a future seed using `WITH cte AS (...) INSERT INTO engine_authority_config SELECT ...` would not be detected.
- **J4 runtime smoke deferred**: managers authoring handbook_chapter/policy/protocol on local dashboard not yet exercised post-migration. Pre-deploy smoke probe recommended.

## Next Steps

1. **Local Supabase apply test** — operator runs `pnpm exec supabase db reset` (or `db push`), then re-runs parity script + manual `/dashboard/governance` smoke on handbook chapter / policy / protocol edit flow.
2. **Production deploy** — migration `20260616120001_seed_governance_content_authority.sql` queued for next preview promote (HOP A). Idempotency contract: ON CONFLICT DO NOTHING + graceful no-godmode exit.
3. **Follow-up — dotted-form alignment sortie** (post-Phase-3 stability): rename contract → contract.{compose,send,revise,...}, payroll → payroll.{lock,snapshot,...}, etc. Drop SINGLE_WORD_ALLOWLIST entries as caps migrate. Touches 31+ call sites + 6 seed migrations + IntentClassifier; estimate 1-day sortie with high regression-test surface.
4. **Follow-up — allowlist-growth CI gate**: new audit/lint that blocks `SINGLE_WORD_ALLOWLIST` growth without an accompanying ADR. Prevents quiet exemption creep.
5. **Audit re-run** — next `/audit smoke` should drop F-CT-01 from HIGH backlog (or reclassify if 14 legacy `gate.ts` files still trigger the separate F-CT-01 finding under ADR-0204 §SS-5).

## Verification Trail

- Commit `a203cc8a4` — T2 build wave: script + types + migration + thunk markers
- Commit `9eb836b1d` — T1 ADR-0343 + placeholder swaps + decision log register
- `pnpm exec tsx scripts/authority-seed-parity.ts` exit 0 (post-`a203cc8a4`)
- `pnpm turbo typecheck` exit 0 (full repo)
- `pnpm --filter @smartout/ai run invariants:emit-coverage` exit 0
- `pnpm --filter @smartout/ai run invariants:intent-coverage` exit 0
- `pnpm exec tsx scripts/gate-action-coverage.ts` exit 0

## ADR

- ADR-0343 — Authority Seed Parity Backlog Closure (Hybrid). Accepted 2026-05-16. Cross-refs ADR-0189, ADR-0099, ADR-0195, ADR-0201, ADR-0204, ADR-0298.
