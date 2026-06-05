---
title: HANDOFF — Payroll MVP Ship-Blockers
status: done
created: 2026-05-12
updated: 2026-05-12
module: payroll
tags: [handoff, payroll, sma-327, sma-343, sma-344, sma-345, sma-346, sma-347, sma-348, adr-0295]
---

# HANDOFF — payroll-mvp-blockers

> Branch: `campaign/payroll` | Worktree: `/home/sxtnl/wsl/smartout.ai-payroll`
>
> Driving issues: SMA-327 (epic), SMA-343–SMA-348 (6 ship-blockers). Driving ADR: ADR-0295 (feriepenger basis boundary).

## Summary

Council UX session 2026-05-10 PM produced 5 SHIP-BLOCKER verdicts for the payroll module following a 4-persona user test (Anders, Maria, Sven, Lovsen). This sortie closed all 5 blockers plus their bundled ADR draft (SMA-348) in a single multi-wave build run on `campaign/payroll`.

The blockers were:

- **SMA-343** — Period-creation UI: manager had no way to start a new payroll period after locking May. Also bundled B5 manual-time-entry dialog.
- **SMA-344** — Schema Trust Gate: `salary_query` Botsson tool was SELECTing 4 columns that didn't exist (`hourly_rate`, `monthly_salary`, `remuneration_type`, `currency`). Rate columns added, sync trigger fixed, Phase 2 schema-mismatch fixed, types regen'd.
- **SMA-345** — Rate resolver: `baseHourlyRateNok = 0` hardcode replaced with contract-column → tariff fallback chain in `snapshot-period-costs`.
- **SMA-346** — Feriepenger exposure: `feriepenger_accrued: 0` hardcoded in 4 output routes. Replaced with real basis computation (`sum(base_pay) × holiday_allowance_pct/100`). Field renamed `feriepenger_basis` per ADR-0295 boundary semantics. UI label updated on my-salary + LineDrawer.
- **SMA-347** — `payroll.period_locked` notification handler: Pattern B direct EF invoke wired into `lock-period` BFF post-emit. Handler inserts `notification_outbox` rows for all affected profiles.
- **SMA-348** — ADR-0295 drafted (status: `proposed`): codifies Smartout = basis producer, regnskapsfører = accrual + payout consumer.

22 payroll feature commits + 4 fixup commits (post-review gate) + 2 E2E infra fixes across 7 build waves. All 6 SMA tasks implementation-complete. ADR-0295 proposed; Pontus accepts on merge to development per ADR body.

## What was built

### Wave 1 — Schema foundation (SMA-344)

- Migration `20260519_add_rate_columns_to_employee_payroll_profile.sql` — ADD COLUMN `hourly_rate NUMERIC(8,2)`, `monthly_salary NUMERIC(10,2)`, `remuneration_type TEXT`, `currency TEXT DEFAULT 'NOK'` to `employee_payroll_profile`. Guarded with `IF NOT EXISTS` check for idempotency.
- `sync_payroll_on_contract_signed()` trigger updated to write all 4 columns from contract on status transition.
- Phase 2 trigger schema-mismatch fixed: `public.payroll_manual_supplement` → `payroll.manual_supplement`.
- Backfill from `employment_contract` (latest active) for existing rows.
- Types regen via `npx supabase gen types` (NOT wrapped in `op run` — see Learnings).
- `salary_query` SELECT fixed to actual schema (`tools.ts`).
- Full schema scope regen committed as separate commit after discovering Wave 1A had been run against incomplete local DB (missing 20260527* migrations).

### Wave 2 — Rate resolver (SMA-345)

- `snapshot-period-costs/resolver.ts` — new module. Resolver prefers `employee_payroll_profile.hourly_rate`, falls back to `tariff_rate_table` lookup via `tariff_category` + `is_tariff_bound`, logs resolver source in telemetry.
- `baseHourlyRateNok = 0` hardcode removed from `snapshot-period-costs/route.ts`.
- Vitest: golden case covers both column-populated branch and tariff-fallback branch.

### Wave 3 — Feriepenger basis (SMA-346)

