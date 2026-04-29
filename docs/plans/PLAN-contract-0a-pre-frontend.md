---
title: "Contract Phase 0a-pre — Frontend Pre-work (motion-token-sweep + spec amendments)"
id: PLAN_CONTRACT_0A_PRE_FRONTEND
status: draft
layer: plan
created: 2026-04-29
updated: 2026-04-29
module: contract
tags: [contract, motion-tokens, nordic-split, frontend, phase-0a]
depends_on:
  - ADR_0233
  - ADR_0234
  - ADR_0236
  - LEARNING_0174
  - docs/architecture/contract-service/ARCHITECTURE-contracts-module.md
---

# Contract Phase 0a-pre — Frontend Pre-work

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clear frontend blockers before Phase 0a implementation lands — sweep 9 motion-debt sites to `motionTokens.*`, amend ARCHITECTURE-contracts-module.md with 5 missing UI sections, and scaffold 5 new contract components (no impl, compile-safe placeholder JSX).

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), Tailwind v4, shadcn/ui new-york, Framer Motion, `packages/design-tokens/src/tokens.ts` (`motion` object), `useReducedMotion` from Framer Motion.

**Source documents:**

- `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md` (target for §UI amendments)
- `docs/architecture/contract-service/JOURNEY-contract-module.md` (Journey 1, Journey 4 primary refs)
- `docs/decisions/0234-contract-payroll-capability-split.md` (RevealableField PII requirement)
- `docs/decisions/0236-amendment-flow-acknowledgement-as-legal-evidence.md` (WCAG AAA, 6 animated elements, TariffBadge, ContractAmendmentDiff)
- `docs/learnings/0174-compose-vs-author-verb-collision.md` (people-page = author, drawer = dispatch)
- `packages/design-tokens/src/tokens.ts` — `motion` object: `spring`, `springSnappy`, `springGentle`, `enterMs` (500), `exitMs` (250), `easingExpoArray`

---

## E: Sub-sortie or In-place?

**Recommendation: spawn sub-sortie `feat/services-contract-0a-pre-frontend`** from the current campaign `campaign/services`.

Rationale: the motion-sweep touches 9 files across `apps/web/src/components/` (dashboard/, day/, ui/, wizard/) — none overlap with the backend contract work in the current `feat/services-contract-employee` branch. Isolating avoids merge conflict risk when employee-contract backend lands. The sub-sortie merges to campaign, syncs development automatically at close per standard sub-sortie flow.

---

## Architecture Overview

Three parallel workstreams, all non-overlapping:

1. **Motion-token-sweep** — Replace hardcoded `duration: N` / Tailwind `duration-*` / bare `ms` literals with references to `motion.enterMs`, `motion.exitMs`, `motion.spring`, `motion.springGentle`, `motion.springSnappy` from `@smartout/design-tokens`. Add `useReducedMotion` guard where missing. Scope: 9 files confirmed by council (Frontend Designer finding: 30 total motion-debt sites; this sortie touches 9 contract-path-adjacent ones).

2. **Spec amendments** — Add 5 new `§UI *` sections to `ARCHITECTURE-contracts-module.md`. Each section is a net-new addition (not editing existing content). Frontmatter `updated:` bumped.

3. **Component scaffolds** — Create 5 new `.tsx` files with placeholder JSX + correct import structure. No business logic. Purpose: unblock parallel build-agents in Phase 0a who need import targets to typecheck against.

---

## Prerequisites

- [ ] Sub-sortie branch `feat/services-contract-0a-pre-frontend` created from `campaign/services`
- [ ] `packages/design-tokens/src/tokens.ts` `motion` export confirmed present (verified: yes, lines 180–191)
- [ ] `pnpm turbo typecheck` baseline passes on current branch before any changes

---

## F: Agent Dispatch Plan

Parallelizable across 3 Sonnet build-agents. All are independent — no shared files.

| Agent | Task(s) | Model |
|-------|---------|-------|
| Agent A — motion-sweep | Task 1 (9 files) | sonnet |
| Agent B — spec-amendments | Task 2 (1 file, 5 sections) | sonnet |
| Agent C — component-scaffolds | Task 3 (5 new files) | sonnet |

---

## Tasks

### Task 1: Motion-Token Sweep — 9 Files

**Agent A**

