---
title: Feature Verification Template
status: done
updated: 2026-03-30
created: 2026-03-30
module: meta
tags: [template, verification, quality-gate]
---

# Feature Verification Template

> Run after implementation, before commit. Catches orphaned references, missing wiring, and integration gaps.

---

## When to Use

- After implementing a multi-file feature
- Before running `/close-feature`
- After adding new types/enums that propagate across layers

---

## Phase 1: Type Safety

```bash
# Must pass with 0 new errors (pre-existing errors are documented)
pnpm --filter web typecheck 2>&1 | grep "error TS"
pnpm --filter @smartout/ai typecheck 2>&1 | grep "error TS"
```

| Check         | Command                                | Pass criteria |
| ------------- | -------------------------------------- | ------------- |
| Web typecheck | `pnpm --filter web typecheck`          | 0 new errors  |
| AI typecheck  | `pnpm --filter @smartout/ai typecheck` | 0 new errors  |
| Full monorepo | `pnpm typecheck`                       | 0 new errors  |

---

## Phase 2: Stale References

Search for old identifiers that should have been replaced:

```bash
# Replace OLD_TERM / NEW_TERM with your feature's renames
grep -rn "OLD_TERM" apps/web/src/ packages/ --include="*.ts" --include="*.tsx"
```

**Common patterns:**

| What changed          | Search for stale   | Where to look                   |
| --------------------- | ------------------ | ------------------------------- |
| Section/stage renamed | Old name in quotes | types, components, context, CSS |
| Component replaced    | Old component name | page.tsx, imports, tests        |
| Type renamed          | Old type name      | interfaces, function signatures |
| DB enum changed       | Old enum value     | migrations, seed, types         |

---

## Phase 3: Cross-Layer Consistency

For features that touch multiple layers, verify each layer agrees:

### A. Type → State → UI → Agent chain

```
types.ts → defines the shape
    ↓
useOnboardingState.ts → manages state + actions
    ↓
WizardContext.tsx → exposes to components + agent
    ↓
useBotsson.ts → CLIENT_TOOLS + registerToolImplementation
    ↓
page.tsx → SECTION_COMPONENTS map
    ↓
NavigationController.tsx → SECTION_LABELS
    ↓
ParallaxBackground.tsx → SECTION_COLORS
    ↓
globals.css → CSS custom properties
```

**Verification command:**

```bash
# Extract each registry and compare counts
echo "Sections:" && grep -c '"' types.ts  # count entries
echo "Components:" && grep -c ':' page.tsx  # count entries
echo "Labels:" && grep -c ':' NavigationController.tsx
echo "Colors:" && grep -c ':' ParallaxBackground.tsx
echo "CSS vars:" && grep -c 'onboarding-' globals.css
```

All counts must match.

### B. Agent Tools chain

```
BotssonActions interface (useBotsson.ts)
    ↓ must match
botssonActions object (WizardContext.tsx)
    ↓ must match
CLIENT_TOOLS array (useBotsson.ts) — tool definitions
    ↓ must match
registerToolImplementation calls (useBotsson.ts) — implementations
```

**Verification command:**

```bash
echo "Interface:" && grep -c ":" BotssonActions
echo "Object:" && grep -c ":" botssonActions
echo "Definitions:" && grep -c "modelToolName" useBotsson.ts
echo "Implementations:" && grep -c "registerToolImplementation" useBotsson.ts
```

All counts must match.

### C. Stage Engine chain (if mission stages changed)

```
engine_stages seed/migration — stage_id + next_stage
    ↓ must form unbroken chain
Stage Engine loads all stages at runtime
    ↓ instructions must reference
Real tool names (not phantom tools)
```

**Verification:**

```bash
# Extract stage chain from seed
grep "'onboarding-interview'," seed/onboarding-mission.sql  # stage_ids + order
grep -E "'(discovery|confirm|season|departments|locations|procedures|welcome|NULL)'" seed.sql  # next_stage values
```

Chain must be: `stage1 → stage2 → ... → NULL` with no gaps.

**Tool reference check:**

| Real tool                        | Phantom (legacy) |
| -------------------------------- | ---------------- |
| `advanceToNextSection`           | `navigate_to`    |
| `updateBusiness`                 | `fill_field`     |
| `addKeyFact` (via KeyFactsPanel) | `show_panel`     |
| (use sonner toast directly)      | `show_toast`     |
| `advance` (engine HTTP tool)     | —                |
| `store` (engine HTTP tool)       | —                |

Stage instructions must only reference real tools.

---

## Phase 4: Two-Tool Advance Pattern

When the Stage Engine drives the flow, every stage (except the last) needs BOTH:

1. **`advanceToNextSection`** — scrolls the frontend UI
2. **`advance`** — transitions the engine session to next stage + rebuilds prompt

The last stage must NOT call `advance` (no next stage).

**Verification:**

```bash
# Check that non-terminal stages mention both tools
grep -A5 "When done:" seed/onboarding-mission.sql
# Should see: "advanceToNextSection" AND "advance" in each
```

---

## Phase 5: Data Flow Completeness

When new data types are added, verify the full lifecycle:

```
State declaration (useState)
    ↓
Actions (add/remove/toggle)
    ↓
getOnboardingState callback (exposed to agent)
    ↓
Context messages (pushed on section scroll)
    ↓
Finalize payload (sent to backend on completion)
    ↓
Reset (cleared on restart)
```

**Quick check:**

```bash
# New field name should appear in all 6 locations
grep "locations" useOnboardingState.ts  # state + actions + finalize + reset
grep "locations" WizardContext.tsx       # getState + context msgs
grep "procedures" useOnboardingState.ts
grep "procedures" WizardContext.tsx
```

---

## Phase 6: CSS/Style Completeness

When adding visual sections or components with theme tokens:

```bash
# Every section color referenced in code must exist in CSS
grep "color-onboarding" ParallaxBackground.tsx | sort
grep "color-onboarding" globals.css | sort
# Lists must match
```

---

## Verification Report Template

Copy and fill after running all phases:

```markdown
## Verification Report — [Feature Name]

| Phase | Check               | Result                           |
| ----- | ------------------- | -------------------------------- |
| 1     | Web typecheck       | X errors (Y pre-existing)        |
| 1     | AI typecheck        | X errors                         |
| 2     | Stale references    | None / [list]                    |
| 3A    | Type→State→UI→Agent | X/X match                        |
| 3B    | Agent tools         | X definitions, X implementations |
| 3C    | Stage chain         | [chain] → NULL                   |
| 4     | Two-tool advance    | All non-terminal stages correct  |
| 5     | Data flow lifecycle | All fields in all 6 locations    |
| 6     | CSS completeness    | All tokens declared              |

**Pre-existing issues (not from this feature):**

- [list any]

**Verdict:** PASS / FAIL
```

---

## Notes

- Run the full verification in under 30 seconds — these are all grep/typecheck commands
- Pre-existing errors should be documented, not fixed during verification
- If verification fails, fix the issue and re-run — don't skip phases
- This template complements `plan-verification.md` (which checks plan completeness, not code correctness)
