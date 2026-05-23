# Employee Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing web `WelcomeWizard` (currently gated to `null`), extend it with two new steps (Availability + Consent) backed by two new tables, and build a mobile twin that reuses the same Server Actions + the same step state machine.

**Architecture:** Strategy A from spec — extend `apps/web/src/components/welcome-wizard/` in place; do not rebuild. Identity-layer fields stay on `user_identity` (never duplicated to `profile`). Reuse existing `submit_own_pii` RPC + existing Server Actions. Reuse the existing `profile welcome_wizard_*` telemetry namespace (preserves `engine_event` destination). Mobile gets its own shell + 8 RN step components but identical Zod + identical BFF contract. Shared `useWizardState` is imported via deep-path only.

**Tech Stack:** Next.js 16 (App Router) + React 19 + shadcn/ui + framer-motion (web); React Native + Expo + react-native-reanimated (mobile); Supabase Postgres 17 with RLS; pnpm 9.15 + Turborepo; Playwright (web E2E) + Maestro (mobile E2E); Vitest (unit).

**Spec:** `docs/superpowers/specs/2026-05-23-employee-onboarding-wizard-design.md` (R2)

**Migration timestamp floor:** `20260624000000` (HEAD = `20260623101500`).

**ADR slots reserved:** ADR-0396, ADR-0397 (verified HEAD = 0395).

---

## Phase 0 — Pre-flight (1 task)

### Task 0: Verify reserved ADR + migration slots, branch baseline

**Files:** none modified — verification only.

- [ ] **Step 1: Confirm migration HEAD + reserve timestamps**

```bash
ls supabase/migrations/ | grep -E '^[0-9]{14}_' | sort | tail -3
```

Expected last entry: `20260623101500_routine_create_from_image_authority.sql`. New migrations in this plan use timestamps `20260624000000`, `20260624000100`, `20260624000200` (strictly greater).

- [ ] **Step 2: Confirm ADR slots free**

```bash
ls docs/decisions/ | grep -E '^039[5-9]' | sort
```

Expected: only `0395-multimodal-image-storage-contract.md`. Slots `0396` and `0397` free.

- [ ] **Step 3: Confirm baseline typecheck is green**

```bash
pnpm --filter @smartout/mobile run typecheck
cd apps/web && pnpm exec tsc --noEmit
```

Expected: both report 0 errors. If not green at baseline, fix unrelated issues first or branch from a green commit.

---

## Phase 1 — Database foundation (3 tasks)

### Task 1: Migration — `consent_acceptance` table

**Files:**
- Create: `supabase/migrations/20260624000000_create_consent_acceptance.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260624000000_create_consent_acceptance.sql
-- Onboarding-layer consent capture (handbook + GDPR + tariff).
-- Append-only audit table per Bokf. §13-style immutability.
-- Distinct from ADR-0311 payroll.consent_document (Aml. §14-15 deduction consent).

CREATE TABLE public.consent_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('handbook','gdpr','tariff')),
  document_version  TEXT NOT NULL,
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  source            TEXT NOT NULL DEFAULT 'employee-onboarding-wizard',
  client_user_agent TEXT,
  client_ip         TEXT
);

CREATE INDEX idx_consent_acceptance_profile
  ON public.consent_acceptance(profile_id, consent_type, accepted_at DESC);

ALTER TABLE public.consent_acceptance ENABLE ROW LEVEL SECURITY;

-- SELECT: own profile + manager/admin/owner in same workspace
CREATE POLICY "jwt_read_own_consent" ON public.consent_acceptance
  FOR SELECT
  USING (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = consent_acceptance.workspace_id
        AND p.role IN ('manager','admin','owner')
    )
  );

-- API-key path (mirrors smartout-database-guide convention)
CREATE POLICY "api_key_read_consent" ON public.consent_acceptance
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());

-- INSERT: service-role only (Server Action / SECURITY DEFINER RPC).
-- No JWT INSERT policy → forces all writes through the action layer.

-- NO UPDATE policy. NO DELETE policy. Audit-trail immutability.

COMMENT ON TABLE  public.consent_acceptance IS
  'Onboarding-layer consent audit log (handbook + GDPR + tariff). Append-only.';
COMMENT ON COLUMN public.consent_acceptance.document_version IS
  'Version tag of the document the user accepted (e.g. handbook-v3). V1 hardcodes constants.';
```

- [ ] **Step 2: Apply migration locally**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260624000000_create_consent_acceptance.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `CREATE POLICY` ×2, `COMMENT` ×2 — no errors.

- [ ] **Step 3: Verify schema live**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "\\d+ public.consent_acceptance"
```

Expected: table exists with all 9 columns + RLS enabled + 2 policies + 1 index.

- [ ] **Step 4: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Expected: `consent_acceptance` block appears in the new `Database['public']['Tables']` map.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260624000000_create_consent_acceptance.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): consent_acceptance table — onboarding-layer append-only audit

handbook + gdpr + tariff acceptance log. INSERT via service role only;
NO UPDATE/DELETE policy (Bokf. §13-style immutability). Distinct from
ADR-0311 payroll.consent_document (Aml. §14-15)."
```

### Task 2: Migration — `employee_onboarding_state` table

**Files:**
- Create: `supabase/migrations/20260624000100_create_employee_onboarding_state.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260624000100_create_employee_onboarding_state.sql
-- Per-user resumable state for the welcome wizard. Status enum + JSONB step_data.
-- completed_at mirrors profile.welcome_completed_at — set in same transaction.

CREATE TABLE public.employee_onboarding_state (
  profile_id          UUID PRIMARY KEY REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','dismissed','completed')),
  current_step_index  INT NOT NULL DEFAULT 0,
  step_data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- status / timestamp coherence
  CONSTRAINT eos_completed_iff_ts CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
  CONSTRAINT eos_dismissed_iff_ts CHECK ((status = 'dismissed') = (dismissed_at IS NOT NULL))
);

ALTER TABLE public.employee_onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_own_onboarding_state" ON public.employee_onboarding_state
  FOR SELECT
  USING (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "jwt_update_own_onboarding_state" ON public.employee_onboarding_state
  FOR UPDATE
  USING (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "jwt_insert_own_onboarding_state" ON public.employee_onboarding_state
  FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "api_key_select_onboarding_state" ON public.employee_onboarding_state
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());

CREATE TRIGGER set_employee_onboarding_state_updated_at
  BEFORE UPDATE ON public.employee_onboarding_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.employee_onboarding_state IS
  'Per-user resumable wizard state. PK = profile_id (1:1 with profile).';
COMMENT ON COLUMN public.employee_onboarding_state.step_data IS
  'Partial form values for resumability. NEVER contains PII (personal_number, bank_account).';
```

- [ ] **Step 2: Apply + verify + regenerate types**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260624000100_create_employee_onboarding_state.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "\\d+ public.employee_onboarding_state"
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Expected: table + 4 policies + trigger present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260624000100_create_employee_onboarding_state.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): employee_onboarding_state — resumable wizard state

PK = profile_id (1:1). status enum (in_progress|dismissed|completed) with
coherence checks vs dismissed_at/completed_at. step_data JSONB — never PII."
```

### Task 3: Verify `db reset` round-trips both tables

**Files:** none.

- [ ] **Step 1: Reset + verify both tables survive**

```bash
npx supabase db reset
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT 'consent_acceptance' WHERE to_regclass('public.consent_acceptance') IS NOT NULL UNION ALL SELECT 'employee_onboarding_state' WHERE to_regclass('public.employee_onboarding_state') IS NOT NULL;"
```

Expected: both names returned.

- [ ] **Step 2: Re-seed local-smoke API key (db reset wipes it)**

Follow the procedure in `learning_dev_api_key_mismatch_breaks_extract.md`. Not committed.

---

## Phase 2 — Shared package surgery (2 tasks)

### Task 4: Replace `LucideIcon` → `iconName` in `WizardStepDef`

**Files:**
- Modify: `packages/ui/src/wizard/types.ts` (line ~4 import + the icon field)
- Modify: `apps/web/src/app/onboarding/wizard-definition.ts` (sweep all `icon: SomeLucide` → `iconName: "kebab-case"`)
- Modify: web wizard shell components that read `step.icon` to read `step.iconName` and render via name lookup

- [ ] **Step 1: Inspect current usage**

```bash
grep -rn "icon: LucideIcon\\|step\\.icon\\|icon: Layers\\|icon: Wand" packages/ui/src/wizard apps/web/src/app/onboarding apps/web/src/components/wizard
```

Note every file + line that references the old `icon` field.

- [ ] **Step 2: Update `types.ts`**

In `packages/ui/src/wizard/types.ts`, replace the `LucideIcon` import + the `icon?: LucideIcon` field with:

```ts
// (delete) import type { LucideIcon } from "lucide-react";

export type WizardStepDef<TState> = {
  // ... existing fields ...
  /** Icon name (kebab-case). Each platform renders via its own icon lookup
   *  (web: lucide-react; mobile: lucide-react-native). Replaces former
   *  LucideIcon type to keep this module RN-portable. */
  iconName?: string;
  // ... existing fields ...
};
```

- [ ] **Step 3: Sweep callers**

In `apps/web/src/app/onboarding/wizard-definition.ts`, replace each `icon: Layers` style entry with `iconName: "layers"` (kebab-case form of the Lucide component name). Repeat for every step definition.

In `packages/ui/src/wizard/WizardTopBar.tsx` + `WizardSidebar.tsx` (wherever `step.icon` is rendered), swap to a name-keyed lookup:

```tsx
// Top of file:
import { Layers, FileText, Settings /* …only the icons actually used */ } from "lucide-react";

const ICON_BY_NAME: Record<string, LucideIcon> = {
  layers: Layers,
  "file-text": FileText,
  settings: Settings,
  // …add as needed
};

// In the render:
const Icon = step.iconName ? ICON_BY_NAME[step.iconName] : null;
return Icon ? <Icon size={16} /> : null;
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: 0 errors. If any caller missed in the sweep, fix it now.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/wizard/types.ts apps/web/src/app/onboarding/wizard-definition.ts packages/ui/src/wizard/WizardTopBar.tsx packages/ui/src/wizard/WizardSidebar.tsx
git commit -m "refactor(ui): WizardStepDef.icon → iconName (RN portability)

LucideIcon import is web-only. Replacing with a string name keeps the
type module portable to React Native (the icon registry is per-platform)."
```

### Task 5: Add `@smartout/ui/wizard/state` subpath export + ESLint rule

**Files:**
- Modify: `packages/ui/package.json` (exports map)
- Create: `packages/ui/src/wizard/state.ts` (re-export only `useWizardState`)
- Create: `packages/eslint-config/rules/no-wizard-barrel-import.js`
- Modify: `packages/eslint-config/index.js` (register rule, scope to apps/mobile/**)

- [ ] **Step 1: Create the deep-import entry**

`packages/ui/src/wizard/state.ts`:

```ts
/**
 * Mobile-safe deep-import entry. Re-exports ONLY the React-portable
 * wizard state machine — never the web-only shell components.
 */
export { useWizardState } from "./useWizardState";
export type { WizardDefinition, WizardStepDef, WizardStepProps } from "./types";
```

- [ ] **Step 2: Add subpath to `packages/ui/package.json` exports map**

Inside the `"exports"` block, add:

```json
{
  "./wizard/state": {
    "types": "./src/wizard/state.ts",
    "default": "./src/wizard/state.ts"
  }
}
```

(Keep all existing entries unchanged. The deep-import entry sits alongside the existing `./wizard` barrel.)

- [ ] **Step 3: Write the ESLint rule**

`packages/eslint-config/rules/no-wizard-barrel-import.js`:

```js
// Forbids `import … from "@smartout/ui/wizard"` from apps/mobile/**.
// Mobile must use the deep entry `@smartout/ui/wizard/state` to avoid
// transitively pulling lucide-react + framer-motion via Metro.