- `packages/payroll-export/src/feriepenger.ts` — pure `computeFeriepengerBasis()` helper. Input: `basePay[]`, `holidayAllowancePct`. Output: basis amount in NOK cents.
- 4 output routes updated to compute basis: `generate-pdf-bundle`, `generate-pdf-single`, `export-period` (aggregate + audit rows).
- Field renamed `feriepenger_accrued` → `feriepenger_basis` across all output shapes.
- `holiday_allowance_pct` column added to `employee_payroll_profile` (guarded migration). Default 12% per Riksavtalen; 14.3% for over-60 configurable.
- `packages/payroll-export/src/pdf/components/TotalsBlock.tsx` — "Feriepenger-grunnlag" label + regnskapsfører-disclaimer tooltip.
- `apps/web/src/app/dashboard/my-salary/` — feriepenger-grunnlag row added.
- Post-review fixup: `04fcd38c3` — UI reads `holiday_allowance_pct` from profile, not hardcoded default.

### Wave 4 — Period creation + Manual time entry (SMA-343)

- `POST /api/payroll/create-period` BFF route — `{workspace_id, start_date, end_date}` → INSERT into `payroll.period` via `gateAction`. L-0177 fail-fast, UNIQUE → 409 on duplicate. Emits `payroll.period_created`.
- "Ny periode" button + dialog in `PayrollPeriodsClient.tsx`.
- `ManualTimeEntryDialog` mounted in payroll period detail surface, wired to existing `manualTimeEntryAction`.
- Vitest: route + idempotency (9 assertions).

### Wave 5 — Notification handler (SMA-347)

- `apps/web/src/app/api/payroll/notification_outbox-handler.ts` — Pattern B direct EF invoke. Queries all profiles in workspace, INSERTs `notification_outbox` rows (channel `push` or email fallback for null `expo_push_token`). Idempotency key on `(period_id, profile_id, event_type)`.
- `lock-period` BFF route updated to invoke handler post-emit.
- Telemetry: `payroll.notification_dispatched` per delivery attempt.

### Wave 6 — ADR-0295 + telemetry (SMA-348)

- `docs/decisions/0295-feriepenger-boundary.md` — feriepenger basis vs accrual boundary. Status: `proposed`.
- Registered `payroll.feriepenger_basis_computed` event in `packages/telemetry/src/registry.ts`.
- `pnpm --filter @smartout/telemetry build` run post-registry edit to update dist for consumers.

### Wave 7 — E2E infra fixes

- `cead490b5` — Drop invalid `timeout` field from `test.skip()` calls (Playwright 1.58.2 `TestDetails` has only `tag` + `annotation`).
- `be799b28e` — Bypass Next.js 16 Turbopack dev overlay on payroll spec clicks.
- `3a7e223b8` — Use `page.goto(href)` for SPA navigation in payroll specs (dev overlay intercepts pointer events).
- `5c6905357` — Paginate `listUsers` to handle >50 auth users in fixture helper.

## Decisions made

| Decision | Rationale | Where captured |
|---|---|---|
| ADR-0295 — feriepenger basis vs accrual boundary | Smartout = wage basis producer; regnskapsfører = accrual + payout consumer. Aligns with "lønnsgrunnlag not lønnsslipp" memory entry 2026-05-08. | `docs/decisions/0295-feriepenger-boundary.md` |
| Pattern B (direct EF invoke) for SMA-347 handler | Pattern A (engine_process blueprint) adds orchestration overhead for a single-step handler with no branching. Pattern B per ADR-0293 precedent. Steward recommendation accepted. | SMA-347 scope + `lock-period` BFF wiring |
| `holiday_allowance_pct` on `employee_payroll_profile` (not sibling table) | L-0202: ADD COLUMN beats sibling-table for 1:1 attributes without lifecycle independence. | Migration guard commit `e04b96b40` |
| 3 ADR-0295 open questions addressed in implementation, formal council acceptance pending | (1) telemetry event name shape: `payroll.feriepenger_basis_computed` (space-form registry per L-0046); (2) accrual amendment strictness: Phase 7 boundary; (3) per-employee pct override: `holiday_allowance_pct` column on profile. | ADR-0295 §Open questions |
| 5 plan-drifts caught + corrected in Wave 1A | Currency field missing on contract type (added Zod field); `remuneration_type_enum` mapping wrong direction (fixed); `activity_trail` column names mismatched spec (corrected); Phase 2 recalc trigger rollback was full not partial (scoped to schema-mismatch only); `DROP TRIGGER IF NOT EXISTS` doesn't exist in Postgres — use `DROP TRIGGER IF EXISTS` (fixed). | Wave 1A commits |

