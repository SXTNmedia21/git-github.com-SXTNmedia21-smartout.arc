---
title: "Handoff — Helpdesk Primitives (Phase 1 Foundation)"
feature: helpdesk-primitives
status: done
created: 2026-04-24
updated: 2026-04-24
module: Helpdesk
tags: [handoff, helpdesk, design-primitives, nordic-split]
plan: docs/superpowers/plans/2026-04-24-helpdesk-primitives.md
journey: docs/journeys/JOURNEY-helpdesk-primitives.md
design-source: docs/design/smartout-design-helpdesk/project/prototype/shared.jsx
---

# Handoff — Helpdesk Primitives

## Scope delivered

Phase 1 foundation only. Zero consumers of existing helpdesk UI modified.

| Surface | Path | Contents |
|---|---|---|
| Web primitives | `apps/web/src/components/helpdesk-orb/` | `Orb`, `LighthouseAvatar`, `StatusLabel`, `Pill`, `types`, barrel |
| Web preview | `apps/web/src/app/platform-admin/helpdesk-preview/` | Server Component shell + `PrimitivesGallery` client gallery |
| Web tests | `apps/web/src/components/helpdesk-orb/__tests__/` | 28 passing unit tests (4 files) |
| Web E2E spec | `apps/e2e/tests/helpdesk-primitives-preview.spec.ts` | Smoke + snapshot baseline (PNG not seeded in automated run) |
| Design token | `packages/design-tokens/src/tokens.css` (`.dark` block) + `apps/web/src/app/globals.css` (`@theme inline`) | `--brand-orange-dark` parity in dark theme + `--color-brand-orange-dark` Tailwind mapping |
| Mobile primitives | `apps/mobile/src/components/orb/` | `Orb`, `LighthouseAvatar`, `StatusLabel`, `Pill`, `types`, barrel |
| Mobile preview | `apps/mobile/app/(app)/(me)/design-preview.tsx` | Scrollable native gallery (twin of web preview) |
| Mobile test stubs | `apps/mobile/src/components/orb/__tests__/` | 10 `describe.skip`'d specs — living docs for when preset-expo is wired |

Commits (9 total, in order):

1. `0980aa0d` feat(helpdesk-primitives): web Orb component with 3 statuses + pulse
2. `9d1d2142` feat(helpdesk-primitives): web LighthouseAvatar with halo gradient
3. `ffa3c122` feat(helpdesk-primitives): web StatusLabel + Pill primitives
4. `e401e25f` feat(helpdesk-primitives): web barrel export
5. `aa4123c6` feat(helpdesk-primitives): web preview route for visual QA
6. `75851be0` test(helpdesk-primitives): E2E smoke + screenshot baseline spec
7. `4516eb48` feat(helpdesk-primitives): mobile Orb component with Reanimated pulse
8. `99ae211c` feat(helpdesk-primitives): mobile LighthouseAvatar + StatusLabel + Pill
9. `6ca7172f` feat(helpdesk-primitives): mobile preview screen

## API contract for Phase 2-5 consumers

```ts
// Web
import { Orb, LighthouseAvatar, StatusLabel, Pill } from "@/components/helpdesk-orb";
import type { OrbStatus, HaloIntensity, PillTone } from "@/components/helpdesk-orb";

// Mobile
import { Orb, LighthouseAvatar, StatusLabel, Pill } from "@/components/orb";
import type { OrbStatus, HaloIntensity, PillTone } from "@/components/orb";
```

Shared type unions (identical across web + mobile):

```ts
type OrbStatus     = "waiting" | "active" | "complete";
type HaloIntensity = "idle"    | "waiting" | "active";
type PillTone      = "muted"   | "brand"   | "success";
```

Prop surface (same shape both platforms; web adds `className` /
`CSSProperties` style, mobile uses `ViewStyle` + `testID` /
`accessibilityLabel`):

```ts
interface OrbProps {
  size?: number;           // default 48
  status?: OrbStatus;      // default "waiting"
  pulse?: boolean;         // default false
  withCheck?: boolean;     // default false
  style?: CSSProperties | ViewStyle;
  // web-only: className, 'aria-label'
  // mobile-only: testID, accessibilityLabel
}

interface LighthouseAvatarProps {
  name?: string;           // initials source (first letter × up to 2 words)
  size?: number;           // default 56 (avatar); halo = size * 1.5
  src?: string;            // optional background-image override (web); mobile omits
  halo?: HaloIntensity;    // default "idle"
  style?: CSSProperties | ViewStyle;
}

interface StatusLabelProps {
  status: OrbStatus;       // required; maps to VENTER / AKTIV / LØST
  className?: string;      // web only
}

interface PillProps {
  tone?: PillTone;         // default "muted"
  children: ReactNode;
  className?: string;      // web only
}
```

## Decisions

No new ADRs. Implementation adheres to:

- **Nordic Split** (CLAUDE.md + `smartout-nordic-split` skill): warm OKLCH
  hue 40-60, semantic tokens (`var(--muted)`, `var(--foreground)`,
  `var(--muted-foreground)`, `var(--brand-orange-dark)`), Lucide icons
  only, `useReducedMotion()`-aware animation.
- **Fidelity over invention**: every primitive matches
  `shared.jsx:82-280` exactly — chroma constants, gradient formula,
  pulse timing, halo blur, Norwegian copy, pill padding, letter-spacing.
