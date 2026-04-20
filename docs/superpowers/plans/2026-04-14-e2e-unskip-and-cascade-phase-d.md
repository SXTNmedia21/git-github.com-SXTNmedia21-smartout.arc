# E2E Test Unskip + Cascade Phase D Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unskip/fix 18 E2E tests across 9 files and complete the last gap in Cascade Phase D (publish validation dialog integration).

**Architecture:** Two independent workstreams. Part A cleans up test debt by either fixing, rewriting, or intentionally deleting obsolete tests. Part B wires the existing `usePublishValidation()` hook into the publish overview dialog. Both workstreams commit directly to `development`.

**Tech Stack:** Playwright, TypeScript, React, TanStack Query, shadcn/ui

---

## Part A: E2E Test Unskip (18 tests across 9 files)

### Classification of Skipped Tests

| Category | Tests | Action |
|----------|-------|--------|
| **Obsolete** (old wizard, removed features) | onboarding.spec.ts (5 tests) | DELETE — replaced by workspace-setup-flow.spec.ts |
| **Stub** (empty bodies, unimplemented features) | contract decline (1), admin-bypass (1) | DELETE files — no feature to test yet |
| **External dep** (DocuSeal, landing server) | contract signing (1), landing (2) | KEEP skipped — correct behavior, add better skip messages |
| **Runtime conditional** (wizard active, no shift) | performance-gates (8), shift-clock (1) | KEEP conditional skips — these are graceful degradation, not bugs |
| **Removed feature** (brand panel) | join-wizard (1) | DELETE — brand panel doesn't exist |
| **Missing data-testid** (protocol) | protocol.spec.ts (1) | KEEP skipped — needs onboarding component work first |

**Net result:** Delete 8 tests (5 onboarding + 2 contract stubs + 1 join-wizard), improve skip messages on 3 (landing + DocuSeal), leave 7 conditional skips as-is (correct runtime behavior), leave 1 protocol skip as-is.

---

### Task 1: Delete obsolete onboarding tests

**Files:**
- Modify: `apps/e2e/tests/onboarding.spec.ts`

The old scroll-based wizard was replaced by the AnimatedWizardShell. All 5 skipped tests reference removed UI (URL input, auth step, battlefield review). The `workspace-setup-flow.spec.ts` file is the replacement. The two non-skipped tests (invitation accept) remain.

- [ ] **Step 1: Read the file and identify what to keep**

The file has two `test.describe` blocks:
1. "Onboarding Wizard Flow" — 5 tests, ALL skipped. Delete entire describe block.
2. "Invitation Accept Page" — 2 tests, NOT skipped. Keep.

- [ ] **Step 2: Delete the "Onboarding Wizard Flow" describe block**

