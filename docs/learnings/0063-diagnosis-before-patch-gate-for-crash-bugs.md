---
title: Diagnosis-before-patch gate for crash bugs
id: L-0063
status: accepted
layer: learning
module: meta
created: 2026-04-19
updated: 2026-04-19
tags: [learnings, debugging, process, crash-bugs]
---

# Learning-0063: Diagnosis-before-patch gate for crash bugs

## What Happened

On 2026-04-19 a runtime error surfaced in two unrelated surfaces with an identical-looking stack: `Cannot read properties of null (reading 'dispatchEvent') at History.pushState`. The first diagnosis (web-side Radix focus restoration race) fit the invoice-detail-sheet reproducer and got a minimal patch (`onCloseAutoFocus={(e) => e.preventDefault()}`). The same error string then appeared in the Expo-web mobile build, and the initial instinct was to apply the same fix. A council review found that the two errors shared surface strings but had different root causes: the web bug was a conditional-parent-unmount race (`page.tsx:90` destroyed the Sheet before Radix's close animation could run); the mobile bug was an `auth-provider` route-guard redirect racing a screen's passive unmount, further complicated by uncommitted drift that left `react@19.2.0` + `react@19.2.4` both resolvable in the pnpm store.

Prior to the council, two rounds of symptom-patching had already been applied to the mobile code:
- Throw-instead-of-noop stubs in `apps/mobile/app/(app)/(chat)/[id].tsx` for web-unsupported functions
- `router.canGoBack()` guards around `router.back()`

Neither addressed the root race. Both made the bug harder to find by moving the crash site.

## What We Learned

Shared error surface strings lie. `null.dispatchEvent` at `History.pushState` is a generic web-API-layer symptom produced by at least four distinct root causes (Radix unmount race, expo-router memory-adapter race, dual-renderer hoist collision, FocusScope restoration to detached node). A minimal fix for one root cause is not a minimal fix for a different root cause with the same signature.

The failure mode is subtle: the first patch *works* in the first surface where you apply it, which reinforces the wrong mental model. When the same symptom appears elsewhere, the temptation is to copy the first fix rather than re-diagnose. The copy fails silently (no regression test catches it), and the bug accumulates symptom-patches until someone traces the actual code path end-to-end.

## The Rule

**A crash-bug fix requires a named, falsifiable root-cause hypothesis before the patch lands.** The hypothesis must include:

1. The exact call path that produces the crash (file:line citations, not "somewhere in the Sheet close flow").
2. The specific null or detached reference being dereferenced (not "something is null").
3. A reproducer — user actions, code path, or test case — that triggers the crash deterministically.
4. An explanation of why the patch invalidates the hypothesis (the patch removes the null dereference at the cited line, not just the user-visible symptom).

If any of the four are missing or vague, the patch is a symptom-patch. It may ship as a hotfix, but it must be followed by a tracked root-cause diagnosis within the same sprint.

## How to Apply It

**In code reviews of crash-bug fixes.** Reject PRs whose commit message or PR description says "fixes crash" without the four-point hypothesis. Acceptable phrasing: "Radix's `onCloseAutoFocus` callback fires `restoreFocus(previousActiveElement)` at `DialogContent.unmount:142`; `previousActiveElement` is a `<TableRow>` detached by the parent's conditional-render unmount at `page.tsx:90`. Patch always-mounts the Sheet so the row is never detached during close. Reproducer: open preview, change filter, observe crash before patch / no crash after."

**In councils.** The Chair must enforce the Trust Gate — no "the fix looks right" without a named root cause. If two agents disagree on the root cause, the Chair forces semantic conflict resolution in Phase 5 rather than papering over.

**In agent-dispatched work.** When delegating a crash-bug fix to a subagent, include the four-point hypothesis in the briefing. Do not delegate "find and fix the crash" — delegate "verify this hypothesis and apply the patch if it holds."

## What Would Have Caught This Earlier

- **A Playwright smoke covering the Sheet-close-on-route-change path** would have caught the web bug on the billing-engine PR that introduced it.
- **A single-React-version assertion in CI** (`pnpm ls react -r | wc -l` vs expected count) would have caught the mobile drift before it produced a crash.
- **A branch rule** that `apps/mobile/package.json` SDK bumps must be a separate commit would have prevented the drift from being mixed with other work.

## Distinct From, But Related To

- **L-0059 (grep-count briefings undercount without code trace)** — same family ("don't skip the code trace") but applied to audit scoping, not crash fixes.
- **L-0054 (grep-based site inventories inflate scope)** — same family, applied to remediation planning.
- This learning is specific to **crash bugs** (runtime exceptions). Non-crash bugs (wrong behavior, bad UX, missing telemetry) have different diagnosis norms.

## Reference

- Council session 2026-04-19 "Cross-stack null.dispatchEvent audit" — [COUNCIL-LOG entry](../council/COUNCIL-LOG.md).
- ADR-0153 (Expo-web Surface Classification) — the structural outcome.
- Chair ruling quote: "Three different failures share a family resemblance ('we treated the symptom') but have different remediations. Folding them into one rule produces a vague principle that can't be enforced. This rule is scoped to crash bugs — narrow enough to enforce."

---

**Registered in:** `docs/learnings/0000-learning-log.md`