- **Testing pragmatism**: web tests use `renderToStaticMarkup` + string
  matching (the project's established pattern — no
  `@testing-library/react` installed in `apps/web/package.json`). We
  assert visible style output instead of DOM queries, which is
  sufficient for purely stylistic primitives.

## Token added

`--brand-orange-dark`:

- Already existed in `packages/design-tokens/src/tokens.css:50` under
  `:root` (`oklch(0.55 0.22 40)`) from an earlier branch.
- Added under `.dark` for theme parity (identical value — Nordic Split
  warm accent is intentionally theme-invariant).
- Mapped in `apps/web/src/app/globals.css` `@theme inline` as
  `--color-brand-orange-dark: var(--brand-orange-dark)` so Tailwind can
  reference it.

Used by `Pill tone="brand"` (foreground color).

## Known limitations (carried forward to Phase 2+)

1. **Mobile OKLCH**: React Native has no native `oklch()` support in
   Expo SDK 52 / `expo-linear-gradient@15.x`. The four gradient stops
   per status are resolved **offline from the prototype formula** and
   hard-coded as RGBA in `apps/mobile/src/components/orb/Orb.tsx`. True
   OKLCH interpolation awaits upstream
   `expo-linear-gradient` color-interpolation support.

2. **Mobile radial gradient**: expo-linear-gradient ships a
   `LinearGradient` only. The orb on native is drawn as a diagonal
   linear gradient which approximates the radial well at small sizes
   (≤ 64 pt). A true radial would require `@shopify/react-native-skia`
   — disproportionate for Phase 1. Revisit if the approximation reads
   visibly worse at larger sizes in Phase 2-5.

3. **Mobile halo**: RN exposes no `backdrop-filter`. Halo is rendered
   as an opaque warm disc with resolved RGBA values (matches intensity
   mapping idle / waiting / active).

4. **Mobile tests `describe.skip`'d**: `apps/mobile/jest.config.js` uses
   `preset: "ts-jest"` with `testEnvironment: "node"` and no
   `@testing-library/react-native`. Four test files are committed as
   living documentation with `describe.skip` so they can be enabled by
   removing `.skip` once `preset-expo` + `@testing-library/react-native`
   are wired. Follow-up item.

5. **Playwright baseline PNG**: The E2E spec
   (`apps/e2e/tests/helpdesk-primitives-preview.spec.ts`) is committed
   but the snapshot baseline was **not seeded** — the dev server is
   not started as part of automated plan execution. Seed manually once:

   ```
   cd apps/e2e && pnpm exec playwright test \
     tests/helpdesk-primitives-preview.spec.ts --update-snapshots
   ```

6. **Mobile `design-preview` not in tab nav**: Reachable only via
   direct router push. Intended as a dev-only tool — not a customer
   surface. Revisit gating before any App Store submission.

## Quality gates (passed in this run)

| Gate | Result |
|---|---|
| Grep guard (files outside allowed paths) | CLEAN |
| `pnpm --filter web typecheck` | 0 errors |
| `pnpm --filter @smartout/mobile typecheck` | 0 errors |
| Web vitest (Orb + LighthouseAvatar + StatusLabel + Pill) | 28/28 passing |
| Mobile jest (all `describe.skip`) | 10 skipped, 0 failed |
| Web ESLint (helpdesk-orb + helpdesk-preview) | 0 errors, 0 warnings |
| Mobile ESLint (components/orb) | 0 errors, 0 warnings |
| Playwright (spec committed, baseline deferred) | n/a |

## Next steps (Phase 2-5)

- **Phase 2 (web-ticket)**: Wire `Orb` into `TicketHeader`,
  `LighthouseAvatar` into the responsible-rep slot on the desk card,
  `StatusLabel` into the ticket row, `Pill` into channel / tag chips.
- **Phase 3 (web-channels)**: Consume the same primitives on the
  channel list and queue row.
- **Phase 4 (mobile-ticket)**: Use the native twins inside the
  Fjernkontroll card (per ADR-0177 state machine). Remember
  `journey.run_guided` is the only capability that may surface on
  mobile (ADR-0132) — primitives themselves are free but the ticket
  surface routes via BFF.
- **Phase 5 (test + baseline)**: Seed Playwright baseline, wire
  preset-expo into apps/mobile, remove `describe.skip` from the four
  mobile test files, add visual-regression baseline for the mobile
  preview screen if/when Expo screenshot tooling is in place.

## File pointers

- Design source of truth: `docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:82-280`
- Design tokens: `packages/design-tokens/src/tokens.css` (`:root` + `.dark`)
- Tailwind mapping: `apps/web/src/app/globals.css` (`@theme inline` block)
- Web primitives: `apps/web/src/components/helpdesk-orb/`
- Web preview: `apps/web/src/app/platform-admin/helpdesk-preview/`
- Web E2E: `apps/e2e/tests/helpdesk-primitives-preview.spec.ts`
- Mobile primitives: `apps/mobile/src/components/orb/`
- Mobile preview: `apps/mobile/app/(app)/(me)/design-preview.tsx`
- Journey: `docs/journeys/JOURNEY-helpdesk-primitives.md`
- Plan: `docs/superpowers/plans/2026-04-24-helpdesk-primitives.md`