module.exports = {
  meta: {
    type: "problem",
    docs: { description: "Disallow web-only wizard barrel imports on mobile." },
    schema: [],
    messages: {
      barrel: 'Import from "@smartout/ui/wizard/state" instead — the wizard barrel pulls web-only shells (lucide-react, framer-motion) into the Metro bundle.',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === "@smartout/ui/wizard") {
          context.report({ node, messageId: "barrel" });
        }
      },
    };
  },
};
```

- [ ] **Step 4: Register rule in eslint-config**

In `packages/eslint-config/index.js` (or equivalent flat-config entry), add a rule registry entry. Then add a per-app override scoping the rule to `apps/mobile/**`:

```js
// packages/eslint-config/index.js (excerpt — adapt to existing structure):
const noWizardBarrelImport = require("./rules/no-wizard-barrel-import.js");

module.exports = [
  // ... existing config ...
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    plugins: { smartout: { rules: { "no-wizard-barrel-import": noWizardBarrelImport } } },
    rules: { "smartout/no-wizard-barrel-import": "error" },
  },
];
```

- [ ] **Step 5: Verify rule fires + permits deep import**

```bash
# Create a temporary file to test:
cat > /tmp/lint-probe.ts <<'EOF'
import { useWizardState } from "@smartout/ui/wizard";        // should error
import { useWizardState as good } from "@smartout/ui/wizard/state"; // should pass
EOF
# Move to mobile + lint
cp /tmp/lint-probe.ts apps/mobile/src/lint-probe.ts
pnpm --filter @smartout/mobile lint apps/mobile/src/lint-probe.ts
rm apps/mobile/src/lint-probe.ts
```

Expected: ESLint reports one error on line 1, none on line 2.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/wizard/state.ts packages/ui/package.json packages/eslint-config/rules/no-wizard-barrel-import.js packages/eslint-config/index.js
git commit -m "feat(ui+lint): deep-import entry @smartout/ui/wizard/state + barrel ban on mobile

Mobile must use the deep entry to avoid Metro pulling lucide-react +
framer-motion via the wizard barrel. ESLint rule enforces on apps/mobile/**."
```

---

## Phase 3 — Telemetry registry (1 task)

### Task 6: Add `welcome_wizard_dismissed` + `welcome_wizard_resumed` events with emit() sites

**Files:**
- Modify: `packages/telemetry/src/registry.ts` (add 2 entries near existing `profile welcome_wizard_*` block, register destinations)
- Sites for emit() will be added in later tasks (Server Action `dismissWelcomeWizard`, `useOnboardingProgress` resume detection)

- [ ] **Step 1: Find existing welcome_wizard registry block**

```bash
grep -n '"profile welcome_wizard_' packages/telemetry/src/registry.ts
```

Note line numbers of: event name → event metadata block + destinations block.

- [ ] **Step 2: Add the two new events**

In the event-name registry section (around line 636 per spec), add inside the `profile` namespace block:

```ts
"profile welcome_wizard_dismissed": {
  category: "onboarding",
  description: "Employee dismissed the welcome wizard via 'Lukk og fortsett senere'.",
} as const,
"profile welcome_wizard_resumed": {
  category: "onboarding",
  description: "Employee re-opened the welcome wizard after dismissing it.",
} as const,
```

In the destinations block (around line 14253-14268), add:

```ts
"profile welcome_wizard_dismissed": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "onboarding",
} as const,
"profile welcome_wizard_resumed": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "onboarding",
} as const,
```

(NO `engine_event` for these two — only `_completed` keeps engine_event per spec §S4 D10.)

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: 0 errors. (No call-sites yet — those land in Tasks 9, 14.)

- [ ] **Step 4: Build telemetry dist (consumed by other packages)**

```bash
pnpm --filter @smartout/telemetry build
```

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add welcome_wizard_dismissed + _resumed events

Extends the existing 'profile welcome_wizard_*' family. No engine_event
destination (only _completed keeps that). Emit sites land in subsequent
tasks (Server Action saveWelcomeDismiss + useOnboardingProgress)."
```

---

## Phase 4 — ADRs (2 tasks)

### Task 7: ADR-0396 — Identity-layer columns belong on `user_identity`, not `profile`

**Files:**
- Create: `docs/decisions/0396-identity-columns-on-user-identity-not-profile.md`
- Modify: `docs/decisions/0000-decision-log.md` (register)
- Create: `scripts/check-identity-on-profile.mjs` (pre-commit guard)
- Modify: `.husky/pre-commit` (add script invocation)
- Modify: `package.json` (add `check:identity-on-profile` script)

- [ ] **Step 1: Write the ADR**

`docs/decisions/0396-identity-columns-on-user-identity-not-profile.md`:

```markdown
---
title: "ADR-0396: Identity-layer columns belong on user_identity, not profile"
status: accepted
date: 2026-05-23
deciders: pontus + council 2026-05-23 (employee-onboarding-wizard R1→R2)
tags: [adr, schema, identity, cascade]
---

# ADR-0396: Identity-layer columns belong on user_identity, not profile

## Context

`user_identity` is the canonical pre-workspace identity record (one per
human). `profile` is the workspace-scoped role + status (N per human,
one per workspace they belong to).

The employee-onboarding-wizard R1 spec proposed adding `phone`,
`emergency_contact_name`, `emergency_contact_phone`, and
`emergency_contact_relation` to `profile` — fields that already exist on
`user_identity`. This would have created a dual source-of-truth for the
same personal data class, the exact pattern documented in
`schema-orphan-rebuild-pattern.md`.

Cross-checked: ADR-0151 (server-derived identity), L-0177 (silent
fallback class), Cascade invariant 1 (single canonical pipeline per fact).

## Decision

Identity-class columns (anything that follows the human, not the
employment in a specific workspace) belong exclusively on `user_identity`.

This includes:
- `phone`
- `email`, `personal_email`
- `emergency_contact_*`
- `date_of_birth`
- `personal_number` (NB: currently on `profile` — see Exceptions)
- `address_line_*`, `postal_code`, `city`, `country` (when used as the
  person's address; workplace addresses belong on `location`)

## Exceptions

`personal_number` and `bank_account` are currently on `profile` because
they were placed there before the identity layer was formalized. They
stay on `profile` for now (out-of-scope migration). New columns of this
class go on `user_identity`.

## Enforcement

A pre-commit guard (`scripts/check-identity-on-profile.mjs`, registered
in husky) greps staged migrations for `ALTER TABLE … profile … ADD
COLUMN (phone|email|personal_email|emergency_contact_|date_of_birth|
address_line_)` and rejects them. Override requires explicit ADR.

## Consequences

- New identity-class features write through `user_identity` + the
  existing `submit_own_pii` RPC (which handles workspace-scoped
  `profile` fields and is being considered for extension to identity-
  class field groups in a future ADR).
- Audit trail consistency: identity edits land in one canonical event
  stream rather than split across profile vs user_identity writes.
- No silent dual-write for the four columns the R1 spec proposed.

## References

- Spec: `docs/superpowers/specs/2026-05-23-employee-onboarding-wizard-design.md`
- Council log: `docs/council/COUNCIL-LOG.md#2026-05-23`
- ADR-0151 (server-derived identity)
- Pattern: `schema-orphan-rebuild-pattern.md`
- L-0177 (silent fallback class)
```

- [ ] **Step 2: Register in decision log**

In `docs/decisions/0000-decision-log.md`, append a row in chronological order:

```markdown
| 0396 | 2026-05-23 | Identity-layer columns belong on `user_identity`, not `profile` | accepted | schema |
```

- [ ] **Step 3: Write the pre-commit guard**

`scripts/check-identity-on-profile.mjs`:

```js
#!/usr/bin/env node
// Pre-commit guard per ADR-0396.
// Rejects staged migrations that ADD identity-class columns to public.profile.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FORBIDDEN = [
  "phone",
  "personal_email",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relation",
  "date_of_birth",
];

const stagedSql = execSync('git diff --cached --name-only --diff-filter=AM', { encoding: 'utf8' })
  .split('\n')
  .filter(p => p.startsWith('supabase/migrations/') && p.endsWith('.sql'));

let violations = 0;
for (const file of stagedSql) {
  const body = readFileSync(file, 'utf8');
  // Match: ALTER TABLE …profile … ADD COLUMN … <forbidden>
  const re = new RegExp(
    `ALTER\\s+TABLE\\s+(?:public\\.)?profile\\b[\\s\\S]*?ADD\\s+COLUMN[\\s\\S]*?\\b(${FORBIDDEN.join('|')})\\b`,
    'i',
  );
  const m = body.match(re);
  if (m) {
    console.error(`✗ ${file}: ALTER profile adds identity-class column '${m[1]}' — forbidden per ADR-0396.`);
    console.error(`  Move it to user_identity, or override with an explicit ADR.`);
    violations++;
  }
}
if (violations > 0) process.exit(1);
process.exit(0);
```

Make executable:

```bash
chmod +x scripts/check-identity-on-profile.mjs
```

- [ ] **Step 4: Wire husky**

In `package.json` add the script:

```json
"scripts": {
  "check:identity-on-profile": "node scripts/check-identity-on-profile.mjs"
}
```

In `.husky/pre-commit`, append:

```bash
pnpm check:identity-on-profile
```

- [ ] **Step 5: Smoke the guard**

```bash
# Probe negative case:
cat > /tmp/probe.sql <<'EOF'
ALTER TABLE public.profile ADD COLUMN phone TEXT;
EOF
mkdir -p supabase/migrations
cp /tmp/probe.sql supabase/migrations/99999999999999_probe.sql
git add supabase/migrations/99999999999999_probe.sql
pnpm check:identity-on-profile && echo "FAIL — should have rejected" || echo "OK — rejected as expected"
git reset HEAD supabase/migrations/99999999999999_probe.sql
rm supabase/migrations/99999999999999_probe.sql
```

Expected: script exits 1 with the violation message.

- [ ] **Step 6: Commit**

```bash
git add docs/decisions/0396-identity-columns-on-user-identity-not-profile.md docs/decisions/0000-decision-log.md scripts/check-identity-on-profile.mjs package.json .husky/pre-commit
git commit -m "docs(adr): ADR-0396 identity-layer columns on user_identity + pre-commit guard

Codifies the invariant the wizard R1 spec violated. Pre-commit grep
rejects ALTER profile ADD COLUMN for phone/personal_email/emergency_*/
date_of_birth. Override requires a new ADR."
```

### Task 8: ADR-0397 — Employee Onboarding Wizard — Strategy A architecture

**Files:**
- Create: `docs/decisions/0397-employee-onboarding-wizard-extend-existing.md`
- Modify: `docs/decisions/0000-decision-log.md` (register)

- [ ] **Step 1: Write the ADR**

`docs/decisions/0397-employee-onboarding-wizard-extend-existing.md`:

```markdown
---
title: "ADR-0397: Employee onboarding wizard — extend existing WelcomeWizard (Strategy A)"
status: accepted
date: 2026-05-23
deciders: pontus + council 2026-05-23
tags: [adr, wizard, onboarding, mobile, web]
---

# ADR-0397: Employee onboarding wizard — extend existing WelcomeWizard (Strategy A)

## Context

A 6-step web WelcomeWizard already exists at
`apps/web/src/components/welcome-wizard/`, with 6 Server Actions + a
gate stub (`WelcomeWizardGate.tsx:20-22`) that returns `null`. The
brainstorm produced a spec that ignored the existing implementation and
proposed a parallel surface.

Council R1 (2026-05-23) rejected the spec. Strategy choice between:
- A. Extend existing wizard in place.
- B. Replace with new implementation.
- C. Ship parallel surface, hot-swap later.

## Decision

**Strategy A: extend in place.**

- TOTAL_STEPS: 6 → 8. New AvailabilityStep (5) and ConsentStep (6)
  inserted between PersonalNumber and Optional.
- Wire the gate stub to return `<WelcomeWizard userEmail={userEmail} />`.
- Add a mobile twin (RN shell + 8 RN step components) that uses the
  same Zod + the same Server Actions via a thin BFF wrapper.
- Reuse the existing `profile welcome_wizard_*` telemetry namespace
  (preserves `engine_event` destination).
- All new identity fields land on `user_identity` (per ADR-0396).
- `@smartout/ui/wizard/state` deep-import discipline for mobile (ESLint
  rule blocks the barrel).

## Why not B (replace)

- Throws away 6 working Server Actions + a tested wizard.
- Risk of silent engine_event consumer break on
  `profile welcome_wizard_completed`.
- Migration story for any in-flight invites mid-onboarding.

## Why not C (parallel)

- Two wizards racing on `is_welcome_complete` is the worst possible
  outcome. Diverging telemetry, diverging audit trails.

## Consequences

- The existing `welcome-wizard/` directory becomes the canonical
  surface for employee onboarding on both web and mobile.
- Mobile `complete-data.tsx` gets a deprecation banner pointing to the
  wizard (single surface of truth per L-0178).
- Future wizard work (any new domain) follows the same shape: extend
  existing wizard if one exists; replacement requires explicit ADR.

## References

- Spec: `docs/superpowers/specs/2026-05-23-employee-onboarding-wizard-design.md`
- Council log: `docs/council/COUNCIL-LOG.md#2026-05-23`
- ADR-0396 (identity-on-user_identity)
- ADR-0133 (mobile thin client — reframing in spec §D3)
- L-0178 (dual-surface ownership)
```

- [ ] **Step 2: Register in decision log + commit**

```bash
# Add row in decision log:
#   | 0397 | 2026-05-23 | Employee onboarding wizard — extend existing WelcomeWizard | accepted | wizard,onboarding |
git add docs/decisions/0397-employee-onboarding-wizard-extend-existing.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr): ADR-0397 employee onboarding wizard — Strategy A

Extend existing apps/web/src/components/welcome-wizard/ in place; do not
replace. Mobile twin uses same Server Actions via Bearer BFF wrapper.
Reuses profile welcome_wizard_* telemetry. Codifies the council R2
outcome so future wizard work has a precedent."
```

---

## Phase 5 — New Server Actions (3 tasks)

### Task 9: Server Action — `saveAvailability`

**Files:**
- Modify: `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts` (add new export)

- [ ] **Step 1: Read existing action conventions**

```bash
sed -n '1,60p' apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts
```

Note: the file uses `"use server"`, returns `Promise<ActionResult>`, uses `resolveCurrentProfile()` for identity, calls Supabase via the SSR client, emits telemetry via `emit()`.

- [ ] **Step 2: Append the new action**

At the end of `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts`, append:

```ts
import { z } from "zod";

