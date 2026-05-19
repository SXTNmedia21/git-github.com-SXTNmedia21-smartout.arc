---
title: "Journey — hms-cluster-polish-r2-fixup"
status: verified
feature: hms-cluster-polish-r2-fixup
updated: 2026-05-17
created: 2026-05-17
module: hms
tags: [journey, council-followup, r2-fixup, a11y, wcag]
---

# Journey — hms-cluster-polish-r2-fixup

> R2 council fixup. Closes 3 blockers (B1+B3+B4) + 1 maintenance (B5).

## Journey 1: Keyboard-only user navigates procedure detail tabs (B3 — WCAG 2.4.11)

**Precondition:** Trainer/admin viewing a protocol detail page that mounts `ProcedureDetailTabs` (Oversikt / Steg / Quiz / Bekreftelse).

1. User presses Tab → System focuses first tab button → User sees visible focus ring (Nordic Split ring tokens).
2. User presses Arrow Right / Tab → System moves focus across tab buttons → User sees ring follow.
3. User presses Enter on focused tab → System switches active tab → Content updates.

**Postcondition:** Keyboard-only user navigates with visible focus indicator. WCAG 2.4.11 (Focus Appearance) satisfied via `focus-visible:ring-*` tokens.

**Error path:** None — pure UI surface.

## Journey 2: Keyboard-only learner navigates training stage progress (B4 — WCAG 2.4.11)

**Precondition:** Trainee in LearnFlow component, working through Understand / Practice / Test / Confirm / Done stages.

1. User presses Tab → System focuses first stage button → User sees visible focus ring.
2. User presses Arrow / Tab → Focus advances → Ring follows.
3. User presses Enter → System advances stage → Content updates.

**Postcondition:** Keyboard-only learner sees focus state across all 5 stage buttons. WCAG 2.4.11 satisfied.

**Error path:** None.

## Journey 3: Botsson reads training-route knowledge (B1 — site-map validator passes)

**Precondition:** User asks Botsson about `/dashboard/hms/training` (chat or voice).

1. Botsson queries `apps/web/.botsson/site-map.json` → System returns training entry with trimmed 130-char purpose.
2. Botsson explains: "Training mode for protocols + competence matrix. Admin sees readiness matrix; employee sees assigned protocols."
3. User navigates → System loads training route.

**Postcondition:** Site-map validator exits 0 (was 1 with `✗ purpose >140 chars`). Botsson route knowledge intact with concise description.

**Error path:** N/A — read-only lookup.

## Journey 4: Sortie 4 author plans dashboard-wide animate-spin migration (B5 — HANDOFF accuracy)

**Precondition:** Sortie 4 author plans accessibility sortie.

1. Author opens predecessor HANDOFF Known Issue #3 → Reads "297 occurrences across 180+ files" (was "6").
2. Author understands true scope → Plans dashboard-wide `useReducedMotion()` audit + ESLint rule, not HMS-local fix.
3. Sortie 4 scope reflects reality.

**Postcondition:** Known Issue #3 says 297, not 6. Sortie 4 plans correctly framed.

**Error path:** N/A — documentation update.

## Journey 5: Future R2-class council audits validators correctly (L-NEW-C — head-truncation lesson)

**Precondition:** Future post-implementation council Phase 3 dispatch.

1. Reviewer code-traces a validator script's output → Pipes full output, does NOT use `head -N` truncation.
2. Reviewer captures exit code via `; echo "exit=$?"` or equivalent.
3. If `✗` printed AND exit=0 → genuine validator bug. If `✗` printed AND exit=1 → validator works as designed.
4. Phase 5 chair verifies reviewer's exit-code claim against actual invocation before classifying as "self-bug".

**Postcondition:** False `validator self-bug` claims don't propagate. R2 chair retraction (this council) becomes the precedent.

**Error path:** If chair self-reversal evidence is itself truncated → flag for re-verification, do not classify REVERSED.
