---
title: "Plan — payroll-phase-5 (PII Reveal)"
feature: payroll-phase-5
spec: docs/domains/payroll/PHASES.md#phase-5--pii-reveal
status: done
updated: 2026-05-08
created: 2026-05-08
module: payroll
tags: [plan, payroll, phase-5, pii-reveal, audit, revealable-field, mobile-parity]
---

# Plan — payroll-phase-5

> Branch: `feat/payroll-payroll-phase-2` (continued — combined Phase 2+3+4+5 PR) | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1` | Module: payroll

**Spec:** [Phase 5 — PII Reveal](../domains/payroll/PHASES.md#phase-5--pii-reveal)

## Critical positioning (load-bearing)

- Smartout produces **lønnsgrunnlag** — wage basis, NOT lønnsslipp. The PII reveal exists so the lønnsgrunnlag CSV/PDF + payroll detail surface can show the operator the personnummer and bankkonto rows that the regnskapssystem will consume downstream. See memory `feedback_lonnsgrunnlag_not_lonnsslipp.md`.
- **Smartout never fetches from Skatteetaten.** Tax-card data into `employee_payroll_profile.tax_*` columns arrives via two paths only: (1) Tripletex push-sync (Phase 7) OR (2) manual admin entry via the existing `update_payroll_profile` capability tool (schema extended in TB2 to accept the three tax fields). Smartout sits upstream of regnskap; Skatteetaten is the regnskapssystem's responsibility.
- Boundary is non-negotiable: any PR introducing `supabase/functions/skatteetaten-*`, pg_cron skatteetaten jobs, `skatteetaten.*` telemetry events, deviation W05, or 1Password Skatteetaten items is out-of-scope for Phase 5 and rejected at review. ADR-0250 stays `status: deferred` (verified by T0 of this phase, commit c235c5dcc).
- Reveal events route to `logger + activity_trail + engine_event` only — PostHog excluded (high-PII access never enters analytics funnels per ADR-0077).

## Journeys (the contract)

- `JOURNEY-payroll-phase-5-admin-reveals-personal-number` — admin opens payroll detail (period locked or open) → clicks Reveal on masked fnr field → audit row written to `activity_trail` within 100ms + value displayed for 5s then auto-masks
- `JOURNEY-payroll-phase-5-admin-reveals-bank-account` — same pattern on the bank account field
- `JOURNEY-payroll-phase-5-employee-self-reveals-own-pii` — employee on `(me)/my-contract` (web) or `(me)/profile-pii` (mobile) reveals own fnr and bank account; gate path is `is_self=true`; no notification fires (no notify-self)
- `JOURNEY-payroll-phase-5-cross-workspace-reveal-rejected` — admin in workspace A attempts reveal of profile from workspace B (forged `profile_id` in tool call) → tool returns 4xx + reveal-attempt audit row written with `revealed=false` + cross-workspace deviation fans out via engine_event (ADR-0151 forgery defence)
- `JOURNEY-payroll-phase-5-admin-enters-tax-card-manually` — admin opens payroll detail tax-card section → enters `tax_card_type` + `tax_percentage` + `tax_table_number` + `tax_card_year` → `update_payroll_profile` gated mutation writes via existing capability path → activity_trail audit row + recalc-trigger fires if period is open (per ADR-0293 sync-recalc-chain)

## Goal

Replace the two Phase 0c presence-only stub bodies in `packages/ai/src/capabilities/payroll/tools.ts` (`view_personal_number` at L314, `view_bank_account` at L383) with real reveal bodies that return the actual column value, audit every read, and reject cross-workspace attempts with attempt-emit. Extend `update_payroll_profile` schema with the four tax-card fields so admins have a manual entry path while Tripletex sync (Phase 7) is not yet live. Wire the `RevealableField` web component (already present at `apps/web/src/components/RevealableField.tsx`) to call the new BFF reveal routes instead of emitting `contract.pii.revealed` directly. Mobile own-data path (parity per ADR-0133). ADR-0250 stays deferred. No Skatteetaten code in this PR.

## Scope

### A. Telemetry events (DONE — T0 of this phase)

Two events registered in `packages/telemetry/src/registry.ts` at commit `0e896d20e`:

- `payroll.personal_number_revealed` — high-PII reveal-audit; routes to `logger + activity_trail + engine_event`
- `payroll.bank_account_revealed` — same routing
- Both: `entity_type: "employment_contract"`, `entity_id: target_profile_id`. Properties: `target_profile_id`, `is_self`, `gate_evaluation_id` (nullable on early-rejection paths).
- PostHog INTENTIONALLY excluded per ADR-0077 (high-PII access never in analytics funnels).
- The existing `contract.pii.revealed` event STAYS — RevealableField currently emits it client-side; TC.4 migrates RevealableField to a single server-emit path so we don't double-audit. This phase deprecates the client-side emit when the field renders inside payroll surfaces.

### B. Capability tools

#### TB1 — Real reveal bodies (`view_personal_number`, `view_bank_account`)

Both tools currently stub-query `employee_payroll_profile` for non-existent columns `personal_id_number` and `bank_account_number` (verified — see Q1). The actual PII columns live on `public.profile` as `personal_number` and `bank_account` (TEXT, plaintext, no pgsodium). Real bodies must:

1. **Channel + chat-only guard** — keep existing `assertChatChannel` (ADR-0078).
2. **Workspace verify** — query `profile` (not `employee_payroll_profile`) `WHERE profile_id = $1 AND workspace_id = ctx.workspaceId`. If not found → `ok: false, reason: "not_found"` AND emit reveal-attempt audit (`revealed=false`, `is_self=false`) with `target_profile_id` from input — this is the cross-workspace attempt audit row per ADR-0151.
3. **callGateAction** — keep, capture `gate_evaluation_id` for telemetry. On gate denial → emit reveal-attempt audit (`revealed=false`).
4. **Read column** — `personal_number` / `bank_account`. If column NULL on row → `ok: false, reason: "no_value_on_file"` (no audit emit; this isn't an access event, just absence).
5. **Emit on success** — `payroll.personal_number_revealed` or `payroll.bank_account_revealed` with `is_self = (params.profile_id === ctx.profileId)`, `gate_evaluation_id`, `target_profile_id`. NEVER include the value in the event payload.
6. **Return value** — `{ ok: true, value, masked_preview: "••••• " + value.slice(-4) }`.
7. **Body verified before docstring** per L-0176. Update tool header comments to remove "PLACEHOLDER (Phase 0c)" notes.
8. **DROP** the legacy `contract.pii.revealed` emit — replaced by the typed payroll events.

#### TB2 — `update_payroll_profile` schema extension for manual tax-card entry

Tool at `packages/ai/src/capabilities/payroll/tools.ts` (search `update_payroll_profile`). Schema extension:

```ts
schema: z.object({
  // ... existing fields ...
  tax_card_type: z.enum([...DB enum tax_card_type...]).optional(),
  tax_percentage: z.number().min(0).max(100).optional(),
  tax_table_number: z.string().regex(/^\d{4}$/).optional(),  // 4-digit table per Skatteetaten convention
  tax_card_year: z.number().int().min(2025).max(2099).optional(),
}),
```

Body: when any tax field is supplied, set `tax_card_fetched_at = now()` to mark the row as freshly entered and trigger `payroll.recalc_triggered` if the period covering today is `status='open'` (per ADR-0293 Pattern B sync-recalc-chain — call `/api/payroll/recalculate-period` after primary write, best-effort). Do NOT recalc for locked periods (would violate ADR-0251 immutability).

Existing `payroll.update_payroll_profile` event already routes to the right destinations (`posthog + logger + activity_trail + engine_event`). No new event needed. The activity_trail row is the audit for tax-card entry.

#### TB3 — `query_tax_card` body unchanged

The tool at `tools.ts:162` already does the right thing — DB-read of `employee_payroll_profile.tax_*` columns, masks `tax_table_number`, audit-emits `payroll.tax_card_queried`. No changes in this phase.

### C. BFF routes

Two new BFF routes following the Phase 4 `lonnsgrunnlag-url` pattern (HTTP-shaped glue only; tool execute() is the single source of truth):

- `apps/web/src/app/api/payroll/reveal-personal-number/route.ts` (POST) — body `{ profile_id }`. Resolves identity server-side via existing `resolvePayrollAuth` (ADR-0151 — never trusts JWT-default fallback). Constructs synthetic `AgentToolContext` with `channel: "chat"`. Invokes `viewPersonalNumber.execute()`. Maps tool JSON → HTTP response (200 ok / 4xx by reason).
- `apps/web/src/app/api/payroll/reveal-bank-account/route.ts` (POST) — same pattern, `viewBankAccount.execute()`.

4xx mapping (consistent with Phase 4 lonnsgrunnlag-url):
- `not_found` → 404 (also fans out reveal-attempt audit from tool execute())
- `authority_denied` → 403
- `channel_forbidden` → 403 (never hit from HTTP — synthetic context forces chat)
- `no_value_on_file` → 404 with explicit code so UI can render "Ingen registrert"

Reuse pattern lift-and-shift from `apps/web/src/app/api/payroll/lonnsgrunnlag-url/route.ts`. No new business logic at this layer.

### D. UI Web

#### TD1 — Wire RevealableField to BFF
Currently `RevealableField` (apps/web/src/components/RevealableField.tsx) emits `contract.pii.revealed` directly client-side and shows the prop-passed `value` for 5s. Change:
- Add prop `revealEndpoint: "/api/payroll/reveal-personal-number" | "/api/payroll/reveal-bank-account" | undefined`. When defined, on click the component POSTs to the endpoint, awaits the value, then renders for 5s. Server emits the audit; client-side emit is REMOVED on payroll-rendered fields.
- When `revealEndpoint` is undefined, behaviour unchanged (legacy contract surfaces keep client-emit until migrated in a follow-up PR — out of scope here).

#### TD2 — Payroll detail surface — RevealableField wiring
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx` (verify exact path) — replace any plaintext personnummer/bankkonto rendering with `<RevealableField value={maskedFromServer} revealEndpoint=... profileId=... workspaceId=... />`. Server should pass MASK ("••••••") as the `value` prop initially; the BFF call returns the real value on click.