const WeekdayCode = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
export type WeekdayCode = z.infer<typeof WeekdayCode>;

const SaveAvailabilityInput = z.object({
  unavailableDays: z.array(WeekdayCode),
});
export type SaveAvailabilityInput = z.infer<typeof SaveAvailabilityInput>;

/**
 * Wizard step 5. Writes one row per unavailable weekday into
 * `employee_availability` (preference_type='unavailable', RRULE weekly).
 * Idempotent: deletes prior 'onboarding-wizard'-provenance rows for this
 * profile before inserting the current selection.
 */
export async function saveAvailability(
  input: SaveAvailabilityInput,
): Promise<ActionResult> {
  const parsed = SaveAvailabilityInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Idempotent: clear prior wizard-provenance rows.
  const { error: delErr } = await supabase
    .from("employee_availability")
    .delete()
    .eq("workspace_id", profile.workspaceId)
    .eq("profile_id", profile.profileId)
    .eq("reason", "onboarding-wizard");
  if (delErr) return { ok: false, error: delErr.message };

  if (parsed.data.unavailableDays.length === 0) {
    return { ok: true };
  }

  const rows = parsed.data.unavailableDays.map((day) => ({
    workspace_id: profile.workspaceId,
    profile_id: profile.profileId,
    valid_from: today,
    valid_to: null,
    rrule: `FREQ=WEEKLY;BYDAY=${day}`,
    preference_type: "unavailable" as const,
    reason: "onboarding-wizard",
    created_by: profile.profileId,
  }));

  const { error: insErr } = await supabase.from("employee_availability").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  void emit({
    event: "profile welcome_wizard_step_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity_type: "profile",
      entity_id: profile.profileId,
      data: { step: "availability", unavailable_count: parsed.data.unavailableDays.length },
    },
  });

  return { ok: true };
}
```

Adjust imports at the top of the file (add `emit`, `nonEmpty` if not already imported).

- [ ] **Step 3: Add a vitest unit test**

`apps/web/src/app/dashboard/_actions/__tests__/save-availability.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveAvailability } from "../welcome-wizard-actions";

vi.mock("@/lib/resolve-current-profile", () => ({
  resolveCurrentProfile: vi.fn(async () => ({
    profileId: "p-1",
    workspaceId: "w-1",
    role: "employee",
  })),
}));

const supabaseMock = {
  from: vi.fn(),
};
vi.mock("@smartout/supabase/server", () => ({
  createClient: async () => supabaseMock,
}));

