---
title: ADR-0260 — Cabinet Grotesk as new display-font (replaces Instrument Serif)
status: proposed
updated: 2026-04-28
created: 2026-04-28
module: design-system
tags: [adr, design-system, typography, nordic-split]
---

# ADR-0260 — Cabinet Grotesk as new display-font

## Context

Smartout's "Nordic Split" design system (skill: `smartout-nordic-split`) currently specifies **Instrument Serif** as the display-font (`font-heading`). It's used across `apps/web` and `apps/mobile` for:

- Page headers (h1/h2 in dashboard, reconciliation, schedule)
- KPI values (`KpiCard.value`)
- Hero numbers (lockscreen clock equivalents, after-shift summaries)
- ReconSummary card titles
- SignoffPanel titles

Pontus has decided Instrument Serif no longer fits the brand. It reads as "Italian wedding-invitation" — too high-contrast, too aristocratic, mismatched with the Norwegian-Scandinavian hospitality positioning.

During Tips-handling brainstorming (2026-04-28), five alternatives were evaluated live in a font-switcher mockup:

1. Instrument Serif (status quo)
2. Fraunces — variable serif with optical-size
3. Newsreader — editorial calmer serif
4. Bricolage Grotesque — display-sans, soft humanist
5. **Cabinet Grotesk — display-sans, Schibsted-vibe, Skandinavian** ✓ chosen

## Decision

Replace `font-heading` from `'Instrument Serif', Georgia, serif` to `'Cabinet Grotesk', system-ui, sans-serif` across the design system.

### Token change

`packages/design-tokens/src/tokens.ts`:
```typescript
// Before
fontHeading: "'Instrument Serif', Georgia, serif",

// After
fontHeading: "'Cabinet Grotesk', system-ui, -apple-system, sans-serif",
```

`apps/web/globals.css` + `packages/design-tokens/src/tokens.css`:
```css
:root {
  --font-heading: 'Cabinet Grotesk', system-ui, -apple-system, sans-serif;
}
```

### Loading

Cabinet Grotesk is hosted by Indian Type Foundry on Fontshare, NOT Google Fonts.

**Production loading via `next/font/local`** (selvhost):

1. Download `.woff2` files for weights 500 + 700 from `https://www.fontshare.com/fonts/cabinet-grotesk`
2. Place in `apps/web/public/fonts/cabinet-grotesk/`
3. Configure `next/font/local` in `apps/web/src/app/layout.tsx`:
   ```typescript
   import localFont from "next/font/local";
   const cabinetGrotesk = localFont({
     src: [
       { path: "../../public/fonts/cabinet-grotesk/CabinetGrotesk-Medium.woff2", weight: "500", style: "normal" },
       { path: "../../public/fonts/cabinet-grotesk/CabinetGrotesk-Bold.woff2", weight: "700", style: "normal" },
     ],
     variable: "--font-heading",
     display: "swap",
   });
   ```

**Mobile loading** via `expo-font` in `apps/mobile/app/_layout.tsx` — same `.ttf` files.

### Fallback stack

`system-ui, -apple-system, sans-serif` — sans-serif fallback (not serif). Reason: rendering before web-font loads should still look modern; serif fallback would flash a different visual character.

### License

Cabinet Grotesk is **free for both personal and commercial use** under the Indian Type Foundry license (verified 2026-04-28). No purchase required. Files redistributable in production builds.

## Scope of change

This ADR covers the global token change. Files affected:

| File | Change |
|---|---|
| `packages/design-tokens/src/tokens.ts` | Update `fontHeading` |
| `packages/design-tokens/src/tokens.css` | Update `--font-heading` |
| `packages/design-tokens/src/native.ts` | Update mobile token |
| `apps/web/src/app/layout.tsx` | Add `next/font/local` config + class |
| `apps/web/public/fonts/cabinet-grotesk/*.woff2` | NEW — bundled fonts |
| `apps/mobile/app/_layout.tsx` | Update `expo-font` config |
| `apps/mobile/assets/fonts/*.ttf` | NEW — bundled fonts |
| `docs/design/ren-og-varm-styleguide.html` | Update specimen |
| `docs/design/typography.md` | Update reference |
| `.claude/skills/smartout-nordic-split/SKILL.md` | Update authoritative skill |

Anything that uses the `--font-heading` CSS variable or `fontHeading` token automatically updates — no per-component edits required for the 80%+ of usages already on the token.

Hardcoded `'Instrument Serif'` references must be hunted down and replaced. Grep gate:
```bash
grep -R "'Instrument Serif'" apps packages | grep -v "/.next/" | grep -v node_modules
# Must return zero post-cutover
```

## Consequences

### Positive

- Brand alignment: Skandinavian, hospitality, modern — matches Smartout positioning
- Better legibility at small sizes (Instrument Serif's high contrast hurts at 14–18px)
- Sans-serif display pairs ergonomically with Geist body (both sans = no contrast jolt)
- License-free, self-hostable, no Google Fonts dependency
- Variable weight axis available (500/700 covers 95% of use)

### Negative

- Visual identity rewrite — every app screen looks slightly different
- 1× cutover commit risk — if rollback needed, single revert
- Manual font hunting required (grep gate above)
- Lose Instrument Serif's "premium editorial" feel — if Pontus changes mind in 6 months, repeat exercise
- Mobile asset bundle grows ~80KB (.ttf for Medium + Bold)

### Mitigation

- Cutover lands in a dedicated branch + PR (not bundled with feature work)
- ren-og-varm-styleguide.html acts as visual diff baseline before/after
- Storybook screenshots of all KPI/header components captured pre-cutover
- Smartout-nordic-split skill bumps version — every Claude session post-cutover sees correct guidance

## Implementation sequence

1. **Sortie** `feat/cabinet-grotesk-cutover`:
   - Download font files, add to repos, configure `next/font/local` + `expo-font`
   - Update tokens (3 files)
   - Update skill + docs
   - Replace hardcoded references (grep gate)
   - Visual review against pre-cutover screenshots
   - Merge as single PR
2. Post-merge: any feature branch (including `feat/tips-*`) inherits new font automatically

## Relation to ADR-0193 (NonEmptyString brand)

Independent. ADR-0193 hardens telemetry; ADR-0228 hardens visual identity.

## References

- Brainstorming session: 2026-04-28 Tips-handling design (font picker mockup)
- Cabinet Grotesk specimen: https://www.fontshare.com/fonts/cabinet-grotesk
- Indian Type Foundry license: https://www.fontshare.com/license

## Status

`proposed` — awaiting Pontus's approval. Promotes to `accepted` upon decision-log registration + cutover sortie creation.
