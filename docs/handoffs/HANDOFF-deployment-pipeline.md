---
title: "Handoff — deployment-pipeline"
feature: deployment-pipeline
branch: feat/deployment-pipeline
closed: 2026-04-06
module: infra
---

# Handoff — deployment-pipeline

## Summary

Established a 3-branch release flow (development -> preview -> main) with Supabase Branch DB support, automated 1Password env sync to Vercel and DigitalOcean, and hardened deployment scripts. Fixed 8 legacy migration ordering issues that blocked Branch DB creation. Merged all pending feature branches and performed the first development -> main release (PR #128, 1,352 commits).

## What Was Done

- [x] Task 1: Wrapped 85 bare CREATE INDEX with IF NOT EXISTS guards for migration idempotency
- [x] Task 2: Added NEXT_PUBLIC_LIVEKIT_URL to Vercel sync manifest
- [x] Task 3: Rewrote deploy.sh (branch pin, health polling) + health-check.sh (--retry mode, 5 service checks)
- [x] Task 4: Created sync-env-to-droplet.sh (1Password smartout_ai_prod -> infra/.env)
- [x] Task 5: Created seed-preview.sql for Supabase Branch DBs
- [x] Task 6: Updated sync-env-to-vercel.sh gitBranch from 'development' to 'preview'
- [x] Task 7: Updated ~/.claude/CLAUDE.md with preview branch rules and release flow
- [x] Task 8: 8 iterations fixing legacy migration issues (reorders, duplicates, forward refs, timestamp collisions)
- [x] Task 9: Created preview branch from main, merged PR #128 (development -> main)
- [x] Task 10: ADR-0071 — preview environment architecture
- [x] Task 11: Hardened SECURITY.md and ENV_PROTOCOL.md, deleted 2 stale deploy docs, superseded ADR-0055

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| 3-branch flow (development -> preview -> main) | Need staging tier for migration/deploy validation | ADR-0071. All releases go through preview first. |
| Asymmetric Docker (no preview tier) | Cost and complexity not justified for internal services | Docker bugs only surface in production. Accepted risk. |
| IF NOT EXISTS on all indexes | Supabase Branch DBs replay all migrations from scratch | 85 indexes wrapped. All future indexes must follow pattern. |
| 1Password vault separation | Clean env isolation between dev/preview and production | smartout_ai (dev/preview), smartout_ai_prod (production). Supersedes ADR-0055. |
| Merge commit for large PRs | Preserve git history for bisect/blame | PR #128 merged with merge commit, not squash. |

## Learnings

| Learning | Context |
|----------|---------|
| Supabase Branch DBs replay ALL migrations | Local DB has tables pre-existing, masking forward-reference issues. Must test fresh replay. |
| Migration timestamp = sort order | March 28 migration referencing April 22 table = failure. Timestamps must respect dependency order. |
| Duplicate migrations are silent locally | Same content at two timestamps works fine locally (idempotent), but Branch DB fails on duplicate schema_migrations PK. |
| REST health check is slow on Branch DBs | ~30s startup for REST service. Cosmetic, not blocking. Don't fail CI on this. |
| 8 iterations needed for legacy cleanup | Accumulated migration debt from months of parallel feature branches. Each fix revealed the next issue. |

## Known Issues / Debt

- Supabase Branch DB REST service slow startup (cosmetic warning)
- `claude-review` CI check always CANCELLED (not blocking, needs investigation)
- 1Password Service Account not yet created (needed for CI/CD automation)
- Docker services have no preview environment (accepted asymmetry)

## Next Steps

- Set up 1Password Service Account for CI/CD env sync automation
- Establish release cadence (currently ad-hoc)
- Consider CI workflow that auto-creates preview branch on development push
- PWA investigation (user raised, separate feature)
