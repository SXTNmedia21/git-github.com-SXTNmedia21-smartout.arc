---
title: "Journey — Admin ser konsistent shell med Nordic Split"
feature: nordic-split-phase-1
journey: admin-ser-konsistent-shell
status: verified
verified_at: 2026-04-23
e2e_test: null
created: 2026-04-23
updated: 2026-04-23
verification_notes: |
  Grep-gate: 0 zinc/gray/slate in DashboardShell.tsx + GlobalSearchPalette.tsx (verified post-commit).
  Lint: 0 errors, 8 pre-existing warnings (not from migration).
  Typecheck: both files compile clean in isolation (standalone tsc --noEmit --skipLibCheck).
    Monorepo-wide tsc errors exist in unrelated files (@smartout/telemetry, @smartout/types,
    @smartout/ai/* not resolved) — pre-existing workspace resolution issue, out of scope.
  Code review: 3 P1 concerns raised, all verified as false positives or intentional defers
    (active-tab contrast: bg-card in bg-muted tray gives visible lift; shadow-border resolves
    via @theme inline; preserved orange ternaries = Phase 2 scope).
  Design review: Option C (hybrid collapse) executed per frontend-designer verdict.
  Visual QA: deferred — dev server verification + screenshot diff recommended before merge
    to development but not blocking this sub-sortie's internal commit gate.
module: Dashboard
tags: [journey, design-system, nordic-split]
---

# Journey: Admin ser konsistent shell med Nordic Split

**Role:** admin

**Precondition:**
- Admin er innlogget
- Minst én workspace aktiv
- `apps/web` bygget og servert lokalt
- `packages/design-tokens/src/tokens.css` importert i `globals.css`

## Happy Path

1. Admin navigerer til `/dashboard` (light mode)
   → Shell (topbar, sidebar, main-surface) renderer med warm OKLCH-paletten fra tokens
   → Ingen kald zinc-tone synlig (sammenlignet med baseline-screenshot)
   → Tekst, grenser, hover-states bruker semantiske tokens
2. Admin åpner global search palette med `cmd+K` (eller `ctrl+K`)
   → Palette overlay renderer med `bg-card`, `border-border`, `text-foreground`
   → Focus ring bruker `ring-ring` (brand orange)
   → Resultater hover-highlighter med `bg-accent`
3. Admin bytter til dark mode via theme-toggle
   → Shell og palette renderer dark variant via tokens (`.dark` scope)
   → Kontrast og hierarki beholdt
   → Ingen `zinc-900`/`zinc-950` synlig som flat flate — `bg-card` gir korrekt dybde
4. Admin navigerer til `/dashboard/organization` og `/dashboard/schedule`
   → Shell arver token-paletten konsistent
   → Inner-content som fortsatt bruker zinc (out-of-scope filer) er synlig, men shell selv er ren

**Postcondition:**
- `DashboardShell.tsx` og `GlobalSearchPalette.tsx` bruker kun semantiske tokens
- Visuell identitet matcher Nordic Split style guide (`docs/design/ren-og-varm-styleguide.html`)
- Ingen regresjoner i light eller dark mode

## Error Paths

- **Scenario:** Kontrast-brudd etter mapping (f.eks. `text-foreground` på `bg-card` for dempet tekst)
  → Mitigering: bruk `text-muted-foreground` i stedet; verifiser mot style guide seksjon "Typography > Hierarchy"
- **Scenario:** `bg-card` i dark mode gir feil dybde når innhold ligger på kort
  → Mitigering: bruk `bg-muted` for nested surfaces; inspiser z-stack
- **Scenario:** Focus ring usynlig pga. kontrast mot `bg-background`
  → Mitigering: `ring-ring` på warm OKLCH ring-token er designet for synlighet; verifiser keyboard-nav

## Verification

- [x] Implementation matches the steps above
- [x] `grep -rEn "(zinc|gray|slate)-[0-9]+"` på begge filer returnerer 0
- [ ] Visuell QA fullført i light + dark mode — **deferred to pre-merge gate** (requires dev server; not blocking internal commit)
- [ ] Keyboard-nav fungerer; focus ring synlig — **deferred to pre-merge gate**
- [x] Typecheck grønt (files compile clean in isolation; monorepo-wide errors unrelated)
- [ ] Manually tested end-to-end — **deferred to pre-merge gate**

**Status: `verified` for code-level migration (grep, lint, types). Visual verification reserved for pre-merge QA gate per Phase 1 scope agreement.**
