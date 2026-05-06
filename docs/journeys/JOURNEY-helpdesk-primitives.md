---
title: "Journey — Helpdesk Primitives (Phase 1 Foundation)"
feature: helpdesk-primitives
status: verified
verified_at: 2026-04-24
e2e_test: apps/e2e/tests/helpdesk-primitives-preview.spec.ts (baseline not seeded in automated run)
created: 2026-04-24
updated: 2026-04-24
verification_notes: |
  Typecheck: pnpm --filter web typecheck → 0 errors.
               pnpm --filter @smartout/mobile typecheck → 0 errors.
  Web tests (vitest, renderToStaticMarkup pattern — project convention since no
  @testing-library/react installed): 28/28 passing across Orb (9), LighthouseAvatar
  (10), StatusLabel (4), Pill (5).
  Mobile tests: 10 `describe.skip` specs committed as living documentation.
  Jest in apps/mobile runs env=node with NO preset-expo and NO
  @testing-library/react-native installed — RN components cannot be rendered
  from this runtime today. Follow-up: wire preset-expo, remove `.skip`.
  ESLint: 0 errors, 0 warnings on new files.
  Grep guard (git diff 0fb222eb..HEAD): CLEAN — all changes scoped to
  apps/web/src/components/helpdesk-orb/, apps/mobile/src/components/orb/,
  apps/web/src/app/platform-admin/helpdesk-preview/,
  apps/mobile/app/(app)/(me)/design-preview.tsx,
  apps/e2e/tests/helpdesk-primitives-preview*,
  packages/design-tokens/src/tokens.css (brand-orange-dark under .dark),
  apps/web/src/app/globals.css (--color-brand-orange-dark @theme inline mapping),
  docs/journeys/JOURNEY-helpdesk-primitives.md, docs/HANDOFF-helpdesk-primitives.md.
  Zero consumers of existing helpdesk UI modified.
  Playwright baseline: spec committed, PNG not seeded in this run (dev server
  not started as part of automated execution — seed manually per spec header).
module: Helpdesk
tags: [journey, helpdesk, design-primitives, nordic-split, phase-1]
---

# Journey — Helpdesk Primitives (Phase 1 Foundation)

> Dev-facing journeys. These primitives have no end-user journey of their
> own — they are canonical visual building blocks consumed by Phase 2-5
> helpdesk surfaces (TicketHeader, ChannelList, QueueRow, ResolveFAB, etc.).
> The end-user impact is evaluated through the journeys of the consuming
> surfaces once Phase 2+ ships.

Design source of truth:
`docs/design/smartout-design-helpdesk/project/prototype/shared.jsx:82-280`.

---

## Journey: Web dev consumes `Orb` on the helpdesk preview

**Precondition:** dev wants to verify the Orb renders at all three statuses
before wiring it into a ticket row.

1. Dev navigates to `/platform-admin/helpdesk-preview` in a local dev build.
2. System renders the Server Component shell at
   `apps/web/src/app/platform-admin/helpdesk-preview/page.tsx` with the
   `PrimitivesGallery` client gallery.
3. System paints Orb × 3 statuses: `waiting` (chroma 0.08) / `active`
   (chroma 0.12) / `complete` (chroma 0.04 + Lucide Check icon).
4. System animates three pulse orbs at sizes 14 / 48 / 52 — pulse class
   `orbPulse` wraps `@keyframes orb-pulse` at 2.8s, scale 1→1.06, opacity
   1→0.82.
5. Dev toggles OS-level Reduce Motion.
6. System respects `@media (prefers-reduced-motion: reduce)` inside
   `Orb.module.css` → animation suppressed.

**Postcondition:** dev eyeballs all three chroma values + pulse behaviour +
reduced-motion fallback in one page. Ready to consume in Phase 2.

**Error paths:**
- Invalid `status` → TypeScript blocks at compile time (union type).
- Missing `aria-label` → component still renders `role="status"` but the
  label is empty (dev warning, a11y linter catches).

---

## Journey: Web dev consumes `LighthouseAvatar` with halo intensity

**Precondition:** a ticket header needs the "responsible" rep ringed by a
warm halo that intensifies when the rep is active.

1. Dev imports from `@/components/helpdesk-orb`:
   `<LighthouseAvatar name="Linn Andersen" halo="idle" />`.
2. System renders an 84×84 wrapper (size × 1.5) with halo disc behind +
   56×56 avatar centered.