#### TD3 — Manual tax-card admin form
- `apps/web/src/app/dashboard/payroll/[periodId]/_components/TaxCardSection.tsx` (NEW or extend existing detail panel) — admin-only form bound to `update_payroll_profile` via existing TanStack mutation. Four fields (type, percentage, table_number, year). Save → invalidate payroll period query → toast "Skattekort oppdatert" + recalc warning if period open.

### E. UI Mobile

ADR-0133 ("Web composes, mobile executes") — mobile owns the employee self-reveal path; admin reveal stays web-only.

- `apps/mobile/app/(app)/(me)/profile-pii.tsx` (NEW or extend existing me-tab profile screen) — calls the same two BFF reveal endpoints via existing `apiClient`. Renders `RevealableField`-equivalent native component (the web component is React-DOM only; mobile gets its own using `Pressable` + `Animated.View` + same 5s auto-mask timer).
- Audit identical (server emits `is_self=true`).
- NO admin-reveal surface on mobile (rejected per ADR-0133 — admin authoring is web-only).

### F. Tests

#### TF1 — Vitest (capability)
- `packages/ai/src/capabilities/payroll/__tests__/view-personal-number.test.ts`
- `packages/ai/src/capabilities/payroll/__tests__/view-bank-account.test.ts`

Each covers: happy path (admin), happy path (self), cross-workspace rejection (asserts attempt-emit + 4xx), gate denial, no_value_on_file, channel_forbidden (defensive — never hit via BFF but covered).