**What:** Replace all hardcoded motion values with `motion.*` from `@smartout/design-tokens`. Add `useReducedMotion` guard from `framer-motion` where guard is absent. Do NOT change animation intent — only migrate units. Import pattern: `import { motion as motionTokens } from "@smartout/design-tokens"`.

**Target files (9):**

| File | Debt found | Migration |
|------|-----------|-----------|
| `apps/web/src/components/day/AddShiftDialog.tsx` | `transition={{ duration: 0 }}` (reduced-motion branch) + bare spring-like objects | Use `motionTokens.spring`, guard with `useReducedMotion` |
| `apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx` | `transition={{ duration: 0.2 }}`, `duration: 0.15`, `duration: 0.1`, `swapSpring` inline | Replace inline spring objects with `motionTokens.springSnappy`; duration literals → `motionTokens.exitMs / 1000` |
| `apps/web/src/components/ui/PaymentStatusBadge.tsx` | `duration: 2.2` (pulse loop) | Replace with `motionTokens.enterMs * 4.4 / 1000`; add `useReducedMotion` guard on animate prop |
| `apps/web/src/components/ui/DispatchStatusBadge.tsx` | `duration: 2.2` (pulse), bare `animate-spin` class | Same pattern as PaymentStatusBadge; guard `animate-spin` on `!prefersReducedMotion` (already has var but hardcodes duration) |
| `apps/web/src/components/wizard/AnimatedWizardShell.tsx` | `duration: 0.6`, `duration: 0.25`, `duration: 0.5` — plus hardcoded `EASE` const | Replace `EASE` with `motionTokens.easingExpoArray`; durations → `motionTokens.enterMs / 1000` or `motionTokens.exitMs / 1000` |
| `apps/web/src/components/dashboard/ChatPanel.tsx` | `transition={{ duration: 0.2 }}` | `motionTokens.exitMs / 1000` |
| `apps/web/src/components/dashboard/interactive/InteractiveDashboard.tsx` | `AMBIENT_SPRING` inline const + `duration: 0.25` | Replace `AMBIENT_SPRING` with `motionTokens.springGentle`; literal → `motionTokens.exitMs / 1000` |
| `apps/web/src/components/dashboard/interactive/TaskSwiperCard.tsx` | `duration:` literals (grep confirms `transition:` present) | Migrate to `motionTokens.spring` / `exitMs` |
| `apps/web/src/components/dashboard/SignalCard.tsx` | `transition:` with raw duration | Migrate to `motionTokens.exitMs / 1000` |

**Rules for Agent A:**
- NEVER change animation curves to something visually different — only migrate to the token that most closely matches the existing intent
- Every file that adds `useReducedMotion` must already have `framer-motion` in imports (it does — all files use Framer Motion)
- Run `pnpm turbo typecheck --filter=web` after all 9 files changed — must pass

**Files to modify:** the 9 listed above. No new files.

**Acceptance:**
- `pnpm turbo typecheck --filter=web` passes
- `grep -rn "duration: 0\.[0-9]\|duration: [1-9][0-9]*\." apps/web/src/components/day/AddShiftDialog.tsx apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx apps/web/src/components/ui/PaymentStatusBadge.tsx apps/web/src/components/ui/DispatchStatusBadge.tsx apps/web/src/components/wizard/AnimatedWizardShell.tsx apps/web/src/components/dashboard/ChatPanel.tsx apps/web/src/components/dashboard/interactive/InteractiveDashboard.tsx apps/web/src/components/dashboard/interactive/TaskSwiperCard.tsx apps/web/src/components/dashboard/SignalCard.tsx` returns 0 hits for raw duration floats (except computed expressions like `motionTokens.exitMs / 1000`)
- Motion intent visually unchanged (review by eye — no animation direction swaps)

---

### Task 2: ARCHITECTURE Spec Amendments — 5 §UI Sections

**Agent B**

**What:** Append 5 new sections to `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md`. Each is a net-new `## §UI *` section. No editing of existing content. Bump `updated: 2026-04-29` in frontmatter.

**File to modify:** `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md`

**Sections to add (append after last existing section):**

---

**§UI Migration Map** — Documents the 5-step → 2-step drawer element relocation per L-0174 + Council 2026-04-29 verdict. Table format:

