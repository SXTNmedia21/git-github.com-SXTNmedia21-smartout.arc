---
title: "User-home git-handling changes — operator action required"
status: pending
created: 2026-05-04
updated: 2026-05-04
module: deployment
tags: [handoff, git, user-home, deploy-conductor, deploying-skill]
---

# User-home git-handling changes

Git-handling-rewrite (commit `139b39dc9`) ships changes to `development`. The following
changes require operator action because they live in `~/.claude/` (user-home, not in repo).

---

## 1. `~/.claude/skills/deploying/SKILL.md` — curation rule alignment (audit O1)

Current state: skill text says "edit in-place." Deploy-conductor agent says "propose first."
Per Reflection Protocol, both are correct in different contexts (NEW recurring → propose;
STALE → edit in-place). The `deploying` skill should explicitly say:

> Deploy-conductor is the primary curator of this skill. Per Learning Law:
> NEW recurring (≥2 RUNS.md) = propose to operator. STALE = edit in-place.
> DUPLICATE = consolidate. CONFIRMED = no action.

**Operator action:** edit `~/.claude/skills/deploying/SKILL.md` header to add curation rule statement.

---

## 2. `~/.claude/CLAUDE.md` (Pontus's private global) — git workflow cross-ref

Current Git Workflow section in user-home CLAUDE.md predates ADR-0265.

**Operator action:** add cross-ref to the Git Workflow section:

> Canonical sources: ADR-0265 (enforcement), repo `docs/protocols/DEPLOYMENT.md` (topology),
> repo `docs/journeys/JOURNEY-enforce-pipeline.md` (narrative). For project-specific overrides:
> see repo CLAUDE.md.

---

## 3. `~/.claude/scripts/promote-preview.sh` — confirm SHADOW status

Per ADR-0265 hard rule: agent never invokes global `~/.claude/scripts/promote-preview.sh`
directly. Always repo wrapper `./infra/scripts/promote-preview.sh`.

**Operator action:** verify global script comment header explicitly says:
"SHADOW — never invoke directly. Use repo wrapper `./infra/scripts/promote-preview.sh`."

---

## Linear tickets (queued for separate sorties)

- [ ] git-handling-doc-drift-prevention — extend `adr-contract-audit` to docs/skills/agent
      cross-coherence; ADR-0272 proposed; estimate 4-6h
- [ ] git-handling Phase 1.6 epic — 4 child tickets:
      - C9: ai-eval decision
      - C10: build-health-artifact
      - C11: claude-action overlap doc
      - G1: branch-name hook + §11.8 script-shadowing doc
- [ ] PREVIEW_E2E_KEY provisioning (plan v2 Phase 4 prereq)
- [ ] DEPLOY_TAP_WEBHOOK_URL n8n setup (ADR-0271 §2 prereq)
- [ ] Scenario K — preview hard-reset (operator-led; required before plan v2 dispatch)
- [ ] Vercel env-var sync (Pontus running 2026-05-04 — finds: 56 keys all 2026-04-06,
      2 duplicates on smartout-web, manifest baseline 64 → missing 8 keys)

---

## Learnings captured this session

- **L-0193:** pre-commit hook #7 myth — audit-map and council briefings claimed
  development-block; end-to-end hook-read falsified. Briefing claim survived 2 sessions.
  Cross-ref L-0117.
- **L-0194:** Agents drift on own knowledge bundles. Self-audit found ADR-0262→0265,
  F2/F3 status, dev SHA, audit-map path prefix. Reflection Protocol works retrospectively
  but doesn't catch silent staleness between runs.
- **L-0195:** KNOWLEDGE.md staleness creates agent-confusion vectors TODAY, not 6 months.
  Drift-prevention defer must NOT defer agent-knowledge updates.
