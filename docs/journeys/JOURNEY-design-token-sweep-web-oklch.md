---
title: "Journey — design-token-sweep-web-oklch"
status: draft
updated: 2026-05-28
created: 2026-05-28
module: design-system
tags: [journey, design-tokens, oklch, eslint, adr-0366, nordic-split, web]
---

# Journey — design-token-sweep-web-oklch

## Journey: Developer introduces `oklch(...)` literal in web component → ESLint blocks

**Precondition:** Sortie shipped. `no-oklch-literal` ESLint rule wired into `apps/web/.eslintrc`
at error level. CI runs `pnpm --filter web lint` as a required check.

1. Developer writes new component in `apps/web/src/components/foo/Foo.tsx`
2. Developer types `className="bg-[oklch(0.7_0.2_180)]"` (or `style={{ color: 'oklch(...)' }}`)
3. Developer saves file → editor ESLint shows red squiggle with rule `no-oklch-literal`
4. Developer runs `pnpm --filter web lint` locally → exits non-zero with file:line of violation
5. Developer reads error message: "OKLCH literal banned per ADR-0366. Use CSS variable from globals.css (e.g. `var(--foreground)`) or a shadcn token class."
6. Developer replaces literal with `text-foreground` or `var(--primary)` reference
7. Lint passes → commit allowed

**Postcondition:** No new `oklch(...)` literal can land in `apps/web/src/**` outside `globals.css`.

**Error paths:**
- Developer adds `// eslint-disable-next-line no-oklch-literal` — rule still works for the rest of file. Disable comment requires PR-reviewer judgment (no auto-blocker, but visible in diff)
- Developer tries to bypass with `String.fromCharCode(...)` concat — out of scope; not a real-world path; lint catches the literal, not run-time computed strings
- Sortie ships rule but doesn't wire to husky pre-push → first regression slips to CI → fix: ensure `lint:fix-or-fail` runs in `.husky/pre-push`

---

## Journey: CI on PR catches OKLCH literal that slipped past local lint

**Precondition:** Developer either skipped local lint or used `--no-verify`. PR opened against
`development` or `preview`.

1. PR opened → GitHub Actions triggers `web-lint` workflow (existing or added in this sortie)
2. Workflow runs `pnpm --filter web lint` → fails with violation list
3. PR shows red ✗ on `web-lint` required check → merge button disabled
4. Developer pushes fix → lint passes → check goes green → merge unblocks

**Postcondition:** OKLCH literals cannot land in `apps/web/` even with local hook bypass.

**Error paths:**
- Required check not configured in branch protection → merge possible with red lint. Fix: branch protection must include `web-lint` (or whichever job name) in required status checks for `development` + `preview` + `main`
- Lint job times out or runs out of memory → not a code violation; fix as ops problem separately

---

## Journey: Existing 28 OKLCH literals + 4 zinc/slate/gray hits → sweep audit grep returns 0

**Precondition:** Tier 2 + Tier 3 sweep complete. All hits replaced with tokens.

1. Run `grep -rEn "oklch\(" apps/web/src/components apps/web/src/app` → 0 hits
2. Run `grep -rEn "(zinc|slate|gray)-[0-9]" apps/web/src/components apps/web/src/app` → 0 hits
3. Visual spot-check 5 high-traffic pages:
   - `/dashboard` → backgrounds, headers, text render identical to pre-sweep (Nordic Split light + dark)
   - `/dashboard/schedule` → shift cells, sub-header, drag-handles render identical
   - `/dashboard/oppgaver` → DnD chips, tabs, timeline render identical (PR-487 + PR-488 baselines)
   - `/dashboard/payroll` → period table, Godkjenn button render identical
   - `/dashboard/contracts` → contract list, status badges render identical
4. Run `pnpm turbo typecheck` → 0 errors
5. Theme toggle (light ↔ dark) on each spot-check page → colors switch correctly

**Postcondition:** Baseline-defining grep returns 0 for OKLCH + zinc/slate/gray; visual parity
holds across light + dark in 5 spot-check pages.

**Error paths:**
- Sweep removed a token-mapped class but no equivalent CSS variable exists → visual regression. Fix: add the missing token to `globals.css` BEFORE swapping (Tier 2 sub-step)
- Spot-check reveals contrast regression (e.g. white-on-light, dark-on-dark) → revert the specific hit; add a comment marking why this position needs a literal; OR add a new semantic token

---

## Journey: 206 hex hits categorized into actionable buckets for follow-up

**Precondition:** Tier 4 complete. `docs/audits/2026-05-28-oklch-sweep/hex-buckets.md` written.

1. Open `hex-buckets.md` → see three counts: Bucket A (exempt) / Bucket B (replaceable) / Bucket C (ambiguous)
2. Sum equals 206 (all hits categorized)
3. Bucket B section lists file:line samples + suggested token replacement
4. Bucket A section lists file:line + reason exempt (SVG fill, gradient stop, third-party prop)
5. Bucket C section lists file:line + question for design-system reviewer
6. Next sortie scope: take Bucket B file list as the input + Bucket C decisions

**Postcondition:** A scoped follow-up sortie can pick up Bucket B without re-baselining.

**Error paths:**
- Bucket totals don't sum to 206 → re-bucket; numbers must reconcile
- Bucket B too large for one sortie → split by directory (`components/` separate from `app/dashboard/`)