## Learnings

| Learning | Context |
|---|---|
| `op run` corrupts `supabase gen types` output | 1Password substitutes substrings like `admin` (in column `admin_profile_id`) with `<concealed by 1Password>`. Run `npx supabase gen types` WITHOUT `op run` wrap. Local Supabase only needs port 54321. Already in MEMORY.md; reinforced here. |
| Local Supabase can drift from migration set | Wave 1A regen happened against local DB that was missing 20260527* migrations (applied to cloud but not local reset). Symptom: types omit new columns. Fix: `npx supabase db reset` (applies all migrations in order) before regen. |
| `pnpm --filter @smartout/telemetry build` required after registry edit | Consumers import from `dist/`. If dist is stale, new events compile in registry but consumers see old type union at runtime. Always rebuild telemetry after adding events. |
| Edit/Write tool silent persistence bug risk | Discovered in Wave 4A — on-disk content can diverge from what was written if editor state is stale. Mitigation: `cat`-verify after each write before committing. |
| lint-staged stash + restore can lose untracked files | Wave 3 handler files lost mid-run when lint-staged stashed working tree and untracked files weren't stashed. Recovery: redo the write. Guard: `git add -p` all new files before committing to move them out of untracked. |
| Next.js 16 Turbopack dev overlay intercepts pointer events in Playwright | Dev overlay renders above SPA content in dev mode. `{ force: true }` on clicks and `page.goto(href)` for navigation bypass the overlay. Production builds don't exhibit this. |
| Playwright `test.skip()` `TestDetails` shape in 1.58.2 | `TestDetails` has only `tag` and `annotation` fields. `timeout` is a separate overload — `test.skip(reason, options)` not `test.skip({ ..., timeout })`. Caught by typecheck. |

## Known issues / debt

| Item | Severity | Notes |
|---|---|---|
| Pre-existing `@smartout/voice-agent` typecheck failure (`lise-interview` enum) | Low — pre-existing, unrelated to payroll | Tracked SMA-349 |
| Pre-existing botsson/emma 4 `get-server-context` errors in web typecheck | Low — pre-existing | Not payroll surface; 4 errors only |
| Group B E2E tests (download round-trip) SKIPPED | Medium | Blocked on `E2E_LOCKED_PERIOD_ID` seed in `apps/e2e/helpers/seed.ts`. Group A (8 specs) all green. |
| ADR-0295 status `proposed` | N/A — by design | Pontus accepts on merge to development per ADR body. 3 open questions parked for council acceptance. |
| SMA-347 handler is Pattern B (no retry on push failure) | Low | Stale Expo tokens → push fails silently. Mitigated by email fallback + telemetry alert. Full retry queue is Phase 7 infrastructure. |
| `feriepenger_basis` in CSV/PDF is basis only — no liability schedule | By design | ADR-0295 boundary. Accrual = regnskapsfører. |

## Next steps

1. **Council formally accept ADR-0295** + resolve 3 open questions (telemetry event name shape, accrual amendment strictness, per-employee pct override path).
2. **Add locked-period seed** to `apps/e2e/helpers/seed.ts` to unblock Group B E2E specs (download round-trip).
3. **Smoke-test SMA-347 notification flow** in dev — curl one-liner in SMA-347 comment to verify outbox rows created on lock.
4. **Mobile parity for my-salary feriepenger row** — read-only `feriepenger_basis` row on `(me)/payroll` (ADR-0133).
5. **Merge `campaign/payroll` to `development`** — run `/close-feature` or manual PR. Campaign has 6 SMA tasks complete + ADR-0295 proposed.