| Element | Old location (5-step drawer) | New location | Action |
|---------|------------------------------|--------------|--------|
| 15 §14-6 employment fields | Drawer Steps 1–3 | `/dashboard/people/[id]` — `Ansettelse` inline-save section | Relocated (Author verb → people-page) |
| Compliance badge | Drawer Step 1 sidebar | People-page section header | Relocated |
| Cascade ghost-values | Drawer Step 2 | Removed — inline inputs on people-page are live values | Dropped |
| AcknowledgementRing | Drawer Step 3 | CompositionDrawer Step 2 (Compose + Dispatch) | Stays in drawer — witness verb |
| Template selector | Drawer Step 1 | CompositionDrawer Step 1 | Stays in drawer |

Drawer is now **2-step only**: Step 1 = Velg mal, Step 2 = Preview + AcknowledgementRing + Send.

---

**§UI PII Policy** — Documents RevealableField masking requirements per ADR-0234 §Høy-PII:

- Fields classified Høy sensitivity (`personal_number`, `bank_account`, `tax_card_number`, `tax_percentage`, `tax_table_number`) MUST render through `<RevealableField />`.
- Default state: masked (value replaced with `••••••••`).
- Click-to-reveal: user clicks → field reveals plaintext for 5 seconds → auto-masks. Reveal triggers `emit("payroll.pii_revealed", { field, profile_id, workspace_id })` to `activity_trail`.
- Medium fields (`salary_amount`, `tax_deduction_percentage`) use standard display, no masking.
- Lav fields (`position_title`, `department`, `start_date`) — no masking.
- `<RevealableField />` is workspace-scoped — reveal event is audit-logged per ADR-0234 channel-guard rules.
- Component location: `apps/web/src/components/RevealableField.tsx` (reusable, not contract-only).

---

**§UI ObligationBlocker** — Documents ObligationBlocker component variants per Journey 4:

The blocker must render in 3 contexts depending on surface + state:

| Context | Component variant | Trigger |
|---------|-----------------|---------|
| Mobile clock-in attempt | Bottom sheet (`ObligationBlocker` with `variant="sheet"`) | `is_employee_blocked` RPC returns blocked |
| Web dashboard banner | Sticky banner above page content (`variant="banner"`) | Employee navigates to shift-relevant page with overdue obligation |
| Botsson card | Inline Botsson chat card (`variant="botsson-card"`) | Botsson surfaces blocker proactively in obligation-due-soon context |

All 3 variants:
- Show obligation name, due date, overdue delta
- CTA: deep-link to protocol page (`/dashboard/competence/protocol/[id]`)
- Emit `contract.obligation_blocker_shown` on mount
- Respect `useReducedMotion` — no entrance animation when reduced

Single component file: `apps/web/src/components/contract/ObligationBlocker.tsx` with `variant` prop.

---

**§UI Motion Inventory** — Documents the 6 animated elements in contract UI per ADR-0236 Frontend Designer finding:

| Element | Component | Animation | motionTokens ref | useReducedMotion guard |
|---------|-----------|-----------|-----------------|----------------------|
| AcknowledgementRing fill | `AcknowledgementRing` | Arc progress fill on toggle | `motionTokens.springSnappy` | Yes — instant fill if reduced |
| Send button aria-disabled state | `AcknowledgementRing` | Opacity fade 1→0.4 | `motionTokens.exitMs / 1000` | Yes — no fade if reduced |
| ContractAmendmentDiff row highlight | `ContractAmendmentDiff` | bg flash on diff line appear | `motionTokens.enterMs / 1000` | Yes — static bg if reduced |
| TariffBadge drift pulse | `TariffBadge` | Amber/red pulse on stale state | `motionTokens.springGentle` | Yes — static badge if reduced |
| ObligationBlocker banner entrance | `ObligationBlocker` (banner) | Slide-down from top | `motionTokens.spring` | Yes — instant show if reduced |
| RevealableField reveal/mask transition | `RevealableField` | Opacity crossfade | `motionTokens.exitMs / 1000` | Yes — instant swap if reduced |

All 6 elements MUST use `useReducedMotion()` from `framer-motion` and skip motion when `true`. This satisfies ADR-0236 WCAG AAA requirement for legally-binding interactions.

---

**§UI Mobile Parity** — Documents web-vs-mobile surface split per ADR-0133 + ADR-0236:

