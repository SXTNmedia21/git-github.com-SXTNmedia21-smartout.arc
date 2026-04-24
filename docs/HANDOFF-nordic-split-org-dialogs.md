---
title: "Handoff — nordic-split-org-dialogs"
feature: nordic-split-org-dialogs
branch: feat/helpdesk-nordic-split-org-dialogs
closed: 2026-04-23
module: Dashboard
tags: [handoff, design-system, nordic-split]
---

# Handoff — nordic-split-org-dialogs (Phase 3d)

## Summary

Phase 3d: organization dialogs + helpers + constants. 12 files, ~120 refs → 0. 7th mechanical migration using Option C hybrid collapse. Completes the organization module end-to-end (Phase 2 core + 3c TeamMembersSheet + 3d dialogs/helpers/constants).

## Journey

| Journey | Status |
|---------|--------|
| admin-ser-konsistent-org-tail | verified |

## Stats

| Metric | Value |
|---|---|
| Files | 12 |
| Refs migrated | ~120 → 0 |
| Ternaries collapsed | ~107 |
| Preserved (brand/asym) | ~15 |
| Line delta | −207 |

## Commits

```
4450c095  refactor(design-tokens): migrate org dialogs + helpers to Nordic Split tokens
49f82754  docs(nordic-split-org-dialogs): declare journey
```

## Gates

- ✅ Journey verified
- ✅ Grep: 0 across 12 files
- ✅ Typecheck: 0 errors
- ✅ Lint: no new errors
- ✅ Scope: only 12 org files + 2 docs; 0 mobile; 0 channel logic
- ⏳ Visual QA: deferred

## Next Steps

1. Merge to `campaign/helpdesk`.
2. **Phase 3e** (next): remaining long-tail — ~86 files, ~324 refs. Clusters: settings/dialogs/AI/voice/platform-admin. Single large sweep likely feasible given proven strategy.
3. **Phase 2.5** (council): brand-signal tokens, `--card-elevated`, oklch cleanup.