#### TF2 — Vitest (telemetry)
Mock-based test asserting `EVENT_ROUTING["payroll.personal_number_revealed"]` excludes `posthog`.

#### TF3 — E2E
- `apps/e2e/payroll-phase-5/admin-reveals-personal-number.spec.ts`
- `apps/e2e/payroll-phase-5/admin-reveals-bank-account.spec.ts`
- `apps/e2e/payroll-phase-5/employee-self-reveal.spec.ts`
- `apps/e2e/payroll-phase-5/cross-workspace-reveal-rejected.spec.ts`
- `apps/e2e/payroll-phase-5/admin-enters-tax-card.spec.ts`

Each asserts: HTTP outcome + `activity_trail` row presence + correct event_name + correct entity_type + (for cross-workspace) attempt-emit row with `revealed=false`.

### G. Out of scope (explicit — do not bleed in)

- ❌ Skatteetaten Edge Function, pg_cron, `skatteetaten.*` events, deviation W05, TLS cert handling, 1Password Skatteetaten items (per T0 commit c235c5dcc + memory addendum)
- ❌ Migration of legacy `contract.pii.revealed` emits on contract-only surfaces (separate sortie; this phase only migrates the payroll surfaces)
- ❌ pgsodium encryption-at-rest for `personal_number`/`bank_account` columns (currently plaintext TEXT — see Q1; encryption is a separate ADR + sortie, not this phase)
- ❌ Re-emit deduplication if RevealableField gets clicked 10× in 5s (ratelimit deferred — current pattern emits per click, by design)
- ❌ Mobile admin-reveal (ADR-0133 boundary)
- ❌ Tripletex sync (Phase 7)

