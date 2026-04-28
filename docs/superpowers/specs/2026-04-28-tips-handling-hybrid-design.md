---
title: Tips Handling — Hybrid Design (spec + cascade integration)
status: proposed
updated: 2026-04-28
created: 2026-04-28
module: tips
tags: [design, tips, payroll, hospitality, d3, d6, c3, cascade]
---

# Tips Handling — Hybrid Design

> **Purpose:** Final design for Tips module before implementation. Reconciles three input sources (PRD + ARCHITECTURE + COMPONENTS authored 2026-04-28 by external draft + existing campaign roadmap `CAMPAIGN-tips-handling.md`) into one Smartout-cascade-aligned design.
>
> **Visual companion:** `2026-04-28-tips-handling-mockup.html` (sibling file in this directory)
> **Campaign:** `~/dev/smartout.ai-tips-handling/` (worktree on `campaign/tips-handling`)
> **Companion ADRs:** ADR-0203 (Cabinet Grotesk display-font) — independent prerequisite

## 1. Vision

Tips er kontant-penger som gjør hospitality-ansatte stolte. I dag fordeles de manuelt, utransparent, og ofte med mistillit. Smartout gjør det rettferdig, sporbart og mobilt. Tre verdiløfter:

1. **Transparent fordeling** — hver ansatt ser sin andel med full beregning (timer × vekt-forklaring)
2. **Audit-trail** — alle utdelinger + justeringer ligger i `tip_adjustment_log`
3. **Emosjonell push-notif** — "Kvelden ga 4 500 kr i tips. Din andel: 900 kr." instant feedback bygger tillit

## 2. Design philosophy

**No new screens. Plug into existing surfaces.** Three leader touchpoints + four employee touchpoints, all pre-existing in the app:

| Role | Surface | Action |
|---|---|---|
| Admin | `dashboard/settings/operations/tips` | Toggle Tips on/off per workspace |
| Leder | `DayControlPanel` Okonomi-tab | Register kvelden tips (quick) |
| Leder | `WebDayControl` Oppgjør-tab | Block session-close gate |
| Leder | `reconciliation/DayDetail` ny "Tips"-tab | Adjust + approve formally |
| Ansatt | `AfterShiftView` tile (shift-hub) | Same-evening summary |
| Ansatt | `Lønn`-skjerm via ActionBar | Periode-akkumulert + drill-ned |
| Ansatt | `NotificationSheet` row | Persistent feed |

All employee + leader surfaces gated behind workspace `tips_enabled` flag (§22). Disabled = nothing renders, anywhere.

## 3. Design tokens

Inherited from Nordic Split:

- **Display-font:** Cabinet Grotesk (per ADR-0203). Used for all KPI values, headers, large numbers, lockscreen clock.
- **Body:** Geist Sans
- **Mono/data:** Geist Mono
- **Accent:** brand-orange (`oklch(0.62 0.190 50)`) for "tips-related" UI states
- **Success:** `oklch(0.62 0.140 145)` for `approved` state
- **Spring physics:** stiffness 35, damping 22, mass 2.2 on transitions
- **Touch target:** ≥44pt on mobile (per ADR-0177)
- **Tokens only:** No hardcoded zinc/gray. `bg-background`, `text-foreground`, `border-border`, `--brand-orange`.

## 4. Database schema

Five tables (3 from campaign roadmap + 2 from external spec, reconciled to Smartout cascade):

### 4.1 `tip_pool`

```sql
CREATE TABLE tip_pool (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                    UUID NOT NULL REFERENCES workspace(workspace_id),
  department_session_id           UUID NOT NULL REFERENCES department_session(session_id),
  policy_id                       UUID NOT NULL REFERENCES tip_policy(id),
  amount_nok                      NUMERIC(10,2) NOT NULL CHECK (amount_nok >= 0),
  currency                        TEXT NOT NULL DEFAULT 'NOK',
  status                          tip_pool_status NOT NULL DEFAULT 'recorded',
  recorded_by                     UUID NOT NULL REFERENCES profile(profile_id),
  recorded_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by                     UUID REFERENCES profile(profile_id),
  approved_at                     TIMESTAMPTZ,
  algorithm_version_at_approval   TEXT,
  notes                           TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_session_id)
);

CREATE TYPE tip_pool_status AS ENUM ('recorded', 'approved', 'paid', 'voided');
```

