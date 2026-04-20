---
title: Journey — Helpdesk Shared Primitives
status: in_progress
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [journey, helpdesk, ui, dev-facing, phase-1]
---

# Journey — Helpdesk Shared Primitives

> Dev-facing journeys. These primitives have no end-user journey of their own —
> they are consumed by the web and mobile sub-sorties and evaluated through
> the journeys those surfaces ship.

---

## Journey: Web dev consumes `ResponsibilityOrb`

**Precondition:** web sub-sortie needs to render a status dot or halo on the desks page.

1. Dev imports from `@smartout/ui` → `import { ResponsibilityOrb } from "@smartout/ui"`.
2. Dev renders `<ResponsibilityOrb status="waiting" size={48} />` inside the TicketHeader.
3. System renders a CSS radial-gradient circle, 48×48px, hue 50 chroma 0.06 with a 2.8s breathing pulse.
4. Dev reloads with `prefers-reduced-motion: reduce`.
5. System renders the same orb without animation (framer-motion's `useReducedMotion` gates the pulse).

**Postcondition:** orb visible, behaves per Spec §4.1 table.
**Error paths:** invalid `status` value → TypeScript blocks at compile time (union type).

---

## Journey: Mobile dev consumes `ResponsibilityOrb` on queue tab badge

**Precondition:** mobile sub-sortie needs the 8pt pulsing dot on the "Min kø" tab icon.

1. Dev imports from `@smartout/ui` → Metro resolves `.native.tsx` automatically.
2. Dev renders `<ResponsibilityOrb status="waiting" size={8} />` inside the tab label.
3. System renders a `react-native-svg` `<RadialGradient>` 8×8, with reanimated scale+opacity pulse at 1.4s half-cycle.
4. User toggles iOS "Reduce Motion" in Accessibility settings.
5. System respects `useReducedMotion()` from reanimated → pulse disabled, chroma still applies.

**Postcondition:** dot visible, reduces motion under OS setting.
**Error paths:** `react-native-svg` missing at runtime → app crash at first render. Mitigated: mobile app already depends on `react-native-svg@^15.15.3` (Spec §3.7 + mobile package.json). Missing from a new consumer → `packages/ui` peerDep warning at install.

---

## Journey: Web dev composes `LighthouseAvatar` for DeskCard

**Precondition:** DeskCard needs to show the responsible rep's avatar ringed by the warm halo.

1. Dev renders `<LighthouseAvatar avatarUrl={profile.avatar_url} name={profile.display_name} size={56} haloState="idle" />`.
2. System renders a 78×78 wrapper (56 × 1.4) with orb behind + 56×56 avatar centered.
3. Image load fails (404 from storage).
4. `onError` fires → component falls back to initials (`LA` for "Linn Andersen") in mono font.
5. Orb halo remains; no broken-image icon.

**Postcondition:** avatar always renders, with or without image.
**Error paths:** empty `name` → initials fall back to `?`.

---

## Journey: Mobile dev uses `OrphanBadge` with lucide-react-native

**Precondition:** mobile error-state needs the dashed-border treatment (Spec §3.2 error state).

1. Dev imports `OrphanBadge` from `@smartout/ui` + `AlertCircle` from `lucide-react-native`.
2. Dev renders `<OrphanBadge label={t("mobile_queue.error_title")} renderIcon={({ size, color }) => <AlertCircle size={size} color={color} />} />`.
3. System renders dashed border pill, `AlertCircle` at 20pt in muted-foreground, label text in Geist.

**Postcondition:** badge renders with correct muted warm tone — no red, no destructive styling.
**Error paths:** `renderIcon` omitted → badge renders label only, no visual regression.

---

## Journey: Consumer translator pulls `helpdesk` namespace

**Precondition:** a component calls `useTranslation("helpdesk")`.

1. Dev calls `const { t } = useTranslation("helpdesk")`.
2. Dev renders `t("page.desks_title")` → resolves to `"Helpdesk · Skranker"` (nb) / `"Helpdesk · Desks"` (en).
3. Dev renders `t("desk_card.open_count_other", { count: 3 })` → resolves to `"3 åpne saker"` via `{count}` interpolation.

**Postcondition:** all Spec §4.2 keys resolve; 3-level resolver handles every key.
**Error paths:** unknown key → returns the key itself (default behavior); dev sees the literal key in UI during development and can fix.

---

## Journey: Design-token consumer pulls orb colors

**Precondition:** a mobile component needs a chroma token without touching OKLCH literals.

1. Dev imports `nativeTheme` from `@smartout/design-tokens/native`.
2. Dev reads `nativeTheme.helpdesk.orb.neutral` → `"oklch(0.68 0.06 50)"`.
3. Dev passes as `backgroundColor` prop on a static view (outside the SVG radial).

**Postcondition:** no inline OKLCH literal in component file.
**Error paths:** typo (`nativeTheme.helpdesk.orb.neturl`) → TypeScript `never` type error at compile time.