## Tasks

- [x] T0.1 — Verify ADR-0250 frontmatter `status: deferred` (DONE c235c5dcc)
- [x] T0.2 — Strip Skatteetaten lines from PHASES.md Phase 5 (DONE c235c5dcc)
- [x] T0.3 — Register 2 PII-reveal telemetry events in registry.ts (DONE 0e896d20e)
- [ ] TB1.1 — `view_personal_number` real body (drop stub, query `profile.personal_number`, audit-emit success + cross-workspace attempt)
- [ ] TB1.2 — `view_bank_account` real body (same shape, query `profile.bank_account`)
- [ ] TB1.3 — Update tool header comments — remove "PLACEHOLDER (Phase 0c)" prose, replace with ADR-0077 + ADR-0151 + ADR-0204 + L-0177 compliance lines (body verified before docstring per L-0176)
- [ ] TB2.1 — `update_payroll_profile` schema extension: 4 optional tax fields (`tax_card_type`, `tax_percentage`, `tax_table_number`, `tax_card_year`)
- [ ] TB2.2 — Body: write tax fields to `employee_payroll_profile`, set `tax_card_fetched_at = now()`, trigger ADR-0293 sync-recalc if period open
- [ ] TB3 — Verify `query_tax_card` body unchanged from current state (smoke test only)
- [ ] TC1 — BFF route: `/api/payroll/reveal-personal-number/route.ts`
- [ ] TC2 — BFF route: `/api/payroll/reveal-bank-account/route.ts`
- [ ] TC3 — Verify `resolvePayrollAuth` reused for ADR-0151 derivation
- [ ] TC4 — Migrate `RevealableField` to call BFF when `revealEndpoint` prop set; remove client-side `contract.pii.revealed` emit on payroll surfaces
- [ ] TD1 — `LineDrawer.tsx` (or equivalent payroll detail panel) — wire RevealableField for personnummer + bankkonto
- [ ] TD2 — `(me)/my-contract` web — same wiring for self-reveal
- [ ] TD3 — `TaxCardSection.tsx` — admin form for manual tax-card entry
- [ ] TE1 — Mobile `(me)/profile-pii.tsx` — native RevealableField-equivalent + BFF call
- [ ] TE2 — Mobile parity check — admin payroll-detail surface NOT built on mobile (ADR-0133)
- [ ] TF1.1 — Vitest: view_personal_number (4 cases)
- [ ] TF1.2 — Vitest: view_bank_account (4 cases)
- [ ] TF2 — Vitest: telemetry routing assertion (no PostHog)
- [ ] TF3.1-5 — 5 e2e specs (one per declared journey)
- [ ] TG1 — Journey verification — 5 journeys → status: verified with file:line refs
- [ ] TG2 — HANDOFF-payroll-phase-5.md
- [ ] TG3 — Decision-log update if any new ADR drafted (escalation candidate Q1 — pgsodium encryption sortie)

## Acceptance Criteria