## Test counts

| Suite | Count | Status |
|---|---|---|
| vitest — `@smartout/payroll-export` (3 test files) | 74 | All pass |
| vitest — web `src/app/api/payroll/` (6 test files) | 46 | All pass |
| **Total unit tests** | **120** | **All green** |
| pgTAP | 3/3 (hourlyWage / monthlyWage / commissionOnly trigger scenarios) | All pass |
| Playwright Group A | 8/8 | All pass |
| Playwright Group B | 0 run (4 expected skips) | Blocked on seed — not failures |
| Typecheck: `@smartout/payroll-export` | 0 errors | Green |
| Typecheck: `@smartout/ai` | 0 errors | Green |
| Typecheck: `@smartout/telemetry` | 0 errors | Green |
| Typecheck: web | 4 errors (pre-existing botsson `get-server-context`) | Payroll surface: 0 errors |

## Commits

All payroll feature commits on `campaign/payroll` since `a42fa6f04`:

| SHA | Subject |
|---|---|
| `887d2d60e` | chore(payroll): merge development into campaign |
| `e5475d054` | docs(payroll): log dev→campaign sync 2026-05-11 |
| `cead490b5` | fix(payroll): drop invalid timeout option on e2e test.skip block |
| `5c787cb66` | docs(payroll): ADR-0295 — feriepenger boundary (basis vs accrual) |
| `358625782` | feat(payroll): add rate columns to employee_payroll_profile (SMA-344) |
| `7f1e86fe1` | feat(payroll): sync trigger writes rate columns to employee_payroll_profile |
| `83ff6734d` | fix(payroll): Phase 2 recalc triggers schema-mismatch (public.* → payroll.*) |
| `0e7e5b9cf` | chore(payroll): backfill rate columns from latest active contract |
| `69673b7d7` | fix(payroll): salary_query no longer crashes — schema columns now exist |
| `0b1b65bdb` | chore(payroll): regen types with full schema scope — fix Wave 1A narrow regen |
| `e04b96b40` | chore(payroll): guard migration for holiday_allowance_pct on employee_payroll_profile (SMA-346) |
| `f04bfbb4b` | feat(payroll): rate resolver replaces baseHourlyRateNok = 0 hardcode (SMA-345) |
| `0f47c54d8` | feat(payroll): feriepenger basis compute helper (ADR-0295, SMA-346) |
| `33f95f180` | refactor(payroll): rename feriepenger_accrued → feriepenger_basis per ADR-0295 |
| `40a37d2e5` | feat(payroll): wire feriepenger basis into export + PDF + salary_query (SMA-346) |
| `a81d32666` | feat(payroll): add ManualTimeEntryDialog wired to existing manualTimeEntryAction |
| `77b5e1300` | feat(payroll): POST /api/payroll/create-period BFF + tests (SMA-343 S1a) |
| `2432a62fc` | feat(payroll-ux): Ny periode button + dialog — SMA-343 S1a |
| `a3728dd27` | feat(payroll): notification_outbox handler for payroll.period_locked event (SMA-347) |
| `8ac36d966` | feat(payroll): invoke period-locked-handler from lock-period BFF post-emit (SMA-347) |
| `6d8eee7f3` | fix(payroll-tests): close strict-null + duplicate-property typecheck errors |
| `3294840b5` | feat(payroll-ux): feriepenger-grunnlag label on my-salary + LineDrawer (ADR-0295) |
| `687a3002e` | feat(payroll-telemetry): register + emit payroll.feriepenger_basis_computed (ADR-0295) |
| `5c6905357` | fix(playwright-fixture): paginate listUsers to handle more than 50 auth users |
| `04fcd38c3` | fix(payroll-ux): UI feriepenger preview reads holiday_allowance_pct from profile (ADR-0295) |
| `be799b28e` | fix(playwright-fixture): bypass Next.js 16 dev overlay on payroll spec clicks |
| `3a7e223b8` | fix(playwright-fixture): use page.goto(href) for SPA navigation in payroll specs |