3. System computes halo chroma from the `halo` prop: `idle`=0.06 /
   `waiting`=0.10 / `active`=0.12. Gradient formula matches
   `shared.jsx:116-119` exactly; `filter: blur(2px)` applied.
4. Dev omits `src` → avatar fills with
   `linear-gradient(135deg, oklch(0.72 0.08 50), oklch(0.55 0.12 35))` and
   renders initials (first letter of up to two words, white, `size*0.36`
   font-size, weight 500).
5. Dev passes `src="/avatar.png"` → avatar fills with the image via
   `background: #d6cfc2 url(...) center/cover`; initials suppressed.
6. Dev omits `name` entirely → initials fall back to `?`.

**Postcondition:** avatar always renders — with image, with initials, or
with `?`. Halo always applied and blurred.

**Error paths:**
- Invalid `halo` → TypeScript blocks at compile time.
- Image 404 → browser shows the `#d6cfc2` base color; no broken-image
  icon (no `<img>` tag used).

---

## Journey: Web dev composes `StatusLabel` + `Pill` on a ticket row

**Precondition:** a ticket row needs a Norwegian status tag and a
channel/tag pill.

1. Dev renders `<StatusLabel status="waiting" />` → mono 11px
   `VENTER` in `var(--muted-foreground)`, letter-spacing 0.12em.
2. Dev swaps to `status="active"` → `AKTIV`.
3. Dev swaps to `status="complete"` → `LØST`.
4. Dev renders `<Pill tone="muted">3</Pill>` → padding 2px 8px, rounded
   pill, `var(--muted)` bg, `var(--foreground)` fg.
5. Dev renders `<Pill tone="brand">#lønn</Pill>` → 10 % warm-orange
   overlay bg, `var(--brand-orange-dark)` fg.
6. Dev renders `<Pill tone="success">AKTIV</Pill>` → 10 % green overlay
   bg, `oklch(0.45 0.15 145)` fg.

**Postcondition:** all three states + all three tones render with the
exact color values from `shared.jsx:167 / 243-247`. Text never wraps
(`whiteSpace: nowrap`).

**Error paths:**
- Unknown `tone` → TypeScript blocks at compile time.
- `--brand-orange-dark` missing → pill fg falls back to `currentColor`
  but dark-theme is guarded by the new `.dark` entry in
  `packages/design-tokens/src/tokens.css`.

---

## Journey: Mobile dev renders the preview screen on a physical device

**Precondition:** mobile dev wants to verify the native Orb / LighthouseAvatar
render correctly before wiring them into the Fjernkontroll card.

1. Dev opens Expo Go / dev client and navigates via router to
   `/me/design-preview` (direct URL; not wired into the tab navigation).
2. System renders the `DesignPreviewScreen` from
   `apps/mobile/app/(app)/(me)/design-preview.tsx` inside SafeAreaView.
3. System paints Orb × 3 statuses via `expo-linear-gradient` with the
   4-stop RGBA approximation of the OKLCH formula (see Orb.tsx header
   comment for the resolution table).
4. System animates two pulse orbs via Reanimated 4 — `withRepeat` +
   `withTiming` at 1400 ms one-way, reverse=true → 2.8 s full cycle.
5. Dev toggles iOS "Reduce Motion" in Accessibility settings.
6. System respects `useReducedMotion()` from Reanimated → shared values
   held at `scale=1, opacity=1`, no animation.
7. System paints three LighthouseAvatars at halos idle / waiting / active
   using pre-resolved halo disc colors (backdrop-filter unavailable on
   RN).

**Postcondition:** dev can hold the device next to a web browser showing
`/platform-admin/helpdesk-preview` and visually confirm parity within the
known-limitations envelope.

**Error paths:**
- `expo-linear-gradient` missing → Metro fails at import; prereq gate
  `pnpm list expo-linear-gradient` documented in the plan header.
- Reanimated not configured → app crashes on `useSharedValue`; mitigated
  by Expo SDK 52 preset-expo which configures Reanimated out of the box.

---

## Known limitations (documented in HANDOFF)

- Mobile Orb uses `expo-linear-gradient` with 4-stop RGBA approximation
  (no native OKLCH interpolation in RN; no Skia dependency in Phase 1).
- Mobile LighthouseAvatar halo is a simple opaque disc (no
  backdrop-filter in RN).
- Mobile tests `describe.skip`'d (no preset-expo +
  @testing-library/react-native in apps/mobile).
- Web Playwright baseline PNG not seeded in the automated run (dev
  server not started).