| Journey | Action | Web | Mobile |
|---------|--------|-----|--------|
| J1 — Author employment data | Author verb (D1–D5) | `/dashboard/people/[id]` inline sections | Not available (compose verb — web-only per ADR-0133) |
| J2 — Send contract | Dispatch verb (D6) | CompositionDrawer (2-step) + AcknowledgementRing | Not available |
| J3 — Employee signs | Witness verb | Web DocuSeal redirect | DocuSeal mobile webview |
| J4 — Clock-in ObligationBlocker | Execute verb (D6) | Banner variant | Bottom sheet variant |
| J5 — Admin amendment authoring | Compose verb | AmendmentDrawer (web-only) | Not available |
| J5 — Employee re-sign amendment | Witness verb | Web re-sign page | Mobile bottom sheet + DocuSeal webview |

`ObligationBlocker` is the only contract component that must ship with both web AND mobile variants in Phase 0a. All other contract UI is web-only for Phase 0a.

---

**Files to modify:** `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md` only.

**Acceptance:**
- File has all 5 `## §UI *` sections present
- Frontmatter `updated:` is `2026-04-29`
- YAML frontmatter valid (no malformed keys)
- Each section has the table/content described above

---

### Task 3: Component Scaffolds — 5 New Files

**Agent C**

**What:** Create 5 new TypeScript React component files. Placeholder JSX only — no business logic, no API calls, no hooks beyond type imports. Goal: unblock Phase 0a build-agents who will implement internals; these scaffolds must typecheck clean.

**Files to create:**

---

**1. `apps/web/src/components/contract/ObligationsList.tsx`**

```tsx
// apps/web/src/components/contract/ObligationsList.tsx
// What: List of contract_obligation rows for a given contract.
// Why: Journey 3 — employee sees obligations post-signing; Journey 4 — tracks completion.

"use client";

import type { Database } from "@smartout/supabase";

type ContractObligation =
  Database["public"]["Tables"]["contract_obligation"]["Row"];

interface ObligationsListProps {
  obligations: ContractObligation[];
  onObligationClick?: (obligationId: string) => void;
}

export function ObligationsList({
  obligations,
  onObligationClick,
}: ObligationsListProps) {
  return (
    <ul>
      {obligations.map((o) => (
        <li key={o.id}>
          {/* TODO Phase 0a: implement obligation row */}
          {o.id}
        </li>
      ))}
    </ul>
  );
}
```

---

**2. `apps/web/src/components/contract/ObligationBlocker.tsx`**

```tsx
// apps/web/src/components/contract/ObligationBlocker.tsx
// What: Renders a blocker when employee has overdue contract obligations.
// Why: Journey 4 — clock-in blocked; renders in 3 contexts per §UI ObligationBlocker.
// Variants: "banner" (web), "sheet" (mobile), "botsson-card" (Botsson chat card).

"use client";

interface ObligationBlockerProps {
  variant: "banner" | "sheet" | "botsson-card";
  obligationName: string;
  dueDate: string;
  protocolId: string;
  workspaceSlug: string;
}

export function ObligationBlocker({
  variant,
  obligationName,
  dueDate,
  protocolId,
  workspaceSlug,
}: ObligationBlockerProps) {
  return (
    <div data-variant={variant}>
      {/* TODO Phase 0a: implement variant rendering + useReducedMotion guard + emit */}
      <span>{obligationName}</span>
      <span>{dueDate}</span>
    </div>
  );
}
```

---

**3. `apps/web/src/components/contract/ContractAmendmentDiff.tsx`**

```tsx
// apps/web/src/components/contract/ContractAmendmentDiff.tsx
// What: Renders field-level diff between original and amended contract values.
// Why: Journey 5 — employee sees side-by-side diff before re-signing (ADR-0236).
// Web: side-by-side panes. Mobile: stacked rows. Uses bg-emerald-500/10 + bg-rose-500/10.

"use client";

interface DiffField {
  label: string;
  previous: string | number | null;
  proposed: string | number | null;
}

interface ContractAmendmentDiffProps {
  fields: DiffField[];
  layout?: "side-by-side" | "stacked";
}

export function ContractAmendmentDiff({
  fields,
  layout = "side-by-side",
}: ContractAmendmentDiffProps) {
  return (
    <div data-layout={layout}>
      {/* TODO Phase 0a: implement diff rows with motion highlight + useReducedMotion guard */}
      {fields.map((f) => (
        <div key={f.label}>
          <span>{f.label}</span>
          <span className="bg-rose-500/10">{String(f.previous ?? "—")}</span>
          <span className="bg-emerald-500/10">{String(f.proposed ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}
```

