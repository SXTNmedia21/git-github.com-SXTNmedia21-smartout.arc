---
title: "Git Workflow — see ADR-0265 + DEPLOYMENT.md"
status: superseded
created: 2026-02-28
updated: 2026-05-04
module: cross-cutting
tags: [git, workflow, archived]
superseded_by: [ADR_0265]
---

# Git Workflow

> This page is superseded. The original Norwegian baseline (2026-02-28) is preserved at
> `docs/reference/archive/GIT-WORKFLOW-2026-02-28-original.md`.

For canonical git workflow:

- **Branch model + hard rules:** [ADR-0265](../decisions/0265-enforced-deployment-pipeline.md)
- **Topology + 14 required checks:** [DEPLOYMENT.md](../protocols/DEPLOYMENT.md)
- **HOP A / HOP B / drift narrative:** [JOURNEY-enforce-pipeline.md](../journeys/JOURNEY-enforce-pipeline.md)
- **Campaign merge-commit rule:** [ADR-0213](../decisions/0213-campaign-prs-use-merge-commit-not-squash.md)
- **Worktree discipline:** [ADR-0075](../decisions/0075-knowledge-system-consolidation.md)
- **Deploy execution:** `~/.claude/skills/deploying/SKILL.md` + `.claude/agents/deploy-conductor/`
