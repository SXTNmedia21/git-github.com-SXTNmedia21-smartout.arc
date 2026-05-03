---
title: "deploy-conductor — Run Log"
status: live
created: 2026-05-03
updated: 2026-05-03
---

# Run Log

Append-only log of every deploy-conductor invocation. The agent writes here automatically after each run as part of its self-learning loop. Never edit existing entries.

## Format (mandatory)

Every run entry uses this shape. Fail to follow it = self-learning loop is broken.

```
## <ISO-8601 timestamp> — <scenario letter A-J> — <one-line outcome>

**Operator:** <pontus|automated>
**Trigger:** <exact phrase or signal that started the run>
**SHA in/out:** <input SHA> → <output SHA or "no change">

### Gates (HOP A only)
| # | Gate | Result | Detail |
|---|---|---|---|
| 1 | branch-sync | ✅/❌ | <one line> |
| 2 | ci-green | ✅/❌ | <one line> |
| 3 | vercel-ready | ✅/❌ | <one line> |
| 4 | ff-possible | ✅/❌ | <one line> |
| 5 | smoke-probe | ✅/❌ | <one line> |
| 6 | lkg-tag | ✅/❌ | <one line> |

### Drift / smoke / CI snapshot
- drift-check: <green/N fails — first fail name>
- smoke result: <green/N red surfaces — list>
- CI status: <14/14 green | failed checks>

### Outcome
<one paragraph: what happened, whether operator was asked anything, what was done, what was deferred>

### Learnings (Learning Law — every run, no exceptions)
- NEW/CONFIRMED/STALE/DUPLICATE: <description> → <action proposed/taken>
- (repeat as needed, minimum 1 entry — "all gates green, baseline holds" is a valid CONFIRMED entry)

### Curation (what changed)
- STATE.md: <updated <field> from <X> to <Y> | no change>
- KNOWLEDGE.md: <updated <section> | no change>
- ROADMAP.md: <phase advanced | task struck | no change>
- PLAYBOOK.md: <scenario amended | no change>
- Skill `deploying`: <proposed addition | no change>
- ADR-0265: <amendment proposed | no change>

### Activity-log entry
<paste the message written via log-activity.sh — must mirror the outcome>
```

---

## Run history (newest first)

## 2026-05-03 18:30 +0200 — dry-run-A — full 6-gate dry-run against post-merge state

**Operator:** pontus
**Trigger:** "vi må testköra den här mer. Jag måste se att den går igenom alla tester."
**SHA in/out:** d13542620 → no change (dry-run only, no actual promote)

### Gates (dry-run, read-only)
| # | Gate | Result | Detail |
|---|---|---|---|
| 1 | branch-sync | ✅ | local d13542620 = origin/d13542620 |
| 2 | ci-green | ⏳ | 2 runs total, 1 green, 1 pending (CI on merge commit still building) |
| 3 | vercel-ready | ❌ | smartout-web CANCELED, smartout-landing CANCELED for SHA |
| 4 | ff-possible | ❌ | preview ahead of dev by 3543, dev ahead of preview by 734 — DIVERGED |
| 5 | smoke-probe (preview) | ❌ | Vercel web FAIL, Vercel landing FAIL on preview-branch URLs; Supabase REST + EFs alive |
| 6 | lkg-tag | n/a | would have been `lkg-preview-d1354262`; no remote tag exists |

### Drift / smoke / CI snapshot
- drift-check: ✅ green (manifest 64/64 baseline holds; env.ts traced)
- smoke (preview): ❌ RED — Vercel web + landing deploys gone for preview branch
- smoke (production, separate dry-run earlier): ✅ green — app.smartout.ai + smartout.ai + Supabase prod + prod EFs all alive
- CI on dev d13542620: 1 green + 1 pending

### Outcome

The pipe correctly blocks at multiple layers. This is not failure — it is the pipe doing its job. Three real findings:

1. **Preview branch is divergent** from development. 3543 unique commits on preview, 734 on dev. Pattern matches squash-merge ghost (memory: reference_squash_merge_recovery.md — Pontus has squash-merged campaign branches via GitHub UI 3x earlier; each leaves content-identical-but-ancestry-different commits on preview). Recovery is operator-led: temp-disable preview ruleset → `git reset --hard origin/development` → force-push → re-enable.

2. **Vercel deploys gone for preview branch.** smoke-probe.sh hit preview URLs and got 404/DNS-fail. Either Vercel deleted preview deployments after long inactivity, or branch-URL pattern changed. Smoke-probe baseline URLs may need refresh via Vercel API.

3. **CI still pending on merge commit.** Gate 2 would block until pending CI resolves. Operator must wait or investigate if stuck.

The wrapper would refuse to promote in this state. This is correct behavior. The 6 gates catch all three issues independently.

### Learnings (Learning Law)

