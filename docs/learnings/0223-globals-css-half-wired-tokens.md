---
title: "Half-wired CSS tokens force fallback to raw Tailwind palette"
id: LEARNING_0223
status: canonical
layer: learning
created: 2026-05-06
updated: 2026-05-06
tags: [nordic-split, tailwind-v4, design-tokens, frontend, journey-control-center]
---

# Learning-0223: Half-wired CSS tokens force fallback to raw Tailwind palette

## Context

Journey Control Center sortie 2026-05-06 (28 commits on `feat/journey-control-center`). Council Phase 3 frontend-designer review caught `text-green-500` at `apps/journey-control/src/components/run-viewer.tsx:62` for the run-success badge. Supervisor's parallel review cleared the same site as "accepted convention — 10+ apps/web files use green-500/red-500/blue-500/yellow-500 because shadcn ships only `--destructive`."

Phase 5 conflict resolution code-traced both claims:

- `apps/journey-control/src/app/globals.css:81-86` (and `.dark` variants 123-128) DEFINE `--success`, `--success-foreground`, `--warning`, `--warning-foreground`, `--info`, `--info-foreground` as raw CSS custom properties.
- The `@theme inline` block at `globals.css:9-42` ONLY exports `--color-destructive` to Tailwind. Success / warning / info raw vars are never aliased as `--color-success` etc.
- Result: `text-success` is not a valid Tailwind utility in this app. Developer reaches for `text-green-500` because it is the only thing that produces a green pixel.

Same shape exists in `apps/web/` per Supervisor's evidence — accumulated drift over months. The new app inherited the trap on day one because globals.css was authored against the same half-wired pattern.

## Discovery

In Tailwind v4, defining `--<name>: value;` in `:root` does NOT make `text-<name>` / `bg-<name>` / `border-<name>` Tailwind utilities. Only declarations inside the `@theme` (or `@theme inline`) block expose tokens to the utility generator. Specifically: a token must appear as `--color-<name>: <value>;` (or `var(--<name>)`) inside `@theme` to be reachable as `text-<name>`.

The pattern that actually works:

```css
:root {
  --success: oklch(0.65 0.18 145);
  --success-foreground: oklch(0.98 0 0);
}

@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}
```

Only after both halves are in place does `<span class="text-success">` render the token color. Without the `@theme inline` alias, the raw var sits in the cascade unused — semantically declared, mechanically dead.

This is the second documented instance (apps/web has the same shape per Supervisor evidence). Council Phase 5 elected to fix forward in apps/journey-control rather than retrofit apps/web in this sortie.

## Impact

- **Author-time check:** when writing or reviewing a new `globals.css`, grep every `--<name>:` declaration in `:root` / `[data-theme]` blocks. For each token intended for component use, verify a matching `--color-<name>: var(--<name>);` line exists in the `@theme inline` block. Half-declared tokens force fallback to raw Tailwind palette every time.
- **Review-time check:** any `text-green-500`, `text-red-500`, `text-blue-500`, `text-yellow-500` in component code is a smell. Either (a) the matching semantic token is half-wired (fix the `@theme` alias), or (b) the token doesn't exist yet (decide whether to add it before merging). "Status colors are different" is true; "we use raw Tailwind palette for status" is debt, not policy.
- **Scope:** applies to every Smartout app using Tailwind v4 CSS-config (`apps/web/`, `apps/journey-control/`, `apps/landing/` — verify each). Mobile Expo uses different theming, not in scope.
- **Promotion path:** one more occurrence (3rd) promotes this to a hard rule in the Nordic Split skill — "globals.css token audit gate before merge."

## References

- ADR-0291 — Journey speed profiles (sister artefact from same sortie)
- `apps/journey-control/src/app/globals.css:9-42` (`@theme inline` block)
- `apps/journey-control/src/app/globals.css:81-86` + `123-128` (raw token declarations)
- `apps/journey-control/src/components/run-viewer.tsx:62` (fix landed in commit `dafc3793a`)
- Council session 2026-05-06 — `docs/council/COUNCIL-LOG.md`
- Apps/web instances cited by Supervisor (drift precedent): `apps/web/src/app/dashboard/hms/_components/SessionSignoffDrawer.tsx:131`, `apps/web/src/app/dashboard/contract-editor/status-bar.tsx:49`, `apps/web/src/app/dashboard/schedule/_components/week-grid.tsx:348`

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