- [ ] `view_personal_number` returns real `profile.personal_number` value on admin or self read; emits `payroll.personal_number_revealed` to `activity_trail` within 100ms of tool execute
- [ ] `view_bank_account` same for `profile.bank_account`
- [ ] Cross-workspace reveal attempt: tool returns `not_found` 4xx AND emits attempt-audit row with `revealed=false`, `target_profile_id` from input (forged ID), `gate_evaluation_id: null` (rejected before gate)
- [ ] `update_payroll_profile` accepts 4 new tax fields with validation; writes set `tax_card_fetched_at`; recalc-trigger fires if period open, NOT if period locked
- [ ] `RevealableField` rendered with `revealEndpoint` prop performs server round-trip; no client-side `contract.pii.revealed` emit on payroll surfaces
- [ ] Web admin payroll detail: personnummer + bankkonto both render via RevealableField
- [ ] Mobile employee `(me)/profile-pii.tsx` self-reveals own PII; same activity_trail audit row shape with `is_self=true`
- [ ] All 5 declared journeys → status: verified with file:line refs at closure
- [ ] PostHog routing verification: `EVENT_ROUTING["payroll.personal_number_revealed"].destinations` does not include `"posthog"`
- [ ] ADR-0250 frontmatter still `status: deferred` (no Skatteetaten code shipped)
- [ ] Typecheck green: web + @smartout/ai + @smartout/telemetry + @smartout/payroll-calculate
- [ ] No new ADR-0077 violations (audit-emit on every PII access, including denied/forged attempts)

## Open questions

### Q1 — pgsodium status of `personal_number` / `bank_account` columns

**Answered (TA Task 3 of this phase, 2026-05-08):** PLAINTEXT TEXT on `public.profile`. No pgsodium encryption applied. No `vault.secrets` references. No `_encrypted` suffix. The `vault.create_secret` machinery in `20260228230000_api_key_management.sql` is for API key storage only, not PII columns.

**Verification:**
- `database.types.ts` L14691: `bank_account: string | null` on `profile`
- `database.types.ts` L14715: `personal_number: string | null` on `profile`
- `employee_payroll_profile` does NOT carry these columns (the stub tools incorrectly query non-existent `personal_id_number` + `bank_account_number` on `employee_payroll_profile` — TB1.1 + TB1.2 fix the table reference to `profile`).
- Existing RPC `admin_submit_employee_pii` (`20260501100500_admin_submit_employee_pii_rpc.sql`) writes via `UPDATE public.profile SET personal_number = ..., bank_account = ...` directly — confirms plaintext.

**Implication for plan:** TB1 tools just SELECT plaintext columns. No unwrap RPC needed. **However**, ADR-0077 §"Encryption" is unfulfilled by current schema. This is pre-existing tech debt outside Phase 5 scope. Flag for Phase 5 closure HANDOFF as a candidate sortie: `feat/payroll-pii-pgsodium-encryption` — would migrate the two columns to pgsodium-encrypted variants (`vault.secrets` referenced via `decrypt_personal_number(profile_id)` SECURITY DEFINER RPC). Not blocking for Phase 5; flagged for council review.

### Q2 — Should `view_bank_account` reveal include OCR check digit?

Norwegian bank account numbers are 11 digits; the last digit is MOD11 check. Currently `profile.bank_account` is TEXT — format unverified. TB1.2 should: (a) return raw column value, (b) optionally validate format on read and log warning to telemetry if malformed (do NOT block reveal — it's display, not write). Defer format-validation policy to TB1.2 implementation; bake decision into HANDOFF.

### Q3 — Manual tax-card entry triggering recalc on locked periods

ADR-0251 (frozen calculation) + ADR-0293 (sync-recalc Pattern B). Confirmed: TB2.2 must NOT trigger recalc when period is locked. Locked periods are immutable; tax-card entry on a locked period updates the master row only — re-computation requires a separate unlock + re-open flow (out of Phase 5 scope; documented in HANDOFF as known limitation).

### Q4 — RevealableField client-emit dual-trail

Currently RevealableField emits `contract.pii.revealed` client-side. Server tools also emit. After TC4 migration, payroll surfaces will only have server-emit (single source). Contract-only surfaces still dual-emit until follow-up sortie migrates them. Flag in HANDOFF: contract surface migration is out of Phase 5 scope.

## Closing note

Phase 5 is the smallest of the post-T0 payroll phases — 2 stub bodies + 1 schema extension + 2 BFF routes + 1 component prop + 1 mobile screen. The hardest work was T0 (Skatteetaten removal) which is already shipped. Risk concentration: TB1.1's column-rename fix (stub queried wrong table — `employee_payroll_profile.personal_id_number` doesn't exist; real column is `profile.personal_number`). This was masked by the stub returning a presence-only indicator regardless of column name. Real bodies will fail at compile/runtime if the wrong table+column are used — TF1 vitest tests catch this immediately.
