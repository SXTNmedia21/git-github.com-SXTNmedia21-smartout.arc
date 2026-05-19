---
title: "Journey — design-token-sweep"
status: done
updated: 2026-05-19
created: 2026-05-19
module: Mobile
tags: [journey, design-tokens, nordic-split, mobile]
---

# Journey — design-token-sweep

## Journey: Developer changes hardcoded color → token reference → theme switch works in light + dark

**Precondition:** A mobile component contains a hardcoded hex/rgba/OKLCH color literal that should
respond to light/dark theme switching.

1. Developer identifies hardcoded literal (e.g. `color="#8b5cf6"` for a badge)
2. Developer opens `packages/design-tokens/src/native.ts` — finds the semantic token
   (`brandPurple`, `brandOrange`, `success`, `primaryForeground`, etc.)
3. For opaque uses: replace with `theme.colors.<token>` inside the `createStyles` callback
   or via `useTheme()` hook for inline JSX props
4. For translucent uses: replace with `withOpacity(theme.colors.<token>, alpha)` —
   import `withOpacity` from `@/theme`
5. For `token + "1A"` hex-append pattern: replace with `withOpacity(token, 0.1)` —
   `"1A"` is hex 26/255 ≈ 0.10
6. Developer runs `pnpm --filter @smartout/mobile typecheck` → passes with 0 errors
7. Developer spot-checks light + dark in Expo dev build → badge/label colors respond to
   theme toggle correctly

**Postcondition:** Component color responds to useColorScheme() via `nativeTheme.light` /
`nativeTheme.dark` — no raw hex literals remain in the changed component.

**Error paths:**
- Token name typo → TypeScript error on `theme.colors.nonExistentToken` — caught at typecheck
- `withOpacity` not imported → TypeScript error `withOpacity is not defined` — add to import
- `ThemeColors` type not imported for function parameter → TypeScript type mismatch — add import
- `token + "1A"` still in file → remains a raw string concat, not caught by TS — grep catches it

---

## Journey: Theme switch validates correct in both modes

**Precondition:** Tier-1 / Tier-2 changes are committed, running Expo dev build.

1. Toggle device to dark mode → primary button labels remain white (primaryForeground: `#fafafa`)
2. Toggle to light mode → same buttons still white (primaryForeground is `#fafafa` in both modes)
3. Success/warning/destructive badge backgrounds lighten/darken via their respective tokens
4. Shadow color holds warm-black in both modes (SHADOW_COLOR is a single neutral constant)

**Postcondition:** Visual output correct in both color schemes. No stray white-on-white or
dark-on-dark legibility issues introduced.