- NEW: Preview-divergence is the single biggest blocker for first real promote — added Scenario K to PLAYBOOK with diagnose + recovery. Until preview is reset, no promote succeeds regardless of dev state.
- NEW: smoke-probe preview URL pattern is fragile. Hardcoded `smartout-web-git-preview-smartout.vercel.app` may not match Vercel's actual URL. Phase 1 task: read URL from Vercel API per Gate 3, not hardcode.
- CONFIRMED: Vercel API token works via `op run`; Gate 3 logic correct.
- CONFIRMED: drift-check green on baseline 64 holds across dev merge — no manifest drift introduced.
- CONFIRMED: production surfaces all alive (app.smartout.ai + smartout.ai + prod Supabase + prod EFs).
- STALE: Earlier STATE.md said "pipeline gap dev→preview: 725". Actual: 734 dev-ahead + 3543 preview-ahead = DIVERGED. The "gap" framing is wrong; correct framing is two-way divergence.
- NEW: Confirmation model — operator types "yes", agent runs `op run` itself. Boundary section in agent .md updated to document.

### Curation (what changed)
- STATE.md: pipeline-gap row updated to reflect divergence + last-verified bumped
- PLAYBOOK.md: NEW Scenario K (preview-divergence-recovery) added
- agent .md: Confirmation model section added under Boundaries
- Skill `deploying`: no change yet (recurrence required before curation per Learning Law)
- ROADMAP.md: smoke-probe URL fragility added as Phase 1 sub-task

### Activity-log entry
```
deploy-conductor dry-run-A: 6 gates against d13542620 — Gate 4 RED (preview diverged 3543 ahead + 734 behind), Gate 5 RED (preview Vercel deploys gone), Gate 2 PENDING. Pipe correctly blocks. Scenario K added. Operator action required: hard-reset preview ruleset.
```

---

<!-- New entries go here. Insert above this line. -->

---

## Curation rules (Learning Law applied to this log)

1. **NEW** entries that recur ≥ 2 times → MUST be curated into `~/.claude/skills/deploying/SKILL.md` as a new trap or rule. Append to relevant section, not to history.
2. **STALE** entries that confirm an existing skill claim is wrong → edit the skill IN PLACE, do not append. Update `updated:` timestamp.
3. **DUPLICATE** entries (same observation in 2+ places) → consolidate to one canonical location, delete the other.
4. **CONFIRMED** entries → no action; the log itself is the audit trail.

After every run, ask: "Is anything I just learned NEW or STALE?" If yes → propose curation in the next operator message before moving on.

---

## Triggers that REQUIRE a RUNS.md entry

- Any execution of `./infra/scripts/promote-preview.sh` (success OR fail)
- Any execution of `./infra/scripts/smoke-probe.sh` invoked by the agent (not by wrapper internally)
- Any execution of `./infra/scripts/drift-check.sh` invoked manually (not by heartbeat — heartbeat writes to activity-log instead)
- Any rollback proposal acted upon (Vercel, droplet, EF, migration)
- Any time the agent refuses to act (boundary violation, missing operator confirm, stale state)
- Any time CI red is diagnosed (Scenario F)
- Any time MIGRATIONS_FAILED is encountered (Scenario H)

## Triggers that do NOT require a RUNS.md entry

- Read-only status queries (Scenario J) — already lightweight
- Heartbeat-driven drift-check (already logged via heartbeat-notify.sh + activity-log)
- ADR coherence audits (logged by adr-contract-audit skill)

---

## Bootstrap entry — not a real run

```
## 2026-05-03 17:00 +0200 — bootstrap — agent created

**Operator:** pontus
**Trigger:** "lage en agent og strukturere den agenten i en mappe i agents"
**SHA in/out:** bf3ef5c10 → 9c2442382 (4 commits on feat/enforce-pipeline)

### Outcome
Agent + 4 knowledge files committed. Validated dry-runs:
- Vercel API token: HTTP 200 ✅
- drift-check --skip-droplet: green ✅
- smoke-probe production --skip-droplet: 4/4 surfaces alive ✅
- Gate 3 logic: returned CANCELED for current dev SHA — gate works correctly ✅

### Learnings
- NEW: agent folder pattern (`.claude/agents/<name>/<files>`) works for Smartout — Claude Code discovers entry .md, agent reads folder via tool calls. Document for future agents.
- NEW: self-learning loop must be encoded in agent identity, not just skill — added RUNS.md + reflection protocol on bootstrap.
- CONFIRMED: smoke-probe needs auth-aware reachability check (200/401/403 = alive); fixed in commit b3c786ecd before bootstrap.
- CONFIRMED: drift-check baseline 64 holds against current `infra/scripts/sync-env-to-vercel.sh`.
- STALE: skill `deploying` originally said "create new docs/protocols/DEPLOYMENT.md as live dashboard" — that conflicts with static topology role. Updated in this sortie's skill edit.

### Curation
- STATE.md: bootstrap snapshot written (725 dev→preview, 154/481 migrations w/o idempotency, 62 EFs / 52 config.toml = 10 gap, 102 E2E orphan)
- ROADMAP.md: Phase 0 marked active, F1 ✅ done, F2+F3 ❌ pending
- PLAYBOOK.md: 10 scenarios A-J written
- Skill `deploying`: enforced-pipeline section added; ADR-0265 referenced
- ADR-0265: drafted + accepted in branch

### Activity-log entry
"deploy-conductor agent created: 4 files in .claude/agents/deploy-conductor/, dry-runs validated, awaiting close-feature to merge into development"
```