Replace the entire file content with just the invitation tests:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Invitation Accept Page", () => {
  test("should show error for invalid token", async ({ page }) => {
    await page.goto("/invite/00000000-0000-0000-0000-000000000000");
    await expect(
      page
        .locator("text=Invitasjonen ble ikke funnet")
        .or(page.locator("text=Invitation not found"))
        .or(page.locator("text=ikke funnet")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show invitation page structure for valid-format token", async ({ page }) => {
    await page.goto("/invite/11111111-1111-1111-1111-111111111111");
    await expect(page.locator("body")).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the onboarding test file to verify**

Run: `cd apps/e2e && pnpm playwright test tests/onboarding.spec.ts --reporter=list`
Expected: 2 tests pass (the invitation tests), 0 skipped.

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/tests/onboarding.spec.ts
git commit -m "test(e2e): remove 5 obsolete onboarding wizard tests

Old scroll-based wizard was replaced by AnimatedWizardShell.
Replacement tests live in workspace-setup-flow.spec.ts.
Kept 2 invitation accept tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Delete empty contract stub files

**Files:**
- Delete: `apps/e2e/tests/contract-composition/decline.spec.ts`
- Delete: `apps/e2e/tests/contract-composition/admin-bypass.spec.ts`

Both files contain only empty test bodies with comment-only pseudocode. The features (employee decline flow, admin PII bypass) don't exist yet. Empty stubs add noise to test reports.

- [ ] **Step 1: Delete the stub files**

```bash
rm apps/e2e/tests/contract-composition/decline.spec.ts
rm apps/e2e/tests/contract-composition/admin-bypass.spec.ts
```

- [ ] **Step 2: Verify happy-path still passes**

Run: `cd apps/e2e && pnpm playwright test tests/contract-composition/ --reporter=list`
Expected: happy-path.spec.ts tests run, no decline/admin-bypass files.

- [ ] **Step 3: Commit**

```bash
git add -A apps/e2e/tests/contract-composition/
git commit -m "test(e2e): remove empty contract decline and admin-bypass stubs

Features not implemented yet. Stubs had empty bodies with pseudocode.
Will be recreated when decline flow and admin PII bypass are built.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Improve DocuSeal signing test skip message

**Files:**
- Modify: `apps/e2e/tests/contract-composition/happy-path.spec.ts:333`

The DocuSeal signing test is correctly skipped (external service), but the skip message should clearly state this is intentional and permanent in local dev.

- [ ] **Step 1: Update the skip message**

Change line 333 from:

```typescript
  test.skip("employee signs contract via DocuSeal", async () => {
    // DocuSeal is an external signing service — cannot be controlled in local dev.
    // Signing flow: /sign/{signing_url} → DocuSeal iframe → webhook callback
    // Test this manually or with a DocuSeal sandbox environment.
  });
```

to:

```typescript
  test.skip("employee signs contract via DocuSeal", async () => {
    // PERMANENT SKIP: DocuSeal is an external signing service.
    // Local dev has no DocuSeal sandbox. Manual test or staging-only.
    // Flow: /sign/{signing_url} → DocuSeal iframe → webhook callback
  });
```

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/tests/contract-composition/happy-path.spec.ts
git commit -m "test(e2e): clarify DocuSeal signing test skip is permanent

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Delete brand panel test from join-wizard

**Files:**
- Modify: `apps/e2e/tests/join-wizard.spec.ts:257`

Brand panel was replaced by WizardSidebar. Test 8 tests a feature that no longer exists.

- [ ] **Step 1: Delete the skipped test**

Remove lines 253-259 (the `test.skip("brand panel shows step-specific messages"` block):

```typescript
  // ─── Test 8: Brand panel → SKIPPED ─────────────────────
  // Brand panel no longer exists in WizardShell. Replaced by WizardSidebar
  // which shows step labels (visible on lg+ screens only).

  test.skip("brand panel shows step-specific messages", async () => {
    // WizardShell replaced brand panel with WizardSidebar.
    // Sidebar shows step labels, not contextual brand messages.
  });
```

- [ ] **Step 2: Run join-wizard tests to verify**

Run: `cd apps/e2e && pnpm playwright test tests/join-wizard.spec.ts --reporter=list`
Expected: Remaining tests run without issues.

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/tests/join-wizard.spec.ts
git commit -m "test(e2e): remove brand panel test — feature replaced by WizardSidebar

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verify conditional skips are working correctly

**Files:**
- Verify: `apps/e2e/tests/performance-gates.spec.ts` (8 conditional skips)
- Verify: `apps/e2e/tests/journey-shift-clock.spec.ts` (1 conditional skip)
- Verify: `apps/e2e/tests/landing.spec.ts` (2 conditional skips)
- Verify: `apps/e2e/tests/protocol.spec.ts` (1 skip)

These tests use runtime conditional skips (`test.skip(condition, reason)`) which is correct Playwright behavior. When the wizard is active, sidebar isn't visible, or landing server isn't running, these tests gracefully skip instead of failing.

- [ ] **Step 1: Run all e2e tests and verify skip behavior**

Run: `cd apps/e2e && pnpm playwright test --reporter=list 2>&1 | grep -E "skip|SKIP|passed|failed"`
Expected: No unexpected failures. Conditional skips appear as "skipped" with reason messages.

- [ ] **Step 2: Document the skip inventory**

No code changes needed. These conditional skips are correct. Document counts for the commit message.

Expected inventory after all changes:
- **Deleted:** 8 tests (5 onboarding, 2 contract stubs, 1 brand panel)
- **Permanently skipped:** 2 (DocuSeal signing, protocol P-001 data-testid)
- **Conditionally skipped at runtime:** 8 performance-gates + 1 shift-clock + 2 landing = 11 (correct behavior, skip when precondition not met)

- [ ] **Step 3: Final full test suite run**

Run: `cd apps/e2e && pnpm playwright test --reporter=list`
Expected: All non-skipped tests pass. No regressions.

---

## Part B: Cascade Phase D — Publish Validation Dialog

### Context

Phase D (Cascade Operational Layer) is **95% implemented**:

| Component | Status |
|-----------|--------|
| Schema migration (snapshot_basis, provenance columns) | DONE |
| `buildEntityContext()` pure function + tests | DONE |
| `useEmployeeRuleContext()` hook | DONE |
| `useShiftRuleCheck()` hook | DONE |
| Shift modal rule warning badges | DONE |
| `usePublishValidation()` hook | DONE |
| **Publish dialog validation summary** | **NOT WIRED** |
| `cascade_cost_snapshot` engine action | DONE |
| `cascade_budget_propagation` engine action | DONE |
| Engine trigger seed migrations | DONE |
| `shift_ids` enrichment in "shift published" | DONE |
| `"shift completed"` emit from punch-out | DONE |
| `useFrameworkRules()` settings hook | DONE |
| `FrameworkRulesPanel` settings component | DONE |
| `useWorkspaceTariffs()` settings hook | DONE |
| `TariffRatesPanel` settings component | DONE |
| `ChangeProposalsPanel` settings component | DONE |
| All wired into settings-tabs.tsx | DONE |

**Only missing piece:** The publish overview dialog (`publish-overview-dialog.tsx`) doesn't call `usePublishValidation()` to show rule hit summary before confirming publish.

---

### Task 6: Wire usePublishValidation into publish dialog

**Files:**
- Modify: `apps/web/src/app/dashboard/schedule/_components/publish-overview-dialog.tsx`

The spec says the publish dialog should show:
- "12 shifts ready, 0 issues" → green, proceed
- "12 shifts ready, 2 warnings" → yellow, expandable detail, proceed allowed
- "12 shifts ready, 1 blocked" → red, expandable detail, proceed allowed but acknowledged ("Publiser likevel")

- [ ] **Step 1: Read current publish dialog**

File: `apps/web/src/app/dashboard/schedule/_components/publish-overview-dialog.tsx`
Already read above. It has `shifts`, `employees` props. We need to add validation.

- [ ] **Step 2: Add validation imports and hook**

Add these imports at the top of publish-overview-dialog.tsx:

```typescript
import { AlertTriangle, CheckCircle } from "lucide-react";
import { usePublishValidation, type PublishValidationHit } from "../_hooks/use-publish-validation";
```

- [ ] **Step 3: Call usePublishValidation inside the component**

Inside `PublishOverviewDialog`, after the `groupedByDay` memo, add:

```typescript
  // Prepare shifts for validation (map to the format usePublishValidation expects)
  const shiftsForValidation = useMemo(
    () =>
      draftShifts.map((s) => ({
        id: s.id,
        employeeId: s.employeeId,
        employeeName: s.employeeId
          ? (employeeMap.get(s.employeeId)?.name ?? "Ukjent")
          : "Ikke tildelt",
        dateId: s.dateId,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    [draftShifts, employeeMap],
  );

  const { result: validation, isLoading: validationLoading } = usePublishValidation(
    shiftsForValidation,
    open && draftShifts.length > 0,
  );

  const hasWarnings = (validation?.warnings ?? 0) > 0;
  const hasBlocked = (validation?.blocked ?? 0) > 0;
  const [showHits, setShowHits] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
```

- [ ] **Step 4: Add validation summary between ScrollArea and DialogFooter**

After the closing `</ScrollArea>` and before `<DialogFooter>`, add:

```tsx
        {/* Validation summary */}
        {draftShifts.length > 0 && !validationLoading && validation && (validation.warnings > 0 || validation.blocked > 0) && (
          <div className="border-border border-t px-6 py-3">
            <button
              type="button"
              onClick={() => setShowHits(!showHits)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                hasBlocked
                  ? "bg-red-500/10 text-red-500"
                  : "bg-yellow-500/10 text-yellow-500"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {validation.warnings > 0 && `${validation.warnings} advarsel${validation.warnings > 1 ? "er" : ""}`}
                {validation.warnings > 0 && validation.blocked > 0 && ", "}
                {validation.blocked > 0 && `${validation.blocked} blokkert`}
              </span>
              <ChevronRight className={`ml-auto h-3.5 w-3.5 transition-transform ${showHits ? "rotate-90" : ""}`} />
            </button>

            {showHits && (
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {validation.hits.map((hit, i) => (
                  <div
                    key={`${hit.shiftId}-${i}`}
                    className={`rounded px-2.5 py-1.5 text-xs ${
                      hit.outcome === "blocked"
                        ? "bg-red-500/5 text-red-400"
                        : "bg-yellow-500/5 text-yellow-400"
                    }`}
                  >
                    <span className="font-medium">{hit.employeeName}</span>
                    <span className="text-muted-foreground"> — {hit.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {draftShifts.length > 0 && !validationLoading && validation && validation.warnings === 0 && validation.blocked === 0 && (
          <div className="border-border border-t px-6 py-3">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500">
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              {validation.totalShifts} {validation.totalShifts === 1 ? "vakt" : "vakter"} klar, ingen regelbrudd
            </div>
          </div>
        )}
```

- [ ] **Step 5: Update the publish button to handle blocked shifts**

Change the DialogFooter publish button to require acknowledgment when blocked shifts exist:

```tsx
        <DialogFooter className="border-border flex-row gap-2 border-t px-6 py-4 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={draftShifts.length === 0 || isPublishing || validationLoading}
            className={
              hasBlocked && !acknowledged
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {hasBlocked && !acknowledged ? "Publiser likevel" : "Publiser alle"}
          </Button>
        </DialogFooter>
```

When blocked, first click sets `acknowledged = true` via `handlePublish`:

```typescript
  function handlePublish() {
    if (hasBlocked && !acknowledged) {
      setAcknowledged(true);
      return;
    }
    const ids = draftShifts.map((s) => s.id);
    onPublish(ids);
    toast.success(`${ids.length} vakter publisert`);
    onOpenChange(false);
  }
```

- [ ] **Step 6: Reset state on dialog open/close**

Add reset in the component body:

```typescript
  // Reset validation UI state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setShowHits(false);
      setAcknowledged(false);
      setDiscardedIds(new Set());
    }
  }, [open]);
```

Replace the existing `useState<Set<string>>(new Set())` for discardedIds — the reset is now handled in the useEffect. Change the initial state to just `new Set()` (it already is).

Add `useEffect` to the imports:

```typescript
import { useMemo, useState, useEffect } from "react";
```

- [ ] **Step 7: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/publish-overview-dialog.tsx
git commit -m "feat(schedule): wire cascade rule validation into publish dialog

Shows rule hit summary (warnings/blocked) before publish confirmation.
Blocked shifts require explicit acknowledgment ('Publiser likevel').
Green summary when all shifts pass validation.

Uses existing usePublishValidation() hook from cascade operational layer.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Update STATE-SUMMARY to reflect Phase D completion

**Files:**
- Modify: `docs/STATE-SUMMARY.md`

- [ ] **Step 1: Update cascade status**

Change the Cascade Status section from:

```markdown
## Cascade Status (~55% complete)

- Phase A (Schema): DONE
- Phase B (Pure Functions): DONE — 9 functions, 8 test files
- Phase C (Bootstrap): 85% — framework seeded, I1 bootstrap wired
- Phase D (Adapters): NOT STARTED
- Phase E (Control Planes): NOT STARTED — C4 governance first
```

to:

```markdown
## Cascade Status (~75% complete)

- Phase A (Schema): DONE
- Phase B (Pure Functions): DONE — 10 functions, 8 test files
- Phase C (Bootstrap): 85% — framework seeded, I1 bootstrap wired
- Phase D (Operational Layer): DONE — hooks, panels, engine actions, publish validation all wired
- Phase E (Control Planes): NOT STARTED — C4 governance first
- Phase F (External Adapters): NOT STARTED — Tripletex first target
```

Update the "Top Priority Gaps" to remove Phase D:

```markdown
## Top Priority Gaps

No critical gaps. Next focus areas:

1. **Cascade Phase E (Control Planes)** — NOT STARTED. C4 governance first.
2. **Cascade Phase C last 15%** — I1 bootstrap wired, needs final verification.
3. **Cascade Phase F (External Adapters)** — NOT STARTED. Tripletex payroll sync.
```

- [ ] **Step 2: Commit**

```bash
git add docs/STATE-SUMMARY.md
git commit -m "docs: update STATE-SUMMARY — cascade Phase D now complete

Phase D operational layer was already 95% implemented.
Final piece (publish dialog validation) wired in this session.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Validation

### Task 8: Full verification pass

- [ ] **Step 1: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: All packages pass, 0 errors.

- [ ] **Step 2: Run unit tests**

Run: `pnpm turbo test`
Expected: All unit tests pass.

- [ ] **Step 3: Run E2E test suite**

Run: `cd apps/e2e && pnpm playwright test --reporter=list`
Expected: No new failures. Deleted tests no longer appear. Conditional skips still work.

- [ ] **Step 4: Manual verification of publish dialog**

Start dev server: `pnpm dev --filter=web`
1. Login as admin
2. Navigate to /dashboard/schedule
3. Create 2-3 draft shifts
4. Click publish → verify validation summary appears
5. If framework rules are seeded: verify warnings/blocked show correctly
6. If no framework binding: verify green "0 issues" summary

---

## Summary

| Workstream | Tests Before | Tests After | Change |
|------------|-------------|-------------|--------|
| Onboarding | 7 (5 skipped) | 2 (0 skipped) | -5 deleted |
| Contract decline | 1 (skipped) | 0 | -1 deleted |
| Contract admin-bypass | 1 (skipped) | 0 | -1 deleted |
| Contract signing | 1 (skipped) | 1 (skipped) | 0 (permanent, external dep) |
| Join-wizard brand | 1 (skipped) | 0 | -1 deleted |
| Performance gates | 8 (conditional) | 8 (conditional) | 0 (correct behavior) |
| Shift clock | 1 (conditional) | 1 (conditional) | 0 (correct behavior) |
| Landing | 2 (conditional) | 2 (conditional) | 0 (correct behavior) |
| Protocol | 1 (skipped) | 1 (skipped) | 0 (needs data-testid work) |
| **Total** | **18 skipped** | **10 remaining** | **-8 deleted** |

Phase D: Publish dialog validation wired → Cascade Phase D complete.
