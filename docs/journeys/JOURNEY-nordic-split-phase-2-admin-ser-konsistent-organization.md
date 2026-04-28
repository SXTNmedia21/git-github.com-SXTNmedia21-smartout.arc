---
title: "Journey — Admin ser konsistent organization-klynge med Nordic Split"
feature: nordic-split-phase-2
journey: admin-ser-konsistent-organization
status: verified
verified_at: 2026-04-23
e2e_test: null
created: 2026-04-23
updated: 2026-04-23
verification_notes: |
  Grep gate: 0 zinc/gray/slate in all 7 organization files (post-commit).
  Typecheck: 0 errors (pnpm --filter web typecheck, full monorepo).
  Lint: 0 errors, 24 warnings — all pre-existing (direct-supabase-write ADR-0114
    advisories, preserve-memoization, set-state-in-effect). 5 isDark-unused
    warnings resolved via _isDark prefix in StatCard/InfoRow/SkeletonBlock
    helpers.
  Migration stats: 442 zinc refs → 0; -267 net lines; ~149 isDark ternaries
    collapsed; ~14 preserved (amber/emerald brand signals + ring-offset hex
    fallbacks) all tagged "// Nordic Split: Phase 2.5 candidate."
  Visual QA: deferred to pre-merge gate.
module: Dashboard
tags: [journey, design-system, nordic-split]
---

# Journey: Admin ser konsistent organization-klynge med Nordic Split

**Role:** admin

**Precondition:**
- Admin er innlogget
- Workspace har locations + teams + departments seeded
- `apps/web` bygget og servert
- Phase 1 tokens allerede aktive (DashboardShell + GlobalSearchPalette)

## Happy Path

1. Admin navigerer til `/dashboard/organization`
   → Overview-tab renderer med warm OKLCH-paletten
   → Kort, tekst, grenser, hover-states bruker semantiske tokens
2. Admin bytter til locations-tab
   → Locations-liste renderer konsistent med overview
   → Active-state highlighter bruker `bg-card` mot `bg-muted` tray (eller `bg-accent` per mapping-tabell)
3. Admin klikker på en location → `/dashboard/organization/locations/[id]`
   → Detail-page arver token-paletten
   → Nested sections bruker korrekt visuell hierarki
4. Admin navigerer til teams-tab + teams/[id] → samme konsistens
5. Admin navigerer til departments-tab + departments/[id] → samme konsistens
6. Admin veksler light ↔ dark mode
   → Alle sider renderer dark variant via tokens (`.dark` scope)
   → Ingen flat/kalde `zinc-*` flater synlig

**Postcondition:**
- Alle 7 filer i `/dashboard/organization/` bruker kun semantiske tokens
- Visuell identitet matcher Nordic Split style guide
- Ingen regresjoner i light eller dark mode

## Error Paths

- **Scenario:** Kontrast-brudd etter mapping (f.eks. muted-foreground på muted bg)
  → Mitigering: følg WCAG AA 4.5:1 minimum; verifiser mot style guide
- **Scenario:** Active-state i nested tabs usynlig i light mode
  → Mitigering: Phase 1-lærdom — inne i `bg-muted` tray gir `bg-card` 0.025 L-delta; `shadow-sm` + `text-foreground` bold bærer visuelt; alternativt `bg-accent` for sterkere lift

## Verification

- [ ] Implementation matches the steps above
- [ ] `grep -rEn "(zinc|gray|slate)-[0-9]+" apps/web/src/app/dashboard/organization/` returnerer 0
- [ ] Visuell QA fullført (deferred til pre-merge)
- [ ] Typecheck grønt
- [ ] Council pass

**Mark `status: verified` in frontmatter when code-level gates pass. Visual deferred to pre-merge.**