**Key invariants:**
- `department_session_id` UNIQUE — one pool per session (kveldsgrense, not kalenderdag — invariant #10)
- `workspace_id` denormalized from session for RLS (invariant #1: `workspace_id` on every workspace-scoped table)
- `algorithm_version_at_approval` snapshots the policy state at approval time (audit reproducibility)

### 4.2 `tip_distribution`

```sql
CREATE TABLE tip_distribution (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id),
  pool_id             UUID NOT NULL REFERENCES tip_pool(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id),
  shift_id            UUID REFERENCES schedule_shift(shift_id),
  role                TEXT NOT NULL,
  hours_worked        NUMERIC(5,2) NOT NULL,
  weight_applied      NUMERIC(4,2) NOT NULL,
  algorithm_snapshot  JSONB NOT NULL,
  calculated_amount   NUMERIC(10,2) NOT NULL,
  adjusted_amount     NUMERIC(10,2),
  adjustment_reason   TEXT,
  payroll_period_id   UUID,
  paid_at             TIMESTAMPTZ,
  status              tip_distribution_status NOT NULL DEFAULT 'calculated',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, profile_id),
  CHECK (adjustment_reason IS NULL OR length(adjustment_reason) >= 5)
);

CREATE TYPE tip_distribution_status AS ENUM ('calculated', 'approved', 'paid');
```

**Notes:**
- `payroll_period_id` is a plain UUID (no FK) — schema-prep for future payroll-campaign without forcing FK now
- `paid_at` populated by future payroll-campaign, never by Tips campaign itself
- `adjusted_amount` NULL means no adjustment (use calculated_amount); when set, requires `adjustment_reason ≥ 5 chars` (CHECK constraint)
- `algorithm_snapshot` JSONB captures full policy state at calc time (reproducibility, tamper detection)

### 4.3 `tip_policy`

```sql
CREATE TABLE tip_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  department_id   UUID NOT NULL REFERENCES department(department_id),
  name            TEXT NOT NULL,
  method          tip_algorithm NOT NULL,
  active_from     DATE NOT NULL,
  active_to       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NOT NULL REFERENCES profile(profile_id),
  CHECK (active_to IS NULL OR active_to >= active_from)
);

CREATE TYPE tip_algorithm AS ENUM ('equal', 'by_hours', 'by_role');

CREATE INDEX idx_tip_policy_active
  ON tip_policy (department_id, active_from DESC)
  WHERE active_to IS NULL;
```

**Granularity decision:** per `department_id`, not per `workspace_id`. Reason: bar and kitchen in same workspace can have different algorithms.

**Versioning:** `active_to` NULL = active. Setting active_to + creating new row = atomic policy transition (single transaction). Old rows preserved for audit.

### 4.4 `tip_role_weight`

```sql
CREATE TABLE tip_role_weight (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id   UUID NOT NULL REFERENCES tip_policy(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  weight      NUMERIC(4,2) NOT NULL CHECK (weight >= 0 AND weight <= 10),
  UNIQUE (policy_id, role)
);
```

Only relevant when `tip_policy.method = 'by_role'`. Default seed weights per workspace's primary department: `servitør=1.0, bartender=0.9, runner=0.7, kjøkken=0.5`.

### 4.5 `tip_adjustment_log`

```sql
CREATE TABLE tip_adjustment_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id),
  distribution_id   UUID NOT NULL REFERENCES tip_distribution(id) ON DELETE CASCADE,
  changed_by        UUID NOT NULL REFERENCES profile(profile_id),
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_amount        NUMERIC(10,2),
  new_amount        NUMERIC(10,2) NOT NULL,
  reason            TEXT NOT NULL CHECK (length(reason) >= 5)
);

CREATE INDEX idx_tip_adjustment_log_dist ON tip_adjustment_log (distribution_id, changed_at DESC);
```

INSERT-only. Visible to the affected employee (via `profile_id` JOIN through `tip_distribution`). No UPDATE-policy.

## 5. RLS policies

All five tables: dual JWT + API key.

### tip_pool

```sql
-- JWT: leader sees pools in their department(s)
CREATE POLICY tip_pool_jwt_leader_read ON tip_pool FOR SELECT
  USING (
    department_session_id IN (
      SELECT session_id FROM department_session ds
      WHERE ds.department_id IN (SELECT department_id FROM current_user_departments())
    )
  );

-- JWT: leader inserts/updates own department's pools (gated via capability, but RLS as defense-in-depth)
CREATE POLICY tip_pool_jwt_leader_write ON tip_pool FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace_id()
    AND department_session_id IN (
      SELECT session_id FROM department_session
      WHERE department_id IN (SELECT department_id FROM current_user_departments())
    )
  );

CREATE POLICY tip_pool_jwt_leader_update ON tip_pool FOR UPDATE
  USING (
    department_session_id IN (
      SELECT session_id FROM department_session
      WHERE department_id IN (SELECT department_id FROM current_user_departments())
    )
    AND status != 'approved'  -- locked once approved
  );

-- Employee: read-only on pools they have a distribution in
CREATE POLICY tip_pool_jwt_employee_read ON tip_pool FOR SELECT
  USING (
    id IN (
      SELECT pool_id FROM tip_distribution
      WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    )
    AND status = 'approved'  -- employees never see un-approved pools
  );

-- API key: workspace-scoped full access (capability layer enforces specifics)
CREATE POLICY tip_pool_api_key ON tip_pool FOR ALL
  USING (workspace_id = current_setting('request.jwt.claim.workspace_id', true)::uuid);
```

### tip_distribution

Same pattern; key SELECT for employees:

```sql
CREATE POLICY tip_distribution_jwt_employee_read ON tip_distribution FOR SELECT
  USING (
    profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND status IN ('approved', 'paid')
  );

-- UPDATE locked after approve
CREATE POLICY tip_distribution_jwt_leader_update ON tip_distribution FOR UPDATE
  USING (
    pool_id IN (
      SELECT id FROM tip_pool
      WHERE department_session_id IN (
        SELECT session_id FROM department_session
        WHERE department_id IN (SELECT department_id FROM current_user_departments())
      )
      AND status != 'approved'
    )
  );
```

### tip_policy / tip_role_weight / tip_adjustment_log

Same pattern. `tip_adjustment_log` has employee SELECT via JOIN through distribution:

```sql
CREATE POLICY tip_adjustment_log_jwt_employee_read ON tip_adjustment_log FOR SELECT
  USING (
    distribution_id IN (
      SELECT id FROM tip_distribution
      WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    )
  );
```

## 6. Capabilities

Four tools, registered in `packages/ai/src/capabilities/tips/`:

| Capability | Authority | Surface | Mutation |
|---|---|---|---|
| `tips.set_pot` | suggest | DayControlPanel · WebDayControl signoff-gate | INSERT pool + distributions |
| `tips.adjust_share` | confirm | reconciliation/DayDetail Tips-tab | INSERT log + UPDATE distribution |
| `tips.approve_distribution` | confirm | reconciliation/DayDetail Tips-tab | UPDATE pool.status, trigger push |
| `tips.query_own_share` | read_only | mobile (BFF /api/tips/me) | SELECT |

### 6.1 Authority seed

Migration uses CROSS JOIN VALUES form (per ADR-0176, authority-seed-parity scanner requirement):

```sql
INSERT INTO engine_authority_config (workspace_id, capability_key, default_authority, ...)
SELECT w.workspace_id, t.capability_key, t.authority, ...
FROM workspace w
CROSS JOIN (VALUES
  ('tips.set_pot', 'suggest'),
  ('tips.adjust_share', 'confirm'),
  ('tips.approve_distribution', 'confirm'),
  ('tips.query_own_share', 'read_only')
) AS t(capability_key, authority)
ON CONFLICT (workspace_id, capability_key) DO NOTHING;
```

### 6.2 Gate enforcement

Every mutation tool wraps `callGateAction(...)` BEFORE the DB write (per ADR-0201). `read_only` queries skip the gate.

`gate_action` failure = fail-CLOSED, return `{ok:false, error:'gate_denied'}`, do NOT emit any `*_started` event (per ADR-0196 / Invariant 11 from journey-engine campaign).

### 6.3 Phantom-emit guard

Every capability tool that emits `tip_pool.created` or similar MUST produce the declared artefact in the same `execute()` call. Forbidden shape: `emit() → return {ok:true, note:"skeleton"}`. Grep gate enforced in close-feature.

## 7. Telemetry registry

Four events in `packages/telemetry/src/registry.ts`:

```typescript
{
  event: "tip_pool created",
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  payloadSchema: z.object({
    pool_id: z.string().uuid(),
    department_session_id: z.string().uuid(),
    amount_nok: z.number(),
    distribution_count: z.number().int(),
    algorithm: z.enum(["equal", "by_hours", "by_role"]),
  }),
},
{
  event: "tip_distribution calculated",
  destinations: ["logger", "engine_event"],  // high-volume, exclude posthog
  payloadSchema: z.object({
    pool_id: z.string().uuid(),
    distribution_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    calculated_amount: z.number(),
    weight_applied: z.number(),
  }),
},
{
  event: "tip_distribution adjusted",
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  payloadSchema: z.object({
    distribution_id: z.string().uuid(),
    pool_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    old_amount: z.number().nullable(),
    new_amount: z.number(),
    reason: z.string().min(5),
  }),
},
{
  event: "tip_pool approved",
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  payloadSchema: z.object({
    pool_id: z.string().uuid(),
    department_session_id: z.string().uuid(),
    total_distributed: z.number(),
    distribution_count: z.number().int(),
    adjustment_count: z.number().int(),
  }),
}
```

Phase 2.5 fact-check before implementation: grep `packages/telemetry/src/registry.ts` for each `tip_*` event before referencing in capability code (per L-0094 phantom emit prevention).

## 8. BFF routes

Per ADR-0132 (mobile thin-client BFF), all data access goes through `apps/web/src/app/api/tips/*` route handlers. No direct capability imports in mobile.

| Method | Path | Capability | Auth |
|---|---|---|---|
| POST | `/api/tips/pools` | tips.set_pot | dual (Bearer + cookie) |
| GET | `/api/tips/pools/[id]` | (RLS-only read) | dual |
| POST | `/api/tips/pools/[id]/approve` | tips.approve_distribution | dual |
| PATCH | `/api/tips/distributions/[id]` | tips.adjust_share | dual |
| GET | `/api/tips/me?from=&to=` | tips.query_own_share | mobile JWT |
| GET | `/api/tips/policies?department_id=` | (RLS-only read) | dual |
| POST | `/api/tips/policies` | (suggested follow-up: tips.set_policy capability — out of Sortie 1 scope) | dual |

**Server-derived identity** (per ADR-0151):
- `workspace_id` derived from JWT claim `request.jwt.claim.workspace_id`
- `actor_id` derived via `getProfileContext()` server-side
- Never trust client-supplied `profile_id` / `workspace_id` from request body

## 9. Distribution algorithm

Pure function in `packages/ai/src/capabilities/tips/calculate.ts`:

```typescript
export function calculate(
  amountNok: number,
  shifts: Array<{ profile_id: string; role: string; hours_worked: number }>,
  policy: { method: 'equal'; } | { method: 'by_hours'; } | { method: 'by_role'; weights: Record<string, number> },
): Array<{ profile_id: string; weight_applied: number; calculated_amount: number; algorithm_snapshot: object }> {
  if (shifts.length === 0) return [];

  const weighted = shifts.map((s) => {
    const weight =
      policy.method === 'equal' ? 1 :
      policy.method === 'by_hours' ? 1 :
      /* by_role */                  (policy.weights[s.role] ?? 1.0);
    const points =
      policy.method === 'equal' ? 1 :
      /* hours / by_role */          s.hours_worked * weight;
    return { ...s, weight_applied: weight, points };
  });

  const totalPoints = weighted.reduce((sum, w) => sum + w.points, 0);
  if (totalPoints === 0) return [];

  // Round to 2 decimals, allocate remainder to highest-points employee
  const raw = weighted.map((w) => ({
    ...w,
    calculated_amount: Math.round((amountNok * w.points / totalPoints) * 100) / 100,
  }));
  const allocated = raw.reduce((s, r) => s + r.calculated_amount, 0);
  const remainder = Math.round((amountNok - allocated) * 100) / 100;
  if (remainder !== 0) {
    const top = raw.reduce((a, b) => (b.points > a.points ? b : a));
    top.calculated_amount = Math.round((top.calculated_amount + remainder) * 100) / 100;
  }
  return raw.map(({ profile_id, weight_applied, calculated_amount }) => ({
    profile_id,
    weight_applied,
    calculated_amount,
    algorithm_snapshot: { method: policy.method, weights: 'weights' in policy ? policy.weights : null, total_points: totalPoints, points: 'points' in {} ? 0 : 0 },
  }));
}
```

Unit-tested in `packages/ai/src/capabilities/tips/calculate.test.ts`. Three policy branches × edge cases (zero hours, single employee, all-zero weights, rounding remainder).

**Sum invariant:** `sum(calculated_amount) === amount_nok` ALWAYS. Enforced by remainder-allocation. Tested.

## 10. State machine

```
[no row]
   │ tips.set_pot (DayControlPanel.OkonomiTab OR WebDayControl close-out gate)
   ▼
[recorded] ──┐
   │         │ tips.set_pot (idempotent on session_id) · tips.adjust_share
   │         └──▶ [recorded]
   │
   │ tips.approve_distribution (reconciliation/DayDetail Tips-tab)
   ▼
[approved] ─── (RLS UPDATE locked, distributions immutable)
   │
   │ (future payroll-campaign — out of scope here)
   ▼
[paid]
```

**Locks:**
- `tip_pool.status = approved` → `tip_distribution` UPDATE-policy denies for non-payroll roles
- `tip_pool.status = approved` → `tip_pool` UPDATE-policy denies amount/policy changes
- `tip_adjustment_log` is INSERT-only, never UPDATE/DELETE

## 11. UI integration — three leader surfaces

### 11.1 DayControlPanel · Okonomi-tab

File: `apps/web/src/app/dashboard/schedule/_components/day-control/OkonomiTab.tsx`

NEW `<section>` between "Budsjett vs Faktisk" and "Registrer dagsoppgjor"-button:

```tsx
<section>
  <SectionHeader label="Tips" />
  <div className="grid grid-cols-3 gap-2">
    {tipPool === null ? (
      <KpiCard label="Pool" value="Ikke registrert" empty />
    ) : tipPool.status === "recorded" ? (
      <KpiCard label="Pool · venter" value={formatNok(tipPool.amount_nok)} accent="warm" />
    ) : (
      <KpiCard label="Pool · godkjent" value={formatNok(tipPool.amount_nok)} accent="success" />
    )}
    <KpiCard label="Algoritme" value={policyLabel(tipPool?.policy)} />
    <KpiCard label="Andeler" value={tipPool ? `${tipPool.distribution_count}` : "—"} />
  </div>
  {tipPool === null && (
    <TipsRegisterInlineForm sessionId={sessionId} departmentId={departmentId} />
  )}
</section>
```

Reuses existing `SectionHeader`, `KpiCard` (per `shared.tsx`). New component: `TipsRegisterInlineForm` — input + button, calls `tips.set_pot` via BFF.

### 11.2 WebDayControl · Oppgjør-tab

File: `apps/web/src/components/day/tabs/SignoffTab.tsx`

NEW row in `SignoffPanel.summary`:

```tsx
{tipPoolStatus === "recorded" || tipPoolStatus === "approved" ? (
  <SummaryRow label="★ Tips registrert" value={formatNok(amount)} variant="tips" />
) : null}
```

NEW gate on "Send til oppgjør"-button: disable + toast if `tipPool === null && !sessionVoidedTips`. Toast: "Registrer kveldens tips i Okonomi-tab først".

### 11.3 reconciliation/DayDetail · ny "Tips"-tab

Files:
- `apps/web/src/app/dashboard/reconciliation/_components/DayDetail.tsx` — add to TABS array
- `apps/web/src/app/dashboard/reconciliation/_components/tabs/TipsTab.tsx` — NEW

Components inside TipsTab:
- KPI strip (3 cards): Pool, Algoritme, Justeringer
- DistributionTable (re-implementation of distribution-table pattern with adjusted-row warm tint)
- AdjustmentDialog (modal, per row click — calls `tips.adjust_share`)
- ApproveBar (sticky bottom, sum-vs-pool diff, "Godkjenn fordeling" button calling `tips.approve_distribution`)

## 12. UI integration — four employee surfaces

### 12.1 Push-notif — DEFERRED to payroll-campaign

**Removed from Tips campaign scope.** Reasoning:

- `tip_pool.approved` is a leader-side admin event. Real money-payoff for ansatt happens when payroll runs and `paid_at` populates.
- Sending push at approval = informational, not emotional. Risk: notification-fatigue.
- AfterShiftView tile (instant on tab focus) + Lønn-skjerm (cumulative) + NotificationSheet (queue) cover visibility without push.

`tip_pool.approved` event still emits to `engine_event` for telemetry/audit. Future payroll-campaign owns the user-facing payment notification.

If later product-feedback shows employees want approval-time push: add `tips-push-notif` Edge Function as standalone enhancement post-Tips-MVP. Schema already supports it.

### 12.2 AfterShiftView tile

File: `apps/mobile/src/components/home/AfterShiftView.tsx`

NEW tile-row when phase = `after_shift`:
- Two states: `recorded` (warm orange) | `approved` (success green)
- Hidden if no pool exists for the closed session
- Tap → navigate to `/lonn` screen

### 12.3 Lønn-skjerm

NEW file: `apps/mobile/app/(app)/(home)/lonn.tsx`

Triggered by ActionBar Lønn button (already exists, currently no destination).

Layout:
- Period card (top) — vakter, lønn brutto, **★ Tips · X dager · X kr** (warm row)
- Section "Tips-historikk" — list of day-rows with date, dept, hours, weight, amount, status, justification reason if any

Hook: `apps/mobile/src/hooks/queries/use-tips.ts` — calls `/api/tips/me?from=&to=` via BFF helper.

### 12.4 NotificationSheet row

File: `apps/mobile/src/components/notifications/NotificationSheet.tsx`

NEW row-type `tips_approved`:
- Icon: ★ in success-tint circle
- Title: "Tips godkjent"
- Body: "Din andel av kveldens tips: 900 kr"
- Tap → same deep-link as push

## 13. Mobile thin-client compliance (ADR-0132 / 0134)

- Mobile imports `useTips()` hook → calls `/api/tips/me` via `getTipsMeUrl()` helper in `apps/mobile/src/lib/web-api.ts`
- NO direct `supabase.rpc` or capability imports in mobile
- Every emit resolves `workspace_id` (non-null) + `actor_id` via `getProfileContext()` BEFORE `emit()`
- Empty-string fallback forbidden — Zod-validated at telemetry layer (per ADR-0193 NonEmptyString brand)

## 14. Voice policy (ADR-0078 / 0163)

Tips er PII-nær (lønnsopplysninger). Per ADR-0163 domain `payroll`:
- `tips.query_own_share` — chat-only, NO voice
- `tips.set_pot` / `tips.adjust_share` / `tips.approve_distribution` — chat-only, NO voice
- 3-layer defence: process `allowed_channels`, capability `allowedChannels`, tool `ctx.channel` guard

## 15. Out of scope

**Sortie 1:**
- UI implementation (Sortie 2-3)
- Mobile screens (Sortie 3)

**Whole campaign:**
- Push-notif Edge Function — deferred to payroll-campaign (real money-event = real notification)
- Lønnseksport flow + `paid` state transition (separate payroll-campaign — schema prepped via `payroll_period_id` + `paid_at` columns)
- Hybrid policies (FoH/BoH split)
- Salgsbaserte policies (POS-line-level — requires separate integration)
- Ukespool / månedspool (dag-pool covers 90% of NO restaurants)
- Vipps/kort/kontant skille (registreres som ett beløp)
- Tilbakeføring etter utbetaling (sjelden, manuelt via lønn)
- Multi-currency (Skandinavia-only)
- Cabinet Grotesk cutover — handled in separate branch by Pontus

## 16. Sortie breakdown

See §23 for revised scope per Pontus's feedback (settings toggle added, push-notif removed). Summary:

| # | Sortie | Scope | Days |
|---|---|---|---|
| 1 | `tips-data-model` | 5 tables + RLS + capability skeleton + authority seed + 4 telemetry events + workspace_setting.tips_enabled + useTipsEnabled hook + settings toggle UI | 2-3 |
| 2 | `tips-leader-flows` | OkonomiTab + SignoffTab gate + reconciliation Tips-tab + BFF routes (all wrapped in tips_enabled gate) | 3-4 |
| 3 | `tips-employee-mobile` | use-tips hook + Lønn-skjerm + AfterShiftView tile + NotificationSheet row (mobile tips_enabled gate) | 1-2 |
| 4 | `tips-e2e-audit` | Playwright money-flow + audit-review + close-feature gate hardening + on/off toggle E2E | 1-2 |

**Total: ~7-11 dev-days.**

## 17. Trust gates

Each sortie must pass:

1. Decision-log updated for any new ADRs / status promotions
2. `docs/journeys/JOURNEY-tips-<sub>.md` written (admin + leader + employee flows; happy + error paths)
3. `pnpm turbo typecheck` passes 0 errors
4. Authority-seed-parity scanner passes (CROSS JOIN VALUES form required)
5. Phase 2.5 telemetry registry grep returns all 4 events
6. No `gate_action` skipped on any mutation (ADR-0201 enforcement, grep gate)
7. No phantom emit (ADR-0196 — `*_started` only with declared artefact)
8. RLS policies cover JWT + API key on all 5 tables
9. Calculate.ts unit tests cover all 3 algorithms × edge cases
10. Money-flow E2E test (Playwright): leader registers pool → adjusts row → approves → employee sees push + amount

## 18. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Beregning oppleves urettferdig | Vis transparente vekter + timer i UI; tillat justering med audit |
| Justering misbrukes av leder | `tip_adjustment_log` synlig for ansatt + admin (RLS via JOIN) |
| Bemanningsdata mangler | `tips.set_pot` returns error if no shifts in session; UI explains |
| Ansatt klager på beløp | Distribution-rad har full forklaring (timer × vekt × algoritme-snapshot JSONB) |
| Skattetrekk feilkonfigureres | Ute av scope (separate payroll-campaign); `payroll_period_id` schema-prep only |
| Endring av policy midt i lønnsperiode | Policy versjoneres; pool refererer `policy_id`; `algorithm_version_at_approval` snapshot |
| Phantom emit (L-0094 4. forekomst) | Phase 2.5 grep gate på registry før implementasjon |
| Default-allow CVE (L-0066 / L-0097) | Authority-seed migration uses CROSS JOIN VALUES (parity-scanner) — no default `read_only`+`gate_action` combo |

## 19. Success criteria

| Milestone | Goal |
|---|---|
| MVP live | Én avdeling registrerer + godkjenner tips daglig i 14 dager uten bug |
| Adopsjon | 100% av betalende hospitality-kunder bruker modulen innen 90 dager |
| Tillit | <5% av distributions justeres manuelt etter første måned |
| Lønn-prep | `payroll_period_id` populerbar fra framtidig payroll-campaign uten schema-endring |

## 20. Document references

- **Mockup:** `docs/superpowers/specs/2026-04-28-tips-handling-mockup.html` (interactive, 5 tabs, font-switcher locked to Cabinet Grotesk)
- **External draft:** `docs/architecture/SMARTOUT_TIPS_PRD.md`, `SMARTOUT_TIPS_ARCHITECURE.md`, `SMARTOUT_TIPS_UI_COMPS.md` (referenced for product shape; data model + integration pattern superseded by this hybrid)
- **Campaign roadmap:** `docs/plans/CAMPAIGN-tips-handling.md` (in `~/dev/smartout.ai-tips-handling`)
- **Companion ADR:** `docs/decisions/0203-cabinet-grotesk-display-font.md`

## 21. Open questions — resolved

1. ~~`tips.set_policy` 5th capability~~ → Direct Server Action on `tip_policy` (admin-only). No 5th capability.
2. ~~Push-notif preference~~ → **Push-notif dropped entirely from Tips campaign.** Defer to payroll-campaign (real money-event = real notification). Tips campaign emits `tip_pool.approved` to telemetry only; no user-facing push. AfterShiftView tile + Lønn-skjerm + NotificationSheet provide visibility without push.
3. ~~`paid` enum verdi~~ → Keep in enum (schema-stable). Tips campaign never sets `paid`; payroll-campaign sets it on payout.
4. ~~Cabinet Grotesk cutover timing~~ → Already handled in another branch. Out of scope here.

## 22. Workspace settings — tips on/off

**Master toggle:** Each workspace can enable or disable Tips entirely. When disabled: NOTHING shows anywhere — no tabs, no tiles, no notifications, no schema-fiction-style "ghost UI".

### 22.1 Storage

Single boolean on existing `workspace_setting` table (or `workspace.settings JSONB` if that's the canonical pattern):

```sql
-- Sortie 1 migration adds:
ALTER TABLE workspace_setting
  ADD COLUMN IF NOT EXISTS tips_enabled BOOLEAN NOT NULL DEFAULT false;
```

**Default `false`** — opt-in. Workspaces must explicitly enable Tips per their hospitality reality. Not all restaurants have tip culture.

(Phase 2.5 fact-check: verify which table pattern the codebase actually uses — `workspace_setting` row-per-key vs `workspace.settings JSONB` vs separate `workspace_*` flag tables. Use existing pattern, do not invent.)

### 22.2 Hook

NEW: `apps/web/src/hooks/use-tips-enabled.ts`

```typescript
export function useTipsEnabled(): { enabled: boolean; isLoading: boolean } {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;
  const { data, isLoading } = useQuery({
    queryKey: ["tips-enabled", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("workspace_setting")
        .select("tips_enabled")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      return data?.tips_enabled ?? false;
    },
  });
  return { enabled: data ?? false, isLoading };
}
```

Mobile mirror: `apps/mobile/src/hooks/queries/use-tips-enabled.ts`.

### 22.3 Gating per surface

Every tips-related UI element wraps `useTipsEnabled()` and renders nothing when disabled:

| Surface | Behavior when disabled |
|---|---|
| `DayControlPanel.OkonomiTab` | Tips `<section>` not rendered |
| `WebDayControl.SignoffTab` | No tips row in summary, no close-out gate |
| `reconciliation/DayDetail` TABS | "Tips"-tab filtered from TABS array |
| Mobile `AfterShiftView` | No tips tile |
| Mobile `/lonn` skjerm | "Tips-historikk"-section + period-card tips-row not rendered |
| Mobile `NotificationSheet` | Tips notif row-type filtered out |

Server-side gating (defense-in-depth):

| BFF route | Behavior when disabled |
|---|---|
| `POST /api/tips/pools` | Return 403 `{error: "tips_disabled"}` |
| `GET /api/tips/me` | Return `[]` empty array |
| `POST /api/tips/pools/[id]/approve` | Return 403 |
| `PATCH /api/tips/distributions/[id]` | Return 403 |

Capability tools also check workspace setting before any DB write — fail-CLOSED if disabled.

### 22.4 Settings UI (admin)

NEW: `apps/web/src/app/dashboard/settings/operations/tips/page.tsx`

Single toggle:

```
┌─────────────────────────────────────────┐
│ Tips-håndtering                         │
│                                         │
│ ⊙ På    ◯ Av                           │
│                                         │
│ Når aktivert: ledere kan registrere     │
│ kveldens tips i Okonomi-tab og fordele  │
│ via avstemming. Ansatte ser sin andel   │
│ i Lønn-skjermen.                        │
│                                         │
│ Når deaktivert: Tips skjules helt fra   │
│ alle skjermer. Eksisterende registrerte │
│ pools beholdes (ikke slettet) men er    │
│ ikke synlige.                           │
└─────────────────────────────────────────┘
```

Toggle = single Server Action UPDATE on `workspace_setting.tips_enabled`. RLS: only admin role can write.

### 22.5 Disable does not delete

Important: turning Tips off does NOT delete pools/distributions/policies/logs. Audit-trail intact. Re-enable = data reappears unchanged. Avoids accidental data loss.

### 22.6 Where this hooks into Sortie 1

Sortie 1 scope adds:
- Migration: `ALTER TABLE workspace_setting ADD COLUMN tips_enabled BOOLEAN NOT NULL DEFAULT false`
- Hook: `useTipsEnabled()` (web + mobile)
- Settings UI page: `dashboard/settings/operations/tips/page.tsx` (single-toggle)
- Server Action: `setTipsEnabledAction` (admin-gated)

Sortie 2 wires the hook into all leader UI surfaces. Sortie 3 wires it into mobile.

## 23. Sortie scope updates (post-feedback)

### Sortie 1 — `tips-data-model` (revised)

- 5 tables + RLS + capability skeleton + authority seed (CROSS JOIN VALUES) + 4 telemetry events + Phase 2.5 fact-check
- **+ workspace_setting.tips_enabled column + useTipsEnabled hook + settings toggle UI**

### Sortie 2 — `tips-leader-flows` (unchanged)

OkonomiTab tile + Inline form + SignoffTab gate + reconciliation Tips-tab + AdjustmentDialog + ApproveBar + BFF routes. All wrapped in `useTipsEnabled()` gate.

### Sortie 3 — `tips-employee-mobile` (revised — slimmer)

- use-tips hook + Lønn-skjerm + AfterShiftView tile + NotificationSheet row
- All wrapped in mobile `useTipsEnabled()` gate
- ~~Push-notif Edge Function~~ → **REMOVED.** Defer to payroll-campaign. TanStack invalidation on approval suffices for tile/skjerm refresh.

### Sortie 4 — `tips-e2e-audit` (unchanged)

Playwright money-flow journey + audit-trail-review + close-feature gate hardening.

**Total: ~8-12 dev-days (slightly reduced from earlier estimate due to dropped Edge Function).**
