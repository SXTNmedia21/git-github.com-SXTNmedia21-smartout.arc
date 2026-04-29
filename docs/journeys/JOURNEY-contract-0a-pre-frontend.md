---
title: "Journey — Contract Phase 0a-pre Frontend"
feature: contract-0a-pre-frontend
status: verified
updated: 2026-04-29
created: 2026-04-29
module: contract
tags: [frontend, motion-tokens, nordic-split, scaffolds, phase-0a]
---

# Journey — Contract Phase 0a-pre Frontend

Pre-work sortie. Three independent workstreams — no user-facing flow yet (Phase 0a is schema-first). Journeys describe **developer journey** through this sortie's gates, not end-user product journeys.

## Journey 1: Build-agent migrates motion-debt site to motion tokens

**Mål:** 9 hardcoded transition/animation sites migrate to `motionTokens.*` from `@smartout/design-tokens`. `useReducedMotion` guards added where missing.

**Precondition:**
- 9 target files identified per Frontend Designer Council (AddShiftDialog, EntityDrawer, PaymentStatusBadge, DispatchStatusBadge, AnimatedWizardShell, ChatPanel, InteractiveDashboard, TaskSwiperCard, SignalCard)
- `packages/design-tokens/src/tokens.ts` `motion` export verified at lines 180–191

### Steg

1. **Build-agent** opens target file
   → Greps `duration: ` / `duration-` / bare ms literals
   → Replaces with `motion.spring`, `motion.springGentle`, `motion.springSnappy`, `motion.enterMs`, `motion.exitMs`, `motion.easingExpoArray`

2. **Agent** verifies `useReducedMotion` import
   → Adds Framer Motion `useReducedMotion()` hook if missing
   → Wraps spring physics in conditional: `const reduced = useReducedMotion(); const transition = reduced ? { duration: 0 } : motion.spring;`

3. **Agent** runs typecheck per file
   → `pnpm turbo typecheck --filter=web`
   → Fixes import paths if `@smartout/design-tokens` not yet imported

**Postcondition:**
- Grep `(duration: \d|duration-\[|duration-(75|100|150|200|300|500|700|1000))` over 9 files = 0 matches
- All 9 files import `motion` from `@smartout/design-tokens`
- `useReducedMotion` guard present on every spring/animation
- Typecheck 0 errors

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| File has hardcoded easing fn (e.g., `[0.4, 0, 0.2, 1]`) | Replace with `motion.easingExpoArray` |
| Component uses `transition` prop without spring | Convert to `transition={motion.spring}` shape |
| Existing `useReducedMotion` already present | Skip guard insert; reuse |
| Import path conflict with local `motion` variable | Rename local var to avoid `motion` collision |

## Journey 2: Architect amends ARCHITECTURE-contracts-module.md with 5 §UI sections

**Mål:** Add 5 net-new UI specification sections to canonical architecture doc per Council 2026-04-29 Frontend Designer findings.

**Precondition:**
- `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md` exists at HEAD
- 5 sections drafted inline in PLAN per source documents

### Steg

1. **Architect-agent** locates §UI insertion point in ARCHITECTURE doc
   → Append after existing §Compliance section
   → Each section starts with `## §UI {N}: {Title}`

2. **Architect-agent** adds Section 1 — UI Migration Map (5-step → 2-step drawer)
   → Table mapping old element → new home (per L-0174 cascade verb separation)

3. **Architect-agent** adds Section 2 — UI PII Policy
   → RevealableField component pattern: masking by default, click-to-reveal, 5s auto-mask, audit emit `contract.pii.revealed`
   → Tier mapping (Høy/Medium/Lav per ARCH §9)

4. **Architect-agent** adds Section 3 — UI ObligationBlocker
   → Single component, 3 render variants: mobile bottom sheet / web inline banner / Botsson rich card
   → Telemetry shape uniform across variants

5. **Architect-agent** adds Section 4 — UI Motion Inventory
   → 6 animated elements + `motionTokens.*` reference + `useReducedMotion` requirement

6. **Architect-agent** adds Section 5 — UI Mobile Parity
   → Per-journey allocation table (Journey 5 admin web-only / employee re-sign mobile+web per ADR-0133)

7. **Architect-agent** updates frontmatter `updated:` to today's date

**Postcondition:**
- 5 new `## §UI` sections present
- Frontmatter `updated:` = 2026-04-29
- ARCHITECTURE doc passes markdown lint

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| Existing §UI section conflicts | Renumber + append; no overwrite |
| Frontmatter missing | Add per `docs/templates/` convention |
| Motion token names changed since plan | Verify against `packages/design-tokens/src/tokens.ts` HEAD |

## Journey 3: Build-agent scaffolds 5 contract components (placeholder JSX)

**Mål:** 5 new `.tsx` files compile-safe, placeholder JSX, correct import structure. No business logic — purpose is unblocking parallel Phase 0a build-agents who need import targets.

**Precondition:**
- Component locations confirmed per spec
- Nordic Split design tokens available

### Steg

1. **Build-agent** creates `apps/web/src/components/contract/ObligationsList.tsx`
   → Placeholder: `export function ObligationsList({ contractId }: { contractId: string }) { return <div>Obligations placeholder</div>; }`
   → File header comment cites ADR-0233

2. **Build-agent** creates `apps/web/src/components/contract/ObligationBlocker.tsx`
   → 3 variants exported: `MobileObligationBlocker`, `WebObligationBlocker`, `BotssonObligationBlockerCard`
   → Shared props type
   → Header cites ADR-0235 + ADR-0236

3. **Build-agent** creates `apps/web/src/components/contract/ContractAmendmentDiff.tsx`
   → Placeholder rendering field-level diff, mobile-stacked / web-side-by-side responsive
   → Header cites ADR-0236

4. **Build-agent** creates `apps/web/src/components/contract/TariffBadge.tsx`
   → Placeholder with framework name + version + drift status (3 colors)
   → Header cites ADR-0181 + ADR-0236

5. **Build-agent** creates `apps/web/src/components/RevealableField.tsx`
   → Reusable (NOT contract-only) — masking + click-to-reveal + audit emit hook
   → Header cites ADR-0234

6. **Build-agent** runs typecheck
   → 5 files compile
   → All ADR references resolvable

**Postcondition:**
- 5 component files exist
- All compile (placeholder JSX OK)
- Import-target verified by trial-import from another file
- Typecheck 0 errors

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| Component name collision with existing | Verify before write; rename if needed |
| Missing peer dep (Framer Motion, lucide-react) | Confirm available via `package.json` |
| Tailwind v4 token unavailable | Use design-token CSS var instead |

## Cascade-touchpoints

| Journey | Cascade-dimensjoner berørt | Notes |
|---------|---------------------------|-------|
| 1. Motion-sweep | None | Pure UI infrastructure |
| 2. Spec amendments | None | Doc-only |
| 3. Component scaffolds | None | Empty placeholders |

No runtime cascade impact — Phase 0a-pre is preparation, not execution.

## Telemetri pr journey

No new telemetry events shipped in this sortie. Component scaffolds will declare events when actual implementations land in Phase 0a.

## Endringshistorikk

| Dato | Endring | Forfatter |
|------|---------|-----------|
| 2026-04-29 | Initial — 0a-pre frontend developer journeys | Claude (caveman) |
