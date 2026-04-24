---
title: "Handoff — nordic-split-hub"
feature: nordic-split-hub
branch: feat/helpdesk-nordic-split-hub
closed: 2026-04-23
module: Dashboard
tags: [handoff, design-system, nordic-split]
---

# Handoff — nordic-split-hub (Phase 3c)

## Summary

Phase 3c of Nordic Split migration. Hub/landing cluster: 5 files, 191 refs → 0. Sub-sortie of `campaign/helpdesk`. Follows Phase 1 (99) + Phase 2 (442) + Phase 3a (162) + Phase 3b (121). Option C hybrid collapse — 6th successful mechanical application.

## Journey

| Journey | Status |
|---------|--------|
| admin-ser-konsistent-hub | verified |

## Migration Stats

| File | Zinc refs | Collapsed | Preserved | Δ lines |
|---|---|---|---|---|
| `app/page.tsx` (landing) | 63 → 0 | ~56 | Orange CTA, emerald Active, indigo AI, future-col asymmetric | −84 |
| `components/dashboard/EmployeeDashboard.tsx` | 44 → 0 | ~36 | Orange Today's Shift pill, indigo CTA, emerald Open Shifts | −68 |
| `app/dashboard/organization/_components/TeamMembersSheet.tsx` | 28 → 0 | ~26 | ROLE_COLORS amber/purple/blue, ring-offset hex | −70 |
| `app/scrape/page.tsx` | 36 → 0 | 36 | Purple/blue/red brand | 0 |
| `app/dashboard/handbook/_components/ChapterReader.tsx` | 20 → 0 | ~17 | Orange active chapter indicator | −32 |
| **Total** | **191 → 0** | **~171** | **~15** | **−254** |

## Decisions

- **Inverted Punch-In pattern preserved** — `bg-foreground text-background` keeps the high-contrast inversion the original `bg-white/zinc-900` pair produced. Token-based, both themes supported.
- **page.tsx header flattened** — low-confidence decision: original was `bg-[#0a0a0c]` dark and `bg-zinc-900 text-white shadow-md` light (dark-over-light marketing contrast). Collapsed to `bg-card + border-border`. Tagged for Phase 2.5 visual review.
- **ROLE_COLORS.employee lost translucent parity** — other roles (owner/admin/manager) use `/10` translucent amber/purple/blue; employee now uses solid `bg-muted`. Phase 2.5 may want employee to use a translucent brand-neutral variant.

## Known Issues / Debt

- **4 low-confidence visual items** (all tagged in commit message) — require pre-merge visual QA:
  1. `page.tsx` header flatten — may look too neutral for landing marketing
  2. Punch-In button invert — color math is correct, verify visual weight
  3. ROLE_COLORS employee — missing translucent parity
  4. Admin/Employee toggle knob — `bg-muted-foreground` slightly darker than original `zinc-400`
- **~15 preserved ternaries** — brand signals (orange/emerald/indigo/purple/amber/blue/red) + ring-offset hex — all for Phase 2.5

## Next Steps

1. Merge to `campaign/helpdesk`.
2. **Phase 3d** (long tail): ~98 files, ~444 refs, all <20 refs per file — batch by logical clusters (settings, organization sub-components, AI config, voice-assistant, etc.) OR single large sub-sortie.
3. **Phase 2.5** (council required): brand-signal semantic tokens, chart tokens, oklch cleanup, active-state affordance token, `--card-elevated`.

## Commits

```
acb1b3f3  refactor(design-tokens): migrate hub cluster to Nordic Split tokens
acb93141  docs(nordic-split-hub): declare journey
```

## Gates

- ✅ Journey verified
- ✅ Grep: 0 zinc/gray/slate across 5 files
- ✅ Typecheck: 0 errors
- ✅ Lint: 0 errors, 5 warnings (pre-existing)
- ✅ Scope: 5 files + 2 docs; 0 mobile; 0 channel logic
- ⏳ Visual QA: deferred (4 low-confidence items flagged)
