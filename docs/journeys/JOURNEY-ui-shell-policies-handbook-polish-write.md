---
title: "Journey — Write-heavy HMS routes ship production polish"
status: verified
feature: policies-handbook-polish-write
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, polish, hms, policies, handbook, council-verified, campaign-ui-shell, M5-final]
---

# Journey — Write-heavy HMS routes ship production polish

> Sub-sortie: `policies-handbook-polish-write`. M5 Sortie 4 of 4 — FINAL. Council-verified 2026-05-17.

## Journey: Admin opens DeviationKanban on slow network — SkeletonEntrance at route boundary, then cards static-load

**Precondition:** Admin signed in. Pre-this-sortie, `/dashboard/hms/deviations` lacks both loading.tsx + error.tsx. DeviationKanban has hardcoded palette tokens for status columns.

1. Admin navigates to `/dashboard/hms/deviations` → Server Component shell runs
2. Suspense fallback `DeviationsLoading` (NEW) renders → SkeletonEntrance at ROUTE boundary, NOT per-card
3. Deviations query resolves → DeviationKanban renders with cards as static elements on initial load (no card-level enter animation)
4. User drags card to new status column → AnimatePresence with `mode="popLayout"` handles card reorder cleanly
5. Status badges use semantic tokens (success/warning/destructive/info) — dark mode parity correct
6. Telemetry events fire on user actions: `deviation status_changed`, `deviation acknowledged`, etc. (server-side awaited via Server Action per Sortie 1 closure)

**Postcondition:** Initial load = fast + static. Interactions = animated only where motion adds value. No motion-budget regression.

**Error paths:**
- Deviation query throws → `error.tsx` (NEW) renders Norwegian retry button, semantic destructive accent
- AnimatePresence per-card on initial mount → MOTION BUDGET VIOLATION — reject

## Journey: Admin opens PolicyCreateDialog — focus trap + accessibility

**Precondition:** Admin on `/dashboard/policies`. Pre-sortie, dialog has hardcoded tokens (TBD per recon).

1. Click "Ny policy" → shadcn Dialog opens with focus auto-trapped (Radix UI default)
2. First input auto-focused (or per shadcn convention)
3. Tab cycles within dialog only; Esc closes; Shift+Tab cycles backward
4. Form submits → calls `createPolicy` Server Action (gated post-Sortie-1)
5. Success → toast + dialog closes + list refreshes
6. PolicyTypeBadge uses semantic tokens (info/success/etc per type)

**Postcondition:** Dialog accessible. Tokens semantic. Mutation gated.

## Journey: Admin reads handbook chapter — Nordic Split reading experience

**Precondition:** Admin on `/dashboard/handbook`. Pre-sortie, has loading.tsx; ChapterReader hardcoded tokens TBD.

1. Navigate to chapter → ChapterReader renders prose content
2. Typography: `font-heading` Instrument Serif for headings, Geist Sans body — established
3. Color tokens semantic — no hardcoded grays/blues/reds for callouts/quotes/emphasis
4. Reading state stable across navigation (handbook-page-client maintains scroll)
5. Telemetry: `handbook chapter_opened` if not already registered

**Postcondition:** Reading experience matches Nordic Split. Cascade role: K1b content layer surface.

## Journey: Procedure detail with multi-step LearnFlow

**Precondition:** Admin on `/dashboard/hms/procedure/[id]`. ProcedureDetailTabs + ProcedureExperience + LearnFlow (LearnFlow already polished Sortie 3). Loading + error needed.

1. Server resolves procedure context → tabs render (overview, steps, attestation)
2. LearnFlow renders sequential step UI (already Sortie 3 polished)
3. ProcedureExperience wraps the flow with progress indicator
4. Tab switching = ARIA tab pattern (verify per Sortie 3 HmsSubNav fix)
5. Loading state = SkeletonEntrance at route boundary

**Postcondition:** Procedure surface coherent across tabs.

**Error paths:**
- `[id]` not found → 404 (not error.tsx scope; 404 page handles)
- Network/RLS error → error.tsx renders

## Verification

- `pnpm turbo typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0
- `pnpm lint:tool-collisions` → exit 0 (allowlist still 8)
- `ls apps/web/src/app/dashboard/{policies,handbook,hms/deviations,hms/procedure/[id]}/error.tsx` → 4 files
- `ls apps/web/src/app/dashboard/hms/{deviations,procedure/[id]}/loading.tsx` → 2 files
- `grep -nE 'bg-(green|amber|red|yellow|orange|blue|purple|emerald|rose|indigo|cyan|teal|sky|lime|pink|fuchsia|violet)-[0-9]|text-(green|amber|red|yellow|orange|blue|purple|emerald|rose)-[0-9]' apps/web/src/app/dashboard/hms/_components/{Deviation,Procedure}*.tsx apps/web/src/app/dashboard/policies/_components/*.tsx apps/web/src/app/dashboard/handbook/_components/*.tsx` → 0 hits
- `grep "Prøv igjen" apps/web/src/app/dashboard/{policies,handbook,hms/deviations,hms/procedure/[id]}/error.tsx` → 4 hits
- Motion guard verify on DeviationKanban: no AnimatePresence per-card on initial mount

## E2E (recommended)

S12 protocol already covers all 4 routes for HTTP < 500 (M1 sidebar-reorg). Per-route error.tsx render test deferred. DeviationKanban drag-drop interaction test deferred (out of scope this sortie).

## Council learning ref

- L-0286 (Polish PRs gild half-converted patterns) — Sortie 1 closed mutation surface; this sortie clean
- L-0287 (Bridge tool description phantom amplifier) — no new tools this sortie
- ADR-0360 ratchet — verified post-merge
- L-0271 (Frontend-designer hook loop) — G4 dispatched via general-purpose sonnet fallback