---

**4. `apps/web/src/components/contract/TariffBadge.tsx`**

```tsx
// apps/web/src/components/contract/TariffBadge.tsx
// What: Badge showing tariff sync state per ADR-0181 drift indicator.
// Why: Employee /my-contract page needs to surface whether their tariff is current.
// States: green (synced), amber (>7 days), red (>30 days stale).
// Phase 0a ships badge + tooltip. Phase 0b adds clickable EntityDrawer destination.

"use client";

type TariffSyncState = "synced" | "pending" | "stale";

interface TariffBadgeProps {
  state: TariffSyncState;
  lastSyncedAt: string | null;
  tariffName: string;
}

export function TariffBadge({
  state,
  lastSyncedAt,
  tariffName,
}: TariffBadgeProps) {
  return (
    <span data-state={state}>
      {/* TODO Phase 0a: implement badge with pulse animation + useReducedMotion guard */}
      {tariffName}
    </span>
  );
}
```

---

**5. `apps/web/src/components/RevealableField.tsx`**

```tsx
// apps/web/src/components/RevealableField.tsx
// What: Renders Høy-PII field values masked by default; click-to-reveal for 5s then auto-masks.
// Why: ADR-0234 §Høy-PII — personal_number, bank_account, tax_* require masking + audit emit.
// Reusable across contract and payroll surfaces — not contract-only.
// Reveal emits payroll.pii_revealed to activity_trail. Auto-masks after 5000ms.

"use client";

interface RevealableFieldProps {
  label: string;
  value: string;
  fieldName: string;
  profileId: string;
  workspaceId: string;
}

export function RevealableField({
  label,
  value,
  fieldName,
  profileId,
  workspaceId,
}: RevealableFieldProps) {
  return (
    <div>
      {/* TODO Phase 0a: implement reveal state + 5s timer + emit + useReducedMotion crossfade */}
      <span>{label}</span>
      <span aria-label={`${label} — skjult`}>{"••••••••"}</span>
    </div>
  );
}
```

---

**Files to create:** all 5 above. No existing files modified.

**Acceptance:**
- All 5 files exist at the specified paths
- `pnpm turbo typecheck --filter=web` passes with 0 errors
- No business logic (no API calls, no `useQuery`, no `useMutation`)
- Each file has a file-header comment explaining what + why

---

## D: Acceptance Criteria (full sortie gate)

- [ ] **Typecheck**: `pnpm turbo typecheck` passes with 0 errors
- [ ] **Motion-debt grep**: `grep -rn "duration: 0\.[0-9]" apps/web/src/components/day/AddShiftDialog.tsx apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx apps/web/src/components/ui/PaymentStatusBadge.tsx apps/web/src/components/ui/DispatchStatusBadge.tsx apps/web/src/components/wizard/AnimatedWizardShell.tsx apps/web/src/components/dashboard/ChatPanel.tsx apps/web/src/components/dashboard/interactive/InteractiveDashboard.tsx apps/web/src/components/dashboard/interactive/TaskSwiperCard.tsx apps/web/src/components/dashboard/SignalCard.tsx` → 0 raw duration literals remain (computed expressions OK)
- [ ] **5 ARCHITECTURE sections**: `grep -c "^## §UI" docs/architecture/contract-service/ARCHITECTURE-contracts-module.md` returns ≥ 5
- [ ] **5 component scaffolds compile**: all 5 files exist and typecheck passes
- [ ] **No regressions**: motion intent visually unchanged (no animation direction swaps, no timing inversions)
- [ ] **ADR references present**: each new component file header references the ADR that drives it

---

## References

- ADR-0233 (contract schema migration foundation)
- ADR-0234 (payroll capability split — drives RevealableField requirement)
- ADR-0235 (obligation lifecycle trigger semantics)
- ADR-0236 (amendment flow + AcknowledgementRing — WCAG AAA + 6 animated elements + TariffBadge + ContractAmendmentDiff)
- L-0174 (compose vs author verb collision — drives migration map)
- `docs/architecture/contract-service/JOURNEY-contract-module.md` (Journey 1 + Journey 4)
- `packages/design-tokens/src/tokens.ts` — `motion` object (canonical source for all token refs)
- Frontend Designer Council 2026-04-29 Contract Module Phase 0a verdict