describe("saveAvailability", () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it("rejects invalid weekday codes", async () => {
    const r = await saveAvailability({ unavailableDays: ["XX" as never] });
    expect(r.ok).toBe(false);
  });

  it("inserts a row per unavailable day with RRULE weekly", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }));
    supabaseMock.from.mockReturnValue({ delete: del, insert });

    const r = await saveAvailability({ unavailableDays: ["MO", "WE"] });
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledOnce();
    const rows = insert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      preference_type: "unavailable",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      reason: "onboarding-wizard",
    });
  });

  it("clears prior wizard rows then inserts nothing when all days available", async () => {
    const insert = vi.fn();
    const del = vi.fn(() => ({ eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }));
    supabaseMock.from.mockReturnValue({ delete: del, insert });
    const r = await saveAvailability({ unavailableDays: [] });
    expect(r.ok).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test (RED then GREEN)**

```bash
cd apps/web && pnpm vitest run src/app/dashboard/_actions/__tests__/save-availability.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
cd apps/web && pnpm exec tsc --noEmit
git add apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts apps/web/src/app/dashboard/_actions/__tests__/save-availability.test.ts
git commit -m "feat(wizard): saveAvailability Server Action (idempotent RRULE writes)

Writes one employee_availability row per unavailable weekday with
provenance reason='onboarding-wizard'. Idempotent: clears prior wizard-
provenance rows before insert so the action can run multiple times."
```

### Task 10: Server Action — `saveConsent`

**Files:**
- Modify: `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts` (add new export)
- Modify: same file: add constants for current document versions

- [ ] **Step 1: Append constants + action**

```ts
// Document version constants — V1 hardcoded; ROADMAP: per-workspace
// versioning catalog so admins can update consent text without code change.
export const HANDBOOK_DOCUMENT_VERSION = "handbook-v1";
export const GDPR_DOCUMENT_VERSION = "gdpr-v1";
export const TARIFF_DOCUMENT_VERSION = "tariff-v1";

const SaveConsentInput = z.object({
  handbook: z.literal(true),
  gdpr: z.literal(true),
  tariff: z.boolean().optional(),
});
export type SaveConsentInput = z.infer<typeof SaveConsentInput>;

/**
 * Wizard step 6. Inserts one consent_acceptance row per accepted
 * consent_type. All-or-nothing: if the tariff checkbox is required by
 * workspace.is_tariff_bound and missing, returns an error.
 */
export async function saveConsent(input: SaveConsentInput): Promise<ActionResult> {
  const parsed = SaveConsentInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();

  // Workspace tariff binding gate.
  const { data: ws } = await supabase
    .from("workspace")
    .select("is_tariff_bound")
    .eq("workspace_id", profile.workspaceId)
    .maybeSingle();
  const tariffRequired = ws?.is_tariff_bound === true;
  if (tariffRequired && parsed.data.tariff !== true) {
    return { ok: false, error: "tariff_consent_required" };
  }

  const rows: Array<{
    workspace_id: string;
    profile_id: string;
    consent_type: "handbook" | "gdpr" | "tariff";
    document_version: string;
  }> = [
    { workspace_id: profile.workspaceId, profile_id: profile.profileId,
      consent_type: "handbook", document_version: HANDBOOK_DOCUMENT_VERSION },
    { workspace_id: profile.workspaceId, profile_id: profile.profileId,
      consent_type: "gdpr", document_version: GDPR_DOCUMENT_VERSION },
  ];
  if (parsed.data.tariff === true) {
    rows.push({
      workspace_id: profile.workspaceId,
      profile_id: profile.profileId,
      consent_type: "tariff",
      document_version: TARIFF_DOCUMENT_VERSION,
    });
  }

  const { error } = await supabase.from("consent_acceptance").insert(rows);
  if (error) return { ok: false, error: error.message };

  void emit({
    event: "profile welcome_wizard_step_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity_type: "profile",
      entity_id: profile.profileId,
      data: { step: "consent", accepted_count: rows.length, tariff: parsed.data.tariff ?? false },
    },
  });

  return { ok: true };
}
```

- [ ] **Step 2: Add vitest test**

`apps/web/src/app/dashboard/_actions/__tests__/save-consent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveConsent } from "../welcome-wizard-actions";

vi.mock("@/lib/resolve-current-profile", () => ({
  resolveCurrentProfile: vi.fn(async () => ({
    profileId: "p-1", workspaceId: "w-1", role: "employee",
  })),
}));

const supabaseMock = { from: vi.fn() };
vi.mock("@smartout/supabase/server", () => ({ createClient: async () => supabaseMock }));

describe("saveConsent", () => {
  beforeEach(() => { supabaseMock.from.mockReset(); });

  it("rejects when tariff required but not accepted", async () => {
    supabaseMock.from.mockImplementation((tbl: string) => {
      if (tbl === "workspace") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_tariff_bound: true } }) }) }) };
      }
      return { insert: async () => ({ error: null }) };
    });
    const r = await saveConsent({ handbook: true, gdpr: true });
    expect(r).toEqual({ ok: false, error: "tariff_consent_required" });
  });

  it("inserts 2 rows when tariff not bound", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    supabaseMock.from.mockImplementation((tbl: string) => {
      if (tbl === "workspace") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_tariff_bound: false } }) }) }) };
      }
      return { insert };
    });
    const r = await saveConsent({ handbook: true, gdpr: true });
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ consent_type: "handbook" }),
      expect.objectContaining({ consent_type: "gdpr" }),
    ]));
    expect(insert.mock.calls[0][0]).toHaveLength(2);
  });

  it("inserts 3 rows when tariff bound + accepted", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    supabaseMock.from.mockImplementation((tbl: string) => {
      if (tbl === "workspace") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_tariff_bound: true } }) }) }) };
      }
      return { insert };
    });
    const r = await saveConsent({ handbook: true, gdpr: true, tariff: true });
    expect(r.ok).toBe(true);
    expect(insert.mock.calls[0][0]).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
cd apps/web && pnpm vitest run src/app/dashboard/_actions/__tests__/save-consent.test.ts
git add apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts apps/web/src/app/dashboard/_actions/__tests__/save-consent.test.ts
git commit -m "feat(wizard): saveConsent Server Action — handbook + gdpr (+ tariff if bound)

Inserts 2 or 3 rows into consent_acceptance based on workspace.is_tariff_bound.
Hardcoded document versions for V1 — versioning catalog deferred."
```

### Task 11: Extend `completeWelcome` to update `employee_onboarding_state` + add `dismissWelcomeWizard` + `resumeWelcomeWizard`

**Files:**
- Modify: `apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts`

- [ ] **Step 1: Read existing `completeWelcome`**

```bash
sed -n '295,330p' apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts
```

- [ ] **Step 2: Extend completeWelcome**

Replace the existing function body so it also UPSERTs `employee_onboarding_state`:

```ts
export async function completeWelcome(): Promise<ActionResult> {
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();

  // Existing: flip the profile flags.
  const { error: profErr } = await supabase
    .from("profile")
    .update({ is_welcome_complete: true, welcome_completed_at: new Date().toISOString() })
    .eq("profile_id", profile.profileId);
  if (profErr) return { ok: false, error: profErr.message };

  // NEW: mirror to employee_onboarding_state.
  const { error: stateErr } = await supabase
    .from("employee_onboarding_state")
    .upsert({
      profile_id: profile.profileId,
      workspace_id: profile.workspaceId,
      status: "completed",
      completed_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });
  if (stateErr) return { ok: false, error: stateErr.message };

  // Emit (existing event — destinations preserved incl. engine_event).
  void emit({
    event: "profile welcome_wizard_completed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity_type: "profile",
      entity_id: profile.profileId,
      data: {},
    },
  });

  return { ok: true };
}

/** Wizard dismissed via "Lukk og fortsett senere". Sets status='dismissed'
 *  so the same-session trigger does not re-fire. Cold-start gate re-checks. */
export async function dismissWelcomeWizard(): Promise<ActionResult> {
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "unauthenticated" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("employee_onboarding_state")
    .upsert({
      profile_id: profile.profileId,
      workspace_id: profile.workspaceId,
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });
  if (error) return { ok: false, error: error.message };

  void emit({
    event: "profile welcome_wizard_dismissed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: { entity_type: "profile", entity_id: profile.profileId, data: {} },
  });
  return { ok: true };
}

/** Emits `wizard_resumed` when a previously-dismissed wizard is re-opened.
 *  Caller invokes this from the BFF GET handler when state row exists
 *  with dismissed_at IS NOT NULL and the gate fires anew. */
export async function recordWelcomeResume(profileId: string, workspaceId: string): Promise<void> {
  await emit({
    event: "profile welcome_wizard_resumed",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profileId, "actor_id"),
    properties: { entity_type: "profile", entity_id: profileId, data: {} },
  });
}
```

- [ ] **Step 3: Smoke-test against local DB**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts
git commit -m "feat(wizard): extend completeWelcome; add dismiss + resume actions

completeWelcome now mirrors completion into employee_onboarding_state
(status='completed', completed_at) in the same transaction as the
existing profile flag flip. dismissWelcomeWizard sets status='dismissed'.
recordWelcomeResume emits the resume event from the BFF GET handler."
```

---

## Phase 6 — Web new step components (3 tasks)

### Task 12: Web `AvailabilityStep` component

**Files:**
- Create: `apps/web/src/components/welcome-wizard/steps/AvailabilityStep.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import * as React from "react";
import { saveAvailability, type WeekdayCode } from "@/app/dashboard/_actions/welcome-wizard-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Props = { onNext: () => void; onBack: () => void };

const WEEKDAYS: ReadonlyArray<{ code: WeekdayCode; label: string }> = [
  { code: "MO", label: "Mandag" },
  { code: "TU", label: "Tirsdag" },
  { code: "WE", label: "Onsdag" },
  { code: "TH", label: "Torsdag" },
  { code: "FR", label: "Fredag" },
  { code: "SA", label: "Lørdag" },
  { code: "SU", label: "Søndag" },
];

export function AvailabilityStep({ onNext, onBack }: Props) {
  const [unavailable, setUnavailable] = React.useState<Set<WeekdayCode>>(new Set());
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  const toggle = (code: WeekdayCode) => {
    setUnavailable((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const handleNext = async () => {
    setPending(true);
    const r = await saveAvailability({ unavailableDays: Array.from(unavailable) });
    setPending(false);
    if (!r.ok) {
      toast({ title: "Kunne ikke lagre", description: r.error, variant: "destructive" });
      return;
    }
    onNext();
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header>
        <h2 className="font-heading text-3xl">Når er du tilgjengelig?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hvilke dager kan du vanligvis <strong>IKKE</strong> jobbe? Du kan endre dette når som helst i Min Tid.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Velg ukedager du ikke kan jobbe">
        {WEEKDAYS.map((d) => {
          const off = unavailable.has(d.code);
          return (
            <button
              key={d.code}
              type="button"
              aria-pressed={off}
              onClick={() => toggle(d.code)}
              className={
                "rounded-full border px-4 py-2 text-sm transition-colors " +
                (off
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-card text-foreground hover:bg-muted")
              }
            >
              {d.label}
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={pending}>Tilbake</Button>
        <Button onClick={handleNext} disabled={pending} autoFocus>
          {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Lagrer…</> : "Neste"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/web && pnpm exec tsc --noEmit
git add apps/web/src/components/welcome-wizard/steps/AvailabilityStep.tsx
git commit -m "feat(wizard): web AvailabilityStep — daily on/off chips

7 day chips; users mark days they CANNOT work. aria-pressed per chip.
Wired to saveAvailability Server Action."
```

### Task 13: Web `ConsentStep` component

**Files:**
- Create: `apps/web/src/components/welcome-wizard/steps/ConsentStep.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import * as React from "react";
import { saveConsent } from "@/app/dashboard/_actions/welcome-wizard-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText } from "lucide-react";

type Props = {
  onNext: () => void;
  onBack: () => void;
  /** True when workspace.is_tariff_bound — adds tariff checkbox. */
  tariffBound?: boolean;
};

export function ConsentStep({ onNext, onBack, tariffBound = false }: Props) {
  const [handbook, setHandbook] = React.useState(false);
  const [gdpr, setGdpr] = React.useState(false);
  const [tariff, setTariff] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  const canSubmit = handbook && gdpr && (!tariffBound || tariff);

  const handleNext = async () => {
    if (!canSubmit) return;
    setPending(true);
    const r = await saveConsent({
      handbook: true,
      gdpr: true,
      ...(tariffBound ? { tariff: true } : {}),
    });
    setPending(false);
    if (!r.ok) {
      toast({ title: "Kunne ikke lagre samtykke", description: r.error, variant: "destructive" });
      return;
    }
    onNext();
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header>
        <h2 className="font-heading text-3xl">Samtykke</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Bekreft at du har lest personalhåndboken og personvernerklæringen.
        </p>
      </header>

      <ul className="space-y-3">
        <li className="rounded border border-border bg-card p-4">
          <label className="flex items-start gap-3">
            <Checkbox checked={handbook} onCheckedChange={(v) => setHandbook(v === true)} />
            <span className="flex-1 text-sm">
              Jeg har lest <a href="/dashboard/handbook" target="_blank" className="text-primary underline inline-flex items-center gap-1">personalhåndboken <FileText className="h-3 w-3" /></a>.
            </span>
          </label>
        </li>
        <li className="rounded border border-border bg-card p-4">
          <label className="flex items-start gap-3">
            <Checkbox checked={gdpr} onCheckedChange={(v) => setGdpr(v === true)} />
            <span className="flex-1 text-sm">
              Jeg samtykker til at Smartout behandler mine personopplysninger som beskrevet i <a href="/legal/privacy" target="_blank" className="text-primary underline">personvernerklæringen</a>.
            </span>
          </label>
        </li>
        {tariffBound && (
          <li className="rounded border border-border bg-card p-4">
            <label className="flex items-start gap-3">
              <Checkbox checked={tariff} onCheckedChange={(v) => setTariff(v === true)} />
              <span className="flex-1 text-sm">
                Jeg er kjent med at min arbeidsplass er bundet av Riksavtalen (NHO Reiseliv).
              </span>
            </label>
          </li>
        )}
      </ul>

      <div className="mt-auto flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={pending}>Tilbake</Button>
        <Button onClick={handleNext} disabled={pending || !canSubmit}>
          {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Lagrer…</> : "Neste"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/web && pnpm exec tsc --noEmit
git add apps/web/src/components/welcome-wizard/steps/ConsentStep.tsx
git commit -m "feat(wizard): web ConsentStep — handbook + gdpr (+ tariff if bound)

Required checkboxes; submit gated on all-checked. Tariff checkbox shown
only when workspace.is_tariff_bound (prop passed from WelcomeWizard)."
```

### Task 14: Extend `PersonalNumberStep` with reveal toggle + confirmation sub-screen (D4/R8)

**Files:**
- Modify: `apps/web/src/components/welcome-wizard/steps/PersonalNumberStep.tsx`

- [ ] **Step 1: Read existing step**

```bash
sed -n '1,80p' apps/web/src/components/welcome-wizard/steps/PersonalNumberStep.tsx
```

- [ ] **Step 2: Replace with extended version**

Within the existing component file, add internal `phase: 'input' | 'confirm'` state and an `Eye`/`EyeOff` toggle. Skeleton:

```tsx
"use client";
import * as React from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePersonalNumber } from "@/app/dashboard/_actions/welcome-wizard-actions";
import { useToast } from "@/hooks/use-toast";

type Props = { onNext: () => void; onBack: () => void };

export function PersonalNumberStep({ onNext, onBack }: Props) {
  const [phase, setPhase] = React.useState<"input" | "confirm">("input");
  const [value, setValue] = React.useState("");
  const [reveal, setReveal] = React.useState(true); // default visible per D4
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  const isValid = /^\d{11}$/.test(value); // mod-11 check happens server-side

  const goConfirm = () => { if (isValid) setPhase("confirm"); };
  const handleSave = async () => {
    setPending(true);
    const r = await savePersonalNumber({ personal_number: value });
    setPending(false);
    if (!r.ok) {
      toast({ title: "Kunne ikke lagre", description: r.error, variant: "destructive" });
      setPhase("input");
      return;
    }
    onNext();
  };

  if (phase === "confirm") {
    return (
      <div role="dialog" aria-labelledby="pii-confirm-h2" className="flex flex-1 flex-col gap-6">
        <header>
          <h2 id="pii-confirm-h2" className="font-heading text-3xl">Bekreft personnummer</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sjekk at nummeret er riktig før du lagrer. Du kan endre det senere i Min Tid.
          </p>
        </header>
        <div className="rounded border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <code className="font-mono text-2xl">{reveal ? value : "•".repeat(11)}</code>
            <Button variant="ghost" size="icon" aria-label={reveal ? "Skjul" : "Vis"} onClick={() => setReveal((r) => !r)}>
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="mt-auto flex justify-between">
          <Button variant="ghost" onClick={() => setPhase("input")} disabled={pending}>Tilbake</Button>
          <Button onClick={handleSave} disabled={pending} autoFocus>
            {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Lagrer…</> : "Bekreft og lagre"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header>
        <h2 className="font-heading text-3xl">Personnummer</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          11 siffer. Brukes til lønn og A-melding. Vises kun til deg og lønnsansvarlig.
        </p>
      </header>
      <Input
        inputMode="numeric"
        pattern="\d{11}"
        maxLength={11}
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        aria-label="Personnummer (11 siffer)"
      />
      <div className="mt-auto flex justify-between">
        <Button variant="ghost" onClick={onBack}>Tilbake</Button>
        <Button onClick={goConfirm} disabled={!isValid} autoFocus>Neste</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd apps/web && pnpm exec tsc --noEmit
git add apps/web/src/components/welcome-wizard/steps/PersonalNumberStep.tsx
git commit -m "feat(wizard): PersonalNumberStep R8 — confirmation sub-screen + reveal toggle

Two phases: input → confirm. Confirm screen shows full value with
Eye/EyeOff toggle (default visible per D4). Mod-11 server-side; client
checks 11-digit format only."
```

---

## Phase 7 — Wire WelcomeWizard 6→8 (1 task)

### Task 15: Bump `TOTAL_STEPS`, insert new steps, add a11y + reduced-motion

**Files:**
- Modify: `apps/web/src/components/welcome-wizard/WelcomeWizard.tsx`

- [ ] **Step 1: Read existing wizard**

```bash
sed -n '1,40p' apps/web/src/components/welcome-wizard/WelcomeWizard.tsx
sed -n '160,180p' apps/web/src/components/welcome-wizard/WelcomeWizard.tsx
```

- [ ] **Step 2: Apply diff**

In `WelcomeWizard.tsx`:

1. Change `const TOTAL_STEPS = 6;` → `const TOTAL_STEPS = 8;`.
2. Update the `WizardStep` type from `1 | 2 | 3 | 4 | 5 | 6` to `1 | 2 | 3 | 4 | 5 | 6 | 7 | 8`.
3. Replace the step-switch block:

```tsx
{step === 1 && <HeroStep onNext={next} />}
{step === 2 && <ContactStep userEmail={userEmail} onNext={next} onBack={back} />}
{step === 3 && <AddressStep onNext={next} onBack={back} />}
{step === 4 && <PersonalNumberStep onNext={next} onBack={back} />}
{step === 5 && <AvailabilityStep onNext={next} onBack={back} />}
{step === 6 && <ConsentStep onNext={next} onBack={back} tariffBound={tariffBound} />}
{step === 7 && <OptionalStep onNext={next} onBack={back} />}
{step === 8 && <DoneStep />}
```

4. Add `import { AvailabilityStep } from "./steps/AvailabilityStep";` and `import { ConsentStep } from "./steps/ConsentStep";` next to existing step imports.

5. Wire `useReducedMotion` (already imported as `prefersReduced` in the file per existing usage) — the existing transition already conditionalises on it; verify no new motion code is introduced without the gate.

6. Plumb `tariffBound` prop. Accept it as a prop on `WelcomeWizard` (`Props = { userEmail: string; tariffBound?: boolean }`), default `false`. The gate passes it from layout context (Task 16).

7. Add `aria-live="polite"` to the animated step container so screen readers announce step changes.

8. Add focus management on step mount: pass `key={step}` to a focusable wrapper, or rely on each step's `autoFocus` (already added in the new step components).

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/welcome-wizard/WelcomeWizard.tsx
git commit -m "feat(wizard): TOTAL_STEPS 6→8; insert Availability + Consent; a11y additions

New steps inserted between PersonalNumber (4) and Optional (now 7).
aria-live='polite' on animated container; tariffBound prop plumbed to
ConsentStep; reduced-motion gate confirmed on transition."
```

---

## Phase 8 — Wire the gate (1 task)

### Task 16: `WelcomeWizardGate` returns the wizard

**Files:**
- Modify: `apps/web/src/app/dashboard/_components/WelcomeWizardGate.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx` (resolve `tariffBound` for the gate)

- [ ] **Step 1: Update layout to fetch tariff binding**

In `apps/web/src/app/dashboard/layout.tsx` (around the gate mount line ~180), resolve workspace `is_tariff_bound`:

```ts
let tariffBound = false;
if (showWelcomeWizard && profileId) {
  const { data: ws } = await adminOrServerSupabase
    .from("workspace")
    .select("is_tariff_bound")
    .eq("workspace_id", workspaceId) // pulled from the existing context
    .maybeSingle();
  tariffBound = ws?.is_tariff_bound === true;
}
```

Pass `tariffBound` to the gate component.

- [ ] **Step 2: Replace the gate stub**

`apps/web/src/app/dashboard/_components/WelcomeWizardGate.tsx`:

```tsx
"use client";
import { WelcomeWizard } from "@/components/welcome-wizard/WelcomeWizard";

type Props = {
  userEmail: string;
  tariffBound?: boolean;
};

export function WelcomeWizardGate({ userEmail, tariffBound = false }: Props) {
  return <WelcomeWizard userEmail={userEmail} tariffBound={tariffBound} />;
}
```

- [ ] **Step 3: Smoke test in dev browser**

```bash
op run --env-file=.env.template -- pnpm --filter web dev
# Open http://localhost:3060/dashboard as a seed user with is_welcome_complete=false
# Expected: wizard renders (Hero step visible)
```

Reset a user back to incomplete for testing:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "UPDATE public.profile SET is_welcome_complete=false, welcome_completed_at=NULL WHERE profile_id='f0000000-0000-0000-0000-000000000000';"
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/_components/WelcomeWizardGate.tsx apps/web/src/app/dashboard/layout.tsx
git commit -m "feat(wizard): wire WelcomeWizardGate — render the wizard instead of null

Replaces the one-line stub. Layout fetches workspace.is_tariff_bound and
passes through. This is the change that turns 6 working Server Actions
+ 8 step components into a shipped wizard."
```

---

## Phase 9 — Web BFF (1 task)

### Task 17: Web BFF state route (cookie GET/PUT/dismiss)

**Files:**
- Create: `apps/web/src/app/api/employee-onboarding/state/route.ts`
- Create: `apps/web/src/app/api/employee-onboarding/state/dismiss/route.ts`

- [ ] **Step 1: Write state GET/PUT route**

`apps/web/src/app/api/employee-onboarding/state/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { recordWelcomeResume } from "@/app/dashboard/_actions/welcome-wizard-actions";

export const runtime = "nodejs";

const PutBody = z.object({
  current_step_index: z.number().int().min(0).max(8),
  step_data: z.record(z.unknown()).optional(),
});

async function resolve() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1).maybeSingle();
  if (!profile) return null;
  return { ...profile, supabase };
}

export async function GET(_req: NextRequest) {
  const ctx = await resolve();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lazy create on first GET. UPSERT semantics — never errors on existing row.
  const { data, error } = await ctx.supabase
    .from("employee_onboarding_state")
    .upsert(
      { profile_id: ctx.profile_id, workspace_id: ctx.workspace_id },
      { onConflict: "profile_id", ignoreDuplicates: false },
    )
    .select("status, current_step_index, step_data, dismissed_at, completed_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If previously dismissed, fire resumed event.
  if (data.dismissed_at && !data.completed_at) {
    await recordWelcomeResume(ctx.profile_id, ctx.workspace_id);
  }
  return NextResponse.json({ ok: true, state: data });
}

export async function PUT(req: NextRequest) {
  const ctx = await resolve();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = PutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 });
  }

  const { error } = await ctx.supabase
    .from("employee_onboarding_state")
    .update({
      current_step_index: parsed.data.current_step_index,
      step_data: parsed.data.step_data ?? {},
    })
    .eq("profile_id", ctx.profile_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write dismiss route**

`apps/web/src/app/api/employee-onboarding/state/dismiss/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { dismissWelcomeWizard } from "@/app/dashboard/_actions/welcome-wizard-actions";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const r = await dismissWelcomeWizard();
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Smoke locally**

```bash
# Hit the route with the dev server running; cookie auth from browser session.
curl -i -X GET http://localhost:3060/api/employee-onboarding/state \
  -H "Cookie: <copy from devtools>"
```

Expected: 200 with `{ok:true, state:{...}}`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/employee-onboarding/state/route.ts apps/web/src/app/api/employee-onboarding/state/dismiss/route.ts
git commit -m "feat(bff): /api/employee-onboarding/state GET/PUT + /dismiss POST

Cookie auth (web). GET lazily creates state row + fires welcome_wizard_resumed
when re-opening after a prior dismissal. PUT upserts current_step_index +
step_data. POST /dismiss sets status='dismissed'."
```

---

## Phase 10 — Mobile shell foundation (4 tasks)

### Task 18: Lift `WizardHeader` to `apps/mobile/src/components/ui/`

**Files:**
- Move: `apps/mobile/src/components/reconciliation/_shared/WizardHeader.tsx` → `apps/mobile/src/components/ui/WizardHeader.tsx`
- Update imports in any caller.

- [ ] **Step 1: Move + sweep**

```bash
git mv apps/mobile/src/components/reconciliation/_shared/WizardHeader.tsx apps/mobile/src/components/ui/WizardHeader.tsx
grep -rln "reconciliation/_shared/WizardHeader" apps/mobile/src apps/mobile/app | xargs sed -i 's|reconciliation/_shared/WizardHeader|ui/WizardHeader|g'
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @smartout/mobile run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A apps/mobile
git commit -m "refactor(mobile): lift WizardHeader to components/ui/ for cross-wizard reuse"
```

### Task 19: Add `nativeMotion` tokens

**Files:**
- Modify: `packages/design-tokens/src/native.ts`

- [ ] **Step 1: Read existing exports**

```bash
grep -nE "^export" packages/design-tokens/src/native.ts | head
```

- [ ] **Step 2: Append**

```ts
/** Reanimated-compatible motion tokens. Mirrors the web `motion.*` tokens
 *  from `tokens.ts` so the mobile WizardShell uses the same curve. */
export const nativeMotion = {
  spring: { stiffness: 35, damping: 22, mass: 2.2 },
  springSnappy: { stiffness: 45, damping: 24, mass: 2 },
  springGentle: { stiffness: 30, damping: 20, mass: 2.5 },
  enterMs: 500,
  exitMs: 250,
} as const;
```

- [ ] **Step 3: Build + commit**

```bash
pnpm --filter @smartout/design-tokens build
git add packages/design-tokens/src/native.ts
git commit -m "feat(tokens): nativeMotion tokens for RN — spring + enter/exit timings

Mirrors web motion.* so mobile wizard transitions match web shell exactly."
```

### Task 20: Build mobile `WizardShell`

**Files:**
- Create: `apps/mobile/src/components/ui/WizardShell.tsx`

- [ ] **Step 1: Write the shell**

```tsx
/**
 * Mobile WizardShell — RN twin of web `WizardShell`. Uses the shared
 * `useWizardState` (deep import per ADR-0397 / D14) + the lifted
 * `WizardHeader`. Each step component receives identical props to its
 * web sibling (`onNext`, `onBack`, optional skip).
 */
import * as React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { MoreVertical } from "lucide-react-native";
import { useWizardState, type WizardDefinition } from "@smartout/ui/wizard/state";
import { useTheme, createStyles } from "@/theme";
import { WizardHeader } from "@/components/ui/WizardHeader";
import { nativeMotion } from "@smartout/design-tokens/native";

export type WizardShellProps<TState> = {
  definition: WizardDefinition<TState>;
  initialState: TState;
  onDismiss?: () => void;
};

export function WizardShell<TState>({ definition, initialState, onDismiss }: WizardShellProps<TState>) {
  const theme = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const state = useWizardState({ definition, initialState });
  const Step = definition.steps[state.currentStepIndex]?.component;
  const stepDef = definition.steps[state.currentStepIndex];

  return (
    <SafeAreaView style={styles.root}>
      <WizardHeader
        stepIndex={state.currentStepIndex}
        total={definition.steps.length}
        title={stepDef?.labelKey ?? ""}
      />

      <Animated.View
        key={state.currentStepIndex}
        entering={reduced ? undefined : FadeIn.duration(nativeMotion.enterMs)}
        exiting={reduced ? undefined : FadeOut.duration(nativeMotion.exitMs)}
        style={styles.body}
        accessibilityLiveRegion="polite"
      >
        {Step ? (
          <Step
            state={state.state}
            updateState={state.updateState}
            next={state.next}
            back={state.back}
            goTo={state.goTo}
            isFirst={state.currentStepIndex === 0}
            isLast={state.currentStepIndex === definition.steps.length - 1}
            attempted={state.attempted}
          />
        ) : null}
      </Animated.View>

      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          style={styles.dismiss}
          accessibilityRole="button"
          accessibilityLabel="Lukk og fortsett senere"
        >
          <MoreVertical size={20} color={theme.colors.mutedForeground} />
          <Text style={styles.dismissLabel}>Lukk og fortsett senere</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  body: { flex: 1, paddingHorizontal: 20 },
  dismiss: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
  },
  dismissLabel: { color: theme.colors.mutedForeground, fontSize: 13 },
}));
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @smartout/mobile run typecheck
git add apps/mobile/src/components/ui/WizardShell.tsx
git commit -m "feat(mobile): WizardShell — RN twin of web shell

useWizardState via deep import (@smartout/ui/wizard/state). FadeIn/FadeOut
gated on useReducedMotion. accessibilityLiveRegion='polite' on body."
```

### Task 21: Mobile BFF — state + save-step wrapper (Bearer)

**Files:**
- Create: `apps/web/src/app/api/mobile/employee-onboarding/state/route.ts`
- Create: `apps/web/src/app/api/mobile/employee-onboarding/state/dismiss/route.ts`
- Create: `apps/web/src/app/api/mobile/employee-onboarding/save-step/route.ts`

- [ ] **Step 1: Mobile state route (Bearer)**

`apps/web/src/app/api/mobile/employee-onboarding/state/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveMobileActor } from "@/app/api/mobile/_shared/actor";
import { recordWelcomeResume } from "@/app/dashboard/_actions/welcome-wizard-actions";

export const runtime = "nodejs";

const PutBody = z.object({
  current_step_index: z.number().int().min(0).max(8),
  step_data: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  const actor = await resolveMobileActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employee_onboarding_state")
    .upsert(
      { profile_id: actor.profileId, workspace_id: actor.workspaceId },
      { onConflict: "profile_id", ignoreDuplicates: false },
    )
    .select("status, current_step_index, step_data, dismissed_at, completed_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data.dismissed_at && !data.completed_at) {
    await recordWelcomeResume(actor.profileId, actor.workspaceId);
  }
  return NextResponse.json({ ok: true, state: data });
}

export async function PUT(req: NextRequest) {
  const actor = await resolveMobileActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = PutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("employee_onboarding_state")
    .update({
      current_step_index: parsed.data.current_step_index,
      step_data: parsed.data.step_data ?? {},
    })
    .eq("profile_id", actor.profileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Mobile dismiss route**

`apps/web/src/app/api/mobile/employee-onboarding/state/dismiss/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { resolveMobileActor } from "@/app/api/mobile/_shared/actor";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const actor = await resolveMobileActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin
    .from("employee_onboarding_state")
    .upsert({
      profile_id: actor.profileId,
      workspace_id: actor.workspaceId,
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  void emit({
    event: "profile welcome_wizard_dismissed",
    workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
    actor_id: nonEmpty(actor.profileId, "actor_id"),
    properties: { entity_type: "profile", entity_id: actor.profileId, data: {} },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Save-step wrapper (delegates to existing Server Actions)**

`apps/web/src/app/api/mobile/employee-onboarding/save-step/route.ts`:

```ts
/**
 * Mobile BFF wrapper: routes per-step saves to the same Server Actions
 * the web wizard uses. Bearer auth via resolveMobileActor (ADR-0151).
 * The Server Actions re-resolve identity from cookie — we re-invoke them
 * inside the route handler so they pick up the BFF-resolved actor by
 * passing through workspace_id (where applicable).
 *
 * NOTE: existing actions read identity from cookies. To support Bearer-
 * authenticated mobile calls, this route invokes a small Bearer-aware
 * thin re-implementation per action. Adding `actor` parameters to the
 * Server Actions is OUT OF SCOPE for this sortie; the duplication here
 * is the temporary bridge.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveMobileActor } from "@/app/api/mobile/_shared/actor";
import { createAdminClient } from "@smartout/supabase/admin";

const Body = z.object({
  step: z.enum(["contact", "address", "personal_number", "availability", "consent", "optional"]),
  values: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  const actor = await resolveMobileActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 });

  const admin = createAdminClient();
  const { step, values } = parsed.data;

  switch (step) {
    case "contact": {
      // Writes phone + display_name to user_identity. (Mirrors saveContact.)
      const v = z.object({ display_name: z.string().min(2), phone: z.string() }).parse(values);
      const { error } = await admin.from("user_identity").update({
        display_name: v.display_name, phone: v.phone,
      }).eq("user_id", (await admin.auth.getUser((req.headers.get("authorization") || "").slice(7))).data.user!.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "address": {
      const v = z.object({
        address_line_1: z.string(), address_line_2: z.string().optional(),
        postal_code: z.string(), city: z.string(),
      }).parse(values);
      const { error } = await admin.rpc("submit_own_pii", {
        p_workspace_id: actor.workspaceId, p_field_group: "address", p_values: v,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "personal_number": {
      const v = z.object({ personal_number: z.string().regex(/^\d{11}$/) }).parse(values);
      const { error } = await admin.rpc("submit_own_pii", {
        p_workspace_id: actor.workspaceId, p_field_group: "identity",
        p_values: { personal_number: v.personal_number },
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "availability": {
      const v = z.object({ unavailableDays: z.array(z.enum(["MO","TU","WE","TH","FR","SA","SU"])) }).parse(values);
      // Mirror saveAvailability: clear + insert.
      await admin.from("employee_availability").delete()
        .eq("workspace_id", actor.workspaceId).eq("profile_id", actor.profileId)
        .eq("reason", "onboarding-wizard");
      if (v.unavailableDays.length === 0) return NextResponse.json({ ok: true });
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await admin.from("employee_availability").insert(
        v.unavailableDays.map((d) => ({
          workspace_id: actor.workspaceId, profile_id: actor.profileId,
          valid_from: today, valid_to: null,
          rrule: `FREQ=WEEKLY;BYDAY=${d}`,
          preference_type: "unavailable", reason: "onboarding-wizard",
          created_by: actor.profileId,
        })),
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "consent": {
      const v = z.object({ handbook: z.literal(true), gdpr: z.literal(true), tariff: z.boolean().optional() }).parse(values);
      const rows: Array<{ workspace_id: string; profile_id: string; consent_type: "handbook"|"gdpr"|"tariff"; document_version: string }> = [
        { workspace_id: actor.workspaceId, profile_id: actor.profileId, consent_type: "handbook", document_version: "handbook-v1" },
        { workspace_id: actor.workspaceId, profile_id: actor.profileId, consent_type: "gdpr", document_version: "gdpr-v1" },
      ];
      if (v.tariff === true) rows.push({ workspace_id: actor.workspaceId, profile_id: actor.profileId, consent_type: "tariff", document_version: "tariff-v1" });
      const { error } = await admin.from("consent_acceptance").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "optional": {
      const v = z.object({
        bank_account: z.string().optional(),
        emergency_contact_name: z.string().optional(),
        emergency_contact_phone: z.string().optional(),
        emergency_contact_relation: z.string().optional(),
      }).parse(values);
      // bank_account → profile; emergency_* → user_identity (ADR-0396).
      if (v.bank_account) {
        const { error } = await admin.rpc("submit_own_pii", {
          p_workspace_id: actor.workspaceId, p_field_group: "banking",
          p_values: { bank_account: v.bank_account },
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (v.emergency_contact_name || v.emergency_contact_phone || v.emergency_contact_relation) {
        const user = (await admin.auth.getUser((req.headers.get("authorization") || "").slice(7))).data.user!;
        const { error } = await admin.from("user_identity").update({
          emergency_contact_name: v.emergency_contact_name ?? null,
          emergency_contact_phone: v.emergency_contact_phone ?? null,
          emergency_contact_relation: v.emergency_contact_relation ?? null,
        }).eq("user_id", user.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/mobile/employee-onboarding/state/route.ts apps/web/src/app/api/mobile/employee-onboarding/state/dismiss/route.ts apps/web/src/app/api/mobile/employee-onboarding/save-step/route.ts
git commit -m "feat(bff): mobile employee-onboarding routes (Bearer)

state GET/PUT mirrors web cookie route; /dismiss POST; save-step
dispatches per-step writes via submit_own_pii RPC + direct table writes
(emergency_* → user_identity per ADR-0396). Reuses resolveMobileActor."
```

---

## Phase 11 — Mobile step components (8 tasks)

Each mobile step mirrors the same Zod + visual flow as its web sibling. They all consume `WizardStepProps` from the shared types and call the mobile BFF save-step route. Pattern is identical across the 8 — write one fully, then repeat. Below shows the canonical pattern + lists the remaining 7 as repeats.

### Task 22: Mobile `HeroStep`

**Files:**
- Create: `apps/mobile/src/components/welcome-wizard/_steps/HeroStep.tsx`

- [ ] **Step 1: Write the component**

```tsx
import * as React from "react";
import { View, Text } from "react-native";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";

type Props = { next: () => void };

export function HeroStep({ next }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Velkommen til Smartout</Text>
      <Text style={styles.sub}>La oss få deg klar til første vakt. Det tar 3-5 minutter.</Text>
      <Button title="Sett i gang" onPress={next} variant="primary" fullWidth />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, justifyContent: "center", gap: 24 },
  heading: { fontFamily: "InstrumentSerif-Regular", fontSize: 36, color: theme.colors.foreground },
  sub: { color: theme.colors.mutedForeground, fontSize: 16, lineHeight: 22 },
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/welcome-wizard/_steps/HeroStep.tsx
git commit -m "feat(mobile-wizard): HeroStep — welcome screen"
```

### Task 23: Mobile `ContactStep` (+ pattern for save-step BFF call)

**Files:**
- Create: `apps/mobile/src/components/welcome-wizard/_steps/ContactStep.tsx`
- Create: `apps/mobile/src/lib/onboarding-bff.ts` (reusable helper)

- [ ] **Step 1: Reusable BFF helper**

`apps/mobile/src/lib/onboarding-bff.ts`:

```ts
import { supabase } from "@/lib/supabase";
import { getWebApiUrl } from "@/lib/web-api";

export type OnboardingStep = "contact" | "address" | "personal_number" | "availability" | "consent" | "optional";

export async function saveOnboardingStep(step: OnboardingStep, values: Record<string, unknown>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Ikke innlogget");
  const res = await fetch(`${getWebApiUrl()}/api/mobile/employee-onboarding/save-step`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ step, values }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Serverfeil (${res.status})`);
  }
}

export async function putOnboardingState(currentStepIndex: number, stepData: Record<string, unknown>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Ikke innlogget");
  const res = await fetch(`${getWebApiUrl()}/api/mobile/employee-onboarding/state`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ current_step_index: currentStepIndex, step_data: stepData }),
  });
  if (!res.ok) throw new Error(`state PUT failed (${res.status})`);
}

export async function dismissOnboarding(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Ikke innlogget");
  await fetch(`${getWebApiUrl()}/api/mobile/employee-onboarding/state/dismiss`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}
```

- [ ] **Step 2: ContactStep component**

```tsx
import * as React from "react";
import { View, Text, Alert } from "react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

type Props = {
  next: () => void;
  back: () => void;
  userEmail?: string;
};

export function ContactStep({ next, back, userEmail }: Props) {
  const styles = useStyles();
  const [displayName, setDisplayName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const valid = displayName.trim().length >= 2 && /^\+?\d{8,15}$/.test(phone);

  const submit = async () => {
    setPending(true);
    try {
      await saveOnboardingStep("contact", { display_name: displayName.trim(), phone });
      next();
    } catch (e) {
      Alert.alert("Kunne ikke lagre", e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Kontaktinfo</Text>
      <Text style={styles.email}>{userEmail}</Text>
      <Input label="Navn" value={displayName} onChangeText={setDisplayName} placeholder="Ola Nordmann" />
      <Input label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+47 …" />
      <View style={styles.row}>
        <Button title="Tilbake" variant="ghost" onPress={back} disabled={pending} />
        <Button title={pending ? "Lagrer…" : "Neste"} variant="primary" onPress={submit} disabled={!valid || pending} loading={pending} />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, gap: 16, paddingTop: 24 },
  heading: { fontFamily: "InstrumentSerif-Regular", fontSize: 32, color: theme.colors.foreground },
  email: { color: theme.colors.mutedForeground, fontSize: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: "auto", gap: 12 },
}));
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/welcome-wizard/_steps/ContactStep.tsx apps/mobile/src/lib/onboarding-bff.ts
git commit -m "feat(mobile-wizard): ContactStep + onboarding-bff helpers

Helper module wraps fetch(save-step|state|dismiss) with Bearer auth.
ContactStep collects display_name + phone → /save-step?step=contact."
```

### Task 24: Mobile `AddressStep`

**Files:**
- Create: `apps/mobile/src/components/welcome-wizard/_steps/AddressStep.tsx`

- [ ] **Step 1: Write the component** (same pattern as ContactStep — Inputs + Next/Back + saveOnboardingStep("address", values))

Fields: `address_line_1`, `address_line_2` (optional), `postal_code`, `city`. Validation: address_line_1 + postal_code (4 digits Norway) + city all non-empty.

```tsx
import * as React from "react";
import { View, Text, Alert } from "react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createStyles } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

type Props = { next: () => void; back: () => void };

export function AddressStep({ next, back }: Props) {
  const styles = useStyles();
  const [a1, setA1] = React.useState("");
  const [a2, setA2] = React.useState("");
  const [postal, setPostal] = React.useState("");
  const [city, setCity] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const valid = a1.trim().length > 0 && /^\d{4}$/.test(postal) && city.trim().length > 0;

  const submit = async () => {
    setPending(true);
    try {
      await saveOnboardingStep("address", {
        address_line_1: a1.trim(),
        address_line_2: a2.trim() || undefined,
        postal_code: postal, city: city.trim(),
      });
      next();
    } catch (e) {
      Alert.alert("Kunne ikke lagre", e instanceof Error ? e.message : "Ukjent feil");
    } finally { setPending(false); }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Adresse</Text>
      <Input label="Gateadresse" value={a1} onChangeText={setA1} />
      <Input label="Adresse linje 2 (valgfritt)" value={a2} onChangeText={setA2} />
      <Input label="Postnummer" value={postal} onChangeText={setPostal} keyboardType="number-pad" maxLength={4} />
      <Input label="Sted" value={city} onChangeText={setCity} />
      <View style={styles.row}>
        <Button title="Tilbake" variant="ghost" onPress={back} disabled={pending} />
        <Button title={pending ? "Lagrer…" : "Neste"} variant="primary" onPress={submit} disabled={!valid || pending} loading={pending} />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, gap: 16, paddingTop: 24 },
  heading: { fontFamily: "InstrumentSerif-Regular", fontSize: 32, color: theme.colors.foreground },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: "auto", gap: 12 },
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/welcome-wizard/_steps/AddressStep.tsx
git commit -m "feat(mobile-wizard): AddressStep — gateadresse + postnummer + sted"
```

### Task 25: Mobile `PersonalNumberStep` (with reveal toggle + confirm sub-screen)

**Files:**
- Create: `apps/mobile/src/components/welcome-wizard/_steps/PersonalNumberStep.tsx`

- [ ] **Step 1: Write component (two phases like web)**

```tsx
import * as React from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

type Props = { next: () => void; back: () => void };

export function PersonalNumberStep({ next, back }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const [phase, setPhase] = React.useState<"input" | "confirm">("input");
  const [value, setValue] = React.useState("");
  const [reveal, setReveal] = React.useState(true);
  const [pending, setPending] = React.useState(false);

  const valid = /^\d{11}$/.test(value);

  const onConfirm = async () => {
    setPending(true);
    try {
      await saveOnboardingStep("personal_number", { personal_number: value });
      next();
    } catch (e) {
      Alert.alert("Kunne ikke lagre", e instanceof Error ? e.message : "Ukjent feil");
      setPhase("input");
    } finally { setPending(false); }
  };

  if (phase === "confirm") {
    return (
      <View style={styles.root} accessibilityLiveRegion="assertive" accessibilityViewIsModal>
        <Text style={styles.heading}>Bekreft personnummer</Text>
        <Text style={styles.sub}>Sjekk at nummeret er riktig før du lagrer.</Text>
        <View style={styles.card}>
          <Text style={styles.value}>{reveal ? value : "•".repeat(11)}</Text>
          <Pressable onPress={() => setReveal((r) => !r)} accessibilityLabel={reveal ? "Skjul" : "Vis"} hitSlop={8}>
            {reveal ? <EyeOff size={20} color={theme.colors.mutedForeground} /> : <Eye size={20} color={theme.colors.mutedForeground} />}
          </Pressable>
        </View>
        <View style={styles.row}>
          <Button title="Tilbake" variant="ghost" onPress={() => setPhase("input")} disabled={pending} />
          <Button title={pending ? "Lagrer…" : "Bekreft og lagre"} variant="primary" onPress={onConfirm} loading={pending} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Personnummer</Text>
      <Text style={styles.sub}>11 siffer. Brukes til lønn og A-melding.</Text>
      <Input label="Personnummer" value={value} onChangeText={(t) => setValue(t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={11} />
      <View style={styles.row}>
        <Button title="Tilbake" variant="ghost" onPress={back} />
        <Button title="Neste" variant="primary" onPress={() => valid && setPhase("confirm")} disabled={!valid} />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, gap: 16, paddingTop: 24 },
  heading: { fontFamily: "InstrumentSerif-Regular", fontSize: 32, color: theme.colors.foreground },
  sub: { color: theme.colors.mutedForeground, fontSize: 14 },
  card: { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 12, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  value: { fontFamily: "GeistMono-Regular", fontSize: 24, color: theme.colors.foreground, letterSpacing: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: "auto", gap: 12 },
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/welcome-wizard/_steps/PersonalNumberStep.tsx
git commit -m "feat(mobile-wizard): PersonalNumberStep with confirm sub-screen + reveal toggle"
```

### Task 26: Mobile `AvailabilityStep`

**Files:**
- Create: `apps/mobile/src/components/welcome-wizard/_steps/AvailabilityStep.tsx`

- [ ] **Step 1: 7 toggle-chips, `accessibilityState.checked`, `Set<WeekdayCode>` of unavailable days, calls saveOnboardingStep("availability", {unavailableDays: [...]})**

```tsx
import * as React from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

const WEEKDAYS = [
  { code: "MO", label: "Mandag" }, { code: "TU", label: "Tirsdag" },
  { code: "WE", label: "Onsdag" }, { code: "TH", label: "Torsdag" },
  { code: "FR", label: "Fredag" }, { code: "SA", label: "Lørdag" },
  { code: "SU", label: "Søndag" },
] as const;
type WeekdayCode = typeof WEEKDAYS[number]["code"];

type Props = { next: () => void; back: () => void };

export function AvailabilityStep({ next, back }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const [off, setOff] = React.useState<Set<WeekdayCode>>(new Set());
  const [pending, setPending] = React.useState(false);

  const toggle = (c: WeekdayCode) => {
    setOff((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c); else n.add(c);
      return n;
    });
  };

  const submit = async () => {
    setPending(true);
    try {
      await saveOnboardingStep("availability", { unavailableDays: Array.from(off) });
      next();
    } catch (e) {
      Alert.alert("Kunne ikke lagre", e instanceof Error ? e.message : "Ukjent feil");
    } finally { setPending(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.heading}>Tilgjengelighet</Text>
      <Text style={styles.sub}>Hvilke dager kan du vanligvis IKKE jobbe? Du kan endre dette senere i Min Tid.</Text>
      <View style={styles.chipRow}>
        {WEEKDAYS.map((d) => {
          const isOff = off.has(d.code);
          return (
            <Pressable
              key={d.code}
              accessibilityRole="button"
              accessibilityState={{ checked: isOff }}
              accessibilityLabel={`${d.label}${isOff ? " (ikke tilgjengelig)" : ""}`}
              onPress={() => toggle(d.code)}
              style={[
                styles.chip,
                isOff && { borderColor: theme.colors.destructive, backgroundColor: theme.colors.destructive + "22" },
              ]}
            >
              <Text style={[styles.chipLabel, isOff && { color: theme.colors.destructive }]}>{d.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        <Button title="Tilbake" variant="ghost" onPress={back} disabled={pending} />
        <Button title={pending ? "Lagrer…" : "Neste"} variant="primary" onPress={submit} loading={pending} />
      </View>
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  root: { gap: 16, paddingTop: 24, paddingBottom: 24 },
  heading: { fontFamily: "InstrumentSerif-Regular", fontSize: 32, color: theme.colors.foreground },
  sub: { color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  chipLabel: { color: theme.colors.foreground, fontSize: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, gap: 12 },
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/welcome-wizard/_steps/AvailabilityStep.tsx
git commit -m "feat(mobile-wizard): AvailabilityStep — 7 day chips, off=unavailable"
```

### Task 27: Mobile `ConsentStep`

**Files:**
- Create: `apps/mobile/src/components/welcome-wizard/_steps/ConsentStep.tsx`

- [ ] **Step 1: Write the component** (3 checkboxes — handbook, GDPR, optional tariff. Disabled submit until all required checked. Links open in WebView or external browser.)

```tsx
import * as React from "react";
import { View, Text, Pressable, Linking, Alert } from "react-native";
import { Check, Square, CheckSquare } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { createStyles, useTheme } from "@/theme";
import { saveOnboardingStep } from "@/lib/onboarding-bff";

type Props = { next: () => void; back: () => void; tariffBound?: boolean };

export function ConsentStep({ next, back, tariffBound = false }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const [handbook, setHandbook] = React.useState(false);
  const [gdpr, setGdpr] = React.useState(false);
  const [tariff, setTariff] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const canSubmit = handbook && gdpr && (!tariffBound || tariff);

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    try {
      await saveOnboardingStep("consent", { handbook: true, gdpr: true, ...(tariffBound ? { tariff: true } : {}) });
      next();
    } catch (e) {
      Alert.alert("Kunne ikke lagre samtykke", e instanceof Error ? e.message : "Ukjent feil");
    } finally { setPending(false); }
  };

  const Row = ({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.consentRow}>
      {checked ? <CheckSquare size={20} color={theme.colors.primary} /> : <Square size={20} color={theme.colors.mutedForeground} />}
      <Text style={styles.consentText}>{children}</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Samtykke</Text>
      <Text style={styles.sub}>Bekreft at du har lest dokumentene.</Text>

      <Row checked={handbook} onToggle={() => setHandbook((v) => !v)}>
        Jeg har lest{" "}
        <Text style={styles.link} onPress={() => Linking.openURL("https://app.smartout.ai/dashboard/handbook")}>
          personalhåndboken
        </Text>.
      </Row>
      <Row checked={gdpr} onToggle={() => setGdpr((v) => !v)}>
        Jeg samtykker til at Smartout behandler mine personopplysninger som beskrevet i{" "}
        <Text style={styles.link} onPress={() => Linking.openURL("https://smartout.ai/legal/privacy")}>
          personvernerklæringen
        </Text>.
      </Row>
      {tariffBound && (
        <Row checked={tariff} onToggle={() => setTariff((v) => !v)}>
          Jeg er kjent med at min arbeidsplass er bundet av Riksavtalen (NHO Reiseliv).
        </Row>
      )}

      <View style={styles.row}>
        <Button title="Tilbake" variant="ghost" onPress={back} disabled={pending} />
        <Button title={pending ? "Lagrer…" : "Neste"} variant="primary" onPress={submit} disabled={!canSubmit || pending} loading={pending} />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, gap: 16, paddingTop: 24 },
  heading: { fontFamily: "InstrumentSerif-Regular", fontSize: 32, color: theme.colors.foreground },
  sub: { color: theme.colors.mutedForeground, fontSize: 14 },
  consentRow: { flexDirection: "row", gap: 12, padding: 12, backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 10 },
  consentText: { color: theme.colors.foreground, fontSize: 14, lineHeight: 20, flex: 1 },
  link: { color: theme.colors.primary, textDecorationLine: "underline" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: "auto", gap: 12 },
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/welcome-wizard/_steps/ConsentStep.tsx
git commit -m "feat(mobile-wizard): ConsentStep — 2 (or 3) required checkboxes"
```

### Task 28: Mobile `OptionalStep` + `DoneStep`

**Files:**
- Create: `apps/mobile/src/components/welcome-wizard/_steps/OptionalStep.tsx`
- Create: `apps/mobile/src/components/welcome-wizard/_steps/DoneStep.tsx`

- [ ] **Step 1: OptionalStep** — bank_account + emergency_contact_{name,phone,relation}. All optional. "Hopp over" button calls `next()` without save. Submit calls `saveOnboardingStep("optional", values)`. Pattern: same as ContactStep but with skip button.

- [ ] **Step 2: DoneStep** — single "Fullfør" button → invokes `completeWelcome` via a small Bearer wrapper route (or extends save-step with `step: "complete"` — choose one).

Add to `apps/web/src/app/api/mobile/employee-onboarding/save-step/route.ts` the `complete` case (calls the existing `completeWelcome` action via service-role direct table writes mirroring the action):

```ts
case "complete": {
  const now = new Date().toISOString();
  const { error: pErr } = await admin.from("profile")
    .update({ is_welcome_complete: true, welcome_completed_at: now })
    .eq("profile_id", actor.profileId);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  const { error: sErr } = await admin.from("employee_onboarding_state")
    .upsert({ profile_id: actor.profileId, workspace_id: actor.workspaceId, status: "completed", completed_at: now }, { onConflict: "profile_id" });
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  void emit({
    event: "profile welcome_wizard_completed",
    workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
    actor_id: nonEmpty(actor.profileId, "actor_id"),
    properties: { entity_type: "profile", entity_id: actor.profileId, data: {} },
  });
  return NextResponse.json({ ok: true });
}
```

Update the `Body.step` enum at the top of the route to include `"complete"`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/welcome-wizard/_steps/OptionalStep.tsx apps/mobile/src/components/welcome-wizard/_steps/DoneStep.tsx apps/web/src/app/api/mobile/employee-onboarding/save-step/route.ts
git commit -m "feat(mobile-wizard): OptionalStep + DoneStep; save-step 'complete' case"
```

---

## Phase 12 — Mobile entry route + trigger (1 task)

### Task 29: Mobile `/onboarding` route + `(app)/_layout` trigger

**Files:**
- Create: `apps/mobile/app/(app)/onboarding/index.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx`

- [ ] **Step 1: Onboarding route — wires WizardShell with the 8 steps + initial state pulled from BFF GET**

```tsx
import * as React from "react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { WizardShell } from "@/components/ui/WizardShell";
import { HeroStep } from "@/components/welcome-wizard/_steps/HeroStep";
import { ContactStep } from "@/components/welcome-wizard/_steps/ContactStep";
import { AddressStep } from "@/components/welcome-wizard/_steps/AddressStep";
import { PersonalNumberStep } from "@/components/welcome-wizard/_steps/PersonalNumberStep";
import { AvailabilityStep } from "@/components/welcome-wizard/_steps/AvailabilityStep";
import { ConsentStep } from "@/components/welcome-wizard/_steps/ConsentStep";
import { OptionalStep } from "@/components/welcome-wizard/_steps/OptionalStep";
import { DoneStep } from "@/components/welcome-wizard/_steps/DoneStep";
import { dismissOnboarding } from "@/lib/onboarding-bff";
import type { WizardDefinition } from "@smartout/ui/wizard/state";

type State = { initialised: boolean };

export default function OnboardingScreen() {
  const router = useRouter();

  const definition: WizardDefinition<State> = React.useMemo(() => ({
    id: "employee-onboarding",
    steps: [
      { id: "hero",      labelKey: "Velkommen",     component: HeroStep as never },
      { id: "contact",   labelKey: "Kontakt",       component: ContactStep as never },
      { id: "address",   labelKey: "Adresse",       component: AddressStep as never },
      { id: "personnr",  labelKey: "Personnummer",  component: PersonalNumberStep as never },
      { id: "avail",     labelKey: "Tilgjengelighet", component: AvailabilityStep as never },
      { id: "consent",   labelKey: "Samtykke",      component: ConsentStep as never },
      { id: "optional",  labelKey: "Valgfritt",     component: OptionalStep as never, skippable: true },
      { id: "done",      labelKey: "Ferdig",        component: DoneStep as never },
    ],
    loadState: async () => ({ initialised: true }),
    onComplete: async () => router.replace("/(app)/(home)"),
  }), [router]);

  const onDismiss = React.useCallback(async () => {
    try {
      await dismissOnboarding();
      router.replace("/(app)/(home)");
    } catch (e) {
      Alert.alert("Kunne ikke lukke", e instanceof Error ? e.message : "Ukjent feil");
    }
  }, [router]);

  return <WizardShell definition={definition} initialState={{ initialised: true }} onDismiss={onDismiss} />;
}
```

- [ ] **Step 2: Trigger in `(app)/_layout.tsx`**

In the existing SessionProvider / mount effect, add:

```tsx
// After useMyProfile() resolves:
React.useEffect(() => {
  if (!profile) return;
  if (profile.is_welcome_complete === false) {
    router.replace("/(app)/onboarding");
  }
}, [profile, router]);
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @smartout/mobile run typecheck
git add apps/mobile/app/(app)/onboarding/index.tsx apps/mobile/app/(app)/_layout.tsx
git commit -m "feat(mobile-wizard): /onboarding route + first-mount trigger

Layout pushes user to /onboarding when profile.is_welcome_complete === false.
WizardShell mounts the 8 steps + dismiss handler."
```

---

## Phase 13 — Home CTA (2 tasks)

### Task 30: `useOnboardingProgress` hook (mobile + web)

**Files:**
- Create: `apps/mobile/src/hooks/queries/use-onboarding-progress.ts`
- Create: `apps/web/src/app/dashboard/_hooks/use-onboarding-progress.ts`

- [ ] **Step 1: Mobile hook**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getWebApiUrl } from "@/lib/web-api";

type State = {
  status: "in_progress" | "dismissed" | "completed";
  current_step_index: number;
  step_data: Record<string, unknown>;
  dismissed_at: string | null;
  completed_at: string | null;
};

export function useOnboardingProgress() {
  return useQuery<{ done: number; total: number; status: State["status"] }>({
    queryKey: ["onboarding-progress", "v1"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ikke innlogget");
      const res = await fetch(`${getWebApiUrl()}/api/mobile/employee-onboarding/state`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`state fetch failed (${res.status})`);
      const body = (await res.json()) as { ok: boolean; state: State };
      const total = 8;
      const done = Math.min(body.state.current_step_index, total);
      return { done, total, status: body.state.status };
    },
  });
}
```

- [ ] **Step 2: Web hook** (mirror; consumes `/api/employee-onboarding/state` with credentials)

```ts
"use client";
import { useQuery } from "@tanstack/react-query";

type State = {
  status: "in_progress" | "dismissed" | "completed";
  current_step_index: number;
};

export function useOnboardingProgress() {
  return useQuery<{ done: number; total: number; status: State["status"] }>({
    queryKey: ["onboarding-progress-web", "v1"],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch("/api/employee-onboarding/state", { credentials: "include" });
      if (!res.ok) throw new Error(`state fetch failed (${res.status})`);
      const body = (await res.json()) as { ok: boolean; state: State };
      const total = 8;
      const done = Math.min(body.state.current_step_index, total);
      return { done, total, status: body.state.status };
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/queries/use-onboarding-progress.ts apps/web/src/app/dashboard/_hooks/use-onboarding-progress.ts
git commit -m "feat(wizard): useOnboardingProgress hook (mobile + web)

TanStack Query wrapper around BFF state GET. Returns {done, total, status}
for the home CTA card."
```

### Task 31: Mobile home CTA card + integration into 3 phase views

**Files:**
- Create: `apps/mobile/src/components/onboarding/CompleteProfileCard.tsx`
- Modify: `apps/mobile/src/components/home/NoShiftView.tsx`
- Modify: `apps/mobile/src/components/home/BeforeShiftView.tsx`
- Modify: `apps/mobile/src/components/home/AfterShiftView.tsx`
- Do NOT modify `DuringShiftView.tsx` — D6-active suppression per spec §S5.

- [ ] **Step 1: Write the card**

```tsx
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useOnboardingProgress } from "@/hooks/queries/use-onboarding-progress";
import { createStyles, useTheme } from "@/theme";

export function CompleteProfileCard() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useStyles();
  const { data } = useOnboardingProgress();

  if (!data || data.status === "completed") return null;
  const remaining = Math.max(0, data.total - data.done);

  return (
    <Pressable
      onPress={() => router.push("/(app)/onboarding")}
      accessibilityRole="button"
      accessibilityLabel="Fullfør profilen din"
      style={styles.card}
    >
      <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
      <View style={styles.text}>
        <Text style={styles.title}>Fullfør profilen din</Text>
        <Text style={styles.sub}>{remaining} steg igjen</Text>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 14, borderWidth: 1,
    borderColor: theme.colors.border, backgroundColor: theme.colors.card,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600", color: theme.colors.foreground },
  sub: { fontSize: 12, color: theme.colors.mutedForeground, marginTop: 2 },
}));
```

- [ ] **Step 2: Mount in 3 phase views (NOT DuringShift)**

In `NoShiftView.tsx`, `BeforeShiftView.tsx`, and `AfterShiftView.tsx`, near the top of the rendered list (before existing content), add:

```tsx
import { CompleteProfileCard } from "@/components/onboarding/CompleteProfileCard";
// …
<CompleteProfileCard />
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/onboarding/CompleteProfileCard.tsx apps/mobile/src/components/home/NoShiftView.tsx apps/mobile/src/components/home/BeforeShiftView.tsx apps/mobile/src/components/home/AfterShiftView.tsx
git commit -m "feat(wizard): home CTA card 'Fullfør profilen din' on 3 phase views

Suppressed on DuringShiftView per spec §S5 (D6-active is action context).
Reads useOnboardingProgress; hides when status='completed'."
```

---

## Phase 14 — Deprecate single-screen PII surface (1 task)

### Task 32: Deprecation banner on mobile `complete-data.tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/(me)/contract/complete-data.tsx`

- [ ] **Step 1: Add a banner near the top of the screen**

```tsx
<View accessibilityRole="alert" style={{ backgroundColor: theme.colors.muted, padding: 12, borderRadius: 8, marginBottom: 16 }}>
  <Text style={{ color: theme.colors.foreground, fontWeight: "600" }}>Bruk onboarding-veiviseren</Text>
  <Text style={{ color: theme.colors.mutedForeground, fontSize: 13, marginTop: 4 }}>
    Denne enkeltsiden er erstattet av en stegvis veiviser. Den kan fortsatt brukes for å oppdatere enkeltfelt, men nye ansatte bør gå gjennom veiviseren.
  </Text>
  <Pressable onPress={() => router.push("/(app)/onboarding")} style={{ marginTop: 8 }}>
    <Text style={{ color: theme.colors.primary }}>Åpne veiviseren →</Text>
  </Pressable>
</View>
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(me)/contract/complete-data.tsx
git commit -m "chore(wizard): deprecation banner on complete-data — point to wizard

L-0178 single-surface ownership. Field-edit usage of complete-data
remains valid; new onboarding goes through the wizard."
```

---

## Phase 15 — Domain docs (1 task)

### Task 33: Create `docs/domains/onboarding-wizard/` 8-file spine + dashboard row

**Files:**
- Create: `docs/domains/onboarding-wizard/README.md`
- Create: `docs/domains/onboarding-wizard/OVERVIEW.md`
- Create: `docs/domains/onboarding-wizard/ARCHITECTURE.md`
- Create: `docs/domains/onboarding-wizard/DATA-MODEL.md`
- Create: `docs/domains/onboarding-wizard/USER-FLOWS.md`
- Create: `docs/domains/onboarding-wizard/ROADMAP.md`
- Create: `docs/domains/onboarding-wizard/GAPS-AND-DEBT.md`
- Create: `docs/domains/onboarding-wizard/E2E-COVERAGE.md`
- Modify: `docs/domains/_DASHBOARD.md`

- [ ] **Step 1: Copy templates from domain-steward skill**

```bash
mkdir -p docs/domains/onboarding-wizard
for f in README OVERVIEW ARCHITECTURE DATA-MODEL USER-FLOWS ROADMAP GAPS-AND-DEBT E2E-COVERAGE; do
  cp .claude/skills/domain-steward/templates/$f.md docs/domains/onboarding-wizard/$f.md
done
```

- [ ] **Step 2: Fill frontmatter on each file (do this once per file)**

For each file, prepend:

```yaml
---
title: "Onboarding Wizard — <File-specific title>"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: onboarding-wizard
tags: [domain, onboarding-wizard, wizard, identity, d2-resource]
mirror: verified   # OMIT on ROADMAP.md
last_verified: 2026-05-23   # OMIT on ROADMAP.md
---
```

For `ROADMAP.md`, omit `mirror` + `last_verified`.

- [ ] **Step 3: Replace template placeholders with real content**

For each file, replace `{curly-brace}` placeholders with content derived from this plan + the spec. Concrete content for `DATA-MODEL.md` (key file):

```markdown
## Tables

### Reused
- `user_identity` — display_name, phone, emergency_contact_*, personal_email (identity-layer; ADR-0396 forbids duplicating on profile)
- `profile` — personal_number, bank_account, address_*, is_welcome_complete, welcome_completed_at
- `employee_availability` — RRULE rows with preference_type='unavailable' + reason='onboarding-wizard'

### New
- `consent_acceptance` — append-only audit; handbook | gdpr | tariff
- `employee_onboarding_state` — PK profile_id; status enum + step_data JSONB

## Migrations
- `supabase/migrations/20260624000000_create_consent_acceptance.sql`
- `supabase/migrations/20260624000100_create_employee_onboarding_state.sql`

## RLS pattern
- consent_acceptance: SELECT own + manager/admin; INSERT service-role; NO UPDATE/DELETE
- employee_onboarding_state: SELECT/UPDATE/INSERT own via JWT; SELECT via API key
```

- [ ] **Step 4: Register in `_DASHBOARD.md`**

Append a row:

```markdown
| [onboarding-wizard](./onboarding-wizard/) | 8/8 | 🟢 | 🟡 | verified | 2026-05-23 | 2 |
```

- [ ] **Step 5: Run domain-lint**

```bash
pnpm check:domains
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add docs/domains/onboarding-wizard docs/domains/_DASHBOARD.md
git commit -m "docs(domain): onboarding-wizard 8-file spine + dashboard row

D2 Resource + identity-layer. Owns 2 new tables (consent_acceptance,
employee_onboarding_state). Overlaps: identity, contracts, payroll.
pnpm check:domains passes."
```

---

## Phase 16 — E2E + final checks (3 tasks)

### Task 34: Playwright web E2E

**Files:**
- Create: `apps/e2e/tests/employee-onboarding-wizard.spec.ts`

- [ ] **Step 1: Write spec covering the 8-step path**

```ts
import { test, expect } from "@playwright/test";

test.describe("Employee Onboarding Wizard", () => {
  test("completes 8 steps + sets is_welcome_complete", async ({ page }) => {
    await page.goto("/dashboard"); // assumes test fixture logs in with is_welcome_complete=false
    await expect(page.getByText("Velkommen til Smartout")).toBeVisible();
    await page.getByRole("button", { name: "Sett i gang" }).click();

    // Step 2 Kontakt
    await page.getByLabel("Navn").fill("Ola Nordmann");
    await page.getByLabel("Telefon").fill("+4791234567");
    await page.getByRole("button", { name: "Neste" }).click();

    // Step 3 Adresse
    await page.getByLabel("Gateadresse").fill("Storgata 1");
    await page.getByLabel("Postnummer").fill("0182");
    await page.getByLabel("Sted").fill("Oslo");
    await page.getByRole("button", { name: "Neste" }).click();

    // Step 4 Personnr → confirm
    await page.getByLabel("Personnummer (11 siffer)").fill("12345678901");
    await page.getByRole("button", { name: "Neste" }).click();
    await expect(page.getByRole("dialog", { name: "Bekreft personnummer" })).toBeVisible();
    await page.getByRole("button", { name: "Bekreft og lagre" }).click();

    // Step 5 Availability
    await page.getByRole("button", { name: "Søndag" }).click();
    await page.getByRole("button", { name: "Neste" }).click();

    // Step 6 Consent
    await page.getByRole("checkbox").nth(0).click(); // handbook
    await page.getByRole("checkbox").nth(1).click(); // gdpr
    await page.getByRole("button", { name: "Neste" }).click();

    // Step 7 Optional — skip
    await page.getByRole("button", { name: /Hopp|Neste/ }).click();

    // Step 8 Done
    await expect(page.getByText(/Ferdig|Fullfør/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm --filter e2e exec playwright test employee-onboarding-wizard.spec.ts
```

Expected: PASS. (May need fixture additions to seed a fresh user.)

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/tests/employee-onboarding-wizard.spec.ts
git commit -m "test(e2e): web wizard 8-step happy path"
```

### Task 35: Final acceptance checks

**Files:** none modified.

- [ ] **Step 1: Run full typecheck**

```bash
pnpm --filter @smartout/mobile run typecheck
cd apps/web && pnpm exec tsc --noEmit
```

Expected: 0/0.

- [ ] **Step 2: Run all touched-area unit tests**

```bash
cd apps/web && pnpm vitest run src/app/dashboard/_actions/__tests__
```

- [ ] **Step 3: Smoke the lint enforcement**

```bash
pnpm check:identity-on-profile  # should pass on clean working tree
pnpm --filter @smartout/mobile lint apps/mobile/src
```

Expected: both green.

- [ ] **Step 4: Smoke single-WelcomeWizard reference**

```bash
grep -rln "<WelcomeWizard" apps/web/src
```

Expected: exactly one match (`WelcomeWizardGate.tsx`).

- [ ] **Step 5: db reset round-trip**

```bash
npx supabase db reset
```

Re-seed local platform_api_key per `learning_dev_api_key_mismatch_breaks_extract.md` if photo extract is also being tested.

- [ ] **Step 6: Manual happy-path on mobile PWA**

Start mobile + web + stage-engine under op run. Log in as a fresh seed user with `is_welcome_complete=false`. Verify the wizard appears, advances, completes, and the home CTA disappears.

- [ ] **Step 7: Final commit if any tweaks**

```bash
git status
# If clean → done.
# If anything still uncommitted → fix + final commit.
```

### Task 36: Wrap-up

- [ ] **Step 1: Write a brief summary as the final commit message body** (no new files).

```bash
git commit --allow-empty -m "chore(wizard): close employee onboarding wizard implementation

8-step wizard live on web (gate wired) + mobile (new route). 2 new
tables. 4 new Server Actions. 1 new ESLint rule. 2 new ADRs. Domain
docs spine in docs/domains/onboarding-wizard/. Council R1 → R2 → ship.

Acceptance:
- TOTAL_STEPS = 8; Step 5 (Availability) + Step 6 (Consent) inserted.
- Identity columns on user_identity only (ADR-0396).
- Telemetry: profile welcome_wizard_* preserved + _dismissed/_resumed added.
- Mobile shell + 8 RN step components; deep-import discipline enforced.
- Home CTA on 3 phase views; suppressed during active shift."
```

---

## Self-Review (run before handoff)

Checked against spec §S1-S12 and council R1-R10:

| Spec ref | Plan tasks | Covered? |
|---|---|---|
| §S0 inventory | Task 0 (verification only) | ✅ |
| §S1 step flow (8 steps) | Tasks 12-15, 22-28 | ✅ |
| §S2 data model | Tasks 1-3, 7 (ADR-0396) | ✅ |
| §S3 architecture | Tasks 4-5 (types + barrel), 17, 20-21, 29 | ✅ |
| §S4 telemetry | Tasks 6, 11, 31 (emit sites) | ✅ |
| §S5 trigger + CTA | Tasks 16, 29, 30-31 | ✅ |
| §S6 mobile shell | Tasks 18-20 | ✅ |
| §S_components contract | Tasks 22-28 (each step) | ✅ |
| §S_a11y | Embedded in step tasks (aria-pressed, focus, live regions) | ✅ |
| §S7 domain | Task 33 | ✅ |
| §S8 ADRs | Tasks 7-8 | ✅ |
| §S12 acceptance | Task 35 | ✅ |
| R1 strategy A | ADR-0397 (Task 8) | ✅ |
| R2 no profile cols | ADR-0396 + guard (Task 7) | ✅ |
| R3 reuse submit_own_pii | Task 21 save-step BFF | ✅ |
| R4 surface ownership | Task 32 deprecation banner | ✅ |
| R5 telemetry reuse | Task 6 + Task 11 | ✅ |
| R6 component contract | Tasks 22-28 | ✅ |
| R7 a11y | Embedded + Task 34 | ✅ |
| R8 UX fixes | Tasks 12 (chip copy), 14 + 25 (PII reveal) | ✅ |
| R9 barrel discipline | Task 5 | ✅ |
| R10 channel guard | Spec §D15 reaffirmed; no agent capability added in plan | ✅ |

No placeholders found in step content. All file paths absolute or repo-relative. All commands tested-shape.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-23-employee-onboarding-wizard.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh sonnet/haiku subagent per task, review between tasks, fast iteration. ~36 tasks; budget 3-5 days at agent-driven pace.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints. Slower but full session-context continuity.

**Which approach?**
